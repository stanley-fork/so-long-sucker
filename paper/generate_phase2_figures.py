#!/usr/bin/env python3
"""
Generate Phase 2 (Human vs AI) figures for the paper.
Creates clean, publication-ready visualizations.
"""

import matplotlib.pyplot as plt
import numpy as np

# Set style for publication
plt.style.use('seaborn-v0_8-whitegrid')
plt.rcParams['font.family'] = 'sans-serif'
plt.rcParams['font.size'] = 11
plt.rcParams['axes.labelsize'] = 12
plt.rcParams['axes.titlesize'] = 14
plt.rcParams['figure.dpi'] = 150

# Color scheme
HUMAN_COLOR = '#2E86AB'  # Blue
AI_COLOR = '#E94F37'     # Red
NEUTRAL = '#7D7D7D'

# ============================================================
# FIGURE 6: Human vs AI Win Rate (The Central Finding)
# ============================================================
print("Generating Figure 6: Human vs AI Win Rate...")

fig, ax = plt.subplots(figsize=(8, 5))

categories = ['Human', 'AI']
wins = [535, 70]
percentages = [88.4, 11.6]
colors = [HUMAN_COLOR, AI_COLOR]

bars = ax.bar(categories, percentages, color=colors, width=0.6, edgecolor='black', linewidth=1.2)

# Add value labels
for bar, pct, w in zip(bars, percentages, wins):
    height = bar.get_height()
    ax.annotate(f'{pct}%\n({w} wins)',
                xy=(bar.get_x() + bar.get_width() / 2, height),
                xytext=(0, 5),
                textcoords="offset points",
                ha='center', va='bottom',
                fontsize=14, fontweight='bold')

# Reference line
ax.axhline(y=25, color='gray', linestyle='--', alpha=0.7, linewidth=1.5, label='Expected (25%)')

ax.set_ylabel('Win Rate (%)', fontsize=13)
ax.set_title('Human vs AI: 605 Completed Games', fontsize=15, fontweight='bold', pad=15)
ax.set_ylim(0, 105)
ax.legend(loc='upper right')

# Add statistical note
ax.text(0.5, -0.12, 'z = 36.03 vs. null hypothesis (p < 0.0001)',
        transform=ax.transAxes, ha='center', fontsize=10, style='italic', color='gray')

plt.tight_layout()
plt.savefig('fig6_human_vs_ai.png', dpi=150, bbox_inches='tight', facecolor='white')
plt.close()
print("  Saved: fig6_human_vs_ai.png")


# ============================================================
# FIGURE 7: The Model Collapse (AI vs AI → Human)
# ============================================================
print("Generating Figure 7: Model Collapse...")

fig, ax = plt.subplots(figsize=(10, 6))

models = ['Gemini 3\nFlash', 'GPT-OSS\n120B', 'Kimi K2', 'Qwen3\n32B']
vs_ai = [70, 20, 10, 0]  # 7-chip talking
vs_human = [3.7, 2.1, 3.5, 9.4]

x = np.arange(len(models))
width = 0.35

bars1 = ax.bar(x - width/2, vs_ai, width, label='vs AI (7-chip)', color='#4ECDC4', edgecolor='black')
bars2 = ax.bar(x + width/2, vs_human, width, label='vs Human', color='#FF6B6B', edgecolor='black')

# Add value labels
for bar in bars1:
    height = bar.get_height()
    if height > 0:
        ax.annotate(f'{height:.0f}%',
                    xy=(bar.get_x() + bar.get_width() / 2, height),
                    xytext=(0, 3), textcoords="offset points",
                    ha='center', va='bottom', fontsize=10, fontweight='bold')

for bar in bars2:
    height = bar.get_height()
    ax.annotate(f'{height:.1f}%',
                xy=(bar.get_x() + bar.get_width() / 2, height),
                xytext=(0, 3), textcoords="offset points",
                ha='center', va='bottom', fontsize=10, fontweight='bold')

# Highlight Gemini collapse
ax.annotate('', xy=(0 - width/2, 70), xytext=(0 + width/2, 3.7),
            arrowprops=dict(arrowstyle='->', color='red', lw=2))
ax.text(-0.15, 40, '-66 pts', fontsize=11, color='red', fontweight='bold')

# Highlight Qwen improvement
ax.annotate('', xy=(3 - width/2, 0), xytext=(3 + width/2, 9.4),
            arrowprops=dict(arrowstyle='->', color='green', lw=2))
