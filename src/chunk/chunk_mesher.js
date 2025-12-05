import * as THREE from 'three';
import { BLOCKS, BLOCK_FACES, FACE_VERTS, ATLAS_MAT_SOLID, ATLAS_MAT_TRANS, ATLAS_MAT_ALPHA_TEST, getAtlasUV, isFoliage, getBlockImagePixels } from '../blocks.js';
import { createExtrudedGeometry } from '../utils/geometry.js';

let torchGeoData = null;
const _dirs = [[1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1]];
const _colorCache = { r: 0, g: 0, b: 0 };

function isDoor(id) {
    return (id === BLOCKS.OAK_DOOR_BOTTOM || id === BLOCKS.OAK_DOOR_TOP || (id >= 75 && id <= 86));
}

function isStair(id) {
    return (id === BLOCKS.COBBLESTONE_STAIRS || id === BLOCKS.OAK_STAIRS);
}

export class ChunkMesher {
    constructor() {
        // Standard Minecraft Directional Shading
        // Right(+X), Left(-X), Top(+Y), Bottom(-Y), Front(+Z), Back(-Z)
        // E/W = 0.6, Top = 1.0, Bottom = 0.5, N/S = 0.8
        this.dirMults = [0.6, 0.6, 1.0, 0.5, 0.8, 0.8];
        this.uvOrder = [ [0,0], [1,0], [1,1], [0,1] ]; 
        
        // AO Multipliers (0 neighbors to 3 neighbors blocked)
        this.aoMults = [1.0, 0.8, 0.6, 0.4];

        // Reusable buffers to reduce GC
        this.geoSolid = { positions: [], normals: [], uvs: [], colors: [] };
        this.geoTrans = { positions: [], normals: [], uvs: [], colors: [] };
        this.geoFoliage = { positions: [], normals: [], uvs: [], colors: [] };
        this.geoNoShadow = { positions: [], normals: [], uvs: [], colors: [] };
    }

    getBiomeColor(temp, humidity, matName) {
        let r = 0.5, g = 0.8, b = 0.4; // Default Green

        // Normalize inputs (-1 to 1) -> (0 to 1)
        const t = (temp + 1) * 0.5; 
        const h = (humidity + 1) * 0.5;

        // More saturated biome colors
        // Increase color variation and vibrancy
        const noiseVar = (Math.sin(t * 10) + Math.cos(h * 10)) * 0.1;

        if (t < 0.2) { // Snowy/Cold
            r = 0.6 + noiseVar; g = 0.9 + noiseVar; b = 0.9; // Brighter Ice Blue
        } else if (t > 0.8 && h < 0.3) { // Desert/Dry
            r = 0.8 + noiseVar; g = 0.7 + noiseVar; b = 0.4; // Dull Yellow-Green (Alpha Desert)
        } else {
            // "Alpha" Green: Vibrant, Neon-ish but smooth gradient
            // High temp/humidity = Neon Green
            // Low temp/humid = Dull Green
            
            const saturation = t * h; 
            
            // Interpolate between "Dull" (0.5, 0.6, 0.4) and "Neon" (0.3, 1.0, 0.1)
            // But keep it high brightness overall
            
            // Alpha grass approximation
            // Temp (0..1) * Humidity (0..1) triangle map usually
            
            // Base Vibrant Green
            const baseR = 0.4;
            const baseG = 1.0; 
            const baseB = 0.1;
            
            // Modify by temperature
            // Cooler -> Blueish/Darker
            const tempMod = 1.0 - t; 
            
            r = baseR - (tempMod * 0.1);
            g = baseG - (tempMod * 0.2);
            b = baseB + (tempMod * 0.3);
            
            // Modify by humidity
            // Drier -> Yellow/Brown
            const humidMod = 1.0 - h;
            
            r += humidMod * 0.2;
            g -= humidMod * 0.3;
            b -= humidMod * 0.1;
            
            // Add slight randomness to break uniformity
            r += noiseVar * 0.05;
            g += noiseVar * 0.05;
            b += noiseVar * 0.05;
        }
        
        // Block specific overrides
        if (matName === 'water') {
            r = 1.0; g = 1.0; b = 1.0; // Reset
            if (t < 0.3) { // Frozen/Cold water
                r *= 0.6; g *= 0.6; b *= 0.9; 
            } else if (h > 0.6) { // Swampy water
                r *= 0.4; g *= 0.6; b *= 0.4; 
            } else {
                // Brighter Blue for general water to allow texture details to show
                r = 0.6; g = 0.8; b = 1.0;
            }
        }
        
        // Biome tints for new leaves
        // Use predefined constants closer to MC
        if (matName === 'birch_leaves') {
            r = 0.5; g = 0.65; b = 0.35; // Birch is consistent forest green
        } else if (matName === 'spruce_leaves') {
            r = 0.38; g = 0.6; b = 0.38; // Evergreen / Darker
        } else if (matName === 'jungle_leaves') {
            r = 0.3; g = 0.8; b = 0.1; // Lush bright green
        } else if (matName === 'acacia_leaves') {
            r = 0.5; g = 0.5; b = 0.1; // Dull/Yellowish
        } else if (matName === 'dark_oak_leaves') {
            r = 0.2; g = 0.4; b = 0.1; // Very dark green
        }

        _colorCache.r = r; _colorCache.g = g; _colorCache.b = b;
        return _colorCache;
    }

    getSmoothedBiome(terrainGen, wx, wz) {
        // Optimization: Disable smoothing for performance to reduce noise calculations
        // 1 sample instead of 9 per column
        return terrainGen.getBiomeData(wx, wz);
    }

    clearBuffers(geo) {
        geo.positions.length = 0;
        geo.normals.length = 0;
        geo.uvs.length = 0;
        geo.colors.length = 0;
    }

    // New helper: Calculate Ambient Occlusion for a specific vertex
    // Returns integer 0-3 representing how many neighboring blocks occlude light
    vertexAO(chunk, x, y, z, px, py, pz, faceDir) {
        // x,y,z is the block position
        // px,py,pz is the vertex offset (0 or 1) relative to block
        // faceDir is index 0-5
        
        // Transform vertex offset to neighbor checks
        // We need the two blocks adjacent to the vertex ON THE FACE PLANE, and the corner block
        
        let side1 = 0, side2 = 0, corner = 0;
        
        // Determine offsets based on face
        // We look at the layer *above* the face (where the light comes from for this face)
        const dx = _dirs[faceDir][0];
        const dy = _dirs[faceDir][1];
        const dz = _dirs[faceDir][2];
        
        const nx = x + dx;
        const ny = y + dy;
        const nz = z + dz;
        
        // Relative coords on the face plane
        // E.g. Top Face (+Y). Vertex 0,0 (BL).
        // Neighbors are (-1, 0), (0, -1), (-1, -1) relative to nx, ny, nz
        
        // Mapping (vertex 0/1 logic to offsets -1/0/1)
        // px, py, pz are 0 or 1.
        // If px is 0, we check x-1. If px is 1, we check x+1.
        
        let ox = 0, oy = 0, oz = 0;
        let ox2 = 0, oy2 = 0, oz2 = 0;
        
        if (dx !== 0) { // Side faces X
            // Check Y and Z neighbors
            oy = (py === 0) ? -1 : 1;
            oz = (pz === 0) ? -1 : 1;
            
            // Side 1: (nx, ny + oy, nz)
            // Side 2: (nx, ny, nz + oz)
            // Corner: (nx, ny + oy, nz + oz)
            
            if (chunk.isSolidBlock(nx, ny + oy, nz)) side1 = 1;
            if (chunk.isSolidBlock(nx, ny, nz + oz)) side2 = 1;
            if (side1 && side2) corner = 1;
            else if (chunk.isSolidBlock(nx, ny + oy, nz + oz)) corner = 1;
        } else if (dy !== 0) { // Top/Bottom faces Y
            // Check X and Z
            ox = (px === 0) ? -1 : 1;
            oz = (pz === 0) ? -1 : 1;
            
            if (chunk.isSolidBlock(nx + ox, ny, nz)) side1 = 1;
            if (chunk.isSolidBlock(nx, ny, nz + oz)) side2 = 1;
            if (side1 && side2) corner = 1;
            else if (chunk.isSolidBlock(nx + ox, ny, nz + oz)) corner = 1;
        } else { // Front/Back faces Z
            // Check X and Y
            ox = (px === 0) ? -1 : 1;
            oy = (py === 0) ? -1 : 1;
            
            if (chunk.isSolidBlock(nx + ox, ny, nz)) side1 = 1;
            if (chunk.isSolidBlock(nx, ny + oy, nz)) side2 = 1;
            if (side1 && side2) corner = 1;
            else if (chunk.isSolidBlock(nx + ox, ny + oy, nz)) corner = 1;
        }
        
        return side1 + side2 + corner;
    }

