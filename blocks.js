import * as THREE from 'three';
import { BLOCKS, BLOCK_FACES, FACE_VERTS, isFoliage } from './constants.js';
import { 
    registerAtlasTexture, 
    getAtlasUV, 
    getBlockImagePixels, 
    ATLAS_MAT_SOLID, 
    ATLAS_MAT_ALPHA_TEST, 
    ATLAS_MAT_TRANS,
    setTextureFiltering,
    atlasCanvas,
    atlasCtx
} from './rendering/texture_atlas.js';
import { 
    initBlockMats, 
    getBlockMeshMaterials, 
    BLOCK_MATS, 
    loadBlockTexture 
} from './rendering/block_materials.js';

export { BLOCKS, BLOCK_FACES, FACE_VERTS, isFoliage };
export { 
    getAtlasUV, 
    getBlockImagePixels, 
    ATLAS_MAT_SOLID, 
    ATLAS_MAT_ALPHA_TEST, 
    ATLAS_MAT_TRANS,
    getBlockMeshMaterials,
    setTextureFiltering
};

const iconCache = new Map();

export function clearIconCache() {
    iconCache.clear();
}

// Register textures (Delegated to texture_atlas)
registerAtlasTexture('grass_top', './grass_block_top.png');
registerAtlasTexture('grass_side', './grass_side_carried.png');
registerAtlasTexture('dirt', './dirt.png');
registerAtlasTexture('stone', './stone (1).png');
registerAtlasTexture('water', './water_flow.png');
registerAtlasTexture('sand', './sand (1).png');
registerAtlasTexture('log_side', './log_oak.png');
registerAtlasTexture('log_top', './log_oak_top.png');
registerAtlasTexture('leaves', './leaves.png');
registerAtlasTexture('gravel', './gravel.png');
registerAtlasTexture('clay', './dirt.png');
registerAtlasTexture('sugar_cane', './leaves_big_oak_opaque.png');
registerAtlasTexture('granite', './granite.png');
registerAtlasTexture('diorite', './diorite.png');
registerAtlasTexture('andesite', './andesite.png');
registerAtlasTexture('bedrock', './bedrock.png');
registerAtlasTexture('snow', './sand.png');
registerAtlasTexture('terracotta', './dirt.png');
registerAtlasTexture('oak_planks', './oak_planks.png');
registerAtlasTexture('crafting_table_top', './crafting_table_top.png');
registerAtlasTexture('crafting_table_side', './crafting_table_side.png');
registerAtlasTexture('crafting_table_front', './crafting_table_front.png');
registerAtlasTexture('furnace_front', './furnace_front.png');
registerAtlasTexture('furnace_side', './furnace_side.png');
registerAtlasTexture('furnace_top', './furnace_top.png');
registerAtlasTexture('cobblestone', './cobblestone.png');
registerAtlasTexture('cactus_side', './cactus_side.png');
registerAtlasTexture('cactus_top', './cactus_top.png');
registerAtlasTexture('dead_bush', './dead_bush.png');
registerAtlasTexture('dandelion', './dandelion.png');
registerAtlasTexture('pink_tulip', './pink_tulip.png');
registerAtlasTexture('lily_of_the_valley', './lily_of_the_valley.png');
registerAtlasTexture('coal_ore', './coal_ore.png');
registerAtlasTexture('iron_ore', './iron_ore.png');
registerAtlasTexture('gold_ore', './gold_ore.png');
registerAtlasTexture('redstone_ore', './redstone_ore.png');
registerAtlasTexture('lapis_ore', './lapis_ore.png');
registerAtlasTexture('diamond_ore', './diamond_ore.png');
registerAtlasTexture('emerald_ore', './emerald_ore.png');
registerAtlasTexture('stick', './stick.png');
registerAtlasTexture('netherrack', './netherrack.png');
registerAtlasTexture('obsidian', './obsidian.png'); // No tint needed for texture
registerAtlasTexture('glowstone', './stone (1).png', '#ffcc00');
registerAtlasTexture('quartz_ore', './stone_diorite.png', '#eec');
registerAtlasTexture('soul_sand', './soul_sand.png');
registerAtlasTexture('lava', './lava_flow.png'); // Use animated flow
registerAtlasTexture('lava_still', './lava_still.png'); // Added Still Lava
registerAtlasTexture('magma', './lava_flow.png', '#550000'); // Use animated flow
registerAtlasTexture('furnace_front_on', './furnace_front_on.png');
registerAtlasTexture('oak_door_top', './oak_door_top.png');
registerAtlasTexture('oak_door_bottom', './oak_door_bottom.png');
registerAtlasTexture('oak_door_item', './oak_door.png');
registerAtlasTexture('bucket', './bucket.png');
registerAtlasTexture('water_bucket', './water_bucket.png');
registerAtlasTexture('lava_bucket', './lava_bucket.png');
registerAtlasTexture('diamond', './diamond.png');
registerAtlasTexture('coal', './coal.png');
registerAtlasTexture('iron_ingot', './iron_ingot.png');
registerAtlasTexture('gold_ingot', './gold_ingot.png');
registerAtlasTexture('torch', './torch.png');
registerAtlasTexture('structure_block', './structure_block.png');
registerAtlasTexture('glass', './glass.png');
registerAtlasTexture('iron_shovel', './iron_shovel.png');
registerAtlasTexture('iron_pickaxe', './iron_pickaxe.png');
registerAtlasTexture('iron_axe', './iron_axe.png');
registerAtlasTexture('iron_sword', './iron_sword.png');
registerAtlasTexture('iron_hoe', './iron_hoe.png');
registerAtlasTexture('farmland_dry', './farmland.png');
registerAtlasTexture('farmland_wet', './farmland_moist.png');
registerAtlasTexture('fire', './fire_1.png');
registerAtlasTexture('flint_and_steel', './flint_and_steel.png');
registerAtlasTexture('nether_portal', './nether_portal.png');
registerAtlasTexture('wheat_seeds', './wheat_seeds.png');
registerAtlasTexture('wheat', './wheat.png');
for(let i=0; i<=7; i++) {
    registerAtlasTexture(`wheat_stage_${i}`, `./wheat_stage${i}.png`);
}

