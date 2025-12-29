import { initMain } from './main.js';
import { setRoot } from './utils.js';

// Entry point for Shadow DOM Injector
(function() {
    console.log('🚀 VG Coder: Initializing in Shadow Context...');
    
    // 1. Determine Root (ShadowRoot exposed by gulp wrapper)
    const root = window.__VG_CODER_ROOT__;
    
    if (!root) {
        console.error('VG Coder: Root context not found!');
        return;
    }

    // 2. Set Context for Utils
    setRoot(root);

    // 3. Initialize Main App Logic
    initMain();
})();
