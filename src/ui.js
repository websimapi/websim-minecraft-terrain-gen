import * as Skinview3d from 'skinview3d';
import { renderBlockIcon, setTextureFiltering, BLOCKS, clearIconCache } from './blocks.js';
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { ChatManager } from './ui/chat.js';
import { CraftingManager } from './ui/crafting.js';
import { Inventory } from './game/inventory.js';
import { FurnaceManager } from './ui/furnace.js';
import { CreativeUI } from './ui/creative.js';
import { StructureBlockUI } from './ui/structure_block.js';
import { onTextureLoaded } from './rendering/texture_atlas.js';
import { WorldMenu } from './ui/world_menu.js';
import { AchievementManager } from './ui/achievements.js'; // Import
import { getStackLimit, getMaxDurability } from './constants.js';

export class UIManager {
    constructor(player, controls, itemManager, world, clouds, networkManager, audioManager) {
        this.player = player;
        this.controls = controls;
        this.itemManager = itemManager;
        this.world = world;
        this.clouds = clouds;
        this.networkManager = networkManager;
        this.audioManager = audioManager;

        this.TOTAL_SLOTS = CONFIG.TOTAL_SLOTS;
        this.HOTBAR_SLOTS = CONFIG.HOTBAR_SLOTS;
        
        // Slot Index Ranges - Defined BEFORE DOM init
        this.CRAFT_START = 100;
        this.OUTPUT_SLOT = 200;
        this.FURNACE_START = 300; 
        
        // Refactored: Uses Inventory class
        this.inventory = new Inventory(this.TOTAL_SLOTS, this.HOTBAR_SLOTS);

        this.isInventoryOpen = false;
        this.isPaused = true;
        this.gameStarted = false;
        this.inventoryMode = 'inventory';

        this.canvasContainer = document.getElementById('canvas-container');
        this.ui = document.getElementById('ui');
        this.menuOverlay = document.getElementById('menu-overlay');
        this.inventoryMenu = document.getElementById('inventory-menu');
        this.craftingMenu = document.getElementById('crafting-menu');
        
        // Add Furnace Menu
        this.furnaceMenu = document.createElement('div');
        this.furnaceMenu.id = 'furnace-menu';
        this.furnaceMenu.style.cssText = `
            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.7); display: none; justify-content: center; align-items: center; z-index: 2000;
        `;
        document.body.appendChild(this.furnaceMenu);

        // DOM Init calls - Now safe because constants are defined
        this.initFurnaceDOM();

        this.mainMenu = document.getElementById('main-menu');
        this.pauseMenu = document.getElementById('pause-menu');
        this.optionsMenu = document.getElementById('options-menu');
        this.videoMenu = document.getElementById('video-menu');
        this.soundMenu = document.getElementById('sound-menu'); // NEW
        this.controlsMenu = document.getElementById('controls-menu');
        this.skinMenu = document.getElementById('skin-menu');
        this.deathScreen = document.getElementById('death-screen');
        this.loadingEl = document.getElementById('loading');
        this.selectorEl = document.getElementById('selector');
        this.hotbarContainer = document.getElementById('hotbar-container');
        this.invMainGrid = document.getElementById('inv-main-grid');
        this.invHotbarGrid = document.getElementById('inv-hotbar-grid');
        this.invCraftingGrid = document.getElementById('inv-crafting-grid');
        this.invCraftingOutput = document.getElementById('inv-crafting-output');
        this.slotsLayerEl = document.getElementById('slots-layer');

        this.craft3x3Grid = document.getElementById('craft-3x3-grid');
        this.craftOutput = document.getElementById('craft-output');
        this.craftMainGrid = document.getElementById('craft-main-grid');
        this.craftHotbarGrid = document.getElementById('craft-hotbar-grid');

        this.crosshairEl = document.getElementById('crosshair');
        this.skinCanvas = document.getElementById('skin-preview-canvas');
        this.invPreviewEl = document.getElementById('inv-player-preview');
        this.menuSkinViewer = null;
        this.invSkinViewer = null;
        this.currentSkinModel = 'default'; // 'default' or 'slim'

        this.cursorItem = null;
        this.cursorGhost = document.getElementById('cursor-ghost');

        this.isMiddleDrag = false;
        this.draggedSlots = new Set();

        this.craftingSlots = new Array(9).fill(null); 
        this.craftingResult = null;

        this.furnaceSlots = new Array(3).fill(null); // 0:Input, 1:Fuel, 2:Output
        this.furnaceManager = new FurnaceManager();

        this.maxHealth = CONFIG.MAX_HEALTH;
        this.currentHealth = CONFIG.MAX_HEALTH;
        this.isDead = false;

        this.isMultiplayer = false;
        this.stats = { blocksPlaced: 0, zombiesKilled: 0 };

        this.chatManager = new ChatManager(this, networkManager, world);
        this.craftingManager = new CraftingManager();
        this.creativeUI = new CreativeUI(this);
        this.structureBlockUI = new StructureBlockUI(this, world);
        this.achievementManager = new AchievementManager(this); // Initialize

        this.currentSkinUrl = './steve.png';
        
        // Tooltip Elements
        this.tooltip = document.getElementById('tooltip');
        this.tooltipTitle = this.tooltip.querySelector('.tooltip-title');
        this.tooltipBody = this.tooltip.querySelector('.tooltip-body');
        this.tooltipMod = this.tooltip.querySelector('.tooltip-mod');

        window.addEventListener('chat-msg', (e) => {
             this.chatManager.addMessage(e.detail.user, e.detail.msg);
        });

        // Debounced UI update on texture load
        let updateTimeout = null;
        onTextureLoaded(() => {
            if (updateTimeout) return;
            updateTimeout = setTimeout(() => {
                updateTimeout = null;
                clearIconCache();
                this.updateUI();
                if (this.creativeUI) this.creativeUI.refresh(); // Fix Creative Inventory
            }, 100);
        });

        this.worldMenu = new WorldMenu(this);
        
        this.saveInterval = null;
        this.currentWorldId = null;

        this.init();
    }

    init() {
        // Initialize UI Scale FIRST to ensure computedScale is available for DOM sizing logic
        this.uiScale = 1; // Default Scale (User requested "1" as default for current size)
        this.updateUIScale(this.uiScale);

        this.initSkinViewers();
        this.initInventoryGrid();
        this.initCraftingTableDOM();
        this.initHotbarDOM();
        this.initHealthBar();
        this.initSplashText();
        this.creativeUI.init();
        this.setupEventListeners();
        this.setupInventoryInteractions();
        this.setupTooltipEvents(); // New Tooltip Setup
        this.updateHotbarSelection(0);

        // Remove old singleplayer listener if it existed (WorldMenu takes over)
        const btnSingle = document.getElementById('btn-singleplayer');
        const newBtn = btnSingle.cloneNode(true);
        btnSingle.parentNode.replaceChild(newBtn, btnSingle);
        
        this.worldMenu.bindElements(); // Rebind to new button
        this.worldMenu.setupListeners();

        this.renderDistances = CONFIG.RENDER_DISTANCES;
        this.currentDistIndex = 2;

        this.resolutionScale = 1.0; // 1.0, 0.75, 0.5
        this.cloudsVisible = true;
        this.bobbing = true;
        this.shadows = true;
        this.particlesMode = 0; // 0: All, 1: Decreased, 2: Minimal
        this.chunkUpdates = 4; // Sync with World default (4)

        this.preventAutoPause = false;
        
        this.updateOptionText();

        this.setBlur(false);
        this.toggleFooter(true);
    }

    startGame(worldData) {
        // Auto fullscreen - safer check
        try { 
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(e => {
                    console.log("Fullscreen request denied or failed:", e);
                }); 
            }
        } catch(e) {}
        
        this.isMultiplayer = false;
        this.gameStarted = true;
        this.togglePause(false);
        this.achievementManager.reset(); // Reset on new game
        this.currentWorldId = worldData.id;

        // Load Save Data
        const saveKey = `minecraft_save_${worldData.id}`;
        const saved = localStorage.getItem(saveKey);
        
