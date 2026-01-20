// Game Data Collector - Captures snapshots for analysis
// Same format as CLI for consistency

const COLORS = ['red', 'blue', 'green', 'yellow'];

export class GameDataCollector {
  constructor() {
    this.reset();
  }

  reset() {
    this.snapshots = [];
    this.eliminationOrder = [];
    this.startTime = Date.now();
    this.turnCount = 0;
    this.lastAliveStatus = [true, true, true, true];
    this.lastChatSnapshotIndex = 0; // For incremental chat tracking
    
    // Player configuration (set via setPlayerConfig)
    this.playerTypes = {}; // playerId -> 'human' | 'ai'
    this.playerModels = {}; // playerId -> model name (for AI players)
    this.chips = 7; // default chip count
  }

  /**
   * Configure player types and models
   * @param {Object} config - { playerTypes: {0: 'human', 1: 'ai', ...}, playerModels: {1: 'gemini-2.5-flash', ...}, chips: 7 }
   */
  setPlayerConfig(config) {
    if (config.playerTypes) {
      this.playerTypes = { ...config.playerTypes };
    }
    if (config.playerModels) {
      this.playerModels = { ...config.playerModels };
    }
    if (config.chips) {
      this.chips = config.chips;
    }
  }

  // Get state snapshot from game
  getStateSnapshot(game) {
    const state = game.getState();
    return {
      players: state.players.map(p => ({
        color: p.color,
        supply: p.supply,
        prisoners: [...p.prisoners],
        totalChips: p.totalChips,
        alive: p.isAlive
      })),
      piles: state.piles.map(p => ({
        id: p.id,
        chips: [...p.chips]
      })),
      deadBox: [...state.deadBox],
      phase: state.phase,
      currentPlayer: COLORS[state.currentPlayer]
    };
  }

  // Get chat history from game (full - for game_start/game_end)
  getChatHistory(game) {
    const state = game.getState();
    return state.messages.map(m => ({
      player: COLORS[m.player],
      message: m.text
    }));
  }

  // Get only NEW chat messages since last snapshot (incremental - avoids O(n²) duplication)
  getNewChatMessages(game) {
    const state = game.getState();
    const allMessages = state.messages;
    const newMessages = allMessages.slice(this.lastChatSnapshotIndex).map(m => ({
      player: COLORS[m.player],
      message: m.text
    }));
    this.lastChatSnapshotIndex = allMessages.length;
    return newMessages;
  }

  // Check for new eliminations
  checkEliminations(game) {
    const state = game.getState();
    for (let i = 0; i < 4; i++) {
      if (this.lastAliveStatus[i] && !state.players[i].isAlive) {
        this.lastAliveStatus[i] = false;
        this.eliminationOrder.push(COLORS[i]);
      }
    }
  }

  // Add game_start snapshot
  addGameStart(game) {
    // Build player info with types and models
    const players = COLORS.map((color, id) => ({
      player: color,
      type: this.playerTypes[id] || 'unknown',
      model: this.playerModels[id] || null
    }));

    this.snapshots.push({
      type: 'game_start',
      game: 0,
      state: this.getStateSnapshot(game),
      chatHistory: [],
      players: players, // Player configuration (who is human vs AI, which models)
      timestamp: Date.now()
    });
  }

  // Add decision snapshot (before/after LLM call)
  // NOTE: state and full chatHistory are NOT included - they're embedded in llmRequest.userPrompt
  // This saves ~56% of decision data size
  addDecision(game, playerId, llmRequest, llmResponse, execution) {
    const playerType = this.playerTypes[playerId] || 'unknown';
    const playerModel = this.playerModels[playerId] || null;
    const state = game.getState();

    this.snapshots.push({
      type: 'decision',
      game: 0,
      turn: this.turnCount,
      player: COLORS[playerId],
      playerType: playerType, // 'human' or 'ai'
      model: playerModel, // Model name for AI, null for human
      phase: state.phase, // Keep phase for quick filtering (small field)
      newMessages: this.getNewChatMessages(game), // Incremental: only new messages since last snapshot
      llmRequest: llmRequest || null, // null for human players (contains full state + chat for AI)
      llmResponse: llmResponse || null, // null for human players
      execution: execution || [],
      timestamp: Date.now()
    });

    // Check for eliminations after each decision
    this.checkEliminations(game);
  }

  // Add game_end snapshot
  addGameEnd(game) {
    const state = game.getState();
    const winner = state.winner !== null ? COLORS[state.winner] : null;

    this.snapshots.push({
      type: 'game_end',
      game: 0,
      winner: winner,
      turns: this.turnCount,
      duration: Date.now() - this.startTime,
      eliminationOrder: this.eliminationOrder,
      state: this.getStateSnapshot(game),
      chatHistory: this.getChatHistory(game),
      timestamp: Date.now()
    });
  }

  // Increment turn counter
  incrementTurn() {
    this.turnCount++;
  }

  // Export data in the same format as CLI
  exportData(providerType, modelName) {
    // Build playerTypes and playerModels in color-keyed format (like CLI)
    const playerTypesExport = {};
    const playerModelsExport = {};
    
    for (let i = 0; i < 4; i++) {
      const color = COLORS[i];
      playerTypesExport[color] = this.playerTypes[i] || 'unknown';
      if (this.playerModels[i]) {
        playerModelsExport[color] = this.playerModels[i];
      }
    }

    return {
      session: {
        id: `session-${Date.now()}`,
        provider: providerType || 'unknown',
        model: modelName || 'unknown',
        playerTypes: playerTypesExport, // { red: 'human', blue: 'ai', ... }
        playerModels: Object.keys(playerModelsExport).length > 0 ? playerModelsExport : null, // { blue: 'gemini-2.5-flash', ... }
        startTime: this.startTime,
        endTime: Date.now(),
        totalGames: 1,
        chips: this.chips,
        source: 'browser' // Distinguish from CLI data
      },
      snapshots: this.snapshots
    };
  }

  // Download as JSON file
  downloadJSON(providerType, modelName) {
    const data = this.exportData(providerType, modelName);
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `game-${timestamp}.json`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log(`📥 Downloaded: ${filename}`);
    return filename;
  }

  // Get snapshot count
  getSnapshotCount() {
    return this.snapshots.length;
  }
}
