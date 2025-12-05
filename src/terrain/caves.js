// Simple LCG RNG for deterministic worms
class LCG {
    constructor(seed) {
        this.m = 0x80000000;
        this.a = 1103515245;
        this.c = 12345;
        this.state = seed ? seed : Math.floor(Math.random() * (this.m - 1));
    }

    nextInt() {
        this.state = (this.a * this.state + this.c) % this.m;
        return this.state;
    }

    nextFloat() {
        return this.nextInt() / (this.m - 1);
    }
    
    range(min, max) {
        return min + this.nextFloat() * (max - min);
    }
}

export class CaveGenerator {
    constructor(seed) {
        this.seed = seed;
    }

    carveCaves(chunk) {
        const cx = chunk.cx;
        const cz = chunk.cz;
        const radius = 2;

        for (let ox = -radius; ox <= radius; ox++) {
            for (let oz = -radius; oz <= radius; oz++) {
                const neighborX = cx + ox;
                const neighborZ = cz + oz;
                
                const s1 = (neighborX * 3418731287127 + neighborZ * 132897987541) + this.seed;
                const rng = new LCG(s1 & 0xffffffff);
                
                const numWorms = rng.nextInt() % 4 === 0 ? 1 : 0;
                const extraWorms = rng.nextInt() % 16 === 0 ? 4 : 0;
                
                const total = numWorms + extraWorms;

                for (let i = 0; i < total; i++) {
                    const startX = neighborX * 16 + rng.range(0, 16);
                    const startZ = neighborZ * 16 + rng.range(0, 16);
                    // Increased height range significantly to allow surface breaches
                    const startY = rng.range(10, 70); 
                    
                    const headRot = rng.nextFloat() * Math.PI * 2;
                    // Allow steeper pitch to go up/down
                    const headPitch = (rng.nextFloat() - 0.5) * 2; 
                    const len = rng.range(80, 150);
                    const rad = rng.range(1.5, 4.0); // Slightly wider

                    this.generateWorm(chunk, startX, startY, startZ, headRot, headPitch, len, rad, rng);
                }
            }
        }
    }

    generateWorm(chunk, x, y, z, yaw, pitch, length, maxRadius, rng) {
        const minX = chunk.cx * 16;
        const maxX = minX + 16;
        const minZ = chunk.cz * 16;
        const maxZ = minZ + 16;
        
        let currX = x;
        let currY = y;
        let currZ = z;
        let currYaw = yaw;
        let currPitch = pitch;
        
        for (let i = 0; i < length; i++) {
            const speed = 1.0;
            currX += Math.cos(currPitch) * Math.sin(currYaw) * speed;
            currY += Math.sin(currPitch) * speed;
            currZ += Math.cos(currPitch) * Math.cos(currYaw) * speed;
            
            currYaw += (rng.nextFloat() - 0.5) * 0.2;
            currPitch += (rng.nextFloat() - 0.5) * 0.1;
            currPitch = Math.max(-1.5, Math.min(1.5, currPitch));
            
            const radius = maxRadius + Math.sin(i * 0.1) * 0.5;

            const sMinX = currX - radius;
            const sMaxX = currX + radius;
            const sMinZ = currZ - radius;
            const sMaxZ = currZ + radius;
            
            if (sMaxX < minX || sMinX > maxX || sMaxZ < minZ || sMinZ > maxZ) {
                continue;
            }

            const localX = currX - minX;
            const localZ = currZ - minZ;
            
            const startLX = Math.max(0, Math.floor(localX - radius));
            const endLX = Math.min(15, Math.floor(localX + radius));
            const startLZ = Math.max(0, Math.floor(localZ - radius));
            const endLZ = Math.min(15, Math.floor(localZ + radius));
            const startY = Math.max(1, Math.floor(currY - radius));
            const endY = Math.min(128, Math.floor(currY + radius));
            
            const rSq = radius * radius;

            for (let lx = startLX; lx <= endLX; lx++) {
                for (let lz = startLZ; lz <= endLZ; lz++) {
                    for (let ly = startY; ly <= endY; ly++) {
                        const dx = lx - localX;
                        const dz = lz - localZ;
                        const dy = ly - currY;
                        
                        if (dx*dx + dy*dy + dz*dz < rSq) {
                            const existing = chunk.getBlock(lx, ly, lz);
                            if (existing !== 0 && existing !== 6 && existing !== 9) {
                                chunk.setBlock(lx, ly, lz, 0, 0);
                            }
                        }
                    }
                }
            }
        }
    }
}