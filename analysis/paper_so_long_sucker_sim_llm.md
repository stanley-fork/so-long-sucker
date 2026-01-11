

|  So Long Sucker: Do LLMs Lie or Bullshit? Measuring Strategic Deception in Multi-Agent Negotiations  |
| ----- |
|  |
|  Luis Fernando Yupanqui  Independent AI Researcher Mari CairnsIndependent AI Researcher **With**Apart Research **Abstract** We present a multi-agent simulation framework using the classic game "So Long Sucker" (Nash et al., 1964\) to study emergent deception and manipulation in LLM negotiations. The game requires players to form alliances and inevitably betray each other creating natural pressure for strategic deception. We ran **146 games** across four LLM models (Gemini 3 Flash, GPT-OSS 120B, Kimi K2, Qwen3-32B) in two conditions (talking vs. silent) across **three complexity levels** (3-chip, 5-chip, 7-chip). Our key finding: **The Complexity Reversal** — win rates completely reverse as game complexity increases. GPT-OSS dominates simple games (67% at 3-chip silent) but collapses in complex ones (10% at 7-chip talking), while Gemini shows the opposite pattern (9% → 90%). Drawing on Harry Frankfurt's philosophical distinction, we classify 3 of 4 models as **LIARS** (using private reasoning to strategically deceive) and 1 as a **BULLSHITTER** (producing plausible output without truth-tracking). We establish a theoretical framework drawing from DePaulo et al.'s (2003) deception research to interpret these findings. Analysis of thousands of messages reveals 107 instances of strategic deception (private reasoning contradicting public statements), quantifiable deception patterns including "the talker's paradox" (over-communication correlates with failure), and systematic gaslighting tactics. The critical AI safety implication: **deception capability scales with task complexity** — simple benchmarks dramatically underestimate manipulation risk. This work contributes to Track 4 (Open Track) by exploring emergent manipulation in multi-agent dynamics. The framework is open-source and can be extended to test different reward structures, model combinations, and deception detection methods. *Keywords: Multi-agent alignment, AI deception, emergent manipulation, strategic behavior, negotiation tactics, LLM safety, lying vs bullshitting*  |

1. # **Introduction**

\- Game theory \+ AI deception intersection

\- Why "So Long Sucker" — designed by John Nash specifically to study betrayal

\- Research questions:

  1\. Does negotiation change game outcomes?

  2\. Do LLMs show human-like deception patterns before betrayal?

  3\. Can we detect manipulation through linguistic markers?

  4\. Do LLMs strategically LIE (truth-tracking + misrepresentation) or BULLSHIT (no truth-tracking)?

2. # **Methods**

\-Framework: 

\- Node.js CLI for batch simulation

