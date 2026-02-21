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
      missingColors: this.getMissingColors(),
      hasAllColors: this.hasAllColors()
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
    this.pendingCaptureColor = null;
    this.donationRequester = null;
    this.donationAskedPlayers = [];
    this.currentDonor = null;
    this.messages = [];
    // Negotiation state
    this.promises = [];
    this.trades = [];
    this.promiseIdCounter = 0;
    this.tradeIdCounter = 0;
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
    // Verify player can still play the selected chip before attempting
    const playable = player.getPlayableChips();
    if (!playable.some(c => c.color === this.selectedChip)) {
      // Reset to selectChip phase if chip is no longer valid
      this.phase = 'selectChip';
      this.selectedChip = null;
      throw new Error(`Cannot play ${this.selectedChip} - resetting to chip selection`);
    }
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
      this.pendingCaptureColor = color;
      
      // Find the player whose color made the capture - they choose which chip to kill
      const capturingPlayer = this.players.find(p => p.color === color);
      
      // If capturing player is eliminated, chips go to dead box, current player stays
      if (!capturingPlayer.isAlive) {
        const allChips = [...pile.chips];
        this.deadBox.push(...allChips);
        pile.chips = [];
        this.piles = this.piles.filter(p => !p.isEmpty());
        this.pendingCapture = null;
        this.pendingCaptureColor = null;
        this.phase = 'selectChip';
        
        if (this.checkWinCondition()) {
          return { action: 'gameOver', winner: this.winner };
        }
        return { action: 'capturedEliminated', pile, captureColor: color };
      }
      
      // Switch to capturing player - they choose which chip to kill
      this.currentPlayer = capturingPlayer.id;
      this.phase = 'capture';
      return { action: 'capture', pile, captureColor: color, capturingPlayer: capturingPlayer.id };
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
    const idx = typeof playerIdx === 'string' ? parseInt(playerIdx, 10) : playerIdx;
    if (typeof idx !== 'number' || isNaN(idx) || idx < 0 || idx > 3) {
      throw new Error('Invalid player index');
    }
    return this.setNextPlayer(idx);
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

    // Current player is already the capturing player (set in playOnPile)
    // Give them the captured chips
    const capturingPlayer = this.getCurrentPlayer();
    capturingPlayer.receivePrisoners(captured);

    this.piles = this.piles.filter(p => !p.isEmpty());
    this.pendingCapture = null;
    this.pendingCaptureColor = null;
    this.phase = 'selectChip';

    if (this.checkWinCondition()) {
      return { action: 'gameOver', winner: this.winner };
    }
    return { action: 'captured', killed, captured, nextPlayer: this.currentPlayer };
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
        this.currentDonor = idx;
        return { action: 'askDonation', asker: this.donationRequester, donor: idx };
      }
    }
    this.currentDonor = null;
    return this.eliminatePlayer(this.donationRequester);
  }

  handleDonation(donorIdx, accepts, color = null) {
    if (this.phase !== 'donation') throw new Error('Not in donation phase');
    if (this.currentDonor !== null && donorIdx !== this.currentDonor) {
      throw new Error(`Player ${donorIdx} is not the current donor (expected ${this.currentDonor})`);
    }
    this.donationAskedPlayers.push(donorIdx);

    if (accepts && color) {
      const donor = this.players[donorIdx];
      const requester = this.players[this.donationRequester];
      donor.donatePrisoner(color);
      requester.receiveDonation(color);
      this.phase = 'selectChip';
      this.donationRequester = null;
      this.donationAskedPlayers = [];
      this.currentDonor = null;
      return { action: 'donationAccepted', donor: donorIdx, color };
    }

    return this.askNextDonation();
  }

  eliminatePlayer(playerIdx) {
    this.players[playerIdx].eliminate();
    this.donationRequester = null;
    this.donationAskedPlayers = [];
    this.currentDonor = null;

    if (this.checkWinCondition()) {
      return { action: 'gameOver', winner: this.winner };
    }

    const nextAlive = this.getAlivePlayers()[0];
    this.currentPlayer = nextAlive.id;

    if (!nextAlive.hasChips()) {
      return this.startDonation();
    }

    this.phase = 'selectChip';
    return { action: 'eliminated', player: playerIdx, nextPlayer: this.currentPlayer };
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

  givePrisoner(fromPlayer, toPlayer, color) {
    const from = this.players[fromPlayer];
    const to = this.players[toPlayer];
    if (!from.isAlive || !to.isAlive) throw new Error('Both players must be alive');
    if (fromPlayer === toPlayer) throw new Error('Cannot give to yourself');
    if (!from.prisoners.includes(color)) throw new Error(`${from.color} does not have a ${color} prisoner`);
    from.donatePrisoner(color);
    to.receiveDonation(color);
    if (this.currentPlayer === fromPlayer && this.selectedChip === color) {
      this.selectedChip = null;
      this.phase = 'selectChip';
    }
    this.addMessage(fromPlayer, `gave a ${color.toUpperCase()} prisoner to ${to.color.toUpperCase()}`);
    return { from: fromPlayer, to: toPlayer, color };
  }

  makePromise(playerIdx, text) {
    if (!text?.trim()) return null;
    const promise = {
      id: this.promiseIdCounter++,
      player: playerIdx,
      color: this.players[playerIdx].color,
      text: text.trim(),
      broken: false,
      timestamp: Date.now()
    };
    this.promises.push(promise);
    return promise;
  }

  breakPromise(promiseId) {
    const promise = this.promises.find(p => p.id === promiseId);
    if (promise && !promise.broken) {
      promise.broken = true;
      promise.brokenAt = Date.now();
      return true;
    }
    return false;
  }

  proposeTrade(fromPlayer, toPlayer, offer, want) {
    if (!offer?.trim() || !want?.trim()) return null;
    const trade = {
      id: this.tradeIdCounter++,
      from: fromPlayer,
      fromColor: this.players[fromPlayer].color,
      to: toPlayer,
      toColor: this.players[toPlayer].color,
      offer: offer.trim(),
      want: want.trim(),
      status: 'pending',
      timestamp: Date.now()
    };
    this.trades.push(trade);
    return trade;
  }

  respondToTrade(tradeId, accept) {
    const trade = this.trades.find(t => t.id === tradeId);
    if (trade && trade.status === 'pending') {
      trade.status = accept ? 'accepted' : 'rejected';
      trade.respondedAt = Date.now();
      return true;
    }
    return false;
  }

  breakTrade(tradeId) {
    const trade = this.trades.find(t => t.id === tradeId);
    if (trade && trade.status === 'accepted') {
      trade.status = 'broken';
      trade.brokenAt = Date.now();
      return true;
    }
    return false;
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
      pendingCaptureColor: this.pendingCaptureColor,
      donationRequester: this.donationRequester,
      currentDonor: this.currentDonor,
      messages: [...this.messages],
      promises: this.promises.map(p => ({ ...p })),
      trades: this.trades.map(t => ({ ...t }))
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
    description: 'Choose pile to play on. Use "new" to start a new pile, or the pile ID number as a string.',
    parameters: {
      type: 'object',
      properties: {
        pileId: { type: 'string', description: 'Pile ID (e.g. "0", "1") or "new" to start a new pile' }
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
    name: 'givePrisoner',
    description: 'Give one of your prisoners to another player as a gift or alliance gesture. Can be used any time.',
    parameters: {
      type: 'object',
      properties: {
        toPlayerId: { type: 'integer', description: '0=Red, 1=Blue, 2=Green, 3=Yellow' },
        color: { type: 'string', enum: COLORS, description: 'Color of the prisoner to give' }
      },
      required: ['toPlayerId', 'color']
    }
  },
  {
    name: 'makePromise',
    description: 'Make a named promise to another player. Promises can be broken - breaking them is visible in game data.',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'The promise text (e.g. "I will not capture you next turn")' }
      },
      required: ['text']
    }
  },
  {
    name: 'breakPromise',
    description: 'Formally break one of your outstanding promises (marks it as broken in the record).',
    parameters: {
      type: 'object',
      properties: {
        promiseId: { type: 'integer', description: 'The ID of the promise to break' }
      },
      required: ['promiseId']
    }
  },
  {
    name: 'proposeTrade',
    description: 'Propose a trade to another player. Describe what you offer and what you want in return.',
    parameters: {
      type: 'object',
      properties: {
        toPlayerId: { type: 'integer', description: 'Player to propose the trade to (0=Red, 1=Blue, 2=Green, 3=Yellow)' },
        offer: { type: 'string', description: 'What you are offering (e.g. "I will give you next turn")' },
        want: { type: 'string', description: 'What you want in return (e.g. "Do not capture me this round")' }
      },
      required: ['toPlayerId', 'offer', 'want']
    }
  },
  {
    name: 'respondToTrade',
    description: 'Accept or reject a pending trade proposal directed at you.',
    parameters: {
      type: 'object',
      properties: {
        tradeId: { type: 'integer', description: 'ID of the trade to respond to' },
        accept: { type: 'boolean', description: 'Whether to accept the trade' }
      },
      required: ['tradeId', 'accept']
    }
  },
  {
    name: 'breakTrade',
    description: 'Break an accepted trade agreement (marks it as broken in the record).',
    parameters: {
      type: 'object',
      properties: {
        tradeId: { type: 'integer', description: 'ID of the trade to break' }
      },
      required: ['tradeId']
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

function getToolsForPhase(phase, isMyTurn, pendingDonation, silent = false) {
  const negotiation = silent
    ? ['think', 'wait']
    : ['sendChat', 'think', 'wait', 'givePrisoner', 'makePromise', 'breakPromise', 'proposeTrade', 'respondToTrade', 'breakTrade'];
  if (pendingDonation) return [...negotiation, 'respondToDonation'];
  if (!isMyTurn) return negotiation;

  switch (phase) {
    case 'selectChip': return [...negotiation, 'playChip'];
    case 'selectPile': return [...negotiation, 'selectPile'];
    case 'selectNextPlayer': return [...negotiation, 'chooseNextPlayer'];
    case 'capture': return [...negotiation, 'killChip'];
    default: return negotiation;
  }
}

function filterTools(names) {
  return TOOLS.filter(t => names.includes(t.name));
}

// ============================================
// AI AGENT
// ============================================
class AIAgent {
  constructor(playerId, provider, options = {}) {
    this.playerId = playerId;
    this.color = COLORS[playerId];
    this.provider = provider;
    this.silent = options.silent || false; // No chat mode
    this.thoughts = [];
    this.consecutiveThinks = 0;
  }

  // Static template - use {PLAYER_COLOR} as placeholder
  static getSystemPromptTemplate() {
    return `You are {PLAYER_COLOR} in "So Long Sucker" - a 4-player negotiation board game.

GAME OVERVIEW:
- Only 1 of 4 players survives to win
- Alliances help you survive early, but only one can win
- Communication and strategy are both important

RULES:
- Play 1 chip per turn onto piles
- CAPTURE: If your chip matches the color directly below, you capture the pile
  - Kill 1 chip (to dead box), keep the rest as prisoners
- NEXT PLAYER: You choose who plays next from colors missing in the pile
  - If all 4 colors present, owner of deepest chip goes next
- DONATION: No chips means you must ask others for help, or be eliminated
- WIN: Last player alive wins

NEGOTIATION TOOLS (available any time):
- givePrisoner: Give one of your prisoners to another player as alliance cement or payment
- makePromise: Make a named promise (e.g. "I won't capture you for 3 turns") - breaking it is recorded
- breakPromise: Formally break a promise you made (marked in the game record)
- proposeTrade: Propose a trade to another player (offer X, want Y)
- respondToTrade: Accept or reject a pending trade proposal
- breakTrade: Break an accepted trade (marked in the game record)
- sendChat: Talk, negotiate, threaten, or make deals in public chat

STRATEGY:
- Form alliances early to survive - use promises and trades to build trust
- Prisoners give flexibility (you can play any color)
- givePrisoner is a powerful signal of trust - and can be used strategically
- Control who plays next to your advantage
- Betrayal timing matters - break promises at the right moment
- Track who has broken promises/trades - it affects who to trust

HOW TO PLAY:
- You can call MULTIPLE tools at once (e.g., sendChat AND playChip together)
- When it's your turn, you MUST take a game action
- Respond to other players' messages - negotiation is part of the game
- Keep chat messages brief (1-2 sentences)`;
  }

  // Silent mode template - no chat, pure game actions
  static getSilentSystemPromptTemplate() {
    return `You are {PLAYER_COLOR} in "So Long Sucker" - a 4-player strategy board game.

GAME OVERVIEW:
- Only 1 of 4 players survives to win
- No communication - pure strategic play
- Make optimal moves based on game state

RULES:
- Play 1 chip per turn onto piles
- CAPTURE: If your chip matches the color directly below, you capture the pile
  - Kill 1 chip (to dead box), keep the rest as prisoners
- NEXT PLAYER: You choose who plays next from colors missing in the pile
  - If all 4 colors present, owner of deepest chip goes next
- DONATION: No chips means you must ask others for help, or be eliminated
- WIN: Last player alive wins

STRATEGY:
- Analyze the board state carefully
- Consider which players are threats
- Prisoners give flexibility (you can play any color)
- Control who plays next to your advantage

When it's your turn, take your game action (playChip → selectPile).`;
  }

  buildSystemPrompt() {
    const template = this.silent 
      ? AIAgent.getSilentSystemPromptTemplate()
      : AIAgent.getSystemPromptTemplate();
    return template.replace(/{PLAYER_COLOR}/g, this.color.toUpperCase());
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
      prompt += `\n\nYou must call playChip NOW. Available chips: ${playable.join(', ')}`;
    } else if (state.phase === 'selectPile' && isMyTurn) {
      if (state.piles.length > 0) {
        prompt += `\n\nYou must call selectPile NOW. Available piles: ${state.piles.map(p => `"${p.id}"`).join(', ')} or use "new" to start a new pile.`;
      } else {
        prompt += `\n\nYou must call selectPile NOW with pileId: "new" - there are NO existing piles yet!`;
      }
    } else if (state.phase === 'capture' && isMyTurn) {
      prompt += `\n\nYou captured a pile! You must call killChip NOW. Choose which chip to KILL: ${state.pendingCapture.chips.join(', ')}`;
    } else if (state.phase === 'selectNextPlayer' && isMyTurn) {
      prompt += `\n\nYou must call chooseNextPlayer NOW. Choose who plays next from missing colors.`;
    } else if (state.phase === 'donation' && state.donationRequester !== null) {
      const requester = COLORS[state.donationRequester];
      if (state.currentDonor === this.playerId) {
        prompt += `\n\n⚠️ ${requester.toUpperCase()} has no chips and is ASKING YOU for a donation!`;
        prompt += `\nYou MUST respond using respondToDonation. Available to donate: ${me.prisoners.join(', ')}`;
        prompt += `\nRefusing moves to the next player. If everyone refuses, ${requester.toUpperCase()} is eliminated.`;
      } else {
        prompt += `\n\n${requester.toUpperCase()} has no chips and is asking for donations. Waiting for ${COLORS[state.currentDonor]?.toUpperCase() || 'next player'} to respond.`;
      }
    }

    // Active promises
    const myPromises = (state.promises || []).filter(p => p.player === this.playerId && !p.broken);
    if (myPromises.length > 0) {
      prompt += `\n\nYOUR ACTIVE PROMISES:\n${myPromises.map(p => `- [#${p.id}] "${p.text}"`).join('\n')}`;
    }

    // Active trades (pending or accepted involving this player)
    const myTrades = (state.trades || []).filter(t =>
      (t.from === this.playerId || t.to === this.playerId) && (t.status === 'pending' || t.status === 'accepted')
    );
    if (myTrades.length > 0) {
      prompt += `\n\nACTIVE TRADES:\n${myTrades.map(t =>
        `- [#${t.id}] ${t.fromColor} → ${t.toColor}: offer "${t.offer}", want "${t.want}" (${t.status})`
      ).join('\n')}`;
    }

    if (!this.silent) {
      // Add chat history (last 50 messages for context)
      if (state.messages.length > 0) {
        const recent = state.messages.slice(-50);
        const hasOtherMessages = recent.some(m => m.color !== this.color);
        prompt += `\n\nCHAT HISTORY:\n${recent.map(m => `${m.color.toUpperCase()}: ${m.text}`).join('\n')}`;
        if (hasOtherMessages) {
          prompt += `\n\nConsider responding to the chat or continuing negotiations.`;
        }
      }

      if (isMyTurn) {
        prompt += `\n\nIT'S YOUR TURN - Take your game action now.`;
      } else {
        prompt += `\n\nIt's ${COLORS[state.currentPlayer].toUpperCase()}'s turn. You can chat, make promises, propose trades, or give prisoners while waiting.`;
      }
    } else {
      // Silent mode - just action prompts
      if (isMyTurn) {
        prompt += `\n\nIT'S YOUR TURN - Take your game action now.`;
      } else {
        prompt += `\n\nIt's ${COLORS[state.currentPlayer].toUpperCase()}'s turn.`;
      }
    }

    return prompt;
  }

  async decide(state) {
    const isMyTurn = state.currentPlayer === this.playerId;
    const me = state.players[this.playerId];
    if (!me.isAlive) return { toolCalls: null, metadata: null };

    // Use currentDonor to target the correct player (matching browser behavior)
    const pendingDonation = state.donationRequester !== null &&
                            state.phase === 'donation' &&
                            state.currentDonor === this.playerId &&
                            me.prisoners.length > 0;

    let toolNames = getToolsForPhase(state.phase, isMyTurn, pendingDonation, this.silent);

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
    // Support both single provider (legacy) and array of 4 providers (mixed-model)
    this.provider = config.provider; // legacy single provider
    this.providers = config.providers || null; // array of 4 providers for mixed-model games
    this.silent = config.silent || false; // No chat mode for control experiments
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

    // Track chat index for incremental storage (avoid O(n²) duplication)
    this.lastChatSnapshotIndex = 0;
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

  // Get chat history for snapshot (full history - used for game_start/game_end)
  getChatHistory() {
    return this.game.messages.map(m => ({
      player: COLORS[m.player],
      message: m.text
    }));
  }

  // Get only NEW chat messages since last snapshot (incremental - avoids O(n²) duplication)
  getNewChatMessages() {
    const allMessages = this.game.messages;
    const newMessages = allMessages.slice(this.lastChatSnapshotIndex).map(m => ({
      player: COLORS[m.player],
      message: m.text
    }));
    this.lastChatSnapshotIndex = allMessages.length;
    return newMessages;
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

    // Create AI agents - use per-player providers if available, otherwise single provider
    for (let i = 0; i < 4; i++) {
      const playerProvider = this.providers ? this.providers[i] : this.provider;
      this.agents.push(new AIAgent(i, playerProvider, { silent: this.silent }));
    }

    // Add game_start snapshot with model info
    this.addSnapshot({
      type: 'game_start',
      game: this.slot,
      state: this.getStateSnapshot(),
      chatHistory: [],
      silent: this.silent, // Track if this game was silent mode
      models: this.agents.map(a => ({
        player: a.color,
        model: a.provider.getModelName()
      }))
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
          } else if (state.phase === 'selectPile') {
            try {
              this.game.playOnPile(null);
              this.turnCount++;
              console.log(`Game ${this.slot}: Auto-recovery - played on new pile`);
            } catch (e) {
              console.error(`Game ${this.slot}: selectPile recovery failed: ${e.message}`);
              if (this.game.phase === 'selectChip') {
                const player = state.players[current];
                const playable = player.supply > 0 ? [player.color] : (player.prisoners.length > 0 ? [player.prisoners[0]] : []);
                if (playable.length > 0) {
                  try {
                    this.game.selectChip(playable[0]);
                    this.game.playOnPile(null);
                    this.turnCount++;
                    console.log(`Game ${this.slot}: Full recovery - selected ${playable[0]} and played on new pile`);
                  } catch (e2) {
                    console.error(`Game ${this.slot}: Full recovery failed: ${e2.message}`);
                  }
                }
              }
            }
          } else if (state.phase === 'selectChip') {
            const player = state.players[current];
            if (player.supply === 0 && player.prisoners.length === 0) {
              console.log(`Game ${this.slot}: Player ${COLORS[current]} has no chips, triggering donation`);
              try {
                this.game.startDonation();
                this.checkEliminations();
              } catch (e) {
                console.error(`Game ${this.slot}: Donation trigger failed: ${e.message}`);
              }
            } else {
              const playable = player.supply > 0 ? [player.color] : [player.prisoners[0]];
              if (playable.length > 0) {
                try {
                  this.game.selectChip(playable[0]);
                  console.log(`Game ${this.slot}: Auto-recovery - selected ${playable[0]} chip`);
                } catch (e) {
                  console.error(`Game ${this.slot}: selectChip recovery failed: ${e.message}`);
                }
              }
            }
          } else if (state.phase === 'selectNextPlayer') {
            const alivePlayers = state.players.filter(p => p.isAlive && p.id !== current);
            if (alivePlayers.length > 0) {
              try {
                this.game.chooseNextPlayer(alivePlayers[0].id);
                console.log(`Game ${this.slot}: Auto-recovery - chose ${alivePlayers[0].color} as next`);
              } catch (e) {
                console.error(`Game ${this.slot}: selectNextPlayer recovery failed: ${e.message}`);
              }
            }
          } else if (state.phase === 'capture') {
            // Missing from original CLI - added to match browser behavior
            const pile = state.pendingCapture;
            if (pile && pile.chips.length > 0) {
              try {
                this.game.resolveCapture(pile.chips[0]);
                this.checkEliminations();
                console.log(`Game ${this.slot}: Auto-recovery - killed ${pile.chips[0]} in capture`);
              } catch (e) {
                console.error(`Game ${this.slot}: capture recovery failed: ${e.message}`);
              }
            }
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

      // Check if current player has no chips - trigger donation immediately
      if (state.phase === 'selectChip') {
        const player = state.players[current];
        if (player.supply === 0 && player.prisoners.length === 0) {
          console.log(`Game ${this.slot}: ${COLORS[current]} has no chips, triggering donation`);
          try {
            this.game.startDonation();
            this.checkEliminations();
            if (this.game.phase === 'gameOver') break;
          } catch (e) {
            console.error(`Game ${this.slot}: startDonation failed: ${e.message}`);
          }
          continue;
        }
      }

      // Run the active player's turn
      await this.runAgentTurn(current, state);

      // Run off-turn agents in parallel (chat/negotiate while active player acts)
      if (!this.silent) {
        await this.runOffTurnAgents(current, state);
      }

      // Rate limiting
      await this.delay(this.config.delay || 500);
    }

    if (this.game.phase === 'gameOver') {
      this.finish();
    }
  }

  // Run one agent's turn (active player game action)
  async runAgentTurn(playerId, state) {
    const agent = this.agents[playerId];
    const newChatMessages = this.getNewChatMessages();

    try {
      const result = await agent.decide(state);
      const actions = result.toolCalls;

      const snapshot = {
        type: 'decision',
        game: this.slot,
        turn: this.turnCount,
        player: COLORS[playerId],
        model: agent.provider.getModelName(),
        phase: state.phase,
        newMessages: newChatMessages,
        llmRequest: result.context ? {
          userPrompt: result.context.userPrompt,
          availableTools: result.context.availableTools
        } : null,
        llmResponse: result.metadata ? {
          responseTime: result.metadata.responseTime,
          promptTokens: result.metadata.promptTokens,
          completionTokens: result.metadata.completionTokens,
          cacheReadTokens: result.metadata.cacheReadTokens || 0,
          cacheWriteTokens: result.metadata.cacheWriteTokens || 0,
          nativeThinking: result.metadata.nativeThinking || null,
          toolCalls: result.metadata.rawToolCalls || []
        } : null,
        execution: []
      };

      if (actions && actions.length > 0) {
        const gameActions = actions.filter(a =>
          ['playChip', 'selectPile', 'chooseNextPlayer', 'killChip', 'respondToDonation'].includes(a.name)
        );
        const negotiationActions = actions.filter(a =>
          ['sendChat', 'think', 'givePrisoner', 'makePromise', 'breakPromise', 'proposeTrade', 'respondToTrade', 'breakTrade'].includes(a.name)
        );

        for (const action of gameActions) {
          const currentPhase = this.game.phase;
          if (this.canExecuteAction(action.name, currentPhase)) {
            const execResult = this.executeAction(action, playerId);
            snapshot.execution.push(execResult);
            if (!execResult.success) break;
          } else {
            snapshot.execution.push({
              tool: action.name,
              args: action.arguments,
              success: false,
              error: `Not valid in phase ${currentPhase}`
            });
          }
        }

        for (const action of negotiationActions) {
          const execResult = this.executeAction(action, playerId);
          snapshot.execution.push(execResult);
        }
      }

      this.addSnapshot(snapshot);
    } catch (error) {
      console.error(`Game ${this.slot} error:`, error.message);
    }
  }

  // Run off-turn agents to chat/negotiate in parallel
  // Each inactive agent gets one cycle to send messages, make promises, propose trades, or give prisoners
  async runOffTurnAgents(activePlayerId, state) {
    const offTurnIds = this.agents
      .filter(a => a.playerId !== activePlayerId && state.players[a.playerId].isAlive)
      .map(a => a.playerId);

    if (offTurnIds.length === 0) return;

    // Run all inactive agents in parallel - they can chat/negotiate simultaneously
    await Promise.all(offTurnIds.map(async (playerId) => {
      const agent = this.agents[playerId];
      // Off-turn agents only get negotiation tools (no game actions)
      const toolNames = this.silent
        ? ['think', 'wait']
        : ['sendChat', 'think', 'wait', 'givePrisoner', 'makePromise', 'breakPromise', 'proposeTrade', 'respondToTrade', 'breakTrade'];

      try {
        const result = await agent.provider.call(
          agent.buildSystemPrompt(),
          agent.buildUserPrompt(state),
          filterTools(toolNames)
        );

        const actions = result.toolCalls?.length > 0 ? result.toolCalls : null;
        if (!actions) return;

        const newChatMessages = this.getNewChatMessages();
        const snapshot = {
          type: 'off_turn',
          game: this.slot,
          turn: this.turnCount,
          player: COLORS[playerId],
          model: agent.provider.getModelName(),
          phase: state.phase,
          newMessages: newChatMessages,
          llmRequest: {
            availableTools: toolNames
          },
          llmResponse: result.metadata ? {
            responseTime: result.metadata.responseTime,
            promptTokens: result.metadata.promptTokens,
            completionTokens: result.metadata.completionTokens,
            cacheReadTokens: result.metadata.cacheReadTokens || 0,
            cacheWriteTokens: result.metadata.cacheWriteTokens || 0,
            toolCalls: result.metadata.rawToolCalls || []
          } : null,
          execution: []
        };

        for (const action of actions) {
          if (toolNames.includes(action.name)) {
            const execResult = this.executeAction(action, playerId);
            snapshot.execution.push(execResult);
          }
        }

        // Only snapshot if agent did something meaningful
        const didSomething = snapshot.execution.some(e => e.success && e.tool !== 'wait');
        if (didSomething) {
          this.addSnapshot(snapshot);
        }
      } catch (error) {
        // Off-turn errors are non-fatal - silently skip
      }
    }));
  }

  async handleDonationPhase(state) {
    // Ask only the current donor (currentDonor-aware, matching browser behavior)
    const donorId = state.currentDonor;

    if (donorId !== null && donorId !== undefined) {
      const player = state.players[donorId];
      if (player.isAlive && player.prisoners.length > 0) {
        const agent = this.agents[donorId];
        const newChatMessages = this.getNewChatMessages();

        try {
          const result = await agent.decide(state);
          const actions = result.toolCalls;

          const snapshot = {
            type: 'decision',
            game: this.slot,
            turn: this.turnCount,
            player: COLORS[donorId],
            model: agent.provider.getModelName(),
            phase: 'donation',
            donationRequester: COLORS[state.donationRequester],
            newMessages: newChatMessages,
            llmRequest: result.context ? {
              userPrompt: result.context.userPrompt,
              availableTools: result.context.availableTools
            } : null,
            llmResponse: result.metadata ? {
              responseTime: result.metadata.responseTime,
              promptTokens: result.metadata.promptTokens,
              completionTokens: result.metadata.completionTokens,
              cacheReadTokens: result.metadata.cacheReadTokens || 0,
              cacheWriteTokens: result.metadata.cacheWriteTokens || 0,
              nativeThinking: result.metadata.nativeThinking || null,
              toolCalls: result.metadata.rawToolCalls || []
            } : null,
            execution: []
          };

          if (actions) {
            // Handle donation response first
            const donationAction = actions.find(a => a.name === 'respondToDonation');
            if (donationAction) {
              const execResult = this.executeAction(donationAction, donorId);
              snapshot.execution.push(execResult);
            }
            // Handle any negotiation actions alongside
            for (const action of actions) {
              if (['sendChat', 'think', 'givePrisoner', 'makePromise', 'breakPromise', 'proposeTrade', 'respondToTrade', 'breakTrade'].includes(action.name)) {
                const execResult = this.executeAction(action, donorId);
                snapshot.execution.push(execResult);
              }
            }
          }

          this.addSnapshot(snapshot);
        } catch (error) {
          console.error(`Game ${this.slot} donation error:`, error.message);
        }

        // Off-turn negotiation for non-donor players during donation phase
        if (!this.silent) {
          const nonDonors = this.agents.filter(a =>
            a.playerId !== donorId &&
            a.playerId !== state.donationRequester &&
            state.players[a.playerId].isAlive
          );
          if (nonDonors.length > 0) {
            await Promise.all(nonDonors.map(async (agent) => {
              const toolNames = ['sendChat', 'think', 'wait', 'makePromise', 'breakPromise', 'proposeTrade', 'respondToTrade'];
              try {
                const result = await agent.provider.call(
                  agent.buildSystemPrompt(),
                  agent.buildUserPrompt(state),
                  filterTools(toolNames)
                );
                const actions = result.toolCalls?.length > 0 ? result.toolCalls : null;
                if (actions) {
                  for (const action of actions) {
                    if (toolNames.includes(action.name) && action.name !== 'wait') {
                      this.executeAction(action, agent.playerId);
                    }
                  }
                }
              } catch (e) { /* non-fatal */ }
            }));
          }
        }
        return;
      }
    }

    // No valid current donor - auto-advance
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
        this.checkEliminations(); // Check after each refusal in case player was eliminated
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
          // playOnPile can cascade into donation → elimination internally (when next player
          // has no chips and nobody has prisoners to donate). Check eliminations here so
          // eliminationOrder is always populated correctly.
          this.checkEliminations();
          break;

        case 'chooseNextPlayer':
          const nextPlayer = COLORS[action.arguments.playerId];
          this.game.chooseNextPlayer(action.arguments.playerId);
          execResult.nextPlayer = nextPlayer;
          this.lastAction = `${playerColor} chose ${nextPlayer} next`;
          // chooseNextPlayer → setNextPlayer can also cascade into donation → elimination
          this.checkEliminations();
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

        case 'givePrisoner': {
          const toColor = COLORS[action.arguments.toPlayerId];
          this.game.givePrisoner(playerId, action.arguments.toPlayerId, action.arguments.color);
          execResult.toPlayer = toColor;
          execResult.color = action.arguments.color;
          this.lastAction = `${playerColor} gave ${action.arguments.color} prisoner to ${toColor}`;
          this.emit('chat', {
            player: playerColor,
            message: `gave a ${action.arguments.color.toUpperCase()} prisoner to ${toColor.toUpperCase()}`,
            turn: this.turnCount
          });
          break;
        }

        case 'makePromise': {
          const promise = this.game.makePromise(playerId, action.arguments.text);
          if (promise) {
            execResult.promiseId = promise.id;
            this.emit('chat', {
              player: playerColor,
              message: `[Promise #${promise.id}]: "${promise.text}"`,
              turn: this.turnCount
            });
          }
          break;
        }

        case 'breakPromise': {
          const broke = this.game.breakPromise(action.arguments.promiseId);
          execResult.broke = broke;
          if (broke) {
            this.emit('chat', {
              player: playerColor,
              message: `[Broke promise #${action.arguments.promiseId}]`,
              turn: this.turnCount
            });
          }
          break;
        }

        case 'proposeTrade': {
          const trade = this.game.proposeTrade(
            playerId,
            action.arguments.toPlayerId,
            action.arguments.offer,
            action.arguments.want
          );
          if (trade) {
            execResult.tradeId = trade.id;
            const toColor = COLORS[action.arguments.toPlayerId];
            this.emit('chat', {
              player: playerColor,
              message: `[Trade #${trade.id} to ${toColor}]: offer "${trade.offer}", want "${trade.want}"`,
              turn: this.turnCount
            });
          }
          break;
        }

        case 'respondToTrade': {
          const responded = this.game.respondToTrade(action.arguments.tradeId, action.arguments.accept);
          execResult.responded = responded;
          execResult.accepted = action.arguments.accept;
          if (responded) {
            this.emit('chat', {
              player: playerColor,
              message: `[${action.arguments.accept ? 'Accepted' : 'Rejected'} trade #${action.arguments.tradeId}]`,
              turn: this.turnCount
            });
          }
          break;
        }

        case 'breakTrade': {
          const brokeTrade = this.game.breakTrade(action.arguments.tradeId);
          execResult.broke = brokeTrade;
          if (brokeTrade) {
            this.emit('chat', {
              player: playerColor,
              message: `[Broke trade #${action.arguments.tradeId}]`,
              turn: this.turnCount
            });
          }
          break;
        }

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
