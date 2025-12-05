import * as THREE from 'three';
import { Chunk } from './chunk.js';
import { BLOCKS, isFoliage } from './blocks.js';
import { CONFIG } from './config.js';
import { updateChunkLighting } from './chunk/lighting.js';

const _fluidDirs = [[1,0], [-1,0], [0,1], [0,-1]];

export class World {
    constructor(scene, terrainGen) {
        this.scene = scene;
        this.terrainGen = terrainGen;
        this.chunkGroup = new THREE.Group();
        this.scene.add(this.chunkGroup);
        
        // Chunk storage for multiple dimensions
        this.chunkMaps = {
            'overworld': new Map(),
            'nether': new Map()
        };
        this.chunks = this.chunkMaps['overworld']; // Current active chunks
        
        this.renderDistance = CONFIG.RENDER_DISTANCE_DEFAULT;
        this.chunkSize = 16;
        this.lastChunkX = null;
        this.lastChunkZ = null;
        this.chunkQueue = [];
        
        // Optimization: Dirty Set to avoid iterating all chunks
        this.dirtyChunks = new Set();
        
        // Modifications
        this.modifiedBlocks = new Map(); // Key "x,y,z" -> {id, meta}

        // Physics Updates
        this.updateQueue = []; // Packed array [x, y, z, x, y, z...]
        this.physicsTimer = 0;
        this.randomTickTimer = 0;
        this.chunkUpdateLimit = 4; // Reduced from 8 to 4 to reduce stutter
        this.fallingBlockManager = null;
        this.dimension = 'overworld';
        this.randomTickSpeed = 3;

        // View Culling
        this.frustum = new THREE.Frustum();
        this.projScreenMatrix = new THREE.Matrix4();
        this.chunkBox = new THREE.Box3();
    }

    setDimension(dim) {
        if (this.dimension === dim) return;
        this.dimension = dim;
        
        // Swap chunk map
        if (!this.chunkMaps[dim]) this.chunkMaps[dim] = new Map();
        this.chunks = this.chunkMaps[dim];
        
        // Update Scene Graph
        this.chunkGroup.clear();
        for (const chunk of this.chunks.values()) {
            if (chunk.meshGroup) this.chunkGroup.add(chunk.meshGroup);
        }
        
        // Reset state for new dimension
        this.dirtyChunks.clear();
        this.lastChunkX = null;
        this.lastChunkZ = null;
        this.chunkQueue = [];
        this.updateQueue = [];
    }

    setFallingBlockManager(fbm) {
        this.fallingBlockManager = fbm;
    }

    update(playerPos, time, delta, camera = null, isPreloading = false) { // Added delta
        const currentChunkX = Math.floor(playerPos.x / this.chunkSize);
        const currentChunkZ = Math.floor(playerPos.z / this.chunkSize);
        
        // updateWaterTexture(time); // REMOVED to fix buggy texture scrolling
        
        if (currentChunkX !== this.lastChunkX || currentChunkZ !== this.lastChunkZ) {
            this.lastChunkX = currentChunkX;
            this.lastChunkZ = currentChunkZ;
            this.queueChunks(currentChunkX, currentChunkZ);
            this.unloadChunks(currentChunkX, currentChunkZ);
        }

        this.processQueue(isPreloading);

        // Update Physics (Fluids & Falling Blocks) - 20 TPS (0.05s) for smooth reactions
        this.physicsTimer += delta || 0.016;
        if (this.physicsTimer >= 0.05) {
            this.physicsTimer = 0;
            this.processUpdates();
        }

        // Random Ticks (Growth, etc) - Slower (0.1s or dependent on randomTickSpeed)
        this.randomTickTimer += delta || 0.016;
        if (this.randomTickTimer >= 0.1) {
            this.randomTickTimer = 0;
            this.processRandomTicks();
        }
        
        // Process dirty chunks (Rebuild meshes)
        // Limit to chunkUpdateLimit per frame to handle lighting updates faster, iterate Set for O(1) access
        if (this.dirtyChunks.size > 0) {
            let processed = 0;
            const limit = isPreloading ? 200 : this.chunkUpdateLimit; // Speed up dirty updates during preload
            for (const key of this.dirtyChunks) {
                const chunk = this.chunks.get(key);
                if (chunk && chunk.generated) {
                    chunk.buildMesh();
                }
                this.dirtyChunks.delete(key);
                processed++;
                if (processed >= limit) break;
            }
        }

        if (camera) this.updateCulling(camera);
    }