        if (saved) {
            try {
                const data = JSON.parse(saved);
                // Load Blocks
                if (data.mods) this.world.loadModifications(data.mods);
                
                // Load Achievements
                if (data.achievements) this.achievementManager.loadUnlocked(data.achievements);

                // Load Skin
                if (data.skin) {
                    this.currentSkinUrl = data.skin;
                    this.loadDefaultSkin(data.skin);
                }

                // Load Entities
                if (data.entities && this.world.entityManagers) {
                    if (data.entities.pigs) this.world.entityManagers.pig.loadData(data.entities.pigs);
                    if (data.entities.cows) this.world.entityManagers.cow.loadData(data.entities.cows);
                    if (data.entities.zombies) this.world.entityManagers.zombie.loadData(data.entities.zombies);
                }

                // Load Dimension & Player Pos
                if (data.player) {
                    worldData.hasSave = true;
                    worldData.savePos = data.player;
                    
                    // Restore Dimension
                    if (data.dimension && data.dimension !== this.world.dimension) {
                        // Dispatch dimension change. Logic in main.js handles world/sky updates.
                        // Position override happens via worldData.savePos in main.js start-game handler.
                        window.dispatchEvent(new CustomEvent('cmd-dimension', { detail: data.dimension }));
                    }
                }
                // Load Inventory
                if (data.inventory) {
                    this.inventory.slots = data.inventory;
                    this.updateUI();
                    this.player.setHeldItem(this.inventory.getItem(this.selectedSlot) ? this.inventory.getItem(this.selectedSlot).id : 0);
                }
            } catch(e) { console.error("Failed to load save", e); }
        }

        // Dispatch event with world data
        window.dispatchEvent(new CustomEvent('start-game', { detail: worldData }));
        
