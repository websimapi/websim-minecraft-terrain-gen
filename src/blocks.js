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
    atlasCtx,
    rawImages
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
registerAtlasTexture('sand', './sand (3).png');
registerAtlasTexture('log_side', './oak_log (1).png');
registerAtlasTexture('log_top', './oak_log_top (1).png');
registerAtlasTexture('leaves', './leaves.png');
registerAtlasTexture('gravel', './gravel.png');
registerAtlasTexture('clay', './dirt.png');
registerAtlasTexture('sugar_cane', './leaves_big_oak_opaque.png');
registerAtlasTexture('granite', './granite.png');
registerAtlasTexture('diorite', './diorite.png');
registerAtlasTexture('andesite', './andesite.png');
registerAtlasTexture('bedrock', './bedrock (3).png');
registerAtlasTexture('snow', './sand.png');
registerAtlasTexture('terracotta', './dirt.png');
registerAtlasTexture('oak_planks', './oak_planks (1).png'); // Updated per request
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
registerAtlasTexture('glowstone', './glowstone (2).png'); 
registerAtlasTexture('quartz_ore', './nether_quartz_ore (1).png'); 
registerAtlasTexture('soul_sand', './soul_sand.png');
registerAtlasTexture('lava', './lava_flow.png'); // Use animated flow
registerAtlasTexture('lava_still', './lava_still.png'); // Added Still Lava
registerAtlasTexture('magma', './magma.png'); 
registerAtlasTexture('quartz_block_top', './quartz_block_top.png');
registerAtlasTexture('quartz_block_side', './quartz_block_side.png');
registerAtlasTexture('quartz_block_bottom', './quartz_block_bottom.png');
registerAtlasTexture('furnace_front_on', './furnace_front_on.png');
registerAtlasTexture('oak_door_top', './oak_door_top.png');
registerAtlasTexture('oak_door_bottom', './oak_door_bottom.png');
registerAtlasTexture('oak_door_item', './oak_door (1).png');
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
registerAtlasTexture('glass_pane_top', './glass_pane_top.png'); // Use for edges if available, else glass
registerAtlasTexture('iron_shovel', './iron_shovel.png');
registerAtlasTexture('iron_pickaxe', './iron_pickaxe.png');
registerAtlasTexture('iron_axe', './iron_axe.png');
registerAtlasTexture('iron_sword', './iron_sword.png');
registerAtlasTexture('iron_hoe', './iron_hoe.png');
registerAtlasTexture('diamond_shovel', './diamond_shovel.png');
registerAtlasTexture('diamond_pickaxe', './diamond_pickaxe.png');
registerAtlasTexture('diamond_axe', './diamond_axe.png');
registerAtlasTexture('diamond_sword', './diamond_sword.png');
registerAtlasTexture('diamond_hoe', './diamond_hoe.png');
registerAtlasTexture('golden_shovel', './golden_shovel.png');
registerAtlasTexture('golden_pickaxe', './golden_pickaxe.png');
registerAtlasTexture('golden_axe', './golden_axe.png');
registerAtlasTexture('golden_sword', './golden_sword.png');
registerAtlasTexture('golden_hoe', './golden_hoe.png');
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

// New Items
registerAtlasTexture('bone_meal', './bone_meal.png');
registerAtlasTexture('bread', './bread.png');
registerAtlasTexture('golden_carrot', './golden_carrot.png');
registerAtlasTexture('pumpkin_pie', './pumpkin_pie.png');
registerAtlasTexture('milk_bucket', './milk_bucket.png');
registerAtlasTexture('bone', './bone.png');
registerAtlasTexture('saddle', './saddle.png');

registerAtlasTexture('oak_sapling', './oak_sapling.png');
registerAtlasTexture('spruce_sapling', './spruce_sapling.png');
registerAtlasTexture('birch_sapling', './birch_sapling.png');
registerAtlasTexture('jungle_sapling', './jungle_sapling.png');
registerAtlasTexture('acacia_sapling', './acacia_sapling.png');
registerAtlasTexture('dark_oak_sapling', './dark_oak_sapling.png');
registerAtlasTexture('structure_block_save', './structure_block_save.png');

