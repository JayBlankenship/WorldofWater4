import * as THREE from 'https://cdn.skypack.dev/three@0.134.0';
import { GLTFLoader } from 'https://cdn.skypack.dev/three@0.134.0/examples/jsm/loaders/GLTFLoader.js';

export class NetworkedPlayer {
    constructor(peerId, scene, isHost = false) {
        this.peerId = peerId;
        this.scene = scene;
        this.isHost = isHost; // Track if this is the host/server player
        
        console.log(`[NetworkedPlayer] Creating ${isHost ? 'HOST' : 'CLIENT'} ship for peer: ${peerId}`);
        
        // Create the player group that will hold the ship
        this.pawn = new THREE.Group();
        this.pawn.position.set(0, 20, 0); // Start at water level
        
        // Load Ship1.glb for networked players - same model as local player
        const loader = new GLTFLoader();
        loader.load(
            './Ship1.glb',
            (gltf) => {
                console.log(`[NetworkedPlayer] Ship1.glb loaded successfully for peer: ${peerId}`);
                const shipModel = gltf.scene;
                
                // Configure the ship
                shipModel.scale.setScalar(1.0);
                shipModel.position.y = 0;
                
                // Apply different colors based on role
                this.applyShipStyling(shipModel, isHost);
                
                this.pawn.add(shipModel);
                this.pawn.shipModel = shipModel; // Store reference
                
                console.log(`[NetworkedPlayer] Ship added to scene for peer: ${peerId}`);
            },
            (progress) => {
                console.log(`[NetworkedPlayer] Loading Ship1.glb progress for ${peerId}:`, (progress.loaded / progress.total) * 100 + '%');
            },
            (error) => {
                console.error(`[NetworkedPlayer] Error loading Ship1.glb for peer ${peerId}:`, error);
                
                // Fallback: create a simple colored ship if GLTF fails
                this.createFallbackShip(isHost);
            }
        );
        
        this.scene.add(this.pawn);
        
        // Network state tracking
        this.lastKnownState = {
            position: { x: 0, y: 20, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            timestamp: Date.now()
        };
        
        // Network status
        this.lastUpdateTime = Date.now();
        this.isActive = true;
        
        console.log(`[NetworkedPlayer] Created networked ship for peer: ${peerId} at position:`, this.pawn.position);
    }
    
    // Apply visual styling based on player role
    applyShipStyling(shipModel, isHost) {
        const color = isHost ? new THREE.Color(0x00FF00) : new THREE.Color(0xFF0000); // Green for host, red for clients
        const colorName = isHost ? 'GREEN (HOST)' : 'RED (CLIENT)';
        
        shipModel.traverse((child) => {
            if (child.isMesh && child.material) {
                // Clone material to avoid affecting other instances
                child.material = child.material.clone();
                
                // Apply color tint
                if (child.material.color) {
                    child.material.color.lerp(color, 0.3); // 30% color tint
                }
                
                // Add emissive glow for visibility
                if (child.material.emissive) {
                    child.material.emissive.copy(color);
                    child.material.emissiveIntensity = 0.15;
                }
            }
        });
        
        console.log(`[NetworkedPlayer] Applied ${colorName} styling to ship: ${this.peerId}`);
    }
    
    // Create fallback ship if GLTF loading fails
    createFallbackShip(isHost) {
        const color = isHost ? 0x00FF00 : 0xFF0000; // Green for host, red for clients
        const emissive = isHost ? 0x004400 : 0x440000;
        
        const fallbackGeometry = new THREE.BoxGeometry(3, 1, 6);
        const fallbackMaterial = new THREE.MeshLambertMaterial({ 
            color: color,
            emissive: emissive,
            emissiveIntensity: 0.2
        });
        const fallbackShip = new THREE.Mesh(fallbackGeometry, fallbackMaterial);
        fallbackShip.position.y = 0;
        this.pawn.add(fallbackShip);
        this.pawn.shipModel = fallbackShip;
        
        console.log(`[NetworkedPlayer] Fallback ship created for peer: ${this.peerId}`);
    }
    
    // Update the player's state from network data
    updateFromNetwork(state) {
        if (!state || !state.position) {
            console.warn(`[NetworkedPlayer] Invalid state received for ${this.peerId}:`, state);
            return;
        }
        
        this.lastKnownState = { ...state };
        this.lastUpdateTime = Date.now();
        this.isActive = true;
        
        // Directly apply the exact position and rotation vectors from the network
        // This includes all bobbing, tilting, and physics that the sender calculated
        this.pawn.position.set(state.position.x, state.position.y, state.position.z);
        
        if (state.rotation) {
            this.pawn.rotation.set(state.rotation.x, state.rotation.y, state.rotation.z);
        }
        
        // Apply ship model rotation (pitch, roll, leaning) if available
        if (state.shipModelRotation && this.pawn.shipModel) {
            this.pawn.shipModel.rotation.set(
                state.shipModelRotation.x, 
                state.shipModelRotation.y, 
                state.shipModelRotation.z
            );
        }
        
        // Apply ship model position (bobbing effects) if available
        if (state.shipModelPosition && this.pawn.shipModel) {
            this.pawn.shipModel.position.set(
                state.shipModelPosition.x, 
                state.shipModelPosition.y, 
                state.shipModelPosition.z
            );
        }
        
        // Update surge state if available
        if (typeof state.surgeActive !== 'undefined' && this.pawn.setSurge) {
            this.pawn.setSurge(state.surgeActive);
        }
        
        console.log(`[NetworkedPlayer] Updated ${this.isHost ? 'HOST' : 'CLIENT'} ship ${this.peerId} to position:`, this.pawn.position, 'shipModel rotation:', this.pawn.shipModel?.rotation);
    }
    
    // Update the networked player (called each frame)
    update(deltaTime, animationTime) {
        // Check for network timeout (if no updates received for too long)
        const timeSinceLastUpdate = Date.now() - this.lastUpdateTime;
        const NETWORK_TIMEOUT = 5000; // 5 seconds
        
        if (timeSinceLastUpdate > NETWORK_TIMEOUT && this.isActive) {
            console.warn(`[NetworkedPlayer] No network updates for ${this.peerId} in ${timeSinceLastUpdate}ms - marking as inactive`);
            this.isActive = false;
            // Could add visual indicator here (fade out, different color, etc.)
        }
        
        // Pure network replication - no local physics or movement
        // All bobbing, tilting, and physics are already baked into the position/rotation
        // vectors received from the network, so we don't modify them at all
    }
    
    // Check if this networked player is currently active
    isPlayerActive() {
        return this.isActive;
    }
    
    // Get the role of this networked player
    getRole() {
        return this.isHost ? 'HOST' : 'CLIENT';
    }
    
    // Remove the networked player from the scene
    destroy() {
        if (this.pawn && this.scene) {
            this.scene.remove(this.pawn);
            console.log(`[NetworkedPlayer] Removed networked ship: ${this.peerId}`);
        }
    }
    
    // Get the current position for distance calculations, etc.
    getPosition() {
        return this.pawn.position.clone();
    }
}

// NetworkedPlayerManager - manages all remote player ships
export class NetworkedPlayerManager {
    constructor(scene) {
        this.scene = scene;
        this.networkedPlayers = new Map(); // Map<peerId, NetworkedPlayer>
        this.isMultiplayerMode = false;
        this.localPeerId = null;
        
        console.log('[NetworkedPlayerManager] Initialized');
        
        // Detect if we're in multiplayer mode
        this.detectMultiplayerMode();
    }
    
