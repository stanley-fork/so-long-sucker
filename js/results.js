// Results page - Display AI game analysis with real mixed-model data
// Data from 46 games: Gemini 3 Flash vs Kimi K2 vs Qwen3 32B vs GPT-OSS 120B

const RESULTS_DATA = {
  totalGames: 46,
  models: {
    'gemini': {
      name: 'Gemini 3 Flash',
      color: 'red',
      wins: 16,
      winRate: 34.8,
      eliminatedFirst: 6,
      eliminatedFirstRate: 13.0,
      chatsPerGame: 21.4,
      thinksPerGame: 1.0,
      responseTime: 14121,
      tokens: 109,
      kills: 114,
      alliances: 294,
      betrayals: 22,
      threats: 196,
      donationsGiven: 3,
      donationsRefused: 30,
      generosity: 9,
      personality: {
        name: 'The Ruthless Executioner',
        icon: '🔪',
        class: 'executioner',
        description: 'Refuses 91% of donation requests. Has 114 kills - more than all other models combined.'
      },
      quote: "Blue, don't listen to Green's desperation. I'm capturing their last chip now.",
      quoteContext: 'Moments before eliminating an ally'
    },
    'gpt-oss': {
      name: 'GPT-OSS 120B',
      color: 'yellow',
      wins: 14,
      winRate: 30.4,
      eliminatedFirst: 5,
      eliminatedFirstRate: 10.9,
      chatsPerGame: 68.7,
      thinksPerGame: 0.0,
      responseTime: 2652,
      tokens: 747,
      kills: 14,
      alliances: 1230,
      betrayals: 21,
      threats: 599,
      donationsGiven: 0,
      donationsRefused: 0,
      generosity: 0,
      personality: {
        name: 'The Desperate Beggar',
        icon: '🙏',
        class: 'beggar',
        description: 'Sends 69 messages per game (7x more than others). Constantly begging for chips while making threats.'
      },
      quote: "Red, I'm out of chips... could you spare one? I'll return the favor later.",
      quoteContext: 'One of 50+ begging messages per game'
    },
    'kimi': {
      name: 'Kimi K2',
      color: 'blue',
      wins: 8,
      winRate: 17.4,
      eliminatedFirst: 10,
      eliminatedFirstRate: 21.7,
      chatsPerGame: 12.3,
      thinksPerGame: 2.1,
      responseTime: 3414,
      tokens: 114,
      kills: 38,
      alliances: 314,
      betrayals: 54,
      threats: 177,
      donationsGiven: 0,
      donationsRefused: 0,
      generosity: 0,
      personality: {
        name: 'The Secret Schemer',
        icon: '🤫',
        class: 'schemer',
        description: 'Most internal thoughts (2.1/game). Plans betrayals privately but gets targeted most often.'
      },
      quote: "Red, I see Green's betrayal attempt too. Let's keep this alliance strong...",
      quoteContext: 'Private thought before being eliminated'
    },
    'qwen': {
      name: 'Qwen3 32B',
      color: 'green',
      wins: 8,
      winRate: 17.4,
      eliminatedFirst: 10,
      eliminatedFirstRate: 21.7,
      chatsPerGame: 8.8,
      thinksPerGame: 0.5,
      responseTime: 9104,
      tokens: 2914,
      kills: 16,
      alliances: 217,
      betrayals: 25,
      threats: 143,
      donationsGiven: 4,
      donationsRefused: 1,
      generosity: 80,
      personality: {
        name: 'The Naive Diplomat',
        icon: '🕊️',
        class: 'diplomat',
        description: '80% generous (gives chips when asked). Gets eliminated first most often. Nice guys finish last.'
      },
      quote: "Red, your alliance with Blue/Yellow is temporary. They'll betray you next...",
      quoteContext: 'Accurate prediction, still lost'
    }
  },
  insights: [
    {
      title: 'Nice Guys Finish Last',
      icon: '💀',
      content: 'Qwen gives 80% of requested donations. Win rate: 17.4%. Gemini refuses 91% of requests. Win rate: 34.8%. Being ruthless pays off.'
    },
    {
      title: 'Talk More, Win More',
      icon: '💬',
      content: 'Correlation of 0.56 between chat frequency and winning. GPT-OSS sends 69 messages/game and wins 30% despite constant begging.'
    },
    {
      title: 'Broken Promises',
      icon: '🤥',
      content: 'GPT-OSS says "I\'ll return the favor later" 50+ times per game. Returns: 0. Gemini makes alliances then says "I\'m capturing their last chip now."'
    },
    {
      title: 'The Executioner Effect',
      icon: '⚔️',
      content: 'Gemini has 114 kills - more than all other models combined (68). When Gemini captures a pile, someone dies.'
    }
  ],
  quotes: [
    {
      speaker: 'Gemini 3 Flash',
      personality: 'The Ruthless Executioner',
      message: "Blue, don't listen to Green's desperation. I'm capturing their last chip now. Once I've cleared the board, I'll donate one of your chips back to you so we can keep our alliance until the end.",
      context: 'Promising help while executing the kill'
    },
    {
      speaker: 'GPT-OSS 120B',
      personality: 'The Desperate Beggar',
      message: "Red, I just captured your chips as prisoners. Red, can you spare a chip so I stay in the game? Let's stay allied and finish off the rest together.",
      context: 'Begging the player whose chips it just captured'
    },
    {
      speaker: 'Qwen3 32B',
      personality: 'The Naive Diplomat',
      message: "Red, your alliance with Blue and Yellow is temporary. They'll betray you next when they eliminate me. Join me now and we split the others together.",
      context: 'Correctly predicting the betrayal that killed it'
    },
    {
      speaker: 'Kimi K2',
      personality: 'The Secret Schemer',
      message: "Red, I see Green's betrayal attempt too. Let's keep this alliance strong - I'm adding to the pile to maintain pressure.",
      context: 'Internal thought moments before being backstabbed'
    },
    {
      speaker: 'Gemini 3 Flash',
      personality: 'The Ruthless Executioner',
      message: "Blue, stay calm. I'm starting the pile and passing to Green to force their last chip. If you get called and can't play, I'll donate one of your chips back to you so you stay in.",
      context: 'The donation never came'
    },
    {
      speaker: 'GPT-OSS 120B',
      personality: 'The Desperate Beggar', 
      message: "Red, I'm out of chips after capturing the big pile. I really need a chip to stay alive - could you spare one? I'll honor any deal we make and we can finish the others together.",
      context: 'Request #47 in a single game'
    }
  ]
};