// New Textures
registerAtlasTexture('grass_plant', './grass.png'); // Short grass
registerAtlasTexture('tall_grass_bottom', './tall_grass_bottom.png');
registerAtlasTexture('tall_grass_top', './tall_grass_top.png');

registerAtlasTexture('birch_log', './birch_log.png');
registerAtlasTexture('birch_log_top', './birch_log_top.png');
registerAtlasTexture('birch_planks', './birch_planks.png');
registerAtlasTexture('birch_leaves', './birch_leaves.png');

registerAtlasTexture('spruce_log', './spruce_log.png');
registerAtlasTexture('spruce_log_top', './spruce_log_top.png');
registerAtlasTexture('spruce_planks', './spruce_planks.png');
registerAtlasTexture('spruce_leaves', './spruce_leaves.png');

registerAtlasTexture('jungle_log', './jungle_log.png');
registerAtlasTexture('jungle_log_top', './jungle_log_top.png');
registerAtlasTexture('jungle_planks', './jungle_planks.png');
registerAtlasTexture('jungle_leaves', './jungle_leaves.png');

registerAtlasTexture('acacia_log', './acacia_log.png');
registerAtlasTexture('acacia_log_top', './acacia_log_top.png');
registerAtlasTexture('acacia_planks', './acacia_planks.png');
registerAtlasTexture('acacia_leaves', './acacia_leaves.png');

registerAtlasTexture('dark_oak_log', './dark_oak_log.png');
registerAtlasTexture('dark_oak_log_top', './dark_oak_log_top.png');
registerAtlasTexture('dark_oak_planks', './dark_oak_planks.png');
registerAtlasTexture('dark_oak_leaves', './dark_oak_leaves.png');

// Stripped Logs
registerAtlasTexture('stripped_oak_log', './stripped_oak_log.png');
registerAtlasTexture('stripped_oak_log_top', './stripped_oak_log_top.png');

registerAtlasTexture('stripped_birch_log', './stripped_birch_log.png');
registerAtlasTexture('stripped_birch_log_top', './stripped_birch_log_top.png');

registerAtlasTexture('stripped_spruce_log', './stripped_spruce_log.png');
registerAtlasTexture('stripped_spruce_log_top', './stripped_spruce_log_top.png');

registerAtlasTexture('stripped_jungle_log', './stripped_jungle_log.png');
registerAtlasTexture('stripped_jungle_log_top', './stripped_jungle_log_top.png');

registerAtlasTexture('stripped_acacia_log', './stripped_acacia_log.png');
registerAtlasTexture('stripped_acacia_log_top', './stripped_acacia_log_top.png');

registerAtlasTexture('stripped_dark_oak_log', './stripped_dark_oak_log.png');
registerAtlasTexture('stripped_dark_oak_log_top', './stripped_dark_oak_log_top.png');

