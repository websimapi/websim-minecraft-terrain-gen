import * as THREE from 'three';
import { TerrainGenerator } from './terrain.js';
import { World } from './world.js';
import { Controls } from './controls.js';
import { CloudLayer } from './clouds.js';
import { ParticleSystem } from './particles.js';
import { ItemManager } from './items.js';
import { Player } from './player.js';
import { UIManager } from './ui.js';
import { AudioManager } from './audio.js';
import { NetworkManager } from './network.js';
import { ZombieManager } from './zombies.js';
import { CowManager, Cow } from './cow.js'; // Import Cow class
import { PigManager, Pig } from './pig.js'; // Import Pig Manager
import { PigmanManager } from './pigman.js';
import { FallingBlockManager } from './falling_blocks.js';
import { CONFIG } from './config.js';
import { DayNightCycle } from './game/day-night.js';
import { setupRenderer, loadBreakTextures, createSelectionBox, createBreakMesh } from './game/init.js';
import { BLOCKS, getMaxDurability } from './constants.js';
import GUI from 'lil-gui';
import { attemptSpawn } from './game/spawning.js';
import { updateTextureAtlas } from './rendering/texture_atlas.js'; // Import animation updater
import { Chunk } from './chunk.js'; // Explicit import needed for pre-gen

const scene = new THREE.Scene();

scene.fog = new THREE.Fog(0x87CEEB, 150, 250);

const sceneHUD = new THREE.Scene();
const cameraHUD = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 10);

// Add lighting to HUD scene so tools have shading
const hudAmbient = new THREE.AmbientLight(0xffffff, 0.6);
sceneHUD.add(hudAmbient);
const hudDir = new THREE.DirectionalLight(0xffffff, 0.8);
hudDir.position.set(5, 10, 7); // Top-right-front lighting
sceneHUD.add(hudDir);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 100, 0);

const renderer = setupRenderer();
// Optimize performance: Cap pixel ratio to 1 to prevent stutter on high-DPI screens
renderer.setPixelRatio(1); 
const container = document.getElementById('canvas-container');
if (container) container.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 0.05));

const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
dirLight.position.set(50, 200, 50);
dirLight.castShadow = true;
// Reduce shadow map size for performance
dirLight.shadow.mapSize.width = 1024; 
dirLight.shadow.mapSize.height = 1024;
// Tighten shadow frustum to player area for better resolution and performance
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 200;
dirLight.shadow.camera.left = -50;
dirLight.shadow.camera.right = 50;
dirLight.shadow.camera.top = 50;
dirLight.shadow.camera.bottom = -50;
dirLight.shadow.bias = -0.0005;
scene.add(dirLight);

const dayNightCycle = new DayNightCycle(dirLight, scene, null);

window.addEventListener('cmd-time', (e) => {
    dayNightCycle.setTime(e.detail);
});

window.addEventListener('cmd-weather', (e) => {
    dayNightCycle.setWeather(e.detail);
});

window.addEventListener('cmd-tickspeed', (e) => {
    if (world) world.randomTickSpeed = e.detail;
});

window.addEventListener('update-resolution', (e) => {
    const scale = e.detail;
    // Cap at 1.0 to avoid high DPI issues on retina (which uses devicePixelRatio > 1)
    // We multiply devicePixelRatio by scale, but ensure we don't exceed window size if we want simple downscaling.
    // Actually, renderer.setPixelRatio handles logical/physical. 
    // Basic scaling:
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2) * scale);
    renderer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener('update-shadows', (e) => {
    const enabled = e.detail;
    dirLight.castShadow = enabled;
    renderer.shadowMap.enabled = enabled;
    scene.traverse(obj => {
        if (obj.material) obj.material.needsUpdate = true;
    });
});

window.addEventListener('update-particles', (e) => {
    particleSystem.setDensity(e.detail);
});

window.addEventListener('update-chunk-limit', (e) => {
    world.chunkUpdateLimit = e.detail;
});

window.addEventListener('cmd-dimension', (e) => {
    const dim = e.detail;
    if (world.dimension !== dim) {
        // loadingEl.style.display = 'block'; // Disabled to prevent text overlay
        world.setDimension(dim);
        dayNightCycle.setDimension(dim);
        
        // Find safe spawn in new dimension
        // Use current X/Z but find new Y
        const pPos = controls.getPosition();
        // Scale coords: Overworld -> Nether (/8), Nether -> Overworld (*8)
        let newX = pPos.x;
        let newZ = pPos.z;
        if (dim === 'nether') {
            newX = Math.floor(pPos.x / 8);
            newZ = Math.floor(pPos.z / 8);
        } else {
            newX = Math.floor(pPos.x * 8);
            newZ = Math.floor(pPos.z * 8);
        }
        
        // Force spawn search near these coords
        controls.position.set(newX, 200, newZ); // Temporary high
        camera.position.set(newX, 200, newZ);
        
        spawned = false; // Trigger spawn search in animate loop
        
        if (dim === 'nether') {
            const NETHER_COLOR = new THREE.Color(0x300505);
            scene.fog.color.copy(NETHER_COLOR);
            scene.fog.near = 10;
            scene.fog.far = 80; 
            scene.background = NETHER_COLOR;
        }
    }
});

