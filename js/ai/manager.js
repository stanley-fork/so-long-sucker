// Agent Manager - coordinates AI agents and runs the game loop

import { AIAgent } from './agent.js';
import { OpenAIProvider } from './providers/openai.js';
import { ClaudeProvider } from './providers/claude.js';
import { AzureClaudeProvider } from './providers/azure-claude.js';
import { GroqProvider } from './providers/groq.js';
import { GeminiProvider } from './providers/gemini.js';
import { OpenRouterProvider } from './providers/openrouter.js';
import { GameDataCollector } from './data-collector.js';
import { uploadGameToStorage } from '../api/supabase.js';
import { CONFIG } from '../config.js';

const COLORS = ['red', 'blue', 'green', 'yellow'];

export class AgentManager {
  constructor(game, onAction, onRender) {
    this.game = game;
    this.onAction = onAction;
    this.onRender = onRender;
    this.agents = {}; // playerId -> AIAgent
    this.agentLoops = {}; // playerId -> intervalId (each agent has own loop)
    this.provider = null;
    this.providerType = null;
    this.running = false;

    // Data collection
    this.dataCollector = new GameDataCollector();
    this.setupDataCollector();

    // Handle page unload to save abandoned games
    this.boundBeforeUnload = this.handleBeforeUnload.bind(this);
    window.addEventListener('beforeunload', this.boundBeforeUnload);

    // Stuck state detection
    this.stuckState = {
      phase: null,
      player: null,
      count: 0
    };
    this.STUCK_THRESHOLD = 10; // Number of cycles before auto-recovery
  }

  /**
   * Configure the LLM provider (stores API key and provider type for per-player setup)
   */
  setProvider(providerType, apiKey) {
    this.providerType = providerType;
    this.apiKey = apiKey;
  }

  /**
   * Create a provider instance for a specific model
   * @param {string} model - Model identifier
   * @returns {LLMProvider} Provider instance
   */
  createProvider(model) {
    switch (this.providerType) {
      case 'openai':
        return new OpenAIProvider(this.apiKey, model);
      case 'claude':
        return new ClaudeProvider(this.apiKey, model);
      case 'azure-claude':
        return new AzureClaudeProvider(this.apiKey, CONFIG.AZURE_RESOURCE, model);
      case 'groq':
        return new GroqProvider(this.apiKey, model);
      case 'gemini':
        return new GeminiProvider(this.apiKey, model);
      case 'openrouter':
        return new OpenRouterProvider(this.apiKey, model);
      default:
        throw new Error(`Unknown provider: ${this.providerType}`);
    }
  }

  /**
   * Set which players are AI-controlled with per-player model config
   * @param {number[]} playerIds - Array of player IDs that should be AI-controlled
   * @param {Object} playerModelConfig - Map of playerId -> model name (optional)
   */
  setAIPlayers(playerIds, playerModelConfig = {}) {
    this.agents = {};
    
    const defaultModel = 'moonshotai/kimi-k2-instruct-0905';
    
    // Build player types and models for data collection
    const playerTypes = {};
    const playerModels = {};
    
    for (let i = 0; i < 4; i++) {
      if (playerIds.includes(i)) {
        playerTypes[i] = 'ai';
        playerModels[i] = playerModelConfig[i] || defaultModel;
      } else {
        playerTypes[i] = 'human';
      }
    }
    
    // Configure data collector with player info
    this.dataCollector.setPlayerConfig({
      playerTypes,
      playerModels,
      chips: this.game.startingChips || 7
    });
    
    // Create AI agents with per-player providers
    for (const id of playerIds) {
      const model = playerModelConfig[id] || defaultModel;
      const provider = this.createProvider(model);
      this.agents[id] = new AIAgent(id, provider, this.game, this.onAction);
      console.log(`🤖 ${COLORS[id].toUpperCase()} agent: ${model}`);
    }
  }

  /**
   * Check if a player is AI-controlled
   */
  isAI(playerId) {
    return playerId in this.agents;
  }

