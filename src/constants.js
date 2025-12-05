// Block Type Constants
export const BLOCKS = {
    AIR: 0,
    GRASS: 1,
    PLANKS: 2,
    DIRT: 3,
    STONE: 4,
    SAND: 5,
    WATER: 6,
    SNOW: 7,
    TERRACOTTA: 8,
    BEDROCK: 9,
    LOG: 10,
    LEAVES: 11,
    GRAVEL: 12,
    CLAY: 13,
    SUGAR_CANE: 14,
    GRANITE: 15,
    DIORITE: 16,
    ANDESITE: 17,
    CRAFTING_TABLE: 18,
    COBBLESTONE: 19,
    CACTUS: 20,
    FURNACE: 21,
    DEAD_BUSH: 22,
    DANDELION: 23,
    PINK_TULIP: 24,
    LILY_OF_THE_VALLEY: 25,
    STICK: 26,
    COAL_ORE: 27,
    IRON_ORE: 28,
    GOLD_ORE: 29,
    REDSTONE_ORE: 30,
    LAPIS_ORE: 31,
    DIAMOND_ORE: 32,
    EMERALD_ORE: 33,
    NETHERRACK: 34,
    GLOWSTONE: 35,
    QUARTZ_ORE: 36,
    SOUL_SAND: 37,
    LAVA: 38,
    MAGMA: 39,
    // Items / Special Blocks
    FURNACE_ON: 40,
    OAK_DOOR_BOTTOM: 41,
    OAK_DOOR_TOP: 42,
    OBSIDIAN: 43,
    STRUCTURE_BLOCK: 44,
    GLASS: 45,
    FARMLAND: 46,
    FARMLAND_MOIST: 47,
    FIRE: 48,
    NETHER_PORTAL: 49,
    WHEAT: 50,
    // New Wood Types
    BIRCH_LOG: 51,
    BIRCH_LEAVES: 52,
    BIRCH_PLANKS: 53,
    SPRUCE_LOG: 54,
    SPRUCE_LEAVES: 55,
    SPRUCE_PLANKS: 56,
    JUNGLE_LOG: 57,
    JUNGLE_LEAVES: 58,
    JUNGLE_PLANKS: 59,
    ACACIA_LOG: 60,
    ACACIA_LEAVES: 61,
    ACACIA_PLANKS: 62,
    DARK_OAK_LOG: 63,
    DARK_OAK_LEAVES: 64,
    DARK_OAK_PLANKS: 65,
    // Foliage
    GRASS_PLANT: 66,
    TALL_GRASS_BOTTOM: 67,
    TALL_GRASS_TOP: 68,
    
    // Stripped Logs
    STRIPPED_OAK_LOG: 69,
    STRIPPED_BIRCH_LOG: 70,
    STRIPPED_SPRUCE_LOG: 71,
    STRIPPED_JUNGLE_LOG: 72,
    STRIPPED_ACACIA_LOG: 73,
    STRIPPED_DARK_OAK_LOG: 74,

    // New Doors
    SPRUCE_DOOR_BOTTOM: 75,
    SPRUCE_DOOR_TOP: 76,
    BIRCH_DOOR_BOTTOM: 77,
    BIRCH_DOOR_TOP: 78,
    JUNGLE_DOOR_BOTTOM: 79,
    JUNGLE_DOOR_TOP: 80,
    ACACIA_DOOR_BOTTOM: 81,
    ACACIA_DOOR_TOP: 82,
    DARK_OAK_DOOR_BOTTOM: 83,
    DARK_OAK_DOOR_TOP: 84,
    IRON_DOOR_BOTTOM: 85,
    IRON_DOOR_TOP: 86,
    
    QUARTZ_BLOCK: 87,
    GLASS_PANE: 88,
    PUMPKIN: 89,
    
    // Slabs & Stairs & Fences
    OAK_SLAB: 90,
    COBBLESTONE_SLAB: 91,
    OAK_STAIRS: 92,
    COBBLESTONE_STAIRS: 93,
    OAK_FENCE: 94,

    BUCKET: 100,
    WATER_BUCKET: 101,
    LAVA_BUCKET: 102,
    DIAMOND: 103,
    COAL: 104,
    IRON_INGOT: 105,
    GOLD_INGOT: 106,
    RAW_IRON: 107,
    RAW_GOLD: 108,
    OAK_DOOR_ITEM: 109,
    TORCH: 110,
    IRON_SHOVEL: 111,
    IRON_PICKAXE: 112,
    IRON_AXE: 113,
    IRON_SWORD: 114,
    IRON_HOE: 115,
    FLINT_AND_STEEL: 116,
    WHEAT_SEEDS: 117,
    WHEAT_ITEM: 118,
    
    SPRUCE_DOOR_ITEM: 119,
    BIRCH_DOOR_ITEM: 120,
    JUNGLE_DOOR_ITEM: 121,
    ACACIA_DOOR_ITEM: 122,
    DARK_OAK_DOOR_ITEM: 123,
    IRON_DOOR_ITEM: 124,

    // Diamond Tools
    DIAMOND_SHOVEL: 130,
    DIAMOND_PICKAXE: 131,
    DIAMOND_AXE: 132,
    DIAMOND_SWORD: 133,
    DIAMOND_HOE: 134,

    // Golden Tools
    GOLDEN_SHOVEL: 140,
    GOLDEN_PICKAXE: 141,
    GOLDEN_AXE: 142,
    GOLDEN_SWORD: 143,
    GOLDEN_HOE: 144,
    
    // New Items
    BONE_MEAL: 150,
    BREAD: 151,
    GOLDEN_CARROT: 152,
    PUMPKIN_PIE: 153,
    MILK_BUCKET: 154,
    BONE: 155,
    SADDLE: 156,
    
    // Saplings
    OAK_SAPLING: 160,
    SPRUCE_SAPLING: 161,
    BIRCH_SAPLING: 162,
    JUNGLE_SAPLING: 163,
    ACACIA_SAPLING: 164,
    DARK_OAK_SAPLING: 165
};