// Legacy textures for UI/Items (Loaded here to pass to initBlockMats)
const texMap = {
    texGrassTop: loadBlockTexture('./grass_carried.png'),
    texGrassSide: loadBlockTexture('./grass_side_carried.png'),
    texDirt: loadBlockTexture('./dirt.png'),
    texStone: loadBlockTexture('./stone (1).png'),
    texWater: loadBlockTexture('./water_flow.png'),
    texSand: loadBlockTexture('./sand (1).png'),
    texLogSide: loadBlockTexture('./log_oak.png'),
    texLogTop: loadBlockTexture('./log_oak_top.png'),
    texLeaves: loadBlockTexture('./leaves.png'),
    texGravel: loadBlockTexture('./gravel.png'),
    texClay: loadBlockTexture('./dirt.png'),
    texCane: loadBlockTexture('./leaves_big_oak_opaque.png'),
    texGranite: loadBlockTexture('./stone_granite.png'),
    texDiorite: loadBlockTexture('./stone_diorite.png'),
    texAndesite: loadBlockTexture('./stone_andesite.png'),
    texBedrock: loadBlockTexture('./bedrock.png'),
    texOakPlanks: loadBlockTexture('./oak_planks.png'),
    texCraftingTop: loadBlockTexture('./crafting_table_top.png'),
    texCraftingSide: loadBlockTexture('./crafting_table_side.png'),
    texCraftingFront: loadBlockTexture('./crafting_table_front.png'),
    texFurnaceFront: loadBlockTexture('./furnace_front.png'),
    texFurnaceSide: loadBlockTexture('./furnace_side.png'),
    texFurnaceTop: loadBlockTexture('./furnace_top.png'),
    texCobblestone: loadBlockTexture('./cobblestone.png'),
    texCactusSide: loadBlockTexture('./cactus_side.png'),
    texCactusTop: loadBlockTexture('./cactus_top.png'),
    texDeadBush: loadBlockTexture('./dead_bush.png'),
    texDandelion: loadBlockTexture('./dandelion.png'),
    texPinkTulip: loadBlockTexture('./pink_tulip.png'),
    texLily: loadBlockTexture('./lily_of_the_valley.png'),
    texCoalOre: loadBlockTexture('./coal_ore.png'),
    texIronOre: loadBlockTexture('./iron_ore.png'),
    texGoldOre: loadBlockTexture('./gold_ore.png'),
    texRedstoneOre: loadBlockTexture('./redstone_ore.png'),
    texLapisOre: loadBlockTexture('./lapis_ore.png'),
    texDiamondOre: loadBlockTexture('./diamond_ore.png'),
    texEmeraldOre: loadBlockTexture('./emerald_ore.png'),
    texStick: loadBlockTexture('./stick.png'),
    texNetherrack: loadBlockTexture('./netherrack.png'),
    texObsidian: loadBlockTexture('./obsidian.png'),
    texGlowstone: loadBlockTexture('./stone (1).png'), // Manual tint in materials
    texQuartzOre: loadBlockTexture('./stone_diorite.png'), // Note: manual tint needed if used in legacy map, but usually not used for blocks
    texSoulSand: loadBlockTexture('./soul_sand.png'),
    texLava: loadBlockTexture('./lava_flow.png'),
    texMagma: loadBlockTexture('./lava_flow.png'),
    texFarmland: loadBlockTexture('./farmland.png'),
    texFarmlandWet: loadBlockTexture('./farmland_moist.png'),
    texFlintAndSteel: loadBlockTexture('./flint_and_steel.png'),
    texNetherPortal: loadBlockTexture('./nether_portal.png'),
    texWheatSeeds: loadBlockTexture('./wheat_seeds.png'),
    texWheat: loadBlockTexture('./wheat.png')
};

initBlockMats(texMap);

export function getBlockTexture(blockId, randomFace = false) {
    const faces = BLOCK_FACES[blockId];
    let matName = 'stone';
    if (!faces) return null;
    if (typeof faces === 'string') matName = faces;
    else if (Array.isArray(faces)) matName = faces[randomFace ? Math.floor(Math.random() * faces.length) : 2];
    const mat = BLOCK_MATS[matName];
    return mat ? mat.map : null;
}