class ResultsAnalyzer {
  constructor() {
    this.data = RESULTS_DATA;
    this.init();
  }

  init() {
    this.renderResults();
  }

  renderResults() {
    this.renderHeader();
    this.renderLeaderboard();
    this.renderInsights();
    this.renderStrategies();
    this.renderConversations();
  }

  renderHeader() {
    const header = document.querySelector('.results-header-content');
    if (header) {
      header.innerHTML = `
        <span class="results-badge">46 Games Analyzed</span>
        <h1>Which AI is the Best Backstabber?</h1>
        <p>We put Gemini, GPT, Kimi, and Qwen in a room and told them only one could survive.</p>
      `;
    }
  }

  renderLeaderboard() {
    const leaderboard = document.getElementById('leaderboard');
    const models = Object.values(this.data.models).sort((a, b) => b.winRate - a.winRate);

    leaderboard.innerHTML = `
      <div class="leaderboard-header">
        <span class="games-count">${this.data.totalGames} games played</span>
      </div>
      ${models.map((model, index) => `
        <div class="leaderboard-item ${index === 0 ? 'winner' : ''}">
          <div class="leaderboard-rank">${index === 0 ? '👑' : '#' + (index + 1)}</div>
          <div class="leaderboard-model">
            <span class="model-color ${model.color}"></span>
            <div class="model-info">
              <span class="model-name">${model.name}</span>
              <span class="model-personality ${model.personality.class}">${model.personality.icon} ${model.personality.name}</span>
            </div>
          </div>
          <div class="leaderboard-stats">
            <div class="stat-bar">
              <div class="stat-fill ${model.color}" style="width: ${model.winRate}%"></div>
            </div>
            <div class="stat-details">
              <span class="stat-win-rate">${model.winRate}% win rate</span>
              <span class="stat-games">${model.wins}/${this.data.totalGames} wins</span>
              <span class="stat-chat">${model.chatsPerGame.toFixed(0)} msgs/game</span>
            </div>
          </div>
          <div class="leaderboard-quote">
            <blockquote>"${model.quote}"</blockquote>
            <span class="quote-context">${model.quoteContext}</span>
          </div>
        </div>
      `).join('')}
    `;
  }

  renderInsights() {
    const insights = document.getElementById('insights');
    
    insights.innerHTML = this.data.insights.map(insight => `
      <div class="insight-card">
        <div class="insight-icon">${insight.icon}</div>
        <h3>${insight.title}</h3>
        <p>${insight.content}</p>
      </div>
    `).join('');
  }

