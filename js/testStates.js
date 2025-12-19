// Predefined test states for So Long Sucker
// Each state sets up a specific scenario for testing

import { Pile } from './pile.js';

export const TEST_STATES = [
  {
    id: 0,
    name: 'Default',
    description: 'Normal game start - all players have 7 chips',
    apply: null  // null means use default initialization
  },
  {
    id: 1,
    name: 'Red has prisoners',
    description: 'Red has 3 prisoners (blue, green, yellow)',
    apply: (game) => {
      // Red has captured some chips
      game.players[0].supply = 5;
      game.players[0].prisoners = ['blue', 'green', 'yellow'];
      game.players[1].supply = 6;
      game.players[2].supply = 6;
      game.players[3].supply = 6;
      game.currentPlayer = 0;
    }
  },
  {
    id: 2,
    name: 'Red almost winning',
    description: 'Red has many chips, others are low',
    apply: (game) => {
      game.players[0].supply = 6;
      game.players[0].prisoners = ['blue', 'blue', 'green', 'yellow'];
      game.players[1].supply = 1;
      game.players[1].prisoners = [];
      game.players[2].supply = 2;
      game.players[2].prisoners = [];
      game.players[3].supply = 1;
      game.players[3].prisoners = ['red'];
      game.deadBox = ['blue', 'blue', 'green', 'green', 'yellow', 'yellow'];
      game.currentPlayer = 0;
    }
  },
  {
    id: 3,
    name: 'Donation needed',
    description: 'Blue has no chips - needs donation',
    apply: (game) => {
      game.players[0].supply = 5;
      game.players[0].prisoners = ['blue', 'blue'];
      game.players[1].supply = 0;
      game.players[1].prisoners = [];
      game.players[2].supply = 5;
      game.players[2].prisoners = ['blue'];
      game.players[3].supply = 5;
      game.players[3].prisoners = ['blue'];
      game.deadBox = ['blue', 'blue', 'blue'];
      game.currentPlayer = 1;  // Blue's turn but no chips
    }
  },
  {
    id: 4,
    name: 'Capture ready',
    description: 'Pile ready for capture - red on top of red',
    apply: (game) => {
      game.players[0].supply = 5;
      game.players[1].supply = 6;
      game.players[2].supply = 6;
      game.players[3].supply = 6;
      // Create a pile with red at bottom, others on top, red about to capture
      const pile = new Pile(0);
      pile.chips = ['red', 'blue', 'green', 'red'];
      game.piles = [pile];
      game.pileIdCounter = 1;
      game.currentPlayer = 0;
      game.phase = 'capture';
      game.pendingCapture = pile;
    }
  },
  {
    id: 5,
    name: 'Late game - 2 players',
    description: 'Only Red and Blue alive',
    apply: (game) => {
      game.players[0].supply = 3;
      game.players[0].prisoners = ['blue', 'green'];
      game.players[1].supply = 2;
      game.players[1].prisoners = ['red', 'yellow'];
      game.players[2].supply = 0;
      game.players[2].prisoners = [];
      game.players[2].isAlive = false;
      game.players[3].supply = 0;
      game.players[3].prisoners = [];
      game.players[3].isAlive = false;
      game.deadBox = ['green', 'green', 'green', 'yellow', 'yellow', 'yellow'];
      game.currentPlayer = 0;
    }
  },
  {
    id: 6,
    name: 'Choose next player',
    description: 'Pile missing 2 colors - must choose who plays next',
    apply: (game) => {
      game.players[0].supply = 5;
      game.players[1].supply = 6;
      game.players[2].supply = 6;
      game.players[3].supply = 6;
      // Pile with only red and blue - green/yellow missing
      const pile = new Pile(0);
      pile.chips = ['red', 'blue'];
      game.piles = [pile];
      game.pileIdCounter = 1;
      game.currentPlayer = 0;
      // Set phase to selectNextPlayer so modal appears
      game.phase = 'selectNextPlayer';
    }
  },
  {
    id: 7,
    name: 'Multiple piles',
    description: 'Several piles in play',
    apply: (game) => {
      game.players[0].supply = 4;
      game.players[0].prisoners = ['blue'];
      game.players[1].supply = 4;
      game.players[1].prisoners = ['red'];
      game.players[2].supply = 5;
      game.players[2].prisoners = [];
      game.players[3].supply = 5;
      game.players[3].prisoners = [];
      const pile0 = new Pile(0);
      pile0.chips = ['red', 'blue', 'green'];
      const pile1 = new Pile(1);
      pile1.chips = ['yellow', 'red'];
      const pile2 = new Pile(2);
      pile2.chips = ['blue'];
      game.piles = [pile0, pile1, pile2];
      game.pileIdCounter = 3;
      game.currentPlayer = 0;
    }
  },
  {
    id: 8,
    name: 'Prisoner exchange test',
    description: 'Multiple players have prisoners to trade',
    apply: (game) => {
      game.players[0].supply = 4;
      game.players[0].prisoners = ['blue', 'blue', 'green'];
      game.players[1].supply = 4;
      game.players[1].prisoners = ['red', 'yellow'];
      game.players[2].supply = 4;
      game.players[2].prisoners = ['red', 'yellow'];
      game.players[3].supply = 4;
      game.players[3].prisoners = ['green', 'blue'];
      game.currentPlayer = 0;
    }
  }
];

/**
 * Apply a test state to a game instance
 * @param {Game} game - The game instance
 * @param {number} stateId - The test state ID to apply
 */
export function applyTestState(game, stateId) {
  const state = TEST_STATES.find(s => s.id === stateId);
  if (!state) {
    console.warn(`Test state ${stateId} not found, using default`);
    return;
  }

  if (state.apply) {
    // Reset game first
    game.reset();

    // Apply the test state modifications
    state.apply(game);

    console.log(`🧪 Applied test state: ${state.name}`);
  }
}