export function getMaxDurability(id) {
    if (id === BLOCKS.IRON_SHOVEL || id === BLOCKS.IRON_PICKAXE || id === BLOCKS.IRON_AXE || id === BLOCKS.IRON_SWORD || id === BLOCKS.IRON_HOE) return 250;
    if (id === BLOCKS.DIAMOND_SHOVEL || id === BLOCKS.DIAMOND_PICKAXE || id === BLOCKS.DIAMOND_AXE || id === BLOCKS.DIAMOND_SWORD || id === BLOCKS.DIAMOND_HOE) return 1561;
    if (id === BLOCKS.GOLDEN_SHOVEL || id === BLOCKS.GOLDEN_PICKAXE || id === BLOCKS.GOLDEN_AXE || id === BLOCKS.GOLDEN_SWORD || id === BLOCKS.GOLDEN_HOE) return 32;
    if (id === BLOCKS.FLINT_AND_STEEL) return 64;
    return 0;
}

// Stack Sizes
export function getStackLimit(id) {
    // Tools & Weapons (Unstackable)
    if (
        id === BLOCKS.IRON_SHOVEL ||
        id === BLOCKS.IRON_PICKAXE ||
        id === BLOCKS.IRON_AXE ||
        id === BLOCKS.IRON_SWORD ||
        id === BLOCKS.IRON_HOE ||
        id === BLOCKS.DIAMOND_SHOVEL || id === BLOCKS.DIAMOND_PICKAXE || id === BLOCKS.DIAMOND_AXE || id === BLOCKS.DIAMOND_SWORD || id === BLOCKS.DIAMOND_HOE ||
        id === BLOCKS.GOLDEN_SHOVEL || id === BLOCKS.GOLDEN_PICKAXE || id === BLOCKS.GOLDEN_AXE || id === BLOCKS.GOLDEN_SWORD || id === BLOCKS.GOLDEN_HOE ||
        id === BLOCKS.FLINT_AND_STEEL ||
        id === BLOCKS.BUCKET || 
        id === BLOCKS.WATER_BUCKET ||
        id === BLOCKS.LAVA_BUCKET ||
        id === BLOCKS.MILK_BUCKET ||
        id === BLOCKS.PUMPKIN_PIE // Normally stacks, but keeping simple
    ) {
        return 1;
    }
    
    // Special cases
    if (id === BLOCKS.BUCKET) return 16; 
    if (id === BLOCKS.SADDLE) return 1;
    if (id === BLOCKS.SNOW) return 16;
    if (id === BLOCKS.OAK_DOOR_ITEM || 
        id === BLOCKS.SPRUCE_DOOR_ITEM || 
        id === BLOCKS.BIRCH_DOOR_ITEM || 
        id === BLOCKS.JUNGLE_DOOR_ITEM || 
        id === BLOCKS.ACACIA_DOOR_ITEM || 
        id === BLOCKS.DARK_OAK_DOOR_ITEM || 
        id === BLOCKS.IRON_DOOR_ITEM) return 64;

    return 64;
}

