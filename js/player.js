// Player class for So Long Sucker

export const COLORS = ['red', 'blue', 'green', 'yellow'];
export const DEFAULT_CHIPS = 7;

export class Player {
  constructor(id, color, startingChips = DEFAULT_CHIPS) {
    this.id = id;
    this.color = color;
    this.supply = startingChips;  // Own-color chips
    this.prisoners = [];  // Foreign-color chips
    this.isAlive = true;
  }

  /**
   * Get total chips this player can play
   */
  totalChips() {
    return this.supply + this.prisoners.length;
  }

  /**
   * Check if player has any chips to play
   */
  hasChips() {
    return this.totalChips() > 0;
  }

  /**
   * Get all playable chips as an array
   * Returns: Array of { color, source: 'supply' | 'prisoner' }
   */
  getPlayableChips() {
    const chips = [];

    // Own color chips
    for (let i = 0; i < this.supply; i++) {
      chips.push({ color: this.color, source: 'supply' });
    }

    // Prisoner chips
    for (const color of this.prisoners) {
      chips.push({ color, source: 'prisoner' });
    }

    return chips;
  }

  /**
   * Play a chip (remove from supply or prisoners)
   * @param {string} color - Color of chip to play
   * @returns {string} The color played
   */
  playChip(color) {
    if (color === this.color && this.supply > 0) {
      this.supply--;
      return color;
    }

    const prisonerIndex = this.prisoners.indexOf(color);
    if (prisonerIndex !== -1) {
      this.prisoners.splice(prisonerIndex, 1);
      return color;
    }

    throw new Error(`Player ${this.id} cannot play ${color} chip`);
  }

  /**
   * Receive captured chips as prisoners
   * @param {string[]} chips - Array of chip colors
   */
  receivePrisoners(chips) {
    for (const color of chips) {
      if (color === this.color) {
        // Own color goes back to supply
        this.supply++;
      } else {
        this.prisoners.push(color);
      }
    }
  }

  /**
   * Receive a donated chip
   * @param {string} color - Color of donated chip
   */
  receiveDonation(color) {
    if (color === this.color) {
      this.supply++;
    } else {
      this.prisoners.push(color);
    }
  }

  /**
   * Donate a prisoner to another player
   * @param {string} color - Color to donate (cannot be own color from supply)
   * @returns {string} The donated color
   */
  donatePrisoner(color) {
    const index = this.prisoners.indexOf(color);
    if (index === -1) {
      throw new Error(`Player ${this.id} does not have ${color} prisoner to donate`);
    }
    this.prisoners.splice(index, 1);
    return color;
  }

  /**
   * Check if player can donate (has prisoners)
   */
  canDonate() {
    return this.prisoners.length > 0;
  }

  /**
   * Eliminate this player
   */
  eliminate() {
    this.isAlive = false;
  }

  /**
   * Create a snapshot of player state (for UI)
   */
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
