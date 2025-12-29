// Configuration & Constants

// Kiểm tra biến global được set bởi Injector trong gulpfile.js
// Hoặc kiểm tra xem có chạy trong Iframe không (fallback)
const isInjected = (typeof window !== 'undefined' && window.__VG_CODER_ROOT__) || 
                   (document.getElementById('vg-coder-shadow-host'));

console.log('[Config] VG Coder Context:', isInjected ? 'Injected (Shadow DOM)' : 'Standalone');

// QUAN TRỌNG: Nếu là Injected thì MẶC ĐỊNH trỏ về localhost:6868
// Nếu không, dùng relative path (cho trường hợp mở dashboard trực tiếp)
export const API_BASE = isInjected ? 'http://localhost:6868' : window.location.origin;

export const SYSTEM_PROMPT = `# VG Coder AI System Prompt`;
