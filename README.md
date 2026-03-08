# So Long Sucker

Web app, simulation lab, and research benchmark for studying negotiation, betrayal, and deception in large language models.

> Original game: "So Long Sucker" (originally "Fuck You, Buddy"), created in 1950 by John Nash, Lloyd Shapley, Mel Hausner, and Martin Shubik.

![Players](https://img.shields.io/badge/players-4-blue)
![Stack](https://img.shields.io/badge/stack-vanilla_js%20%2B%20vite-black)
![Focus](https://img.shields.io/badge/focus-AI%20deception%20research-red)

**Play online:** `https://so-long-sucker.vercel.app`

## What this repo contains

This repository is not just a playable board game adaptation.

It combines three things in one codebase:

1. A browser version of So Long Sucker where humans can play against AI models
2. A Node.js CLI for running large batches of AI-vs-AI simulations
3. A research workspace with papers, benchmark assets, analysis scripts, reports, slides, and raw derived datasets

The core research question is simple: when you put LLMs into a game where betrayal is structurally necessary, what kinds of deception emerge?

## Why this game

So Long Sucker is unusually good for deception research because it has:

- perfect information: every chip and pile is visible
- unavoidable conflict: only one player can win
- negotiation pressure: alliances help you survive, but must eventually break
- scalable complexity: 3-chip, 5-chip, and 7-chip settings create short, medium, and long strategic horizons

That makes it a good lab for testing whether models merely sound strategic or actually sustain multi-turn manipulation.

## Main findings so far

Across the materials in this repo, the project reports three main phases of work:

- **Phase 1 - AI vs AI:** 146 completed games across Gemini 3 Flash, GPT-OSS 120B, Kimi K2, and Qwen3 32B
- **Phase 2 - Human vs AI:** 605 completed public browser games with one human facing three AIs
- **Phase 3 pilot:** new models plus formal negotiation tools such as promises and trades

Highlights documented in the paper and reports:

- Gemini dominated long, chat-enabled AI-only games and developed the "Alliance Bank" pattern
- Human players won 88.4% of completed human-vs-AI games
- deception that worked on AI opponents transferred poorly to humans
- the benchmark suggests a "complexity reversal": some models improve as longer strategic games give manipulation time to compound, while others collapse
- formal negotiation tooling in the Phase 3 pilot changed model behavior again, especially for Gemini, Claude, and Maverick

Primary writeups:

- `analysis/paper_so_long_sucker_sim_llm.md`
- `analysis/blogv2.md`
- `analysis/blogv3.md`
- `paper/main.pdf`
- `analysis/benchmark_scores.json`

## Blog guide

The repo has multiple blog/report versions because the project evolved in public across several research phases.

### `blog.html`

This is the earlier AI-vs-AI focused story.

It centers on:

- the original AI-only study
- the complexity reversal result
- Gemini's "Alliance Bank" manipulation pattern
- the lying vs. bullshitting framing
- the Gemini mirror-match result, where manipulation largely disappeared against copies of itself

Use this if you want the shortest narrative introduction to the original deception findings.

### `blog2.html` / `analysis/blogv2.md`

This is the main Phase 1 + Phase 2 public writeup.

It adds the human-vs-AI results on top of the earlier AI-only work and is the best all-around overview of the project.

It covers:

- 146 AI-vs-AI games
- 605 completed human-vs-AI games
- the 88.4% human win rate
- Gemini's collapse from dominant AI-only performance to weak human-facing performance
- model-by-model comparisons against human opponents
- team-composition effects and abandonment/session funnel analysis

If you read only one blog post to understand the repo's main public-facing research story, read this one.

### `analysis/blogv3.md`

This is the ongoing Phase 3 pilot writeup.

It documents the next version of the environment, where the game includes formal negotiation tools instead of relying only on free-form chat.

Key additions discussed there:

- structured promises and trades as first-class game objects
- new models including Claude Sonnet 4.6, Claude Opus 4.6, Llama 4 Maverick, and GLM-5
- early findings on tool usage, incomplete/stuck sessions, and shifting model rankings
- pilot observations that may change as more runs complete

Treat this document as a living status report rather than a final paper-style result.

## Project surfaces

### Browser app

The browser side is a vanilla JavaScript app bundled with Vite.

Key entry points:

- `index.html` - landing page and research-facing homepage
- `game.html` - play against AI / run in-browser simulations
- `js/main.js` - browser app controller
- `js/game.js` - game rules and state transitions
- `js/ui.js` - DOM rendering
- `js/ai/manager.js` - browser AI turn orchestration
- `js/ai/tools.js` - browser tool definitions exposed to models

Features in the browser app include:

- human vs AI play
- AI vs AI simulation mode
- support for multiple model providers
- session collection hooks for research upload/storage
- hidden/private reasoning support for models using the `think` tool

### CLI simulator

The CLI is the research workhorse for repeatable batch experiments.

Key files:

- `cli/index.js` - CLI entry point
- `cli/HeadlessGame.js` - headless game runner and negotiation engine
- `cli/SimulatorTUI.js` - terminal UI
- `cli/providers.js` - provider wiring for Node.js
- `cli/DataCollector.js` - structured output capture
- `cli/analyze.js`
- `cli/analyze-models.js`
- `cli/aggregate.js`

CLI-specific capabilities include:

- single-model and mixed-model lineups
- parallel batch runs
- silent mode control experiments
- headless execution for long background jobs
- v2 output format with decision snapshots and `off_turn` negotiation snapshots
- formal negotiation actions such as `givePrisoner`, `makePromise`, `breakPromise`, `proposeTrade`, `respondToTrade`, and `breakTrade`

### Research website pages

This repo also ships static research-facing pages:

- `blog.html` - earlier AI-vs-AI writeup
- `blog2.html` - Phase 1 + Phase 2 public writeup
- `benchmark.html` - SLS-Bench v1 leaderboard and methodology
- `results.html` - visual research summary page
- `analysis/presentation.html` - slide deck version of the findings

## Quick start

### Prerequisites

- Node.js 18+
- one or more model API keys if you want to play against AI or run simulations

### Install

```bash
git clone https://github.com/lout33/so-long-sucker.git
cd so-long-sucker
npm install
```

### Run locally

```bash
npm run dev
```

Open `http://localhost:5173`.

### Production build

```bash
npm run build
npm run preview
```

## Environment variables

The project supports several providers. In practice, you only need the keys for the models you want to use.

Common variables:

```bash
GROQ_API_KEY=
GEMINI_API_KEY=
OPENAI_API_KEY=
CLAUDE_API_KEY=
OPENROUTER_API_KEY=

# Optional browser-injected variants
VITE_GROQ_API_KEY=
VITE_GEMINI_API_KEY=
VITE_OPENAI_API_KEY=
VITE_CLAUDE_API_KEY=
VITE_OPENROUTER_API_KEY=
```

There is also support in the codebase for Azure and Bedrock-backed variants in the CLI.

Do not commit `.env` files.

## Playing the game

Short version:

- 4 players, one color each
- on your turn, play exactly one chip
- if your chip matches the color directly below it, you capture the pile
- after a capture, kill one chip and take the rest as prisoners
- if no capture happens, next-player selection depends on which colors are missing from the pile
- if a player has no chips when their turn arrives, others may donate; if all refuse, that player is eliminated
- last player alive wins

Detailed rules live in `RULES.md`.

## CLI usage

Basic examples:

```bash
npm run simulate
npm run simulate -- --games 1 --provider groq --chips 3
npm run simulate -- --games 20 --providers gemini3,kimi,qwen3,gpt-oss --chips 7
npm run simulate -- --games 10 --chips 5 --silent
npm run simulate -- --games 100 --parallel 4 --headless
```

Important defaults and behavior:

- default output directory is `./data_v2`
- `--provider` uses one model for all four players
- `--providers` expects exactly four comma-separated providers, one per color seat
- `--silent` disables chat and negotiation for control experiments
- `--headless` disables the TUI

Full CLI documentation: `CLI.md`

## Supported providers

The repo currently includes browser and/or CLI support for these families:

- Groq-hosted models
- Gemini
- OpenAI
- Anthropic Claude
- OpenRouter
- Azure-backed variants
- AWS Bedrock Claude variants
- Llama 4 Maverick / Scout variants
- GLM-5 variants

The exact provider IDs accepted by the CLI are listed in `cli/index.js`.

## Research assets in this repo

### Papers and manuscripts

- `paper/main.tex` - main LaTeX source
- `paper/main.pdf` - compiled paper PDF
- `paper/refs.bib` - bibliography
- `analysis/paper_so_long_sucker_sim_llm.md` - long-form paper draft in Markdown
- `analysis/paper_so_long_sucker_sim_llm.pdf` - PDF export of the Markdown paper
- `paper/arxiv_submission.zip` - paper packaging artifact

### Benchmark and reports

- `analysis/benchmark_scores.json` - SLS-Bench v1 model scores and scoring rationale
- `analysis/blog.md` - early blog/report version
- `analysis/blogv2.md` - Phase 1 + Phase 2 writeup
- `analysis/blogv3.md` - Phase 3 pilot writeup
- `analysis/hackathon_summary.py` - generated summary for hackathon submission

### Analysis code

- `analysis/deep_analysis.py`
- `analysis/deep_analysis_v2.py`
- `analysis/deep_think_analysis.py`
- `analysis/depaulo_analysis.py`
- `analysis/hallucination_analysis.py`
- `analysis/hallucination_deep.py`
- `analysis/lying_vs_bullshitting.py`
- `analysis/adversarial_analysis.py`
- `analysis/eda.py`
- `analysis/generate_figures.py`
- `analysis/analysis_colab.py`
- `analysis/full_analysis.ipynb`
- `analysis/complexity_analysis.ipynb`
- `analysis/main.ipynb`

### Derived datasets and extracted artifacts

- `analysis/game_outcomes.json`
- `analysis/game_outcomes_full.json`
- `analysis/extracted_messages.json`

### Slides and visual assets

- `analysis/presentation.html`
- `analysis/slides/Deception Scales_ How Strategic Manipulation Emerges in Complex LLM Negotiations (4).pdf`
- `analysis/slides/slide_1_title.jpg`
- `analysis/slides/slide_2_game.jpg`
- `analysis/slides/slide_3_experiment.jpg`
- `analysis/slides/slide_4_reversal.jpg`
- `analysis/slides/slide_5_deception.jpg`
- `analysis/slides/slide_6_conclusion.jpg`
- `paper/fig1_complexity_reversal.png`
- `paper/fig2_win_rates_complexity.png`
- `paper/fig3_talkers_paradox.png`
- `paper/fig4_chat_impact.png`
- `paper/fig5_game_length.png`
- `paper/fig6_human_vs_ai.png`
- `paper/fig7_model_collapse.png`
- `paper/fig8_ai_targeting.png`
- `paper/fig9_survival_vs_manipulation.png`

## Data format notes

The repo now uses the v2 simulation output format for CLI runs.

Important details:

- CLI sessions default to `./data_v2`
- non-silent runs can emit `off_turn` snapshots when inactive players negotiate between turns
- formal promises and trades are tracked in structured game state, not just chat text

If you are writing new analytics, treat `off_turn` as a first-class event type. Older analyzer scripts may undercount chat, negotiation, or token totals on v2 non-silent data.

## Repository map

```text
.
|- index.html              # landing page
|- game.html               # playable game UI
|- benchmark.html          # benchmark page
|- results.html            # research summary page
|- blog.html               # early writeup
|- blog2.html              # main public writeup
|- js/                     # browser app and providers
|- cli/                    # batch simulation and analyzers
|- analysis/               # papers, reports, datasets, scripts, slides
|- paper/                  # LaTeX paper source and figures
|- public/                 # sitemap, robots, OG image
|- RULES.md                # game rules
|- CLI.md                  # CLI docs
```

## Development notes

- frontend is plain DOM manipulation, no React/Vue/etc.
- modules use ESM imports with explicit `.js` extensions
- browser and CLI share the same underlying game concepts, but not the exact same runtime surface
- browser code includes Supabase upload hooks for session summaries/storage
- the codebase contains stuck-state recovery logic for both browser and CLI agents

## Recommended workflows

### Run a quick manual game

```bash
npm run dev
```

Then open `game.html` and play against one or more AI players.

### Run a short local experiment

```bash
npm run simulate -- --games 1 --chips 3 --provider groq
```

### Run a mixed-model benchmark slice

```bash
npm run simulate -- --games 20 --providers gemini3,kimi,qwen3,gpt-oss --chips 7
```

### Inspect outputs

```bash
node cli/analyze.js ./data_v2/session-*.json
```

## Related docs

- `RULES.md` - full rules and annotated examples
- `CLI.md` - command-line usage
- `AGENTS.md` - repo-specific engineering notes
- `docs/claude.md` - Claude Foundry reference kept in-repo
- `docs/gemini.md` - Gemini API reference notes kept in-repo

## Credits

- Original game design: John Nash, Lloyd Shapley, Mel Hausner, Martin Shubik
- Research and implementation: Luis Fernando Yupanqui, Mari Cairns

## License

Repository license metadata is currently `ISC` in `package.json`.
