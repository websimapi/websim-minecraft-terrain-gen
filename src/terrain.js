import { createNoise2D, createNoise3D } from 'simplex-noise';
import { BiomeManager } from './terrain/biomes.js';
import { CaveGenerator } from './terrain/caves.js';

export class TerrainGenerator {
    constructor(seed = Math.random()) {
        this.seed = typeof seed === 'number' ? seed : this.stringToSeed(seed.toString());
        
        this.noises = {
            continentalness: createNoise2D(this.pseudoRandom(this.seed + 'cont')),
            erosion: createNoise2D(this.pseudoRandom(this.seed + 'ero')),
            weirdness: createNoise2D(this.pseudoRandom(this.seed + 'weird')),
            temp: createNoise2D(this.pseudoRandom(this.seed + 'temp')),
            humid: createNoise2D(this.pseudoRandom(this.seed + 'humid')),
            rivers: createNoise2D(this.pseudoRandom(this.seed + 'rivers')),
            ore: createNoise3D(this.pseudoRandom(this.seed + 'ores')),
            density: createNoise3D(this.pseudoRandom(this.seed + 'density'))
        };

        this.seaLevel = 62;
        this.scale = 0.0015; // Decreased scale for larger biomes (was 0.004)
        
        this.type = 'default'; // 'default', 'superflat', 'skyblock'

        this.biomeManager = new BiomeManager(this.noises, this.scale);
        this.caveGenerator = new CaveGenerator(this.seed);
    }

    setType(type) {
        this.type = type;
        if (type === 'superflat') this.seaLevel = 4;
        else if (type === 'skyblock') this.seaLevel = 0;
        else this.seaLevel = 62;
    }

