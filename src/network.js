import * as THREE from 'three';
import { RemotePlayer } from './remote_player.js';
import { BLOCKS } from './blocks.js';

export class NetworkManager {
    constructor(world, scene, player, controls) {
        this.world = world;
        this.scene = scene;
        this.localPlayer = player;
        this.controls = controls;
        this.room = new WebsimSocket();
        this.peers = {}; // id -> RemotePlayer
        this.updateRate = 0.05; // 20 ticks/sec
        this.timer = 0;

        this.connected = false;
        
        // LAN features
        this.lanCode = null;
        this.isHost = false;
        this.mode = 'offline'; // 'offline', 'lan', 'server'
    }

    setUIManager(uiManager) {
        this.uiManager = uiManager;
    }

    // Start hosting a LAN game
    async hostGame() {
        if (this.connected && this.mode === 'lan') return this.lanCode;
        
        // Generate 6 digit code
        this.lanCode = Math.floor(100000 + Math.random() * 900000).toString();
        this.isHost = true;
        this.mode = 'lan';
        
        console.log(`Hosting LAN Game: ${this.lanCode}`);
        await this.init();
        
        return this.lanCode;
    }

    // Join a LAN game
    async joinGame(code) {
        if (this.connected) this.disconnect();
        
        this.lanCode = code.toString();
        this.isHost = false;
        this.mode = 'lan';
        
        console.log(`Joining LAN Game: ${this.lanCode}`);
        await this.init();
        
        // Request world data from host
        this.room.send({
            type: 'request-world-data',
            lanCode: this.lanCode
        });
        
        if (this.uiManager) {
            this.uiManager.addChatMessage('System', `Joined LAN game: ${this.lanCode}`);
        }
    }

    // Server Mode: Persistent World
    async connectToServer() {
        if (this.connected) this.disconnect();
        this.mode = 'server';
        this.isHost = false; // Everyone is equal in server mode regarding physics, but state is shared
        
        await this.init();
        
        // Check Room State for World Data
        const state = this.room.roomState;
        if (state && state.seed) {
            console.log("Found persistent server world.");
            // Load Server World
            if (this.world.terrainGen.seed !== state.seed || this.world.terrainGen.type !== state.worldType) {
                this.syncWorld(state.seed, state.worldType);
            }
            // Load Blocks
            if (state.blocks) {
                // Bulk load block changes
                // state.blocks is map "x,y,z" -> {id, meta}
                // We need to apply this carefully
                for(const key in state.blocks) {
                    const [x, y, z] = key.split(',').map(Number);
                    const b = state.blocks[key];
                    this.world.setBlock(x, y, z, b.id, b.meta, false);
                }
            }
        } else {
            // First one here initializes the server?
            // Or explicit "Create Server" action.
            console.log("No server world found. Waiting for init or creation.");
        }
    }

    async publishServerWorld() {
        if (!this.connected) await this.connectToServer();
        
        const seed = this.world.terrainGen.seed;
        const type = this.world.terrainGen.type;
        const blocks = this.world.exportModifications();
        
        this.room.updateRoomState({
            seed: seed,
            worldType: type,
            blocks: blocks
        });
        
        this.uiManager.showNotification("World Published to Server!", 3000);
    }

