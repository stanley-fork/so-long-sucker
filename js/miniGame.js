// Mini Game Component for Simulation Mode
// Compact, auto-playing game view with expand functionality

import { Game } from './game.js';
import { COLORS } from './player.js';

export class MiniGame {
  constructor(slot, config, onComplete, sessionLog = null) {
    this.slot = slot;
    this.config = config;
    this.onComplete = onComplete;
    this.sessionLog = sessionLog;  // Reference to parent session log

    this.game = new Game(config.chips);
    this.provider = config.provider;
    this.agents = [];
    this.isRunning = false;
    this.isFinished = false;
    this.turnCount = 0;
    this.startTime = null;
    this.lastAction = '';
    this.chatMessages = [];  // Track chat history
    this.lastThought = null;  // Track last AI thought
    this.isExpanded = false;
    this.expandedElement = null;
    this.log = this.createLogger();

    this.element = this.createElement();
  }

  createLogger() {
    return {
      gameId: `game-${this.slot}-${Date.now()}`,
      config: { chips: this.config.chips },
      startTime: null,
      endTime: null,
      events: [],
      result: null
    };
  }

  logEvent(event) {
    this.log.events.push({
      turn: this.turnCount,
      timestamp: Date.now(),
      ...event
    });
  }

  /**
   * Record event to session log (for analysis later)
   */
  recordToSession(action, player, data) {
    if (!this.sessionLog) return;

    const gameEntry = this.sessionLog.games[this.slot];
    if (!gameEntry) return;

    gameEntry.events.push({
      t: Date.now(),
      turn: this.turnCount,
      action,
      player,
      data
    });
  }

  createElement() {
    const div = document.createElement('div');
    div.className = 'mini-game';
    div.id = `mini-game-${this.slot}`;
    div.innerHTML = this.renderPlaying();
    this.bindEvents(div);
    return div;
  }

  bindEvents(element) {
    // Expand button click
    element.addEventListener('click', (e) => {
      if (e.target.classList.contains('expand-btn')) {
        this.expand();
      }
    });
  }

  renderPlaying() {
    const state = this.game.getState();
    return `
      <div class="mini-game-header">
        <span class="mini-game-title">Game ${this.slot + 1}</span>
        <span class="mini-game-turn">Turn ${this.turnCount}</span>
        <button class="expand-btn" title="Expand view">↗</button>
      </div>
      <div class="mini-players-detailed">
        ${this.renderPlayersDetailed(state)}
      </div>
      <div class="mini-piles-visual">
        ${this.renderPilesVisual(state)}
      </div>
      <div class="mini-chat">
        <div class="mini-chat-label">Chat</div>
        <div class="mini-chat-messages">
          ${this.renderChatMini()}
        </div>
      </div>
      ${this.lastThought ? `
        <div class="mini-thinking">
          <span class="think-icon">💭</span>
          <span class="think-player ${this.lastThought.color}">${this.lastThought.color.substring(0, 3).toUpperCase()}:</span>
          <span class="think-text">${this.truncate(this.lastThought.text, 35)}</span>
        </div>
      ` : ''}
      <div class="mini-action">${this.lastAction || 'Starting...'}</div>
    `;
  }

  renderPlayersDetailed(state) {
    return state.players.map((p, i) => {
      const isCurrent = i === state.currentPlayer;
      const isEliminated = !p.isAlive;
      let classes = 'mini-player-detail';
      if (isCurrent) classes += ' current';
      if (isEliminated) classes += ' eliminated';

      return `
        <div class="${classes}">
          <div class="mini-player-color ${p.color}"></div>
          <div class="mini-player-info">
            <span class="mini-player-supply">${p.supply}</span>
            ${p.prisoners.length > 0 ? `<span class="mini-player-prisoners">+${p.prisoners.length}</span>` : ''}
          </div>
          ${isEliminated ? '<span class="mini-player-status">✗</span>' : ''}
          ${isCurrent && !isEliminated ? '<span class="mini-player-status">▶</span>' : ''}
        </div>
      `;
    }).join('');
  }

  renderPilesVisual(state) {
    if (state.piles.length === 0) {
      return '<span class="mini-no-piles">No piles</span>';
    }

    return state.piles.map((pile, idx) => `
      <div class="mini-pile-visual">
        <span class="mini-pile-label">P${idx}:</span>
        <div class="mini-pile-chips">
          ${pile.chips.map(c => `<div class="mini-pile-chip ${c}"></div>`).join('')}
        </div>
      </div>
    `).join('');
  }