  /**
   * Get AI agent for a player
   */
  getAgent(playerId) {
    return this.agents[playerId];
  }

  /**
   * Start independent loops for each agent
   */
  start() {
    if (this.running) return;
    this.running = true;
    console.log('🤖 Agent manager started');

    // Reset and add game_start snapshot
    this.dataCollector.reset();
    this.dataCollector.addGameStart(this.game);
    
    // Trigger initial save (game start)
    this.dataCollector.triggerSave();

    // Start a separate loop for each AI agent with staggered start times
    Object.entries(this.agents).forEach(([id, agent], index) => {
      const playerId = parseInt(id);
      // Stagger start times by 500ms to avoid all hitting API at once
      setTimeout(() => {
        this.startAgentLoop(playerId, agent);
      }, index * 500);
    });
  }

  /**
   * Start independent loop for a single agent
   */
  startAgentLoop(playerId, agent) {
    console.log(`🤖 Starting independent loop for ${COLORS[playerId].toUpperCase()}`);

    const runLoop = async () => {
      if (!this.running) return;

      const state = this.game.getState();
      const isMyTurn = state.currentPlayer === playerId;

      await this.processAgent(playerId, agent);

      // Check more often when it's your turn, less often when idle
      const delay = isMyTurn ? 1000 : 3000;
      this.agentLoops[playerId] = setTimeout(runLoop, delay);
    };

    runLoop();
  }

  /**
   * Stop all agent loops
   */
  stop() {
    this.running = false;
    // Clear all individual agent loops
    Object.values(this.agentLoops).forEach(timeoutId => {
      clearTimeout(timeoutId);
    });
    this.agentLoops = {};
    console.log('🤖 Agent manager stopped');
  }

  /**
   * Process a single agent - called by that agent's independent loop
   */
  async processAgent(playerId, agent) {
    const state = this.game.getState();
    const player = state.players[playerId];

    // Skip if game over or player dead
    if (state.phase === 'gameOver') {
      this.stop();
      return;
    }
    if (!player.isAlive) return;

    // Skip if already making a request
    if (agent.isRequesting) return;

    const isMyTurn = state.currentPlayer === playerId;

    // Pre-check: if it's our turn and we have no chips, trigger donation immediately
    // This prevents the AI from trying to play when it has nothing
    if (isMyTurn && state.phase === 'selectChip') {
      if (player.supply === 0 && player.prisoners.length === 0) {
        console.log(`🔧 ${COLORS[playerId]} has no chips, triggering donation`);
        try {
          const result = this.game.startDonation();
          if (result?.action === 'gameOver') {
            this.dataCollector.addGameEnd(this.game);
            this.stop();
          }
          this.onRender();
          return;
        } catch (error) {
          console.error(`❌ Failed to start donation:`, error.message);
        }
      }
    }

    // Check for stuck state and attempt recovery (only for current player's agent)
    if (isMyTurn) {
      const recovered = this.checkAndRecoverStuckState(state, playerId);
      if (recovered) {
        this.onRender();
        return;
      }
    }

    const shouldAct = isMyTurn && this.shouldAgentAct(state, playerId);

    // Determine what this agent should do
    let requestType = null;

    if (shouldAct && agent.canRequest(true)) {
      // It's my turn - I must take a game action
      requestType = 'action';
    } else if (state.phase === 'donation' &&
               state.currentDonor === playerId &&
               player.prisoners.length > 0 &&
               agent.canRequest(true)) {
      // Donation request - I am the specific player being asked
      requestType = 'donation';
    } else if (!isMyTurn && state.phase !== 'donation' && agent.canRequest(false)) {
      // Not my turn and not in donation phase - I can chat/think
      requestType = 'chat';
    }

    // Execute the request if we have something to do
    if (requestType) {
      await this.executeAgentRequest(playerId, agent, requestType, state);
    }
  }

