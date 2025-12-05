import * as THREE from 'three';
import { BLOCK_FACES, BLOCKS } from '../constants.js';

const textureLoader = new THREE.TextureLoader();

const loadBlockTexture = (path) => {
    const tex = new THREE.Texture();
    const image = new Image();
    image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);
        
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        for(let i=0; i<data.length; i+=4) {
            if(data[i]===0 && data[i+1]===0 && data[i+2]===0) {
                data[i+3] = 0;
            }
        }
        ctx.putImageData(imgData, 0, 0);
        
        tex.image = canvas;
        tex.needsUpdate = true;
    };
    image.src = path;

    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
};

// Legacy materials map (still used for hand items until fully migrated to atlas mesh logic)
export const BLOCK_MATS = {
    // populated in blocks.js via imports for now or lazily
    [BLOCKS.IRON_DOOR_ITEM]: 'iron_door_item',

    [BLOCKS.COBBLESTONE_SLAB]: 'cobblestone',
    [BLOCKS.OAK_SLAB]: 'oak_planks',
    [BLOCKS.COBBLESTONE_STAIRS]: 'cobblestone',
    [BLOCKS.OAK_STAIRS]: 'oak_planks',
    [BLOCKS.OAK_FENCE]: 'oak_planks',

    [BLOCKS.OBSIDIAN]: 'obsidian',
};