  renderChatMini() {
    if (this.chatMessages.length === 0) {
      return '<span class="mini-no-chat">No messages</span>';
    }

    // Show ALL messages (container is scrollable)
    return this.chatMessages.map(msg => `
      <div class="mini-chat-msg ${msg.color}">
        <span class="mini-chat-sender">${msg.color.substring(0, 3).toUpperCase()}:</span>
        <span class="mini-chat-text">${msg.text}</span>
      </div>
    `).join('');
  }

  truncate(text, maxLen) {
    if (text.length <= maxLen) return text;
    return text.substring(0, maxLen - 3) + '...';
  }

  renderComplete() {
    const winner = COLORS[this.game.winner];
    const duration = Math.round((this.log.endTime - this.log.startTime) / 1000);
    return `
      <div class="mini-game-result">
        <div class="winner-icon">&#9813;</div>
        <h4>${winner.toUpperCase()} Wins!</h4>
        <div class="stats">
          ${this.turnCount} turns &bull; ${duration}s
        </div>
        <button class="btn btn-outline view-log-btn" data-slot="${this.slot}">View Log</button>
        <button class="expand-btn expand-btn-result" title="View game detail">↗</button>
      </div>
    `;
  }

  render() {
    if (this.isFinished) {
      this.element.innerHTML = this.renderComplete();
      this.element.classList.add('complete');
    } else {
      this.element.innerHTML = this.renderPlaying();
    }
    this.bindEvents(this.element);

    // Auto-scroll chat to bottom
    const chatContainer = this.element.querySelector('.mini-chat-messages');
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    // Also update expanded view if open
    if (this.isExpanded && this.expandedElement) {
      this.updateExpandedView();
    }
  }

  // ==========================================
  // EXPANDED VIEW
  // ==========================================

  expand() {
    if (this.isExpanded) return;
    this.isExpanded = true;
    this.expandedElement = this.createExpandedView();
    document.body.appendChild(this.expandedElement);
  }

  collapse() {
    if (!this.isExpanded) return;
    this.isExpanded = false;
    if (this.expandedElement) {
      this.expandedElement.remove();
      this.expandedElement = null;
    }
  }

  createExpandedView() {
    const overlay = document.createElement('div');
    overlay.className = 'expanded-game-overlay';
    overlay.innerHTML = this.renderExpandedContent();

    // Bind close button
    overlay.querySelector('.expanded-close-btn').addEventListener('click', () => {
      this.collapse();
    });

    // Click outside to close
    overlay.querySelector('.expanded-backdrop').addEventListener('click', () => {
      this.collapse();
    });

    return overlay;
  }

  renderExpandedContent() {
    const state = this.game.getState();
    const currentPlayer = state.players[state.currentPlayer];

    return `
      <div class="expanded-backdrop"></div>
      <div class="expanded-game-content">
        <div class="expanded-header">
          <h2>Game ${this.slot + 1} ${this.isFinished ? '(Finished)' : ''}</h2>
          <div class="expanded-status">
            ${this.isFinished
              ? `Winner: <span class="color-${COLORS[this.game.winner]}">${COLORS[this.game.winner].toUpperCase()}</span>`
              : `<span class="color-${currentPlayer.color}">${currentPlayer.color.toUpperCase()}</span>'s Turn`
            }
            &nbsp;|&nbsp; Turn ${this.turnCount}
          </div>
          <button class="expanded-close-btn">← Back to Grid</button>
        </div>

        <div class="expanded-body">
          <div class="expanded-left">
            <div class="expanded-players">
              <h3>Players</h3>
              ${this.renderExpandedPlayers(state)}
            </div>
            <div class="expanded-piles">
              <h3>Piles</h3>
              ${this.renderExpandedPiles(state)}
            </div>
            <div class="expanded-deadbox">
              <h3>Dead Box</h3>
              <div class="expanded-dead-chips">
                ${state.deadBox.length === 0 ? '<span class="empty">Empty</span>' :
                  state.deadBox.map(c => `<div class="chip-small ${c}"></div>`).join('')
                }
              </div>
            </div>
          </div>

          <div class="expanded-right">
            <div class="expanded-chat">
              <h3>Chat History</h3>
              <div class="expanded-chat-messages">
                ${this.renderExpandedChat()}
              </div>
            </div>
          </div>
        </div>

