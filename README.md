# VG Coder CLI

🚀 **Powerful CLI tool & API Server** để phân tích dự án, nối file mã nguồn, đếm token, xuất HTML và thực thi bash scripts qua REST API.

## ✨ Tính năng

### 📊 Code Analysis & Export
- 🔍 **Phát hiện loại dự án**: Tự động nhận diện Angular, Spring Boot, React, Vue, Node.js, Python, Java, .NET
- 📁 **Xử lý `.gitignore`**: Tuân thủ chuẩn Git với multi-level ignore rules
- 🛡️ **Hỗ trợ `.vgignore`**: Có độ ưu tiên cao hơn `.gitignore`, với cú pháp giống hệt
- 📜 **Bỏ qua file mặc định**: Tự động bỏ qua `node_modules`, `dist`, `.git`, `build`, `target`
- 📄 **Scan và nối file**: Quét toàn bộ dự án và nối các file mã nguồn
- 🧮 **Đếm token**: Sử dụng `tiktoken` để đếm token chính xác cho AI models
- ✂️ **Chia nhỏ nội dung**: Chia nội dung thông minh thành chunks nhỏ hơn
- 🌐 **Xuất HTML**: Tạo báo cáo HTML tương tác với syntax highlighting
- 📋 **Sao chép vào Clipboard**: Chế độ `-c` sao chép toàn bộ code vào clipboard
- 🤖 **Tối ưu cho AI**: Xuất file `combined.txt` với định dạng thân thiện cho AI

### 🚀 API Server (NEW!)
- 🌐 **REST API Server**: Khởi động server với `vg start`
- 🎨 **Beautiful Dashboard**: Tự động mở web UI để test API
- 📡 **5 API Endpoints**:
  - `GET /health` - Health check
  - `POST /api/analyze` - Phân tích dự án, download project.txt
  - `GET /api/info` - Lấy thông tin dự án (JSON)
  - `POST /api/execute` - **Thực thi bash scripts** với validation
  - `DELETE /api/clean` - Xóa output directory
- ⚡ **Real-time Status**: Dashboard hiển thị server status live
- 🔒 **Syntax Validation**: Validate bash syntax trước khi execute
- 🧹 **Auto Cleanup**: Tự động dọn dẹp temp files

## 📦 Cài đặt

### Từ NPM (Recommended)
```bash
# Global install
npm install -g vg-coder-cli

# Local install
npm install vg-coder-cli
```

### Từ Source
```bash
git clone https://github.com/tinhthanh/vg-coder-cli.git
cd vg-coder-cli
npm install
```

## 🚀 Sử dụng

### CLI Commands

#### 1. Phân tích dự án
```bash
# Phân tích và xuất HTML
vg analyze
vg a                    # Alias rút gọn

# Với options
vg analyze /path/to/project --max-tokens 8192 --output ./my-output

# Copy vào clipboard (không tạo file)
vg analyze -c
vg analyze --clipboard
```

#### 2. Xem thông tin dự án
```bash
vg info
vg info /path/to/project
```

#### 3. Xóa output
```bash
vg clean
vg clean --output ./my-output
```

#### 4. **Khởi động API Server** 🆕
```bash
# Start server (mặc định port 6868)
vg start
vg s                    # Alias rút gọn

# Custom port
vg start -p 8080

# Browser tự động mở dashboard tại http://localhost:6868
```

### API Endpoints

#### Health Check
```bash
GET http://localhost:6868/health
```

**Response:**
```json
{
  "status": "ok",
  "version": "1.0.10",
  "timestamp": "2025-11-24T15:00:00.000Z"
}
```

#### Analyze Project
```bash
POST http://localhost:6868/api/analyze
Content-Type: application/json

{
  "path": ".",
  "options": {
    "maxTokens": 8000
  }
}
```

**Response:** Downloads `project.txt` file

#### Get Project Info
```bash
GET http://localhost:6868/api/info?path=.
```

**Response:**
```json
{
  "path": "/path/to/project",
  "primaryType": "nodejs",
  "stats": {
    "totalFiles": 42,
    "totalSize": 123456,
    "totalLines": 5000
  },
  "tokens": {
    "total": 15000,
    "averagePerFile": 357
  }
}
```

#### Execute Bash Script 🆕
```bash
POST http://localhost:6868/api/execute
Content-Type: application/json

{
  "bash": "mkdir -p $(dirname \"src/test.js\")\ncat <<'EOF' > src/test.js\nconsole.log('Hello');\nEOF"
}
```

**Response:**
```json
{
  "success": true,
  "stdout": "",
  "stderr": "",
  "exitCode": 0,
  "executionTime": 15
}
```

**Features:**
- ✅ Syntax validation trong `.vg/temp-execute`
- ✅ Execute tại working directory
- ✅ Auto cleanup temp files
- ✅ Return stdout/stderr/exitCode

#### Clean Output
```bash
DELETE http://localhost:6868/api/clean
Content-Type: application/json

{
  "output": "./vg-output"
}
```

## ⚙️ Options

### CLI Options