// Block Face Definitions
export const BLOCK_FACES = {
    [BLOCKS.GRASS]: ['grass_side', 'grass_side', 'grass_top', 'dirt', 'grass_side', 'grass_side'],
    [BLOCKS.PLANKS]: 'oak_planks',
    [BLOCKS.DIRT]: 'dirt',
    [BLOCKS.STONE]: 'stone',
    [BLOCKS.SAND]: 'sand',
    [BLOCKS.WATER]: 'water',
    [BLOCKS.SNOW]: 'snow',
    [BLOCKS.TERRACOTTA]: 'terracotta',
    [BLOCKS.BEDROCK]: 'bedrock',
    [BLOCKS.LOG]: ['log_side', 'log_side', 'log_top', 'log_top', 'log_side', 'log_side'],
    [BLOCKS.LEAVES]: 'leaves',
    [BLOCKS.GRAVEL]: 'gravel',
    [BLOCKS.CLAY]: 'clay',
    [BLOCKS.SUGAR_CANE]: 'sugar_cane',
    [BLOCKS.GRANITE]: 'granite',
    [BLOCKS.DIORITE]: 'diorite',
    [BLOCKS.ANDESITE]: 'andesite',
    [BLOCKS.CRAFTING_TABLE]: ['crafting_table_side', 'crafting_table_side', 'crafting_table_top', 'oak_planks', 'crafting_table_front', 'crafting_table_side'],
    [BLOCKS.COBBLESTONE]: 'cobblestone',
    [BLOCKS.CACTUS]: ['cactus_side', 'cactus_side', 'cactus_top', 'dirt', 'cactus_side', 'cactus_side'],
    [BLOCKS.FURNACE]: ['furnace_side', 'furnace_side', 'furnace_top', 'furnace_top', 'furnace_front', 'furnace_side'],
    [BLOCKS.OAK_DOOR_BOTTOM]: 'oak_door_bottom',
    [BLOCKS.OAK_DOOR_TOP]: 'oak_door_top',
    [BLOCKS.OAK_DOOR_ITEM]: 'oak_door_item',
    
    [BLOCKS.SPRUCE_DOOR_BOTTOM]: 'spruce_door_bottom',
    [BLOCKS.SPRUCE_DOOR_TOP]: 'spruce_door_top',
    [BLOCKS.SPRUCE_DOOR_ITEM]: 'spruce_door_item',
    
    [BLOCKS.BIRCH_DOOR_BOTTOM]: 'birch_door_bottom',
    [BLOCKS.BIRCH_DOOR_TOP]: 'birch_door_top',
    [BLOCKS.BIRCH_DOOR_ITEM]: 'birch_door_item',
    
    [BLOCKS.JUNGLE_DOOR_BOTTOM]: 'jungle_door_bottom',
    [BLOCKS.JUNGLE_DOOR_TOP]: 'jungle_door_top',
    [BLOCKS.JUNGLE_DOOR_ITEM]: 'jungle_door_item',
    
    [BLOCKS.ACACIA_DOOR_BOTTOM]: 'acacia_door_bottom',
    [BLOCKS.ACACIA_DOOR_TOP]: 'acacia_door_top',
    [BLOCKS.ACACIA_DOOR_ITEM]: 'acacia_door_item',
    
    [BLOCKS.DARK_OAK_DOOR_BOTTOM]: 'dark_oak_door_bottom',
    [BLOCKS.DARK_OAK_DOOR_TOP]: 'dark_oak_door_top',
    [BLOCKS.DARK_OAK_DOOR_ITEM]: 'dark_oak_door_item',
    
    [BLOCKS.IRON_DOOR_BOTTOM]: 'iron_door_bottom',
    [BLOCKS.IRON_DOOR_TOP]: 'iron_door_top',
    [BLOCKS.IRON_DOOR_ITEM]: 'iron_door_item',

    [BLOCKS.COBBLESTONE_SLAB]: 'cobblestone',
    [BLOCKS.COBBLESTONE_STAIRS]: 'cobblestone',
    [BLOCKS.OAK_FENCE]: 'oak_planks',
    [BLOCKS.OAK_SLAB]: 'oak_planks',
    [BLOCKS.OAK_STAIRS]: 'oak_planks',
    [BLOCKS.GLASS_PANE]: 'glass',

    [BLOCKS.OBSIDIAN]: 'obsidian',
    [BLOCKS.TORCH]: 'torch',
    [BLOCKS.IRON_SHOVEL]: 'iron_shovel',
    [BLOCKS.IRON_PICKAXE]: 'iron_pickaxe',
    [BLOCKS.IRON_AXE]: 'iron_axe',
    [BLOCKS.IRON_SWORD]: 'iron_sword',
    [BLOCKS.IRON_HOE]: 'iron_hoe',
    [BLOCKS.DIAMOND_SHOVEL]: 'diamond_shovel',
    [BLOCKS.DIAMOND_PICKAXE]: 'diamond_pickaxe',
    [BLOCKS.DIAMOND_AXE]: 'diamond_axe',
    [BLOCKS.DIAMOND_SWORD]: 'diamond_sword',
    [BLOCKS.DIAMOND_HOE]: 'diamond_hoe',

    [BLOCKS.GOLDEN_SHOVEL]: 'golden_shovel',
    [BLOCKS.GOLDEN_PICKAXE]: 'golden_pickaxe',
    [BLOCKS.GOLDEN_AXE]: 'golden_axe',
    [BLOCKS.GOLDEN_SWORD]: 'golden_sword',
    [BLOCKS.GOLDEN_HOE]: 'golden_hoe',

    [BLOCKS.FARMLAND]: ['dirt', 'dirt', 'farmland_dry', 'dirt', 'dirt', 'dirt'],
    [BLOCKS.FARMLAND_MOIST]: ['dirt', 'dirt', 'farmland_wet', 'dirt', 'dirt', 'dirt'],
    [BLOCKS.FIRE]: 'fire',
    [BLOCKS.DEAD_BUSH]: 'dead_bush',
    [BLOCKS.DANDELION]: 'dandelion',
    // New Definitions
    [BLOCKS.GRASS_PLANT]: 'grass_plant',
    [BLOCKS.TALL_GRASS_BOTTOM]: 'tall_grass_bottom',
    [BLOCKS.TALL_GRASS_TOP]: 'tall_grass_top',
    
    [BLOCKS.BIRCH_LOG]: ['birch_log', 'birch_log', 'birch_log_top', 'birch_log_top', 'birch_log', 'birch_log'],
    [BLOCKS.BIRCH_PLANKS]: 'birch_planks',
    [BLOCKS.BIRCH_LEAVES]: 'birch_leaves',
    
    [BLOCKS.SPRUCE_LOG]: ['spruce_log', 'spruce_log', 'spruce_log_top', 'spruce_log_top', 'spruce_log', 'spruce_log'],
    [BLOCKS.SPRUCE_PLANKS]: 'spruce_planks',
    [BLOCKS.SPRUCE_LEAVES]: 'spruce_leaves',
    
    [BLOCKS.JUNGLE_LOG]: ['jungle_log', 'jungle_log', 'jungle_log_top', 'jungle_log_top', 'jungle_log', 'jungle_log'],
    [BLOCKS.JUNGLE_PLANKS]: 'jungle_planks',
    [BLOCKS.JUNGLE_LEAVES]: 'jungle_leaves',
    
    [BLOCKS.ACACIA_LOG]: ['acacia_log', 'acacia_log', 'acacia_log_top', 'acacia_log_top', 'acacia_log', 'acacia_log'],
    [BLOCKS.ACACIA_PLANKS]: 'acacia_planks',
    [BLOCKS.ACACIA_LEAVES]: 'acacia_leaves',
    
    [BLOCKS.DARK_OAK_LOG]: ['dark_oak_log', 'dark_oak_log', 'dark_oak_log_top', 'dark_oak_log_top', 'dark_oak_log', 'dark_oak_log'],
    [BLOCKS.DARK_OAK_PLANKS]: 'dark_oak_planks',
    [BLOCKS.DARK_OAK_LEAVES]: 'dark_oak_leaves',

    // Stripped Logs Faces
    [BLOCKS.STRIPPED_OAK_LOG]: ['stripped_oak_log', 'stripped_oak_log', 'stripped_oak_log_top', 'stripped_oak_log_top', 'stripped_oak_log', 'stripped_oak_log'],
    [BLOCKS.STRIPPED_BIRCH_LOG]: ['stripped_birch_log', 'stripped_birch_log', 'stripped_birch_log_top', 'stripped_birch_log_top', 'stripped_birch_log', 'stripped_birch_log'],
    [BLOCKS.STRIPPED_SPRUCE_LOG]: ['stripped_spruce_log', 'stripped_spruce_log', 'stripped_spruce_log_top', 'stripped_spruce_log_top', 'stripped_spruce_log', 'stripped_spruce_log'],
    [BLOCKS.STRIPPED_JUNGLE_LOG]: ['stripped_jungle_log', 'stripped_jungle_log', 'stripped_jungle_log_top', 'stripped_jungle_log_top', 'stripped_jungle_log', 'stripped_jungle_log'],
    [BLOCKS.STRIPPED_ACACIA_LOG]: ['stripped_acacia_log', 'stripped_acacia_log', 'stripped_acacia_log_top', 'stripped_acacia_log_top', 'stripped_acacia_log', 'stripped_acacia_log'],
    [BLOCKS.STRIPPED_DARK_OAK_LOG]: ['stripped_dark_oak_log', 'stripped_dark_oak_log', 'stripped_dark_oak_log_top', 'stripped_dark_oak_log_top', 'stripped_dark_oak_log', 'stripped_dark_oak_log'],

    [BLOCKS.PINK_TULIP]: 'pink_tulip',
    [BLOCKS.LILY_OF_THE_VALLEY]: 'lily_of_the_valley',
    [BLOCKS.STICK]: 'stick',
    [BLOCKS.COAL_ORE]: 'coal_ore',
    [BLOCKS.IRON_ORE]: 'iron_ore',
    [BLOCKS.GOLD_ORE]: 'gold_ore',
    [BLOCKS.REDSTONE_ORE]: 'redstone_ore',
    [BLOCKS.LAPIS_ORE]: 'lapis_ore',
    [BLOCKS.DIAMOND_ORE]: 'diamond_ore',
    [BLOCKS.EMERALD_ORE]: 'emerald_ore',
    [BLOCKS.NETHERRACK]: 'netherrack',
    [BLOCKS.GLOWSTONE]: 'glowstone',
    [BLOCKS.QUARTZ_ORE]: 'quartz_ore',
    [BLOCKS.SOUL_SAND]: 'soul_sand',
    [BLOCKS.LAVA]: 'lava',
    [BLOCKS.MAGMA]: 'magma',
    [BLOCKS.STRUCTURE_BLOCK]: 'structure_block',
    [BLOCKS.GLASS]: 'glass',
    [BLOCKS.FURNACE_ON]: ['furnace_side', 'furnace_side', 'furnace_top', 'furnace_top', 'furnace_front_on', 'furnace_side'],
    [BLOCKS.BUCKET]: 'bucket',
    [BLOCKS.WATER_BUCKET]: 'water_bucket',
    [BLOCKS.LAVA_BUCKET]: 'lava_bucket',
    [BLOCKS.DIAMOND]: 'diamond',
    [BLOCKS.COAL]: 'coal',
    [BLOCKS.IRON_INGOT]: 'iron_ingot',
    [BLOCKS.GOLD_INGOT]: 'gold_ingot',
    [BLOCKS.OAK_DOOR_ITEM]: 'oak_door_item', 
    [BLOCKS.FLINT_AND_STEEL]: 'flint_and_steel',
    [BLOCKS.WHEAT_SEEDS]: 'wheat_seeds',
    [BLOCKS.WHEAT_ITEM]: 'wheat',
    [BLOCKS.PUMPKIN]: ['pumpkin_side', 'pumpkin_side', 'pumpkin_top', 'pumpkin_top', 'pumpkin_face', 'pumpkin_side'],
    [BLOCKS.QUARTZ_BLOCK]: ['quartz_block_side', 'quartz_block_side', 'quartz_block_top', 'quartz_block_bottom', 'quartz_block_side', 'quartz_block_side'],
    
    // New Item Faces
    [BLOCKS.BONE_MEAL]: 'bone_meal',
    [BLOCKS.BREAD]: 'bread',
    [BLOCKS.GOLDEN_CARROT]: 'golden_carrot',
    [BLOCKS.PUMPKIN_PIE]: 'pumpkin_pie',
    [BLOCKS.MILK_BUCKET]: 'milk_bucket',
    [BLOCKS.BONE]: 'bone',
    [BLOCKS.SADDLE]: 'saddle',

    // Saplings
    [BLOCKS.OAK_SAPLING]: 'oak_sapling',
    [BLOCKS.SPRUCE_SAPLING]: 'spruce_sapling',
    [BLOCKS.BIRCH_SAPLING]: 'birch_sapling',
    [BLOCKS.JUNGLE_SAPLING]: 'jungle_sapling',
    [BLOCKS.ACACIA_SAPLING]: 'acacia_sapling',
    [BLOCKS.DARK_OAK_SAPLING]: 'dark_oak_sapling'
};

