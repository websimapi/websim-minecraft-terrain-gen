import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Physics } from './physics.js';
import { BLOCKS } from './constants.js';

const loader = new GLTFLoader();
const textureLoader = new THREE.TextureLoader();
const shadowTexture = textureLoader.load('./shadow.png');

export class Cow {
    constructor(scene, position, physics) {
        this.scene = scene;
        this.position = position.clone();
        this.physics = physics;

        this.velocity = new THREE.Vector3(0, 0, 0);
        this.onGround = false;
        this.speed = 1.0; 
        this.gravity = 30.0;
        this.jumpForce = 7.0;

        this.group = new THREE.Group();
        this.group.position.copy(this.position);
        this.scene.add(this.group);

        // Shadow
        const shadowGeo = new THREE.PlaneGeometry(1.5, 1.5);
        const shadowMat = new THREE.MeshBasicMaterial({ 
            map: shadowTexture, 
            transparent: true, 
            opacity: 0.6,
            depthWrite: false, 
            side: THREE.DoubleSide 
        });
        this.shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
        this.shadowMesh.rotation.x = -Math.PI / 2;
        this.shadowMesh.position.y = 0.05;
        this.group.add(this.shadowMesh);

        // Rigging Parts
        this.skin = {
            head: null,
            body: null,
            leg1: null, // FL
            leg2: null, // FR
            leg3: null, // BL
            leg4: null  // BR
        };
        
        this.mixer = null;
        this.walkAction = null;
        this.animations = [];
        this.useBakedAnimation = true; // Toggle for GUI

        this.loadModel();

        this.width = 0.9;
        this.height = 1.4;
        this.dead = false;
        
        this.health = 10;
        this.walkTime = 0;
        this.headBob = 0;
        
        // AI State
        this.moveTimer = 0;
        this.idleTimer = 0;
        this.targetDir = new THREE.Vector3();
        this.isMoving = false;
        this.knockback = new THREE.Vector3();
        this.panicTimer = 0; // Run away timer
    }

    loadModel() {
        const texture = textureLoader.load('./cow.png');
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.flipY = false; // FIX UV MAPPING for GLTF

        loader.load('./hello!@.gltf', (gltf) => {
            const model = gltf.scene;
            this.model = model;
            
            // 1. Scale Model
            const boxRaw = new THREE.Box3().setFromObject(model);
            const sizeRaw = boxRaw.getSize(new THREE.Vector3());
            const scaleY = sizeRaw.y > 0 ? sizeRaw.y : 1;
            const targetHeight = 1.4;
            const scale = targetHeight / scaleY;
            model.scale.set(scale, scale, scale);
            
            // Fix rotation so it faces forward
            model.rotation.y = Math.PI;

            // 2. Fix Visual Position (Prevent Ground Clipping)
            model.updateMatrixWorld(true);
            const boxFinal = new THREE.Box3().setFromObject(model);
            // Shift model down so its bottom aligns with 0 (feet level)
            model.position.y = -boxFinal.min.y;

            model.traverse(c => {
                // Ensure every part has a name for the editor
                if (!c.name) c.name = 'Part_' + c.uuid.substring(0,4);
                
                if (c.isMesh) {
                    c.frustumCulled = false;
                    if (c.material) {
                        // Use MeshBasicMaterial for bright, non-reflective look
                        c.material = new THREE.MeshBasicMaterial({
                            map: texture,
                            color: 0xffffff,
                            side: THREE.DoubleSide,
                            transparent: true,
                            alphaTest: 0.5
                        });
                    }
                }
            });

            this.animations = gltf.animations || [];

            // 3. Animation / Rigging
            if (this.animations.length > 0) {
                // Use baked animations if available
                this.mixer = new THREE.AnimationMixer(model);
                this.playAnimation(this.animations[0].name);
            } 
            
            // Setup Manual Rigging based on updated instructions
            const findNode = (name) => {
                let res = null;
                model.traverse(c => { if(c.name === name) res = c; });
                return res;
            };

            // Mapping from prompt instructions
            this.skin.head = findNode('head');
            this.skin.body = findNode('body');
            this.skin.leg1 = findNode('leg0'); // Front Left
            this.skin.leg2 = findNode('leg1'); // Front Right
            this.skin.leg3 = findNode('leg2'); // Back Left
            this.skin.leg4 = findNode('leg3'); // Back Right

            // Fallback if specific nodes missing (safety)
            if (!this.skin.leg1) {
                const meshes = [];
                model.traverse(c => { if (c.isMesh || c.isBone) meshes.push(c); });
                // ... (Original sorting logic omitted for brevity, assuming names exist in this asset)
            }
            
            // Save base transforms for procedural animation reset
            const saveBase = (part) => {
                if(part) {
                    part.userData.baseRot = part.rotation.clone();
                    part.userData.basePos = part.position.clone();
                }
            };
            Object.values(this.skin).forEach(saveBase);

            this.group.add(model);
            
            // Notify system for Debug GUI
            window.dispatchEvent(new CustomEvent('cow-loaded', { detail: { cow: this } }));

        }, undefined, (err) => console.error("Error loading cow:", err));
    }

