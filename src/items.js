import * as THREE from 'three';
import { getBlockMeshMaterials, BLOCKS, isFoliage, getBlockImagePixels, BLOCK_FACES, getAtlasUV } from './blocks.js';
import { createExtrudedGeometry } from './utils/geometry.js';
import { atlasTexture } from './rendering/texture_atlas.js';

export class ItemManager {
    constructor(scene, world, particleSystem, onPickup) {
        this.scene = scene;
        this.world = world;
        this.world.itemManager = this; // Attach to world for network access
        this.particleSystem = particleSystem;
        this.items = [];
        this.onPickup = onPickup; // onPickup set by UIManager
        this.networkManager = null; // Added network manager reference

        this.itemGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
        
        const loader = new THREE.TextureLoader();
        this.shadowTex = loader.load('./shadow.png');
        this.shadowMat = new THREE.MeshBasicMaterial({ 
            map: this.shadowTex, 
            transparent: true, 
            opacity: 0.5,
            depthWrite: false, 
            side: THREE.DoubleSide 
        });
        this.shadowGeo = new THREE.PlaneGeometry(0.5, 0.5);
    }

    // Generate simple ID
    generateId() {
        return Math.random().toString(36).substr(2, 9);
    }

    spawnItem(pos, blockId, initialVelocity = null, count = 1, fromNetwork = false, networkId = null, damage = 0) {
        if (!blockId || blockId === BLOCKS.AIR || blockId === BLOCKS.WATER) return;

        const itemId = networkId || this.generateId();

        // Broadcast if local spawn (not from network)
        if (!fromNetwork && this.networkManager && this.networkManager.connected) {
             this.networkManager.sendItemDrop(pos, blockId, initialVelocity, count, itemId);
        }

        // Avoid duplicates
        if (this.items.some(i => i.id === itemId)) return;

        let mesh;
        
        try {
            // Check if it's a sprite-based item (Foliage or Item)
            if (isFoliage(blockId)) {
                // Extruded 3D Item
                let faceName = BLOCK_FACES[blockId];
                if (!faceName) faceName = 'stick'; // Fallback
                if (Array.isArray(faceName)) faceName = faceName[0];
                
                const pixels = getBlockImagePixels(faceName);
                
                // If pixels exist (atlas loaded), create extruded geo. 
                // Otherwise fall back to plane (rare race condition on init)
                let hasPixels = false;
                if (pixels && pixels.data) {
                    for(let i=3; i<pixels.data.length; i+=4) {
                        if(pixels.data[i] > 0) { hasPixels = true; break; }
                    }
                }

                if (hasPixels) {
                    const geometry = createExtrudedGeometry(pixels, 1.5); // Thickness relative to pixel size
                    // Extruded geo is 1x1 units centered. Scale it down to look like an item.
                    const mat = new THREE.MeshBasicMaterial({ 
                        vertexColors: true, 
                        side: THREE.DoubleSide 
                    });

                    // Apply Biome Tints to Foliage Items
                    if (blockId === BLOCKS.GRASS_PLANT || blockId === BLOCKS.TALL_GRASS_BOTTOM || blockId === BLOCKS.TALL_GRASS_TOP) {
                        mat.color.setHex(0x79C05A);
                    } else if (blockId === BLOCKS.SUGAR_CANE) {
                        mat.color.setHex(0x99cc66);
                    } else if (blockId === BLOCKS.LEAVES || blockId === BLOCKS.JUNGLE_LEAVES || blockId === BLOCKS.ACACIA_LEAVES || blockId === BLOCKS.DARK_OAK_LEAVES) {
                        mat.color.setHex(0x48B518);
                    } else if (blockId === BLOCKS.BIRCH_LEAVES) {
                        mat.color.setHex(0x80a755);
                    } else if (blockId === BLOCKS.SPRUCE_LEAVES) {
                        mat.color.setHex(0x619961);
                    }

                    mesh = new THREE.Mesh(geometry, mat);
                    mesh.scale.set(0.5, 0.5, 0.5);
                    // Fix rotation to stand upright initially or spin nicely
                    // By default createExtrudedGeometry makes it flat on XY plane.
                    // We want dropped items to spin around Y axis standing up? 
                    // Usually dropped items float and spin.
                    
                } else {
                    // Fallback to Plane if texture not ready
                    const materials = getBlockMeshMaterials(blockId);
                    const mat = materials[0].clone();
                    mat.type = 'MeshBasicMaterial';
                    mat.color.setHex(0xffffff);
                    mat.side = THREE.DoubleSide;
                    const geometry = new THREE.PlaneGeometry(0.5, 0.5);
                    mesh = new THREE.Mesh(geometry, mat);
                }
            } else {
                // Block Item using Atlas
                const geometry = new THREE.BoxGeometry(0.4, 0.4, 0.4); 
                const uvs = geometry.attributes.uv;
                
                const faces = BLOCK_FACES[blockId];
                
                // Map UVs for each face (0:Right, 1:Left, 2:Top, 3:Bottom, 4:Front, 5:Back)
                for(let i=0; i<6; i++) {
                    let matName;
                    if (faces) {
                        if (Array.isArray(faces)) matName = faces[i];
                        else matName = faces; 
                    }
                    
                    if (!matName) matName = 'stone'; // Default if texture missing
                    
                    const uvData = getAtlasUV(matName);
                    // If UV returns 0 (missing), and it's not stone, try to find a valid one or keep 0
                    
                    const uMin = uvData.u;
                    const uMax = uvData.u + uvData.w;
                    const vMin = uvData.v;
                    const vMax = uvData.v + uvData.h;
                    
                    // BoxGeometry Face Order: 0:+x, 1:-x, 2:+y, 3:-y, 4:+z, 5:-z
                    const idx = i * 4;
                    // Standard UV Mapping
                    uvs.setXY(idx + 0, uMin, vMax); // 0,1
                    uvs.setXY(idx + 1, uMax, vMax); // 1,1
                    uvs.setXY(idx + 2, uMin, vMin); // 0,0
                    uvs.setXY(idx + 3, uMax, vMin); // 1,0
                }
                
                geometry.attributes.uv.needsUpdate = true;
                
                const mat = new THREE.MeshBasicMaterial({
                    map: atlasTexture,
                    transparent: true,
                    alphaTest: 0.1,
                    side: THREE.DoubleSide
                });
                
                // Apply Tint to Blocks
                if (blockId === BLOCKS.GRASS) {
                    mat.color.setHex(0x79C05A); // Grass Block Tint
                } else if (blockId === BLOCKS.LEAVES || blockId === BLOCKS.JUNGLE_LEAVES || blockId === BLOCKS.ACACIA_LEAVES || blockId === BLOCKS.DARK_OAK_LEAVES) {
                    mat.color.setHex(0x48B518);
                } else if (blockId === BLOCKS.BIRCH_LEAVES) {
                    mat.color.setHex(0x80a755);
                } else if (blockId === BLOCKS.SPRUCE_LEAVES) {
                    mat.color.setHex(0x619961);
                } else if (blockId === BLOCKS.WATER || blockId === BLOCKS.WATER_BUCKET) {
                    mat.color.setHex(0x0040FF);
                }

                mesh = new THREE.Mesh(geometry, mat);
            }
        } catch (e) {
            console.error("Error creating item mesh:", e);
            return;
        }
        
        mesh.position.copy(pos);

        const shadow = new THREE.Mesh(this.shadowGeo, this.shadowMat);
        shadow.rotation.x = -Math.PI / 2;
        shadow.visible = false;

        this.scene.add(mesh);
        this.scene.add(shadow);

        const item = {
            id: itemId,
            mesh: mesh,
            shadow: shadow,
            blockId: blockId,
            count: count,
            damage: damage, // Store damage
            isFoliage: isFoliage(blockId),
            velocity: initialVelocity ? initialVelocity.clone() : new THREE.Vector3(
                (Math.random() - 0.5) * 3,
                3 + Math.random() * 2,
                (Math.random() - 0.5) * 3
            ),
            life: 300,
            onGround: false,
            baseY: 0,
            bobOffset: Math.random() * Math.PI * 2,
            spawnAnim: 0 // For squashed scale animation
        };
        this.items.push(item);
    }

