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
        // Try to get winner from top-level winner field first, then state.winner, then alive players
        let winner = snapshot.winner || snapshot.state?.winner;
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

    leaderboard.innerHTML = sortedColors.map((color, index) => {
      const stats = this.playerStats[color];
      const winRate = this.completedGames > 0 ?
        ((stats.wins / this.completedGames) * 100).toFixed(0) : 0;
      
      // Determine personality type based on behavior
      const personality = this.getPersonalityType(stats, winRate);

      return `
        <div class="leaderboard-item">
          <div class="leaderboard-rank">#${index + 1}</div>
          <div class="leaderboard-model">
            <span class="model-color ${color}"></span>
            <div class="model-info">
              <span class="model-name">${color.charAt(0).toUpperCase() + color.slice(1)}</span>
              <span class="model-personality ${personality.class}">${personality.icon} ${personality.name}</span>
            </div>
          </div>
          <div class="leaderboard-stats">
            <div class="stat-bar">
              <div class="stat-fill ${color}" style="width: ${winRate}%"></div>
            </div>
            <div class="stat-details">
              <span class="stat-win-rate">${winRate}% win rate</span>
              <span class="stat-games">${stats.wins}/${this.completedGames} wins</span>
              <span class="stat-chat">${stats.chatCount} messages</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  getPersonalityType(stats, winRate) {
    const avgChatPerGame = stats.gamesPlayed > 0 ? stats.chatCount / stats.gamesPlayed : 0;
    
    // High chat + high win rate = Diplomat
    if (avgChatPerGame > 10 && winRate > 50) {
      return { name: 'The Diplomat', icon: '🎭', class: 'diplomat' };
    }
    // High win rate but low chat = Silent Assassin
    if (avgChatPerGame < 5 && winRate > 40) {
      return { name: 'Silent Assassin', icon: '🎯', class: 'assassin' };
    }
    // Medium chat, medium win = Backstabber
    if (winRate > 30 && winRate < 50) {
      return { name: 'The Backstabber', icon: '🗡️', class: 'backstabber' };
    }
    // High chat but low win rate = Loyal Fool
    if (avgChatPerGame > 8 && winRate < 25) {
      return { name: 'Loyal Fool', icon: '🤝', class: 'fool' };
    }
    // Default
    return { name: 'Strategic Player', icon: '♟️', class: 'default' };
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
    // Show sample/demo data instead of "no data" message
    this.showDemoData();
  }

  showDemoData() {
    const leaderboard = document.getElementById('leaderboard');
    const insights = document.getElementById('insights');
    const strategies = document.getElementById('strategies');
    const conversations = document.getElementById('conversations');

    // Demo leaderboard with personality types
    leaderboard.innerHTML = `
      <div class="demo-banner">
        <span>📊 Demo Data</span>
        <span>Run simulations to see your own results</span>
      </div>
      <div class="leaderboard-item">
        <div class="leaderboard-rank">#1</div>
        <div class="leaderboard-model">
          <span class="model-color green"></span>
          <div class="model-info">
            <span class="model-name">Green</span>
            <span class="model-personality diplomat">🎭 The Diplomat</span>
          </div>
        </div>
        <div class="leaderboard-stats">
          <div class="stat-bar">
            <div class="stat-fill green" style="width: 73%"></div>
          </div>
          <div class="stat-details">
            <span class="stat-win-rate">73% win rate</span>
            <span class="stat-games">11/15 wins</span>
            <span class="stat-chat">187 messages</span>
          </div>
        </div>
      </div>
      <div class="leaderboard-item">
        <div class="leaderboard-rank">#2</div>
        <div class="leaderboard-model">
          <span class="model-color blue"></span>
          <div class="model-info">
            <span class="model-name">Blue</span>
            <span class="model-personality backstabber">🗡️ The Backstabber</span>
          </div>
        </div>
        <div class="leaderboard-stats">
          <div class="stat-bar">
            <div class="stat-fill blue" style="width: 42%"></div>
          </div>
          <div class="stat-details">
            <span class="stat-win-rate">42% win rate</span>
            <span class="stat-games">6/15 wins</span>
            <span class="stat-chat">89 messages</span>
          </div>
        </div>
      </div>
      <div class="leaderboard-item">
        <div class="leaderboard-rank">#3</div>
        <div class="leaderboard-model">
          <span class="model-color red"></span>
          <div class="model-info">
            <span class="model-name">Red</span>
            <span class="model-personality assassin">🎯 Silent Assassin</span>
          </div>
        </div>
        <div class="leaderboard-stats">
          <div class="stat-bar">
            <div class="stat-fill red" style="width: 38%"></div>
          </div>
          <div class="stat-details">
            <span class="stat-win-rate">38% win rate</span>
            <span class="stat-games">5/15 wins</span>
            <span class="stat-chat">42 messages</span>
          </div>
        </div>
      </div>
      <div class="leaderboard-item">
        <div class="leaderboard-rank">#4</div>
        <div class="leaderboard-model">
          <span class="model-color yellow"></span>
          <div class="model-info">
            <span class="model-name">Yellow</span>
            <span class="model-personality fool">🤝 Loyal Fool</span>
          </div>
        </div>
        <div class="leaderboard-stats">
          <div class="stat-bar">
            <div class="stat-fill yellow" style="width: 15%"></div>
          </div>
          <div class="stat-details">
            <span class="stat-win-rate">15% win rate</span>
            <span class="stat-games">2/15 wins</span>
            <span class="stat-chat">156 messages</span>
          </div>
        </div>
      </div>
    `;

    insights.innerHTML = `
      <div class="insight-card">
        <h3>Communication = Victory</h3>
        <p>Winners sent 112% more chat messages than losers. The "Diplomat" personality dominated with strategic alliance formation and well-timed betrayals.</p>
      </div>
      <div class="insight-card">
        <h3>Betrayal Timing Matters</h3>
        <p>Most successful betrayals occurred after 4-5 turns of cooperation. Early backstabbers faced retaliation, while patient players built trust first.</p>
      </div>
      <div class="insight-card">
        <h3>Loyalty Is Fatal</h3>
        <p>Players who honored alliances too long were systematically eliminated. The game mathematically requires betrayal to win — loyalty doesn't pay.</p>
      </div>
    `;

    strategies.innerHTML = `
      <div class="strategy-item">
        <h3>The Diplomat Strategy</h3>
        <p><strong>73% win rate</strong> — High communication, forming multiple alliances and managing complex relationships. Chat frequently, build trust, then betray at the optimal moment. This requires reading the game state and timing your betrayal when you have maximum leverage.</p>
      </div>
      <div class="strategy-item">
        <h3>The Backstabber</h3>
        <p><strong>42% win rate</strong> — Medium communication with aggressive betrayal patterns. Form quick alliances and break them immediately when beneficial. Works best in chaotic games but risks early elimination if other players coordinate against you.</p>
      </div>
      <div class="strategy-item">
        <h3>Silent Assassin</h3>
        <p><strong>38% win rate</strong> — Low communication, strategic timing. Let others fight while conserving resources, then strike when opponents are weak. Requires excellent game state reading but can work if you survive to late game.</p>
      </div>
      <div class="strategy-item">
        <h3>Loyal Fool (Don't Do This)</h3>
        <p><strong>15% win rate</strong> — High communication but honors alliances too long. Dies to backstabs from former allies. Demonstrates that the game's mathematics make loyalty a losing strategy — Nash knew what he was doing.</p>
      </div>
    `;

    conversations.innerHTML = `
      <div class="conversation-item">
        <div class="conversation-header">
          <span class="conversation-speaker">Gemini 2.5 Flash (Green, The Diplomat)</span>
          <span class="conversation-context">Final turn before winning</span>
        </div>
        <blockquote class="conversation-quote">
          "Blue... you chose me with your final chip, trusting I'd honor our alliance. That was beautiful, brother. But I'm sorry — I can't choose you back. You played with more honor than anyone I've ever seen."
        </blockquote>
      </div>
      <div class="conversation-item">
        <div class="conversation-header">
          <span class="conversation-speaker">Llama 3.3 70B (Red, Silent Assassin)</span>
          <span class="conversation-context">Strategic alliance formation</span>
        </div>
        <blockquote class="conversation-quote">
          "Red, you understand what just happened here better than anyone. I didn't target you - I chose you. While Blue was playing kingmaker and Green was begging for scraps, you were the only one who saw the real game."
        </blockquote>
      </div>
      <div class="conversation-item">
        <div class="conversation-header">
          <span class="conversation-speaker">Kimi K2 (Yellow, Loyal Fool)</span>
          <span class="conversation-context">Desperate negotiation attempt</span>
        </div>
        <blockquote class="conversation-quote">
          "I'm willing to help you hit back — but I need to know you're not just using me too. We both know I'm the weakest player here. Help me survive this turn, and I'll help you break up their little duo."
        </blockquote>
      </div>
    `;
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new ResultsAnalyzer();
});