// Alternative script injection methods for CSP-restricted environments

export class ScriptInjector {

  /**
   * Detect if site has strict CSP that blocks blob/data URLs
   */
  private static detectStrictCSP(): boolean {
    try {
      // Check for CSP meta tags
      const cspMetas = document.querySelectorAll('meta[http-equiv="Content-Security-Policy"]');
      for (let i = 0; i < cspMetas.length; i++) {
        const meta = cspMetas[i];
        const content = meta.getAttribute('content') || '';
        if (content.includes('script-src') && !content.includes('blob:') && !content.includes('data:')) {
          return true;
        }
      }

      // Check common strict CSP domains
      const strictDomains = [
        'midjourney.com',
        'openai.com',
        'github.com',
        'google.com',
        'googletagmanager.com',
        'facebook.com',
        'twitter.com',
        'linkedin.com'
      ];

      const hostname = window.location.hostname.toLowerCase();
      return strictDomains.some(domain => hostname.includes(domain));
    } catch (error) {
      console.error('CSP detection error:', error);
      return false;
    }
  }

  /**
   * Safely get head element or wait for it
   */
  private static getHeadElement(): Promise<HTMLHeadElement> {
    return new Promise((resolve) => {
      const tryGetHead = () => {
        const head = document.head || document.getElementsByTagName('head')[0];
        if (head) {
          resolve(head as HTMLHeadElement);
          return;
        }

        // If no head, wait for DOM
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', tryGetHead, { once: true });
        } else {
          // Create head if it doesn't exist
          const newHead = document.createElement('head');
          if (document.documentElement) {
            document.documentElement.appendChild(newHead);
            resolve(newHead);
          } else {
            // Last resort: wait a bit and try again
            setTimeout(tryGetHead, 100);
          }
        }
      };

      tryGetHead();
    });
  }

  /**
   * Method 1: Blob URL injection (works in most cases)
   */
  static async injectViaBlob(script: string, actionType: string): Promise<boolean> {
    try {
      const blob = new Blob([script], { type: 'application/javascript' });
      const blobUrl = URL.createObjectURL(blob);

      const scriptElement = document.createElement('script');
      scriptElement.type = 'text/javascript';
      scriptElement.id = actionType;
      scriptElement.src = blobUrl;

      return new Promise(async (resolve) => {
        scriptElement.onload = () => {
          URL.revokeObjectURL(blobUrl);
          resolve(true);
        };

        scriptElement.onerror = () => {
          URL.revokeObjectURL(blobUrl);
          resolve(false);
        };

        try {
          const head = await this.getHeadElement();
          head.appendChild(scriptElement);
        } catch (error) {
          console.error('Failed to get head element:', error);
          URL.revokeObjectURL(blobUrl);
          resolve(false);
        }
      });
    } catch (error) {
      console.error('Blob injection failed:', error);
      return false;
    }
  }

  /**
   * Method 2: Data URL injection (fallback)
   */
  static async injectViaDataUrl(script: string, actionType: string): Promise<boolean> {
    try {
      const dataUrl = 'data:application/javascript;base64,' + btoa(script);
      const scriptElement = document.createElement('script');
      scriptElement.type = 'text/javascript';
      scriptElement.id = actionType + '_data';
      scriptElement.src = dataUrl;

      return new Promise(async (resolve) => {
        scriptElement.onload = () => resolve(true);
        scriptElement.onerror = () => resolve(false);

        try {
          const head = await this.getHeadElement();
          head.appendChild(scriptElement);
        } catch (error) {
          console.log('Failed to get head element for data URL:');
          resolve(false);
        }
      });
    } catch (error) {
      console.log('Data URL injection failed:');
      return false;
    }
  }

  /**
   * Method 3: PostMessage bridge injection
   */
  static injectViaPostMessage(script: string, actionType: string): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        // Create a bridge script that listens for postMessage
        const bridgeScript = `
          window.addEventListener('message', function(event) {
            if (event.source !== window || !event.data.type || event.data.type !== 'VETGO_SCRIPT_INJECT') {
              return;
            }
            try {
              const func = new Function(event.data.script);
              func();
              window.postMessage({type: 'VETGO_SCRIPT_SUCCESS', actionType: event.data.actionType}, '*');
            } catch (error) {
              console.error('PostMessage script execution failed:', error);
              window.postMessage({type: 'VETGO_SCRIPT_ERROR', actionType: event.data.actionType, error: error.message}, '*');
            }
          });
        `;
        
        // First inject the bridge
        this.injectViaBlob(bridgeScript, actionType + '_bridge').then((bridgeSuccess) => {
          if (bridgeSuccess) {
            // Listen for response
            const responseHandler = (event: MessageEvent) => {
              if (event.source !== window || !event.data.type) return;
              
              if (event.data.type === 'VETGO_SCRIPT_SUCCESS' && event.data.actionType === actionType) {
                window.removeEventListener('message', responseHandler);
                resolve(true);
              } else if (event.data.type === 'VETGO_SCRIPT_ERROR' && event.data.actionType === actionType) {
                window.removeEventListener('message', responseHandler);
                resolve(false);
              }
            };
            
            window.addEventListener('message', responseHandler);
            
            // Send script via postMessage
            window.postMessage({
              type: 'VETGO_SCRIPT_INJECT',
              script: script,
              actionType: actionType
            }, '*');
            
            // Timeout after 5 seconds
            setTimeout(() => {
              window.removeEventListener('message', responseHandler);
              resolve(false);
            }, 5000);
          } else {
            resolve(false);
          }
        });
      } catch (error) {
        console.error('PostMessage injection failed:', error);
        resolve(false);
      }
    });
  }

  /**
   * Method 4: Background script injection via chrome.scripting
   */
  static injectViaBackground(script: string, actionType: string): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({
          action: "INJECT_SCRIPT",
          script: script,
          actionType: actionType
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Background injection failed:', chrome.runtime.lastError);
            resolve(false);
          } else {
            resolve(response && response.success);
          }
        });
      } catch (error) {
        console.error('Background script injection failed:', error);
        resolve(false);
      }
    });
  }

  /**
   * Method 5: Direct eval in content script context (last resort)
   */
  static injectViaEval(script: string, actionType: string): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        console.log(`Attempting direct eval for ${actionType}`);

        // Create isolated function to avoid polluting global scope
        const isolatedExecution = new Function(`
          try {
            ${script}
            return true;
          } catch (error) {
            console.error('Eval execution error:', error);
            return false;
          }
        `);

        const success = isolatedExecution();
        resolve(success);
      } catch (error) {
        console.error('Eval injection failed:', error);
        resolve(false);
      }
    });
  }

  /**
   * Try all methods in smart order based on CSP detection
   */
  static async injectScript(script: string, actionType: string): Promise<boolean> {
    const hasStrictCSP = this.detectStrictCSP();

    // Smart method ordering based on CSP detection
    const methods = hasStrictCSP ? [
      // For strict CSP sites, try background injection first
      () => this.injectViaBackground(script, actionType),
      () => this.injectViaEval(script, actionType),
      () => this.injectViaPostMessage(script, actionType),
      () => this.injectViaBlob(script, actionType),
      () => this.injectViaDataUrl(script, actionType)
    ] : [
      // For normal sites, try blob first (fastest)
      () => this.injectViaBlob(script, actionType),
      () => this.injectViaDataUrl(script, actionType),
      () => this.injectViaBackground(script, actionType),
      () => this.injectViaEval(script, actionType),
      () => this.injectViaPostMessage(script, actionType)
    ];

    console.log(`Injecting script for ${actionType} (Strict CSP: ${hasStrictCSP})`);

    for (let i = 0; i < methods.length; i++) {
      const method = methods[i];
      const methodName = hasStrictCSP ?
        ['Background', 'Eval', 'PostMessage', 'Blob', 'DataURL'][i] :
        ['Blob', 'DataURL', 'Background', 'Eval', 'PostMessage'][i];

      try {
        console.log(`Trying ${methodName} injection...`);
        const success = await method();
        if (success) {
          console.log(`✅ Script injection successful via ${methodName} for ${actionType}`);
          return true;
        } else {
          console.log(`❌ ${methodName} injection failed for ${actionType}`);
        }
      } catch (error) {
        console.error(`❌ ${methodName} injection error:`, error);
      }
    }

    console.error(`❌ All injection methods failed for ${actionType}`);
    return false;
  }
}
