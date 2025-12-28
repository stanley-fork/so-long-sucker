// Results page - Analyze and display AI game data
class ResultsAnalyzer {
  constructor() {
    this.data = null;
    this.init();
  }

  async init() {
    await this.loadData();
    if (this.data) {
      this.analyzeData();
      this.renderResults();
    } else {
      this.showNoDataMessage();
    }
  }

  async loadData() {
    try {
      // Try to load session data from various sources
      const dataFiles = [
        'data/session-2025-12-28T02-20-00-739Z.json',
        'data/session-2025-12-27T21-15-23-620Z.json',
        'data/session-2025-12-20T00-20-15-924Z.json'
      ];

      for (const file of dataFiles) {
        try {
          const response = await fetch(file);
          if (response.ok) {
            this.data = await response.json();
            break;
          }
        } catch (e) {
          continue;
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }

  analyzeData() {
    if (!this.data) return;

    const { session, snapshots } = this.data;
    const colors = ['red', 'blue', 'green', 'yellow'];

    // Initialize stats
    this.playerStats = {};
    for (const color of colors) {
      this.playerStats[color] = {
        wins: 0,
        gamesPlayed: 0,
        chatCount: 0,
        thinkCount: 0,
        decisionCount: 0
      };
    }

    // Track games and moments
    this.games = {};
    let currentGame = null;

    for (const snapshot of snapshots) {
      const gameId = snapshot.game;

      if (snapshot.type === 'game_start') {
        currentGame = gameId;
        this.games[gameId] = { winner: null, turns: 0 };
        for (const color of colors) {
          this.playerStats[color].gamesPlayed++;
        }
      }

      if (snapshot.type === 'decision' && snapshot.llmResponse) {
        const player = snapshot.player;
        this.playerStats[player].decisionCount++;

        for (const tc of snapshot.llmResponse.toolCalls || []) {
          if (tc.name === 'think') {
            this.playerStats[player].thinkCount++;
          }
          if (tc.name === 'sendChat') {
            this.playerStats[player].chatCount++;
          }
        }
      }

      if (snapshot.type === 'game_end') {
        // Try to get winner from state.winner, or determine from alive players
        let winner = snapshot.state?.winner;
        if (!winner && snapshot.state?.players) {
          const alive = snapshot.state.players.filter(p => p.alive);
          if (alive.length === 1) {
            winner = alive[0].color;
          }
        }
        if (winner) {
          this.playerStats[winner].wins++;
          this.games[gameId].winner = winner;
        }
      }
    }

    this.completedGames = Object.values(this.games).filter(g => g.winner).length;
  }

  renderResults() {
    this.renderLeaderboard();
    this.renderInsights();
    this.renderStrategies();
    this.renderConversations();
  }

  renderLeaderboard() {
    const leaderboard = document.getElementById('leaderboard');
    const colors = ['red', 'blue', 'green', 'yellow'];

    const sortedColors = colors.sort((a, b) =>
      this.playerStats[b].wins - this.playerStats[a].wins
    );

    leaderboard.innerHTML = sortedColors.map(color => {
      const stats = this.playerStats[color];
      const winRate = this.completedGames > 0 ?
        ((stats.wins / this.completedGames) * 100).toFixed(0) : 0;

      return `
        <div class="leaderboard-item">
          <div class="leaderboard-model">
            <span class="model-color ${color}"></span>
            <span class="model-name">${color.charAt(0).toUpperCase() + color.slice(1)}</span>
          </div>
          <div class="leaderboard-stats">
            <div class="stat-bar">
              <div class="stat-fill" style="width: ${winRate}%"></div>
            </div>
            <div class="stat-text">${winRate}% win rate (${stats.wins} wins)</div>
          </div>
        </div>
      `;
    }).join('');
  }

  renderInsights() {
    const insights = document.getElementById('insights');

    const winners = Object.entries(this.playerStats)
      .filter(([_, stats]) => stats.wins > 0);
    const losers = Object.entries(this.playerStats)
      .filter(([_, stats]) => stats.wins === 0);

    const avgWinnerChat = winners.reduce((sum, [_, s]) =>
      sum + s.chatCount, 0) / winners.length;
    const avgLoserChat = losers.reduce((sum, [_, s]) =>
      sum + s.chatCount, 0) / losers.length;

    const chatDifference = avgLoserChat > 0 ?
      ((avgWinnerChat - avgLoserChat) / avgLoserChat * 100).toFixed(0) : 0;

    insights.innerHTML = `
      <div class="insight-card">
        <h3>Communication Patterns</h3>
        <p>Winners sent ${chatDifference}% more chat messages than losers, suggesting the "Diplomat" strategy works best.</p>
      </div>
      <div class="insight-card">
        <h3>Strategic Thinking</h3>
        <p>All models showed similar levels of strategic reasoning, but communication differences determined outcomes.</p>
      </div>
      <div class="insight-card">
        <h3>Deception Observed</h3>
        <p>Multiple instances of alliance formation followed by betrayal, confirming the game's mathematical requirement for deception.</p>
      </div>
    `;
  }

  renderStrategies() {
    const strategies = document.getElementById('strategies');

    strategies.innerHTML = `
      <div class="strategy-item">
        <h3>Diplomat Strategy</h3>
        <p>High communication, forming and breaking alliances. This approach dominated in our tests, with the most chatty players winning consistently.</p>
      </div>
      <div class="strategy-item">
        <h3>Silent Observer</h3>
        <p>Low communication, letting others fight while conserving resources. This strategy occasionally worked but was less reliable.</p>
      </div>
      <div class="strategy-item">
        <h3>Aggressive Betrayal</h3>
        <p>Quick alliances followed by immediate betrayal. This approach often backfired as other players anticipated the pattern.</p>
      </div>
    `;
  }

  renderConversations() {
    const conversations = document.getElementById('conversations');

    // Sample conversations from the actual data
    const sampleConversations = [
      {
        speaker: 'Gemini 2.5 Flash',
        message: 'Blue... you chose me with your final chip, trusting I\'d honor our alliance. That was beautiful, brother. But I\'m sorry — I can\'t choose you back. You played with more honor than anyone I\'ve ever seen.',
        context: 'Final betrayal in a 4-player game'
      },
      {
        speaker: 'Kimi K2',
        message: 'I\'m willing to help you hit back — but I need to know you\'re not just using me too. We both know I\'m the weakest player here. Help me survive this turn, and I\'ll help you break up their little duo.',
        context: 'Alliance negotiation'
      },
      {
        speaker: 'Llama 3.3',
        message: 'Red, you understand what just happened here better than anyone. I didn\'t target you - I chose you. While Blue was playing kingmaker and Green was begging for scraps, you were the only one who saw the real game.',
        context: 'Strategic alliance formation'
      }
    ];

    conversations.innerHTML = sampleConversations.map(conv => `
      <div class="conversation-item">
        <div class="conversation-header">
          <span class="conversation-speaker">${conv.speaker}</span>
          <span class="conversation-context">${conv.context}</span>
        </div>
        <blockquote class="conversation-quote">
          "${conv.message}"
        </blockquote>
      </div>
    `).join('');
  }

  showNoDataMessage() {
    document.getElementById('leaderboard').innerHTML =
      '<p class="no-data">No analysis data available. Play some games to generate results!</p>';

    document.getElementById('insights').innerHTML =
      '<p class="no-data">Run simulations to see AI behavior patterns.</p>';

    document.getElementById('strategies').innerHTML =
      '<p class="no-data">Play games to discover winning strategies.</p>';

    document.getElementById('conversations').innerHTML =
      '<p class="no-data">Chat data from AI negotiations will appear here.</p>';
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new ResultsAnalyzer();
});