import * as THREE from 'three';
import { BLOCKS, isFoliage } from '../blocks.js';
import { getMaxDurability } from '../constants.js';

export class InteractionController {
    constructor(world, physics) {
        this.world = world;
        this.physics = physics;
        this.raycaster = new THREE.Raycaster();
        this.raycaster.far = 6;
    }

    damageHeldItem(uiManager, amount = 1) {
        if (!uiManager || uiManager.controls.isCreative) return;
        
        const item = uiManager.inventory.getItem(uiManager.selectedSlot);
        if (!item) return;
        
        const maxD = getMaxDurability(item.id);
        if (maxD > 0) {
            item.damage = (item.damage || 0) + amount;
            if (item.damage >= maxD) {
                // Break tool
                uiManager.inventory.setItem(uiManager.selectedSlot, null);
                uiManager.player.setHeldItem(0);
                if (uiManager.audioManager) uiManager.audioManager.playBreak(item.id);
            }
            uiManager.updateUI();
        }
    }

    updateTargetBlock(camera) {
        this.raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
        const objects = this.world.chunkGroup ? this.world.chunkGroup.children : this.world.scene.children;
        const intersects = this.raycaster.intersectObjects(objects, true);
        
        for(let h of intersects) {
             if (h.object.userData.particle || h.object.userData.isPlayer || h.object.isPlayer || h.object.userData.isCloud) continue;
             
             if (!h.face) continue;

             const testP = h.point.clone().addScaledVector(h.face.normal, -0.01);
             const x = Math.floor(testP.x);
             const y = Math.floor(testP.y);
             const z = Math.floor(testP.z);
             const id = this.world.getBlock(x, y, z);
             
             if (id !== BLOCKS.WATER && id !== BLOCKS.AIR) {
                 return { x, y, z, id, faceNormal: h.face.normal };
             }
        }
        return null;
    }

