// UI rendering and event handling for So Long Sucker

export class UI {
  constructor(game, onAction) {
    this.game = game;
    this.onAction = onAction;  // Callback for game actions
    this.elements = {};
    this.aiPlayers = [];  // Track which players are AI
    this.cacheElements();
    this.bindEvents();
  }

  /**
   * Set which players are AI-controlled
   * @param {number[]} aiPlayers - Array of player indices that are AI
   * @param {Object} playerModels - Map of playerId -> model name (optional)
   */
  setAIPlayers(aiPlayers, playerModels = {}) {
    this.aiPlayers = aiPlayers || [];
    this.playerModels = playerModels || {};
  }

  /**
   * Check if a player is AI-controlled
   * @param {number} playerIndex - Player index to check
   */
  isAI(playerIndex) {
    return this.aiPlayers.includes(playerIndex);
  }

  /**
   * Get display name for a model
   * @param {string} modelConfig - Model config string (provider:model format)
   */
  getModelDisplayName(modelConfig) {
    if (!modelConfig) return 'AI';
    
    const modelMap = {
      'gemini:gemini-3-flash-preview': 'Gemini 3',
      'gemini:gemini-2.5-flash': 'Gemini 2.5',
      'groq:openai/gpt-oss-120b': 'GPT-OSS',
      'groq:moonshotai/kimi-k2-instruct-0905': 'Kimi K2',
      'groq:llama-3.3-70b-versatile': 'Llama 3.3',
      'groq:qwen/qwen3-32b': 'Qwen 3',
      'openai/gpt-oss-120b': 'GPT-OSS',
      'moonshotai/kimi-k2-instruct-0905': 'Kimi K2',
      'llama-3.3-70b-versatile': 'Llama 3.3',
      'qwen/qwen3-32b': 'Qwen 3'
    };
    
    return modelMap[modelConfig] || modelConfig.split(':').pop().split('/').pop();
  }

