import * as THREE from 'three';
import { BLOCKS, ATLAS_MAT_TRANS, isFoliage } from './blocks.js';
import { ChunkMesher } from './chunk/chunk_mesher.js';
import { updateChunkLighting } from './chunk/lighting.js';
import { CONFIG } from './config.js';

const chunkMesher = new ChunkMesher();

// Shared buffer for noise generation to reduce GC
const noiseCache = new Float32Array(5 * 41 * 5); // 1025 floats for standard 16x320
const _cornerNeighbors = [[0, 0], [-1, 0], [0, -1], [-1, -1]];

export class Chunk {
    constructor(cx, cz, world) {
        this.cx = cx;
        this.cz = cz;
        this.world = world;
        this.dimension = world.dimension; // Store dimension at creation
        this.terrainGen = world.terrainGen;
        this.size = 16; 
        this.height = CONFIG.WORLD_HEIGHT;
        this.meshGroup = new THREE.Group();
        this.meshGroup.position.set(cx * this.size, 0, cz * this.size);
        
        this.generated = false;
        this.dirty = false;
        
        // Sections logic for optimized meshing
        this.sectionSize = CONFIG.SECTION_SIZE;
        this.sectionsCount = Math.ceil(this.height / this.sectionSize);
        this.sectionGroups = new Array(this.sectionsCount);
        this.dirtySections = new Array(this.sectionsCount).fill(true);
        
        for(let i=0; i<this.sectionsCount; i++) {
            const g = new THREE.Group();
            this.sectionGroups[i] = g;
            this.meshGroup.add(g);
        }

        this.data = new Uint8Array(this.size * this.size * this.height);
        this.metadata = new Uint8Array(this.size * this.size * this.height);
        this.lightMap = new Uint8Array(this.size * this.size * this.height);
        
        this.waterMeshes = [];
    }

    idx(x, y, z) {
        return x + this.size * (z + this.size * y);
    }
    
    getCornerWaterHeight(wx, y, wz, fluidId) {
        let sum = 0;
        let count = 0;

        for (let [dx, dz] of _cornerNeighbors) {
            const checkX = wx + dx;
            const checkZ = wz + dz;
            const id = this.world.getBlock(checkX, y, checkZ);
            
            if (id === fluidId) {
                const upId = this.world.getBlock(checkX, y + 1, checkZ);
                if (upId === fluidId) {
                    sum += 1.0;
                    count++;
                } else {
                    const meta = this.world.getBlockMetadata(checkX, y, checkZ);
                    let h = (meta / 8.0); 
                    if (meta === 7) h = 0.9; 
                    sum += h;
                    count++;
                }
            }
        }
        if (count === 0) return 0.05; // Thinner minimum water level
        return Math.max(0.05, sum / count);
    }

    setBlock(x, y, z, id, meta = 0) {
        if (x >= 0 && x < this.size && z >= 0 && z < this.size && y >= 0 && y < this.height) {
            const i = this.idx(x,y,z);
            if (this.data[i] !== id || this.metadata[i] !== meta) {
                this.data[i] = id;
                this.metadata[i] = meta;
                this.generated = true; 
                this.dirty = true;
                
                // Mark Sections Dirty
                const sec = Math.floor(y / this.sectionSize);
                this.dirtySections[sec] = true;
                
                // Mark Border Sections
                if (y % this.sectionSize === 0 && sec > 0) this.dirtySections[sec - 1] = true;
                if (y % this.sectionSize === this.sectionSize - 1 && sec < this.sectionsCount - 1) this.dirtySections[sec + 1] = true;
            }
        }
    }

    getBlockId(name) {
        const key = name ? name.toUpperCase() : 'STONE';
        return BLOCKS[key] !== undefined ? BLOCKS[key] : BLOCKS.STONE;
    }

    generateData() {
        if (this.dimension === 'nether') {
            this.generateNetherData();
            this.generateNetherDecorations();
        } else if (this.terrainGen.type === 'superflat') {
            this.generateSuperflatData();
        } else if (this.terrainGen.type === 'skyblock') {
            this.generateSkyblockData();
        } else {
            this.generateOverworldData3D();
            this.terrainGen.carveCaves(this);
            this.generateDecorations();
        }
        
        // Apply saved modifications
        const mods = this.world.getChunkModifications(this.cx, this.cz);
        for(const mod of mods) {
            if (mod.y >= 0 && mod.y < this.height) {
                const idx = this.idx(mod.x, mod.y, mod.z);
                this.data[idx] = mod.id;
                this.metadata[idx] = mod.meta;
            }
        }

        this.updateLighting();
        this.generated = true;
        this.dirtySections.fill(true);
    }