        <div class="expanded-footer">
          <span>Last action: ${this.lastAction || 'None'}</span>
        </div>
      </div>
    `;
  }

  renderExpandedPlayers(state) {
    return state.players.map((p, i) => {
      const isCurrent = i === state.currentPlayer;
      const isEliminated = !p.isAlive;

      return `
        <div class="expanded-player ${isCurrent ? 'current' : ''} ${isEliminated ? 'eliminated' : ''}">
          <div class="expanded-player-header">
            <div class="expanded-player-indicator ${p.color}"></div>
            <span class="expanded-player-name">${p.color.toUpperCase()}</span>
            ${isCurrent && !isEliminated ? '<span class="expanded-player-badge">PLAYING</span>' : ''}
            ${isEliminated ? '<span class="expanded-player-badge eliminated">ELIMINATED</span>' : ''}
          </div>
          <div class="expanded-player-chips">
            <div class="expanded-chip-row">
              <span class="label">Supply:</span>
              <span class="chips">
                ${p.supply > 0
                  ? Array(p.supply).fill(`<div class="chip-small ${p.color}"></div>`).join('')
                  : '<span class="empty">-</span>'
                }
              </span>
            </div>
            <div class="expanded-chip-row">
              <span class="label">Prisoners:</span>
              <span class="chips">
                ${p.prisoners.length > 0
                  ? p.prisoners.map(c => `<div class="chip-small ${c}"></div>`).join('')
                  : '<span class="empty">-</span>'
                }
              </span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  renderExpandedPiles(state) {
    if (state.piles.length === 0) {
      return '<span class="empty">No piles in play</span>';
    }

    return state.piles.map((pile, idx) => `
      <div class="expanded-pile">
        <span class="expanded-pile-label">Pile ${idx}</span>
        <div class="expanded-pile-stack">
          ${pile.chips.map(c => `<div class="chip ${c}"></div>`).join('')}
        </div>
      </div>
    `).join('');
  }

  renderExpandedChat() {
    if (this.chatMessages.length === 0) {
      return '<span class="empty">No messages yet</span>';
    }

    return this.chatMessages.map(msg => `
      <div class="expanded-chat-msg ${msg.color}">
        <span class="sender">${msg.color.toUpperCase()}:</span>
        <span class="text">${this.escapeHtml(msg.text)}</span>
      </div>
    `).join('');
  }

