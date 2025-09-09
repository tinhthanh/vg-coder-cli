# VG Coder CLI

🚀 **CLI tool để phân tích dự án, nối file mã nguồn, đếm token và xuất HTML** với syntax highlighting và copy functionality.

## ✨ Tính năng

- 🔍 **Phát hiện loại dự án**: Tự động nhận diện Angular, Spring Boot, React, Vue, Node.js, Python, Java, .NET
- 📁 **Xử lý .gitignore**: Tuân thủ chuẩn Git với multi-level ignore rules
- 📄 **Scan và nối file**: Quét toàn bộ dự án và nối file mã nguồn
- 🧮 **Đếm token**: Sử dụng tiktoken để đếm token chính xác cho AI models
- ✂️ **Chia nhỏ nội dung**: Smart chunking với preserve structure
- 🌐 **Xuất HTML**: Tạo HTML với syntax highlighting và copy buttons
- 🎨 **Syntax Highlighting**: Hỗ trợ nhiều ngôn ngữ lập trình
- 📋 **Copy to Clipboard**: Dễ dàng copy code với một click

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

### Phân tích dự án
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
node src/index.js clean

# Xóa output tùy chỉnh
node src/index.js clean --output ./my-output
```

## ⚙️ Options

| Option | Mô tả | Default |
|--------|-------|---------|
| `--max-tokens <number>` | Số token tối đa mỗi chunk | 8000 |
| `--model <model>` | Model AI để đếm token | gpt-4 |
| `--output <path>` | Thư mục output | ./vg-output |
| `--extensions <list>` | Danh sách extensions (comma-separated) | Auto-detect |
| `--include-hidden` | Bao gồm file ẩn | false |
| `--no-structure` | Không ưu tiên giữ cấu trúc file | false |
| `--theme <theme>` | Theme cho syntax highlighting | github |

## 📋 Ví dụ chi tiết

### Phân tích dự án Angular
```bash
node src/index.js analyze ./my-angular-app --max-tokens 6000 --theme monokai
```

### Phân tích với extensions tùy chỉnh
```bash
node src/index.js analyze ./my-project --extensions "js,ts,vue,css" --include-hidden
```

### Xem thông tin chi tiết
```bash
node src/index.js info ./my-project
# Output:
# 📁 Project Information:
# Path: /path/to/my-project
# Primary Type: nodejs
#
# Detected Technologies:
#   nodejs: high confidence
#
# 📊 File Statistics:
# Total Files: 25
# Total Size: 156.7 KB
# Total Lines: 4,523
# Extensions: js, ts, json, md
```

## 🧪 Testing

```bash
# Chạy tất cả tests
npm test

# Chạy tests với coverage
npm run test:coverage

# Chạy specific test
npm test -- --testNamePattern="project detection"
```

## 📁 Cấu trúc Output

```
vg-output/
├── index.html          # Trang chính với navigation
├── combined.html       # Tất cả code trong một file
├── chunks/             # Các chunk riêng biệt
│   ├── chunk-1.html
│   ├── chunk-2.html
│   └── ...
└── assets/             # CSS, JS, themes
    ├── styles.css
    ├── scripts.js
    └── highlight.css
```

## 🎯 Các loại dự án được hỗ trợ

- **Frontend**: Angular, React, Vue.js, Svelte
- **Backend**: Node.js, Spring Boot, Python, .NET
- **Mobile**: React Native, Flutter
- **Languages**: JavaScript, TypeScript, Java, Python, C#, Go, Rust
- **Config**: JSON, YAML, XML, TOML

## 🔧 Tùy chỉnh

### Extensions mặc định
Tool tự động detect extensions phù hợp với loại dự án:
- **Web**: .js, .jsx, .ts, .tsx, .vue, .html, .css, .scss
- **Backend**: .java, .py, .cs, .go, .rs, .php
- **Config**: .json, .yaml, .xml, .toml, .env

### Themes có sẵn
- github (default)
- monokai
- atom-one-dark
- vs2015
- rainbow

## 🤝 Đóng góp

1. Fork repository
2. Tạo feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Tạo Pull Request

## 📄 License

MIT License - xem file [LICENSE](LICENSE) để biết thêm chi tiết.
