#!/usr/bin/env node
// CLI Entry Point for So Long Sucker Mass Simulation
// Usage: node cli/index.js --games 100 --provider groq --chips 3

import 'dotenv/config';
import { SimulatorTUI } from './SimulatorTUI.js';
import { parseArgs } from './utils.js';

const HELP = `
So Long Sucker - Mass Simulation CLI

Usage: node cli/index.js [options]

Options:
  --games N      Total games to run (default: 10)
  --parallel N   Concurrent games (default: 4)
  --provider P   LLM provider: groq, openai, claude, azure-claude, azure-kimi (default: groq)
  --chips N      Chips per player (default: 3)
  --output PATH  Output directory (default: ./data)
  --delay MS     Delay between API calls in ms (default: 500)
  --headless     Run without interactive TUI
  --help         Show this help

Examples:
  node cli/index.js --games 100 --provider groq
  node cli/index.js --games 50 --parallel 2 --chips 5
  npm run simulate -- --games 20

Controls (in TUI mode):
  1-9   Focus on game N
  ESC   Back to overview
  q     Quit (auto-saves)
  s     Save & exit
  p     Pause all games
  r     Resume all games
`;

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(HELP);
    process.exit(0);
  }

  // Validate provider
  const validProviders = ['groq', 'openai', 'claude', 'azure-claude', 'azure-kimi', 'gemini'];
  if (!validProviders.includes(args.provider)) {
    console.error(`Invalid provider: ${args.provider}`);
    console.error(`Valid providers: ${validProviders.join(', ')}`);
    process.exit(1);
  }

  // Check API key (supports both VITE_ prefixed and unprefixed)
  const apiKeyNames = {
    'groq': ['GROQ_API_KEY', 'VITE_GROQ_API_KEY'],
    'openai': ['OPENAI_API_KEY', 'VITE_OPENAI_API_KEY'],
    'claude': ['CLAUDE_API_KEY', 'VITE_CLAUDE_API_KEY'],
    'azure-claude': ['AZURE_API_KEY', 'VITE_AZURE_CLAUDE_API_KEY', 'AZURE_CLAUDE_API_KEY'],
    'azure-kimi': ['AZURE_API_KEY', 'AZURE_KIMI_API_KEY', 'VITE_AZURE_API_KEY'],
    'gemini': ['GEMINI_API_KEY', 'VITE_GEMINI_API_KEY']
  }[args.provider];

  const hasKey = apiKeyNames.some(name => process.env[name]);
  if (!hasKey && !['azure-claude', 'azure-kimi'].includes(args.provider)) {
    console.error(`Missing API key. Set one of: ${apiKeyNames.join(' or ')}`);
    console.error(`Add it to .env file or environment variable`);
    process.exit(1);
  }

  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║  🎮 So Long Sucker - Mass Simulation                          ║
╚═══════════════════════════════════════════════════════════════╝

Config:
  Provider: ${args.provider}
  Games:    ${args.games}
  Parallel: ${args.parallel}
  Chips:    ${args.chips}
  Output:   ${args.output}
`);

  const tui = new SimulatorTUI({
    totalGames: args.games,
    parallel: args.parallel,
    provider: args.provider,
    chips: args.chips,
    outputDir: args.output,
    delay: args.delay,
    headless: args.headless
  });

  await tui.start();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