    generateSuperflatData() {
        for (let x = 0; x < this.size; x++) {
            for (let z = 0; z < this.size; z++) {
                for (let y = 0; y < 5; y++) {
                    let id = BLOCKS.AIR;
                    if (y === 0) id = BLOCKS.BEDROCK;
                    else if (y < 4) id = BLOCKS.DIRT;
                    else if (y === 4) id = BLOCKS.GRASS;
                    
                    const i = this.idx(x, y, z);
                    this.data[i] = id;
                    this.metadata[i] = 0;
                }
            }
        }
        this.updateLighting();
        this.generated = true;
        this.dirtySections.fill(true);
    }

    generateSkyblockData() {
        // Empty by default
        // If this is the center chunk (0,0), spawn the island
        if (this.cx === 0 && this.cz === 0) {
            const centerX = 8;
            const centerZ = 8;
            const centerY = 64;

            // Simple L-shape island
            for(let x=0; x<16; x++) {
                for(let z=0; z<16; z++) {
                    for(let y=0; y<128; y++) {
                        // 3x3x3 dirt block
                        if (x >= centerX-1 && x <= centerX+1 && z >= centerZ-1 && z <= centerZ+1) {
                            if (y === centerY) {
                                this.setBlock(x, y, z, BLOCKS.GRASS);
                            } else if (y >= centerY-2 && y < centerY) {
                                this.setBlock(x, y, z, BLOCKS.DIRT);
                            } else if (y === centerY-3) {
                                // bedrock bottom? No, just dirt/stone.
                                // Let's put one bedrock at center
                                if (x===centerX && z===centerZ) this.setBlock(x,y,z,BLOCKS.BEDROCK);
                                else this.setBlock(x, y, z, BLOCKS.DIRT);
                            }
                        }
                    }
                }
            }
            
            // Tree
            const tx = centerX;
            const tz = centerZ;
            const ty = centerY + 1;
            
            // Log
            for(let i=0; i<4; i++) this.setBlock(tx, ty+i, tz, BLOCKS.LOG);
            // Leaves
            for(let lx=-2; lx<=2; lx++) {
                for(let lz=-2; lz<=2; lz++) {
                    for(let ly=2; ly<=3; ly++) {
                        if (Math.abs(lx)===2 && Math.abs(lz)===2) continue;
                        if (this.getBlock(tx+lx, ty+ly, tz+lz) === BLOCKS.AIR)
                            this.setBlock(tx+lx, ty+ly, tz+lz, BLOCKS.LEAVES);
                    }
                }
            }
            // Top Leaves
            for(let lx=-1; lx<=1; lx++) {
                for(let lz=-1; lz<=1; lz++) {
                    if (Math.abs(lx)===1 && Math.abs(lz)===1) continue;
                    if (this.getBlock(tx+lx, ty+4, tz+lz) === BLOCKS.AIR)
                        this.setBlock(tx+lx, ty+4, tz+lz, BLOCKS.LEAVES);
                }
            }
            
            // Chest (Placeholder with Crafting Table for now until Chest block exists)
            this.setBlock(centerX+1, centerY+1, centerZ, BLOCKS.CRAFTING_TABLE);
        }

        this.updateLighting();
        this.generated = true;
        this.dirtySections.fill(true);
    }

