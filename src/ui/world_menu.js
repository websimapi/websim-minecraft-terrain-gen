import { TerrainGenerator } from '../terrain.js';

export class WorldMenu {
    constructor(uiManager) {
        this.ui = uiManager;
        this.selectedWorldId = null;
        this.worlds = this.loadWorlds();
        // bindElements and setupListeners removed from here to prevent double initialization
        // They are called explicitly by UIManager.init()
    }

    bindElements() {
        const d = document;
        this.mainMenu = d.getElementById('main-menu');
        this.worldSelectMenu = d.getElementById('world-select-menu');
        this.createWorldMenu = d.getElementById('create-world-menu');
        this.worldListContainer = d.getElementById('world-list');
        this.btnSingleplayer = d.getElementById('btn-singleplayer');
        this.btnCreateNew = d.getElementById('btn-create-new');
        this.btnPlaySelected = d.getElementById('btn-play-selected');
        this.btnWorldBack = d.getElementById('btn-world-back');
        this.btnDoCreate = d.getElementById('btn-do-create');
        this.btnCreateCancel = d.getElementById('btn-create-cancel');
        this.btnWorldType = d.getElementById('btn-world-type');
        this.inputName = d.getElementById('world-name-input');
        this.inputSeed = d.getElementById('world-seed-input');
        this.newWorldType = 'default';
    }

    setupListeners() {
        this.btnSingleplayer.addEventListener('click', (e) => {
            e.stopImmediatePropagation(); // Prevent UI.js handler
            this.openWorldSelect();
        });

        this.btnCreateNew.addEventListener('click', () => {
            this.openCreateWorld();
        });

        this.btnWorldBack.addEventListener('click', () => {
            this.closeAll();
            this.mainMenu.style.display = 'flex';
        });

        this.btnCreateCancel.addEventListener('click', () => {
            this.createWorldMenu.style.display = 'none';
            this.worldSelectMenu.style.display = 'flex';
        });

        this.btnWorldType.addEventListener('click', () => {
            if (this.newWorldType === 'default') {
                this.newWorldType = 'superflat';
                this.btnWorldType.innerText = 'World Type: Superflat';
                document.getElementById('superflat-options').innerText = '(Grass, Dirt, Bedrock)';
                document.getElementById('superflat-options').style.display = 'block';
            } else if (this.newWorldType === 'superflat') {
                this.newWorldType = 'skyblock';
                this.btnWorldType.innerText = 'World Type: Skyblock';
                document.getElementById('superflat-options').innerText = '(Floating Island)';
                document.getElementById('superflat-options').style.display = 'block';
            } else {
                this.newWorldType = 'default';
                this.btnWorldType.innerText = 'World Type: Default';
                document.getElementById('superflat-options').style.display = 'none';
            }
        });

        this.btnDoCreate.addEventListener('click', () => {
            this.createWorld();
        });

        this.btnPlaySelected.addEventListener('click', () => {
            this.playWorld();
        });
    }

    loadWorlds() {
        try {
            const data = localStorage.getItem('minecraft_worlds');
            const list = data ? JSON.parse(data) : [];
            
            // Deduplicate worlds by ID to fix any existing duplication bugs
            const unique = [];
            const ids = new Set();
            for (const w of list) {
                if (!ids.has(w.id)) {
                    ids.add(w.id);
                    unique.push(w);
                }
            }
            return unique;
        } catch (e) {
            return [];
        }
    }

    saveWorlds() {
        localStorage.setItem('minecraft_worlds', JSON.stringify(this.worlds));
    }

    openWorldSelect() {
        this.mainMenu.style.display = 'none';
        this.worldSelectMenu.style.display = 'flex';
        this.createWorldMenu.style.display = 'none';
        this.renderWorldList();
    }

    openCreateWorld() {
        this.worldSelectMenu.style.display = 'none';
        this.createWorldMenu.style.display = 'flex';
        this.inputName.value = `New World ${this.worlds.length + 1}`;
        this.inputSeed.value = '';
        this.newWorldType = 'default';
        this.btnWorldType.innerText = 'World Type: Default';
        document.getElementById('superflat-options').style.display = 'none';
    }

    closeAll() {
        this.worldSelectMenu.style.display = 'none';
        this.createWorldMenu.style.display = 'none';
    }

    renderWorldList() {
        this.worldListContainer.innerHTML = '';
        this.btnPlaySelected.disabled = true;
        this.selectedWorldId = null;

        if (this.worlds.length === 0) {
            this.worldListContainer.innerHTML = '<div style="color:#888; text-align:center; padding:20px; width: 100%;">No worlds found. Create one!</div>';
            return;
        }

        this.worlds.forEach(world => {
            const el = document.createElement('div');
            el.className = 'world-item';
            
            // Format date
            const dateStr = new Date(world.lastPlayed).toLocaleString();
            
            // Use icon property or default
            const iconSrc = world.icon || './unknown_server.png';
            
            let typeStr = 'Survival Mode';
            if (world.type === 'superflat') typeStr = 'Superflat';
            if (world.type === 'skyblock') typeStr = 'Skyblock';

            el.innerHTML = `
                <img src="${iconSrc}" class="world-icon" alt="icon">
                <div class="world-info">
                    <div class="world-name">${world.name}</div>
                    <div class="world-details">${world.name} (${new Date(world.lastPlayed).toLocaleDateString()} ${new Date(world.lastPlayed).toLocaleTimeString()})</div>
                    <div class="world-details">${typeStr} - Seed: ${world.seed}</div>
                </div>
            `;
            
            el.onclick = () => {
                Array.from(this.worldListContainer.children).forEach(c => c.classList.remove('selected'));
                el.classList.add('selected');
                this.selectedWorldId = world.id;
                this.btnPlaySelected.disabled = false;
            };
            this.worldListContainer.appendChild(el);
        });
    }

    createWorld() {
        const name = this.inputName.value || "New World";
        const seedInput = this.inputSeed.value;
        const seed = seedInput ? this.stringToSeed(seedInput) : Math.floor(Math.random() * 1000000000);
        
        const newWorld = {
            id: Date.now().toString(),
            name: name,
            seed: seed,
            type: this.newWorldType,
            lastPlayed: Date.now(),
            mode: 'survival'
        };

        this.worlds.push(newWorld);
        this.saveWorlds();
        
        this.selectedWorldId = newWorld.id;
        this.playWorld();
    }

    stringToSeed(str) {
        // If number, return number
        if (/^-?\d+$/.test(str)) return parseInt(str);
        // Hash string
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash;
    }

    playWorld() {
        const worldData = this.worlds.find(w => w.id === this.selectedWorldId);
        if (!worldData) return;

        // Update Last Played
        worldData.lastPlayed = Date.now();
        this.saveWorlds();

        this.closeAll();
        this.ui.startGame(worldData);
    }
}