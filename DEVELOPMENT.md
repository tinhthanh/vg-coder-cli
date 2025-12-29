# VG Coder - Development & Architecture Guide

Tài liệu này quy định kiến trúc Frontend (Dashboard) để đảm bảo tính dễ bảo trì, mở rộng và code sạch (Clean Code).

## 1. Directory Structure (Cấu trúc thư mục)

Frontend nằm trong `src/server/views/`.

```text
src/server/views/
├── dashboard.html          # File HTML chính (Layout & Markup)
├── dashboard.css           # CSS Global (Variables, Reset, Layout khung sườn)
├── css/                    # 📁 MODULE CSS (Chứa style riêng biệt cho từng feature)
│   ├── structure.css       # Style cho cây thư mục
│   ├── iframe.css          # Style cho Iframe/AI Panel
│   └── [feature].css       # -> Style cho tính năng mới đặt tại đây
├── js/                     # 📁 JAVASCRIPT
│   ├── main.js             # Entry Point (Khởi tạo, Import các feature)
│   ├── config.js           # Constants & Config
│   ├── api.js              # API Layer (Fetch requests)
│   ├── utils.js            # Helper functions
│   ├── handlers.js         # Global event handlers (để bind vào window)
│   └── features/           # 📁 MODULE JS (Logic riêng biệt cho từng feature)
│       ├── structure.js    # Logic cây thư mục
│       ├── iframe-manager.js # Logic Iframe AI
│       └── [feature].js    # -> Logic tính năng mới đặt tại đây
```

---

## 2. Quy trình thêm tính năng mới (Workflow)

Khi thêm một tính năng mới (ví dụ: `Settings`), tuân thủ 4 bước sau:

### Bước 1: Tạo CSS Module
Tạo file `src/server/views/css/settings.css`.
*   **Quy tắc:** Chỉ viết style liên quan đến settings.
*   **Import:** Thêm thẻ `<link>` vào `dashboard.html`.

### Bước 2: Tạo JS Module
Tạo file `src/server/views/js/features/settings.js`.
*   **Quy tắc:** Export hàm khởi tạo (`initSettings`) hoặc các hàm xử lý logic.
*   **Không** viết code chạy ngay lập tức (IIFE) trừ khi cần thiết.

```javascript
// Example: src/server/views/js/features/settings.js
export function initSettings() {
    console.log('Settings initialized');
    // Logic here
}
```

### Bước 3: Cập nhật HTML
Thêm Markup vào `src/server/views/dashboard.html`.
*   Thêm ID cụ thể để JS dễ query (ví dụ: `id="settings-panel"`).
*   Thêm link CSS mới vào `<head>`.

### Bước 4: Đăng ký (Register) trong `main.js`
Import và gọi hàm khởi tạo trong `src/server/views/js/main.js`.

```javascript
// src/server/views/js/main.js
import { initSettings } from './features/settings.js';

document.addEventListener('DOMContentLoaded', async () => {
    // ... các init khác
    initSettings();
});
```

---

## 3. Coding Standards (Quy chuẩn Code)

### CSS
*   Sử dụng **CSS Variables** (`var(--ios-bg)`) định nghĩa trong `dashboard.css` để đồng bộ Dark/Light mode.
*   Tránh sửa trực tiếp `dashboard.css` trừ khi thay đổi Layout toàn cục.

### JavaScript
*   **ES Modules:** Sử dụng `import/export`.
*   **Global Scope:** Hạn chế gán biến vào `window`. Nếu cần dùng cho `onclick=""` trong HTML, hãy gán thông qua file `handlers.js` hoặc gán explicit trong `main.js`.
*   **API Calls:** Mọi lệnh `fetch` gọi về server nên được viết trong `js/api.js`, sau đó feature import về dùng.

---

## 4. Prompt mẫu cho AI

Khi yêu cầu AI code tính năng mới, hãy dùng prompt sau để đảm bảo AI tuân thủ kiến trúc:

> "Hãy thêm tính năng [TÊN_TÍNH_NĂNG].
> Tuân thủ kiến trúc trong `DEVELOPMENT.md`:
> 1. Tạo file CSS riêng trong `views/css/`.
> 2. Tạo file JS logic riêng trong `views/js/features/`.
> 3. Cập nhật `dashboard.html` và `main.js`.
> 4. Sử dụng style từ biến CSS có sẵn."

# VG Coder - Coding Standards & Rules

Tài liệu này quy định các tiêu chuẩn viết code để đảm bảo ứng dụng không xung đột với trang web gốc (Host Page) và dễ dàng mở rộng.

---

## 1. Quy tắc đặt tên (Naming Conventions)

### A. CSS Class & ID Prefix
Tất cả các Class và ID trong HTML/CSS **BẮT BUỘC** phải có tiền tố `vg-`.
*   **Sai:** `<div class="container">`, `<button id="submit">`
*   **Đúng:** `<div class="vg-container">`, `<button id="vg-submit">`

### B. BEM Methodology (Khuyến khích)
Sử dụng chuẩn BEM kết hợp với prefix để quản lý style dễ dàng hơn:
`vg-[block]__[element]--[modifier]`
*   Ví dụ: `vg-terminal__input--active`

---

## 2. Quy tắc Styling (CSS)

### A. Tuyệt đối không dùng Tag Selector toàn cục
Không bao giờ viết style trực tiếp vào các thẻ HTML cơ bản mà không có class, vì nó có thể ảnh hưởng đến các thành phần khác trong Shadow DOM.
*   **Sai:** `div { padding: 10px; }`, `button { background: blue; }`
*   **Đúng:** `.vg-main-wrapper div { ... }`, `button.vg-btn { ... }`

### B. Sử dụng CSS Variables
Luôn sử dụng biến CSS được định nghĩa trong `dashboard.css` để hỗ trợ Dark/Light mode tự động.
*   Ví dụ: `background-color: var(--ios-bg); color: var(--text-primary);`

---

## 3. Quy tắc Thao tác DOM (JavaScript)

### A. Không sử dụng `document` trực tiếp
Vì App chạy trong Shadow DOM, các hàm `document.getElementById` hoặc `document.querySelector` sẽ trả về `null`.
*   **BẮT BUỘC:** Sử dụng các helper từ `utils.js`:
    *   `getById('name')` thay cho `document.getElementById('vg-name')` (Helper tự thêm prefix `vg-` nếu cần hoặc bạn tự viết kèm prefix).
    *   `qs('.vg-class')` thay cho `document.querySelector`.

### B. Event Listeners
Khi gắn sự kiện vào các phần tử được sinh ra động (như danh sách file), hãy sử dụng **Event Delegation** hoặc gắn sự kiện ngay khi tạo element để tránh "leak" event.

---

## 4. Quy tắc Cấu trúc Tính năng (Features)

Mỗi tính năng mới phải được đóng gói vào 3 phần:
1.  **UI:** `dashboard.html` (Bọc trong một div có ID `vg-featurename`).
2.  **Style:** `css/featurename.css` (Tất cả selector bắt đầu bằng `.vg-featurename`).
3.  **Logic:** `js/features/featurename.js` (Export một hàm `initFeatureName`).

---

## 5. Quy tắc API & Network

### A. API Base URL
Luôn import `API_BASE` từ `config.js`. Không bao giờ viết cứng `http://localhost:6868`.
```javascript
import { API_BASE } from '../config.js';
fetch(`${API_BASE}/api/my-endpoint`);
