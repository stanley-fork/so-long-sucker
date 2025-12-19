// Azure Claude (Foundry) LLM Provider

import { LLMProvider } from './base.js';

export class AzureClaudeProvider extends LLMProvider {
  constructor(apiKey, resource, model = 'claude-opus-4-5') {
    super(apiKey);
    this.resource = resource;
    this.model = model;
    this.baseUrl = `https://${resource}.services.ai.azure.com/anthropic/v1/messages`;
  }

  getName() {
    return 'Azure Claude';
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

  /**
   * Make API call with timeout and retry
   */
  async call(systemPrompt, userPrompt, tools, timeout = 15000, maxRetries = 2) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this._callWithTimeout(systemPrompt, userPrompt, tools, timeout);
      } catch (error) {
        const isLastAttempt = attempt === maxRetries;
        const isTimeout = error.name === 'AbortError' || error.message.includes('timeout');

        if (isLastAttempt) {
          console.error(`❌ All ${maxRetries + 1} attempts failed`);
          throw error;
        }

        const delay = 1000 * Math.pow(2, attempt); // 1s, 2s, 4s exponential backoff
        console.log(`⏳ Attempt ${attempt + 1} failed (${isTimeout ? 'timeout' : 'error'}). Retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  /**
   * Internal call with timeout
   */
  async _callWithTimeout(systemPrompt, userPrompt, tools, timeout) {
    const requestBody = {
      model: this.model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt }
      ],
      tools: this.formatTools(tools),
      tool_choice: { type: 'auto' }
    };

    console.log('🔵 Azure Claude Request:', {
      url: this.baseUrl,
      model: this.model,
      systemPrompt: systemPrompt.substring(0, 100) + '...',
      userPrompt: userPrompt.substring(0, 200) + '...',
      toolCount: tools.length
    });

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log(`⏰ Request timeout after ${timeout}ms`);
      controller.abort();
    }, timeout);

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Azure Claude error:', errorText);
        throw new Error(`Azure Claude API error: ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ Azure Claude Response:', data);

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

      console.log('🔧 Extracted:', { toolCalls, text: text.substring(0, 100) });
      return { toolCalls, text };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeout}ms`);
      }
      throw error;
    }
  }

  /**
   * Simple test call without tools
   */
  async test() {
    console.log('🧪 Testing Azure Claude connection...');
    console.log('   URL:', this.baseUrl);
    console.log('   Model:', this.model);

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 100,
        messages: [
          { role: 'user', content: 'Say "Hello! Azure Claude is working!" and nothing else.' }
        ]
      })
    });

    const responseText = await response.text();
    console.log('📥 Raw response:', response.status, responseText);

    if (!response.ok) {
      throw new Error(`Test failed: ${response.status} - ${responseText}`);
    }

    const data = JSON.parse(responseText);
    console.log('✅ Test successful:', data.content?.[0]?.text);
    return data;
  }
}