const terrainGen = new TerrainGenerator(Math.random());
const world = new World(scene, terrainGen);
// Immediately clamp title screen render distance to 2 chunks to reduce menu lag
world.setRenderDistance(2);

const particleSystem = new ParticleSystem(scene);
const player = new Player(scene, camera, sceneHUD, cameraHUD);
const audioManager = new AudioManager();
audioManager.init();

// Load Dev Settings from LocalStorage
try {
    const saved = localStorage.getItem('minecraft_dev_settings');
    if (saved) {
        const data = JSON.parse(saved);
        if (data.holding) Object.assign(player.hand.transformHolding, data.holding);
        if (data.empty) Object.assign(player.hand.transformEmpty, data.empty);
        if (data.foliage) Object.assign(player.hand.transformFoliage, data.foliage);
        if (data.tool) Object.assign(player.hand.transformTool, data.tool);
        if (data.tp) Object.assign(player.transformThirdPerson, data.tp);
        if (data.tpArm) Object.assign(player.tpArmOffset, data.tpArm);
        console.log("Loaded dev settings from storage.");
    }
} catch (e) {
    console.error("Error loading settings:", e);
}

// Arm Editor GUI
const gui = new GUI({ title: 'Arm / Hand Editor' });
gui.domElement.style.zIndex = '100000';
gui.hide(); // Hidden by default

window.addEventListener('keydown', (e) => {
    if (e.code === 'Backquote') {
        gui._hidden ? gui.show() : gui.hide();
    }
});

// Holding Transform (Blocks)
const holdingFolder = gui.addFolder('Block Position');
const tfHolding = player.hand.transformHolding;
holdingFolder.add(tfHolding, 'baseX', -5, 5).name('X');
holdingFolder.add(tfHolding, 'baseY', -5, 5).name('Y');
holdingFolder.add(tfHolding, 'baseZ', -5, 5).name('Z');
holdingFolder.add(tfHolding, 'rotX', 0, 360).name('RX');
holdingFolder.add(tfHolding, 'rotY', 0, 360).name('RY');
holdingFolder.add(tfHolding, 'rotZ', 0, 360).name('RZ');

// Empty Hand Transform
const emptyFolder = gui.addFolder('Arm Position (Base)');
const tfEmpty = player.hand.transformEmpty;
emptyFolder.add(tfEmpty, 'baseX', -5, 5).name('X');
emptyFolder.add(tfEmpty, 'baseY', -5, 5).name('Y');
emptyFolder.add(tfEmpty, 'baseZ', -5, 5).name('Z');
emptyFolder.add(tfEmpty, 'rotX', 0, 360).name('RX');
emptyFolder.add(tfEmpty, 'rotY', 0, 360).name('RY');
emptyFolder.add(tfEmpty, 'rotZ', 0, 360).name('RZ');

// Foliage Transform (Items/Plants)
const foliageFolder = gui.addFolder('Item Offset');
const tfFoliage = player.hand.transformFoliage;
foliageFolder.add(tfFoliage, 'x', -5, 5).name('X');
foliageFolder.add(tfFoliage, 'y', -5, 5).name('Y');
foliageFolder.add(tfFoliage, 'z', -5, 5).name('Z');
foliageFolder.add(tfFoliage, 'rotX', 0, 360).name('RX');
foliageFolder.add(tfFoliage, 'rotY', 0, 360).name('RY');
foliageFolder.add(tfFoliage, 'rotZ', 0, 360).name('RZ');
foliageFolder.add(tfFoliage, 'scale', 0.1, 5).name('Scale');
foliageFolder.add(tfFoliage, 'thickness', 0.1, 5).name('Thick').onChange(() => {
    if (player.hand.currentBlockId) player.hand.setHeldItem(player.hand.currentBlockId);
});

// Tool Transform (Pickaxe/Axe/etc)
const toolFolder = gui.addFolder('Tool Offset');
const tfTool = player.hand.transformTool;
toolFolder.add(tfTool, 'x', -5, 5).name('X');
toolFolder.add(tfTool, 'y', -5, 5).name('Y');
toolFolder.add(tfTool, 'z', -5, 5).name('Z');
toolFolder.add(tfTool, 'rotX', 0, 360).name('RX');
toolFolder.add(tfTool, 'rotY', 0, 360).name('RY');
toolFolder.add(tfTool, 'rotZ', 0, 360).name('RZ');
toolFolder.add(tfTool, 'scale', 0.1, 5).name('Scale');
toolFolder.add(tfTool, 'thickness', 0.1, 5).name('Thick').onChange(() => {
    if (player.hand.currentBlockId) {
        if(player.hand.heldItemMesh) player.hand.heldItemMesh.userData.cacheKey = null; 
        player.hand.setHeldItem(player.hand.currentBlockId);
    }
});