// Cube Face Vertex Data
export const FACE_VERTS = [
    [1,0,1, 1,0,0, 1,1,0, 1,1,1], // Right +x
    [0,0,0, 0,0,1, 0,1,1, 0,1,0], // Left -x
    [0,1,1, 1,1,1, 1,1,0, 0,1,0], // Top +y
    [0,0,0, 1,0,0, 1,0,1, 0,0,1], // Bottom -y
    [0,0,1, 1,0,1, 1,1,1, 0,1,1], // Front +z
    [1,0,0, 0,0,0, 0,1,0, 1,1,0]  // Back -z
];

export function isFoliage(id) {
    return (id === BLOCKS.DEAD_BUSH || 
            id === BLOCKS.DANDELION || 
            id === BLOCKS.PINK_TULIP || 
            id === BLOCKS.LILY_OF_THE_VALLEY || 
            id === BLOCKS.SUGAR_CANE ||
            id === BLOCKS.GRASS_PLANT ||
            id === BLOCKS.TALL_GRASS_BOTTOM ||
            id === BLOCKS.TALL_GRASS_TOP ||
            id === BLOCKS.STICK ||
            id === BLOCKS.OAK_DOOR_ITEM ||
            id === BLOCKS.SPRUCE_DOOR_ITEM ||
            id === BLOCKS.BIRCH_DOOR_ITEM ||
            id === BLOCKS.JUNGLE_DOOR_ITEM ||
            id === BLOCKS.ACACIA_DOOR_ITEM ||
            id === BLOCKS.DARK_OAK_DOOR_ITEM ||
            id === BLOCKS.IRON_DOOR_ITEM ||
            id === BLOCKS.TORCH ||
            (id >= 130 && id <= 144) || // New Tools
            id === BLOCKS.OAK_DOOR_BOTTOM || 
            id === BLOCKS.OAK_DOOR_TOP ||
            id === BLOCKS.SPRUCE_DOOR_BOTTOM || id === BLOCKS.SPRUCE_DOOR_TOP ||
            id === BLOCKS.BIRCH_DOOR_BOTTOM || id === BLOCKS.BIRCH_DOOR_TOP ||
            id === BLOCKS.JUNGLE_DOOR_BOTTOM || id === BLOCKS.JUNGLE_DOOR_TOP ||
            id === BLOCKS.ACACIA_DOOR_BOTTOM || id === BLOCKS.ACACIA_DOOR_TOP ||
            id === BLOCKS.DARK_OAK_DOOR_BOTTOM || id === BLOCKS.DARK_OAK_DOOR_TOP ||
            id === BLOCKS.IRON_DOOR_BOTTOM || id === BLOCKS.IRON_DOOR_TOP ||
            id === BLOCKS.BUCKET ||
            id === BLOCKS.WATER_BUCKET ||
            id === BLOCKS.LAVA_BUCKET ||
            id === BLOCKS.FIRE ||
            id === BLOCKS.NETHER_PORTAL ||
            id === BLOCKS.WHEAT ||
            id === BLOCKS.WHEAT_SEEDS ||
            id >= 150 || // All new items (bone meal etc)
            id >= 100); // Items are sprites
}