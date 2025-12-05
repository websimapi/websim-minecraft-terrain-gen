import * as THREE from 'three';
import { getBlockMeshMaterials, BLOCKS } from './blocks.js';

export class FallingBlockManager {
    constructor(scene, world) {
        this.scene = scene;
        this.world = world;
        this.blocks = [];
    }

    spawnFallingBlock(x, y, z, blockId) {
        // Remove from world immediately
        this.world.setBlock(x, y, z, BLOCKS.AIR);

        const materials = getBlockMeshMaterials(blockId);
        const geometry = new THREE.BoxGeometry(0.98, 0.98, 0.98); 
        const mesh = new THREE.Mesh(geometry, materials);

        // Center of block
        mesh.position.set(x + 0.5, y + 0.5, z + 0.5);
        this.scene.add(mesh);

        const fallingBlock = {
            mesh: mesh,
            blockId: blockId,
            velocity: new THREE.Vector3(0, 0, 0),
            x: x,
            z: z
        };
        this.blocks.push(fallingBlock);
    }

    update(delta) {
        for (let i = this.blocks.length - 1; i >= 0; i--) {
            const fb = this.blocks[i];

            // Gravity
            fb.velocity.y -= 25 * delta; 

            const prevY = fb.mesh.position.y;
            const nextY = prevY + fb.velocity.y * delta;

            // Check landing
            const bottomY = nextY - 0.5;
            const checkY = Math.floor(bottomY);

            // Boundary check
            if (checkY < -64) {
                 this.removeBlock(i);
                 continue;
            }

            const blockBelow = this.world.getBlock(fb.x, checkY, fb.z);

            // If block below is solid (not Air/Water)
            if (blockBelow !== BLOCKS.AIR && blockBelow !== BLOCKS.WATER && blockBelow !== 0) {
                // Land
                const landY = checkY + 1;

                // Attempt to place
                const targetId = this.world.getBlock(fb.x, landY, fb.z);

                if (targetId === BLOCKS.AIR || targetId === BLOCKS.WATER) {
                    this.world.setBlock(fb.x, landY, fb.z, fb.blockId);
                } else {
                    // Occupied space, drop as item
                    if (this.world.itemManager) {
                        this.world.itemManager.spawnItem(fb.mesh.position.clone(), fb.blockId);
                    }
                }

                this.removeBlock(i);
            } else {
                fb.mesh.position.y = nextY;
            }
        }
    }

    removeBlock(index) {
        const fb = this.blocks[index];
        this.scene.remove(fb.mesh);
        if (fb.mesh.geometry) fb.mesh.geometry.dispose();
        this.blocks.splice(index, 1);
    }
}