// Third Person Tweaks
const tpFolder = gui.addFolder('3rd Person Hand');
const tfTP = player.transformThirdPerson;
tpFolder.add(tfTP, 'x', -20, 20).name('Item X');
tpFolder.add(tfTP, 'y', -20, 20).name('Item Y');
tpFolder.add(tfTP, 'z', -20, 20).name('Item Z');
tpFolder.add(tfTP, 'rotX', 0, 360).name('Item RX');
tpFolder.add(tfTP, 'rotY', 0, 360).name('Item RY');
tpFolder.add(tfTP, 'rotZ', 0, 360).name('Item RZ');
tpFolder.add(tfTP, 'scale', 0.1, 10).name('Item Scale');

const tfTPArm = player.tpArmOffset;
tpFolder.add(tfTPArm, 'x', -Math.PI, Math.PI).name('Arm Rot X');
tpFolder.add(tfTPArm, 'y', -Math.PI, Math.PI).name('Arm Rot Y');
tpFolder.add(tfTPArm, 'z', -Math.PI, Math.PI).name('Arm Rot Z');

const settings = {
    save: () => {
        const data = {
            holding: player.hand.transformHolding,
            empty: player.hand.transformEmpty,
            foliage: player.hand.transformFoliage,
            tool: player.hand.transformTool,
            tp: player.transformThirdPerson,
            tpArm: player.tpArmOffset
        };
        localStorage.setItem('minecraft_dev_settings', JSON.stringify(data));
        console.log("Settings saved:", data);
        alert("Settings saved to LocalStorage!");
    }
};
gui.add(settings, 'save').name('Save Settings');

// Notify user
setTimeout(() => {
    if (uiManager && uiManager.chatManager) {
        uiManager.chatManager.addMessage('System', 'Press ` (Backquote) to open Arm Editor.');
    }
}, 3000);

const fallingBlockManager = new FallingBlockManager(scene, world);

const onPickup = (blockId, count, damage) => {
    return uiManager.pickupItem(blockId, count, damage);
};

const itemManager = new ItemManager(scene, world, particleSystem, onPickup);
const clouds = new CloudLayer(scene);
dayNightCycle.clouds = clouds;
const controls = new Controls(camera, renderer.domElement, world, particleSystem, itemManager);
controls.player = player; // Attach player for debug access

controls.onSwing = () => {
    player.swing();
    networkManager.sendSwing();
    
    // Include pigmen and pigs in targets
    const targets = [...zombieManager.zombies, ...cowManager.cows, ...pigmanManager.pigmen, ...pigManager.pigs];
    const hitEntity = controls.raycastEntity(targets);
    
    let heldItem = uiManager ? uiManager.inventory.getItem(uiManager.selectedSlot) : null;
    let heldId = heldItem ? heldItem.id : 0;

    if (hitEntity) {
        const pPos = controls.getPosition();
        const ePos = hitEntity.position;
        const dir = new THREE.Vector3().subVectors(ePos, pPos).normalize();
        dir.y = 0.2;
        
        let damage = 1;
        // Check for swords/axes
        // Iron
        if (heldId === BLOCKS.IRON_SWORD) damage = 6;
        if (heldId === BLOCKS.IRON_AXE) damage = 5;
        // Diamond
        if (heldId === BLOCKS.DIAMOND_SWORD) damage = 7;
        if (heldId === BLOCKS.DIAMOND_AXE) damage = 6;
        // Gold
        if (heldId === BLOCKS.GOLDEN_SWORD) damage = 4;
        if (heldId === BLOCKS.GOLDEN_AXE) damage = 3;
        
        // Pickaxes/Shovels minor damage boost
        if (heldId === BLOCKS.IRON_PICKAXE || heldId === BLOCKS.DIAMOND_PICKAXE || heldId === BLOCKS.GOLDEN_PICKAXE) damage = 3;
        if (heldId === BLOCKS.IRON_SHOVEL || heldId === BLOCKS.DIAMOND_SHOVEL || heldId === BLOCKS.GOLDEN_SHOVEL) damage = 2;
        
        if (!controls.onGround && controls.velocity.y < 0) damage *= 1.5; // Crit

        hitEntity.takeDamage(damage, dir);
        audioManager.init();
        
        // Damage Tool
        const maxD = getMaxDurability(heldId);
        if (maxD > 0 && heldItem && !controls.isCreative) {
            heldItem.damage = (heldItem.damage || 0) + 1; // Hitting mobs costs 1 (usually 2 in MC but 1 for simplicity here)
            if (heldItem.damage >= maxD) {
                // Break tool
                audioManager.playBreak(heldId);
                uiManager.inventory.setItem(uiManager.selectedSlot, null);
                player.setHeldItem(0);
            }
            uiManager.updateUI();
        }
    }
};

const zombieManager = new ZombieManager(scene, world);
const cowManager = new CowManager(scene, world);
const pigManager = new PigManager(scene, world); // Init Pig Manager
const pigmanManager = new PigmanManager(scene, world);

