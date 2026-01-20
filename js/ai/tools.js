// AI Tool definitions for So Long Sucker

export const TOOLS = [
  {
    name: 'playChip',
    description: 'Select a chip to play. Use this when it is your turn and you need to choose which chip to play.',
    parameters: {
      type: 'object',
      properties: {
        color: {
          type: 'string',
          enum: ['red', 'blue', 'green', 'yellow'],
          description: 'The color of the chip to play (from your supply or prisoners)'
        }
      },
      required: ['color']
    }
  },
  {
    name: 'selectPile',
    description: 'Choose which pile to play your selected chip on. Use "new" to start a new pile.',
    parameters: {
      type: 'object',
      properties: {
        pileId: {
          type: ['integer', 'string'],
          description: 'The pile ID (number) to play on, or "new" to start a new pile'
        }
      },
      required: ['pileId']
    }
  },
  {
    name: 'chooseNextPlayer',
    description: 'Choose who plays next when multiple players are eligible (their color is missing from the pile).',
    parameters: {
      type: 'object',
      properties: {
        playerId: {
          type: 'integer',
          description: 'The player ID (0=Red, 1=Blue, 2=Green, 3=Yellow)'
        }
      },
      required: ['playerId']
    }
  },
  {
    name: 'killChip',
    description: 'During capture, choose which chip to kill (send to dead box). The rest become your prisoners.',
    parameters: {
      type: 'object',
      properties: {
        color: {
          type: 'string',
          enum: ['red', 'blue', 'green', 'yellow'],
          description: 'The color of the chip to kill'
        }
      },
      required: ['color']
    }
  },
  {
    name: 'respondToDonation',
    description: 'When another player has no chips and asks for a donation, accept or refuse.',
    parameters: {
      type: 'object',
      properties: {
        accept: {
          type: 'boolean',
          description: 'Whether to donate a prisoner'
        },
        color: {
          type: 'string',
          enum: ['red', 'blue', 'green', 'yellow'],
          description: 'If accepting, which prisoner color to donate'
        }
      },
      required: ['accept']
    }
  },
  {
    name: 'givePrisoner',
    description: 'Give one of your prisoners to another player as a gift or alliance gesture.',
    parameters: {
      type: 'object',
      properties: {
        toPlayerId: {
          type: 'integer',
          description: 'The player ID to give the prisoner to (0=Red, 1=Blue, 2=Green, 3=Yellow)'
        },
        color: {
          type: 'string',
          enum: ['red', 'blue', 'green', 'yellow'],
          description: 'The color of the prisoner to give'
        }
      },
      required: ['toPlayerId', 'color']
    }
  },
  {
    name: 'sendChat',
    description: 'Send a chat message to negotiate, threaten, make promises, or communicate with other players.',
    parameters: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'The message to send (keep it short and strategic)'
        }
      },
      required: ['message']
    }
  },
  {
    name: 'think',
    description: 'Record your internal reasoning. This is not visible to other players but helps you plan.',
    parameters: {
      type: 'object',
      properties: {
        thought: {
          type: 'string',
          description: 'Your internal reasoning or strategy'
        }
      },
      required: ['thought']
    }
  },
  {
    name: 'wait',
    description: 'Do nothing this cycle. Use when it is not your turn and you have nothing to do.',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  }
];

/**
 * Get tools available for the current game phase
 */
export function getToolsForPhase(phase, isMyTurn, pendingDonation) {
  // During donation phase, limit available tools to avoid confusion
  if (phase === 'donation') {
    if (pendingDonation) {
      // Only the current donor can respond
      return ['sendChat', 'think', 'respondToDonation'];
    }
    // Others should wait during donation
    return ['sendChat', 'think', 'wait'];
  }

  const always = ['sendChat', 'think', 'wait', 'givePrisoner'];

  if (!isMyTurn) {
    return always;
  }

  switch (phase) {
    case 'selectChip':
      return [...always, 'playChip'];
    case 'selectPile':
      return [...always, 'selectPile'];
    case 'selectNextPlayer':
      return [...always, 'chooseNextPlayer'];
    case 'capture':
      return [...always, 'killChip'];
    default:
      return always;
  }
}

/**
 * Filter TOOLS array to only include specified tool names
 */
export function filterTools(toolNames) {
  return TOOLS.filter(t => toolNames.includes(t.name));
}