    async init() {
        if (this.connected) return; 
        
        await this.room.initialize();
        this.connected = true;
        console.log("Connected to Socket.");

        this.room.onmessage = (event) => {
            if (!event || !event.data) return;

            const { type, clientId, data, username, lanCode } = event.data;
            
            // Filter by LAN Code if in LAN mode
            if (this.mode === 'lan') {
                if (lanCode !== this.lanCode) return;
            }

            if (type === 'request-world-data') {
                // Only host responds in LAN
                if (this.mode === 'lan' && this.isHost) {
                    console.log("Sending world data to " + clientId);
                    this.room.send({
                        type: 'world-data-response',
                        lanCode: this.lanCode,
                        targetId: clientId,
                        seed: this.world.terrainGen.seed,
                        worldType: this.world.terrainGen.type
                    });
                }
            } else if (type === 'world-data-response') {
                if (data.targetId === this.room.clientId && !this.isHost) {
                    console.log("Received world data. Syncing...");
                    this.syncWorld(data.seed, data.worldType);
                }
            } else if (type === 'swing') {
                const peer = this.peers[clientId];
                if (peer) peer.triggerSwing();
            } else if (type === 'chat') {
                if (this.uiManager) {
                    this.uiManager.addChatMessage(username, data.message);
                }
            } else if (type === 'block-update') {
                // Ephemeral block update (LAN)
                const { x, y, z, id, meta } = data;
                this.world.setBlock(x, y, z, id, meta, false); 
            } else if (type === 'dropItem') {
                if (this.world && this.world.itemManager) {
                    const pos = new THREE.Vector3(data.x, data.y, data.z);
                    const vel = new THREE.Vector3(data.vx, data.vy, data.vz);
                    const count = data.count || 1;
                    this.world.itemManager.spawnItem(pos, data.blockId, vel, count, true, data.id);
                }
            } else if (type === 'collectItem') {
                if (this.world && this.world.itemManager) {
                    this.world.itemManager.removeItem(data.id);
                }
            }
        };

        // Subscribe to presence
        this.room.subscribePresence((presence) => {
            this.handlePresenceUpdate(presence);
        });

        // Subscribe to Room State (Server Mode)
        this.room.subscribeRoomState((state) => {
            if (this.mode === 'server') {
                // Check if world init
                if (state.seed && (this.world.terrainGen.seed !== state.seed)) {
                    this.syncWorld(state.seed, state.worldType);
                }
                
                // Sync Blocks
                if (state.blocks) {
                    // This is heavy if sending all blocks every time. 
                    // WebsimSocket sends diffs usually? No, full state usually.
                    // Ideally we'd use a log or diffs.
                    // For now, let's just iterate.
                    // Optimization: Only check if count changed? No.
                    
                    // Simple incremental check:
                    // Only apply if not matching local
                    for (const key in state.blocks) {
                        const [x, y, z] = key.split(',').map(Number);
                        const b = state.blocks[key];
                        // Get local
                        const currentId = this.world.getBlock(x, y, z);
                        const currentMeta = this.world.getBlockMetadata(x, y, z);
                        if (currentId !== b.id || currentMeta !== b.meta) {
                            this.world.setBlock(x, y, z, b.id, b.meta, false);
                        }
                    }
                }
            }
        });
    }

    syncWorld(seed, type) {
        // Re-generate world with host's seed
        if (this.world.terrainGen.seed !== seed || this.world.terrainGen.type !== type) {
             this.world.terrainGen = new this.world.terrainGen.constructor(seed);
             this.world.terrainGen.setType(type || 'default');
             this.world.clear();
             // Respawn player
             window.dispatchEvent(new CustomEvent('player-respawn'));
        }
    }

    disconnect() {
        this.connected = false;
        this.isHost = false;
        this.lanCode = null;
        this.mode = 'offline';
        for (const id in this.peers) {
            this.peers[id].dispose();
        }
        this.peers = {};
    }
    
    sendSwing() {
        if (!this.connected) return;
        this.room.send({ type: 'swing', lanCode: this.lanCode });
    }

    sendChat(message) {
        if (!this.connected) return;
        this.room.send({ 
            type: 'chat',
            lanCode: this.lanCode,
            data: { message }
        });
    }

    sendItemDrop(pos, blockId, velocity, count = 1, itemId) {
        if (!this.connected) return;
        this.room.send({
            type: 'dropItem',
            lanCode: this.lanCode,
            data: {
                x: pos.x, y: pos.y, z: pos.z,
                blockId: blockId,
                vx: velocity ? velocity.x : 0,
                vy: velocity ? velocity.y : 0,
                vz: velocity ? velocity.z : 0,
                count: count,
                id: itemId
            }
        });
    }

    sendItemCollect(itemId) {
        if (!this.connected) return;
        this.room.send({
            type: 'collectItem',
            lanCode: this.lanCode,
            data: { id: itemId }
        });
    }

    broadcastBlockUpdate(x, y, z, id) {
        if (!this.connected) return;
        
        if (this.mode === 'server') {
            // Update Room State persistent storage
            const key = `${x},${y},${z}`;
            const meta = this.world.getBlockMetadata(x, y, z);
            
            // We need to merge into existing blocks object
            // room.roomState.blocks is expected to be an object
            // updateRoomState does a shallow merge of top level keys.
            // But we need to update a nested key 'blocks'.
            
            // Websim Room State hack: nested updates need full object or cleverness.
            // room.updateRoomState({ blocks: { [key]: { id, meta } } }) MIGHT overwrite 'blocks' entirely depending on impl.
            // Standard Websim behavior usually merges top level.
            // To be safe and efficient, let's assume we can pass the whole updated blocks map 
            // OR use a specific event for realtime updates, and periodic save for state.
            
            // Actually, let's try the merge approach. If it fails, we fall back to event based + state save.
            // Better approach for Multiplayer:
            // Send event for immediate visual update to peers.
            // Send state update for persistence.
            
            this.room.send({
                type: 'block-update', // Realtime visual
                data: { x, y, z, id, meta }
            });
            
            // Persistence (Debounce this? No, just send it)
            // Warning: Potential race condition if two people edit.
            // We use the 'blocks' object in roomState.
            const blocks = this.room.roomState.blocks || {};
            blocks[key] = { id, meta };
            this.room.updateRoomState({ blocks });
            
        } else {
            // LAN (Ephemeral)
            this.room.send({
                type: 'block-update',
                lanCode: this.lanCode,
                data: { x, y, z, id, meta: 0 }
            });
        }
    }