// Attach managers to world for persistence access in UI
world.entityManagers = {
    cow: cowManager,
    pig: pigManager,
    zombie: zombieManager
};

// Cow Debugger GUI
let cowGuiSetup = false;
window.addEventListener('cow-loaded', (e) => {
    if (cowGuiSetup) return;
    cowGuiSetup = true;
    
    const cow = e.detail.cow;
    const partNames = cow.getPartNames();
    const animNames = cow.animations.map(a => a.name);
    
    const cowGui = new GUI({ title: 'Cow Debugger' });
    cowGui.hide(); // Hidden by default
    cowGui.domElement.style.position = 'absolute';
    cowGui.domElement.style.top = '10px';
    cowGui.domElement.style.left = '10px';
    cowGui.domElement.style.right = 'auto'; // Left align
    
    const params = {
        useBaked: cow.useBakedAnimation,
        animation: animNames.length > 0 ? animNames[0] : 'None',
        head: cow.skin.head ? cow.skin.head.name : '',
        body: cow.skin.body ? cow.skin.body.name : '',
        leg1: cow.skin.leg1 ? cow.skin.leg1.name : '',
        leg2: cow.skin.leg2 ? cow.skin.leg2.name : '',
        leg3: cow.skin.leg3 ? cow.skin.leg3.name : '',
        leg4: cow.skin.leg4 ? cow.skin.leg4.name : ''
    };
    
    cowGui.add(params, 'useBaked').name('Use Baked Anim').onChange(v => {
        cowManager.cows.forEach(c => c.useBakedAnimation = v);
    });
    
    if (animNames.length > 0) {
        cowGui.add(params, 'animation', animNames).name('Animation').onChange(v => {
            cowManager.cows.forEach(c => c.playAnimation(v));
        });
    }
    
    const limbs = cowGui.addFolder('Limb Mapping (Procedural)');
    
    ['head', 'body', 'leg1', 'leg2', 'leg3', 'leg4'].forEach(limb => {
        limbs.add(params, limb, partNames).name(limb.toUpperCase()).onChange(v => {
            cowManager.cows.forEach(c => c.mapLimb(limb, v));
        });
    });
});

const networkManager = new NetworkManager(world, scene, player, controls);
world.setNetworkManager(networkManager);
itemManager.networkManager = networkManager;

const selectionBox = createSelectionBox(scene);

const uiManager = new UIManager(player, controls, itemManager, world, clouds, networkManager, audioManager);
networkManager.setUIManager(uiManager);
world.uiManager = uiManager;

const breakTextures = loadBreakTextures();
const { breakMesh, breakMat } = createBreakMesh(scene, breakTextures);

let lastDamageTime = 0;
let portalTime = 0;
let inPortal = false;
const portalOverlay = document.getElementById('portal-overlay');

window.addEventListener('player-damage', (e) => {
    if (controls.isCreative) return;
    const now = performance.now();
    if (now - lastDamageTime < 500) return;
    lastDamageTime = now;

    const amount = e.detail.amount;
    const newHealth = Math.max(0, uiManager.currentHealth - amount);
    uiManager.updateHealth(newHealth);
    controls.takeDamage(amount);
});

window.addEventListener('player-respawn', () => {
    isRespawning = true;
    
    // Reset to safe high position to watch world load without blocking screen
    const y = (world.dimension === 'nether') ? 95 : 200;
    controls.position.set(0, y, 0);
    controls.velocity.set(0, 0, 0);
    
    // Clear old queue and prioritize 0,0
    world.chunkQueue = [];
    world.queueChunks(0, 0);
    
    // Hide loading text explicitly
    if (loadingEl) loadingEl.style.display = 'none';
});

window.addEventListener('cmd-spawn-zombie', () => {
    const pPos = controls.getPosition();
    zombieManager.spawnZombie(pPos);
});

window.addEventListener('cmd-spawn-cow', () => {
    const pPos = controls.getPosition();
    cowManager.spawnCow(pPos, true);
});

window.addEventListener('cmd-spawn-pig', () => {
    const pPos = controls.getPosition();
    pigManager.spawnPig(pPos, true);
    // Also try spawning a few around
    for(let i=0; i<3; i++) pigManager.spawnPig(pPos, false);
});

controls.onInteract = () => {
    // Interaction logic (Milking, etc)
    const targets = [...cowManager.cows, ...pigManager.pigs]; // Add other interactable entities here
    const hitEntity = controls.raycastEntity(targets);
    
    if (hitEntity) {
        const heldItem = uiManager.inventory.getItem(uiManager.selectedSlot);
        const heldId = heldItem ? heldItem.id : 0;

        // Milking Logic
        if (hitEntity instanceof Cow) {
            if (heldId === BLOCKS.BUCKET) {
                // Give Milk Bucket
                uiManager.replaceHeldItem(BLOCKS.MILK_BUCKET);
                // Optional: Play Sound
                // audioManager.playSound('milking'); 
                player.swing();
                return true; // Interaction Handled
            }
        }
        
        // Riding & Saddling Logic
        if (hitEntity instanceof Pig) {
            // Saddle the pig
            if (heldId === BLOCKS.SADDLE && !hitEntity.saddled) {
                hitEntity.setSaddled(true);
                uiManager.consumeHeldItem();
                player.swing();
                // Play saddle sound?
                return true;
            }

            // Ride the pig
            if (hitEntity.saddled && !hitEntity.rider && !controls.sneak) {
                controls.mount(hitEntity);
                return true;
            }
        }
    }
    return false; // Not handled, proceed to block placement
};

