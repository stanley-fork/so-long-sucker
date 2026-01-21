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
    return `You are ${this.color.toUpperCase()} in "So Long Sucker" - a 4-player negotiation board game.

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

STRATEGY:
- Form alliances early to survive
- Prisoners give flexibility (you can play any color)
- Control who plays next to your advantage
- Betrayal timing matters - too early loses allies, too late loses the game

HOW TO PLAY:
- You can call MULTIPLE tools at once (e.g., sendChat AND playChip together)
- When it's your turn, you MUST take a game action
- Respond to other players' messages - negotiation is part of the game
- Keep chat messages brief (1-2 sentences)`;
  }

  /**
   * Build the user prompt with current game state
   */
  buildUserPrompt(state) {
    const myPlayer = state.players[this.playerId];
    const isMyTurn = state.currentPlayer === this.playerId;

    let prompt = `GAME TURN: ${state.turnCount || 0}

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
CURRENT PLAYER: ${COLORS[state.currentPlayer].toUpperCase()}${isMyTurn ? ' (YOU)' : ''}
`;

    // Add recent action history for context
    if (state.actionHistory?.length > 0) {
      const recent = state.actionHistory.slice(-10);
      prompt += `\nRECENT ACTIONS:\n${recent.map(a => 
        `- Turn ${a.turn}: ${a.player.toUpperCase()} ${a.action}`
      ).join('\n')}\n`;
    }

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
    } else if (state.phase === 'donation' && state.donationRequester !== null) {
      const requester = COLORS[state.donationRequester];
      if (state.currentDonor === this.playerId) {
        prompt += `\n⚠️ ${requester.toUpperCase()} has no chips and is ASKING YOU for a donation!`;
        prompt += `\nYou MUST respond using respondToDonation tool. Available to donate: ${myPlayer.prisoners.join(', ')}`;
        prompt += `\nRefusing will move to the next player. If everyone refuses, ${requester.toUpperCase()} is eliminated.`;
      } else {
        prompt += `\n${requester.toUpperCase()} has no chips and is asking for donations. Waiting for ${COLORS[state.currentDonor]?.toUpperCase() || 'next player'} to respond.`;
      }
    }

    // Add chat history (last 50 messages for context)
    if (state.messages.length > 0) {
      const recent = state.messages.slice(-50);
      const hasOtherMessages = recent.some(m => m.color !== this.color);
      prompt += `\n\nCHAT HISTORY:\n${recent.map(m =>
        `${m.color.toUpperCase()}: ${m.text}`
      ).join('\n')}`;
      if (hasOtherMessages) {
        prompt += `\n\nConsider responding to the chat or continuing negotiations.`;
      }
    }

    // Add previous thoughts if any (to avoid repetition)
    if (this.thoughts.length > 0 && this.consecutiveThinks > 0) {
      prompt += `\n\nYOUR RECENT THOUGHTS:\n${this.thoughts.slice(-3).map(t => `- ${t}`).join('\n')}`;
      prompt += `\n\nYou've been thinking. Now take action.`;
    }

    if (isMyTurn) {
      prompt += `\n\nIT'S YOUR TURN - Take your game action now.`;
    } else {
      prompt += `\n\nIt's ${COLORS[state.currentPlayer].toUpperCase()}'s turn. You can chat while waiting.`;
    }

    return prompt;
  }

  /**
   * Decide what action to take
   * Returns: { toolCalls, metadata, context } or null
   */
  async decide(state) {
    const isMyTurn = state.currentPlayer === this.playerId;
    const myPlayer = state.players[this.playerId];

    // Check if we're dead
    if (!myPlayer.isAlive) {
      return null;
    }

    // Check if donation is being requested from us specifically
    const pendingDonation = state.phase === 'donation' &&
                            state.currentDonor === this.playerId &&
                            myPlayer.prisoners.length > 0;

    // Get available tools for current phase
    let toolNames = getToolsForPhase(state.phase, isMyTurn, pendingDonation);

    // If we've been thinking too much, remove think/wait to force action
    if (this.consecutiveThinks >= 2 && isMyTurn) {
      console.log(`🤖 ${this.color} forcing action after ${this.consecutiveThinks} thinks`);
      toolNames = toolNames.filter(t => !['think', 'wait'].includes(t));
    }

    const tools = filterTools(toolNames);
    const userPrompt = this.buildUserPrompt(state);

    // Call LLM
    try {
      const result = await this.provider.call(
        this.buildSystemPrompt(),
        userPrompt,
        tools
      );

      // Return tool calls with metadata and context for data collection
      return {
        toolCalls: result.toolCalls.length > 0 ? result.toolCalls : null,
        metadata: result.metadata || null,
        context: {
          userPrompt,
          availableTools: toolNames
        }
      };
    } catch (error) {
      console.error(`AI Agent ${this.color} error:`, error);
      return { toolCalls: null, metadata: null, error: error.message };
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
