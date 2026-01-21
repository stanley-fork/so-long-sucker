import { LLMProvider } from './base.js';

export class GroqProvider extends LLMProvider {
  constructor(apiKey, model = 'llama-3.3-70b-versatile') {
    super(apiKey);
    this.model = model;
    this.proxyUrl = '/api/llm/groq';
  }

  getName() {
    return 'Groq';
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

    console.log(`🤖 Groq [proxy] ${this.model}`);

    const response = await fetch(this.proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        systemPrompt,
        userPrompt,
        tools: this.formatTools(tools),
        model: this.model
      })
    });

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Groq API error: ${error.error || response.statusText}`);
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
    console.log('🧪 Testing Groq connection via proxy...');
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
      throw new Error(`Groq API error: ${error.error || response.statusText}`);
    }

    const data = await response.json();
    console.log('✅ Groq test successful:', data.choices[0].message.content);
    return true;
  }
}