controls.onPlace = (x, y, z, hitInfo) => {
    if (uiManager.isInventoryOpen) return;
    
    // Just swing if no coordinates (Interact only)
    if (x === undefined || y === undefined || z === undefined) {
        player.swing();
        return;
    }
    
    const blockId = uiManager.getSelectedBlockId();
    
    // Prevent placing items as blocks (except specific ones)
    const isPlaceableItem = (
        blockId === BLOCKS.TORCH ||
        (blockId >= BLOCKS.OAK_SAPLING && blockId <= BLOCKS.DARK_OAK_SAPLING)
    );
    // Items > 100 are mostly items. Buckets are handled in InteractionController.
    if (blockId >= 100 && !isPlaceableItem) return;

    if (blockId && blockId !== BLOCKS.STICK) {
        audioManager.init();
        
        let meta = 0;
        
        // Slabs
        if (blockId === BLOCKS.COBBLESTONE_SLAB) {
            if (hitInfo && hitInfo.point) {
                // Check if placed on top face of a block? No, check relative Y in the block space.
                // hitInfo.point is world coord.
                const relativeY = hitInfo.point.y - y;
                // If clicked on top face of block below (y-1), relativeY is near 0.
                // If clicked on bottom face of block above, relativeY is near 1.
                // Standard logic: If clicking top face of a block, it places on top -> Bottom Slab.
                // If clicking bottom face -> Top Slab.
                // If clicking side -> Upper/Lower half of side.
                
                if (hitInfo.face && hitInfo.face.normal.y > 0) meta = 0; // Top face -> Bottom slab
                else if (hitInfo.face && hitInfo.face.normal.y < 0) meta = 1; // Bottom face -> Top slab
                else {
                    // Side click
                    meta = (relativeY > 0.5) ? 1 : 0;
                }
            }
        }

        // Stairs
        if (blockId === BLOCKS.COBBLESTONE_STAIRS || blockId === BLOCKS.OAK_STAIRS) {
            // Direction based on player yaw
            const yaw = controls.getYaw();
            // Normalize yaw
            let normYaw = yaw % (Math.PI * 2);
            if (normYaw < 0) normYaw += Math.PI * 2;
            
            const deg = THREE.MathUtils.radToDeg(normYaw);
            
            // Meta mapping:
            // 0: East (+X) (Ascends East)
            // 1: West (-X) (Ascends West)
            // 2: South (+Z) (Ascends South)
            // 3: North (-Z) (Ascends North)
            
            // Player looking North (deg 315-45). We place stair facing South (Ascends North).
            if (deg >= 315 || deg < 45) meta = 3; 
            else if (deg >= 45 && deg < 135) meta = 0; // East (Was 1)
            else if (deg >= 135 && deg < 225) meta = 2; 
            else meta = 1; // West (Was 0)

            // Vertical placement (Upside Down)
            if (hitInfo) {
                // If clicking BOTTOM face of a block (normal.y < 0), always upside down
                if (hitInfo.face && hitInfo.face.normal.y < -0.5) {
                    meta |= 4; 
                } else if (hitInfo.face && hitInfo.face.normal.y > 0.5) {
                    // Top face, standard (Right side up)
                } else {
                    // Side face: check relative Y of hit point
                    const py = hitInfo.point.y;
                    const fracY = py - Math.floor(py);
                    // If fractional Y > 0.5 (top half), place upside down
                    if (fracY > 0.5) {
                        meta |= 4;
                    }
                }
            }
        }

        // Determine metadata for rotation (Furnace etc)
        if (blockId === BLOCKS.FURNACE || blockId === BLOCKS.FURNACE_ON) {
            // Apply proper rotation based on camera facing
            const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
            forward.y = 0; // Flatten to XZ plane
            forward.normalize();
            
            // Standard Minecraft Rotation: 
            // We want the block's front to face the player.
            
            if (Math.abs(forward.x) > Math.abs(forward.z)) {
                if (forward.x > 0) meta = 1; // Player looks East -> Block faces West (-X)
                else meta = 3; // Player looks West -> Block faces East (+X)
            } else {
                if (forward.z > 0) meta = 2; // Player looks South -> Block faces North (-Z)
                else meta = 0; // Player looks North -> Block faces South (+Z)
            }
        }

        world.setBlock(x, y, z, blockId, meta);
        player.swing();
        uiManager.consumeHeldItem();
        uiManager.incrementBlockStat();
    } else if (blockId === BLOCKS.STICK) {
        player.swing();
    }
};