    updateCulling(camera) {
        this.projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        this.frustum.setFromProjectionMatrix(this.projScreenMatrix);

        for (const chunk of this.chunks.values()) {
            if (!chunk.meshGroup) continue;

            const minX = chunk.cx * this.chunkSize;
            const minZ = chunk.cz * this.chunkSize;
            
            this.chunkBox.min.set(minX, -64, minZ);
            this.chunkBox.max.set(minX + this.chunkSize, 320, minZ + this.chunkSize);

            chunk.meshGroup.visible = this.frustum.intersectsBox(this.chunkBox);
        }
    }

    queueChunks(cx, cz) {
        for (let x = -this.renderDistance; x <= this.renderDistance; x++) {
            for (let z = -this.renderDistance; z <= this.renderDistance; z++) {
                const key = `${cx + x},${cz + z}`;
                if (!this.chunks.has(key)) {
                    if (!this.chunkQueue.some(c => c.key === key)) {
                        const dist = Math.sqrt(x*x + z*z);
                        this.chunkQueue.push({ key, cx: cx + x, cz: cz + z, dist });
                    }
                }
            }
        }
        this.chunkQueue.sort((a, b) => a.dist - b.dist);
    }

    processQueue(isPreloading = false) {
        const startTime = performance.now();
        // Reduced budget for smoother runtime loading
        const budget = isPreloading ? 100 : 2; 

        while (this.chunkQueue.length > 0) {
            if (performance.now() - startTime > budget) break;

            const item = this.chunkQueue.shift();
            if (this.chunks.has(item.key)) continue;

            const chunk = new Chunk(item.cx, item.cz, this);
            chunk.generateData(); 
            this.chunks.set(item.key, chunk); 
            
            chunk.buildMesh(); 
            this.chunkGroup.add(chunk.meshGroup);
            
            // Update neighbors lighting and visibility
            const neighbors = [
                { cx: item.cx - 1, cz: item.cz },
                { cx: item.cx + 1, cz: item.cz },
                { cx: item.cx, cz: item.cz - 1 },
                { cx: item.cx, cz: item.cz + 1 }
            ];

            for (const n of neighbors) {
                const nc = this.getChunk(n.cx, n.cz);
                if (nc && nc.generated) {
                    updateChunkLighting(nc); // Recalculate light to account for new chunk blocking/allowing light
                    this.triggerUpdate(n.cx, n.cz); // Rebuild mesh
                }
            }
            
            // Update Diagonals to fix corner AO seams
            this.triggerUpdate(item.cx - 1, item.cz - 1);
            this.triggerUpdate(item.cx + 1, item.cz + 1);
            this.triggerUpdate(item.cx - 1, item.cz + 1);
            this.triggerUpdate(item.cx + 1, item.cz - 1);
        }
    }

    unloadChunks(cx, cz) {
        for (const [key, chunk] of this.chunks) {
            const dist = Math.sqrt((chunk.cx - cx)**2 + (chunk.cz - cz)**2);
            if (dist > this.renderDistance + 1) {
                chunk.dispose();
                this.chunks.delete(key);
            }
        }
    }

    getBiomeInfo(x, z) {
        return this.terrainGen.getBiomeData(x, z);
    }

