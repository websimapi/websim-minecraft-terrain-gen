import { BLOCKS } from '../constants.js';
import { getStackLimit } from '../constants.js';
import { renderBlockIcon } from '../blocks.js';

export class CreativeUI {
    constructor(uiManager) {
        this.ui = uiManager;
        this.element = null;
        this.scrollContainer = null;
        this.items = [];
        this.initItems();
    }

    initItems() {
        const uniqueIds = new Set();
        const blockKeys = Object.keys(BLOCKS);
        
        // Group by ID to filter duplicates/aliases
        blockKeys.forEach(key => {
            const id = BLOCKS[key];
            if (id <= 0) return; // Skip Air
            if (uniqueIds.has(id)) return;
            
            // Filter technical blocks that shouldn't be in creative menu
            if (
                id === BLOCKS.WATER || // Use bucket
                id === BLOCKS.LAVA || // Use bucket
                id === BLOCKS.MAGMA || // Keep Magma block? Yes, it's a block. Wait, MAGMA (39) is block.
                id === BLOCKS.FURNACE_ON ||
                id === BLOCKS.OAK_DOOR_BOTTOM ||
                id === BLOCKS.OAK_DOOR_TOP ||
                id === BLOCKS.WHEAT || // Crop block (use seeds/item)
                id === BLOCKS.FARMLAND ||
                id === BLOCKS.FARMLAND_MOIST ||
                id === BLOCKS.FIRE ||
                id === BLOCKS.NETHER_PORTAL ||
                (id >= 75 && id <= 86) // New Door Halves (Technical)
            ) {
                return;
            }

            uniqueIds.add(id);
            this.items.push(id);
        });

        // Ensure saddle is present if not already (it should be via BLOCKS iteration)
        if (!uniqueIds.has(BLOCKS.SADDLE)) {
            this.items.push(BLOCKS.SADDLE);
        }

        // Sort by ID
        this.items.sort((a, b) => a - b);
    }

    init() {
        this.element = document.createElement('div');
        this.element.id = 'creative-menu';
        this.element.style.cssText = `
            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.7); display: none; flex-direction: column; 
            justify-content: center; align-items: center; z-index: 2000;
        `;

        const windowDiv = document.createElement('div');
        windowDiv.className = 'creative-window';
        windowDiv.style.cssText = `
            width: 600px;
            background: #c6c6c6;
            border: 2px solid #000;
            padding: 10px;
            box-shadow: inset 2px 2px 0 #fff, inset -2px -2px 0 #555;
            display: flex;
            flex-direction: column;
            gap: 10px;
            transform-origin: center center;
            transform: scale(calc(var(--ui-scale) / 3)); /* Default scale adjustment */
        `;
        
        // Title
        const title = document.createElement('div');
        title.innerText = "Creative Inventory";
        title.style.cssText = `
            font-family: 'Minecraft', sans-serif;
            color: #ffffff;
            font-size: 20px;
            text-shadow: 3px 3px 0 #000000;
        `;
        windowDiv.appendChild(title);

        // Scrollable Grid
        this.scrollContainer = document.createElement('div');
        this.scrollContainer.style.cssText = `
            width: 100%;
            height: 300px;
            overflow-y: scroll;
            background: #8b8b8b;
            border: 2px solid #373737;
            padding: 5px;
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(36px, 1fr));
            gap: 4px;
            box-sizing: border-box;
        `;
        
        // Populate Grid
        this.items.forEach(id => {
            const slot = document.createElement('div');
            slot.className = 'creative-slot';
            slot.dataset.id = id;
            slot.style.cssText = `
                width: 36px; height: 36px;
                background: #8b8b8b;
                border: 1px solid #373737;
                display: flex; justify-content: center; align-items: center;
                cursor: pointer;
                box-sizing: border-box;
            `;
            slot.addEventListener('mouseover', () => { slot.style.borderColor = '#fff'; });
            slot.addEventListener('mouseout', () => { slot.style.borderColor = '#373737'; });
            slot.addEventListener('mousedown', (e) => this.handleCreativeClick(e, id));
            
            const img = document.createElement('img');
            img.src = renderBlockIcon(id);
            img.style.cssText = `width: 28px; height: 28px; image-rendering: pixelated; object-fit: contain; pointer-events: none;`;
            slot.appendChild(img);
            
            this.scrollContainer.appendChild(slot);
        });
        
        windowDiv.appendChild(this.scrollContainer);

        // Player Hotbar Mirror (to drop items into)
        const hotbarContainer = document.createElement('div');
        hotbarContainer.style.cssText = `
            display: flex;
            gap: 4px;
            justify-content: center;
            margin-top: 5px;
            padding-top: 10px;
            border-top: 2px solid #555;
        `;
        this.hotbarContainerEl = hotbarContainer;

        for(let i=0; i<9; i++) {
             const slot = document.createElement('div');
             slot.className = 'creative-hotbar-slot';
             slot.dataset.index = i;
             slot.style.cssText = `
                width: 36px; height: 36px;
                background: #8b8b8b;
                border: 1px solid #373737;
                display: flex; justify-content: center; align-items: center;
                cursor: pointer;
                box-sizing: border-box;
             `;
             slot.addEventListener('mousedown', (e) => this.handleHotbarClick(e, i));
             hotbarContainer.appendChild(slot);
        }

        windowDiv.appendChild(hotbarContainer);
        this.element.appendChild(windowDiv);
        document.body.appendChild(this.element);
        
        this.element.addEventListener('contextmenu', e => e.preventDefault());
        
        // Outside click to drop held item
        this.element.addEventListener('mousedown', (e) => {
             if (e.target === this.element && this.ui.cursorItem) {
                 this.ui.spawnItemDrop(this.ui.cursorItem);
                 this.ui.cursorItem = null;
                 this.ui.updateCursor();
             }
        });
    }

