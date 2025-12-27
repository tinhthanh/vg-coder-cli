import { ScriptInjector } from './script-injector';
import { isAIChatDomain } from './utils/ai-domains';
import { VG_CODER_INJECTOR_SCRIPT } from './utils/injector-script';

const addScript = async (script: string, actionType: string) => {
  try {
    const success = await ScriptInjector.injectScript(script, actionType);
    if (!success) {
      console.error('All script injection methods failed for:', actionType);
    }
  } catch (error) {
    console.error('Script injection error:', error);
  }
}
// Wait for DOM to be ready before executing
const waitForDOM = (): Promise<void> => {
  return new Promise((resolve) => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => resolve(), { once: true });
    } else {
      resolve();
    }
  });
};

/**
 * Multi-layer detection to check if current page is loaded inside VG Coder's iframe
 * Returns true if this is a nested context (should skip injection)
 */
const detectVGCoderContext = async (): Promise<boolean> => {
  // Layer 1: URL parameter check (fastest)
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('vg_coder_context')) {
    console.log('⚡ VG Coder context detected: URL parameter');
    return true;
  }
  
  // Layer 2: Referrer check (backup)
  const referrer = document.referrer;
  if (referrer && (referrer.includes(':6868') || referrer.includes('vg-coder'))) {
    console.log('⚡ VG Coder context detected: Referrer contains :6868');
    return true;
  }
  
  // Layer 3: PostMessage ping (most reliable for iframe detection)
  if (window.self !== window.top) {
    try {
      const isVGCoder = await new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => resolve(false), 200);
        
        const handler = (event: MessageEvent) => {
          if (event.data?.type === 'VG_CODER_PARENT') {
            clearTimeout(timeout);
            window.removeEventListener('message', handler);
            resolve(true);
          }
        };
        
        window.addEventListener('message', handler);
        window.parent.postMessage({ type: 'VG_CODER_PING' }, '*');
      });
      
      if (isVGCoder) {
        console.log('⚡ VG Coder context detected: PostMessage confirmation');
        return true;
      }
    } catch (e) {
      console.log('PostMessage detection failed (expected for cross-origin):', e);
    }
  }
  
  console.log('✅ Normal context - not inside VG Coder iframe');
  return false;
};

const initializeController = async () => {
  try {
    // Check if we're in VG Coder's iframe context
    const isVGCoderNested = await detectVGCoderContext();
    
    if (isVGCoderNested) {
      console.log('🚫 VG Coder nested iframe context detected - skipping all script injections');
      sessionStorage.setItem('VG_CODER_NESTED', 'true');
      return; // Early exit - don't inject any scripts
    }

    // Ensure DOM is ready
    await waitForDOM();

    const currentHostname = window.location.hostname.replace(/(https?:\/\/)?(www.)?/i, '');
    
    // Check if this is an AI chat domain - use bundled injector
    if (isAIChatDomain(currentHostname)) {
      console.log('🤖 AI chat domain detected:', currentHostname);
      console.log('📦 Using bundled VG Coder injector (no Firebase needed)');
      
      // Execute bundled injector script
      await addScript(VG_CODER_INJECTOR_SCRIPT, 'VG_CODER_INJECTOR');
      return; // Done - no need for Firebase script
    }

    // For non-AI domains, continue with Firebase script loading
    const actionType = new URL(window.location.href).searchParams.get("actionType") || "MAIN";
    const cache = sessionStorage.getItem(actionType);

    if (cache) {
      await addScript(cache, actionType);
    } else {
      chrome.runtime.sendMessage({
        action: "CONTROLLER",
        domain: currentHostname,
        actionType: actionType
      }, async (response) => {
        if (chrome.runtime.lastError) {
          console.error('Runtime error:', chrome.runtime.lastError);
          return;
        }
        if (response && response.script) {
          const fullScript = `var chromeId = "${chrome.runtime.id}"; ${response.script}`;
          await addScript(fullScript, actionType);
          sessionStorage.setItem(actionType, fullScript);
        }
      });
    }
  } catch (err) {
    console.error('Controller initialization error:', err);
  }
};

// Initialize controller
initializeController();
const setupRemoveExtensionListener = async () => {
  try {
    // Wait for DOM and body to be ready
    await waitForDOM();

    // Wait for body element
    const waitForBody = (): Promise<HTMLBodyElement> => {
      return new Promise((resolve) => {
        const checkBody = () => {
          const body = document.querySelector('body');
          if (body) {
            resolve(body as HTMLBodyElement);
          } else {
            setTimeout(checkBody, 100);
          }
        };
        checkBody();
      });
    };

    const body = await waitForBody();

    // cach dung: document.querySelector('body').dispatchEvent(new CustomEvent('REMOVE_EXTENSION', { detail: { key: 'value' } }));
    body.addEventListener('REMOVE_EXTENSION', function(event: any) {
      console.log(event.detail); // { key: 'value' }
      chrome.runtime.sendMessage({action: "REMOVE_EXTENSION", data: event.detail}, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Runtime error:', chrome.runtime.lastError);
          return;
        }
        console.log('tu huy thanh cong', response);
      });
    });
  } catch (err) {
    console.error('Setup remove extension listener error:', err);
  }
};

// Setup remove extension listener
setupRemoveExtensionListener();

