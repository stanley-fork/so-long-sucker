// Game state management for So Long Sucker

import { Player, COLORS, DEFAULT_CHIPS } from './player.js';
import { Pile } from './pile.js';

export class Game {
  constructor(startingChips = DEFAULT_CHIPS) {
    this.startingChips = startingChips;
    this.reset();
  }

  /**
   * Reset game to initial state
   */
  reset() {
    this.players = COLORS.map((color, i) => new Player(i, color, this.startingChips));
    this.piles = [];
    this.deadBox = [];
    this.currentPlayer = Math.floor(Math.random() * 4);
    this.phase = 'selectChip';
    this.winner = null;
    this.pileIdCounter = 0;

    // Temporary state for multi-step actions
    this.selectedChip = null;
    this.pendingCapture = null;
    this.donationRequester = null;
    this.donationAskedPlayers = [];
    this.currentDonor = null; // Who is currently being asked for donation

    // Negotiation state
    this.messages = [];
    this.promises = [];
    this.trades = [];
    this.promiseIdCounter = 0;
    this.tradeIdCounter = 0;
  }

  /**
   * Get current player object
   */
  getCurrentPlayer() {
    return this.players[this.currentPlayer];
  }

  /**
   * Get player by index
   */
  getPlayer(index) {
    return this.players[index];
  }

  /**
   * Get alive players
   */
  getAlivePlayers() {
    return this.players.filter(p => p.isAlive);
  }

  /**
   * Get player index by color
   */
  getPlayerByColor(color) {
    return this.players.find(p => p.color === color);
  }

  /**
   * Select a chip to play
   * @param {string} color - Color of chip to play
   */
  selectChip(color) {
    const player = this.getCurrentPlayer();
    const playable = player.getPlayableChips();

    if (!playable.some(c => c.color === color)) {
      throw new Error('Cannot play this chip');
    }

    this.selectedChip = color;
    this.phase = 'selectPile';
  }

  /**
   * Play selected chip on a pile (or new pile)
   * @param {number|null} pileId - Pile ID to play on, or null for new pile
   */
  playOnPile(pileId) {
    if (this.phase !== 'selectPile' || !this.selectedChip) {
      throw new Error('Not in pile selection phase');
    }

    const player = this.getCurrentPlayer();
    const color = player.playChip(this.selectedChip);

    let pile;
    if (pileId === null) {
      // New pile
      pile = new Pile(this.pileIdCounter++);
      this.piles.push(pile);
    } else {
      pile = this.piles.find(p => p.id === pileId);
      if (!pile) throw new Error('Pile not found');
    }

    // Check for capture BEFORE adding chip
    const willCapture = pile.wouldCapture(color);

    // Add chip to pile
    pile.addChip(color);
    this.selectedChip = null;

    if (willCapture) {
      this.pendingCapture = pile;
      this.phase = 'capture';
      return { action: 'capture', pile };
    }

    // Determine next player
    return this.determineNextPlayer(pile);
  }

  /**
   * Determine who plays next based on pile state
   * @param {Pile} pile - The pile that was just played on
   */
  determineNextPlayer(pile) {
    const missingColors = pile.getMissingColors();

    if (missingColors.length === 0) {
      // All colors present - deepest chip rule
      const deepestColor = pile.getDeepestColor();
      const nextPlayer = this.getPlayerByColor(deepestColor);
      return this.setNextPlayer(nextPlayer.id);
    }

    if (missingColors.length === 1) {
      // Only one option
      const nextPlayer = this.getPlayerByColor(missingColors[0]);
      return this.setNextPlayer(nextPlayer.id);
    }

    // Multiple options - current player chooses
    // Filter to only alive players
    const validChoices = missingColors.filter(c =>
      this.getPlayerByColor(c).isAlive
    );

    if (validChoices.length === 1) {
      const nextPlayer = this.getPlayerByColor(validChoices[0]);
      return this.setNextPlayer(nextPlayer.id);
    }

    if (validChoices.length === 0) {
      // Edge case: all missing color players are eliminated
      // Fall back to deepest alive player
      for (const color of pile.chips) {
        const player = this.getPlayerByColor(color);
        if (player.isAlive) {
          return this.setNextPlayer(player.id);
        }
      }
    }

    this.phase = 'selectNextPlayer';
    return { action: 'chooseNext', options: validChoices };
  }

