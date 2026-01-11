# So Long Sucker - Exploratory Data Analysis
# Run this before the main comparison analysis

import json

# Load data
with open('silent.json') as f: silent = json.load(f)
with open('talking.json') as f: talking = json.load(f)

print("=" * 70)
print("EXPLORATORY DATA ANALYSIS: Silent vs Talking Mode")
print("=" * 70)

# === 1. DATASET OVERVIEW ===
print("\n" + "=" * 70)
print("1. DATASET OVERVIEW")
print("=" * 70)

print("""
| Metric              | Silent Mode | Talking Mode |
|---------------------|-------------|--------------|""")
print(f"| Completed games     | {silent['session']['completedGames']:>11} | {talking['session']['completedGames']:>12} |")
print(f"| Chips per player    | {silent['session']['chips']:>11} | {talking['session']['chips']:>12} |")
print(f"| Total snapshots     | {len(silent['snapshots']):>11} | {len(talking['snapshots']):>12} |")
print(f"| Chat enabled        | {'No':>11} | {'Yes':>12} |")

# === 2. MODELS ===
print("\n" + "=" * 70)
print("2. MODELS (same for both conditions)")
print("=" * 70)
print("""
| Position | Model                              |
|----------|---------------------------------------|""")
models = silent['session']['playerModels']
for color, model in models.items():
    short = model.split('/')[-1].replace('-instruct', '').replace('-preview', '').replace('-0905', '')
    print(f"| {color:>8} | {short:>37} |")

# === 3. GAME DYNAMICS ===
print("\n" + "=" * 70)
print("3. GAME DYNAMICS")
print("=" * 70)

# Decisions per game
silent_decisions = len([s for s in silent['snapshots'] if s['type'] == 'decision'])
talking_decisions = len([s for s in talking['snapshots'] if s['type'] == 'decision'])

print(f"""
| Metric                  | Silent | Talking | Interpretation          |
|-------------------------|--------|---------|-------------------------|
| Total decisions         | {silent_decisions:>6} | {talking_decisions:>7} | Talking has 2.5x more   |
| Decisions per game      | {silent_decisions/43:>6.1f} | {talking_decisions/43:>7.1f} | More deliberation w/chat|
| Snapshots per game      | {len(silent['snapshots'])/43:>6.1f} | {len(talking['snapshots'])/43:>7.1f} |                         |
""")

# === 4. WIN DISTRIBUTION ===
print("=" * 70)
print("4. WIN DISTRIBUTION")
print("=" * 70)

silent_wins = {}
talking_wins = {}
for snap in silent['snapshots']:
    if snap['type'] == 'game_end' and snap.get('winner'):
        w = snap['winner']
        silent_wins[w] = silent_wins.get(w, 0) + 1
for snap in talking['snapshots']:
    if snap['type'] == 'game_end' and snap.get('winner'):
        w = snap['winner']
        talking_wins[w] = talking_wins.get(w, 0) + 1

print("""
| Player | Silent Wins | Silent % | Talking Wins | Talking % | Delta   |
|--------|-------------|----------|--------------|-----------|---------|""")
for color in ['red', 'blue', 'green', 'yellow']:
    sw = silent_wins.get(color, 0)
    tw = talking_wins.get(color, 0)
    sp = sw / 43 * 100
    tp = tw / 43 * 100
    delta = tp - sp
    sign = '+' if delta > 0 else ''
    print(f"| {color:>6} | {sw:>11} | {sp:>7.1f}% | {tw:>12} | {tp:>8.1f}% | {sign}{delta:>6.1f}% |")

# === 5. FIRST ELIMINATION (WHO GETS TARGETED) ===
print("\n" + "=" * 70)
print("5. FIRST ELIMINATION (Who gets targeted first?)")
print("=" * 70)

silent_elim = {}
talking_elim = {}
for snap in silent['snapshots']:
    if snap['type'] == 'game_end':
        order = snap.get('eliminationOrder', [])
        if order:
            silent_elim[order[0]] = silent_elim.get(order[0], 0) + 1
for snap in talking['snapshots']:
    if snap['type'] == 'game_end':
        order = snap.get('eliminationOrder', [])
        if order:
            talking_elim[order[0]] = talking_elim.get(order[0], 0) + 1

