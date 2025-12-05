import * as THREE from 'three';
import * as Skinview3d from 'skinview3d';
import { PlayerHand } from './player_hand.js';
import { getBlockMeshMaterials, BLOCKS, BLOCK_FACES, isFoliage, getBlockImagePixels } from './blocks.js';
import { createExtrudedGeometry } from './utils/geometry.js';

export class Player {
    constructor(scene, camera, sceneHUD, cameraHUD) {
        this.scene = scene;
        this.camera = camera;
        
        // Container for Third Person mesh (World Space)
        this.group = new THREE.Group();
        this.scene.add(this.group);
        
        // First Person Hand
        this.hand = new PlayerHand(sceneHUD);

        // Off-screen viewer to load/generate meshes for 3rd person
        this.viewer = new Skinview3d.SkinViewer({
            width: 300,
            height: 400,
            renderPaused: true 
        });
        
        this.isThirdPerson = false;
        this.walkTime = 0; 
        
        // Third Person State
        this.heldBlockId = 0;
        this.tpItemMesh = null;
        this.swinging = false;
        this.swingProgress = 0;

        // TP Customization
        this.transformThirdPerson = {
            x: -0.4,
            y: -9.24,
            z: 3.16,
            rotX: 0,
            rotY: 93.6,
            rotZ: 123.84,
            scale: 10
        };
        
        // Default Block Transform
        this.transformBlock = {
            x: -2, 
            y: -10, 
            z: 2.5, 
            rotX: 0, 
            rotY: 0, 
            rotZ: 0, 
            scale: 4.0
        };

        this.tpArmOffset = {
            x: 0,
            y: 0,
            z: 0
        };
        this.modelType = 'default';
    }
    
    setModelType(type) {
        this.modelType = type;
        if (this.playerObject) {
            // Reload skin to apply model change
            // We need to keep current URL
            // Handled via loadSkin call from UI usually, but internal setter useful
        }
    }

    setHeldItem(blockId) {
        this.hand.setHeldItem(blockId);
        this.heldBlockId = blockId;
        this.updateThirdPersonItem();
    }

    updateThirdPersonItem() {
        if (!this.playerObject || !this.playerObject.skin) return;
        
        const rightArm = this.playerObject.skin.rightArm;
        
        // Remove old item
        if (this.tpItemMesh) {
            rightArm.remove(this.tpItemMesh);
            // Dispose logic...
            if(this.tpItemMesh.geometry) this.tpItemMesh.geometry.dispose();
            this.tpItemMesh = null;
        }
        
        if (!this.heldBlockId || this.heldBlockId === BLOCKS.AIR) return;
        
        let geometry, materials;
        
        // Check if it's a sprite/foliage item
        if (BLOCKS.TORCH === this.heldBlockId || this.heldBlockId >= 100 || isFoliage(this.heldBlockId)) {
             // Use extruded geometry for 3D item look
             const pixels = getBlockImagePixels(BLOCK_FACES[this.heldBlockId]);
             if (pixels) {
                 geometry = createExtrudedGeometry(pixels, 1.5);
                 materials = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
             } else {
                 geometry = new THREE.BoxGeometry(1, 1, 1);
                 materials = new THREE.MeshBasicMaterial({ color: 0xffffff });
             }
        } else {
             materials = getBlockMeshMaterials(this.heldBlockId);
             geometry = new THREE.BoxGeometry(1, 1, 1); 
        }

        this.tpItemMesh = new THREE.Mesh(geometry, materials);
        // Transforms are applied in update()
        
        rightArm.add(this.tpItemMesh);
    }

