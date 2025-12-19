// Simulation Manager for So Long Sucker
// Orchestrates multiple parallel AI games

import { MiniGame } from './miniGame.js';
import { COLORS } from './player.js';
import { saveGameSession } from './api/supabase.js';

export class SimulationManager {
  constructor(config) {
    this.parallelCount = config.parallel || 4;
    this.chips = config.chips || 3;
    this.provider = config.provider;

    this.slots = [];  // MiniGame instances
    this.logs = [];   // Completed game logs
    this.completedCount = 0;
    this.isRunning = false;

    // Session recording
    this.sessionLog = null;

    this.onUpdate = config.onUpdate;  // Callback for UI updates
    this.onAllComplete = config.onAllComplete;  // Callback when all games done

    this.gridElement = document.getElementById('simulation-grid');
    this.statusElement = document.getElementById('sim-status');
    this.progressElement = document.getElementById('sim-progress');
  }

  /**
   * Set up the grid layout based on parallel count
   */
  setupGrid() {
    // Clear existing
    this.gridElement.innerHTML = '';
    this.gridElement.className = 'simulation-grid';

    // Determine column count
    let cols = 1;
    if (this.parallelCount === 2) cols = 2;
    else if (this.parallelCount <= 4) cols = 2;
    else if (this.parallelCount <= 6) cols = 3;
    else cols = 4;

    this.gridElement.classList.add(`cols-${cols}`);

    // Add rows-2 class for 6+ games
    if (this.parallelCount > 4) {
      this.gridElement.classList.add('rows-2');
    }
  }

  /**
   * Start all parallel games
   */
  async start() {
    if (this.isRunning) return;

    this.isRunning = true;
    this.slots = [];
    this.logs = [];
    this.completedCount = 0;

    // Initialize session log
    this.sessionLog = {
      sessionId: `session-${Date.now()}`,
      startTime: Date.now(),
      config: {
        parallelGames: this.parallelCount,
        chipsPerPlayer: this.chips,
        provider: this.provider?.constructor?.name || 'unknown'
      },
      games: []
    };

    // Pre-create game entries
    for (let i = 0; i < this.parallelCount; i++) {
      this.sessionLog.games.push({
        slot: i,
        startTime: null,
        events: [],
        endTime: null,
        winner: null,
        turns: 0
      });
    }

    this.setupGrid();
    this.updateStatus('Running...');
    this.updateProgress();

    // Create and start all mini games
    for (let i = 0; i < this.parallelCount; i++) {
      const miniGame = new MiniGame(i, {
        chips: this.chips,
        provider: this.provider
      }, this.onGameComplete.bind(this), this.sessionLog);

      this.slots.push(miniGame);
      this.gridElement.appendChild(miniGame.element);
    }

    // Start all games (they run independently)
    for (const miniGame of this.slots) {
      miniGame.start();
    }
  }

  /**
   * Handle a game completing
   */
  onGameComplete(slot, log) {
    this.logs.push(log);
    this.completedCount++;

    this.updateProgress();

    if (this.completedCount >= this.parallelCount) {
      this.finish();
    }
  }

  /**
   * All games finished
   */
  finish() {
    this.isRunning = false;
    this.updateStatus('Complete!');

    // Finalize and auto-download session log
    if (this.sessionLog) {
      this.sessionLog.endTime = Date.now();
      this.downloadSessionLog();

      // Save to Supabase for analysis
      const stats = this.getStats();
      saveGameSession({
        session_id: this.sessionLog.sessionId,
        mode: 'simulation',
        config: this.sessionLog.config,
        games: this.sessionLog.games,
        duration_ms: this.sessionLog.endTime - this.sessionLog.startTime,
        total_turns: stats?.avgTurns * stats?.gameCount || 0,
        winner: null // Multiple games - no single winner
      });
    }

    if (this.onAllComplete) {
      this.onAllComplete(this.getStats());
    }
  }

  /**
   * Download session log as JSON file
   */
  downloadSessionLog() {
    if (!this.sessionLog) return;

    const blob = new Blob([JSON.stringify(this.sessionLog, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `sls-${this.sessionLog.sessionId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log('📥 Session log downloaded:', this.sessionLog.sessionId);
  }

  /**
   * Stop all games
   */
  stop() {
    this.isRunning = false;
    for (const miniGame of this.slots) {
      miniGame.stop();
    }
    this.updateStatus('Stopped');
  }

  /**
   * Restart with fresh games
   */
  restart() {
    this.stop();
    setTimeout(() => this.start(), 100);
  }

  /**
   * Update status display
   */
  updateStatus(status) {
    if (this.statusElement) {
      this.statusElement.textContent = status;
    }
  }

  /**
   * Update progress display
   */
  updateProgress() {
    if (this.progressElement) {
      this.progressElement.textContent = `${this.completedCount} / ${this.parallelCount} games complete`;
    }
  }

  /**
   * Get aggregate statistics
   */
  getStats() {
    if (this.logs.length === 0) return null;

    const wins = { red: 0, blue: 0, green: 0, yellow: 0 };
    let totalTurns = 0;
    let totalDuration = 0;

    for (const log of this.logs) {
      if (log.result) {
        wins[log.result.winner]++;
        totalTurns += log.result.turns;
        totalDuration += log.result.duration;
      }
    }

    const gameCount = this.logs.length;
    return {
      gameCount,
      wins,
      winRates: {
        red: (wins.red / gameCount * 100).toFixed(1),
        blue: (wins.blue / gameCount * 100).toFixed(1),
        green: (wins.green / gameCount * 100).toFixed(1),
        yellow: (wins.yellow / gameCount * 100).toFixed(1)
      },
      avgTurns: Math.round(totalTurns / gameCount),
      avgDuration: Math.round(totalDuration / gameCount / 1000),
      logs: this.logs
    };
  }

  /**
   * Export all logs as JSON
   */
  exportLogs() {
    const data = {
      exportDate: new Date().toISOString(),
      config: {
        parallelGames: this.parallelCount,
        chipsPerPlayer: this.chips
      },
      stats: this.getStats(),
      games: this.logs
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `sls-simulation-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log('Simulation logs exported');
  }

  /**
   * Render stats panel
   */
  renderStats(container) {
    const stats = this.getStats();
    if (!stats) {
      container.innerHTML = '<p>No data yet</p>';
      return;
    }

    container.innerHTML = `
      <div class="stat-card">
        <h5>Win Rates</h5>
        ${COLORS.map(color => `
          <div class="win-rate-bar">
            <span class="color-label">${color}</span>
            <div class="bar-container">
              <div class="bar ${color}" style="width: ${stats.winRates[color]}%"></div>
            </div>
            <span class="percent">${stats.winRates[color]}%</span>
          </div>
        `).join('')}
      </div>
      <div class="stat-card">
        <h5>Average Game Length</h5>
        <div class="stat-value">${stats.avgTurns}</div>
        <div class="stat-detail">turns per game</div>
      </div>
      <div class="stat-card">
        <h5>Average Duration</h5>
        <div class="stat-value">${stats.avgDuration}s</div>
        <div class="stat-detail">seconds per game</div>
      </div>
      <div class="stat-card">
        <h5>Games Played</h5>
        <div class="stat-value">${stats.gameCount}</div>
        <div class="stat-detail">total games</div>
      </div>
    `;
  }
}
