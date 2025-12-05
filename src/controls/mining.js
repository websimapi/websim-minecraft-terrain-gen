import * as THREE from 'three';
import { BLOCKS, getMaxDurability } from '../constants.js';

export class MiningController {
    constructor(world, particleSystem) {
        this.world = world;
        this.particleSystem = particleSystem;
        
        this.miningProgress = 0;
        this.miningTarget = null;
        this.miningDelay = 0;
    }

    getBlockHardness(id) {
        if (id === BLOCKS.LEAVES || id === BLOCKS.SUGAR_CANE) return 0.2;
        if (id === BLOCKS.GRASS || id === BLOCKS.DIRT || id === BLOCKS.SAND || id === BLOCKS.GRAVEL || id === BLOCKS.CLAY || id === BLOCKS.SNOW) return 0.6;
        if (id === BLOCKS.LOG || id === BLOCKS.PLANKS || id === BLOCKS.CRAFTING_TABLE) return 2.0;
        if (id === BLOCKS.STONE || id === BLOCKS.GRANITE || id === BLOCKS.DIORITE || id === BLOCKS.ANDESITE || id === BLOCKS.TERRACOTTA || id === BLOCKS.COBBLESTONE || id === BLOCKS.FURNACE || id === BLOCKS.FURNACE_ON) return 1.5;
        if (id === BLOCKS.IRON_ORE || id === BLOCKS.GOLD_ORE || id === BLOCKS.DIAMOND_ORE || id === BLOCKS.EMERALD_ORE || id === BLOCKS.REDSTONE_ORE || id === BLOCKS.LAPIS_ORE || id === BLOCKS.COAL_ORE) return 3.0;
        if (id === BLOCKS.OBSIDIAN) return 50.0;
        if (id === BLOCKS.BEDROCK) return Infinity;
        if (id === BLOCKS.FIRE) return 0; // Instabreak
        return 1.0;
    }

    getToolMultiplier(heldId, targetId) {
        if (!heldId) return 1.0;

        if (heldId === BLOCKS.IRON_PICKAXE) {
            if ([BLOCKS.STONE, BLOCKS.COBBLESTONE, BLOCKS.GRANITE, BLOCKS.DIORITE, BLOCKS.ANDESITE, BLOCKS.TERRACOTTA, 
                 BLOCKS.IRON_ORE, BLOCKS.GOLD_ORE, BLOCKS.DIAMOND_ORE, BLOCKS.EMERALD_ORE, BLOCKS.REDSTONE_ORE, BLOCKS.LAPIS_ORE, BLOCKS.COAL_ORE,
                 BLOCKS.FURNACE, BLOCKS.FURNACE_ON, BLOCKS.OBSIDIAN, BLOCKS.NETHERRACK].includes(targetId)) {
                return 6.0;
            }
        }
        if (heldId === BLOCKS.IRON_SHOVEL) {
            if ([BLOCKS.GRASS, BLOCKS.DIRT, BLOCKS.SAND, BLOCKS.GRAVEL, BLOCKS.CLAY, BLOCKS.SNOW, BLOCKS.SOUL_SAND].includes(targetId)) {
                return 6.0;
            }
        }
        if (heldId === BLOCKS.IRON_AXE) {
            if ([BLOCKS.LOG, BLOCKS.PLANKS, BLOCKS.CRAFTING_TABLE].includes(targetId)) {
                return 6.0;
            }
        }
        
        return 1.0;
    }

