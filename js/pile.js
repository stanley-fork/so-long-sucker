// Pile class for So Long Sucker

import { COLORS } from './player.js';

export class Pile {
  constructor(id) {
    this.id = id;
    this.chips = [];  // Bottom to top (index 0 = bottom)
  }

  /**
   * Add a chip to the top of the pile
   * @param {string} color - Color of chip to add
   */
  addChip(color) {
    this.chips.push(color);
  }

  /**
   * Get the top chip color
   */
  topChip() {
    return this.chips.length > 0 ? this.chips[this.chips.length - 1] : null;
  }

  /**
   * Check if adding a chip would trigger a capture
   * @param {string} color - Color of chip being added
   * @returns {boolean}
   */
  wouldCapture(color) {
    return this.topChip() === color;
  }

  /**
   * Get colors NOT present in this pile
   * @returns {string[]}
   */
  getMissingColors() {
    const present = new Set(this.chips);
    return COLORS.filter(c => !present.has(c));
  }

  /**
   * Check if all 4 colors are present
   */
  hasAllColors() {
    return this.getMissingColors().length === 0;
  }

  /**
   * Get the owner of the deepest chip (for next player when all colors present)
   * @returns {string} Color of deepest chip
   */
  getDeepestColor() {
    return this.chips[0];  // Bottom of stack
  }

  /**
   * Resolve capture - returns chips to give to capturer
   * @param {string} chipToKill - Color of chip to send to dead box
   * @returns {{ killed: string, captured: string[] }}
   */
  resolveCapture(chipToKill) {
    const killIndex = this.chips.indexOf(chipToKill);
    if (killIndex === -1) {
      throw new Error(`Chip ${chipToKill} not in pile`);
    }

    const killed = this.chips.splice(killIndex, 1)[0];
    const captured = [...this.chips];
    this.chips = [];  // Pile is now empty (will be removed)

    return { killed, captured };
  }

  /**
   * Get pile size
   */
  size() {
    return this.chips.length;
  }

  /**
   * Check if pile is empty
   */
  isEmpty() {
    return this.chips.length === 0;
  }

  /**
   * Create a snapshot of pile state (for UI)
   */
  toState() {
    return {
      id: this.id,
      chips: [...this.chips],
      missingColors: this.getMissingColors(),
      hasAllColors: this.hasAllColors()
    };
  }
}
