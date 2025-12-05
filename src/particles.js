import * as THREE from 'three';
import { getBlockTexture, BLOCKS } from './blocks.js';

export class ParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.particles = [];
        this.geometry = new THREE.PlaneGeometry(0.15, 0.15);
        this.densityMode = 0; // 0: All, 1: Decreased, 2: Minimal
    }

    setDensity(mode) {
        this.densityMode = mode;
    }

    spawnBlockParticles(pos, blockId) {
        if (this.densityMode === 2 && Math.random() > 0.5) return; // Minimal

        const texture = getBlockTexture(blockId, true);
        if (!texture) return; 

        let color = 0xffffff;
        if (blockId === BLOCKS.GRASS) color = 0x77bb77;

        let count = 8;
        if (this.densityMode === 1) count = 4;
        if (this.densityMode === 2) count = 2;

        for (let i = 0; i < count; i++) {
            // Updated to Basic Material for flat shading (no reflections)
            const material = new THREE.MeshBasicMaterial({
                map: texture,
                transparent: true,
                side: THREE.DoubleSide,
                depthWrite: false, 
                color: color
            });

            const particle = new THREE.Mesh(this.geometry.clone(), material);

            // Random UV crop
            const ru = Math.random() * 0.75;
            const rv = Math.random() * 0.75;
            const uvs = particle.geometry.attributes.uv;
            uvs.setXY(0, ru, rv + 0.25);
            uvs.setXY(1, ru + 0.25, rv + 0.25);
            uvs.setXY(2, ru, rv);
            uvs.setXY(3, ru + 0.25, rv);
            uvs.needsUpdate = true;

            particle.position.copy(pos);
            particle.position.x += (Math.random() - 0.5) * 0.8;
            particle.position.y += (Math.random() - 0.5) * 0.8;
            particle.position.z += (Math.random() - 0.5) * 0.8;

            particle.userData.velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 5,
                Math.random() * 3 + 1,
                (Math.random() - 0.5) * 5
            );
            particle.userData.life = 1.0 + Math.random(); 

            this.scene.add(particle);
            this.particles.push(particle);
        }
    }

    update(delta, camera) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.userData.life -= delta;

            if (p.userData.life <= 0) {
                this.scene.remove(p);
                p.geometry.dispose();
                p.material.dispose();
                this.particles.splice(i, 1);
                continue;
            }

            p.userData.velocity.y -= 20 * delta; // Gravity
            p.position.addScaledVector(p.userData.velocity, delta);
            p.lookAt(camera.position);
        }
    }
}