    buildSection(chunk, sectionY, meshGroup) {
        meshGroup.traverse(child => {
            if (child.geometry) child.geometry.dispose();
        });
        meshGroup.clear();

        const minY = sectionY * 16;
        const maxY = minY + 16;

        // Pre-fetch neighbor chunks including diagonals to avoid Map lookups in inner loop
        const getC = (dx, dz) => chunk.world.getChunk(chunk.cx + dx, chunk.cz + dz);
        const neighbors = {
            px: getC(1, 0),
            nx: getC(-1, 0),
            pz: getC(0, 1),
            nz: getC(0, -1),
            pxpz: getC(1, 1),
            pxnz: getC(1, -1),
            nxpz: getC(-1, 1),
            nxnz: getC(-1, -1)
        };

        // Use reused buffers
        this.clearBuffers(this.geoSolid);
        this.clearBuffers(this.geoTrans);
        this.clearBuffers(this.geoFoliage);
        this.clearBuffers(this.geoNoShadow);
        
        const geoSolid = this.geoSolid;
        const geoTrans = this.geoTrans;
        const geoFoliage = this.geoFoliage;
        const geoNoShadow = this.geoNoShadow;

        const worldXBase = chunk.cx * chunk.size;
        const worldZBase = chunk.cz * chunk.size;

        // Optimized solidity check using pre-fetched neighbors
        chunk.isSolidBlock = (x, y, z) => {
            if (y < 0 || y >= chunk.height) return false;
            
            let targetChunk = chunk;
            let lx = x;
            let lz = z;

            // Handle Boundaries
            if (x < 0) {
                lx = x + 16;
                if (z < 0) { lz = z + 16; targetChunk = neighbors.nxnz; }
                else if (z >= 16) { lz = z - 16; targetChunk = neighbors.nxpz; }
                else targetChunk = neighbors.nx;
            } else if (x >= 16) {
                lx = x - 16;
                if (z < 0) { lz = z + 16; targetChunk = neighbors.pxnz; }
                else if (z >= 16) { lz = z - 16; targetChunk = neighbors.pxpz; }
                else targetChunk = neighbors.px;
            } else {
                if (z < 0) { lz = z + 16; targetChunk = neighbors.nz; }
                else if (z >= 16) { lz = z - 16; targetChunk = neighbors.pz; }
            }
            
            if (targetChunk && targetChunk.generated) {
                // Inline isSolid check logic
                const id = targetChunk.data[lx + 16 * (lz + 16 * y)];
                // Quick checks for common non-solids
                if (id === BLOCKS.AIR) return false;
                if (id === BLOCKS.STONE || id === BLOCKS.DIRT || id === BLOCKS.GRASS) return true; // Fast path for common solids
                
                return (id !== BLOCKS.WATER && id !== BLOCKS.LAVA && !isFoliage(id) && id !== BLOCKS.GLASS && id !== BLOCKS.LEAVES && id !== -1);
            }
            
            return false; 
        };

        for (let x = 0; x < chunk.size; x++) {
            for (let z = 0; z < chunk.size; z++) {
                const wx = worldXBase + x;
                const wz = worldZBase + z;

                // Optimization: Cache biome data for this column
                // Use smoothed biome data for vertex colors
                const colBiome = this.getSmoothedBiome(chunk.terrainGen, wx, wz);

                for (let y = minY; y < maxY; y++) {
                    const idx = chunk.idx(x, y, z);
                    const id = chunk.data[idx];
                    const meta = chunk.metadata[idx];

                    if (id === BLOCKS.AIR) continue;
                    
                    if (id === BLOCKS.TORCH) {
                        this.addTorch(chunk, x, y, z, id, geoNoShadow, meta);
                        continue;
                    }

                    if (id === BLOCKS.FIRE) {
                        this.addFire(chunk, x, y, z, id, geoNoShadow);
                        continue;
                    }

                    // Fences (Move before foliage check to prevent cross rendering)
                    if (id === BLOCKS.OAK_FENCE) {
                        this.addFence(chunk, x, y, z, id, geoSolid);
                        continue;
                    }
                    
                    // Glass Panes
                    if (id === BLOCKS.GLASS_PANE) {
                        this.addPane(chunk, x, y, z, id, geoNoShadow);
                        continue;
                    }

                    if (id === BLOCKS.NETHER_PORTAL) {
                        this.addPortal(chunk, x, y, z, id, geoTrans); // Portal is transparent
                        continue;
                    }

                    if (isFoliage(id) && !isDoor(id)) {
                        // Tall Grass uses geoNoShadow per request
                        const targetGeo = (id === BLOCKS.TALL_GRASS_BOTTOM || id === BLOCKS.TALL_GRASS_TOP) ? geoNoShadow : geoFoliage;
                        this.addFoliage(chunk, x, y, z, id, targetGeo, colBiome);
                        continue;
                    }

                    const isWater = (id === BLOCKS.WATER);
                    const isLava = (id === BLOCKS.LAVA);
                    let facesDef = BLOCK_FACES[id]; 
                    if (!facesDef) continue;

                    // Door Logic
                    if (id === BLOCKS.OAK_DOOR_BOTTOM || id === BLOCKS.OAK_DOOR_TOP ||
                        (id >= 75 && id <= 86)) {
                        this.addDoor(chunk, x, y, z, id, geoNoShadow, chunk.metadata[chunk.idx(x, y, z)]);
                        continue;
                    }

                    // Slabs
                    if (id === BLOCKS.COBBLESTONE_SLAB || id === BLOCKS.OAK_SLAB) {
                        this.addSlab(chunk, x, y, z, id, geoSolid, chunk.metadata[chunk.idx(x, y, z)]);
                        continue;
                    }

                    // Stairs
                    if (id === BLOCKS.COBBLESTONE_STAIRS || id === BLOCKS.OAK_STAIRS) {
                        this.addStairs(chunk, x, y, z, id, geoSolid, meta);
                        continue;
                    }

                    // Fences
                    if (id === BLOCKS.OAK_FENCE) {
                        this.addFence(chunk, x, y, z, id, geoSolid);
                        continue;
                    }

                    // Handle Block Rotation (Furnace)
                    if (id === BLOCKS.FURNACE || id === BLOCKS.FURNACE_ON || id === BLOCKS.PUMPKIN) {
                        const meta = chunk.metadata[chunk.idx(x, y, z)];
                        
                        // Create a shallow copy of the array to modify faces for this specific block instance
                        // This prevents mutating the global constant array
                        if (Array.isArray(facesDef)) {
                            facesDef = [...facesDef];
                            
                            // Pumpkin/Furnace mapping
                            // [Right, Left, Top, Bottom, Front, Back]
                            // Default: Side, Side, Top, Top, Front, Side
                            
                            const sideTex = facesDef[0]; 
                            const topTex = facesDef[2];
                            const frontTex = facesDef[4]; 
                            
                            // Reset horizontal sides to generic side texture
                            facesDef[0] = sideTex;
                            facesDef[1] = sideTex;
                            facesDef[4] = sideTex;
                            facesDef[5] = sideTex;
                            
                            // Apply front face based on meta
                            if (meta === 3) facesDef[0] = frontTex; // +X (Right)
                            else if (meta === 1) facesDef[1] = frontTex; // -X (Left)
                            else if (meta === 0) facesDef[4] = frontTex; // +Z (Front)
                            else if (meta === 2) facesDef[5] = frontTex; // -Z (Back)
                        }
                    }

                    for (let i = 0; i < 6; i++) {
                        const dx = _dirs[i][0], dy = _dirs[i][1], dz = _dirs[i][2];
                        const nx = x + dx, ny = y + dy, nz = z + dz;
                        let drawFace = false;
                        let nId = BLOCKS.AIR;

                        // Optimized Neighbor Lookup using cached chunks
                        if (ny >= 0 && ny < chunk.height) {
                            if (nx >= 0 && nx < chunk.size && nz >= 0 && nz < chunk.size) {
                                nId = chunk.data[chunk.idx(nx, ny, nz)];
                            } else {
                                // Boundary check with pre-fetched neighbors
                                let nChunk = null;
                                let lx = nx;
                                let lz = nz;
                                
                                if (nx < 0) { nChunk = neighbors.nx; lx += 16; }
                                else if (nx >= 16) { nChunk = neighbors.px; lx -= 16; }
                                
                                if (nz < 0) { nChunk = neighbors.nz; lz += 16; }
                                else if (nz >= 16) { nChunk = neighbors.pz; lz -= 16; }
                                
                                if (nChunk && nChunk.generated) {
                                    nId = nChunk.data[nChunk.idx(lx, ny, lz)];
                                } else {
                                    nId = -1; // Unloaded
                                }
                            }
                        } else {
                            nId = BLOCKS.AIR; // Top/Bottom of world
                        }
                        
                        if (nId === -1) {
                            if (isWater || isLava) {
                                drawFace = false; // Hide liquid borders at world edge
                                continue;
                            }
                        }

                        const isCactus = (id === BLOCKS.CACTUS);
                        const isFarm = (id === BLOCKS.FARMLAND || id === BLOCKS.FARMLAND_MOIST);

                        // Helper for transparency check
                        // Blocks that reveal the face behind them
                        const isNeighborTransparent = (nId === BLOCKS.AIR || 
                                                     nId === BLOCKS.WATER || 
                                                     nId === BLOCKS.LAVA || 
                                                     nId === BLOCKS.LEAVES || 
                                                     nId === BLOCKS.GLASS ||
                                                     nId === BLOCKS.SUGAR_CANE || 
                                                     nId === BLOCKS.CACTUS || 
                                                     // Update transparent checks to include all door parts
                                                     (nId >= 41 && nId <= 42) || // Oak Door
                                                     (nId >= 75 && nId <= 86) || // Other Doors
                                                     nId === BLOCKS.TORCH ||
                                                     nId === BLOCKS.FARMLAND ||
                                                     nId === BLOCKS.FARMLAND_MOIST ||
                                                     nId === BLOCKS.FIRE ||
                                                     nId === BLOCKS.NETHER_PORTAL ||
                                                     isFoliage(nId) ||
                                                     // Treat new shapes as transparent for neighbors
                                                     nId === BLOCKS.COBBLESTONE_SLAB || nId === BLOCKS.OAK_SLAB ||
                                                     nId === BLOCKS.COBBLESTONE_STAIRS || nId === BLOCKS.OAK_STAIRS ||
                                                     nId === BLOCKS.OAK_FENCE ||
                                                     nId === BLOCKS.GLASS_PANE ||
                                                     nId === -1);

                        if (isWater) {
                            // Water draws face if neighbor is air or transparent block (but not water)
                            if (isNeighborTransparent && nId !== BLOCKS.WATER) drawFace = true;
                        } else if (isLava) {
                            if (isNeighborTransparent && nId !== BLOCKS.LAVA) drawFace = true;
                        } else {
                            if (isNeighborTransparent) drawFace = true;
                        }
                        // Don't draw water faces between water blocks
                        if (isWater && nId === BLOCKS.WATER) drawFace = false;
                        if (isLava && nId === BLOCKS.LAVA) drawFace = false;

                        // Custom Culling Logic for CACTUS
                        if (isCactus) {
                           if (i !== 2 && i !== 3) { // Only apply this override to side faces
                               const isNeighborSolidOrCactus = (!isNeighborTransparent && nId !== BLOCKS.CACTUS);
                               if (isNeighborSolidOrCactus) drawFace = true;
                           }
                           if (i === 3 && (nId === BLOCKS.DIRT || nId === BLOCKS.SAND || nId === BLOCKS.TERRACOTTA)) {
                               drawFace = true;
                           }
                        }
                        
                        // Farmland Culling: Always draw top, bottom? 
                        // It is handled by isNeighborTransparent logic mostly.
                        // Neighbors see farmland as transparent, so they draw their sides.
                        // Farmland sees neighbors as solid (unless they are transparent), so it might NOT draw its sides if neighbor is full block.
                        // But since farmland is smaller, we ALWAYS want to see its sides if the neighbor is transparent.
                        // If neighbor is solid full block, we don't need to see farmland side because it's embedded.
                        // But wait, if neighbor is air, we see it.
                        // What if neighbor is a slab/farmland?
                        // Standard culling works fine for the farmland ITSELF (it won't draw side if blocked by full block).
                        // But we need to ensure the TOP face is shifted down.

                        // Fix Glass Culling
                        if (id === BLOCKS.GLASS && nId === BLOCKS.GLASS) drawFace = false;

                        if (!drawFace) continue;

                        let matName = 'stone';
                        if (typeof facesDef === 'string') matName = facesDef;
                        else if (Array.isArray(facesDef)) matName = facesDef[i] || 'stone';
                        
                        // Safety: If matName is missing (undefined/null), fallback
                        if (!matName) matName = 'stone';

                        // Override matName for Lava Source to use Still texture
                        if (id === BLOCKS.LAVA && chunk.metadata[idx] === 7) {
                            matName = 'lava_still';
                        }

                        // Lava is now solid/opaque, only water uses transparent pass
                        // Glass uses NoShadow (Cutout/AlphaTest)
                        const targetGeo = (isWater) ? geoTrans : (id === BLOCKS.GLASS ? geoNoShadow : geoSolid);

                        let lightLvl = 0;
                        if (ny >= 0 && ny < chunk.height) {
                            if (nx >= 0 && nx < chunk.size && nz >= 0 && nz < chunk.size) {
                                lightLvl = chunk.lightMap[chunk.idx(nx, ny, nz)];
                            } else {
                                // Boundary Light Lookup
                                let nChunk = null;
                                let lx = nx;
                                let lz = nz;
                                
                                if (nx < 0) { nChunk = neighbors.nx; lx += 16; }
                                else if (nx >= 16) { nChunk = neighbors.px; lx -= 16; }
                                
                                if (nz < 0) { nChunk = neighbors.nz; lz += 16; }
                                else if (nz >= 16) { nChunk = neighbors.pz; lz -= 16; }
                                
                                if (nChunk && nChunk.generated) {
                                    lightLvl = nChunk.lightMap[nChunk.idx(lx, ny, lz)];
                                } else {
                                    // Fallback: Use light from block above as heuristic to guess ambient exposure
                                    // This prevents glowing cave walls at chunk borders where neighbor is missing
                                    const aboveY = Math.min(ny + 1, chunk.height - 1);
                                    lightLvl = chunk.lightMap[chunk.idx(x, aboveY, z)];
                                }
                            }
                        } else {
                            lightLvl = 15; // Sky
                        }

                        const baseLight = Math.pow(0.85, 15 - lightLvl); 
                        const dirFactor = this.dirMults[i];
                        const vertData = FACE_VERTS[i];
                        
                        // Fix: Check corner heights for ALL fluid faces if they are at the top level
                        // This ensures side faces squash down to match the top surface
                        let applyFluidHeight = (isWater || isLava); 

                        const atlasData = getAtlasUV(matName);

                        const indices = [0, 1, 2, 0, 2, 3];
                        for (const idx of indices) {
                            const lx = vertData[idx*3];
                            const ly = vertData[idx*3+1];
                            const lz = vertData[idx*3+2];

                            let vx = lx + x;
                            let vy = ly + y;
                            let vz = lz + z;

                            // Calculate AO
                            const aoVal = this.vertexAO(chunk, x, y, z, lx, ly, lz, i);
                            const aoFactor = this.aoMults[aoVal];

                            if (id === BLOCKS.CACTUS) {
                                const inset = 0.0625;
                                if (lx === 0) vx = x + inset;
                                else if (lx === 1) vx = x + 1 - inset;
                                if (lz === 0) vz = z + inset;
                                else if (lz === 1) vz = z + 1 - inset;
                            }
                            
                            if (isFarm) {
                                // 2 pixels smaller = 14/16 height = 0.875
                                const h = 14/16;
                                if (ly === 1) {
                                    vy = y + h;
                                }
                            }

                            let localV = this.uvOrder[idx][1];

                            if (applyFluidHeight && ly === 1) {
                                const cornerWx = worldXBase + vx;
                                const cornerWz = worldZBase + vz;
                                const h = chunk.getCornerWaterHeight(cornerWx, y, cornerWz, id);
                                vy = y + h; 
                                // Crop texture instead of squashing
                                if (i !== 2) localV = h;
                            }

                            targetGeo.positions.push(vx, vy, vz);
                            targetGeo.normals.push(dx, dy, dz);

                            const localU = this.uvOrder[idx][0];
                            
                            // UV Padding to prevent bleeding artifacts
                            const pad = 0.0001; 
                            const u = atlasData.u + pad + localU * (atlasData.w - 2 * pad);
                            const v = atlasData.v + pad + localV * (atlasData.h - 2 * pad);
                            
                            targetGeo.uvs.push(u, v);

                            // Apply AO to lighting
                            const finalLight = Math.min(1, baseLight * dirFactor * aoFactor);
                            
                            // Lowered minimum brightness to allow deeper shadows as requested
                            // MODIFIED: Increase base brightness in Nether to simulate ambient heat/fog scattering
                            let c = Math.max(0.02, finalLight);
                            
                            if (chunk.dimension === 'nether') {
                                c = Math.max(0.3, finalLight); // Brighter ambient in Nether
                            }

                            let r = c, g = c, b = c;
                            
                            // Full bright blocks
                            if (id === BLOCKS.GLOWSTONE || id === BLOCKS.LAVA || id === BLOCKS.MAGMA) {
                                r = 1.0; g = 1.0; b = 1.0;
                            }

                            // Apply Biome Coloring
                            if (matName === 'leaves' || matName === 'grass_top' || matName === 'water' || matName === 'sugar_cane' || matName === 'grass_plant' || matName === 'tall_grass_bottom' || matName === 'tall_grass_top' || matName.includes('leaves')) {
                                const biomeTint = this.getBiomeColor(colBiome.temp, colBiome.humidity, matName);
                                
                                // Special hardcoded override for water based on riverNoise/legacy logic
                                if (matName === 'water') {
                                    // Make it even bluer in rivers? No, keep it consistent but deep blue
                                    r = biomeTint.r;
                                    g = biomeTint.g;
                                    b = biomeTint.b;
                                } else {
                                    r *= biomeTint.r;
                                    g *= biomeTint.g;
                                    b *= biomeTint.b;
                                }
                            }
                            targetGeo.colors.push(r, g, b);
                        }
                    }
                }
            }
        }

        this.createMesh(geoSolid, ATLAS_MAT_SOLID, meshGroup, true);
        this.createMesh(geoTrans, ATLAS_MAT_TRANS, meshGroup, false);
        this.createMesh(geoFoliage, ATLAS_MAT_ALPHA_TEST, meshGroup, true);
        this.createMesh(geoNoShadow, ATLAS_MAT_ALPHA_TEST, meshGroup, false); // No Shadow
    }