    update(delta) {
        if (!this.connected) return;

        this.timer += delta;
        if (this.timer >= this.updateRate) {
            this.timer = 0;

            const pos = this.controls.getPosition();
            const yaw = this.controls.getYaw();
            const pitch = this.controls.getPitch();
            const vel = this.controls.velocity;
            const isWalking = vel.lengthSq() > 0.1 && this.controls.onGround;
            const skinUrl = (this.uiManager && this.uiManager.currentSkinUrl) ? this.uiManager.currentSkinUrl : 'default';
            const modelType = (this.localPlayer && this.localPlayer.modelType) ? this.localPlayer.modelType : 'default';
            const heldId = this.uiManager ? this.uiManager.getSelectedBlockId() : 0;
            const isRiding = !!this.controls.ridingEntity;

            this.room.updatePresence({
                lanCode: this.lanCode, // Key for filtering
                x: pos.x, y: pos.y, z: pos.z,
                yaw: yaw, pitch: pitch,
                walking: isWalking,
                sneaking: this.controls.sneak,
                riding: isRiding,
                skin: skinUrl,
                model: modelType, // 'default' or 'slim'
                heldBlock: heldId,
                username: this.room.peers[this.room.clientId]?.username || "Player"
            });
        }

        for (const p of Object.values(this.peers)) {
            p.update(delta, p.targetPos, p.targetRot, p.targetPitch || 0, p.isWalking, p.isSneaking, p.isRiding);
        }
        
        // Update Tab List content if UI manager is linked
        if (this.uiManager) {
            this.uiManager.updatePlayerTabList(this.getPeerList());
        }
    }

    getPeerList() {
        const list = [];
        // Add self
        list.push({ 
            username: this.room.peers[this.room.clientId]?.username || "Me", 
            ping: "0ms", // Local
            isSelf: true 
        });
        
        // Add others
        for (const id in this.peers) {
            // Filter valid peers
            if (this.peers[id] && this.room.peers[id]) {
                list.push({
                    username: this.room.peers[id].username,
                    ping: "5ms", 
                    isSelf: false
                });
            }
        }
        return list;
    }

    handlePresenceUpdate(presence) {
        const activeIds = new Set();

        for (const [id, data] of Object.entries(presence)) {
            if (id === this.room.clientId) continue; 
            
            // Check LAN Code if in LAN mode
            if (this.mode === 'lan' && data.lanCode !== this.lanCode) continue;

            activeIds.add(id);

            if (!this.peers[id]) {
                const peerInfo = this.room.peers[id];
                const username = data.username || (peerInfo ? peerInfo.username : "Player");
                const skinId = data.skin || 'default';
                const model = data.model || 'default';
                
                // Fix: Ensure we spawn them safely, or interpolate from their current pos
                // Default to high Y if unknown, but data.y should be present
                const spawnY = data.y !== undefined ? data.y : 100;
                
                const spawnPos = new THREE.Vector3(
                    data.x !== undefined ? data.x : 0,
                    spawnY,
                    data.z !== undefined ? data.z : 0
                );

                const p = new RemotePlayer(this.scene, spawnPos, skinId, username, model);
                this.peers[id] = p;
                
                if (this.uiManager) this.uiManager.addChatMessage('System', `${username} joined the game.`);
            }

            const p = this.peers[id];
            if (data.x !== undefined && data.y !== undefined) {
                p.targetPos.set(data.x, data.y, data.z); 
                p.targetRot = data.yaw || 0;
                p.targetPitch = data.pitch || 0;
                p.isWalking = data.walking;
                p.isSneaking = data.sneaking;
                p.isRiding = !!data.riding;
                
                if (data.heldBlock !== undefined) {
                    p.setHeldItem(data.heldBlock);
                }
                
                // Update Skin/Model if changed
                if ((data.skin !== undefined && data.skin !== p.currentSkinUrl) ||
                    (data.model !== undefined && data.model !== p.modelType)) {
                    p.loadSkin(data.skin, data.model);
                }
                
                // Update name if available
                if (data.username && p.username !== data.username) {
                    p.username = data.username;
                    p.updateNameTag(data.username);
                }
            }
        }

        for (const id of Object.keys(this.peers)) {
            if (!activeIds.has(id)) {
                const p = this.peers[id];
                if (this.uiManager) this.uiManager.addChatMessage('System', `A player left the game.`);
                p.dispose();
                delete this.peers[id];
            }
        }
    }
}