export function renderBlockIcon(blockId) {
    if (iconCache.has(blockId)) {
        return iconCache.get(blockId);
    }

    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    const BLOCK_UNIT = 8;
    // Adjusted scale and position to fit 128x128 canvas without clipping
    // Unit Height = 16. Scale 6.0 -> 96px height. 
    // Center Y: (128-96)/2 = 16.
    // Top padding = 16.
    // Origin (top of top face) should be at 16 + (something?)
    // Actually, let's use 20 to give a bit more headroom for the top face peak.
    const CANVAS_SCALE = 6.2; 
    
    // TILE_SIZE is 16
    const TILE_SIZE = 16; 

    if (isFoliage(blockId)) {
        ctx.translate(64, 64);
        ctx.scale(CANVAS_SCALE, CANVAS_SCALE);
        
        let faceName = BLOCK_FACES[blockId];
        if (Array.isArray(faceName)) faceName = faceName[0];
        
        const atlasSlot = getAtlasUV(faceName);
        if (atlasSlot) {
            const atlasX = atlasSlot.col * TILE_SIZE;
            const atlasY = atlasSlot.row * TILE_SIZE;
            // Center sprite
            ctx.drawImage(atlasCanvas, atlasX, atlasY, TILE_SIZE, TILE_SIZE, -8, -8, 16, 16);
        }
        const url = canvas.toDataURL();
        iconCache.set(blockId, url);
        return url;
    }
    
    // Center horizontally (64).
    // Move vertically to avoid bottom clipping. The isometric block is tall.
    ctx.translate(64, 16); 
    ctx.scale(CANVAS_SCALE, CANVAS_SCALE); 

    const faces = BLOCK_FACES[blockId];
    if (!faces) return canvas.toDataURL();

    let topName, leftName, rightName;
    if (typeof faces === 'string') topName = leftName = rightName = faces;
    else { 
        // MC Icon Standard: Top, Front (Left), Right
        topName = faces[2];   // Top
        leftName = faces[4];  // Front -> Left side of icon
        rightName = faces[0]; // Right -> Right side of icon
    }

    // Iso Projection Setup
    // 2:1 Pixel Art Isometric Projection Matrices
    // Input coordinates are 0..8 (BLOCK_UNIT)

    const drawFace = (name, transformArgs, shade) => {
        const atlasSlot = getAtlasUV(name);
        if (!atlasSlot || !atlasCanvas.width) {
            const mat = BLOCK_MATS[name];
            ctx.save();
            ctx.transform(...transformArgs);
            ctx.fillStyle = (mat && mat.color) ? '#' + mat.color.getHexString() : '#888';
            ctx.fillRect(0, 0, BLOCK_UNIT, BLOCK_UNIT);
            if (shade) { ctx.fillStyle = shade; ctx.fillRect(0, 0, BLOCK_UNIT, BLOCK_UNIT); }
            ctx.restore();
            return;
        }

        const atlasX = atlasSlot.col * TILE_SIZE;
        const atlasY = atlasSlot.row * TILE_SIZE;
        
        let tint = null;
        if (name === 'grass_top') tint = '#6ABD45';
        else if (name === 'water') tint = '#0040FF';
        else if (name === 'sugar_cane') tint = '#99cc66';
        else if (name === 'glowstone') tint = '#ffcc00';
        else if (name === 'soul_sand') tint = '#4a3b2b';
        else if (name === 'magma') tint = '#400000';
        
        ctx.save();
        ctx.transform(...transformArgs);

        ctx.drawImage(atlasCanvas, atlasX, atlasY, TILE_SIZE, TILE_SIZE, 0, 0, BLOCK_UNIT, BLOCK_UNIT);
        
        if (tint) {
            ctx.globalCompositeOperation = 'multiply';
            ctx.fillStyle = tint;
            ctx.fillRect(0, 0, BLOCK_UNIT, BLOCK_UNIT);
            ctx.globalCompositeOperation = 'source-over';
        }

        if (shade) { ctx.fillStyle = shade; ctx.fillRect(0, 0, BLOCK_UNIT, BLOCK_UNIT); }
        ctx.restore();
    };

    // Top Face: Diamond shape
    drawFace(topName, [1, 0.5, -1, 0.5, 0, 0], null);
    
    // Left Face (Front): Skewed down-left
    // Offset: -8 X, 4 Y
    drawFace(leftName, [1, 0.5, 0, 1, -BLOCK_UNIT, BLOCK_UNIT/2], 'rgba(0,0,0,0.2)');
    
    // Right Face (Side): Skewed down-right
    // Offset: 0 X, 8 Y
    drawFace(rightName, [1, -0.5, 0, 1, 0, BLOCK_UNIT], 'rgba(0,0,0,0.4)');

    const url = canvas.toDataURL();
    iconCache.set(blockId, url);
    return url;
}

// Map of block IDs to texture names for item icons
export const TEXTURE_MAP = {
    [BLOCKS.IRON_INGOT]: 'iron_ingot',
    [BLOCKS.GOLD_INGOT]: 'gold_ingot',
    [BLOCKS.OAK_DOOR_ITEM]: 'oak_door_item', // Use top texture for item icon
    [BLOCKS.BUCKET]: 'bucket',
    [BLOCKS.WATER_BUCKET]: 'water_bucket',
    [BLOCKS.LAVA_BUCKET]: 'lava_bucket',
    [BLOCKS.FIRE]: 'fire',
    [BLOCKS.FLINT_AND_STEEL]: 'flint_and_steel',
    [BLOCKS.DIAMOND]: 'diamond',
    [BLOCKS.COAL]: 'coal',
    [BLOCKS.WHEAT_SEEDS]: 'wheat_seeds',
    [BLOCKS.WHEAT_ITEM]: 'wheat'
};

export function isFarmland(id) {
    return (id === BLOCKS.FARMLAND || id === BLOCKS.FARMLAND_MOIST);
}
