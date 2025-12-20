// Headless Game for CLI Simulation
// Self-contained game logic + AI agents without DOM dependencies

import EventEmitter from 'events';

const COLORS = ['red', 'blue', 'green', 'yellow'];

// ============================================
// PLAYER CLASS
// ============================================
class Player {
  constructor(id, color, startingChips) {
    this.id = id;
    this.color = color;
    this.supply = startingChips;
    this.prisoners = [];
    this.isAlive = true;
  }

  totalChips() { return this.supply + this.prisoners.length; }
  hasChips() { return this.totalChips() > 0; }

  getPlayableChips() {
    const chips = [];
    for (let i = 0; i < this.supply; i++) {
      chips.push({ color: this.color, source: 'supply' });
    }
    for (const color of this.prisoners) {
      chips.push({ color, source: 'prisoner' });
    }
    return chips;
  }

  playChip(color) {
    if (color === this.color && this.supply > 0) {
      this.supply--;
      return color;
    }
    const idx = this.prisoners.indexOf(color);
    if (idx !== -1) {
      this.prisoners.splice(idx, 1);
      return color;
    }
    throw new Error(`Player ${this.id} cannot play ${color}`);
  }

  receivePrisoners(chips) {
    for (const color of chips) {
      if (color === this.color) this.supply++;
      else this.prisoners.push(color);
    }
  }

  receiveDonation(color) {
    if (color === this.color) this.supply++;
    else this.prisoners.push(color);
  }

  donatePrisoner(color) {
    const idx = this.prisoners.indexOf(color);
    if (idx === -1) throw new Error(`No ${color} prisoner`);
    this.prisoners.splice(idx, 1);
    return color;
  }

  canDonate() { return this.prisoners.length > 0; }
  eliminate() { this.isAlive = false; }

  toState() {
    return {
      id: this.id,
      color: this.color,
      supply: this.supply,
      prisoners: [...this.prisoners],
      isAlive: this.isAlive,
      totalChips: this.totalChips()
    };
  }
}

// ============================================
// PILE CLASS
// ============================================
class Pile {
  constructor(id) {
    this.id = id;
    this.chips = [];
  }

  addChip(color) { this.chips.push(color); }
  topChip() { return this.chips[this.chips.length - 1] || null; }
  wouldCapture(color) { return this.topChip() === color; }

  getMissingColors() {
    const present = new Set(this.chips);
    return COLORS.filter(c => !present.has(c));
  }

  hasAllColors() { return this.getMissingColors().length === 0; }
  getDeepestColor() { return this.chips[0]; }

  resolveCapture(chipToKill) {
    const idx = this.chips.indexOf(chipToKill);
    if (idx === -1) throw new Error(`${chipToKill} not in pile`);
    const killed = this.chips.splice(idx, 1)[0];
    const captured = [...this.chips];
    this.chips = [];
    return { killed, captured };
  }

  size() { return this.chips.length; }
  isEmpty() { return this.chips.length === 0; }

  toState() {
    return {
      id: this.id,
      chips: [...this.chips],
      missingColors: this.getMissingColors()
    };
  }
}

// ============================================
// GAME CLASS
// ============================================
class Game {
  constructor(startingChips = 3) {
    this.startingChips = startingChips;
    this.reset();
  }

  reset() {
    this.players = COLORS.map((c, i) => new Player(i, c, this.startingChips));
    this.piles = [];
    this.deadBox = [];
    this.currentPlayer = Math.floor(Math.random() * 4);
    this.phase = 'selectChip';
    this.winner = null;
    this.pileIdCounter = 0;
    this.selectedChip = null;
    this.pendingCapture = null;
    this.donationRequester = null;
    this.donationAskedPlayers = [];
    this.messages = [];
  }

  getCurrentPlayer() { return this.players[this.currentPlayer]; }
  getPlayer(i) { return this.players[i]; }
  getAlivePlayers() { return this.players.filter(p => p.isAlive); }
  getPlayerByColor(color) { return this.players.find(p => p.color === color); }

  selectChip(color) {
    const player = this.getCurrentPlayer();
    const playable = player.getPlayableChips();
    if (!playable.some(c => c.color === color)) {
      throw new Error('Cannot play this chip');
    }
    this.selectedChip = color;
    this.phase = 'selectPile';
  }