  updateExpandedView() {
    if (!this.expandedElement) return;
    const content = this.expandedElement.querySelector('.expanded-game-content');
    if (content) {
      // Update just the body content, keeping header
      const body = content.querySelector('.expanded-body');
      const footer = content.querySelector('.expanded-footer');
      const state = this.game.getState();

      if (body) {
        body.innerHTML = `
          <div class="expanded-left">
            <div class="expanded-players">
              <h3>Players</h3>
              ${this.renderExpandedPlayers(state)}
            </div>
            <div class="expanded-piles">
              <h3>Piles</h3>
              ${this.renderExpandedPiles(state)}
            </div>
            <div class="expanded-deadbox">
              <h3>Dead Box</h3>
              <div class="expanded-dead-chips">
                ${state.deadBox.length === 0 ? '<span class="empty">Empty</span>' :
                  state.deadBox.map(c => `<div class="chip-small ${c}"></div>`).join('')
                }
              </div>
            </div>
          </div>

          <div class="expanded-right">
            <div class="expanded-chat">
              <h3>Chat History</h3>
              <div class="expanded-chat-messages">
                ${this.renderExpandedChat()}
              </div>
            </div>
          </div>
        `;
      }

      if (footer) {
        footer.innerHTML = `<span>Last action: ${this.lastAction || 'None'}</span>`;
      }

      // Update header status
      const status = content.querySelector('.expanded-status');
      if (status) {
        const currentPlayer = state.players[state.currentPlayer];
        status.innerHTML = this.isFinished
          ? `Winner: <span class="color-${COLORS[this.game.winner]}">${COLORS[this.game.winner].toUpperCase()}</span>`
          : `<span class="color-${currentPlayer.color}">${currentPlayer.color.toUpperCase()}</span>'s Turn`;
        status.innerHTML += ` &nbsp;|&nbsp; Turn ${this.turnCount}`;
      }

      // Auto-scroll chat
      const chatContainer = content.querySelector('.expanded-chat-messages');
      if (chatContainer) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ==========================================
  // GAME LOGIC
  // ==========================================

  async start() {
    if (this.isRunning) return;

    this.isRunning = true;
    this.startTime = Date.now();
    this.log.startTime = this.startTime;

    // Record start time in session log
    if (this.sessionLog && this.sessionLog.games[this.slot]) {
      this.sessionLog.games[this.slot].startTime = this.startTime;
    }

    // Create AI agents for all 4 players
    const { AIAgent } = await import('./ai/agent.js');
    for (let i = 0; i < 4; i++) {
      const agent = new AIAgent(i, this.provider, this.game, this.handleAction.bind(this));
      this.agents.push(agent);
    }

    // Start the game loop
    this.gameLoop();
  }

  stop() {
    this.isRunning = false;
  }

  async gameLoop() {
    while (this.isRunning && this.game.phase !== 'gameOver') {
      const state = this.game.getState();
      const currentAgent = this.agents[state.currentPlayer];

      // Check if current player is alive
      if (!state.players[state.currentPlayer].isAlive) {
        continue;
      }

      try {
        const actions = await currentAgent.decide(state);
        if (actions && actions.length > 0) {
          currentAgent.executeAll(actions);
        }
      } catch (error) {
        console.error(`MiniGame ${this.slot} error:`, error);
      }

      // Small delay to prevent overwhelming the API
      await this.delay(500);
    }

    // Game finished
    if (this.game.phase === 'gameOver') {
      this.finish();
    }
  }

  handleAction(action, data) {
    try {
      let result;
      const state = this.game.getState();
      const playerColor = COLORS[state.currentPlayer];

      switch (action) {
        case 'selectChip':
          this.game.selectChip(data);
          this.lastAction = `${playerColor} selected ${data}`;
          this.logEvent({ player: playerColor, action: 'selectChip', chip: data });
          this.recordToSession('selectChip', playerColor, { chip: data });
          break;

        case 'playOnPile':
          result = this.game.playOnPile(data);
          this.turnCount++;
          this.lastAction = `${playerColor} played on pile ${data === null ? '(new)' : data}`;
          this.logEvent({ player: playerColor, action: 'playOnPile', pile: data });
          this.recordToSession('playOnPile', playerColor, { pile: data, capture: result?.action === 'capture' });
          this.handleResult(result);
          break;

        case 'chooseNextPlayer':
          result = this.game.chooseNextPlayer(data);
          this.lastAction = `${playerColor} chose ${COLORS[data]} next`;
          this.logEvent({ player: playerColor, action: 'chooseNext', nextPlayer: COLORS[data] });
          this.recordToSession('chooseNext', playerColor, { nextPlayer: COLORS[data] });
          break;

        case 'resolveCapture':
          result = this.game.resolveCapture(data);
          this.lastAction = `${playerColor} killed ${data}`;
          this.logEvent({ player: playerColor, action: 'capture', killed: data });
          this.recordToSession('capture', playerColor, { killed: data, captured: result?.captured });
          break;

        case 'donate':
          result = this.game.handleDonation(data.donor, data.accepts, data.color);
          if (data.accepts) {
            this.lastAction = `${COLORS[data.donor]} donated ${data.color}`;
            this.logEvent({ player: COLORS[data.donor], action: 'donate', color: data.color });
            this.recordToSession('donate', COLORS[data.donor], { color: data.color });
          } else {
            this.lastAction = `${COLORS[data.donor]} refused donation`;
            this.logEvent({ player: COLORS[data.donor], action: 'refuseDonate' });
            this.recordToSession('refuseDonate', COLORS[data.donor], {});
          }
          this.handleResult(result);
          break;

        case 'chat':
          // Track chat message (use passed color since currentPlayer may have changed)
          const chatColor = data.color || playerColor;
          this.chatMessages.push({
            color: chatColor,
            text: data.text
          });
          this.logEvent({ player: chatColor, action: 'chat', message: data.text });
          this.recordToSession('chat', chatColor, { message: data.text });
          break;

        case 'think':
          // Track thoughts for display (use passed color)
          const thinkColor = data.color || playerColor;
          this.lastThought = { color: thinkColor, text: data.thought };
          this.logEvent({ player: thinkColor, action: 'think', thought: data.thought });
          this.recordToSession('think', thinkColor, { thought: data.thought });
          break;
      }

      this.render();
    } catch (error) {
      console.error(`MiniGame ${this.slot} action error:`, error);
    }
  }

  handleResult(result) {
    if (!result) return;

    switch (result.action) {
      case 'eliminated':
        this.lastAction = `${COLORS[result.player]} eliminated!`;
        this.logEvent({ action: 'elimination', player: COLORS[result.player] });
        this.recordToSession('elimination', COLORS[result.player], {});
        break;

      case 'gameOver':
        this.finish();
        break;
    }
  }

  finish() {
    this.isRunning = false;
    this.isFinished = true;
    this.log.endTime = Date.now();
    this.log.result = {
      winner: COLORS[this.game.winner],
      turns: this.turnCount,
      duration: this.log.endTime - this.log.startTime
    };

    // Update session log with final results
    if (this.sessionLog && this.sessionLog.games[this.slot]) {
      const gameEntry = this.sessionLog.games[this.slot];
      gameEntry.endTime = this.log.endTime;
      gameEntry.winner = COLORS[this.game.winner];
      gameEntry.turns = this.turnCount;
    }

    this.render();

    if (this.onComplete) {
      this.onComplete(this.slot, this.log);
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getLog() {
    return this.log;
  }
}
