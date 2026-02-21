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

  async call(systemPrompt, userPrompt, tools, maxRetries = 3) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this._doCall(systemPrompt, userPrompt, tools);
      } catch (error) {
        const isLastAttempt = attempt === maxRetries;
        const isRetryable = error.message.includes('429') || 
                           error.message.includes('503') || 
                           error.message.includes('fetch failed') ||
                           error.message.includes('ECONNRESET');

        if (isLastAttempt || !isRetryable) {
          throw error;
        }

        // Exponential backoff: 2s, 4s, 8s
        const delay = 2000 * Math.pow(2, attempt);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  async _doCall(systemPrompt, userPrompt, tools) {
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

// Azure DeepSeek Provider (DeepSeek V3 via Azure OpenAI-compatible API)
class AzureDeepSeekProvider extends BaseProvider {
  constructor(apiKey, resource = 'hellobusiness999-4411-resource', model = 'DeepSeek-V3.2') {
    super(apiKey);
    this.resource = resource;
    this.model = model;
    this.baseUrl = `https://${resource}.openai.azure.com/openai/v1`;
  }

  async call(systemPrompt, userPrompt, tools) {
    const startTime = Date.now();

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
      })
    });

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Azure DeepSeek API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const message = data.choices[0].message;

    let rawToolCalls = [];

    // Check for native tool_calls first
    if (message.tool_calls && message.tool_calls.length > 0) {
      rawToolCalls = message.tool_calls.map(tc => {
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
    } 
    // DeepSeek V3 on Azure returns tool calls as text, parse them
    else if (message.content && message.content.includes('tool_call_name:')) {
      const toolCallMatch = message.content.match(/tool_call_name:\s*(\w+)\s*\ntool_call_arguments:\s*(\{[^}]+\})/);
      if (toolCallMatch) {
        try {
          rawToolCalls = [{
            name: toolCallMatch[1],
            arguments: JSON.parse(toolCallMatch[2])
          }];
        } catch {
          rawToolCalls = [{
            name: toolCallMatch[1],
            arguments: toolCallMatch[2],
            parseError: true
          }];
        }
      }
    }

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
        // Use STRING for mixed types - more flexible (can represent both "new" and "0")
        result.type = 'STRING';
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

// GLM 5 Provider (Vertex AI OpenAI-compatible endpoint)
// Hacky: shells out to gcloud for auth token on each call
import { execSync } from 'child_process';

class GLM5Provider extends BaseProvider {
  constructor(projectId = 'gen-lang-client-0241703515', region = 'global') {
    super(null); // No static API key - uses gcloud token
    this.model = 'zai-org/glm-5-maas';
    this.projectId = projectId;
    this.region = region;
    this.baseUrl = `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/endpoints/openapi`;
  }

  _getToken() {
    try {
      return execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
    } catch (error) {
      throw new Error('GLM5: Failed to get gcloud token. Run: gcloud auth login');
    }
  }

  async call(systemPrompt, userPrompt, tools, maxRetries = 2) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this._doCall(systemPrompt, userPrompt, tools);
      } catch (error) {
        const isLastAttempt = attempt === maxRetries;
        const isRetryable = error.message.includes('429') || error.message.includes('503');
        if (isLastAttempt || !isRetryable) throw error;
        await new Promise(r => setTimeout(r, 2000 * Math.pow(2, attempt)));
      }
    }
  }

  async _doCall(systemPrompt, userPrompt, tools) {
    const startTime = Date.now();
    const token = this._getToken();

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        model: this.model,
        stream: false,
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
      throw new Error(`GLM5 API error: ${response.status} - ${error}`);
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

// AWS Bedrock Provider (ABSK bearer token - no SigV4 needed)
class BedrockProvider extends BaseProvider {
  constructor(apiKey, model = 'us.anthropic.claude-3-5-sonnet-20241022-v2:0', region = 'us-east-1', thinkingBudget = 0) {
    super(apiKey);
    this.model = model;
    this.region = region;
    this.baseUrl = `https://bedrock-runtime.${region}.amazonaws.com`;
    // thinkingBudget > 0 enables Claude extended thinking (min 1024 tokens required)
    this.thinkingBudget = thinkingBudget;
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

    let content = '';
    let nativeThinking = null; // Native model reasoning (Claude extended thinking)
    const rawToolCalls = [];

    for (const part of parts) {
      if (part.text) {
        content += part.text;
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
      content,
      toolCalls: rawToolCalls,
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

  getModelName() {
    return this.model;
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
      return new GroqProvider(getEnv('GROQ_API_KEY'), 'moonshotai/kimi-k2-instruct-0905');

    case 'groq-llama':
      return new GroqProvider(getEnv('GROQ_API_KEY'), 'llama-3.3-70b-versatile');

    case 'groq-maverick':
    case 'llama4-maverick':
      return new GroqProvider(getEnv('GROQ_API_KEY'), 'meta-llama/llama-4-maverick-17b-128e-instruct');

    case 'groq-scout':
    case 'llama4-scout':
      return new GroqProvider(getEnv('GROQ_API_KEY'), 'meta-llama/llama-4-scout-17b-16e-instruct');

    case 'groq-gpt-oss':
    case 'gpt-oss':
      return new GroqProvider(getEnv('GROQ_API_KEY'), 'openai/gpt-oss-120b');

    case 'groq-qwen3':
    case 'qwen3':
      return new GroqProvider(getEnv('GROQ_API_KEY'), 'qwen/qwen3-32b');

    case 'groq-kimi':
    case 'kimi':
      return new GroqProvider(getEnv('GROQ_API_KEY'), 'moonshotai/kimi-k2-instruct-0905');

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
      return new GeminiProvider(getEnv('GEMINI_API_KEY'), 'gemini-2.5-flash');

    case 'gemini3':
      return new GeminiProvider(getEnv('GEMINI_API_KEY'), 'gemini-3-flash-preview');

    case 'azure-deepseek':
      return new AzureDeepSeekProvider(
        getEnv('AZURE_DEEPSEEK_API_KEY') || getEnv('AZURE_API_KEY'),
        getEnv('AZURE_DEEPSEEK_RESOURCE') || 'hellobusiness999-4411-resource',
        getEnv('AZURE_DEEPSEEK_MODEL') || 'DeepSeek-V3.2'
      );

    case 'openrouter-mimo':
    case 'openrouter-glm':
    case 'openrouter':
      return new OpenRouterProvider(
        getEnv('OPENROUTER_API_KEY'),
        'z-ai/glm-4.5-air:free'  // Free model with tool support
      );

    case 'glm5':
    case 'vertex-glm5':
      return new GLM5Provider(
        getEnv('GLM5_PROJECT_ID') || 'gen-lang-client-0241703515',
        getEnv('GLM5_REGION') || 'global'
      );

    case 'bedrock':
    case 'bedrock-claude':
      return new BedrockProvider(
        getEnv('BEDROCK_API_KEY'),
        getEnv('BEDROCK_MODEL') || 'us.anthropic.claude-sonnet-4-6',
        getEnv('BEDROCK_REGION') || 'us-east-1'
      );

    // ── Claude 4.6 (latest, primary focus) ──────────────────────────────
    case 'bedrock-sonnet46':
      return new BedrockProvider(
        getEnv('BEDROCK_API_KEY'),
        'us.anthropic.claude-sonnet-4-6',
        getEnv('BEDROCK_REGION') || 'us-east-1'
      );

    case 'bedrock-sonnet46-thinking':
      return new BedrockProvider(
        getEnv('BEDROCK_API_KEY'),
        'us.anthropic.claude-sonnet-4-6',
        getEnv('BEDROCK_REGION') || 'us-east-1',
        1024
      );

    case 'bedrock-opus46':
      return new BedrockProvider(
        getEnv('BEDROCK_API_KEY'),
        'us.anthropic.claude-opus-4-6-v1',
        getEnv('BEDROCK_REGION') || 'us-east-1'
      );

    case 'bedrock-opus46-thinking':
      return new BedrockProvider(
        getEnv('BEDROCK_API_KEY'),
        'us.anthropic.claude-opus-4-6-v1',
        getEnv('BEDROCK_REGION') || 'us-east-1',
        1024
      );

    // ── Claude 4.5 ───────────────────────────────────────────────────────
    case 'bedrock-sonnet45':
      return new BedrockProvider(
        getEnv('BEDROCK_API_KEY'),
        'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
        getEnv('BEDROCK_REGION') || 'us-east-1'
      );

    case 'bedrock-sonnet45-thinking':
      return new BedrockProvider(
        getEnv('BEDROCK_API_KEY'),
        'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
        getEnv('BEDROCK_REGION') || 'us-east-1',
        1024
      );

    case 'bedrock-opus45':
      return new BedrockProvider(
        getEnv('BEDROCK_API_KEY'),
        'us.anthropic.claude-opus-4-5-20251101-v1:0',
        getEnv('BEDROCK_REGION') || 'us-east-1'
      );

    case 'bedrock-opus45-thinking':
      return new BedrockProvider(
        getEnv('BEDROCK_API_KEY'),
        'us.anthropic.claude-opus-4-5-20251101-v1:0',
        getEnv('BEDROCK_REGION') || 'us-east-1',
        1024
      );

    // ── Claude 4.0 / 4.1 ────────────────────────────────────────────────
    case 'bedrock-sonnet4':
      return new BedrockProvider(
        getEnv('BEDROCK_API_KEY'),
        'us.anthropic.claude-sonnet-4-20250514-v1:0',
        getEnv('BEDROCK_REGION') || 'us-east-1'
      );

    case 'bedrock-opus4':
      return new BedrockProvider(
        getEnv('BEDROCK_API_KEY'),
        'us.anthropic.claude-opus-4-20250514-v1:0',
        getEnv('BEDROCK_REGION') || 'us-east-1'
      );

    case 'bedrock-opus41':
      return new BedrockProvider(
        getEnv('BEDROCK_API_KEY'),
        'us.anthropic.claude-opus-4-1-20250805-v1:0',
        getEnv('BEDROCK_REGION') || 'us-east-1'
      );

    // ── Legacy thinking alias (Sonnet 4) ─────────────────────────────────
    case 'bedrock-thinking':
      return new BedrockProvider(
        getEnv('BEDROCK_API_KEY'),
        'us.anthropic.claude-sonnet-4-20250514-v1:0',
        getEnv('BEDROCK_REGION') || 'us-east-1',
        1024
      );

    default:
      throw new Error(`Unknown provider: ${type}`);
  }
}

// OpenRouter Provider (OpenAI-compatible)
class OpenRouterProvider extends BaseProvider {
  constructor(apiKey, model = 'xiaomi/mimo-v2-flash:free') {
    super(apiKey);
    this.model = model;
    this.baseUrl = 'https://openrouter.ai/api/v1';
  }

  async call(systemPrompt, userPrompt, tools) {
    const startTime = Date.now();

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'HTTP-Referer': 'https://github.com/so-long-sucker',
        'X-Title': 'So Long Sucker AI Research'
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

export { OpenAIProvider, GroqProvider, ClaudeProvider, AzureClaudeProvider, AzureKimiProvider, AzureDeepSeekProvider, GeminiProvider, OpenRouterProvider, BedrockProvider, GLM5Provider };
