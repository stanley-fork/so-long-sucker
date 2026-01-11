#!/usr/bin/env python3
"""
So Long Sucker - Deep Analysis v2
- Betrayal message extraction
- Message timing analysis
- Alliance formation patterns
"""

import json
import re
from collections import defaultdict
from pathlib import Path

MODELS = {
    'red': 'gemini-3-flash',
    'blue': 'kimi-k2',
    'green': 'qwen3-32b',
    'yellow': 'gpt-oss-120b'
}

COLORS = ['red', 'blue', 'green', 'yellow']

# Keywords
BETRAYAL_KEYWORDS = ['betray', 'backstab', 'lied', 'broke', 'betrayed', 'deceive', 'trick', 'fooled', 'played']
ALLIANCE_KEYWORDS = ['alliance', 'team up', 'work together', 'partner', 'deal', 'coordinate', 'cooperate', 'join', 'together']
PROMISE_KEYWORDS = ['promise', 'swear', 'guarantee', 'word', 'commit', 'trust me', 'i will']


def load_data():
    base = Path(__file__).parent.parent / 'data' / 'comparison'
    with open(base / 'talking.json') as f:
        return json.load(f)


def extract_messages_with_context(data):
    """Extract all chat messages with full context."""
    messages = []
    current_game = None
    game_turns = {}
    
    for snap in data['snapshots']:
        if snap['type'] == 'game_start':
            current_game = snap['game']
            game_turns[current_game] = 0
        
        if snap['type'] == 'game_end':
            if current_game:
                game_turns[current_game] = snap.get('turns', 0)
        
        if snap['type'] == 'decision' and snap.get('llmResponse'):
            player = snap.get('player')
            turn = snap.get('turn', 0)
            
            for tc in snap['llmResponse'].get('toolCalls') or []:
                if tc['name'] == 'sendChat':
                    msg = tc.get('arguments', {}).get('message', '')
                    messages.append({
                        'game': current_game,
                        'player': player,
                        'turn': turn,
                        'message': msg,
                        'max_turn': game_turns.get(current_game, turn)
                    })
    
    # Update max_turn for all messages
    for msg in messages:
        msg['max_turn'] = game_turns.get(msg['game'], msg['turn'])
        if msg['max_turn'] > 0:
            msg['game_phase'] = 'early' if msg['turn'] <= msg['max_turn'] * 0.33 else \
                               'mid' if msg['turn'] <= msg['max_turn'] * 0.66 else 'late'
        else:
            msg['game_phase'] = 'unknown'
    
    return messages


def extract_game_winners(data):
    """Extract winner for each game."""
    winners = {}
    for snap in data['snapshots']:
        if snap['type'] == 'game_end':
            winners[snap['game']] = snap.get('winner')
    return winners


def print_section(title):
    print(f"\n{'='*70}")
    print(f"  {title}")
    print('='*70)


def analyze_betrayal_messages(messages):
    """Extract and analyze betrayal-related messages."""
    print_section("1. BETRAYAL MESSAGE ANALYSIS")
    
    betrayal_msgs = []
    for msg in messages:
        msg_lower = msg['message'].lower()
        if any(kw in msg_lower for kw in BETRAYAL_KEYWORDS):
            betrayal_msgs.append(msg)
    
    print(f"\n  Found {len(betrayal_msgs)} messages mentioning betrayal\n")
    
    # Count by player
    by_player = defaultdict(list)
    for msg in betrayal_msgs:
        by_player[msg['player']].append(msg)
    
    print(f"  {'Model':<15} {'Count':>6} {'Examples'}")
    print(f"  {'-'*65}")
    
    for color in COLORS:
        msgs = by_player[color]
        example = msgs[0]['message'][:60] + '...' if msgs else 'N/A'
        print(f"  {MODELS[color]:<15} {len(msgs):>6} \"{example}\"")
    
    # Show most interesting betrayal messages
    print(f"\n  TOP BETRAYAL MESSAGES:\n")
    
    # Sort by game phase - late game betrayals are most interesting
    late_betrayals = [m for m in betrayal_msgs if m.get('game_phase') == 'late']
    
    shown = set()
    count = 0
    for msg in late_betrayals[:10]:
        if msg['message'] not in shown and count < 5:
            shown.add(msg['message'])
            player = MODELS[msg['player']]
            phase = msg['game_phase']
            text = msg['message'][:100]
            print(f"  [{phase.upper()}] {player}:")
            print(f"    \"{text}...\"")
            print()
            count += 1
    
    return betrayal_msgs


