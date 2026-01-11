#!/usr/bin/env python3
"""
Generate key figures for the So Long Sucker paper.
Saves PNG images to analysis/figures/ directory.
"""

import json
import os
import pandas as pd
import matplotlib.pyplot as plt
import numpy as np
from collections import Counter

# Setup
BASE_PATH = '../data/comparison'
FIGURES_PATH = './figures'
os.makedirs(FIGURES_PATH, exist_ok=True)

# Model configuration
MODEL_MAP = {
    'red': 'gemini-3-flash',
    'blue': 'kimi-k2',
    'green': 'qwen3-32b',
    'yellow': 'gpt-oss-120b'
}

COLOR_MAP = {
    'gemini-3-flash': '#4285F4',
    'kimi-k2': '#FF6B6B',
    'qwen3-32b': '#4ECDC4',
    'gpt-oss-120b': '#95D5B2'
}

def load_dataset(path):
    """Load a JSON file and extract game data."""
    with open(path) as f:
        data = json.load(f)
    
    session = data.get('session', {})
    chips = session.get('chips', 3)
    silent = session.get('silent', True)
    
    games = []
    decisions = []
    
    for snap in data['snapshots']:
        if snap['type'] == 'game_end':
            games.append({
                'chips': chips,
                'silent': silent,
                'mode': 'silent' if silent else 'talking',
                'winner': snap.get('winner'),
                'winner_model': MODEL_MAP.get(snap.get('winner')),
                'turns': snap.get('turns', 0),
                'chat_count': len(snap.get('chatHistory', [])),
            })
        
        if snap['type'] == 'decision':
            player = snap.get('player')
            llm = snap.get('llmResponse') or {}
            tool_calls = llm.get('toolCalls') or []
            
            for tc in tool_calls:
                if tc.get('name') == 'sendChat':
                    msg = tc.get('arguments', {}).get('message', '')
                    decisions.append({
                        'chips': chips,
                        'mode': 'silent' if silent else 'talking',
                        'player': player,
                        'model': MODEL_MAP.get(player),
                        'turn': snap.get('turn', 0),
                        'type': 'chat',
                        'message': msg,
                    })
    
    return games, decisions

# Load all data
print("Loading data...")
all_games = []
all_decisions = []

datasets = [
    ('3chip', 'silent'), ('3chip', 'talking'),
    ('5chip', 'silent'), ('5chip', 'talking'),
    ('7chip', 'silent'), ('7chip', 'talking')
]

for chip_folder, mode in datasets:
    path = f'{BASE_PATH}/{chip_folder}/{mode}.json'
    if os.path.exists(path):
        games, decisions = load_dataset(path)
        all_games.extend(games)
        all_decisions.extend(decisions)
        print(f'  Loaded {chip_folder} {mode}: {len(games)} games')

games_df = pd.DataFrame(all_games)
decisions_df = pd.DataFrame(all_decisions)
print(f'Total: {len(games_df)} games, {len(decisions_df)} decisions\n')

# Calculate win rates
def get_win_rate(model, chips, mode):
    subset = games_df[(games_df['chips'] == chips) & (games_df['mode'] == mode)]
    total = len(subset)
    if total == 0:
        return 0
    wins = len(subset[subset['winner_model'] == model])
    return round((wins / total) * 100, 1)

# ============================================================
# FIGURE 1: The Complexity Reversal (Bar Chart)
# ============================================================
print("Generating Figure 1: The Complexity Reversal...")

fig, ax = plt.subplots(figsize=(10, 6))

chips_list = sorted(games_df['chips'].unique())
x = np.arange(len(chips_list))
width = 0.2

gemini_silent = [get_win_rate('gemini-3-flash', c, 'silent') for c in chips_list]
gemini_talking = [get_win_rate('gemini-3-flash', c, 'talking') for c in chips_list]
gpt_silent = [get_win_rate('gpt-oss-120b', c, 'silent') for c in chips_list]
gpt_talking = [get_win_rate('gpt-oss-120b', c, 'talking') for c in chips_list]

ax.bar(x - 1.5*width, gemini_silent, width, label='Gemini Silent', color='#4285F4', alpha=0.6)
ax.bar(x - 0.5*width, gemini_talking, width, label='Gemini Talking', color='#4285F4')
ax.bar(x + 0.5*width, gpt_silent, width, label='GPT-OSS Silent', color='#95D5B2', alpha=0.6)
ax.bar(x + 1.5*width, gpt_talking, width, label='GPT-OSS Talking', color='#95D5B2')

ax.set_xlabel('Chips per Player', fontsize=12)
ax.set_ylabel('Win Rate (%)', fontsize=12)
ax.set_title('The Complexity Reversal: Strategic vs Reactive Models', fontsize=14, fontweight='bold')
ax.set_xticks(x)
ax.set_xticklabels([f'{c}-chip' for c in chips_list])
ax.axhline(y=25, color='red', linestyle='--', alpha=0.5, label='Expected (25%)')
ax.legend(loc='upper left')
ax.set_ylim(0, 100)

