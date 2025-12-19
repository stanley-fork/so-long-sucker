// Claude (Anthropic) LLM Provider

import { LLMProvider } from './base.js';

export class ClaudeProvider extends LLMProvider {
  constructor(apiKey, model = 'claude-3-5-sonnet-20241022') {
    super(apiKey);
    this.model = model;
    this.baseUrl = 'https://api.anthropic.com/v1/messages';
  }

  getName() {
    return 'Claude';
  }

  /**
   * Convert our tool format to Claude format
   */
  formatTools(tools) {
    return tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters
    }));
  }

  async call(systemPrompt, userPrompt, tools) {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userPrompt }
        ],
        tools: this.formatTools(tools),
        tool_choice: { type: 'auto' }
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Claude API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();

    // Extract tool calls and text from content blocks
    const toolCalls = [];
    let text = '';

    for (const block of data.content) {
      if (block.type === 'tool_use') {
        toolCalls.push({
          name: block.name,
          arguments: block.input
        });
      } else if (block.type === 'text') {
        text += block.text;
      }
    }

    return { toolCalls, text };
  }
}