  /**
   * Execute a single agent request
   */
  async executeAgentRequest(playerId, agent, type, state) {
    agent.startRequest();
    try {
      console.log(`🤖 ${COLORS[playerId].toUpperCase()} (${type}) requesting...`);
      const result = await agent.decide(state);

      if (result && result.toolCalls) {
        const actions = result.toolCalls;
        const execution = [];

        if (type === 'chat') {
          // Only allow chat when not their turn
          const chatActions = actions.filter(a => a.name === 'sendChat');
          if (chatActions.length > 0) {
            for (const action of chatActions) {
              const success = agent.execute(action);
              execution.push({ tool: action.name, args: action.arguments, success });
            }
            this.onRender();
          }
        } else if (type === 'donation') {
          // Check for donation response
          const hasDonationResponse = actions.some(a => a.name === 'respondToDonation');
          if (hasDonationResponse) {
            for (const action of actions) {
              const success = agent.execute(action);
              execution.push({ tool: action.name, args: action.arguments, success });
            }
            this.onRender();
          }
        } else {
          // Game action - execute all
          for (const action of actions) {
            const success = agent.execute(action);
            execution.push({ tool: action.name, args: action.arguments, success });
          }
          this.onRender();

          // Increment turn count on game actions
          if (actions.some(a => a.name === 'selectPile')) {
            this.dataCollector.incrementTurn();
          }
        }

        // Build LLM request/response for snapshot
        const llmRequest = result.context ? {
          userPrompt: result.context.userPrompt,
          availableTools: result.context.availableTools
        } : null;

        const llmResponse = result.metadata ? {
          responseTime: result.metadata.responseTime,
          promptTokens: result.metadata.promptTokens,
          completionTokens: result.metadata.completionTokens,
          toolCalls: result.metadata.rawToolCalls || []
        } : null;

        // Add decision snapshot
        this.dataCollector.addDecision(this.game, playerId, llmRequest, llmResponse, execution);

        // Check for game over
        if (state.phase === 'gameOver' || this.game.getState().phase === 'gameOver') {
          this.dataCollector.addGameEnd(this.game);
        }
      }
    } catch (error) {
      console.error(`❌ Agent ${COLORS[playerId]} error:`, error);
    } finally {
      agent.finishRequest();
    }
  }

  /**
   * Check for stuck state and attempt auto-recovery
   * Returns true if recovery action was taken
   */
  checkAndRecoverStuckState(state, playerId) {
    // Track if we're stuck in the same state
    if (state.phase === this.stuckState.phase && state.currentPlayer === this.stuckState.player) {
      this.stuckState.count++;
    } else {
      // State changed, reset counter
      this.stuckState = {
        phase: state.phase,
        player: state.currentPlayer,
        count: 0
      };
      return false;
    }

    // Not stuck yet
    if (this.stuckState.count < this.STUCK_THRESHOLD) {
      return false;
    }

    // We're stuck - attempt recovery
    console.warn(`⚠️ Stuck state detected: ${state.phase} for ${COLORS[playerId]}, attempting recovery...`);
    this.stuckState.count = 0; // Reset to avoid rapid retries

    const player = state.players[playerId];

    try {
      switch (state.phase) {
        case 'selectChip':
          return this.recoverSelectChip(player, playerId);

        case 'selectPile':
          return this.recoverSelectPile();

        case 'selectNextPlayer':
          return this.recoverSelectNextPlayer(state);

        case 'capture':
          return this.recoverCapture(state);

        case 'donation':
          return this.recoverDonation(state);

        default:
          console.warn(`⚠️ No recovery for phase: ${state.phase}`);
          return false;
      }
    } catch (error) {
      console.error(`❌ Recovery failed for ${state.phase}:`, error.message);
      return false;
    }
  }

