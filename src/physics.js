import * as THREE from 'three';
import { BLOCKS, isFoliage } from './blocks.js';

function connectsToFence(id) {
    if (id === BLOCKS.OAK_FENCE) return true;
    if (id === BLOCKS.GLASS_PANE) return true; // Connects to panes too
    // Solid block check matching Mesher logic
    // Exclude liquids, foliage, air, unloaded
    // ALLOW slabs and stairs
    if (id === BLOCKS.COBBLESTONE_SLAB || id === BLOCKS.OAK_SLAB || id === BLOCKS.COBBLESTONE_STAIRS || id === BLOCKS.OAK_STAIRS) return true;
    
    if (id !== BLOCKS.AIR && 
        id !== BLOCKS.WATER && 
        id !== BLOCKS.LAVA && 
        !isFoliage(id) && 
        id !== -1 && id !== 0) return true;
    return false;
}

function isStair(id) {
    return (id === BLOCKS.COBBLESTONE_STAIRS || id === BLOCKS.OAK_STAIRS);
}

export class Physics {
    constructor(world) {
        this.world = world;
    }

    isSolid(x, y, z) {
        const id = this.world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
        // Whitelist non-solid blocks
        if (id === BLOCKS.AIR || 
            id === BLOCKS.WATER || 
            id === BLOCKS.LAVA ||
            id === BLOCKS.MAGMA ||
            id === BLOCKS.CACTUS || 
            id === BLOCKS.DEAD_BUSH ||
            id === BLOCKS.DANDELION ||
            id === BLOCKS.PINK_TULIP ||
            id === BLOCKS.LILY_OF_THE_VALLEY ||
            id === BLOCKS.SUGAR_CANE ||
            id === BLOCKS.GRASS_PLANT ||
            id === BLOCKS.TALL_GRASS_BOTTOM ||
            id === BLOCKS.TALL_GRASS_TOP ||
            id === BLOCKS.TORCH ||
            id === BLOCKS.FIRE ||
            id === BLOCKS.NETHER_PORTAL || // Added to allow walking in
            id === BLOCKS.WHEAT ||
            id === BLOCKS.OAK_DOOR_BOTTOM || 
            id === BLOCKS.OAK_DOOR_TOP ||
            (id >= 75 && id <= 86) || // New Doors
            (id >= 160 && id <= 165) || // Saplings
            id === -1 // Unloaded
           ) return false;
        
        return true;
    }

    checkFenceCollision(x, y, z, pMinX, pMaxX, pMinZ, pMaxZ, pos, height) {
        const pMin = 0.375;
        const pMax = 0.625;
        
        // Post
        const postMinX = x + pMin;
        const postMaxX = x + pMax;
        const postMinZ = z + pMin;
        const postMaxZ = z + pMax;
        
        // Check Post AABB
        if (pMaxX > postMinX && pMinX < postMaxX && pMaxZ > postMinZ && pMinZ < postMaxZ) {
            return true;
        }
        
        // Check Connections
        // North (-Z)
        if (connectsToFence(this.world.getBlock(x, y, z-1))) {
            if (pMaxX > postMinX && pMinX < postMaxX && pMaxZ > z && pMinZ < postMinZ) return true;
        }
        // South (+Z)
        if (connectsToFence(this.world.getBlock(x, y, z+1))) {
            if (pMaxX > postMinX && pMinX < postMaxX && pMaxZ > postMaxZ && pMinZ < z+1) return true;
        }
        // West (-X)
        if (connectsToFence(this.world.getBlock(x-1, y, z))) {
            if (pMaxX > x && pMinX < postMinX && pMaxZ > postMinZ && pMinZ < postMaxZ) return true;
        }
        // East (+X)
        if (connectsToFence(this.world.getBlock(x+1, y, z))) {
            if (pMaxX > postMaxX && pMinX < x+1 && pMaxZ > postMinZ && pMinZ < postMaxZ) return true;
        }
        
        return false;
    }

