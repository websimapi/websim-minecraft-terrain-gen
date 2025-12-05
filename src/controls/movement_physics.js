import * as THREE from 'three';
import { BLOCKS } from '../blocks.js';

const _input = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _targetVel = new THREE.Vector3();
const _euler = new THREE.Euler();
const _pos = new THREE.Vector3();

export class MovementPhysics {
    constructor(world, physics) {
        this.world = world;
        this.physics = physics;
    }

    update(dt, controls) {
        // Prepare input vector
        _input.set(0, 0, 0);

        if (controls.isMobile && controls.touchMoveVector) {
            _input.z = controls.touchMoveVector.y;
            _input.x = controls.touchMoveVector.x;
        } else {
            _input.z = Number(controls.moveBackward) - Number(controls.moveForward);
            _input.x = Number(controls.moveRight) - Number(controls.moveLeft);
        }

        if (_input.lengthSq() > 0) _input.normalize();
        
        // Convert input to world direction relative to yaw
        const yaw = controls.viewAngles.yaw;
        const inputDir = _input.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);

        // Environment Checks
        const feetBlock = this.world.getBlock(Math.floor(controls.position.x), Math.floor(controls.position.y), Math.floor(controls.position.z));
        const inWater = (feetBlock === BLOCKS.WATER);
        const inLava = (feetBlock === BLOCKS.LAVA);

        if (controls.isFlying) {
             this.handleFlyingMovement(dt, controls, _input);
        } else if (inWater || inLava) {
            this.handleLiquidMovement(dt, controls, _input, inLava);
        } else {
            if (controls.onGround) {
                this.handleGroundMovement(dt, controls, inputDir);
            } else {
                this.handleAirMovement(dt, controls, inputDir);
            }
        }

        // Apply Velocity with Collisions
        this.applyVelocity(dt, controls, (inWater || inLava));

        // Update Fall Damage Tracking
        this.updateFallTracking(controls, (inWater || inLava));

