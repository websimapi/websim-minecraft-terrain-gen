import { BLOCKS } from './constants.js';

export class AudioManager {
    constructor() {
        // Web Audio Context setup
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);
        
        // Volumes
        this.masterVolume = 1.0;
        this.musicVolume = 0.5;
        this.sfxVolume = 1.0;

        // Music
        this.bgm = new Audio('./1-13. Wet Hands (12).mp3');
        this.bgm.loop = true;
        
        this.updateVolumes();

        // UI Sounds
        this.clickSound = new Audio('./minecraft_click.mp3');
        this.clickSound.volume = 1.0;

        this.initialized = false;
        this.wasPaused = false;
        
        // Footsteps
        this.stepDistance = 0;
        this.strideLength = 2.2;

        this.buffers = new Map();
        
        // Defined break sounds to reuse for walking as requested
        const grassBreak = ['grass1 (1).ogg', 'grass1 (2).ogg', 'grass2 (4).ogg', 'grass2 (5).ogg', 'grass3 (2).ogg', 'grass3 (3).ogg', 'grass4 (1).ogg', 'grass4 (2).ogg'];
        const gravelBreak = ['gravel1 (4).ogg', 'gravel1 (5).ogg', 'gravel2 (2).ogg', 'gravel2 (3).ogg', 'gravel3 (1).ogg', 'gravel3 (2).ogg', 'gravel4 (1).ogg', 'gravel4 (2).ogg'];
        const sandBreak = ['sand1 (4).ogg', 'sand1 (5).ogg', 'sand2 (1).ogg', 'sand2 (2).ogg', 'sand3 (2).ogg', 'sand3 (3).ogg', 'sand4 (8).ogg', 'sand4 (9).ogg'];
        const snowBreak = ['snow1 (3).ogg', 'snow1 (4).ogg', 'snow2 (4).ogg', 'snow2 (5).ogg', 'snow3 (2).ogg', 'snow3 (3).ogg', 'snow4 (3).ogg', 'snow4 (4).ogg'];
        const stoneBreak = ['stone1 (3).ogg', 'stone1 (4).ogg', 'stone2 (2).ogg', 'stone2 (3).ogg', 'stone3 (3).ogg', 'stone3 (4).ogg', 'stone4 (1).ogg', 'stone4 (2).ogg'];
        const woodBreak = ['wood1 (3).ogg', 'wood1 (4).ogg', 'wood2 (4).ogg', 'wood2 (5).ogg', 'wood3 (1).ogg', 'wood4 (2).ogg', 'wood4 (3).ogg'];
        const clothBreak = ['cloth1 (1).ogg', 'cloth1 (2).ogg', 'cloth2 (2).ogg', 'cloth2 (3).ogg', 'cloth3 (5).ogg', 'cloth3 (6).ogg', 'cloth4 (2).ogg', 'cloth4 (3).ogg'];
        const ladderBreak = ['ladder1.ogg', 'ladder2.ogg', 'ladder3.ogg', 'ladder4.ogg', 'ladder5.ogg'];
        const scaffoldBreak = ['scaffold1.ogg', 'scaffold2.ogg', 'scaffold3.ogg', 'scaffold4.ogg', 'scaffold5.ogg', 'scaffold6.ogg', 'scaffold7.ogg'];
        const coralBreak = ['coral1 (6).ogg', 'coral1 (7).ogg', 'coral2 (2).ogg', 'coral2 (3).ogg', 'coral3 (2).ogg', 'coral3 (3).ogg', 'coral4 (2).ogg', 'coral4 (3).ogg'];
        const wetGrassBreak = ['wet_grass1 (4).ogg', 'wet_grass1 (5).ogg', 'wet_grass2 (1).ogg', 'wet_grass2 (2).ogg', 'wet_grass3 (2).ogg', 'wet_grass3 (3).ogg', 'wet_grass4 (3).ogg', 'wet_grass4 (4).ogg'];

