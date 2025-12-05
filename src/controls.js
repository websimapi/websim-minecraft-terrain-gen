import * as THREE from 'three';
import nipplejs from 'nipplejs';
import { Physics } from './physics.js';
import { BLOCKS } from './blocks.js';
import { MiningController } from './controls/mining.js';
import { InteractionController } from './controls/interaction.js';
import { MovementPhysics } from './controls/movement_physics.js';
import { InputHandler } from './controls/input_handler.js';

export class Controls {
    constructor(camera, domElement, world, particleSystem, itemManager) {
        this.camera = camera;
        this.domElement = domElement;
        this.world = world;
        this.world.uiManager = null;
        this.physics = new Physics(world);
        this.particleSystem = particleSystem;
        this.itemManager = itemManager;
        
        // Controllers
        this.miningController = new MiningController(world, particleSystem);
        this.miningController.setItemManager(itemManager);
        this.interactionController = new InteractionController(world, this.physics);
        this.movementPhysics = new MovementPhysics(world, this.physics);
        this.cameraRaycaster = new THREE.Raycaster();
        
        // Input Handler (Refactored)
        this.inputHandler = new InputHandler(this);

        // Input State
        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;
        this.jump = false;
        this.sneak = false;
        this.sprint = false;
        
        // Player Params
        this.defaultEyeHeight = 1.62;
        this.sneakEyeHeight = 1.32;
        this.eyeHeight = this.defaultEyeHeight;
        this.playerHeight = 1.8;
        this.radius = 0.3;
        
        this.position = new THREE.Vector3(camera.position.x, camera.position.y - this.eyeHeight, camera.position.z);
        this.velocity = new THREE.Vector3();
        this.onGround = false;
        
        this.speed = 4.317;
        this.runSpeed = 5.612;
        this.sneakSpeed = 1.3;
        this.jumpForce = 9.0;
        this.gravity = 32.0;

        this.bobTimer = 0;
        this.bobStrength = 0;
        this.isLocked = false;
        this.enableBobbing = true;
        this.baseFov = 75;

        this.fallStartY = this.position.y;
        this.wasOnGround = false;
        
        this.isDigging = false;
        this.isPlacing = false;
        this.interactionTimer = 0;
        
        this.isSpectator = false;
        this.targetedBlock = null;
        
        this.damageTilt = 0;
        this.isDead = false;
        
        this.isCreative = false;
        this.isFlying = false;

        this.stats = { distanceTraveled: 0 };
        
        this.onSwing = null;
        this.onPlace = null;
        this.onInteract = null; // New interaction callback

        this.player = null; // Reference to player for debug
        this.debugHandMode = false; // Item Rotation Debug Mode

        this.cameraMode = 0;
        this.viewAngles = { yaw: camera.rotation.y, pitch: camera.rotation.x };
        
        this.camera.rotation.order = "YXZ";

        this.setupMouse();
        this.isChatOpen = false;

        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if(this.isMobile) {
            this.setupTouch();
        }
        
        this.cactusDamageTimer = 0;
        this.lavaDamageTimer = 0;
        
        this.ridingEntity = null;
    }
    
    mount(entity) {
        if (this.ridingEntity) this.dismount();
        this.ridingEntity = entity;
        this.velocity.set(0, 0, 0);
        entity.rider = this;
        window.dispatchEvent(new CustomEvent('chat-msg', { detail: { user: 'System', msg: 'Mounted Pig. Press Shift to dismount.' } }));
    }

    dismount() {
        if (this.ridingEntity) {
            this.ridingEntity.rider = null;
            const offset = new THREE.Vector3(0, 1, 0);
            this.position.copy(this.ridingEntity.position).add(offset);
            this.ridingEntity = null;
            this.velocity.set(0, 5, 0); // Jump off
            this.onGround = false;
        }
    }
    
