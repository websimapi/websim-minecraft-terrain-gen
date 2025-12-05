import * as THREE from 'three';
import { BLOCKS } from '../constants.js';

export function attemptSpawn(world, camera, controls, loadingEl) {
    // Scan a 3x3 chunk area around 0,0 to find a valid spawn
    var range = 1; // +/- 1 chunk
    var centerChunkX = 0;
    var centerChunkZ = 0;

    for (var cx = centerChunkX - range; cx <= centerChunkX + range; cx++) {
        for (var cz = centerChunkZ - range; cz <= centerChunkZ + range; cz++) {
            var chunk = world.getChunk(cx, cz);
            if (!chunk || !chunk.generated) {
                // Prioritize central chunks
                if (!world.chunkQueue.some(c => c.key === `${cx},${cz}`) && world.chunks.size < 5) {
                    world.queueChunks(cx, cz);
                }
                continue; 
            }

            // Scan a few columns in this chunk (Center, Corners)
            var checkPoints = [
                {x: 8, z: 8},
                {x: 0, z: 0},
                {x: 15, z: 15},
                {x: 0, z: 15},
                {x: 15, z: 0}
            ];

            for (var pt of checkPoints) {
                var wx = cx * 16 + pt.x;
                var wz = cz * 16 + pt.z;
                
                var startY = 250;
                var endY = -60;
                
                if (world.dimension === 'nether') { startY = 100; endY = 32; }
                if (world.terrainGen.type === 'superflat') { startY = 10; endY = -5; }

                for (var y = startY; y > endY; y--) {
                    var id = world.getBlock(wx, y, wz);
                    if (id === -1) continue;

                    var bodyId = world.getBlock(wx, y + 1, wz);
                    var headId = world.getBlock(wx, y + 2, wz);

                    var isSafeFloor = (id !== BLOCKS.AIR && id !== BLOCKS.LAVA && id !== BLOCKS.MAGMA && id !== BLOCKS.WATER);
                    
                    // In superflat, allow spawning on grass
                    if (world.terrainGen.type === 'superflat' && id === BLOCKS.GRASS) {
                        isSafeFloor = true;
                    }

                    var isClearSpace = (bodyId === BLOCKS.AIR && headId === BLOCKS.AIR);

                    if (isSafeFloor && isClearSpace) {
                        var spawnY = y + 1.0; // Feet position

                        camera.position.set(wx + 0.5, spawnY + 1.62, wz + 0.5);
                        controls.position.set(wx + 0.5, spawnY, wz + 0.5);

                        controls.fallStartY = spawnY;
                        controls.velocity.set(0, 0, 0);
                        controls.onGround = true; 

                        if (loadingEl) loadingEl.style.display = 'none';
                        controls.lastPos = controls.position.clone();

                        console.log(`Spawned at ${wx}, ${spawnY}, ${wz}`);
                        return true;
                    }
                }
            }
        }
    }
    
    return false;
}