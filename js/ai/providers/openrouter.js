import { LLMProvider } from './base.js';

export class OpenRouterProvider extends LLMProvider {
  constructor(apiKey, model = 'meta-llama/llama-3.1-8b-instruct:free') {
    super(apiKey);
    this.model = model;
    this.baseUrl = 'https://openrouter.ai/api/v1/chat/completions';
  }

  getName() {
    return 'OpenRouter';
  }

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
    const startTime = Date.now();

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'HTTP-Referer': 'https://so-long-sucker.vercel.app',
        'X-Title': 'So Long Sucker AI Research'
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

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const message = data.choices[0].message;

    const rawToolCalls = (message.tool_calls || []).map(tc => {
      try {
        return {
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments)
        };
      } catch {
        return {
          name: tc.function.name,
          arguments: tc.function.arguments,
          parseError: true
        };
      }
    });

    return {
      toolCalls: rawToolCalls.filter(tc => !tc.parseError),
      text: message.content || '',
      metadata: {
        responseTime,
        promptTokens: data.usage?.prompt_tokens || null,
        completionTokens: data.usage?.completion_tokens || null,
        rawToolCalls
      }
    };
  }

  async test() {
    console.log('🧪 Testing OpenRouter connection...');
    console.log('   Model:', this.model);

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'HTTP-Referer': 'https://so-long-sucker.vercel.app',
        'X-Title': 'So Long Sucker AI Research'
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'user', content: 'Say "ok" and nothing else.' }
        ],
        max_tokens: 10
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    console.log('✅ OpenRouter test successful:', data.choices[0].message.content);
    return true;
  }
}