    addTorch(chunk, x, y, z, id, geo, meta) {
        const matName = BLOCK_FACES[id];
        const pixels = getBlockImagePixels(matName);
        if (!pixels) return;

        const atlasData = getAtlasUV(matName);
        const w = pixels.width;
        const h = pixels.height;
        const data = pixels.data;
        
        // Torch Placement Logic
        // 1: East, 2: West, 3: South, 4: North, 5: Top
        let cx = x + 0.5;
        let cy = y;
        let cz = z + 0.5;
        
        const wallOffset = 0.35;
        const upOffset = 0.2;
        
        const rot = new THREE.Euler();
        const base = new THREE.Vector3(cx, cy, cz);
        
        if (meta === 1) { // East Wall (Pointing West)
            base.x -= wallOffset; base.y += upOffset;
            rot.z = -Math.PI / 5;
        } else if (meta === 2) { // West Wall
            base.x += wallOffset; base.y += upOffset;
            rot.z = Math.PI / 5;
        } else if (meta === 3) { // South Wall
            base.z -= wallOffset; base.y += upOffset;
            rot.x = Math.PI / 5;
        } else if (meta === 4) { // North Wall
            base.z += wallOffset; base.y += upOffset;
            rot.x = -Math.PI / 5;
        }
        
        const c = 1.0;
        const pushQuad = (v1, v2, v3, v4, n, u, v, uw, vh) => {
             const transform = (vec) => vec.clone().applyEuler(rot).add(base);
             const tv1 = transform(v1);
             const tv2 = transform(v2);
             const tv3 = transform(v3);
             const tv4 = transform(v4);
             const tn = n.clone().applyEuler(rot);
             
             const verts = [tv1, tv2, tv3, tv4];
             const inds = [0, 1, 2, 0, 2, 3]; 
             
             for(const i of inds) {
                 const vert = verts[i];
                 geo.positions.push(vert.x, vert.y, vert.z);
                 geo.normals.push(tn.x, tn.y, tn.z);
                 
                 const finalU = atlasData.u + (u + this.uvOrder[i][0]*uw) * atlasData.w;
                 const finalV = atlasData.v + (v + this.uvOrder[i][1]*vh) * atlasData.h;
                 
                 geo.uvs.push(finalU, finalV);
                 geo.colors.push(c, c, c);
             }
        };

        const isSolid = (px, py) => {
            if (px < 0 || px >= 16 || py < 0 || py >= 16) return false;
            return data[(py*16 + px)*4 + 3] > 128;
        };

        for(let py=0; py<16; py++) {
            for(let px=0; px<16; px++) {
                if (!isSolid(px, py)) continue;

                const minX = (px - 8) / 16;
                const maxX = (px - 7) / 16;
                const minY = (15 - py) / 16;
                const maxY = (16 - py) / 16;
                const minZ = -1/16;
                const maxZ = 1/16;
                
                const u = px / 16;
                const v = (15 - py) / 16;
                const uw = 1/16;
                const vh = 1/16;
                
                const v000 = new THREE.Vector3(minX, minY, minZ);
                const v100 = new THREE.Vector3(maxX, minY, minZ);
                const v110 = new THREE.Vector3(maxX, maxY, minZ);
                const v010 = new THREE.Vector3(minX, maxY, minZ);
                const v001 = new THREE.Vector3(minX, minY, maxZ);
                const v101 = new THREE.Vector3(maxX, minY, maxZ);
                const v111 = new THREE.Vector3(maxX, maxY, maxZ);
                const v011 = new THREE.Vector3(minX, maxY, maxZ);
                
                if (!isSolid(px, py-1)) pushQuad(v011, v111, v110, v010, new THREE.Vector3(0,1,0), u, v, uw, vh); // Top
                if (!isSolid(px, py+1)) pushQuad(v000, v100, v101, v001, new THREE.Vector3(0,-1,0), u, v, uw, vh); // Bottom
                if (!isSolid(px-1, py)) pushQuad(v000, v001, v011, v010, new THREE.Vector3(-1,0,0), u, v, uw, vh); // Left
                if (!isSolid(px+1, py)) pushQuad(v101, v100, v110, v111, new THREE.Vector3(1,0,0), u, v, uw, vh); // Right
                
                pushQuad(v001, v101, v111, v011, new THREE.Vector3(0,0,1), u, v, uw, vh); // Front
                pushQuad(v100, v000, v010, v110, new THREE.Vector3(0,0,-1), u, v, uw, vh); // Back
            }
        }
    }

