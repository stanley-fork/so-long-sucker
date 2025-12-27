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

  // Get chat history from game
  getChatHistory(game) {
    const state = game.getState();
    return state.messages.map(m => ({
      player: COLORS[m.player],
      message: m.text
    }));
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
    this.snapshots.push({
      type: 'game_start',
      game: 0,
      state: this.getStateSnapshot(game),
      chatHistory: [],
      timestamp: Date.now()
    });
  }

  // Add decision snapshot (before/after LLM call)
  addDecision(game, playerId, llmRequest, llmResponse, execution) {
    this.snapshots.push({
      type: 'decision',
      game: 0,
      turn: this.turnCount,
      player: COLORS[playerId],
      state: this.getStateSnapshot(game),
      chatHistory: this.getChatHistory(game),
      llmRequest: llmRequest || null,
      llmResponse: llmResponse || null,
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
    return {
      session: {
        id: `session-${Date.now()}`,
        provider: providerType || 'unknown',
        model: modelName || 'unknown',
        startTime: this.startTime,
        endTime: Date.now(),
        totalGames: 1,
        chips: 7 // default for web UI
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
