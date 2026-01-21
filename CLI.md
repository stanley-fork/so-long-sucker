# CLI Documentation

Run AI vs AI simulations from the command line.

## Quick Start

```bash
npm run simulate
```

## Commands

### Run Simulations

```bash
# Basic simulation (10 games, 4 parallel, groq)
npm run simulate

# Single game test
npm run simulate -- --games 1 --provider groq --chips 3

# Mixed-model simulation (4 different providers)
npm run simulate -- --games 20 --providers gemini3,kimi,qwen3,gpt-oss --chips 7

# Silent mode (no chat between models)
npm run simulate -- --games 10 --chips 5 --silent

# Headless mode (no TUI, good for background runs)
npm run simulate -- --games 100 --parallel 4 --headless
```

### Options

| Flag | Description | Default |
|------|-------------|---------|
| `--games N` | Total games to run | 10 |
| `--parallel N` | Concurrent games | 4 |
| `--provider P` | Single provider for all players | groq |
| `--providers P` | Comma-separated list (4 providers) | — |
| `--chips N` | Chips per player (3, 5, or 7) | 3 |
| `--silent` | Disable chat between models | false |
| `--output PATH` | Output directory | ./data |
| `--headless` | Run without TUI | false |

### Analyze Results

```bash
node cli/analyze.js ./data/session-*.json
```

Outputs:
- Win rates by player color
- Agent behavior stats
- Tool usage breakdown
- Key moments (eliminations, captures)
- Strategic thinking from winners

---

## TUI Controls

When running with the terminal UI:

| Key | Action |
|-----|--------|
| `1-9` | Focus on game N |
| `ESC` | Back to overview |
| `q` | Quit (auto-saves) |
| `p` | Pause all games |
| `r` | Resume all games |

---

## Available Providers

| Provider | Model | Notes |
|----------|-------|-------|
| `groq` | Llama 3.3 70B | Fast, free tier |
| `groq-llama` | Llama 3.3 70B | Same as groq |
| `gemini` | Gemini 2.5 Flash | Google |
| `gemini3` | Gemini 3 Flash | Latest |
| `kimi` | K2 Thinking | Deep reasoning |
| `qwen3` | Qwen3 32B | Quiet strategist |
| `gpt-oss` | GPT-OSS 120B | Reactive |
| `openai` | GPT-4 | OpenAI |
| `claude` | Claude | Anthropic |
| `openrouter` | Various | Multi-model gateway |

---

## Environment Variables

Create a `.env` file or set these in your environment:

```bash
GROQ_API_KEY=          # For Groq-hosted models
GEMINI_API_KEY=        # For Google Gemini
OPENAI_API_KEY=        # For OpenAI models
CLAUDE_API_KEY=        # For Anthropic Claude
OPENROUTER_API_KEY=    # For OpenRouter
```

For browser use, prefix with `VITE_`:

```bash
VITE_GROQ_API_KEY=your-key
```

---

## Research Configuration

The paper used this configuration:

```bash
# 146 games across 3 complexity levels
npm run simulate -- --games 20 --providers gemini3,kimi,qwen3,gpt-oss --chips 3
npm run simulate -- --games 20 --providers gemini3,kimi,qwen3,gpt-oss --chips 5
npm run simulate -- --games 20 --providers gemini3,kimi,qwen3,gpt-oss --chips 7

# With and without chat
npm run simulate -- --games 20 --providers gemini3,kimi,qwen3,gpt-oss --chips 7
npm run simulate -- --games 20 --providers gemini3,kimi,qwen3,gpt-oss --chips 7 --silent
```

---

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import at [vercel.com](https://vercel.com)
3. Add environment variables:
   - `VITE_GROQ_API_KEY`
   - Other `VITE_*` keys as needed
4. Deploy

> Environment variables with `VITE_` prefix are injected at build time.

### Manual Build

```bash
npm run build
# Output in dist/
```