    addFoliage(chunk, x, y, z, id, geoFoliage, colBiome) {
        const lightLvl = chunk.getLight(x, y, z);
        const baseLight = Math.pow(0.85, 15 - lightLvl);
        const finalLight = Math.min(1, baseLight); 
        let c = Math.max(0.02, finalLight); // Darker floor

        let matName = BLOCK_FACES[id];
        if (id === BLOCKS.WHEAT) {
            const meta = chunk.metadata[chunk.idx(x, y, z)];
            matName = `wheat_stage_${Math.min(7, Math.max(0, meta))}`;
        }

        const atlasData = getAtlasUV(matName);
        
        // Calculate Tint
        let tr = c, tg = c, tb = c;
        if (id === BLOCKS.SUGAR_CANE || id === BLOCKS.GRASS_PLANT || id === BLOCKS.TALL_GRASS_BOTTOM || id === BLOCKS.TALL_GRASS_TOP) {
             const tintName = (id === BLOCKS.SUGAR_CANE) ? 'sugar_cane' : 'grass_top';
             const tint = this.getBiomeColor(colBiome.temp, colBiome.humidity, tintName);
             tr *= tint.r; tg *= tint.g; tb *= tint.b;
        }

        const pushQuad = (v1, v2, v3, v4, n) => {
             const verts = [v1, v2, v3, v4];
             const inds = [0, 1, 2, 0, 2, 3]; 
             for(const i of inds) {
                 const v = verts[i];
                 geoFoliage.positions.push(v[0], v[1], v[2]);
                 geoFoliage.normals.push(n[0], n[1], n[2]);
                 const localU = this.uvOrder[i][0];
                 const localV = this.uvOrder[i][1];
                 geoFoliage.uvs.push(atlasData.u + localU * atlasData.w, atlasData.v + localV * atlasData.h);
                 geoFoliage.colors.push(tr, tg, tb);
             }
        };

        const offset = 0.15; // Inset
        const vx = x, vy = y, vz = z;

        // Plane A
        pushQuad(
            [vx + offset, vy, vz + offset],
            [vx + 1 - offset, vy, vz + 1 - offset],
            [vx + 1 - offset, vy + 1, vz + 1 - offset],
            [vx + offset, vy + 1, vz + offset],
            [0.7, 0, 0.7] // Approx Normal
        );
        // Plane B
        pushQuad(
            [vx + offset, vy, vz + 1 - offset],
            [vx + 1 - offset, vy, vz + offset],
            [vx + 1 - offset, vy + 1, vz + offset],
            [vx + offset, vy + 1, vz + 1 - offset],
            [0.7, 0, -0.7]
        );
    }