  /**
   * Current player chooses who goes next
   * @param {number} playerIndex - Index of player to go next
   */
  chooseNextPlayer(playerIndex) {
    if (this.phase !== 'selectNextPlayer') {
      throw new Error('Not in next player selection phase');
    }
    return this.setNextPlayer(playerIndex);
  }

  /**
   * Set next player and check if they can play
   * @param {number} playerIndex
   */
  setNextPlayer(playerIndex) {
    const nextPlayer = this.players[playerIndex];

    if (!nextPlayer.isAlive) {
      // Skip eliminated players
      return this.setNextPlayer((playerIndex + 1) % 4);
    }

    this.currentPlayer = playerIndex;

    if (!nextPlayer.hasChips()) {
      // Start donation phase
      return this.startDonation();
    }

    this.phase = 'selectChip';
    return { action: 'nextTurn', player: playerIndex };
  }

  /**
   * Resolve a capture - player chooses which chip to kill
   * @param {string} colorToKill - Color of chip to send to dead box
   */
  resolveCapture(colorToKill) {
    if (this.phase !== 'capture' || !this.pendingCapture) {
      throw new Error('Not in capture phase');
    }

    const pile = this.pendingCapture;
    const { killed, captured } = pile.resolveCapture(colorToKill);

    // Send killed chip to dead box
    this.deadBox.push(killed);

    // Give captured chips to current player
    const player = this.getCurrentPlayer();
    player.receivePrisoners(captured);

    // Remove empty pile
    this.piles = this.piles.filter(p => !p.isEmpty());

    this.pendingCapture = null;

    // Capturer goes again
    this.phase = 'selectChip';

    // Check win condition
    if (this.checkWinCondition()) {
      return { action: 'gameOver', winner: this.winner };
    }

    return { action: 'captured', killed, captured, nextPlayer: this.currentPlayer };
  }

  /**
   * Start donation phase for current player
   */
  startDonation() {
    this.donationRequester = this.currentPlayer;
    this.donationAskedPlayers = [];
    this.phase = 'donation';

    return this.askNextDonation();
  }

  /**
   * Ask next player for donation
   */
  askNextDonation() {
    // Find next alive player who hasn't been asked
    for (let i = 1; i <= 3; i++) {
      const idx = (this.donationRequester + i) % 4;
      if (this.players[idx].isAlive &&
          !this.donationAskedPlayers.includes(idx) &&
          this.players[idx].canDonate()) {
        this.currentDonor = idx; // Track who is being asked
        return { action: 'askDonation', asker: this.donationRequester, donor: idx };
      }
    }

    // No one can donate - eliminate player
    this.currentDonor = null;
    return this.eliminatePlayer(this.donationRequester);
  }

  /**
   * Handle donation response
   * @param {number} donorIndex - Player being asked
   * @param {boolean} accepts - Whether they accept
   * @param {string} color - Color to donate (if accepting)
   */
  handleDonation(donorIndex, accepts, color = null) {
    if (this.phase !== 'donation') {
      throw new Error('Not in donation phase');
    }

    // Validate that this is the player currently being asked
    if (this.currentDonor !== null && donorIndex !== this.currentDonor) {
      throw new Error(`Player ${donorIndex} is not the current donor (expected ${this.currentDonor})`);
    }

    this.donationAskedPlayers.push(donorIndex);

    if (accepts && color) {
      // Donation accepted
      const donor = this.players[donorIndex];
      const requester = this.players[this.donationRequester];

      donor.donatePrisoner(color);
      requester.receiveDonation(color);

      this.phase = 'selectChip';
      this.donationRequester = null;
      this.donationAskedPlayers = [];
      this.currentDonor = null;

      return { action: 'donationAccepted', donor: donorIndex, color };
    }

    // Refused - ask next player
    return this.askNextDonation();
  }