    placeBlock(camera, playerPos, playerHeight, radius, sneak, onPlace, uiManager) {
        this.raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
        const objects = this.world.chunkGroup ? this.world.chunkGroup.children : this.world.scene.children;
        const intersects = this.raycaster.intersectObjects(objects, true);

        for (let hit of intersects) {
            if (hit.object.userData.particle || hit.object.userData.isPlayer || hit.object.isPlayer) continue;
            if (hit.object.parent && hit.object.parent.isPlayer) continue;

            if (!hit.face) continue;
            
            const testP = hit.point.clone().addScaledVector(hit.face.normal, -0.01);
            const targetX = Math.floor(testP.x);
            const targetY = Math.floor(testP.y);
            const targetZ = Math.floor(testP.z);
            const targetId = this.world.getBlock(targetX, targetY, targetZ);
            
            // Interaction Check (Furnace/Crafting/Doors)
            if (!sneak) {
                if (targetId === BLOCKS.CRAFTING_TABLE) {
                    if (uiManager) uiManager.openCraftingTable();
                    if (onPlace) onPlace();
                    return;
                }
                if (targetId === BLOCKS.FURNACE || targetId === BLOCKS.FURNACE_ON) {
                    if (uiManager) uiManager.openFurnace();
                    if (onPlace) onPlace();
                    return;
                }
                if (targetId === BLOCKS.STRUCTURE_BLOCK) {
                    if (uiManager) uiManager.openStructureBlock(targetX, targetY, targetZ);
                    if (onPlace) onPlace();
                    return;
                }
                
                // Door Interaction (Toggle Open/Close)
                // Check if target is ANY door block
                const isDoor = (
                    (targetId === BLOCKS.OAK_DOOR_BOTTOM || targetId === BLOCKS.OAK_DOOR_TOP) ||
                    (targetId === BLOCKS.SPRUCE_DOOR_BOTTOM || targetId === BLOCKS.SPRUCE_DOOR_TOP) ||
                    (targetId === BLOCKS.BIRCH_DOOR_BOTTOM || targetId === BLOCKS.BIRCH_DOOR_TOP) ||
                    (targetId === BLOCKS.JUNGLE_DOOR_BOTTOM || targetId === BLOCKS.JUNGLE_DOOR_TOP) ||
                    (targetId === BLOCKS.ACACIA_DOOR_BOTTOM || targetId === BLOCKS.ACACIA_DOOR_TOP) ||
                    (targetId === BLOCKS.DARK_OAK_DOOR_BOTTOM || targetId === BLOCKS.DARK_OAK_DOOR_TOP) ||
                    (targetId === BLOCKS.IRON_DOOR_BOTTOM || targetId === BLOCKS.IRON_DOOR_TOP)
                );

                if (isDoor) {
                    // Iron doors only open with redstone (not implemented fully, but for now strict interact lock)
                    if (targetId === BLOCKS.IRON_DOOR_BOTTOM || targetId === BLOCKS.IRON_DOOR_TOP) return;

                    // Toggle Door
                    const isBottom = (targetId % 2 !== 0); // Bottom IDs are usually odd in our sequence (41, 75, 77...)
                    // Actually let's just check ID
                    // Bottoms: 41, 75, 77, 79, 81, 83, 85
                    // Tops: 42, 76, 78, 80, 82, 84, 86
                    
                    // Simple partner logic: If ID is odd, partner is ID+1 (Top). If even, ID-1 (Bottom).
                    // This assumes strict pair ordering in constants.js which we followed.
                    
                    let partnerY = (targetId % 2 !== 0) ? targetY + 1 : targetY - 1;
                    const meta = this.world.getBlockMetadata(targetX, targetY, targetZ);
                    const isOpen = (meta & 4) !== 0;
                    const newMeta = isOpen ? (meta & 3) : (meta | 4);
                    
                    this.world.setBlock(targetX, targetY, targetZ, targetId, newMeta);
                    // Update partner
                    const partnerId = this.world.getBlock(targetX, partnerY, targetZ);
                    // Check if partner is actually a door part
                    if (partnerId === targetId + 1 || partnerId === targetId - 1) {
                        this.world.setBlock(targetX, partnerY, targetZ, partnerId, newMeta);
                    }
                    if (onPlace) onPlace(); // Trigger swing/sound
                    return;
                }
            }
            
            // Special: Bucket Logic / Items
            const heldId = uiManager ? uiManager.getSelectedBlockId() : 0;
            
            // Eating / Drinking
            if (heldId === BLOCKS.BREAD || heldId === BLOCKS.PUMPKIN_PIE || heldId === BLOCKS.GOLDEN_CARROT || heldId === BLOCKS.MILK_BUCKET) {
                 let healAmount = 0;
                 if (heldId === BLOCKS.BREAD) healAmount = 5;
                 if (heldId === BLOCKS.PUMPKIN_PIE) healAmount = 8;
                 if (heldId === BLOCKS.GOLDEN_CARROT) healAmount = 6;
                 
                 if (heldId === BLOCKS.MILK_BUCKET) {
                     if (uiManager) {
                         uiManager.replaceHeldItem(BLOCKS.BUCKET);
                         if (onPlace) onPlace(); 
                     }
                     return;
                 }
                 
                 if (healAmount > 0 && uiManager) {
                     if (uiManager.currentHealth < uiManager.maxHealth) {
                         uiManager.updateHealth(Math.min(uiManager.maxHealth, uiManager.currentHealth + healAmount));
                         uiManager.consumeHeldItem();
                         if (onPlace) onPlace();
                     }
                 }
                 return;
            }

            // Bone Meal Logic
            if (heldId === BLOCKS.BONE_MEAL) {
                // Grow Saplings
                if (targetId >= 160 && targetId <= 165) {
                    if (this.world.growTree(targetX, targetY, targetZ, targetId)) {
                        if (uiManager) uiManager.consumeHeldItem();
                        if (onPlace) onPlace();
                    }
                    return;
                }

                if (targetId === BLOCKS.WHEAT) {
                    // Instantly grow
                    this.world.setBlock(targetX, targetY, targetZ, BLOCKS.WHEAT, 7);
                    if (uiManager) uiManager.consumeHeldItem();
                    if (onPlace) onPlace();
                    return;
                }
                if (targetId === BLOCKS.GRASS) {
                    // Spawn grass/flowers in expanded radius
                    const range = 3; 
                    let success = false;
                    for (let dx = -range; dx <= range; dx++) {
                        for (let dz = -range; dz <= range; dz++) {
                            // Circular dispersion
                            if (dx*dx + dz*dz > range*range) continue;

                            const gx = targetX + dx;
                            const gz = targetZ + dz;
                            const gy = targetY + 1;
                            
                            if (this.world.getBlock(gx, targetY, gz) === BLOCKS.GRASS && 
                                this.world.getBlock(gx, gy, gz) === BLOCKS.AIR) {
                                
                                if (Math.random() < 0.3) {
                                    const rand = Math.random();
                                    let plantId = BLOCKS.GRASS_PLANT;
                                    if (rand > 0.9) plantId = BLOCKS.DANDELION;
                                    else if (rand > 0.8) plantId = BLOCKS.PINK_TULIP;
                                    else if (rand > 0.75) plantId = BLOCKS.LILY_OF_THE_VALLEY;
                                    
                                    this.world.setBlock(gx, gy, gz, plantId);
                                    success = true;
                                }
                            }
                        }
                    }
                    if (success) {
                        if (uiManager) uiManager.consumeHeldItem();
                        if (onPlace) onPlace();
                    }
                    return;
                }
            }

            // Axe Stripping Logic
            const isAxe = (heldId === BLOCKS.IRON_AXE || heldId === BLOCKS.WOODEN_AXE || heldId === BLOCKS.STONE_AXE || heldId === BLOCKS.DIAMOND_AXE || heldId === BLOCKS.GOLDEN_AXE);
            if (isAxe) {
                let strippedId = null;
                switch(targetId) {
                    case BLOCKS.LOG: strippedId = BLOCKS.STRIPPED_OAK_LOG; break;
                    case BLOCKS.BIRCH_LOG: strippedId = BLOCKS.STRIPPED_BIRCH_LOG; break;
                    case BLOCKS.SPRUCE_LOG: strippedId = BLOCKS.STRIPPED_SPRUCE_LOG; break;
                    case BLOCKS.JUNGLE_LOG: strippedId = BLOCKS.STRIPPED_JUNGLE_LOG; break;
                    case BLOCKS.ACACIA_LOG: strippedId = BLOCKS.STRIPPED_ACACIA_LOG; break;
                    case BLOCKS.DARK_OAK_LOG: strippedId = BLOCKS.STRIPPED_DARK_OAK_LOG; break;
                }
                
                if (strippedId) {
                    this.world.setBlock(targetX, targetY, targetZ, strippedId);
                    this.damageHeldItem(uiManager, 1);
                    if (onPlace) onPlace(); // Trigger swing/sound (could use custom sound)
                    return;
                }
            }

            // Hoe Logic
            if (heldId === BLOCKS.IRON_HOE || heldId === BLOCKS.WOODEN_HOE || heldId === BLOCKS.STONE_HOE || heldId === BLOCKS.DIAMOND_HOE || heldId === BLOCKS.GOLDEN_HOE) {
                if (targetId === BLOCKS.GRASS || targetId === BLOCKS.DIRT || targetId === BLOCKS.GRASS_PATH) {
                    const above = this.world.getBlock(targetX, targetY + 1, targetZ);
                    if (above === BLOCKS.AIR) {
                        this.world.setBlock(targetX, targetY, targetZ, BLOCKS.FARMLAND);
                        this.damageHeldItem(uiManager, 1);
                        if (onPlace) onPlace(); // Trigger swing
                        // Damage tool? (Todo)
                        return;
                    }
                }
            }

            // Seeds
            if (heldId === BLOCKS.WHEAT_SEEDS) {
                if (targetId === BLOCKS.FARMLAND || targetId === BLOCKS.FARMLAND_MOIST) {
                    const above = this.world.getBlock(targetX, targetY + 1, targetZ);
                    if (above === BLOCKS.AIR) {
                        this.world.setBlock(targetX, targetY + 1, targetZ, BLOCKS.WHEAT, 0);
                        if (uiManager) uiManager.consumeHeldItem();
                        if (onPlace) onPlace();
                        return;
                    }
                }
            }

            // Flint and Steel Logic
            if (heldId === BLOCKS.FLINT_AND_STEEL) {
                const p = hit.point.clone().addScaledVector(hit.face.normal, 0.1);
                const x = Math.floor(p.x);
                const y = Math.floor(p.y);
                const z = Math.floor(p.z);
                
                // If target is obsidian, try light portal
                if (targetId === BLOCKS.OBSIDIAN) {
                    const aboveX = targetX;
                    const aboveY = targetY + 1;
                    const aboveZ = targetZ;
                    
                    if (this.world.getBlock(aboveX, aboveY, aboveZ) === BLOCKS.AIR) {
                        // Try to construct full portal frame
                        if (this.tryLightPortal(aboveX, aboveY, aboveZ)) {
                            // Consume durability / swing
                            this.damageHeldItem(uiManager, 1);
                            if (onPlace) onPlace();
                            return;
                        }
                    }
                }

                const existing = this.world.getBlock(x, y, z);
                if (existing === BLOCKS.AIR) {
                    this.world.setBlock(x, y, z, BLOCKS.FIRE);
                    this.damageHeldItem(uiManager, 1);
                    if (onPlace) onPlace();
                    return;
                }
            }

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
                     if (uiManager) uiManager.consumeHeldItem(); // Fix: consume instead of replace
                     if (onPlace) onPlace();
                     return;
                 }
            }

