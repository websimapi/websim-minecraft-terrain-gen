import { BLOCKS, getStackLimit } from '../constants.js';

export class FurnaceManager {
    constructor() {
        this.recipes = [
            { input: BLOCKS.SAND, output: { id: BLOCKS.GLASS, count: 1 } },
            { input: BLOCKS.COBBLESTONE, output: { id: BLOCKS.STONE, count: 1 } },
            { input: BLOCKS.IRON_ORE, output: { id: BLOCKS.IRON_INGOT, count: 1 } },
            { input: BLOCKS.GOLD_ORE, output: { id: BLOCKS.GOLD_INGOT, count: 1 } },
            { input: BLOCKS.CLAY, output: { id: BLOCKS.TERRACOTTA, count: 1 } },
            { input: BLOCKS.LOG, output: { id: BLOCKS.COAL, count: 1 } },
            { input: BLOCKS.CACTUS, output: { id: BLOCKS.DANDELION, count: 1 } },
        ];

        this.fuels = {
            [BLOCKS.COAL]: 80.0,
            [BLOCKS.PLANKS]: 15.0,
            [BLOCKS.LOG]: 15.0,
            [BLOCKS.STICK]: 5.0,
            [BLOCKS.LAVA_BUCKET]: 1000.0,
            [BLOCKS.CRAFTING_TABLE]: 15.0,
            [BLOCKS.OAK_DOOR_ITEM]: 10.0,
            [BLOCKS.WOODEN_AXE]: 10.0, // Example
            [BLOCKS.WOODEN_PICKAXE]: 10.0,
        };

        this.isBurning = false;
        this.burnTime = 0;
        this.currentFuelMaxTime = 0;
        this.cookTime = 0;
        this.cookDuration = 10.0; // 10 seconds
    }

    getBurnProgress() {
        if (this.currentFuelMaxTime === 0) return 0;
        return this.burnTime / this.currentFuelMaxTime;
    }

    getCookProgress() {
        return this.cookTime / this.cookDuration;
    }

    tick(dt, slots, updateCallback) {
        // slots[0] = Input, slots[1] = Fuel, slots[2] = Output
        const inputItem = slots[0];
        const fuelItem = slots[1];
        const outputItem = slots[2];

        let dirty = false;
        let stateChanged = false;

        // 1. Handle Burning Fuel
        if (this.isBurning) {
            this.burnTime -= dt;
            if (this.burnTime <= 0) {
                this.burnTime = 0;
                this.isBurning = false;
                stateChanged = true;
            }
        }

        // 2. Check Recipe
        let recipe = null;
        if (inputItem) {
            recipe = this.recipes.find(r => r.input === inputItem.id);
        }

        // 3. Check if we can smelt
        let canSmelt = false;
        if (recipe) {
            // Check output slot space
            if (!outputItem) {
                canSmelt = true;
            } else if (outputItem.id === recipe.output.id) {
                const limit = getStackLimit(outputItem.id);
                if (outputItem.count + recipe.output.count <= limit) {
                    canSmelt = true;
                }
            }
        }

        // 4. Ignite if needed
        if (!this.isBurning && canSmelt && fuelItem) {
            const fuelValue = this.fuels[fuelItem.id];
            if (fuelValue > 0) {
                // Consume Fuel
                this.currentFuelMaxTime = fuelValue;
                this.burnTime = fuelValue;
                this.isBurning = true;
                stateChanged = true;

                if (fuelItem.id === BLOCKS.LAVA_BUCKET) {
                    slots[1] = { id: BLOCKS.BUCKET, count: 1 }; // Return bucket
                } else {
                    fuelItem.count--;
                    if (fuelItem.count <= 0) {
                        slots[1] = null;
                    }
                }
                dirty = true;
            }
        }

        // 5. Cook Progress
        if (this.isBurning && canSmelt) {
            this.cookTime += dt;
            if (this.cookTime >= this.cookDuration) {
                this.cookTime = 0;
                this.smeltItem(slots, recipe);
                dirty = true;
            }
        } else {
            // Cooldown / Regress
            if (this.cookTime > 0) {
                this.cookTime = Math.max(0, this.cookTime - dt * 2); // Cool down faster than cook
                // dirty = true; // Optional: only update UI on significant change?
            }
        }

        if (dirty || stateChanged) {
            if (updateCallback) updateCallback();
        }
    }

    smeltItem(slots, recipe) {
        const inputItem = slots[0];
        
        // Decrease Input
        inputItem.count--;
        if (inputItem.count <= 0) {
            slots[0] = null;
        }

        // Increase Output
        if (!slots[2]) {
            slots[2] = { id: recipe.output.id, count: recipe.output.count };
        } else {
            slots[2].count += recipe.output.count;
        }
    }
}