    setBlock(x, y, z, id, meta = 0, broadcast = true) {
        const cx = Math.floor(x / this.chunkSize);
        const cz = Math.floor(z / this.chunkSize);
        const key = `${cx},${cz}`;
        const chunk = this.chunks.get(key);
        if (chunk) {
            const lx = Math.floor(x) - cx * this.chunkSize;
            const lz = Math.floor(z) - cz * this.chunkSize;
            const ly = Math.floor(y);
            
            const oldId = chunk.getBlock(lx, ly, lz);
            const oldMeta = chunk.getBlockMetadata(lx, ly, lz);
            
            if (oldId !== id || oldMeta !== meta) {
                chunk.setBlock(lx, ly, lz, id, meta);
                
                // Save Modification
                this.modifiedBlocks.set(`${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`, { id, meta });

                // Recalculate lighting for this chunk
                updateChunkLighting(chunk);
                this.triggerUpdate(cx, cz); // Rebuild this mesh

                // Trigger Neighbor Updates (Geometry/Connections & Lighting)
                // Explicitly check all 4 horizontal neighbors to ensure cross-chunk connections update
                const neighbors = [
                    { nx: x + 1, nz: z },
                    { nx: x - 1, nz: z },
                    { nx: x, nz: z + 1 },
                    { nx: x, nz: z - 1 }
                ];

                for (const n of neighbors) {
                    const nCx = Math.floor(n.nx / this.chunkSize);
                    const nCz = Math.floor(n.nz / this.chunkSize);
                    
                    // If neighbor is in a different chunk, update it
                    if (nCx !== cx || nCz !== cz) {
                        const nChunk = this.getChunk(nCx, nCz);
                        if (nChunk) {
                            updateChunkLighting(nChunk); // Fix lighting seams
                            this.triggerUpdate(nCx, nCz); // Rebuild neighbor mesh (connect fences)
                        }
                    }
                }
                
                // Broadcast to network
                if (broadcast && this.networkManager) {
                    this.networkManager.broadcastBlockUpdate(x, y, z, id);
                }

                // Trigger Physics Updates
                this.scheduleUpdate(x, y, z);
                this.scheduleUpdate(x, y+1, z); 
                this.scheduleUpdate(x, y-1, z);
                this.scheduleUpdate(x+1, y, z);
                this.scheduleUpdate(x-1, y, z);
                this.scheduleUpdate(x, y, z+1);
                this.scheduleUpdate(x, y, z-1);
            }
        }
    }
    
    scheduleUpdate(x, y, z) {
        if (this.updateQueue.length < 6000) { // 2000 updates * 3
            this.updateQueue.push(x, y, z);
        }
    }

    triggerUpdate(cx, cz, y = null) {
        const key = `${cx},${cz}`;
        const chunk = this.chunks.get(key);
        if (chunk) {
            // Fix: Re-calculate lighting when neighbors update to prevent shadows/seams
            if (chunk.generated) {
                updateChunkLighting(chunk);
            }
            chunk.setDirty(y); // Update specific section
            this.dirtyChunks.add(key);
        }
    }

    processUpdates() {
        const limit = 6000; 
        const batch = this.updateQueue.splice(0, limit);
        
        for (let i = 0; i < batch.length; i += 3) {
            const x = batch[i];
            const y = batch[i+1];
            const z = batch[i+2];
            
            const id = this.getBlock(x, y, z);
            if (id === BLOCKS.WATER) {
                this.updateWater(x, y, z);
            } else if (id === BLOCKS.LAVA) {
                this.updateLava(x, y, z);
            } else if (id === BLOCKS.SAND || id === BLOCKS.GRAVEL) {
                this.updateFallingBlock(x, y, z);
            } else if (id === BLOCKS.FARMLAND || id === BLOCKS.FARMLAND_MOIST) {
                this.updateFarmland(x, y, z);
            } else if (id === BLOCKS.WHEAT) {
                // Check support
                const below = this.getBlock(x, y - 1, z);
                if (below !== BLOCKS.FARMLAND && below !== BLOCKS.FARMLAND_MOIST) {
                    this.setBlock(x, y, z, BLOCKS.AIR);
                    // Drop seed
                    if(this.itemManager) this.itemManager.spawnItem(new THREE.Vector3(x+0.5, y+0.5, z+0.5), BLOCKS.WHEAT_SEEDS);
                }
            }
        }
    }

