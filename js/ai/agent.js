// AI Agent for So Long Sucker

import { TOOLS, getToolsForPhase, filterTools } from './tools.js';

const COLORS = ['red', 'blue', 'green', 'yellow'];

export class AIAgent {
  constructor(playerId, provider, game, onAction) {
    this.playerId = playerId;
    this.color = COLORS[playerId];
    this.provider = provider;
    this.game = game;
    this.onAction = onAction; // Callback to execute actions
    this.thoughts = []; // Internal reasoning log
    this.lastActionTime = 0;
    this.consecutiveChats = 0;
    this.consecutiveThinks = 0; // Track thinking loops

    // Per-agent timing for parallel execution
    this.lastRequestTime = 0;
    this.isRequesting = false;
    this.turnInterval = 3000;    // 3s between requests when it's your turn
    this.idleInterval = 10000;   // 10s between requests when not your turn
  }

  /**
   * Check if this agent can make a request (based on individual timing)
   */
  canRequest(isMyTurn = false) {
    if (this.isRequesting) return false;
    const now = Date.now();
    const interval = isMyTurn ? this.turnInterval : this.idleInterval;
    return (now - this.lastRequestTime) >= interval;
  }

  /**
   * Mark request as started
   */
  startRequest() {
    this.isRequesting = true;
  }

  /**
   * Mark request as finished
   */
  finishRequest() {
    this.isRequesting = false;
    this.lastRequestTime = Date.now();
  }

  /**
   * Build the system prompt for the AI
   */
  buildSystemPrompt() {
    return `You are playing "So Long Sucker", a 4-player negotiation game created by John Nash.

RULES:
- 4 players (Red, Blue, Green, Yellow) each start with 7 chips of their color
- On your turn, play 1 chip onto a pile (existing or new)
- CAPTURE: If your chip matches the color directly below it, you capture the pile
  - Kill 1 chip (to dead box), take the rest as prisoners
  - You go again after capturing
- NEXT PLAYER: If no capture:
  - If pile is missing colors, current player chooses from missing colors
  - If all 4 colors present, owner of deepest chip goes next
- DONATION: If you have no chips, others can donate or you're eliminated
- WIN: Last player alive wins

YOU ARE: ${this.color.toUpperCase()} (Player ${this.playerId})

STRATEGY TIPS:
- Form alliances early but remember only ONE can win
- Betrayal is mathematically required - time it well
- Prisoners give flexibility (any color)
- Control who plays next to your advantage
- Negotiate but never fully trust anyone

IMPORTANT RULES FOR YOU:
1. When it's your turn, you MUST take a game action (playChip, selectPile, etc.)
2. You can call MULTIPLE tools at once - e.g., sendChat AND playChip together
3. ALWAYS respond to chat messages from other players - be social and strategic!
4. Keep chat messages short (1-2 sentences max)
5. Don't just think - ACT!`;
  }

  /**
   * Build the user prompt with current game state
   */
  buildUserPrompt(state) {
    const myPlayer = state.players[this.playerId];
    const isMyTurn = state.currentPlayer === this.playerId;

    let prompt = `CURRENT GAME STATE:

YOUR STATUS (${this.color.toUpperCase()}):
- Supply: ${myPlayer.supply} ${this.color} chips
- Prisoners: ${myPlayer.prisoners.length > 0 ? myPlayer.prisoners.join(', ') : 'none'}
- Total chips: ${myPlayer.totalChips}

OTHER PLAYERS:
${state.players.filter((p, i) => i !== this.playerId).map(p =>
  `- ${p.color.toUpperCase()}: ${p.isAlive ? `${p.supply} supply, ${p.prisoners.length} prisoners` : 'ELIMINATED'}`
).join('\n')}

PILES:
${state.piles.length === 0 ? '- No piles yet' : state.piles.map(p =>
  `- Pile ${p.id}: [${p.chips.join(' → ')}] (bottom to top)`
).join('\n')}

DEAD BOX: ${state.deadBox.length > 0 ? state.deadBox.join(', ') : 'empty'}

PHASE: ${state.phase}
CURRENT TURN: ${COLORS[state.currentPlayer].toUpperCase()}${isMyTurn ? ' (YOU)' : ''}
`;

    // Add phase-specific context
    if (state.phase === 'selectChip' && isMyTurn) {
      const playable = [];
      if (myPlayer.supply > 0) playable.push(this.color);
      playable.push(...myPlayer.prisoners);
      prompt += `\nYou must select a chip to play. Available: ${playable.join(', ')}`;
    } else if (state.phase === 'selectPile' && isMyTurn) {
      prompt += `\nYou must choose a pile to play on, or start a new pile.`;
      if (state.piles.length > 0) {
        prompt += ` Pile IDs: ${state.piles.map(p => p.id).join(', ')}`;
      }
    } else if (state.phase === 'selectNextPlayer' && isMyTurn) {
      prompt += `\nYou must choose who plays next from players whose color is missing from the pile.`;
    } else if (state.phase === 'capture' && isMyTurn) {
      prompt += `\nYou captured a pile! Choose which chip to KILL (send to dead box).`;
      prompt += `\nChips in pile: ${state.pendingCapture.chips.join(', ')}`;
    } else if (state.donationRequester !== null) {
      const requester = COLORS[state.donationRequester];
      prompt += `\n${requester.toUpperCase()} has no chips and needs a donation to survive.`;
      if (myPlayer.prisoners.length > 0) {
        prompt += ` You can donate: ${myPlayer.prisoners.join(', ')}`;
      }
    }

    // Add recent chat
    if (state.messages.length > 0) {
      const recent = state.messages.slice(-8);
      const hasHumanMessages = recent.some(m => !m.text.startsWith('🤖') && m.color !== this.color);
      prompt += `\n\nRECENT CHAT:\n${recent.map(m =>
        `${m.color.toUpperCase()}: ${m.text}`
      ).join('\n')}`;
      if (hasHumanMessages) {
        prompt += `\n\n💬 Other players are chatting - respond to them!`;
      }
    }

    // Add previous thoughts if any (to avoid repetition)
    if (this.thoughts.length > 0 && this.consecutiveThinks > 0) {
      prompt += `\n\nYOUR RECENT THOUGHTS:\n${this.thoughts.slice(-3).map(t => `- ${t}`).join('\n')}`;
      prompt += `\n\n⚠️ You've been thinking. Now TAKE ACTION!`;
    }

    if (isMyTurn) {
      prompt += `\n\nIT'S YOUR TURN - You MUST use playChip, selectPile, chooseNextPlayer, or killChip to take your move!`;
    } else {
      prompt += `\n\nWhat do you want to do?`;
    }

    return prompt;
  }