    stringToSeed(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash);
    }

    pseudoRandom(input) {
        let h = 0xdeadbeef;
        const str = input.toString();
        for(let i = 0; i < str.length; i++)
            h = Math.imul(h ^ str.charCodeAt(i), 2654435761);
        return function() {
            h = Math.imul(h ^ (h >>> 16), 2246822507);
            h = Math.imul(h ^ (h >>> 13), 3266489909);
            return (h >>> 0) / 4294967296;
        }
    }

    lerp(a, b, t) {
        return a + (b - a) * t;
    }

    getBiomeData(x, z) {
        return this.biomeManager.getBiomeData(x, z);
    }

    getTreeDensity(data) {
        return this.biomeManager.getTreeDensity(data);
    }

    getHeight(x, z, data) {
        if (this.type === 'superflat') return 4; // Flat height
        if (this.type === 'skyblock') return 0;

        if (!data) data = this.getBiomeData(x, z);
        const { cont, erosion, weirdness, riverNoise } = data;

        let baseHeight = 64;
        
        if (cont < -0.4) {
            baseHeight = 45;
        } else if (cont < -0.1) {
            baseHeight = 58;
        } else if (cont < 0.1) {
            baseHeight = 64;
        } else {
            const t = (cont - 0.1) / 0.9;
            
            if (t < 0.35) {
                baseHeight = 66 + (t * 15);
            } else if (t < 0.65) {
                baseHeight = 78 + ((t - 0.35) * 40);
            } else {
                const mt = (t - 0.65) / 0.35;
                baseHeight = 95 + (mt * mt * 55);
            }
            
            if (Math.abs(weirdness) > 0.65) {
                baseHeight += (weirdness > 0 ? 12 : -8);
            }
        }

        const detail = erosion * 10;
        let finalY = baseHeight + detail;
        
        const riverThreshold = 0.10;
        if (cont > -0.2 && riverNoise < riverThreshold) {
             const t = riverNoise / riverThreshold;
             const smooth = t * t * (3 - 2 * t);
             const riverBed = this.seaLevel - 3;
             finalY = this.lerp(riverBed, finalY, smooth);
        }

        if(finalY < 2) finalY = 2;

        return Math.floor(finalY);
    }

    carveCaves(chunk) {
        if (this.type === 'superflat' || this.type === 'skyblock') return; 
        this.caveGenerator.carveCaves(chunk);
    }

    getStoneType(x, y, z) {
        if (this.type === 'superflat' || this.type === 'skyblock') return 'stone';
        // Use 3D noise for large stone variant patches (Granite, Diorite, Andesite)
        // Offset coordinates slightly to decorate distinct from ores/caves
        const scale = 0.04; 
        const n = this.noises.ore(x * scale + 100, y * scale, z * scale + 100);
        
        // Non-overlapping thresholds
        if (n > 0.65) return 'granite';
        if (n < -0.65) return 'diorite';
        if (n > 0.25 && n < 0.45) return 'andesite';
        
        // Dirt/Gravel patches (less frequent)
        const n2 = this.noises.ore(x * scale - 100, y * scale, z * scale - 100);
        if (n2 > 0.75) return 'dirt';
        if (n2 < -0.75) return 'gravel';

        return 'stone';
    }

    getOreType(x, y, z, stoneType, biomeData) {
        if (y < 4 || y > 128) return stoneType;

        const n = this.noises.ore(x * 0.08, y * 0.08, z * 0.08);
        const a = Math.abs(n);

        if (y > 72 && biomeData && biomeData.cont > 0.5 && a > 0.97) {
            return 'emerald_ore';
        }

        if (y <= 12 && a > 0.96) {
            return 'diamond_ore';
        }

        if (y <= 18 && a > 0.93) {
            return 'redstone_ore';
        }

        if (y <= 28 && a > 0.94) {
            return 'gold_ore';
        }

        if (y <= 28 && y >= 10 && a > 0.90 && a < 0.95) {
            return 'lapis_ore';
        }

        if (y <= 56 && a > 0.90) {
            return 'iron_ore';
        }

        if (y <= 96 && a > 0.88) {
            return 'coal_ore';
        }

        return stoneType;
    }

    getBlockType(y, data) {
        if (this.type === 'superflat') {
            if (y === 0) return 'bedrock';
            if (y < 4) return 'dirt';
            if (y === 4) return 'grass';
            return 'air';
        }
        if (this.type === 'skyblock') return 'air';
        return this.biomeManager.getBlockType(y, data);
    }

    getBiomeName(x, z, y) {
        return this.biomeManager.getBiomeName(x, z, y);
    }

    getNetherNoise(x, y, z) {
        // Use 3D noise to create cheese-like terrain
        // Scale for caves
        const s = 0.015; // Increased scale slightly for larger features
        // Using 'ore' noise (3D simplex)
        let density = this.noises.ore(x * s, y * s * 1.5, z * s); 
        
        // Bias density to make it more hollow (caves)
        // Simplex is roughly -1 to 1.
        // density > 0.1 means only areas with high noise value become solid.
        // Lowering the "solid" threshold would fill it up. Raising it makes it emptier.
        
        // Add vertical turbulence to make it look more organic/layered
        density += this.noises.density(x * 0.05, y * 0.02, z * 0.05) * 0.2;
        
        // Solid floor/ceiling bias
        if (y < 32) density += (32 - y) * 0.1; // Floor
        if (y > 96) density += (y - 96) * 0.1; // Ceiling
        
        return density;
    }
    
    getOverworldDensity(x, y, z) {
        if (this.type === 'superflat') {
            if (y === 0) return 1.0; // Bedrock
            if (y < 4) return 1.0;   // Dirt
            if (y === 4) return 1.0; // Grass
            return -1.0; // Air
        }
        if (this.type === 'skyblock') return -1.0;

        // HYBRID TERRAIN GENERATION (Modern Macro + Beta Detail)
        
        // 1. Scales - Beta-ish noise scale (Tighter for more hills)
        const scaleH = 0.005; 
        const scaleV = 0.008; 
        
        // 2. 3D Noise (The "Beta" Shape)
        // High amplitude, creates overhangs when bias is low
        let noise = this.noises.density(x * scaleH, y * scaleV, z * scaleH);
        
        // Add detail noise
        noise += this.noises.ore(x * scaleH * 2, y * scaleV * 2, z * scaleH * 2) * 0.4;

        // 3. Modern Parameters
        // Center height logic around y=80
        const heightFactor = (y - 80) / 64.0; 
        
        const cont = this.noises.continentalness(x * 0.001, z * 0.001); // Large scale landmass
        const erosion = this.noises.erosion(x * 0.002, z * 0.002); // Flatness
        const weird = this.noises.weirdness(x * 0.003, z * 0.003); // Structural variety
        
        // 4. Bias Calculation (The "Floor")
        let bias = 0;
        
        // CONTINENTALNESS: Defines base height
        if (cont < -0.4) bias = -1.0; // Ocean
        else if (cont < 0.0) bias = -0.2; // Coast/Beach
        else if (cont < 0.5) bias = 0.2; // Land
        else bias = 0.6; // Inland/Mountain
        
        // Height falloff
        bias -= heightFactor;

        // EROSION: Flattens terrain
        // High erosion = very flat (Modern plains)
        // Low erosion = chaotic (Beta hills)
        let noiseAmp = 1.0;
        
        if (erosion > 0.4) {
             // Flat
             noiseAmp = 0.3;
             bias -= Math.max(0, heightFactor * 1.0); // Push down high spots
        } else {
             // Hilly/Jagged
             noiseAmp = 1.1; // Reduced from 1.4 for less exaggeration
             // Beta hills allowed overhangs. We need the noise to overpower the bias.
             if (weird > 0.1) { // More frequent crazy hills
                 noiseAmp = 1.5; // Reduced from 2.2 to tame extreme overhangs
             }
        }
        
        // WEIRDNESS: Adds "Beta" anomalies
        if (Math.abs(weird) > 0.6) { // Lower threshold for weirdness
             // Floating islands / craziness
             bias += 0.4; 
             noiseAmp *= 1.2; // Reduced multiplier
        }

        let density = bias + (noise * noiseAmp);
        
        // Hard limits
        if (y < 4) density += 10.0;
        if (y > 310) density -= 10.0;

        return density;
    }
}