    processRandomTicks() {
        // Pick random active chunks from mesh list to save performance
        const visibleChunks = [];
        for (const chunk of this.chunks.values()) {
            if (chunk.meshGroup.visible) visibleChunks.push(chunk);
        }
        
        if (visibleChunks.length === 0) return;
        
        // Scale ticks based on randomTickSpeed (simulating sub-chunks roughly)
        // MC default is 3 ticks per sub-chunk (16x16x16). 
        // We'll approximate to ensure performance in JS.
        const ticksPerChunk = this.randomTickSpeed * 8; 

        for (const chunk of visibleChunks) {
            for (let i = 0; i < ticksPerChunk; i++) {
                const lx = Math.floor(Math.random() * 16);
                const lz = Math.floor(Math.random() * 16);
                const ly = Math.floor(Math.random() * this.chunkSize * 20) % 256; // Random height up to 256
                
                const id = chunk.getBlock(lx, ly, lz);
                const wx = chunk.cx * 16 + lx;
                const wz = chunk.cz * 16 + lz;

                if (id === BLOCKS.FIRE) {
                    // Fire Spread Logic
                    // 1. Burn out chance
                    if (Math.random() < 0.3) { // High burnout rate to prevent infinite fires
                        this.setBlock(wx, ly, wz, BLOCKS.AIR);
                        continue;
                    }

                    // 2. Spread
                    const trySpread = (dx, dy, dz) => {
                        const targetId = this.getBlock(wx + dx, ly + dy, wz + dz);
                        if (targetId === BLOCKS.AIR) {
                            // Check for flammable neighbors around target
                            // If adjacent to flammable, chance to ignite
                            if (this.hasFlammableNeighbor(wx + dx, ly + dy, wz + dz)) {
                                if (Math.random() < 0.2) { // Spread chance
                                    this.setBlock(wx + dx, ly + dy, wz + dz, BLOCKS.FIRE);
                                }
                            }
                        } else if (this.isFlammable(targetId)) {
                            // Burn existing block
                            if (Math.random() < 0.1) {
                                this.setBlock(wx + dx, ly + dy, wz + dz, BLOCKS.FIRE);
                            }
                        }
                    };

                    // Check area
                    for (let x = -1; x <= 1; x++) {
                        for (let y = -1; y <= 1; y++) {
                            for (let z = -1; z <= 1; z++) {
                                if (x === 0 && y === 0 && z === 0) continue;
                                trySpread(x, y, z);
                            }
                        }
                    }
                } else if (id === BLOCKS.WHEAT) {
                    const meta = chunk.getBlockMetadata(lx, ly, lz);
                    if (meta < 7) {
                        const light = chunk.getLight(lx, ly, lz);
                        if (light >= 9) {
                            // Hydration bonus
                            const below = this.getBlock(wx, ly-1, wz);
                            const chance = (below === BLOCKS.FARMLAND_MOIST) ? 0.3 : 0.1;
                            
                            if (Math.random() < chance) {
                                this.setBlock(wx, ly, wz, BLOCKS.WHEAT, meta + 1);
                            }
                        }
                    }
                } else if (id === BLOCKS.FARMLAND || id === BLOCKS.FARMLAND_MOIST) {
                    const above = this.getBlock(wx, ly + 1, wz);
                    // Decay logic: If no crops above, chance to turn to dirt
                    if (above !== BLOCKS.WHEAT && above !== BLOCKS.PUMPKIN && above !== BLOCKS.MELON) {
                        // If moist, maybe dry out first? For simplicity, if standard farmland (dry) and no water nearby, revert.
                        // check hydration
                        let hydrated = false;
                        if (id === BLOCKS.FARMLAND_MOIST) hydrated = true;
                        else {
                            // Check water range
                            const range = 4;
                            search: for (let dx = -range; dx <= range; dx++) {
                                for (let dz = -range; dz <= range; dz++) {
                                    const b = this.getBlock(wx + dx, ly, wz + dz);
                                    if (b === BLOCKS.WATER) { hydrated = true; break search; }
                                }
                            }
                        }

                        if (!hydrated) {
                            this.setBlock(wx, ly, wz, BLOCKS.DIRT);
                        } else if (id === BLOCKS.FARMLAND) {
                            // Randomly hydrate if near water
                            this.setBlock(wx, ly, wz, BLOCKS.FARMLAND_MOIST);
                        }
                    }
                } else if (id === BLOCKS.GRASS) {
                    // Grass spread / decay logic could go here
                    const light = chunk.getLight(lx, ly + 1, lz);
                    if (light < 4 && this.getBlock(wx, ly + 1, wz) !== BLOCKS.AIR) {
                        this.setBlock(wx, ly, wz, BLOCKS.DIRT);
                    }
                } else if (id >= 160 && id <= 165) {
                    // Sapling Growth
                    const light = chunk.getLight(lx, ly, lz);
                    // Needs light
                    if (light >= 9) {
                        // Random chance (approx 1/10 per random tick batch)
                        if (Math.random() < 0.15) {
                            this.growTree(wx, ly, wz, id);
                        }
                    }
                }
            }
        }
    }