// Pumpkin
registerAtlasTexture('pumpkin_face', './carved_pumpkin.png');
registerAtlasTexture('pumpkin_side', './pumpkin_side.png');
registerAtlasTexture('pumpkin_top', './pumpkin_top.png');

// Icon Overrides
registerAtlasTexture('icon_oak_stairs', './Oak_Stairs_29_JE1_BE1.webp');
registerAtlasTexture('icon_oak_slab', './Oak_Slab_JE3_BE2.webp');
registerAtlasTexture('icon_cobblestone_stairs', './Cobblestone_Stairs_29_JE3_BE4.webp');
registerAtlasTexture('icon_cobblestone_slab', './Cobblestone_Slab_JE2_BE2.png');

// New Door Textures
registerAtlasTexture('spruce_door_top', './spruce_door_top.png');
registerAtlasTexture('spruce_door_bottom', './spruce_door_bottom.png');
registerAtlasTexture('spruce_door_item', './spruce_door.png');

registerAtlasTexture('birch_door_top', './birch_door_top.png');
registerAtlasTexture('birch_door_bottom', './birch_door_bottom.png');
registerAtlasTexture('birch_door_item', './birch_door.png');

registerAtlasTexture('jungle_door_top', './jungle_door_top.png');
registerAtlasTexture('jungle_door_bottom', './jungle_door_bottom.png');
registerAtlasTexture('jungle_door_item', './jungle_door.png');

registerAtlasTexture('acacia_door_top', './acacia_door_top.png');
registerAtlasTexture('acacia_door_bottom', './acacia_door_bottom.png');
registerAtlasTexture('acacia_door_item', './acacia_door.png');

registerAtlasTexture('dark_oak_door_top', './dark_oak_door_top.png');
registerAtlasTexture('dark_oak_door_bottom', './dark_oak_door_bottom.png');
registerAtlasTexture('dark_oak_door_item', './dark_oak_door.png');

registerAtlasTexture('iron_door_top', './iron_door_top.png');
registerAtlasTexture('iron_door_bottom', './iron_door_bottom.png');
registerAtlasTexture('iron_door_item', './iron_door.png');

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

// Ensure BLOCK_FACES has entries for non-standard blocks to allow procedural rendering fallback
BLOCK_FACES[BLOCKS.OAK_SLAB] = 'oak_planks';
BLOCK_FACES[BLOCKS.COBBLESTONE_SLAB] = 'cobblestone';
BLOCK_FACES[BLOCKS.OAK_STAIRS] = 'oak_planks';
BLOCK_FACES[BLOCKS.COBBLESTONE_STAIRS] = 'cobblestone';
BLOCK_FACES[BLOCKS.OAK_FENCE] = 'oak_planks';
BLOCK_FACES[BLOCKS.GLASS_PANE] = 'glass';

