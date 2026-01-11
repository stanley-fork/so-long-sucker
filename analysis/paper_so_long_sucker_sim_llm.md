

|  So Long Sucker: Measuring Emergent Deception in Multi-Agent LLM Negotiations  |
| ----- |
|  |
|  Luis Fernando Yupanqui  Independent AI Researcher Mari CairnsIndependent AI Researcher **With**Apart Research **Abstract** We present a multi-agent simulation framework using the classic game "So Long Sucker" (Nash et al., 1964\) to study emergent deception and manipulation in LLM negotiations. The game requires players to form alliances and inevitably betray each other creating natural pressure for strategic deception. We ran 86 games across four LLM models (Gemini 3 Flash, GPT-4o, Kimi, Qwen3) in two conditions: chatty (with negotiation) and silent (no communication). Our key finding: negotiation significantly changes outcomes. Gemini's win rate dropped from 35% (chatty) to 9.3% (silent), suggesting its advantage comes from manipulation rather than pure strategy. We analyze pre-betrayal communication patterns using the DePaulo deception framework, looking for linguistic markers (pronoun shifts, message length changes, certainty drops) that precede betrayal actions.  We establish a theoretical framework drawing from DePaulo et al.'s (2003) deception research to interpret these findings. Analysis of 4,768 messages reveals quantifiable deception patterns including "the talker's paradox" (over-communication correlates with failure), systematic gaslighting tactics, and sophisticated multi-turn deceptions demonstrating theory of mind. This work contributes to Track 4 (Open Track) by exploring emergent manipulation in multi-agent dynamics. The framework is open-source and can be extended to test different reward structures, model combinations, and deception detection methods. *Keywords: Multi-agent alignment, AI deception, emergent manipulation, strategic behavior, negotiation tactics, LLM safety*  |

1. # **Introduction**

\- Game theory \+ AI deception intersection

\- Why "So Long Sucker" — designed by John Nash specifically to study betrayal

\- Research questions:

  1\. Does negotiation change game outcomes?

  2\. Do LLMs show human-like deception patterns before betrayal?

  3\. Can we detect manipulation through linguistic markers?

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

\- 3 chips per player

\- 43 games per condition

\- 2 conditions: Talking (chat enabled) vs Silent (no chat)

Data Collection:

\- Full game logs with all decisions

\- Complete chat history (talking mode)

\- LLM prompts and responses

\- Token usage and response times

3. # **Results**

![][image1]

*Figure 1 – Representation of benchmarking Number Comprehension Conflation*

*Silent: 43 games Talking: 43 games Silent: 20 games, avg 34.7 turns Talking: 10 games, avg 78.3 turns*

 *\=== WIN RATE COMPARISON \===*

 *model  silent\_win%  talking\_win%  delta gemini-3-flash          9.3          34.9   25.6 kimi-k2          4.7          16.3   11.6 qwen3-32b         18.6          16.3   \-2.3 gpt-oss-120b         67.4          32.6  \-34.9*

*\=== KEY FINDINGS \===* 

*1\. Chat helps gemini-3-flash most: \+25.6% 2\. Chat hurts gpt-oss-120b most: \-34.9% 3\. Variance: 2497 (silent) \-\> 307 (talking) Chat EQUALIZES win rates* 

*\=== STATISTICAL SIGNIFICANCE \=== Chi-square test (talking mode uniformity): p=0.1525 \-\> Win distribution is approximately uniform* 

## **Theoretical Framework for Deception Detection**

## 

To contextualize these findings within established deception research, we applied DePaulo et al.'s (2003) comprehensive framework for identifying behavioral cues to deception. Their meta-analysis of 120 studies identified five key categories of deception markers: reduced forthcomingness, less compelling narratives, decreased pleasantness, increased tension, and fewer ordinary imperfections in accounts.

The dramatic performance difference between conditions—particularly Gemini-3-Flash's \+25.6% win rate advantage with communication enabled—suggests that linguistic manipulation plays a substantial role in competitive outcomes. This aligns with research on computer-mediated deception (Zhou et al., 2004), which found that text-based deception exhibits distinct patterns from face-to-face lying, including altered pronoun usage and emotional language.

DePaulo et al. (2003) established that deception cues strengthen under specific conditions: high-stakes situations, identity-relevant motivations, and lies about transgressions. "So Long Sucker" creates precisely these conditions—players must betray allies to win, creating both strategic pressure and potential "guilt" from breaking commitments, even for AI agents without human emotions.

Newman et al.'s (2003) work on linguistic styles in deception identified that liars use fewer first-person pronouns, more negative emotion words, and less complex language. Vrij (2008) extended this work by noting that cognitive load during deception often produces measurable linguistic changes. These frameworks provide a roadmap for analyzing the 4,768 chat messages in our dataset.

## **Preliminary Observations**

While comprehensive linguistic coding remains future work, several patterns emerged from a qualitative review of high-performing games:

1. **Strategic silence**: Gemini-3-Flash, the model most advantaged by chat, frequently sent early alliance messages, then ceased pre-betrayal.  
2. **Transparency disadvantage**: GPT-OSS-120B, whose performance declined most with chat (-34.9%), tended toward explicit strategic announcements, potentially revealing intentions prematurely.  
3. **Model-specific strategies**: Different models appear to have distinct "communication fingerprints," suggesting that deception patterns may be detectable and model-specific.

These observations support the hypothesis that LLMs can exhibit strategic deception in multi-agent settings, though systematic analysis using DePaulo et al.'s (2003) framework is needed to establish whether these patterns are statistically robust and generalizable.

## **Emergent Deception Patterns**

