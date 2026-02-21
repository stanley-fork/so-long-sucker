# So Long Sucker

A 4-player negotiation/betrayal board game where **only one player survives**.

> *Original name: "Fuck You, Buddy"* — Created in 1950 by game theorists **John Nash**, **Lloyd Shapley**, **Mel Hausner**, and **Martin Shubik**.

![Players](https://img.shields.io/badge/players-4-blue) ![AI](https://img.shields.io/badge/AI-LLM%20powered-purple) ![License](https://img.shields.io/badge/license-MIT-green)

**[Play Now](https://so-long-sucker.vercel.app)** | **[Research Blog](https://so-long-sucker.vercel.app/blog2.html)** | **[Full Rules](./RULES.md)** | **[Paper](./paper/)**

---

## Quick Start

**Prerequisites:** Node.js 18+

```bash
git clone https://github.com/lout33/so-long-sucker.git
cd so-long-sucker
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

> To play against AI, add your API key in the setup screen (or set `VITE_GROQ_API_KEY` in `.env`).

---

## The Game

- **4 players** with 7 colored chips each
- **Play chips** on piles — capture when colors match
- **Choose who plays next** based on pile contents
- **Refuse donations** to eliminate players
- **Last player alive wins**

All promises are unenforceable. All alliances will break. **Betrayal is mathematically required to win.**

[Full Rules](./RULES.md)

---

## Game Flow

```mermaid
flowchart TD
    START([Start]) --> TURN[Your Turn]
    TURN --> HAS_CHIPS{Have chips?}
    HAS_CHIPS -->|Yes| PLAY[Play chip on pile]
    HAS_CHIPS -->|No| DONATE[Ask for donation]
    DONATE -->|Someone donates| PLAY
    DONATE -->|All refuse| DEAD[Eliminated]
    PLAY --> CAPTURE{Matches color below?}
    CAPTURE -->|Yes| TAKE[Kill 1 chip, take rest, go again]
    CAPTURE -->|No| NEXT[Next player]
    TAKE --> TURN
    NEXT --> CHECK{1 player left?}
    DEAD --> CHECK
    CHECK -->|No| TURN
    CHECK -->|Yes| WIN([Winner!])
```

---

## Research

This project studies **AI deception in multi-agent negotiation**. Two-phase study:

### Phase 1: AI vs AI (146 games)
- Gemini 3 Flash achieved **70% win rate** through "institutional deception" (fake "Alliance Banks")
- Complex games revealed manipulation that simple benchmarks missed

### Phase 2: Human vs AI (605 games)
- **Humans won 88.4%** (z = 36.03, p < 0.0001)
- AI deception that dominated other AIs **failed catastrophically** against humans
- Gemini collapsed from 70% to 3.7% win rate
- AIs targeted each other 86% of the time while ignoring the human

**Key finding:** AI deception is currently calibrated for AI victims, not humans.

[Read the Full Blog](https://so-long-sucker.vercel.app/blog2.html) | [Paper (ArXiv)](./paper/)

---

## CLI Simulations

Run AI vs AI matches:

```bash
npm run simulate                                    # 10 games with Groq
npm run simulate -- --games 1 --provider groq      # Single test game
npm run simulate -- --providers gemini3,kimi,qwen3,gpt-oss --chips 7  # Mixed models
npm run simulate -- --games 20 --parallel 4        # Parallel execution
```

[Full CLI Documentation](./CLI.md)

---

## Supported AI Providers

| Provider | Models |
|----------|--------|
| Groq | Kimi K2, Qwen3 32B, GPT-OSS 120B, Llama 4 Maverick |
| Google | Gemini 3 Flash, Gemini 2.5 Flash |
| AWS Bedrock | Claude Sonnet 4.6, Claude Opus 4.6 |
| OpenAI | GPT-4o |
| Anthropic | Claude |
| OpenRouter | Various |

---

## Links

| | |
|---|---|
| **Play Online** | [so-long-sucker.vercel.app](https://so-long-sucker.vercel.app) |
| **Research Blog** | [Phase 1 + 2 Findings](https://so-long-sucker.vercel.app/blog2.html) |
| **Paper** | [ArXiv Preprint](./paper/) |
| **Game Rules** | [RULES.md](./RULES.md) |
| **CLI Docs** | [CLI.md](./CLI.md) |
| **GitHub** | [github.com/lout33/so-long-sucker](https://github.com/lout33/so-long-sucker) |

---

## Credits

**Original Game (1950):** John Nash, Lloyd Shapley, Mel Hausner, Martin Shubik

**Research & Implementation:** Luis Fernando Yupanqui, Mari Cairns

---

MIT License
