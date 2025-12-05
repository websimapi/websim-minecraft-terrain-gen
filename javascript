                    // Door Logic
                    if (id === BLOCKS.OAK_DOOR_BOTTOM || id === BLOCKS.OAK_DOOR_TOP) {
                        this.addDoor(...);
                        continue;
                    }

    if (isFoliage(blockId)) {
        // ... sprite rendering

// ... existing code ...

// src/blocks.js

// src/blocks.js
// ...

src/blocks.js

// ... existing code ...
registerAtlasTexture('sand', './sand (1).png');
registerAtlasTexture('log_side', './oak_log (1).png');
registerAtlasTexture('log_top', './oak_log_top (1).png');
registerAtlasTexture('leaves', './leaves.png');
registerAtlasTexture('gravel', './gravel.png');
// ... existing code ...
registerAtlasTexture('oak_door_top', './oak_door_top.png');
registerAtlasTexture('oak_door_bottom', './oak_door_bottom.png');
registerAtlasTexture('oak_door_item', './oak_door (1).png');
registerAtlasTexture('bucket', './bucket.png');
registerAtlasTexture('water_bucket', './water_bucket.png');
// ... existing code ...
registerAtlasTexture('wheat_seeds', './wheat_seeds.png');
registerAtlasTexture('wheat', './wheat.png');
for(let i=0; i<=7; i++) {
    registerAtlasTexture(`wheat_stage_${i}`, `./wheat_stage${i}.png`);
}

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
// ... existing code ...
// Legacy textures for UI/Items (Loaded here to pass to initBlockMats)
const texMap = {
    texGrassTop: loadBlockTexture('./grass_carried.png'),
    texGrassSide: loadBlockTexture('./grass_side_carried.png'),
    texDirt: loadBlockTexture('./dirt.png'),
    texStone: loadBlockTexture('./stone (1).png'),
    texWater: loadBlockTexture('./water_flow.png'),
    texSand: loadBlockTexture('./sand (1).png'),
    texLogSide: loadBlockTexture('./oak_log (1).png'),
    texLogTop: loadBlockTexture('./oak_log_top (1).png'),
    texLeaves: loadBlockTexture('./leaves.png'),
    texGravel: loadBlockTexture('./gravel.png'),
// ... existing code ...
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
// ... existing code ...
// Map of block IDs to texture names for item icons
export const TEXTURE_MAP = {
    [BLOCKS.IRON_INGOT]: 'iron_ingot',
    [BLOCKS.GOLD_INGOT]: 'gold_ingot',
    [BLOCKS.OAK_DOOR_ITEM]: 'oak_door_item',
    [BLOCKS.SPRUCE_DOOR_ITEM]: 'spruce_door_item',
    [BLOCKS.BIRCH_DOOR_ITEM]: 'birch_door_item',
    [BLOCKS.JUNGLE_DOOR_ITEM]: 'jungle_door_item',
    [BLOCKS.ACACIA_DOOR_ITEM]: 'acacia_door_item',
    [BLOCKS.DARK_OAK_DOOR_ITEM]: 'dark_oak_door_item',
    [BLOCKS.IRON_DOOR_ITEM]: 'iron_door_item',
    [BLOCKS.BUCKET]: 'bucket',
    [BLOCKS.WATER_BUCKET]: 'water_bucket',
// ... existing code ...

src/constants.js

// ... existing code ...
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

    BUCKET: 100,
    WATER_BUCKET: 101,
// ... existing code ...
    RAW_GOLD: 108,
    OAK_DOOR_ITEM: 109,
    SPRUCE_DOOR_ITEM: 119,
    BIRCH_DOOR_ITEM: 120,
    JUNGLE_DOOR_ITEM: 121,
    ACACIA_DOOR_ITEM: 122,
    DARK_OAK_DOOR_ITEM: 123,
    IRON_DOOR_ITEM: 124,
    TORCH: 110,
    IRON_SHOVEL: 111,
// ... existing code ...
    if (id === BLOCKS.BUCKET) return 16; 
    if (id === BLOCKS.SNOW) return 16; // Snowballs/layers sometimes 16
    // Doors
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
// ... existing code ...
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

    [BLOCKS.OBSIDIAN]: 'obsidian',
    [BLOCKS.TORCH]: 'torch',
// ... existing code ...
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
// ... existing code ...

src/rendering/block_materials.js

// ... existing code ...
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
// ... existing code ...

src/chunk/chunk_mesher.js

// ... existing code ...
    getBiomeColor(temp, humidity, matName) {
        // Alpha-style Neon Green Color Profile
        // Base is extremely vibrant
        const baseR = 0.45;
        const baseG = 1.0; 
        const baseB = 0.15;

        // Normalize inputs
        const t = THREE.MathUtils.clamp((temp + 1) / 2, 0, 1);
        const h = THREE.MathUtils.clamp((humidity + 1) / 2, 0, 1);

        let r = baseR;
        let g = baseG;
        let b = baseB;

        // Temperature effect (Cold -> Blue/Dull)
        const coldFactor = (1.0 - t);
        r -= coldFactor * 0.1;
        g -= coldFactor * 0.3; // Less green in cold
        b += coldFactor * 0.4; // More blue

        // Humidity effect (Dry -> Yellow/Brown)
        const dryFactor = (1.0 - h);
        r += dryFactor * 0.3; // More red (yellow)
        g -= dryFactor * 0.2; // Less green
        b -= dryFactor * 0.1;

        // Clamp
        r = THREE.MathUtils.clamp(r, 0, 1);
        g = THREE.MathUtils.clamp(g, 0, 1);
        b = THREE.MathUtils.clamp(b, 0, 1);
        
        // Block specific overrides
        if (matName === 'water') {
            r = 1.0; g = 1.0; b = 1.0; 
            if (t < 0.3) { r *= 0.6; g *= 0.6; b *= 0.9; } 
            else if (h > 0.6) { r *= 0.4; g *= 0.6; b *= 0.4; } 
            else { r = 0.6; g = 0.8; b = 1.0; }
        }
        
        if (matName === 'birch_leaves') { r = 0.5; g = 0.7; b = 0.4; } 
        else if (matName === 'spruce_leaves') { r = 0.4; g = 0.6; b = 0.4; } 
        else if (matName === 'jungle_leaves') { r = 0.3; g = 0.9; b = 0.1; } 
        else if (matName === 'acacia_leaves') { r = 0.6; g = 0.6; b = 0.1; } 
        else if (matName === 'dark_oak_leaves') { r = 0.2; g = 0.5; b = 0.1; }

        _colorCache.r = r; _colorCache.g = g; _colorCache.b = b;
        return _colorCache;
    }

    clearBuffers(geo) {
// ... existing code ...
                    if (id === BLOCKS.NETHER_PORTAL) {
                        this.addPortal(chunk, x, y, z, id, geoTrans); // Portal is transparent
                        continue;
                    }

                    if (isFoliage(id) && 
                        id !== BLOCKS.OAK_DOOR_BOTTOM && id !== BLOCKS.OAK_DOOR_TOP &&
                        !(id >= 75 && id <= 86)) { // Exclude all new door blocks
                        
                        // Tall Grass uses geoNoShadow per request
                        const targetGeo = (id === BLOCKS.TALL_GRASS_BOTTOM || id === BLOCKS.TALL_GRASS_TOP) ? geoNoShadow : geoFoliage;
                        this.addFoliage(chunk, x, y, z, id, targetGeo, colBiome);
                        continue;
                    }

                    const isWater = (id === BLOCKS.WATER);
                    const isLava = (id === BLOCKS.LAVA);
                    let facesDef = BLOCK_FACES[id]; 
                    if (!facesDef) continue;

                    // Door Logic
                    if (id === BLOCKS.OAK_DOOR_BOTTOM || id === BLOCKS.OAK_DOOR_TOP ||
                        (id >= 75 && id <= 86)) {
                        this.addDoor(chunk, x, y, z, id, geoNoShadow, chunk.metadata[chunk.idx(x, y, z)]);
                        continue;
                    }

                    // Handle Block Rotation (Furnace)
                    if (id === BLOCKS.FURNACE || id === BLOCKS.FURNACE_ON) {
// ... existing code ...
                        const isNeighborTransparent = (nId === BLOCKS.AIR || 
                                                     nId === BLOCKS.WATER || 
                                                     nId === BLOCKS.LAVA || 
                                                     nId === BLOCKS.LEAVES || 
                                                     nId === BLOCKS.GLASS ||
                                                     nId === BLOCKS.SUGAR_CANE || 
                                                     nId === BLOCKS.CACTUS || 
                                                     (nId === BLOCKS.OAK_DOOR_BOTTOM || nId === BLOCKS.OAK_DOOR_TOP) ||
                                                     (nId >= 75 && nId <= 86) || // New Doors
                                                     nId === BLOCKS.TORCH ||
                                                     nId === BLOCKS.FARMLAND ||
                                                     nId === BLOCKS.FARMLAND_MOIST ||
                                                     nId === BLOCKS.FIRE ||
                                                     nId === BLOCKS.NETHER_PORTAL ||
                                                     isFoliage(nId) ||
                                                     nId === -1);

                        if (isWater) {
// ... existing code ...

src/controls/interaction.js

// ... existing code ...
                if (targetId === BLOCKS.STRUCTURE_BLOCK) {
                    if (uiManager) uiManager.openStructureBlock(targetX, targetY, targetZ);
                    if (onPlace) onPlace();
                    return;
                }
                
                const isDoor = (
                    (targetId === BLOCKS.OAK_DOOR_BOTTOM || targetId === BLOCKS.OAK_DOOR_TOP) ||
                    (targetId >= 75 && targetId <= 86)
                );

                if (isDoor) {
                    // Iron doors (85, 86) only open with redstone
                    if (targetId === BLOCKS.IRON_DOOR_BOTTOM || targetId === BLOCKS.IRON_DOOR_TOP) return;

                    // Toggle Door
                    // If ID is odd (Bottom for most), partner is +1. If even (Top), partner is -1.
                    // Oak: 41(B), 42(T). 41 is odd.
                    // Spruce: 75(B), 76(T). 75 is odd.
                    // ... Iron: 85(B), 86(T).
                    
                    let partnerY = (targetId % 2 !== 0) ? targetY + 1 : targetY - 1;
                    const meta = this.world.getBlockMetadata(targetX, targetY, targetZ);
                    const isOpen = (meta & 4) !== 0;
                    const newMeta = isOpen ? (meta & 3) : (meta | 4);
                    
                    this.world.setBlock(targetX, targetY, targetZ, targetId, newMeta);
                    // Update partner
                    const partnerId = this.world.getBlock(targetX, partnerY, targetZ);
                    // Partner should be adjacent ID
                    if (partnerId === targetId + 1 || partnerId === targetId - 1) {
                        this.world.setBlock(targetX, partnerY, targetZ, partnerId, newMeta);
                    }
                    if (onPlace) onPlace(); 
                    return;
                }
            }
            
            // Special: Bucket Logic
// ... existing code ...
            // Door Placement Logic
            const doorItems = {
                [BLOCKS.OAK_DOOR_ITEM]: [BLOCKS.OAK_DOOR_BOTTOM, BLOCKS.OAK_DOOR_TOP],
                [BLOCKS.SPRUCE_DOOR_ITEM]: [BLOCKS.SPRUCE_DOOR_BOTTOM, BLOCKS.SPRUCE_DOOR_TOP],
                [BLOCKS.BIRCH_DOOR_ITEM]: [BLOCKS.BIRCH_DOOR_BOTTOM, BLOCKS.BIRCH_DOOR_TOP],
                [BLOCKS.JUNGLE_DOOR_ITEM]: [BLOCKS.JUNGLE_DOOR_BOTTOM, BLOCKS.JUNGLE_DOOR_TOP],
                [BLOCKS.ACACIA_DOOR_ITEM]: [BLOCKS.ACACIA_DOOR_BOTTOM, BLOCKS.ACACIA_DOOR_TOP],
                [BLOCKS.DARK_OAK_DOOR_ITEM]: [BLOCKS.DARK_OAK_DOOR_BOTTOM, BLOCKS.DARK_OAK_DOOR_TOP],
                [BLOCKS.IRON_DOOR_ITEM]: [BLOCKS.IRON_DOOR_BOTTOM, BLOCKS.IRON_DOOR_TOP]
            };

            if (doorItems[heldId]) {
                 const p = hit.point.clone().addScaledVector(hit.face.normal, 0.1);
                 const x = Math.floor(p.x);
                 const y = Math.floor(p.y);
                 const z = Math.floor(p.z);
                 
                 // Check space (needs 2 high)
                 const b1 = this.world.getBlock(x, y, z);
                 const b2 = this.world.getBlock(x, y + 1, z);
                 if (b1 === BLOCKS.AIR && b2 === BLOCKS.AIR) {
                     const [bottomId, topId] = doorItems[heldId];
                     this.world.setBlock(x, y, z, bottomId, 0);
                     this.world.setBlock(x, y + 1, z, topId, 0);
                     if (uiManager) uiManager.consumeHeldItem();
                     if (onPlace) onPlace();
                     return;
                 }
            }

            // 1. Fill Bucket
            if (heldId === BLOCKS.BUCKET) {
// ... existing code ...

src/physics.js

// ... existing code ...
            id === BLOCKS.WHEAT ||
            id === BLOCKS.OAK_DOOR_BOTTOM || // Handled specially in checkCollision
            id === BLOCKS.OAK_DOOR_TOP ||
            (id >= 75 && id <= 86) || // New Doors
            id === -1 // Unloaded
           ) return false;
        
        return true;
    }

    checkCollision(pos, radius, height) {
// ... existing code ...
                     // 1. Standard Solid Check
                     if (this.isSolid(x, y, z)) return true;

                     // 2. Special Door Check
                     const id = this.world.getBlock(x, y, z);
                     if (id === BLOCKS.OAK_DOOR_BOTTOM || id === BLOCKS.OAK_DOOR_TOP || (id >= 75 && id <= 86)) {
                         const meta = this.world.getBlockMetadata(x, y, z);
                         const isOpen = (meta & 4) !== 0;
                         const facing = meta & 3; 
                         const T = 3/16; 
// ... existing code ...

src/player_hand.js

// ... existing code ...
            // Upright for Door Items
            if (this.currentBlockId === BLOCKS.OAK_DOOR_ITEM ||
                this.currentBlockId === BLOCKS.SPRUCE_DOOR_ITEM ||
                this.currentBlockId === BLOCKS.BIRCH_DOOR_ITEM ||
                this.currentBlockId === BLOCKS.JUNGLE_DOOR_ITEM ||
                this.currentBlockId === BLOCKS.ACACIA_DOOR_ITEM ||
                this.currentBlockId === BLOCKS.DARK_OAK_DOOR_ITEM ||
                this.currentBlockId === BLOCKS.IRON_DOOR_ITEM) {
                tf.rotZ = 180;
                tf.rotX = 0;
                tf.y += 1.0;
                tf.scale *= 0.8; // Fit better
            }

            // Flip Axe Texture (Left-Right)
            if (this.currentBlockId === BLOCKS.IRON_AXE) {
// ... existing code ...

src/ui/chat.js

// ... existing code ...
            '/spawn zombie',
            '/spawn cow',
            '/heal',
            '/tickspeed 3',
            '/locate biome desert',
            '/debug arm',
            '/locate biome plains',
            '/locate biome forest',
            '/locate biome mountains',
// ... existing code ...
        } else if (command === '/tickspeed') {
            const val = parseInt(parts[1]);
            if (!isNaN(val)) {
                window.dispatchEvent(new CustomEvent('cmd-tickspeed', { detail: val }));
                this.addMessage('System', `Set random tick speed to ${val}`);
            } else {
                this.addMessage('System', 'Usage: /tickspeed [number]');
            }
        } else if (command === '/debug') {
            if (parts[1] === 'arm') {
                window.dispatchEvent(new CustomEvent('cmd-debug-arm'));
                this.addMessage('System', 'Toggled Arm Debug Menu.');
            }
        } else if (command === '/locate') {
            if (parts[1] === 'biome' && parts[2]) {
// ... existing code ...

src/main.js

// ... existing code ...
window.addEventListener('cmd-spawn-cow', () => {
    const pPos = controls.getPosition();
    cowManager.spawnCow(pPos, true);
});

window.addEventListener('cmd-debug-arm', () => {
    gui._hidden ? gui.show() : gui.hide();
});

controls.onPlace = (x, y, z) => {
    if (uiManager.isInventoryOpen) return;
// ... existing code ...

