# So Long Sucker - Project Context

## What is this?

A web implementation of "So Long Sucker" — a 4-player negotiation/betrayal board game created by game theorists John Nash, Lloyd Shapley, Mel Hausner, and Martin Shubik in 1950.

**Goal:** Build a minimal playable version, then potentially add LLM players to study AI deception/negotiation.

---

## Tech Stack

- **Vanilla JavaScript** (no frameworks)
- **Single HTML page**
- **CSS** for styling
- **Local hot-seat multiplayer** (all players on same screen)

---

## Project Structure

```
so-long-sucker/
├── index.html          # Game page
├── style.css           # Styling
├── js/
│   ├── main.js         # Entry point, game loop
│   ├── game.js         # Game state & rules
│   ├── player.js       # Player class
│   ├── pile.js         # Pile mechanics
│   └── ui.js           # DOM rendering
├── RULES.md            # Complete game rules
└── CLAUDE.md           # This file
```

---

## Game State Model

```javascript
{
  players: [
    { id: 0, color: 'red', supply: 7, prisoners: [], isAlive: true },
    { id: 1, color: 'blue', supply: 7, prisoners: [], isAlive: true },
    { id: 2, color: 'green', supply: 7, prisoners: [], isAlive: true },
    { id: 3, color: 'yellow', supply: 7, prisoners: [], isAlive: true }
  ],
  piles: [],           // Array of chip stacks
  deadBox: [],         // Killed chips
  currentPlayer: 0,    // Player index
  phase: 'selectChip', // Game phase
  winner: null
}
```

**Phases:**
- `selectChip` - Player choosing which chip to play
- `selectPile` - Player choosing which pile to play on
- `selectNextPlayer` - Player choosing who goes next (when multiple options)
- `capture` - Resolving a capture (choose chip to kill)
- `donation` - Asking for donations when player has no chips
- `gameOver` - Game ended

---

## Implementation Status

### Done
- [x] Project structure created
- [x] Rules documented

### TODO
- [ ] HTML structure (game board, player panels)
- [ ] CSS styling (chip colors, layout)
- [ ] Player class (supply, prisoners, elimination)
- [ ] Pile class (stack, capture detection, next player logic)
- [ ] Game state management
- [ ] UI rendering & event handlers
- [ ] Turn flow logic
- [ ] Donation phase
- [ ] Win condition check

### Future (v2+)
- [ ] LLM player integration
- [ ] Game replay/history
- [ ] Online multiplayer

---

## Key Rules to Implement

1. **Capture:** Chip matches color directly below → capture pile
2. **Next player (missing colors):** Current player chooses from missing
3. **Next player (all colors):** Owner of deepest chip goes
4. **Donation:** If can't play, ask others; all refuse = elimination
5. **Win:** Last player alive

---

## Edge Cases

- All 4 colors in pile → use deepest chip rule
- Cascade elimination (multiple players eliminated in sequence)
- Winner has 0 chips (all others eliminated first)
- Player plays prisoner of own color (still counts as that color)

---

## Commands

```bash
# Start local server (any of these)
python -m http.server 8000
npx serve .
open index.html  # Or just open directly in browser
```

---

## Notes

- Keep UI simple — focus on playability
- All game state visible (perfect information game)
- No hidden mechanics
- Designed for eventual LLM integration (clean state model)