        // Bobbing Logic update
        this.updateBobbing(dt, controls, _input, (inWater || inLava));
    }

    handleLiquidMovement(dt, controls, input, isLava) {
        const speed = isLava ? 2.0 : 4.0;
        const drag = isLava ? 0.5 : 0.8; // Viscosity (Velocity retention)
        
        // Calculate target velocity vector based on input
        // Input is raw X/Z. We need to rotate it to view.
        const viewDir = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(controls.viewAngles.pitch, controls.viewAngles.yaw, 0, 'YXZ'));
        const strafeDir = new THREE.Vector3(1, 0, 0).applyEuler(new THREE.Euler(0, controls.viewAngles.yaw, 0, 'YXZ'));
        
        const moveVec = new THREE.Vector3();
        // Forward/Back
        if (Math.abs(input.z) > 0) {
            moveVec.addScaledVector(viewDir, -input.z * speed);
        }
        // Strafe
        if (Math.abs(input.x) > 0) {
            moveVec.addScaledVector(strafeDir, input.x * speed);
        }

        if (controls.jump) {
            // Swim up
            moveVec.y += speed;
            // Surface boost
            const headY = Math.floor(controls.position.y + 0.1);
            const blockAbove = this.world.getBlock(Math.floor(controls.position.x), headY + 1, Math.floor(controls.position.z));
            if (controls.position.y % 1 > 0.6 && (blockAbove === 0 || blockAbove === undefined)) {
                moveVec.y += 2.0;
            }
        } else if (controls.sneak) {
            moveVec.y -= speed;
        } else if (Math.abs(input.z) < 0.1 && Math.abs(input.x) < 0.1) {
            moveVec.y -= 2.0; // Sink
        }

        // Apply
        const accel = 5.0 * dt;
        controls.velocity.lerp(moveVec, accel);
        
        // Drag
        controls.velocity.multiplyScalar(1.0 - (1.0 - drag) * dt * 5.0);
    }

    handleFlyingMovement(dt, controls, input) {
        const speed = controls.sprint ? 20.0 : 10.0;
        const drag = 5.0;

        const viewDir = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(controls.viewAngles.pitch, controls.viewAngles.yaw, 0, 'YXZ'));
        const strafeDir = new THREE.Vector3(1, 0, 0).applyEuler(new THREE.Euler(0, controls.viewAngles.yaw, 0, 'YXZ'));
        
        const targetVel = new THREE.Vector3();
        if (Math.abs(input.z) > 0) targetVel.addScaledVector(viewDir, -input.z * speed);
        if (Math.abs(input.x) > 0) targetVel.addScaledVector(strafeDir, input.x * speed);

        if (controls.jump) targetVel.y = speed;
        if (controls.sneak) targetVel.y = -speed;

        controls.velocity.lerp(targetVel, drag * dt);
    }

    handleGroundMovement(dt, controls, inputDir) {
        let moveSpeed = controls.speed;
        if (controls.sneak) moveSpeed = controls.sneakSpeed;
        else if (controls.sprint) moveSpeed = controls.runSpeed;

        if (inputDir.lengthSq() > 0) {
            // Accelerate
            const accel = 15.0 * dt;
            const targetX = inputDir.x * moveSpeed;
            const targetZ = inputDir.z * moveSpeed;
            
            controls.velocity.x = THREE.MathUtils.lerp(controls.velocity.x, targetX, accel);
            controls.velocity.z = THREE.MathUtils.lerp(controls.velocity.z, targetZ, accel);
        } else {
            // Decelerate (Friction)
            const friction = 10.0 * dt;
            controls.velocity.x = THREE.MathUtils.lerp(controls.velocity.x, 0, friction);
            controls.velocity.z = THREE.MathUtils.lerp(controls.velocity.z, 0, friction);
        }

        if (controls.jump) {
            controls.velocity.y = controls.jumpForce;
            controls.onGround = false;
        }
    }

    handleAirMovement(dt, controls, inputDir) {
        // Air Physics: Conservation of momentum + small control
        const airDrag = Math.pow(0.98, dt * 20); // Slight drag (0.98 per tick)
        controls.velocity.x *= airDrag;
        controls.velocity.z *= airDrag;
        controls.velocity.y -= controls.gravity * dt;

        if (inputDir.lengthSq() > 0) {
            const airAccel = 15.0 * dt; // Acceleration force
            const maxAirSpeed = controls.sprint ? controls.runSpeed : controls.speed;
            
            // Project current horizontal velocity onto input direction
            const currentSpeed = controls.velocity.x * inputDir.x + controls.velocity.z * inputDir.z;
            
            // Only add speed if we are below max, or if we are turning (velocity against input)
            // This prevents "b-hopping" accumulation beyond max run speed
            const addSpeed = Math.max(0, maxAirSpeed - currentSpeed);
            const accel = Math.min(addSpeed, airAccel);
            
            controls.velocity.x += inputDir.x * accel;
            controls.velocity.z += inputDir.z * accel;
        }
    }

    applyVelocity(dt, controls, inWater) {
        _pos.copy(controls.position);

        // Helper to check if player is supported by solid ground
        const isSupported = (pos) => {
            const r = controls.radius;
            // Check the block immediately below the feet position
            const feetY = Math.floor(pos.y - 0.1);
            
            // Check bounding box corners
            const corners = [
                {x: pos.x - r, z: pos.z - r},
                {x: pos.x + r, z: pos.z - r},
                {x: pos.x - r, z: pos.z + r},
                {x: pos.x + r, z: pos.z + r}
            ];

            for (const c of corners) {
                const bx = Math.floor(c.x);
                const bz = Math.floor(c.z);
                if (this.physics.isSolid(bx, feetY, bz)) return true;
            }
            return false;
        };

        // Step Assist / Auto Jump Logic
        // Try move X
        const originalX = _pos.x;
        _pos.x += controls.velocity.x * dt;
        let colX = this.physics.checkCollision(_pos, controls.radius, controls.playerHeight);
        
        // Auto Step X
        if (colX && controls.onGround && !controls.sneak && !controls.isFlying) {
            const stepHeight = 0.6; // Max step height
            const testPos = _pos.clone();
            testPos.y += stepHeight;
            // Check if we can move at new height
            if (!this.physics.checkCollision(testPos, controls.radius, controls.playerHeight)) {
                _pos.y += stepHeight;
                colX = false;
                // We successfully stepped up! Gravity will snap us down to the exact floor height next frame.
            }
        }

        // Sneak Edge Logic X
        if (!colX && controls.sneak && controls.onGround) {
            if (!isSupported(_pos)) {
                _pos.x = originalX;
                controls.velocity.x = 0;
                colX = true;
            }
        }

        if (colX) {
            _pos.x = originalX;
            controls.velocity.x = 0;
        }

        // Try move Z
        const originalZ = _pos.z;
        _pos.z += controls.velocity.z * dt;
        let colZ = this.physics.checkCollision(_pos, controls.radius, controls.playerHeight);

        // Auto Step Z
        if (colZ && controls.onGround && !controls.sneak && !controls.isFlying) {
            const stepHeight = 0.6; 
            const testPos = _pos.clone();
            testPos.y += stepHeight;
            if (!this.physics.checkCollision(testPos, controls.radius, controls.playerHeight)) {
                _pos.y += stepHeight;
                colZ = false;
            }
        }

        // Sneak Edge Logic Z
        if (!colZ && controls.sneak && controls.onGround) {
            if (!isSupported(_pos)) {
                _pos.z = originalZ;
                controls.velocity.z = 0;
                colZ = true;
            }
        }

        if (colZ) {
            _pos.z = originalZ;
            controls.velocity.z = 0;
        }

        controls.onGround = false;
        _pos.y += controls.velocity.y * dt;
        if (this.physics.checkCollision(_pos, controls.radius, controls.playerHeight)) {
            if (controls.velocity.y < 0) {
                controls.onGround = true;
                
                // Clutch Fix: Check for water at landing position to negate fall damage
                const feetX = Math.floor(_pos.x);
                const feetY = Math.floor(_pos.y);
                const feetZ = Math.floor(_pos.z);
                const b1 = this.world.getBlock(feetX, feetY, feetZ);
                const b2 = this.world.getBlock(feetX, feetY + 1, feetZ);
                const isWaterLanding = (b1 === BLOCKS.WATER || b2 === BLOCKS.WATER);

                if (!controls.wasOnGround && !inWater && !isWaterLanding) {
                    const fallDist = controls.fallStartY - _pos.y;
                    if (fallDist > 6.0) {
                        const dmg = Math.floor((fallDist - 6.0) * 0.5);
                        if (dmg > 0 && controls.takeDamage) controls.takeDamage(dmg);
                    }
                }
            }
            _pos.y -= controls.velocity.y * dt;
            controls.velocity.y = 0;
        }

        controls.position.copy(_pos);
    }

    updateFallTracking(controls, inWater) {
        if (controls.onGround || inWater) {
            controls.fallStartY = controls.position.y;
        } else if (controls.velocity.y > 0) {
            controls.fallStartY = controls.position.y;
        }
        controls.wasOnGround = controls.onGround;
    }

    updateBobbing(dt, controls, input, inWater) {
        const speed = controls.velocity.length();
        if (controls.onGround && speed > 0.5) {
            const freq = controls.sprint ? 15 : 10;
            controls.bobTimer += dt * freq;
        } else {
            controls.bobTimer *= Math.pow(0.5, dt * 10);
        }

        const targetHeight = controls.sneak ? controls.sneakEyeHeight : controls.defaultEyeHeight;
        controls.eyeHeight += (targetHeight - controls.eyeHeight) * 10 * dt;
    }
}