// Helper to init BLOCK_MATS content (moved from blocks.js inline)
export function initBlockMats(texMap) {
    Object.assign(BLOCK_MATS, {
        grass_top: new THREE.MeshBasicMaterial({ map: texMap.texGrassTop, vertexColors: true }),
        grass_side: new THREE.MeshBasicMaterial({ map: texMap.texGrassSide, vertexColors: true }),
        dirt: new THREE.MeshBasicMaterial({ map: texMap.texDirt, vertexColors: true }),
        stone: new THREE.MeshBasicMaterial({ map: texMap.texStone, vertexColors: true }),
        sand: new THREE.MeshBasicMaterial({ map: texMap.texSand, vertexColors: true }),
        log_side: new THREE.MeshBasicMaterial({ map: texMap.texLogSide, vertexColors: true }),
        log_top: new THREE.MeshBasicMaterial({ map: texMap.texLogTop, vertexColors: true }),
        leaves: new THREE.MeshBasicMaterial({ map: texMap.texLeaves, vertexColors: true, color: 0xffffff }), 
        
        // New Wood/Leaf Materials (Legacy UI fallback, main engine uses atlas)
        birch_log: new THREE.MeshBasicMaterial({ map: texMap.texLogSide, vertexColors: true }), // Fallback tex
        birch_leaves: new THREE.MeshBasicMaterial({ map: texMap.texLeaves, vertexColors: true }),
        
        water: new THREE.MeshBasicMaterial({ 
            map: texMap.texWater,
            color: 0x0022FF, // Darker intense blue
            transparent: true, 
            opacity: 0.7, 
            side: THREE.DoubleSide,
            vertexColors: true,
            alphaTest: 0.1
        }),
        snow: new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true }),
        terracotta: new THREE.MeshBasicMaterial({ color: 0xcc6633, vertexColors: true }),
        bedrock: new THREE.MeshBasicMaterial({ map: texMap.texBedrock, vertexColors: true }),
        gravel: new THREE.MeshBasicMaterial({ map: texMap.texGravel, color: 0x999999, vertexColors: true }),
        clay: new THREE.MeshBasicMaterial({ map: texMap.texClay, color: 0x9aa3b3, vertexColors: true }),
        sugar_cane: new THREE.MeshBasicMaterial({ map: texMap.texCane, color: 0x99cc66, transparent: true, side: THREE.DoubleSide, alphaTest: 0.5, vertexColors: true }),
        granite: new THREE.MeshBasicMaterial({ map: texMap.texGranite, vertexColors: true }),
        diorite: new THREE.MeshBasicMaterial({ map: texMap.texDiorite, vertexColors: true }),
        andesite: new THREE.MeshBasicMaterial({ map: texMap.texAndesite, vertexColors: true }),
        oak_planks: new THREE.MeshBasicMaterial({ map: texMap.texOakPlanks, vertexColors: true }),
        crafting_table_top: new THREE.MeshBasicMaterial({ map: texMap.texCraftingTop, vertexColors: true }),
        crafting_table_side: new THREE.MeshBasicMaterial({ map: texMap.texCraftingSide, vertexColors: true }),
        crafting_table_front: new THREE.MeshBasicMaterial({ map: texMap.texCraftingFront, vertexColors: true }),
        furnace_front: new THREE.MeshBasicMaterial({ map: texMap.texFurnaceFront, vertexColors: true }),
        furnace_side: new THREE.MeshBasicMaterial({ map: texMap.texFurnaceSide, vertexColors: true }),
        furnace_top: new THREE.MeshBasicMaterial({ map: texMap.texFurnaceTop, vertexColors: true }),
        cobblestone: new THREE.MeshBasicMaterial({ map: texMap.texCobblestone, vertexColors: true }),
        cactus_side: new THREE.MeshBasicMaterial({ map: texMap.texCactusSide, vertexColors: true }),
        cactus_top: new THREE.MeshBasicMaterial({ map: texMap.texCactusTop, vertexColors: true }),
        dead_bush: new THREE.MeshBasicMaterial({ map: texMap.texDeadBush, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, vertexColors: true }),
        dandelion: new THREE.MeshBasicMaterial({ map: texMap.texDandelion, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, vertexColors: true }),
        pink_tulip: new THREE.MeshBasicMaterial({ map: texMap.texPinkTulip, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, vertexColors: true }),
        lily_of_the_valley: new THREE.MeshBasicMaterial({ map: texMap.texLily, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, vertexColors: true }),
        coal_ore: new THREE.MeshBasicMaterial({ map: texMap.texCoalOre, vertexColors: true }),
        iron_ore: new THREE.MeshBasicMaterial({ map: texMap.texIronOre, vertexColors: true }),
        gold_ore: new THREE.MeshBasicMaterial({ map: texMap.texGoldOre, vertexColors: true }),
        redstone_ore: new THREE.MeshBasicMaterial({ map: texMap.texRedstoneOre, vertexColors: true }),
        lapis_ore: new THREE.MeshBasicMaterial({ map: texMap.texLapisOre, vertexColors: true }),
        diamond_ore: new THREE.MeshBasicMaterial({ map: texMap.texDiamondOre, vertexColors: true }),
        emerald_ore: new THREE.MeshBasicMaterial({ map: texMap.texEmeraldOre, vertexColors: true }),
        stick: new THREE.MeshBasicMaterial({ map: texMap.texStick, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, vertexColors: true }),
        
        obsidian: new THREE.MeshBasicMaterial({ map: texMap.texObsidian, vertexColors: true }),
        netherrack: new THREE.MeshBasicMaterial({ map: texMap.texNetherrack, color: 0x804040, vertexColors: true }),
        glowstone: new THREE.MeshBasicMaterial({ map: texMap.texGlowstone, vertexColors: true }),
        quartz_ore: new THREE.MeshBasicMaterial({ map: texMap.texQuartzOre, vertexColors: true }),
        soul_sand: new THREE.MeshBasicMaterial({ map: texMap.texSoulSand, vertexColors: true }),
        lava: new THREE.MeshBasicMaterial({ map: texMap.texWater, color: 0xff4400, opacity: 1.0, transparent: false, vertexColors: true }),
        magma: new THREE.MeshBasicMaterial({ map: texMap.texMagma, vertexColors: true }),
        quartz_block: new THREE.MeshBasicMaterial({ map: texMap.texQuartzBlockSide, vertexColors: true }),
        furnace_front_on: new THREE.MeshBasicMaterial({ map: texMap.texFurnaceOn, vertexColors: true }),
        bucket: new THREE.MeshBasicMaterial({ map: texMap.texBucket, transparent: true, side: THREE.DoubleSide }),
        water_bucket: new THREE.MeshBasicMaterial({ map: texMap.texWaterBucket, transparent: true, side: THREE.DoubleSide }),
        lava_bucket: new THREE.MeshBasicMaterial({ map: texMap.texLavaBucket, transparent: true, side: THREE.DoubleSide }),
        diamond: new THREE.MeshBasicMaterial({ map: texMap.texDiamond, transparent: true, side: THREE.DoubleSide }),
        coal: new THREE.MeshBasicMaterial({ map: texMap.texCoal, transparent: true, side: THREE.DoubleSide }),
        iron_ingot: new THREE.MeshBasicMaterial({ map: texMap.texIronIngot, transparent: true, side: THREE.DoubleSide }),
        gold_ingot: new THREE.MeshBasicMaterial({ map: texMap.texGoldIngot, transparent: true, side: THREE.DoubleSide }),
        
        oak_door_top: new THREE.MeshBasicMaterial({ map: texMap.texOakDoorTop, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }),
        oak_door_bottom: new THREE.MeshBasicMaterial({ map: texMap.texOakDoorBottom, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }),
        
        spruce_door_top: new THREE.MeshBasicMaterial({ map: texMap.texSpruceDoorTop, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }),
        spruce_door_bottom: new THREE.MeshBasicMaterial({ map: texMap.texSpruceDoorBottom, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }),
        
        birch_door_top: new THREE.MeshBasicMaterial({ map: texMap.texBirchDoorTop, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }),
        birch_door_bottom: new THREE.MeshBasicMaterial({ map: texMap.texBirchDoorBottom, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }),
        
        jungle_door_top: new THREE.MeshBasicMaterial({ map: texMap.texJungleDoorTop, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }),
        jungle_door_bottom: new THREE.MeshBasicMaterial({ map: texMap.texJungleDoorBottom, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }),
        
        acacia_door_top: new THREE.MeshBasicMaterial({ map: texMap.texAcaciaDoorTop, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }),
        acacia_door_bottom: new THREE.MeshBasicMaterial({ map: texMap.texAcaciaDoorBottom, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }),
        
        dark_oak_door_top: new THREE.MeshBasicMaterial({ map: texMap.texDarkOakDoorTop, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }),
        dark_oak_door_bottom: new THREE.MeshBasicMaterial({ map: texMap.texDarkOakDoorBottom, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }),
        
        iron_door_top: new THREE.MeshBasicMaterial({ map: texMap.texIronDoorTop, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }),
        iron_door_bottom: new THREE.MeshBasicMaterial({ map: texMap.texIronDoorBottom, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }),

        torch: new THREE.MeshBasicMaterial({ map: texMap.texTorch, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, vertexColors: true }),
        structure_block: new THREE.MeshBasicMaterial({ map: texMap.texStructureBlock, vertexColors: true }),
        glass: new THREE.MeshBasicMaterial({ map: texMap.texGlass, transparent: true, opacity: 0.3, side: THREE.DoubleSide, vertexColors: true, depthWrite: false }),
        iron_shovel: new THREE.MeshBasicMaterial({ map: texMap.texIronShovel, transparent: true, side: THREE.DoubleSide, alphaTest: 0.5 }),
        iron_pickaxe: new THREE.MeshBasicMaterial({ map: texMap.texIronPickaxe, transparent: true, side: THREE.DoubleSide, alphaTest: 0.5 }),
        iron_axe: new THREE.MeshBasicMaterial({ map: texMap.texIronAxe, transparent: true, side: THREE.DoubleSide, alphaTest: 0.5 }),
        iron_sword: new THREE.MeshBasicMaterial({ map: texMap.texIronSword, transparent: true, side: THREE.DoubleSide, alphaTest: 0.5 }),
        iron_hoe: new THREE.MeshBasicMaterial({ map: texMap.texIronHoe, transparent: true, side: THREE.DoubleSide, alphaTest: 0.5 }),
        
        diamond_shovel: new THREE.MeshBasicMaterial({ map: texMap.texDiamondShovel, transparent: true, side: THREE.DoubleSide, alphaTest: 0.5 }),
        diamond_pickaxe: new THREE.MeshBasicMaterial({ map: texMap.texDiamondPickaxe, transparent: true, side: THREE.DoubleSide, alphaTest: 0.5 }),
        diamond_axe: new THREE.MeshBasicMaterial({ map: texMap.texDiamondAxe, transparent: true, side: THREE.DoubleSide, alphaTest: 0.5 }),
        diamond_sword: new THREE.MeshBasicMaterial({ map: texMap.texDiamondSword, transparent: true, side: THREE.DoubleSide, alphaTest: 0.5 }),
        diamond_hoe: new THREE.MeshBasicMaterial({ map: texMap.texDiamondHoe, transparent: true, side: THREE.DoubleSide, alphaTest: 0.5 }),

        golden_shovel: new THREE.MeshBasicMaterial({ map: texMap.texGoldenShovel, transparent: true, side: THREE.DoubleSide, alphaTest: 0.5 }),
        golden_pickaxe: new THREE.MeshBasicMaterial({ map: texMap.texGoldenPickaxe, transparent: true, side: THREE.DoubleSide, alphaTest: 0.5 }),
        golden_axe: new THREE.MeshBasicMaterial({ map: texMap.texGoldenAxe, transparent: true, side: THREE.DoubleSide, alphaTest: 0.5 }),
        golden_sword: new THREE.MeshBasicMaterial({ map: texMap.texGoldenSword, transparent: true, side: THREE.DoubleSide, alphaTest: 0.5 }),
        golden_hoe: new THREE.MeshBasicMaterial({ map: texMap.texGoldenHoe, transparent: true, side: THREE.DoubleSide, alphaTest: 0.5 }),

        oak_sapling: new THREE.MeshBasicMaterial({ map: texMap.texOakSapling, transparent: true, side: THREE.DoubleSide, alphaTest: 0.5 }),
        spruce_sapling: new THREE.MeshBasicMaterial({ map: texMap.texSpruceSapling, transparent: true, side: THREE.DoubleSide, alphaTest: 0.5 }),
        birch_sapling: new THREE.MeshBasicMaterial({ map: texMap.texBirchSapling, transparent: true, side: THREE.DoubleSide, alphaTest: 0.5 }),
        jungle_sapling: new THREE.MeshBasicMaterial({ map: texMap.texJungleSapling, transparent: true, side: THREE.DoubleSide, alphaTest: 0.5 }),
        acacia_sapling: new THREE.MeshBasicMaterial({ map: texMap.texAcaciaSapling, transparent: true, side: THREE.DoubleSide, alphaTest: 0.5 }),
        dark_oak_sapling: new THREE.MeshBasicMaterial({ map: texMap.texDarkOakSapling, transparent: true, side: THREE.DoubleSide, alphaTest: 0.5 }),

        flint_and_steel: new THREE.MeshBasicMaterial({ map: texMap.texFlintAndSteel, transparent: true, side: THREE.DoubleSide, alphaTest: 0.5 }),
        farmland_dry: new THREE.MeshBasicMaterial({ map: texMap.texFarmland, vertexColors: true }),
        farmland_wet: new THREE.MeshBasicMaterial({ map: texMap.texFarmlandWet, vertexColors: true }),
        
        pumpkin_face: new THREE.MeshBasicMaterial({ map: texMap.texPumpkinFace, vertexColors: true }),
        pumpkin_side: new THREE.MeshBasicMaterial({ map: texMap.texPumpkinSide, vertexColors: true }),
        pumpkin_top: new THREE.MeshBasicMaterial({ map: texMap.texPumpkinTop, vertexColors: true }),
    });
}