    // Detect if we're running in single player or multiplayer mode
    detectMultiplayerMode() {
        // Check if networking system is available and initialized
        if (window.Network && window.Network.isInitialized) {
            this.isMultiplayerMode = true;
            this.localPeerId = window.Network.myPeerId;
            console.log(`[NetworkedPlayerManager] Multiplayer mode detected - Local peer: ${this.localPeerId}`);
        } else {
            this.isMultiplayerMode = false;
            console.log('[NetworkedPlayerManager] Single player mode detected');
        }
    }
    
    // Check if we should create networked players (only in multiplayer)
    shouldCreateNetworkedPlayers() {
        return this.isMultiplayerMode;
    }
    
    // Add a new networked player ship
    addPlayer(peerId, isHost = false) {
        // Don't create networked players in single player mode
        if (!this.shouldCreateNetworkedPlayers()) {
            console.log(`[NetworkedPlayerManager] Skipping player creation in single player mode: ${peerId}`);
            return;
        }
        
        // Don't create a networked player for ourselves
        if (peerId === this.localPeerId) {
            console.log(`[NetworkedPlayerManager] Skipping self-player creation: ${peerId}`);
            return;
        }
        
        if (this.networkedPlayers.has(peerId)) {
            console.warn(`[NetworkedPlayerManager] Player ${peerId} already exists`);
            return;
        }
        
        const networkedPlayer = new NetworkedPlayer(peerId, this.scene, isHost);
        this.networkedPlayers.set(peerId, networkedPlayer);
        
        console.log(`[NetworkedPlayerManager] Added ${isHost ? 'HOST' : 'CLIENT'} ship: ${peerId}`);
    }
    
