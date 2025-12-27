const AI_PROVIDERS = [
    { id: 'chatgpt', name: 'ChatGPT', url: 'https://chat.openai.com' },
    { id: 'kimi', name: 'Kimi AI', url: 'https://www.kimi.com' },
    { id: 'deepseek', name: 'DeepSeek', url: 'https://chat.deepseek.com' },
    { id: 'gemini', name: 'Google Gemini', url: 'https://gemini.google.com/app' },
    { id: 'aistudio', name: 'Google AI Studio', url: 'https://aistudio.google.com/prompts/new_chat' },
    { id: 'gork', name: 'Gork', url: 'https://grok.com' },
];

export function initIframeManager() {
    const select = document.getElementById('ai-provider-select');
    const iframe = document.getElementById('ai-iframe');
    // Removed externalLink reference
    const placeholderLink = document.getElementById('ai-placeholder-link');
    
    // Guide elements
    const guideContainer = document.getElementById('iframe-placeholder');
    const guideToggleBtn = document.getElementById('guide-toggle-btn');
    const guideCloseBtn = document.getElementById('guide-close-btn');
    const guideDoneBtn = document.getElementById('guide-done-btn');

    if (!select || !iframe) return;

    // 1. Populate options
    AI_PROVIDERS.forEach(provider => {
        const option = document.createElement('option');
        option.value = provider.id;
        option.textContent = provider.name;
        select.appendChild(option);
    });

    // 2. Load saved selection
    const savedProviderId = localStorage.getItem('ai_provider') || 'chatgpt';
    const isValid = AI_PROVIDERS.some(p => p.id === savedProviderId);
    select.value = isValid ? savedProviderId : AI_PROVIDERS[0].id;

    const updateProvider = (providerId) => {
        const provider = AI_PROVIDERS.find(p => p.id === providerId) || AI_PROVIDERS[0];
        
        // Add VG Coder context parameter to prevent nested iframe injection
        const urlWithParam = new URL(provider.url);
        urlWithParam.searchParams.set('vg_coder_context', 'true');
        
        // Reset iframe source to trigger reload
        iframe.src = 'about:blank';
        setTimeout(() => {
            iframe.src = urlWithParam.toString();
        }, 50);

        // Update placeholder link (without the parameter for direct access)
        if (placeholderLink) {
            placeholderLink.href = provider.url;
            placeholderLink.textContent = `Mở ${provider.name} tab mới ↗`;
        }
        
        localStorage.setItem('ai_provider', providerId);
    };

    // Initial load
    updateProvider(select.value);

    // Event listeners
    select.addEventListener('change', (e) => {
        updateProvider(e.target.value);
    });

    // --- GUIDE TOGGLE LOGIC ---

    const showGuide = () => {
        if (guideContainer) guideContainer.classList.remove('hidden');
    };

    const hideGuide = () => {
        if (guideContainer) guideContainer.classList.add('hidden');
    };

    const reloadIframe = () => {
        const currentSrc = iframe.src;
        iframe.src = 'about:blank';
        setTimeout(() => {
            iframe.src = currentSrc;
        }, 100);
    };

    if (guideToggleBtn) {
        guideToggleBtn.addEventListener('click', showGuide);
    }

    if (guideCloseBtn) {
        guideCloseBtn.addEventListener('click', hideGuide);
    }

    if (guideDoneBtn) {
        guideDoneBtn.addEventListener('click', () => {
            hideGuide();
            reloadIframe();
        });
    }
}
