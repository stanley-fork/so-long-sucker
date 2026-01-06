#!/usr/bin/env node
// Model comparison analysis for So Long Sucker mixed-model games
// Usage: node cli/analyze-models.js ./data/session-*.json
// Or:    node cli/analyze-models.js ./data/  (analyzes all sessions in directory)

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { colorize } from './utils.js';

const HELP = `
So Long Sucker - Model Comparison Analysis

Analyzes mixed-model games to compare LLM performance.

Usage: 
  node cli/analyze-models.js <session-file.json> [more files...]
  node cli/analyze-models.js <directory>

Examples:
  node cli/analyze-models.js ./data/session-2026-01-06*.json
  node cli/analyze-models.js ./data/

Output:
  - Win rate by model
  - Elimination order (who gets targeted first)
  - Chat/negotiation patterns by model
  - Betrayal and alliance statistics
  - Head-to-head comparisons
`;

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(HELP);
    process.exit(0);
  }

  // Collect all session files
  const files = [];
  for (const arg of args) {
    try {
      const stat = statSync(arg);
      if (stat.isDirectory()) {
        // Add all .json files in directory
        const dirFiles = readdirSync(arg)
          .filter(f => f.endsWith('.json') && f.startsWith('session-'))
          .map(f => join(arg, f));
        files.push(...dirFiles);
      } else {
        files.push(arg);
      }
    } catch (err) {
      console.error(`Warning: Cannot access ${arg}: ${err.message}`);
    }
  }

  if (files.length === 0) {
    console.error('No session files found');
    process.exit(1);
  }

  console.log(`\nAnalyzing ${files.length} session file(s)...\n`);

  // Load and merge all sessions
  const allSnapshots = [];
  const sessionMeta = [];
  let mixedModelSessions = 0;
  let singleModelSessions = 0;

  for (const file of files) {
    try {
      const raw = readFileSync(file, 'utf-8');
      const data = JSON.parse(raw);
      
      // Check if this is a mixed-model session
      const isMixed = data.session?.playerModels !== null;
      if (isMixed) {
        mixedModelSessions++;
      } else {
        singleModelSessions++;
      }

      sessionMeta.push({
        file,
        ...data.session,
        isMixed
      });

      // Add session context to each snapshot
      for (const snap of data.snapshots || []) {
        allSnapshots.push({
          ...snap,
          sessionId: data.session?.id,
          playerModels: data.session?.playerModels || null,
          sessionModel: data.session?.model || 'unknown'
        });
      }
    } catch (err) {
      console.error(`Warning: Error reading ${file}: ${err.message}`);
    }
  }

  console.log(`Found: ${mixedModelSessions} mixed-model, ${singleModelSessions} single-model sessions\n`);

  const analysis = analyzeModels(allSnapshots, sessionMeta);
  printReport(analysis);
}