// Legacy textures for UI/Items (Loaded here to pass to initBlockMats)
const texMap = {
    texGrassTop: loadBlockTexture('./grass_carried.png'),
    texGrassSide: loadBlockTexture('./grass_side_carried.png'),
    texDirt: loadBlockTexture('./dirt.png'),
    texStone: loadBlockTexture('./stone (1).png'),
    texWater: loadBlockTexture('./water_flow.png'),
    texSand: loadBlockTexture('./sand (3).png'),
    texLogSide: loadBlockTexture('./oak_log (1).png'),
    texLogTop: loadBlockTexture('./oak_log_top (1).png'),
    texLeaves: loadBlockTexture('./leaves.png'),
    texGravel: loadBlockTexture('./gravel.png'),
    texClay: loadBlockTexture('./dirt.png'),
    texCane: loadBlockTexture('./leaves_big_oak_opaque.png'),
    texGranite: loadBlockTexture('./stone_granite.png'),
    texDiorite: loadBlockTexture('./stone_diorite.png'),
    texAndesite: loadBlockTexture('./stone_andesite.png'),
    texBedrock: loadBlockTexture('./bedrock.png'),
    texOakPlanks: loadBlockTexture('./oak_planks (1).png'), // Updated
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
    texGlowstone: loadBlockTexture('./glowstone (2).png'), 
    texQuartzOre: loadBlockTexture('./nether_quartz_ore (1).png'), 
    texSoulSand: loadBlockTexture('./soul_sand.png'),
    texLava: loadBlockTexture('./lava_flow.png'),
    texMagma: loadBlockTexture('./magma.png'),
    texQuartzBlockTop: loadBlockTexture('./quartz_block_top.png'),
    texQuartzBlockSide: loadBlockTexture('./quartz_block_side.png'),
    texQuartzBlockBottom: loadBlockTexture('./quartz_block_bottom.png'),
    texFarmland: loadBlockTexture('./farmland.png'),
    texFarmlandWet: loadBlockTexture('./farmland_moist.png'),
    texFlintAndSteel: loadBlockTexture('./flint_and_steel.png'),
    texNetherPortal: loadBlockTexture('./nether_portal.png'),
    texWheatSeeds: loadBlockTexture('./wheat_seeds.png'),
    texWheat: loadBlockTexture('./wheat.png'),
    texIronIngot: loadBlockTexture('./iron_ingot.png'),
    texGoldIngot: loadBlockTexture('./gold_ingot.png'),
    texOakDoorTop: loadBlockTexture('./oak_door_top.png'),
    texOakDoorBottom: loadBlockTexture('./oak_door_bottom.png'),
    texSpruceDoorTop: loadBlockTexture('./spruce_door_top.png'),
    texSpruceDoorBottom: loadBlockTexture('./spruce_door_bottom.png'),
    texBirchDoorTop: loadBlockTexture('./birch_door_top.png'),
    texBirchDoorBottom: loadBlockTexture('./birch_door_bottom.png'),
    texJungleDoorTop: loadBlockTexture('./jungle_door_top.png'),
    texJungleDoorBottom: loadBlockTexture('./jungle_door_bottom.png'),
    texAcaciaDoorTop: loadBlockTexture('./acacia_door_top.png'),
    texAcaciaDoorBottom: loadBlockTexture('./acacia_door_bottom.png'),
    texDarkOakDoorTop: loadBlockTexture('./dark_oak_door_top.png'),
    texDarkOakDoorBottom: loadBlockTexture('./dark_oak_door_bottom.png'),
    texIronDoorTop: loadBlockTexture('./iron_door_top.png'),
    texIronDoorBottom: loadBlockTexture('./iron_door_bottom.png'),
    texTorch: loadBlockTexture('./torch.png'),
    texStructureBlock: loadBlockTexture('./structure_block.png'),
    texGlass: loadBlockTexture('./glass.png'),
    texIronShovel: loadBlockTexture('./iron_shovel.png'),
    texIronPickaxe: loadBlockTexture('./iron_pickaxe.png'),
    texIronAxe: loadBlockTexture('./iron_axe.png'),
    texIronSword: loadBlockTexture('./iron_sword.png'),
    texIronHoe: loadBlockTexture('./iron_hoe.png'),
    texDiamondShovel: loadBlockTexture('./diamond_shovel.png'),
    texDiamondPickaxe: loadBlockTexture('./diamond_pickaxe.png'),
    texDiamondAxe: loadBlockTexture('./diamond_axe.png'),
    texDiamondSword: loadBlockTexture('./diamond_sword.png'),
    texDiamondHoe: loadBlockTexture('./diamond_hoe.png'),

    texGoldenShovel: loadBlockTexture('./golden_shovel.png'),
    texGoldenPickaxe: loadBlockTexture('./golden_pickaxe.png'),
    texGoldenAxe: loadBlockTexture('./golden_axe.png'),
    texGoldenSword: loadBlockTexture('./golden_sword.png'),
    texGoldenHoe: loadBlockTexture('./golden_hoe.png'),

    texOakSapling: loadBlockTexture('./oak_sapling.png'),
    texSpruceSapling: loadBlockTexture('./spruce_sapling.png'),
    texBirchSapling: loadBlockTexture('./birch_sapling.png'),
    texJungleSapling: loadBlockTexture('./jungle_sapling.png'),
    texAcaciaSapling: loadBlockTexture('./acacia_sapling.png'),
    texDarkOakSapling: loadBlockTexture('./dark_oak_sapling.png'),

    texFarmland: loadBlockTexture('./farmland.png'),
    texFarmlandWet: loadBlockTexture('./farmland_moist.png'),
    texFlintAndSteel: loadBlockTexture('./flint_and_steel.png'),
    texNetherPortal: loadBlockTexture('./nether_portal.png'),
    texWheatSeeds: loadBlockTexture('./wheat_seeds.png'),
    texWheat: loadBlockTexture('./wheat.png'),
    texPumpkinFace: loadBlockTexture('./carved_pumpkin.png'),
    texPumpkinSide: loadBlockTexture('./pumpkin_side.png'),
    texPumpkinTop: loadBlockTexture('./pumpkin_top.png')
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

    const iconOverride = TEXTURE_MAP[blockId];

    const BLOCK_UNIT = 8;
    
    const SCALE_2D = 7.8;
    const SCALE_ISO = 3.2;
    
    // TILE_SIZE is 16
    const TILE_SIZE = 16; 

    if (isFoliage(blockId) || iconOverride) {
        ctx.translate(64, 64);
        ctx.scale(SCALE_2D, SCALE_2D);
        
        let textureName = iconOverride;
        if (!textureName) {
            let faceName = BLOCK_FACES[blockId];
            if (Array.isArray(faceName)) faceName = faceName[0];
            textureName = faceName;
        }
        
        // Manual Tints
        let tint = null;
        if (blockId === BLOCKS.GRASS_PLANT || blockId === BLOCKS.TALL_GRASS_BOTTOM || blockId === BLOCKS.TALL_GRASS_TOP) tint = '#79C05A';
        else if (blockId === BLOCKS.SUGAR_CANE) tint = '#99cc66';
        else if (blockId === BLOCKS.LEAVES || blockId === BLOCKS.JUNGLE_LEAVES || blockId === BLOCKS.ACACIA_LEAVES || blockId === BLOCKS.DARK_OAK_LEAVES) tint = '#48B518';
        else if (blockId === BLOCKS.BIRCH_LEAVES) tint = '#80a755';
        else if (blockId === BLOCKS.SPRUCE_LEAVES) tint = '#619961';

        // Check Raw Image First (for high-res icons like stairs/slabs)
        if (rawImages.has(textureName)) {
            const img = rawImages.get(textureName);
            if (img.complete && img.naturalWidth > 0) {
                // Draw high-res image directly into slot context
                ctx.drawImage(img, -8, -8, 16, 16);
                
                if (tint) {
                    ctx.globalCompositeOperation = 'multiply';
                    ctx.fillStyle = tint;
                    ctx.fillRect(-8, -8, 16, 16);
                    ctx.globalCompositeOperation = 'destination-in';
                    ctx.drawImage(img, -8, -8, 16, 16);
                    ctx.globalCompositeOperation = 'source-over';
                }
                const url = canvas.toDataURL();
                iconCache.set(blockId, url);
                return url;
            }
        }

        const atlasSlot = getAtlasUV(textureName);
        if (atlasSlot) {
            const atlasX = atlasSlot.col * TILE_SIZE;
            const atlasY = atlasSlot.row * TILE_SIZE;
            
            // Center sprite
            ctx.drawImage(atlasCanvas, atlasX, atlasY, TILE_SIZE, TILE_SIZE, -8, -8, 16, 16);
            
            if (tint) {
                ctx.globalCompositeOperation = 'multiply';
                ctx.fillStyle = tint;
                ctx.fillRect(-8, -8, 16, 16);
                
                // Fix: Mask back to original sprite alpha to prevent tinting the transparent background
                ctx.globalCompositeOperation = 'destination-in';
                ctx.drawImage(atlasCanvas, atlasX, atlasY, TILE_SIZE, TILE_SIZE, -8, -8, 16, 16);
                
                ctx.globalCompositeOperation = 'source-over';
            }
        }
        const url = canvas.toDataURL();
        iconCache.set(blockId, url);
        return url;
    }

    // Isometric Block Render
    // Center horizontally (64) and vertically (64).
    ctx.translate(64, 64); 
    ctx.scale(SCALE_ISO, SCALE_ISO); 

    const faces = BLOCK_FACES[blockId];
    if (!faces) return canvas.toDataURL();

    let topName, leftName, rightName;
    if (typeof faces === 'string') topName = leftName = rightName = faces;
    else { 
        topName = faces[2];   // Top
        leftName = faces[4];  // Front -> Left side of icon
        rightName = faces[0]; // Right -> Right side of icon
    }

    const drawFace = (name, transformArgs, shade) => {
        const atlasSlot = getAtlasUV(name);
        if (!atlasSlot || !atlasCanvas.width) return;

        const atlasX = atlasSlot.col * TILE_SIZE;
        const atlasY = atlasSlot.row * TILE_SIZE;
        
        let tint = null;
        if (name === 'grass_top') tint = '#79C05A';
        else if (name === 'leaves') tint = '#48B518';
        else if (name === 'birch_leaves') tint = '#80a755';
        else if (name === 'spruce_leaves') tint = '#619961';
        else if (name === 'jungle_leaves') tint = '#4DCC1A';
        else if (name === 'acacia_leaves') tint = '#80801A';
        else if (name === 'dark_oak_leaves') tint = '#33661A';
        
        ctx.save();
        ctx.transform(...transformArgs);

        ctx.drawImage(atlasCanvas, atlasX, atlasY, TILE_SIZE, TILE_SIZE, 0, 0, TILE_SIZE, TILE_SIZE);
        
        if (tint) {
            ctx.globalCompositeOperation = 'multiply';
            ctx.fillStyle = tint;
            ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
            
            // Mask back to original texture alpha
            ctx.globalCompositeOperation = 'destination-in';
            ctx.drawImage(atlasCanvas, atlasX, atlasY, TILE_SIZE, TILE_SIZE, 0, 0, TILE_SIZE, TILE_SIZE);
            
            ctx.globalCompositeOperation = 'source-over';
        }

        if (shade < 1.0) {
            ctx.fillStyle = `rgba(0,0,0,${1.0 - shade})`;
            ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
        }
        ctx.restore();
    };

    // Special handling for Stairs
    const isStair = (blockId === BLOCKS.OAK_STAIRS || blockId === BLOCKS.COBBLESTONE_STAIRS);
    const isSlab = (blockId === BLOCKS.OAK_SLAB || blockId === BLOCKS.COBBLESTONE_SLAB);

    if (isStair) {
        // Draw Bottom Slab + Top Back Quarter
        
        // 1. Top Face Low (Front Z=8..16) -> Y=8
        // Transform offset Y by -8
        drawFace(topName, [1, 0.5, -1, 0.5, 0, -8], 1.0, 0, 8, 16, 8);
        
        // 2. Top Face High (Back Z=0..8) -> Y=16
        drawFace(topName, [1, 0.5, -1, 0.5, 0, -16], 1.0, 0, 0, 16, 8);
        
        // 3. Right Face (Full Bottom Half Y=8..16)
        drawFace(rightName, [1, -0.5, 0, 1, 0, 0], 0.6, 0, 8, 16, 8);
        
        // 4. Right Face (Top Back Quarter Y=0..8, Z=0..8)
        // Crop: sx=0, sy=0, sw=8, sh=8?
        // Right face texture: u=Z, v=Y. Z=0 is Back? Or Z=0 is Front?
        // Let's assume u=0 is Back (Right-Up). So we want u=0..8. v=0..8 (Top).
        drawFace(rightName, [1, -0.5, 0, 1, 0, 0], 0.6, 0, 0, 8, 8);
        
        // 5. Left Face (Front Z=16). Bottom Half (Y=8..16).
        drawFace(leftName, [1, 0.5, 0, 1, -16, -8], 0.8, 0, 8, 16, 8);
        
    } else if (isSlab) {
        // Draw Slab (Bottom Half)
        
        // 1. Top Face at Y=8
        drawFace(topName, [1, 0.5, -1, 0.5, 0, -8], 1.0);
        
        // 2. Right Face Bottom Half
        drawFace(rightName, [1, -0.5, 0, 1, 0, 0], 0.6, 0, 8, 16, 8);
        
        // 3. Left Face Bottom Half
        drawFace(leftName, [1, 0.5, 0, 1, -16, -8], 0.8, 0, 8, 16, 8);
        
    } else {
        // Standard Cube
        // Top Face (Brightness 1.0)
        drawFace(topName, [1, 0.5, -1, 0.5, 0, -16], 1.0);
        // Right Face (Brightness 0.6)
        drawFace(rightName, [1, -0.5, 0, 1, 0, 0], 0.6);
        // Left Face (Brightness 0.8)
        drawFace(leftName, [1, 0.5, 0, 1, -16, -8], 0.8);
    }

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
    [BLOCKS.WHEAT_ITEM]: 'wheat',
    [BLOCKS.OAK_SLAB]: 'icon_oak_slab',
    [BLOCKS.OAK_STAIRS]: 'icon_oak_stairs',
    [BLOCKS.COBBLESTONE_SLAB]: 'icon_cobblestone_slab',
    [BLOCKS.COBBLESTONE_STAIRS]: 'icon_cobblestone_stairs',
    [BLOCKS.GLASS_PANE]: 'glass', // Icon uses glass texture

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

// Robust Fallback: Ensure critical blocks are defined in case of merge errors
BLOCK_FACES[BLOCKS.STONE] = 'stone';
BLOCK_FACES[BLOCKS.DIRT] = 'dirt';
BLOCK_FACES[BLOCKS.PLANKS] = 'oak_planks';
BLOCK_FACES[BLOCKS.COBBLESTONE] = 'cobblestone';
BLOCK_FACES[BLOCKS.BEDROCK] = 'bedrock';
BLOCK_FACES[BLOCKS.SAND] = 'sand';
BLOCK_FACES[BLOCKS.GRAVEL] = 'gravel';
BLOCK_FACES[BLOCKS.GOLD_ORE] = 'gold_ore';
BLOCK_FACES[BLOCKS.IRON_ORE] = 'iron_ore';
BLOCK_FACES[BLOCKS.COAL_ORE] = 'coal_ore';
BLOCK_FACES[BLOCKS.LOG] = ['log_side', 'log_side', 'log_top', 'log_top', 'log_side', 'log_side'];
BLOCK_FACES[BLOCKS.LEAVES] = 'leaves';
BLOCK_FACES[BLOCKS.GRANITE] = 'granite';
BLOCK_FACES[BLOCKS.DIORITE] = 'diorite';
BLOCK_FACES[BLOCKS.ANDESITE] = 'andesite';
BLOCK_FACES[BLOCKS.OBSIDIAN] = 'obsidian';
BLOCK_FACES[BLOCKS.GLASS] = 'glass';

export function isFarmland(id) {
    return (id === BLOCKS.FARMLAND || id === BLOCKS.FARMLAND_MOIST);
}