| Option | Mô tả | Default |
|--------|-------|---------|
| `-o, --output <path>` | Thư mục output | ./vg-output |
| `-m, --max-tokens <number>` | Số token tối đa mỗi chunk | 8000 |
| `-t, --model <model>` | Model AI để đếm token | gpt-4 |
| `--extensions <list>` | Extensions (comma-separated) | Auto-detect |
| `--include-hidden` | Bao gồm file ẩn | false |
| `--no-structure` | Không giữ cấu trúc file | false |
| `--theme <theme>` | Theme cho syntax highlighting | github |
| `-c, --clipboard` | Copy vào clipboard | false |
| `--save-txt` | Lưu vào vg-projects.txt | false |

### Server Options

| Option | Mô tả | Default |
|--------|-------|---------|
| `-p, --port <port>` | Port cho server | 6868 |

## 🎨 Dashboard UI

Khi chạy `vg start`, browser tự động mở dashboard với:

- 🎯 **Interactive Forms** cho tất cả endpoints
- 🎨 **Beautiful Gradient UI** (purple to violet)
- 📊 **Real-time Server Status** (green/red indicator)
- 💻 **Syntax Highlighting** cho responses
- ⚡ **Loading States** cho async operations
- 📥 **Auto Download** cho analyze endpoint

## 🤖 Tích hợp AI

### System Prompt cho AI

Xem file [SYSTEM_PROMPT.md](SYSTEM_PROMPT.md) để biết cách tích hợp với AI.

**Command Prefixes:**
- `/ask` - Q&A mode (Markdown response)
- `/plan` - Planning mode (Checklist + bash)
- `/fix` - Bug fix mode (Analysis + solution)
- `/code` - Code generation (Bash script only)

### Bash Script Format

Khi AI generate code với `/code`, format chuẩn:

```bash
mkdir -p $(dirname "path/to/file.ext")
cat <<'EOF' > path/to/file.ext
... file content ...
EOF
```

**Quy tắc:**
- ✅ Luôn có `mkdir -p $(dirname "...")` trước mỗi file
- ✅ Sử dụng `<<'EOF'` (có quotes) để tránh expansion
- ✅ Chỉ include files có thay đổi
- ✅ Ghi đè hoàn toàn file content

## 📁 Cấu trúc Output

```
vg-output/
├── index.html          # Trang chính với navigation
├── combined.html       # Tất cả code, có search
├── combined.txt        # Text format, tối ưu cho AI
├── chunks/             # Chunks riêng biệt
│   ├── chunk-1.html
│   └── ...
└── assets/             # CSS, JS
```

## 🎯 Dự án được hỗ trợ

- **Frontend**: Angular, React, Vue.js, Svelte
- **Backend**: Node.js, Spring Boot, Python, .NET
- **Mobile**: React Native, Flutter
- **Languages**: JavaScript, TypeScript, Java, Python, C#, Go, Rust
- **Config**: JSON, YAML, XML, TOML

## 🛡️ Quy tắc bỏ qua file

Thứ tự ưu tiên:
1. **`.vgignore`** - Cao nhất
2. **`.gitignore`** - Trung bình
3. **Default rules** - Thấp nhất (node_modules, .git, dist, build, target)

## 📝 Examples

### Example 1: Analyze và Copy
```bash
# Analyze project và copy vào clipboard
vg a . -c

# Paste vào AI tool (Claude, ChatGPT, etc.)
```

### Example 2: API Server Workflow
```bash
# 1. Start server
vg start

# 2. Browser mở dashboard tự động
# 3. Test endpoints trực tiếp trên UI
# 4. Hoặc dùng Postman/curl

# 5. Execute bash script từ AI
curl -X POST http://localhost:6868/api/execute \
  -H "Content-Type: application/json" \
  -d '{"bash": "mkdir -p src && echo \"test\" > src/file.js"}'
```

### Example 3: AI Integration
```bash
# 1. Analyze project
vg a . -c

# 2. Paste vào AI với prompt:
# "/code Thêm authentication vào project này"

# 3. AI trả về bash script
# 4. Copy bash script

# 5. Execute qua API
curl -X POST http://localhost:6868/api/execute \
  -H "Content-Type: application/json" \
  -d '{"bash": "..."}'
```

## 🔧 Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run in dev mode
npm run dev

# Build and publish
npm run push
```

## 🤝 Đóng góp

1. Fork repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Create Pull Request

## 📄 License

MIT License - xem file [LICENSE](LICENSE) để biết thêm chi tiết.

## 🔗 Links

- **GitHub**: https://github.com/tinhthanh/vg-coder-cli
- **NPM**: https://www.npmjs.com/package/vg-coder-cli
- **Issues**: https://github.com/tinhthanh/vg-coder-cli/issues

## 📊 Version History

### v1.0.10 (Latest)
- ✨ Added API Server with REST endpoints
- 🎨 Beautiful dashboard UI with auto-open browser
- ⚡ Bash script execution with validation
- 🔧 Shortened commands: `vg`, `a`, `-c`, `s`
- 📝 System prompt documentation

### v1.0.9
- 🚀 Initial release
- 📊 Code analysis and token counting
- 🌐 HTML export with syntax highlighting
- 📋 Clipboard integration

Repo extension: 
https://github.com/tinhthanh/vetgo-auto
vg-coder.zip
📁 Directory Structure:
vg-coder/
├── assets
│   ├── icon128.png (.png)
│   ├── icon16.png (.png)
│   └── icon48.png (.png)
├── background.js (.js)
├── background.js.LICENSE.txt (.txt)
├── controller.js (.js)
├── manifest.json (.json)
├── options.css (.css)
├── options.html (.html)
├── options.js (.js)
└── rules.json (.json)