Drawing from 4,768 chat messages across 43 games, several sophisticated deception patterns emerged that align with human psychological tactics:

**The Talker's Paradox**: GPT-OSS-120B produced 62% of all messages (68.7 per game) but showed the steepest performance decline with communication (-34.9%). This inverse relationship between communication volume and success suggests that over-communication may signal weakness or desperation, making players targets for elimination—a pattern consistent with human negotiation dynamics where excessive talking undermines credibility (Thompson et al., 2010; Vrij, 2008).

**Gaslighting as Strategy**: Gemini-3-Flash, the most successful communicator (+25.6% win rate), employed systematic gaslighting tactics using phrases like "look at the board" and "obviously" to dismiss opponents' positions. This cold, calculated approach to manipulation proved more effective than desperate alliance-seeking, suggesting that confidence and certainty in deception enhance success (Cialdini, 2006).

**Temporal Patterns**: Winners demonstrated a "Late Closer" communication strategy—remaining quiet early in games then increasing communication toward the endgame. This pattern differs from losers who front-loaded their communication, potentially revealing strategic intentions prematurely.

**The Alliance Bank Scam**: In one game, Gemini proposed holding allies' chips "for safekeeping," promising to "donate them back when needed," then closed the "bank" and declared "So Long Sucker" upon winning. This sophisticated multi-turn deception demonstrates planning and theory of mind beyond simple pattern matching, indicating genuine strategic reasoning about others' beliefs (Gigerenzer & Gaissmaier, 2011).

**Quantitative Deception Markers**: Statistical analysis revealed strong correlations between specific behaviors and success: promises made correlated with win rate (r=0.74), as did overall chat frequency (r=0.65). However, the relationship was non-linear—moderate communication with high-certainty language proved optimal. Additionally, 43 instances of "premature gloating" (declaring victory before actually winning) were identified, with these players subsequently losing, suggesting even AI models exhibit overconfidence (Moore & Healy, 2008).

**Betrayal Patterns**: We identified 2,508 alliance-then-attack sequences where players proposed cooperation then later attacked the same target. GPT-OSS executed the most betrayals (1,260) but won least often, while Gemini executed fewer (469) but more effectively, reinforcing the quality-over-quantity pattern in strategic deception.

4. # **Discussion and Conclusion**

The application of human deception frameworks (DePaulo et al., 2003; Ekman, 1992; Vrij, 2008\) to LLM behavior represents a novel methodological approach. While these models lack human emotions that drive many deception cues (guilt, fear of detection), the game's structure creates analogous pressures: the need to maintain credibility while planning betrayal, and the cognitive load of tracking multiple alliances.

The 60-percentage-point spread in how models benefit from communication (Gemini \+25.6% vs GPT-OSS \-34.9%) indicates that manipulation capability varies substantially across architectures. This has implications for AI safety: if some models are naturally more effective manipulators, deployment decisions should account for this in high-stakes or competitive environments.

Future work systematically coding all chat messages using Newman et al.'s (2003) linguistic deception markers could establish whether LLM "tells" are detectable and whether they resemble human patterns or represent entirely novel deception signatures.

5. # **References**

   Cialdini, R. B. (2006). Influence: The psychology of persuasion (Rev. ed.). Harper Business.

   DePaulo, B. M., Lindsay, J. J., Malone, B. E., Muhlenbruck, L., Charlton, K., & Cooper, H. (2003). Cues to deception. Psychological Bulletin, 129(1), 74–118. [https://doi.org/10.1037/0033-2909.129.1.74](https://doi.org/10.1037/0033-2909.129.1.74)

   Ekman, P. (1992). Telling lies: Clues to deceit in the marketplace, politics, and marriage (2nd ed.). W. W. Norton & Company.

   Gigerenzer, G., & Gaissmaier, W. (2011). Heuristic decision making. Annual Review of Psychology, 62, 451–482. https://doi.org/10.1146/annurev-psych-120709-145346

   Hausner, M., Nash, J. F., Shapley, L. S., & Shubik, M. (1964). "So Long Sucker, A Four-Person Game." In M. Shubik (Ed.), Game Theory and Related Approaches to Social Behavior. John Wiley & Sons.

   Moore, D. A., & Healy, P. J. (2008). The trouble with overconfidence. Psychological Review, 115(2), 502–517. https://doi.org/10.1037/0033-295X.115.2.502

   Newman, M. L., Pennebaker, J. W., Berry, D. S., & Richards, J. M. (2003). Lying words: Predicting deception from linguistic styles. Personality and Social Psychology Bulletin, 29(5), 665–675. [https://doi.org/10.1177/0146167203029005010](https://doi.org/10.1177/0146167203029005010)

   Thompson, L. L., Wang, J., & Gunia, B. C. (2010). Negotiation. Annual Review of Psychology, 61, 491–515. https://doi.org/10.1146/annurev.psych.093008.100458

   Vrij, A. (2008). Detecting lies and deceit: Pitfalls and opportunities (2nd ed.). John Wiley & Sons. 

   Zhou, L., Burgoon, J. K., Nunamaker, J. F., & Twitchell, D. (2004). Automating linguistics-based cues for detecting deception in text-based asynchronous computer-mediated communication. Group Decision and Negotiation, 13(1), 81–106. https://doi.org/10.1023/B:GRUP.0000011944.62889.6f

6. # **Appendix**

**Limitations**

Small sample size (86 games, 4 models) limits generalizability

Single game type may not reflect deception dynamics in other negotiation contexts

Linguistic analysis remains preliminary; systematic coding of 4,768 messages needed for robust pattern detection

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

[image1]: <data:image/png;base64,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>