  /**
   * Decide what action to take
   */
  async decide(state) {
    const isMyTurn = state.currentPlayer === this.playerId;
    const myPlayer = state.players[this.playerId];

    // Check if we're dead
    if (!myPlayer.isAlive) {
      return null;
    }

    // Check if donation is being requested from us
    const pendingDonation = state.donationRequester !== null &&
                            state.phase === 'donation' &&
                            myPlayer.prisoners.length > 0;

    // Get available tools for current phase
    let toolNames = getToolsForPhase(state.phase, isMyTurn, pendingDonation);

    // If we've been thinking too much, remove think/wait to force action
    if (this.consecutiveThinks >= 2 && isMyTurn) {
      console.log(`🤖 ${this.color} forcing action after ${this.consecutiveThinks} thinks`);
      toolNames = toolNames.filter(t => !['think', 'wait'].includes(t));
    }

    const tools = filterTools(toolNames);

    // Call LLM
    try {
      const result = await this.provider.call(
        this.buildSystemPrompt(),
        this.buildUserPrompt(state),
        tools
      );

      // Return all tool calls so we can process multiple (chat + action)
      return result.toolCalls.length > 0 ? result.toolCalls : null;
    } catch (error) {
      console.error(`AI Agent ${this.color} error:`, error);
      return null;
    }
  }

  /**
   * Execute all actions returned by the LLM
   */
  executeAll(actions) {
    if (!actions || actions.length === 0) return false;

    let tookGameAction = false;
    for (const action of actions) {
      const result = this.execute(action);
      if (result) tookGameAction = true;
    }
    return tookGameAction;
  }

  /**
   * Execute an action returned by the LLM
   */
  execute(action) {
    if (!action) return false;

    console.log(`🤖 ${this.color.toUpperCase()} executing:`, action.name, action.arguments);

    try {
      switch (action.name) {
        case 'playChip':
          this.consecutiveThinks = 0; // Reset on action
          this.thoughts = []; // Clear thoughts after acting
          this.onAction('selectChip', action.arguments.color);
          return true;

        case 'selectPile':
          this.consecutiveThinks = 0;
          this.thoughts = [];
          const pileId = action.arguments.pileId === 'new' ? null : action.arguments.pileId;
          this.onAction('playOnPile', pileId);
          return true;

        case 'chooseNextPlayer':
          this.consecutiveThinks = 0;
          this.onAction('chooseNextPlayer', action.arguments.playerId);
          return true;

        case 'killChip':
          this.consecutiveThinks = 0;
          this.onAction('resolveCapture', action.arguments.color);
          return true;

        case 'respondToDonation':
          this.consecutiveThinks = 0;
          this.onAction('donate', {
            donor: this.playerId,
            accepts: action.arguments.accept,
            color: action.arguments.color
          });
          return true;

        case 'givePrisoner':
          this.consecutiveThinks = 0;
          this.onAction('givePrisoner', {
            from: this.playerId,
            to: action.arguments.toPlayerId,
            color: action.arguments.color
          });
          return true;

        case 'sendChat':
          this.consecutiveThinks = 0;
          // Rate limit chat
          if (this.consecutiveChats >= 3) {
            console.log(`🤖 ${this.color} chat rate limited`);
            return false;
          }
          // Route through callback with agent's color (currentPlayer may have changed)
          this.onAction('chat', { text: action.arguments.message, color: this.color });
          this.consecutiveChats++;
          return true;

        case 'think':
          this.thoughts.push(action.arguments.thought);
          this.consecutiveThinks++;
          console.log(`🤖 ${this.color} thinks (${this.consecutiveThinks}x):`, action.arguments.thought);
          // Route through callback with agent's color
          this.onAction('think', { thought: action.arguments.thought, color: this.color });
          return false; // Don't count as action

        case 'wait':
          return false; // Explicitly do nothing

        default:
          console.warn(`Unknown action: ${action.name}`);
          return false;
      }
    } catch (error) {
      console.error(`AI execute error:`, error);
      return false;
    }
  }

  /**
   * Reset chat counter (called when other players chat)
   */
  resetChatCounter() {
    this.consecutiveChats = 0;
  }
}