    checkCollision(pos, radius, height) {
        const minX = Math.floor(pos.x - radius);
        const maxX = Math.floor(pos.x + radius);
        const minY = Math.floor(pos.y);
        const maxY = Math.floor(pos.y + height - 0.1);
        const minZ = Math.floor(pos.z - radius);
        const maxZ = Math.floor(pos.z + radius);

        const pMinX = pos.x - radius;
        const pMaxX = pos.x + radius;
        const pMinZ = pos.z - radius;
        const pMaxZ = pos.z + radius;
        const pMinY = pos.y;
        const pMaxY = pos.y + height;

        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) { 
                for (let z = minZ; z <= maxZ; z++) {
                     // 1. Standard Solid Check
                     if (this.isSolid(x, y, z)) {
                         const id = this.world.getBlock(x, y, z);
                         
                         // Slab Collision
                         if (id === BLOCKS.COBBLESTONE_SLAB || id === BLOCKS.OAK_SLAB) {
                             const meta = this.world.getBlockMetadata(x, y, z);
                             const isTop = (meta & 1) === 1;
                             // Check collision with the slab part
                             const slabYMin = y + (isTop ? 0.5 : 0.0);
                             const slabYMax = y + (isTop ? 1.0 : 0.5);
                             
                             if (pos.y < slabYMax && pos.y + height > slabYMin) return true;
                             continue; // Skip full block check
                         }
                         
                         // Fence Collision (Corrected shape)
                         if (id === BLOCKS.OAK_FENCE || id === BLOCKS.GLASS_PANE) {
                             // Panes are same logic as fences for collision basically
                             if (pos.y < y + 1.5 && pos.y + height > y) { // 1.5 height for fences, 1.0 for panes?
                                 // Panes are 1.0 high physically but fence logic handles connections
                                 const hTop = (id === BLOCKS.GLASS_PANE) ? y + 1.0 : y + 1.5;
                                 if (pos.y < hTop && pos.y + height > y) {
                                     if (this.checkFenceCollision(x, y, z, pMinX, pMaxX, pMinZ, pMaxZ, pos, height)) {
                                         return true;
                                     }
                                 }
                             }
                             continue;
                         }

                         // Stairs Collision (Partial Blocks)
                         if (isStair(id)) {
                             const meta = this.world.getBlockMetadata(x, y, z);
                             const isUpsideDown = (meta & 4) !== 0;
                             const dir = meta & 3;
                             
                             // 1. Solid Half
                             // Normal: Bottom (0.0-0.5). UpsideDown: Top (0.5-1.0)
                             const solidMinY = isUpsideDown ? y + 0.5 : y;
                             const solidMaxY = isUpsideDown ? y + 1.0 : y + 0.5;
                             
                             // Collide with solid half
                             if (pos.y < solidMaxY && pos.y + height > solidMinY) return true;
                             
                             // 2. Step Half (Shape Logic)
                             const stepMinY = isUpsideDown ? y : y + 0.5;
                             const stepMaxY = isUpsideDown ? y + 0.5 : y + 1.0;
                             
                             if (pos.y < stepMaxY && pos.y + height > stepMinY) {
                                 // Determine Shape Logic (Ported from ChunkMesher)
                                 let shape = 'straight';
                                 
                                 const checkStair = (dx, dz) => {
                                     const nid = this.world.getBlock(x + dx, y, z + dz);
                                     return isStair(nid);
                                 };
                                 const getMeta = (dx, dz) => {
                                     return this.world.getBlockMetadata(x + dx, y, z + dz);
                                 };
                                 const isSameOrientation = (otherMeta) => (otherMeta & 4) === (meta & 4);
                                 
                                 let mx = 0, mz = 0; // My Dir vector
                                 if (dir === 0) mx = 1; else if (dir === 1) mx = -1;
                                 else if (dir === 2) mz = 1; else if (dir === 3) mz = -1;
                                 
                                 // Inner (Back)
                                 if (checkStair(mx, mz)) {
                                     const nm = getMeta(mx, mz);
                                     if (isSameOrientation(nm)) {
                                         const nd = nm & 3;
                                         if (dir === 0) { if (nd === 3) shape = 'inner_left'; else if (nd === 2) shape = 'inner_right'; }
                                         else if (dir === 1) { if (nd === 2) shape = 'inner_left'; else if (nd === 3) shape = 'inner_right'; }
                                         else if (dir === 2) { if (nd === 0) shape = 'inner_left'; else if (nd === 1) shape = 'inner_right'; }
                                         else if (dir === 3) { if (nd === 1) shape = 'inner_left'; else if (nd === 0) shape = 'inner_right'; }
                                     }
                                 }
                                 
                                 // Outer (Front)
                                 if (shape === 'straight') {
                                     if (checkStair(-mx, -mz)) {
                                         const nm = getMeta(-mx, -mz);
                                         if (isSameOrientation(nm)) {
                                             const nd = nm & 3;
                                             if (dir === 0) { if (nd === 3) shape = 'outer_left'; else if (nd === 2) shape = 'outer_right'; }
                                             else if (dir === 1) { if (nd === 2) shape = 'outer_left'; else if (nd === 3) shape = 'outer_right'; }
                                             else if (dir === 2) { if (nd === 0) shape = 'outer_left'; else if (nd === 1) shape = 'outer_right'; }
                                             else if (dir === 3) { if (nd === 1) shape = 'outer_left'; else if (nd === 0) shape = 'outer_right'; }
                                         }
                                     }
                                 }
                                 
                                 // Quadrants
                                 const q = [false, false, false, false]; // NW, NE, SW, SE
                                 if (dir === 0) { q[1]=true; q[3]=true; }
                                 else if (dir === 1) { q[0]=true; q[2]=true; }
                                 else if (dir === 2) { q[2]=true; q[3]=true; }
                                 else if (dir === 3) { q[0]=true; q[1]=true; }
                                 
                                 if (shape === 'outer_left') {
                                     if (dir === 0) q[1]=false; else if (dir === 1) q[2]=false; else if (dir === 2) q[2]=false; else if (dir === 3) q[1]=false;
                                 } else if (shape === 'outer_right') {
                                     if (dir === 0) q[3]=false; else if (dir === 1) q[0]=false; else if (dir === 2) q[3]=false; else if (dir === 3) q[0]=false;
                                 } else if (shape === 'inner_left') {
                                     if (dir === 0) q[0]=true; else if (dir === 1) q[3]=true; else if (dir === 2) q[1]=true; else if (dir === 3) q[2]=true;
                                 } else if (shape === 'inner_right') {
                                     if (dir === 0) q[2]=true; else if (dir === 1) q[1]=true; else if (dir === 2) q[0]=true; else if (dir === 3) q[3]=true;
                                 }
                                 
                                 // Collision Check against active quadrants
                                 // Quadrant Boxes:
                                 // Q0 (NW): x:0-0.5, z:0-0.5
                                 // Q1 (NE): x:0.5-1, z:0-0.5
                                 // Q2 (SW): x:0-0.5, z:0.5-1
                                 // Q3 (SE): x:0.5-1, z:0.5-1
                                 
                                 const checkQuad = (qxMin, qxMax, qzMin, qzMax) => {
                                     return (pMaxX > x+qxMin && pMinX < x+qxMax && pMaxZ > z+qzMin && pMinZ < z+qzMax);
                                 };
                                 
                                 if (q[0] && checkQuad(0, 0.5, 0, 0.5)) return true;
                                 if (q[1] && checkQuad(0.5, 1, 0, 0.5)) return true;
                                 if (q[2] && checkQuad(0, 0.5, 0.5, 1)) return true;
                                 if (q[3] && checkQuad(0.5, 1, 0.5, 1)) return true;
                             }
                             
                             continue;
                         }
                         
                         return true;
                     }

                     // 2. Special Door Check
                     const id = this.world.getBlock(x, y, z);
                     const isDoor = (id === BLOCKS.OAK_DOOR_BOTTOM || id === BLOCKS.OAK_DOOR_TOP || (id >= 75 && id <= 86));
                     
                     if (isDoor) {
                         const meta = this.world.getBlockMetadata(x, y, z);
                         const isOpen = (meta & 4) !== 0;
                         // Check collision against CLOSED door parts
                         if (isOpen) return false; 

                         // If closed, full block collision or thin? 
                         // Treat as full block for simplicity unless detailed AABB is needed
                         // Since we removed AABB logic for brevity, returning true here makes closed doors solid.
                         return true;
                     }
                }
            }
        }

        // Special check: Fences are 1.5 blocks high
        // If the block BELOW the current checking position is a fence, treat it as obstructing 
        // up to y+0.5 relative to the fence top.
        
        const feetY = Math.floor(pos.y);
        const belowId = this.world.getBlock(Math.floor(pos.x), feetY - 1, Math.floor(pos.z));
        
        if (belowId === BLOCKS.OAK_FENCE) {
            // Check lateral bounds of fence below
            if (pos.y < (feetY - 1) + 1.5) {
                // We are in the "extra 0.5" height of the fence below
                // Perform precise AABB check on that fence
                if (this.checkFenceCollision(Math.floor(pos.x), feetY - 1, Math.floor(pos.z), pMinX, pMaxX, pMinZ, pMaxZ, pos, height)) {
                    return true;
                }
            }
        }

        return false;
    }
}