    addFire(chunk, x, y, z, id, geo) {
        const lightLvl = 15; // Fire is bright
        const c = 1.0; 

        const matName = 'fire';
        const atlasData = getAtlasUV(matName);
        
        const pushQuad = (v1, v2, v3, v4, n) => {
             const verts = [v1, v2, v3, v4];
             const inds = [0, 1, 2, 0, 2, 3]; 
             for(const i of inds) {
                 const v = verts[i];
                 geo.positions.push(v[0], v[1], v[2]);
                 geo.normals.push(n[0], n[1], n[2]);
                 const localU = this.uvOrder[i][0];
                 const localV = this.uvOrder[i][1];
                 geo.uvs.push(atlasData.u + localU * atlasData.w, atlasData.v + localV * atlasData.h);
                 geo.colors.push(c, c, c);
             }
        };

        const vx = x, vy = y, vz = z;
        
        // 1. Foliage Cross Pattern
        const offset = 0.2; // Inset slightly more
        
        // Plane A (Diagonal 1)
        pushQuad(
            [vx + offset, vy, vz + offset],
            [vx + 1 - offset, vy, vz + 1 - offset],
            [vx + 1 - offset, vy + 1, vz + 1 - offset],
            [vx + offset, vy + 1, vz + offset],
            [0.7, 0, 0.7] 
        );
        
        // Plane A Back
        pushQuad(
            [vx + offset, vy + 1, vz + offset],
            [vx + 1 - offset, vy + 1, vz + 1 - offset],
            [vx + 1 - offset, vy, vz + 1 - offset],
            [vx + offset, vy, vz + offset],
            [-0.7, 0, -0.7]
        );
        
        // Plane B (Diagonal 2)
        pushQuad(
            [vx + offset, vy, vz + 1 - offset],
            [vx + 1 - offset, vy, vz + offset],
            [vx + 1 - offset, vy + 1, vz + offset],
            [vx + offset, vy + 1, vz + 1 - offset],
            [0.7, 0, -0.7]
        );
        
        // Plane B Back
        pushQuad(
            [vx + offset, vy + 1, vz + 1 - offset],
            [vx + 1 - offset, vy + 1, vz + offset],
            [vx + 1 - offset, vy, vz + offset],
            [vx + offset, vy, vz + 1 - offset],
            [-0.7, 0, 0.7]
        );
    }