function analyzeModels(snapshots, sessionMeta) {
  const colors = ['red', 'blue', 'green', 'yellow'];
  
  // Model stats
  const modelStats = {};
  
  // Position stats (to detect position bias)
  const positionStats = {
    red: { wins: 0, games: 0 },
    blue: { wins: 0, games: 0 },
    green: { wins: 0, games: 0 },
    yellow: { wins: 0, games: 0 }
  };

  // Game tracking
  const games = new Map(); // gameKey -> game data
  
  // Helper to get model for a player in a game
  function getModel(snapshot, color) {
    // First check if model is directly on the decision
    if (snapshot.model) return snapshot.model;
    
    // Then check playerModels from session
    if (snapshot.playerModels && snapshot.playerModels[color]) {
      return snapshot.playerModels[color];
    }
    
    // Fall back to session model (single-provider mode)
    return snapshot.sessionModel || 'unknown';
  }

  // Helper to normalize model names for display
  function normalizeModelName(model) {
    if (!model) return 'unknown';
    // Extract just the model name, not the full path
    if (model.includes('/')) {
      const parts = model.split('/');
      return parts[parts.length - 1].replace(/-instruct|-preview|-0905/g, '');
    }
    return model;
  }

  // Initialize model stats helper
  function ensureModelStats(model) {
    if (!modelStats[model]) {
      modelStats[model] = {
        wins: 0,
        gamesPlayed: 0,
        eliminations: { first: 0, second: 0, third: 0 },
        chatCount: 0,
        thinkCount: 0,
        decisions: 0,
        totalResponseTime: 0,
        totalPromptTokens: 0,
        totalCompletionTokens: 0,
        kills: 0,
        donations: { given: 0, refused: 0 },
        positions: { red: 0, blue: 0, green: 0, yellow: 0 },
        // Negotiation patterns
        allianceProposals: 0,
        betrayalMentions: 0,
        threatCount: 0
      };
    }
    return modelStats[model];
  }

  // Process snapshots
  for (const snap of snapshots) {
    const gameKey = `${snap.sessionId}-${snap.game}`;

    if (snap.type === 'game_start') {
      // Initialize game tracking (don't count games yet - wait for completion)
      const gameModels = {};
      for (const color of colors) {
        const model = normalizeModelName(getModel(snap, color));
        gameModels[color] = model;
        ensureModelStats(model);
      }
      games.set(gameKey, {
        models: gameModels,
        eliminationOrder: [],
        winner: null,
        completed: false
      });
    }

    if (snap.type === 'decision' && snap.llmResponse) {
      const color = snap.player;
      const game = games.get(gameKey);
      if (!game) continue;

      const model = normalizeModelName(game.models[color] || getModel(snap, color));
      const stats = ensureModelStats(model);

      stats.decisions++;
      stats.totalResponseTime += snap.llmResponse.responseTime || 0;
      stats.totalPromptTokens += snap.llmResponse.promptTokens || 0;
      stats.totalCompletionTokens += snap.llmResponse.completionTokens || 0;

      // Analyze tool calls
      for (const tc of snap.llmResponse.toolCalls || []) {
        if (tc.name === 'sendChat') {
          stats.chatCount++;
          const msg = (tc.arguments?.message || '').toLowerCase();
          
          // Detect negotiation patterns
          if (msg.includes('alliance') || msg.includes('team up') || msg.includes('work together') || msg.includes('partner')) {
            stats.allianceProposals++;
          }
          if (msg.includes('betray') || msg.includes('backstab') || msg.includes('lied') || msg.includes('broke')) {
            stats.betrayalMentions++;
          }
          if (msg.includes('kill') || msg.includes('eliminate') || msg.includes('destroy') || msg.includes('target')) {
            stats.threatCount++;
          }
        }
        if (tc.name === 'think') {
          stats.thinkCount++;
        }
        if (tc.name === 'killChip') {
          stats.kills++;
        }
        if (tc.name === 'respondToDonation') {
          if (tc.arguments?.accept) {
            stats.donations.given++;
          } else {
            stats.donations.refused++;
          }
        }
      }
    }

    if (snap.type === 'game_end') {
      const game = games.get(gameKey);
      if (!game) continue;

      game.completed = true;

      // Count games played and positions for all players in this completed game
      for (const color of colors) {
        const model = normalizeModelName(game.models[color]);
        ensureModelStats(model);
        modelStats[model].gamesPlayed++;
        modelStats[model].positions[color]++;
        positionStats[color].games++;
      }

      const winner = snap.winner;
      if (winner && game.models[winner]) {
        const model = normalizeModelName(game.models[winner]);
        ensureModelStats(model).wins++;
        game.winner = winner;
        positionStats[winner].wins++;
      }

      // Track elimination order
      const elimOrder = snap.eliminationOrder || [];
      for (let i = 0; i < elimOrder.length; i++) {
        const color = elimOrder[i];
        const model = normalizeModelName(game.models[color]);
        const stats = ensureModelStats(model);
        if (i === 0) stats.eliminations.first++;
        else if (i === 1) stats.eliminations.second++;
        else if (i === 2) stats.eliminations.third++;
      }
    }
  }

  // Calculate derived stats
  const modelSummary = [];
  for (const [model, stats] of Object.entries(modelStats)) {
    if (stats.gamesPlayed === 0) continue;

    modelSummary.push({
      model,
      wins: stats.wins,
      gamesPlayed: stats.gamesPlayed,
      winRate: (stats.wins / stats.gamesPlayed * 100).toFixed(1),
      eliminatedFirst: stats.eliminations.first,
      eliminatedFirstRate: (stats.eliminations.first / stats.gamesPlayed * 100).toFixed(1),
      avgChat: (stats.chatCount / stats.gamesPlayed).toFixed(1),
      avgThink: (stats.thinkCount / stats.gamesPlayed).toFixed(1),
      avgResponseTime: stats.decisions > 0 ? (stats.totalResponseTime / stats.decisions).toFixed(0) : 0,
      avgTokens: stats.decisions > 0 ? Math.round(stats.totalCompletionTokens / stats.decisions) : 0,
      kills: stats.kills,
      allianceProposals: stats.allianceProposals,
      betrayalMentions: stats.betrayalMentions,
      threatCount: stats.threatCount,
      donationsGiven: stats.donations.given,
      donationsRefused: stats.donations.refused,
      positions: stats.positions
    });
  }

  // Sort by win rate
  modelSummary.sort((a, b) => parseFloat(b.winRate) - parseFloat(a.winRate));

  // Calculate position bias
  const positionSummary = [];
  for (const [color, stats] of Object.entries(positionStats)) {
    if (stats.games === 0) continue;
    positionSummary.push({
      position: color,
      wins: stats.wins,
      games: stats.games,
      winRate: (stats.wins / stats.games * 100).toFixed(1)
    });
  }

  return {
    modelSummary,
    positionSummary,
    totalGames: [...games.values()].filter(g => g.winner).length,
    totalSessions: sessionMeta.length
  };
}

