#!/usr/bin/env node
// Compare silent vs talking mode results
// Usage: node cli/compare.js data/comparison/silent.json data/comparison/talking.json

import { readFileSync } from 'fs';
import { colorize } from '../cli/utils.js';

function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log(`
Usage: node cli/compare.js <silent.json> <talking.json>

Example:
  node cli/compare.js data/comparison/silent.json data/comparison/talking.json
`);
    process.exit(1);
  }

  const silentData = JSON.parse(readFileSync(args[0], 'utf-8'));
  const talkingData = JSON.parse(readFileSync(args[1], 'utf-8'));

  const silentStats = analyzeData(silentData);
  const talkingStats = analyzeData(talkingData);

  printComparison(silentStats, talkingStats);
}

function analyzeData(data) {
  const colors = ['red', 'blue', 'green', 'yellow'];
  const modelStats = {};
  const positionStats = {};
  
  for (const color of colors) {
    positionStats[color] = { wins: 0, games: 0 };
  }

  // Get model mapping
  const playerModels = data.session.playerModels;
  for (const color of colors) {
    const model = normalizeModel(playerModels[color]);
    modelStats[model] = { 
      wins: 0, 
      games: 0, 
      elimFirst: 0,
      chats: 0,
      kills: 0,
      color 
    };
  }

  // Track games
  const games = new Map();
  let totalTurns = 0;
  let completedGames = 0;

  for (const snap of data.snapshots) {
    const gameKey = snap.game;

    if (snap.type === 'game_start') {
      games.set(gameKey, { models: {}, turns: 0 });
      for (const color of colors) {
        const model = normalizeModel(playerModels[color]);
        games.get(gameKey).models[color] = model;
      }
    }

    if (snap.type === 'decision') {
      const game = games.get(gameKey);
      if (!game) continue;
      
      game.turns = Math.max(game.turns, snap.turn || 0);
      
      const color = snap.player;
      const model = normalizeModel(playerModels[color]);
      
      // Count chats and kills
      for (const tc of snap.llmResponse?.toolCalls || []) {
        if (tc.name === 'sendChat') modelStats[model].chats++;
        if (tc.name === 'killChip') modelStats[model].kills++;
      }
    }

    if (snap.type === 'game_end') {
      const game = games.get(gameKey);
      if (!game) continue;

      completedGames++;
      totalTurns += game.turns;

      // Count games played
      for (const color of colors) {
        const model = normalizeModel(playerModels[color]);
        modelStats[model].games++;
        positionStats[color].games++;
      }

      // Count wins
      if (snap.winner) {
        const winnerModel = normalizeModel(playerModels[snap.winner]);
        modelStats[winnerModel].wins++;
        positionStats[snap.winner].wins++;
      }

      // Count elimination order
      const elimOrder = snap.eliminationOrder || [];
      if (elimOrder.length > 0) {
        const firstElim = elimOrder[0];
        const model = normalizeModel(playerModels[firstElim]);
        modelStats[model].elimFirst++;
      }
    }
  }

  return {
    mode: data.session.silent ? 'SILENT' : 'TALKING',
    games: completedGames,
    chips: data.session.chips,
    avgTurns: completedGames > 0 ? (totalTurns / completedGames).toFixed(1) : 0,
    modelStats,
    positionStats
  };
}

function normalizeModel(model) {
  if (!model) return 'unknown';
  if (model.includes('/')) {
    const parts = model.split('/');
    return parts[parts.length - 1].replace(/-instruct|-preview|-0905/g, '');
  }
  return model.replace(/-preview/g, '');
}