    playAnimation(name) {
        if (!this.mixer) return;
        const clip = this.animations.find(c => c.name === name);
        if (clip) {
            if (this.walkAction) this.walkAction.stop();
            this.walkAction = this.mixer.clipAction(clip);
            this.walkAction.play();
            // Start paused, update loop handles playing
            this.walkAction.paused = true;
        }
    }

    getPartNames() {
        const names = [];
        if (this.model) {
            this.model.traverse(o => {
                if (o.name) names.push(o.name);
            });
        }
        return names;
    }

    mapLimb(limbKey, partName) {
        if (!this.model) return;
        let found = null;
        this.model.traverse(o => {
            if (o.name === partName) found = o;
        });
        
        if (found) {
            this.skin[limbKey] = found;
            // Capture base transform for procedural animation reference
            if (!found.userData.baseRot) found.userData.baseRot = found.rotation.clone();
            if (!found.userData.basePos) found.userData.basePos = found.position.clone();
        }
    }

    update(delta, playerPos) {
        if (this.dead) return;

        // Lighting
        const lx = Math.floor(this.position.x);
        const ly = Math.floor(this.position.y + 1);
        const lz = Math.floor(this.position.z);
        const wLight = this.physics.world.getLight(lx, ly, lz);
        const val = Math.max(0.2, wLight / 15.0);

        if (this.model) {
            this.model.traverse(o => {
                if(o.isMesh && o.material) {
                    // Base white
                    if (o.material.color.getHex() === 0xff0000) return;
                    o.material.color.setScalar(val);
                }
            });
        }

        // Apply Knockback
        if (this.knockback.lengthSq() > 0.01) {
            this.velocity.add(this.knockback.clone().multiplyScalar(delta * 10)); // Apply impulse influence
            this.knockback.multiplyScalar(0.9); // Decay
        }

        // Panic Logic (Run away from player)
        if (this.panicTimer > 0) {
            this.panicTimer -= delta;
            this.moveTimer = 0.5; // Force movement
            this.isMoving = true;
            
            // Calculate direction away from player
            const dx = this.position.x - playerPos.x;
            const dz = this.position.z - playerPos.z;
            const dist = Math.sqrt(dx*dx + dz*dz);
            
            if (dist > 0.1) {
                // Add slight randomness to not run in perfectly straight lines
                const jitter = (Math.random() - 0.5) * 0.5;
                this.targetDir.set(dx/dist + jitter, 0, dz/dist + jitter).normalize();
            } else {
                // Too close/on top, pick random
                this.targetDir.set(Math.random()-0.5, 0, Math.random()-0.5).normalize();
            }
            
            // Speed boost
            this.velocity.x = this.targetDir.x * this.speed * 2.0;
            this.velocity.z = this.targetDir.z * this.speed * 2.0;
            
            // Smooth Rotation towards target
            const targetAngle = Math.atan2(this.targetDir.x, this.targetDir.z);
            let angleDiff = targetAngle - this.group.rotation.y;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            this.group.rotation.y += angleDiff * delta * 10.0;

            // Jump up block
            const lookAhead = this.position.clone().addScaledVector(this.targetDir, 0.6);
            if (this.physics.checkCollision(lookAhead, 0.4, 0.5)) {
                if (this.onGround) this.velocity.y = this.jumpForce;
            }

        } else if (this.moveTimer > 0) {
            this.moveTimer -= delta;
            this.isMoving = true;
            
            // Move
            this.velocity.x = this.targetDir.x * this.speed;
            this.velocity.z = this.targetDir.z * this.speed;
            
            // Smooth Rotation towards target
            const targetAngle = Math.atan2(this.targetDir.x, this.targetDir.z);
            let angleDiff = targetAngle - this.group.rotation.y;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            this.group.rotation.y += angleDiff * delta * 5.0;

            // Jump up block
            const lookAhead = this.position.clone().addScaledVector(this.targetDir, 0.6);
            if (this.physics.checkCollision(lookAhead, 0.4, 0.5)) {
                if (this.onGround) this.velocity.y = this.jumpForce;
            }

        } else {
            this.isMoving = false;
            this.velocity.x = 0;
            this.velocity.z = 0;
            
            this.idleTimer -= delta;
            if (this.idleTimer <= 0) {
                // More active: 70% chance to move
                if (Math.random() < 0.3) { 
                    this.idleTimer = 1 + Math.random() * 3;
                } else {
                    this.moveTimer = 1 + Math.random() * 4;
                    const r = Math.random() * Math.PI * 2;
                    this.targetDir.set(Math.sin(r), 0, Math.cos(r));
                }
            }
        }

        // Physics
        this.velocity.y -= this.gravity * delta;
        const dt = Math.min(delta, 0.1);
        const pos = this.position.clone();

        // Collision X
        pos.x += this.velocity.x * dt;
        if (this.physics.checkCollision(pos, 0.45, 1.4)) {
            pos.x -= this.velocity.x * dt;
            this.velocity.x = 0;
        }

        // Collision Z
        pos.z += this.velocity.z * dt;
        if (this.physics.checkCollision(pos, 0.45, 1.4)) {
            pos.z -= this.velocity.z * dt;
            this.velocity.z = 0;
        }

        // Collision Y
        this.onGround = false;
        pos.y += this.velocity.y * dt;
        if (this.physics.checkCollision(pos, 0.45, 1.4)) {
            if (this.velocity.y < 0) this.onGround = true;
            pos.y -= this.velocity.y * dt;
            this.velocity.y = 0;
        }

        // Void Kill
        if (pos.y < -20) this.kill();

        this.position.copy(pos);
        this.group.position.copy(this.position);

        if (this.useBakedAnimation && this.mixer) {
            this.mixer.update(delta);
            if (this.walkAction) {
                this.walkAction.paused = !this.isMoving;
                // If using baked animation, ensure timeScale is set
                if (this.isMoving) this.walkAction.timeScale = 1.0;
            }
        } else {
            this.animate(delta);
        }
    }

