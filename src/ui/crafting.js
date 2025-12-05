import { BLOCKS } from '../constants.js';

// Crafting Recipes
export class CraftingManager {
    constructor() {
        this.recipes = this.initRecipes();
    }

    initRecipes() {
        // Helper lists
        const ALL_LOGS = [
            BLOCKS.LOG, BLOCKS.BIRCH_LOG, BLOCKS.SPRUCE_LOG, BLOCKS.JUNGLE_LOG, 
            BLOCKS.ACACIA_LOG, BLOCKS.DARK_OAK_LOG,
            BLOCKS.STRIPPED_OAK_LOG, BLOCKS.STRIPPED_BIRCH_LOG, BLOCKS.STRIPPED_SPRUCE_LOG, 
            BLOCKS.STRIPPED_JUNGLE_LOG, BLOCKS.STRIPPED_ACACIA_LOG, BLOCKS.STRIPPED_DARK_OAK_LOG
        ];
        
        const ALL_PLANKS = [
            BLOCKS.PLANKS, BLOCKS.BIRCH_PLANKS, BLOCKS.SPRUCE_PLANKS, 
            BLOCKS.JUNGLE_PLANKS, BLOCKS.ACACIA_PLANKS, BLOCKS.DARK_OAK_PLANKS
        ];

        return {
            // All recipes stored in a flat list, we'll matching dynamically
            'all': [
                // Planks from Logs (Specific mapping)
                { pattern: [[BLOCKS.LOG]], result: { id: BLOCKS.PLANKS, count: 4 } },
                { pattern: [[BLOCKS.BIRCH_LOG]], result: { id: BLOCKS.BIRCH_PLANKS, count: 4 } },
                { pattern: [[BLOCKS.SPRUCE_LOG]], result: { id: BLOCKS.SPRUCE_PLANKS, count: 4 } },
                { pattern: [[BLOCKS.JUNGLE_LOG]], result: { id: BLOCKS.JUNGLE_PLANKS, count: 4 } },
                { pattern: [[BLOCKS.ACACIA_LOG]], result: { id: BLOCKS.ACACIA_PLANKS, count: 4 } },
                { pattern: [[BLOCKS.DARK_OAK_LOG]], result: { id: BLOCKS.DARK_OAK_PLANKS, count: 4 } },
                
                // Sticks (Any Planks)
                {
                    pattern: [[ALL_PLANKS], [ALL_PLANKS]],
                    result: { id: BLOCKS.STICK, count: 4 }
                },
                // Crafting Table (Any Planks)
                {
                    pattern: [
                        [ALL_PLANKS, ALL_PLANKS],
                        [ALL_PLANKS, ALL_PLANKS]
                    ],
                    result: { id: BLOCKS.CRAFTING_TABLE, count: 1 }
                },
                {
                    pattern: [
                        [BLOCKS.COBBLESTONE, BLOCKS.COBBLESTONE, BLOCKS.COBBLESTONE],
                        [BLOCKS.COBBLESTONE, null, BLOCKS.COBBLESTONE],
                        [BLOCKS.COBBLESTONE, BLOCKS.COBBLESTONE, BLOCKS.COBBLESTONE]
                    ],
                    result: { id: BLOCKS.FURNACE, count: 1 }
                },
                {
                    pattern: [[BLOCKS.COAL], [BLOCKS.STICK]],
                    result: { id: BLOCKS.TORCH, count: 4 }
                },
                {
                    pattern: [[BLOCKS.STICK], [BLOCKS.COAL]], 
                    result: { id: BLOCKS.TORCH, count: 4 }
                },
                // Tools (Standard recipes using Sticks + Material)
                // IRON
                {
                    pattern: [
                        [BLOCKS.IRON_INGOT, BLOCKS.IRON_INGOT, BLOCKS.IRON_INGOT],
                        [null, BLOCKS.STICK, null],
                        [null, BLOCKS.STICK, null]
                    ],
                    result: { id: BLOCKS.IRON_PICKAXE, count: 1 }
                },
                {
                    pattern: [
                        [BLOCKS.IRON_INGOT, BLOCKS.IRON_INGOT],
                        [BLOCKS.IRON_INGOT, BLOCKS.STICK],
                        [null, BLOCKS.STICK]
                    ],
                    result: { id: BLOCKS.IRON_AXE, count: 1 }
                },
                {
                    pattern: [
                        [BLOCKS.IRON_INGOT, BLOCKS.IRON_INGOT, null],
                        [BLOCKS.IRON_INGOT, BLOCKS.STICK, null],
                        [null, BLOCKS.STICK, null]
                    ],
                    result: { id: BLOCKS.IRON_AXE, count: 1 }
                },
                {
                    pattern: [
                        [BLOCKS.IRON_INGOT],
                        [BLOCKS.STICK],
                        [BLOCKS.STICK]
                    ],
                    result: { id: BLOCKS.IRON_SHOVEL, count: 1 }
                },
                {
                    pattern: [
                        [null, BLOCKS.IRON_INGOT],
                        [null, BLOCKS.STICK],
                        [null, BLOCKS.STICK]
                    ],
                    result: { id: BLOCKS.IRON_SHOVEL, count: 1 }
                },
                {
                    pattern: [
                        [BLOCKS.IRON_INGOT],
                        [BLOCKS.IRON_INGOT],
                        [BLOCKS.STICK]
                    ],
                    result: { id: BLOCKS.IRON_SWORD, count: 1 }
                },
                {
                    pattern: [
                        [BLOCKS.IRON_INGOT, BLOCKS.IRON_INGOT],
                        [null, BLOCKS.STICK],
                        [null, BLOCKS.STICK]
                    ],
                    result: { id: BLOCKS.IRON_HOE, count: 1 }
                },
                // Doors (Any Planks -> Specific Door?)
                // Simplified: Any planks -> Oak Door for now, or match specific
                {
                    pattern: [
                        [BLOCKS.PLANKS, BLOCKS.PLANKS],
                        [BLOCKS.PLANKS, BLOCKS.PLANKS],
                        [BLOCKS.PLANKS, BLOCKS.PLANKS]
                    ],
                    result: { id: BLOCKS.OAK_DOOR_ITEM, count: 3 }
                },
                // Misc
                {
                    pattern: [
                        [ALL_PLANKS, ALL_PLANKS, ALL_PLANKS],
                        [ALL_PLANKS, null, ALL_PLANKS],
                        [ALL_PLANKS, ALL_PLANKS, ALL_PLANKS]
                    ],
                    result: { id: BLOCKS.CRAFTING_TABLE, count: 1 } // Chest fallback
                }
            ]
        };
    }