window.addEventListener('toggle-night', () => {
    const progress = (dayNightCycle.dayTime % dayNightCycle.dayDuration) / dayNightCycle.dayDuration;
    if (progress > 0.25 && progress < 0.75) {
         dayNightCycle.dayTime = 0;
    } else {
         dayNightCycle.dayTime = dayNightCycle.dayDuration * 0.5;
    }
});

const originalRequestPointerLock = renderer.domElement.requestPointerLock;
renderer.domElement.requestPointerLock = function() {
    if (!uiManager.isPaused && !uiManager.isInventoryOpen && !uiManager.chatManager.isChatOpen) {
        const promise = originalRequestPointerLock.call(this);
        if (promise && typeof promise.catch === 'function') {
            promise.catch(err => {
                if (err.name === 'AbortError' || (err.message && err.message.includes('exited the lock'))) return;
                console.warn("Pointer lock failed:", err);
            });
        }
    }
};

document.addEventListener('pointerlockchange', () => {
    const locked = (document.pointerLockElement === renderer.domElement);
    controls.isLocked = locked;
    if (!locked && uiManager.gameStarted && !uiManager.isPaused && !uiManager.isInventoryOpen && !uiManager.chatManager.isChatOpen) {
        if (!uiManager.preventAutoPause) {
            uiManager.togglePause(true);
        }
    }
});

const uiFps = document.getElementById('fps-counter');
const uiBiome = document.getElementById('biome-debug');
const uiCont = document.getElementById('cont-debug');
const uiEro = document.getElementById('ero-debug');
const uiPV = document.getElementById('pv-debug');

