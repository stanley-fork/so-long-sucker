// Main entry point for So Long Sucker

import { Game } from './game.js';
import { UI } from './ui.js';
import { COLORS } from './player.js';
import { AgentManager } from './ai/manager.js';
import { AzureClaudeProvider } from './ai/providers/azure-claude.js';
import { GroqProvider } from './ai/providers/groq.js';
import { CONFIG } from './config.js';
import { applyTestState } from './testStates.js';
import { SimulationManager } from './simulation.js';
import { saveGameSession } from './api/supabase.js';

class SoLongSucker {
  constructor() {
    this.game = null;
    this.ui = null;
    this.agentManager = null;
    this.simulationManager = null;

    // Play mode tracking for Supabase
    this.gameStartTime = null;
    this.turnCount = 0;

    // Screen elements
    this.setupScreen = document.getElementById('setup-screen');
    this.gameContainer = document.getElementById('game-container');
    this.simulationContainer = document.getElementById('simulation-container');

    // Mode/setup elements
    this.landingHero = document.getElementById('landing-hero');
    this.modeSelection = document.getElementById('mode-selection');
    this.playSetup = document.getElementById('play-setup');
    this.simulationSetup = document.getElementById('simulation-setup');

    // Initialize visibility based on whether hero exists
    if (this.landingHero) {
      // We're on index.html - hide everything initially, show hero
      this.landingHero.style.display = 'flex';
      this.setupScreen.style.display = 'none';
    } else {
      // We're on game.html - show mode selection immediately
      this.setupScreen.style.display = 'block';
      this.setupScreen.style.opacity = '1';
      this.setupScreen.style.pointerEvents = 'auto';
      const setupContent = this.setupScreen.querySelector('.setup-content');
      if (setupContent) {
        setupContent.style.opacity = '1';
        setupContent.style.pointerEvents = 'auto';
      }
      this.modeSelection.style.display = 'grid';
      this.playSetup.style.display = 'none';
      this.simulationSetup.style.display = 'none';
    }

    this.bindSetupEvents();
    this.bindModeEvents();
    this.bindSimulationEvents();
    this.loadSavedConfig();
  }

  /**
   * Bind setup screen events
   */
  bindSetupEvents() {
    // Hero CTA button
    document.getElementById('start-experiment-btn')?.addEventListener('click', () => {
      this.setupScreen.classList.add('setup-mode-visible');
      this.modeSelection.scrollIntoView({ behavior: 'smooth' });
    });

    document.getElementById('start-game-btn').addEventListener('click', () => {
      this.startGame(false); // New game
    });

    // Continue game button (if exists)
    const continueBtn = document.getElementById('continue-game-btn');
    if (continueBtn) {
      continueBtn.addEventListener('click', () => {
        this.startGame(true); // Continue saved game
      });
    }

    // Show/hide AI config based on player selections
    const playerSelects = document.querySelectorAll('.player-type-select');
    playerSelects.forEach(select => {
      select.addEventListener('change', () => this.updateAIConfigVisibility());
    });

    // Show/hide Azure resource based on provider
    document.getElementById('ai-provider').addEventListener('change', () => {
      this.updateProviderFields();
    });
    this.updateProviderFields();

    // Test API button
    document.getElementById('test-api-btn').addEventListener('click', () => {
      this.testAPI();
    });

    // Show/hide continue button based on saved game
    this.updateContinueButton();
  }

  /**
   * Update visibility of Continue Game button
   */
  updateContinueButton() {
    const continueBtn = document.getElementById('continue-game-btn');
    if (continueBtn) {
      continueBtn.style.display = this.hasSavedGame() ? 'block' : 'none';
    }
  }