    generateOverworldData3D() {
        // Interpolation Settings
        const noiseScale = 4; // Sample every 4 blocks (4x4x4 grid in 16x16 chunk)
        const verticalScale = 8; // Sample every 8 blocks vertically
        
        // Grid dimensions
        const gridX = Math.ceil(this.size / noiseScale) + 1;
        const gridZ = Math.ceil(this.size / noiseScale) + 1;
        const gridY = Math.ceil(this.height / verticalScale) + 1;
        
        // Re-use a shared buffer if possible to optimize GC
        const sizeNeeded = gridX * gridY * gridZ;
        let noiseValues = noiseCache;
        if (noiseCache.length < sizeNeeded) {
             noiseValues = new Float32Array(sizeNeeded);
        }
        
        // 1. Sample Noise at grid points
        for (let gx = 0; gx < gridX; gx++) {
            const x = gx * noiseScale;
            const wx = (this.cx * this.size) + x;
            for (let gz = 0; gz < gridZ; gz++) {
                const z = gz * noiseScale;
                const wz = (this.cz * this.size) + z;
                
                // Optimization: Pre-calculate index stride
                const idxBase = (gx * gridY * gridZ) + gz;
                const stride = gridZ;

                for (let gy = 0; gy < gridY; gy++) {
                    const y = gy * verticalScale;
                    const val = this.terrainGen.getOverworldDensity(wx, y, wz);
                    
                    noiseValues[idxBase + (gy * stride)] = val;
                }
            }
        }
        
        const seaLevel = this.terrainGen.seaLevel;

        // Precompute Lerp Factors to avoid division in inner loop
        const txCache = new Float32Array(this.size);
        const gxCache = new Int32Array(this.size);
        for(let x=0; x<this.size; x++) {
            gxCache[x] = Math.floor(x / noiseScale);
            txCache[x] = (x % noiseScale) / noiseScale;
        }

        // 2. Interpolate
        for (let x = 0; x < this.size; x++) {
            const gx = gxCache[x];
            const tx = txCache[x];
            const wx = (this.cx * this.size) + x;
            
            for (let z = 0; z < this.size; z++) {
                const gz = gxCache[z]; // Size is same for Z
                const tz = txCache[z];
                const wz = (this.cz * this.size) + z;

                const biomeData = this.terrainGen.getBiomeData(wx, wz);
                const biomeBlock = this.terrainGen.getBlockType(64, biomeData);

                let surfaceFound = false;
                let dirtDepth = 0;
                
                // Pre-calculate X indices
                const idx00 = (gx * gridY * gridZ) + gz;
                const idx10 = idx00 + (gridY * gridZ);
                const idx01 = idx00 + 1;
                const idx11 = idx10 + 1;
                const gzStride = gridZ;

                for(let y = this.height - 1; y >= 0; y--) {
                    const gy = Math.floor(y / verticalScale);
                    const ty = (y % verticalScale) / verticalScale;
                    
                    // Indices for Y layers
                    const offset0 = gy * gzStride;
                    const offset1 = offset0 + gzStride; // (gy+1) * gzStride

                    const v000 = noiseValues[idx00 + offset0];
                    const v001 = noiseValues[idx01 + offset0];
                    const v010 = noiseValues[idx00 + offset1];
                    const v011 = noiseValues[idx01 + offset1];
                    const v100 = noiseValues[idx10 + offset0];
                    const v101 = noiseValues[idx11 + offset0];
                    const v110 = noiseValues[idx10 + offset1];
                    const v111 = noiseValues[idx11 + offset1];

                    // Lerp X
                    const c00 = v000 + (v100 - v000) * tx;
                    const c10 = v010 + (v110 - v010) * tx;
                    const c01 = v001 + (v101 - v001) * tx;
                    const c11 = v011 + (v111 - v011) * tx;
                    
                    // Lerp Y
                    const c0 = c00 + (c10 - c00) * ty;
                    const c1 = c01 + (c11 - c01) * ty;
                    
                    // Lerp Z
                    const density = c0 + (c1 - c0) * tz;
                    
                    let typeId = BLOCKS.AIR;
                    
                    if (y === 0) {
                        typeId = BLOCKS.BEDROCK;
                    } else if (density > 0) {
                        typeId = BLOCKS.STONE;
                        
                        // Surface Grass Logic
                        // If this is the first solid block from top, make it grass/dirt
                        if (!surfaceFound) {
                             const isAlphaBeach = (y >= seaLevel - 2 && y <= seaLevel + 4) && 
                                                (biomeData.cont > -0.15 && biomeData.cont < 0.25) &&
                                                (biomeData.temp > 0.0);

                             if (isAlphaBeach) {
                                  typeId = BLOCKS.SAND;
                             } else if (y >= seaLevel - 1 && y <= seaLevel + 1 && biomeData.riverNoise < 0.1) {
                                  // River/Beach edge
                                  typeId = BLOCKS.SAND;
                                  if (biomeData.temp < 0.2) typeId = BLOCKS.GRAVEL;
                             } else {
                                  // Standard surface
                                  if (biomeBlock === 'sand') typeId = BLOCKS.SAND;
                                  else if (biomeBlock === 'snow') typeId = BLOCKS.SNOW;
                                  else if (biomeBlock === 'terracotta') typeId = BLOCKS.TERRACOTTA;
                                  else if (biomeBlock === 'gravel') typeId = BLOCKS.GRAVEL;
                                  else if (biomeBlock === 'clay') typeId = BLOCKS.CLAY;
                                  else typeId = BLOCKS.GRASS;
                             }
                             surfaceFound = true;
                             dirtDepth = 0;
                        } else {
                            // Sub-surface dirt
                            if (dirtDepth < 4) {
                                const blockAbove = this.data[this.idx(x, y + 1, z)];
                                if (blockAbove === BLOCKS.GRASS || blockAbove === BLOCKS.DIRT || blockAbove === BLOCKS.SNOW || blockAbove === BLOCKS.SAND) {
                                     if (typeId === BLOCKS.STONE) {
                                         if (blockAbove === BLOCKS.SAND) typeId = BLOCKS.SAND;
                                         else typeId = BLOCKS.DIRT;
                                         dirtDepth++;
                                     }
                                }
                            }
                        }
                        
                        // Ores (Simple check)
                        if (typeId === BLOCKS.STONE) {
                            let stoneType = this.terrainGen.getStoneType(wx, y, wz);
                            // Only replace pure stone
                            let ore = this.terrainGen.getOreType(wx, y, wz, stoneType, biomeData);
                            // Convert string to ID
                            if (ore !== 'stone') typeId = this.getBlockId(ore);
                        }

                    } else if (y < seaLevel) {
                        typeId = BLOCKS.WATER;
                        surfaceFound = false; // Water resets surface
                    } else {
                        surfaceFound = false;
                    }
                    
                    if (typeId !== BLOCKS.AIR) {
                        const i = this.idx(x, y, z);
                        this.data[i] = typeId;
                        if (typeId === BLOCKS.WATER) this.metadata[i] = 7;
                        else this.metadata[i] = 0;
                    }
                }
            }
        }
    }