    // Remove a networked player
    removePlayer(peerId) {
        const networkedPlayer = this.networkedPlayers.get(peerId);
        if (networkedPlayer) {
            networkedPlayer.destroy();
            this.networkedPlayers.delete(peerId);
            console.log(`[NetworkedPlayerManager] Removed ship: ${peerId}`);
        }
    }
    
    // Update a player's state from network data
    updatePlayer(peerId, state) {
        // Only handle updates in multiplayer mode
        if (!this.shouldCreateNetworkedPlayers()) {
            return;
        }
        
        const networkedPlayer = this.networkedPlayers.get(peerId);
        if (networkedPlayer) {
            networkedPlayer.updateFromNetwork(state);
        } else {
            console.warn(`[NetworkedPlayerManager] Received update for unknown ship: ${peerId}`);
            // Auto-create player if they don't exist (they might have joined mid-game)
            const isHost = window.Network && window.Network.isBase && peerId !== window.Network.myPeerId;
            this.addPlayer(peerId, isHost);
            
            // Try to update again after creation
            const newPlayer = this.networkedPlayers.get(peerId);
            if (newPlayer) {
                newPlayer.updateFromNetwork(state);
            }
        }
    }
    
    // Update all networked player ships (called each frame)
    update(deltaTime, animationTime) {
        // Only update in multiplayer mode
        if (!this.shouldCreateNetworkedPlayers()) {
            return;
        }
        
        for (const [peerId, networkedPlayer] of this.networkedPlayers) {
            networkedPlayer.update(deltaTime, animationTime);
        }
        
        // Clean up inactive players periodically
        this.cleanupInactivePlayers();
    }
    
    // Remove players that haven't been updated in a long time
    cleanupInactivePlayers() {
        const CLEANUP_INTERVAL = 10000; // Check every 10 seconds
        const now = Date.now();
        
        if (!this.lastCleanupTime || now - this.lastCleanupTime > CLEANUP_INTERVAL) {
            this.lastCleanupTime = now;
            
            for (const [peerId, networkedPlayer] of this.networkedPlayers) {
                if (!networkedPlayer.isPlayerActive()) {
                    console.log(`[NetworkedPlayerManager] Cleaning up inactive player: ${peerId}`);
                    this.removePlayer(peerId);
                }
            }
        }
    }
    
    // Get all networked player ship positions (for terrain generation, etc.)
    getAllPositions() {
        if (!this.shouldCreateNetworkedPlayers()) {
            return [];
        }
        
        const positions = [];
        for (const [peerId, networkedPlayer] of this.networkedPlayers) {
            if (networkedPlayer.isPlayerActive()) {
                positions.push(networkedPlayer.getPosition());
            }
        }
        return positions;
    }
    
    // Get count of active networked players
    getActivePlayerCount() {
        if (!this.shouldCreateNetworkedPlayers()) {
            return 0;
        }
        
        let count = 0;
        for (const [peerId, networkedPlayer] of this.networkedPlayers) {
            if (networkedPlayer.isPlayerActive()) {
                count++;
            }
        }
        return count;
    }
    
    // Get networking mode info
    getNetworkInfo() {
        return {
            isMultiplayer: this.isMultiplayerMode,
            localPeerId: this.localPeerId,
            activePlayerCount: this.getActivePlayerCount(),
            totalPlayerCount: this.networkedPlayers.size
        };
    }
    
    // Clear all networked players
    clear() {
        for (const [peerId, networkedPlayer] of this.networkedPlayers) {
            networkedPlayer.destroy();
        }
        this.networkedPlayers.clear();
        console.log('[NetworkedPlayerManager] Cleared all networked ships');
    }
}
