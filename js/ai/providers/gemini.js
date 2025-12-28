// Gemini LLM Provider

import { LLMProvider } from './base.js';

export class GeminiProvider extends LLMProvider {
  constructor(apiKey, model = 'gemini-2.5-flash') {
    super(apiKey);
    this.model = model;
    this.baseUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  }

  getName() {
    return 'Gemini';
  }

  /**
   * Convert JSON Schema to Gemini's expected format
   */
  convertSchema(schema) {
    if (!schema || typeof schema !== 'object') return schema;

    const result = {};

    // Handle type - Gemini doesn't support array types like ['integer', 'string']
    if (schema.type) {
      if (Array.isArray(schema.type)) {
        result.type = schema.type[0] === 'integer' ? 'INTEGER' : 'STRING';
      } else {
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

  /**
   * Convert our tool format to Gemini format
   */
  formatTools(tools) {
    return [{
      functionDeclarations: tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        parameters: this.convertSchema(tool.parameters)
      }))
    }];
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
        tools: this.formatTools(tools),
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
      const error = await response.json();
      throw new Error(`Gemini API error: ${error.error?.message || response.statusText}`);
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
    console.log('🧪 Testing Gemini connection...');
    console.log('   Model:', this.model);

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.apiKey
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: 'Say "ok" and nothing else.' }]
          }
        ],
        generationConfig: {
          maxOutputTokens: 10
        }
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Gemini API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log('✅ Gemini test successful:', text);
    return true;
  }
}