  playOnPile(pileId) {
    if (this.phase !== 'selectPile' || !this.selectedChip) {
      throw new Error('Not in pile selection phase');
    }
    const player = this.getCurrentPlayer();
    const color = player.playChip(this.selectedChip);

    let pile;
    if (pileId === null) {
      pile = new Pile(this.pileIdCounter++);
      this.piles.push(pile);
    } else {
      pile = this.piles.find(p => p.id === pileId);
      if (!pile) throw new Error('Pile not found');
    }

    const willCapture = pile.wouldCapture(color);
    pile.addChip(color);
    this.selectedChip = null;

    if (willCapture) {
      this.pendingCapture = pile;
      this.phase = 'capture';
      return { action: 'capture', pile };
    }

    return this.determineNextPlayer(pile);
  }

  determineNextPlayer(pile) {
    const missing = pile.getMissingColors();

    if (missing.length === 0) {
      const next = this.getPlayerByColor(pile.getDeepestColor());
      return this.setNextPlayer(next.id);
    }

    if (missing.length === 1) {
      const next = this.getPlayerByColor(missing[0]);
      return this.setNextPlayer(next.id);
    }

    const valid = missing.filter(c => this.getPlayerByColor(c).isAlive);

    if (valid.length === 1) {
      return this.setNextPlayer(this.getPlayerByColor(valid[0]).id);
    }

    if (valid.length === 0) {
      for (const c of pile.chips) {
        const p = this.getPlayerByColor(c);
        if (p.isAlive) return this.setNextPlayer(p.id);
      }
    }

    this.phase = 'selectNextPlayer';
    return { action: 'chooseNext', options: valid };
  }

  chooseNextPlayer(playerIdx) {
    if (this.phase !== 'selectNextPlayer') {
      throw new Error('Not in next player selection phase');
    }
    return this.setNextPlayer(playerIdx);
  }

  setNextPlayer(playerIdx) {
    const next = this.players[playerIdx];
    if (!next.isAlive) {
      return this.setNextPlayer((playerIdx + 1) % 4);
    }
    this.currentPlayer = playerIdx;
    if (!next.hasChips()) {
      return this.startDonation();
    }
    this.phase = 'selectChip';
    return { action: 'nextTurn', player: playerIdx };
  }

  resolveCapture(colorToKill) {
    if (this.phase !== 'capture' || !this.pendingCapture) {
      throw new Error('Not in capture phase');
    }
    const pile = this.pendingCapture;
    const { killed, captured } = pile.resolveCapture(colorToKill);
    this.deadBox.push(killed);
    this.getCurrentPlayer().receivePrisoners(captured);
    this.piles = this.piles.filter(p => !p.isEmpty());
    this.pendingCapture = null;
    this.phase = 'selectChip';

    if (this.checkWinCondition()) {
      return { action: 'gameOver', winner: this.winner };
    }
    return { action: 'captured', killed, captured };
  }

  startDonation() {
    this.donationRequester = this.currentPlayer;
    this.donationAskedPlayers = [];
    this.phase = 'donation';
    return this.askNextDonation();
  }

  askNextDonation() {
    for (let i = 1; i <= 3; i++) {
      const idx = (this.donationRequester + i) % 4;
      if (this.players[idx].isAlive &&
          !this.donationAskedPlayers.includes(idx) &&
          this.players[idx].canDonate()) {
        return { action: 'askDonation', asker: this.donationRequester, donor: idx };
      }
    }
    return this.eliminatePlayer(this.donationRequester);
  }

  handleDonation(donorIdx, accepts, color = null) {
    if (this.phase !== 'donation') throw new Error('Not in donation phase');
    this.donationAskedPlayers.push(donorIdx);

    if (accepts && color) {
      const donor = this.players[donorIdx];
      const requester = this.players[this.donationRequester];
      donor.donatePrisoner(color);
      requester.receiveDonation(color);
      this.phase = 'selectChip';
      this.donationRequester = null;
      this.donationAskedPlayers = [];
      return { action: 'donationAccepted', donor: donorIdx, color };
    }

    return this.askNextDonation();
  }