    async loadSkin(url, model = 'default') {
        try {
            this.modelType = model;
            await this.viewer.loadSkin(url, { model: model });
            
            // Update Hand Texture
            const loader = new THREE.TextureLoader();
            loader.load(url, (tex) => {
                tex.colorSpace = THREE.SRGBColorSpace;
                tex.magFilter = THREE.NearestFilter;
                if (tex.image && tex.image.width === 64) {
                    this.hand.setSkin(tex);
                }
            });
            
            const playerObject = this.viewer.playerObject;
            if (!playerObject) return;
            
            this.group.clear();
            
            const scale = 1.8 / 32.0;
            playerObject.scale.set(scale, scale, scale);
            const yOffset = (16 * scale);
            playerObject.position.y = yOffset;
            this.yOffset = yOffset;
            playerObject.rotation.y = Math.PI;

            const saveBase = (part) => {
                if(part) {
                    part.userData.basePos = part.position.clone();
                    part.userData.baseRot = part.rotation.clone();
                }
            };
            const s = playerObject.skin;
            saveBase(s.head); saveBase(s.body);
            saveBase(s.leftArm); saveBase(s.rightArm);
            saveBase(s.leftLeg); saveBase(s.rightLeg);

            playerObject.traverse(obj => {
                if (obj.isMesh || obj.isGroup) {
                    // obj.castShadow = true; // Shadows removed
                    // obj.receiveShadow = true;
                    obj.frustumCulled = false; 
                    obj.userData.isPlayer = true;

                    // Convert materials to Basic for consistent flat shading
                    if (obj.isMesh && obj.material) {
                        const old = obj.material;
                        obj.material = new THREE.MeshBasicMaterial({
                            map: old.map,
                            color: 0xcccccc, // Darkened from default white (0xffffff)
                            side: old.side,
                            transparent: old.transparent,
                            alphaTest: old.alphaTest
                        });
                    }
                }
            });
            playerObject.userData.isPlayer = true;
            
            this.group.add(playerObject);
            this.playerObject = playerObject;
            
            // Re-attach item if needed
            this.updateThirdPersonItem();

        } catch (err) {
            console.error("Failed to load skin:", err);
            throw err;
        }
    }
    
    setPlayerPosition(x, y, z) { this.group.position.set(x, y, z); }
    setPlayerRotation(yaw) { this.group.rotation.y = yaw; }
    setSwimmingRotation(yaw, pitch) {
        this.group.rotation.order = 'YXZ';
        this.group.rotation.y = yaw;
        this.group.rotation.x = pitch;
    }
    
    swing() { 
        this.hand.swing(); 
        // Trigger 3rd person swing
        this.swinging = true;
        this.swingProgress = 0;
    }
    
    startSwitchAnimation() { this.hand.startSwitchAnimation(); }

    update(delta, time, pos, yaw, pitch, velocity, cameraMode, isSneaking, isUnderwater, isDigging, damageTilt, isRiding = false) {
        this.isThirdPerson = (cameraMode !== 0);
        
        this.setPlayerPosition(pos.x, pos.y, pos.z);
        
        // Apply Lighting to Third Person Model
        if (this.isThirdPerson && this.playerObject) {
            // Need world ref. Not passed in. 
            // We can infer light from hand logic in main loop, or pass it.
            // Main.js calculates light for hand. We can use that or look up again if we had world.
            // Let's rely on Main.js passing light level or a global/singleton.
            // Or just use the fact that PlayerHand gets it.
            // Actually, let's update applyLight method on Player to handle body too.
        }
        
        const speed = Math.sqrt(velocity.x**2 + velocity.y**2 + velocity.z**2);
        const isSwimming = isUnderwater && speed > 0.5;

        if (isSwimming) {
            this.setSwimmingRotation(yaw, pitch);
        } else {
             this.setPlayerRotation(yaw);
             this.group.rotation.x = 0;
        }
        
        this.group.visible = this.isThirdPerson;
        this.hand.setVisible(!this.isThirdPerson);
        
        // Apply TP Item Transform Live
        if (this.tpItemMesh && this.isThirdPerson) {
            const isTool = (this.heldBlockId >= 100 || isFoliage(this.heldBlockId));
            const tf = isTool ? this.transformThirdPerson : this.transformBlock;

            this.tpItemMesh.position.set(tf.x, tf.y, tf.z);
            this.tpItemMesh.rotation.set(
                THREE.MathUtils.degToRad(tf.rotX),
                THREE.MathUtils.degToRad(tf.rotY),
                THREE.MathUtils.degToRad(tf.rotZ)
            );
            const s = tf.scale;
            this.tpItemMesh.scale.set(s, s, s);
        }

        if (this.playerObject && this.playerObject.skin && this.isThirdPerson) {
             this.animateProcedural(delta, time, velocity, pitch, isSneaking, isUnderwater, isRiding);
        }
        
        if (!this.isThirdPerson) {
            this.hand.update(delta, time, velocity, isDigging, damageTilt);
        }
    }
    
