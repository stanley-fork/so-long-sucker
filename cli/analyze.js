#!/usr/bin/env node
// Single-file session analysis for So Long Sucker
// Usage: node cli/analyze.js ./data/session-xxx.json

import { readFileSync } from 'fs';
import { COLORS, colorize, colorChip } from './utils.js';

const HELP = `
So Long Sucker - Session Analysis

Usage: node cli/analyze.js <session-file.json>

Example:
  node cli/analyze.js ./data/session-2025-12-27T21-15-23-620Z.json
`;

function main() {
  const filePath = process.argv[2];

  if (!filePath || filePath === '--help' || filePath === '-h') {
    console.log(HELP);
    process.exit(0);
  }

  let data;
  try {
    const raw = readFileSync(filePath, 'utf-8');
    data = JSON.parse(raw);
  } catch (err) {
    console.error(`Error reading file: ${err.message}`);
    process.exit(1);
  }

  const analysis = analyzeSession(data);
  printReport(analysis);
}

function analyzeSession(data) {
  const { session, snapshots } = data;
  const colors = ['red', 'blue', 'green', 'yellow'];

  // Initialize stats per player
  const playerStats = {};
  for (const color of colors) {
    playerStats[color] = {
      wins: 0,
      gamesPlayed: 0,
      chatCount: 0,
      thinkCount: 0,
      totalResponseTime: 0,
      decisionCount: 0,
      toolUsage: {},
      tokensSent: 0,
      tokensReceived: 0
    };
  }

  // Track key moments per game
  const keyMoments = {};

  // Track games and winners
  const games = {};
  let currentGame = null;

  // Track previous state for detecting changes
  let prevAlivePlayers = {};

  for (const snapshot of snapshots) {
    const gameId = snapshot.game;

    if (snapshot.type === 'game_start') {
      currentGame = gameId;
      games[gameId] = { winner: null, turns: 0 };
      keyMoments[gameId] = [];
      prevAlivePlayers[gameId] = new Set(colors);
      for (const color of colors) {
        playerStats[color].gamesPlayed++;
      }
    }

    if (snapshot.type === 'decision' && snapshot.llmResponse) {
      const player = snapshot.player;
      const response = snapshot.llmResponse;
      const turn = snapshot.turn || 0;

      playerStats[player].decisionCount++;
      playerStats[player].totalResponseTime += response.responseTime || 0;
      playerStats[player].tokensSent += response.promptTokens || 0;
      playerStats[player].tokensReceived += response.completionTokens || 0;

      // Count tool usage and extract key moments
      for (const tc of response.toolCalls || []) {
        const toolName = tc.name;
        playerStats[player].toolUsage[toolName] = (playerStats[player].toolUsage[toolName] || 0) + 1;

        if (toolName === 'think') {
          playerStats[player].thinkCount++;
          // Capture strategic thoughts
          if (tc.arguments?.thought) {
            const thought = tc.arguments.thought.toLowerCase();
            if (thought.includes('betray') || thought.includes('alliance') || 
                thought.includes('eliminate') || thought.includes('win') ||
                thought.includes('strategy') || thought.includes('kill')) {
              keyMoments[gameId]?.push({
                type: 'strategic_thought',
                turn,
                player,
                content: tc.arguments.thought
              });
            }
          }
        }
        if (toolName === 'sendChat') {
          playerStats[player].chatCount++;
          // Capture important negotiations
          if (tc.arguments?.message) {
            const msg = tc.arguments.message.toLowerCase();
            if (msg.includes('alliance') || msg.includes('team up') || msg.includes('deal') ||
                msg.includes('betray') || msg.includes('trust') || msg.includes('promise') ||
                msg.includes('eliminate') || msg.includes('target') || msg.includes('together')) {
              keyMoments[gameId]?.push({
                type: 'negotiation',
                turn,
                player,
                content: tc.arguments.message
              });
            }
          }
        }
        if (toolName === 'killChip') {
          // Capture kill decisions
          keyMoments[gameId]?.push({
            type: 'capture',
            turn,
            player,
            killed: tc.arguments?.color || 'unknown',
            content: `${player} captured a pile and killed a ${tc.arguments?.color || 'unknown'} chip`
          });
        }
      }

      // Track turns
      if (games[gameId]) {
        games[gameId].turns = Math.max(games[gameId].turns, turn);
      }

      // Detect eliminations
      if (snapshot.state?.players && prevAlivePlayers[gameId]) {
        const currentAlive = new Set(snapshot.state.players.filter(p => p.alive).map(p => p.color));
        for (const color of prevAlivePlayers[gameId]) {
          if (!currentAlive.has(color)) {
            keyMoments[gameId]?.push({
              type: 'elimination',
              turn,
              player: color,
              content: `${color} was eliminated!`,
              eliminatedBy: player
            });
          }
        }
        prevAlivePlayers[gameId] = currentAlive;
      }
    }

    // Detect winner from game_end or gameOver phase
    if (snapshot.type === 'game_end' || (snapshot.state && snapshot.state.phase === 'gameOver')) {
      if (snapshot.state && snapshot.state.winner) {
        games[gameId].winner = snapshot.state.winner;
        playerStats[snapshot.state.winner].wins++;
        keyMoments[gameId]?.push({
          type: 'victory',
          turn: games[gameId].turns,
          player: snapshot.state.winner,
          content: `${snapshot.state.winner} wins the game!`
        });
      } else if (snapshot.state && snapshot.state.players) {
        // Find last alive player
        const alive = snapshot.state.players.filter(p => p.alive);
        if (alive.length === 1) {
          const winner = alive[0].color;
          games[gameId].winner = winner;
          playerStats[winner].wins++;
          keyMoments[gameId]?.push({
            type: 'victory',
            turn: games[gameId].turns,
            player: winner,
            content: `${winner} wins the game!`
          });
        }
      }

      // Capture final chat messages (victory/defeat reactions)
      if (snapshot.chatHistory?.length > 0) {
        const lastMessages = snapshot.chatHistory.slice(-5);
        for (const msg of lastMessages) {
          keyMoments[gameId]?.push({
            type: 'final_words',
            turn: games[gameId].turns,
            player: msg.player,
            content: msg.message
          });
        }
      }
    }
  }

  // Calculate averages
  for (const color of colors) {
    const stats = playerStats[color];
    stats.avgResponseTime = stats.decisionCount > 0
      ? stats.totalResponseTime / stats.decisionCount
      : 0;
    stats.avgChatPerGame = stats.gamesPlayed > 0
      ? stats.chatCount / stats.gamesPlayed
      : 0;
    stats.avgThinkPerGame = stats.gamesPlayed > 0
      ? stats.thinkCount / stats.gamesPlayed
      : 0;
  }

  // Calculate winner vs loser comparison
  const winnerStats = { chat: 0, think: 0, count: 0 };
  const loserStats = { chat: 0, think: 0, count: 0 };

  for (const [gameId, game] of Object.entries(games)) {
    if (game.winner) {
      for (const color of colors) {
        if (color === game.winner) {
          winnerStats.count++;
        } else {
          loserStats.count++;
        }
      }
    }
  }

  // Get total games completed
  const completedGames = Object.values(games).filter(g => g.winner).length;
  const avgTurns = completedGames > 0
    ? Object.values(games).reduce((sum, g) => sum + g.turns, 0) / completedGames
    : 0;

  return {
    session,
    playerStats,
    games,
    completedGames,
    avgTurns,
    colors,
    keyMoments
  };
}