    update(delta, isDigging, targetedBlock, heldItemId) {
        if (this.miningDelay > 0) this.miningDelay -= delta;

        if (!isDigging) {
            this.miningProgress = 0;
            this.miningTarget = null;
            return { mining: false, progress: 0 };
        }

        if (targetedBlock) {
            const { x, y, z, id } = targetedBlock;

            if (!this.miningTarget || this.miningTarget.x !== x || this.miningTarget.y !== y || this.miningTarget.z !== z) {
                this.miningTarget = {x, y, z, id};
                this.miningProgress = 0;
            }

            const hardness = this.getBlockHardness(id);
            const multiplier = this.getToolMultiplier(heldItemId, id);
            
            this.miningProgress += delta * multiplier;

            if (this.miningProgress > 0.1 && Math.random() < 0.2) {
                 if (this.particleSystem) {
                     const center = new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5);
                     this.particleSystem.spawnBlockParticles(center, id);
                 }
            }

            if (this.miningProgress >= hardness) {
                this.breakBlock(x, y, z, id, heldItemId);
                this.miningProgress = 0;
                this.miningTarget = null;
                return { mining: true, progress: 1.0, broke: true };
            }

            return { mining: true, progress: this.miningProgress / hardness };
        } else {
            this.miningProgress = 0;
            this.miningTarget = null;
            return { mining: false, progress: 0 };
        }
    }

    breakBlock(x, y, z, id, heldItemId) {
        if (id !== 0 && id !== BLOCKS.WATER && id !== BLOCKS.BEDROCK) {
            const center = new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5);
            if (this.particleSystem) this.particleSystem.spawnBlockParticles(center, id);
            
            // Damage Tool
            if (this.itemManager && this.itemManager.world.uiManager) { // Hacky access but valid
                const ui = this.itemManager.world.uiManager;
                if (!ui.controls.isCreative) {
                    const item = ui.inventory.getItem(ui.selectedSlot);
                    if (item && item.id === heldItemId) {
                        const maxD = getMaxDurability(heldItemId);
                        if (maxD > 0) {
                            item.damage = (item.damage || 0) + 1;
                            if (item.damage >= maxD) {
                                ui.inventory.setItem(ui.selectedSlot, null);
                                ui.player.setHeldItem(0);
                                // Play break sound? Main logic handles loop but here specific tool break sound is nice.
                            }
                            ui.updateUI();
                        }
                    }
                }
            }

            let dropId = id;
            let count = 1;

            if (id === BLOCKS.STONE || id === BLOCKS.GRANITE || id === BLOCKS.DIORITE || id === BLOCKS.ANDESITE) dropId = BLOCKS.COBBLESTONE;
            if (id === BLOCKS.GRASS) dropId = BLOCKS.DIRT;
            if (id === BLOCKS.LEAVES) dropId = null; // Chance for sapling?
            if (id === BLOCKS.DEAD_BUSH) dropId = BLOCKS.STICK;
            if (id === BLOCKS.FIRE) dropId = null; // No drop for fire
            
            // Ore Drops - Adjusted for smelting logic
            if (id === BLOCKS.DIAMOND_ORE) dropId = BLOCKS.DIAMOND;
            if (id === BLOCKS.COAL_ORE) dropId = BLOCKS.COAL;
            if (id === BLOCKS.LAPIS_ORE) dropId = BLOCKS.LAPIS_ORE;
            if (id === BLOCKS.REDSTONE_ORE) dropId = BLOCKS.REDSTONE_ORE;
            if (id === BLOCKS.EMERALD_ORE) dropId = BLOCKS.EMERALD_ORE;
            
            // Wheat Logic
            if (id === BLOCKS.WHEAT) {
                const meta = this.world.getBlockMetadata(x, y, z);
                if (meta >= 7) {
                    // Fully grown: Drop Wheat Item + Seeds
                    if (this.itemManager) {
                        this.itemManager.spawnItem(center, BLOCKS.WHEAT_ITEM);
                        // Chance for extra seeds
                        let seedCount = 1 + (Math.random() > 0.5 ? 1 : 0) + (Math.random() > 0.5 ? 1 : 0);
                        this.itemManager.spawnItem(center, BLOCKS.WHEAT_SEEDS, null, seedCount);
                    }
                    dropId = null; // Handled manually
                } else {
                    // Not grown: Drop Seeds only
                    dropId = BLOCKS.WHEAT_SEEDS;
                }
            }
            
            // Iron/Gold drop themselves to be smelted
            if (id === BLOCKS.IRON_ORE) dropId = BLOCKS.IRON_ORE;
            if (id === BLOCKS.GOLD_ORE) dropId = BLOCKS.GOLD_ORE;
            
            // Furnace drops Furnace (off)
            if (id === BLOCKS.FURNACE_ON) dropId = BLOCKS.FURNACE;

            if (this.itemManager && dropId) {
                for(let i=0; i<count; i++) this.itemManager.spawnItem(center, dropId);
            }

            this.world.setBlock(x, y, z, 0);
            this.miningDelay = 0.25;
        }
    }

    setItemManager(itemManager) {
        this.itemManager = itemManager;
    }
}