    isFlammable(id) {
        return (id === BLOCKS.LOG || 
                id === BLOCKS.PLANKS || 
                id === BLOCKS.LEAVES || 
                id === BLOCKS.OAK_FENCE || 
                id === BLOCKS.OAK_STAIRS || 
                id === BLOCKS.OAK_SLAB ||
                id === BLOCKS.CRAFTING_TABLE || 
                id === BLOCKS.BOOKSHELF || // Future proofing
                isFoliage(id) ||
                (id >= 51 && id <= 65) || // New Woods
                (id >= 69 && id <= 74)); // Stripped Logs
    }

    hasFlammableNeighbor(x, y, z) {
        const check = (dx, dy, dz) => this.isFlammable(this.getBlock(x+dx, y+dy, z+dz));
        return check(1,0,0) || check(-1,0,0) || check(0,1,0) || check(0,-1,0) || check(0,0,1) || check(0,0,-1);
    }

    setBlocks(updates) {
        const lightingUpdates = new Set();

        // 1. Apply Data Changes
        for(const u of updates) {
            const cx = Math.floor(u.x / this.chunkSize);
            const cz = Math.floor(u.z / this.chunkSize);
            const key = `${cx},${cz}`;
            const chunk = this.chunks.get(key);
            
            if (chunk) {
                const lx = Math.floor(u.x) - cx * this.chunkSize;
                const lz = Math.floor(u.z) - cz * this.chunkSize;
                const ly = Math.floor(u.y);
                
                const idx = chunk.idx(lx, ly, lz);
                if (chunk.data[idx] !== u.id || chunk.metadata[idx] !== (u.meta||0)) {
                    chunk.data[idx] = u.id;
                    chunk.metadata[idx] = u.meta || 0;
                    chunk.generated = true;
                    // Note: We intentionally don't rebuild mesh here, deferred to step 2
                    
                    this.modifiedBlocks.set(`${Math.floor(u.x)},${Math.floor(u.y)},${Math.floor(u.z)}`, { id: u.id, meta: u.meta || 0 });
                    
                    // Mark this chunk and neighbors for lighting/meshing updates
                    lightingUpdates.add(key);
                    lightingUpdates.add(`${cx-1},${cz}`);
                    lightingUpdates.add(`${cx+1},${cz}`);
                    lightingUpdates.add(`${cx},${cz-1}`);
                    lightingUpdates.add(`${cx},${cz+1}`);

                    // Network broadcast
                    if (this.networkManager) {
                        this.networkManager.broadcastBlockUpdate(u.x, u.y, u.z, u.id);
                    }
                    
                    this.scheduleUpdate(u.x, u.y, u.z);
                }
            }
        }

        // 2. Recalculate Lighting & Trigger Rebuilds
        for(const key of lightingUpdates) {
            const chunk = this.chunks.get(key);
            if (chunk && chunk.generated) {
                updateChunkLighting(chunk);
                chunk.setDirty(null); // Mark full chunk dirty to ensure lighting propagates to mesh
                this.dirtyChunks.add(key);
            }
        }
    }