  eliminatePlayer(playerIdx) {
    this.players[playerIdx].eliminate();
    this.donationRequester = null;
    this.donationAskedPlayers = [];

    if (this.checkWinCondition()) {
      return { action: 'gameOver', winner: this.winner };
    }

    const nextAlive = this.getAlivePlayers()[0];
    this.currentPlayer = nextAlive.id;

    if (!nextAlive.hasChips()) {
      return this.startDonation();
    }

    this.phase = 'selectChip';
    return { action: 'eliminated', player: playerIdx };
  }

  checkWinCondition() {
    const alive = this.getAlivePlayers();
    if (alive.length === 1) {
      this.winner = alive[0].id;
      this.phase = 'gameOver';
      return true;
    }
    return false;
  }

  addMessage(playerIdx, text) {
    if (!text?.trim()) return;
    this.messages.push({
      player: playerIdx,
      color: this.players[playerIdx].color,
      text: text.trim(),
      timestamp: Date.now()
    });
  }

  getState() {
    return {
      players: this.players.map(p => p.toState()),
      piles: this.piles.map(p => p.toState()),
      deadBox: [...this.deadBox],
      currentPlayer: this.currentPlayer,
      phase: this.phase,
      winner: this.winner,
      selectedChip: this.selectedChip,
      pendingCapture: this.pendingCapture?.toState() || null,
      donationRequester: this.donationRequester,
      messages: [...this.messages]
    };
  }
}

// ============================================
// AI TOOLS
// ============================================
const TOOLS = [
  {
    name: 'playChip',
    description: 'Select a chip to play.',
    parameters: {
      type: 'object',
      properties: {
        color: { type: 'string', enum: COLORS, description: 'Chip color to play' }
      },
      required: ['color']
    }
  },
  {
    name: 'selectPile',
    description: 'Choose pile to play on. Use "new" for new pile.',
    parameters: {
      type: 'object',
      properties: {
        pileId: { type: ['integer', 'string'], description: 'Pile ID or "new"' }
      },
      required: ['pileId']
    }
  },
  {
    name: 'chooseNextPlayer',
    description: 'Choose who plays next.',
    parameters: {
      type: 'object',
      properties: {
        playerId: { type: 'integer', description: '0=Red, 1=Blue, 2=Green, 3=Yellow' }
      },
      required: ['playerId']
    }
  },
  {
    name: 'killChip',
    description: 'Choose chip to kill during capture.',
    parameters: {
      type: 'object',
      properties: {
        color: { type: 'string', enum: COLORS, description: 'Chip to kill' }
      },
      required: ['color']
    }
  },
  {
    name: 'respondToDonation',
    description: 'Accept or refuse donation request.',
    parameters: {
      type: 'object',
      properties: {
        accept: { type: 'boolean', description: 'Whether to donate' },
        color: { type: 'string', enum: COLORS, description: 'Color to donate if accepting' }
      },
      required: ['accept']
    }
  },
  {
    name: 'sendChat',
    description: 'Send a chat message.',
    parameters: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Message to send' }
      },
      required: ['message']
    }
  },
  {
    name: 'think',
    description: 'Record internal reasoning (not visible to others).',
    parameters: {
      type: 'object',
      properties: {
        thought: { type: 'string', description: 'Your reasoning' }
      },
      required: ['thought']
    }
  },
  {
    name: 'wait',
    description: 'Do nothing this cycle.',
    parameters: { type: 'object', properties: {}, required: [] }
  }
];

function getToolsForPhase(phase, isMyTurn, pendingDonation) {
  const always = ['sendChat', 'think', 'wait'];
  if (pendingDonation) return [...always, 'respondToDonation'];
  if (!isMyTurn) return always;

  switch (phase) {
    case 'selectChip': return [...always, 'playChip'];
    case 'selectPile': return [...always, 'selectPile'];
    case 'selectNextPlayer': return [...always, 'chooseNextPlayer'];
    case 'capture': return [...always, 'killChip'];
    default: return always;
  }
}

function filterTools(names) {
  return TOOLS.filter(t => names.includes(t.name));
}

// ============================================
// AI AGENT
// ============================================
class AIAgent {
  constructor(playerId, provider) {
    this.playerId = playerId;
    this.color = COLORS[playerId];
    this.provider = provider;
    this.thoughts = [];
    this.consecutiveThinks = 0;
  }

