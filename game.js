// game.js - Main game file  
// Version: Updated 2025-08-02 09:15 - Fixed ship replication bugs

import * as THREE from 'https://cdn.skypack.dev/three@0.134.0';
import { createPlayerPawn } from './playerPawn.js';
import { createShipPawn } from './shipPawn.js';
import { SpectatorPawn } from './spectatorPawn.js'; // Import SpectatorPawn
// --- GLOBAL OCEAN MESH ---
let globalOcean = null;
let globalOceanGeometry = null;
let globalOceanSegments = 64;
let globalOceanTime = Math.random() * 1000;
let globalOceanWaveState = {
    amp: 0.8, // More intense default amplitude
    speed: 2.0, // Faster default speed
    targetAmp: 0.8,
    targetSpeed: 2.0,
    timer: 0,
    storms: [], // Array of active storm systems
    stormIntensity: 0.5, // Global storm intensity factor
    targetStormIntensity: 0.5, // Target storm intensity for gradual transitions
    maxStorms: 4 // Allow more simultaneous storms
};
let globalOceanSize = 120;

// Make ocean variables globally accessible for ship synchronization
window.globalOceanTime = globalOceanTime;
window.globalOceanWaveState = globalOceanWaveState;

function createGlobalOcean(scene, size = 120, segments = 64) {
    // Create a large transparent ocean surface that sits above the terrain
    size = 2400; // Doubled from 1200
    segments = 128; // Reduced for better performance but still smooth
    const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
    geometry.rotateX(-Math.PI / 2);
    
    // Add vertex colors for enhanced depth effect with multiple gradients
    const colors = [];
    const positions = geometry.attributes.position.array;
    for (let i = 0; i < positions.length; i += 3) {
        const x = positions[i];
        const z = positions[i + 2];
        const distanceFromCenter = Math.sqrt(x * x + z * z);
        const maxDistance = size * 0.4;
        const depthFactor = Math.min(distanceFromCenter / maxDistance, 1.0);
        
        // Enhanced depth gradient with dramatic color transitions and storm effects
        // Base ocean colors - darker blue variations
        const calmShallowR = 0.0, calmShallowG = 0.3, calmShallowB = 0.7; // Dark blue
        const calmDeepR = 0.0, calmDeepG = 0.05, calmDeepB = 0.3; // Very dark navy
        
        // Storm colors - greens, grays, and darker blues emerge during storms
        const stormShallowR = 0.1, stormShallowG = 0.4, stormShallowB = 0.5; // Stormy blue-green
        const stormDeepR = 0.05, stormDeepG = 0.15, stormDeepB = 0.2; // Dark gray-blue
        
        // Foam and turbulence colors - whites and light blues
        const foamR = 0.8, foamG = 0.9, foamB = 1.0; // White foam
        const turbulenceR = 0.4, turbulenceG = 0.6, turbulenceB = 0.8; // Light stormy blue
        
        // Calculate storm intensity at this location
        let stormIntensity = 0;
        const globalStormFactor = Math.sin(x * 0.002 + z * 0.003) * Math.cos(x * 0.001 - z * 0.004);
        stormIntensity = Math.max(0, globalStormFactor * 0.5 + 0.3); // Always some storm potential
        
        // Distance-based storm variation - storms can be more intense in different areas
        const distanceStorm = Math.sin(distanceFromCenter * 0.001) * 0.3;
        stormIntensity += distanceStorm;
        stormIntensity = Math.max(0, Math.min(1, stormIntensity));
        
        // Multiple wave-based color layers for texture with storm enhancement
        const wavePattern1 = Math.sin(x * 0.008) * Math.cos(z * 0.012) * (0.04 + stormIntensity * 0.06); // Large waves - storm enhanced
        const wavePattern2 = Math.sin(x * 0.025 + z * 0.018) * (0.025 + stormIntensity * 0.04); // Medium waves
        const wavePattern3 = Math.sin(x * 0.045) * Math.cos(z * 0.038) * (0.015 + stormIntensity * 0.03); // Small ripples
        const wavePattern4 = Math.cos(x * 0.06 + z * 0.052) * (0.01 + stormIntensity * 0.02); // Fine detail
        
        // Foam/whitecap simulation - much stronger during storms
        const foamPattern = Math.sin(x * 0.1) * Math.cos(z * 0.08) * (1 - depthFactor) * (0.02 + stormIntensity * 0.08);
        
        // Turbulence patterns that emerge during storms
        const turbulencePattern1 = Math.sin(x * 0.15) * Math.cos(z * 0.12) * stormIntensity * 0.05;
        const turbulencePattern2 = Math.cos(x * 0.2 + z * 0.18) * stormIntensity * 0.03;
        
        // Combine all wave patterns
        const totalWaveEffect = (wavePattern1 + wavePattern2 + wavePattern3 + wavePattern4) * (1 - depthFactor * 0.4);
        const totalFoamEffect = foamPattern + turbulencePattern1 + turbulencePattern2;
        
        // Additional color variation for natural look with storm chaos
        const colorVariation1 = Math.sin(x * 0.03 + z * 0.04) * (0.015 + stormIntensity * 0.025);
        const colorVariation2 = Math.cos(x * 0.07 - z * 0.02) * (0.01 + stormIntensity * 0.02);
        const stormChaos = Math.sin(x * 0.08 + z * 0.09) * Math.cos(x * 0.11 - z * 0.07) * stormIntensity * 0.04;
        
        // Interpolate between calm and storm colors based on storm intensity
        const baseShallowR = calmShallowR + (stormShallowR - calmShallowR) * stormIntensity;
        const baseShallowG = calmShallowG + (stormShallowG - calmShallowG) * stormIntensity;
        const baseShallowB = calmShallowB + (stormShallowB - calmShallowB) * stormIntensity;
        
        const baseDeepR = calmDeepR + (stormDeepR - calmDeepR) * stormIntensity;
        const baseDeepG = calmDeepG + (stormDeepG - calmDeepG) * stormIntensity;
        const baseDeepB = calmDeepB + (stormDeepB - calmDeepB) * stormIntensity;
        
        // Apply depth gradient with storm colors
        let r = baseShallowR + (baseDeepR - baseShallowR) * depthFactor;
        let g = baseShallowG + (baseDeepG - baseShallowG) * depthFactor;
        let b = baseShallowB + (baseDeepB - baseShallowB) * depthFactor;
        
        // Add wave effects
        r += totalWaveEffect * 0.3 + colorVariation1 + stormChaos;
        g += totalWaveEffect * 0.4 + colorVariation2 + stormChaos * 0.5;
        b += totalWaveEffect * 0.2 + stormChaos * 0.3;
        
        // Add foam/turbulence effects (lighter colors)
        const foamStrength = Math.max(0, totalFoamEffect);
        r += foamStrength * foamR * 0.3;
        g += foamStrength * foamG * 0.3;
        b += foamStrength * foamB * 0.3;
        
        // Add turbulence coloring (stormy blues and greens)
        r += stormIntensity * turbulenceR * 0.1;
        g += stormIntensity * turbulenceG * 0.15;
        b += stormIntensity * turbulenceB * 0.1;
        
        colors.push(Math.max(0, Math.min(1, r)), Math.max(0, Math.min(1, g)), Math.max(0, Math.min(1, b)));
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    
    const material = new THREE.MeshLambertMaterial({
        vertexColors: true, // Use vertex colors for enhanced depth effect
        wireframe: false, // Solid surface, not wireframe
        transparent: true, // Add slight transparency for depth perception
        opacity: 0.75, // Subtle transparency to match terrain planes
        side: THREE.DoubleSide, // Render both sides to prevent culling
        // Enhanced cartoon water surface with sparkles
        emissive: 0x002255, // Stronger magical blue glow
        emissiveIntensity: 0.2 // Higher intensity for cartoon sparkle effect
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(0, 20.0, 0); // Position ocean surface properly relative to player height
    mesh.name = "globalOceanSurface"; // Add name for debugging
    scene.add(mesh);
    // Removed ocean creation logging for performance
    globalOcean = mesh;
    globalOceanGeometry = geometry;
    globalOceanSegments = segments;
    globalOceanSize = size;
}
import { createAIPlayer } from './ai.js';
import { TerrainPlane } from './terrainPlane.js';
import { TerrainGenerator } from './terrainGenerator.js'; // Import the new class
import { NetworkedPlayerManager } from './networkedPlayer.js'; // Import networked player system

const canvas = document.getElementById('gameCanvas');
const startButton = document.getElementById('startButton');
const menu = document.getElementById('menu');
const pauseMenu = document.getElementById('pauseMenu');
const closeMenuButton = document.getElementById('closeMenu');
const instructions = document.getElementById('instructions');
const thetaSensitivityInput = document.getElementById('thetaSensitivity');
const phiSensitivityInput = document.getElementById('phiSensitivity');

// Global state
let isInstructionsVisible = true;
let isGamePaused = false;
let isSettingsOpen = false;
let isSpectatorMode = false; // Add spectator mode state

// Global functions for menu controls
window.resumeGame = function() {
    isGamePaused = false;
    pauseMenu.style.display = 'none';
    if (!document.pointerLockElement) {
        canvas.requestPointerLock();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    startButton.addEventListener('click', () => {
        startButton.style.display = 'none';
        canvas.style.display = 'block';
        initGame();
    });
});

// Load saved settings on page load
function loadSettings() {
    const savedTheta = localStorage.getItem('thetaSensitivity');
    const savedPhi = localStorage.getItem('phiSensitivity');
    if (savedTheta) thetaSensitivityInput.value = savedTheta;
    if (savedPhi) phiSensitivityInput.value = savedPhi;
}

let spectatorPawn = null; // Declare spectatorPawn variable
        
function initGame() {
    const scene = new THREE.Scene();
    
    // Set a simple sky color background
    scene.background = new THREE.Color(0x87ceeb); // Sky blue background
    
    // === SIMPLE LOW-COST LIGHTING SETUP ===
    
    // Ambient light - provides soft overall illumination
    const ambientLight = new THREE.AmbientLight(0x404080, 0.4); // Soft blue ambient light
    scene.add(ambientLight);
    
    // Directional light - simulates sunlight
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(100, 200, 50); // High in the sky
    directionalLight.castShadow = false; // Keep shadows off for performance
    scene.add(directionalLight);
    
    // Optional: Add a subtle second light for fill lighting
    const fillLight = new THREE.DirectionalLight(0x87ceeb, 0.3); // Sky blue fill light
    fillLight.position.set(-50, 100, -100); // From opposite direction
    fillLight.castShadow = false;
    scene.add(fillLight);
    
    // Add global animated ocean mesh (wireframe, ripple effect)
    createGlobalOcean(scene, 120, 64);
    // Increase far plane to 5000 and near plane to 1.0 for large world and high ocean
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1.0, 5000);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);

    // Create ship pawn and star
    const playerPawn = createShipPawn(false, null, false); // false indicates human player, no star
    scene.add(playerPawn);

    // Initialize networked player manager for multiplayer replication
    const networkedPlayerManager = new NetworkedPlayerManager(scene);
    
    // === NETWORKING SETUP - Refactored for clean architecture ===
    
    // Create a unified networking handler class to manage all network operations
    class GameNetworkingHandler {
        constructor(playerManager, networkInstance) {
            this.playerManager = playerManager;
            this.network = networkInstance;
            this.isMultiplayerMode = this.playerManager.shouldCreateNetworkedPlayers();
            
            // Initialize networking if available
            if (this.isMultiplayerMode && this.network) {
                this.setupNetworkCallbacks();
            }
        }
        
        // Set up all network-related callbacks in one place
        setupNetworkCallbacks() {
            // Handle incoming player state updates from other clients
            this.network.callbacks.handlePlayerState = (peerId, state) => {
                this.playerManager.updatePlayer(peerId, state);
            };
            
            // Track when players join/leave the lobby to create/remove networked players
            const originalUpdateUI = this.network.callbacks.updateUI;
            this.network.callbacks.updateUI = (peers) => {
                // Call original updateUI if it exists
                if (originalUpdateUI) {
                    originalUpdateUI(peers);
                }
                
                // Trigger networked player creation/cleanup
                this.updateNetworkedPlayers();
            };
            
            // Initialize networked players after a delay to ensure network is ready
            setTimeout(() => {
                this.updateNetworkedPlayers();
            }, 1000);
        }
        
        // Handle networked player creation and cleanup - now properly scoped
        updateNetworkedPlayers() {
            if (!this.isMultiplayerMode) {
                return; // Do nothing in single player mode
            }
            
            // Only create networked players if we're in a complete multiplayer lobby
            if (this.network.isInCompleteLobby && this.network.isInCompleteLobby()) {
                const currentPeerIds = this.network.getLobbyPeerIds();
                const existingPeerIds = Array.from(this.playerManager.networkedPlayers.keys());
                
                // Add networked players for all other peers in the lobby
                for (const peerId of currentPeerIds) {
                    if (peerId !== this.network.myPeerId && !this.playerManager.networkedPlayers.has(peerId)) {
                        const isHostPlayer = this.network.isBase && peerId !== this.network.myPeerId;
                        this.playerManager.addPlayer(peerId, isHostPlayer);
                    }
                }
                
                // Remove networked players that are no longer in the lobby
                for (const peerId of existingPeerIds) {
                    if (!currentPeerIds.includes(peerId)) {
                        this.playerManager.removePlayer(peerId);
                    }
                }
            }
        }
        
        // Check if we should broadcast player state
        shouldBroadcastState() {
            if (!this.isMultiplayerMode || !this.network || !this.network.isInitialized) {
                return false;
            }
            
            const hasAnyPeers = this.network.getLobbyPeerIds && this.network.getLobbyPeerIds().length > 0;
            const hasHostConnections = this.network.isBase && 
                this.network.lobbyPeerConnections && 
                Object.keys(this.network.lobbyPeerConnections).length > 0;
            const hasClientConnection = !this.network.isBase && 
                this.network.hostConn && 
                this.network.hostConn.open;
                
            return hasAnyPeers || hasHostConnections || hasClientConnection;
        }
        
        // Broadcast player state with proper error handling
        broadcastPlayerState(playerState) {
            if (!this.shouldBroadcastState()) {
                return false;
            }
            
            try {
                this.network.broadcastPlayerState(playerState);
                return true;
            } catch (error) {
                console.warn('[GameNetworking] Failed to broadcast player state:', error);
                return false;
            }
        }
        
        // Get network info for debugging
        getNetworkInfo() {
            if (!this.isMultiplayerMode) {
                return { mode: 'single-player' };
            }
            
            return {
                mode: 'multiplayer',
                isHost: this.network.isBase,
                peerId: this.network.myPeerId,
                connectedPeers: this.network.getLobbyPeerIds ? this.network.getLobbyPeerIds().length : 0,
                isInitialized: this.network.isInitialized
            };
        }
    }
    
    // Initialize the networking handler
    const gameNetworking = new GameNetworkingHandler(networkedPlayerManager, window.Network);

    // Removed AI players to reduce network and performance overhead
    const aiPlayers = []; // Empty array to prevent errors

    // Terrain system - restored with local generation (no networking)
    const planeSize = 256; // Size of each terrain section
    const planeGeometry = new THREE.PlaneGeometry(planeSize, planeSize, 16, 16);
    const planeMaterial = new THREE.MeshLambertMaterial({ color: 0x228B22, side: THREE.DoubleSide, transparent: true, opacity: 0.7 });
    const terrainGenerator = new TerrainGenerator(scene, planeSize, planeGeometry, planeMaterial);

    // Terrain networking is disabled to prevent performance issues
    // Terrain will only generate locally for each client

    // Initial camera position - pulled back further for better ocean view
    camera.position.set(0, 8, -18);
    camera.lookAt(playerPawn.position);

    // Calculate initial theta and phi
    const initialOffset = new THREE.Vector3().subVectors(camera.position, playerPawn.position);
    const r = initialOffset.length();
    let theta = Math.atan2(initialOffset.x, initialOffset.z);
    let phi = Math.atan2(initialOffset.y, Math.sqrt(initialOffset.x ** 2 + initialOffset.z ** 2));

    // Mouse controls with Pointer Lock
    let isPointerLocked = false;
    let mouseX = 0;
    let mouseY = 0;
    let thetaSensitivity = parseFloat(thetaSensitivityInput.value);
    let phiSensitivity = parseFloat(phiSensitivityInput.value);

    canvas.requestPointerLock = canvas.requestPointerLock || canvas.mozRequestPointerLock;

    canvas.addEventListener('click', () => {
        if (!isPointerLocked && !menu.style.display) {
            canvas.requestPointerLock();
        }
    });

    document.addEventListener('pointerlockchange', () => {
        isPointerLocked = document.pointerLockElement === canvas;
    });

    document.addEventListener('mousemove', (e) => {
        if (isPointerLocked) {
            const movementX = e.movementX || e.mozMovementX || 0;
            const movementY = e.movementY || e.mozMovementY || 0;
            
            if (isSpectatorMode) {
                // Pass mouse movement to spectator pawn
                spectatorPawn.handleMouseMovement(movementX, movementY);
            } else {
                // Regular camera mouse input
                mouseX = movementX;
                mouseY = movementY;
            }
        }
    });

    // Update and save sensitivity from sliders
    thetaSensitivityInput.addEventListener('input', (e) => {
        thetaSensitivity = parseFloat(e.target.value);
        localStorage.setItem('thetaSensitivity', thetaSensitivity);
    });
    phiSensitivityInput.addEventListener('input', (e) => {
        phiSensitivity = parseFloat(e.target.value);
        localStorage.setItem('phiSensitivity', phiSensitivity);
    });

    // Load settings when the page loads
    loadSettings();

    // Movement controls
    const moveState = { forward: false, backward: false, left: false, right: false };
    const playerSpeed = 5.0;
    let lastTime = performance.now();
    let isMenuOpen = false;
    let animationTime = 0;

    document.addEventListener('keydown', (e) => {
        const key = e.key.toLowerCase();
        
        // Global hotkeys
        if (key === 'escape') {
            isGamePaused = !isGamePaused;
            pauseMenu.style.display = isGamePaused ? 'block' : 'none';
            if (isGamePaused && isPointerLocked) {
                document.exitPointerLock();
            } else if (!isGamePaused && !isPointerLocked) {
                canvas.requestPointerLock();
            }
        }
        
        if (key === 'f1') {
            isInstructionsVisible = !isInstructionsVisible;
            instructions.classList.toggle('hidden', !isInstructionsVisible);
        }
        
        if (key === 'f2') {
            isSettingsOpen = !isSettingsOpen;
            menu.style.display = isSettingsOpen ? 'block' : 'none';
        }
        
        // Movement controls only when not paused, not in settings, and not in spectator mode
        if (!isGamePaused && !isSettingsOpen && !isSpectatorMode) {
            if (key === 'w') {
                // W key increases sail mode
                toggleSailMode('w');
            }
            if (key === 's') {
                // S key can decrease sail mode OR provide manual reverse
                if (currentSailMode === 'noSail') {
                    moveState.backward = true; // Manual reverse when no sail
                } else {
                    toggleSailMode('s'); // Decrease sail mode
                }
            }
            if (key === 'a') {
                moveState.left = true;
            }
            if (key === 'd') {
                moveState.right = true;
            }
        }
    });

    document.addEventListener('keyup', (e) => {
        const key = e.key.toLowerCase();
        // Only process movement key releases if not in spectator mode
        if (!isSpectatorMode) {
            if (key === 's') {
                moveState.backward = false; // Stop manual reverse
            }
            if (key === 'a') {
                moveState.left = false;
            }
            if (key === 'd') {
                moveState.right = false;
            }
        }
    });

    closeMenuButton.addEventListener('click', () => {
        isSettingsOpen = false;
        menu.style.display = 'none';
        if (!isPointerLocked) {
            canvas.requestPointerLock();
        }
    });

    // Initialize SpectatorPawn
    spectatorPawn = new SpectatorPawn(scene, camera);

    // Add keybinding for F8 with capture phase
    window.addEventListener('keydown', (event) => {
        if (event.code === 'F8') {
            event.preventDefault();
            event.stopPropagation();
            toggleSpectatorMode();
        }
    }, true); // Use capture phase

    function toggleSpectatorMode() {
        const spectatorIndicator = document.getElementById('spectatorIndicator');
        
        if (isSpectatorMode) {
            // Deactivate spectator mode
            spectatorPawn.deactivate();
            isSpectatorMode = false;
            spectatorIndicator.style.display = 'none';
            // Removed spectator mode logging for performance
        } else {
            // Activate spectator mode
            // Clear all movement states to stop the ship
            moveState.forward = false;
            moveState.backward = false;
            moveState.left = false;
            moveState.right = false;
            
            spectatorPawn.activate();
            isSpectatorMode = true;
            spectatorIndicator.style.display = 'block';
            // Removed spectator mode logging for performance
        }
    }

    // Add sailing speeds logic
    const sailModes = {
        noSail: 0,
        partSail: 2,
        halfSail: 4,
        fullSail: 6
    };
    let currentSailMode = 'noSail';

    // Add UI element to display current sail mode
    const sailModeDisplay = document.createElement('div');
    sailModeDisplay.id = 'sailModeDisplay';
    sailModeDisplay.style.position = 'absolute';
    sailModeDisplay.style.bottom = '10px';
    sailModeDisplay.style.left = '10px';
    sailModeDisplay.style.padding = '10px';
    sailModeDisplay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    sailModeDisplay.style.color = 'white';
    sailModeDisplay.style.fontSize = '16px';
    sailModeDisplay.style.borderRadius = '5px';
    sailModeDisplay.style.zIndex = '1000';
    sailModeDisplay.textContent = `Sail Mode: ${currentSailMode}`;
    document.body.appendChild(sailModeDisplay);

    // Update toggleSailMode to handle 'w' for increase and 's' for decrease
    // Ship now moves independently based on sail mode, not tied to key states
    function toggleSailMode(key) {
        const sailModeKeys = Object.keys(sailModes);
        const currentIndex = sailModeKeys.indexOf(currentSailMode);

        if (key === 'w') {
            currentSailMode = sailModeKeys[(currentIndex + 1) % sailModeKeys.length];
        } else if (key === 's') {
            currentSailMode = sailModeKeys[(currentIndex - 1 + sailModeKeys.length) % sailModeKeys.length];
        }

        const sailSpeed = sailModes[currentSailMode];
        // Removed sail mode logging for performance
        sailModeDisplay.textContent = `Sail Mode: ${currentSailMode} (Speed: ${sailSpeed})`;
    }

    // Animation loop
    function animate(currentTime) {
        requestAnimationFrame(animate);
        
        const deltaTime = Math.min((currentTime - lastTime) / 1000, 0.1);
        lastTime = currentTime;
        animationTime += deltaTime;

        // Always update the ship for visual effects (bouncing, bobbing)
        // Ship should continue moving based on sail mode even in spectator mode (sails keep working!)
        if (!isGamePaused && !isSettingsOpen) {
            // Movement logic is now handled in playerPawn.update()
            const sailSpeed = sailModes[currentSailMode];
            
            
            if (!isSpectatorMode) {
                // Normal mode: pass sail speed, move state, and camera for full control
                playerPawn.update(deltaTime, animationTime, sailSpeed, moveState, camera);
            } else {
                // Spectator mode: ship continues sailing based on sail mode, but no manual controls
                // Create empty move state so ship only moves based on sail speed, not key presses
                const autoMoveState = { left: false, right: false, backward: false };
                playerPawn.update(deltaTime, animationTime, sailSpeed, autoMoveState, camera);
            }
        } else {
            // Update ship visual effects only when paused or settings open
            playerPawn.update(deltaTime, animationTime);
        }

        // --- Animate global ocean mesh (ripple effect) - OPTIMIZED FOR PERFORMANCE ---
        if (globalOcean && globalOceanGeometry && playerPawn) {
            // PERFORMANCE: Reduce ocean update frequency to every 3rd frame
            if (!window.oceanUpdateCounter) window.oceanUpdateCounter = 0;
            window.oceanUpdateCounter++;
            
            if (window.oceanUpdateCounter % 3 === 0) { // Only update every 3rd frame
                // --- Simplified Storm system for performance ---
                // Update storms less frequently
                if (!globalOceanWaveState.storms) globalOceanWaveState.storms = [];
                
                // Reduced storm spawning frequency and complexity
                if (Math.random() < deltaTime * 0.02 && globalOceanWaveState.storms.length < 2) { // Max 2 storms, less frequent
                    const angle = Math.random() * Math.PI * 2;
                    const dist = 1000 + Math.random() * 1000; // Further away storms
                    globalOceanWaveState.storms.push({
                        x: playerPawn.position.x + Math.cos(angle) * dist,
                        z: playerPawn.position.z + Math.sin(angle) * dist,
                        amp: 2 + Math.random() * 2, // Reduced intensity
                        radius: 800, // Fixed radius for performance
                        age: 0
                    });
                }
                
                // Simplified storm aging
                globalOceanWaveState.storms = globalOceanWaveState.storms.filter(s => {
                    s.age += deltaTime;
                    return s.age < 60; // Shorter storm life
                });

                // Simplified ocean state changes
                globalOceanWaveState.timer -= deltaTime;
                if (globalOceanWaveState.timer <= 0) {
                    if (Math.random() < 0.5) {
                        globalOceanWaveState.targetAmp = 1.5 + Math.random() * 1.0;
                        globalOceanWaveState.targetSpeed = 2.5 + Math.random() * 1.0;
                    } else {
                        globalOceanWaveState.targetAmp = 0.5 + Math.random() * 0.5;
                        globalOceanWaveState.targetSpeed = 1.0 + Math.random() * 0.5;
                    }
                    globalOceanWaveState.timer = 8 + Math.random() * 8; // Longer cycles
                }
                
                // Faster interpolation for fewer updates
                globalOceanWaveState.amp += (globalOceanWaveState.targetAmp - globalOceanWaveState.amp) * deltaTime * 0.1;
                globalOceanWaveState.speed += (globalOceanWaveState.targetSpeed - globalOceanWaveState.speed) * deltaTime * 0.1;
                
                // Center ocean on player
                globalOcean.position.x = playerPawn.position.x;
                globalOcean.position.z = playerPawn.position.z;
                globalOcean.position.y = 20.0;
                globalOceanTime += deltaTime * globalOceanWaveState.speed;
                
                // Update window variables for ship synchronization
                window.globalOceanTime = globalOceanTime;
                window.globalOceanWaveState = globalOceanWaveState;
                
                // PERFORMANCE: Simplified ocean mesh update - reduced complexity
                const pos = globalOceanGeometry.attributes.position;
                const seg = globalOceanSegments;
                const t = globalOceanTime;
                const px = playerPawn.position.x;
                const pz = playerPawn.position.z;
                const size = globalOceanSize;
                
                // Simplified wave calculation - removed complex storm effects for performance
                for (let xi = 0; xi <= seg; xi += 2) { // Skip every other vertex for performance
                    for (let zi = 0; zi <= seg; zi += 2) { // Skip every other vertex for performance
                        const idx = xi * (seg + 1) + zi;
                        const x = (xi - seg / 2) * (size / seg) + px;
                        const z = (zi - seg / 2) * (size / seg) + pz;
                        
                        // Simplified wave calculation - much faster
                        let y = 0;
                        y += Math.sin(0.08 * x + t * 0.6) * 1.0 * globalOceanWaveState.amp;
                        y += Math.cos(0.07 * z + t * 0.4) * 0.8 * globalOceanWaveState.amp;
                        y += Math.sin(0.06 * (x + z) + t * 0.2) * 0.5 * globalOceanWaveState.amp;
                        
                        pos.setY(idx, y);
                    }
                }
                
                pos.needsUpdate = true;
                // Skip normal calculation for performance - not needed for basic water
                // globalOceanGeometry.computeVertexNormals();
            }
        }
        // === NETWORKING - Clean player state broadcasting ===
        
        // Create player state object with comprehensive rotation data
        const playerState = {
            position: {
                x: playerPawn.position.x,
                y: playerPawn.position.y,
                z: playerPawn.position.z
            },
            rotation: {
                x: playerPawn.rotation.x,
                y: playerPawn.rotation.y,
                z: playerPawn.rotation.z
            },
            // Ship model rotation (pitch, roll, and leaning from wave effects)
            shipModelRotation: playerPawn.shipModel ? {
                x: playerPawn.shipModel.rotation.x,
                y: playerPawn.shipModel.rotation.y,
                z: playerPawn.shipModel.rotation.z
            } : null,
            // Ship model position (for bobbing effects)
            shipModelPosition: playerPawn.shipModel ? {
                x: playerPawn.shipModel.position.x,
                y: playerPawn.shipModel.position.y,
                z: playerPawn.shipModel.position.z
            } : null,
            surgeActive: playerPawn.surgeActive || false
        };
        
        // Throttle network updates to avoid spam (send every ~100ms for stable performance)
        const now = Date.now();
        if (!window.lastNetworkUpdate || now - window.lastNetworkUpdate > 100) {
            if (gameNetworking.broadcastPlayerState(playerState)) {
                window.lastNetworkUpdate = now;
            }
        }

        // Update networked players (animate them smoothly)
        networkedPlayerManager.update(deltaTime, animationTime);

        // Update global player position for exclusion zone logic
        window.playerPosition = playerPawn.position.clone();

        // Update terrain system locally (no networking to prevent lag)
        if (terrainGenerator && typeof terrainGenerator.updateStormSystem === 'function') {
            terrainGenerator.updateStormSystem(deltaTime, playerPawn.position);
        }

        // Dynamically update terrain tiles with storm effects every frame
        if (terrainGenerator && terrainGenerator.planes && typeof window.updateExclusionZoneEveryFrame === 'function') {
            window.updateExclusionZoneEveryFrame(Array.from(terrainGenerator.planes.values()), terrainGenerator);
        }

        // Generate new planes for local player only (no networking)
        if (terrainGenerator && typeof terrainGenerator.generateNeighboringPlanes === 'function') {
            // Generate terrain around local player
            terrainGenerator.generateNeighboringPlanes(playerPawn.position);
            
            // Remove distant planes based on local player position
            if (typeof terrainGenerator.removeDistantPlanes === 'function') {
                terrainGenerator.removeDistantPlanes(playerPawn.position, aiPlayers);
            }
        }

        // Update camera based on mouse movement (only if not in spectator mode)
        if (isPointerLocked && (mouseX !== 0 || mouseY !== 0) && !isSpectatorMode) {
            theta -= mouseX * thetaSensitivity;
            phi -= mouseY * phiSensitivity;
            phi = Math.max(0.1, Math.min(1.2, phi));
            theta = ((theta % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
            mouseX = 0;
            mouseY = 0;
        }

        // Update camera position (only if not in spectator mode)
        if (!isSpectatorMode) {
            const horizontalDistance = r * Math.cos(phi);
            camera.position.x = playerPawn.position.x + horizontalDistance * Math.sin(theta);
            camera.position.z = playerPawn.position.z + horizontalDistance * Math.cos(theta);
            camera.position.y = playerPawn.position.y + r * Math.sin(phi);
            camera.lookAt(playerPawn.position);
        }

        // Update spectator pawn if in spectator mode (outside pause check)
        if (isSpectatorMode) {
            // Removed logging for performance
            spectatorPawn.update(deltaTime);
        }

        renderer.render(scene, camera);
    }
    animate(performance.now());

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}