            // 1. Fill Bucket
            if (heldId === BLOCKS.BUCKET) {
                if (targetId === BLOCKS.WATER || targetId === BLOCKS.LAVA) {
                    // Fill
                    const newId = (targetId === BLOCKS.WATER) ? BLOCKS.WATER_BUCKET : BLOCKS.LAVA_BUCKET;
                    this.world.setBlock(targetX, targetY, targetZ, BLOCKS.AIR);
                    if (uiManager) uiManager.replaceHeldItem(newId);
                    return;
                }
            }

            // 2. Place Liquid
            if (heldId === BLOCKS.WATER_BUCKET || heldId === BLOCKS.LAVA_BUCKET) {
                const placeP = hit.point.clone().addScaledVector(hit.face.normal, 0.1);
                const px = Math.floor(placeP.x);
                const py = Math.floor(placeP.y);
                const pz = Math.floor(placeP.z);
                const liquidId = (heldId === BLOCKS.WATER_BUCKET) ? BLOCKS.WATER : BLOCKS.LAVA;
                
                // Can we place here? (Allow replacing air, existing liquids, or non-solids like grass)
                const existing = this.world.getBlock(px, py, pz);
                // Also allow replacing if existing is replaceable foliage
                const replaceable = (existing === BLOCKS.AIR || existing === BLOCKS.WATER || existing === BLOCKS.LAVA || !this.physics.isSolid(px, py, pz));
                
                if (replaceable) { 
                     this.world.setBlock(px, py, pz, liquidId, 7); // Source block
                     if (uiManager) uiManager.replaceHeldItem(BLOCKS.BUCKET);
                     return;
                }
            }
            
