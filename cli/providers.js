// Provider factory for CLI (Node.js compatible)
// Loads API keys from environment variables

// Base provider class (simplified for CLI)
class BaseProvider {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  async call(systemPrompt, userPrompt, tools) {
    throw new Error('Not implemented');
  }
}

// OpenAI Provider
class OpenAIProvider extends BaseProvider {
  constructor(apiKey, model = 'gpt-4o-mini') {
    super(apiKey);
    this.model = model;
    this.baseUrl = 'https://api.openai.com/v1';
  }

  async call(systemPrompt, userPrompt, tools) {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
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
        tools: tools.map(t => ({ type: 'function', function: t })),
        tool_choice: 'auto'
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const message = data.choices[0].message;

    return {
      content: message.content,
      toolCalls: (message.tool_calls || []).map(tc => ({
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments)
      }))
    };
  }
}

// Groq Provider
class GroqProvider extends BaseProvider {
  constructor(apiKey, model = 'llama-3.3-70b-versatile') {
    super(apiKey);
    this.model = model;
    this.baseUrl = 'https://api.groq.com/openai/v1';
  }

  async call(systemPrompt, userPrompt, tools) {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
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
        tools: tools.map(t => ({ type: 'function', function: t })),
        tool_choice: 'auto'
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Groq API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const message = data.choices[0].message;

    return {
      content: message.content,
      toolCalls: (message.tool_calls || []).map(tc => ({
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments)
      }))
    };
  }
}

// Claude Provider (direct Anthropic API)
class ClaudeProvider extends BaseProvider {
  constructor(apiKey, model = 'claude-3-5-sonnet-20241022') {
    super(apiKey);
    this.model = model;
    this.baseUrl = 'https://api.anthropic.com/v1';
  }

  async call(systemPrompt, userPrompt, tools) {
    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        tools: tools.map(t => ({
          name: t.name,
          description: t.description,
          input_schema: t.parameters
        }))
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Claude API error: ${response.status} - ${error}`);
    }

    const data = await response.json();

    // Parse Claude's response format
    const toolCalls = [];
    let content = '';

    for (const block of data.content) {
      if (block.type === 'text') {
        content += block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          name: block.name,
          arguments: block.input
        });
      }
    }

    return { content, toolCalls };
  }
}

// Azure Claude Provider
class AzureClaudeProvider extends BaseProvider {
  constructor(apiKey, resource, model = 'claude-sonnet-4-20250514') {
    super(apiKey);
    this.resource = resource;
    this.model = model;
    this.baseUrl = `https://${resource}.openai.azure.com`;
  }

  async call(systemPrompt, userPrompt, tools) {
    const response = await fetch(
      `${this.baseUrl}/openai/deployments/${this.model}/chat/completions?api-version=2024-12-01-preview`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.apiKey
        },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          tools: tools.map(t => ({ type: 'function', function: t })),
          tool_choice: 'auto'
        })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Azure Claude API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const message = data.choices[0].message;

    return {
      content: message.content,
      toolCalls: (message.tool_calls || []).map(tc => ({
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments)
      }))
    };
  }
}

/**
 * Get env variable with or without VITE_ prefix
 */
function getEnv(name) {
  return process.env[name] || process.env[`VITE_${name}`] || '';
}

/**
 * Create a provider instance based on type
 */
export function createProvider(type) {
  switch (type) {
    case 'openai':
      return new OpenAIProvider(getEnv('OPENAI_API_KEY'));

    case 'groq':
      return new GroqProvider(getEnv('GROQ_API_KEY'));

    case 'claude':
      return new ClaudeProvider(getEnv('CLAUDE_API_KEY'));

    case 'azure-claude':
      return new AzureClaudeProvider(
        getEnv('AZURE_API_KEY') || getEnv('AZURE_CLAUDE_API_KEY'),
        getEnv('AZURE_RESOURCE') || 'data4peopleservice-8737-resource',
        getEnv('AZURE_MODEL') || 'claude-sonnet-4-20250514'
      );

    default:
      throw new Error(`Unknown provider: ${type}`);
  }
}

export { OpenAIProvider, GroqProvider, ClaudeProvider, AzureClaudeProvider };