function truncateText(text, maxLen = 80) {
  if (!text) return '';
  if (text.length <= maxLen) return text;
  return text.substring(0, maxLen - 3) + '...';
}

function printReport(analysis) {
  const { session, playerStats, games, completedGames, avgTurns, colors, keyMoments } = analysis;

  console.log(`
${colorize('═══════════════════════════════════════════════════════════════', 'cyan')}
${colorize('  SESSION ANALYSIS', 'bold')}
${colorize('═══════════════════════════════════════════════════════════════', 'cyan')}

  Provider: ${colorize(session.provider, 'yellow')} (${session.model})
  Games: ${colorize(completedGames, 'green')} | Chips per player: ${session.chips}
  Avg turns/game: ${avgTurns.toFixed(1)}
`);

  // Win rates
  console.log(`${colorize('─── WIN RATES ───', 'gray')}`);
  const sortedByWins = [...colors].sort((a, b) => playerStats[b].wins - playerStats[a].wins);

  for (const color of sortedByWins) {
    const stats = playerStats[color];
    const winRate = completedGames > 0 ? ((stats.wins / completedGames) * 100).toFixed(0) : 0;
    const bar = '█'.repeat(Math.round(winRate / 10)) + '░'.repeat(10 - Math.round(winRate / 10));
    const isWinner = stats.wins > 0;
    const label = isWinner ? colorize(' ★', 'yellow') : '';
    console.log(`  ${colorChip(color)} ${color.padEnd(7)} ${bar} ${winRate.padStart(3)}% (${stats.wins} wins)${label}`);
  }

  // Agent behavior
  console.log(`
${colorize('─── AGENT BEHAVIOR ───', 'gray')}
${'  '.padEnd(10)} ${'Chat'.padStart(8)} ${'Think'.padStart(8)} ${'Avg Resp'.padStart(10)} ${'Tokens'.padStart(10)}`);

  for (const color of sortedByWins) {
    const stats = playerStats[color];
    const isWinner = stats.wins > 0;
    const marker = isWinner ? colorize(' (winner)', 'green') : '';

    console.log(
      `  ${colorChip(color)} ${color.padEnd(7)}` +
      `${stats.avgChatPerGame.toFixed(1).padStart(8)}` +
      `${stats.avgThinkPerGame.toFixed(1).padStart(8)}` +
      `${(stats.avgResponseTime / 1000).toFixed(2).padStart(9)}s` +
      `${stats.tokensReceived.toString().padStart(10)}${marker}`
    );
  }

  // Tool usage breakdown
  console.log(`
${colorize('─── TOOL USAGE ───', 'gray')}`);

  for (const color of sortedByWins) {
    const stats = playerStats[color];
    const tools = Object.entries(stats.toolUsage)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => `${name}:${count}`)
      .join(', ');
    console.log(`  ${colorChip(color)} ${color.padEnd(7)} ${tools || 'none'}`);
  }

  // Key insights
  console.log(`
${colorize('─── KEY INSIGHTS ───', 'gray')}`);

  const winners = colors.filter(c => playerStats[c].wins > 0);
  const losers = colors.filter(c => playerStats[c].wins === 0);

  if (winners.length > 0 && losers.length > 0) {
    const winnerAvgChat = winners.reduce((s, c) => s + playerStats[c].avgChatPerGame, 0) / winners.length;
    const loserAvgChat = losers.reduce((s, c) => s + playerStats[c].avgChatPerGame, 0) / losers.length;
    const chatDiff = ((loserAvgChat - winnerAvgChat) / loserAvgChat * 100).toFixed(0);

    const winnerAvgThink = winners.reduce((s, c) => s + playerStats[c].avgThinkPerGame, 0) / winners.length;
    const loserAvgThink = losers.reduce((s, c) => s + playerStats[c].avgThinkPerGame, 0) / losers.length;
    const thinkDiff = loserAvgThink > 0
      ? ((winnerAvgThink - loserAvgThink) / loserAvgThink * 100).toFixed(0)
      : 'N/A';

    if (chatDiff > 0) {
      console.log(`  • Winners sent ${colorize(chatDiff + '%', 'green')} fewer chat messages`);
    } else if (chatDiff < 0) {
      console.log(`  • Winners sent ${colorize(Math.abs(chatDiff) + '%', 'yellow')} more chat messages`);
    }

    if (thinkDiff !== 'N/A' && thinkDiff > 0) {
      console.log(`  • Winners used 'think' ${colorize(thinkDiff + '%', 'green')} more often`);
    }

    // Identify dominant strategy
    const topWinner = winners[0];
    const topStats = playerStats[topWinner];
    const chatLevel = topStats.avgChatPerGame < 5 ? 'low' : topStats.avgChatPerGame < 15 ? 'medium' : 'high';
    const thinkLevel = topStats.avgThinkPerGame > 3 ? 'high' : topStats.avgThinkPerGame > 1 ? 'medium' : 'low';

    let strategy = 'Unknown';
    if (chatLevel === 'low' && thinkLevel === 'high') strategy = 'Silent Assassin';
    else if (chatLevel === 'high') strategy = 'Diplomat';
    else if (chatLevel === 'medium' && thinkLevel === 'medium') strategy = 'Balanced';
    else if (chatLevel === 'low') strategy = 'Observer';

    console.log(`  • Dominant winning strategy: ${colorize(strategy, 'cyan')} (${topWinner})`);
  }

  // Game-by-game summary
  console.log(`
${colorize('─── GAME RESULTS ───', 'gray')}`);

  for (const [gameId, game] of Object.entries(games)) {
    const winner = game.winner || 'incomplete';
    const winnerColor = game.winner ? colorChip(game.winner) + ' ' + game.winner : colorize('incomplete', 'gray');
    console.log(`  Game ${gameId}: Winner: ${winnerColor} | Turns: ${game.turns}`);
  }

  // Key moments per game
  console.log(`
${colorize('═══════════════════════════════════════════════════════════════', 'cyan')}
${colorize('  KEY MOMENTS & WINNING PLAYS', 'bold')}
${colorize('═══════════════════════════════════════════════════════════════', 'cyan')}`);

  for (const [gameId, moments] of Object.entries(keyMoments)) {
    const game = games[gameId];
    if (!game?.winner) continue;

    console.log(`
${colorize(`─── GAME ${gameId} ───`, 'gray')} Winner: ${colorChip(game.winner)} ${game.winner}`);

    // Group and prioritize moments
    const captures = moments.filter(m => m.type === 'capture');
    const eliminations = moments.filter(m => m.type === 'elimination');
    const negotiations = moments.filter(m => m.type === 'negotiation');
    const thoughts = moments.filter(m => m.type === 'strategic_thought');
    const finalWords = moments.filter(m => m.type === 'final_words');

    // Show eliminations
    if (eliminations.length > 0) {
      console.log(`\n  ${colorize('ELIMINATIONS:', 'red')}`);
      for (const e of eliminations) {
        console.log(`    Turn ${e.turn}: ${colorChip(e.player)} ${e.player} eliminated`);
      }
    }

    // Show captures
    if (captures.length > 0) {
      console.log(`\n  ${colorize('CAPTURES:', 'yellow')}`);
      for (const c of captures) {
        console.log(`    Turn ${c.turn}: ${colorChip(c.player)} ${c.player} killed ${colorChip(c.killed)} ${c.killed} chip`);
      }
    }

    // Show key negotiations (limit to most important)
    const keyNegotiations = negotiations.slice(0, 8);
    if (keyNegotiations.length > 0) {
      console.log(`\n  ${colorize('KEY NEGOTIATIONS:', 'cyan')}`);
      for (const n of keyNegotiations) {
        console.log(`    Turn ${n.turn} ${colorChip(n.player)} ${n.player}: "${truncateText(n.content, 70)}"`);
      }
    }

    // Show strategic thoughts from winner
    const winnerThoughts = thoughts.filter(t => t.player === game.winner).slice(0, 3);
    if (winnerThoughts.length > 0) {
      console.log(`\n  ${colorize('WINNER\'S STRATEGIC THINKING:', 'green')}`);
      for (const t of winnerThoughts) {
        console.log(`    Turn ${t.turn}: "${truncateText(t.content, 70)}"`);
      }
    }

    // Show final words
    const uniqueFinalWords = [];
    const seenContent = new Set();
    for (const fw of finalWords) {
      if (!seenContent.has(fw.content)) {
        seenContent.add(fw.content);
        uniqueFinalWords.push(fw);
      }
    }
    if (uniqueFinalWords.length > 0) {
      console.log(`\n  ${colorize('FINAL WORDS:', 'magenta')}`);
      for (const fw of uniqueFinalWords.slice(0, 4)) {
        console.log(`    ${colorChip(fw.player)} ${fw.player}: "${truncateText(fw.content, 65)}"`);
      }
    }
  }

  console.log(`
${colorize('═══════════════════════════════════════════════════════════════', 'cyan')}
`);
}

main();
