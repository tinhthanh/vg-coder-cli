import { ScriptInjector } from './script-injector';

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

const initializeController = async () => {
  try {
    // Ensure DOM is ready
    await waitForDOM();

    const actionType = new URL(window.location.href).searchParams.get("actionType") || "MAIN";
    const cache = sessionStorage.getItem(actionType);

    if (cache) {
      await addScript(cache, actionType);
    } else {
      chrome.runtime.sendMessage({
        action: "CONTROLLER",
        domain: window.location.hostname.replace(/(https?:\/\/)?(www.)?/i, ''),
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

