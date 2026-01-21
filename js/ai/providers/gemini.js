import { LLMProvider } from './base.js';
import { GroqProvider } from './groq.js';

export class GeminiProvider extends LLMProvider {
  constructor(apiKey, model = 'gemini-3-flash-preview') {
    super(apiKey);
    this.model = model;
    this.proxyUrl = '/api/llm/gemini';
    this.fallbackProvider = null;
    this.usingFallback = false;
  }

  getName() {
    return this.usingFallback ? 'Groq (fallback)' : 'Gemini';
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

    // Handle rate limit - fallback to Groq
    if (response.status === 429) {
      const errorData = await response.json();
      if (errorData.fallbackToGroq) {
        console.log(`⚠️ Gemini rate limited, falling back to Groq GPT-OSS`);
        
        if (!this.usingFallback) {
          this.usingFallback = true;
          window.dispatchEvent(new CustomEvent('llm-fallback', {
            detail: { from: 'Gemini', to: 'GPT-OSS 120B' }
          }));
        }
        
        return this._callGroqFallback(systemPrompt, userPrompt, tools);
      }
      throw new Error(`Gemini API error: Rate limit exceeded`);
    }

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

  async _callGroqFallback(systemPrompt, userPrompt, tools) {
    if (!this.fallbackProvider) {
      this.fallbackProvider = new GroqProvider('proxy', 'openai/gpt-oss-120b');
    }
    return this.fallbackProvider.call(systemPrompt, userPrompt, tools);
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