            if (heldId === BLOCKS.TORCH) {
                 const bx = targetX;
                 const by = targetY;
                 const bz = targetZ;
                 
                 // Determine placement face
                 const nx = hit.face.normal.x;
                 const ny = hit.face.normal.y;
                 const nz = hit.face.normal.z;
                 
                 let meta = 5; // Default floor/up
                 let px = bx; let py = by; let pz = bz;

                 if (ny > 0.5) { // Top face -> Place on top
                     px = bx; py = by + 1; pz = bz;
                     meta = 5;
                 } else if (nx > 0.5) { // East face -> Place on East side (attach to West)
                     px = bx + 1; py = by; pz = bz;
                     meta = 1; 
                 } else if (nx < -0.5) { // West face -> Place on West side (attach to East)
                     px = bx - 1; py = by; pz = bz;
                     meta = 2;
                 } else if (nz > 0.5) { // South face -> Place on South side (attach to North)
                     px = bx; py = by; pz = bz + 1;
                     meta = 3;
                 } else if (nz < -0.5) { // North face -> Place on North side (attach to South)
                     px = bx; py = by; pz = bz - 1;
                     meta = 4;
                 } else {
                     return; // Bottom face? No torches on ceiling in MC usually
                 }

                 const id = this.world.getBlock(px, py, pz);
                 if (id === BLOCKS.AIR || id === BLOCKS.WATER) { // Replace water? Sure
                      this.world.setBlock(px, py, pz, BLOCKS.TORCH, meta);
                      if (uiManager) uiManager.consumeHeldItem();
                      if (onPlace) onPlace();
                      return;
                 }
            }
            
