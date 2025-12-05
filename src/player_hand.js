import * as THREE from 'three';
import { getBlockMeshMaterials, BLOCKS, BLOCK_FACES, getBlockImagePixels, isFoliage, getAtlasUV } from './blocks.js';
import { createExtrudedGeometry } from './utils/geometry.js';
import { atlasTexture } from './rendering/texture_atlas.js';

export class PlayerHand {
    constructor(sceneHUD) {
        this.group = new THREE.Group();
        this.group.position.set(0.8, -1.0, -1.2);
        sceneHUD.add(this.group);

        this.heldItemMesh = null;
        this.initHandMesh();

        // Animation State
        this.swinging = false;
        this.swingProgress = 0;
        this.isSwitching = false;
        this.switchProgress = 0;
        this.switchDuration = 0.2; 
        
        this.limbSwing = 0;
        this.limbSwingStrength = 0;
        
        // Cache for extruded geometries
        this.extrudedGeometries = new Map();
        
        // Fixed Params (Now Public for GUI)
        this.transformFoliage = {
            x: -1.68,
            y: -3.15,
            z: 2.67,
            rotX: 23.76,
            rotY: 0,
            rotZ: 184.6,
            scale: 4.037,
            thickness: 2.028 
        };
        
        // Tool Transform (Axes, Pickaxes, Shovels, Swords, Hoes)
        this.transformTool = {
            x: -1.68,
            y: -2.55,
            z: 2.47,
            rotX: 20.52,
            rotY: 205.2,
            rotZ: 154.8,
            scale: 4.331,
            thickness: 2.028
        };
        
        // Adjusted defaults for "Straight" look requested previously, 
        // now tweakable via GUI.
        this.transformEmpty = {
            baseX: 1.1,
            baseY: -2,
            baseZ: -1.15,
            rotX: 107.28,
            rotY: 66.24,
            rotZ: 28.08,
        };

        this.transformHolding = {
            baseX: 1.32,
            baseY: -1.69,
            baseZ: -2.68,
            rotX: 20.16,
            rotY: 141.48,
            rotZ: 329.76
        };

        this.currentBlockId = null;
        this.verticalSwing = 0;
    }

    // Accessor for the currently active transform object based on held item
    getActiveTransform() {
        if (!this.currentBlockId || this.currentBlockId === BLOCKS.AIR) return this.transformEmpty;
        
        if (isFoliage(this.currentBlockId)) {
            const isTool = (this.currentBlockId >= 111 && this.currentBlockId <= 116) || (this.currentBlockId >= 130 && this.currentBlockId <= 144);
            return isTool ? this.transformTool : this.transformFoliage;
        }
        
        return this.transformHolding;
    }

    initHandMesh() {
        const w = 0.55; 
        const h = 1.6; 
        const d = 0.55;
        this.handGeo = new THREE.BoxGeometry(w, h, d);
        this.handGeo.translate(0, -h/2 + 0.1, 0);

        // Use Lambert for lighting/shading support
        this.handMat = new THREE.MeshLambertMaterial({ 
            map: null,
            color: 0xffffff
        });

        this.handMesh = new THREE.Mesh(this.handGeo, this.handMat);
        // Adjusted rotation to be slightly more angled to the right
        // Old: 1.8, 1.2, 0.2
        // New: 1.8, 1.0, 0.35 (Less Yaw inward, more Roll outward)
        this.handMesh.rotation.set(1.8, 1.0, 0.35);
        this.group.add(this.handMesh);

        // Sleeve Layer (Outer Layer)
        const sW = w * 1.1; // Slightly larger
        const sH = h * 1.05;
        const sD = d * 1.1;
        this.sleeveGeo = new THREE.BoxGeometry(sW, sH, sD);
        this.sleeveGeo.translate(0, -sH/2 + 0.1, 0); // Match offset pivot
        
        // Updated to Lambert Material for lighting
        this.sleeveMat = new THREE.MeshLambertMaterial({
            map: null,
            color: 0xffffff,
            transparent: true,
            side: THREE.DoubleSide,
            alphaTest: 0.1
        });
        
        this.sleeveMesh = new THREE.Mesh(this.sleeveGeo, this.sleeveMat);
        // Add to handMesh so it moves with it
        this.handMesh.add(this.sleeveMesh);
    }