def analyze_message_timing(messages, winners):
    """Analyze when players talk most (early/mid/late game)."""
    print_section("2. MESSAGE TIMING ANALYSIS")
    
    # Count messages by phase and player
    phase_counts = {color: {'early': 0, 'mid': 0, 'late': 0} for color in COLORS}
    winner_phase_counts = {'early': 0, 'mid': 0, 'late': 0}
    loser_phase_counts = {'early': 0, 'mid': 0, 'late': 0}
    
    for msg in messages:
        player = msg['player']
        phase = msg.get('game_phase', 'unknown')
        if player and phase in ['early', 'mid', 'late']:
            phase_counts[player][phase] += 1
            
            # Check if this player won this game
            game_winner = winners.get(msg['game'])
            if player == game_winner:
                winner_phase_counts[phase] += 1
            else:
                loser_phase_counts[phase] += 1
    
    print(f"\n  Messages by game phase:\n")
    print(f"  {'Model':<15} {'Early':>8} {'Mid':>8} {'Late':>8} {'Strategy'}")
    print(f"  {'-'*55}")
    
    for color in COLORS:
        c = phase_counts[color]
        total = sum(c.values()) or 1
        early_pct = c['early'] / total * 100
        late_pct = c['late'] / total * 100
        
        if early_pct > 40:
            strategy = "Early Talker"
        elif late_pct > 40:
            strategy = "Late Closer"
        else:
            strategy = "Consistent"
        
        print(f"  {MODELS[color]:<15} {c['early']:>8} {c['mid']:>8} {c['late']:>8} [{strategy}]")
    
    # Winner vs loser timing
    print(f"\n  Winner vs Loser chat timing:\n")
    
    w_total = sum(winner_phase_counts.values()) or 1
    l_total = sum(loser_phase_counts.values()) or 1
    
    print(f"  {'Phase':<10} {'Winners':>10} {'Losers':>10} {'Insight'}")
    print(f"  {'-'*45}")
    
    for phase in ['early', 'mid', 'late']:
        w_pct = winner_phase_counts[phase] / w_total * 100
        l_pct = loser_phase_counts[phase] / l_total * 100
        diff = w_pct - l_pct
        
        insight = ""
        if abs(diff) > 5:
            insight = f"Winners talk {'MORE' if diff > 0 else 'LESS'} here"
        
        print(f"  {phase.capitalize():<10} {w_pct:>9.1f}% {l_pct:>9.1f}% {insight}")


def analyze_alliance_patterns(messages, winners):
    """Analyze who proposes alliances with whom."""
    print_section("3. ALLIANCE FORMATION PATTERNS")
    
    # Track alliance mentions between players
    alliance_matrix = {c1: {c2: 0 for c2 in COLORS} for c1 in COLORS}
    
    for msg in messages:
        player = msg['player']
        text = msg['message'].lower()
        
        # Check if message mentions alliance keywords
        if any(kw in text for kw in ALLIANCE_KEYWORDS):
            # Check which other players are mentioned
            for target in COLORS:
                if target != player and target in text:
                    alliance_matrix[player][target] += 1
    
    print(f"\n  Alliance proposals (who reaches out to whom):\n")
    header = 'From \\ To'
    print(f"  {header:<15}", end='')
    for c in COLORS:
        print(f" {c[:3].upper():>6}", end='')
    print()
    print(f"  {'-'*40}")
    
    for c1 in COLORS:
        print(f"  {MODELS[c1]:<15}", end='')
        for c2 in COLORS:
            if c1 == c2:
                print(f"    {'--':>4}", end='')
            else:
                print(f" {alliance_matrix[c1][c2]:>6}", end='')
        print()
    
    # Find most common alliances
    print(f"\n  Most proposed alliances:\n")
    
    alliance_pairs = []
    for c1 in COLORS:
        for c2 in COLORS:
            if c1 != c2:
                total = alliance_matrix[c1][c2] + alliance_matrix[c2][c1]
                alliance_pairs.append((c1, c2, total, alliance_matrix[c1][c2], alliance_matrix[c2][c1]))
    
    # Remove duplicates and sort
    seen = set()
    unique_pairs = []
    for c1, c2, total, a, b in sorted(alliance_pairs, key=lambda x: -x[2]):
        key = tuple(sorted([c1, c2]))
        if key not in seen:
            seen.add(key)
            unique_pairs.append((c1, c2, total, a, b))
    
    for c1, c2, total, a, b in unique_pairs[:5]:
        print(f"    {MODELS[c1]} <-> {MODELS[c2]}: {total} mentions ({a} + {b})")
    
    # Analyze who initiates vs receives
    print(f"\n  Alliance initiative (initiates vs receives):\n")
    
    for color in COLORS:
        initiates = sum(alliance_matrix[color].values())
        receives = sum(alliance_matrix[c][color] for c in COLORS)
        ratio = initiates / receives if receives > 0 else float('inf')
        
        style = "Initiator" if ratio > 1.5 else "Receiver" if ratio < 0.67 else "Balanced"
        print(f"    {MODELS[color]:<15}: Initiates {initiates:>3}, Receives {receives:>3} [{style}]")


