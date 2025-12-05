import { BLOCKS, renderBlockIcon } from '../blocks.js';

export class AchievementManager {
    constructor(uiManager) {
        this.ui = uiManager;
        this.container = document.getElementById('achievement-container');
        
        // State to track unlocked achievements
        this.unlocked = new Set();

        this.achievements = {
            'open_inventory': {
                title: "Taking Inventory",
                desc: "Press 'E' to open your inventory.",
                iconBlock: BLOCKS.CRAFTING_TABLE
            },
            'mine_wood': {
                title: "Getting Wood",
                desc: "Attack a tree until a block of wood pops out.",
                iconBlock: BLOCKS.LOG
            },
            'craft_bench': {
                title: "Benchmarking",
                desc: "Craft a workbench with four blocks of planks.",
                iconBlock: BLOCKS.CRAFTING_TABLE
            },
            'mine_stone': {
                title: "Stone Age",
                desc: "Mine stone with your new pickaxe.",
                iconBlock: BLOCKS.COBBLESTONE
            },
            'smelt_iron': {
                title: "Acquire Hardware",
                desc: "Smelt an iron ingot.",
                iconBlock: BLOCKS.IRON_INGOT
            },
            'diamonds': {
                title: "DIAMONDS!",
                desc: "Acquire diamonds with your iron pickaxe.",
                iconBlock: BLOCKS.DIAMOND
            },
            'kill_zombie': {
                title: "Monster Hunter",
                desc: "Attack and destroy a monster.",
                iconBlock: BLOCKS.IRON_INGOT // Fallback
            },
            'nether': {
                title: "We Need to Go Deeper",
                desc: "Build a portal to the Nether.",
                iconBlock: BLOCKS.OBSIDIAN
            },
            'lan_party': {
                title: "LAN Party",
                desc: "Join or Host a Multiplayer Game.",
                iconBlock: BLOCKS.GRASS // Representing world
            }
        };
    }

    unlock(id) {
        if (this.unlocked.has(id)) return;
        if (!this.achievements[id]) return;

        this.unlocked.add(id);
        this.showToast(this.achievements[id]);
    }

    showToast(data) {
        const toast = document.createElement('div');
        toast.className = 'achievement-toast';
        
        const iconUrl = renderBlockIcon(data.iconBlock || BLOCKS.GRASS);
        
        toast.innerHTML = `
            <img src="${iconUrl}" class="achievement-icon">
            <div class="achievement-text">
                <div class="achievement-header">Achievement Made!</div>
                <div class="achievement-name">${data.title}</div>
            </div>
        `;

        this.container.appendChild(toast);

        // Remove from DOM after animation (5s total)
        setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 5000);
    }
    
    reset() {
        this.unlocked.clear();
        this.container.innerHTML = '';
    }

    getUnlocked() {
        return Array.from(this.unlocked);
    }

    loadUnlocked(list) {
        this.unlocked.clear();
        if (list && Array.isArray(list)) {
            list.forEach(id => this.unlocked.add(id));
        }
    }
}