export function getBlockMeshMaterials(blockId) {
    const faces = BLOCK_FACES[blockId];
    // Safety check for invalid blocks or missing faces
    if (!faces) {
        const m = new THREE.MeshBasicMaterial({ color: 0xff00ff });
        return [m, m, m, m, m, m];
    }

    const getMat = (name) => {
        const original = BLOCK_MATS[name];
        // Fallback to stone or simple grey if texture/material not loaded yet
        if (!original) {
            return BLOCK_MATS.stone ? BLOCK_MATS.stone.clone() : new THREE.MeshBasicMaterial({ color: 0x888888 });
        }
        const mat = original.clone();
        mat.vertexColors = false;
        
        const lambert = new THREE.MeshLambertMaterial({
            map: mat.map,
            color: mat.color,
            transparent: mat.transparent,
            side: mat.side,
            alphaTest: mat.alphaTest
        });

        if (name === 'leaves') lambert.color.setHex(0xffffff);
        if (name === 'grass_top') lambert.color.setHex(0x77bb77);
        return lambert;
    };

    if (typeof faces === 'string') {
        const m = getMat(faces);
        return [m, m, m, m, m, m];
    } else if (Array.isArray(faces)) {
        return faces.map(name => getMat(name));
    }
    
    // Fallback if structure is unknown
    const fm = new THREE.MeshBasicMaterial({ color: 0xff00ff });
    return [fm, fm, fm, fm, fm, fm];
}

export { loadBlockTexture };