    matchRecipe(grid, gridSize) {
        // Extract bounds of items in grid
        let minX = 3, maxX = -1, minY = 3, maxY = -1;
        const size = gridSize === 4 ? 2 : 3;
        
        let hasItems = false;
        for(let i=0; i<gridSize; i++) {
            if (grid[i]) {
                const x = i % size;
                const y = Math.floor(i / size);
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
                hasItems = true;
            }
        }

        if (!hasItems) return null;

        // Extract input pattern
        const inputH = maxY - minY + 1;
        const inputW = maxX - minX + 1;

        // Check all recipes
        const recipes = this.recipes['all'];
        for (const recipe of recipes) {
            const rPattern = recipe.pattern;
            const rH = rPattern.length;
            const rW = rPattern[0].length;

            // Dimensions must match
            if (rH !== inputH || rW !== inputW) continue;

            // Check items
            let match = true;
            for (let py = 0; py < rH; py++) {
                for (let px = 0; px < rW; px++) {
                    const gridX = minX + px;
                    const gridY = minY + py;
                    const gridIdx = gridY * size + gridX;
                    
                    const item = grid[gridIdx];
                    const required = rPattern[py][px]; // Can be ID or Array of IDs

                    if (required === null) {
                        if (item !== null) { match = false; break; }
                    } else {
                        if (!item) { match = false; break; }
                        
                        // Check match (Single ID or Array inclusion)
                        if (Array.isArray(required)) {
                            if (!required.includes(item.id)) { match = false; break; }
                        } else {
                            if (item.id !== required) { match = false; break; }
                        }
                    }
                }
                if (!match) break;
            }

            if (match) return recipe.result;
        }

        return null;
    }
}