    addPortal(chunk, x, y, z, id, geo) {
        const c = 1.0; 
        const matName = 'nether_portal';
        const atlasData = getAtlasUV(matName);
        
        const pushQuad = (v1, v2, v3, v4, n) => {
             const verts = [v1, v2, v3, v4];
             const inds = [0, 1, 2, 0, 2, 3]; 
             for(const i of inds) {
                 const v = verts[i];
                 geo.positions.push(v[0], v[1], v[2]);
                 geo.normals.push(n[0], n[1], n[2]);
                 // Full UV for portal frame
                 const localU = this.uvOrder[i][0];
                 const localV = this.uvOrder[i][1];
                 
                 const texU = atlasData.u + localU * atlasData.w;
                 const texV = atlasData.v + localV * atlasData.h;
                 
                 geo.uvs.push(texU, texV);
                 geo.colors.push(c, c, c);
             }
        };

        const vx = x, vy = y, vz = z;
        const thickness = 1/16; 
        const offset = (1 - thickness) / 2; // Center
        
        // Check neighbors to decide axis
        // If neighbors on Z are portal/obsidian, assume Z-axis (rotate 90)
        // Default to X-axis alignment (facing Z)
        let isZAxis = false;
        
        const nZ1 = chunk.world.getBlock(chunk.cx * 16 + x, y, chunk.cz * 16 + z - 1);
        const nZ2 = chunk.world.getBlock(chunk.cx * 16 + x, y, chunk.cz * 16 + z + 1);
        
        if (nZ1 === BLOCKS.NETHER_PORTAL || nZ1 === BLOCKS.OBSIDIAN || nZ2 === BLOCKS.NETHER_PORTAL || nZ2 === BLOCKS.OBSIDIAN) {
            // Actually, if Z neighbors are present, it extends along Z, so faces X.
            // If X neighbors are present, it extends along X, so faces Z.
            // This heuristic is simple. 
            // If we have portal neighbors on X, it's an X-axis portal (facing Z).
            // If we have portal neighbors on Z, it's a Z-axis portal (facing X).
            
            // Let's check X neighbors
            const nX1 = chunk.world.getBlock(chunk.cx * 16 + x - 1, y, chunk.cz * 16 + z);
            const nX2 = chunk.world.getBlock(chunk.cx * 16 + x + 1, y, chunk.cz * 16 + z);
            
            if (nZ1 === BLOCKS.NETHER_PORTAL || nZ2 === BLOCKS.NETHER_PORTAL) isZAxis = true;
            else if (nX1 === BLOCKS.NETHER_PORTAL || nX2 === BLOCKS.NETHER_PORTAL) isZAxis = false;
            else if (nZ1 === BLOCKS.OBSIDIAN || nZ2 === BLOCKS.OBSIDIAN) isZAxis = true;
        }

        if (!isZAxis) {
            // Aligned along X, Facing Z
            // Front (+Z)
            pushQuad([vx, vy, vz+offset+thickness], [vx+1, vy, vz+offset+thickness], [vx+1, vy+1, vz+offset+thickness], [vx, vy+1, vz+offset+thickness], [0,0,1]);
            // Back (-Z)
            pushQuad([vx+1, vy, vz+offset], [vx, vy, vz+offset], [vx, vy+1, vz+offset], [vx+1, vy+1, vz+offset], [0,0,-1]);
        } else {
            // Aligned along Z, Facing X
            // Right (+X)
            pushQuad([vx+offset+thickness, vy, vz+1], [vx+offset+thickness, vy, vz], [vx+offset+thickness, vy+1, vz], [vx+offset+thickness, vy+1, vz+1], [1,0,0]);
            // Left (-X)
            pushQuad([vx+offset, vy, vz], [vx+offset, vy, vz+1], [vx+offset, vy+1, vz+1], [vx+offset, vy+1, vz], [-1,0,0]);
        }
    }

    addDoor(chunk, x, y, z, id, geo, meta) {
        const lightLvl = chunk.getLight(x, y, z);
        const baseLight = Math.pow(0.85, 15 - lightLvl);
        const finalLight = Math.min(1, baseLight); 
        let c = Math.max(0.1, finalLight);

        const matName = BLOCK_FACES[id];
        const atlasData = getAtlasUV(matName);
        
        const isOpen = (meta & 4) !== 0;
        const facing = meta & 3; 

        const T = 3/16; 
        let minX = 0, maxX = 1, minZ = 0, maxZ = 1;
        
        if (isOpen) {
            if (facing === 0) { minX=0; maxX=T; minZ=0; maxZ=1; } 
            else if (facing === 1) { minX=0; maxX=1; minZ=0; maxZ=T; } 
            else if (facing === 2) { minX=1-T; maxX=1; minZ=0; maxZ=1; } 
            else if (facing === 3) { minX=0; maxX=1; minZ=1-T; maxZ=1; } 
        } else {
            if (facing === 0) { minX=0; maxX=1; minZ=1-T; maxZ=1; } 
            else if (facing === 1) { minX=0; maxX=T; minZ=0; maxZ=1; } 
            else if (facing === 2) { minX=0; maxX=1; minZ=0; maxZ=T; } 
            else if (facing === 3) { minX=1-T; maxX=1; minZ=0; maxZ=1; } 
        }
        
        const pushQuad = (v1, v2, v3, v4, n, uStart = 0, uWidth = 1) => {
             const verts = [v1, v2, v3, v4];
             const inds = [0, 1, 2, 0, 2, 3]; 
             for(const i of inds) {
                 const v = verts[i];
                 geo.positions.push(v[0], v[1], v[2]);
                 geo.normals.push(n[0], n[1], n[2]);
                 
                 const localU = uStart + this.uvOrder[i][0] * uWidth;
                 const localV = this.uvOrder[i][1];
                 
                 geo.uvs.push(atlasData.u + localU * atlasData.w, atlasData.v + localV * atlasData.h);
                 geo.colors.push(c, c, c);
             }
        };

        const vx = x, vy = y, vz = z;
        // Use the left 2 pixels for sides (columns 0 and 1)
        const sideU = 0; 
        const sideW = 2/16;

        // Top Face - Use Side Texture
        pushQuad([vx+minX, vy+1, vz+maxZ], [vx+maxX, vy+1, vz+maxZ], [vx+maxX, vy+1, vz+minZ], [vx+minX, vy+1, vz+minZ], [0,1,0], sideU, sideW);
        // Bottom Face - Use Side Texture
        pushQuad([vx+minX, vy, vz+minZ], [vx+maxX, vy, vz+minZ], [vx+maxX, vy, vz+maxZ], [vx+minX, vy, vz+maxZ], [0,-1,0], sideU, sideW);
        
        // Vertical Sides logic:
        // Identify broad faces vs thin faces based on dimensions
        const xLen = maxX - minX;
        const zLen = maxZ - minZ;
        const isXBroad = xLen > 0.5;
        const isZBroad = zLen > 0.5;

        // North (-Z)
        pushQuad([vx+maxX, vy, vz+minZ], [vx+minX, vy, vz+minZ], [vx+minX, vy+1, vz+minZ], [vx+maxX, vy+1, vz+minZ], [0,0,-1], isXBroad ? 0 : sideU, isXBroad ? 1 : sideW);
        // South (+Z)
        pushQuad([vx+minX, vy, vz+maxZ], [vx+maxX, vy, vz+maxZ], [vx+maxX, vy+1, vz+maxZ], [vx+minX, vy+1, vz+maxZ], [0,0,1], isXBroad ? 0 : sideU, isXBroad ? 1 : sideW);
        // West (-X)
        pushQuad([vx+minX, vy, vz+minZ], [vx+minX, vy, vz+maxZ], [vx+minX, vy+1, vz+maxZ], [vx+minX, vy+1, vz+minZ], [-1,0,0], isZBroad ? 0 : sideU, isZBroad ? 1 : sideW);
        // East (+X)
        pushQuad([vx+maxX, vy, vz+maxZ], [vx+maxX, vy, vz+minZ], [vx+maxX, vy+1, vz+minZ], [vx+maxX, vy+1, vz+maxZ], [1,0,0], isZBroad ? 0 : sideU, isZBroad ? 1 : sideW);
    }

