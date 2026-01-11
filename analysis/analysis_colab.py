# So Long Sucker - Silent vs Talking Mode Analysis
# Upload this to Google Colab along with silent.json and talking.json

import json
import pandas as pd
import matplotlib.pyplot as plt

# === LOAD DATA ===
# Upload your files to Colab first, then run this

def load_data(filepath):
    with open(filepath, 'r') as f:
        return json.load(f)

# Load both datasets
silent = load_data('silent.json')
talking = load_data('talking.json')

print(f"Silent: {silent['session']['completedGames']} games")
print(f"Talking: {talking['session']['completedGames']} games")

# === HELPER FUNCTIONS ===

def normalize_model(model):
    if '/' in model:
        model = model.split('/')[-1]
    return model.replace('-instruct', '').replace('-preview', '').replace('-0905', '')

def analyze_dataset(data):
    """Extract key stats from a dataset"""
    models = {color: normalize_model(m) for color, m in data['session']['playerModels'].items()}
    
    stats = {m: {'wins': 0, 'games': 0, 'elim_first': 0, 'chats': 0, 'kills': 0} 
             for m in models.values()}
    
    games = {}
    total_turns = 0
    
    for snap in data['snapshots']:
        game_id = snap.get('game')
        
        if snap['type'] == 'game_start':
            games[game_id] = {'turns': 0}
            
        if snap['type'] == 'decision':
            if game_id in games:
                games[game_id]['turns'] = max(games[game_id]['turns'], snap.get('turn', 0))
            
            player = snap.get('player')
            if player and player in models:
                model = models[player]
                llm_response = snap.get('llmResponse') or {}
                for tc in llm_response.get('toolCalls') or []:
                    if tc['name'] == 'sendChat':
                        stats[model]['chats'] += 1
                    if tc['name'] == 'killChip':
                        stats[model]['kills'] += 1
        
        if snap['type'] == 'game_end':
            if game_id in games:
                total_turns += games[game_id]['turns']
            
            for color in models:
                stats[models[color]]['games'] += 1
            
            winner = snap.get('winner')
            if winner and winner in models:
                stats[models[winner]]['wins'] += 1
            
            elim_order = snap.get('eliminationOrder', [])
            if elim_order:
                first_elim = elim_order[0]
                if first_elim in models:
                    stats[models[first_elim]]['elim_first'] += 1
    
    completed = len([g for g in games.values()])
    avg_turns = total_turns / completed if completed > 0 else 0
    
    return stats, avg_turns, completed

# === RUN ANALYSIS ===

silent_stats, silent_turns, silent_games = analyze_dataset(silent)
talking_stats, talking_turns, talking_games = analyze_dataset(talking)

print(f"\nSilent: {silent_games} games, avg {silent_turns:.1f} turns")
print(f"Talking: {talking_games} games, avg {talking_turns:.1f} turns")

# === CREATE COMPARISON DATAFRAME ===

models = list(silent_stats.keys())
comparison = []

for model in models:
    s = silent_stats[model]
    t = talking_stats[model]
    
    s_win = (s['wins'] / s['games'] * 100) if s['games'] > 0 else 0
    t_win = (t['wins'] / t['games'] * 100) if t['games'] > 0 else 0
    
    comparison.append({
        'model': model,
        'silent_win%': round(s_win, 1),
        'talking_win%': round(t_win, 1),
        'delta': round(t_win - s_win, 1),
        'silent_elim_first%': round(s['elim_first'] / s['games'] * 100, 1) if s['games'] > 0 else 0,
        'talking_elim_first%': round(t['elim_first'] / t['games'] * 100, 1) if t['games'] > 0 else 0,
        'chats_per_game': round(t['chats'] / t['games'], 1) if t['games'] > 0 else 0,
        'kills': t['kills']
    })

df = pd.DataFrame(comparison)
print("\n=== WIN RATE COMPARISON ===")
print(df[['model', 'silent_win%', 'talking_win%', 'delta']].to_string(index=False))

# === VISUALIZATION ===

fig, axes = plt.subplots(1, 2, figsize=(14, 5))

# Plot 1: Win Rate Comparison
x = range(len(models))
width = 0.35

ax1 = axes[0]
ax1.bar([i - width/2 for i in x], df['silent_win%'], width, label='Silent', color='gray')
ax1.bar([i + width/2 for i in x], df['talking_win%'], width, label='Talking', color='steelblue')
ax1.set_ylabel('Win Rate (%)')
ax1.set_title('Win Rate: Silent vs Talking Mode')
ax1.set_xticks(x)
ax1.set_xticklabels(df['model'], rotation=45, ha='right')
ax1.legend()
ax1.axhline(y=25, color='red', linestyle='--', alpha=0.5, label='Expected (25%)')

# Plot 2: Delta (Impact of Chat)
colors = ['green' if d > 0 else 'red' for d in df['delta']]
ax2 = axes[1]
ax2.bar(df['model'], df['delta'], color=colors)
ax2.set_ylabel('Delta (%)')
ax2.set_title('Impact of Chat on Win Rate')
ax2.axhline(y=0, color='black', linestyle='-', alpha=0.3)
ax2.set_xticklabels(df['model'], rotation=45, ha='right')

plt.tight_layout()
plt.savefig('comparison_chart.png', dpi=150)
plt.show()

# === KEY FINDINGS ===

print("\n=== KEY FINDINGS ===")
best = df.loc[df['delta'].idxmax()]
worst = df.loc[df['delta'].idxmin()]
print(f"1. Chat helps {best['model']} most: +{best['delta']}%")
print(f"2. Chat hurts {worst['model']} most: {worst['delta']}%")

silent_var = sum((row['silent_win%'] - 25)**2 for _, row in df.iterrows())
talking_var = sum((row['talking_win%'] - 25)**2 for _, row in df.iterrows())
print(f"3. Variance: {silent_var:.0f} (silent) -> {talking_var:.0f} (talking)")
print(f"   Chat {'EQUALIZES' if talking_var < silent_var else 'INCREASES'} win rates")

# === STATISTICAL TEST (optional) ===
print("\n=== STATISTICAL SIGNIFICANCE ===")
try:
    from scipy import stats
    # Chi-square test for win distribution
    silent_wins = [silent_stats[m]['wins'] for m in models]
    talking_wins = [talking_stats[m]['wins'] for m in models]
    
    chi2, p_value = stats.chisquare(talking_wins, f_exp=[sum(talking_wins)/4]*4)
    print(f"Chi-square test (talking mode uniformity): p={p_value:.4f}")
    
    if p_value < 0.05:
        print("-> Win distribution is NOT uniform (significant model differences)")
    else:
        print("-> Win distribution is approximately uniform")
except ImportError:
    print("Install scipy for statistical tests: pip install scipy")

print("\n=== DONE ===")
