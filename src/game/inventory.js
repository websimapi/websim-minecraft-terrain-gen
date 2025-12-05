import { CONFIG } from '../config.js';
import { BLOCKS, getStackLimit, getMaxDurability } from '../constants.js';

export class Inventory {
    constructor(totalSlots, hotbarSlots) {
        this.totalSlots = totalSlots;
        this.hotbarSlots = hotbarSlots;
        this.slots = new Array(totalSlots).fill(null);
        this.selectedSlot = 0;
        this.lastChangedSlots = [];

        this.NON_COLLECTABLE_IDS = new Set([
            BLOCKS.AIR, 
            BLOCKS.WATER, 
            BLOCKS.BEDROCK
        ]);
    }

    getItem(index) {
        return this.slots[index];
    }

    setItem(index, item) {
        // Sanitize: Treat Air or empty count as null to prevent ghost items
        if (item) {
            // Strict validation: ID must be a positive number
            if (typeof item.id !== 'number' || item.id <= 0 || item.count <= 0 || isNaN(item.count) || isNaN(item.id)) {
                item = null;
            }
        }
        this.slots[index] = item;
    }

    pickupItem(blockId, count = 1, durability = 0) {
        this.lastChangedSlots = [];
        if (this.NON_COLLECTABLE_IDS.has(blockId)) return 0;
        let remaining = count;
        const maxStack = getStackLimit(blockId);
        const maxD = getMaxDurability(blockId);

        // If item has damage, it is unstackable effectively unless we merge (complex). 
        // For simplicity, damaged items don't stack.
        const isDamaged = (maxD > 0 && durability > 0);

        if (!isDamaged) {
            // Try to stack first
            for (let i = 0; i < this.totalSlots; i++) {
                if (this.slots[i] && this.slots[i].id === blockId && this.slots[i].count < maxStack) {
                    // Check if target slot has damage? If so, don't stack clean item onto it.
                    if (this.slots[i].damage && this.slots[i].damage > 0) continue;
                    
                    const space = maxStack - this.slots[i].count;
                    const add = Math.min(space, remaining);
                    this.slots[i].count += add;
                    this.lastChangedSlots.push(i);
                    remaining -= add;
                    if (remaining <= 0) break;
                }
            }
        }

        // Try hotbar first for empty slot
        for (let i = 0; i < this.hotbarSlots; i++) {
            if (!this.slots[i]) {
                const add = Math.min(maxStack, remaining);
                this.slots[i] = { id: blockId, count: add, damage: durability };
                this.lastChangedSlots.push(i);
                remaining -= add;
                if (remaining <= 0) break;
            }
        }

        // Try rest of inventory if we still have items
        if (remaining > 0) {
            for (let i = this.hotbarSlots; i < this.totalSlots; i++) {
                if (!this.slots[i]) {
                    const add = Math.min(maxStack, remaining);
                    this.slots[i] = { id: blockId, count: add, damage: durability };
                    this.lastChangedSlots.push(i);
                    remaining -= add;
                    if (remaining <= 0) break;
                }
            }
        }
        
        return count - remaining; 
    }

    consumeSelected() {
        const item = this.slots[this.selectedSlot];
        if (item) {
            item.count--;
            if (item.count <= 0) {
                this.slots[this.selectedSlot] = null;
            }
            return true;
        }
        return false;
    }

    getSelectedBlockId() {
        const item = this.slots[this.selectedSlot];
        return item ? item.id : 0;
    }

    giveAllItems() {
        const MAX_ID = BLOCKS.MAGMA; // Adjusted range if needed, e.g. max ID in BLOCKS
        let inventoryIndex = 0;

        // Iterate BLOCKS object to get all IDs
        const allIds = Object.values(BLOCKS).filter(id => typeof id === 'number' && id > 0).sort((a,b) => a-b);
        const uniqueIds = [...new Set(allIds)]; // dedupe

        for (let id of uniqueIds) {
            if (this.NON_COLLECTABLE_IDS.has(id)) continue;
            if (inventoryIndex >= this.totalSlots) break;

            this.slots[inventoryIndex] = {
                id: id,
                count: getStackLimit(id)
            };
            inventoryIndex++;
        }
    }

    clear() {
        this.slots.fill(null);
    }
}