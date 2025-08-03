// --- APPLICATION CONTROLLER ---
// This file now acts as the main application controller,
// coordinating between the Network module, PauseUI module, and Game

import { SpectatorPawn } from './spectatorPawn.js';

// Legacy global variables for compatibility (reference Network object)
let myPeerId = null;
let peer = null;
let isBase = false;
let paired = false;
let partnerPeerId = null;
let partnerConn = null;
let isInitialized = false;

// Spectator mode variables
let spectatorPawn = null;
let isSpectatorMode = false;

// Initialize all modules when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
});

// Initialize all modules
function initializeApp() {
  // Initialize UI
  PauseUI.init();
  
  // Set up Network callbacks to use PauseUI functions
  Network.setCallbacks({
    updateConnectionStatus: PauseUI.updateConnectionStatus.bind(PauseUI),
    logChainEvent: PauseUI.logChainEvent.bind(PauseUI),
    updateUI: PauseUI.updateUI.bind(PauseUI),
    handleMessage: PauseUI.handleMessage.bind(PauseUI)
  });
  
  // Start networking
  Network.init();
  Network.startAutoReconnect();
  
  // Initialize SpectatorPawn
  spectatorPawn = new SpectatorPawn(scene, camera);

  // Add keybinding for F8
  window.addEventListener('keydown', (event) => {
      if (event.code === 'F8') {
          toggleSpectatorMode();
      }
  });
  
  // Update legacy variables for compatibility
  updateLegacyVariables();
}

// Update legacy global variables for any remaining compatibility needs
function updateLegacyVariables() {
  myPeerId = Network.myPeerId;
  peer = Network.peer;
  isBase = Network.isBase;
  paired = Network.paired;
  partnerPeerId = Network.partnerPeerId;
  partnerConn = Network.partnerConn;
  isInitialized = Network.isInitialized;
}

// Wrapper functions for global access
function sendMessage() {
  PauseUI.sendMessage();
  updateLegacyVariables();
}

function joinChain() {
  PauseUI.joinChain();
  updateLegacyVariables();
}

// Legacy functions kept for compatibility
function broadcastChain() {
  PauseUI.broadcastChain();
}

function updateChainLinks() {
  PauseUI.updateChainLinks();
}

// Expose functions globally for HTML onclick handlers
window.sendMessage = sendMessage;
window.joinChain = joinChain;
window.broadcastChain = broadcastChain;

// Toggle spectator mode
function toggleSpectatorMode() {
  if (isSpectatorMode) {
      // Deactivate spectator mode
      spectatorPawn.deactivate();
      isSpectatorMode = false;
      console.log('Spectator mode deactivated');
  } else {
      // Activate spectator mode
      spectatorPawn.activate();
      isSpectatorMode = true;
      console.log('Spectator mode activated');
  }
}

// Update loop
function update(deltaTime) {
  if (isSpectatorMode) {
      spectatorPawn.update(deltaTime);
  } else {
      // ...existing update logic...
  }
}

// Start the application
initializeApp();