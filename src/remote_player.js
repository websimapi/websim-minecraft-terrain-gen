import * as THREE from 'three';
import * as Skinview3d from 'skinview3d';
import { getBlockMeshMaterials, BLOCKS, isFoliage, getBlockImagePixels, BLOCK_FACES } from './blocks.js';
import { createExtrudedGeometry } from './utils/geometry.js';

export class RemotePlayer {
    constructor(scene, initialPos, skinUrl, username, modelType = 'default') {
        this.scene = scene;
        this.group = new THREE.Group();
        this.group.position.copy(initialPos);
        this.scene.add(this.group);

        // Name Tag
        this.username = username;
        this.nameTagSprite = null;
        this.addNameTag(username);

        // Skin Viewer - Use SAME settings as Player.js
        this.viewer = new Skinview3d.SkinViewer({
            width: 300,
            height: 400,
            renderPaused: true 
        });

        this.playerObject = null;
        this.walkTime = 0;
        
        // Animation State
        this.swinging = false;
        this.swingProgress = 0;

        this.heldBlockId = 0;
        this.heldItemMesh = null;

        // Interpolation
        this.targetPos = initialPos.clone();
        this.targetRot = 0;
        this.currentRot = 0;
        this.targetPitch = 0;
        this.currentPitch = 0;
        
        this.modelType = modelType;

        // Load skin immediately
        this.loadSkin(skinUrl, modelType).catch(console.error);
    }