  /**
   * Recovery: selectChip phase
   */
  recoverSelectChip(player, playerId) {
    // Don't auto-recover if current player is human
    if (!this.isAI(playerId)) {
      console.log(`🔧 Recovery: Skipping - waiting for human ${COLORS[playerId]} to select chip`);
      return false;
    }
    
    // Check if player has no chips - should trigger donation
    if (player.supply === 0 && player.prisoners.length === 0) {
      console.log(`🔧 Recovery: ${COLORS[playerId]} has no chips, triggering donation`);
      const result = this.game.startDonation();
      if (result.action === 'gameOver') {
        this.dataCollector.addGameEnd(this.game);
        this.stop();
      }
      return true;
    }

    // Auto-select first available chip
    const chipToPlay = player.supply > 0 ? player.color : player.prisoners[0];
    if (chipToPlay) {
      console.log(`🔧 Recovery: Auto-selecting ${chipToPlay} chip for ${COLORS[playerId]}`);
      this.game.selectChip(chipToPlay);
      return true;
    }

    return false;
  }

  /**
   * Recovery: selectPile phase
   */
  recoverSelectPile() {
    // Don't auto-recover if current player is human
    const state = this.game.getState();
    if (!this.isAI(state.currentPlayer)) {
      console.log(`🔧 Recovery: Skipping - waiting for human ${COLORS[state.currentPlayer]} to select pile`);
      return false;
    }
    
    console.log(`🔧 Recovery: Auto-playing on new pile`);
    try {
      const result = this.game.playOnPile(null);
      this.dataCollector.incrementTurn();
      if (result?.action === 'gameOver') {
        this.dataCollector.addGameEnd(this.game);
        this.stop();
      }
      return true;
    } catch (error) {
      // If playOnPile failed, the chip may be invalid - reset to selectChip
      console.warn(`🔧 Recovery: playOnPile failed, game reset to ${this.game.phase}`);
      return this.game.phase === 'selectChip'; // Return true if phase changed
    }
  }

  /**
   * Recovery: selectNextPlayer phase
   */
  recoverSelectNextPlayer(state) {
    // Don't auto-recover if current player is human
    if (!this.isAI(state.currentPlayer)) {
      console.log(`🔧 Recovery: Skipping - waiting for human ${COLORS[state.currentPlayer]} to choose next player`);
      return false;
    }
    
    // Find first alive player that's not current
    const alivePlayers = state.players.filter(p => p.isAlive && p.id !== state.currentPlayer);
    if (alivePlayers.length > 0) {
      const nextPlayer = alivePlayers[0];
      console.log(`🔧 Recovery: Auto-choosing ${nextPlayer.color} as next player`);
      this.game.chooseNextPlayer(nextPlayer.id);
      return true;
    }
    return false;
  }

  /**
   * Recovery: capture phase
   */
  recoverCapture(state) {
    // Don't auto-recover if current player is human
    if (!this.isAI(state.currentPlayer)) {
      console.log(`🔧 Recovery: Skipping - waiting for human ${COLORS[state.currentPlayer]} to choose chip to kill`);
      return false;
    }
    
    if (state.pendingCapture && state.pendingCapture.chips.length > 0) {
      // Kill the first chip in the pile
      const chipToKill = state.pendingCapture.chips[0];
      console.log(`🔧 Recovery: Auto-killing ${chipToKill} chip`);
      const result = this.game.resolveCapture(chipToKill);
      if (result?.action === 'gameOver') {
        this.dataCollector.addGameEnd(this.game);
        this.stop();
      }
      return true;
    }
    return false;
  }

  /**
   * Recovery: donation phase
   */
  recoverDonation(state) {
    const currentDonor = state.currentDonor;
    if (currentDonor !== null) {
      // Don't auto-refuse if the donor is human - let them decide
      if (!this.isAI(currentDonor)) {
        console.log(`🔧 Recovery: Skipping - waiting for human ${COLORS[currentDonor]} to respond to donation`);
        return false;
      }
      
      // Auto-refuse donation from AI donor
      console.log(`🔧 Recovery: Auto-refusing donation from ${COLORS[currentDonor]}`);
      const result = this.game.handleDonation(currentDonor, false);
      if (result?.action === 'gameOver') {
        this.dataCollector.addGameEnd(this.game);
        this.stop();
      }
      return true;
    }

    // No current donor but still in donation phase - force ask next or eliminate
    console.log(`🔧 Recovery: Forcing donation resolution`);
    const result = this.game.askNextDonation();
    if (result?.action === 'gameOver') {
      this.dataCollector.addGameEnd(this.game);
      this.stop();
    }
    return true;
  }

