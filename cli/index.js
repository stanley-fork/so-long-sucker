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
  --games N       Total games to run (default: 10)
  --parallel N    Concurrent games (default: 4)
  --provider P    Single LLM provider for all players (default: groq)
  --providers P   Mixed-model: 4 comma-separated providers for Red,Blue,Green,Yellow
                  Example: --providers gemini3,kimi,qwen3,gpt-oss
  --chips N       Chips per player (default: 3)
  --output PATH   Output directory (default: ./data)
  --delay MS      Delay between API calls in ms (default: 500)
  --silent        Disable chat - models can only make game moves (control experiment)
  --headless      Run without interactive TUI
  --help          Show this help

Available providers:
  groq, kimi, qwen3, gpt-oss, groq-llama, gemini, gemini3, 
  openai, claude, azure-claude, azure-kimi, azure-deepseek, openrouter

Examples:
  # Single provider (all 4 players use same model)
  node cli/index.js --games 100 --provider groq

  # Mixed providers (each player uses different model)
  node cli/index.js --games 20 --providers gemini3,kimi,qwen3,gpt-oss

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

  // Valid providers list
  const validProviders = ['groq', 'kimi', 'groq-kimi', 'qwen3', 'groq-qwen3', 'groq-llama', 'groq-gpt-oss', 'gpt-oss', 'openai', 'claude', 'azure-claude', 'azure-kimi', 'azure-deepseek', 'gemini', 'gemini3', 'openrouter-mimo', 'openrouter'];
  
  // Parse --providers for mixed-model mode
  let providersList = null;
  if (args.providers) {
    providersList = args.providers.split(',').map(p => p.trim());
    if (providersList.length !== 4) {
      console.error(`--providers requires exactly 4 comma-separated providers (one per player)`);
      console.error(`Example: --providers gemini3,kimi,qwen3,gpt-oss`);
      process.exit(1);
    }
    for (const p of providersList) {
      if (!validProviders.includes(p)) {
        console.error(`Invalid provider: ${p}`);
        console.error(`Valid providers: ${validProviders.join(', ')}`);
        process.exit(1);
      }
    }
  } else {
    // Single provider mode
    if (!validProviders.includes(args.provider)) {
      console.error(`Invalid provider: ${args.provider}`);
      console.error(`Valid providers: ${validProviders.join(', ')}`);
      process.exit(1);
    }
  }

  // API key mapping
  const apiKeyMap = {
    'groq': ['GROQ_API_KEY', 'VITE_GROQ_API_KEY'],
    'kimi': ['GROQ_API_KEY', 'VITE_GROQ_API_KEY'],
    'groq-kimi': ['GROQ_API_KEY', 'VITE_GROQ_API_KEY'],
    'qwen3': ['GROQ_API_KEY', 'VITE_GROQ_API_KEY'],
    'groq-qwen3': ['GROQ_API_KEY', 'VITE_GROQ_API_KEY'],
    'groq-llama': ['GROQ_API_KEY', 'VITE_GROQ_API_KEY'],
    'groq-gpt-oss': ['GROQ_API_KEY', 'VITE_GROQ_API_KEY'],
    'gpt-oss': ['GROQ_API_KEY', 'VITE_GROQ_API_KEY'],
    'openai': ['OPENAI_API_KEY', 'VITE_OPENAI_API_KEY'],
    'claude': ['CLAUDE_API_KEY', 'VITE_CLAUDE_API_KEY'],
    'azure-claude': ['AZURE_API_KEY', 'VITE_AZURE_CLAUDE_API_KEY', 'AZURE_CLAUDE_API_KEY'],
    'azure-kimi': ['AZURE_API_KEY', 'AZURE_KIMI_API_KEY', 'VITE_AZURE_API_KEY'],
    'azure-deepseek': ['AZURE_DEEPSEEK_API_KEY', 'AZURE_API_KEY', 'VITE_AZURE_API_KEY'],
    'gemini': ['GEMINI_API_KEY', 'VITE_GEMINI_API_KEY'],
    'gemini3': ['GEMINI_API_KEY', 'VITE_GEMINI_API_KEY'],
    'openrouter-mimo': ['OPENROUTER_API_KEY', 'VITE_OPENROUTER_API_KEY'],
    'openrouter': ['OPENROUTER_API_KEY', 'VITE_OPENROUTER_API_KEY']
  };

  // Check API keys for all required providers
  const providersToCheck = providersList || [args.provider];
  for (const provider of providersToCheck) {
    const keyNames = apiKeyMap[provider];
    if (!keyNames) continue;
    const hasKey = keyNames.some(name => process.env[name]);
    if (!hasKey && !['azure-claude', 'azure-kimi', 'azure-deepseek'].includes(provider)) {
      console.error(`Missing API key for ${provider}. Set one of: ${keyNames.join(' or ')}`);
      console.error(`Add it to .env file or environment variable`);
      process.exit(1);
    }
  }

  // Display config
  const providerDisplay = providersList 
    ? `MIXED [${providersList.join(', ')}]`
    : args.provider;

  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║  So Long Sucker - Mass Simulation                             ║
╚═══════════════════════════════════════════════════════════════╝

Config:
  Provider: ${providerDisplay}
  Games:    ${args.games}
  Parallel: ${args.parallel}
  Chips:    ${args.chips}
  Silent:   ${args.silent ? 'YES (no chat - control experiment)' : 'NO (chat enabled)'}
  Output:   ${args.output}
`);

  if (providersList) {
    console.log(`  Player Models:
    Red:    ${providersList[0]}
    Blue:   ${providersList[1]}
    Green:  ${providersList[2]}
    Yellow: ${providersList[3]}
`);
  }

  const tui = new SimulatorTUI({
    totalGames: args.games,
    parallel: args.parallel,
    provider: args.provider,
    providers: providersList, // Pass array of 4 providers for mixed-model
    chips: args.chips,
    outputDir: args.output,
    delay: args.delay,
    silent: args.silent, // No chat mode for control experiments
    headless: args.headless
  });

  await tui.start();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
