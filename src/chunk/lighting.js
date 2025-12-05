import { BLOCKS, isFoliage } from '../constants.js';

export function updateChunkLighting(chunk) {
    const isNether = chunk.dimension === 'nether';

    // Reset light map
    chunk.lightMap.fill(0);

    const queue = []; 
    let qHead = 0;
    
    // Cache constants
    const size = chunk.size;
    const height = chunk.height;
    const maxY = isNether ? 128 : height;
    
    // Helper to get neighbor chunk
    const getNeighbor = (dx, dz) => chunk.world.getChunk(chunk.cx + dx, chunk.cz + dz);
    
    const nWest = getNeighbor(-1, 0);
    const nEast = getNeighbor(1, 0);
    const nNorth = getNeighbor(0, -1);
    const nSouth = getNeighbor(0, 1);

    // 1. Initialize Sources (Sunlight + Emissive Blocks + Neighbor Propagation)
    
    for (let x = 0; x < size; x++) {
        for (let z = 0; z < size; z++) {
            let sunlight = isNether ? 0 : 15;

            // Optimization: Iterate Y down, calculating flat index
            let idx = x + size * (z + size * (maxY - 1));
            const stride = size * size;

            for (let y = maxY - 1; y >= 0; y--) {
                const id = chunk.data[idx];

                // Block Emission
                let emitted = 0;
                if (id === BLOCKS.GLOWSTONE || id === BLOCKS.LAVA || id === BLOCKS.MAGMA || id === BLOCKS.FIRE) emitted = 15;
                else if (id === BLOCKS.TORCH) emitted = 14;
                else if (id === BLOCKS.FURNACE_ON) emitted = 13;
                else if (id === BLOCKS.NETHER_PORTAL) emitted = 11;
                
                if (isNether && emitted < 7) emitted = 7; // Ambient nether light

                // Check Neighbors for light ingress (Chunk Borders)
                // Manual unroll for boundary checks to avoid function calls in loop
                if (x === 0 && nWest && nWest.generated) {
                    const nLight = nWest.lightMap[15 + size * (z + size * y)];
                    if (nLight > 1 && (nLight - 1) > emitted) emitted = nLight - 1;
                }
                if (x === 15 && nEast && nEast.generated) {
                    const nLight = nEast.lightMap[0 + size * (z + size * y)];
                    if (nLight > 1 && (nLight - 1) > emitted) emitted = nLight - 1;
                }
                if (z === 0 && nNorth && nNorth.generated) {
                    const nLight = nNorth.lightMap[x + size * (15 + size * y)];
                    if (nLight > 1 && (nLight - 1) > emitted) emitted = nLight - 1;
                }
                if (z === 15 && nSouth && nSouth.generated) {
                    const nLight = nSouth.lightMap[x + size * (0 + size * y)];
                    if (nLight > 1 && (nLight - 1) > emitted) emitted = nLight - 1;
                }

                if (emitted > chunk.lightMap[idx]) {
                    chunk.lightMap[idx] = emitted;
                    queue.push(idx);
                }

                // Sunlight Logic
                if (!isNether) {
                    if (sunlight > chunk.lightMap[idx]) {
                        chunk.lightMap[idx] = sunlight;
                        queue.push(idx);
                    }

                    // Occlusion
                    if (id === BLOCKS.AIR) {
                        // Pass
                    } else if (id === BLOCKS.WATER || id === BLOCKS.LEAVES || id === BLOCKS.LAVA) {
                         sunlight = Math.max(0, sunlight - 3); 
                    } else if (id === BLOCKS.GLASS || id === BLOCKS.FIRE || id === BLOCKS.NETHER_PORTAL || id === BLOCKS.TORCH || isFoliage(id)) {
                        // Pass
                    } else {
                         sunlight = 0; 
                    }
                }
                
                idx -= stride;
            }
        }
    }

    // 2. Propagate Light (BFS)
    // Inline helper to avoid closure allocation
    const pushNeighbor = (nx, ny, nz, light) => {
        const nIdx = nx + size * (nz + size * ny);
        const nId = chunk.data[nIdx];

        let decay = 1; 

        if (nId === BLOCKS.AIR) {
            // decay 1
        } else if (nId === BLOCKS.WATER || nId === BLOCKS.LEAVES || nId === BLOCKS.LAVA) {
            decay = 3; 
        } else if (nId === BLOCKS.GLASS || nId === BLOCKS.FIRE || nId === BLOCKS.NETHER_PORTAL || isFoliage(nId)) {
            // decay 1
        } else {
            decay = 15; // Solid
        }

        const newLight = light - decay;

        if (newLight > chunk.lightMap[nIdx]) {
            chunk.lightMap[nIdx] = newLight;
            queue.push(nIdx);
        }
    };

    while(qHead < queue.length) {
        const idx = queue[qHead++];
        const light = chunk.lightMap[idx];

        if (light <= 1) continue;

        const x = idx & 15; // idx % 16
        const z = (idx >> 4) & 15; // (idx / 16) % 16
        const y = idx >> 8; // idx / 256

        if (x > 0) pushNeighbor(x-1, y, z, light);
        if (x < 15) pushNeighbor(x+1, y, z, light);
        
        if (z > 0) pushNeighbor(x, y, z-1, light);
        if (z < 15) pushNeighbor(x, y, z+1, light);
        
        if (y > 0) pushNeighbor(x, y-1, z, light);
        if (y < height - 1) pushNeighbor(x, y+1, z, light);
    }
}