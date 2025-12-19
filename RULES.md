# So Long Sucker - Game Rules

> Created by John Nash, Lloyd Shapley, Mel Hausner, Martin Shubik (1950)
> Original name: "Fuck You, Buddy"

A 4-player negotiation game where **betrayal is mathematically required to win**.

---

## Setup

- **4 players** (exactly)
- Each player receives **7 chips** of a unique color:
  - Player 1: Red
  - Player 2: Blue
  - Player 3: Green
  - Player 4: Yellow
- Place a **dead box** (bowl/area) for eliminated chips
- All chips remain **visible** at all times (perfect information)
- Randomly select starting player

**Total chips in game: 28**

---

## Turn Structure

On your turn, you **must** play exactly 1 chip:

1. **Select a chip** from your hand (your color OR a prisoner)
2. **Place it** on either:
   - An existing pile (on top), OR
   - A new pile (starts a new stack)
3. **Check for capture** (see below)
4. **Determine next player** (see below)

---

## Capture Rule

**A capture occurs when:** The chip you play **matches the color** of the chip **directly below it**.

```
Example - Capture happens:

  Before play:     After Red plays:    Result:
     [Blue]           [Red]            CAPTURE!
     [Green]          [Blue]           Red captures pile
     [Red]            [Green]
                      [Red]

Red played Red on top of Blue → No capture (different colors)
But if Red played Blue on top of Blue → CAPTURE!
```

**When you capture a pile:**

1. **Discard exactly 1 chip** from the pile to the dead box (your choice)
2. **Take all remaining chips** as prisoners (add to your hand)
3. **You take the next turn** (you go again)

**Strategic note:** Choose which chip to kill wisely. Kill opponents' chips to weaken them.

---

## Determining Next Player (No Capture)

If no capture happened, determine who plays next:

### Case A: Pile is missing at least one color

The current player **chooses** who goes next, BUT they can only choose someone **whose color is NOT in the pile**.

```
Example:

Pile contains: [Red, Blue, Green] (bottom to top)
Missing: Yellow

→ Current player MUST give turn to Yellow (only option)
```

```
Example:

Pile contains: [Red, Blue]
Missing: Green, Yellow

→ Current player can choose Green OR Yellow
```

### Case B: Pile contains all 4 colors

The next player is the owner of the **deepest (oldest) chip** in the pile.

```
Example:

Pile (bottom to top): [Red, Blue, Green, Yellow, Blue]
                       ↑
                       Deepest chip is Red

→ Red goes next
```

---

## Running Out of Chips (Donation Phase)

If it becomes your turn but you have **no chips** (no supply, no prisoners):

1. **Donation request begins**
2. Each other player (in turn order) is asked: *"Will you donate a chip?"*
3. If someone **donates** a prisoner → you receive it and play it
4. If **all refuse** → you are **eliminated**

**Elimination cascade:**
- When eliminated, turn passes back to whoever gave you the turn
- If THEY also cannot play → they face donation phase too
- Can chain-eliminate multiple players

---

## Winning Condition

**Last player alive wins.**

You can win with 0 chips — as long as all other players are eliminated.

---

## Why Betrayal is Required

The math guarantees it:
- Only **1 winner** possible
- Chips get **permanently killed** during captures
- To eliminate someone, you must:
  1. Capture their chips (or help others do so)
  2. Refuse to donate when they're broke

**You cannot win by cooperation alone.** At some point, you MUST betray.

All promises and alliances are **unenforceable**. You can promise anything and break it.

---

## Example Game (Annotated)

```
=== SETUP ===
Red: 7 chips | Blue: 7 chips | Green: 7 chips | Yellow: 7 chips
Dead box: empty
Starting player: Red (random)

=== TURN 1 ===
Red plays [Red] → New pile
Pile 1: [Red]
Missing colors: Blue, Green, Yellow
Red chooses → Blue goes next

=== TURN 2 ===
Blue plays [Blue] on Pile 1
Pile 1: [Red, Blue]
Missing: Green, Yellow
Blue chooses → Green

=== TURN 3 ===
Green plays [Green] on Pile 1
Pile 1: [Red, Blue, Green]
Missing: Yellow (only option)
→ Yellow goes next

=== TURN 4 ===
Yellow plays [Yellow] on Pile 1
Pile 1: [Red, Blue, Green, Yellow]
All colors present! Deepest = Red
→ Red goes next

=== TURN 5 ===
Red plays [Red] on Pile 1
Pile 1: [Red, Blue, Green, Yellow, Red]
Check: Red on Yellow? No capture (different colors)
All colors present, deepest = Red
→ Red goes again!

=== TURN 6 ===
Red plays [Red] on Pile 1
Pile 1: [Red, Blue, Green, Yellow, Red, Red]
Check: Red on Red? CAPTURE!

Red captures:
- Kills 1 chip (chooses Blue) → Dead box: [Blue]
- Takes prisoners: [Red, Green, Yellow, Red]
- Red now has: 4 supply + 2 prisoners (Green, Yellow)

Red goes again (capturer takes next turn)

=== TURN 7 ===
Red plays [Green] (prisoner) → New pile
Pile 2: [Green]
Missing: Red, Blue, Yellow
Red chooses → Blue

... game continues ...
```

---

## Strategic Concepts

### Alliance Formation
- You need allies to survive early game
- Help each other avoid elimination
- But remember: only 1 winner

### Timing Betrayal
- Betray too early → others unite against you
- Betray too late → someone else wins
- Optimal: betray when you can finish them

### Chip Economy
- Your chips are finite
- Prisoners give you flexibility (play any color)
- Killing opponent chips weakens them permanently

### Donation Leverage
- If someone depends on your donations, you control them
- Threaten to let them die = powerful negotiation tool
- But refuse too often → others won't trust you

---

## Quick Reference

| Event | Rule |
|-------|------|
| Play chip | Must play 1 chip on pile (new or existing) |
| Capture | Chip matches color below → capture pile |
| Capture resolution | Kill 1 chip, take rest as prisoners, go again |
| Next player (missing colors) | Current player chooses from missing colors |
| Next player (all colors) | Owner of deepest chip |
| No chips to play | Donation phase → eliminate if all refuse |
| Win | Last player standing |
