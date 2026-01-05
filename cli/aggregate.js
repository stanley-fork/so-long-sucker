#!/usr/bin/env node
// Aggregate analysis across multiple sessions
// Usage: node cli/aggregate.js

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { COLORS, colorize, colorChip } from './utils.js';

const DATA_DIR = './data';

function main() {
  const files = readdirSync(DATA_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => join(DATA_DIR, f));

  console.log(`\nScanning ${files.length} session files...\n`);

  const providers = {};
  const allGames = [];
  let totalCompleted = 0;
  let totalFailed = 0;

  for (const file of files) {
    try {
      const raw = readFileSync(file, 'utf-8');
      const data = JSON.parse(raw);
      
      if (!data.session || !data.snapshots) continue;

      const provider = data.session.provider || 'unknown';
      const model = data.session.model || 'unknown';
      const chips = data.session.chips || 7;

      if (!providers[provider]) {
        providers[provider] = {
          model,
          chips: new Set(),
          games: [],
          completedGames: 0,
          totalTurns: 0,
          winsByColor: { red: 0, blue: 0, green: 0, yellow: 0 },
          totalTokens: 0,
          totalResponseTime: 0,
          decisionCount: 0,
          toolUsage: {},
          chatMessages: 0,
          thinkCalls: 0,
          eliminations: [],
          captures: []
        };
      }

      providers[provider].chips.add(chips);

      // Process snapshots
      let currentGame = null;
      let gameData = {};

      for (const snapshot of data.snapshots) {
        if (snapshot.type === 'game_start') {
          currentGame = snapshot.game;
          gameData[currentGame] = {
            provider,
            turns: 0,
            winner: null,
            completed: false,
            eliminations: [],
            captures: []
          };
        }

        if (snapshot.type === 'decision' && snapshot.llmResponse) {
          const response = snapshot.llmResponse;
          providers[provider].decisionCount++;
          providers[provider].totalResponseTime += response.responseTime || 0;
          providers[provider].totalTokens += (response.promptTokens || 0) + (response.completionTokens || 0);

          for (const tc of response.toolCalls || []) {
            const toolName = tc.name;
            providers[provider].toolUsage[toolName] = (providers[provider].toolUsage[toolName] || 0) + 1;

            if (toolName === 'sendChat') providers[provider].chatMessages++;
            if (toolName === 'think') providers[provider].thinkCalls++;
            
            if (toolName === 'killChip' && gameData[currentGame]) {
              gameData[currentGame].captures.push({
                killer: snapshot.player,
                killed: tc.arguments?.color || 'unknown',
                turn: snapshot.turn
              });
            }
          }

          if (gameData[currentGame]) {
            gameData[currentGame].turns = Math.max(gameData[currentGame].turns, snapshot.turn || 0);
          }
        }

        // Detect game end
        if (snapshot.type === 'game_end' || (snapshot.state && snapshot.state.phase === 'gameOver')) {
          if (snapshot.state && gameData[currentGame]) {
            let winner = snapshot.state.winner;
            if (!winner && snapshot.state.players) {
              const alive = snapshot.state.players.filter(p => p.alive);
              if (alive.length === 1) winner = alive[0].color;
            }

            if (winner) {
              gameData[currentGame].winner = winner;
              gameData[currentGame].completed = true;
              providers[provider].winsByColor[winner]++;
              providers[provider].completedGames++;
              providers[provider].totalTurns += gameData[currentGame].turns;
              totalCompleted++;

              allGames.push({
                provider,
                winner,
                turns: gameData[currentGame].turns,
                chips,
                captures: gameData[currentGame].captures
              });
            }
          }
        }
      }

      // Count incomplete games
      for (const g of Object.values(gameData)) {
        if (!g.completed) totalFailed++;
      }

    } catch (err) {
      // Skip invalid files silently
    }
  }

  printReport(providers, allGames, totalCompleted, totalFailed);
}