    addSlab(chunk, x, y, z, id, geo, meta) {
        // Meta: 0 = Bottom, 1 = Top
        const isTop = (meta & 1) === 1;
        const yMin = isTop ? 0.5 : 0.0;
        const yMax = isTop ? 1.0 : 0.5;
        
        this.addSimpleBox(chunk, x, y, z, id, geo, 0, 1, yMin, yMax, 0, 1);
    }

    addStairs(chunk, x, y, z, id, geo, meta) {
        // Meta: 0-3 Direction. 4 (0x4) = Upside Down
        const isUpsideDown = (meta & 4) !== 0;
        const dir = meta & 3;
        
        // 1. Base Slab (Half)
        // Normal: Bottom (0.0 - 0.5)
        // UpsideDown: Top (0.5 - 1.0)
        const baseMinY = isUpsideDown ? 0.5 : 0.0;
        const baseMaxY = isUpsideDown ? 1.0 : 0.5;
        
        this.addSimpleBox(chunk, x, y, z, id, geo, 0, 1, baseMinY, baseMaxY, 0, 1);
        
        // 2. Shape Logic (Corner detection)
        let shape = 'straight';
        
        const checkStair = (dx, dz) => {
            // Need world coordinates for lookup
            const wx = chunk.cx * 16 + x + dx;
            const wz = chunk.cz * 16 + z + dz;
            const nid = chunk.world.getBlock(wx, y, wz);
            return isStair(nid);
        };
        const getMeta = (dx, dz) => {
            const wx = chunk.cx * 16 + x + dx;
            const wz = chunk.cz * 16 + z + dz;
            return chunk.world.getBlockMetadata(wx, y, wz);
        };
        
        // Only connect to stairs of same orientation (upside down or not)
        const isSameOrientation = (otherMeta) => {
            return (otherMeta & 4) === (meta & 4);
        };

        const getDir = (m) => {
            const d = m & 3;
            // 0: East (+X), 1: West (-X), 2: South (+Z), 3: North (-Z)
            if (d === 0) return { x: 1, z: 0 }; 
            if (d === 1) return { x: -1, z: 0 }; 
            if (d === 2) return { x: 0, z: 1 }; 
            if (d === 3) return { x: 0, z: -1 }; 
            return { x: 0, z: 0 };
        };

        const myDir = getDir(dir);
        
        // Inner Corner Check (Back Neighbor)
        // Check if the stair BEHIND us (where we ascend to) is a stair that wraps around
        if (checkStair(myDir.x, myDir.z)) {
            const nm = getMeta(myDir.x, myDir.z);
            if (isSameOrientation(nm)) {
                const nd = nm & 3;
                // Inner Logic: Back stair faces Left/Right relative to us
                if (dir === 0) { if (nd === 3) shape = 'inner_left'; else if (nd === 2) shape = 'inner_right'; }
                else if (dir === 1) { if (nd === 2) shape = 'inner_left'; else if (nd === 3) shape = 'inner_right'; }
                else if (dir === 2) { if (nd === 0) shape = 'inner_left'; else if (nd === 1) shape = 'inner_right'; }
                else if (dir === 3) { if (nd === 1) shape = 'inner_left'; else if (nd === 0) shape = 'inner_right'; }
            }
        }
        
        // Outer Corner Check (Front Neighbor)
        // Only if not already inner
        if (shape === 'straight') {
            const frontX = -myDir.x;
            const frontZ = -myDir.z;
            if (checkStair(frontX, frontZ)) {
                const nm = getMeta(frontX, frontZ);
                if (isSameOrientation(nm)) {
                    const nd = nm & 3;
                    // Outer Logic: Front stair faces Left/Right relative to us
                    if (dir === 0) { if (nd === 3) shape = 'outer_left'; else if (nd === 2) shape = 'outer_right'; }
                    else if (dir === 1) { if (nd === 2) shape = 'outer_left'; else if (nd === 3) shape = 'outer_right'; }
                    else if (dir === 2) { if (nd === 0) shape = 'outer_left'; else if (nd === 1) shape = 'outer_right'; }
                    else if (dir === 3) { if (nd === 1) shape = 'outer_left'; else if (nd === 0) shape = 'outer_right'; }
                }
            }
        }

        // 3. Draw Step Parts
        // Normal: Top Half (0.5 - 1.0)
        // UpsideDown: Bottom Half (0.0 - 0.5)
        const stepMinY = isUpsideDown ? 0.0 : 0.5;
        const stepMaxY = isUpsideDown ? 0.5 : 1.0;

        const drawPart = (mx, Mx, mz, Mz) => {
            this.addSimpleBox(chunk, x, y, z, id, geo, mx, Mx, stepMinY, stepMaxY, mz, Mz);
        };

        const q = [false, false, false, false];
        // Quadrants: 0:NW, 1:NE, 2:SW, 3:SE
        // Q0: x<0.5, z<0.5 (North-West)
        // Q1: x>0.5, z<0.5 (North-East)
        // Q2: x<0.5, z>0.5 (South-West)
        // Q3: x>0.5, z>0.5 (South-East)
        
        // Default Straight Shapes (Half Block - Ascending side)
        if (dir === 0) { q[1]=true; q[3]=true; } // East (+X high) -> NE, SE
        else if (dir === 1) { q[0]=true; q[2]=true; } // West (-X high) -> NW, SW
        else if (dir === 2) { q[2]=true; q[3]=true; } // South (+Z high) -> SW, SE
        else if (dir === 3) { q[0]=true; q[1]=true; } // North (-Z high) -> NW, NE
        
        // Modify for Corners
        // Outer: Remove a quadrant (Convex corner)
        if (shape === 'outer_left') {
            if (dir === 0) q[1]=false; 
            else if (dir === 1) q[2]=false;
            else if (dir === 2) q[2]=false;
            else if (dir === 3) q[1]=false;
        } else if (shape === 'outer_right') {
            if (dir === 0) q[3]=false;
            else if (dir === 1) q[0]=false;
            else if (dir === 2) q[3]=false;
            else if (dir === 3) q[0]=false;
        } 
        // Inner: Add a quadrant (Concave corner)
        else if (shape === 'inner_left') {
            if (dir === 0) q[0]=true;
            else if (dir === 1) q[3]=true;
            else if (dir === 2) q[1]=true; 
            else if (dir === 3) q[2]=true; 
        } else if (shape === 'inner_right') {
            if (dir === 0) q[2]=true;
            else if (dir === 1) q[1]=true;
            else if (dir === 2) q[0]=true; 
            else if (dir === 3) q[3]=true; 
        }
        
        if (q[0]) drawPart(0, 0.5, 0, 0.5);
        if (q[1]) drawPart(0.5, 1, 0, 0.5);
        if (q[2]) drawPart(0, 0.5, 0.5, 1);
        if (q[3]) drawPart(0.5, 1, 0.5, 1);
    }

