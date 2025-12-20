# So Long Sucker

A web implementation of the classic 1950 negotiation/betrayal board game created by game theorists **John Nash**, **Lloyd Shapley**, **Mel Hausner**, and **Martin Shubik**.

> *Original name: "Fuck You, Buddy"*

![Game Preview](https://img.shields.io/badge/players-4-blue) ![AI](https://img.shields.io/badge/AI-LLM%20powered-purple) ![License](https://img.shields.io/badge/license-MIT-green)

---

## The Game

**So Long Sucker** is a 4-player game where **betrayal is mathematically required to win**. All promises are unenforceable. All alliances will break. Only one player survives.

### Core Mechanics

- **4 players**, each with 7 colored chips
- **Play chips** onto piles, capture piles when colors match
- **Choose who plays next** based on pile contents
- **Donate or die** — refuse donations to eliminate players
- **Last player standing wins**

### Why It Matters

This game was designed by Nobel laureates to study:
- Coalition formation and breakdown
- Trust and betrayal dynamics
- Negotiation under zero-sum conditions

---

## Features

### Play Mode
- Human vs AI gameplay
- Hot-seat multiplayer (all players on same device)
- Save/load game state
- Export/import games as JSON

### Simulation Mode
- Watch AI vs AI matches
- Run 1-8 parallel games
- Collect statistics on win rates
- Auto-export session logs

### AI Players
Powered by LLMs with strategic reasoning:
- **Groq** (Llama 3.3 70B) — Fast, free tier available
- **Azure Claude** (Opus) — Advanced reasoning
- **OpenAI** (GPT-4o-mini) — Coming soon

---

## Quick Start

```bash
# Clone the repo
git clone https://github.com/yourusername/so-long-sucker.git
cd so-long-sucker

# Install dependencies
npm install

# Start dev server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import repo at [vercel.com](https://vercel.com)
3. Deploy (auto-detects Vite)

### Manual Build

```bash
npm run build
# Output in dist/
```

---

## Data Collection

Game sessions are automatically saved to Supabase for research analysis.

**What's collected:**
- Game configuration (chips, player types)
- All game events (moves, captures, donations, chat)
- Win/loss outcomes
- Session duration

**Privacy:** No personal data collected. All sessions are anonymous.

### Query Examples

```sql
-- Win rates by color
SELECT winner, COUNT(*) as wins
FROM game_sessions
WHERE mode = 'simulation'
GROUP BY winner;

-- Average game length
SELECT AVG(total_turns) as avg_turns
FROM game_sessions;
```

---

## Project Structure

```
so-long-sucker/
├── index.html          # Main page
├── style.css           # Styling
├── js/
│   ├── main.js         # Entry point
│   ├── game.js         # Game state & rules
│   ├── player.js       # Player class
│   ├── pile.js         # Pile mechanics
│   ├── ui.js           # DOM rendering
│   ├── simulation.js   # AI vs AI mode
│   ├── miniGame.js     # Parallel game component
│   ├── config.js       # API keys config
│   ├── testStates.js   # Debug scenarios
│   └── ai/
│       ├── agent.js    # AI decision making
│       ├── manager.js  # AI turn orchestration
│       └── providers/  # LLM integrations
└── api/
    └── supabase.js     # Data collection
```

---

## Game Rules

### Setup
- 4 players with 7 chips each (Red, Blue, Green, Yellow)
- Random starting player

### Turn Flow
1. **Play a chip** on a pile (existing or new)
2. **Check for capture** — if chip matches color below, capture the pile
3. **Determine next player** — based on missing colors or deepest chip

### Capture
When you capture a pile:
1. Kill exactly 1 chip (send to dead box)
2. Take remaining chips as prisoners
3. Take another turn

### Next Player Rules
- **Missing colors:** Current player chooses from players whose color isn't in pile
- **All colors present:** Owner of deepest (bottom) chip goes next

### Donation
If it's your turn but you have no chips:
1. Ask each player for a donation
2. If someone donates → play that chip
3. If all refuse → **you're eliminated**

### Winning
Last player alive wins. You can win with 0 chips.

---

## Configuration

### API Keys

Edit `js/config.js`:

```javascript
export const CONFIG = {
  GROQ_API_KEY: 'your-groq-key',
  AZURE_RESOURCE: 'your-azure-resource'
};
```

Or enter keys in the setup screen (saved to localStorage).

---

## Research Applications

This implementation is designed for studying:

- **AI negotiation** — How do LLMs form and break alliances?
- **Deception detection** — Can AI recognize when it's being betrayed?
- **Multi-agent dynamics** — Emergent behaviors in competitive settings
- **Game theory** — Empirical validation of theoretical predictions

---

## Credits

**Original Game Design (1950)**
- John Nash (Nobel Prize, Economics)
- Lloyd Shapley (Nobel Prize, Economics)
- Mel Hausner
- Martin Shubik

**Web Implementation**
- Built with vanilla JavaScript
- AI powered by Groq, Anthropic, OpenAI
- Data storage by Supabase

---

## License

MIT License — feel free to use, modify, and distribute.

---


  npm run simulate -- --games 1 --provider groq --chips 3

---

## Links

- [Full Game Rules](./RULES.md)
- [Supabase Dashboard](https://supabase.com/dashboard)
- [Vercel Deployment](https://vercel.com)
