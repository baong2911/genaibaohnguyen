// API Keys Configuration
// Add your API keys here instead of entering them through the UI

export const API_KEYS = {
  openai: import.meta.env.VITE_OPENAI_API_KEY || "",
  gemini: import.meta.env.VITE_GEMINI_API_KEY || "",
  perplexity: import.meta.env.VITE_PERPLEXITY_API_KEY || "",
};
