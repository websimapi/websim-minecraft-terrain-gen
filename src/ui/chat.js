import { BLOCKS } from '../constants.js';

// Chat System
export class ChatManager {
    constructor(uiManager, networkManager, world) {
        this.uiManager = uiManager;
        this.networkManager = networkManager;
        this.world = world;

        this.chatContainer = document.getElementById('chat-container');
        this.chatHistory = document.getElementById('chat-history');
        this.chatInputLine = document.getElementById('chat-input-line');
        this.chatInput = document.getElementById('chat-input');
        this.chatSuggestions = document.getElementById('chat-suggestions');
        this.isChatOpen = false;

        this.knownCommands = [
            '/time set day',
            '/time set night',
            '/spawn zombie',
            '/spawn cow',
            '/spawn pig',
            '/heal',
            '/tickspeed 3',
            '/locate biome desert',
            '/locate biome plains',
            '/locate biome forest',
            '/locate biome mountains',
            '/locate biome snow',
            '/locate biome ocean',
            '/give all',
            '/give debug',
            '/tp dimension nether',
            '/tp dimension overworld',
            '/debug arm',
            '/debug hand',
            '/weather clear',
            '/weather rain'
        ];

        this.setupEvents();
    }

    setupEvents() {
        this.chatInput.addEventListener('input', () => {
            const val = this.chatInput.value;
            if (val.startsWith('/')) {
                const matches = this.knownCommands.filter(c => c.startsWith(val));
                if (matches.length > 0 && val.length > 1) {
                    this.chatSuggestions.style.display = 'flex';
                    this.chatSuggestions.innerHTML = matches.slice(0, 5).map(cmd => 
                        `<div class="suggestion-item">${cmd}</div>`
                    ).join('');
                } else {
                    this.chatSuggestions.style.display = 'none';
                }
            } else {
                this.chatSuggestions.style.display = 'none';
            }
        });

        this.chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                const val = this.chatInput.value;
                if (val.startsWith('/')) {
                    const matches = this.knownCommands.filter(c => c.startsWith(val));
                    if (matches.length > 0) {
                        this.chatInput.value = matches[0];
                    }
                }
            }
        });

        window.addEventListener('keydown', (e) => {
            if (e.key === 't' || e.key === 'T') {
                if (!this.isChatOpen && !this.uiManager.isPaused && !this.uiManager.isInventoryOpen && this.uiManager.gameStarted) {
                    e.preventDefault();
                    this.toggle(true);
                }
            }
            if (e.key === 'Enter' && this.isChatOpen) {
                const msg = this.chatInput.value.trim();
                this.chatSuggestions.style.display = 'none';
                if (msg) {
                    if (msg.startsWith('/')) {
                        this.handleCommand(msg);
                    } else {
                        this.networkManager.sendChat(msg);
                        this.addMessage(this.networkManager.username || "Me", msg);
                    }
                    this.chatInput.value = '';
                }
                this.toggle(false);
            }
            if (e.key === '/' && !this.isChatOpen && !this.uiManager.isPaused && this.uiManager.gameStarted) {
                e.preventDefault();
                this.toggle(true);
                this.chatInput.value = '/';
            }
        });
    }

    toggle(open) {
        this.isChatOpen = open;
        if (open) {
            this.chatInputLine.style.display = 'block';
            this.chatInput.focus();
            this.uiManager.controls.isLocked = false;
            const crosshair = document.getElementById('crosshair');
            if (crosshair) crosshair.style.display = 'none';
            document.exitPointerLock();
            this.chatContainer.classList.add('chat-open');
        } else {
            this.chatInputLine.style.display = 'none';
            this.chatInput.blur();
            const crosshair = document.getElementById('crosshair');
            if (crosshair) crosshair.style.display = 'block';
            const canvas = document.querySelector('#canvas-container canvas');
            if (canvas) canvas.requestPointerLock();
            this.chatContainer.classList.remove('chat-open');
        }
    }

    addMessage(username, message) {
        const line = document.createElement('div');
        line.className = 'chat-msg';

        const nameSpan = document.createElement('span');
        nameSpan.innerText = `<${username}> `;
        nameSpan.style.color = '#ffffff';

        const msgSpan = document.createElement('span');
        msgSpan.innerText = message;
        msgSpan.style.color = '#ffffff';

        line.appendChild(nameSpan);
        line.appendChild(msgSpan);

        this.chatHistory.appendChild(line);
        this.chatHistory.scrollTop = this.chatHistory.scrollHeight;

        while(this.chatHistory.children.length > 50) {
            this.chatHistory.removeChild(this.chatHistory.firstChild);
        }
    }

    handleCommand(cmd) {
        const parts = cmd.split(' ');
        const command = parts[0].toLowerCase();

        if (command === '/time') {
            if (parts[1] === 'set' && parts[2]) {
                 window.dispatchEvent(new CustomEvent('cmd-time', { detail: parts[2] }));
                 this.addMessage('System', `Set time to ${parts[2]}`);
            } else if (parts[1]) {
                window.dispatchEvent(new CustomEvent('cmd-time', { detail: parts[1] }));
                this.addMessage('System', `Set time to ${parts[1]}`);
            } else {
                this.addMessage('System', 'Usage: /time set [day|night]');
            }
        } else if (command === '/heal') {
            this.uiManager.updateHealth(this.uiManager.maxHealth);
            const overlay = document.getElementById('damage-overlay');
            if (overlay) overlay.style.opacity = 0;
            this.uiManager.controls.setDead(false);
            this.addMessage('System', 'Health restored.');
        } else if (command === '/give') {
            if (parts[1] === 'all') {
                this.uiManager.giveAllItems();
                this.addMessage('System', 'Gave you one stack of all available items.');
            } else if (parts[1] === 'debug') {
                this.uiManager.pickupItem(BLOCKS.STRUCTURE_BLOCK, 64);
                this.uiManager.pickupItem(BLOCKS.GLASS, 64);
                this.addMessage('System', 'Gave 64 Structure Blocks and Glass Blocks.');
            } else {
                this.addMessage('System', 'Usage: /give [all|debug]');
            }
        } else if (command === '/spawn' || command === '/summon') {
            if (parts[1] === 'zombie') {
                 window.dispatchEvent(new CustomEvent('cmd-spawn-zombie'));
                 this.addMessage('System', 'Spawned Zombie nearby.');
            } else if (parts[1] === 'cow') {
                 window.dispatchEvent(new CustomEvent('cmd-spawn-cow'));
                 this.addMessage('System', 'Spawned Cow nearby.');
            } else if (parts[1] === 'pig') {
                 window.dispatchEvent(new CustomEvent('cmd-spawn-pig'));
                 this.addMessage('System', 'Spawned Pig nearby.');
            } else {
                this.addMessage('System', 'Usage: /spawn [zombie|cow|pig]');
            }
        } else if (command === '/tp') {
            if (parts[1] === 'dimension') {
                const dim = parts[2];
                if (dim === 'nether' || dim === 'overworld') {
                    window.dispatchEvent(new CustomEvent('cmd-dimension', { detail: dim }));
                    this.addMessage('System', `Teleporting to ${dim}...`);
                } else {
                    this.addMessage('System', 'Usage: /tp dimension [nether|overworld]');
                }
            }
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
            } else if (parts[1] === 'hand') {
                if (this.uiManager.controls) {
                    this.uiManager.controls.debugHandMode = !this.uiManager.controls.debugHandMode;
                    const state = this.uiManager.controls.debugHandMode ? "ENABLED" : "DISABLED";
                    this.addMessage('System', `Hand Transform Debug Mode ${state}`);
                    if (this.uiManager.controls.debugHandMode) {
                        this.addMessage('System', 'Controls: Arrows (X/Y), [/] (Z), Shift for precision.');
                        this.addMessage('System', 'Press P to log transform to console.');
                    }
                }
            }
        } else if (command === '/weather') {
            if (parts[1] === 'clear' || parts[1] === 'rain') {
                window.dispatchEvent(new CustomEvent('cmd-weather', { detail: parts[1] }));
                this.addMessage('System', `Set weather to ${parts[1]}.`);
            } else {
                this.addMessage('System', 'Usage: /weather [clear|rain]');
            }
        } else if (command === '/locate') {
            if (parts[1] === 'biome' && parts[2]) {
                this.addMessage('System', `Locating ${parts[2]}...`);
                const target = parts[2].toLowerCase();
                const pos = this.uiManager.controls.getPosition();
                const found = this.findBiome(pos, target);
                if (found) {
                    this.addMessage('System', `Found ${target} at (${found.x}, ${found.z}). Distance: ${Math.floor(found.dist)}m`);
                } else {
                    this.addMessage('System', `Could not find ${target} nearby.`);
                }
            } else {
                this.addMessage('System', 'Usage: /locate biome [name]');
            }
        } else {
            this.addMessage('System', `Unknown command: ${command}`);
        }
    }

    findBiome(pos, biomeName) {
        const range = 500;
        const step = 16;
        for(let r = 0; r < range; r+=step) {
            for(let angle = 0; angle < Math.PI*2; angle += 0.5) {
                const x = pos.x + Math.cos(angle) * r;
                const z = pos.z + Math.sin(angle) * r;
                const name = this.world.terrainGen.getBiomeName(x, z, 64).toLowerCase();
                if (name.includes(biomeName)) {
                    return { x: Math.floor(x), z: Math.floor(z), dist: r };
                }
            }
        }
        return null;
    }
}