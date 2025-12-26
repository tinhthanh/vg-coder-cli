# VetGo Pro Extension - Manifest V3 Migration

## Tóm tắt các thay đổi

Extension VetGo Pro đã được cập nhật thành công từ Manifest V2 lên Manifest V3. Dưới đây là chi tiết các thay đổi:

## 1. Cập nhật manifest.json

### Thay đổi chính:
- `manifest_version`: 2 → 3
- `background.scripts` → `background.service_worker`
- Tách `permissions` thành `permissions` và `host_permissions`
- Cập nhật `content_security_policy` theo chuẩn V3
- Thêm `declarative_net_request` configuration

### Permissions mới:
- Thêm `scripting` permission
- Thêm `declarativeNetRequest` permission
- Chuyển `<all_urls>` sang `host_permissions`

## 2. Background Script → Service Worker

### Thay đổi trong background.ts:
- Loại bỏ `webRequest.onHeadersReceived` (blocking)
- Thay thế bằng `declarativeNetRequest` rules
- Cập nhật `webRequest.onBeforeRequest` → `webNavigation.onCompleted`
- Thay thế `chrome.tabs.executeScript` → `chrome.scripting.executeScript`
- Cải thiện error handling với `chrome.runtime.lastError`

## 3. Declarative Net Request

### File rules.json mới:
- Tự động loại bỏ `content-security-policy` headers
- Tự động loại bỏ `x-frame-options` headers
- Áp dụng cho tất cả main_frame và sub_frame

## 4. Content Script Updates

### Thay đổi trong controller.ts:
- Thêm TypeScript types cho parameters
- Cải thiện error handling
- Thêm null checks cho DOM elements

## 5. Build Configuration

### Webpack updates:
- Thêm copy rules.json vào cả dev và production builds
- Cập nhật cả webpack.config.js và webpack.config.prod.js

## 6. Tương thích ngược

### Chức năng được bảo toàn:
✅ Inject scripts động vào trang web
✅ Lưu sheetID và profile vào localStorage
✅ Quản lý Zalo tabs (đóng tab trùng lặp)
✅ Giao tiếp giữa content script và background
✅ Tự xóa extension functionality
✅ Chrome ID management

### Cải tiến:
✅ Hiệu suất tốt hơn với service worker
✅ Bảo mật tăng cường với CSP mới
✅ Declarative rules thay vì blocking requests
✅ Better error handling

## 7. Testing

Extension đã được test build thành công:
- Development build: ✅ Passed
- Production build: ✅ Passed  
- Package creation: ✅ Passed

## 8. Deployment

File `vetgo-extension-build.zip` đã sẵn sàng để upload lên Chrome Web Store.

## 9. Giải pháp CSP Script Injection

### Vấn đề:
Extension gặp lỗi CSP khi inject inline script:
```
Refused to execute inline script because it violates the following Content Security Policy directive
```

### Giải pháp đa tầng:
1. **ScriptInjector Class**: Tạo class với 4 phương pháp injection
   - **Blob URL**: Tạo blob object và inject qua src
   - **Data URL**: Sử dụng base64 data URL
   - **Background Injection**: Sử dụng chrome.scripting với world: 'MAIN'
   - **PostMessage Bridge**: Tạo bridge script để giao tiếp

2. **Fallback Chain**: Thử từng phương pháp cho đến khi thành công

3. **Async Handling**: Chuyển sang async/await pattern

### Files mới:
- `chrome/src/script-injector.ts`: Class xử lý injection với DOM safety
- Cập nhật `controller.ts` để sử dụng ScriptInjector và DOM ready detection
- `chrome/test-injection.html`: Test page để verify script injection

### Fixes cho DOM Issues:
- **getHeadElement()**: Safe method để get head element với fallbacks
- **waitForDOM()**: Promise-based DOM ready detection
- **Error handling**: Comprehensive error handling cho tất cả injection methods
- **Async/await**: Proper async handling để tránh race conditions

## 10. Lưu ý quan trọng

1. **Service Worker Limitations**: Service workers có lifecycle khác background pages, có thể bị terminate sau một thời gian không hoạt động.

2. **Declarative Net Request**: Không thể modify requests dynamically như webRequest, chỉ có thể sử dụng static rules.

3. **CSP Restrictions**: Một số website có CSP rất nghiêm ngặt, cần multiple fallback methods.

4. **Chrome Store Review**: Manifest V3 extensions có thể cần review kỹ hơn từ Chrome Web Store.

## 11. Khuyến nghị

- Test kỹ trên nhiều website khác nhau, đặc biệt các site có CSP nghiêm ngặt
- Monitor console logs để đảm bảo script injection thành công
- Kiểm tra performance impact của multiple injection methods
- Chuẩn bị rollback plan nếu cần thiết
- Test trên các browser khác nhau (Chrome, Edge, etc.)