    growTree(x, y, z, saplingId) {
        let logId = BLOCKS.LOG;
        let leafId = BLOCKS.LEAVES;
        let height = 5;

        // Map Sapling to Wood/Leaves
        switch(saplingId) {
            case BLOCKS.OAK_SAPLING: logId = BLOCKS.LOG; leafId = BLOCKS.LEAVES; break;
            case BLOCKS.SPRUCE_SAPLING: logId = BLOCKS.SPRUCE_LOG; leafId = BLOCKS.SPRUCE_LEAVES; height = 7; break;
            case BLOCKS.BIRCH_SAPLING: logId = BLOCKS.BIRCH_LOG; leafId = BLOCKS.BIRCH_LEAVES; break;
            case BLOCKS.JUNGLE_SAPLING: logId = BLOCKS.JUNGLE_LOG; leafId = BLOCKS.JUNGLE_LEAVES; height = 8; break;
            case BLOCKS.ACACIA_SAPLING: logId = BLOCKS.ACACIA_LOG; leafId = BLOCKS.ACACIA_LEAVES; break;
            case BLOCKS.DARK_OAK_SAPLING: logId = BLOCKS.DARK_OAK_LOG; leafId = BLOCKS.DARK_OAK_LEAVES; break;
        }

        // 1. Check clearance
        for(let i=1; i<height; i++) {
            const b = this.getBlock(x, y+i, z);
            if(b !== BLOCKS.AIR && !isFoliage(b)) return false; // Blocked
        }

        const updates = [];

        // 2. Remove Sapling
        updates.push({x, y, z, id: BLOCKS.AIR});

        // 3. Build Trunk
        for(let i=0; i<height; i++) {
            updates.push({x, y: y+i, z, id: logId});
        }

        // 4. Build Leaves
        const leafStart = height - 2;
        const leafEnd = height + 1;
        
        for(let ly=leafStart; ly<=leafEnd; ly++) {
            const rad = (ly === leafEnd) ? 1 : 2;
            for(let lx=-rad; lx<=rad; lx++) {
                for(let lz=-rad; lz<=rad; lz++) {
                    // Skip corners for rounded look, random skip top corners
                    if (Math.abs(lx)===rad && Math.abs(lz)===rad && (ly!==leafEnd || Math.random()>0.5)) continue;
                    
                    const wx = x + lx;
                    const wy = y + ly;
                    const wz = z + lz;
                    
                    const curr = this.getBlock(wx, wy, wz);
                    if (curr === BLOCKS.AIR || isFoliage(curr)) {
                        updates.push({x: wx, y: wy, z: wz, id: leafId});
                    }
                }
            }
        }
        
        this.setBlocks(updates);
        return true;
    }

    updateFarmland(x, y, z) {
        const id = this.getBlock(x, y, z);
        let hydrated = false;
        
        // Search 9x9 area, y and y+1
        const range = 4;
        search: for (let dx = -range; dx <= range; dx++) {
            for (let dz = -range; dz <= range; dz++) {
                const b = this.getBlock(x + dx, y, z + dz);
                const bu = this.getBlock(x + dx, y + 1, z + dz);
                if (b === BLOCKS.WATER || bu === BLOCKS.WATER) {
                    hydrated = true;
                    break search;
                }
            }
        }
        
        const newId = hydrated ? BLOCKS.FARMLAND_MOIST : BLOCKS.FARMLAND;
        if (newId !== id) {
            this.setBlock(x, y, z, newId);
        }
    }

    updateFallingBlock(x, y, z) {
        const below = this.getBlock(x, y - 1, z);
        // If block below is Air or Water (replaceable)
        if (below === BLOCKS.AIR || below === BLOCKS.WATER) {
            const myId = this.getBlock(x, y, z);
            
            if (this.fallingBlockManager) {
                this.fallingBlockManager.spawnFallingBlock(x, y, z, myId);
            } else {
                // Fallback (Instant)
                this.setBlock(x, y, z, BLOCKS.AIR);
                this.setBlock(x, y - 1, z, myId);
                // Schedule subsequent update to keep falling
                this.scheduleUpdate(x, y - 1, z);
            }
        }
    }