  /**
   * Eliminate a player
   * @param {number} playerIndex
   */
  eliminatePlayer(playerIndex) {
    this.players[playerIndex].eliminate();

    this.donationRequester = null;
    this.donationAskedPlayers = [];
    this.currentDonor = null;

    // Check win condition
    if (this.checkWinCondition()) {
      return { action: 'gameOver', winner: this.winner };
    }

    // Pass turn to next alive player
    const nextAlive = this.getAlivePlayers()[0];
    this.currentPlayer = nextAlive.id;

    // Check if next player can play
    if (!nextAlive.hasChips()) {
      return this.startDonation();
    }

    this.phase = 'selectChip';
    return { action: 'eliminated', player: playerIndex, nextPlayer: this.currentPlayer };
  }

  /**
   * Check if game is over
   */
  checkWinCondition() {
    const alive = this.getAlivePlayers();
    if (alive.length === 1) {
      this.winner = alive[0].id;
      this.phase = 'gameOver';
      return true;
    }
    return false;
  }

  // ==========================================
  // NEGOTIATION METHODS
  // ==========================================

  /**
   * Add a chat message
   * @param {number} playerIndex - Who sent the message
   * @param {string} text - Message content
   */
  addMessage(playerIndex, text) {
    if (!text.trim()) return;
    const player = this.players[playerIndex];
    this.messages.push({
      player: playerIndex,
      color: player.color,
      text: text.trim(),
      timestamp: Date.now()
    });
  }

  /**
   * Make a promise
   * @param {number} playerIndex - Who is making the promise
   * @param {string} text - Promise content
   */
  makePromise(playerIndex, text) {
    if (!text.trim()) return null;
    const player = this.players[playerIndex];
    const promise = {
      id: this.promiseIdCounter++,
      player: playerIndex,
      color: player.color,
      text: text.trim(),
      broken: false,
      timestamp: Date.now()
    };
    this.promises.push(promise);
    return promise;
  }

  /**
   * Mark a promise as broken
   * @param {number} promiseId - ID of promise to break
   */
  breakPromise(promiseId) {
    const promise = this.promises.find(p => p.id === promiseId);
    if (promise && !promise.broken) {
      promise.broken = true;
      promise.brokenAt = Date.now();
      return true;
    }
    return false;
  }

  /**
   * Propose a trade
   * @param {number} fromPlayer - Who is proposing
   * @param {number} toPlayer - Who the trade is offered to
   * @param {string} offer - What is being offered
   * @param {string} want - What is wanted in return
   */
  proposeTrade(fromPlayer, toPlayer, offer, want) {
    if (!offer.trim() || !want.trim()) return null;
    const from = this.players[fromPlayer];
    const to = this.players[toPlayer];
    const trade = {
      id: this.tradeIdCounter++,
      from: fromPlayer,
      fromColor: from.color,
      to: toPlayer,
      toColor: to.color,
      offer: offer.trim(),
      want: want.trim(),
      status: 'pending', // pending, accepted, rejected, broken
      timestamp: Date.now()
    };
    this.trades.push(trade);
    return trade;
  }

  /**
   * Respond to a trade proposal
   * @param {number} tradeId - ID of trade
   * @param {boolean} accept - Whether to accept
   */
  respondToTrade(tradeId, accept) {
    const trade = this.trades.find(t => t.id === tradeId);
    if (trade && trade.status === 'pending') {
      trade.status = accept ? 'accepted' : 'rejected';
      trade.respondedAt = Date.now();
      return true;
    }
    return false;
  }

  /**
   * Mark a trade as broken
   * @param {number} tradeId - ID of trade to break
   */
  breakTrade(tradeId) {
    const trade = this.trades.find(t => t.id === tradeId);
    if (trade && trade.status === 'accepted') {
      trade.status = 'broken';
      trade.brokenAt = Date.now();
      return true;
    }
    return false;
  }