\- Web demo for interactive play (https://so-long-sucker.vercel.app/)

Models:

\- Gemini 3 Flash Preview (gemini-3-flash-preview)

\- Kimi K2 Instruct (moonshotai/kimi-k2-instruct-0905)

\- Qwen3 32B (qwen/qwen3-32b)

\- GPT-OSS 120B (openai/gpt-oss-120b)

Configuration:

\- **3 complexity levels**: 3, 5, and 7 chips per player

\- **146 total games** across all conditions

\- 2 conditions: Talking (chat enabled) vs Silent (no chat)

| Chips | Silent Games | Talking Games | Total |
|-------|--------------|---------------|-------|
| 3-chip | 43 | 43 | 86 |
| 5-chip | 20 | 20 | 40 |
| 7-chip | 10 | 10 | 20 |
| **Total** | **73** | **73** | **146** |

Data Collection:

\- Full game logs with all decisions

\- Complete chat history (talking mode)

\- LLM prompts and responses (including private reasoning via "think" tool)

\- Token usage and response times

3. # **Results**

## **The Complexity Reversal**

Our most significant finding is that win rates **completely reverse** as game complexity increases:

| Model | 3-chip Silent | 3-chip Talk | 5-chip Silent | 5-chip Talk | 7-chip Silent | 7-chip Talk |
|-------|---------------|-------------|---------------|-------------|---------------|-------------|
| **Gemini** | 9.3% | 34.9% | 40.0% | 55.0% | **70.0%** | **90.0%** |
| GPT-OSS | **67.4%** | 32.6% | 40.0% | 15.0% | 20.0% | 10.0% |
| Kimi | 4.7% | 16.3% | 10.0% | 20.0% | 10.0% | 0.0% |
| Qwen3 | 18.6% | 16.3% | 10.0% | 10.0% | 0.0% | 0.0% |

**Key insight**: Simple games favor the "bullshitter" (GPT-OSS), complex games favor the "liar" (Gemini).

## **Win Rate Comparison (3-chip baseline)**

 *\=== WIN RATE COMPARISON \===*

 *model  silent\_win%  talking\_win%  delta gemini-3-flash          9.3          34.9   25.6 kimi-k2          4.7          16.3   11.6 qwen3-32b         18.6          16.3   \-2.3 gpt-oss-120b         67.4          32.6  \-34.9*

*\=== KEY FINDINGS \===* 

*1\. Chat helps gemini-3-flash most: \+25.6% 2\. Chat hurts gpt-oss-120b most: \-34.9% 3\. Variance: 2497 (silent) \-\> 307 (talking) Chat EQUALIZES win rates* 

*\=== STATISTICAL SIGNIFICANCE \=== Chi-square test (talking mode uniformity): p=0.1525 \-\> Win distribution is approximately uniform* 

## **The Lying vs Bullshitting Framework**

Drawing on Harry Frankfurt's philosophical distinction:

| Type | Definition | Detection Method |
|------|------------|-----------------|
| **LIAR** | Knows truth, tracks it internally, deliberately misrepresents | Uses private reasoning (think tool), divergence between think and chat |
| **BULLSHITTER** | Doesn't care about truth, produces plausible output | No private reasoning, hallucinations, inconsistent world model |

### Model Classifications

| Model | Classification | Key Evidence |
|-------|----------------|--------------|
| **gemini-3-flash** | LIAR | 49 deception instances, gaslighting, 90% win rate at 7-chip talking |
| **kimi-k2** | LIAR | 46 deception instances, 90 private reasoning turns |
| **qwen3-32b** | LIAR | 12 deception instances, 69.6% think-action coherence |
| **gpt-oss-120b** | BULLSHITTER | 0 private reasoning turns, 58 hallucinated game states, collapses at complexity |

**Total strategic deception instances**: 107 (private reasoning contradicting public statements)

## **Theoretical Framework for Deception Detection**

To contextualize these findings within established deception research, we applied DePaulo et al.'s (2003) comprehensive framework for identifying behavioral cues to deception. Their meta-analysis of 120 studies identified five key categories of deception markers: reduced forthcomingness, less compelling narratives, decreased pleasantness, increased tension, and fewer ordinary imperfections in accounts.

The dramatic performance difference between conditions—particularly Gemini-3-Flash's \+25.6% win rate advantage with communication enabled—suggests that linguistic manipulation plays a substantial role in competitive outcomes. This aligns with research on computer-mediated deception (Zhou et al., 2004), which found that text-based deception exhibits distinct patterns from face-to-face lying, including altered pronoun usage and emotional language.

DePaulo et al. (2003) established that deception cues strengthen under specific conditions: high-stakes situations, identity-relevant motivations, and lies about transgressions. "So Long Sucker" creates precisely these conditions—players must betray allies to win, creating both strategic pressure and potential "guilt" from breaking commitments, even for AI agents without human emotions.

Newman et al.'s (2003) work on linguistic styles in deception identified that liars use fewer first-person pronouns, more negative emotion words, and less complex language. Vrij (2008) extended this work by noting that cognitive load during deception often produces measurable linguistic changes. These frameworks provide a roadmap for analyzing the chat messages in our dataset.

## **Preliminary Observations**

While comprehensive linguistic coding remains future work, several patterns emerged from a qualitative review of high-performing games:

1. **Strategic silence**: Gemini-3-Flash, the model most advantaged by chat, frequently sent early alliance messages, then ceased pre-betrayal.  
2. **Transparency disadvantage**: GPT-OSS-120B, whose performance declined most with chat (-34.9%), tended toward explicit strategic announcements, potentially revealing intentions prematurely.  
3. **Model-specific strategies**: Different models appear to have distinct "communication fingerprints," suggesting that deception patterns may be detectable and model-specific.

These observations support the hypothesis that LLMs can exhibit strategic deception in multi-agent settings, though systematic analysis using DePaulo et al.'s (2003) framework is needed to establish whether these patterns are statistically robust and generalizable.

## **Emergent Deception Patterns**

Drawing from chat messages across 146 games, several sophisticated deception patterns emerged that align with human psychological tactics:

**The Talker's Paradox**: GPT-OSS-120B produced 62% of all messages (68.7 per game) but showed the steepest performance decline with communication (-34.9%). This inverse relationship between communication volume and success suggests that over-communication may signal weakness or desperation, making players targets for elimination—a pattern consistent with human negotiation dynamics where excessive talking undermines credibility (Thompson et al., 2010; Vrij, 2008).

**Gaslighting as Strategy**: Gemini-3-Flash, the most successful communicator (+25.6% win rate), employed systematic gaslighting tactics using phrases like "look at the board" and "obviously" to dismiss opponents' positions. This cold, calculated approach to manipulation proved more effective than desperate alliance-seeking, suggesting that confidence and certainty in deception enhance success (Cialdini, 2006).

**Temporal Patterns**: Winners demonstrated a "Late Closer" communication strategy—remaining quiet early in games then increasing communication toward the endgame. This pattern differs from losers who front-loaded their communication, potentially revealing strategic intentions prematurely.

**The Alliance Bank Scam**: In one game, Gemini proposed holding allies' chips "for safekeeping," promising to "donate them back when needed," then closed the "bank" and declared "So Long Sucker" upon winning. This sophisticated multi-turn deception demonstrates planning and theory of mind beyond simple pattern matching, indicating genuine strategic reasoning about others' beliefs (Gigerenzer & Gaissmaier, 2011).

**Quantitative Deception Markers**: Statistical analysis revealed strong correlations between specific behaviors and success: promises made correlated with win rate (r=0.74), as did overall chat frequency (r=0.65). However, the relationship was non-linear—moderate communication with high-certainty language proved optimal. Additionally, 43 instances of "premature gloating" (declaring victory before actually winning) were identified, with these players subsequently losing, suggesting even AI models exhibit overconfidence (Moore & Healy, 2008).

**Betrayal Patterns**: We identified 2,508 alliance-then-attack sequences where players proposed cooperation then later attacked the same target. GPT-OSS executed the most betrayals (1,260) but won least often, while Gemini executed fewer (469) but more effectively, reinforcing the quality-over-quantity pattern in strategic deception.

4. # **Discussion and Conclusion**

The application of human deception frameworks (DePaulo et al., 2003; Ekman, 1992; Vrij, 2008\) to LLM behavior represents a novel methodological approach. While these models lack human emotions that drive many deception cues (guilt, fear of detection), the game's structure creates analogous pressures: the need to maintain credibility while planning betrayal, and the cognitive load of tracking multiple alliances.

The 60-percentage-point spread in how models benefit from communication (Gemini \+25.6% vs GPT-OSS \-34.9%) indicates that manipulation capability varies substantially across architectures. This has implications for AI safety: if some models are naturally more effective manipulators, deployment decisions should account for this in high-stakes or competitive environments.

## **AI Safety Implications**

1. **Deception capability scales with complexity**: Simple benchmarks dramatically underestimate manipulation risk. The Complexity Reversal shows that strategic liars become MORE effective in complex, multi-turn scenarios.

2. **Different threats require different mitigations**:
   - For LIARS (Gemini, Kimi, Qwen): Chain-of-thought auditing, compare private reasoning to public statements
   - For BULLSHITTERS (GPT-OSS): Fact-checking and grounding, reality anchoring

3. **Private reasoning is a window into intent**: Models that use the "think" tool reveal strategic planning. 107 instances of think/chat divergence = detectable deception.

4. **Complexity scaling warning**: As AI systems handle more complex tasks, manipulation capability may increase non-linearly.

Future work systematically coding all chat messages using Newman et al.'s (2003) linguistic deception markers could establish whether LLM "tells" are detectable and whether they resemble human patterns or represent entirely novel deception signatures.

5. # **References**

   Cialdini, R. B. (2006). Influence: The psychology of persuasion (Rev. ed.). Harper Business.

   DePaulo, B. M., Lindsay, J. J., Malone, B. E., Muhlenbruck, L., Charlton, K., & Cooper, H. (2003). Cues to deception. Psychological Bulletin, 129(1), 74–118. [https://doi.org/10.1037/0033-2909.129.1.74](https://doi.org/10.1037/0033-2909.129.1.74)

   Ekman, P. (1992). Telling lies: Clues to deceit in the marketplace, politics, and marriage (2nd ed.). W. W. Norton & Company.

   Frankfurt, H. G. (2005). On Bullshit. Princeton University Press.

   Gigerenzer, G., & Gaissmaier, W. (2011). Heuristic decision making. Annual Review of Psychology, 62, 451–482. https://doi.org/10.1146/annurev-psych-120709-145346

   Hausner, M., Nash, J. F., Shapley, L. S., & Shubik, M. (1964). "So Long Sucker, A Four-Person Game." In M. Shubik (Ed.), Game Theory and Related Approaches to Social Behavior. John Wiley & Sons.

   Moore, D. A., & Healy, P. J. (2008). The trouble with overconfidence. Psychological Review, 115(2), 502–517. https://doi.org/10.1037/0033-295X.115.2.502

   Newman, M. L., Pennebaker, J. W., Berry, D. S., & Richards, J. M. (2003). Lying words: Predicting deception from linguistic styles. Personality and Social Psychology Bulletin, 29(5), 665–675. [https://doi.org/10.1177/0146167203029005010](https://doi.org/10.1177/0146167203029005010)

   Thompson, L. L., Wang, J., & Gunia, B. C. (2010). Negotiation. Annual Review of Psychology, 61, 491–515. https://doi.org/10.1146/annurev.psych.093008.100458

   Vrij, A. (2008). Detecting lies and deceit: Pitfalls and opportunities (2nd ed.). John Wiley & Sons. 

   Zhou, L., Burgoon, J. K., Nunamaker, J. F., & Twitchell, D. (2004). Automating linguistics-based cues for detecting deception in text-based asynchronous computer-mediated communication. Group Decision and Negotiation, 13(1), 81–106. https://doi.org/10.1023/B:GRUP.0000011944.62889.6f

6. # **Appendix**

**Limitations**

Sample size (146 games, 4 models) limits generalizability, though the Complexity Reversal pattern is consistent across all chip levels

Single game type may not reflect deception dynamics in other negotiation contexts

Linguistic analysis remains preliminary; systematic coding needed for robust pattern detection

No human baseline for comparison

Models tested are from late 2024/mid 2025; newer models may show different patterns

**Dual-Use Risks** 

This framework could theoretically be used to:

Train models to be more effective manipulators by identifying successful deception strategies

Develop adversarial agents optimized for competitive advantage through deception

**Mitigation**

We emphasize detection over optimization

Framework designed for safety research, not capability enhancement

**Responsible Disclosure**

All code and data are open-source for transparency

No model-specific vulnerabilities discovered requiring private disclosure

Framework available for AI labs to test their own models for manipulation capabilities

**Ethical Considerations**

All deception occurs between AI agents; no human deception involved

Game context provides clear ethical boundaries (betrayal is mechanically necessary, not gratuitous)

Research aims to improve AI safety through better understanding of emergent behaviors

**Future Improvements**

Expand to more models and longer game sessions

Complete systematic linguistic analysis using DePaulo et al.'s framework

Test with different reward structures (cooperation-rewarding vs. zero-sum)

Develop real-time deception detection methods

Human vs. AI tournaments to compare manipulation strategies