    removeItem(itemId) {
        const index = this.items.findIndex(i => i.id === itemId);
        if (index !== -1) {
            const item = this.items[index];
            this.scene.remove(item.mesh);
            this.scene.remove(item.shadow);
            if(item.mesh.geometry) item.mesh.geometry.dispose();
            this.items.splice(index, 1);
        }
    }

    update(delta, time, playerPos) {
        for (let i = this.items.length - 1; i >= 0; i--) {
            const item = this.items[i];

            // Apply Lighting
            const bx = Math.floor(item.mesh.position.x);
            const by = Math.floor(item.mesh.position.y);
            const bz = Math.floor(item.mesh.position.z);
            let light = this.world.getLight(bx, by, bz);
            // Min brightness
            const val = Math.max(0.2, light / 15.0);
            
            if (item.mesh.material) {
                if (item.isFoliage) {
                    // Instanced items usually vertex colors, but here singular mesh
                    // Foliage uses vertex colors for tint, so we can't easily tint material color without affecting biome tint.
                    // Actually BasicMaterial multiplies color with vertex color.
                    // Biome tint is set on vertex colors? No, logic in ItemManager sets material.color.
                    // If we change material.color we lose biome tint.
                    // For Foliage items, we should ideally use vertex colors or separate uniforms.
                    // Simple fix: modulate RGB.
                    // But we used setHex() earlier.
                    // Re-calculate:
                    let baseColor = new THREE.Color(0xffffff);
                    if (item.blockId === BLOCKS.GRASS_PLANT || item.blockId === BLOCKS.TALL_GRASS_BOTTOM || item.blockId === BLOCKS.TALL_GRASS_TOP) baseColor.setHex(0x79C05A);
                    else if (item.blockId === BLOCKS.SUGAR_CANE) baseColor.setHex(0x99cc66);
                    else if (item.blockId === BLOCKS.LEAVES) baseColor.setHex(0x48B518);
                    
                    item.mesh.material.color.copy(baseColor).multiplyScalar(val);
                } else {
                    // Atlas block item (MeshBasicMaterial with map)
                    // If it has a tint (Grass block), base is tinted.
                    let baseColor = new THREE.Color(0xffffff);
                    if (item.blockId === BLOCKS.GRASS) baseColor.setHex(0x79C05A);
                    else if (item.blockId === BLOCKS.LEAVES) baseColor.setHex(0x48B518);
                    
                    item.mesh.material.color.copy(baseColor).multiplyScalar(val);
                }
            }

            // Spawn Animation (Squash/Pop)
            if (item.spawnAnim < 1.0) {
                item.spawnAnim += delta * 3.0; // Speed
                if (item.spawnAnim > 1.0) item.spawnAnim = 1.0;
                
                // Elastic/Overshoot effect or simple easeOut
                // Squash Logic: Start flat and wide (0.6, 0.1, 0.6) -> End (0.35, 0.35, 0.35)
                const t = item.spawnAnim;
                const ease = 1 - Math.pow(1 - t, 3); // Cubic Out
                
                const targetScale = item.isFoliage ? 0.5 : 1.0; 
                const startScaleXZ = targetScale * 0.3;
                const startScaleY = targetScale * 3.0;
                
                const currentScaleXZ = THREE.MathUtils.lerp(startScaleXZ, targetScale, ease);
                const currentScaleY = THREE.MathUtils.lerp(startScaleY, targetScale, ease);
                
                item.mesh.scale.set(currentScaleXZ, currentScaleY, currentScaleXZ);
            }

            // Merging Logic
            if (item.onGround && item.life < 299.5) { // Allow merging shortly after spawn
                for (let j = 0; j < this.items.length; j++) {
                    if (i === j) continue;
                    const other = this.items[j];
                    if (other.blockId === item.blockId && other.onGround && other.life < 299.5 && other.count < 64) {
                        const dist = item.mesh.position.distanceToSquared(other.mesh.position);
                        if (dist < 1.0) {
                            // Merge item into other
                            const space = 64 - other.count;
                            const toAdd = Math.min(space, item.count);
                            
                            if (toAdd > 0) {
                                other.count += toAdd;
                                item.count -= toAdd;
                                // Visual feedback (optional: bounce merged item)
                                other.velocity.y = 2.0;
                                other.onGround = false;
                                
                                if (item.count <= 0) {
                                    item.life = 0; // Schedule for removal
                                    break; 
                                }
                            }
                        }
                    }
                }
            }

            // Pickup Logic
            if (item.life < 299 && playerPos && item.count > 0) { 
                const dist = item.mesh.position.distanceTo(playerPos);
                if (dist < 5.0) {
                    const target = playerPos.clone();
                    target.y += 1.2; 
                    const dir = new THREE.Vector3().subVectors(target, item.mesh.position).normalize();
                    item.velocity.addScaledVector(dir, 40.0 * delta);
                    item.velocity.multiplyScalar(0.85);
                    item.onGround = false; 
                }

                if (dist < 1.5) {
                    // Try to pick up entire stack
                    if (this.onPickup && this.onPickup(item.blockId, item.count, item.damage)) {
                        if (this.particleSystem) {
                            this.particleSystem.spawnBlockParticles(item.mesh.position, item.blockId);
                        }
                        
                        // Send collect event
                        if (this.networkManager && this.networkManager.connected) {
                            this.networkManager.sendItemCollect(item.id);
                        }
                        
                        // Mark for removal
                        item.life = 0;
                    }
                }
            }

            // Physics
            if (!item.onGround) {
                item.velocity.y -= 25 * delta;
                const nextPos = item.mesh.position.clone().addScaledVector(item.velocity, delta);
                const bx = Math.floor(nextPos.x);
                const by = Math.floor(nextPos.y);
                const bz = Math.floor(nextPos.z);
                const id = this.world.getBlock(bx, by, bz);

                if (id !== BLOCKS.AIR && id !== BLOCKS.WATER) {
                    item.onGround = true;
                    item.velocity.set(0, 0, 0);
                    item.mesh.position.y = by + 1 + 0.2;
                    item.baseY = item.mesh.position.y;
                    item.shadow.visible = true;
                    item.shadow.position.set(item.mesh.position.x, by + 1 + 0.02, item.mesh.position.z);
                } else {
                    item.mesh.position.copy(nextPos);
                }
            } else {
                item.mesh.rotation.y += delta;
                
                // If foliage, ensure it faces camera-ish or just spins? 
                // Currently just spinning Y which is fine for sprite items usually (or they face camera)
                // Minecraft items spin in 3D.
                
                const bob = Math.sin(time * 3 + item.bobOffset) * 0.1;
                item.mesh.position.y = item.baseY + bob;
                item.shadow.position.x = item.mesh.position.x;
                item.shadow.position.z = item.mesh.position.z;

                const bx = Math.floor(item.mesh.position.x);
                const by = Math.floor(item.baseY - 0.5);
                const bz = Math.floor(item.mesh.position.z);
                const below = this.world.getBlock(bx, by, bz);
                if (below === BLOCKS.AIR || below === BLOCKS.WATER) {
                    item.onGround = false;
                    item.shadow.visible = false;
                }
            }

            if (item.mesh.position.y < 0) item.life = 0;
            item.life -= delta;
            if (item.life <= 0) {
                this.scene.remove(item.mesh);
                this.scene.remove(item.shadow);
                this.items.splice(i, 1);
            }
        }
    }
}