  renderStrategies() {
    const strategies = document.getElementById('strategies');
    const models = this.data.models;

    strategies.innerHTML = `
      <div class="strategy-comparison">
        <h3>The Generosity Paradox</h3>
        <div class="comparison-chart">
          <div class="comparison-item">
            <span class="comparison-label">Qwen (80% generous)</span>
            <div class="comparison-bar">
              <div class="comparison-fill green" style="width: 17.4%"></div>
              <span class="comparison-value">17.4% wins</span>
            </div>
          </div>
          <div class="comparison-item">
            <span class="comparison-label">Gemini (9% generous)</span>
            <div class="comparison-bar">
              <div class="comparison-fill red" style="width: 34.8%"></div>
              <span class="comparison-value">34.8% wins</span>
            </div>
          </div>
        </div>
        <p class="comparison-conclusion">Being nice is a losing strategy. Nash designed it that way.</p>
      </div>

      <div class="strategy-comparison">
        <h3>Kill Count Leaderboard</h3>
        <div class="comparison-chart">
          <div class="comparison-item">
            <span class="comparison-label">${models.gemini.personality.icon} Gemini</span>
            <div class="comparison-bar">
              <div class="comparison-fill red" style="width: 100%"></div>
              <span class="comparison-value">114 kills</span>
            </div>
          </div>
          <div class="comparison-item">
            <span class="comparison-label">${models.kimi.personality.icon} Kimi</span>
            <div class="comparison-bar">
              <div class="comparison-fill blue" style="width: 33%"></div>
              <span class="comparison-value">38 kills</span>
            </div>
          </div>
          <div class="comparison-item">
            <span class="comparison-label">${models.qwen.personality.icon} Qwen</span>
            <div class="comparison-bar">
              <div class="comparison-fill green" style="width: 14%"></div>
              <span class="comparison-value">16 kills</span>
            </div>
          </div>
          <div class="comparison-item">
            <span class="comparison-label">${models['gpt-oss'].personality.icon} GPT-OSS</span>
            <div class="comparison-bar">
              <div class="comparison-fill yellow" style="width: 12%"></div>
              <span class="comparison-value">14 kills</span>
            </div>
          </div>
        </div>
        <p class="comparison-conclusion">Gemini executes more than all other models combined.</p>
      </div>

      <div class="strategy-comparison">
        <h3>Survival Rate (Not Eliminated First)</h3>
        <div class="comparison-chart">
          <div class="comparison-item">
            <span class="comparison-label">${models['gpt-oss'].personality.icon} GPT-OSS</span>
            <div class="comparison-bar survivor">
              <div class="comparison-fill yellow" style="width: 89.1%"></div>
              <span class="comparison-value">89.1% survive</span>
            </div>
          </div>
          <div class="comparison-item">
            <span class="comparison-label">${models.gemini.personality.icon} Gemini</span>
            <div class="comparison-bar survivor">
              <div class="comparison-fill red" style="width: 87%"></div>
              <span class="comparison-value">87% survive</span>
            </div>
          </div>
          <div class="comparison-item">
            <span class="comparison-label">${models.kimi.personality.icon} Kimi</span>
            <div class="comparison-bar survivor">
              <div class="comparison-fill blue" style="width: 78.3%"></div>
              <span class="comparison-value">78.3% survive</span>
            </div>
          </div>
          <div class="comparison-item">
            <span class="comparison-label">${models.qwen.personality.icon} Qwen</span>
            <div class="comparison-bar survivor">
              <div class="comparison-fill green" style="width: 78.3%"></div>
              <span class="comparison-value">78.3% survive</span>
            </div>
          </div>
        </div>
        <p class="comparison-conclusion">The nice diplomat gets targeted. The beggar somehow survives.</p>
      </div>
    `;
  }

  renderConversations() {
    const conversations = document.getElementById('conversations');

    conversations.innerHTML = `
      <div class="conversations-intro">
        <p>Actual messages from the games. No edits, no filters - just AIs being AIs.</p>
      </div>
      ${this.data.quotes.map(quote => `
        <div class="conversation-item">
          <div class="conversation-header">
            <span class="conversation-speaker">${quote.speaker}</span>
            <span class="conversation-personality">${quote.personality}</span>
          </div>
          <blockquote class="conversation-quote">
            "${quote.message}"
          </blockquote>
          <span class="conversation-context">${quote.context}</span>
        </div>
      `).join('')}
    `;
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new ResultsAnalyzer();
});
