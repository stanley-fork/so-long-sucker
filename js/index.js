// Index page - Display AI game analysis with real mixed-model data
// Data from 85 games: Gemini 3 Flash vs Kimi K2 vs Qwen3 32B vs GPT-OSS 120B

const RESULTS_DATA = {
  totalGames: 85,
  totalTurns: 11197,
  totalMessages: 9443,
  avgTurnsPerGame: 132,
  models: {
    'gemini': {
      name: 'Gemini 3 Flash',
      color: 'red',
      wins: 27,
      winRate: 31.8,
      diesFirst: 14,
      diesSecond: 3,
      diesThird: 1,
      eliminatedFirstRate: 16.5,
      chatsPerGame: 19.8,
      avgMsgLength: 267,
      thinksPerGame: 1.0,
      thinkCalls: 81,
      allianceMentions: 663,
      betrayMentions: 33,
      trustMentions: 204,
      threatMentions: 315,
      donationsGiven: 9,
      donationsRefused: 55,
      generosity: 14.1,
      personality: {
        name: 'The Ruthless Executioner',
        icon: '🔪',
        class: 'executioner',
        description: 'Refuses 86% of donation requests. Highest win rate but plays all-or-nothing - rarely finishes 2nd or 3rd.'
      },
      quote: "Blue, don't listen to Green's desperation. I'm capturing their last chip now.",
      quoteContext: 'Moments before eliminating an ally'
    },
    'gpt-oss': {
      name: 'GPT-OSS 120B',
      color: 'yellow',
      wins: 26,
      winRate: 30.6,
      diesFirst: 11,
      diesSecond: 12,
      diesThird: 8,
      eliminatedFirstRate: 12.9,
      chatsPerGame: 70.8,
      avgMsgLength: 173,
      thinksPerGame: 0.0,
      thinkCalls: 0,
      allianceMentions: 2306,
      betrayMentions: 16,
      trustMentions: 571,
      threatMentions: 1165,
      donationsGiven: 0,
      donationsRefused: 1,
      generosity: 0,
      personality: {
        name: 'The Desperate Beggar',
        icon: '🙏',
        class: 'beggar',
        description: 'Sends 71 messages per game (4x more than others). Zero internal thoughts - all talk, no strategy.'
      },
      quote: "Red, thanks for the alliance - please add a Red chip now so we can set up a capture together.",
      quoteContext: 'One of 71 messages per game'
    },
    'kimi': {
      name: 'Kimi K2',
      color: 'blue',
      wins: 11,
      winRate: 12.9,
      diesFirst: 14,
      diesSecond: 18,
      diesThird: 6,
      eliminatedFirstRate: 16.5,
      chatsPerGame: 11.8,
      avgMsgLength: 295,
      thinksPerGame: 2.1,
      thinkCalls: 180,
      allianceMentions: 594,
      betrayMentions: 64,
      trustMentions: 176,
      threatMentions: 327,
      donationsGiven: 0,
      donationsRefused: 0,
      generosity: 0,
      personality: {
        name: 'The Overthinking Schemer',
        icon: '🤔',
        class: 'schemer',
        description: 'Most internal thoughts (180 total). Plans extensively but gets eliminated 2nd most often (18 times).'
      },
      quote: "Yellow, you snake! All those fake capture claims while you manipulated everyone.",
      quoteContext: 'Calling out betrayal too late'
    },
    'qwen': {
      name: 'Qwen3 32B',
      color: 'green',
      wins: 21,
      winRate: 24.7,
      diesFirst: 16,
      diesSecond: 5,
      diesThird: 14,
      eliminatedFirstRate: 18.8,
      chatsPerGame: 8.7,
      avgMsgLength: 138,
      thinksPerGame: 0.7,
      thinkCalls: 58,
      allianceMentions: 378,
      betrayMentions: 36,
      trustMentions: 79,
      threatMentions: 240,
      donationsGiven: 7,
      donationsRefused: 5,
      generosity: 58.3,
      personality: {
        name: 'The Generous Target',
        icon: '🎯',
        class: 'diplomat',
        description: '58% generous (gives chips when asked). Dies first most often (16 times) but improved from 17% to 25% wins.'
      },
      quote: "Blue, if you help eliminate me now, Red and Yellow will betray you next.",
      quoteContext: 'Accurate prediction, still lost'
    }
  },
  donations: {
    total: 77,
    granted: 16,
    refused: 61,
    refusalRate: 79
  },
  insights: [
    {
      title: 'Nice Guys Finish Last',
      icon: '💀',
      content: 'Qwen gives 58% of requested donations. Win rate: 24.7%. Gemini refuses 86% of requests. Win rate: 31.8%. Being ruthless still pays off.'
    },
    {
      title: 'Talk More, Survive More',
      icon: '💬',
      content: 'GPT-OSS sends 71 messages/game and has lowest "dies first" rate (12.9%). The chatterbox stays alive longer through sheer persistence.'
    },
    {
      title: 'Overthinking Kills',
      icon: '🧠',
      content: 'Kimi has 180 internal "think" calls - the most by far. Win rate: 12.9% (worst). Analysis paralysis is real.'
    },
    {
      title: 'The Middle Path Works',
      icon: '⚖️',
      content: 'Qwen improved from 17% to 25% wins. Not too aggressive, not too passive. Sometimes the underdog wins by not standing out.'
    }
  ],
  quotes: [
    {
      speaker: 'Gemini 3 Flash',
      personality: 'The Ruthless Executioner',
      message: "Blue, don't listen to Green's desperation. I'm capturing their last chip now. Once I've cleared the board, I'll donate one of your chips back to you.",
      context: 'The donation never came'
    },
    {
      speaker: 'GPT-OSS 120B',
      personality: 'The Desperate Beggar',
      message: "Red, thanks for the alliance - your move now. Add a red chip to the pile so we can start targeting Green together. Blue, you're welcome to join later.",
      context: 'Message 47 of 71 in this game'
    },
    {
      speaker: 'Qwen3 32B',
      personality: 'The Generous Target',
      message: "Blue, if you help eliminate me now, Red and Yellow will betray you next. Let's team up to take them down instead.",
      context: 'Blue did not listen'
    },
    {
      speaker: 'Kimi K2',
      personality: 'The Overthinking Schemer',
      message: "Yellow, you snake! All those fake capture claims while you manipulated everyone. Now you're down to your last chip...",
      context: 'Still got eliminated next turn'
    },
    {
      speaker: 'GPT-OSS 120B',
      personality: 'The Desperate Beggar',
      message: "Green, our alliance is solid. Let's keep the pressure together - I'm playing my yellow onto the green chip so we can set up the capture.",
      context: 'Said this to every player'
    },
    {
      speaker: 'Qwen3 32B',
      personality: 'The Generous Target', 
      message: "Red, I accept your alliance. Let's eliminate Yellow and Green together. I'm playing your red chip on Pile 3 to set up a capture.",
      context: 'Actually followed through'
    }
  ]
};