  /**
   * Give a prisoner from one player to another
   * @param {number} fromPlayer - Player giving the prisoner
   * @param {number} toPlayer - Player receiving the prisoner
   * @param {string} color - Color of prisoner to give
   */
  givePrisoner(fromPlayer, toPlayer, color) {
    const from = this.players[fromPlayer];
    const to = this.players[toPlayer];

    // Validate
    if (!from.isAlive || !to.isAlive) {
      throw new Error('Both players must be alive');
    }
    if (fromPlayer === toPlayer) {
      throw new Error('Cannot give to yourself');
    }
    if (!from.prisoners.includes(color)) {
      throw new Error(`${from.color} does not have a ${color} prisoner`);
    }

    // Transfer
    from.donatePrisoner(color);
    to.receiveDonation(color);

    // Clear selected chip if the current player transferred the chip they had selected
    if (this.currentPlayer === fromPlayer && this.selectedChip === color) {
      this.selectedChip = null;
      this.phase = 'selectChip';
    }

    // Auto-log to chat
    this.addMessage(fromPlayer, `gave a ${color.toUpperCase()} prisoner to ${to.color.toUpperCase()}`);

    return { from: fromPlayer, to: toPlayer, color };
  }

  /**
   * Get full game state snapshot (for UI)
   */
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
      currentDonor: this.currentDonor,
      // Negotiation state
      messages: [...this.messages],
      promises: this.promises.map(p => ({ ...p })),
      trades: this.trades.map(t => ({ ...t }))
    };
  }

  /**
   * Serialize game state to JSON for saving
   */
  toJSON() {
    return {
      version: 1,
      timestamp: Date.now(),
      // Player states
      players: this.players.map(p => ({
        id: p.id,
        color: p.color,
        supply: p.supply,
        prisoners: [...p.prisoners],
        isAlive: p.isAlive
      })),
      // Pile states
      piles: this.piles.map(p => ({
        id: p.id,
        chips: [...p.chips]
      })),
      // Game state
      deadBox: [...this.deadBox],
      currentPlayer: this.currentPlayer,
      phase: this.phase,
      winner: this.winner,
      pileIdCounter: this.pileIdCounter,
      // Temporary state
      selectedChip: this.selectedChip,
      pendingCaptureId: this.pendingCapture?.id ?? null,
      donationRequester: this.donationRequester,
      donationAskedPlayers: [...this.donationAskedPlayers],
      currentDonor: this.currentDonor,
      // Negotiation state
      messages: [...this.messages],
      promises: this.promises.map(p => ({ ...p })),
      trades: this.trades.map(t => ({ ...t })),
      promiseIdCounter: this.promiseIdCounter,
      tradeIdCounter: this.tradeIdCounter
    };
  }

  /**
   * Restore game state from JSON
   * @param {object} data - Saved game data
   */
  fromJSON(data) {
    if (!data || data.version !== 1) {
      throw new Error('Invalid save data');
    }

    // Restore players
    data.players.forEach((p, i) => {
      this.players[i].supply = p.supply;
      this.players[i].prisoners = [...p.prisoners];
      this.players[i].isAlive = p.isAlive;
    });

    // Restore piles
    this.piles = data.piles.map(pData => {
      const pile = new Pile(pData.id);
      pile.chips = [...pData.chips];
      return pile;
    });

    // Restore game state
    this.deadBox = [...data.deadBox];
    this.currentPlayer = data.currentPlayer;
    this.phase = data.phase;
    this.winner = data.winner;
    this.pileIdCounter = data.pileIdCounter;

    // Restore temporary state
    this.selectedChip = data.selectedChip;
    this.pendingCapture = data.pendingCaptureId !== null
      ? this.piles.find(p => p.id === data.pendingCaptureId)
      : null;
    this.donationRequester = data.donationRequester;
    this.donationAskedPlayers = [...(data.donationAskedPlayers || [])];
    this.currentDonor = data.currentDonor ?? null;

    // Restore negotiation state
    this.messages = [...(data.messages || [])];
    this.promises = (data.promises || []).map(p => ({ ...p }));
    this.trades = (data.trades || []).map(t => ({ ...t }));
    this.promiseIdCounter = data.promiseIdCounter || 0;
    this.tradeIdCounter = data.tradeIdCounter || 0;

    console.log('📂 Game state restored from save');
  }
}