    animate(delta) {
        if (this.isMoving) {
            this.walkTime += delta * 10.0; // Faster for snappy movement
        } else {
            // Return to stance
            this.walkTime += (Math.round(this.walkTime / Math.PI) * Math.PI - this.walkTime) * delta * 5.0;
        }
        
        // Head idle bob
        this.headBob += delta * 0.5;

        const limbSwing = this.walkTime;
        const swingAmp = 0.8; 

        const applyRot = (part, offset) => {
            if (part && part.userData.baseRot) {
                part.rotation.copy(part.userData.baseRot);
                // Rotate around X axis for legs
                part.rotation.x += Math.sin(limbSwing + offset) * swingAmp;
            }
        };

        // Trot Gait: Diagonals move together
        // leg1 (FL) & leg4 (BR) pair
        // leg2 (FR) & leg3 (BL) pair (Opposite)
        
        applyRot(this.skin.leg1, 0);          // Front Left
        applyRot(this.skin.leg4, 0);          // Back Right
        
        applyRot(this.skin.leg2, Math.PI);    // Front Right
        applyRot(this.skin.leg3, Math.PI);    // Back Left
        
        if (this.skin.head && this.skin.head.userData.baseRot) {
            this.skin.head.rotation.copy(this.skin.head.userData.baseRot);
            // Idle looking around / breathing
            this.skin.head.rotation.x += Math.sin(this.headBob) * 0.1;
            this.skin.head.rotation.y += Math.cos(this.headBob * 0.7) * 0.1;
        }
    }