let showDebug = true;
window.addEventListener('toggle-debug', () => {
    showDebug = !showDebug;
    document.getElementById('ui').style.display = showDebug ? 'block' : 'none';
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    cameraHUD.aspect = window.innerWidth / window.innerHeight;
    cameraHUD.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
let frames = 0;
let spawned = false; // Ensure this is 'let'
let isRespawning = false;
const loadingEl = document.getElementById('loading');

async function initGame() {
    animate();
}

window.addEventListener('start-game', async (e) => {
    loadingEl.style.display = 'block';
    const worldData = e.detail;
    
    // Restore normal gameplay render distance when a world starts
    world.setRenderDistance(CONFIG.RENDER_DISTANCE_DEFAULT);

    // Reset Day Cycle Speed for Gameplay
    dayNightCycle.dayDuration = CONFIG.DAY_DURATION;

    if (uiManager.isMultiplayer) {
        // Multiplayer Logic (Websim Room)
        if (!networkManager.connected) {
            await networkManager.init();
        }
        // In multiplayer, terrain/seed is sync'd from room, so we don't override from worldData
        spawned = false;
    } else {
        // Singleplayer Logic
        if (networkManager.connected) {
            networkManager.disconnect();
        }
        
        if (worldData) {
            console.log("Loading World:", worldData);
            world.terrainGen = new TerrainGenerator(worldData.seed);
            world.terrainGen.setType(worldData.type || 'default');
            world.clear(); 
            
            // Removed Pre-generate Nether Chunks logic to improve load times
        }
        
        if (worldData.hasSave && worldData.savePos) {
            // Restore position
            controls.position.set(worldData.savePos.x, worldData.savePos.y, worldData.savePos.z);
            controls.viewAngles.yaw = worldData.savePos.yaw;
            controls.viewAngles.pitch = worldData.savePos.pitch;
            controls.velocity.set(0, 0, 0);
            controls.fallStartY = controls.position.y;
            
            camera.position.copy(controls.position).add(new THREE.Vector3(0, controls.eyeHeight, 0));
            camera.rotation.set(worldData.savePos.pitch, worldData.savePos.yaw, 0, 'YXZ');
            
            spawned = true; // Skip spawn search
            loadingEl.style.display = 'none';
        } else {
            spawned = false; // Trigger spawn search
        }
    }

    frames = 0;
});

window.addEventListener('player-respawn', () => {
    isRespawning = true;
    
    // Reset to safe high position to watch world load without blocking screen
    const y = (world.dimension === 'nether') ? 95 : 200;
    controls.position.set(0, y, 0);
    controls.velocity.set(0, 0, 0);
    
    // Clear old queue and prioritize 0,0
    world.chunkQueue = [];
    world.queueChunks(0, 0);
    
    // Hide loading text explicitly
    if (loadingEl) loadingEl.style.display = 'none';
});

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    const time = clock.getElapsedTime();
    
    // Update animated textures (Water/Lava)
    updateTextureAtlas(delta);

    // Nether Portal Animation
    if (document.getElementById('portal-overlay').style.display !== 'none') {
        const turbulence = document.querySelector('#portal-wave feTurbulence');
        if (turbulence) {
            // Animate turbulence seed/frequency for wavy effect
            // We can abuse baseFrequency to shift the noise
            const freq = 0.05 + Math.sin(time * 5.0) * 0.005;
            turbulence.setAttribute('baseFrequency', `${freq} ${freq}`);
        }
    }

    if (uiFps) uiFps.innerText = Math.round(1 / delta);

    if (!uiManager.gameStarted) {
        // Title Screen Live Map
        const panSpeed = 0.08;
        const panRadius = 60;
        
        // Circular Flight
        camera.position.x = Math.sin(time * panSpeed) * panRadius;
        camera.position.z = Math.cos(time * panSpeed) * panRadius;
        
        // Terrain Following Height
        let h = 70;
        try {
            // Sample terrain height directly from generator (fast math)
            h = world.terrainGen.getHeight(camera.position.x, camera.position.z);
        } catch(e) {}
        
        // Smooth camera Y
        camera.position.y = Math.max(80, h + 25);
        
        // Look towards center-ish but slightly sweeping
        camera.lookAt(0, 60, 0);

        // Update World & Visuals
        world.update(camera.position, time, delta, camera, false);
        clouds.update(time, camera.position);
        
        // Accelerated Day/Night for ambiance
        dayNightCycle.dayDuration = 120;
        const { skyColor } = dayNightCycle.update(delta, false, camera);
        
        // Match Atmosphere
        const skyFactor = Math.max(0.02, Math.min(1, (camera.position.y - 20) / 40));
        const currentSky = skyColor.clone().multiplyScalar(skyFactor);
        scene.fog.color.copy(currentSky);
        scene.background = currentSky;

        renderer.render(scene, camera);
        return;
    }

    // Update Furnace logic
    if (uiManager.furnaceManager) {
        uiManager.furnaceManager.tick(delta, uiManager.furnaceSlots, () => uiManager.updateUI());
        // Update visual progress bars every frame if open
        if (uiManager.isInventoryOpen && uiManager.inventoryMode === 'furnace') {
            uiManager.updateFurnaceProgress();
        }
    }

    if (!spawned) {
        if (skyboxTexture) scene.background = new THREE.Color(0x87CEEB);
        // Enable high-budget preloading
        world.update(camera.position, time, delta, camera, true);
        
        // Spawn as soon as valid ground is found (minimal preloading)
        if(attemptSpawn(world, camera, controls, loadingEl)) {
            spawned = true;
        }
        
        camera.position.x = Math.sin(time * 0.5) * 30;
        camera.position.z = Math.cos(time * 0.5) * 30;
        camera.position.y = 80;
        camera.lookAt(0, 50, 0);
        
        renderer.render(scene, camera);
    } else {
        if (frames === 0) audioManager.init();

        if (isRespawning) {
            // Force high-speed chunk loading while respawning
            world.update(controls.position, time, delta, camera, true);
            
            if (attemptSpawn(world, camera, controls, null)) {
                isRespawning = false;
            } else {
                // Keep player suspended while terrain generates
                const y = (world.dimension === 'nether') ? 95 : 200;
                controls.position.set(0, y, 0);
                controls.velocity.set(0, 0, 0);
            }
        }

        if (uiManager.isPaused) {
            audioManager.update(delta, new THREE.Vector3(), true, false, true);
            renderer.render(scene, camera);
            return;
        }
        
        const camPos = camera.position;
        const eyeBlockId = world.getBlock(camPos.x, camPos.y, camPos.z);
        const isUnderwater = (eyeBlockId === 6);
        const isInPortal = (eyeBlockId === BLOCKS.NETHER_PORTAL);

        if (isInPortal) {
            inPortal = true;
            portalTime += delta;
            portalOverlay.style.display = 'block';
            
            // Ramp up opacity
            const opacity = Math.min(1.0, portalTime / 3.0);
            portalOverlay.style.opacity = opacity;
            
            // Wobble intensity could be dynamic via JS modifying SVG DOM, but simple CSS anim is set
            
            if (portalTime > 3.0) { // Faster portal transition (3s)
                // Teleport!
                portalTime = 0;
                inPortal = false;
                portalOverlay.style.opacity = 0;
                portalOverlay.style.display = 'none';
                
                const targetDim = world.dimension === 'overworld' ? 'nether' : 'overworld';
                window.dispatchEvent(new CustomEvent('cmd-dimension', { detail: targetDim }));
            }
        } else {
            if (inPortal) {
                // Just exited
                portalTime -= delta * 2; // Decay faster
                if (portalTime <= 0) {
                    portalTime = 0;
                    inPortal = false;
                    portalOverlay.style.display = 'none';
                } else {
                    portalOverlay.style.opacity = Math.min(1.0, portalTime / 3.0);
                }
            }
        }

        controls.update(delta, isUnderwater);
        networkManager.update(delta);
        
        const pPosFeet = controls.getPosition();
        const blockFeet = world.getBlock(Math.floor(pPosFeet.x), Math.floor(pPosFeet.y), Math.floor(pPosFeet.z));
        const blockHead = world.getBlock(Math.floor(pPosFeet.x), Math.floor(pPosFeet.y + 1.6), Math.floor(pPosFeet.z));
        
        const lavaOverlay = document.getElementById('lava-overlay');
        if (blockHead === BLOCKS.LAVA || (blockFeet === BLOCKS.LAVA && !controls.onGround)) {
             if (lavaOverlay) lavaOverlay.style.opacity = 0.7;
        } else {
             if (lavaOverlay) lavaOverlay.style.opacity = 0;
        }

        const blockBelow = world.getBlock(Math.floor(pPosFeet.x), Math.floor(pPosFeet.y - 0.2), Math.floor(pPosFeet.z));
        
        audioManager.update(delta, controls.velocity, controls.onGround, controls.sneak, false, blockBelow);

        const pPos = controls.getPosition();
        let worldLightLevel = 1.0;
        if (spawned) {
             const lx = Math.floor(camera.position.x);
             const ly = Math.floor(camera.position.y);
             const lz = Math.floor(camera.position.z);
             const light = world.getLight(lx, ly, lz);
             worldLightLevel = light / 15.0; 
        }
        
        player.update(delta, time, pPos, controls.getYaw(), controls.getPitch(), controls.velocity, controls.cameraMode, controls.sneak, isUnderwater, controls.isDigging, controls.damageTilt, !!controls.ridingEntity);
        
        if (controls.cameraMode === 0) {
            player.hand.applyLight(worldLightLevel);
        }
        
        if (controls.miningResult && controls.miningResult.mining && controls.targetedBlock) {
             const prog = controls.miningResult.progress;
             if (prog > 0) {
                 const stage = Math.min(9, Math.floor(prog * 10));
                 if (stage >= 0) {
                      breakMat.map = breakTextures[stage];
                      breakMat.needsUpdate = true;
                      breakMesh.visible = true;
                      breakMesh.position.set(controls.targetedBlock.x + 0.5, controls.targetedBlock.y + 0.5, controls.targetedBlock.z + 0.5);
                 }
             } else { breakMesh.visible = false; }

             if (controls.miningResult.broke) {
                 audioManager.playBreak(controls.targetedBlock.id);
             }
        } else { breakMesh.visible = false; }

        if (controls.targetedBlock) {
            selectionBox.visible = true;
            selectionBox.position.set(controls.targetedBlock.x + 0.5, controls.targetedBlock.y + 0.5, controls.targetedBlock.z + 0.5);
        } else { selectionBox.visible = false; }

        const { sunHeight, skyColor } = dayNightCycle.update(delta, uiManager.isPaused, camera);

        world.update(pPos, time, delta, camera);
        clouds.update(time, pPos);
        particleSystem.update(delta, camera);
        itemManager.update(delta, time, pPos);
        zombieManager.update(delta, pPos, sunHeight);
        cowManager.update(delta, pPos, sunHeight);
        pigManager.update(delta, pPos, sunHeight, controls); // Update Pigs with controls
        pigmanManager.update(delta, pPos);
        fallingBlockManager.update(delta);
        
        if (isUnderwater) {
            const WATER_COLOR = new THREE.Color(0x002080);
            scene.fog.color.copy(WATER_COLOR);
            scene.background = WATER_COLOR;
            scene.fog.near = 0.1;
            scene.fog.far = 20;
        } else if (world.dimension === 'nether') {
            const NETHER_COLOR = new THREE.Color(0x300505);
            scene.fog.color.copy(NETHER_COLOR);
            scene.background = NETHER_COLOR;
            const viewDist = world.renderDistance * 16;
            scene.fog.near = 10;
            scene.fog.far = Math.min(viewDist * 0.9, 120); 
        } else {
            const skyFactor = Math.max(0.02, Math.min(1, (camera.position.y - 20) / 40));
            const currentSky = skyColor.clone().multiplyScalar(skyFactor);
            scene.fog.color.copy(currentSky);
            scene.background = currentSky;
            const viewDist = world.renderDistance * 16;
            scene.fog.near = viewDist * 0.25;
            scene.fog.far = viewDist * 0.95;
        }

        renderer.clear();
        renderer.render(scene, camera);
        
        if (controls.cameraMode === 0) {
            renderer.clearDepth();
            renderer.render(sceneHUD, cameraHUD);
        }
    }

    if (frames % 15 === 0) {
        const info = world.getBiomeInfo(camera.position.x, camera.position.z);
        if (world.dimension === 'nether') {
            uiBiome.innerText = "Nether Wastes";
        } else if (info) {
            uiBiome.innerText = world.terrainGen.getBiomeName(camera.position.x, camera.position.z, camera.position.y);
            uiCont.innerText = info.cont.toFixed(2);
            uiEro.innerText = info.erosion.toFixed(2);
            uiPV.innerText = info.pv.toFixed(2);
        }
    }
    frames++;
}

initGame();
uiManager.loadDefaultSkin('./44a5ec16ce1e57fa.png');