    applyBodyLight(lightLevel) {
        const c = Math.max(0.1, lightLevel);
        if (this.playerObject) {
            this.playerObject.traverse(obj => {
                if (obj.isMesh && obj.material) {
                    // Base color 0xcccccc
                    const base = new THREE.Color(0xcccccc);
                    obj.material.color.copy(base).multiplyScalar(c);
                }
            });
        }
        if (this.tpItemMesh) {
             // Basic item coloring
             const base = new THREE.Color(0xffffff);
             if (this.tpItemMesh.material) {
                 if (Array.isArray(this.tpItemMesh.material)) {
                     this.tpItemMesh.material.forEach(m => m.color.copy(base).multiplyScalar(c));
                 } else {
                     this.tpItemMesh.material.color.copy(base).multiplyScalar(c);
                 }
             }
        }
    }
    
    animateProcedural(delta, time, velocity, pitch, isSneaking, isSwimming, isRiding = false) {
        const skin = this.playerObject.skin;
        
        const reset = (part) => {
            if(part && part.userData.basePos) {
                part.position.copy(part.userData.basePos);
                part.rotation.copy(part.userData.baseRot);
            }
        };
        reset(skin.head); reset(skin.body);
        reset(skin.leftArm); reset(skin.rightArm);
        reset(skin.leftLeg); reset(skin.rightLeg);

        const speed = Math.sqrt(velocity.x**2 + velocity.z**2);
        const limbSwingStrength = Math.min(1.0, speed);
        
        if (speed > 0.1) {
            this.walkTime += delta * speed * 3.0;
        } else {
            this.walkTime = 0;
        }

        const limbSwing = this.walkTime;
        const timeAlive = time * 20; // Approx ticks

        // Head Rotation
        skin.head.rotation.x = pitch;

        // Walking Animation (Legs & Arms)
        if (!isRiding) {
            skin.rightArm.rotation.x = Math.cos(limbSwing * 0.6662 + Math.PI) * 2.0 * limbSwingStrength * 0.5;
            skin.leftArm.rotation.x = Math.cos(limbSwing * 0.6662) * 2.0 * limbSwingStrength * 0.5;
            skin.rightLeg.rotation.x = Math.cos(limbSwing * 0.6662) * 1.4 * limbSwingStrength;
            skin.leftLeg.rotation.x = Math.cos(limbSwing * 0.6662 + Math.PI) * 1.4 * limbSwingStrength;
        } else {
            // Sitting Pose
            skin.leftLeg.rotation.x = -1.4;
            skin.leftLeg.rotation.y = -0.3;
            skin.rightLeg.rotation.x = -1.4;
            skin.rightLeg.rotation.y = 0.3;
            
            // Reset arms to idle if not walking
            skin.rightArm.rotation.x = 0;
            skin.leftArm.rotation.x = 0;
        }

        skin.rightArm.rotation.y = 0.0;
        skin.rightArm.rotation.z = 0.0;
        skin.leftArm.rotation.y = 0.0;
        skin.leftArm.rotation.z = 0.0;

        // Held Item Logic
        if (this.heldBlockId !== 0) {
            skin.rightArm.rotation.x = skin.rightArm.rotation.x * 0.5 - (Math.PI / 10);
        }

        // Riding Height Adjustment
        if (isRiding) {
            this.playerObject.position.y = this.yOffset - 0.6;
        } else if (!isSwimming) {
             this.playerObject.position.y = this.yOffset;
        }

        // Attack Animation
        if (this.swinging) {
            this.swingProgress += delta * 6; // Speed
            if (this.swingProgress >= 1) {
                this.swinging = false;
                this.swingProgress = 0;
            } else {
                let sp = this.swingProgress;
                
                // Body Twist
                const bodyTwist = Math.sin(Math.sqrt(sp) * Math.PI * 2.0) * 0.2;
                skin.body.rotation.y = -bodyTwist;

                skin.rightArm.rotation.z += Math.sin(this.swingProgress * Math.PI) * -0.4;
                skin.rightArm.rotation.x += bodyTwist;
                skin.leftArm.rotation.x += bodyTwist;
                
                // Smash Curve
                sp = 1.0 - sp;
                sp = sp * sp;
                sp = sp * sp;
                sp = 1.0 - sp;
                
                const v1 = Math.sin(sp * Math.PI);
                const v2 = Math.sin(sp * Math.PI) * -(skin.head.rotation.x - 0.7) * 0.75;
                
                skin.rightArm.rotation.x -= (v1 * 1.2 + v2);
                skin.rightArm.rotation.y += bodyTwist * 2.0;
                skin.rightArm.rotation.z += Math.sin(sp * Math.PI) * -0.4;
            }
        }

        // Sneaking Animation
        if (isSneaking) {
            skin.body.rotation.x = 0.5;
            skin.rightArm.rotation.x += 0.4;
            skin.leftArm.rotation.x += 0.4;
            skin.head.position.y -= 1.0;
            skin.body.position.y -= 1.5;
        }

        // Idle Breathing
        skin.rightArm.rotation.z += Math.cos(timeAlive * 0.09) * 0.05 + 0.05;
        skin.leftArm.rotation.z -= Math.cos(timeAlive * 0.09) * 0.05 + 0.05;
        skin.rightArm.rotation.x += Math.sin(timeAlive * 0.067) * 0.05;
        skin.leftArm.rotation.x -= Math.sin(timeAlive * 0.067) * 0.05;

        // Apply User Tweak Offsets (Only for tools)
        if (this.heldBlockId >= 100 || isFoliage(this.heldBlockId)) {
            skin.rightArm.rotation.x += this.tpArmOffset.x;
            skin.rightArm.rotation.y += this.tpArmOffset.y;
            skin.rightArm.rotation.z += this.tpArmOffset.z;
        }

        // Swimming Override
        if (isSwimming) {
            const kick = Math.sin(time * 15) * 0.3;
            skin.leftArm.rotation.x = Math.PI; 
            skin.rightArm.rotation.x = Math.PI;
            skin.leftArm.rotation.z = 0.1;
            skin.rightArm.rotation.z = -0.1;
            skin.leftLeg.rotation.x = kick;
            skin.rightLeg.rotation.x = -kick;
            skin.head.rotation.x = -Math.PI / 4;
            this.playerObject.position.y = 0.8; 
            
            if (this.swinging) {
                const armSwing = Math.sin(this.swingProgress * Math.PI) * 2.0;
                skin.rightArm.rotation.x -= armSwing;
            }
        }
        
        const sync = (main, layer) => {
            if (main && layer && layer.parent !== main) {
                layer.position.copy(main.position);
                layer.rotation.copy(main.rotation);
            }
        };
        sync(skin.head, skin.headLayer);
        sync(skin.body, skin.bodyLayer);
        sync(skin.leftArm, skin.leftArmLayer);
        sync(skin.rightArm, skin.rightArmLayer);
        sync(skin.leftLeg, skin.leftLegLayer);
        sync(skin.rightLeg, skin.rightLegLayer);

        if (!isSwimming && !isRiding) this.playerObject.position.y = this.yOffset;
        this.playerObject.rotation.y = Math.PI;
    }
}