  /**
   * Cache DOM elements
   */
  cacheElements() {
    this.elements = {
      turnIndicator: document.getElementById('turn-indicator'),
      statusMessage: document.getElementById('status-message'),
      pilesContainer: document.getElementById('piles-container'),
      deadChips: document.getElementById('dead-chips'),
      playerPanels: document.querySelectorAll('.player-panel'),
      donationModal: document.getElementById('donation-modal'),
      donationMessage: document.getElementById('donation-message'),
      donationOptions: document.getElementById('donation-options'),
      nextPlayerModal: document.getElementById('next-player-modal'),
      nextPlayerOptions: document.getElementById('next-player-options'),
      captureModal: document.getElementById('capture-modal'),
      captureChips: document.getElementById('capture-chips'),
      gameOverModal: document.getElementById('game-over-modal'),
      winnerMessage: document.getElementById('winner-message'),
      restartBtn: document.getElementById('restart-btn'),
      // Negotiation elements
      chatMessages: document.getElementById('chat-messages'),
      chatInput: document.getElementById('chat-input'),
      chatPlayerSelect: document.getElementById('chat-player-select'),
      chatSendBtn: document.getElementById('chat-send-btn'),
      // Give prisoner modal
      givePrisonerBtn: document.getElementById('give-prisoner-btn'),
      givePrisonerModal: document.getElementById('give-prisoner-modal'),
      giveFrom: document.getElementById('give-from'),
      giveTo: document.getElementById('give-to'),
      givePrisonerChips: document.getElementById('give-prisoner-chips'),
      giveConfirmBtn: document.getElementById('give-confirm-btn'),
      giveCancelBtn: document.getElementById('give-cancel-btn')
    };

    // Track selected prisoner in give modal
    this.selectedGivePrisoner = null;
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    this.elements.restartBtn.addEventListener('click', () => {
      this.onAction('restart');
    });

    // Chat events
    this.elements.chatSendBtn.addEventListener('click', () => {
      this.sendChatMessage();
    });

    this.elements.chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.sendChatMessage();
    });

    // Give prisoner modal events
    this.elements.givePrisonerBtn.addEventListener('click', () => {
      this.showGivePrisonerModal();
    });

    this.elements.giveFrom.addEventListener('change', () => {
      this.updateGivePrisonerChips();
    });

    this.elements.giveConfirmBtn.addEventListener('click', () => {
      this.confirmGivePrisoner();
    });

    this.elements.giveCancelBtn.addEventListener('click', () => {
      this.elements.givePrisonerModal.classList.add('hidden');
    });
  }

  /**
   * Send chat message
   */
  sendChatMessage() {
    const text = this.elements.chatInput.value.trim();
    if (!text) return;
    const player = parseInt(this.elements.chatPlayerSelect.value);
    this.onAction('chat', { player, text });
    this.elements.chatInput.value = '';
  }

  /**
   * Show give prisoner modal
   */
  showGivePrisonerModal() {
    this.selectedGivePrisoner = null;
    this.elements.giveConfirmBtn.disabled = true;
    this.updateGivePrisonerChips();
    this.elements.givePrisonerModal.classList.remove('hidden');
  }

  /**
   * Update prisoner chips in give modal based on selected player
   */
  updateGivePrisonerChips() {
    const fromIndex = parseInt(this.elements.giveFrom.value);
    const player = this.game.getPlayer(fromIndex);
    const container = this.elements.givePrisonerChips;

    container.innerHTML = '';
    this.selectedGivePrisoner = null;
    this.elements.giveConfirmBtn.disabled = true;

    if (player.prisoners.length === 0) {
      container.innerHTML = '<span class="no-prisoners">No prisoners to give</span>';
      return;
    }

    player.prisoners.forEach((color, index) => {
      const chip = document.createElement('div');
      chip.className = `chip-small ${color}`;
      chip.dataset.color = color;
      chip.dataset.index = index;

      chip.addEventListener('click', () => {
        // Deselect others
        container.querySelectorAll('.chip-small').forEach(c => c.classList.remove('selected'));
        // Select this one
        chip.classList.add('selected');
        this.selectedGivePrisoner = color;
        this.elements.giveConfirmBtn.disabled = false;
      });

      container.appendChild(chip);
    });
  }

  /**
   * Confirm give prisoner
   */
  confirmGivePrisoner() {
    if (!this.selectedGivePrisoner) return;

    const from = parseInt(this.elements.giveFrom.value);
    const to = parseInt(this.elements.giveTo.value);

    if (from === to) {
      alert('Cannot give to yourself');
      return;
    }

    this.onAction('givePrisoner', {
      from,
      to,
      color: this.selectedGivePrisoner
    });

    this.elements.givePrisonerModal.classList.add('hidden');
  }

  /**
   * Full render of game state
   */
  render(state) {
    // Set phase class on game container for CSS-based highlighting
    const container = document.getElementById('game-container');
    container.className = container.className.replace(/phase-\w+/g, '').trim();
    container.className = container.className.replace(/current-\w+/g, '').trim();
    container.className = container.className.replace(/turn-\w+/g, '').trim();
    container.classList.add(`phase-${state.phase}`);
    container.classList.add(`current-${state.players[state.currentPlayer].color}`);
    container.classList.add(this.isAI(state.currentPlayer) ? 'turn-ai' : 'turn-human');

    this.renderTurnIndicator(state);
    this.renderStatusMessage(state);
    this.renderPiles(state);
    this.renderDeadBox(state);
    this.renderPlayers(state);
    this.renderNegotiation(state);
    // Don't auto-hide modals - they are managed explicitly by show/hide calls
  }

  /**
   * Render turn indicator
   */
  renderTurnIndicator(state) {
    const player = state.players[state.currentPlayer];
    const isAI = this.isAI(state.currentPlayer);
    const colorName = player.color.charAt(0).toUpperCase() + player.color.slice(1);
    
    this.elements.turnIndicator.innerHTML = isAI 
      ? `${colorName}'s Turn 🤖`
      : `${colorName}'s Turn`;
    this.elements.turnIndicator.style.color = `var(--${player.color})`;
  }

  /**
   * Render status message based on phase
   */
  renderStatusMessage(state) {
    const messages = {
      selectChip: 'Select a chip to play',
      selectPile: 'Select a pile to play on (or start new pile)',
      selectNextPlayer: 'Choose who plays next',
      capture: 'Choose a chip to kill',
      donation: 'Waiting for donation...',
      gameOver: 'Game Over!'
    };
    this.elements.statusMessage.textContent = messages[state.phase] || '';
  }

  /**
   * Render all piles
   */
  renderPiles(state) {
    const container = this.elements.pilesContainer;
    container.innerHTML = '';

    const isHumanTurn = !this.isAI(state.currentPlayer);
    const isSelectPile = state.phase === 'selectPile' && isHumanTurn;

    state.piles.forEach(pile => {
      const pileEl = document.createElement('div');
      pileEl.className = 'pile';
      if (isSelectPile) pileEl.classList.add('clickable');
      pileEl.dataset.pileId = pile.id;

      pile.chips.forEach((color, i) => {
        const chip = document.createElement('div');
        chip.className = `chip ${color}`;
        chip.dataset.index = i;
        pileEl.appendChild(chip);
      });

      const label = document.createElement('div');
      label.className = 'pile-label';
      label.textContent = `Pile ${pile.id}`;
      pileEl.appendChild(label);

      if (isSelectPile) {
        pileEl.addEventListener('click', () => {
          this.onAction('playOnPile', pile.id);
        });
      }

      container.appendChild(pileEl);
    });

    // Add "New Pile" card when in selectPile phase for human player
    if (isSelectPile) {
      const newPileCard = document.createElement('div');
      newPileCard.className = 'pile pile-new';
      newPileCard.innerHTML = `
        <div class="pile-new-icon">+</div>
        <div class="pile-label">New Pile</div>
      `;
      newPileCard.addEventListener('click', () => {
        this.onAction('playOnPile', null);
      });
      container.appendChild(newPileCard);
    }

    // Empty state - show message when no piles and it's selectPile phase
    if (state.piles.length === 0 && !isSelectPile) {
      const emptyMsg = document.createElement('div');
      emptyMsg.className = 'piles-empty';
      emptyMsg.textContent = 'No piles yet';
      container.appendChild(emptyMsg);
    }
  }

  /**
   * Render dead box
   */
  renderDeadBox(state) {
    const container = this.elements.deadChips;
    container.innerHTML = '';

    state.deadBox.forEach(color => {
      const chip = document.createElement('div');
      chip.className = `chip-small ${color}`;
      container.appendChild(chip);
    });
  }

  /**
   * Render all player panels
   */
  renderPlayers(state) {
    const isHumanTurn = !this.isAI(state.currentPlayer);
    const isSelectChip = state.phase === 'selectChip' && isHumanTurn;

    state.players.forEach((player, i) => {
      const panel = this.elements.playerPanels[i];
      const isCurrentPlayer = i === state.currentPlayer;
      const isAI = this.isAI(i);

      // Active state
      panel.classList.toggle('active', isCurrentPlayer && player.isAlive);
      panel.classList.toggle('eliminated', !player.isAlive);
      panel.classList.toggle('ai-player', isAI);

      // Status
      const status = panel.querySelector('.player-status');
      if (!player.isAlive) {
        status.textContent = 'ELIMINATED';
      } else if (isCurrentPlayer) {
        status.textContent = '◄ PLAYING';
      } else {
        status.textContent = '';
      }

      // Model name for AI players
      let modelLabel = panel.querySelector('.player-model-label');
      if (isAI && this.playerModels[i]) {
        if (!modelLabel) {
          modelLabel = document.createElement('div');
          modelLabel.className = 'player-model-label';
          status.parentNode.insertBefore(modelLabel, status.nextSibling);
        }
        modelLabel.textContent = this.getModelDisplayName(this.playerModels[i]);
      } else if (modelLabel) {
        modelLabel.remove();
      }

      // Supply chips
      const supplyContainer = panel.querySelector('.supply .chips');
      supplyContainer.innerHTML = '';
      for (let j = 0; j < player.supply; j++) {
        const chip = document.createElement('div');
        chip.className = `chip-small ${player.color}`;
        chip.dataset.source = 'supply';
        chip.dataset.color = player.color;

        // Add clickable class and handler when it's this player's turn to select chip
        if (isCurrentPlayer && isSelectChip) {
          chip.classList.add('clickable');
          chip.addEventListener('click', () => {
            this.onAction('selectChip', player.color);
          });
        }

        supplyContainer.appendChild(chip);
      }

      // Prisoner chips
      const prisonersContainer = panel.querySelector('.prisoners .chips');
      prisonersContainer.innerHTML = '';
      player.prisoners.forEach(color => {
        const chip = document.createElement('div');
        chip.className = `chip-small ${color}`;
        chip.dataset.source = 'prisoner';
        chip.dataset.color = color;

        // Add clickable class and handler when it's this player's turn to select chip
        if (isCurrentPlayer && isSelectChip) {
          chip.classList.add('clickable');
          chip.addEventListener('click', () => {
            this.onAction('selectChip', color);
          });
        }

        prisonersContainer.appendChild(chip);
      });
    });
  }

  /**
   * Hide all modals
   */
  hideAllModals() {
    this.elements.donationModal.classList.add('hidden');
    this.elements.nextPlayerModal.classList.add('hidden');
    this.elements.captureModal.classList.add('hidden');
    this.elements.gameOverModal.classList.add('hidden');
    this.elements.givePrisonerModal.classList.add('hidden');
  }

  // ==========================================
  // NEGOTIATION RENDERING
  // ==========================================

  /**
   * Render negotiation panel (chat only)
   */
  renderNegotiation(state) {
    this.renderChat(state);
  }

  /**
   * Render chat messages
   */
  renderChat(state) {
    const container = this.elements.chatMessages;
    container.innerHTML = '';

    state.messages.forEach(msg => {
      const msgEl = document.createElement('div');
      msgEl.className = `chat-message ${msg.color}`;
      msgEl.innerHTML = `
        <span class="sender">${msg.color.toUpperCase()}:</span>
        <span class="text">${this.escapeHtml(msg.text)}</span>
      `;
      container.appendChild(msgEl);
    });

    // Auto-scroll to bottom
    container.scrollTop = container.scrollHeight;
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Show donation modal
   */
  showDonationModal(askerIndex, donorIndex, donorPrisoners) {
    this.hideAllModals(); // Hide any other modals first
    const asker = this.game.getPlayer(askerIndex);
    const donor = this.game.getPlayer(donorIndex);

    this.elements.donationMessage.innerHTML = `
      <strong style="color: var(--${asker.color})">${asker.color.charAt(0).toUpperCase() + asker.color.slice(1)}</strong> has no chips.<br>
      <strong style="color: var(--${donor.color})">${donor.color.charAt(0).toUpperCase() + donor.color.slice(1)}</strong>, will you donate?
    `;

    this.elements.donationOptions.innerHTML = '';

    // Add chip buttons for each prisoner
    donorPrisoners.forEach(color => {
      const btn = document.createElement('button');
      btn.className = `modal-btn donate`;
      btn.innerHTML = `<span class="chip-small ${color}" style="margin-right: 8px;"></span> Donate ${color}`;
      btn.addEventListener('click', () => {
        // Check if game is still in the expected phase
        if (this.game.phase !== 'donation') {
          this.hideAllModals();
          return;
        }
        this.onAction('donate', { donor: donorIndex, accepts: true, color });
      });
      this.elements.donationOptions.appendChild(btn);
    });

    // Refuse button
    const refuseBtn = document.createElement('button');
    refuseBtn.className = 'modal-btn refuse';
    refuseBtn.textContent = 'Refuse';
    refuseBtn.addEventListener('click', () => {
      // Check if game is still in the expected phase
      if (this.game.phase !== 'donation') {
        this.hideAllModals();
        return;
      }
      this.onAction('donate', { donor: donorIndex, accepts: false });
    });
    this.elements.donationOptions.appendChild(refuseBtn);

    this.elements.donationModal.classList.remove('hidden');
  }

  /**
   * Show next player selection modal
   */
  showNextPlayerModal(options) {
    this.hideAllModals(); // Hide any other modals first
    this.elements.nextPlayerOptions.innerHTML = '';

    options.forEach(color => {
      const player = this.game.getPlayerByColor(color);
      const btn = document.createElement('button');
      btn.className = `modal-btn player-select`;
      btn.innerHTML = `<span class="chip-small ${color}" style="margin-right: 8px;"></span> ${color.charAt(0).toUpperCase() + color.slice(1)}`;
      btn.style.borderLeft = `4px solid var(--${color})`;
      btn.addEventListener('click', () => {
        // Check if game is still in the expected phase
        if (this.game.phase !== 'selectNextPlayer') {
          this.hideAllModals();
          return;
        }
        this.onAction('chooseNextPlayer', player.id);
      });
      this.elements.nextPlayerOptions.appendChild(btn);
    });

    this.elements.nextPlayerModal.classList.remove('hidden');
  }

  /**
   * Show capture resolution modal
   */
  showCaptureModal(pileChips) {
    this.hideAllModals(); // Hide any other modals first
    this.elements.captureChips.innerHTML = '';

    pileChips.forEach(color => {
      const btn = document.createElement('button');
      btn.className = `modal-btn`;
      btn.innerHTML = `<span class="chip-small ${color}" style="margin-right: 8px;"></span> Kill ${color}`;
      btn.style.borderLeft = `4px solid var(--${color})`;
      btn.addEventListener('click', () => {
        // Check if game is still in the expected phase
        if (this.game.phase !== 'capture') {
          this.hideAllModals();
          return;
        }
        this.onAction('resolveCapture', color);
      });
      this.elements.captureChips.appendChild(btn);
    });

    this.elements.captureModal.classList.remove('hidden');
  }

  /**
   * Show game over modal
   */
  showGameOver(winnerIndex) {
    this.hideAllModals(); // Hide any other modals first
    const winner = this.game.getPlayer(winnerIndex);
    this.elements.winnerMessage.innerHTML = `
      <strong style="color: var(--${winner.color}); font-size: 1.25rem;">${winner.color.charAt(0).toUpperCase() + winner.color.slice(1)}</strong> wins!
    `;
    this.elements.gameOverModal.classList.remove('hidden');
  }
}