            // Pumpkin Placement (Directional)
            if (heldId === BLOCKS.PUMPKIN) {
                const p = hit.point.clone().addScaledVector(hit.face.normal, 0.1);
                const x = Math.floor(p.x);
                const y = Math.floor(p.y);
                const z = Math.floor(p.z);
                
                const existing = this.world.getBlock(x, y, z);
                // Check if replaceable (Water/Air)
                if (existing === BLOCKS.AIR || existing === BLOCKS.WATER) {
                    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
                    forward.y = 0;
                    forward.normalize();
                    
                    let meta = 0;
                    if (Math.abs(forward.x) > Math.abs(forward.z)) {
                        if (forward.x > 0) meta = 1; // Faces West (-X) ?? Wait, same as furnace
                        else meta = 3; 
                    } else {
                        if (forward.z > 0) meta = 2; 
                        else meta = 0; 
                    }
                    
                    this.world.setBlock(x, y, z, BLOCKS.PUMPKIN, meta);
                    if (uiManager) uiManager.consumeHeldItem();
                    if (onPlace) onPlace();
                    return;
                }
            }

            // Don't place against liquid logic (pass through liquid)
            if (targetId === BLOCKS.WATER || targetId === BLOCKS.LAVA) continue;

            // Calculate place position
            const p = hit.point.clone().addScaledVector(hit.face.normal, 0.1);
            
            const x = Math.floor(p.x);
            const y = Math.floor(p.y);
            const z = Math.floor(p.z);
            
            // Check if placing inside player
            const pMinX = playerPos.x - radius;
            const pMaxX = playerPos.x + radius;
            const pMinY = playerPos.y;
            const pMaxY = playerPos.y + playerHeight;
            const pMinZ = playerPos.z - radius;
            const pMaxZ = playerPos.z + radius;

            const bMinX = x; const bMaxX = x + 1;
            const bMinY = y; const bMaxY = y + 1;
            const bMinZ = z; const bMaxZ = z + 1;

            const intersectX = (pMinX < bMaxX && pMaxX > bMinX);
            const intersectY = (pMinY < bMaxY && pMaxY > bMinY);
            const intersectZ = (pMinZ < bMaxZ && pMaxZ > bMinZ);

            if (intersectX && intersectY && intersectZ) {
                // Allow placing foliage inside player (saplings etc)
                if (!isFoliage(heldId) && heldId !== BLOCKS.FIRE) return;
            }

            // Sapling Ground Check
            if (heldId >= 160 && heldId <= 165) {
                const below = this.world.getBlock(x, y - 1, z);
                if (below !== BLOCKS.GRASS && below !== BLOCKS.DIRT && below !== BLOCKS.FARMLAND && below !== BLOCKS.FARMLAND_MOIST) {
                    continue; // Invalid ground
                }
            }

