import * as THREE from 'three';
import * as Skinview3d from 'skinview3d';
import { Physics } from './physics.js';

export class Zombie {
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
    }

    async loadSkin() {
        try {
            await this.viewer.loadSkin('./zombie-skins.png');
            const obj = this.viewer.playerObject;
            if (!obj) return;

            const scale = 1.8 / 32.0;
            obj.scale.set(scale, scale, scale);
            obj.position.y = 16 * scale;
            obj.rotation.y = 0;

            obj.traverse(o => {
                if (o.isMesh) {
                    o.frustumCulled = false;
                    o.userData.zombieParent = this; // Reference for raycasting
                    // Tint green/darker
                    if (o.material) {
                        const old = o.material;
                        o.material = new THREE.MeshBasicMaterial({
                            map: old.map,
                            color: 0x88aa88, 
                            side: old.side,
                            transparent: old.transparent,
                            alphaTest: old.alphaTest
                        });
                    }
                }
            });

            // Arms Forward (Zombie Pose)
            obj.skin.leftArm.rotation.x = -Math.PI / 2;
            obj.skin.rightArm.rotation.x = -Math.PI / 2;

            this.group.add(obj);
            this.model = obj;
        } catch(e) { console.error(e); }
    }

    update(delta, playerPos, sunHeight) {
        if (this.dead) return;

        // Apply Lighting
        const lx = Math.floor(this.position.x);
        const ly = Math.floor(this.position.y + 1);
        const lz = Math.floor(this.position.z);
        const light = this.scene.userData.world ? this.scene.userData.world.getLight(lx, ly, lz) : 15;
        // Accessing world via global ref or passed in manager? 
        // Zombie doesn't have world ref directly in constructor, but ZombieManager does.
        // We need to pass world light to update.
        // But main.js calls update. Let's fix this by using a heuristic or passing it.
        // Better: Zombie has physics, which has world.
        const wLight = this.physics.world.getLight(lx, ly, lz);
        const val = Math.max(0.2, wLight / 15.0);
        
        if (this.model) {
            this.model.traverse(o => {
                if(o.isMesh && o.material) {
                    // Base color is tinted green in loadSkin (0x88aa88)
                    // We need to preserve that.
                    const base = new THREE.Color(0x88aa88);
                    // Flash red override
                    if (o.material.color.getHex() === 0xff0000) {
                        // Keep red
                    } else {
                        o.material.color.copy(base).multiplyScalar(val);
                    }
                }
            });
        }

        // Day burn logic: Sun is up
        if (sunHeight > 0.2) {
             this.takeDamage(100); // Burn to death
             return;
        }

        const dist = this.position.distanceTo(playerPos);

        // Apply Knockback decay (State tracking only)
        if (this.knockback.lengthSq() > 0.01) {
            this.knockback.multiplyScalar(0.9);
        } else {
            this.knockback.set(0,0,0);
        }

        // AI: Simple follow
        if (dist < 40) {
            const dx = playerPos.x - this.position.x;
            const dz = playerPos.z - this.position.z;
            const angle = Math.atan2(dx, dz);

            // Smooth rotation
            const currentRot = this.group.rotation.y;
            // Minimal angle diff
            let diff = angle - currentRot;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            this.group.rotation.y += diff * delta * 5;

            const forward = new THREE.Vector3(Math.sin(this.group.rotation.y), 0, Math.cos(this.group.rotation.y));
            
            // Only move if knockback is low to prevent fighting it
            if (this.knockback.lengthSq() < 2.0) {
                this.velocity.x = forward.x * this.speed;
                this.velocity.z = forward.z * this.speed;
            } else {
                // Apply friction to knockback velocity
                this.velocity.x *= 0.92;
                this.velocity.z *= 0.92;
            }

            // Jump if blocked
            if (this.velocity.lengthSq() > 0.1 && this.onGround && this.knockback.lengthSq() < 2.0) {
                // Check slightly ahead
                const ahead = this.position.clone().addScaledVector(forward, 0.5);
                if (this.physics.checkCollision(ahead, 0.3, 0.5)) { // Low obstacle
                    this.velocity.y = this.jumpForce;
                }
            }
        } else {
            this.velocity.x = 0;
            this.velocity.z = 0;
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
        if (dist < 1.2) {
            if (this.attackCooldown <= 0) {
                // Swing animation
                this.swing();
                window.dispatchEvent(new CustomEvent('player-damage', { detail: { amount: 3 } }));
                this.attackCooldown = 1.5;
            }
        }
        if (this.attackCooldown > 0) this.attackCooldown -= delta;

        // Void kill
        if (this.position.y < -20) this.kill();

        this.animate(delta);
    }
    
    takeDamage(amount, fromDir) {
        this.health -= amount;
        
        // Knockback
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
                    if(o.isMesh && o.material) o.material.color.setHex(0x88aa88);
                });
            }, 200);
        }

        if (this.health <= 0) {
            this.kill();
            // Dispatch kill event for score
            window.dispatchEvent(new CustomEvent('zombie-killed'));
        }
    }

    swing() {
        // trigger simple swing anim state if needed
    }

    animate(delta) {
        if (!this.model) return;
        const time = Date.now() / 1000;
        const speed = Math.sqrt(this.velocity.x**2 + this.velocity.z**2);

        if (speed > 0.1) {
            // Use accumulated walk time based on speed to prevent moonwalking
            this.walkTime += delta * speed * 3.0;
            this.model.skin.leftLeg.rotation.x = Math.sin(this.walkTime) * 0.8;
            this.model.skin.rightLeg.rotation.x = -Math.sin(this.walkTime) * 0.8;
            
            // Stiff Zombie Arms: Small bob instead of large swing
            this.model.skin.leftArm.rotation.x = -Math.PI/2 + Math.sin(this.walkTime) * 0.1;
            this.model.skin.rightArm.rotation.x = -Math.PI/2 - Math.sin(this.walkTime) * 0.1;
        } else {
            this.model.skin.leftLeg.rotation.x = 0;
            this.model.skin.rightLeg.rotation.x = 0;
            // Idle Arms
            const bob = Math.sin(time * 4) * 0.05;
            this.model.skin.leftArm.rotation.x = -Math.PI/2 + bob;
            this.model.skin.rightArm.rotation.x = -Math.PI/2 - bob;
        }
    }

    kill() {
        if (this.dead) return;
        this.dead = true;
        this.scene.remove(this.group);
        if(this.model) {
            // Clean up materials if we were strict, but GC handles it mostly
        }
    }
}