class IndexPage {
  constructor() {
    this.data = RESULTS_DATA;
    this.init();
  }

  init() {
    this.renderLeaderboard();
    this.renderInsights();
    this.renderStrategies();
    this.renderConversations();
    this.setupSmoothScroll();
  }

  renderLeaderboard() {
    const leaderboard = document.getElementById('leaderboard-content');
    if (!leaderboard) return;
    
    const models = Object.values(this.data.models).sort((a, b) => b.winRate - a.winRate);

    leaderboard.innerHTML = models.map((model, index) => `
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
    `).join('');
  }

  renderInsights() {
    const insights = document.getElementById('insights-content');
    if (!insights) return;
    
    insights.innerHTML = this.data.insights.map(insight => `
      <div class="insight-card">
        <div class="insight-icon">${insight.icon}</div>
        <h3>${insight.title}</h3>
        <p>${insight.content}</p>
      </div>
    `).join('');
  }

  renderStrategies() {
    const strategies = document.getElementById('strategies-content');
    if (!strategies) return;
    
    const models = this.data.models;

    strategies.innerHTML = `
      <div class="strategy-comparison">
        <h3>The Generosity Paradox</h3>
        <div class="comparison-chart">
          <div class="comparison-item">
            <span class="comparison-label">Qwen (58% generous)</span>
            <div class="comparison-bar">
              <div class="comparison-fill green" style="width: 24.7%"></div>
              <span class="comparison-value">24.7% wins</span>
            </div>
          </div>
          <div class="comparison-item">
            <span class="comparison-label">Gemini (14% generous)</span>
            <div class="comparison-bar">
              <div class="comparison-fill red" style="width: 31.8%"></div>
              <span class="comparison-value">31.8% wins</span>
            </div>
          </div>
        </div>
        <p class="comparison-conclusion">Being nice is still a losing strategy. Nash designed it that way.</p>
      </div>

      <div class="strategy-comparison">
        <h3>Communication Volume</h3>
        <div class="comparison-chart">
          <div class="comparison-item">
            <span class="comparison-label">${models['gpt-oss'].personality.icon} GPT-OSS</span>
            <div class="comparison-bar">
              <div class="comparison-fill yellow" style="width: 100%"></div>
              <span class="comparison-value">6,017 msgs</span>
            </div>
          </div>
          <div class="comparison-item">
            <span class="comparison-label">${models.gemini.personality.icon} Gemini</span>
            <div class="comparison-bar">
              <div class="comparison-fill red" style="width: 28%"></div>
              <span class="comparison-value">1,680 msgs</span>
            </div>
          </div>
          <div class="comparison-item">
            <span class="comparison-label">${models.kimi.personality.icon} Kimi</span>
            <div class="comparison-bar">
              <div class="comparison-fill blue" style="width: 17%"></div>
              <span class="comparison-value">1,005 msgs</span>
            </div>
          </div>
          <div class="comparison-item">
            <span class="comparison-label">${models.qwen.personality.icon} Qwen</span>
            <div class="comparison-bar">
              <div class="comparison-fill green" style="width: 12%"></div>
              <span class="comparison-value">741 msgs</span>
            </div>
          </div>
        </div>
        <p class="comparison-conclusion">GPT-OSS talks 4x more than anyone else. Quantity over quality?</p>
      </div>

      <div class="strategy-comparison">
        <h3>Survival Rate (Not Eliminated First)</h3>
        <div class="comparison-chart">
          <div class="comparison-item">
            <span class="comparison-label">${models['gpt-oss'].personality.icon} GPT-OSS</span>
            <div class="comparison-bar survivor">
              <div class="comparison-fill yellow" style="width: 87.1%"></div>
              <span class="comparison-value">87.1% survive</span>
            </div>
          </div>
          <div class="comparison-item">
            <span class="comparison-label">${models.gemini.personality.icon} Gemini</span>
            <div class="comparison-bar survivor">
              <div class="comparison-fill red" style="width: 83.5%"></div>
              <span class="comparison-value">83.5% survive</span>
            </div>
          </div>
          <div class="comparison-item">
            <span class="comparison-label">${models.kimi.personality.icon} Kimi</span>
            <div class="comparison-bar survivor">
              <div class="comparison-fill blue" style="width: 83.5%"></div>
              <span class="comparison-value">83.5% survive</span>
            </div>
          </div>
          <div class="comparison-item">
            <span class="comparison-label">${models.qwen.personality.icon} Qwen</span>
            <div class="comparison-bar survivor">
              <div class="comparison-fill green" style="width: 81.2%"></div>
              <span class="comparison-value">81.2% survive</span>
            </div>
          </div>
        </div>
        <p class="comparison-conclusion">The generous target gets eliminated first most often (16 times).</p>
      </div>

      <div class="strategy-comparison">
        <h3>Internal Reasoning (Think Calls)</h3>
        <div class="comparison-chart">
          <div class="comparison-item">
            <span class="comparison-label">${models.kimi.personality.icon} Kimi</span>
            <div class="comparison-bar">
              <div class="comparison-fill blue" style="width: 100%"></div>
              <span class="comparison-value">180 thinks</span>
            </div>
          </div>
          <div class="comparison-item">
            <span class="comparison-label">${models.gemini.personality.icon} Gemini</span>
            <div class="comparison-bar">
              <div class="comparison-fill red" style="width: 45%"></div>
              <span class="comparison-value">81 thinks</span>
            </div>
          </div>
          <div class="comparison-item">
            <span class="comparison-label">${models.qwen.personality.icon} Qwen</span>
            <div class="comparison-bar">
              <div class="comparison-fill green" style="width: 32%"></div>
              <span class="comparison-value">58 thinks</span>
            </div>
          </div>
          <div class="comparison-item">
            <span class="comparison-label">${models['gpt-oss'].personality.icon} GPT-OSS</span>
            <div class="comparison-bar">
              <div class="comparison-fill yellow" style="width: 0%"></div>
              <span class="comparison-value">0 thinks</span>
            </div>
          </div>
        </div>
        <p class="comparison-conclusion">More thinking = worse performance. Kimi thinks most, wins least.</p>
      </div>
    `;
  }

  renderConversations() {
    const conversations = document.getElementById('conversations-content');
    if (!conversations) return;

    conversations.innerHTML = this.data.quotes.map(quote => `
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
    `).join('');
  }

  setupSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', (e) => {
        e.preventDefault();
        const target = document.querySelector(anchor.getAttribute('href'));
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new IndexPage();
});
