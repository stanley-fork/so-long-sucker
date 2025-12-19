// Centralized configuration for So Long Sucker
// API keys are loaded from .env file (via Vite)

export const CONFIG = {
  // Groq API (for Llama & Kimi models)
  GROQ_API_KEY: import.meta.env.VITE_GROQ_API_KEY || '',

  // OpenAI API
  OPENAI_API_KEY: import.meta.env.VITE_OPENAI_API_KEY || '',

  // Anthropic Claude API
  CLAUDE_API_KEY: import.meta.env.VITE_CLAUDE_API_KEY || '',

  // Azure Claude
  AZURE_RESOURCE: import.meta.env.VITE_AZURE_RESOURCE || 'data4peopleservice-8737-resource',
  AZURE_MODEL: import.meta.env.VITE_AZURE_MODEL || 'claude-opus-4-5'
};

// Helper to check if a provider is configured
export function isProviderConfigured(provider) {
  switch (provider) {
    case 'groq':
      return !!CONFIG.GROQ_API_KEY;
    case 'openai':
      return !!CONFIG.OPENAI_API_KEY;
    case 'claude':
      return !!CONFIG.CLAUDE_API_KEY;
    case 'azure-claude':
      return !!CONFIG.AZURE_RESOURCE;
    default:
      return false;
  }
}

// Get configured providers
export function getConfiguredProviders() {
  const providers = [];
  if (CONFIG.GROQ_API_KEY) providers.push('groq');
  if (CONFIG.OPENAI_API_KEY) providers.push('openai');
  if (CONFIG.CLAUDE_API_KEY) providers.push('claude');
  if (CONFIG.AZURE_RESOURCE) providers.push('azure-claude');
  return providers;
}
