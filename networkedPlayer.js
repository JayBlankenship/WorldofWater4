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
                
                // Initialize interpolation values to current state
                this.initializeInterpolation();
                
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
        
        // Interpolation state for smooth movement
        this.interpolation = {
            // Current interpolated values
            position: new THREE.Vector3(0, 20, 0),
            rotation: new THREE.Euler(0, 0, 0),
            shipModelPosition: new THREE.Vector3(0, 0, 0),
            shipModelRotation: new THREE.Euler(0, 0, 0),
            
            // Target values from network
            targetPosition: new THREE.Vector3(0, 20, 0),
            targetRotation: new THREE.Euler(0, 0, 0),
            targetShipModelPosition: new THREE.Vector3(0, 0, 0),
            targetShipModelRotation: new THREE.Euler(0, 0, 0),
            
            // Interpolation settings
            positionLerpSpeed: 8.0, // How fast to lerp position
            rotationLerpSpeed: 6.0, // How fast to lerp rotation
            shipModelLerpSpeed: 10.0 // Fast lerp for ship model details
        };
        
        // Network status
        this.lastUpdateTime = Date.now();
        this.isActive = true;
        this.hasReceivedFirstUpdate = false; // Track if we've received network data yet
        
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
    
    // Initialize interpolation values to match current state
    initializeInterpolation() {
        if (this.pawn) {
            // Set current interpolation values to match the pawn's current state
            this.interpolation.position.copy(this.pawn.position);
            this.interpolation.targetPosition.copy(this.pawn.position);
            this.interpolation.rotation.copy(this.pawn.rotation);
            this.interpolation.targetRotation.copy(this.pawn.rotation);
            
            // Initialize ship model interpolation if ship model exists
            if (this.pawn.shipModel) {
                this.interpolation.shipModelPosition.copy(this.pawn.shipModel.position);
                this.interpolation.targetShipModelPosition.copy(this.pawn.shipModel.position);
                this.interpolation.shipModelRotation.copy(this.pawn.shipModel.rotation);
                this.interpolation.targetShipModelRotation.copy(this.pawn.shipModel.rotation);
            }
        }
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
        
        // Initialize interpolation values to current state
        this.initializeInterpolation();
        
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
        
        // For the first update, snap immediately to avoid interpolating from spawn position
        if (!this.hasReceivedFirstUpdate) {
            this.hasReceivedFirstUpdate = true;
            
            // Snap to the exact network position for first update
            this.interpolation.position.set(state.position.x, state.position.y, state.position.z);
            this.interpolation.targetPosition.set(state.position.x, state.position.y, state.position.z);
            this.pawn.position.copy(this.interpolation.position);
            
            if (state.rotation) {
                this.interpolation.rotation.set(state.rotation.x, state.rotation.y, state.rotation.z);
                this.interpolation.targetRotation.set(state.rotation.x, state.rotation.y, state.rotation.z);
                this.pawn.rotation.copy(this.interpolation.rotation);
            }
            
            // Snap ship model transforms for first update
            if (state.shipModelRotation && this.pawn.shipModel) {
                this.interpolation.shipModelRotation.set(
                    state.shipModelRotation.x, 
                    state.shipModelRotation.y, 
                    state.shipModelRotation.z
                );
                this.interpolation.targetShipModelRotation.copy(this.interpolation.shipModelRotation);
                this.pawn.shipModel.rotation.copy(this.interpolation.shipModelRotation);
            }
            
            if (state.shipModelPosition && this.pawn.shipModel) {
                this.interpolation.shipModelPosition.set(
                    state.shipModelPosition.x, 
                    state.shipModelPosition.y, 
                    state.shipModelPosition.z
                );
                this.interpolation.targetShipModelPosition.copy(this.interpolation.shipModelPosition);
                this.pawn.shipModel.position.copy(this.interpolation.shipModelPosition);
            }
            
            console.log(`[NetworkedPlayer] First update - snapped ${this.isHost ? 'HOST' : 'CLIENT'} ship ${this.peerId} to position:`, this.pawn.position);
            
        } else {
            // For subsequent updates, set new targets for smooth interpolation
            this.interpolation.targetPosition.set(state.position.x, state.position.y, state.position.z);
            
            if (state.rotation) {
                this.interpolation.targetRotation.set(state.rotation.x, state.rotation.y, state.rotation.z);
            }
            
            // Update ship model targets if available
            if (state.shipModelRotation) {
                this.interpolation.targetShipModelRotation.set(
                    state.shipModelRotation.x, 
                    state.shipModelRotation.y, 
                    state.shipModelRotation.z
                );
            }
            
            if (state.shipModelPosition) {
                this.interpolation.targetShipModelPosition.set(
                    state.shipModelPosition.x, 
                    state.shipModelPosition.y, 
                    state.shipModelPosition.z
                );
            }
        }
        
        // Update surge state if available
        if (typeof state.surgeActive !== 'undefined' && this.pawn.setSurge) {
            this.pawn.setSurge(state.surgeActive);
        }
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
        
        // Smooth interpolation towards target values
        if (this.isActive) {
            // Interpolate main position and rotation
            this.interpolation.position.lerp(this.interpolation.targetPosition, this.interpolation.positionLerpSpeed * deltaTime);
            
            // For rotation, we need to handle the interpolation more carefully to avoid issues with angle wrapping
            this.interpolateEuler(this.interpolation.rotation, this.interpolation.targetRotation, this.interpolation.rotationLerpSpeed * deltaTime);
            
            // Apply interpolated values to the pawn
            this.pawn.position.copy(this.interpolation.position);
            this.pawn.rotation.copy(this.interpolation.rotation);
            
            // Interpolate ship model position and rotation if ship model exists
            if (this.pawn.shipModel) {
                this.interpolation.shipModelPosition.lerp(this.interpolation.targetShipModelPosition, this.interpolation.shipModelLerpSpeed * deltaTime);
                this.interpolateEuler(this.interpolation.shipModelRotation, this.interpolation.targetShipModelRotation, this.interpolation.shipModelLerpSpeed * deltaTime);
                
                this.pawn.shipModel.position.copy(this.interpolation.shipModelPosition);
                this.pawn.shipModel.rotation.copy(this.interpolation.shipModelRotation);
            }
        }
    }
    
    // Helper function to interpolate Euler angles safely
    interpolateEuler(current, target, alpha) {
        // Convert to quaternions for smooth rotation interpolation
        const currentQuat = new THREE.Quaternion().setFromEuler(current);
        const targetQuat = new THREE.Quaternion().setFromEuler(target);
        
        // Spherical linear interpolation (slerp) for smooth rotation
        currentQuat.slerp(targetQuat, alpha);
        
        // Convert back to Euler and update the current rotation
        current.setFromQuaternion(currentQuat, current.order);
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