    updateWater(x, y, z) {
        const meta = this.getBlockMetadata(x, y, z);
        const decay = 2; // Increased decay for shorter streams (less massive)
        
        // Infinite Source Logic (Horizontal neighbors only)
        // Only convert flowing water (meta < 7) to source (7)
        if (meta < 7) {
            let sourceNeighbors = 0;
            for(const [dx, dz] of _fluidDirs) {
                const nb = this.getBlock(x+dx, y, z);
                const nm = this.getBlockMetadata(x+dx, y, z);
                if (nb === BLOCKS.WATER && nm === 7) sourceNeighbors++;
            }
            if (sourceNeighbors >= 2) {
                this.setBlock(x, y, z, BLOCKS.WATER, 7);
                return;
            }
        }

        const below = this.getBlock(x, y-1, z);
        
        if (below === BLOCKS.AIR) { 
            // Flow Down: Fast fall (no random delay)
            // Inherit meta instead of resetting to 7 to prevent volume amplification
            // Ensure it doesn't die completely if it's too weak, but allowed to be thin
            const dropMeta = meta; 
            this.setBlock(x, y-1, z, BLOCKS.WATER, dropMeta); 
            return; 
        } else if (below === BLOCKS.LAVA) {
            const lMeta = this.getBlockMetadata(x, y-1, z);
            if (lMeta === 7) this.setBlock(x, y-1, z, BLOCKS.OBSIDIAN);
            else this.setBlock(x, y-1, z, BLOCKS.COBBLESTONE);
            return;
        }
        
        // Horizontal Spread: Keep random delay for viscous feel
        if (Math.random() > 0.2) { 
             this.scheduleUpdate(x, y, z);
             return;
        }

        if (meta > 1) { 
             // Use a local copy or shuffle the static array copy to prevent bias
             const dirs = [..._fluidDirs];
             if (Math.random() > 0.5) dirs.reverse();

             for(const [dx, dz] of dirs) {
                 const nx = x + dx;
                 const nz = z + dz;
                 const nId = this.getBlock(nx, y, nz);
                 
                 // Check if we can spread
                 const newMeta = meta - decay;
                 if (newMeta < 1) continue;

                 if (nId === BLOCKS.AIR) { 
                     this.setBlock(nx, y, nz, BLOCKS.WATER, newMeta);
                 } else if (nId === BLOCKS.WATER) { 
                     const nMeta = this.getBlockMetadata(nx, y, nz);
                     if (nMeta < newMeta) {
                         this.setBlock(nx, y, nz, BLOCKS.WATER, newMeta);
                     }
                 } else if (nId === BLOCKS.LAVA) {
                     this.setBlock(nx, y, nz, BLOCKS.COBBLESTONE);
                 }
             }
        }
    }

    updateLava(x, y, z) {
        // Slower flow than water
        const chance = (this.dimension === 'nether') ? 0.25 : 0.06;
        if (Math.random() > chance) {
             this.scheduleUpdate(x, y, z); 
             return;
        }

        const meta = this.getBlockMetadata(x, y, z);
        // Nether lava flows further (decay 1), Overworld decay 2
        const decay = this.dimension === 'nether' ? 1 : 2;
        
        const below = this.getBlock(x, y-1, z);
        
        if (below === BLOCKS.AIR) { 
            this.setBlock(x, y-1, z, BLOCKS.LAVA, 7); 
            return; 
        } else if (below === BLOCKS.WATER) {
            this.setBlock(x, y-1, z, BLOCKS.STONE);
            return;
        } else if (below === BLOCKS.LAVA) {
             if (this.getBlockMetadata(x, y-1, z) < 7) this.setBlock(x, y-1, z, BLOCKS.LAVA, 7);
        }
        
        if (meta > 0) { 
             const dirs = [..._fluidDirs];
             if (Math.random() > 0.5) dirs.reverse();

             for(const [dx, dz] of dirs) {
                 const nx = x + dx;
                 const nz = z + dz;
                 const nId = this.getBlock(nx, y, nz);
                 
                 let newMeta = meta - decay;
                 if (newMeta < 0) newMeta = 0;
                 
                 if (meta <= decay && this.dimension !== 'nether') continue;

                 if (nId === BLOCKS.AIR) { 
                     this.setBlock(nx, y, nz, BLOCKS.LAVA, newMeta);
                 } else if (nId === BLOCKS.LAVA) { 
                     const nMeta = this.getBlockMetadata(nx, y, nz);
                     if (nMeta < newMeta) {
                         this.setBlock(nx, y, nz, BLOCKS.LAVA, newMeta);
                     }
                 } else if (nId === BLOCKS.WATER) {
                     this.setBlock(nx, y, nz, BLOCKS.STONE);
                 }
             }
        }
    }
    