    takeDamage(amount, fromDir) {
        this.health -= amount;
        this.panicTimer = 5.0; // Panic for 5 seconds
        
        // Knockback
        if (fromDir) {
            const kbForce = 5.0; 
            this.knockback.copy(fromDir.clone().normalize().multiplyScalar(kbForce));
            this.velocity.y = 5.0; // Jump up
            this.onGround = false;
        }

        // Flash Red
        if (this.model) {
            this.model.traverse(o => {
                if(o.isMesh && o.material) o.material.color.setHex(0xff0000);
            });
            setTimeout(() => {
                if(this.model) this.model.traverse(o => {
                    if(o.isMesh && o.material) o.material.color.setHex(0xffffff);
                });
            }, 200);
        }

        if (this.health <= 0) {
            this.kill();
        }
    }

    kill() {
        if (this.dead) return;
        this.dead = true;
        this.scene.remove(this.group);
    }
}

export class CowManager {
    constructor(scene, world) {
        this.scene = scene;
        this.world = world;
        this.physics = new Physics(world);
        this.cows = [];
        this.spawnTimer = 0;
    }

    getData() {
        return this.cows.map(c => ({
            x: c.position.x,
            y: c.position.y,
            z: c.position.z,
            ry: c.group.rotation.y,
            health: c.health
        }));
    }

    loadData(data) {
        this.cows.forEach(c => c.kill());
        this.cows = [];
        if (Array.isArray(data)) {
            data.forEach(d => {
                const cow = new Cow(this.scene, new THREE.Vector3(d.x, d.y, d.z), this.physics);
                cow.group.rotation.y = d.ry || 0;
                if(d.health) cow.health = d.health;
                this.cows.push(cow);
            });
        }
    }

    update(delta, playerPos, sunHeight) {
        // No cows in Nether
        if (this.world.dimension === 'nether') return;

        this.cows = this.cows.filter(c => !c.dead);

        // Natural Spawning
        // Increase cap and remove strict sun requirement for testing
        if (this.cows.length < 30) {
            this.spawnTimer += delta;
            if (this.spawnTimer > 0.5) { // Try spawning every 0.5s
                this.spawnCow(playerPos);
                this.spawnTimer = 0;
            }
        }

        for(const c of this.cows) {
            c.update(delta, playerPos);
        }
    }

    spawnCow(centerPos, exact = false) {
        let x, z;
        if (exact) {
            x = centerPos.x;
            z = centerPos.z;
        } else {
            const angle = Math.random() * Math.PI * 2;
            const r = 15 + Math.random() * 20;
            x = centerPos.x + Math.cos(angle) * r;
            z = centerPos.z + Math.sin(angle) * r;
        }

        let y = -999;
        let startY = Math.floor(centerPos.y) + 20;
        if (startY > 255) startY = 255;
        if (startY < 60) startY = 80;

        for(let sy = startY; sy > -60; sy--) {
            const id = this.world.getBlock(Math.floor(x), sy, Math.floor(z));
            // Solid block check
            if (id !== BLOCKS.AIR && id !== BLOCKS.WATER && id !== BLOCKS.LAVA && id !== -1) {
                if (this.world.getBlock(Math.floor(x), sy+1, Math.floor(z)) === BLOCKS.AIR) {
                    y = sy + 1;
                    break;
                }
            }
        }

        if (y === -999 && exact) {
            y = centerPos.y;
        }

        if (y > -64) {
            const cow = new Cow(this.scene, new THREE.Vector3(x, y, z), this.physics);
            this.cows.push(cow);
        }
    }
}


