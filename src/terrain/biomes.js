export class BiomeManager {
    constructor(noises, scale) {
        this.noises = noises;
        this.scale = scale;
        this.seaLevel = 62;
    }

    getBiomeData(x, z) {
        const px = x * this.scale;
        const pz = z * this.scale;

        const cont = this.fbm(px, pz, this.noises.continentalness, 4, 0.5, 2);
        const erosion = this.fbm(px, pz, this.noises.erosion, 4, 0.5, 2);
        const weirdness = this.fbm(px, pz, this.noises.weirdness, 4, 0.5, 2);
        
        const pv = 1.0 - Math.abs(3.0 * Math.abs(weirdness) - 2.0);

        const temp = this.fbm(px, pz, this.noises.temp, 2);
        const humidity = this.fbm(px, pz, this.noises.humid, 2);
        
        const riverNoise = Math.abs(this.noises.rivers(px * 1.5, pz * 1.5));

        return { cont, erosion, pv, weirdness, temp, humidity, riverNoise };
    }

    fbm(x, z, noiseFunc, octaves = 4, persistence = 0.5, lacunarity = 2) {
        let total = 0;
        let frequency = 1;
        let amplitude = 1;
        let maxValue = 0;
        for(let i=0;i<octaves;i++){
            total += noiseFunc(x * frequency, z * frequency) * amplitude;
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= lacunarity;
        }
        return total / maxValue;
    }

    getTreeDensity(data) {
        const { cont, temp, humidity, erosion, riverNoise } = data;
        
        if (riverNoise < 0.06 && cont > 0.1) return 0;
        if (riverNoise < 0.12 && cont > 0.1) return 0.02;
        if (cont < 0.1) return 0;
        if (erosion > 0.6 && cont > 0.7) return 0;
        if (temp > 0.2 && humidity < -0.1) return 0;
        if (humidity > 0.3 && temp > 0.1) return 0.15;
        if (humidity > 0.0) return 0.08;
        if (humidity > -0.4 && temp > -0.2) return 0.008;
        if (temp < -0.2 && humidity > -0.3) return 0.04;
        if (temp > 0.2 && humidity < -0.4) return 0;
        
        return 0.002;
    }

    getBlockType(y, data) {
        const { cont, temp, humidity, erosion, riverNoise } = data;

        if (y < this.seaLevel - 5) return 'stone';
        
        // Ocean floor is gravel now
        if (cont < 0.05 && y < this.seaLevel - 2) return 'gravel';

        if (y < this.seaLevel) return 'sand';

        if (riverNoise < 0.085 && cont > 0.05) {
             if (y <= this.seaLevel + 1) {
                 if (humidity > 0.2) return 'clay';
                 if (erosion < -0.2) return 'gravel';
                 return 'sand';
             }
             if (temp > 0.3 && humidity < -0.1) return 'sand';
             return 'grass';
        }

        if (y <= this.seaLevel + 2 && cont < 0.08) return 'sand';

        if (y > 130) {
            if (temp > 0.5) return 'stone';
            return 'snow';
        }

        if (y > 100) {
            if (cont > 0.65) {
                if (erosion < -0.3 || (temp > 0.5 && humidity < -0.2)) return 'stone';
                if (temp < -0.2) return 'snow';
            } else {
                if (erosion < -0.5) return 'stone';
            }
        }

        if (temp > 0.2 && humidity < -0.1) return 'sand';
        if (temp > 0.6 && humidity < -0.6) return 'terracotta';
        if (humidity > 0.2 && temp > 0.1) return 'grass';

        return 'grass';
    }

    getTreeType(data) {
        const { temp, humidity } = data;
        // Simple decision tree for tree types
        if (temp < 0.2) return 'spruce'; // Cold -> Taiga
        if (humidity > 0.6 && temp > 0.6) return 'jungle'; // Hot & Wet
        if (humidity < 0.0 && temp > 0.7) return 'acacia'; // Hot & Dry
        if (humidity > 0.3 && temp > 0.2 && temp < 0.6) return 'dark_oak'; // Dark Forest conditions
        if (temp > 0.3 && temp < 0.7 && humidity > 0.1 && humidity < 0.4) return 'birch'; // Forest mix
        return 'oak'; // Default
    }

    getBiomeName(x, z, y) {
        const data = this.getBiomeData(x, z);
        if (!data) return "Unknown";
        if (data.cont < -0.5) return "Deep Ocean";
        if (data.cont < -0.1) return "Ocean";
        if (data.cont < 0.05) return "Beach";
        if (y > 130) {
            if (data.temp > 0.5) return "Stony Peaks";
            return "Snowy Peaks";
        }
        if (y > 100 && data.cont > 0.75) {
             if (data.erosion < -0.3) return "Jagged Slopes";
             return "Meadow";
        }
        if (data.temp > 0.2 && data.humidity < -0.1) return "Desert";
        if (data.temp > 0.6 && data.humidity < -0.6) return "Badlands";
        if (data.humidity > 0.5 && data.temp > 0) return "Jungle";
        if (data.temp < -0.2) return "Snowy Plains";
        if (data.humidity > 0.1) return "Forest";
        return "Plains";
    }
}

