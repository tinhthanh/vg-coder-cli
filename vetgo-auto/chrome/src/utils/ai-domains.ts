// AI Chat Providers Configuration
// Domains for automatic VG Coder iframe injection

export const AI_DOMAINS = [
  'chat.openai.com',           // ChatGPT (old URL)
  'chatgpt.com',               // ChatGPT (new URL)
  'gemini.google.com',         // Google Gemini
  'aistudio.google.com',       // Google AI Studio
  'chat.deepseek.com',         // DeepSeek
  'kimi.com',                  // Kimi AI
  'www.kimi.com',             // Kimi AI (www)
  'grok.com',                  // Grok
  'claude.ai',                 // Claude (Anthropic)
  'poe.com',                   // Poe
  'perplexity.ai',            // Perplexity
  'www.perplexity.ai',        // Perplexity (www)
];

/**
 * Check if domain should have VG Coder iframe injected
 */
export function isAIChatDomain(hostname: string): boolean {
  const cleanHostname = hostname.toLowerCase().replace(/^www\./, '');
  console.log('🔍 Checking AI domain:', cleanHostname);
  
  const isMatch = AI_DOMAINS.some(domain => {
    const cleanDomain = domain.toLowerCase().replace(/^www\./, '');
    return cleanHostname === cleanDomain || cleanHostname.endsWith('.' + cleanDomain);
  });
  
  console.log('🎯 AI domain match:', isMatch);
  return isMatch;
}
