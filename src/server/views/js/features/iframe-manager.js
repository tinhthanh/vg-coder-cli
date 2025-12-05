/**
 * Quản lý tính năng Iframe AI Provider
 */

// Danh sách các AI Providers
const AI_PROVIDERS = [
    { id: 'chatgpt', name: 'ChatGPT', url: 'https://chat.openai.com' },
    { id: 'kimi', name: 'Kimi AI', url: 'https://www.kimi.com' },
    { id: 'deepseek', name: 'DeepSeek', url: 'https://chat.deepseek.com' },
    { id: 'gemini', name: 'Google Gemini', url: 'https://gemini.google.com/app' },
    { id: 'aistudio', name: 'Google AI Studio', url: 'https://aistudio.google.com/prompts/new_chat' }
];

export function initIframeManager() {
    const select = document.getElementById('ai-provider-select');
    const iframe = document.getElementById('ai-iframe');
    const externalLink = document.getElementById('ai-external-link');
    const placeholderLink = document.getElementById('ai-placeholder-link');

    if (!select || !iframe) return;

    // 1. Populate options
    AI_PROVIDERS.forEach(provider => {
        const option = document.createElement('option');
        option.value = provider.id;
        option.textContent = provider.name;
        select.appendChild(option);
    });

    // 2. Load saved selection or default
    const savedProviderId = localStorage.getItem('ai_provider') || 'chatgpt';
    
    // Validate if saved provider still exists
    const isValid = AI_PROVIDERS.some(p => p.id === savedProviderId);
    select.value = isValid ? savedProviderId : AI_PROVIDERS[0].id;

    // 3. Function to update UI
    const updateProvider = (providerId) => {
        const provider = AI_PROVIDERS.find(p => p.id === providerId) || AI_PROVIDERS[0];
        
        iframe.src = provider.url;
        externalLink.href = provider.url;
        placeholderLink.href = provider.url;
        placeholderLink.textContent = `Mở ${provider.name} tab mới ↗`;
        
        localStorage.setItem('ai_provider', providerId);
    };

    // 4. Initial update
    updateProvider(select.value);

    // 5. Event listener
    select.addEventListener('change', (e) => {
        updateProvider(e.target.value);
    });
}
