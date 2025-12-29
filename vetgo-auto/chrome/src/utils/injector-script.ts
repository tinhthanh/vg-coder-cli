// VG Coder Shadow DOM Bundle Loader
// This script fetches the compiled bundle from the local server and executes it.

export const VG_CODER_INJECTOR_SCRIPT = `
(function() {
  'use strict';
  
  const CONFIG = {
    // Trỏ tới file bundle vừa build
    BUNDLE_URL: 'http://localhost:6868/dist/vg-coder-bundle.js',
    CONTAINER_ID: 'vg-coder-shadow-host'
  };
  
  // 1. Kiểm tra nếu đã inject rồi
  if (document.getElementById(CONFIG.CONTAINER_ID)) {
    console.log('⚡ VG Coder already injected');
    return;
  }

  console.log('🚀 Loading VG Coder Bundle from:', CONFIG.BUNDLE_URL);

  // 2. Tạo Script Tag để load bundle
  // Cách này tốt hơn fetch+eval vì tận dụng cache và debug dễ hơn
  const script = document.createElement('script');
  script.src = CONFIG.BUNDLE_URL;
  script.type = 'text/javascript';
  script.async = true;
  
  script.onload = () => {
    console.log('✅ VG Coder Bundle Loaded Successfully');
  };
  
  script.onerror = () => {
    console.error('❌ Failed to load VG Coder Bundle. Is the server running at port 6868?');
    // Optional: Show a visual error toast on the page
    const toast = document.createElement('div');
    toast.style.cssText = 'position:fixed; top:20px; right:20px; background:#ff3b30; color:white; padding:10px 20px; border-radius:8px; z-index:999999; font-family:sans-serif; box-shadow:0 4px 12px rgba(0,0,0,0.2);';
    toast.textContent = '⚠️ VG Coder Connection Failed (Is Server Running?)';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
  };

  // 3. Inject vào Head hoặc Body
  (document.head || document.body).appendChild(script);

})();
`;