  /**
   * Bind mode selection events
   */
  bindModeEvents() {
    // Play Game mode card
    document.getElementById('mode-play').addEventListener('click', () => {
      this.showPlaySetup();
    });

    // Simulation Mode card
    document.getElementById('mode-simulate').addEventListener('click', () => {
      this.showSimulationSetup();
    });

    // Back buttons
    document.getElementById('back-to-modes').addEventListener('click', () => {
      this.showModeSelection();
    });

    document.getElementById('back-to-modes-sim').addEventListener('click', () => {
      this.showModeSelection();
    });

    // Option buttons (for parallel count and chips)
    document.querySelectorAll('.option-buttons').forEach(container => {
      container.querySelectorAll('.option-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          container.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
        });
      });
    });

    // Start simulation button
    document.getElementById('start-simulation-btn').addEventListener('click', () => {
      this.startSimulation();
    });

    // Show/hide Azure resource for simulation config
    document.getElementById('sim-ai-provider').addEventListener('change', () => {
      const provider = document.getElementById('sim-ai-provider').value;
      const azureRow = document.getElementById('sim-azure-resource-row');
      azureRow.style.display = provider === 'azure-claude' ? 'flex' : 'none';
    });
  }

  /**
   * Bind simulation screen events
   */
  bindSimulationEvents() {
    document.getElementById('sim-stop-btn').addEventListener('click', () => {
      if (this.simulationManager) {
        this.simulationManager.stop();
      }
    });

    document.getElementById('sim-restart-btn').addEventListener('click', () => {
      if (this.simulationManager) {
        this.simulationManager.restart();
      }
    });

    document.getElementById('sim-export-btn').addEventListener('click', () => {
      if (this.simulationManager) {
        this.simulationManager.exportLogs();
      }
    });

    document.getElementById('sim-back-btn').addEventListener('click', () => {
      if (this.simulationManager) {
        this.simulationManager.stop();
      }
      this.showSetupScreen();
    });
  }

  /**
   * Show mode selection
   */
  showModeSelection() {
    if (this.landingHero) {
      this.landingHero.style.display = 'none';
    }
    this.setupScreen.style.display = 'block';
    this.setupScreen.style.opacity = '1';
    this.setupScreen.style.pointerEvents = 'auto';
    this.setupScreen.classList.remove('hidden');
    const setupContent = this.setupScreen.querySelector('.setup-content');
    if (setupContent) {
      setupContent.style.opacity = '1';
      setupContent.style.pointerEvents = 'auto';
    }
    this.modeSelection.classList.remove('hidden');
    this.modeSelection.style.display = 'grid';
    this.playSetup.classList.add('hidden');
    this.simulationSetup.classList.add('hidden');
  }

  /**
   * Show play game setup
   */
  showPlaySetup() {
    if (this.landingHero) {
      this.landingHero.style.display = 'none';
    }
    this.setupScreen.style.display = 'block';
    this.setupScreen.style.opacity = '1';
    this.setupScreen.style.pointerEvents = 'auto';
    this.setupScreen.classList.remove('hidden');
    const setupContent = this.setupScreen.querySelector('.setup-content');
    if (setupContent) {
      setupContent.style.opacity = '1';
      setupContent.style.pointerEvents = 'auto';
    }
    this.modeSelection.classList.add('hidden');
    this.playSetup.classList.remove('hidden');
    this.playSetup.style.display = 'block';
    this.simulationSetup.classList.add('hidden');
    this.updateAIConfigVisibility();
  }

  /**
   * Show simulation setup
   */
  showSimulationSetup() {
    if (this.landingHero) {
      this.landingHero.style.display = 'none';
    }
    this.setupScreen.style.display = 'block';
    this.setupScreen.style.opacity = '1';
    this.setupScreen.style.pointerEvents = 'auto';
    this.setupScreen.classList.remove('hidden');
    const setupContent = this.setupScreen.querySelector('.setup-content');
    if (setupContent) {
      setupContent.style.opacity = '1';
      setupContent.style.pointerEvents = 'auto';
    }
    this.modeSelection.classList.add('hidden');
    this.playSetup.classList.add('hidden');
    this.simulationSetup.classList.remove('hidden');
    this.simulationSetup.style.display = 'block';

    // Load saved API key into simulation form
    const apiKey = document.getElementById('api-key').value;
    document.getElementById('sim-api-key').value = apiKey;
  }

  /**
   * Show setup screen (from simulation)
   */
  showSetupScreen() {
    this.setupScreen.classList.remove('hidden');
    this.setupScreen.style.display = 'block';
    this.gameContainer.classList.add('hidden');
    this.simulationContainer.classList.add('hidden');
    this.showModeSelection();
  }

  /**
   * Get selected option value from option buttons
   */
  getSelectedOption(containerId) {
    const container = document.getElementById(containerId);
    const selected = container.querySelector('.option-btn.selected');
    return selected ? parseInt(selected.dataset.value) : null;
  }

  /**
   * Start simulation mode
   */
  async startSimulation() {
    const parallelCount = this.getSelectedOption('parallel-options');
    const chips = this.getSelectedOption('chips-options');
    const providerValue = document.getElementById('sim-ai-provider').value;
    const apiKey = document.getElementById('sim-api-key').value;
    const azureResource = document.getElementById('sim-azure-resource').value;

    // Parse provider:model format
    const [providerType, model] = providerValue.includes(':')
      ? providerValue.split(':')
      : [providerValue, null];

    // Use default Groq key if not provided
    const finalApiKey = providerType === 'groq' && !apiKey
      ? CONFIG.GROQ_API_KEY
      : apiKey;

    if (!finalApiKey) {
      alert('Please enter an API key');
      return;
    }

    // Create provider instance
    let provider;
    if (providerType === 'groq') {
      provider = new GroqProvider(finalApiKey, model || 'llama-3.3-70b-versatile');
    } else if (providerType === 'azure-claude') {
      provider = new AzureClaudeProvider(finalApiKey, azureResource, 'claude-opus-4-5');
    } else {
      alert('Provider not yet supported in simulation mode');
      return;
    }

    // Switch to simulation screen
    this.setupScreen.classList.add('hidden');
    this.gameContainer.classList.add('hidden');
    this.simulationContainer.classList.remove('hidden');
    this.simulationContainer.style.display = 'block';

    // Create and start simulation manager
    this.simulationManager = new SimulationManager({
      parallel: parallelCount,
      chips: chips,
      provider: provider,
      onAllComplete: (stats) => {
        this.onSimulationComplete(stats);
      }
    });

    this.simulationManager.start();
  }

  /**
   * Handle simulation completion
   */
  onSimulationComplete(stats) {
    console.log('Simulation complete:', stats);

    // Show stats panel
    const statsPanel = document.getElementById('sim-stats-panel');
    const statsContent = document.getElementById('sim-stats-content');
    statsPanel.style.display = 'block';
    this.simulationManager.renderStats(statsContent);
  }

  /**
   * Test the API connection
   */
  async testAPI() {
    const resultEl = document.getElementById('test-result');
    const btn = document.getElementById('test-api-btn');

    const provider = document.getElementById('ai-provider').value;
    const apiKey = document.getElementById('api-key').value;
    const azureResource = document.getElementById('azure-resource').value;

    if (!apiKey) {
      resultEl.textContent = '❌ Please enter an API key';
      resultEl.style.color = 'red';
      return;
    }

    btn.disabled = true;
    resultEl.textContent = '⏳ Testing...';
    resultEl.style.color = 'white';

    try {
      // Parse provider:model format
      const [providerType, model] = provider.includes(':')
        ? provider.split(':')
        : [provider, null];

      if (providerType === 'groq') {
        const groqKey = apiKey || CONFIG.GROQ_API_KEY;
        const groqProvider = new GroqProvider(groqKey, model || 'llama-3.3-70b-versatile');
        await groqProvider.test();
        resultEl.textContent = `✅ Groq connection successful! (${model || 'llama-3.3-70b-versatile'})`;
        resultEl.style.color = 'lightgreen';
      } else if (providerType === 'azure-claude') {
        const azureProvider = new AzureClaudeProvider(apiKey, azureResource, 'claude-opus-4-5');
        await azureProvider.test();
        resultEl.textContent = '✅ Azure Claude connection successful!';
        resultEl.style.color = 'lightgreen';
      } else {
        resultEl.textContent = '⚠️ Test only implemented for Groq and Azure Claude';
        resultEl.style.color = 'yellow';
      }
    } catch (error) {
      console.error('API test error:', error);
      resultEl.textContent = `❌ ${error.message}`;
      resultEl.style.color = 'red';
    } finally {
      btn.disabled = false;
    }
  }

  /**
   * Show/hide Azure-specific fields
   */
  updateProviderFields() {
    const provider = document.getElementById('ai-provider').value;
    const azureRow = document.getElementById('azure-resource-row');
    azureRow.style.display = provider === 'azure-claude' ? 'flex' : 'none';
  }

  /**
   * Update visibility of AI config section
   */
  updateAIConfigVisibility() {
    const hasAI = this.getAIPlayers().length > 0;
    document.getElementById('ai-config').style.display = hasAI ? 'block' : 'none';
  }

  /**
   * Get list of AI player IDs
   */
  getAIPlayers() {
    const aiPlayers = [];
    for (let i = 0; i < 4; i++) {
      const select = document.getElementById(`player-${i}-type`);
      if (select.value === 'ai') {
        aiPlayers.push(i);
      }
    }
    return aiPlayers;
  }

  /**
   * Load saved configuration from localStorage, with defaults from CONFIG
   */
  loadSavedConfig() {
    // Set defaults from CONFIG
    document.getElementById('api-key').value = CONFIG.GROQ_API_KEY;
    document.getElementById('azure-resource').value = CONFIG.AZURE_RESOURCE;

    // Also set defaults for simulation fields
    document.getElementById('sim-api-key').value = CONFIG.GROQ_API_KEY;
    document.getElementById('sim-azure-resource').value = CONFIG.AZURE_RESOURCE;

    // Override with saved config if available
    const saved = localStorage.getItem('soLongSuckerConfig');
    if (saved) {
      try {
        const config = JSON.parse(saved);
        if (config.apiKey) {
          document.getElementById('api-key').value = config.apiKey;
          document.getElementById('sim-api-key').value = config.apiKey;
        }
        if (config.provider) {
          document.getElementById('ai-provider').value = config.provider;
          document.getElementById('sim-ai-provider').value = config.provider;
        }
        if (config.azureResource) {
          document.getElementById('azure-resource').value = config.azureResource;
          document.getElementById('sim-azure-resource').value = config.azureResource;
        }
        if (config.players) {
          config.players.forEach((type, i) => {
            const select = document.getElementById(`player-${i}-type`);
            if (select) select.value = type;
          });
        }
      } catch (e) {
        console.error('Failed to load config:', e);
      }
    }
    this.updateAIConfigVisibility();
    this.updateProviderFields();

    // Update simulation provider fields visibility
    const simProvider = document.getElementById('sim-ai-provider').value;
    document.getElementById('sim-azure-resource-row').style.display =
      simProvider === 'azure-claude' ? 'flex' : 'none';
  }

  /**
   * Save configuration to localStorage
   */
  saveConfig() {
    const config = {
      apiKey: document.getElementById('api-key').value,
      provider: document.getElementById('ai-provider').value,
      azureResource: document.getElementById('azure-resource').value,
      players: [0, 1, 2, 3].map(i =>
        document.getElementById(`player-${i}-type`).value
      )
    };
    localStorage.setItem('soLongSuckerConfig', JSON.stringify(config));
  }

  // ==========================================
  // GAME STATE PERSISTENCE
  // ==========================================

  /**
   * Save game state to localStorage
   */
  saveGame() {
    if (!this.game) return;
    try {
      const state = this.game.toJSON();
      localStorage.setItem('soLongSuckerGame', JSON.stringify(state));
      console.log('💾 Game auto-saved');
    } catch (e) {
      console.error('Failed to save game:', e);
    }
  }

  /**
   * Load game state from localStorage
   * @returns {boolean} Whether a saved game was loaded
   */
  loadGame() {
    const saved = localStorage.getItem('soLongSuckerGame');
    if (!saved) return false;

    try {
      const data = JSON.parse(saved);
      this.game.fromJSON(data);
      console.log('📂 Game loaded from localStorage');
      return true;
    } catch (e) {
      console.error('Failed to load saved game:', e);
      localStorage.removeItem('soLongSuckerGame'); // Clear corrupted data
      return false;
    }
  }

  /**
   * Clear saved game from localStorage
   */
  clearSavedGame() {
    localStorage.removeItem('soLongSuckerGame');
    console.log('🗑️ Saved game cleared');
  }

  /**
   * Check if there's a saved game
   */
  hasSavedGame() {
    return localStorage.getItem('soLongSuckerGame') !== null;
  }

  /**
   * Export game state as JSON file download
   */
  exportGame() {
    if (!this.game) return;

    // If AI is active, export the AI snapshots instead
    if (this.agentManager && this.agentManager.getSnapshotCount() > 0) {
      this.agentManager.downloadGameData();
      return;
    }

    // Otherwise export basic game state
    const data = this.game.toJSON();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `so-long-sucker-${new Date().toISOString().slice(0,10)}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log('📤 Game exported');
  }

  /**
   * Import game state from JSON file
   * @param {File} file - JSON file to import
   */
  importGame(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        this.game.fromJSON(data);
        this.saveGame(); // Save imported game to localStorage
        this.render();
        console.log('📥 Game imported successfully');
      } catch (err) {
        console.error('Failed to import game:', err);
        alert('Failed to import game: ' + err.message);
      }
    };
    reader.readAsText(file);
  }

  /**
   * Start the game
   * @param {boolean} continueGame - Whether to continue a saved game
   */
  startGame(continueGame = false) {
    const aiPlayers = this.getAIPlayers();
    const apiKey = document.getElementById('api-key').value;
    const providerValue = document.getElementById('ai-provider').value;
    const azureResource = document.getElementById('azure-resource').value;

    // Parse provider:model format (e.g., "groq:llama-3.3-70b-versatile")
    const [provider, model] = providerValue.includes(':')
      ? providerValue.split(':')
      : [providerValue, null];

    // Use default Groq key if not provided
    const finalApiKey = provider === 'groq' && !apiKey
      ? CONFIG.GROQ_API_KEY
      : apiKey;

    // Validate API key if AI players are selected (skip for Groq with hardcoded key)
    if (aiPlayers.length > 0 && !finalApiKey) {
      alert('Please enter an API key for AI players');
      return;
    }

    // Save config
    this.saveConfig();

    // Initialize game
    this.game = new Game();
    this.ui = new UI(this.game, this.handleAction.bind(this));

    // Reset tracking for Supabase
    this.gameStartTime = Date.now();
    this.turnCount = 0;

    // Try to load saved game if requested
    if (continueGame && this.hasSavedGame()) {
      this.loadGame();
    } else {
      // Apply test state if not continuing a saved game
      const testStateId = parseInt(document.getElementById('test-state-select').value);
      if (testStateId > 0) {
        applyTestState(this.game, testStateId);
      }
    }

    // Initialize agent manager if AI players exist
    if (aiPlayers.length > 0) {
      this.agentManager = new AgentManager(
        this.game,
        this.handleAction.bind(this),
        this.render.bind(this)
      );
      this.agentManager.setProvider(provider, finalApiKey, {
        resource: azureResource,
        model: model || 'claude-opus-4-5'
      });
      this.agentManager.setAIPlayers(aiPlayers);
      // Tell UI which players are AI so it can disable controls during AI turns
      this.ui.setAIPlayers(aiPlayers);
    }

    // Switch from setup to game
    this.setupScreen.classList.add('hidden');
    this.gameContainer.classList.remove('hidden');
    this.gameContainer.style.display = 'block';

    // Bind game control events (export/import)
    this.bindGameEvents();

    // Initial render
    this.render();

    // Show modal if test state put us in a special phase
    this.showModalForCurrentPhase();

    // Start AI loop if applicable
    if (this.agentManager) {
      this.agentManager.start();
    }
  }

  /**
   * Show the appropriate modal based on current game phase
   * Used when starting with a test state that requires immediate user input
   */
  showModalForCurrentPhase() {
    const state = this.game.getState();
    const isHuman = !this.agentManager?.isAI(state.currentPlayer);

    if (!isHuman) return;  // AI will handle it

    switch (state.phase) {
      case 'selectNextPlayer': {
        // Find missing colors from the last pile played
        const pile = this.game.piles[this.game.piles.length - 1];
        if (pile) {
          const options = pile.getMissingColors().filter(c =>
            this.game.getPlayerByColor(c).isAlive
          );
          if (options.length > 1) {
            this.ui.showNextPlayerModal(options);
          }
        }
        break;
      }
      case 'capture': {
        if (this.game.pendingCapture) {
          this.ui.showCaptureModal(this.game.pendingCapture.chips);
        }
        break;
      }
      case 'donation': {
        // Find who to ask for donation
        const result = this.game.askNextDonation();
        if (result.action === 'askDonation') {
          const donor = this.game.getPlayer(result.donor);
          this.ui.showDonationModal(result.asker, result.donor, donor.prisoners);
        }
        break;
      }
    }
  }

  /**
   * Bind game screen events (export/import)
   */
  bindGameEvents() {
    // Export button
    const exportBtn = document.getElementById('export-game-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportGame());
    }

    // Import button
    const importInput = document.getElementById('import-game-input');
    if (importInput) {
      importInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
          this.importGame(e.target.files[0]);
          e.target.value = ''; // Reset for future imports
        }
      });
    }
  }

  /**
   * Record a human player's decision for data collection
   */
  recordHumanDecision(playerId, execution) {
    if (!this.agentManager) return;
    
    const dataCollector = this.agentManager.getDataCollector();
    if (!dataCollector) return;
    
    // Record decision with null LLM data (human player)
    dataCollector.addDecision(this.game, playerId, null, null, execution);
  }

  /**
   * Handle UI actions
   */
  handleAction(action, data) {
    console.log('Action:', action, data);

    try {
      let result;
      const currentPlayer = this.game.currentPlayer;
      const isHuman = !this.agentManager?.isAI(currentPlayer);

      switch (action) {
        case 'selectChip':
          this.game.selectChip(data);
          if (isHuman) {
            this.recordHumanDecision(currentPlayer, [{ tool: 'playChip', args: { color: data }, success: true }]);
          }
          this.render();
          break;

        case 'playOnPile':
          result = this.game.playOnPile(data);
          this.turnCount++;
          if (isHuman) {
            this.recordHumanDecision(currentPlayer, [{ tool: 'selectPile', args: { pileId: data }, success: true }]);
            this.agentManager?.getDataCollector()?.incrementTurn();
          }
          this.handleResult(result);
          break;

        case 'chooseNextPlayer':
          result = this.game.chooseNextPlayer(data);
          if (isHuman) {
            this.recordHumanDecision(currentPlayer, [{ tool: 'chooseNextPlayer', args: { playerId: data }, success: true }]);
          }
          this.handleResult(result);
          break;

        case 'resolveCapture':
          result = this.game.resolveCapture(data);
          if (isHuman) {
            this.recordHumanDecision(currentPlayer, [{ tool: 'killChip', args: { color: data }, success: true }]);
          }
          this.handleResult(result);
          break;

        case 'donate':
          result = this.game.handleDonation(data.donor, data.accepts, data.color);
          if (!this.agentManager?.isAI(data.donor)) {
            this.recordHumanDecision(data.donor, [{ tool: 'respondToDonation', args: { accept: data.accepts, color: data.color }, success: true }]);
          }
          this.handleResult(result);
          break;

        case 'restart':
          this.ui.hideAllModals();
          this.game.reset();
          this.render();
          if (this.agentManager) {
            this.agentManager.start();
          }
          break;

        // Negotiation actions
        case 'chat':
          // Convert color to player index if needed
          const chatPlayerIndex = data.player !== undefined
            ? data.player
            : COLORS.indexOf(data.color);
          this.game.addMessage(chatPlayerIndex, data.text);
          // Record human chat for data collection
          if (!this.agentManager?.isAI(chatPlayerIndex)) {
            this.recordHumanDecision(chatPlayerIndex, [{ tool: 'sendChat', args: { message: data.text }, success: true }]);
          }
          // Reset chat counter for AI agents
          if (this.agentManager) {
            Object.values(this.agentManager.agents).forEach(a => a.resetChatCounter());
          }
          this.render();
          break;

        case 'givePrisoner':
          this.game.givePrisoner(data.from, data.to, data.color);
          this.render();
          break;
      }

      // Auto-save after every action
      this.saveGame();
    } catch (err) {
      console.error('Action error:', err);
      alert(err.message);
    }
  }

  /**
   * Handle game results
   */
  handleResult(result) {
    console.log('Result:', result);

    switch (result.action) {
      case 'capture':
        this.render();
        // Only show modal if current player is human
        if (!this.agentManager?.isAI(this.game.currentPlayer)) {
          this.ui.showCaptureModal(result.pile.chips);
        }
        break;

      case 'chooseNext':
        this.render();
        // Only show modal if current player is human
        if (!this.agentManager?.isAI(this.game.currentPlayer)) {
          this.ui.showNextPlayerModal(result.options);
        }
        break;

      case 'nextTurn':
      case 'captured':
      case 'eliminated':
      case 'donationAccepted':
        this.ui.hideAllModals(); // Close any open modals
        this.render();
        break;

      case 'askDonation':
        this.render();
        // Only show modal if donor is human
        if (!this.agentManager?.isAI(result.donor)) {
          const donor = this.game.getPlayer(result.donor);
          this.ui.showDonationModal(result.asker, result.donor, donor.prisoners);
        }
        break;

      case 'gameOver':
        this.render();
        if (this.agentManager) {
          this.agentManager.getDataCollector()?.addGameEnd(this.game);
          this.agentManager.stop();
        }
        this.ui.showGameOver(result.winner);

        // Save to Supabase
        const playerTypes = [0, 1, 2, 3].map(i => {
          const select = document.getElementById(`player-${i}-type`);
          return select ? select.value : 'unknown';
        });
        saveGameSession({
          session_id: `play-${this.gameStartTime}`,
          mode: 'play',
          config: {
            chipsPerPlayer: this.game.startingChips,
            playerTypes: playerTypes
          },
          games: [this.game.toJSON()],
          duration_ms: Date.now() - this.gameStartTime,
          total_turns: this.turnCount,
          winner: COLORS[result.winner]
        });
        break;
    }
  }

  /**
   * Render current state
   */
  render() {
    this.ui.render(this.game.getState());
  }
}

// Start when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.game = new SoLongSucker();
});
