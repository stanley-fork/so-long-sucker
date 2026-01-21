// Centralized configuration for So Long Sucker
// API keys are loaded from environment variables (via Vite) at build time

// Debug: Log env check
console.log('🔧 Environment check:', {
  GROQ_ENABLED: import.meta.env.VITE_GROQ_ENABLED ? 'SET' : 'NOT SET',
  GEMINI_ENABLED: import.meta.env.VITE_GEMINI_ENABLED ? 'SET' : 'NOT SET',
  MODE: import.meta.env.MODE
});

export const CONFIG = {
  // Groq enabled flag (server-side proxy handles the actual API key)
  GROQ_ENABLED: import.meta.env.VITE_GROQ_ENABLED === 'true',

  // Gemini enabled flag (server-side proxy handles the actual API key)
  GEMINI_ENABLED: import.meta.env.VITE_GEMINI_ENABLED === 'true',

  // OpenRouter API (for users with their own keys)
  OPENROUTER_API_KEY: import.meta.env.VITE_OPENROUTER_API_KEY || '',

  // OpenAI API
  OPENAI_API_KEY: import.meta.env.VITE_OPENAI_API_KEY || '',

  // Anthropic Claude API
  CLAUDE_API_KEY: import.meta.env.VITE_CLAUDE_API_KEY || '',

  // Google Gemini API
  GEMINI_API_KEY: import.meta.env.VITE_GEMINI_API_KEY || '',

  // Azure Claude
  AZURE_RESOURCE: import.meta.env.VITE_AZURE_RESOURCE || 'data4peopleservice-8737-resource',
  AZURE_MODEL: import.meta.env.VITE_AZURE_MODEL || 'claude-opus-4-5'
};

// Helper to check if a provider is configured
export function isProviderConfigured(provider) {
  switch (provider) {
    case 'groq':
      return CONFIG.GROQ_ENABLED;
    case 'gemini':
      return CONFIG.GEMINI_ENABLED;
    case 'openrouter':
      return !!CONFIG.OPENROUTER_API_KEY;
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

// Check if Quick Play is available (Groq or Gemini proxy enabled)
export function isQuickPlayAvailable() {
  return CONFIG.GROQ_ENABLED || CONFIG.GEMINI_ENABLED;
}

// Get configured providers
export function getConfiguredProviders() {
  const providers = [];
  if (CONFIG.GROQ_ENABLED) providers.push('groq');
  if (CONFIG.GEMINI_ENABLED) providers.push('gemini');
  if (CONFIG.OPENROUTER_API_KEY) providers.push('openrouter');
  if (CONFIG.OPENAI_API_KEY) providers.push('openai');
  if (CONFIG.CLAUDE_API_KEY) providers.push('claude');
  if (CONFIG.AZURE_RESOURCE) providers.push('azure-claude');
  return providers;
}
