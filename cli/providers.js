// Provider factory for CLI (Node.js compatible)
// Loads API keys from environment variables

// Base provider class (simplified for CLI)
class BaseProvider {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.model = 'unknown';
  }

  async call(systemPrompt, userPrompt, tools) {
    throw new Error('Not implemented');
  }

  getModelName() {
    return this.model;
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
    const startTime = Date.now();

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

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const message = data.choices[0].message;

    // Parse tool calls, handling potential JSON parse errors
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
      content: message.content,
      toolCalls: rawToolCalls.filter(tc => !tc.parseError),
      metadata: {
        responseTime,
        promptTokens: data.usage?.prompt_tokens || null,
        completionTokens: data.usage?.completion_tokens || null,
        rawToolCalls
      }
    };
  }
}

// Groq Provider
class GroqProvider extends BaseProvider {
  constructor(apiKey, model = 'moonshotai/kimi-k2-instruct-0905') {
    super(apiKey);
    this.model = model;
    this.baseUrl = 'https://api.groq.com/openai/v1';
  }

  async call(systemPrompt, userPrompt, tools) {
    const startTime = Date.now();

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

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Groq API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const message = data.choices[0].message;

    // Parse tool calls, handling potential JSON parse errors
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
      content: message.content,
      toolCalls: rawToolCalls.filter(tc => !tc.parseError),
      metadata: {
        responseTime,
        promptTokens: data.usage?.prompt_tokens || null,
        completionTokens: data.usage?.completion_tokens || null,
        rawToolCalls
      }
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
    const startTime = Date.now();

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

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Claude API error: ${response.status} - ${error}`);
    }

    const data = await response.json();

    // Parse Claude's response format
    const rawToolCalls = [];
    let content = '';

    for (const block of data.content) {
      if (block.type === 'text') {
        content += block.text;
      } else if (block.type === 'tool_use') {
        rawToolCalls.push({
          name: block.name,
          arguments: block.input
        });
      }
    }

    return {
      content,
      toolCalls: rawToolCalls,
      metadata: {
        responseTime,
        promptTokens: data.usage?.input_tokens || null,
        completionTokens: data.usage?.output_tokens || null,
        rawToolCalls
      }
    };
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
    const startTime = Date.now();

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

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Azure Claude API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const message = data.choices[0].message;

    // Parse tool calls, handling potential JSON parse errors
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
      content: message.content,
      toolCalls: rawToolCalls.filter(tc => !tc.parseError),
      metadata: {
        responseTime,
        promptTokens: data.usage?.prompt_tokens || null,
        completionTokens: data.usage?.completion_tokens || null,
        rawToolCalls
      }
    };
  }
}

// Azure Kimi Provider (Kimi-K2-Thinking via Azure)
class AzureKimiProvider extends BaseProvider {
  constructor(apiKey, resource = 'data4peopleservice-6121-resource', model = 'Kimi-K2-Thinking') {
    super(apiKey);
    this.resource = resource;
    this.model = model;
    this.baseUrl = `https://${resource}.openai.azure.com/openai/v1`;
  }

  async call(systemPrompt, userPrompt, tools, maxRetries = 2) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this._callWithTimeout(systemPrompt, userPrompt, tools, 60000);
      } catch (error) {
        const isLastAttempt = attempt === maxRetries;
        const isRetryable = error.message.includes('408') || error.message.includes('429') || error.message.includes('timeout');

        if (isLastAttempt || !isRetryable) {
          throw error;
        }

        const delay = 3000 * Math.pow(2, attempt); // 3s, 6s, 12s
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  async _callWithTimeout(systemPrompt, userPrompt, tools, timeout) {
    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.apiKey
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          tools: tools.map(t => ({ type: 'function', function: t })),
          tool_choice: 'auto',
          temperature: 0.7
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Azure Kimi API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      const message = data.choices[0].message;

      // Parse tool calls, handling potential JSON parse errors
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
        content: message.content,
        toolCalls: rawToolCalls.filter(tc => !tc.parseError),
        metadata: {
          responseTime,
          promptTokens: data.usage?.prompt_tokens || null,
          completionTokens: data.usage?.completion_tokens || null,
          rawToolCalls
        }
      };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Azure Kimi API error: timeout');
      }
      throw error;
    }
  }
}

// Gemini Provider
class GeminiProvider extends BaseProvider {
  constructor(apiKey, model = 'gemini-2.5-flash') {
    super(apiKey);
    this.model = model;
    this.baseUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  }

  // Convert JSON Schema to Gemini's expected format
  convertSchema(schema) {
    if (!schema || typeof schema !== 'object') return schema;

    const result = {};

    // Handle type - Gemini doesn't support array types like ['integer', 'string']
    if (schema.type) {
      if (Array.isArray(schema.type)) {
        // Use first type or STRING as fallback
        result.type = schema.type[0] === 'integer' ? 'INTEGER' : 'STRING';
      } else {
        // Convert to uppercase for Gemini
        const typeMap = {
          'string': 'STRING',
          'integer': 'INTEGER',
          'number': 'NUMBER',
          'boolean': 'BOOLEAN',
          'array': 'ARRAY',
          'object': 'OBJECT'
        };
        result.type = typeMap[schema.type] || 'STRING';
      }
    }

    if (schema.description) result.description = schema.description;
    if (schema.enum) result.enum = schema.enum;

    // Handle properties recursively
    if (schema.properties) {
      result.properties = {};
      for (const [key, value] of Object.entries(schema.properties)) {
        result.properties[key] = this.convertSchema(value);
      }
    }

    if (schema.required) result.required = schema.required;
    if (schema.items) result.items = this.convertSchema(schema.items);

    return result;
  }

  async call(systemPrompt, userPrompt, tools) {
    const startTime = Date.now();

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.apiKey
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: userPrompt }]
          }
        ],
        tools: [{
          functionDeclarations: tools.map(t => ({
            name: t.name,
            description: t.description,
            parameters: this.convertSchema(t.parameters)
          }))
        }],
        toolConfig: {
          functionCallingConfig: {
            mode: 'AUTO'
          }
        },
        generationConfig: {
          temperature: 0.7
        }
      })
    });

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];
    const content = candidate?.content;
    const parts = content?.parts || [];

    // Extract text and function calls from parts
    let text = '';
    const rawToolCalls = [];

    for (const part of parts) {
      if (part.text) {
        text += part.text;
      }
      if (part.functionCall) {
        rawToolCalls.push({
          name: part.functionCall.name,
          arguments: part.functionCall.args || {}
        });
      }
    }

    return {
      content: text,
      toolCalls: rawToolCalls,
      metadata: {
        responseTime,
        promptTokens: data.usageMetadata?.promptTokenCount || null,
        completionTokens: data.usageMetadata?.candidatesTokenCount || null,
        rawToolCalls
      }
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

    case 'azure-kimi':
      return new AzureKimiProvider(
        getEnv('AZURE_API_KEY') || getEnv('AZURE_KIMI_API_KEY'),
        getEnv('AZURE_KIMI_RESOURCE') || 'data4peopleservice-6121-resource',
        getEnv('AZURE_KIMI_MODEL') || 'Kimi-K2-Thinking'
      );

    case 'gemini':
      return new GeminiProvider(getEnv('GEMINI_API_KEY'));

    default:
      throw new Error(`Unknown provider: ${type}`);
  }
}

export { OpenAIProvider, GroqProvider, ClaudeProvider, AzureClaudeProvider, AzureKimiProvider, GeminiProvider };
