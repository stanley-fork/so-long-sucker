# AGENTS.md - So Long Sucker

Guidelines for AI agents working on this codebase.

## Project Overview

Web implementation of "So Long Sucker" - a 4-player negotiation/betrayal board game by game theorists John Nash, Lloyd Shapley, Mel Hausner, and Martin Shubik (1950). Includes LLM player integration for AI deception/negotiation research.

## Tech Stack

- Vanilla JavaScript (ES modules)
- Vite for bundling/dev server
- Node.js 18+ for CLI tools
- No frontend framework (plain DOM manipulation)
- dotenv for environment configuration

## Build/Dev Commands

```bash
# Install dependencies
npm install

# Development server (Vite)
npm run dev

# Production build
npm run build

# Preview production build
npm run preview
```

## CLI Simulation Commands

```bash
# Run AI vs AI simulations
npm run simulate

# Single game with specific provider
npm run simulate -- --games 1 --provider groq --chips 3

# Mixed-model simulation (4 different providers)
npm run simulate -- --games 20 --providers gemini3,kimi,qwen3,gpt-oss --chips 7

# Silent mode (no chat between models)
npm run simulate -- --games 10 --chips 5 --silent

# Headless mode (no TUI, good for background runs)
npm run simulate -- --games 100 --parallel 4 --headless

# Analyze session results (data_v2 is the current output directory)
node cli/analyze.js ./data_v2/session-*.json
```

> **Output directory**: Sessions are saved to `./data_v2/` (changed from `./data/` in v2).
> Old `./data/` files are v1 format — backward compatible with analyzers but lack negotiation mechanics.

## Testing

No formal test framework. Manual testing via browser or CLI simulations. Validate changes by:
1. Running `npm run dev` and testing in browser
2. Running short simulations: `npm run simulate -- --games 1 --chips 3`

## Code Style Guidelines

### File Organization

```
js/                    # Browser-side code (ES modules)
  main.js             # Entry point
  game.js             # Game state & rules
  player.js           # Player class
  pile.js             # Pile mechanics
  ui.js               # DOM rendering
  simulation.js       # AI vs AI simulation (hidden - use CLI instead)
  miniGame.js         # Mini game component (hidden - use CLI instead)
  ai/
    agent.js          # AI decision making
    manager.js        # AI turn orchestration
    tools.js          # Tool definitions for LLM
    data-collector.js # Game data collection for analysis
    providers/        # LLM provider implementations
cli/                  # Node.js CLI tools (for AI vs AI simulations)
  index.js            # CLI entry point
  providers.js        # Node.js compatible providers
  HeadlessGame.js     # Headless game runner
  SimulatorTUI.js     # Terminal UI for simulations
```

### Imports

- Use ES module syntax (`import`/`export`)
- Relative imports with `.js` extension
- Named exports preferred over default exports
- Group imports: external libs first, then local modules

```javascript
// Good
import { Player, COLORS, DEFAULT_CHIPS } from './player.js';
import { Pile } from './pile.js';

// Bad - missing extension
import { Player } from './player';
```

### Naming Conventions

- **Classes**: PascalCase (`Game`, `Player`, `AIAgent`)
- **Functions/methods**: camelCase (`getPlayableChips`, `resolveCapture`)
- **Constants**: UPPER_SNAKE_CASE (`COLORS`, `DEFAULT_CHIPS`)
- **Variables**: camelCase (`currentPlayer`, `selectedChip`)
- **File names**: camelCase for JS (`game.js`, `miniGame.js`)

### Class Structure

```javascript
export class Example {
  constructor(param) {
    this.param = param;
  }

  // Public methods - grouped by functionality

  publicMethod() {
    // implementation
  }

  // Private methods (use underscore prefix for internal)

  _privateHelper() {
    // implementation
  }

  // State serialization methods at end

  toState() {
    return { ...this };
  }

  toJSON() {
    return this.toState();
  }
}
```

### Error Handling

- Throw descriptive Error objects for invalid operations
- Use try/catch in async operations (especially API calls)
- Log errors with context (`console.error`)

```javascript
// Good
if (!playable.some(c => c.color === color)) {
  throw new Error('Cannot play this chip');
}

// In async operations
try {
  const result = await this.provider.call(systemPrompt, userPrompt, tools);
} catch (error) {
  console.error(`AI Agent ${this.color} error:`, error);
  return { toolCalls: null, metadata: null, error: error.message };
}
```

### JSDoc Comments

Use JSDoc for public methods with parameters and return types:

```javascript
/**
 * Play selected chip on a pile (or new pile)
 * @param {number|null} pileId - Pile ID to play on, or null for new pile
 * @returns {{ action: string, pile?: Pile }}
 */
playOnPile(pileId) {
  // implementation
}
```

### Game State Model

The canonical game state structure (CLI `Game.getState()` and browser `game.js`):

```javascript
{
  players: [
    { id: 0, color: 'red', supply: 7, prisoners: [], isAlive: true },
    // ... 3 more players
  ],
  piles: [{ id: 0, chips: ['red', 'blue'], missingColors: ['green','yellow'], hasAllColors: false }],
  deadBox: [],
  currentPlayer: 0,
  phase: 'selectChip', // selectChip | selectPile | selectNextPlayer | capture | donation | gameOver
  winner: null,
  donationRequester: null, // player index being asked for chips, or null
  currentDonor: null,      // player index currently being asked to donate, or null
  messages: [],
  promises: [],  // { id, player, color, text, broken, timestamp, brokenAt? }
  trades: []     // { id, from, fromColor, to, toColor, offer, want, status, timestamp, respondedAt?, brokenAt? }
}
```

### LLM Provider Pattern

All providers extend a common interface:

```javascript
class LLMProvider {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  async call(systemPrompt, userPrompt, tools) {
    // Returns: { content, toolCalls, metadata }
    throw new Error('Not implemented');
  }

  getModelName() {
    return this.model;
  }
}
```

### Async/Await

- Use `async/await` over raw Promises
- Implement retry logic for API calls with exponential backoff

```javascript
async call(systemPrompt, userPrompt, tools, maxRetries = 3) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await this._doCall(systemPrompt, userPrompt, tools);
    } catch (error) {
      const isLastAttempt = attempt === maxRetries;
      if (isLastAttempt || !this._isRetryable(error)) throw error;
      await new Promise(r => setTimeout(r, 2000 * Math.pow(2, attempt)));
    }
  }
}
```

## Environment Variables

Required API keys (set in `.env` or environment):

```bash
GROQ_API_KEY=          # For Groq-hosted models (Kimi, Qwen, GPT-OSS)
GEMINI_API_KEY=        # For Google Gemini
OPENAI_API_KEY=        # For OpenAI models
CLAUDE_API_KEY=        # For Anthropic Claude
OPENROUTER_API_KEY=    # For OpenRouter
```

VITE_ prefix supported for browser use.

## Key Domain Concepts

1. **Capture**: Chip matches color directly below -> capture pile
2. **Next player (missing colors)**: Current player chooses from missing
3. **Next player (all colors)**: Owner of deepest chip goes next
4. **Donation**: No chips -> ask others; all refuse = elimination
5. **Win**: Last player alive

## Stuck State Recovery

Both browser (`js/ai/manager.js`) and CLI (`cli/HeadlessGame.js`) implement automatic recovery when AI gets stuck.

**Browser** (`AgentManager`):
- Threshold: **10 cycles** in same phase/player triggers recovery
- Human-aware: skips recovery for human players
- Recovery logged with `🔧` prefix

**CLI** (`HeadlessGame.gameLoop`):
- Threshold: **15 cycles** in same phase + same turn count
- Phases covered: `selectChip`, `selectPile`, `selectNextPlayer`, `capture`, `donation`
- All phases now covered (capture was missing before v2)

Recovery actions per phase (both versions):
- **selectChip**: Auto-select first available chip, or trigger donation if no chips
- **selectPile**: Auto-play on new pile
- **selectNextPlayer**: Auto-choose first alive non-current player
- **capture**: Auto-kill first chip in pile
- **donation**: Auto-refuse from current donor until elimination

## Common Patterns

### Tool Definition (for LLM agents)

```javascript
{
  name: 'playChip',
  description: 'Select a chip to play from your supply or prisoners',
  parameters: {
    type: 'object',
    properties: {
      color: {
        type: 'string',
        enum: ['red', 'blue', 'green', 'yellow'],
        description: 'Color of chip to play'
      }
    },
    required: ['color']
  }
}
```

### State Snapshot Pattern

Classes implement `toState()` for UI rendering and `toJSON()` for serialization:

```javascript
toState() {
  return {
    id: this.id,
    color: this.color,
    supply: this.supply,
    prisoners: [...this.prisoners],
    isAlive: this.isAlive
  };
}
```

## Data Collection Format

Browser and CLI use the same snapshot format for analysis consistency:

```javascript
// Session wrapper
{
  session: {
    id: "session-...",
    provider: "gemini",
    model: "gemini-2.5-flash",
    playerTypes: { red: "human", blue: "ai", green: "ai", yellow: "ai" },
    playerModels: { blue: "gemini-2.5-flash", green: "gemini-2.5-flash", yellow: "gemini-2.5-flash" },
    startTime: 1234567890,
    endTime: 1234567999,
    totalGames: 1,
    chips: 7,
    source: "browser" // or absent for CLI
  },
  snapshots: [...]
}

// Decision snapshot (optimized - no redundant state/chatHistory)
{
  type: "decision",
  turn: 5,
  player: "red",
  playerType: "human", // or "ai"
  model: null,         // null for humans, model name for AI
  phase: "selectChip", // current phase for quick filtering
  newMessages: [...],  // incremental: only NEW chat messages since last snapshot
  llmRequest: null,    // null for humans (contains full state + chat for AI)
  llmResponse: null,   // null for humans
  execution: [{ tool: "playChip", args: { color: "red" }, success: true }],
  timestamp: 1234567890
}

// Off-turn snapshot (CLI v2+ only, non-silent mode)
// Emitted when an inactive player takes a negotiation action between turns.
// Only saved if the agent did something meaningful (not just wait).
{
  type: "off_turn",
  turn: 5,             // same turn number as the active player's decision
  player: "blue",      // the inactive player who acted
  model: "...",
  phase: "selectChip", // the active player's current phase
  newMessages: [...],
  llmRequest: {
    availableTools: [...]  // NOTE: no userPrompt field (unlike decision snapshots)
  },
  llmResponse: {
    responseTime: ...,
    promptTokens: ...,
    completionTokens: ...,
    toolCalls: [...]       // NOTE: no nativeThinking field
  },
  execution: [...],        // only negotiation actions, never game actions
  timestamp: ...
}
```

### Negotiation Tool Execution Results

New tools added in CLI v2. These can appear in `execution[]` of both `decision` and `off_turn` snapshots:

```javascript
{ tool: "givePrisoner",    args: { toPlayerId, color },         success: true, toPlayer: "blue", color: "red" }
{ tool: "makePromise",     args: { text },                      success: true, promiseId: 0 }
{ tool: "breakPromise",    args: { promiseId },                 success: true, broke: true }
{ tool: "proposeTrade",    args: { toPlayerId, offer, want },   success: true, tradeId: 0 }
{ tool: "respondToTrade",  args: { tradeId, accept },           success: true, responded: true, accepted: true }
{ tool: "breakTrade",      args: { tradeId },                   success: true, broke: true }
```

## Analyzer Caveats (CLI v2 data)

The existing analyzer scripts (`analyze.js`, `analyze-models.js`, `aggregate.js`) do not crash on v2 data but produce **silently wrong numbers** for non-silent games. Be aware:

| Issue | Impact |
|---|---|
| `off_turn` snapshots are ignored by all analyzers | Chat/negotiation counts undercount |
| `aggregate.js` does not count `off_turn` LLM calls | Token cost can be **off by up to 3x** in non-silent games |
| `analyze-models.js` has no handlers for the 6 new tools | Promise/trade/givePrisoner activity is invisible in model comparison reports |
| Keyword-scanned alliance/betrayal/threat counts only cover on-turn `sendChat` | Off-turn diplomacy is not measured |

**Safe / unchanged:**
- Win detection and elimination order — fully correct
- `--silent` mode games — no `off_turn` snapshots are produced; all analyzers are accurate
- Old `./data/` session files — backward compatible; absence of new fields is handled gracefully
- Mixed old + new files in `aggregate.js` — safe, just silently inconsistent between session generations

When writing new analysis scripts for v2 data:
- Treat `off_turn` as a first-class snapshot type alongside `decision`
- Count `off_turn` LLM calls toward token totals and chat/negotiation metrics
- Use `promises[]` and `trades[]` from `game_end` state (if captured) or reconstruct from `makePromise`/`proposeTrade` execution entries in snapshots

## Security Notes

- Never commit `.env` files
- API keys should only be in environment variables
- Sanitize chat messages in UI (`escapeHtml`)

## Available Providers

`groq`, `kimi`, `qwen3`, `gpt-oss`, `groq-llama`, `gemini`, `gemini3`, `openai`, `claude`, `azure-claude`, `azure-kimi`, `azure-deepseek`, `openrouter`, `bedrock-sonnet46`, `bedrock-opus46`, `llama4-maverick`, `glm5`