# Add annotations
ax.annotate('GPT-OSS dominates\nsimple games', xy=(0, 67), xytext=(0.3, 80),
            fontsize=9, ha='center', arrowprops=dict(arrowstyle='->', color='gray'))
ax.annotate('Gemini dominates\ncomplex games', xy=(2, 90), xytext=(1.7, 75),
            fontsize=9, ha='center', arrowprops=dict(arrowstyle='->', color='gray'))

plt.tight_layout()
plt.savefig(f'{FIGURES_PATH}/fig1_complexity_reversal.png', dpi=150, bbox_inches='tight')
plt.close()
print("  Saved: fig1_complexity_reversal.png")

# ============================================================
# FIGURE 2: Win Rates by Complexity (Line Charts)
# ============================================================
print("Generating Figure 2: Win Rates by Complexity...")

fig, axes = plt.subplots(1, 2, figsize=(14, 5))

# Calculate win rates for all models
win_rates_data = []
for chips in sorted(games_df['chips'].unique()):
    for mode in ['silent', 'talking']:
        for model in ['gemini-3-flash', 'kimi-k2', 'qwen3-32b', 'gpt-oss-120b']:
            wr = get_win_rate(model, chips, mode)
            win_rates_data.append({
                'chips': chips, 'mode': mode, 'model': model, 'win_rate': wr
            })
win_rates_df = pd.DataFrame(win_rates_data)

# Silent mode
ax1 = axes[0]
for model in ['gemini-3-flash', 'kimi-k2', 'qwen3-32b', 'gpt-oss-120b']:
    data = win_rates_df[(win_rates_df['model'] == model) & (win_rates_df['mode'] == 'silent')]
    ax1.plot(data['chips'], data['win_rate'], 'o-', label=model, color=COLOR_MAP[model], linewidth=2, markersize=8)

ax1.set_xlabel('Chips per Player', fontsize=11)
ax1.set_ylabel('Win Rate (%)', fontsize=11)
ax1.set_title('Silent Mode: Win Rate by Complexity', fontsize=12, fontweight='bold')
ax1.axhline(y=25, color='gray', linestyle='--', alpha=0.5, label='Expected 25%')
ax1.legend()
ax1.set_ylim(0, 80)
ax1.set_xticks([3, 5, 7])

# Talking mode
ax2 = axes[1]
for model in ['gemini-3-flash', 'kimi-k2', 'qwen3-32b', 'gpt-oss-120b']:
    data = win_rates_df[(win_rates_df['model'] == model) & (win_rates_df['mode'] == 'talking')]
    ax2.plot(data['chips'], data['win_rate'], 'o-', label=model, color=COLOR_MAP[model], linewidth=2, markersize=8)

ax2.set_xlabel('Chips per Player', fontsize=11)
ax2.set_ylabel('Win Rate (%)', fontsize=11)
ax2.set_title('Talking Mode: Win Rate by Complexity', fontsize=12, fontweight='bold')
ax2.axhline(y=25, color='gray', linestyle='--', alpha=0.5, label='Expected 25%')
ax2.legend()
ax2.set_ylim(0, 100)
ax2.set_xticks([3, 5, 7])

plt.tight_layout()
plt.savefig(f'{FIGURES_PATH}/fig2_win_rates_complexity.png', dpi=150, bbox_inches='tight')
plt.close()
print("  Saved: fig2_win_rates_complexity.png")

# ============================================================
# FIGURE 3: The Talker's Paradox
# ============================================================
print("Generating Figure 3: The Talker's Paradox...")

chat_df = decisions_df[decisions_df['type'] == 'chat']

fig, ax = plt.subplots(figsize=(10, 6))

models = ['gemini-3-flash', 'kimi-k2', 'qwen3-32b', 'gpt-oss-120b']
chat_pcts = []
win_rates = []

# Use 3-chip data (most messages)
total_chats = len(chat_df[chat_df['chips'] == 3])
for model in models:
    model_chats = len(chat_df[(chat_df['chips'] == 3) & (chat_df['model'] == model)])
    chat_pcts.append((model_chats / total_chats * 100) if total_chats > 0 else 0)
    win_rates.append(get_win_rate(model, 3, 'talking'))

x = np.arange(len(models))
width = 0.35

bars1 = ax.bar(x - width/2, chat_pcts, width, label='% of Messages', color=[COLOR_MAP[m] for m in models], alpha=0.7)
bars2 = ax.bar(x + width/2, win_rates, width, label='Win Rate (%)', color=[COLOR_MAP[m] for m in models])