function printReport(analysis) {
  const { modelSummary, positionSummary, totalGames, totalSessions } = analysis;

  console.log(`
${colorize('═══════════════════════════════════════════════════════════════════════', 'cyan')}
${colorize('  MODEL COMPARISON ANALYSIS', 'bold')}
${colorize('═══════════════════════════════════════════════════════════════════════', 'cyan')}

  Sessions: ${totalSessions} | Completed Games: ${totalGames}
`);

  if (modelSummary.length === 0) {
    console.log('  No game data found.\n');
    return;
  }

  // Win Rate Leaderboard
  console.log(`${colorize('─── WIN RATE LEADERBOARD ───', 'yellow')}\n`);
  console.log(`  ${'Rank'.padEnd(6)} ${'Model'.padEnd(25)} ${'Win%'.padStart(7)} ${'Wins'.padStart(6)} ${'Games'.padStart(7)}`);
  console.log(`  ${'-'.repeat(55)}`);

  for (let i = 0; i < modelSummary.length; i++) {
    const m = modelSummary[i];
    const rank = i === 0 ? colorize('1st', 'yellow') : i === 1 ? colorize('2nd', 'gray') : i === 2 ? colorize('3rd', 'gray') : `${i + 1}th`;
    const bar = createBar(parseFloat(m.winRate), 50);
    // For single-model sessions, show actual games not player-games
    const gamesDisplay = modelSummary.length === 1 ? Math.round(m.gamesPlayed / 4) : m.gamesPlayed;
    const actualWinRate = modelSummary.length === 1 ? ((m.wins / gamesDisplay) * 100).toFixed(1) : m.winRate;
    console.log(`  ${rank.padEnd(6)} ${m.model.padEnd(25)} ${actualWinRate.padStart(6)}% ${m.wins.toString().padStart(6)} ${gamesDisplay.toString().padStart(7)}`);
    console.log(`         ${createBar(parseFloat(actualWinRate), 50)}`);
  }

  // Survival Stats
  console.log(`\n${colorize('─── SURVIVAL STATS ───', 'red')}\n`);
  console.log(`  ${'Model'.padEnd(25)} ${'Elim 1st'.padStart(10)} ${'Rate'.padStart(7)}`);
  console.log(`  ${'-'.repeat(45)}`);

  const sortedBySurvival = [...modelSummary].sort((a, b) => parseFloat(a.eliminatedFirstRate) - parseFloat(b.eliminatedFirstRate));
  for (const m of sortedBySurvival) {
    const status = parseFloat(m.eliminatedFirstRate) > 30 ? colorize('(target)', 'red') : parseFloat(m.eliminatedFirstRate) < 15 ? colorize('(survivor)', 'green') : '';
    console.log(`  ${m.model.padEnd(25)} ${m.eliminatedFirst.toString().padStart(10)} ${(m.eliminatedFirstRate + '%').padStart(7)} ${status}`);
  }

  // Behavior Comparison
  console.log(`\n${colorize('─── BEHAVIOR PATTERNS ───', 'cyan')}\n`);
  console.log(`  ${'Model'.padEnd(25)} ${'Chat/G'.padStart(8)} ${'Think/G'.padStart(9)} ${'Resp(ms)'.padStart(10)} ${'Tokens'.padStart(8)}`);
  console.log(`  ${'-'.repeat(65)}`);

  for (const m of modelSummary) {
    console.log(`  ${m.model.padEnd(25)} ${m.avgChat.padStart(8)} ${m.avgThink.padStart(9)} ${m.avgResponseTime.toString().padStart(10)} ${m.avgTokens.toString().padStart(8)}`);
  }

  // Negotiation Style
  console.log(`\n${colorize('─── NEGOTIATION STYLE ───', 'magenta')}\n`);
  console.log(`  ${'Model'.padEnd(25)} ${'Alliances'.padStart(11)} ${'Betrayals'.padStart(11)} ${'Threats'.padStart(9)} ${'Kills'.padStart(7)}`);
  console.log(`  ${'-'.repeat(68)}`);

  for (const m of modelSummary) {
    let style = '';
    const allianceRate = m.allianceProposals / m.gamesPlayed;
    const threatRate = m.threatCount / m.gamesPlayed;
    
    if (allianceRate > 5 && threatRate < 3) style = colorize('[Diplomat]', 'cyan');
    else if (threatRate > 5) style = colorize('[Aggressor]', 'red');
    else if (m.betrayalMentions > m.gamesPlayed * 2) style = colorize('[Backstabber]', 'yellow');
    else style = colorize('[Balanced]', 'gray');

    console.log(`  ${m.model.padEnd(25)} ${m.allianceProposals.toString().padStart(11)} ${m.betrayalMentions.toString().padStart(11)} ${m.threatCount.toString().padStart(9)} ${m.kills.toString().padStart(7)} ${style}`);
  }

  // Position Bias Check
  console.log(`\n${colorize('─── POSITION BIAS CHECK ───', 'gray')}\n`);
  console.log(`  Expected win rate per position: 25%\n`);
  console.log(`  ${'Position'.padEnd(10)} ${'Wins'.padStart(6)} ${'Games'.padStart(7)} ${'Win%'.padStart(7)} ${'Bias'.padStart(8)}`);
  console.log(`  ${'-'.repeat(42)}`);

  for (const p of positionSummary) {
    const bias = parseFloat(p.winRate) - 25;
    const biasStr = bias > 0 ? colorize(`+${bias.toFixed(1)}%`, 'green') : bias < 0 ? colorize(`${bias.toFixed(1)}%`, 'red') : '0%';
    console.log(`  ${p.position.padEnd(10)} ${p.wins.toString().padStart(6)} ${p.games.toString().padStart(7)} ${(p.winRate + '%').padStart(7)} ${biasStr.padStart(8)}`);
  }

  // Key Insights
  console.log(`\n${colorize('─── KEY INSIGHTS ───', 'green')}\n`);

  if (modelSummary.length >= 2) {
    const top = modelSummary[0];
    const bottom = modelSummary[modelSummary.length - 1];

    console.log(`  ${colorize('Best Model:', 'bold')} ${top.model} (${top.winRate}% win rate)`);
    console.log(`  ${colorize('Worst Model:', 'bold')} ${bottom.model} (${bottom.winRate}% win rate)`);

    // Find most talkative
    const mostChat = [...modelSummary].sort((a, b) => parseFloat(b.avgChat) - parseFloat(a.avgChat))[0];
    console.log(`  ${colorize('Most Talkative:', 'bold')} ${mostChat.model} (${mostChat.avgChat} chats/game)`);

    // Find most targeted
    const mostTargeted = [...modelSummary].sort((a, b) => parseFloat(b.eliminatedFirstRate) - parseFloat(a.eliminatedFirstRate))[0];
    console.log(`  ${colorize('Most Targeted:', 'bold')} ${mostTargeted.model} (eliminated first ${mostTargeted.eliminatedFirstRate}%)`);

    // Correlation hints
    const winRates = modelSummary.map(m => parseFloat(m.winRate));
    const chatRates = modelSummary.map(m => parseFloat(m.avgChat));
    const correlation = calculateCorrelation(winRates, chatRates);
    
    if (Math.abs(correlation) > 0.5) {
      const direction = correlation > 0 ? 'MORE' : 'LESS';
      console.log(`  ${colorize('Pattern:', 'bold')} Winners tend to chat ${direction} (correlation: ${correlation.toFixed(2)})`);
    }
  }

  console.log(`
${colorize('═══════════════════════════════════════════════════════════════════════', 'cyan')}
`);
}

function createBar(percentage, maxWidth = 50) {
  const filled = Math.round((percentage / 100) * maxWidth);
  const empty = maxWidth - filled;
  return colorize('█'.repeat(filled), 'green') + colorize('░'.repeat(empty), 'gray');
}

function calculateCorrelation(x, y) {
  if (x.length !== y.length || x.length < 2) return 0;
  
  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((total, xi, i) => total + xi * y[i], 0);
  const sumX2 = x.reduce((total, xi) => total + xi * xi, 0);
  const sumY2 = y.reduce((total, yi) => total + yi * yi, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  return denominator === 0 ? 0 : numerator / denominator;
}

main();