  // Static template - use {PLAYER_COLOR} as placeholder
  static getSystemPromptTemplate() {
    return `You are {PLAYER_COLOR} in "So Long Sucker" - a negotiation game where TALKING wins games.

THE BRUTAL TRUTH:
- Only 1 of 4 players survives
- Silent players get targeted first (no allies = easy kill)
- Alliances are REQUIRED to survive early game
- Betrayal is REQUIRED to win late game

RULES:
- Play 1 chip per turn onto piles
- CAPTURE: If your chip matches color below, take the pile (kill 1 chip, rest become prisoners)
- You control who plays next (choose from colors missing in pile)
- No chips + no donations = eliminated

HOW TO WIN:
1. EARLY: Form alliances via chat ("{OTHER_COLOR}, let's target {TARGET_COLOR} together")
2. MID: Coordinate moves, honor deals, build trust
3. LATE: Betray at the right moment to be last standing

EVERY TURN you should:
- sendChat: Negotiate, threaten, react, or coordinate (THIS IS HOW YOU WIN)
- AND take your game action (playChip → selectPile)

You can call MULTIPLE tools at once. Example good turn:
- sendChat: "Blue, I kept my promise - your turn. Green is weak, let's finish them"
- playChip: {player_color}`;
  }

  buildSystemPrompt() {
    return AIAgent.getSystemPromptTemplate()
      .replace(/{PLAYER_COLOR}/g, this.color.toUpperCase())
      .replace(/{player_color}/g, this.color)
      .replace(/{OTHER_COLOR}/g, this.color === 'red' ? 'Blue' : 'Red')
      .replace(/{TARGET_COLOR}/g, this.color === 'green' ? 'Yellow' : 'Green');
  }

  buildUserPrompt(state) {
    const me = state.players[this.playerId];
    const isMyTurn = state.currentPlayer === this.playerId;

    let prompt = `GAME STATE:

YOUR STATUS (${this.color}):
- Supply: ${me.supply} chips
- Prisoners: ${me.prisoners.length > 0 ? me.prisoners.join(', ') : 'none'}

OTHERS:
${state.players.filter((p, i) => i !== this.playerId).map(p =>
  `- ${p.color}: ${p.isAlive ? `${p.supply} supply, ${p.prisoners.length} prisoners` : 'ELIMINATED'}`
).join('\n')}

PILES:
${state.piles.length === 0 ? '- None' : state.piles.map(p =>
  `- Pile ${p.id}: [${p.chips.join(' → ')}]`
).join('\n')}

DEAD BOX: ${state.deadBox.length > 0 ? state.deadBox.join(', ') : 'empty'}

PHASE: ${state.phase}
TURN: ${COLORS[state.currentPlayer]}${isMyTurn ? ' (YOU)' : ''}`;

    if (state.phase === 'selectChip' && isMyTurn) {
      const playable = me.supply > 0 ? [me.color] : [];
      playable.push(...me.prisoners);
      prompt += `\n\nYou must select a chip. Available: ${playable.join(', ')}`;
    } else if (state.phase === 'selectPile' && isMyTurn) {
      prompt += `\n\nChoose pile to play on (or "new").`;
      if (state.piles.length > 0) {
        prompt += ` IDs: ${state.piles.map(p => p.id).join(', ')}`;
      }
    } else if (state.phase === 'capture' && isMyTurn) {
      prompt += `\n\nYou captured! Choose chip to KILL: ${state.pendingCapture.chips.join(', ')}`;
    } else if (state.phase === 'selectNextPlayer' && isMyTurn) {
      prompt += `\n\nChoose who plays next from missing colors.`;
    }

    if (state.messages.length > 0) {
      prompt += `\n\nCHAT HISTORY (${state.messages.length} messages):\n${state.messages.map(m => `${m.color}: ${m.text}`).join('\n')}`;
      prompt += `\n\n💬 Consider responding to the chat or continuing negotiations!`;
    } else {
      prompt += `\n\n💬 No one has chatted yet. Start a negotiation or propose an alliance!`;
    }

    if (isMyTurn) {
      prompt += `\n\nIT'S YOUR TURN - Take action NOW! You can also chat while taking your turn.`;
    } else {
      prompt += `\n\nIt's ${COLORS[state.currentPlayer]}'s turn. Use sendChat to negotiate, react, or strategize!`;
    }

    return prompt;
  }

