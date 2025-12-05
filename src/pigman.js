import * as THREE from 'three';
import * as Skinview3d from 'skinview3d';
import { Physics } from './physics.js';

export class Pigman {
    constructor(scene, position, physics) {
        this.scene = scene;
        this.position = position.clone();
        this.physics = physics;

        this.velocity = new THREE.Vector3(0, 0, 0);
        this.onGround = false;
        this.speed = 2.5;
        this.gravity = 30.0;
        this.jumpForce = 9.0; 

        this.group = new THREE.Group();
        this.group.position.copy(this.position);
        this.scene.add(this.group);

        this.model = null;
        this.viewer = new Skinview3d.SkinViewer({
            width: 300, height: 400, renderPaused: true
        });

        this.loadSkin().catch(console.error);

        this.width = 0.6;
        this.height = 1.8;
        this.dead = false;
        this.attackCooldown = 0;
        
        this.health = 20;
        this.walkTime = 0;
        this.knockback = new THREE.Vector3();
        
        // Neutral until provoked
        this.isAggressive = false;
        this.angerTimer = 0;
    }

    async loadSkin() {
        try {
            await this.viewer.loadSkin('./zombie-pigman.png');
            const obj = this.viewer.playerObject;
            if (!obj) return;

            const scale = 1.8 / 32.0;
            obj.scale.set(scale, scale, scale);
            obj.position.y = 16 * scale;
            obj.rotation.y = 0;

            obj.traverse(o => {
                if (o.isMesh) {
                    o.frustumCulled = false;
                    o.userData.pigmanParent = this; // Reference for raycasting
                    if (o.material) {
                        const old = o.material;
                        o.material = new THREE.MeshBasicMaterial({
                            map: old.map,
                            color: 0xffffff, 
                            side: old.side,
                            transparent: old.transparent,
                            alphaTest: old.alphaTest
                        });
                    }
                }
            });

            // Arms Forward (Zombie Pose) ? No, Pigmen usually hold swords normal or like zombies.
            // Let's stick to Zombie pose as per "basically the zombie"
            obj.skin.leftArm.rotation.x = -Math.PI / 2;
            obj.skin.rightArm.rotation.x = -Math.PI / 2;

            this.group.add(obj);
            this.model = obj;
        } catch(e) { console.error(e); }
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
                    if (o.material.color.getHex() === 0xff0000) return;
                    o.material.color.setScalar(val);
                }
            });
        }

        if (this.angerTimer > 0) {
            this.angerTimer -= delta;
            if (this.angerTimer <= 0) this.isAggressive = false;
        }

        const dist = this.position.distanceTo(playerPos);

        // Apply Knockback decay
        if (this.knockback.lengthSq() > 0.01) {
            this.knockback.multiplyScalar(0.9);
        } else {
            this.knockback.set(0,0,0);
        }

        // AI: Follow if Aggressive
        let moveSpeed = 0;
        
        if (this.isAggressive && dist < 40) {
            const dx = playerPos.x - this.position.x;
            const dz = playerPos.z - this.position.z;
            const angle = Math.atan2(dx, dz);

            // Smooth rotation
            const currentRot = this.group.rotation.y;
            let diff = angle - currentRot;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            this.group.rotation.y += diff * delta * 5;

            const forward = new THREE.Vector3(Math.sin(this.group.rotation.y), 0, Math.cos(this.group.rotation.y));
            
            if (this.knockback.lengthSq() < 2.0) {
                this.velocity.x = forward.x * this.speed * 1.5; // Faster when angry
                this.velocity.z = forward.z * this.speed * 1.5;
                moveSpeed = this.speed;
            } else {
                this.velocity.x *= 0.92;
                this.velocity.z *= 0.92;
            }

            // Jump
            if (this.velocity.lengthSq() > 0.1 && this.onGround && this.knockback.lengthSq() < 2.0) {
                const ahead = this.position.clone().addScaledVector(forward, 0.5);
                if (this.physics.checkCollision(ahead, 0.3, 0.5)) {
                    this.velocity.y = this.jumpForce;
                }
            }
        } else {
            // Idle wander
            this.velocity.x *= 0.8;
            this.velocity.z *= 0.8;
        }

        // Physics
        this.velocity.y -= this.gravity * delta;

        const dt = Math.min(delta, 0.1);
        const pos = this.position.clone();

        // Collision X
        pos.x += this.velocity.x * dt;
        if (this.physics.checkCollision(pos, 0.3, 1.8)) {
            pos.x -= this.velocity.x * dt;
            this.velocity.x = 0;
        }

        // Collision Z
        pos.z += this.velocity.z * dt;
        if (this.physics.checkCollision(pos, 0.3, 1.8)) {
            pos.z -= this.velocity.z * dt;
            this.velocity.z = 0;
        }

        // Collision Y
        this.onGround = false;
        pos.y += this.velocity.y * dt;
        if (this.physics.checkCollision(pos, 0.3, 1.8)) {
            if (this.velocity.y < 0) this.onGround = true;
            pos.y -= this.velocity.y * dt;
            this.velocity.y = 0;
        }

        this.position.copy(pos);
        this.group.position.copy(this.position);

        // Attack
        if (this.isAggressive && dist < 1.2) {
            if (this.attackCooldown <= 0) {
                window.dispatchEvent(new CustomEvent('player-damage', { detail: { amount: 5 } }));
                this.attackCooldown = 1.0;
            }
        }
        if (this.attackCooldown > 0) this.attackCooldown -= delta;

        if (this.position.y < -20) this.kill();

        this.animate(delta);
    }
    
    takeDamage(amount, fromDir) {
        this.health -= amount;
        this.isAggressive = true;
        this.angerTimer = 20.0; // 20 seconds of rage
        
        // Notify other pigmen nearby? (Simplification: Global aggro for debugging or just local)
        // For now just self.

        if (fromDir) {
            const kbForce = 8.0; 
            const impulse = fromDir.clone().normalize().multiplyScalar(kbForce);
            impulse.y = 6.0; 
            
            this.velocity.add(impulse);
            this.knockback.copy(impulse);
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

    animate(delta) {
        if (!this.model) return;
        const speed = Math.sqrt(this.velocity.x**2 + this.velocity.z**2);

        if (speed > 0.1) {
            this.walkTime += delta * speed * 3.0;
            this.model.skin.leftLeg.rotation.x = Math.sin(this.walkTime) * 0.8;
            this.model.skin.rightLeg.rotation.x = -Math.sin(this.walkTime) * 0.8;
            
            this.model.skin.leftArm.rotation.x = -Math.PI/2 + Math.sin(this.walkTime) * 0.8;
            this.model.skin.rightArm.rotation.x = -Math.PI/2 - Math.sin(this.walkTime) * 0.8;
        } else {
            this.model.skin.leftLeg.rotation.x = 0;
            this.model.skin.rightLeg.rotation.x = 0;
            const bob = Math.sin(Date.now()/250) * 0.1;
            this.model.skin.leftArm.rotation.x = -Math.PI/2 + bob;
            this.model.skin.rightArm.rotation.x = -Math.PI/2 - bob;
        }
    }

    kill() {
        if (this.dead) return;
        this.dead = true;
        this.scene.remove(this.group);
    }
}

export class PigmanManager {
    constructor(scene, world) {
        this.scene = scene;
        this.world = world;
        this.physics = new Physics(world);
        this.pigmen = [];
        this.spawnTimer = 0;
    }

    update(delta, playerPos) {
        // Only active in Nether
        if (this.world.dimension !== 'nether') {
            // Despawn all if not in Nether
            this.pigmen.forEach(p => p.kill());
            this.pigmen = [];
            return;
        }

        this.pigmen = this.pigmen.filter(p => !p.dead);

        if (this.pigmen.length < 20) {
            this.spawnTimer += delta;
            if (this.spawnTimer > 1.0) {
                this.spawnPigman(playerPos);
                this.spawnTimer = 0;
            }
        }

        for(const p of this.pigmen) {
            p.update(delta, playerPos);
        }
    }

    spawnPigman(playerPos) {
        const angle = Math.random() * Math.PI * 2;
        const r = 20 + Math.random() * 15;
        const x = playerPos.x + Math.cos(angle) * r;
        const z = playerPos.z + Math.sin(angle) * r;

        let y = 0;
        // Search for ground in Nether (could be layers)
        // Search around player Y first
        const startY = Math.floor(playerPos.y + 10);
        const endY = Math.max(0, Math.floor(playerPos.y - 20));
        
        for(let sy = startY; sy > endY; sy--) {
            const id = this.world.getBlock(Math.floor(x), sy, Math.floor(z));
            if (id !== 0 && id !== 38) { // Not Air, Not Lava
                if (this.world.getBlock(Math.floor(x), sy+1, Math.floor(z)) === 0 &&
                    this.world.getBlock(Math.floor(x), sy+2, Math.floor(z)) === 0) {
                    y = sy + 1;
                    break;
                }
            }
        }

        if (y > 0) {
            const pigman = new Pigman(this.scene, new THREE.Vector3(x, y, z), this.physics);
            this.pigmen.push(pigman);
        }
    }
}


