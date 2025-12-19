// OpenAI LLM Provider

import { LLMProvider } from './base.js';

export class OpenAIProvider extends LLMProvider {
  constructor(apiKey, model = 'gpt-4o-mini') {
    super(apiKey);
    this.model = model;
    this.baseUrl = 'https://api.openai.com/v1/chat/completions';
  }

  getName() {
    return 'OpenAI';
  }

  /**
   * Convert our tool format to OpenAI format
   */
  formatTools(tools) {
    return tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }
    }));
  }

  async call(systemPrompt, userPrompt, tools) {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        tools: this.formatTools(tools),
        tool_choice: 'auto',
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const message = data.choices[0].message;

    // Extract tool calls
    const toolCalls = (message.tool_calls || []).map(tc => ({
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments)
    }));

    return {
      toolCalls,
      text: message.content || ''
    };
  }
}