    setHeldItem(blockId) {
        this.currentBlockId = blockId;
        
        // Cleanup old item mesh
        if (this.heldItemMesh) {
            this.heldItemMesh.removeFromParent();
            // Dispose logic
            this.heldItemMesh.traverse(child => {
                if (child.isMesh) {
                    if (child.userData.cacheKey && !this.extrudedGeometries.has(child.userData.cacheKey)) {
                         if (child.geometry) child.geometry.dispose();
                    } else if (!child.userData.cacheKey && child.geometry) {
                         child.geometry.dispose();
                    }
                    
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m.dispose());
                    } else if (child.material) {
                        child.material.dispose();
                    }
                }
            });
            this.heldItemMesh = null;
        }

        // If air/null, show hand and return (ensure mesh is gone)
        if (!blockId || blockId === BLOCKS.AIR) {
            this.handMat.visible = true;
            this.sleeveMat.visible = true;
            return;
        }

        const isComplex = (
            blockId === BLOCKS.COBBLESTONE_SLAB || 
            blockId === BLOCKS.OAK_SLAB ||
            blockId === BLOCKS.COBBLESTONE_STAIRS || 
            blockId === BLOCKS.OAK_STAIRS ||
            blockId === BLOCKS.OAK_FENCE
        );

        if (isFoliage(blockId)) {
            // Hide arm for these items as requested
            this.handMat.visible = false;
            this.sleeveMat.visible = false;
            
            const isTool = (blockId >= 111 && blockId <= 115);
            const tf = isTool ? this.transformTool : this.transformFoliage;

            const cacheKey = 'foliage_' + blockId + '_t' + tf.thickness;
            let geometry = this.extrudedGeometries.get(cacheKey);

            if (!geometry) {
                // Generate Extruded Geometry
                let faceName = BLOCK_FACES[blockId];
                if (Array.isArray(faceName)) faceName = faceName[0];
                
                const pixels = getBlockImagePixels(faceName);
                if (pixels) {
                    // Refactored: Use utility function
                    geometry = createExtrudedGeometry(pixels, tf.thickness || 1.0);
                    this.extrudedGeometries.set(cacheKey, geometry);
                } else {
                    // Fallback
                    geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
                }
            }

            // Create mesh - Use Lambert Material for shading
            const material = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
            this.heldItemMesh = new THREE.Mesh(geometry, material);
            this.heldItemMesh.userData.cacheKey = cacheKey;
            this.heldItemMesh.userData.isFoliage = true; // Flag for update loop
            
            // Use live params
            this.updateFoliageTransform();

            this.handMesh.add(this.heldItemMesh);

        } else {
            // Standard Block or Complex Block using Texture Atlas
            this.handMat.visible = false;
            this.sleeveMat.visible = false;

            // Use Atlas Material
            const material = new THREE.MeshLambertMaterial({ 
                map: atlasTexture, 
                color: 0xffffff, 
                side: THREE.DoubleSide,
                transparent: true,
                alphaTest: 0.1
            });

            // Apply Tint
            if (blockId === BLOCKS.GRASS) {
                material.color.setHex(0x79C05A);
            } else if (blockId === BLOCKS.LEAVES || blockId === BLOCKS.JUNGLE_LEAVES || blockId === BLOCKS.ACACIA_LEAVES || blockId === BLOCKS.DARK_OAK_LEAVES) {
                material.color.setHex(0x48B518);
            } else if (blockId === BLOCKS.BIRCH_LEAVES) {
                material.color.setHex(0x80a755);
            } else if (blockId === BLOCKS.SPRUCE_LEAVES) {
                material.color.setHex(0x619961);
            } else if (blockId === BLOCKS.WATER || blockId === BLOCKS.WATER_BUCKET) {
                material.color.setHex(0x0040FF);
            }

            let mesh;

            // Height offset for held complex items (moved up as requested)
            const yOffset = isComplex ? 0.4 : -0.6;

            if (blockId === BLOCKS.COBBLESTONE_SLAB || blockId === BLOCKS.OAK_SLAB) {
                // Half height box
                const geometry = new THREE.BoxGeometry(1.6, 0.8, 1.6);
                mesh = new THREE.Mesh(geometry, material);
                // Adjust position to align with where the bottom of a full block would be
                mesh.position.set(0, -1.0 + yOffset + 0.6, 0.5); // Adjusted base
            } else if (blockId === BLOCKS.COBBLESTONE_STAIRS || blockId === BLOCKS.OAK_STAIRS) {
                mesh = new THREE.Group();
                // Bottom Half
                const bGeo = new THREE.BoxGeometry(1.6, 0.8, 1.6);
                const bMesh = new THREE.Mesh(bGeo, material);
                bMesh.position.y = -0.4;
                mesh.add(bMesh);
                
                // Top Back Quarter
                const tGeo = new THREE.BoxGeometry(1.6, 0.8, 0.8);
                const tMesh = new THREE.Mesh(tGeo, material);
                tMesh.position.set(0, 0.4, -0.4);
                mesh.add(tMesh);
                
                mesh.position.set(0, yOffset, 0.5);
            } else if (blockId === BLOCKS.OAK_FENCE) {
                mesh = new THREE.Group();
                
                // Post
                const pGeo = new THREE.BoxGeometry(0.6, 1.6, 0.6);
                const pMesh = new THREE.Mesh(pGeo, material);
                mesh.add(pMesh);
                
                // Bars
                const barGeo = new THREE.BoxGeometry(0.4, 0.3, 0.3);
                
                const b1 = new THREE.Mesh(barGeo, material);
                b1.position.set(0.5, 0.3, 0);
                mesh.add(b1);
                
                const b2 = new THREE.Mesh(barGeo, material);
                b2.position.set(0.5, -0.3, 0);
                mesh.add(b2);
                
                const b3 = new THREE.Mesh(barGeo, material);
                b3.position.set(-0.5, 0.3, 0);
                mesh.add(b3);
                
                const b4 = new THREE.Mesh(barGeo, material);
                b4.position.set(-0.5, -0.3, 0);
                mesh.add(b4);

                mesh.position.set(0, yOffset, 0.5);
            } else {
                const geometry = new THREE.BoxGeometry(1.6, 1.6, 1.6); 
                mesh = new THREE.Mesh(geometry, material);
                mesh.position.set(0, -0.6, 0.5); 
            }

            // Apply Atlas UVs to all geometries in the mesh/group
            this.applyAtlasUVs(mesh, blockId);

            mesh.rotation.set(0, Math.PI, 0);
            this.heldItemMesh = mesh;
            this.handMesh.add(this.heldItemMesh);
        }
    }

    applyAtlasUVs(object, blockId) {
        const faces = BLOCK_FACES[blockId];
        
        object.traverse(child => {
            if (child.isMesh && child.geometry && child.geometry.attributes.uv) {
                const geo = child.geometry;
                const uvs = geo.attributes.uv;
                
                for(let i=0; i<6; i++) {
                    let matName;
                    if (faces) {
                        if (Array.isArray(faces)) matName = faces[i];
                        else matName = faces; 
                    }
                    if (!matName) matName = 'stone'; // Default
                    
                    const uvData = getAtlasUV(matName);
                    
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
                geo.attributes.uv.needsUpdate = true;
            }
        });
    }

    updateUVs(textureWidth, textureHeight) {
        const setUV = (geo, faceIdx, u, v, w, h, rotate = 0) => {
            const uvAttr = geo.attributes.uv;
            const tw = textureWidth || 64;
            const th = textureHeight || 64;
            
            // Inset half a pixel to prevent texture border bleeding
            const epsilon = 0.1; 
            
            const u0 = (u + epsilon) / tw;
            const u1 = (u + w - epsilon) / tw;
            
            const v0 = 1 - (v + h - epsilon) / th; 
            const v1 = 1 - (v + epsilon) / th;     

            const i = faceIdx * 4;
            
            // Standard: (0, 1), (1, 1), (1, 0), (0, 0) -> TL, TR, BR, BL
            // Face vertices in BoxGeometry are usually: TL, TR, BL, BR? No.
            // BoxGeometry Face Vertex Order (indexed):
            // 0: Top-Left
            // 1: Top-Right
            // 2: Bottom-Left
            // 3: Bottom-Right
            
            // Fixed UV mapping order to prevent diagonal shearing (2/3 swapped previously)
            
            if (rotate === 0) {
                uvAttr.setXY(i+0, u0, v1); // TL
                uvAttr.setXY(i+1, u1, v1); // TR
                uvAttr.setXY(i+2, u0, v0); // BL
                uvAttr.setXY(i+3, u1, v0); // BR
            } else {
                // Rotate 90 deg ? Or just use specific mappings.
                // For now let's just fix the side faces by flipping if needed.
            }
        };

        // Fix: Map faces correctly to MC layout
        // BoxGeometry Faces: 0:+x(Right), 1:-x(Left), 2:+y(Top), 3:-y(Bottom), 4:+z(Front), 5:-z(Back)
        
        // MC Skin Right Arm: 
        // Right(40,20), Front(44,20), Left(48,20), Back(52,20)
        // Top(44,16), Bottom(48,16)
        
        // Mapping:
        // Face 0 (+x) is Right side of mesh. Should be 'Right' texture (40, 20).
        // Face 1 (-x) is Left side of mesh. Should be 'Left' texture (48, 20).
        // Face 4 (+z) is Front of mesh. Should be 'Front' texture (44, 20).
        // Face 5 (-z) is Back of mesh. Should be 'Back' texture (52, 20).
        
        setUV(this.handGeo, 0, 40, 20, 4, 12); // Right (+x)
        setUV(this.handGeo, 1, 48, 20, 4, 12); // Left (-x)
        
        // Top Face (+y): 
        // MC Top texture: Head Top points -Z? 
        // Standard mapping: (0,1) is -x,-z? 
        // Let's try rotating top face 90 degrees if it looks wrong, but standard might be okay.
        setUV(this.handGeo, 2, 44, 16, 4, 4);  // Top (+y)
        setUV(this.handGeo, 3, 48, 16, 4, 4);  // Bottom (-y)
        
        setUV(this.handGeo, 4, 44, 20, 4, 12); // Front (+z)
        setUV(this.handGeo, 5, 52, 20, 4, 12); // Back (-z)
        
        this.handGeo.attributes.uv.needsUpdate = true;

        // Right Arm Overlay (Sleeve) - Offset +16 Y
        setUV(this.sleeveGeo, 0, 40, 36, 4, 12); 
        setUV(this.sleeveGeo, 1, 48, 36, 4, 12); 
        setUV(this.sleeveGeo, 2, 44, 32, 4, 4);  
        setUV(this.sleeveGeo, 3, 48, 32, 4, 4);  
        setUV(this.sleeveGeo, 4, 44, 36, 4, 12); 
        setUV(this.sleeveGeo, 5, 52, 36, 4, 12); 
        this.sleeveGeo.attributes.uv.needsUpdate = true;
    }

    setSkin(texture) {
        this.handMat.map = texture;
        this.handMat.needsUpdate = true;
        this.sleeveMat.map = texture;
        this.sleeveMat.needsUpdate = true;
        
        if (texture.image) {
            this.updateUVs(texture.image.width, texture.image.height);
        }
    }

    startSwitchAnimation() {
        this.isSwitching = true;
        this.switchProgress = 0;
    }

    swing() {
        if (!this.swinging) {
            this.swinging = true;
            this.swingProgress = 0;
        }
    }

    update(delta, time, velocity, isDigging, damageTilt) {
        // Determine which transform to use based on item type
        const isFoliageItem = this.currentBlockId && isFoliage(this.currentBlockId);
        const isHoldingBlock = this.currentBlockId && !isFoliageItem && this.currentBlockId !== BLOCKS.AIR;
        
        // For Block items, use the hand transform (it includes the block inside)
        // For Foliage items, use transformFoliage logic inside setHeldItem, 
        // but here we might need to adjust the group if holding foliage?
        // Actually, Foliage items are attached to handMesh in setHeldItem using transformFoliage.
        // The GROUP transform is mainly for the ARM itself.
        
        const tf = isHoldingBlock ? this.transformHolding : this.transformEmpty;

        // Base Transforms from params
        const radX = THREE.MathUtils.degToRad(tf.rotX);
        const radY = THREE.MathUtils.degToRad(tf.rotY);
        const radZ = THREE.MathUtils.degToRad(tf.rotZ);
        
        const baseX = tf.baseX;
        const baseY = tf.baseY;
        const baseZ = tf.baseZ;

        // Bobbing Logic
        const speed = Math.sqrt(velocity.x*velocity.x + velocity.z*velocity.z);
        const isMoving = speed > 0.1;

        if (isMoving) {
            this.limbSwing += delta * speed * 3.0;
            this.limbSwingStrength = Math.min(1.0, speed);
        } else {
            this.limbSwingStrength = THREE.MathUtils.lerp(this.limbSwingStrength, 0, delta * 10);
            this.limbSwing = 0;
        }

        const ls = this.limbSwing;
        const lss = this.limbSwingStrength;

        // User Formula
        const bobX = Math.cos(ls * 0.6662) * 0.05 * lss;
        const bobY = -Math.abs(Math.sin(ls * 0.6662)) * 0.07 * lss;

        // Vertical Movement (Jump/Fall) Reactivity
        this.verticalSwing = THREE.MathUtils.lerp(this.verticalSwing, velocity.y, delta * 8);
        // Drag effect: velocity UP -> hand DOWN.
        const vOffset = THREE.MathUtils.clamp(-this.verticalSwing * 0.05, -0.5, 0.5);

        // Set Base Position + Bobbing (No accumulation)
        this.group.position.set(
            baseX + bobX,
            baseY + bobY + vOffset,
            baseZ
        );

        // Apply Damage Tilt
        if (damageTilt) {
            this.group.rotation.z = damageTilt; 
        } else {
            this.group.rotation.z = 0;
        }

        // Apply Base Rotation
        this.handMesh.rotation.set(radX, radY, radZ);

        // Digging Animation - Repeated Swing
        if (isDigging && !this.swinging && !this.isSwitching) {
            this.swing();
        }

        // Item Switching Animation
        if (this.isSwitching) {
            this.swinging = false; 
            this.swingProgress = 0;

            this.switchProgress += delta;
            let t = this.switchProgress / this.switchDuration;
            if (t >= 1) {
                this.isSwitching = false;
                t = 1;
            }
            // Linear down-up for switch
            const offsetMax = 0.8;
            const switchOffsetY = -offsetMax * Math.sin(t * Math.PI);
            this.group.position.y += switchOffsetY;
            
            // Tilt forward slightly during switch
            this.handMesh.rotation.x += Math.sin(t * Math.PI) * 0.5;
        }

        // Minecraft Swing Animation
        if (this.swinging) {
            // Speed = 6.0 (roughly 0.16s, similar to MC's ~6 ticks)
            this.swingProgress += delta * 6.0; 
            
            if (this.swingProgress >= 1) {
                this.swinging = false;
                this.swingProgress = 0;
            } else {
                // Apply logic from Third Person Swing (Player.js)
                const p = this.swingProgress;
                
                const sqrtP = Math.sqrt(p);
                const sinP = Math.sin(p * Math.PI);
                const bodyTwist = Math.sin(sqrtP * Math.PI * 2.0) * 0.2;
                
                // Smash Curve Easing
                let sp = 1.0 - p;
                sp = sp * sp;
                sp = sp * sp;
                sp = 1.0 - sp;
                const sinEased = Math.sin(sp * Math.PI);

                // Rotations matching 3rd person feel
                this.handMesh.rotation.x += bodyTwist;
                this.handMesh.rotation.x -= sinEased * 1.2;
                
                this.handMesh.rotation.y += bodyTwist * 2.0;
                
                this.handMesh.rotation.z += sinP * -0.4;
                this.handMesh.rotation.z += sinEased * -0.4;
            }
        }

        this.updateFoliageTransform(); // Keep foliage relative transform in sync
    }

    applyLight(lightLevel) {
        // lightLevel is 0 (dark) to 1 (bright)
        const c = Math.max(0.1, lightLevel); 
        
        // Update hand/sleeve color scalar
        this.handMat.color.setScalar(c);
        this.sleeveMat.color.setScalar(c);
        
        // Update held item color scalar
        if (this.heldItemMesh && !this.heldItemMesh.userData.isFoliage) {
            this.heldItemMesh.traverse(obj => {
                if (obj.isMesh && obj.material) {
                    if (Array.isArray(obj.material)) {
                        obj.material.forEach(m => m.color.setScalar(c));
                    } else {
                        obj.material.color.setScalar(c);
                    }
                }
            });
        }
    }

    setVisible(visible) {
        this.group.visible = visible;
    }

    // New helper to update foliage live
    updateFoliageTransform() {
        if (this.heldItemMesh && this.heldItemMesh.userData.isFoliage) {
            // Check if it's a tool
            const isTool = (this.currentBlockId >= 111 && this.currentBlockId <= 116) || (this.currentBlockId >= 130 && this.currentBlockId <= 144);

            // Copy transform values to local object to allow overrides
            // Use transformTool for tools, transformFoliage for others
            let tfSource = isTool ? this.transformTool : this.transformFoliage;
            let tf = { ...tfSource };
            
            let scaleX = tf.scale;
            let scaleY = tf.scale;

            // Special handling for specific items

            // Upright for Door Items
            if (this.currentBlockId === BLOCKS.OAK_DOOR_ITEM ||
                this.currentBlockId === BLOCKS.SPRUCE_DOOR_ITEM ||
                this.currentBlockId === BLOCKS.BIRCH_DOOR_ITEM ||
                this.currentBlockId === BLOCKS.JUNGLE_DOOR_ITEM ||
                this.currentBlockId === BLOCKS.ACACIA_DOOR_ITEM ||
                this.currentBlockId === BLOCKS.DARK_OAK_DOOR_ITEM ||
                this.currentBlockId === BLOCKS.IRON_DOOR_ITEM) {
                tf.rotZ = 180;
                tf.rotX = 0;
                tf.y += 1.0;
                tf.scale *= 0.8; // Fit better
            }

            // Flip Axe Texture (Left-Right)
            if (this.currentBlockId === BLOCKS.IRON_AXE) {
                scaleX *= -1;
            }

            // Fix Flint and Steel
            if (this.currentBlockId === BLOCKS.FLINT_AND_STEEL) {
                // Adjust rotation to point correctly (flip)
                scaleX *= -1; 
                tf.rotZ -= 45; // Tilt up slightly
            }

            this.heldItemMesh.position.set(tf.x, tf.y, tf.z); 
            this.heldItemMesh.rotation.set(
                THREE.MathUtils.degToRad(tf.rotX), 
                THREE.MathUtils.degToRad(tf.rotY), 
                THREE.MathUtils.degToRad(tf.rotZ)
            ); 
            const s = tf.scale;
            this.heldItemMesh.scale.set(scaleX, scaleY, s); 
        }
    }
}