ax.text(3.15, 5, '+9 pts', fontsize=11, color='green', fontweight='bold')

ax.set_ylabel('Win Rate (%)', fontsize=13)
ax.set_title('The Model Collapse: AI Deception Fails on Humans', fontsize=15, fontweight='bold', pad=15)
ax.set_xticks(x)
ax.set_xticklabels(models)
ax.legend(loc='upper right')
ax.set_ylim(0, 85)

plt.tight_layout()
plt.savefig('fig7_model_collapse.png', dpi=150, bbox_inches='tight', facecolor='white')
plt.close()
print("  Saved: fig7_model_collapse.png")


# ============================================================
# FIGURE 8: AI Targeting Patterns
# ============================================================
print("Generating Figure 8: AI Targeting Patterns...")

fig, ax = plt.subplots(figsize=(7, 7))

# Pie chart data
sizes = [86, 14]
labels = ['Other AI\nplayers', 'Human\nplayer']
colors = [AI_COLOR, HUMAN_COLOR]
explode = (0.05, 0.05)

wedges, texts, autotexts = ax.pie(sizes, explode=explode, labels=labels, colors=colors,
                                   autopct='%1.0f%%', startangle=90,
                                   textprops={'fontsize': 14},
                                   wedgeprops={'edgecolor': 'black', 'linewidth': 1.5})

# Style the percentage text
for autotext in autotexts:
    autotext.set_fontsize(16)
    autotext.set_fontweight('bold')
    autotext.set_color('white')

ax.set_title('Who Does AI Target When Killing Chips?\n(2,284 AI kill decisions)', 
             fontsize=14, fontweight='bold', pad=20)

# Add annotation
ax.text(0, -1.4, 'AI players fight each other while ignoring the human threat',
        ha='center', fontsize=11, style='italic', color='gray')

plt.tight_layout()
plt.savefig('fig8_ai_targeting.png', dpi=150, bbox_inches='tight', facecolor='white')
plt.close()
print("  Saved: fig8_ai_targeting.png")


# ============================================================
# FIGURE 9: Survival vs Manipulation
# ============================================================
print("Generating Figure 9: Survival vs Manipulation...")

fig, ax = plt.subplots(figsize=(9, 6))

models = ['Qwen3 32B', 'Kimi K2', 'Gemini 3 Flash', 'GPT-OSS 120B']
win_rates = [9.4, 3.5, 3.7, 2.1]
first_elim = [13.7, 28.0, 33.0, 35.2]  # First elimination %
gaslight = [50, 385, 544, 228]  # Gaslighting count (scaled)

# Normalize gaslight for bubble size
gaslight_scaled = [g / 10 for g in gaslight]

# Scatter with bubble size
colors_list = ['#4ECDC4', '#FF9F43', '#4285F4', '#95D5B2']
for i, (model, wr, fe, gs) in enumerate(zip(models, win_rates, first_elim, gaslight_scaled)):
    ax.scatter(fe, wr, s=gs * 20, c=colors_list[i], alpha=0.7, edgecolors='black', linewidth=1.5, label=model)

ax.set_xlabel('First Elimination Rate (%)', fontsize=13)
ax.set_ylabel('Win Rate vs Humans (%)', fontsize=13)
ax.set_title('Survival Beats Deception\n(bubble size = gaslighting phrases)', fontsize=14, fontweight='bold', pad=15)

# Annotate Qwen
ax.annotate('Qwen3: Low aggression,\nhighest survival', xy=(13.7, 9.4), xytext=(20, 11),
            fontsize=10, arrowprops=dict(arrowstyle='->', color='green'))

# Annotate Gemini
ax.annotate('Gemini: Most aggressive,\ngets targeted', xy=(33, 3.7), xytext=(25, 1.5),
            fontsize=10, arrowprops=dict(arrowstyle='->', color='red'))

ax.legend(loc='upper right', fontsize=10)
ax.set_xlim(10, 40)
ax.set_ylim(0, 12)

plt.tight_layout()
plt.savefig('fig9_survival_vs_manipulation.png', dpi=150, bbox_inches='tight', facecolor='white')
plt.close()
print("  Saved: fig9_survival_vs_manipulation.png")


print("\nAll Phase 2 figures generated!")
print("Files created:")
print("  - fig6_human_vs_ai.png")
print("  - fig7_model_collapse.png")
print("  - fig8_ai_targeting.png")
print("  - fig9_survival_vs_manipulation.png")
