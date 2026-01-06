// Simulator TUI - Terminal User Interface for mass simulation
// Displays game progress and allows focusing on individual games

import { HeadlessGame } from './HeadlessGame.js';
import { createProvider } from './providers.js';
import { colorize, colorChip, formatDuration, truncate, clearScreen, hideCursor, showCursor, enterAltScreen, exitAltScreen } from './utils.js';
import * as readline from 'readline';
import * as fs from 'fs';

const COLORS = ['red', 'blue', 'green', 'yellow'];

export class SimulatorTUI {
  constructor(config) {
    this.totalGames = config.totalGames;
    this.parallel = Math.min(config.parallel, config.totalGames);
    this.providerType = config.provider;
    this.providerTypes = config.providers || null; // Array of 4 provider types for mixed-model
    this.chips = config.chips;
    this.outputDir = config.outputDir;
    this.delay = config.delay;
    this.headless = config.headless;

    this.provider = null;
    this.providers = null; // Array of 4 provider instances for mixed-model
    this.games = [];        // All game instances
    this.activeGames = [];  // Currently running
    this.completedGames = [];
    this.queue = [];        // Games waiting to run
    this.isRunning = false;
    this.isPaused = false;
    this.focusedGame = null; // Game slot being viewed in detail

    this.startTime = null;

    // Terminal interface
    this.rl = null;
    this.logs = []; // Capture logs instead of printing to console
    this.maxLogs = 5;
  }

  async start() {
    // Initialize provider(s)
    if (this.providerTypes && this.providerTypes.length === 4) {
      // Mixed-model mode: create 4 separate provider instances
      this.providers = this.providerTypes.map(type => createProvider(type));
      this.provider = this.providers[0]; // For backward compatibility in stats display
    } else {
      // Single provider mode (legacy)
      this.provider = createProvider(this.providerType);
    }
    this.startTime = Date.now();
    this.isRunning = true;

    // Ensure output directory exists
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    // Capture console output to prevent it from breaking the TUI
    if (!this.headless) {
      this.captureConsole();
    }

    // Initialize all games
    for (let i = 0; i < this.totalGames; i++) {
      const gameConfig = {
        chips: this.chips,
        delay: this.delay
      };
      
      // Pass either array of providers or single provider
      if (this.providers) {
        gameConfig.providers = this.providers;
      } else {
        gameConfig.provider = this.provider;
      }
      
      const game = new HeadlessGame(i, gameConfig);

      // Set up event listeners
      game.on('start', () => this.onGameStart(i));
      game.on('complete', (result) => this.onGameComplete(i, result));
      game.on('turn', (data) => this.onGameTurn(i, data));
      game.on('chat', (data) => this.onGameChat(i, data));
      game.on('think', (data) => this.onGameThink(i, data));

      this.games.push(game);
      this.queue.push(game);
    }

    // Set up keyboard input and enter alternate screen
    if (!this.headless) {
      enterAltScreen();
      this.setupKeyboard();
    }

    // Start initial batch
    this.startNextBatch();

    // Render loop
    if (!this.headless) {
      this.renderLoop();
    }

    // Wait for all games to complete
    return new Promise((resolve) => {
      const checkComplete = setInterval(() => {
        if (this.completedGames.length >= this.totalGames) {
          clearInterval(checkComplete);
          this.finish();
          resolve({ gameCount: this.completedGames.length });
        }
      }, 500);
    });
  }

  captureConsole() {
    // Store original console methods
    this.originalConsole = {
      log: console.log,
      error: console.error,
      warn: console.warn
    };

    // Replace with capture functions
    const capture = (type) => (...args) => {
      const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
      this.logs.push({ type, msg, time: Date.now() });
      if (this.logs.length > this.maxLogs) {
        this.logs.shift();
      }
    };

    console.log = capture('log');
    console.error = capture('error');
    console.warn = capture('warn');
  }

  restoreConsole() {
    if (this.originalConsole) {
      console.log = this.originalConsole.log;
      console.error = this.originalConsole.error;
      console.warn = this.originalConsole.warn;
    }
  }

  setupKeyboard() {
    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }

    process.stdin.on('keypress', (str, key) => {
      if (key.ctrl && key.name === 'c') {
        this.gracefulShutdown();
        return;
      }

      if (this.focusedGame !== null) {
        // In focus mode
        if (key.name === 'escape' || key.name === 'backspace') {
          this.focusedGame = null;
        }
      } else {
        // In overview mode
        const num = parseInt(str);
        if (!isNaN(num) && num >= 1 && num <= Math.min(9, this.parallel)) {
          const gameIdx = num - 1;
          if (this.activeGames[gameIdx]) {
            this.focusedGame = this.activeGames[gameIdx].slot;
          }
        }

        switch (key.name) {
          case 'q':
            this.gracefulShutdown();
            break;
          case 's':
            this.saveAndExit();
            break;
          case 'p':
            this.isPaused = true;
            break;
          case 'r':
            this.isPaused = false;
            break;
        }
      }
    });

    process.stdin.resume();
  }

  startNextBatch() {
    while (this.activeGames.length < this.parallel && this.queue.length > 0 && !this.isPaused) {
      const game = this.queue.shift();
      this.activeGames.push(game);
      game.start();
    }
  }

  onGameStart(slot) {
    // Game started
  }

  onGameComplete(slot, result) {
    // Remove from active
    this.activeGames = this.activeGames.filter(g => g.slot !== slot);
    this.completedGames.push(result);

    // If focused on this game, unfocus
    if (this.focusedGame === slot) {
      this.focusedGame = null;
    }

    // Start next game
    this.startNextBatch();
  }

  onGameTurn(slot, data) {
    // Turn completed
  }

  onGameChat(slot, data) {
    // Chat message
  }

  onGameThink(slot, data) {
    // Thought recorded
  }

  renderLoop() {
    const render = () => {
      if (!this.isRunning) return;

      if (this.focusedGame !== null) {
        this.renderFocusView();
      } else {
        this.renderOverview();
      }

      setTimeout(render, 200);
    };
    render();
  }

  renderOverview() {
    // Move cursor to top-left and clear screen
    process.stdout.write('\x1b[H\x1b[J');

    const elapsed = formatDuration(Date.now() - this.startTime);
    const completed = this.completedGames.length;
    const providerDisplay = this.providerTypes 
      ? `${colorize('MIXED', 'magenta')} (${this.providerTypes.join(', ')})` 
      : colorize(this.providerType, 'yellow');

    let output = `
${colorize('╔═══════════════════════════════════════════════════════════════════╗', 'cyan')}
${colorize('║', 'cyan')}  🎮 ${colorize('So Long Sucker - Mass Simulation', 'bold')}                           ${colorize('║', 'cyan')}
${colorize('╚═══════════════════════════════════════════════════════════════════╝', 'cyan')}

  Provider: ${providerDisplay} | Games: ${colorize(`${completed}/${this.totalGames}`, 'green')} | Time: ${elapsed}
  ${this.isPaused ? colorize('⏸  PAUSED', 'yellow') : colorize('▶  Running', 'green')}

${colorize('─────────────────────────────────────────────────────────────────────', 'gray')}
`;

    // Active games
    for (let i = 0; i < this.parallel; i++) {
      const game = this.activeGames[i];
      if (game) {
        const state = game.getState();
        const currentColor = COLORS[state.currentPlayer];
        const chatHistory = game.getChatHistory?.() || [];
        const lastChat = chatHistory[chatHistory.length - 1];

        let statusLine = `  [${colorize(String(i + 1), 'cyan')}] Game ${game.slot + 1}`.padEnd(25);
        statusLine += `Turn ${String(game.turnCount).padStart(3)} `;
        statusLine += colorize(`${currentColor.substring(0, 3).toUpperCase()}▶`, currentColor);
        statusLine += ` ${state.phase.padEnd(15)}`;

        if (lastChat) {
          statusLine += ` 💬 "${truncate(lastChat.message, 25)}"`;
        }

        output += statusLine + '\n';
      } else if (this.queue.length > 0) {
        output += `  [${colorize(String(i + 1), 'gray')}] ${colorize('⏳ Queued', 'gray')}\n`;
      } else {
        output += `  [${colorize(String(i + 1), 'gray')}] ${colorize('─', 'gray')}\n`;
      }
    }

    // Stats section - calculate from completed games
    if (completed > 0) {
      const wins = { red: 0, blue: 0, green: 0, yellow: 0 };
      let totalTurns = 0;
      for (const game of this.completedGames) {
        if (game.winner && wins[game.winner] !== undefined) wins[game.winner]++;
        totalTurns += game.turns || 0;
      }
      const winRates = {};
      for (const c of COLORS) winRates[c] = Math.round((wins[c] / completed) * 100);
      const avgTurns = Math.round(totalTurns / completed);

      output += `
${colorize('─────────────────────────────────────────────────────────────────────', 'gray')}
  ${colorize('📊 Win Rates:', 'bold')}
    ${colorize('●', 'red')} Red: ${winRates.red}%  ${colorize('●', 'blue')} Blue: ${winRates.blue}%  ${colorize('●', 'green')} Green: ${winRates.green}%  ${colorize('●', 'yellow')} Yellow: ${winRates.yellow}%

  Avg Turns: ${avgTurns}
`;
    }

    // Show recent logs/errors
    if (this.logs.length > 0) {
      output += `
${colorize('─────────────────────────────────────────────────────────────────────', 'gray')}
  ${colorize('Recent:', 'dim')}
`;
      for (const log of this.logs.slice(-3)) {
        const color = log.type === 'error' ? 'red' : 'gray';
        output += `  ${colorize(truncate(log.msg, 65), color)}\n`;
      }
    }

    output += `
${colorize('─────────────────────────────────────────────────────────────────────', 'gray')}
  ${colorize('[1-9]', 'cyan')} Focus game | ${colorize('[p]', 'cyan')} Pause | ${colorize('[r]', 'cyan')} Resume | ${colorize('[s]', 'cyan')} Save | ${colorize('[q]', 'cyan')} Quit
`;

    process.stdout.write(output);
  }

  renderFocusView() {
    // Move cursor to top-left and clear screen
    process.stdout.write('\x1b[H\x1b[J');

    const game = this.games[this.focusedGame];
    if (!game) {
      this.focusedGame = null;
      return;
    }

    const state = game.getState();
    const currentColor = COLORS[state.currentPlayer];

    let output = `
${colorize('╔═══════════════════════════════════════════════════════════════════╗', 'magenta')}
${colorize('║', 'magenta')}  🎮 Game ${game.slot + 1} - Turn ${game.turnCount} - ${colorize(currentColor.toUpperCase(), currentColor)}'s Turn               ${colorize('[ESC] Back', 'gray')} ${colorize('║', 'magenta')}
${colorize('╚═══════════════════════════════════════════════════════════════════╝', 'magenta')}

`;

    // Players section
    output += `  ${colorize('PLAYERS', 'bold')}\n`;
    for (const p of state.players) {
      const isCurrent = p.id === state.currentPlayer;
      const prefix = isCurrent ? colorize('▶ ', p.color) : '  ';
      const status = !p.isAlive ? colorize(' [ELIMINATED]', 'red') : '';

      const supplyChips = '●'.repeat(p.supply);
      const prisonerCount = p.prisoners.length > 0 ? ` +${p.prisoners.length}P` : '';

      output += `  ${prefix}${colorize(p.color.toUpperCase().padEnd(7), p.color)} ${colorize(supplyChips, p.color)}${prisonerCount}${status}\n`;
    }

    // Piles section
    output += `\n  ${colorize('PILES', 'bold')}\n`;
    if (state.piles.length === 0) {
      output += `  ${colorize('No piles yet', 'gray')}\n`;
    } else {
      for (const pile of state.piles) {
        const chips = pile.chips.map(c => colorize('●', c)).join(' ');
        output += `  P${pile.id}: [${chips}]\n`;
      }
    }

    // Dead box
    output += `\n  ${colorize('DEAD BOX', 'bold')}: `;
    if (state.deadBox.length === 0) {
      output += colorize('empty', 'gray');
    } else {
      output += state.deadBox.map(c => colorize('●', c)).join(' ');
    }

    // Chat section
    output += `\n\n  ${colorize('💬 CHAT', 'bold')}\n`;
    const chatHistory = game.getChatHistory?.() || [];
    const recentChats = chatHistory.slice(-8);
    if (recentChats.length === 0) {
      output += `  ${colorize('No messages yet', 'gray')}\n`;
    } else {
      for (const msg of recentChats) {
        output += `  ${colorize(msg.player.toUpperCase(), msg.player)}: ${truncate(msg.message, 55)}\n`;
      }
    }

    // Last action
    output += `\n  ${colorize('▶', 'green')} ${game.lastAction || 'Starting...'}\n`;

    output += `
${colorize('─────────────────────────────────────────────────────────────────────', 'gray')}
  ${colorize('[ESC]', 'cyan')} Back to overview
`;

    process.stdout.write(output);
  }

  async gracefulShutdown(skipSave = false) {
    // Stop all active games
    for (const game of this.activeGames) {
      game.stop();
    }

    this.isRunning = false;

    // Exit alternate screen and restore console before printing
    if (!this.headless) {
      exitAltScreen();
      this.restoreConsole();
    }

    console.log('\n⏳ Shutting down gracefully...');
    if (!skipSave) {
      await this.saveResults();
    }

    process.exit(0);
  }

  async saveAndExit() {
    // Pause games first so we get a clean snapshot
    this.isPaused = true;
    
    // Give a moment for any in-flight API calls to complete
    await new Promise(r => setTimeout(r, 500));
    
    // Save all data including active games
    await this.saveResults();
    
    // Shutdown without saving again
    this.gracefulShutdown(true);
  }

  async finish() {
    this.isRunning = false;
    await this.saveResults();

    // Exit alternate screen and restore console
    if (!this.headless) {
      exitAltScreen();
      this.restoreConsole();
    }

    // Calculate basic stats from completed games
    const gameCount = this.completedGames.length;
    const elapsed = formatDuration(Date.now() - this.startTime);

    // Count wins by color
    const wins = { red: 0, blue: 0, green: 0, yellow: 0 };
    let totalTurns = 0;
    let totalDuration = 0;

    for (const game of this.completedGames) {
      if (game.winner && wins[game.winner] !== undefined) {
        wins[game.winner]++;
      }
      totalTurns += game.turns || 0;
      totalDuration += game.duration || 0;
    }

    const winRates = {};
    for (const color of COLORS) {
      winRates[color] = gameCount > 0 ? Math.round((wins[color] / gameCount) * 100) : 0;
    }

    const avgTurns = gameCount > 0 ? Math.round(totalTurns / gameCount) : 0;
    const avgDuration = gameCount > 0 ? Math.round(totalDuration / gameCount / 1000) : 0;

    console.log(`
${colorize('╔═══════════════════════════════════════════════════════════════════╗', 'green')}
${colorize('║', 'green')}  ✅ ${colorize('Simulation Complete!', 'bold')}                                      ${colorize('║', 'green')}
${colorize('╚═══════════════════════════════════════════════════════════════════╝', 'green')}

  📊 ${colorize('Results:', 'bold')}
     Games Played: ${gameCount}
     Total Time:   ${elapsed}

  🏆 ${colorize('Win Rates:', 'bold')}
     ${colorize('●', 'red')} Red:    ${winRates.red}%
     ${colorize('●', 'blue')} Blue:   ${winRates.blue}%
     ${colorize('●', 'green')} Green:  ${winRates.green}%
     ${colorize('●', 'yellow')} Yellow: ${winRates.yellow}%

  📈 ${colorize('Averages:', 'bold')}
     Turns/Game:    ${avgTurns}
     Duration/Game: ${avgDuration}s

  💾 Data saved to: ${colorize(this.outputDir, 'cyan')}
`);
  }

  async saveResults() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${this.outputDir}/session-${timestamp}.json`;

    // Collect all snapshots from all games (both completed AND active)
    const allSnapshots = [];
    
    // Add snapshots from completed games
    for (const result of this.completedGames) {
      if (result.snapshots) {
        allSnapshots.push(...result.snapshots);
      }
    }
    
    // Also add snapshots from currently active games (important for mid-session saves!)
    for (const game of this.activeGames) {
      if (game.snapshots && game.snapshots.length > 0) {
        allSnapshots.push(...game.snapshots);
      }
    }
    
    // And from queued games that might have started but not finished
    for (const game of this.queue) {
      if (game.snapshots && game.snapshots.length > 0) {
        allSnapshots.push(...game.snapshots);
      }
    }

    // Simplified output format
    const data = {
      session: {
        id: `session-${Date.now()}`,
        provider: this.providerTypes ? 'mixed' : this.providerType,
        model: this.providerTypes 
          ? this.providers.map(p => p.getModelName?.() || p.model || 'unknown')
          : (this.provider?.getModelName?.() || this.provider?.model || 'unknown'),
        // For mixed-model games, store model per player color
        playerModels: this.providerTypes ? {
          red: this.providers[0]?.getModelName?.() || 'unknown',
          blue: this.providers[1]?.getModelName?.() || 'unknown',
          green: this.providers[2]?.getModelName?.() || 'unknown',
          yellow: this.providers[3]?.getModelName?.() || 'unknown'
        } : null,
        startTime: this.startTime,
        endTime: Date.now(),
        totalGames: this.totalGames,
        chips: this.chips,
        completedGames: this.completedGames.length,
        activeGames: this.activeGames.length
      },
      snapshots: allSnapshots
    };

    fs.writeFileSync(filename, JSON.stringify(data, null, 2));
    console.log(`\n💾 Saved ${allSnapshots.length} snapshots to: ${filename}`);
  }
}