    addNameTag(username) {
        if (this.nameTagSprite) this.group.remove(this.nameTagSprite);
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const fontSize = 24;
        ctx.font = `${fontSize}px Minecraft, sans-serif`;
        const width = ctx.measureText(username).width + 20;
        const height = fontSize + 10;
        canvas.width = width;
        canvas.height = height;

        // Background - Transparent
        ctx.clearRect(0, 0, width, height);

        // Text Shadow (Solid Black, 3px offset)
        ctx.font = `${fontSize}px Minecraft, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        ctx.fillStyle = '#000000';
        ctx.fillText(username, width / 2 + 3, height / 2 + 3);

        // Text (Solid White)
        ctx.fillStyle = '#ffffff';
        ctx.fillText(username, width / 2, height / 2);

        const tex = new THREE.CanvasTexture(canvas);
        tex.minFilter = THREE.LinearFilter;

        const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.scale.set(width * 0.02, height * 0.02, 1);
        sprite.position.y = 2.2;
        sprite.renderOrder = 100;
        this.group.add(sprite);
        this.nameTagSprite = sprite;
    }
    
    updateNameTag(name) {
        this.addNameTag(name);
    }

    setHeldItem(blockId) {
        if (this.heldBlockId === blockId) return;
        this.heldBlockId = blockId;
        this.updateHeldItemMesh();
    }

    updateHeldItemMesh() {
        if (!this.playerObject || !this.playerObject.skin) return;

        const rightArm = this.playerObject.skin.rightArm;

        // Cleanup
        if (this.heldItemMesh) {
            rightArm.remove(this.heldItemMesh);
            if (this.heldItemMesh.geometry) this.heldItemMesh.geometry.dispose();
            this.heldItemMesh = null;
        }

        if (!this.heldBlockId || this.heldBlockId === BLOCKS.AIR) return;

        let geometry, materials;
        let scale = 4.0;
        let posX = -2, posY = -10, posZ = 2.5;
        let rotX = 0, rotY = 0, rotZ = 0;

        if (BLOCKS.TORCH === this.heldBlockId || this.heldBlockId >= 100 || isFoliage(this.heldBlockId)) {
             const pixels = getBlockImagePixels(BLOCK_FACES[this.heldBlockId]);
             if (pixels) {
                 geometry = createExtrudedGeometry(pixels, 1.5);
                 materials = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
                 scale = 10.0; 
                 posX = -0.4; posY = -4.84; posZ = 3.16;
                 rotX = 0;
                 rotY = THREE.MathUtils.degToRad(93.6);
                 rotZ = THREE.MathUtils.degToRad(123.84);
             } else {
                 geometry = new THREE.BoxGeometry(1, 1, 1);
                 materials = new THREE.MeshBasicMaterial({ color: 0xffffff });
             }
        } else {
            materials = getBlockMeshMaterials(this.heldBlockId);
            geometry = new THREE.BoxGeometry(1, 1, 1);
        }

        this.heldItemMesh = new THREE.Mesh(geometry, materials);
        this.heldItemMesh.scale.set(scale, scale, scale); 
        this.heldItemMesh.position.set(posX, posY, posZ);
        this.heldItemMesh.rotation.set(rotX, rotY, rotZ);
        
        rightArm.add(this.heldItemMesh);
    }

    async loadSkin(url, model = 'default') {
        // Handle default/blob URLs
        if (!url || url === 'default') url = './44a5ec16ce1e57fa.png';
        if (url.startsWith('blob:')) url = './44a5ec16ce1e57fa.png';
        
        // Store current
        this.currentSkinUrl = url;
        this.modelType = model;

        try {
            await this.viewer.loadSkin(url, { model: model });
            
            const playerObject = this.viewer.playerObject;
            if (!playerObject) return;
            
            // Clear group and rebuild - EXACTLY like Player.js
            this.group.clear();
            
            // Re-add nametag (since we cleared)
            if (this.nameTagSprite) this.group.add(this.nameTagSprite);
            
            const scale = 1.8 / 32.0;
            playerObject.scale.set(scale, scale, scale);
            const yOffset = (16 * scale);
            playerObject.position.y = yOffset;
            this.yOffset = yOffset;
            playerObject.rotation.y = Math.PI;

            // Save base positions for animation - like Player.js
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

            // Setup rendering properties - EXACTLY like Player.js
            playerObject.traverse(obj => {
                if (obj.isMesh || obj.isGroup) {
                    obj.frustumCulled = false; 
                    obj.userData.isPlayer = true;

                    // Convert materials to Basic
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
            
            // Re-attach item
            this.updateHeldItemMesh();

        } catch (err) {
            console.error("Remote skin load failed:", err);
            if (url !== './44a5ec16ce1e57fa.png') {
                this.loadSkin('./44a5ec16ce1e57fa.png', model);
            }
        }
    }

    triggerSwing() {
        this.swinging = true;
        this.swingProgress = 0;
    }

    update(delta, pos, rot, pitch, isWalking, isSneaking, isRiding = false) {
        // Interpolate position
        // Check distance. If too far, snap (teleport fix)
        const dist = this.group.position.distanceTo(pos);
        if (dist > 10.0) {
            this.group.position.copy(pos);
        } else {
            this.group.position.lerp(pos, delta * 15);
        }

        // Interpolate rotation
        let diff = rot - this.currentRot;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.currentRot += diff * delta * 15;
        this.group.rotation.y = this.currentRot;
        
        this.currentPitch = THREE.MathUtils.lerp(this.currentPitch, pitch, delta * 15);

        if (!this.playerObject || !this.playerObject.skin) return;

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

        const timeAlive = Date.now() / 50; // Approx ticks

        // Head
        skin.head.rotation.x = this.currentPitch;

        // Walking
        let limbSwing = 0;
        let limbSwingStrength = 0;
        
        if (isWalking && !isRiding) {
            this.walkTime += delta * 10;
            limbSwing = this.walkTime;
            limbSwingStrength = 1.0;
        } else {
            this.walkTime = 0;
        }

        skin.rightArm.rotation.x = Math.cos(limbSwing * 0.6662 + Math.PI) * 2.0 * limbSwingStrength * 0.5;
        skin.leftArm.rotation.x = Math.cos(limbSwing * 0.6662) * 2.0 * limbSwingStrength * 0.5;
        skin.rightLeg.rotation.x = Math.cos(limbSwing * 0.6662) * 1.4 * limbSwingStrength;
        skin.leftLeg.rotation.x = Math.cos(limbSwing * 0.6662 + Math.PI) * 1.4 * limbSwingStrength;

        // Held Item
        if (this.heldBlockId !== 0) {
            skin.rightArm.rotation.x = skin.rightArm.rotation.x * 0.5 - (Math.PI / 10);
        }

        // Riding
        if (isRiding) {
            skin.leftLeg.rotation.x = -1.4;
            skin.leftLeg.rotation.y = -0.3;
            skin.rightLeg.rotation.x = -1.4;
            skin.rightLeg.rotation.y = 0.3;
            this.playerObject.position.y = this.yOffset - 0.6;
        } else {
            this.playerObject.position.y = this.yOffset;
        }

        // Swing
        if (this.swinging) {
            this.swingProgress += delta * 6;
            if (this.swingProgress >= 1) {
                this.swinging = false;
                this.swingProgress = 0;
            } else {
                let sp = this.swingProgress;
                const bodyTwist = Math.sin(Math.sqrt(sp) * Math.PI * 2.0) * 0.2;
                skin.body.rotation.y = -bodyTwist;

                skin.rightArm.rotation.z += Math.sin(this.swingProgress * Math.PI) * -0.4;
                skin.rightArm.rotation.x += bodyTwist;
                skin.leftArm.rotation.x += bodyTwist;
                
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

        // Sneaking
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

        // Sync layers
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

        if (!isRiding) this.playerObject.position.y = this.yOffset;
        this.playerObject.rotation.y = Math.PI;
    }

    dispose() {
        this.scene.remove(this.group);
    }
}