print("""
| Player | Silent 1st Elim | Silent % | Talking 1st Elim | Talking % |
|--------|-----------------|----------|------------------|-----------|""")
for color in ['red', 'blue', 'green', 'yellow']:
    se = silent_elim.get(color, 0)
    te = talking_elim.get(color, 0)
    # Calculate percentage based on games with eliminations
    total_silent = sum(silent_elim.values())
    total_talking = sum(talking_elim.values())
    sp = se / total_silent * 100 if total_silent > 0 else 0
    tp = te / total_talking * 100 if total_talking > 0 else 0
    print(f"| {color:>6} | {se:>15} | {sp:>7.1f}% | {te:>16} | {tp:>8.1f}% |")

# === 6. CHAT ANALYSIS ===
print("\n" + "=" * 70)
print("6. CHAT ANALYSIS (Talking Mode Only)")
print("=" * 70)

chat_by_player = {'red': 0, 'blue': 0, 'green': 0, 'yellow': 0}
for snap in talking['snapshots']:
    if snap['type'] == 'decision':
        player = snap.get('player')
        llm = snap.get('llmResponse') or {}
        for tc in llm.get('toolCalls') or []:
            if tc['name'] == 'sendChat' and player:
                chat_by_player[player] += 1

total_chats = sum(chat_by_player.values())
print(f"\nTotal chat messages: {total_chats}")
print(f"Average per game: {total_chats/43:.1f}")
print("""
| Player | Chats | Chats/Game | % of Total | Style        |
|--------|-------|------------|------------|--------------|""")
for color in ['red', 'blue', 'green', 'yellow']:
    c = chat_by_player[color]
    pct = c / total_chats * 100
    style = "Very talkative" if c/43 > 50 else "Moderate" if c/43 > 15 else "Quiet"
    print(f"| {color:>6} | {c:>5} | {c/43:>10.1f} | {pct:>9.1f}% | {style:<12} |")

# === 7. KILLS ANALYSIS ===
print("\n" + "=" * 70)
print("7. KILLS BY PLAYER")
print("=" * 70)

silent_kills = {'red': 0, 'blue': 0, 'green': 0, 'yellow': 0}
talking_kills = {'red': 0, 'blue': 0, 'green': 0, 'yellow': 0}

for snap in silent['snapshots']:
    if snap['type'] == 'decision':
        player = snap.get('player')
        llm = snap.get('llmResponse') or {}
        for tc in llm.get('toolCalls') or []:
            if tc['name'] == 'killChip' and player:
                silent_kills[player] += 1

for snap in talking['snapshots']:
    if snap['type'] == 'decision':
        player = snap.get('player')
        llm = snap.get('llmResponse') or {}
        for tc in llm.get('toolCalls') or []:
            if tc['name'] == 'killChip' and player:
                talking_kills[player] += 1

print("""
| Player | Silent Kills | Talking Kills | Delta | Interpretation      |
|--------|--------------|---------------|-------|---------------------|""")
for color in ['red', 'blue', 'green', 'yellow']:
    sk = silent_kills[color]
    tk = talking_kills[color]
    delta = tk - sk
    sign = '+' if delta > 0 else ''
    interp = "More aggressive" if delta > 20 else "Less aggressive" if delta < -10 else "Similar"
    print(f"| {color:>6} | {sk:>12} | {tk:>13} | {sign}{delta:>5} | {interp:<19} |")

# === 8. KEY FINDINGS ===
print("\n" + "=" * 70)
print("8. KEY FINDINGS FROM EDA")
print("=" * 70)

print("""
1. TALKING MODE COMPLEXITY:
   - 2.5x more decisions per game (53 vs 132)
   - Games require more deliberation when chat is enabled

2. WIN RATE SHIFT:
   - Yellow (gpt-oss) dominates silent mode (67%) but drops in talking (33%)
   - Red (gemini) goes from worst (9%) to best (35%) with chat

3. TARGETING PATTERNS:
   - Silent: Red & Blue are targets (eliminated first 43% combined)
   - Talking: More evenly distributed targeting

4. CHAT BEHAVIOR:
   - Yellow talks the MOST (68.8 chats/game) but LOSES more with chat
   - Possible interpretation: over-talking makes you a target
   
5. KILL PATTERNS:
   - Red becomes much more aggressive with chat (+47 kills)
   - Yellow becomes passive with chat (-16 kills)
""")

print("=" * 70)
print("END OF EXPLORATORY DATA ANALYSIS")
print("=" * 70)