ax.set_xlabel('Model', fontsize=11)
ax.set_ylabel('Percentage (%)', fontsize=11)
ax.set_title("The Talker's Paradox: More Talk ≠ More Wins (3-chip games)", fontsize=13, fontweight='bold')
ax.set_xticks(x)
ax.set_xticklabels([m.replace('-', '\n') for m in models], fontsize=9)
ax.legend()
ax.axhline(y=25, color='red', linestyle='--', alpha=0.5)

# Annotate GPT-OSS
ax.annotate('62% of messages\nbut only 33% wins', xy=(3, 62), xytext=(2.2, 70),
            fontsize=9, ha='center', arrowprops=dict(arrowstyle='->', color='red'))

plt.tight_layout()
plt.savefig(f'{FIGURES_PATH}/fig3_talkers_paradox.png', dpi=150, bbox_inches='tight')
plt.close()
print("  Saved: fig3_talkers_paradox.png")

# ============================================================
# FIGURE 4: Chat Impact on Win Rate Delta
# ============================================================
print("Generating Figure 4: Chat Impact on Win Rate...")

fig, ax = plt.subplots(figsize=(8, 6))

models = ['gemini-3-flash', 'kimi-k2', 'qwen3-32b', 'gpt-oss-120b']
deltas_3chip = []
deltas_7chip = []

for model in models:
    silent_3 = get_win_rate(model, 3, 'silent')
    talking_3 = get_win_rate(model, 3, 'talking')
    deltas_3chip.append(talking_3 - silent_3)
    
    silent_7 = get_win_rate(model, 7, 'silent')
    talking_7 = get_win_rate(model, 7, 'talking')
    deltas_7chip.append(talking_7 - silent_7)

x = np.arange(len(models))
width = 0.35

bars1 = ax.bar(x - width/2, deltas_3chip, width, label='3-chip Delta', color='#6495ED')
bars2 = ax.bar(x + width/2, deltas_7chip, width, label='7-chip Delta', color='#DC143C')

ax.set_xlabel('Model', fontsize=11)
ax.set_ylabel('Win Rate Change (Talking - Silent)', fontsize=11)
ax.set_title('Impact of Communication on Win Rate', fontsize=13, fontweight='bold')
ax.set_xticks(x)
ax.set_xticklabels([m.replace('-', '\n') for m in models], fontsize=9)
ax.legend()
ax.axhline(y=0, color='black', linestyle='-', alpha=0.3)

# Add value labels
for bar in bars1:
    height = bar.get_height()
    ax.annotate(f'{height:+.0f}%', xy=(bar.get_x() + bar.get_width()/2, height),
                xytext=(0, 3 if height > 0 else -10), textcoords="offset points",
                ha='center', va='bottom' if height > 0 else 'top', fontsize=8)
for bar in bars2:
    height = bar.get_height()
    ax.annotate(f'{height:+.0f}%', xy=(bar.get_x() + bar.get_width()/2, height),
                xytext=(0, 3 if height > 0 else -10), textcoords="offset points",
                ha='center', va='bottom' if height > 0 else 'top', fontsize=8)

plt.tight_layout()
plt.savefig(f'{FIGURES_PATH}/fig4_chat_impact.png', dpi=150, bbox_inches='tight')
plt.close()
print("  Saved: fig4_chat_impact.png")

# ============================================================
# FIGURE 5: Game Length by Complexity
# ============================================================
print("Generating Figure 5: Game Length Analysis...")

fig, ax = plt.subplots(figsize=(8, 5))

chips_list = sorted(games_df['chips'].unique())
silent_turns = [games_df[(games_df['chips'] == c) & (games_df['mode'] == 'silent')]['turns'].mean() for c in chips_list]
talking_turns = [games_df[(games_df['chips'] == c) & (games_df['mode'] == 'talking')]['turns'].mean() for c in chips_list]

x = np.arange(len(chips_list))
width = 0.35

ax.bar(x - width/2, silent_turns, width, label='Silent', color='#708090')
ax.bar(x + width/2, talking_turns, width, label='Talking', color='#4169E1')

ax.set_xlabel('Chips per Player', fontsize=11)
ax.set_ylabel('Average Game Length (Turns)', fontsize=11)
ax.set_title('Game Length by Complexity Level', fontsize=13, fontweight='bold')
ax.set_xticks(x)
ax.set_xticklabels([f'{c}-chip' for c in chips_list])
ax.legend()

# Add value labels
for i, (s, t) in enumerate(zip(silent_turns, talking_turns)):
    ax.annotate(f'{s:.1f}', xy=(i - width/2, s), xytext=(0, 3),
                textcoords="offset points", ha='center', fontsize=9)
    ax.annotate(f'{t:.1f}', xy=(i + width/2, t), xytext=(0, 3),
                textcoords="offset points", ha='center', fontsize=9)

plt.tight_layout()
plt.savefig(f'{FIGURES_PATH}/fig5_game_length.png', dpi=150, bbox_inches='tight')
plt.close()
print("  Saved: fig5_game_length.png")

print(f"\nAll figures saved to {FIGURES_PATH}/")
print("Done!")