  /**
   * Check if an AI agent should take action
   */
  shouldAgentAct(state, playerId) {
    const player = state.players[playerId];
    if (!player.isAlive) return false;

    // Must act if it's their turn
    if (state.currentPlayer === playerId) {
      return ['selectChip', 'selectPile', 'selectNextPlayer', 'capture'].includes(state.phase);
    }

    return false;
  }

  /**
   * Trigger AI to potentially chat (called periodically)
   */
  async triggerChat() {
    if (!this.running) return;

    const state = this.game.getState();
    const agentIds = Object.keys(this.agents).map(Number);

    // Pick a random AI to potentially chat
    if (agentIds.length > 0) {
      const randomId = agentIds[Math.floor(Math.random() * agentIds.length)];
      const agent = this.agents[randomId];

      if (agent && state.players[randomId].isAlive) {
        try {
          const result = await agent.decide(state);
          if (result && result.toolCalls) {
            const action = result.toolCalls.find(a => a.name === 'sendChat');
            if (action) {
              agent.execute(action);
              this.onRender();
            }
          }
        } catch (error) {
          console.error('Chat trigger error:', error);
        }
      }
    }
  }

  /**
   * Set up data collector with save callback
   */
  setupDataCollector() {
    this.dataCollector.setSaveCallback(async (sessionId, gameData) => {
      gameData.session.provider = this.providerType || 'groq';
      await uploadGameToStorage(sessionId, gameData);
    });
  }

  /**
   * Handle page unload - save abandoned game
   */
  handleBeforeUnload(event) {
    if (this.running && this.dataCollector.getSnapshotCount() > 0) {
      // Mark as abandoned and save synchronously
      this.dataCollector.gameStatus = 'abandoned';
      const sessionId = this.dataCollector.getSessionId();
      const modelName = this.provider?.getModelName?.() || this.provider?.model || 'unknown';
      const gameData = this.dataCollector.exportData(this.providerType, modelName);
      
      // Use sendBeacon for reliable save on page unload
      const blob = new Blob([JSON.stringify(gameData)], { type: 'application/json' });
      const url = `https://fisiwiuxcaexlawqlfnl.supabase.co/storage/v1/object/game-data/games/${sessionId}.json`;
      
      // sendBeacon doesn't support custom headers, so we need to use fetch with keepalive
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpc2l3aXV4Y2FleGxhd3FsZm5sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxNzcyNTUsImV4cCI6MjA4MTc1MzI1NX0.QIA1uUId1ytjQdPL5Q_828Bgg3Vj9Xy4DPir6TDj-bE',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpc2l3aXV4Y2FleGxhd3FsZm5sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxNzcyNTUsImV4cCI6MjA4MTc1MzI1NX0.QIA1uUId1ytjQdPL5Q_828Bgg3Vj9Xy4DPir6TDj-bE',
          'x-upsert': 'true'
        },
        body: JSON.stringify(gameData),
        keepalive: true // Important for page unload
      }).catch(() => {}); // Ignore errors on unload
      
      console.log('📤 Saving abandoned game on page unload:', sessionId);
    }
  }

  /**
   * Clean up event listeners
   */
  destroy() {
    window.removeEventListener('beforeunload', this.boundBeforeUnload);
    this.stop();
  }

  /**
   * Download collected game data as JSON
   */
  downloadGameData() {
    const modelName = this.provider?.model || 'unknown';
    return this.dataCollector.downloadJSON(this.providerType, modelName);
  }

  /**
   * Get snapshot count for display
   */
  getSnapshotCount() {
    return this.dataCollector.getSnapshotCount();
  }

  /**
   * Get the data collector instance
   */
  getDataCollector() {
    return this.dataCollector;
  }
}