  async decide(state) {
    const isMyTurn = state.currentPlayer === this.playerId;
    const me = state.players[this.playerId];
    if (!me.isAlive) return { toolCalls: null, metadata: null };

    const pendingDonation = state.donationRequester !== null &&
                            state.phase === 'donation' &&
                            me.prisoners.length > 0;

    let toolNames = getToolsForPhase(state.phase, isMyTurn, pendingDonation);

    // Force action if stuck thinking
    if (this.consecutiveThinks >= 2 && isMyTurn) {
      toolNames = toolNames.filter(t => !['think', 'wait'].includes(t));
    }

    const tools = filterTools(toolNames);
    const userPrompt = this.buildUserPrompt(state);

    try {
      const result = await this.provider.call(
        this.buildSystemPrompt(),
        userPrompt,
        tools
      );

      return {
        toolCalls: result.toolCalls.length > 0 ? result.toolCalls : null,
        metadata: result.metadata || null,
        context: {
          userPrompt,
          availableTools: toolNames
        }
      };
    } catch (error) {
      console.error(`Agent ${this.color} error:`, error.message);
      return { toolCalls: null, metadata: null, error: error.message };
    }
  }

}

// ============================================
// HEADLESS GAME (MAIN EXPORT)
// ============================================
export class HeadlessGame extends EventEmitter {
  constructor(slot, config) {
    super();
    this.slot = slot;
    this.config = config;
    this.game = new Game(config.chips);
    this.provider = config.provider;
    this.agents = [];
    this.isRunning = false;
    this.isFinished = false;
    this.turnCount = 0;
    this.startTime = null;
    this.endTime = null;
    this.lastAction = '';

    // Simple snapshot-based data collection
    this.snapshots = [];
    this.eliminationOrder = [];

    // Track previous alive status for elimination detection
    this.lastAliveStatus = [true, true, true, true];
  }

