# Firebase Script Deployment

## Cấu trúc thư mục

```
scripts/
├── aistudio.google.com/        # Domain folder
│   ├── auto-btn-bash.js        # Script file 1
│   └── main.js                 # Script file 2
└── [domain-name]/              # Thêm domain mới tại đây
    └── *.js                    # Các file JavaScript
```

## Cách hoạt động

Script `deploy-scripts.js` sẽ:

1. **Quét tất cả thư mục con** trong `scripts/`
2. **Với mỗi domain** (tên thư mục):
   - Đọc tất cả file `.js` trong thư mục
   - Nối tất cả nội dung file thành một chuỗi code
   - Tạo payload JSON với cấu trúc cố định
   - Gửi HTTP PUT request lên Firebase Realtime Database

## Cấu trúc JSON payload

```json
{
  "deleted": false,
  "domain": {
    "[uuid]": {
      "actionType": "MAIN",
      "deleted": false,
      "domain": "aistudio.google.com",
      "id": "[uuid]",
      "seqNo": 1767456102884
    }
  },
  "id": "VGCODER",
  "script": {
    "[uuid]": {
      "actionType": "MAIN",
      "code": "[concatenated JS code]",    // ← Phần này thay đổi
      "deleted": false,
      "domain": "aistudio.google.com",
      "id": "[uuid]",
      "seqNo": 1767456102884
    }
  },
  "seqNo": 1767456102884,
  "sync": true
}
```

## Sử dụng

### Deploy tất cả scripts

```bash
cd vetgo-auto
npm run deploy-scripts
```

### Thêm domain mới

1. Tạo thư mục mới trong `scripts/`:
   ```bash
   mkdir scripts/example.com
   ```

2. Thêm file JavaScript:
   ```bash
   echo "console.log('Hello');" > scripts/example.com/script.js
   ```

3. Deploy:
   ```bash
   npm run deploy-scripts
   ```

## Firebase Configuration

Script tự động đọc cấu hình Firebase từ:
```
chrome/environments/environment.ts
```

Đảm bảo file này có `databaseURL` hợp lệ:
```typescript
export const environment = {
  firebaseConfig: {
    databaseURL: "https://vetgo-chrome-default-rtdb.asia-southeast1.firebasedatabase.app"
  }
};
```

## Output mẫu

```
🔥 Firebase Script Deployment Tool
=====================================

📂 Found 1 domain(s): aistudio.google.com

📦 Processing domain: aistudio.google.com
──────────────────────────────────────────────────
📄 Found 2 JavaScript files: auto-btn-bash.js, main.js
  ✓ Read auto-btn-bash.js (2907 bytes)
  ✓ Read main.js (14236 bytes)

📋 Created payload for aistudio.google.com
   Code length: 17145 characters
   Domains: 1
   Scripts: 1

🚀 Pushing to Firebase...
   URL: https://vetgo-chrome-default-rtdb.asia-southeast1.firebasedatabase.app/VGCODER.json
   Status: 200

✨ aistudio.google.com deployment completed successfully!

🎉 All scripts deployed successfully!
```

## Lưu ý

- Tất cả file `.js` trong cùng một domain folder sẽ được nối lại với nhau
- Thứ tự file được sắp xếp theo alphabet
- Mỗi lần deploy sẽ tạo UUID mới cho domain và script
- Timestamp (`seqNo`) được tự động cập nhật
