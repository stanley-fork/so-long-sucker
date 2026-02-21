// AWS Bedrock LLM Provider
// Uses ABSK bearer token auth - no SigV4 signing needed

import { LLMProvider } from './base.js';

export class BedrockProvider extends LLMProvider {
  constructor(apiKey, model = 'us.anthropic.claude-3-5-sonnet-20241022-v2:0', region = 'us-east-1', thinkingBudget = 0) {
    super(apiKey);
    this.model = model;
    this.region = region;
    this.baseUrl = `https://bedrock-runtime.${region}.amazonaws.com`;
    // thinkingBudget > 0 enables Claude extended thinking (min 1024 tokens)
    this.thinkingBudget = thinkingBudget;
  }

  getName() {
    return 'Bedrock';
  }

  async call(systemPrompt, userPrompt, tools, maxRetries = 3) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this._doCall(systemPrompt, userPrompt, tools);
      } catch (error) {
        const isLastAttempt = attempt === maxRetries;
        const isRetryable = error.message.includes('429') ||
                            error.message.includes('503') ||
                            error.message.includes('Too many requests');
        if (isLastAttempt || !isRetryable) throw error;
        await new Promise(r => setTimeout(r, 2000 * Math.pow(2, attempt)));
      }
    }
  }

  async _doCall(systemPrompt, userPrompt, tools) {
    const startTime = Date.now();

    const body = {
      messages: [
        { role: 'user', content: [{ text: userPrompt }] }
      ],
      // Cache the system prompt — it's static for the entire game (~600 tokens)
      system: [
        { text: systemPrompt },
        { cachePoint: { type: 'default' } }
      ],
      toolConfig: {
        // Cache tool definitions — fully static (~1000+ tokens), never change mid-game
        tools: [
          ...tools.map(t => ({
            toolSpec: {
              name: t.name,
              description: t.description,
              inputSchema: { json: t.parameters }
            }
          })),
          { cachePoint: { type: 'default' } }
        ],
        toolChoice: { auto: {} }
      },
      inferenceConfig: { maxTokens: this.thinkingBudget > 0 ? this.thinkingBudget + 1024 : 1024 }
    };

    // Enable extended thinking if budget is set (min 1024 tokens required by Bedrock)
    if (this.thinkingBudget >= 1024) {
      body.additionalModelRequestFields = {
        thinking: { type: 'enabled', budget_tokens: this.thinkingBudget }
      };
    }

    const response = await fetch(
      `${this.baseUrl}/model/${encodeURIComponent(this.model)}/converse`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(body)
      }
    );

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Bedrock API error: ${response.status} - ${err}`);
    }

    const data = await response.json();
    const parts = data.output?.message?.content || [];

    let text = '';
    let nativeThinking = null; // Native model reasoning (Claude extended thinking)
    const rawToolCalls = [];

    for (const part of parts) {
      if (part.text) {
        text += part.text;
      } else if (part.toolUse) {
        rawToolCalls.push({
          name: part.toolUse.name,
          arguments: part.toolUse.input || {}
        });
      } else if (part.reasoningContent?.reasoningText?.text) {
        // Claude extended thinking block — captured separately from the `think` tool
        nativeThinking = (nativeThinking || '') + part.reasoningContent.reasoningText.text;
      }
    }

    return {
      toolCalls: rawToolCalls,
      text,
      metadata: {
        responseTime,
        promptTokens: data.usage?.inputTokens || null,
        completionTokens: data.usage?.outputTokens || null,
        cacheReadTokens: data.usage?.cacheReadInputTokens || 0,
        cacheWriteTokens: data.usage?.cacheWriteInputTokens || 0,
        nativeThinking, // null if model didn't use extended thinking
        rawToolCalls
      }
    };
  }
}
