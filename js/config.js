// Centralized configuration for So Long Sucker
// API keys are loaded from .env file (via Vite) or can be set directly

// Safe accessor for Vite env vars (works without Vite too)
const env = (typeof import.meta !== 'undefined' && import.meta.env) || {};

export const CONFIG = {
  // Groq API (for Llama & Kimi models)
  GROQ_API_KEY: env.VITE_GROQ_API_KEY || '',

  // Public Groq key for Quick Play (shared for demo purposes)
  PUBLIC_GROQ_KEY: env.VITE_PUBLIC_GROQ_KEY || '',

  // OpenRouter API (for users with their own keys)
  OPENROUTER_API_KEY: env.VITE_OPENROUTER_API_KEY || '',

  // OpenAI API
  OPENAI_API_KEY: env.VITE_OPENAI_API_KEY || '',

  // Anthropic Claude API
  CLAUDE_API_KEY: env.VITE_CLAUDE_API_KEY || '',

  // Google Gemini API
  GEMINI_API_KEY: env.VITE_GEMINI_API_KEY || '',

  // Azure Claude
  AZURE_RESOURCE: env.VITE_AZURE_RESOURCE || 'data4peopleservice-8737-resource',
  AZURE_MODEL: env.VITE_AZURE_MODEL || 'claude-opus-4-5'
};

// Helper to check if a provider is configured
export function isProviderConfigured(provider) {
  switch (provider) {
    case 'groq':
      return !!CONFIG.GROQ_API_KEY;
    case 'openrouter':
      return !!CONFIG.OPENROUTER_API_KEY;
    case 'openai':
      return !!CONFIG.OPENAI_API_KEY;
    case 'claude':
      return !!CONFIG.CLAUDE_API_KEY;
    case 'gemini':
      return !!CONFIG.GEMINI_API_KEY;
    case 'azure-claude':
      return !!CONFIG.AZURE_RESOURCE;
    default:
      return false;
  }
}

// Check if Quick Play is available (public key configured)
export function isQuickPlayAvailable() {
  return !!CONFIG.PUBLIC_GROQ_KEY;
}

// Get configured providers
export function getConfiguredProviders() {
  const providers = [];
  if (CONFIG.GROQ_API_KEY) providers.push('groq');
  if (CONFIG.OPENROUTER_API_KEY) providers.push('openrouter');
  if (CONFIG.OPENAI_API_KEY) providers.push('openai');
  if (CONFIG.CLAUDE_API_KEY) providers.push('claude');
  if (CONFIG.GEMINI_API_KEY) providers.push('gemini');
  if (CONFIG.AZURE_RESOURCE) providers.push('azure-claude');
  return providers;
}