    resetState() {
        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;
        this.jump = false;
        this.sneak = false;
        this.sprint = false;
        this.isDigging = false;
        this.isPlacing = false;
    }

    setupMouse() {
        this.domElement.addEventListener('mousemove', (event) => {
            if (this.isLocked) {
                this.viewAngles.yaw -= event.movementX * 0.002;
                this.viewAngles.pitch -= event.movementY * 0.002;
                this.viewAngles.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.viewAngles.pitch));
            }
        });

        this.domElement.addEventListener('mousedown', (event) => {
            if (!this.isLocked) return;
            if (event.button === 0) {
                this.isDigging = true;
                if (this.onSwing) this.onSwing();
            } else if (event.button === 2) {
                this.isPlacing = true;
            }
        });

        this.domElement.addEventListener('mouseup', (event) => {
            if (event.button === 0) {
                this.isDigging = false;
            } else if (event.button === 2) {
                this.isPlacing = false;
            }
        });

        document.addEventListener('contextmenu', (e) => {
            if (this.isLocked) e.preventDefault();
        });
    }

    dropItem() {
        window.dispatchEvent(new CustomEvent('player-drop'));
    }

    checkCactusDamage(pos) {
        const R_P = this.radius;
        const H_P = this.playerHeight;
        const I = 0.0625;
        
        const minX = Math.floor(pos.x - R_P);
        const maxX = Math.floor(pos.x + R_P);
        const minY = Math.floor(pos.y);
        const maxY = Math.floor(pos.y + H_P);
        const minZ = Math.floor(pos.z - R_P);
        const maxZ = Math.floor(pos.z + R_P);

        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                for (let z = minZ; z <= maxZ; z++) {
                    if (this.world.getBlock(x, y, z) === BLOCKS.CACTUS) {
                        const P_x_min = pos.x - R_P;
                        const P_x_max = pos.x + R_P;
                        const C_x_min = x + I;
                        const C_x_max = x + 1 - I;
                        
                        const P_z_min = pos.z - R_P;
                        const P_z_max = pos.z + R_P;
                        const C_z_min = z + I;
                        const C_z_max = z + 1 - I;
                        
                        const intersectX = (P_x_min < C_x_max) && (P_x_max > C_x_min);
                        const intersectY = (pos.y < y + 1) && (pos.y + H_P > y);
                        const intersectZ = (P_z_min < C_z_max) && (P_z_max > C_z_min);

                        if (intersectX && intersectY && intersectZ) {
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }

    updateTargetBlock() {
        this.targetedBlock = this.interactionController.updateTargetBlock(this.camera);
    }

    placeBlock() {
        this.interactionController.placeBlock(
            this.camera,
            this.position,
            this.playerHeight,
            this.radius,
            this.sneak,
            this.onPlace,
            this.world.uiManager // Pass UI Manager for interactions
        );
    }

    setupTouch() {
        document.getElementById('mobile-controls').style.display = 'block';
        const zoneLeft = document.getElementById('zone-left');
        const zoneRight = document.getElementById('zone-right');

        const managerL = nipplejs.create({ zone: zoneLeft, mode: 'static', position: { left: '50%', top: '50%' }, color: 'white' });
        this.touchMoveVector = new THREE.Vector2();

        managerL.on('move', (evt, data) => {
            const force = Math.min(data.force, 1.0);
            this.touchMoveVector.set(
                Math.cos(data.angle.radian) * force,
                -Math.sin(data.angle.radian) * force
            );
        });

        managerL.on('end', () => {
            this.touchMoveVector.set(0, 0);
        });

        // Jump Button
        const jumpBtn = document.getElementById('mobile-jump');
        jumpBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.jump = true;
        });
        jumpBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.jump = false;
        });

        // Chat Button
        const chatBtn = document.getElementById('mobile-chat');
        chatBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            // Trigger Chat Open
            if (this.world.uiManager && this.world.uiManager.chatManager) {
                this.world.uiManager.chatManager.toggle(true);
            }
        });

        let touchStart = 0;
        this.domElement.addEventListener('touchstart', () => {
            touchStart = Date.now();
            this.isDigging = true;
        });
        this.domElement.addEventListener('touchend', () => {
            this.isDigging = false;
        });

        const managerR = nipplejs.create({ zone: zoneRight, mode: 'static', position: { left: '50%', top: '50%' }, color: 'white' });
        managerR.on('move', (evt, data) => {
             const sens = 0.03;
             this.viewAngles.yaw -= data.vector.x * sens;
             this.viewAngles.pitch -= data.vector.y * sens;
             this.viewAngles.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.viewAngles.pitch));
        });
    }

    update(delta, isUnderwater) {
        const dt = Math.min(delta, 0.1);
        
        if (this.isDead) {
            this.damageTilt = THREE.MathUtils.lerp(this.damageTilt, -Math.PI / 2, dt * 5);
            this.camera.rotation.z = this.damageTilt;
            return;
        }

        // Dismount check
        if (this.ridingEntity && this.sneak) {
            this.dismount();
            return;
        }

        if (this.isSpectator) {
            this.updateSpectator(dt);
            return;
        }

        // Lava Damage Logic
        const feetBlock = this.world.getBlock(Math.floor(this.position.x), Math.floor(this.position.y), Math.floor(this.position.z));
        const headBlock = this.world.getBlock(Math.floor(this.position.x), Math.floor(this.position.y + 1), Math.floor(this.position.z));
        
        if (feetBlock === BLOCKS.LAVA || headBlock === BLOCKS.LAVA) {
            this.lavaDamageTimer -= dt;
            if (this.lavaDamageTimer <= 0) {
                this.takeDamage(4); // 2 hearts
                this.lavaDamageTimer = 0.5; // every half second
                // Set On Fire? (Future todo)
            }
        } else {
             this.lavaDamageTimer = 0;
        }

        this.cactusDamageTimer -= dt;
        if (this.cactusDamageTimer <= 0) {
            if (this.checkCactusDamage(this.position)) {
                this.takeDamage(1);
                this.cactusDamageTimer = 0.5;
            }
        }

        if (isUnderwater) {
            this.fallStartY = this.position.y;
        } else {
            // feetBlock already defined
            if (feetBlock === BLOCKS.WATER || feetBlock === BLOCKS.LAVA) {
                this.fallStartY = this.position.y;
            }
        }

        if (!this.isLocked) {
            this.isDigging = false;
            this.isPlacing = false;
        }

        if (this.isLocked) {
            this.updateTargetBlock();

            // Mining handled by MiningController
            const heldId = this.world.uiManager ? this.world.uiManager.getSelectedBlockId() : 0;
            
            if (this.isDigging) {
                const result = this.miningController.update(dt, this.isDigging, this.targetedBlock, heldId);
                // Store result for rendering
                this.miningResult = result;
            } else {
                this.miningResult = { mining: false, progress: 0 };
            }
            
            if (this.isPlacing) {
                 this.interactionTimer -= dt;
                 if (this.interactionTimer <= 0) {
                    let handled = false;
                    // Try Entity Interaction First
                    if (this.onInteract) {
                        handled = this.onInteract();
                    }
                    
                    // If not handled by entity, try Block Placement
                    if (!handled) {
                        this.placeBlock();
                    }
                    this.interactionTimer = 0.2; // 200ms delay
                 }
            }
        } else {
            this.miningResult = { mining: false, progress: 0 };
        }

        if (this.ridingEntity) {
            // Riding Logic: Sync position to entity
            // Entity handles movement physics
            const seatOffset = new THREE.Vector3(0, 0.8, 0); // Pig height roughly
            this.position.copy(this.ridingEntity.position).add(seatOffset);
            
            // Interpolate eye height for sitting (Lower than standing)
            const targetHeight = 1.2; 
            // Soften interpolation while riding to avoid sudden vertical jumps
            this.eyeHeight += (targetHeight - this.eyeHeight) * 4 * dt;
        } else {
            // Delegate Physics Update
            this.movementPhysics.update(dt, this);
        }

        // Update Camera
        if (Math.abs(this.damageTilt) > 0.001) {
            this.damageTilt *= (1.0 - 5.0 * dt);
            this.camera.rotation.z = this.damageTilt;
        } else {
            this.camera.rotation.z = 0;
            this.damageTilt = 0;
        }
        
        // Bobbing Logic (Camera)
        let bobX = 0;
        let bobY = 0;

        if (this.enableBobbing) {
             const speed = this.velocity.length();
             if (this.onGround && speed > 0.1) {
                 this.bobTimer += dt * speed * 3.0;
                 this.bobStrength = Math.min(1.0, speed);
             } else {
                 this.bobStrength = THREE.MathUtils.lerp(this.bobStrength, 0, dt * 10);
                 this.bobTimer = 0;
             }
             
             const ls = this.bobTimer;
             const lss = this.bobStrength;

             // Weaker version of hand bobbing for camera
             // Hand X bob -> Camera X/Yaw (we'll just use X offset for simplicity)
             // Hand Y bob -> Camera Y
             const weakMult = 0.02; // Way lighter strength
             
             bobX = (Math.cos(ls * 0.6662) * 0.05 * lss) * weakMult;
             bobY = (Math.abs(Math.sin(ls * 0.6662)) * 0.07 * lss) * weakMult;
        }

        this.camera.rotation.order = 'YXZ';
        this.camera.rotation.set(
            this.viewAngles.pitch,
            this.viewAngles.yaw,
            this.camera.rotation.z, // Keep strictly to damage tilt (no bob rolling)
            'YXZ'
        );

        if (this.cameraMode !== 0) {
            const eyePos = this.position.clone().add(new THREE.Vector3(0, this.eyeHeight, 0));
            let camDir = new THREE.Vector3(0, 0, 1).applyEuler(this.camera.rotation);
            if (this.cameraMode === 2) camDir.negate();

            const targetDist = 4.0;
            this.cameraRaycaster.set(eyePos, camDir);
            const objects = this.world.chunkGroup ? this.world.chunkGroup.children : this.world.scene.children;
            const hits = this.cameraRaycaster.intersectObjects(objects, true);
            
            let finalDist = targetDist;
            for (let hit of hits) {
                if (hit.distance < targetDist 
                    && !hit.object.userData.particle 
                    && !hit.object.userData.isPlayer 
                    && !hit.object.isPlayer
                    && !(hit.object.parent && hit.object.parent.userData.isPlayer)) {
                    finalDist = Math.min(finalDist, hit.distance - 0.2);
                }
            }
            if (finalDist < 0.8) finalDist = 0.8;
            
            const camPos = eyePos.clone().addScaledVector(camDir, finalDist);
            this.camera.position.copy(camPos);
            
            if (this.cameraMode === 2) this.camera.lookAt(eyePos);
            
        } else {
            // Apply bobbing offsets to camera position
            const camPos = this.position.clone().add(new THREE.Vector3(0, this.eyeHeight, 0));
            
            // Apply bobX relative to view direction (Right vector)
            const right = new THREE.Vector3(1, 0, 0).applyEuler(new THREE.Euler(0, this.viewAngles.yaw, 0, 'YXZ'));
            camPos.addScaledVector(right, bobX);
            
            // Apply bobY up/down
            camPos.y += bobY;

            this.camera.position.copy(camPos);
        }

        if (this.position.y < -30) {
            this.position.set(0, 100, 0);
            this.velocity.set(0,0,0);
        }
    }
    
    getPosition() { return this.position; }
    getYaw() { return this.viewAngles.yaw; }
    getPitch() { return this.viewAngles.pitch; }

    updateSpectator(delta) {
        const speed = (this.sprint ? this.runSpeed * 3 : this.runSpeed * 1.5);
        
        const input = new THREE.Vector3();
        input.x = Number(this.moveRight) - Number(this.moveLeft);
        input.z = Number(this.moveBackward) - Number(this.moveForward);
        input.normalize();

        const euler = new THREE.Euler(this.viewAngles.pitch, this.viewAngles.yaw, 0, 'YXZ');
        const forward = new THREE.Vector3(0, 0, -1).applyEuler(euler);
        const right = new THREE.Vector3(1, 0, 0).applyEuler(euler);
        
        const moveDir = new THREE.Vector3();
        if (input.z !== 0) moveDir.addScaledVector(forward, -input.z);
        if (input.x !== 0) moveDir.addScaledVector(right, input.x);
        
        if (this.jump) moveDir.y += 1;
        if (this.sneak) moveDir.y -= 1;
        
        moveDir.normalize().multiplyScalar(speed);
        
        this.velocity.lerp(moveDir, 10 * delta);
        this.position.addScaledVector(this.velocity, delta);
        
        this.camera.rotation.set(this.viewAngles.pitch, this.viewAngles.yaw, 0, 'YXZ');
        this.camera.position.copy(this.position).add(new THREE.Vector3(0, this.eyeHeight, 0));
    }

    takeDamage(amount) {
        this.damageTilt = -0.4;
        window.dispatchEvent(new CustomEvent('player-damage', { detail: { amount } }));
    }

    setFov(fov) {
        this.baseFov = fov;
        if (this.camera) {
            this.camera.fov = fov;
            this.camera.updateProjectionMatrix();
        }
    }
    
    setBobbing(enabled) {
        this.enableBobbing = enabled;
    }

    raycastEntity(entities) {
        if (!entities || entities.length === 0) return null;
        // Use interactionController's raycaster
        this.interactionController.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
        // Map to group for cows, model/group for zombies
        const objects = [];
        const entityMap = new Map();
        
        entities.forEach(e => {
            const obj = e.group || e.model;
            if (obj) {
                objects.push(obj);
                entityMap.set(obj.uuid, e);
                // Also map children for recursive raycast
                obj.traverse(c => { entityMap.set(c.uuid, e); });
            }
        });

        const intersects = this.interactionController.raycaster.intersectObjects(objects, true);
        if (intersects.length > 0) {
            const hit = intersects[0];
            if (hit.distance < 4.0) {
                return entityMap.get(hit.object.uuid);
            }
        }
        return null;
    }
    
    setDead(dead) {
        this.isDead = dead;
        if (!dead) {
            this.damageTilt = 0;
            this.camera.rotation.z = 0;
        }
    }

    toggleCreative() {
        this.isCreative = !this.isCreative;
        this.isFlying = this.isCreative;
        
        const msg = this.isCreative ? 'Creative Mode: ON (Press G to Fly)' : 'Creative Mode: OFF';
        window.dispatchEvent(new CustomEvent('chat-msg', { detail: { user: 'System', msg } }));
        
        const hb = document.getElementById('health-bar');
        if (hb) hb.style.display = this.isCreative ? 'none' : 'flex';
        
        if (this.isCreative) {
            // Restore health logic? Maybe just visual hide is enough.
        }
    }

    toggleFly() {
        if (this.isCreative) {
            this.isFlying = !this.isFlying;
            window.dispatchEvent(new CustomEvent('chat-msg', { detail: { user: 'System', msg: `Flying: ${this.isFlying ? 'ON' : 'OFF'}` } }));
        }
    }

    updateBobbing(dt, controls, input, inWater) {
        // Deprecated/Superseded by logic in update()
        const targetHeight = controls.sneak ? controls.sneakEyeHeight : controls.defaultEyeHeight;
        controls.eyeHeight += (targetHeight - controls.eyeHeight) * 10 * dt;
    }
}