            // Pass hit info to onPlace for Slab/Stair meta calculation
            if (onPlace) onPlace(x, y, z, { point: hit.point, face: hit.face });
            blockInteractionHandled = true; // Flag that we hit a block context
            break;
        }
        
        // Item Use (Eating/Drinking) - Fallback for Sky clicks
        const heldId = uiManager ? uiManager.getSelectedBlockId() : 0;
        
        if (heldId === BLOCKS.BREAD || heldId === BLOCKS.PUMPKIN_PIE || heldId === BLOCKS.GOLDEN_CARROT || heldId === BLOCKS.MILK_BUCKET) {
             let healAmount = 0;
             if (heldId === BLOCKS.BREAD) healAmount = 5;
             if (heldId === BLOCKS.PUMPKIN_PIE) healAmount = 8;
             if (heldId === BLOCKS.GOLDEN_CARROT) healAmount = 6;
             
             if (heldId === BLOCKS.MILK_BUCKET) {
                 if (uiManager) {
                     uiManager.replaceHeldItem(BLOCKS.BUCKET);
                     if (onPlace) onPlace(); 
                 }
                 return;
             }
             
             if (healAmount > 0 && uiManager) {
                 if (uiManager.currentHealth < uiManager.maxHealth) {
                     uiManager.updateHealth(Math.min(uiManager.maxHealth, uiManager.currentHealth + healAmount));
                     uiManager.consumeHeldItem();
                     if (onPlace) onPlace();
                 }
             }
        }
    }

    tryLightPortal(x, y, z) {
        // Check X-Axis Frame (North/South facing portal)
        if (this.checkAndFillPortal(x, y, z, 1, 0)) return true;
        // Check Z-Axis Frame (East/West facing portal)
        if (this.checkAndFillPortal(x, y, z, 0, 1)) return true;
        
        return false;
    }

    checkAndFillPortal(startX, startY, startZ, dx, dz) {
        // 1. Find Horizontal Bounds at startY (the level of fire/inside bottom)
        let minSide = 0;
        let maxSide = 0;
        
        // Find negative bound (obsidian)
        for (let i = 1; i < 22; i++) {
            const b = this.world.getBlock(startX - dx * i, startY, startZ - dz * i);
            if (b === BLOCKS.OBSIDIAN) {
                minSide = -i;
                break;
            }
            if (b !== BLOCKS.AIR && b !== BLOCKS.FIRE && b !== BLOCKS.NETHER_PORTAL) return false;
        }
        if (minSide === 0) return false;

        // Find positive bound (obsidian)
        for (let i = 1; i < 22; i++) {
            const b = this.world.getBlock(startX + dx * i, startY, startZ + dz * i);
            if (b === BLOCKS.OBSIDIAN) {
                maxSide = i;
                break;
            }
            if (b !== BLOCKS.AIR && b !== BLOCKS.FIRE && b !== BLOCKS.NETHER_PORTAL) return false;
        }
        if (maxSide === 0) return false;

        const width = maxSide - minSide - 1;
        if (width < 2) return false; // Minimum 2 wide

        // 2. Find Internal Height
        // Scan up from inside (minSide + 1) to find ceiling obsidian
        // Scan a valid column (minSide + 1)
        let portalHeight = 0;
        const checkX = startX + dx * (minSide + 1);
        const checkZ = startZ + dz * (minSide + 1);
        
        for (let h = 0; h < 22; h++) {
            const b = this.world.getBlock(checkX, startY + h, checkZ);
            if (b === BLOCKS.OBSIDIAN) {
                portalHeight = h;
                break;
            }
            if (b !== BLOCKS.AIR && b !== BLOCKS.FIRE && b !== BLOCKS.NETHER_PORTAL) return false;
        }
        if (portalHeight < 3) return false; // Minimum 3 high inside

        // 3. Verify Frame
        // Bottom Row (Already mostly checked, but verify full width at startY - 1)
        for(let w = minSide + 1; w < maxSide; w++) {
            const b = this.world.getBlock(startX + dx * w, startY - 1, startZ + dz * w);
            if (b !== BLOCKS.OBSIDIAN) return false;
        }
        
        // Top Row (at startY + portalHeight)
        for(let w = minSide + 1; w < maxSide; w++) {
            const b = this.world.getBlock(startX + dx * w, startY + portalHeight, startZ + dz * w);
            if (b !== BLOCKS.OBSIDIAN) return false;
        }

        // Left Column (minSide) from startY to startY + portalHeight - 1
        for(let h = 0; h < portalHeight; h++) {
            const b = this.world.getBlock(startX + dx * minSide, startY + h, startZ + dz * minSide);
            if (b !== BLOCKS.OBSIDIAN) return false;
        }

        // Right Column (maxSide) from startY to startY + portalHeight - 1
        for(let h = 0; h < portalHeight; h++) {
            const b = this.world.getBlock(startX + dx * maxSide, startY + h, startZ + dz * maxSide);
            if (b !== BLOCKS.OBSIDIAN) return false;
        }

        // 4. Verify Interior (must be empty/fire/portal)
        for(let w = minSide + 1; w < maxSide; w++) {
            for(let h = 0; h < portalHeight; h++) {
                const b = this.world.getBlock(startX + dx * w, startY + h, startZ + dz * w);
                if (b !== BLOCKS.AIR && b !== BLOCKS.FIRE && b !== BLOCKS.NETHER_PORTAL) return false;
            }
        }

        // 5. Fill Portal
        for(let w = minSide + 1; w < maxSide; w++) {
            for(let h = 0; h < portalHeight; h++) {
                this.world.setBlock(startX + dx * w, startY + h, startZ + dz * w, BLOCKS.NETHER_PORTAL);
            }
        }
        
        return true;
    }
}

