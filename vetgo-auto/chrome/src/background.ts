import { LoadScriptController } from "./controllers/load-script.controller";
import { Observable } from "rxjs";
import { CommonFunc } from "./controllers/load-common-fuc.controller";
import { uuid } from "./utils/db-utils";

// Type declaration for chrome.sidePanel API (not yet in @types/chrome)
declare global {
  namespace chrome {
    namespace sidePanel {
      function open(options: { tabId?: number; windowId?: number }): Promise<void>;
      function setOptions(options: { tabId?: number; path?: string; enabled?: boolean }): Promise<void>;
    }
  }
}

// Handle extension icon click to open side panel
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    (chrome as any).sidePanel.open({ tabId: tab.id }).catch((err: Error) => {
      console.error('Failed to open side panel:', err);
    });
  }
});


// Service Worker không hỗ trợ BehaviorSubject như trong background page
// Sử dụng chrome.storage để lưu trữ state thay thế
// const $eventOpenZalo = new BehaviorSubject<boolean>(null);

// Manifest V3 không còn hỗ trợ webRequest blocking
// Chuyển sang sử dụng declarativeNetRequest thông qua rules.json
// Headers sẽ được xử lý bởi declarative rules thay vì code

// Manifest V3: Thay thế webRequest.onBeforeRequest bằng webNavigation
// Vì không thể chặn request, ta sẽ lắng nghe navigation events
chrome.webNavigation.onCompleted.addListener(async (details) => {
  if (details.frameId === 0) { // Chỉ xử lý main frame
    try {
      const url = new URL(details.url);
      const params = new URLSearchParams(url.search);
      const sheetID = params.get('sheetID');
      const profile = params.get('profile');

      if (sheetID) {
        console.log('Found navigation with sheetID:', details.url);
        // Manifest V3: Sử dụng chrome.scripting thay vì chrome.tabs.executeScript
        await chrome.scripting.executeScript({
          target: { tabId: details.tabId },
          func: (sheetID) => {
            localStorage.setItem("sheetID", sheetID);
          },
          args: [sheetID]
        });
        console.log('sheetID saved to local storage:', sheetID);
      }

      if (profile) {
        console.log('Found navigation with profile:', details.url);
        await chrome.scripting.executeScript({
          target: { tabId: details.tabId },
          func: (profile) => {
            localStorage.setItem("phone", profile);
          },
          args: [profile]
        });
        console.log('profile saved to local storage:', profile);
      }
    } catch (error) {
      console.error('Error processing navigation:', error);
    }
  }
});

chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  // Log the URL of the navigation
  console.log('Navigating to:', details.url);
  chrome.tabs.query({ currentWindow: true }, (tabs) => {
    tabs.filter(tab => tab.url && tab.url.includes('id.zalo.me')).forEach((tab) => {
      if(tab.id && tab.id !== details.tabId) {
        chrome.tabs.remove(tab.id);
      }
    })
  })
}, { url: [{ hostEquals: 'id.zalo.me' }] });
const getChromeId = ():Observable<string> =>{
  return new Observable((ob) => {
    chrome.storage.sync.get(({id}) => {
      if(!id) {
       const chromeId =  uuid();
        chrome.storage.sync.set({id: chromeId});
        ob.next(chromeId);
      } else {
        ob.next(id);
      }
    })
  });
}
chrome.runtime.onInstalled.addListener(() => {
  getChromeId().subscribe((id) => {
    console.log("id",id);
  });
  // chrome.storage.sync.clear(() => console.log("Clear store......"));
  // chrome.cookies.getAll({}, function(cookies) {
  //   var json = JSON.stringify(cookies);
  //   var blob = new Blob([json], {type: "application/json"});
  //   var url = URL.createObjectURL(blob);
  //
  //   chrome.downloads.download({
  //     url: url,
  //     filename: "cookies.json"
  //   });
  // });
});
// function zaloTab() {
//   chrome.tabs.query({ currentWindow: true }, (tabs) => {
//     const isNewTab = tabs.map(tab => tab.url).some( url => url.includes('chat.zalo.me') || url.includes('id.zalo.me'));
//     if(!isNewTab) {
//       chrome.tabs.create({ url: 'https://chat.zalo.me', active: false });
//     }
//   });
// }
// Listen for tab removal
// chrome.tabs.onActivated.addListener((activeInfo) => {
//   $eventOpenZalo.next(true);
// });
// chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
//   $eventOpenZalo.next(true);
// });
chrome.tabs.onCreated.addListener(() => {
  // console.log(JSON.stringify(tab));
  // alert(JSON.stringify(tab))
});
chrome.cookies.onChanged.addListener(() => {
  // console.log(JSON.stringify(changeInfo.cookie))
});
chrome.runtime.onMessage.addListener((request, sender, respond) => {
  console.log(sender.tab ?
    "from a content script:" + sender.tab.url :
    "from the extension");
  const handler = new Promise((resolve, reject) => {
    if ( request.action === 'REMOVE_EXTENSION' ) {
      // ham nay de tu xoa extension
      chrome.management.uninstallSelf();
      resolve(request);
      return;
    }
    if(request.action === 'SHEET') {
      resolve(request);
      return;
    }
    if (request.action === 'INJECT_SCRIPT') {
      // Inject script using chrome.scripting API to bypass CSP
      if (sender.tab && sender.tab.id) {
        chrome.scripting.executeScript({
          target: { tabId: sender.tab.id },
          world: 'MAIN', // Execute in main world to access page's window object
          func: (scriptCode) => {
            try {
              // Create script element and inject into DOM
              // This avoids nested eval issues and executes in proper page context
              const script = document.createElement('script');
              script.textContent = scriptCode;
              script.type = 'text/javascript';
              
              // Append to head or document element
              const target = document.head || document.documentElement;
              target.appendChild(script);
              
              // Clean up immediately after execution
              script.remove();
            } catch (error) {
              console.error('Script execution error:', error);
            }
          },
          args: [request.script]
        }).then(() => {
          resolve({ success: true });
        }).catch((error) => {
          console.error('Chrome scripting injection failed:', error);
          resolve({ success: false, error: error.message });
        });
      } else {
        resolve({ success: false, error: 'No tab ID available' });
      }
      return;
    }
    if (request.action == 'CONTROLLER') {
      const actionType = request.actionType || "MAIN";
      getChromeId().subscribe((id) => {
        console.log(id);
        CommonFunc.load().then((commonCode)=> {
          LoadScriptController.loadScriptByDomain(request.domain, actionType).then((code) => {
            let script = `
          window.vetgo = {...(window.vetgo || {} ) ,chromeId:"${id}"};
          ${commonCode}
          ${code}
          `;
            resolve({ script });
          });
        })
      })
    } else {
      reject('//request is empty.');
    }
  });
  handler.then(message => respond(message)).catch(error => respond(error));
  return true;

});