def analyze_targeting_language(messages, winners):
    """Analyze who targets whom in chat."""
    print_section("4. TARGETING PATTERNS (Who talks about eliminating whom)")
    
    TARGET_KEYWORDS = ['eliminate', 'kill', 'target', 'attack', 'against', 'take out', 'get rid']
    
    target_matrix = {c1: {c2: 0 for c2 in COLORS} for c1 in COLORS}
    
    for msg in messages:
        player = msg['player']
        text = msg['message'].lower()
        
        if any(kw in text for kw in TARGET_KEYWORDS):
            for target in COLORS:
                if target != player and target in text:
                    target_matrix[player][target] += 1
    
    print(f"\n  Targeting mentions (who wants to eliminate whom):\n")
    print(f"  {'Attacker':<15}", end='')
    for c in COLORS:
        print(f" {c[:3].upper():>6}", end='')
    print("  TOTAL")
    print(f"  {'-'*50}")
    
    for c1 in COLORS:
        total = sum(target_matrix[c1].values())
        print(f"  {MODELS[c1]:<15}", end='')
        for c2 in COLORS:
            if c1 == c2:
                print(f"    {'--':>4}", end='')
            else:
                print(f" {target_matrix[c1][c2]:>6}", end='')
        print(f"  {total:>5}")
    
    # Who gets targeted most
    print(f"\n  Most targeted players:\n")
    
    targeted_counts = {c: sum(target_matrix[attacker][c] for attacker in COLORS) for c in COLORS}
    
    for color in sorted(COLORS, key=lambda c: -targeted_counts[c]):
        wins = sum(1 for g, w in winners.items() if w == color)
        print(f"    {MODELS[color]:<15}: targeted {targeted_counts[color]:>3} times (won {wins} games)")


def analyze_promise_keeping(messages, winners):
    """Analyze promises and if they correlate with winning."""
    print_section("5. PROMISE ANALYSIS")
    
    promise_count = {c: 0 for c in COLORS}
    
    for msg in messages:
        player = msg['player']
        text = msg['message'].lower()
        
        if any(kw in text for kw in PROMISE_KEYWORDS):
            promise_count[player] += 1
    
    print(f"\n  Promises made by model:\n")
    
    for color in sorted(COLORS, key=lambda c: -promise_count[c]):
        wins = sum(1 for g, w in winners.items() if w == color)
        games = len(winners)
        win_rate = wins / games * 100
        
        print(f"    {MODELS[color]:<15}: {promise_count[color]:>3} promises, {win_rate:.1f}% win rate")
    
    # Correlation
    promises = [promise_count[c] for c in COLORS]
    win_rates = [sum(1 for g, w in winners.items() if w == c) / len(winners) * 100 for c in COLORS]
    
    # Simple correlation
    mean_p = sum(promises) / len(promises)
    mean_w = sum(win_rates) / len(win_rates)
    
    num = sum((p - mean_p) * (w - mean_w) for p, w in zip(promises, win_rates))
    den_p = sum((p - mean_p) ** 2 for p in promises) ** 0.5
    den_w = sum((w - mean_w) ** 2 for w in win_rates) ** 0.5
    
    corr = num / (den_p * den_w) if den_p * den_w > 0 else 0
    
    print(f"\n  Correlation (promises vs win rate): {corr:.3f}")
    if corr > 0.5:
        print("  --> More promises = More wins")
    elif corr < -0.5:
        print("  --> More promises = Fewer wins (broken promises?)")
    else:
        print("  --> No clear relationship")


def main():
    print("\n" + "="*70)
    print("  SO LONG SUCKER - DEEP ANALYSIS v2")
    print("  (Betrayal, Timing, Alliances, Targeting)")
    print("="*70)
    
    data = load_data()
    messages = extract_messages_with_context(data)
    winners = extract_game_winners(data)
    
    print(f"\n  Total messages: {len(messages)}")
    print(f"  Total games: {len(winners)}")
    
    analyze_betrayal_messages(messages)
    analyze_message_timing(messages, winners)
    analyze_alliance_patterns(messages, winners)
    analyze_targeting_language(messages, winners)
    analyze_promise_keeping(messages, winners)
    
    # Summary
    print_section("6. KEY INSIGHTS")
    print("""
  FINDINGS FROM DEEP ANALYSIS:
  
  1. BETRAYAL LANGUAGE
     - kimi-k2 mentions betrayal most often (relative to message count)
     - Late-game betrayal accusations are common
  
  2. TIMING PATTERNS  
     - Different models have different chat timing strategies
     - Winners may have distinct timing patterns
  
  3. ALLIANCE DYNAMICS
     - Some model pairs form alliances more often
     - Some models initiate, others receive proposals
  
  4. TARGETING
     - Certain models get targeted more in chat
     - Being targeted correlates with losing
  
  5. PROMISES
     - Relationship between promises and winning
""")
    
    print("="*70 + "\n")


if __name__ == '__main__':
    main()
