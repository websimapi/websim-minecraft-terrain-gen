import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Physics } from './physics.js';
import { BLOCKS } from './constants.js';
import { loadBlockTexture } from './rendering/block_materials.js';

const loader = new GLTFLoader();
const textureLoader = new THREE.TextureLoader();
const shadowTexture = textureLoader.load('./shadow.png');

export class Pig {
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
        const shadowGeo = new THREE.PlaneGeometry(1.2, 1.2);
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
        this.useBakedAnimation = true;

        this.loadModel();

        this.width = 0.9;
        this.height = 0.9; // Pigs are shorter
        this.dead = false;
        
        this.health = 10;
        this.walkTime = 0;
        this.headBob = 0;
        
        this.rider = null;
        this.saddled = false; // Explicitly false for new pigs

        // AI State
        this.moveTimer = 0;
        this.idleTimer = 0;
        this.targetDir = new THREE.Vector3();
        this.isMoving = false;
        this.knockback = new THREE.Vector3();
        this.panicTimer = 0;
    }

    loadModel() {
        const texture = textureLoader.load('./pig.png');
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.flipY = false;

        // Load Saddle Texture with transparency fix (black -> alpha)
        const saddleTexture = loadBlockTexture('./pig_saddle.png');
        saddleTexture.flipY = false;

        loader.load('./model.gltf', (gltf) => {
            const model = gltf.scene;
            this.model = model;
            
            // 1. Scale Model
            const boxRaw = new THREE.Box3().setFromObject(model);
            const sizeRaw = boxRaw.getSize(new THREE.Vector3());
            const scaleY = sizeRaw.y > 0 ? sizeRaw.y : 1;
            const targetHeight = 0.9;
            const scale = targetHeight / scaleY;
            model.scale.set(scale, scale, scale);
            
            model.rotation.y = Math.PI;

            // 2. Fix Visual Position
            model.updateMatrixWorld(true);
            const boxFinal = new THREE.Box3().setFromObject(model);
            model.position.y = -boxFinal.min.y;

            model.traverse(c => {
                if (!c.name) c.name = 'Part_' + c.uuid.substring(0,4);
                if (c.isMesh) {
                    c.frustumCulled = false;
                    c.userData.pigParent = this;
                    if (c.material) {
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

            if (this.animations.length > 0) {
                this.mixer = new THREE.AnimationMixer(model);
                const anim = this.animations.find(a => a.name.toLowerCase().includes('walk')) || this.animations[0];
                this.playAnimation(anim.name);
            } 
            
            const findNode = (namePart) => {
                let res = null;
                model.traverse(c => { 
                    if(!res && c.name.toLowerCase().includes(namePart)) res = c; 
                });
                return res;
            };

            this.skin.head = findNode('head');
            this.skin.body = findNode('body') || findNode('torso');
            this.skin.leg1 = findNode('leg0') || findNode('front_left') || findNode('leg.fl');
            this.skin.leg2 = findNode('leg1') || findNode('front_right') || findNode('leg.fr');
            this.skin.leg3 = findNode('leg2') || findNode('back_left') || findNode('leg.bl');
            this.skin.leg4 = findNode('leg3') || findNode('back_right') || findNode('leg.br');

            // Apply Saddle Overlay
            if (this.skin.body) {
                let bodyMesh = this.skin.body;
                // If the body node is a Group, try to find the mesh inside
                if (!bodyMesh.isMesh) {
                    bodyMesh.traverse(c => {
                        if (c.isMesh && !bodyMesh.isMesh) bodyMesh = c;
                    });
                }

                if (bodyMesh.isMesh) {
                    const saddleGeo = bodyMesh.geometry.clone();
                    const saddleMat = new THREE.MeshBasicMaterial({
                        map: saddleTexture,
                        transparent: true,
                        side: THREE.DoubleSide,
                        alphaTest: 0.1
                    });
                    const saddleMesh = new THREE.Mesh(saddleGeo, saddleMat);
                    saddleMesh.scale.set(1.05, 1.05, 1.05); // Inflate slightly
                    // Ensure it renders on top
                    saddleMesh.renderOrder = 1;
                    saddleMesh.visible = this.saddled; // Set initial visibility
                    bodyMesh.add(saddleMesh);
                    this.saddleMesh = saddleMesh;
                }
            }

            const saveBase = (part) => {
                if(part) {
                    part.userData.baseRot = part.rotation.clone();
                    part.userData.basePos = part.position.clone();
                }
            };
            Object.values(this.skin).forEach(saveBase);

            this.group.add(model);

        }, undefined, (err) => console.error("Error loading pig:", err));
    }

    setSaddled(isSaddled) {
        this.saddled = isSaddled;
        if (this.saddleMesh) {
            this.saddleMesh.visible = isSaddled;
        }
    }

    playAnimation(name) {
        if (!this.mixer) return;
        const clip = this.animations.find(c => c.name === name);
        if (clip) {
            if (this.walkAction) this.walkAction.stop();
            this.walkAction = this.mixer.clipAction(clip);
            this.walkAction.play();
            this.walkAction.paused = true;
        }
    }

    update(delta, playerPos, sunHeight, controls) {
        if (this.dead) return;

        const lx = Math.floor(this.position.x);
        const ly = Math.floor(this.position.y + 1);
        const lz = Math.floor(this.position.z);
        const wLight = this.physics.world.getLight(lx, ly, lz);
        const val = Math.max(0.2, wLight / 15.0);

        if (this.model) {
            this.model.traverse(o => {
                if(o.isMesh && o.material) {
                    if (o.material.color.getHex() === 0xff0000) return;
                    o.material.color.setScalar(val);
                }
            });
        }

        // Ridden Logic
        if (this.rider && controls) {
            this.moveTimer = 0.5; // Prevent AI idle
            this.panicTimer = 0;
            this.isMoving = false;

            const yaw = controls.getYaw();
            let forward = 0;
            if (controls.moveForward) forward += 1;
            if (controls.moveBackward) forward -= 1;

            if (forward !== 0) {
                this.isMoving = true;
                // Face player direction
                const rotSpeed = 10.0 * delta;
                // Shortest angle path
                let diff = yaw - this.group.rotation.y;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;
                this.group.rotation.y += diff * rotSpeed;

                const speed = this.speed * 2.0; // Fast pig
                const dir = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0,1,0), this.group.rotation.y);
                
                // Only move if actually facing roughly the right way
                if (Math.abs(diff) < 1.0) {
                    this.velocity.x = dir.x * speed * forward;
                    this.velocity.z = dir.z * speed * forward;
                }
            } else {
                this.velocity.x = 0;
                this.velocity.z = 0;
            }

            if (controls.jump && this.onGround) {
                this.velocity.y = this.jumpForce;
                this.onGround = false;
            }

            // Sync physics happens below
        } else if (this.knockback.lengthSq() > 0.01) {
            this.velocity.add(this.knockback.clone().multiplyScalar(delta * 10)); 
            this.knockback.multiplyScalar(0.9);
        }

        // Panic Logic (AI) - Only if not ridden
        if (!this.rider) {
            if (this.panicTimer > 0) {
                this.panicTimer -= delta;
                this.moveTimer = 0.5;
                this.isMoving = true;
                
                const dx = this.position.x - playerPos.x;
                const dz = this.position.z - playerPos.z;
                const dist = Math.sqrt(dx*dx + dz*dz);
                
                if (dist > 0.1) {
                    const jitter = (Math.random() - 0.5) * 0.5;
                    this.targetDir.set(dx/dist + jitter, 0, dz/dist + jitter).normalize();
                } else {
                    this.targetDir.set(Math.random()-0.5, 0, Math.random()-0.5).normalize();
                }
                
                this.velocity.x = this.targetDir.x * this.speed * 2.5; // Pigs run faster
                this.velocity.z = this.targetDir.z * this.speed * 2.5;
                
                const targetAngle = Math.atan2(this.targetDir.x, this.targetDir.z);
                let angleDiff = targetAngle - this.group.rotation.y;
                while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
                this.group.rotation.y += angleDiff * delta * 10.0;

                const lookAhead = this.position.clone().addScaledVector(this.targetDir, 0.6);
                if (this.physics.checkCollision(lookAhead, 0.4, 0.5)) {
                    if (this.onGround) this.velocity.y = this.jumpForce;
                }

            } else if (this.moveTimer > 0) {
                this.moveTimer -= delta;
                this.isMoving = true;
                
                this.velocity.x = this.targetDir.x * this.speed;
                this.velocity.z = this.targetDir.z * this.speed;
                
                const targetAngle = Math.atan2(this.targetDir.x, this.targetDir.z);
                let angleDiff = targetAngle - this.group.rotation.y;
                while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
                this.group.rotation.y += angleDiff * delta * 5.0;

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
                    if (Math.random() < 0.3) { 
                        this.idleTimer = 1 + Math.random() * 3;
                    } else {
                        this.moveTimer = 1 + Math.random() * 4;
                        const r = Math.random() * Math.PI * 2;
                        this.targetDir.set(Math.sin(r), 0, Math.cos(r));
                    }
                }
            }
        }

        this.velocity.y -= this.gravity * delta;
        const dt = Math.min(delta, 0.1);
        const pos = this.position.clone();

        pos.x += this.velocity.x * dt;
        if (this.physics.checkCollision(pos, 0.4, 0.9)) {
            pos.x -= this.velocity.x * dt;
            this.velocity.x = 0;
        }

        pos.z += this.velocity.z * dt;
        if (this.physics.checkCollision(pos, 0.4, 0.9)) {
            pos.z -= this.velocity.z * dt;
            this.velocity.z = 0;
        }

        this.onGround = false;
        pos.y += this.velocity.y * dt;
        if (this.physics.checkCollision(pos, 0.4, 0.9)) {
            if (this.velocity.y < 0) this.onGround = true;
            pos.y -= this.velocity.y * dt;
            this.velocity.y = 0;
        }

        if (pos.y < -20) this.kill();

        this.position.copy(pos);
        this.group.position.copy(this.position);

        if (this.useBakedAnimation && this.mixer) {
            this.mixer.update(delta);
            if (this.walkAction) {
                this.walkAction.paused = !this.isMoving;
                if (this.isMoving) this.walkAction.timeScale = 1.0;
            }
        } else {
            this.animate(delta);
        }
    }

    animate(delta) {
        if (this.isMoving) {
            this.walkTime += delta * 10.0;
        } else {
            this.walkTime += (Math.round(this.walkTime / Math.PI) * Math.PI - this.walkTime) * delta * 5.0;
        }
        
        this.headBob += delta * 0.5;
        const limbSwing = this.walkTime;
        const swingAmp = 0.8; 

        const applyRot = (part, offset) => {
            if (part && part.userData.baseRot) {
                part.rotation.copy(part.userData.baseRot);
                part.rotation.x += Math.sin(limbSwing + offset) * swingAmp;
            }
        };

        applyRot(this.skin.leg1, 0);          
        applyRot(this.skin.leg4, 0);          
        applyRot(this.skin.leg2, Math.PI);    
        applyRot(this.skin.leg3, Math.PI);    
        
        if (this.skin.head && this.skin.head.userData.baseRot) {
            this.skin.head.rotation.copy(this.skin.head.userData.baseRot);
            this.skin.head.rotation.x += Math.sin(this.headBob) * 0.1;
            this.skin.head.rotation.y += Math.cos(this.headBob * 0.7) * 0.1;
        }
    }

    takeDamage(amount, fromDir) {
        this.health -= amount;
        this.panicTimer = 4.0; // Panic for 4 seconds
        
        if (fromDir) {
            const kbForce = 5.0; 
            this.knockback.copy(fromDir.clone().normalize().multiplyScalar(kbForce));
            this.velocity.y = 5.0;
            this.onGround = false;
        }

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

export class PigManager {
    constructor(scene, world) {
        this.scene = scene;
        this.world = world;
        this.physics = new Physics(world);
        this.pigs = [];
        this.spawnTimer = 0;
    }

    getData() {
        return this.pigs.map(p => ({
            x: p.position.x,
            y: p.position.y,
            z: p.position.z,
            ry: p.group.rotation.y,
            saddled: p.saddled,
            health: p.health
        }));
    }

    loadData(data) {
        // Clear existing
        this.pigs.forEach(p => p.kill());
        this.pigs = [];
        
        if (Array.isArray(data)) {
            data.forEach(d => {
                const pig = new Pig(this.scene, new THREE.Vector3(d.x, d.y, d.z), this.physics);
                pig.group.rotation.y = d.ry || 0;
                pig.setSaddled(!!d.saddled);
                if (d.health) pig.health = d.health;
                this.pigs.push(pig);
            });
        }
    }

    update(delta, playerPos, sunHeight, controls) {
        if (this.world.dimension === 'nether') return;

        this.pigs = this.pigs.filter(c => !c.dead);

        if (this.pigs.length < 20) {
            this.spawnTimer += delta;
            if (this.spawnTimer > 1.0) { 
                this.spawnPig(playerPos);
                this.spawnTimer = 0;
            }
        }

        for(const c of this.pigs) {
            c.update(delta, playerPos, sunHeight, controls);
        }
    }

    spawnPig(centerPos, exact = false) {
        let x, z;
        if (exact) {
            x = centerPos.x;
            z = centerPos.z;
        } else {
            const angle = Math.random() * Math.PI * 2;
            const r = 10 + Math.random() * 15;
            x = centerPos.x + Math.cos(angle) * r;
            z = centerPos.z + Math.sin(angle) * r;
        }

        let y = -999;
        let startY = Math.floor(centerPos.y) + 10;
        if (startY > 255) startY = 255;
        if (startY < 60) startY = 80;

        for(let sy = startY; sy > -60; sy--) {
            const id = this.world.getBlock(Math.floor(x), sy, Math.floor(z));
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
            const pig = new Pig(this.scene, new THREE.Vector3(x, y, z), this.physics);
            this.pigs.push(pig);
            console.log(`Spawned pig at ${x.toFixed(1)}, ${y}, ${z.toFixed(1)}`);
        }
    }
}