  // Get current state for snapshot
  getStateSnapshot() {
    const state = this.game.getState();
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

  // Get chat history for snapshot
  getChatHistory() {
    return this.game.messages.map(m => ({
      player: COLORS[m.player],
      message: m.text
    }));
  }

  // Add a snapshot
  addSnapshot(snapshot) {
    this.snapshots.push({
      ...snapshot,
      timestamp: Date.now()
    });
  }

  // Check for eliminations and track them
  checkEliminations() {
    const state = this.game.getState();
    for (let i = 0; i < 4; i++) {
      if (this.lastAliveStatus[i] && !state.players[i].isAlive) {
        this.lastAliveStatus[i] = false;
        const remainingPlayers = state.players.filter(p => p.isAlive);
        this.eliminationOrder.push(COLORS[i]);
        this.emit('elimination', { player: COLORS[i], turn: this.turnCount });
      }
    }
  }

  async start() {
    if (this.isRunning) return;

    this.isRunning = true;
    this.startTime = Date.now();

    // Create AI agents
    for (let i = 0; i < 4; i++) {
      this.agents.push(new AIAgent(i, this.provider));
    }

    // Add game_start snapshot
    this.addSnapshot({
      type: 'game_start',
      game: this.slot,
      state: this.getStateSnapshot(),
      chatHistory: []
    });

    this.emit('start', { slot: this.slot });
    await this.gameLoop();
  }

  stop() {
    this.isRunning = false;
  }

  async gameLoop() {
    let stuckCount = 0;
    let lastPhase = null;
    let lastTurn = 0;

    while (this.isRunning && this.game.phase !== 'gameOver') {
      const state = this.game.getState();
      const current = state.currentPlayer;

      if (!state.players[current].isAlive) {
        continue;
      }

      // Detect stuck states
      if (state.phase === lastPhase && this.turnCount === lastTurn) {
        stuckCount++;
        if (stuckCount > 15) {
          console.error(`Game ${this.slot}: Stuck in phase ${state.phase}, attempting recovery`);
          stuckCount = 0;
          if (state.phase === 'donation') {
            this.handleDonationAuto(state);
          }
          await this.delay(1000);
          continue;
        }
      } else {
        stuckCount = 0;
        lastPhase = state.phase;
        lastTurn = this.turnCount;
      }

      // Handle donation phase specially
      if (state.phase === 'donation' && state.donationRequester !== null) {
        await this.handleDonationPhase(state);
        continue;
      }

      const agent = this.agents[current];

      // Capture state BEFORE LLM call
      const snapshotState = this.getStateSnapshot();
      const snapshotChat = this.getChatHistory();

      try {
        const result = await agent.decide(state);
        const actions = result.toolCalls;

        // Build snapshot with LLM request/response
        const snapshot = {
          type: 'decision',
          game: this.slot,
          turn: this.turnCount,
          player: COLORS[current],
          state: snapshotState,
          chatHistory: snapshotChat,
          llmRequest: result.context ? {
            userPrompt: result.context.userPrompt,
            availableTools: result.context.availableTools
          } : null,
          llmResponse: result.metadata ? {
            responseTime: result.metadata.responseTime,
            promptTokens: result.metadata.promptTokens,
            completionTokens: result.metadata.completionTokens,
            toolCalls: result.metadata.rawToolCalls || []
          } : null,
          execution: []
        };

        if (actions && actions.length > 0) {
          // Process actions smartly - game actions first, then chat/think
          const gameActions = actions.filter(a =>
            ['playChip', 'selectPile', 'chooseNextPlayer', 'killChip', 'respondToDonation'].includes(a.name)
          );
          const chatActions = actions.filter(a =>
            ['sendChat', 'think'].includes(a.name)
          );

          // Execute game actions (only the first valid one for current phase)
          for (const action of gameActions) {
            if (this.canExecuteAction(action.name, state.phase)) {
              const execResult = this.executeAction(action, current);
              snapshot.execution.push(execResult);
              break;
            } else {
              snapshot.execution.push({
                tool: action.name,
                args: action.arguments,
                success: false,
                error: `Not valid in phase ${state.phase}`
              });
            }
          }

          // Execute chat/think actions from current player
          for (const action of chatActions) {
            const execResult = this.executeAction(action, current);
            snapshot.execution.push(execResult);
          }
        }

        // Add the decision snapshot
        this.addSnapshot(snapshot);

      } catch (error) {
        console.error(`Game ${this.slot} error:`, error.message);
      }

      // Rate limiting
      await this.delay(this.config.delay || 500);
    }

    if (this.game.phase === 'gameOver') {
      this.finish();
    }
  }

  async handleDonationPhase(state) {
    // Find potential donors (players who can donate)
    for (let i = 0; i < 4; i++) {
      if (i === state.donationRequester) continue;
      const player = state.players[i];
      if (!player.isAlive || player.prisoners.length === 0) continue;

      // Capture state BEFORE LLM call
      const snapshotState = this.getStateSnapshot();
      const snapshotChat = this.getChatHistory();

      // Ask this player if they want to donate
      const agent = this.agents[i];
      try {
        const result = await agent.decide(state);
        const actions = result.toolCalls;

        // Build snapshot for donation decision
        const snapshot = {
          type: 'decision',
          game: this.slot,
          turn: this.turnCount,
          player: COLORS[i],
          donationRequester: COLORS[state.donationRequester],
          state: snapshotState,
          chatHistory: snapshotChat,
          llmRequest: result.context ? {
            userPrompt: result.context.userPrompt,
            availableTools: result.context.availableTools
          } : null,
          llmResponse: result.metadata ? {
            responseTime: result.metadata.responseTime,
            promptTokens: result.metadata.promptTokens,
            completionTokens: result.metadata.completionTokens,
            toolCalls: result.metadata.rawToolCalls || []
          } : null,
          execution: []
        };

        if (actions) {
          const donationAction = actions.find(a => a.name === 'respondToDonation');
          if (donationAction) {
            const execResult = this.executeAction(donationAction, i);
            snapshot.execution.push(execResult);
            this.addSnapshot(snapshot);
            return; // One donation response per cycle
          }
        }

        this.addSnapshot(snapshot);
      } catch (error) {
        console.error(`Game ${this.slot} donation error:`, error.message);
      }
    }

    // No one can donate - let game handle elimination
    this.handleDonationAuto(state);
    await this.delay(500);
  }

  handleDonationAuto(state) {
    // Auto-refuse from all remaining players to trigger elimination
    const requester = state.donationRequester;
    for (let i = 0; i < 4; i++) {
      if (i === requester) continue;
      if (this.game.phase !== 'donation') break;
      try {
        this.game.handleDonation(i, false);
      } catch (e) {
        // Ignore - might already have been asked
      }
    }
  }

  canExecuteAction(actionName, phase) {
    const validActions = {
      'selectChip': ['playChip'],
      'selectPile': ['selectPile'],
      'selectNextPlayer': ['chooseNextPlayer'],
      'capture': ['killChip'],
      'donation': ['respondToDonation']
    };
    return validActions[phase]?.includes(actionName) || false;
  }

  executeAction(action, playerId) {
    const playerColor = COLORS[playerId];
    const execResult = {
      tool: action.name,
      args: action.arguments,
      success: true
    };

    try {
      switch (action.name) {
        case 'playChip':
          if (this.game.phase !== 'selectChip') {
            execResult.success = false;
            execResult.error = `Can't play chip in phase ${this.game.phase}`;
            return execResult;
          }
          this.game.selectChip(action.arguments.color);
          this.lastAction = `${playerColor} selected ${action.arguments.color}`;
          break;

        case 'selectPile':
          if (this.game.phase !== 'selectPile') {
            execResult.success = false;
            execResult.error = `Can't select pile in phase ${this.game.phase}`;
            return execResult;
          }
          let pileId = action.arguments.pileId;
          if (pileId === 'new' || pileId === null || pileId === undefined || pileId === 'null') {
            pileId = null;
          } else {
            pileId = parseInt(pileId);
            if (isNaN(pileId)) pileId = null;
          }
          const result = this.game.playOnPile(pileId);
          this.turnCount++;
          execResult.pileId = pileId;
          execResult.wasCapture = result?.action === 'capture';
          this.lastAction = `${playerColor} played on pile ${pileId ?? 'new'}`;
          this.emit('turn', { turn: this.turnCount, player: playerColor, action: this.lastAction });
          break;

        case 'chooseNextPlayer':
          const nextPlayer = COLORS[action.arguments.playerId];
          this.game.chooseNextPlayer(action.arguments.playerId);
          execResult.nextPlayer = nextPlayer;
          this.lastAction = `${playerColor} chose ${nextPlayer} next`;
          break;

        case 'killChip':
          this.game.resolveCapture(action.arguments.color);
          execResult.killed = action.arguments.color;
          this.lastAction = `${playerColor} killed ${action.arguments.color}`;
          this.checkEliminations();
          break;

        case 'respondToDonation':
          this.game.handleDonation(playerId, action.arguments.accept, action.arguments.color);
          execResult.accepted = action.arguments.accept;
          if (action.arguments.accept) {
            execResult.donatedColor = action.arguments.color;
            this.lastAction = `${playerColor} donated ${action.arguments.color}`;
          } else {
            this.lastAction = `${playerColor} refused donation`;
          }
          this.checkEliminations();
          break;

        case 'sendChat':
          this.game.addMessage(playerId, action.arguments.message);
          this.emit('chat', { player: playerColor, message: action.arguments.message, turn: this.turnCount });
          break;

        case 'think':
          this.agents[playerId].consecutiveThinks++;
          this.emit('think', { player: playerColor, thought: action.arguments.thought, turn: this.turnCount });
          break;

        case 'wait':
          break;
      }
    } catch (error) {
      execResult.success = false;
      execResult.error = error.message;
    }

    return execResult;
  }

  finish() {
    this.isRunning = false;
    this.isFinished = true;
    this.endTime = Date.now();

    const winner = COLORS[this.game.winner];

    // Add game_end snapshot
    this.addSnapshot({
      type: 'game_end',
      game: this.slot,
      winner: winner,
      turns: this.turnCount,
      duration: this.endTime - this.startTime,
      eliminationOrder: this.eliminationOrder,
      state: this.getStateSnapshot(),
      chatHistory: this.getChatHistory()
    });

    const result = {
      gameId: `game-${this.slot}`,
      winner: winner,
      turns: this.turnCount,
      duration: this.endTime - this.startTime,
      eliminationOrder: this.eliminationOrder,
      snapshots: this.snapshots
    };

    this.emit('complete', result);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getState() {
    return this.game.getState();
  }

  getResult() {
    if (!this.isFinished) return null;
    return {
      gameId: `game-${this.slot}`,
      winner: COLORS[this.game.winner],
      turns: this.turnCount,
      duration: this.endTime - this.startTime,
      eliminationOrder: this.eliminationOrder,
      snapshots: this.snapshots
    };
  }

}
