// Base LLM Provider interface

export class LLMProvider {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  /**
   * Call the LLM with tools
   * @param {string} systemPrompt - System instructions
   * @param {string} userPrompt - User/game state prompt
   * @param {Array} tools - Available tools/functions
   * @returns {Promise<{toolCalls: Array, text: string}>}
   */
  async call(systemPrompt, userPrompt, tools) {
    throw new Error('Not implemented');
  }

  /**
   * Get provider name
   */
  getName() {
    throw new Error('Not implemented');
  }
}