export class ZombieManager {
    constructor(scene, world) {
        this.scene = scene;
        this.world = world;
        this.physics = new Physics(world);
        this.zombies = [];
        this.spawnTimer = 0;
    }

    getData() {
        return this.zombies.map(z => ({
            x: z.position.x,
            y: z.position.y,
            z: z.position.z,
            ry: z.group.rotation.y,
            health: z.health
        }));
    }

    loadData(data) {
        this.zombies.forEach(z => z.kill());
        this.zombies = [];
        if (Array.isArray(data)) {
            data.forEach(d => {
                const zombie = new Zombie(this.scene, new THREE.Vector3(d.x, d.y, d.z), this.physics);
                zombie.group.rotation.y = d.ry || 0;
                if(d.health) zombie.health = d.health;
                this.zombies.push(zombie);
            });
        }
    }

    update(delta, playerPos, sunHeight) {
        // Filter dead
        this.zombies = this.zombies.filter(z => !z.dead);

        // Spawn Logic: Night time (sunHeight < 0)
        if (sunHeight < -0.2) {
            this.spawnTimer += delta;
            // Spawn every 3 seconds if count < 15
            if (this.spawnTimer > 3.0 && this.zombies.length < 15) {
                this.spawnZombie(playerPos);
                this.spawnTimer = 0;
            }
        }

        for(const z of this.zombies) {
            z.update(delta, playerPos, sunHeight);
        }
    }

    spawnZombie(playerPos) {
        // Spawn circle: 20-30 units away
        const angle = Math.random() * Math.PI * 2;
        const r = 20 + Math.random() * 10;
        const x = playerPos.x + Math.cos(angle) * r;
        const z = playerPos.z + Math.sin(angle) * r;

        // Find Surface
        let y = 0;
        for(let sy = 100; sy > 0; sy--) {
            if (this.world.getBlock(Math.floor(x), sy, Math.floor(z)) !== 0) {
                y = sy + 1;
                break;
            }
        }

        if (y > 0) {
            const zombie = new Zombie(this.scene, new THREE.Vector3(x, y, z), this.physics);
            this.zombies.push(zombie);
        }
    }
}