        this.soundConfig = {
            'grass': {
                walk: ['grass5.ogg', 'grass6.ogg', ...grassBreak],
                break: grassBreak
            },
            'gravel': {
                walk: [...gravelBreak], // No dedicated walk sounds found other than break sounds
                break: gravelBreak
            },
            'sand': {
                walk: ['sand5.ogg', ...sandBreak],
                break: sandBreak
            },
            'snow': {
                walk: ['snow4.ogg', ...snowBreak],
                break: snowBreak
            },
            'stone': {
                walk: ['stone5.ogg', 'stone6.ogg', ...stoneBreak],
                break: stoneBreak
            },
            'wood': {
                walk: ['wood5.ogg', 'wood6.ogg', ...woodBreak],
                break: woodBreak
            },
            'cloth': {
                walk: [...clothBreak],
                break: clothBreak
            },
            'ladder': {
                walk: ladderBreak,
                break: ladderBreak
            },
            'scaffold': {
                walk: scaffoldBreak,
                break: scaffoldBreak
            },
            'coral': {
                walk: ['coral5.ogg', 'coral6.ogg', ...coralBreak],
                break: coralBreak
            },
            'wet_grass': {
                walk: ['wet_grass5.ogg', 'wet_grass6.ogg', ...wetGrassBreak],
                break: wetGrassBreak
            }
        };