        // Auto-save loop
        if (this.saveInterval) clearInterval(this.saveInterval);
        this.saveInterval = setInterval(() => this.saveGame(), 10000); // 10s
    }

    saveGame() {
        if (!this.currentWorldId || this.isMultiplayer) return;
        
        // Gather entities
        const entities = {};
        if (this.world.entityManagers) {
            entities.pigs = this.world.entityManagers.pig.getData();
            entities.cows = this.world.entityManagers.cow.getData();
            entities.zombies = this.world.entityManagers.zombie.getData();
        }

        const data = {
            mods: this.world.exportModifications(),
            dimension: this.world.dimension,
            achievements: this.achievementManager.getUnlocked(),
            skin: this.currentSkinUrl,
            entities: entities,
            player: {
                x: this.controls.position.x,
                y: this.controls.position.y,
                z: this.controls.position.z,
                yaw: this.controls.viewAngles.yaw,
                pitch: this.controls.viewAngles.pitch,
                isCreative: this.controls.isCreative,
                isFlying: this.controls.isFlying
            },
            inventory: this.inventory.slots
        };
        
        try {
            localStorage.setItem(`minecraft_save_${this.currentWorldId}`, JSON.stringify(data));
            // Update last played timestamp in metadata
            const worldsStr = localStorage.getItem('minecraft_worlds');
            if (worldsStr) {
                const worlds = JSON.parse(worldsStr);
                const w = worlds.find(x => x.id === this.currentWorldId);
                if (w) {
                    w.lastPlayed = Date.now();
                    localStorage.setItem('minecraft_worlds', JSON.stringify(worlds));
                }
            }
        } catch(e) {
            console.error("Save failed (Quota?)", e);
        }
    }

    initSplashText() {
        const splashes = [
            "Also try Terraria!",
            "Made with WebSim!",
            "Multiplayer!",
            "100% pure code!",
            "Javascript!",
            "Three.js!",
            "Splashing!",
            "Now with bugs!",
            "Don't look down!",
            "Is this real life?",
            "Hello World!",
            "Generative AI!",
            "Pixel art!",
            "Voxel based!",
            "Infinite worlds!",
            "Herobrine removed!",
            "Uses Import Maps!",
            "No installation required!",
            "Check out the code!",
            "Web Scale!",
            "Procedural!",
            "Blocks everywhere!"
        ];
        const splashEl = document.getElementById('splash-text');
        if(splashEl) {
            const idx = Math.floor(Math.random() * splashes.length);
            splashEl.innerText = splashes[idx];
            splashEl.style.fontSize = (18 + Math.random() * 4) + 'px';
        }
    }

    toggleFooter(show) {
        const left = document.getElementById('footer-ver');
        const right = document.getElementById('footer-copy');
        if(left) left.style.display = show ? 'block' : 'none';
        if(right) right.style.display = show ? 'block' : 'none';
    }

    setBlur(blur) {
        if (blur) {
            this.canvasContainer.classList.add('blur-filter');
        } else {
            this.canvasContainer.classList.remove('blur-filter');
        }
    }

    initSkinViewers() {
        if (this.skinCanvas) {
            this.menuSkinViewer = new Skinview3d.SkinViewer({
                canvas: this.skinCanvas,
                width: 150,
                height: 200,
                zoom: 0.8,
                model: this.currentSkinModel
            });
            this.menuSkinViewer.animation = new Skinview3d.IdleAnimation();
            this.menuSkinViewer.autoRotate = true;
        }

        if (this.invPreviewEl) {
            this.invPreviewEl.innerHTML = ''; 
            this.invSkinViewer = new Skinview3d.SkinViewer({
                domElement: this.invPreviewEl,
                width: 153,
                height: 216,
                renderPaused: true,
                model: this.currentSkinModel
            });
            this.invSkinViewer.animation = new Skinview3d.IdleAnimation();
            this.invSkinViewer.camera.position.set(0, 10, 55);
            this.invSkinViewer.fov = 25;
        }
    }

    initInventoryGrid() {
        this.invMainGrid.innerHTML = '';
        this.invHotbarGrid.innerHTML = '';
        this.invCraftingGrid.innerHTML = '';
        this.invCraftingOutput.innerHTML = '';

        const createSlot = (i, isCrafting = false) => {
            const slot = document.createElement('div');
            slot.className = 'inv-slot';
            slot.dataset.index = i;
            return slot;
        };
        for(let i=this.HOTBAR_SLOTS; i<this.TOTAL_SLOTS; i++) {
            this.invMainGrid.appendChild(createSlot(i));
        }
        for(let i=0; i<this.HOTBAR_SLOTS; i++) {
            this.invHotbarGrid.appendChild(createSlot(i));
        }
        for(let i=0; i<4; i++) {
            this.invCraftingGrid.appendChild(createSlot(this.CRAFT_START + i, true));
        }
        const outSlot = createSlot(this.OUTPUT_SLOT);
        this.invCraftingOutput.appendChild(outSlot);
    }

    initCraftingTableDOM() {
        const createSlot = (i) => {
            const slot = document.createElement('div');
            slot.className = 'inv-slot';
            slot.dataset.index = i;
            return slot;
        };

        this.craft3x3Grid.innerHTML = '';
        this.craftOutput.innerHTML = '';
        this.craftMainGrid.innerHTML = '';
        this.craftHotbarGrid.innerHTML = '';

        for(let i=0; i<9; i++) {
            this.craft3x3Grid.appendChild(createSlot(this.CRAFT_START + i));
        }
        this.craftOutput.appendChild(createSlot(this.OUTPUT_SLOT)); 

        for(let i=this.HOTBAR_SLOTS; i<this.TOTAL_SLOTS; i++) {
            this.craftMainGrid.appendChild(createSlot(i));
        }
        for(let i=0; i<this.HOTBAR_SLOTS; i++) {
            this.craftHotbarGrid.appendChild(createSlot(i));
        }
    }

    initHotbarDOM() {
        this.slotsLayerEl.innerHTML = '';
        for(let i=0; i<this.HOTBAR_SLOTS; i++) {
            const slot = document.createElement('div');
            slot.className = 'slot';
            slot.id = `slot-${i}`;
            this.slotsLayerEl.appendChild(slot);
        }
    }

    initFurnaceDOM() {
        const createSlot = (i) => {
            const slot = document.createElement('div');
            slot.className = 'inv-slot';
            slot.dataset.index = i;
            // Ensure high z-index to sit above background
            slot.style.zIndex = '10'; 
            return slot;
        };

        const win = document.createElement('div');
        win.style.cssText = `
            position: relative;
            width: calc(176px * var(--ui-scale));
            height: calc(166px * var(--ui-scale));
            background: url('./Novo Projeto (88).png') center center / contain no-repeat;
            image-rendering: pixelated;
        `;

        // Input Slot (56, 17) -> Adjusted for 18x18 slot centering (55, 16)
        this.furnaceInputEl = createSlot(this.FURNACE_START + 0);
        this.furnaceInputEl.style.cssText = `
            position: absolute;
            top: calc(16px * var(--ui-scale));
            left: calc(55px * var(--ui-scale));
            width: calc(18px * var(--ui-scale));
            height: calc(18px * var(--ui-scale));
            display: flex; justify-content: center; align-items: center;
            z-index: 10;
        `;

        // Flame Icon Container
        this.furnaceFlame = document.createElement('div');
        this.furnaceFlame.style.cssText = `
            position: absolute;
            top: calc(36px * var(--ui-scale));
            left: calc(56px * var(--ui-scale));
            width: calc(14px * var(--ui-scale));
            height: calc(14px * var(--ui-scale));
            background-color: transparent;
            overflow: hidden;
            z-index: 5;
        `;
        this.furnaceFlameFill = document.createElement('div');
        this.furnaceFlameFill.style.cssText = `
            width: 100%;
            height: 0%;
            position: absolute;
            bottom: 0;
            left: 0;
            background: url('./Fireshit.png') bottom center / 100% 100% no-repeat;
            transition: none;
        `;
        this.furnaceFlame.appendChild(this.furnaceFlameFill);


        // Fuel Slot (56, 53) -> Adjusted for 18x18 slot centering (55, 52)
        this.furnaceFuelEl = createSlot(this.FURNACE_START + 1);
        this.furnaceFuelEl.style.cssText = `
            position: absolute;
            top: calc(52px * var(--ui-scale));
            left: calc(55px * var(--ui-scale));
            width: calc(18px * var(--ui-scale));
            height: calc(18px * var(--ui-scale));
            display: flex; justify-content: center; align-items: center;
            z-index: 10;
        `;

        // Arrow Container
        this.furnaceArrow = document.createElement('div');
        this.furnaceArrow.style.cssText = `
            position: absolute;
            top: calc(34px * var(--ui-scale));
            left: calc(79px * var(--ui-scale));
            width: calc(24px * var(--ui-scale));
            height: calc(17px * var(--ui-scale));
            background-color: transparent;
            z-index: 5;
        `;
        this.furnaceArrowFill = document.createElement('div');
        this.furnaceArrowFill.style.cssText = `
            width: 0%;
            height: 100%;
            background: url('./Progress.png') left center / 100% 100% no-repeat;
            transition: none;
        `;
        this.furnaceArrow.appendChild(this.furnaceArrowFill);


        // Output Slot (116, 35) -> Adjusted for larger output
        this.furnaceOutputEl = createSlot(this.FURNACE_START + 2);
        this.furnaceOutputEl.style.cssText = `
            position: absolute;
            top: calc(31px * var(--ui-scale));
            left: calc(112px * var(--ui-scale));
            width: calc(26px * var(--ui-scale));
            height: calc(26px * var(--ui-scale));
            display: flex; justify-content: center; align-items: center;
            z-index: 10;
        `;

        this.furnaceMainGrid = document.createElement('div');
        this.furnaceMainGrid.style.cssText = `
            position: absolute;
            bottom: calc((8px + 18px + 4px) * var(--ui-scale));
            left: calc(8px * var(--ui-scale));
            width: calc(162px * var(--ui-scale));
            height: calc(54px * var(--ui-scale));
            display: grid;
            grid-template-columns: repeat(9, 1fr);
            z-index: 10;
        `;

        this.furnaceHotbarGrid = document.createElement('div');
        this.furnaceHotbarGrid.style.cssText = `
            position: absolute;
            bottom: calc(8px * var(--ui-scale));
            left: calc(8px * var(--ui-scale));
            width: calc(162px * var(--ui-scale));
            height: calc(18px * var(--ui-scale));
            display: grid;
            grid-template-columns: repeat(9, 1fr);
            z-index: 10;
        `;
        
        for(let i=this.HOTBAR_SLOTS; i<this.TOTAL_SLOTS; i++) {
            this.furnaceMainGrid.appendChild(createSlot(i));
        }
        for(let i=0; i<this.HOTBAR_SLOTS; i++) {
            this.furnaceHotbarGrid.appendChild(createSlot(i));
        }

        win.appendChild(this.furnaceInputEl);
        win.appendChild(this.furnaceFlame);
        win.appendChild(this.furnaceFuelEl);
        win.appendChild(this.furnaceArrow);
        win.appendChild(this.furnaceOutputEl);
        win.appendChild(this.furnaceMainGrid);
        win.appendChild(this.furnaceHotbarGrid);

        this.furnaceMenu.innerHTML = ''; 
        this.furnaceMenu.appendChild(win);
    }

    initHealthBar() {
        const container = document.getElementById('health-bar');
        if (!container) return;
        container.innerHTML = '';

        for(let i=0; i<10; i++) {
            const heart = document.createElement('div');
            heart.className = 'heart';
            heart.id = `heart-${i}`;

            const inner = document.createElement('div');
            inner.className = 'heart-inner';

            inner.style.backgroundImage = "url('./Novo Projeto (77)_2.png')"; 
            heart.appendChild(inner);

            container.appendChild(heart);
        }
    }

    updateHealthDisplay() {
        for(let i=0; i<10; i++) {
            const heart = document.getElementById(`heart-${i}`);
            if(!heart) continue;
            const inner = heart.querySelector('.heart-inner');
            if(!inner) continue;

            const heartValFull = (i + 1) * 2;
            const heartValHalf = heartValFull - 1;

            if (this.currentHealth >= heartValFull) {
                inner.style.display = 'block';
                inner.style.backgroundImage = "url('./Novo Projeto (77)_2.png')";
            } else if (this.currentHealth === heartValHalf) {
                inner.style.display = 'block';
                inner.style.backgroundImage = "url('./Novo Projeto (77)_3.png')"; 
            } else {
                inner.style.display = 'none'; 
            }
        }
    }

    updateHealth(hp) {
        if (hp < this.currentHealth) {
            this.animateDamage(this.currentHealth, hp);
        } else {
            this.currentHealth = hp;
            this.updateHealthDisplay();
             const overlay = document.getElementById('damage-overlay');
             if (overlay && !this.isDead) overlay.style.opacity = 0;
        }
    }

    animateDamage(oldHp, newHp) {
        const startHeartIdx = Math.ceil(newHp / 2); 
        const endHeartIdx = Math.ceil(oldHp / 2);

        this.currentHealth = newHp;

        if (this.currentHealth <= 0 && !this.isDead) {
            this.isDead = true;
            this.dropAllItems();
            this.controls.setDead(true);
            const overlay = document.getElementById('damage-overlay');
            if(overlay) overlay.style.opacity = 0.5;

            setTimeout(() => this.showDeathScreen(), 1000);
        }

        const flashSequence = async (element) => {
             if (!element) return;
             const inner = element.querySelector('.heart-inner');
             if (!inner) return;

             inner.style.display = 'block';

             inner.style.backgroundImage = "url('./Novo Projeto (77) (1)_1.png')";
             await new Promise(r => setTimeout(r, 150));

             inner.style.backgroundImage = "url('./Novo Projeto (77)_3.png')";
             await new Promise(r => setTimeout(r, 150));

             this.updateHealthDisplay();
        };

        for (let i = startHeartIdx; i < endHeartIdx; i++) {
            const heart = document.getElementById(`heart-${i}`);
            flashSequence(heart);
        }
    }

    setupEventListeners() {
        // Global audio unlock fallback
        document.addEventListener('click', () => {
            if (this.audioManager && !this.audioManager.initialized) {
                this.audioManager.init();
            }
        }, { once: true });

        // UI Click Sounds
        document.addEventListener('click', (e) => {
            const t = e.target;
            if (t.classList.contains('btn-minecraft') || 
                t.closest('.inv-slot') || 
                t.closest('.creative-slot') ||
                t.closest('.creative-hotbar-slot') ||
                t.id === 'craft-output' || 
                t.id === 'inv-crafting-output' ||
                t.closest('.slot')) { // Hotbar slots

                if (this.audioManager) this.audioManager.playClick();
            }
        });

        const btnSingle = document.getElementById('btn-singleplayer');
        if(btnSingle) btnSingle.addEventListener('click', () => {
            try { document.documentElement.requestFullscreen().catch(e => console.log("Fullscreen failed", e)); } catch(e) {}
            this.isMultiplayer = false;
            this.gameStarted = true;
            this.togglePause(false);
            window.dispatchEvent(new CustomEvent('start-game'));
        });

        const btnMulti = document.getElementById('btn-multiplayer');
        const joinMenu = document.getElementById('join-game-menu');
        const btnJoinLan = document.getElementById('btn-join-lan');
        const btnHostLan = document.getElementById('btn-host-lan');
        const btnJoinServer = document.getElementById('btn-join-server');
        const btnPublishServer = document.getElementById('btn-publish-server');
        const btnJoinCancel = document.getElementById('btn-join-cancel');
        const lanInput = document.getElementById('lan-code-input');

        // Open Join Menu
        if(btnMulti) {
            btnMulti.addEventListener('click', () => {
                this.mainMenu.style.display = 'none';
                joinMenu.style.display = 'flex';
            });
        }

        // LAN Join
        if(btnJoinLan) {
            btnJoinLan.addEventListener('click', () => {
                const code = lanInput.value.trim();
                if (code.length === 0) {
                    this.showNotification("Please enter a code!", 2000);
                    return;
                }
                this.startMultiplayer('lan', code);
            });
        }

        // LAN Host
        if(btnHostLan) {
            btnHostLan.addEventListener('click', async () => {
                const code = await this.networkManager.hostGame();
                this.startMultiplayer('lan-host', code);
            });
        }

        // Server Join
        if(btnJoinServer) {
            btnJoinServer.addEventListener('click', () => {
                this.startMultiplayer('server');
            });
        }

        // Publish Server
        if(btnPublishServer) {
            btnPublishServer.addEventListener('click', () => {
                // Must be in a game to publish? Or load selected world?
                // For now, let's just say "Play Selected World" then publish.
                this.showNotification("Start Singleplayer -> Esc -> Open to LAN/Server", 4000);
            });
        }

        // Join Cancel
        if(btnJoinCancel) {
            btnJoinCancel.addEventListener('click', () => {
                joinMenu.style.display = 'none';
                this.mainMenu.style.display = 'flex';
            });
        }

        // Open to LAN button (Pause Menu)
        const btnOpenLan = document.getElementById('btn-open-lan');
        if (btnOpenLan) {
            btnOpenLan.addEventListener('click', () => {
                this.networkManager.hostGame().then(code => {
                    this.addChatMessage('System', `LAN Game Hosted! Code: ${code}`);
                    this.showNotification(`LAN Code: ${code}`, 10000);
                    this.togglePause(false);
                    this.achievementManager.unlock('lan_party');
                });
            });
        }

        const btnResume = document.getElementById('btn-resume');
        if(btnResume) btnResume.addEventListener('click', () => this.togglePause(false));

        // Advancements Button (Dummy for now, just toast test)
        const btnAdvancements = document.getElementById('btn-advancements');
        if(btnAdvancements) {
            btnAdvancements.addEventListener('click', () => {
                this.achievementManager.unlock('open_inventory'); // Achievement
            });
        }

        // Sound Settings
        const btnSoundSettings = document.getElementById('btn-sound-settings');
        const btnSoundBack = document.getElementById('btn-sound-back');
        if (btnSoundSettings) btnSoundSettings.addEventListener('click', () => this.openSoundSettings());
        if (btnSoundBack) btnSoundBack.addEventListener('click', () => this.closeSubMenu());

        // Sound Sliders
        const bindVolumeSlider = (id, labelId, type) => {
            const slider = document.getElementById(id);
            const label = document.getElementById(labelId);
            if (slider && label) {
                slider.addEventListener('input', (e) => {
                    const val = parseInt(e.target.value);
                    label.innerText = val + '%';
                    const norm = val / 100;
                    if (type === 'master') this.audioManager.setVolumes(norm, undefined, undefined);
                    if (type === 'music') this.audioManager.setVolumes(undefined, norm, undefined);
                    if (type === 'sfx') this.audioManager.setVolumes(undefined, undefined, norm);
                });
            }
        };
        bindVolumeSlider('master-vol-slider', 'master-vol-val', 'master');
        bindVolumeSlider('music-vol-slider', 'music-vol-val', 'music');
        bindVolumeSlider('sfx-vol-slider', 'sfx-vol-val', 'sfx');

        const btnRespawn = document.getElementById('btn-respawn');
        if(btnRespawn) btnRespawn.addEventListener('click', () => this.respawn());

        const btnTitleDeath = document.getElementById('btn-title-death');
        if(btnTitleDeath) btnTitleDeath.addEventListener('click', () => {
            this.respawn();
            this.gameStarted = false;
            this.togglePause(true);
        });

        window.addEventListener('zombie-killed', () => {
            this.stats.zombiesKilled++;
            this.achievementManager.unlock('kill_zombie'); // Achievement
        });

        const btnOptMain = document.getElementById('btn-options-main');
        const btnOptPause = document.getElementById('btn-options-pause');
        const btnOptBack = document.getElementById('btn-options-back');
        const sliderRenderDist = document.getElementById('render-dist-slider');
        const labelRenderDist = document.getElementById('render-dist-val');
        const btnAutoPause = document.getElementById('btn-auto-pause');

        const btnVideoSettings = document.getElementById('btn-video-settings');
        const btnControls = document.getElementById('btn-controls-settings');
        const btnSkinSettings = document.getElementById('btn-skin-settings');

        if (btnVideoSettings) btnVideoSettings.addEventListener('click', () => this.openVideoSettings());
        if (btnControls) btnControls.addEventListener('click', () => this.openControls());
        if (btnSkinSettings) btnSkinSettings.addEventListener('click', () => this.openSkinSettings());

        const btnVideoBack = document.getElementById('btn-video-back');
        const btnVideoFilter = document.getElementById('btn-video-filter');
        const btnVideoRes = document.getElementById('btn-video-res');
        const btnVideoShadows = document.getElementById('btn-video-shadows');
        const btnVideoParticles = document.getElementById('btn-video-particles');
        const btnVideoChunkUpdates = document.getElementById('btn-video-chunk-updates');
        const btnVideoClouds = document.getElementById('btn-video-clouds');
        const btnVideoBobbing = document.getElementById('btn-video-bobbing');
        const btnUIScale = document.getElementById('btn-ui-scale');
        const sliderFov = document.getElementById('fov-slider');
        const labelFov = document.getElementById('fov-val');

        if (btnVideoBack) btnVideoBack.addEventListener('click', () => this.closeSubMenu());

        if (btnUIScale) btnUIScale.addEventListener('click', (e) => {
            this.uiScale++;
            if (this.uiScale > 4) this.uiScale = 1; // Cycle 1-4
            this.updateUIScale(this.uiScale);
            e.target.innerText = `UI Scale: ${this.uiScale}`;
        });

        if (btnVideoFilter) btnVideoFilter.addEventListener('click', (e) => {
            this.useLinearFilter = !this.useLinearFilter;
            setTextureFiltering(this.useLinearFilter);
            e.target.innerText = `Texture Filtering: ${this.useLinearFilter ? 'Linear' : 'Nearest'}`;
        });

        if (btnVideoRes) btnVideoRes.addEventListener('click', (e) => {
            if (this.resolutionScale === 1.0) this.resolutionScale = 0.75;
            else if (this.resolutionScale === 0.75) this.resolutionScale = 0.5;
            else this.resolutionScale = 1.0;
            e.target.innerText = `Resolution: ${this.resolutionScale * 100}%`;
            window.dispatchEvent(new CustomEvent('update-resolution', { detail: this.resolutionScale }));
        });

        if (btnVideoShadows) btnVideoShadows.addEventListener('click', (e) => {
            this.shadows = !this.shadows;
            e.target.innerText = `Shadows: ${this.shadows ? 'ON' : 'OFF'}`;
            window.dispatchEvent(new CustomEvent('update-shadows', { detail: this.shadows }));
        });

        if (btnVideoParticles) btnVideoParticles.addEventListener('click', (e) => {
            this.particlesMode = (this.particlesMode + 1) % 3;
            const modes = ['All', 'Decreased', 'Minimal'];
            e.target.innerText = `Particles: ${modes[this.particlesMode]}`;
            window.dispatchEvent(new CustomEvent('update-particles', { detail: this.particlesMode }));
        });

        if (btnVideoChunkUpdates) btnVideoChunkUpdates.addEventListener('click', (e) => {
            const opts = [1, 2, 4, 8, 16];
            const idx = opts.indexOf(this.chunkUpdates);
            this.chunkUpdates = opts[(idx + 1) % opts.length];
            e.target.innerText = `Chunk Updates: ${this.chunkUpdates}`;
            window.dispatchEvent(new CustomEvent('update-chunk-limit', { detail: this.chunkUpdates }));
        });

        if (btnVideoClouds) btnVideoClouds.addEventListener('click', (e) => {
            this.cloudsVisible = !this.cloudsVisible;
            if (this.clouds) this.clouds.enabled = this.cloudsVisible;
            e.target.innerText = `Clouds: ${this.cloudsVisible ? 'ON' : 'OFF'}`;
        });

        if (btnVideoBobbing) btnVideoBobbing.addEventListener('click', (e) => {
            this.bobbing = !this.bobbing;
            this.controls.setBobbing(this.bobbing);
            e.target.innerText = `View Bobbing: ${this.bobbing ? 'ON' : 'OFF'}`;
        });

        if (sliderFov) {
            sliderFov.addEventListener('input', (e) => {
                const val = parseInt(e.target.value);
                if (labelFov) labelFov.innerText = val;
                this.controls.setFov(val);
            });
        }

        const btnControlsBack = document.getElementById('btn-controls-back');
        if (btnControlsBack) btnControlsBack.addEventListener('click', () => this.closeSubMenu());

        const btnSkinBack = document.getElementById('btn-skin-back');
        if (btnSkinBack) btnSkinBack.addEventListener('click', () => this.closeSubMenu());

        if (btnOptMain) btnOptMain.addEventListener('click', () => this.openOptions(true));
        if (btnOptPause) btnOptPause.addEventListener('click', () => this.openOptions(false));
        if (btnOptBack) btnOptBack.addEventListener('click', () => this.closeOptions());

        if (sliderRenderDist) {
            sliderRenderDist.addEventListener('input', (e) => {
                const val = parseInt(e.target.value);
                if (labelRenderDist) labelRenderDist.innerText = val;
                // Debounce slightly or just set? World handles it.
                if (this.world) this.world.setRenderDistance(val);
            });
        }

        if (btnAutoPause) btnAutoPause.addEventListener('click', () => {
             this.preventAutoPause = !this.preventAutoPause;
             this.updateOptionText();
        });

        const skinInput = document.getElementById('skin-upload');
        if(skinInput) skinInput.addEventListener('change', (e) => this.handleSkinUpload(e));
        
        const btnToggleModel = document.getElementById('btn-toggle-model');
        if(btnToggleModel) {
            btnToggleModel.addEventListener('click', () => {
                this.currentSkinModel = (this.currentSkinModel === 'default') ? 'slim' : 'default';
                btnToggleModel.innerText = `Model: ${this.currentSkinModel === 'default' ? 'Steve' : 'Alex'}`;
                // Reload viewers
                if (this.menuSkinViewer) this.menuSkinViewer.loadSkin(this.currentSkinUrl, { model: this.currentSkinModel });
                if (this.invSkinViewer) this.invSkinViewer.loadSkin(this.currentSkinUrl, { model: this.currentSkinModel });
                if (this.player) this.player.setModelType(this.currentSkinModel);
            });
        }

        window.addEventListener('keydown', (e) => {
            if (this.chatManager.isChatOpen && e.code !== 'Escape' && e.code !== 'Enter') return;

            if (e.code === 'Escape') {
                if (this.chatManager.isChatOpen) this.chatManager.toggle(false);
                else if (this.isInventoryOpen) this.toggleInventory(false);
                else if (this.gameStarted) this.togglePause(true);
            }
            
            if (e.code === 'KeyL' && this.controls.isLocked) {
                 e.preventDefault();
                 document.exitPointerLock();
                 return; 
            }
            
            if (e.code === 'KeyE') {
                if (this.isInventoryOpen) {
                    this.toggleInventory(false);
                } else if (this.gameStarted && !this.isPaused && !this.chatManager.isChatOpen) {
                    this.achievementManager.unlock('open_inventory'); // Achievement
                    if (this.controls.isCreative) {
                        this.toggleInventory(true, 'creative');
                    } else {
                        this.toggleInventory(true, 'inventory');
                    }
                }
            }

            if (e.key >= '1' && e.key <= '9') {
                this.updateHotbarSelection(parseInt(e.key) - 1);
            }
        });

        window.addEventListener('wheel', (e) => {
            if (this.isInventoryOpen) return;
            let newSlot = this.selectedSlot;
            if (e.deltaY > 0) newSlot = (this.selectedSlot + 1) % this.HOTBAR_SLOTS;
            else newSlot = (this.selectedSlot - 1 + this.HOTBAR_SLOTS) % this.HOTBAR_SLOTS;
            this.updateHotbarSelection(newSlot);
        });

        window.addEventListener('player-drop', () => this.dropCurrentItem());
    }

    startMultiplayer(mode, code) {
        try { document.documentElement.requestFullscreen().catch(e => {}); } catch(e) {}

        this.isMultiplayer = true;
        this.gameStarted = true;
        this.togglePause(false);
        this.achievementManager.unlock('lan_party');

        this.loadingEl.style.display = 'block';
        
        // Hide join menu
        document.getElementById('join-game-menu').style.display = 'none';

        if (mode === 'lan') {
            this.networkManager.joinGame(code);
        } else if (mode === 'lan-host') {
            // Already hosted, just enter game loop (assume world is loaded/generated)
            // If starting from main menu without world, we need to generate one.
            if (!this.world.chunks.size) { // Heuristic
                window.dispatchEvent(new CustomEvent('start-game', { detail: { seed: Math.random() } }));
            } else {
                this.loadingEl.style.display = 'none';
            }
            this.addChatMessage('System', `Hosting LAN: ${code}`);
            this.showNotification(`LAN Code: ${code}`, 10000);
        } else if (mode === 'server') {
            this.networkManager.connectToServer();
        }
    }

    showNotification(text, duration = 3000) {
        const area = document.getElementById('notification-area');
        if (!area) return;
        
        const el = document.createElement('div');
        el.style.cssText = `
            background: rgba(0,0,0,0.7);
            color: #ffff55;
            padding: 8px 12px;
            font-family: 'Minecraft', sans-serif;
            text-shadow: 2px 2px 0 #000;
            font-size: 16px;
            border: 2px solid #fff;
            animation: fadeIn 0.3s;
        `;
        el.innerText = text;
        
        area.appendChild(el);
        
        setTimeout(() => {
            el.style.opacity = 0;
            setTimeout(() => { if(el.parentNode) el.parentNode.removeChild(el); }, 500);
        }, duration);
    }

    addChatMessage(user, msg) {
        this.chatManager.addMessage(user, msg);
    }

    giveAllItems() {
        this.inventory.giveAllItems();
        this.updateUI();
        this.player.setHeldItem(this.inventory.getItem(this.selectedSlot) ? this.inventory.getItem(this.selectedSlot).id : 0);
    }

    togglePause(pause) {
        if (this.isInventoryOpen && pause) this.toggleInventory(false);
        if (this.chatManager.isChatOpen && pause) this.chatManager.toggle(false);

        this.isPaused = pause;
        if (pause) this.saveGame(); // Save on pause

        if (this.optionsMenu) this.optionsMenu.style.display = 'none';

        if (this.isPaused) {
            this.ui.style.display = 'none';
            this.menuOverlay.style.display = 'flex';
            if (this.crosshairEl) this.crosshairEl.style.display = 'none';
            if (this.hotbarContainer) this.hotbarContainer.style.display = 'none';
            if (!this.gameStarted) {
                this.setBlur(true);
                this.toggleFooter(true);
            } else {
                this.setBlur(false);
                this.toggleFooter(false);
            }

            if (this.isDead) {
                this.mainMenu.style.display = 'none';
                this.pauseMenu.style.display = 'none';
                this.deathScreen.style.display = 'flex';
            } else {
                if (!this.gameStarted) {
                    this.setBlur(true);
                    this.mainMenu.style.display = 'flex';
                    this.pauseMenu.style.display = 'none';
                } else {
                    this.mainMenu.style.display = 'none';
                    this.pauseMenu.style.display = 'flex';
                }
            }
            document.exitPointerLock();
        } else {
            this.ui.style.display = 'block';
            this.menuOverlay.style.display = 'none';
            if (this.crosshairEl) this.crosshairEl.style.display = 'block';
            if (this.hotbarContainer) this.hotbarContainer.style.display = 'block';
            this.setBlur(false);
            
            const canvas = document.querySelector('#canvas-container canvas');
            if (canvas) canvas.requestPointerLock();
        }
    }

    respawn() {
        this.isDead = false;
        this.currentHealth = this.maxHealth;
        this.updateHealth(this.maxHealth);
        this.deathScreen.style.display = 'none';
        
        this.controls.setDead(false);
        window.dispatchEvent(new CustomEvent('player-respawn'));
        this.togglePause(false);
    }

    showDeathScreen() {
        this.togglePause(true);
        const scoreEl = document.getElementById('score-display');
        if (scoreEl) scoreEl.innerHTML = `Score: <span style="color: #ffffff">${this.stats.zombiesKilled * 10 + this.stats.blocksPlaced}</span>`;
    }

    openOptions(isMain) {
        if (isMain) {
            this.mainMenu.style.display = 'none';
        } else {
            this.pauseMenu.style.display = 'none';
        }
        this.optionsMenu.style.display = 'flex';
    }

    closeOptions() {
        this.optionsMenu.style.display = 'none';
        if (this.gameStarted) {
            this.pauseMenu.style.display = 'flex';
        } else {
            this.mainMenu.style.display = 'flex';
        }
    }

    openVideoSettings() { this.optionsMenu.style.display = 'none'; this.videoMenu.style.display = 'flex'; }
    openControls() { this.optionsMenu.style.display = 'none'; this.controlsMenu.style.display = 'flex'; }
    openSkinSettings() { this.optionsMenu.style.display = 'none'; this.skinMenu.style.display = 'flex'; }
    openSoundSettings() { this.optionsMenu.style.display = 'none'; this.soundMenu.style.display = 'flex'; }

    closeSubMenu() {
        this.videoMenu.style.display = 'none';
        this.controlsMenu.style.display = 'none';
        this.skinMenu.style.display = 'none';
        this.soundMenu.style.display = 'none';
        this.optionsMenu.style.display = 'flex';
    }

    updateOptionText() {
        const btnAutoPause = document.getElementById('btn-auto-pause');
        if (btnAutoPause) btnAutoPause.innerText = `Auto Pause on Lost Focus: ${this.preventAutoPause ? 'OFF' : 'ON'}`;
    }

    updateUIScale(scale) {
        this.uiScale = scale;
        // Map user scale 1..4 to internal CSS scale logic
        // Current "default" was 4. User wants that to be called "1".
        // So: 1->4, 2->5, 3->6, 4->3? Or maybe just steps of 1 starting at 4?
        const cssScale = 3 + scale; 
        this.computedScale = cssScale; // Store computed scale for JS positioning
        document.documentElement.style.setProperty('--ui-scale', cssScale);
        
        // Creative menu transform hack
        if (this.creativeUI && this.creativeUI.element) {
            const el = this.creativeUI.element.querySelector('.creative-window');
            if (el) {
                // Base creative menu is drawn at approx scale 3 equivalent (36px slots vs 18px base).
                // So scale relative to 3.
                const factor = cssScale / 3;
                el.style.transform = `scale(${factor})`;
            }
        }
        
        // Re-center Hotbar Selector
        if (this.selectedSlot !== undefined) {
            this.updateHotbarSelection(this.selectedSlot);
        }
    }

    handleSkinUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            const url = evt.target.result;
            this.setSkin(url);
        };
        reader.readAsDataURL(file);
    }

    setSkin(url) {
        this.currentSkinUrl = url;
        this.loadDefaultSkin(url);
        if (this.networkManager && this.networkManager.connected) {
            // Force presence update immediately to sync skin change
            this.networkManager.update(100); 
        }
    }

    loadDefaultSkin(url) {
        if (this.player) this.player.loadSkin(url, this.currentSkinModel);
        if (this.menuSkinViewer) this.menuSkinViewer.loadSkin(url, { model: this.currentSkinModel });
        if (this.invSkinViewer) this.invSkinViewer.loadSkin(url, { model: this.currentSkinModel });
    }

    updateHotbarSelection(index) {
        if (index < 0 || index >= this.HOTBAR_SLOTS) return;
        
        // Ensure we strictly deselect old one
        const old = document.getElementById(`slot-${this.selectedSlot}`);
        if(old) old.classList.remove('selected');

        this.selectedSlot = index;
        this.inventory.selectedSlot = index; 

        // Update visuals strictly
        const newSlotEl = document.getElementById(`slot-${index}`);
        if(newSlotEl) newSlotEl.classList.add('selected');

        this.updateUI(); // Refresh visuals completely to prevent ghost items

        // Move selector
        if (this.selectorEl && newSlotEl) {
            // Position selector over slot
            // Use computedScale (actual CSS pixels) instead of uiScale index
            const scale = this.computedScale || (3 + this.uiScale); 
            
            // Pixel-perfect alignment for 24px selector over 20px slot starting at x=1
            // Selector Left = Slot Left (1 + i*20) - 2px (centering offset) = i*20 - 1
            const left = (index * 20 - 1) * scale;
            this.selectorEl.style.left = `${left}px`;
            
            // Selector Top = Hotbar Center Y (11) - Selector Half Height (12) = -1
            this.selectorEl.style.top = `${-1 * scale}px`;
            this.selectorEl.style.transform = 'none'; // Remove CSS transform centering
        }

        const item = this.inventory.getItem(index);
        this.player.setHeldItem(item ? item.id : 0);
        
        // Update item name tooltip immediately
        const tooltip = document.getElementById('tooltip');
        if (tooltip && item) {
            // Flash item name above hotbar (custom logic, or just standard tooltip?)
            // Standard MC shows item name above hotbar for a few seconds.
            // For now, let's just rely on cursor hover tooltip or implement hotbar text later.
        }
    }

    dropCurrentItem() {
        if (this.isInventoryOpen) return;
        const item = this.inventory.getItem(this.selectedSlot);
        if (item) {
            this.spawnItemDrop({ ...item, count: 1 });
            
            item.count--;
            if (item.count <= 0) {
                this.inventory.setItem(this.selectedSlot, null);
                this.player.setHeldItem(0);
            }
            this.updateUI();
        }
    }

    dropAllItems() {
        for(let i=0; i<this.TOTAL_SLOTS; i++) {
            const item = this.inventory.getItem(i);
            if(item) {
                this.spawnItemDrop(item);
                this.inventory.setItem(i, null);
            }
        }
        this.updateUI();
        this.player.setHeldItem(0);
    }

    spawnItemDrop(item) {
        if (!item) return;
        const pos = this.controls.getPosition();
        const dir = this.controls.camera.getWorldDirection(new THREE.Vector3());
        
        // Offset start position
        const spawnPos = pos.clone().add(new THREE.Vector3(0, 1.3, 0));
        
        // Velocity
        const velocity = dir.multiplyScalar(6.0);
        velocity.y = 3.0; // Arc up
        
        this.itemManager.spawnItem(spawnPos, item.id, velocity, item.count, false, null, item.damage);
    }

    pickupItem(blockId, count, damage = 0) {
        if (this.isDead) return false;
        const pickedUp = this.inventory.pickupItem(blockId, count, damage);
        if (pickedUp > 0) {
            this.updateUI();
            
            // If picked up into selected slot, update held item
            const item = this.inventory.getItem(this.selectedSlot);
            if (item && item.id === blockId) {
                this.player.setHeldItem(blockId);
            }
            
            // Trigger pop animation for changed slots
            this.inventory.lastChangedSlots.forEach(idx => {
                const domSlot = this.getSlotElement(idx);
                if (domSlot) {
                    const icon = domSlot.querySelector('.item-icon, .inv-icon');
                    if (icon) {
                        icon.classList.remove('pop-anim');
                        void icon.offsetWidth; // trigger reflow
                        icon.classList.add('pop-anim');
                    }
                }
            });
            return true;
        }
        return false;
    }

    consumeHeldItem() {
        if (this.controls.isCreative) return;
        const consumed = this.inventory.consumeSelected();
        if (consumed) {
            this.updateUI();
            const item = this.inventory.getItem(this.selectedSlot);
            this.player.setHeldItem(item ? item.id : 0);
        }
    }

    getSelectedBlockId() {
        return this.inventory.getSelectedBlockId();
    }

    replaceHeldItem(newId) {
        if (this.controls.isCreative) return;
        this.inventory.setItem(this.selectedSlot, { id: newId, count: 1 });
        this.updateUI();
        this.player.setHeldItem(newId);
    }

    incrementBlockStat() {
        this.stats.blocksPlaced++;
    }

    toggleInventory(open, mode = 'inventory') {
        this.isInventoryOpen = open;
        this.inventoryMode = mode;

        if (this.isInventoryOpen) {
            this.ui.style.display = 'none';
            this.controls.isLocked = false;
            document.exitPointerLock();
            this.crosshairEl.style.display = 'none';
            this.hotbarContainer.style.display = 'none';
            
            this.inventoryMenu.style.display = 'none';
            this.craftingMenu.style.display = 'none';
            this.furnaceMenu.style.display = 'none';
            if (this.creativeUI) this.creativeUI.hide();
            if (this.structureBlockUI) this.structureBlockUI.hide();

            if (mode === 'inventory') {
                this.inventoryMenu.style.display = 'flex';
            } else if (mode === 'crafting') {
                this.craftingMenu.style.display = 'flex';
            } else if (mode === 'furnace') {
                this.furnaceMenu.style.display = 'flex';
            } else if (mode === 'creative') {
                this.creativeUI.show();
            } else if (mode === 'structure') {
                // Structure block handled by its UI class mostly
            }

            this.updateUI(); // Force update on open to sync visuals
        } else {
            this.ui.style.display = 'block';
            this.inventoryMenu.style.display = 'none';
            this.craftingMenu.style.display = 'none';
            this.furnaceMenu.style.display = 'none';
            if (this.creativeUI) this.creativeUI.hide();
            if (this.structureBlockUI) this.structureBlockUI.hide();
            
            // Force UI update on close to ensure HUD is synced
            this.updateUI();

            if (this.cursorItem) {
                this.spawnItemDrop(this.cursorItem);
                this.cursorItem = null;
                this.updateCursor();
            }

            this.crosshairEl.style.display = 'block';
            this.hotbarContainer.style.display = 'block';
            
            const canvas = document.querySelector('#canvas-container canvas');
            if (canvas) canvas.requestPointerLock();
        }
    }

    openCraftingTable() {
        this.toggleInventory(true, 'crafting');
    }

    openFurnace() {
        this.toggleInventory(true, 'furnace');
    }

    openStructureBlock(x, y, z) {
        this.toggleInventory(true, 'structure');
        this.structureBlockUI.show(x, y, z);
    }

    updateUI() {
        // Update Hotbar HUD
        for (let i = 0; i < this.HOTBAR_SLOTS; i++) {
            const item = this.inventory.getItem(i);
            const slotEl = document.getElementById(`slot-${i}`);
            this.renderSlot(slotEl, item, true);
        }

        // Update Inventory Menu
        if (this.isInventoryOpen) {
            // Update Main Grid and Hotbar Grid in Inv
            for (let i = 0; i < this.TOTAL_SLOTS; i++) {
                const slotEl = this.getInvSlotElement(i);
                if (slotEl) this.renderSlot(slotEl, this.inventory.getItem(i));
            }

            // Update Crafting Grids
            // Fix: Check crafting result BEFORE rendering the output slot to ensure visual sync
            if (this.inventoryMode === 'inventory') {
                for(let i=0; i<4; i++) {
                    const slotEl = this.invCraftingGrid.children[i];
                    this.renderSlot(slotEl, this.craftingSlots[i]);
                }
                this.checkCrafting(4); // Check first
                this.renderSlot(this.invCraftingOutput.firstElementChild, this.craftingResult); // Then render
            } else if (this.inventoryMode === 'crafting') {
                for(let i=0; i<9; i++) {
                    const slotEl = this.craft3x3Grid.children[i];
                    this.renderSlot(slotEl, this.craftingSlots[i]);
                }
                this.checkCrafting(9); // Check first
                this.renderSlot(this.craftOutput.firstElementChild, this.craftingResult); // Then render
            } else if (this.inventoryMode === 'furnace') {
                this.renderSlot(this.furnaceInputEl, this.furnaceSlots[0]);
                this.renderSlot(this.furnaceFuelEl, this.furnaceSlots[1]);
                this.renderSlot(this.furnaceOutputEl, this.furnaceSlots[2]);
            }
        }
    }

    renderSlot(el, item, isHud = false) {
        if (!el) return;
        el.innerHTML = '';
        
        // Safety check: if item ID is 0 or invalid, treat as null
        if (item && (typeof item.id !== 'number' || item.id <= 0 || item.count <= 0)) item = null;

        if (item) {
            const img = document.createElement('img');
            img.src = renderBlockIcon(item.id);
            img.className = isHud ? 'item-icon' : 'inv-icon';
            el.appendChild(img);

            if (item.count > 1) {
                const count = document.createElement('div');
                count.className = 'item-count';
                count.innerText = item.count;
                el.appendChild(count);
            }
            
            // Durability Bar
            const maxD = getMaxDurability(item.id);
            if (maxD > 0 && item.damage > 0) {
                const pct = Math.max(0, Math.min(1, 1.0 - (item.damage / maxD)));
                const barBg = document.createElement('div');
                barBg.className = 'durability-bar-bg';
                const bar = document.createElement('div');
                bar.className = 'durability-bar';
                bar.style.width = `${pct * 100}%`;
                
                // Color ramp: Green -> Yellow -> Red
                const hue = pct * 120; // 0..120
                bar.style.backgroundColor = `hsl(${hue}, 100%, 50%)`;
                
                barBg.appendChild(bar);
                el.appendChild(barBg);
            }
        }
    }

    checkCrafting(gridSize) {
        // Only run logic if inputs changed (handled by click events mostly)
        const result = this.craftingManager.matchRecipe(this.craftingSlots, gridSize);
        if (result) {
            this.craftingResult = { id: result.id, count: result.count };
        } else {
            this.craftingResult = null;
        }
        
        // Update Output Slot Display
        const outEl = (gridSize === 4) ? this.invCraftingOutput.firstElementChild : this.craftOutput.firstElementChild;
        this.renderSlot(outEl, this.craftingResult);
    }

    getInvSlotElement(index) {
        if (this.inventoryMode === 'inventory') {
            if (index < this.HOTBAR_SLOTS) return this.invHotbarGrid.children[index];
            return this.invMainGrid.children[index - this.HOTBAR_SLOTS];
        } else if (this.inventoryMode === 'crafting') {
            if (index < this.HOTBAR_SLOTS) return this.craftHotbarGrid.children[index];
            return this.craftMainGrid.children[index - this.HOTBAR_SLOTS];
        } else if (this.inventoryMode === 'furnace') {
            if (index < this.HOTBAR_SLOTS) return this.furnaceHotbarGrid.children[index];
            return this.furnaceMainGrid.children[index - this.HOTBAR_SLOTS];
        }
        return null;
    }

    setupInventoryInteractions() {
        const handleSlotClick = (e, index, location) => {
            if (e.button !== 0 && e.button !== 2) return; // Only left/right click
            const isRight = (e.button === 2);

            let item = null;
            let setItem = null;

            // Resolve location to data source
            if (location === 'inventory') {
                item = this.inventory.getItem(index);
                setItem = (val) => this.inventory.setItem(index, val);
            } else if (location === 'crafting') {
                item = this.craftingSlots[index];
                setItem = (val) => { this.craftingSlots[index] = val; this.updateUI(); };
            } else if (location === 'furnace') {
                item = this.furnaceSlots[index];
                setItem = (val) => { this.furnaceSlots[index] = val; this.updateUI(); };
            } else if (location === 'output') {
                // Crafting Output Logic
                if (this.craftingResult) {
                    const gridSize = (this.inventoryMode === 'inventory') ? 4 : 9;
                    if (!this.cursorItem) {
                        this.cursorItem = { ...this.craftingResult };
                        this.craftingResult = null;
                        this.consumeCraftingIngredients(gridSize);
                    } else if (this.cursorItem.id === this.craftingResult.id) {
                        const limit = getStackLimit(this.cursorItem.id);
                        if (this.cursorItem.count + this.craftingResult.count <= limit) {
                            this.cursorItem.count += this.craftingResult.count;
                            this.consumeCraftingIngredients(gridSize);
                            this.checkCrafting(gridSize); // Re-check
                        }
                    }
                }
                this.updateCursor();
                this.updateUI();
                return;
            } else if (location === 'furnace_output') {
                if (this.furnaceSlots[2]) {
                    // Logic similar to crafting output but simple take
                    if (!this.cursorItem) {
                        this.cursorItem = this.furnaceSlots[2];
                        this.furnaceSlots[2] = null;
                    } else if (this.cursorItem.id === this.furnaceSlots[2].id) {
                        const limit = getStackLimit(this.cursorItem.id);
                        const taking = Math.min(limit - this.cursorItem.count, this.furnaceSlots[2].count);
                        if (taking > 0) {
                            this.cursorItem.count += taking;
                            this.furnaceSlots[2].count -= taking;
                            if (this.furnaceSlots[2].count <= 0) this.furnaceSlots[2] = null;
                        }
                    }
                    this.updateCursor();
                    this.updateUI();
                }
                return;
            }

            // Standard Slot Logic
            if (!this.cursorItem) {
                if (item) {
                    if (isRight) {
                        // Split
                        const half = Math.ceil(item.count / 2);
                        this.cursorItem = { ...item, count: half };
                        item.count -= half;
                        if (item.count <= 0) setItem(null);
                    } else {
                        // Pick up all
                        this.cursorItem = item;
                        setItem(null);
                    }
                }
            } else {
                if (!item) {
                    if (isRight) {
                        // Place one
                        setItem({ ...this.cursorItem, count: 1 });
                        this.cursorItem.count--;
                        if (this.cursorItem.count <= 0) this.cursorItem = null;
                    } else {
                        // Place all
                        setItem(this.cursorItem);
                        this.cursorItem = null;
                    }
                } else {
                    if (item.id === this.cursorItem.id) {
                        const limit = getStackLimit(item.id);
                        if (isRight) {
                            if (item.count < limit) {
                                item.count++;
                                this.cursorItem.count--;
                                if (this.cursorItem.count <= 0) this.cursorItem = null;
                            }
                        } else {
                            const space = limit - item.count;
                            const toAdd = Math.min(space, this.cursorItem.count);
                            item.count += toAdd;
                            this.cursorItem.count -= toAdd;
                            if (this.cursorItem.count <= 0) this.cursorItem = null;
                        }
                    } else {
                        // Swap
                        const temp = item;
                        setItem(this.cursorItem);
                        this.cursorItem = temp;
                    }
                }
            }
            this.updateCursor();
            this.updateUI();
        };

        // Bind clicks for inventory slots
        const bindGrid = (container, type, offset = 0) => {
            container.addEventListener('mousedown', (e) => {
                const slot = e.target.closest('.inv-slot');
                if (slot) {
                    const idx = parseInt(slot.dataset.index);
                    // Map DOM index to internal index
                    let realIdx = idx;
                    let loc = 'inventory';
                    
                    if (type === 'crafting') {
                        if (idx === this.OUTPUT_SLOT) {
                            loc = 'output';
                            realIdx = idx;
                        } else if (idx >= this.CRAFT_START) {
                            loc = 'crafting';
                            realIdx = idx - this.CRAFT_START;
                        }
                    } else if (type === 'furnace') {
                        if (idx >= this.FURNACE_START) {
                            if (idx === this.FURNACE_START + 2) loc = 'furnace_output';
                            else loc = 'furnace';
                            realIdx = idx - this.FURNACE_START;
                        }
                    }
                    
                    handleSlotClick(e, realIdx, loc);
                }
            });
        };

        bindGrid(this.invMainGrid, 'inventory');
        bindGrid(this.invHotbarGrid, 'inventory');
        bindGrid(this.invCraftingGrid, 'crafting'); // 2x2
        bindGrid(this.invCraftingOutput, 'crafting');
        
        bindGrid(this.craftMainGrid, 'inventory');
        bindGrid(this.craftHotbarGrid, 'inventory');
        bindGrid(this.craft3x3Grid, 'crafting');
        bindGrid(this.craftOutput, 'crafting'); // 3x3 output

        // Furnace Binds
        this.furnaceInputEl.addEventListener('mousedown', (e) => handleSlotClick(e, 0, 'furnace'));
        this.furnaceFuelEl.addEventListener('mousedown', (e) => handleSlotClick(e, 1, 'furnace'));
        this.furnaceOutputEl.addEventListener('mousedown', (e) => handleSlotClick(e, 2, 'furnace_output'));
        bindGrid(this.furnaceMainGrid, 'inventory');
        bindGrid(this.furnaceHotbarGrid, 'inventory');
        
        // Prevent context menu on slots
        document.addEventListener('contextmenu', (e) => {
            if (e.target.closest('.inv-slot') || e.target.closest('.slot')) {
                e.preventDefault();
            }
        });
        
        // Mouse Move for Ghost Item
        document.addEventListener('mousemove', (e) => {
            if (this.cursorItem) {
                this.cursorGhost.style.left = e.clientX + 'px';
                this.cursorGhost.style.top = e.clientY + 'px';
            }
        });
    }

    consumeCraftingIngredients(gridSize) {
        const size = gridSize === 4 ? 2 : 3;
        for (let i = 0; i < gridSize; i++) {
            if (this.craftingSlots[i]) {
                this.craftingSlots[i].count--;
                if (this.craftingSlots[i].count <= 0) this.craftingSlots[i] = null;
            }
        }
    }

    updateCursor() {
        // Sanitize cursor: Ensure no ghost items (Air or 0 count or malformed) are held
        if (this.cursorItem && (typeof this.cursorItem.id !== 'number' || this.cursorItem.id <= 0 || this.cursorItem.count <= 0)) {
            this.cursorItem = null;
        }

        if (this.cursorItem) {
            this.cursorGhost.style.display = 'block';
            this.renderSlot(this.cursorGhost, this.cursorItem, false);
        } else {
            this.cursorGhost.style.display = 'none';
        }
    }

    setupTooltipEvents() {
        const showTooltip = (name, mod) => {
            this.tooltipTitle.innerText = name;
            this.tooltipMod.innerText = mod;
            this.tooltip.style.display = 'flex';
        };

        const moveTooltip = (e) => {
            this.tooltip.style.left = (e.clientX + 15) + 'px';
            this.tooltip.style.top = (e.clientY - 30) + 'px';
        };

        const hideTooltip = () => {
            this.tooltip.style.display = 'none';
        };

        const getItemName = (id) => {
            const key = Object.keys(BLOCKS).find(k => BLOCKS[k] === id);
            if (!key) return "Unknown";
            return key.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
        };

        document.addEventListener('mouseover', (e) => {
            const slot = e.target.closest('.inv-slot, .slot, .creative-slot');
            if (slot) {
                let item = null;
                // Determine item from slot type
                if (slot.classList.contains('inv-slot')) {
                    // Complex lookup logic reused from click handler?
                    // Simplified: check img src? No, data.
                    // Just look at index
                    // ... (implement full lookup if needed, or store item data on DOM)
                    // Quick fix: if it has an image, look up key from source? No.
                    // Access inventory state directly
                    const idx = parseInt(slot.dataset.index);
                    // ... Check inventory mode and ranges ...
                    if (this.inventoryMode === 'inventory') {
                        if(idx < this.TOTAL_SLOTS) item = this.inventory.getItem(idx);
                    }
                    // This is getting complex to duplicate logic.
                    // Better: renderSlot stores data-id on the element?
                } else if (slot.classList.contains('slot')) {
                    // Hotbar HUD
                    const idx = parseInt(slot.id.split('-')[1]);
                    item = this.inventory.getItem(idx);
                } else if (slot.classList.contains('creative-slot')) {
                    const id = parseInt(slot.dataset.id);
                    item = { id: id };
                }

                if (item) {
                    showTooltip(getItemName(item.id), "Minecraft");
                }
            }
        });

        document.addEventListener('mousemove', moveTooltip);
        document.addEventListener('mouseout', (e) => {
            if (e.target.closest('.inv-slot, .slot, .creative-slot')) hideTooltip();
        });
    }

    updateFurnaceProgress() {
        if (this.furnaceManager) {
            const burnPct = this.furnaceManager.getBurnProgress();
            const cookPct = this.furnaceManager.getCookProgress();
            
            // Update flame (height)
            if (this.furnaceFlameFill) {
                this.furnaceFlameFill.style.height = `${burnPct * 100}%`;
            }
            
            // Update arrow (width)
            if (this.furnaceArrowFill) {
                this.furnaceArrowFill.style.width = `${cookPct * 100}%`;
            }
        }
    }

    updatePlayerTabList(list) {
        const content = document.getElementById('tab-list-content');
        if (!content) return;
        content.innerHTML = '';
        
        list.forEach(p => {
            const row = document.createElement('div');
            row.className = 'tab-player-row';
            row.innerHTML = `
                <div class="tab-player-head"></div>
                <div class="tab-player-name" style="color:#ffffff; font-weight:${p.isSelf ? 'bold' : 'normal'}">${p.username}</div>
                <div class="tab-player-ping">${p.ping}</div>
            `;
            content.appendChild(row);
        });
    }
    
    getSlotElement(index) {
        // Try hotbar HUD first
        if (index < this.HOTBAR_SLOTS) {
            const hudSlot = document.getElementById(`slot-${index}`);
            if (hudSlot) return hudSlot;
        }
        return this.getInvSlotElement(index);
    }
}