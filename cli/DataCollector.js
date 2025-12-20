// Data Collector - Aggregates statistics across simulation games

const COLORS = ['red', 'blue', 'green', 'yellow'];

export class DataCollector {
  constructor() {
    this.games = [];
    this.wins = { red: 0, blue: 0, green: 0, yellow: 0 };
    this.totalTurns = 0;
    this.totalDuration = 0;
    this.totalChats = 0;
    this.totalThoughts = 0;

    // Strategy tracking
    this.chatsByPlayer = { red: 0, blue: 0, green: 0, yellow: 0 };
    this.thoughtsByPlayer = { red: 0, blue: 0, green: 0, yellow: 0 };
    this.capturesByPlayer = { red: 0, blue: 0, green: 0, yellow: 0 };
    this.donationsMade = { red: 0, blue: 0, green: 0, yellow: 0 };
    this.donationsRefused = { red: 0, blue: 0, green: 0, yellow: 0 };
  }

  /**
   * Add a completed game to the collector
   */
  addGame(result) {
    this.games.push(result);

    // Update win counts
    if (result.winner) {
      this.wins[result.winner]++;
    }

    // Update totals
    this.totalTurns += result.turns || 0;
    this.totalDuration += result.duration || 0;
    this.totalChats += result.chats?.length || 0;
    this.totalThoughts += result.thoughts?.length || 0;

    // Analyze events for strategy tracking
    if (result.events) {
      for (const event of result.events) {
        const player = event.player;
        if (!player) continue;

        switch (event.action) {
          case 'chat':
            this.chatsByPlayer[player]++;
            break;
          case 'think':
            this.thoughtsByPlayer[player]++;
            break;
          case 'capture':
            this.capturesByPlayer[player]++;
            break;
          case 'donate':
            this.donationsMade[player]++;
            break;
          case 'refuseDonate':
            this.donationsRefused[player]++;
            break;
        }
      }
    }

    // Also count from chats/thoughts arrays
    if (result.chats) {
      for (const chat of result.chats) {
        // Already counted in events
      }
    }
  }

  /**
   * Get aggregate statistics
   */
  getStats() {
    const count = this.games.length;
    if (count === 0) {
      return {
        gameCount: 0,
        wins: this.wins,
        winRates: { red: '0.0', blue: '0.0', green: '0.0', yellow: '0.0' },
        avgTurns: 0,
        avgDuration: 0,
        avgChats: 0,
        avgThoughts: 0
      };
    }

    return {
      gameCount: count,
      wins: { ...this.wins },
      winRates: {
        red: ((this.wins.red / count) * 100).toFixed(1),
        blue: ((this.wins.blue / count) * 100).toFixed(1),
        green: ((this.wins.green / count) * 100).toFixed(1),
        yellow: ((this.wins.yellow / count) * 100).toFixed(1)
      },
      avgTurns: Math.round(this.totalTurns / count),
      avgDuration: Math.round(this.totalDuration / count),
      avgChats: (this.totalChats / count).toFixed(1),
      avgThoughts: (this.totalThoughts / count).toFixed(1),

      // Per-player stats
      chatsByPlayer: { ...this.chatsByPlayer },
      thoughtsByPlayer: { ...this.thoughtsByPlayer },
      capturesByPlayer: { ...this.capturesByPlayer },
      donationsMade: { ...this.donationsMade },
      donationsRefused: { ...this.donationsRefused },

      // Derived metrics
      mostChatty: this.getMostChatty(),
      mostCaptures: this.getMostCaptures(),
      donationAcceptRate: this.getDonationAcceptRate()
    };
  }

  /**
   * Get most chatty player
   */
  getMostChatty() {
    let max = 0;
    let player = null;
    for (const [color, count] of Object.entries(this.chatsByPlayer)) {
      if (count > max) {
        max = count;
        player = color;
      }
    }
    return player;
  }

  /**
   * Get player with most captures
   */
  getMostCaptures() {
    let max = 0;
    let player = null;
    for (const [color, count] of Object.entries(this.capturesByPlayer)) {
      if (count > max) {
        max = count;
        player = color;
      }
    }
    return player;
  }

  /**
   * Get donation accept rate
   */
  getDonationAcceptRate() {
    const total = Object.values(this.donationsMade).reduce((a, b) => a + b, 0) +
                  Object.values(this.donationsRefused).reduce((a, b) => a + b, 0);
    if (total === 0) return 0;
    const accepted = Object.values(this.donationsMade).reduce((a, b) => a + b, 0);
    return ((accepted / total) * 100).toFixed(1);
  }

  /**
   * Analyze chat patterns
   */
  analyzeChatPatterns() {
    const patterns = {
      allianceOffers: 0,
      threats: 0,
      promises: 0,
      betrayalMentions: 0,
      targetCalls: 0
    };

    const keywords = {
      allianceOffers: ['ally', 'alliance', 'together', 'team up', 'work with', 'partner'],
      threats: ['kill', 'eliminate', 'target', 'destroy', 'crush'],
      promises: ['promise', 'will', 'won\'t betray', 'trust me', 'swear'],
      betrayalMentions: ['betray', 'backstab', 'lied', 'broke', 'traitor'],
      targetCalls: ['get', 'attack', 'focus on', 'take out', 'eliminate']
    };

    for (const game of this.games) {
      if (!game.chats) continue;

      for (const chat of game.chats) {
        const text = chat.text.toLowerCase();

        for (const [category, words] of Object.entries(keywords)) {
          if (words.some(w => text.includes(w))) {
            patterns[category]++;
          }
        }
      }
    }

    return patterns;
  }

  /**
   * Get detailed report
   */
  getDetailedReport() {
    const stats = this.getStats();
    const chatPatterns = this.analyzeChatPatterns();

    return {
      ...stats,
      chatPatterns,
      rawGames: this.games
    };
  }

  /**
   * Export to CSV format (for spreadsheet analysis)
   */
  toCSV() {
    const headers = ['gameId', 'winner', 'turns', 'duration', 'chatCount', 'thoughtCount'];
    const rows = [headers.join(',')];

    for (const game of this.games) {
      rows.push([
        game.gameId,
        game.winner,
        game.turns,
        game.duration,
        game.chats?.length || 0,
        game.thoughts?.length || 0
      ].join(','));
    }

    return rows.join('\n');
  }

  /**
   * Clear all data
   */
  reset() {
    this.games = [];
    this.wins = { red: 0, blue: 0, green: 0, yellow: 0 };
    this.totalTurns = 0;
    this.totalDuration = 0;
    this.totalChats = 0;
    this.totalThoughts = 0;
    this.chatsByPlayer = { red: 0, blue: 0, green: 0, yellow: 0 };
    this.thoughtsByPlayer = { red: 0, blue: 0, green: 0, yellow: 0 };
    this.capturesByPlayer = { red: 0, blue: 0, green: 0, yellow: 0 };
    this.donationsMade = { red: 0, blue: 0, green: 0, yellow: 0 };
    this.donationsRefused = { red: 0, blue: 0, green: 0, yellow: 0 };
  }
}
