# VG Coder CLI

🚀 **CLI tool để phân tích dự án, nối file mã nguồn, đếm token và xuất HTML** với syntax highlighting và copy functionality.

## ✨ Tính năng

- 🔍 **Phát hiện loại dự án**: Tự động nhận diện Angular, Spring Boot, React, Vue, Node.js, Python, Java, .NET.
- 📁 **Xử lý `.gitignore`**: Tuân thủ chuẩn Git với multi-level ignore rules.
- 🛡️ **Hỗ trợ `.vgignore`**: Có độ ưu tiên cao hơn `.gitignore`, với cú pháp giống hệt.
- 📜 **Bỏ qua file mặc định**: Tự động bỏ qua các thư mục phổ biến như `node_modules`, `dist`, `.git`, `build`, `target` và các file cấu hình IDE.
- 📄 **Scan và nối file**: Quét toàn bộ dự án và nối các file mã nguồn lại với nhau.
- 🧮 **Đếm token**: Sử dụng `tiktoken` để đếm token chính xác cho các mô hình AI.
- ✂️ **Chia nhỏ nội dung**: Chia nội dung thông minh thành các chunk nhỏ hơn mà vẫn giữ cấu trúc file.
- 🌐 **Xuất HTML**: Tạo báo cáo HTML tương tác với syntax highlighting và các nút bấm sao chép.
- 📋 **Sao chép vào Clipboard**: Chế độ `--clipboard-only` giúp sao chép toàn bộ mã nguồn đã xử lý vào clipboard, không cần tạo file.
- 🤖 **Tối ưu cho AI**: Xuất file `combined.txt` với định dạng thân thiện cho các mô hình AI và cung cấp mẫu script để hướng dẫn AI.
- 🌳 **Cây thư mục**: Hiển thị và cho phép sao chép cấu trúc cây thư mục của dự án trong giao diện HTML.
- 🔍 **Tìm kiếm tích hợp**: Giao diện HTML đi kèm chức năng tìm kiếm nội dung trực tiếp trong code.

## 📦 Cài đặt

### Cài đặt từ NPM (Recommended)
```bash
# Cài đặt global
npm install -g vg-coder-cli

# Hoặc cài đặt local
npm install vg-coder-cli
```

### Cài đặt từ source
```bash
# Clone repository
git clone <repository-url>
cd vg-coder-cli

# Cài đặt dependencies
npm install

# Cấp quyền thực thi (nếu cần)
chmod +x bin/vg-coder.js
```

## 🚀 Sử dụng

### Phân tích dự án và xuất HTML
```bash
# Nếu cài global
vg-coder analyze

# Nếu cài local
npx vg-coder analyze

# Phân tích dự án khác
vg-coder analyze /path/to/project

# Với options tùy chỉnh
vg-coder analyze /path/to/project --max-tokens 8192 --output ./my-output --theme monokai
```

### Sao chép nhanh vào Clipboard (Không tạo file)
Chế độ này rất hữu ích để nhanh chóng đưa toàn bộ ngữ cảnh dự án vào các công cụ AI.
```bash
# Phân tích và sao chép toàn bộ code vào clipboard
vg-coder analyze --clipboard-only

# Hoặc dùng alias ngắn gọn
vg-coder analyze --clipboard
```

### Xem thông tin dự án
```bash
# Thông tin dự án hiện tại
vg-coder info

# Thông tin dự án khác
vg-coder info /path/to/project
```

### Xóa output
```bash
# Xóa output mặc định
vg-coder clean

# Xóa output tùy chỉnh
vg-coder clean --output ./my-output
```

## 📜 Trợ giúp (Help)

Bạn có thể xem tất cả các lệnh và tùy chọn có sẵn bằng cách sử dụng cờ `--help` hoặc `-h`.

### Trợ giúp chung
Để xem danh sách các lệnh chính:
```bash
vg-coder --help
```