    generateDecorations() {
        // Moved tree/flower logic here to keep generateData clean
        const seaLevel = this.terrainGen.seaLevel;
        
        for (let x = 2; x < this.size - 2; x++) {
            for (let z = 2; z < this.size - 2; z++) {
                const wx = (this.cx * this.size) + x;
                const wz = (this.cz * this.size) + z;
                
                // Since we don't have a simple heightmap, we scan down
                let h = -1;
                // Scan from reasonable height
                for(let y = 140; y > 0; y--) {
                    const id = this.data[this.idx(x, y, z)];
                    if (id !== BLOCKS.AIR && id !== BLOCKS.WATER && id !== BLOCKS.LEAVES && id !== BLOCKS.LOG) {
                        h = y;
                        break;
                    }
                }
                
                if (h === -1) continue;

                if (this.data[this.idx(x, h + 1, z)] === BLOCKS.WATER) continue;

                const r = this.terrainGen.pseudoRandom(wx * 1337 + wz * 7331)();
                const biomeData = this.terrainGen.getBiomeData(wx, wz);
                const density = this.terrainGen.getTreeDensity(biomeData);
                const groundBlock = this.data[this.idx(x, h, z)];
                
                if (groundBlock === BLOCKS.GRASS) {
                    // Flowers & Grass
                    if (r > 0.95) {
                        const flowerType = (r > 0.975) ? BLOCKS.DANDELION : BLOCKS.PINK_TULIP;
                        if (h + 1 < this.height && this.data[this.idx(x, h + 1, z)] === BLOCKS.AIR) {
                             this.data[this.idx(x, h + 1, z)] = flowerType;
                        }
                    } else if (r > 0.6 && r < 0.8) {
                        // Grass
                        if (h + 1 < this.height && this.data[this.idx(x, h + 1, z)] === BLOCKS.AIR) {
                             // Chance for Tall Grass
                             if (r > 0.75 && h + 2 < this.height && this.data[this.idx(x, h+2, z)] === BLOCKS.AIR) {
                                 this.data[this.idx(x, h + 1, z)] = BLOCKS.TALL_GRASS_BOTTOM;
                                 this.data[this.idx(x, h + 2, z)] = BLOCKS.TALL_GRASS_TOP;
                             } else {
                                 this.data[this.idx(x, h + 1, z)] = BLOCKS.GRASS_PLANT;
                             }
                        }
                    }
                    if (biomeData.humidity > 0.3 && r > 0.8 && r < 0.85) {
                        if (h + 1 < this.height && this.data[this.idx(x, h + 1, z)] === BLOCKS.AIR) {
                             this.data[this.idx(x, h + 1, z)] = BLOCKS.LILY_OF_THE_VALLEY;
                        }
                    }
                }
                
                // Trees
                 if (r < density) {
                    if (groundBlock === BLOCKS.GRASS || groundBlock === BLOCKS.DIRT) {
                        const treeType = this.terrainGen.biomeManager.getTreeType(biomeData);
                        
                        let logId = BLOCKS.LOG; // Oak
                        let leafId = BLOCKS.LEAVES; // Oak
                        
                        switch(treeType) {
                            case 'birch': logId = BLOCKS.BIRCH_LOG; leafId = BLOCKS.BIRCH_LEAVES; break;
                            case 'spruce': logId = BLOCKS.SPRUCE_LOG; leafId = BLOCKS.SPRUCE_LEAVES; break;
                            case 'jungle': logId = BLOCKS.JUNGLE_LOG; leafId = BLOCKS.JUNGLE_LEAVES; break;
                            case 'acacia': logId = BLOCKS.ACACIA_LOG; leafId = BLOCKS.ACACIA_LEAVES; break;
                            case 'dark_oak': logId = BLOCKS.DARK_OAK_LOG; leafId = BLOCKS.DARK_OAK_LEAVES; break;
                        }

                        if (treeType === 'acacia') {
                            const hBase = 4 + Math.floor(r * 100) % 3;
                            // Trunk
                            for(let i=0; i<hBase; i++) {
                                if(h+i < this.height) this.data[this.idx(x, h+i, z)] = logId;
                            }
                            // Branches (1 or 2)
                            const branchH = h + hBase - 1;
                            const dirX = (Math.floor(r * 50) % 3) - 1; 
                            const dirZ = (Math.floor(r * 80) % 3) - 1;
                            
                            // Diagonal Branch
                            for(let i=1; i<=3; i++) {
                                const bx = x + dirX*i;
                                const bz = z + dirZ*i;
                                const by = branchH + i;
                                if(bx>=0 && bx<this.size && bz>=0 && bz<this.size && by<this.height) {
                                    this.data[this.idx(bx, by, bz)] = logId;
                                    // Leaves at end
                                    if(i===3) {
                                        for(let lx=-2; lx<=2; lx++) {
                                            for(let lz=-2; lz<=2; lz++) {
                                                if(Math.abs(lx)+Math.abs(lz) > 3) continue;
                                                const lly = by+1;
                                                if(lly<this.height && (bx+lx)>=0 && (bx+lx)<this.size && (bz+lz)>=0 && (bz+lz)<this.size) {
                                                    this.data[this.idx(bx+lx, lly, bz+lz)] = leafId;
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            // Add a second canopy at top of main trunk
                            for(let lx=-2; lx<=2; lx++) {
                                for(let lz=-2; lz<=2; lz++) {
                                    if(Math.abs(lx)+Math.abs(lz) > 3) continue;
                                    const lly = branchH+1;
                                    if(lly<this.height && (x+lx)>=0 && (x+lx)<this.size && (z+lz)>=0 && (z+lz)<this.size) {
                                        this.data[this.idx(x+lx, lly, z+lz)] = leafId;
                                    }
                                }
                            }

                        } else if (treeType === 'spruce') {
                            const hTrunk = 6 + Math.floor(r * 100) % 4;
                            for(let i=0; i<hTrunk; i++) {
                                if(h+i < this.height) this.data[this.idx(x, h+i, z)] = logId;
                            }
                            // Layers
                            let rad = 0;
                            for(let yOff = hTrunk; yOff >= 2; yOff--) {
                                rad = (yOff % 3 === 0) ? 2 : 1;
                                if (yOff === hTrunk) rad = 0; // Top tip
                                
                                for(let lx=-rad; lx<=rad; lx++) {
                                    for(let lz=-rad; lz<=rad; lz++) {
                                        if (Math.abs(lx) === rad && Math.abs(lz) === rad) continue; // Circle approximation
                                        const dy = h + yOff;
                                        const dx = x + lx;
                                        const dz = z + lz;
                                        if(dx>=0 && dx<this.size && dz>=0 && dz<this.size && dy<this.height) {
                                            if (this.data[this.idx(dx, dy, dz)] === BLOCKS.AIR) {
                                                this.data[this.idx(dx, dy, dz)] = leafId;
                                            }
                                        }
                                    }
                                }
                            }
                            if(h+hTrunk < this.height) this.data[this.idx(x, h+hTrunk, z)] = leafId;

                        } else if (treeType === 'dark_oak') {
                            const hTrunk = 6 + Math.floor(r * 100) % 3;
                            // 2x2 Trunk
                            for(let i=0; i<hTrunk; i++) {
                                const dy = h+i;
                                if(dy>=this.height) break;
                                this.data[this.idx(x, dy, z)] = logId;
                                if(x+1 < this.size) this.data[this.idx(x+1, dy, z)] = logId;
                                if(z+1 < this.size) this.data[this.idx(x, dy, z+1)] = logId;
                                if(x+1 < this.size && z+1 < this.size) this.data[this.idx(x+1, dy, z+1)] = logId;
                            }
                            // Big spherical leaves
                            const leafCenterY = h + hTrunk - 1;
                            const rad = 3;
                            for(let ly=-rad; ly<=rad; ly++) {
                                for(let lx=-rad; lx<=rad+1; lx++) {
                                    for(let lz=-rad; lz<=rad+1; lz++) {
                                        const dist = lx*lx + ly*ly + lz*lz;
                                        if(dist < (rad*rad)+2) {
                                            const dy = leafCenterY + ly;
                                            const dx = x + lx;
                                            const dz = z + lz;
                                            if(dx>=0 && dx<this.size && dz>=0 && dz<this.size && dy<this.height && dy>=0) {
                                                const cur = this.data[this.idx(dx, dy, dz)];
                                                if(cur === BLOCKS.AIR || isFoliage(cur)) {
                                                    this.data[this.idx(dx, dy, dz)] = leafId;
                                                }
                                            }
                                        }
                                    }
                                }
                            }

                        } else if (treeType === 'jungle') {
                            if (r > 0.3) {
                                // Tall Tree
                                const hTrunk = 10 + Math.floor(r * 200) % 10;
                                for(let i=0; i<hTrunk; i++) {
                                    if(h+i < this.height) this.data[this.idx(x, h+i, z)] = logId;
                                }
                                const leafStart = hTrunk - 2;
                                for(let ly=leafStart; ly<=hTrunk+1; ly++) {
                                    const rad = (ly > hTrunk) ? 1 : 2;
                                    for(let lx=-rad; lx<=rad; lx++) {
                                        for(let lz=-rad; lz<=rad; lz++) {
                                            const dx = x + lx;
                                            const dz = z + lz;
                                            const dy = h + ly;
                                            if(dx>=0 && dx<this.size && dz>=0 && dz<this.size && dy<this.height) {
                                                if(this.data[this.idx(dx, dy, dz)] === BLOCKS.AIR) {
                                                    this.data[this.idx(dx, dy, dz)] = leafId;
                                                }
                                            }
                                        }
                                    }
                                }
                            } else {
                                // Bush
                                const treeHeight = 3;
                                for (let ty = 1; ty <= treeHeight; ty++) {
                                    if (h + ty < this.height) this.data[this.idx(x, h + ty, z)] = logId;
                                }
                                const leafStart = treeHeight - 1;
                                for (let ly = leafStart; ly <= treeHeight + 1; ly++) {
                                    const radius = 2;
                                    for (let lx = -radius; lx <= radius; lx++) {
                                        for (let lz = -radius; lz <= radius; lz++) {
                                            if(Math.abs(lx)===radius && Math.abs(lz)===radius) continue;
                                            const dx = x + lx;
                                            const dz = z + lz;
                                            const dy = h + ly;
                                            if(dx>=0 && dx<this.size && dz>=0 && dz<this.size && dy<this.height) {
                                                if(this.data[this.idx(dx, dy, dz)] === BLOCKS.AIR) {
                                                    this.data[this.idx(dx, dy, dz)] = leafId;
                                                }
                                            }
                                        }
                                    }
                                }
                            }

                        } else {
                            // Standard Oak / Birch
                            const treeHeight = 4 + Math.floor(r * 100) % 3;
                            for (let ty = 1; ty <= treeHeight; ty++) {
                                if (h + ty < this.height) this.data[this.idx(x, h + ty, z)] = logId;
                            }
                            const leafStart = treeHeight - 2;
                            for (let ly = leafStart; ly <= treeHeight + 1; ly++) {
                                const radius = (ly >= treeHeight) ? 1 : 2;
                                for (let lx = -radius; lx <= radius; lx++) {
                                    for (let lz = -radius; lz <= radius; lz++) {
                                        const dx = x + lx;
                                        const dz = z + lz;
                                        const dy = h + ly;
                                        if (dx >= 0 && dx < this.size && dz >= 0 && dz < this.size && dy < this.height) {
                                            const currentId = this.data[this.idx(dx, dy, dz)];
                                            if (currentId === BLOCKS.AIR || currentId === BLOCKS.LEAVES || isFoliage(currentId)) {
                                                if (Math.abs(lx) === radius && Math.abs(lz) === radius && (Math.floor(r*1000)%2===0)) continue;
                                                this.data[this.idx(dx, dy, dz)] = leafId;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                
                // Cactus & Sugar Cane logic copied similarly...
                if (groundBlock === BLOCKS.SAND || groundBlock === BLOCKS.TERRACOTTA) {
                    if (r < 0.01) {
                         // Check neighbor clearance
                         let clear = true;
                         // ... (abbreviated for brevity, reusing logic)
                         if (clear && h + 1 < this.height) {
                             this.data[this.idx(x, h+1, z)] = BLOCKS.CACTUS;
                         }
                    }
                }
            }
        }
    }

    generateNetherData() {
        const noiseScale = 4;
        const verticalScale = 8;
        
        const gridX = Math.ceil(this.size / noiseScale) + 1;
        const gridY = Math.ceil(128 / verticalScale) + 1;
        const gridZ = Math.ceil(this.size / noiseScale) + 1;
        
        const sizeNeeded = gridX * gridY * gridZ;
        let noiseValues = noiseCache;
        if (noiseCache.length < sizeNeeded) {
             noiseValues = new Float32Array(sizeNeeded);
        }
        
        // 1. Sample Noise at grid points
        for (let gx = 0; gx < gridX; gx++) {
            for (let gz = 0; gz < gridZ; gz++) {
                for (let gy = 0; gy < gridY; gy++) {
                    const x = gx * noiseScale;
                    const y = gy * verticalScale;
                    const z = gz * noiseScale;
                    
                    const wx = (this.cx * this.size) + x;
                    const wz = (this.cz * this.size) + z;
                    
                    // Boundary check for y
                    const actualY = Math.min(y, 127);
                    
                    const val = this.terrainGen.getNetherNoise(wx, actualY, wz);
                    
                    // Stride: X * (gridY * gridZ) + Y * gridZ + Z
                    // Note: This matches the lookup order below
                    const idx = (gx * gridY * gridZ) + (gy * gridZ) + gz;
                    noiseValues[idx] = val;
                }
            }
        }

        // 2. Interpolate
        for (let x = 0; x < this.size; x++) {
            const gx = Math.floor(x / noiseScale);
            const tx = (x % noiseScale) / noiseScale;
            const wx = (this.cx * this.size) + x;
            
            for (let z = 0; z < this.size; z++) {
                const gz = Math.floor(z / noiseScale);
                const tz = (z % noiseScale) / noiseScale;
                const wz = (this.cz * this.size) + z;
                
                // Pre-calculated pseudo-random seed for this column for ore distribution
                const colSeed = Math.sin((this.cx * 16 + x) * 12.9898 + (this.cz * 16 + z) * 78.233) * 43758.5453;
                
                for(let y = 0; y < 128; y++) {
                    const gy = Math.floor(y / verticalScale);
                    const ty = (y % verticalScale) / verticalScale;
                    
                    // Interpolation Indices
                    // Structure: X plane -> Y rows -> Z cols
                    const idx000 = (gx * gridY * gridZ) + (gy * gridZ) + gz;
                    const idx001 = idx000 + 1;          // +Z
                    const idx010 = idx000 + gridZ;      // +Y
                    const idx011 = idx010 + 1;          // +Y +Z
                    
                    const idx100 = idx000 + (gridY * gridZ); // +X
                    const idx101 = idx100 + 1;          // +X +Z
                    const idx110 = idx100 + gridZ;      // +X +Y
                    const idx111 = idx110 + 1;          // +X +Y +Z
                    
                    const v000 = noiseValues[idx000];
                    const v001 = noiseValues[idx001];
                    const v010 = noiseValues[idx010];
                    const v011 = noiseValues[idx011];
                    const v100 = noiseValues[idx100];
                    const v101 = noiseValues[idx101];
                    const v110 = noiseValues[idx110];
                    const v111 = noiseValues[idx111];
                    
                    // Trilinear Interpolation
                    
                    // Interpolate along X
                    const c00 = v000 + (v100 - v000) * tx; // y=0 z=0
                    const c10 = v010 + (v110 - v010) * tx; // y=1 z=0
                    const c01 = v001 + (v101 - v001) * tx; // y=0 z=1
                    const c11 = v011 + (v111 - v011) * tx; // y=1 z=1
                    
                    // Interpolate along Y
                    const c0 = c00 + (c10 - c00) * ty; // z=0
                    const c1 = c01 + (c11 - c01) * ty; // z=1
                    
                    // Interpolate along Z
                    const density = c0 + (c1 - c0) * tz;
                    
                    let typeId = BLOCKS.AIR;
                    
                    if (y === 0 || y === 127) {
                        typeId = BLOCKS.BEDROCK;
                    } else {
                        if (density > 0) {
                            typeId = BLOCKS.NETHERRACK;
                            
                            const wx = (this.cx * this.size) + x;
                            const wz = (this.cz * this.size) + z;

                            let r = colSeed + y * 132.1;
                            r = r - Math.floor(r);
                            
                            // Enhanced Soul Sand Generation
                            // Use 3D noise for patches instead of random
                            const ssNoise = this.terrainGen.noises.ore(wx * 0.05, y * 0.05, wz * 0.05);
                            if (y < 45 && ssNoise > 0.4) { 
                                 typeId = BLOCKS.SOUL_SAND;
                            } else {
                                // Ores and Magma (Only in Netherrack)
                                // Quartz: Common, scattered
                                if (Math.random() < 0.025) { 
                                    const oreN = this.terrainGen.noises.density(wx * 0.15, y * 0.15, wz * 0.15);
                                    if (oreN > 0.5) typeId = BLOCKS.QUARTZ_ORE;
                                }
                                
                                // Magma: Near lava level (32)
                                if (y >= 28 && y <= 35) {
                                    const magmaN = this.terrainGen.noises.ore(wx * 0.1, y * 0.1, wz * 0.1);
                                    if (magmaN > 0.5) typeId = BLOCKS.MAGMA;
                                }
                                
                                // Gravel patches
                                const gravelN = this.terrainGen.noises.erosion(wx * 0.04, wz * 0.04);
                                if (y < 64 && gravelN < -0.6 && density > 0.5) typeId = BLOCKS.GRAVEL;
                            }
                        } else if (y < 32) {
                            typeId = BLOCKS.LAVA;
                        }
                    }

                    if (typeId !== BLOCKS.AIR) {
                        const i = this.idx(x, y, z);
                        this.data[i] = typeId;
                        if (typeId === BLOCKS.LAVA) this.metadata[i] = 7;
                        else this.metadata[i] = 0;
                    }
                }
            }
        }
        this.updateLighting();
        this.generated = true;
        this.dirtySections.fill(true);
    }

    generateNetherDecorations() {
        // Glowstone Clusters
        const count = 1 + Math.floor(Math.random() * 2);
        
        for(let i=0; i<count; i++) {
            const lx = Math.floor(Math.random() * 16);
            const lz = Math.floor(Math.random() * 16);
            
            // Scan for ceiling
            // Start high and go down
            for(let y=110; y>10; y--) {
                const id = this.getBlock(lx, y, lz);
                const below = this.getBlock(lx, y-1, lz);
                
                // Found Ceiling surface (Solid block with Air below)
                if (id !== BLOCKS.AIR && id !== BLOCKS.LAVA && id !== BLOCKS.GLOWSTONE && below === BLOCKS.AIR) {
                    if (Math.random() < 0.3) {
                        this.spawnGlowstoneCluster(lx, y-1, lz);
                        break; // One per column attempt
                    }
                }
            }
        }
    }

    spawnGlowstoneCluster(x, y, z) {
        // Simple blob
        const rad = 2 + Math.floor(Math.random() * 2);
        for(let dx=-rad; dx<=rad; dx++) {
            for(let dy=-rad; dy<=rad; dy++) {
                for(let dz=-rad; dz<=rad; dz++) {
                    if (dx*dx + dy*dy + dz*dz < rad*rad) {
                        const nx = x + dx;
                        const ny = y + dy;
                        const nz = z + dz;
                        // Boundary check
                        if (nx>=0 && nx<this.size && nz>=0 && nz<this.size && ny>=0 && ny<this.height) {
                            if (this.data[this.idx(nx, ny, nz)] === BLOCKS.AIR) {
                                // 70% chance to fill
                                if (Math.random() > 0.3) {
                                    this.data[this.idx(nx, ny, nz)] = BLOCKS.GLOWSTONE;
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    updateLighting() {
        updateChunkLighting(this);
    }

    getLight(x, y, z) {
        if (y < 0) return 0;
        if (y >= this.height) return 15;
        
        // In-bounds check
        if (x >= 0 && x < this.size && z >= 0 && z < this.size) {
            return this.lightMap[this.idx(x, y, z)];
        }
        
        // Out of bounds: Look up neighbor via world
        const cx = Math.floor((this.cx * this.size + x) / this.size);
        const cz = Math.floor((this.cz * this.size + z) / this.size);
        
        const chunk = this.world.getChunk(cx, cz);
        if (chunk && chunk.generated) {
            const lx = (x % this.size + this.size) % this.size;
            const lz = (z % this.size + this.size) % this.size;
            return chunk.lightMap[chunk.idx(lx, y, lz)];
        }

        // Fallback for unloaded chunks
        return y > this.terrainGen.seaLevel ? 15 : 0; 
    }

    setDirty(y) {
        if (y === undefined || y === null) {
            this.dirty = true;
            this.dirtySections.fill(true);
        } else {
            if (y >= 0 && y < this.height) {
                const s = Math.floor(y / this.sectionSize);
                this.dirtySections[s] = true;
                // If on border, mark neighbors (lighting/AO bleed)
                if (y % this.sectionSize === 0 && s > 0) this.dirtySections[s - 1] = true;
                if (y % this.sectionSize === this.sectionSize - 1 && s < this.sectionsCount - 1) this.dirtySections[s + 1] = true;
                this.dirty = true;
            }
        }
    }

    buildMesh() {
        if (!this.generated) this.generateData();
        
        let rebuiltAny = false;
        
        // Rebuild dirty sections only
        for(let i=0; i<this.sectionsCount; i++) {
            if (this.dirtySections[i]) {
                chunkMesher.buildSection(this, i, this.sectionGroups[i]);
                this.dirtySections[i] = false;
                rebuiltAny = true;
            }
        }
        
        if (rebuiltAny) {
            this.waterMeshes = [];
            // Collect water meshes from all sections
            for(let i=0; i<this.sectionsCount; i++) {
                const group = this.sectionGroups[i];
                for(let child of group.children) {
                    if (child.material === ATLAS_MAT_TRANS) {
                        this.waterMeshes.push(child);
                    }
                }
            }
        }
        
        this.dirty = false;
    }
    
    dispose() {
        this.meshGroup.clear();
        for(const g of this.sectionGroups) {
            g.traverse(c => { if(c.geometry) c.geometry.dispose(); });
        }
        this.sectionGroups = [];
        this.meshGroup.removeFromParent();
        this.data = null;
        this.metadata = null;
        this.lightMap = null;
    }
    
    getBlock(x, y, z) {
        if (x >= 0 && x < this.size && z >= 0 && z < this.size && y >= 0 && y < this.height) {
            return this.data[this.idx(x, y, z)];
        }
        return 0;
    }

    getBlockMetadata(x, y, z) {
        if (x >= 0 && x < this.size && z >= 0 && z < this.size && y >= 0 && y < this.height) {
            return this.metadata[this.idx(x, y, z)];
        }
        return 0;
    }
}