    addFence(chunk, x, y, z, id, geo) {
        // Helper to add box with correct mapping
        const box = (mx, Mx, my, My, mz, Mz) => {
            this.addSimpleBox(chunk, x, y, z, id, geo, mx, Mx, my, My, mz, Mz, false); 
        };

        // Post: 0.375 to 0.625 (Center 4/16ths)
        const min = 0.375;
        const max = 0.625;
        box(min, max, 0, 1, min, max);

        // Connections logic
        const check = (dx, dz) => {
            const wx = chunk.cx * 16 + x + dx;
            const wz = chunk.cz * 16 + z + dz;
            const nid = chunk.world.getBlock(wx, y, wz);
            
            if (nid === id) return true;
            // Connect to solid blocks + stairs + slabs + gates
            if (nid !== BLOCKS.AIR && nid !== BLOCKS.WATER && nid !== BLOCKS.LAVA && !isFoliage(nid) && nid !== -1 && nid !== 0) return true;
            // Allow Stairs/Slabs specifically
            if (nid === BLOCKS.COBBLESTONE_SLAB || nid === BLOCKS.COBBLESTONE_STAIRS) return true;
            
            return false;
        };

        // Bars Geometry
        const barY1_min = 0.375; // 6/16
        const barY1_max = 0.5625; // 9/16
        const barY2_min = 0.75; // 12/16
        const barY2_max = 0.9375; // 15/16
        
        // North (-Z)
        if (check(0, -1)) {
            // Lower Bar
            box(min + 0.0625, max - 0.0625, barY1_min, barY1_max, 0, min);
            // Upper Bar
            box(min + 0.0625, max - 0.0625, barY2_min, barY2_max, 0, min);
        }
        // South (+Z)
        if (check(0, 1)) {
            box(min + 0.0625, max - 0.0625, barY1_min, barY1_max, max, 1);
            box(min + 0.0625, max - 0.0625, barY2_min, barY2_max, max, 1);
        }
        // West (-X)
        if (check(-1, 0)) {
            box(0, 0.5, barY1_min, barY1_max, min + 0.0625, max - 0.0625);
            box(0, 0.5, barY2_min, barY2_max, min + 0.0625, max - 0.0625);
        }
        // East (+X)
        if (check(1, 0)) {
            box(max, 1, barY1_min, barY1_max, min + 0.0625, max - 0.0625);
            box(max, 1, barY2_min, barY2_max, min + 0.0625, max - 0.0625);
        }
    }

    addPane(chunk, x, y, z, id, geo) {
        const box = (mx, Mx, my, My, mz, Mz) => {
            this.addSimpleBox(chunk, x, y, z, id, geo, mx, Mx, my, My, mz, Mz, false); 
        };

        const T = 2/16; 
        const min = 0.5 - T/2;
        const max = 0.5 + T/2;
        
        const check = (dx, dz) => {
            const wx = chunk.cx * 16 + x + dx;
            const wz = chunk.cz * 16 + z + dz;
            const nid = chunk.world.getBlock(wx, y, wz);
            
            if (nid === id) return true;
            if (nid !== BLOCKS.AIR && nid !== BLOCKS.WATER && nid !== BLOCKS.LAVA && !isFoliage(nid) && nid !== -1 && nid !== 0) return true;
            return false;
        };

        let connected = false;
        if (check(0, -1)) { box(min, max, 0, 1, 0, 0.5); connected = true; } // North
        if (check(0, 1)) { box(min, max, 0, 1, 0.5, 1); connected = true; } // South
        if (check(-1, 0)) { box(0, 0.5, 0, 1, min, max); connected = true; } // West
        if (check(1, 0)) { box(0.5, 1, 0, 1, min, max); connected = true; } // East
        
        if (!connected) {
            box(min, max, 0, 1, min, max); // Post
        }
    }

    addSimpleBox(chunk, x, y, z, id, geo, minX, maxX, minY, maxY, minZ, maxZ, cull = true) {
        let matName = BLOCK_FACES[id];
        if (!matName) matName = 'oak_planks'; // Fallback
        const atlasData = getAtlasUV(typeof matName === 'string' ? matName : matName[0]);
        const pad = 0.0001; 
        
        // Calculate Light
        let lightLvl = chunk.getLight(x, y, z);
        // Ensure minimal light so it's not pitch black
        if (chunk.world.dimension === 'nether') lightLvl = Math.max(lightLvl, 5);
        
        const baseLight = Math.pow(0.85, 15 - lightLvl);
        
        const pushQuad = (v1, v2, v3, v4, n, uMin, uMax, vMin, vMax, faceDir) => {
             // Basic directional shading
             const dirFactor = this.dirMults[faceDir];
             let c = Math.max(0.1, baseLight * dirFactor);
             
             geo.positions.push(v1[0],v1[1],v1[2], v2[0],v2[1],v2[2], v3[0],v3[1],v3[2]);
             geo.positions.push(v1[0],v1[1],v1[2], v3[0],v3[1],v3[2], v4[0],v4[1],v4[2]);
             
             for(let k=0; k<6; k++) geo.normals.push(n[0], n[1], n[2]);
             for(let k=0; k<6; k++) geo.colors.push(c, c, c);
             
             const u0 = atlasData.u + pad + uMin * (atlasData.w - 2*pad);
             const u1 = atlasData.u + pad + uMax * (atlasData.w - 2*pad);
             const texV0 = atlasData.v + pad + vMin * (atlasData.h - 2*pad);
             const texV1 = atlasData.v + pad + vMax * (atlasData.h - 2*pad);
             
             geo.uvs.push(u0, texV1, u1, texV1, u1, texV0);
             geo.uvs.push(u0, texV1, u1, texV0, u0, texV0);
        };

        const vx = x, vy = y, vz = z;
        
        // Top (Face 2)
        pushQuad([vx+minX, vy+maxY, vz+maxZ], [vx+maxX, vy+maxY, vz+maxZ], [vx+maxX, vy+maxY, vz+minZ], [vx+minX, vy+maxY, vz+minZ], [0,1,0], minX, maxX, minZ, maxZ, 2);
        // Bottom (Face 3)
        pushQuad([vx+minX, vy+minY, vz+minZ], [vx+maxX, vy+minY, vz+minZ], [vx+maxX, vy+minY, vz+maxZ], [vx+minX, vy+minY, vz+maxZ], [0,-1,0], minX, maxX, maxY, minY, 3);
        // Front (+Z) (Face 4)
        pushQuad([vx+minX, vy+minY, vz+maxZ], [vx+maxX, vy+minY, vz+maxZ], [vx+maxX, vy+maxY, vz+maxZ], [vx+minX, vy+maxY, vz+maxZ], [0,0,1], minX, maxX, maxY, minY, 4);
        // Back (-Z) (Face 5)
        pushQuad([vx+maxX, vy+minY, vz+minZ], [vx+minX, vy+minY, vz+minZ], [vx+minX, vy+maxY, vz+minZ], [vx+maxX, vy+maxY, vz+minZ], [0,0,-1], minX, maxX, maxY, minY, 5);
        // Right (+X) (Face 0)
        pushQuad([vx+maxX, vy+minY, vz+maxZ], [vx+maxX, vy+minY, vz+minZ], [vx+maxX, vy+maxY, vz+minZ], [vx+maxX, vy+maxY, vz+maxZ], [1,0,0], minZ, maxZ, maxY, minY, 0);
        // Left (-X) (Face 1)
        pushQuad([vx+minX, vy+minY, vz+minZ], [vx+minX, vy+minY, vz+maxZ], [vx+minX, vy+maxY, vz+maxZ], [vx+minX, vy+maxY, vz+minZ], [-1,0,0], minZ, maxZ, maxY, minY, 1);
    }

    createMesh(data, mat, meshGroup, castShadow = true) {
        if (data.positions.length === 0) return;
        const bufferGeo = new THREE.BufferGeometry();
        bufferGeo.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
        bufferGeo.setAttribute('normal', new THREE.Float32BufferAttribute(data.normals, 3));
        bufferGeo.setAttribute('uv', new THREE.Float32BufferAttribute(data.uvs, 2));
        bufferGeo.setAttribute('color', new THREE.Float32BufferAttribute(data.colors, 3));
        
        bufferGeo.computeBoundingSphere();

        const mesh = new THREE.Mesh(bufferGeo, mat);
        mesh.castShadow = castShadow; 
        mesh.receiveShadow = true;
        mesh.matrixAutoUpdate = false;
        mesh.updateMatrix();
        meshGroup.add(mesh);
    }
}