**Output (ví dụ):**
```
Usage: vg-coder [command] [options]

CLI tool để phân tích dự án, nối file mã nguồn, đếm token và xuất HTML

Options:
  -V, --version      output the version number
  -h, --help         display help for command

Commands:
  analyze [path]     Phân tích dự án và tạo output HTML
  info [path]        Hiển thị thông tin về dự án
  clean              Xóa thư mục output
  help [command]     display help for command
```

### Trợ giúp cho lệnh cụ thể
Để xem chi tiết các tùy chọn cho một lệnh cụ thể (ví dụ: `analyze`):
```bash
vg-coder analyze --help
```

## ⚙️ Options

| Option | Mô tả | Default |
|--------|-------|---------|
| `--max-tokens <number>` | Số token tối đa mỗi chunk | 8000 |
| `--model <model>` | Model AI để đếm token | gpt-4 |
| `--output <path>` | Thư mục output | ./vg-output |
| `--extensions <list>` | Danh sách extensions (comma-separated) | Tự động phát hiện |
| `--include-hidden` | Bao gồm file ẩn (bị bỏ qua mặc định) | false |
| `--no-structure` | Không ưu tiên giữ cấu trúc file khi chia chunk | false |
| `--theme <theme>` | Theme cho syntax highlighting | github |
| `--clipboard-only` | Sao chép nội dung vào clipboard thay vì tạo file output. | false |
| `--clipboard` | Alias cho `--clipboard-only` | false |


## 🤖 Tối ưu cho AI (AI Optimization)

### File `combined.txt`
Công cụ tạo ra file `combined.txt` được định dạng đặc biệt để dễ dàng đưa vào các mô hình ngôn ngữ lớn. Mỗi file được phân tách rõ ràng bằng một header duy nhất, giúp AI nhận biết và xử lý chính xác từng file.

**Ví dụ định dạng:**
```
// ===== FILE: src/index.js =====
... nội dung file index.js ...

// ===== FILE: src/utils.js =====
... nội dung file utils.js ...
```

### Mẫu Script Hướng Dẫn AI
Trang `combined.html` có sẵn một mẫu hướng dẫn (prompt template) để yêu cầu AI trả về các thay đổi dưới dạng script shell. Điều này giúp tự động hóa việc áp dụng các thay đổi do AI đề xuất một cách an toàn và có thể kiểm soát.

## 📁 Cấu trúc Output

```
vg-output/
├── index.html          # Trang chính với navigation và cây thư mục
├── combined.html       # Tất cả code trong một file HTML, có chức năng tìm kiếm
├── combined.txt        # Tất cả code trong một file text, tối ưu cho AI
├── chunks/             # Các chunk riêng biệt (nếu nội dung lớn)
│   ├── chunk-1.html
│   └── ...
└── assets/             # CSS, JS cho trang HTML
```

## 🎯 Các loại dự án được hỗ trợ

- **Frontend**: Angular, React, Vue.js, Svelte
- **Backend**: Node.js, Spring Boot, Python, .NET
- **Mobile**: React Native, Flutter
- **Languages**: JavaScript, TypeScript, Java, Python, C#, Go, Rust
- **Config**: JSON, YAML, XML, TOML

## 🛡️ Quy tắc bỏ qua file (Ignoring Files)

Công cụ tuân thủ các quy tắc bỏ qua file theo thứ tự ưu tiên sau:
1.  **`.vgignore`**: Các quy tắc trong file này có độ ưu tiên cao nhất.
2.  **`.gitignore`**: Các quy tắc trong file `.gitignore` sẽ được áp dụng.
3.  **Quy tắc mặc định**: Nếu không có các file trên, công cụ sẽ tự động bỏ qua các thư mục và file phổ biến như `node_modules`, `.git`, `dist`, `build`, `target`, các file log, và các thư mục cấu hình của IDE (`.vscode`, `.idea`).

## 🤝 Đóng góp

1.  Fork repository
2.  Tạo feature branch (`git checkout -b feature/amazing-feature`)
3.  Commit changes (`git commit -m 'Add amazing feature'`)
4.  Push to branch (`git push origin feature/amazing-feature`)
5.  Tạo Pull Request

## 📄 License

MIT License - xem file [LICENSE](LICENSE) để biết thêm chi tiết.