        this.loadSounds();
    }

    setVolumes(master, music, sfx) {
        if (master !== undefined) this.masterVolume = master;
        if (music !== undefined) this.musicVolume = music;
        if (sfx !== undefined) this.sfxVolume = sfx;
        this.updateVolumes();
    }

    updateVolumes() {
        // HTML Audio Element (BGM)
        this.bgm.volume = this.masterVolume * this.musicVolume;
        
        // WebAudio (SFX)
        // Set master gain for all buffer sources
        this.masterGain.gain.value = this.masterVolume * this.sfxVolume * 0.8; // 0.8 is base mix level
    }

    async loadSounds() {
        const urls = new Set();
        // Collect all unique files
        for(const cat in this.soundConfig) {
            this.soundConfig[cat].walk.forEach(f => urls.add(f));
            this.soundConfig[cat].break.forEach(f => urls.add(f));
        }

        const loadFile = async (url) => {
            try {
                // Encode URI to handle spaces/parens in filenames
                const safeUrl = encodeURI('./' + url);
                const res = await fetch(safeUrl);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const buf = await res.arrayBuffer();
                const audioBuf = await this.ctx.decodeAudioData(buf);
                this.buffers.set(url, audioBuf);
            } catch(e) {
                console.warn("Failed to load sound:", url, e);
            }
        };

        const promises = [];
        for(const url of urls) {
            promises.push(loadFile(url));
        }
        await Promise.all(promises);
    }

    init() {
        if (this.initialized) return;
        
        const enableAudio = () => {
            if (this.initialized) return;
            this.initialized = true;
            
            if (this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
            
            this.bgm.play().catch(e => console.warn("BGM autoplay prevented", e));
            
            // Unlock Click Sound (play silent momentarily)
            this.clickSound.play().then(() => {
                this.clickSound.pause();
                this.clickSound.currentTime = 0;
            }).catch(() => {});

            // Unlock Web Audio with silent buffer
            const buffer = this.ctx.createBuffer(1, 1, 22050);
            const source = this.ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(this.ctx.destination);
            source.start(0);
            
            document.removeEventListener('click', enableAudio);
            document.removeEventListener('keydown', enableAudio);
            document.removeEventListener('touchstart', enableAudio);
        };

        document.addEventListener('click', enableAudio);
        document.addEventListener('keydown', enableAudio);
        document.addEventListener('touchstart', enableAudio);
    }
    
    playClick() {
        if (this.clickSound) {
            this.clickSound.currentTime = 0.05;
            this.clickSound.play().catch(() => {});
        }
    }

    getCategoryForBlock(blockId) {
        if (!blockId) return 'stone';
        
        switch(blockId) {
            case BLOCKS.GRASS:
            case BLOCKS.DIRT:
            case BLOCKS.CLAY:
            case BLOCKS.LEAVES:
            case BLOCKS.DEAD_BUSH:
            case BLOCKS.DANDELION:
            case BLOCKS.PINK_TULIP:
            case BLOCKS.LILY_OF_THE_VALLEY:
            case BLOCKS.SUGAR_CANE:
                return 'grass';
            
            case BLOCKS.SAND:
            case BLOCKS.SOUL_SAND:
                return 'sand';
            
            case BLOCKS.GRAVEL:
                return 'gravel';
                
            case BLOCKS.SNOW:
                return 'snow';
                
            case BLOCKS.LOG:
            case BLOCKS.PLANKS:
            case BLOCKS.CRAFTING_TABLE:
            case BLOCKS.STICK:
            case BLOCKS.OAK_DOOR_BOTTOM:
            case BLOCKS.OAK_DOOR_TOP:
            case BLOCKS.OAK_DOOR_ITEM:
            case BLOCKS.TORCH:
                return 'wood';

            case BLOCKS.CACTUS:
                return 'cloth';

            case BLOCKS.STONE:
            case BLOCKS.COBBLESTONE:
            case BLOCKS.BEDROCK:
            case BLOCKS.GRANITE:
            case BLOCKS.DIORITE:
            case BLOCKS.ANDESITE:
            case BLOCKS.FURNACE:
            case BLOCKS.FURNACE_ON:
            case BLOCKS.COAL_ORE:
            case BLOCKS.IRON_ORE:
            case BLOCKS.GOLD_ORE:
            case BLOCKS.REDSTONE_ORE:
            case BLOCKS.LAPIS_ORE:
            case BLOCKS.DIAMOND_ORE:
            case BLOCKS.EMERALD_ORE:
            case BLOCKS.NETHERRACK:
            case BLOCKS.GLOWSTONE:
            case BLOCKS.QUARTZ_ORE:
            case BLOCKS.OBSIDIAN:
            case BLOCKS.STRUCTURE_BLOCK:
                return 'stone';
                
            case BLOCKS.GLASS:
                return 'stone';

            default:
                return 'stone';
        }
    }

    getRandomBuffer(category, type) {
        const config = this.soundConfig[category];
        if (!config) return null;
        
        let pool = config[type];
        // Fallback if specific pool is empty
        if (!pool || pool.length === 0) {
            pool = (type === 'walk') ? config['break'] : config['walk'];
        }
        
        if (!pool || pool.length === 0) return null;
        
        const name = pool[Math.floor(Math.random() * pool.length)];
        return this.buffers.get(name);
    }

    playStep(blockId) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        
        const cat = this.getCategoryForBlock(blockId);
        const buf = this.getRandomBuffer(cat, 'walk');
        
        if (buf) {
            const src = this.ctx.createBufferSource();
            src.buffer = buf;
            // Randomize pitch slightly
            src.playbackRate.value = 0.95 + Math.random() * 0.1;
            
            const gain = this.ctx.createGain();
            gain.gain.value = 0.6; 
            
            src.connect(gain);
            gain.connect(this.masterGain);
            src.start(0);
        }
    }

    playBreak(blockId) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        
        const cat = this.getCategoryForBlock(blockId);
        const buf = this.getRandomBuffer(cat, 'break');
        
        if (buf) {
            const src = this.ctx.createBufferSource();
            src.buffer = buf;
            // Lower pitch for break
            src.playbackRate.value = 0.8 + Math.random() * 0.1;
            
            const gain = this.ctx.createGain();
            gain.gain.value = 0.8; // Louder than step
            
            src.connect(gain);
            gain.connect(this.masterGain);
            src.start(0);
        }
    }

    update(delta, velocity, onGround, isSneaking, isPaused, blockBelow) {
        if (!this.initialized) return;

        if (isPaused) {
            if (!this.bgm.paused) {
                this.bgm.pause();
                this.wasPaused = true;
            }
            return;
        } else if (this.wasPaused) {
            this.bgm.play().catch(()=>{});
            this.wasPaused = false;
        }
        
        if (onGround && blockBelow !== BLOCKS.AIR && blockBelow !== 0) {
            const speed = Math.sqrt(velocity.x**2 + velocity.z**2);
            const interval = isSneaking ? this.strideLength * 1.5 : this.strideLength;

            if (speed > 0.1) {
                this.stepDistance += speed * delta;
                
                if (this.stepDistance >= interval) {
                    this.stepDistance = 0;
                    this.playStep(blockBelow);
                }
            } else {
                this.stepDistance = interval * 0.9;
            }
        } else {
            this.stepDistance = 0;
        }
    }
}