    triggerUpdate(cx, cz) {
        const key = `${cx},${cz}`;
        const chunk = this.chunks.get(key);
        if (chunk) {
            chunk.dirty = true;
            this.dirtyChunks.add(key);
        }
    }

    getBlock(x, y, z) {
        const cx = Math.floor(x / this.chunkSize);
        const cz = Math.floor(z / this.chunkSize);
        const key = `${cx},${cz}`;
        const chunk = this.chunks.get(key);
        if (chunk) {
            const lx = Math.floor(x) - cx * this.chunkSize;
            const lz = Math.floor(z) - cz * this.chunkSize;
            const ly = Math.floor(y);
            return chunk.getBlock(lx, ly, lz);
        }
        return -1; // Unloaded
    }

    getBlockMetadata(x, y, z) {
        const cx = Math.floor(x / this.chunkSize);
        const cz = Math.floor(z / this.chunkSize);
        const key = `${cx},${cz}`;
        const chunk = this.chunks.get(key);
        if (chunk) {
            const lx = Math.floor(x) - cx * this.chunkSize;
            const lz = Math.floor(z) - cz * this.chunkSize;
            const ly = Math.floor(y);
            return chunk.getBlockMetadata(lx, ly, lz);
        }
        return 0;
    }

    getLight(x, y, z) {
        const cx = Math.floor(x / this.chunkSize);
        const cz = Math.floor(z / this.chunkSize);
        const chunk = this.getChunk(cx, cz); // Use helper
        if (chunk) {
            const lx = Math.floor(x) - cx * this.chunkSize;
            const lz = Math.floor(z) - cz * this.chunkSize;
            const ly = Math.floor(y);
            return chunk.getLight(lx, ly, lz);
        }
        // Fallback
        return y > this.terrainGen.seaLevel ? 15 : 0;
    }

    getChunk(cx, cz) {
        return this.chunks.get(`${cx},${cz}`);
    }

    getChunkModifications(cx, cz) {
        const mods = [];
        const startX = cx * 16;
        const startZ = cz * 16;
        const endX = startX + 16;
        const endZ = startZ + 16;
        
        for (const [key, val] of this.modifiedBlocks) {
            const [bx, by, bz] = key.split(',').map(Number);
            if (bx >= startX && bx < endX && bz >= startZ && bz < endZ) {
                mods.push({ x: bx - startX, y: by, z: bz - startZ, id: val.id, meta: val.meta });
            }
        }
        return mods;
    }

    loadModifications(data) {
        this.modifiedBlocks.clear();
        if (typeof data === 'object') {
             for(const k in data) this.modifiedBlocks.set(k, data[k]);
        }
    }
    
    exportModifications() {
        const obj = {};
        for(const [k, v] of this.modifiedBlocks) {
            obj[k] = v;
        }
        return obj;
    }

    setRenderDistance(dist) {
        this.renderDistance = dist;
        // Force update
        this.lastChunkX = null; 
        this.lastChunkZ = null;
    }

    setNetworkManager(nm) {
        this.networkManager = nm;
    }

    clear() {
        // Dispose all chunks in all dimensions
        ['overworld', 'nether'].forEach(dim => {
            if (this.chunkMaps[dim]) {
                for (const chunk of this.chunkMaps[dim].values()) {
                    chunk.dispose();
                }
                this.chunkMaps[dim].clear();
            }
        });
        
        this.dirtyChunks.clear();
        this.chunkGroup.clear();
        this.lastChunkX = null;
        this.lastChunkZ = null;
        this.chunkQueue = [];
        this.updateQueue = [];
        this.waterMeshes = [];
    }
}