function printReport(providers, allGames, totalCompleted, totalFailed) {
  console.log(colorize('═══════════════════════════════════════════════════════════════════════════', 'cyan'));
  console.log(colorize('                    AGGREGATE ANALYSIS - ALL SESSIONS', 'bold'));
  console.log(colorize('═══════════════════════════════════════════════════════════════════════════', 'cyan'));

  console.log(`\n  Total completed games: ${colorize(totalCompleted, 'green')}`);
  console.log(`  Total incomplete/failed: ${colorize(totalFailed, 'red')}`);
  console.log(`  Success rate: ${colorize(((totalCompleted / (totalCompleted + totalFailed)) * 100).toFixed(1) + '%', 'yellow')}`);

  // Provider comparison
  console.log(`\n${colorize('─── PROVIDER COMPARISON ───', 'gray')}`);
  console.log(`${'  Provider'.padEnd(20)} ${'Games'.padStart(8)} ${'Avg Turns'.padStart(10)} ${'Tokens/Game'.padStart(14)} ${'Avg Resp'.padStart(10)}`);
  console.log(`${'  ────────'.padEnd(20)} ${'─────'.padStart(8)} ${'─────────'.padStart(10)} ${'───────────'.padStart(14)} ${'────────'.padStart(10)}`);

  const sortedProviders = Object.entries(providers)
    .filter(([_, p]) => p.completedGames > 0)
    .sort((a, b) => b[1].completedGames - a[1].completedGames);

  for (const [name, p] of sortedProviders) {
    const avgTurns = p.completedGames > 0 ? (p.totalTurns / p.completedGames).toFixed(1) : '-';
    const tokensPerGame = p.completedGames > 0 ? Math.round(p.totalTokens / p.completedGames).toLocaleString() : '-';
    const avgResp = p.decisionCount > 0 ? ((p.totalResponseTime / p.decisionCount) / 1000).toFixed(2) + 's' : '-';
    
    console.log(`  ${name.padEnd(18)} ${p.completedGames.toString().padStart(8)} ${avgTurns.padStart(10)} ${tokensPerGame.padStart(14)} ${avgResp.padStart(10)}`);
  }

  // Win rates by color (across all providers)
  console.log(`\n${colorize('─── WIN RATES BY COLOR (All Providers) ───', 'gray')}`);
  
  const totalWins = { red: 0, blue: 0, green: 0, yellow: 0 };
  for (const p of Object.values(providers)) {
    for (const color of ['red', 'blue', 'green', 'yellow']) {
      totalWins[color] += p.winsByColor[color];
    }
  }

  const sortedColors = Object.entries(totalWins).sort((a, b) => b[1] - a[1]);
  for (const [color, wins] of sortedColors) {
    const pct = totalCompleted > 0 ? ((wins / totalCompleted) * 100).toFixed(1) : 0;
    const bar = '█'.repeat(Math.round(pct / 5)) + '░'.repeat(20 - Math.round(pct / 5));
    console.log(`  ${colorChip(color)} ${color.padEnd(7)} ${bar} ${pct.padStart(5)}% (${wins} wins)`);
  }

  // Win rates by color per provider
  console.log(`\n${colorize('─── WIN RATES BY PROVIDER ───', 'gray')}`);
  
  for (const [name, p] of sortedProviders) {
    if (p.completedGames < 3) continue; // Skip providers with too few games
    
    console.log(`\n  ${colorize(name, 'yellow')} (${p.completedGames} games):`);
    const providerColors = Object.entries(p.winsByColor).sort((a, b) => b[1] - a[1]);
    for (const [color, wins] of providerColors) {
      const pct = p.completedGames > 0 ? ((wins / p.completedGames) * 100).toFixed(0) : 0;
      const bar = '█'.repeat(Math.round(pct / 5)) + '░'.repeat(20 - Math.round(pct / 5));
      console.log(`    ${colorChip(color)} ${color.padEnd(7)} ${bar} ${pct.padStart(3)}% (${wins})`);
    }
  }

  // Turn distribution
  console.log(`\n${colorize('─── GAME LENGTH DISTRIBUTION ───', 'gray')}`);
  
  const turnBuckets = { '1-20': 0, '21-40': 0, '41-60': 0, '61-80': 0, '81+': 0 };
  for (const game of allGames) {
    if (game.turns <= 20) turnBuckets['1-20']++;
    else if (game.turns <= 40) turnBuckets['21-40']++;
    else if (game.turns <= 60) turnBuckets['41-60']++;
    else if (game.turns <= 80) turnBuckets['61-80']++;
    else turnBuckets['81+']++;
  }

  const maxBucket = Math.max(...Object.values(turnBuckets));
  for (const [bucket, count] of Object.entries(turnBuckets)) {
    const barLen = maxBucket > 0 ? Math.round((count / maxBucket) * 30) : 0;
    const bar = '█'.repeat(barLen);
    console.log(`  ${bucket.padEnd(8)} ${bar} ${count}`);
  }

  // Statistical significance test
  console.log(`\n${colorize('─── STATISTICAL ANALYSIS ───', 'gray')}`);
  
  // Chi-square test for color win rate uniformity
  const expected = totalCompleted / 4;
  let chiSquare = 0;
  for (const wins of Object.values(totalWins)) {
    chiSquare += Math.pow(wins - expected, 2) / expected;
  }
  
  // Chi-square critical value for df=3, p=0.05 is 7.815
  const significant = chiSquare > 7.815;
  console.log(`  Chi-square statistic: ${chiSquare.toFixed(2)}`);
  console.log(`  Color win rates are ${significant ? colorize('SIGNIFICANTLY', 'green') : colorize('NOT significantly', 'yellow')} different from uniform (p < 0.05)`);

  // Key findings
  console.log(`\n${colorize('─── KEY FINDINGS ───', 'gray')}`);
  
  const [topColor] = sortedColors[0];
  const [bottomColor] = sortedColors[sortedColors.length - 1];
  const topPct = ((totalWins[topColor] / totalCompleted) * 100).toFixed(1);
  const bottomPct = ((totalWins[bottomColor] / totalCompleted) * 100).toFixed(1);
  
  console.log(`  • ${colorChip(topColor)} ${topColor} wins most often (${topPct}%)`);
  console.log(`  • ${colorChip(bottomColor)} ${bottomColor} wins least often (${bottomPct}%)`);
  
  const avgTurnsAll = allGames.length > 0 
    ? (allGames.reduce((s, g) => s + g.turns, 0) / allGames.length).toFixed(1)
    : 0;
  console.log(`  • Average game length: ${avgTurnsAll} turns`);

  // First-mover analysis
  console.log(`\n${colorize('─── FIRST-MOVER ADVANTAGE ───', 'gray')}`);
  console.log(`  (Red always moves first in turn order)`);
  const redWinRate = ((totalWins.red / totalCompleted) * 100).toFixed(1);
  const hasFirstMoverAdvantage = totalWins.red > expected;
  console.log(`  Red win rate: ${redWinRate}% (expected 25%)`);
  console.log(`  First-mover advantage: ${hasFirstMoverAdvantage ? colorize('YES', 'green') : colorize('NO', 'yellow')}`);

  console.log(`\n${colorize('═══════════════════════════════════════════════════════════════════════════', 'cyan')}\n`);
}

main();