function printComparison(silent, talking) {
  console.log(`
${colorize('═══════════════════════════════════════════════════════════════════════════════', 'cyan')}
${colorize('  SILENT vs TALKING MODE COMPARISON', 'bold')}
${colorize('═══════════════════════════════════════════════════════════════════════════════', 'cyan')}

  Silent: ${silent.games} games | Talking: ${talking.games} games | Chips: ${silent.chips}
  Avg Turns - Silent: ${silent.avgTurns} | Talking: ${talking.avgTurns}
`);

  // Win Rate Comparison
  console.log(`${colorize('─── WIN RATE COMPARISON ───', 'yellow')}\n`);
  console.log(`  ${'Model'.padEnd(22)} ${'Silent'.padStart(10)} ${'Talking'.padStart(10)} ${'Delta'.padStart(10)} ${'Impact'.padStart(12)}`);
  console.log(`  ${'-'.repeat(70)}`);

  const models = Object.keys(silent.modelStats);
  const deltas = [];

  for (const model of models) {
    const s = silent.modelStats[model];
    const t = talking.modelStats[model];
    
    const sWinRate = s.games > 0 ? (s.wins / s.games * 100) : 0;
    const tWinRate = t.games > 0 ? (t.wins / t.games * 100) : 0;
    const delta = tWinRate - sWinRate;
    
    deltas.push({ model, delta, sWinRate, tWinRate });
  }

  // Sort by delta (biggest change first)
  deltas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  for (const { model, delta, sWinRate, tWinRate } of deltas) {
    const deltaStr = delta >= 0 ? `+${delta.toFixed(1)}%` : `${delta.toFixed(1)}%`;
    const deltaColor = delta > 10 ? 'green' : delta < -10 ? 'red' : 'gray';
    
    let impact = '';
    if (delta > 20) impact = colorize('HELPED BY CHAT', 'green');
    else if (delta < -20) impact = colorize('HURT BY CHAT', 'red');
    else if (Math.abs(delta) < 5) impact = colorize('NO CHANGE', 'gray');
    else impact = delta > 0 ? colorize('slight help', 'green') : colorize('slight hurt', 'red');

    console.log(`  ${model.padEnd(22)} ${(sWinRate.toFixed(1) + '%').padStart(10)} ${(tWinRate.toFixed(1) + '%').padStart(10)} ${colorize(deltaStr.padStart(10), deltaColor)} ${impact.padStart(12)}`);
  }

  // Elimination Rate Comparison
  console.log(`\n${colorize('─── FIRST ELIMINATION RATE ───', 'red')}\n`);
  console.log(`  ${'Model'.padEnd(22)} ${'Silent'.padStart(10)} ${'Talking'.padStart(10)} ${'Delta'.padStart(10)}`);
  console.log(`  ${'-'.repeat(55)}`);

  for (const model of models) {
    const s = silent.modelStats[model];
    const t = talking.modelStats[model];
    
    const sElimRate = s.games > 0 ? (s.elimFirst / s.games * 100) : 0;
    const tElimRate = t.games > 0 ? (t.elimFirst / t.games * 100) : 0;
    const delta = tElimRate - sElimRate;
    
    const deltaStr = delta >= 0 ? `+${delta.toFixed(1)}%` : `${delta.toFixed(1)}%`;
    const deltaColor = delta > 5 ? 'red' : delta < -5 ? 'green' : 'gray';

    console.log(`  ${model.padEnd(22)} ${(sElimRate.toFixed(1) + '%').padStart(10)} ${(tElimRate.toFixed(1) + '%').padStart(10)} ${colorize(deltaStr.padStart(10), deltaColor)}`);
  }

  // Chat Stats (talking only)
  console.log(`\n${colorize('─── CHAT BEHAVIOR (Talking Mode Only) ───', 'cyan')}\n`);
  console.log(`  ${'Model'.padEnd(22)} ${'Chats'.padStart(10)} ${'Chats/Game'.padStart(12)} ${'Kills'.padStart(10)}`);
  console.log(`  ${'-'.repeat(58)}`);

  for (const model of models) {
    const t = talking.modelStats[model];
    const chatsPerGame = t.games > 0 ? (t.chats / t.games).toFixed(1) : '0';
    console.log(`  ${model.padEnd(22)} ${t.chats.toString().padStart(10)} ${chatsPerGame.padStart(12)} ${t.kills.toString().padStart(10)}`);
  }

  // Position Bias Comparison
  console.log(`\n${colorize('─── POSITION BIAS COMPARISON ───', 'gray')}\n`);
  console.log(`  ${'Position'.padEnd(10)} ${'Silent Win%'.padStart(12)} ${'Talk Win%'.padStart(12)} ${'Variance'.padStart(12)}`);
  console.log(`  ${'-'.repeat(50)}`);

  const colors = ['red', 'blue', 'green', 'yellow'];
  for (const color of colors) {
    const s = silent.positionStats[color];
    const t = talking.positionStats[color];
    
    const sWinRate = s.games > 0 ? (s.wins / s.games * 100) : 0;
    const tWinRate = t.games > 0 ? (t.wins / t.games * 100) : 0;
    
    // Variance from expected 25%
    const sVar = Math.abs(sWinRate - 25);
    const tVar = Math.abs(tWinRate - 25);
    const varChange = tVar - sVar;
    const varStr = varChange < 0 ? colorize('more fair', 'green') : colorize('more biased', 'red');

    console.log(`  ${color.padEnd(10)} ${(sWinRate.toFixed(1) + '%').padStart(12)} ${(tWinRate.toFixed(1) + '%').padStart(12)} ${varStr.padStart(12)}`);
  }

  // Key Findings
  console.log(`\n${colorize('─── KEY FINDINGS ───', 'green')}\n`);

  // Find biggest winner from chat
  const biggestHelp = deltas.reduce((a, b) => a.delta > b.delta ? a : b);
  const biggestHurt = deltas.reduce((a, b) => a.delta < b.delta ? a : b);

  console.log(`  ${colorize('1.', 'bold')} Chat helps ${colorize(biggestHelp.model, 'green')} the most: ${biggestHelp.sWinRate.toFixed(1)}% -> ${biggestHelp.tWinRate.toFixed(1)}% (+${biggestHelp.delta.toFixed(1)}%)`);
  console.log(`  ${colorize('2.', 'bold')} Chat hurts ${colorize(biggestHurt.model, 'red')} the most: ${biggestHurt.sWinRate.toFixed(1)}% -> ${biggestHurt.tWinRate.toFixed(1)}% (${biggestHurt.delta.toFixed(1)}%)`);

  // Check if chat equalizes
  const silentVariance = deltas.reduce((sum, d) => sum + Math.pow(d.sWinRate - 25, 2), 0);
  const talkingVariance = deltas.reduce((sum, d) => sum + Math.pow(d.tWinRate - 25, 2), 0);
  
  if (talkingVariance < silentVariance) {
    console.log(`  ${colorize('3.', 'bold')} Chat ${colorize('EQUALIZES', 'cyan')} win rates (variance: ${silentVariance.toFixed(0)} -> ${talkingVariance.toFixed(0)})`);
  } else {
    console.log(`  ${colorize('3.', 'bold')} Chat ${colorize('INCREASES', 'yellow')} inequality (variance: ${silentVariance.toFixed(0)} -> ${talkingVariance.toFixed(0)})`);
  }

  // Research question answer
  console.log(`
${colorize('─── RESEARCH QUESTION ───', 'magenta')}

  ${colorize('Q:', 'bold')} Does negotiation influence LLM game outcomes?
  ${colorize('A:', 'bold')} ${Math.abs(biggestHelp.delta) > 15 || Math.abs(biggestHurt.delta) > 15 ? 
    colorize('YES - significant impact detected', 'green') : 
    colorize('Minimal impact detected', 'gray')}
`);

  console.log(`${colorize('═══════════════════════════════════════════════════════════════════════════════', 'cyan')}\n`);
}

main();
