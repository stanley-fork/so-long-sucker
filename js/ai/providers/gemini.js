import { LLMProvider } from './base.js';

export class GeminiProvider extends LLMProvider {
  constructor(apiKey, model = 'gemini-2.5-flash') {
    super(apiKey);
    this.model = model;
    this.proxyUrl = '/api/llm/gemini';
  }

  getName() {
    return 'Gemini';
  }

  async call(systemPrompt, userPrompt, tools) {
    const startTime = Date.now();

    console.log(`🤖 Gemini [proxy] ${this.model}`);

    const response = await fetch(this.proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        systemPrompt,
        userPrompt,
        tools,
        model: this.model
      })
    });

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Gemini API error: ${error.error || response.statusText}`);
    }

    const data = await response.json();
    const parts = data.candidates?.[0]?.content?.parts || [];

    let text = '';
    const rawToolCalls = [];

    for (const part of parts) {
      if (part.text) text += part.text;
      if (part.functionCall) {
        rawToolCalls.push({
          name: part.functionCall.name,
          arguments: part.functionCall.args || {}
        });
      }
    }

    return {
      toolCalls: rawToolCalls,
      text,
      metadata: {
        responseTime,
        promptTokens: data.usageMetadata?.promptTokenCount || null,
        completionTokens: data.usageMetadata?.candidatesTokenCount || null,
        rawToolCalls
      }
    };
  }

  async test() {
    console.log('🧪 Testing Gemini connection via proxy...');
    console.log('   Model:', this.model);

    const response = await fetch(this.proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        systemPrompt: 'You are a test assistant.',
        userPrompt: 'Say "ok" and nothing else.',
        tools: [],
        model: this.model
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Gemini API error: ${error.error || response.statusText}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log('✅ Gemini test successful:', text);
    return true;
  }
}