    handleCreativeClick(e, id) {
        // Creative Click Logic:
        // Always grab a full stack of the clicked item (respect limit)
        const limit = getStackLimit(id);
        this.ui.cursorItem = { id: id, count: limit };
        this.ui.updateCursor();
    }

    handleHotbarClick(e, index) {
        const cursor = this.ui.cursorItem;
        const current = this.ui.inventory.getItem(index);
        
        if (cursor) {
            // If same item, try to stack
            if (current && current.id === cursor.id) {
                const limit = getStackLimit(current.id);
                if (current.count < limit) {
                    const space = limit - current.count;
                    const toAdd = Math.min(space, cursor.count);
                    current.count += toAdd;
                    cursor.count -= toAdd;
                    if (cursor.count <= 0) this.ui.cursorItem = null;
                } else {
                    // Swap if full
                    const temp = { ...current };
                    this.ui.inventory.setItem(index, { ...cursor });
                    this.ui.cursorItem = temp;
                }
            } else {
                // Different item or empty slot -> Swap/Place
                // Ensure we handle current being null correctly (don't create empty object)
                const temp = current ? { ...current } : null;
                this.ui.inventory.setItem(index, { ...cursor });
                this.ui.cursorItem = temp;
            }
        } else {
            // Pick up
            if (current) {
                this.ui.cursorItem = { ...current };
                // Fix duplication: Remove from hotbar when picking up in Creative Menu
                this.ui.inventory.setItem(index, null); 
            }
        }
        this.ui.updateCursor();
        this.updateHotbarDisplay();
        this.ui.updateUI(); // Sync main HUD
    }

    refresh() {
        if (!this.scrollContainer) return;
        
        // Update main grid icons
        const slots = this.scrollContainer.children;
        for (let slot of slots) {
            const id = parseInt(slot.dataset.id);
            const img = slot.querySelector('img');
            if (img) {
                img.src = renderBlockIcon(id);
            }
        }
        
        // Update hotbar display
        this.updateHotbarDisplay();
    }

    updateHotbarDisplay() {
        if (!this.hotbarContainerEl) return;
        const slots = this.hotbarContainerEl.children;
        for(let i=0; i<9; i++) {
            const slot = slots[i];
            let item = this.ui.inventory.getItem(i);
            
            // Sanitize item display
            if (item && (item.id === 0 || item.count <= 0)) item = null;
            
            slot.innerHTML = '';
            if (item) {
                const img = document.createElement('img');
                img.src = renderBlockIcon(item.id);
                img.style.cssText = `width: 28px; height: 28px; image-rendering: pixelated; object-fit: contain; pointer-events: none;`;
                slot.appendChild(img);
                
                if (item.count > 1) {
                    const count = document.createElement('div');
                    count.style.cssText = `
                        position: absolute; bottom: 0; right: 2px;
                        color: #ffffff; font-size: 14px;
                        text-shadow: 3px 3px 0 #000000; font-family: 'Minecraft', sans-serif;
                        pointer-events: none;
                    `;
                    count.innerText = item.count;
                    slot.style.position = 'relative';
                    slot.appendChild(count);
                }
            }
        }
    }
    
    show() {
        if (!this.element) this.init();
        this.element.style.display = 'flex';
        this.updateHotbarDisplay();
        
        // Refresh icons on show to ensure latest textures (fixes gray squares if opened early)
        this.refresh(); 
    }
    
    hide() {
        if (this.element) this.element.style.display = 'none';
    }

    isVisible() {
        return this.element && this.element.style.display !== 'none';
    }
}