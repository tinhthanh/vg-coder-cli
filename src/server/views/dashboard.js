const API_BASE = window.location.origin;
let lastAnalyzeResult = null;

// System Prompt
const SYSTEM_PROMPT = `# VG Coder AI System Prompt

## Command Prefixes

### /ask - Question & Answer Mode
Khi người dùng hỏi với prefix /ask, họ đang muốn tìm hiểu hoặc được giải thích về một vấn đề.

**Response Format:** Markdown
- Trả lời chi tiết, rõ ràng
- Sử dụng code blocks, lists, tables khi cần
- Cung cấp ví dụ minh họa

---

### /plan - Planning Mode
Khi người dùng muốn lên kế hoạch với prefix /plan, tạo một implementation plan chi tiết.

**Response Format:** Markdown checklist với bash commands
- Chia nhỏ thành các bước cụ thể
- Mỗi bước có bash command tương ứng
- Sắp xếp theo thứ tự logic

---

### /fix - Bug Fix Mode
Khi người dùng cần fix bug với prefix /fix, phân tích lỗi và đưa ra giải pháp.

**Response Format:** Markdown + Bash script
1. **Phân tích lỗi:** Giải thích nguyên nhân
2. **Giải pháp:** Mô tả cách fix
3. **Bash script:** Code để fix (nếu cần)

---

### /code - Code Generation Mode
Khi người dùng hỏi với prefix /code, trả về **BASH SCRIPT DUY NHẤT** để tạo/cập nhật files.

## ⚠️ QUY TẮC BẮT BUỘC

### 1. Chỉ bao gồm files có thay đổi
- ❌ **KHÔNG** bao gồm files không có sự thay đổi nội dung
- ✅ Nếu nội dung file sau chỉnh sửa giống 100% bản cũ → **BỎ QUA**

### 2. Format Script Chuẩn

**Mỗi file PHẢI theo cú pháp:**
\\\`\\\`\\\`bash
mkdir -p $(dirname "path/to/file.ext")
cat <<'EOF' > path/to/file.ext
... toàn bộ nội dung file sau khi chỉnh sửa ...
EOF
\\\`\\\`\\\`

### 3. Chi tiết quan trọng
- ✅ **LUÔN** có \\\`mkdir -p $(dirname "...")\\\` trước mỗi file
- ✅ Sử dụng \\\`<<'EOF'\\\` (có dấu nháy đơn) để tránh bash expansion
- ✅ Ghi đè hoàn toàn file bằng nội dung mới
- ✅ Tự động tạo file và thư mục cha nếu chưa tồn tại
- ✅ Đường dẫn giống với file mẫu đính kèm

### 4. Example Output

\\\`\\\`\\\`bash
# Create/Update component file
mkdir -p $(dirname "src/components/Button/index.tsx")
cat <<'EOF' > src/components/Button/index.tsx
import React from 'react';

export const Button = () => {
  return <button>Click me</button>;
};
EOF

# Create/Update styles
mkdir -p $(dirname "src/components/Button/styles.css")
cat <<'EOF' > src/components/Button/styles.css
.button {
  padding: 10px 20px;
  background: blue;
}
EOF
\\\`\\\`\\\`

---

## Integration với VG Coder CLI

Bash scripts được generate sẽ được thực thi qua:
\\\`\\\`\\\`bash
POST http://localhost:6868/api/execute
{
  "bash": "mkdir -p $(dirname \\\\"src/...\\\\")\\\\\\\ncat <<'EOF' > ..."
}
\\\`\\\`\\\`

API sẽ:
1. ✅ Validate bash syntax trong \\\`.vg/temp-execute\\\`
2. ✅ Execute tại working directory nếu syntax OK
3. ✅ Trả về stdout/stderr/exitCode
4. ✅ Auto cleanup temp directory

---

## Best Practices

### DO ✅
- Luôn dùng \\\`mkdir -p $(dirname "...")\\\` trước mỗi file
- Sử dụng \\\`<<'EOF'\\\` để tránh variable expansion
- Ghi đè toàn bộ nội dung file
- Chỉ include files có thay đổi thực sự

### DON'T ❌
- Không tạo file mà không tạo thư mục cha
- Không dùng \\\`<<EOF\\\` (thiếu quotes) nếu có \\\`$\\\` trong content
- Không include files không thay đổi
- Không dùng relative paths phức tạp`;

// Load system prompt on page load
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('prompt-text').textContent = SYSTEM_PROMPT;
    checkServerStatus();
});

function toggleSystemPrompt() {
    const content = document.getElementById('system-prompt-content');
    const icon = document.getElementById('toggle-icon');
    content.classList.toggle('open');
    icon.classList.toggle('open');
}

function copySystemPrompt() {
    const copyBtn = event.target.closest('.btn-copy');
    const copyIcon = document.getElementById('copy-icon');
    const copyText = document.getElementById('copy-text');

    navigator.clipboard.writeText(SYSTEM_PROMPT).then(() => {
        copyBtn.classList.add('copied');
        copyIcon.textContent = '✓';
        copyText.textContent = 'Copied';
        showToast('Đã copy System Prompt', 'success');

        setTimeout(() => {
            copyBtn.classList.remove('copied');
            copyIcon.textContent = '📋';
            copyText.textContent = 'Copy System Prompt';
        }, 2000);
    }).catch(err => {
        showToast('Lỗi copy: ' + err.message, 'error');
    });
}

function showResponse(elementId, data, isError = false) {
    const el = document.getElementById(elementId);
    el.className = 'response show ' + (isError ? 'error' : 'success');
    el.innerHTML = '<pre>' + JSON.stringify(data, null, 2) + '</pre>';
}

function showLoading(button, originalText) {
    button.disabled = true;
    button.innerHTML = '<span class="loading"></span>';
    button.dataset.originalText = originalText;
}

function resetButton(button) {
    button.disabled = false;
    const originalText = button.dataset.originalText;
    button.innerHTML = originalText;
}

async function testAnalyze() {
    const btn = event.target.closest('.btn');
    const path = document.getElementById('analyze-path').value;

    showLoading(btn, btn.innerHTML);
    try {
        const res = await fetch(`${API_BASE}/api/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path })
        });

        if (res.ok) {
            const text = await res.text();
            lastAnalyzeResult = text;

            // Download file
            const blob = new Blob([text], { type: 'text/plain' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'project.txt';
            a.click();

            showResponse('analyze-response', {
                success: true,
                message: 'File downloaded!',
                files: text.split('\n').filter(l => l.includes('===== FILE:')).length,
                size: (text.length / 1024).toFixed(2) + ' KB'
            });
            showToast('Đã download file', 'success');
        } else {
            const data = await res.json();
            showResponse('analyze-response', data, true);
            showToast('Lỗi analyze', 'error');
        }
    } catch (err) {
        showResponse('analyze-response', { error: err.message }, true);
        showToast('Lỗi: ' + err.message, 'error');
    }
    resetButton(btn);
}

async function copyAnalyzeResult() {
    const copyBtn = event.target.closest('.btn-copy');
    const copyIcon = document.getElementById('analyze-copy-icon');
    const copyText = document.getElementById('analyze-copy-text');

    if (!lastAnalyzeResult) {
        // Fetch if not already analyzed
        const path = document.getElementById('analyze-path').value;
        showLoading(copyBtn, copyBtn.innerHTML);

        try {
            const res = await fetch(`${API_BASE}/api/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path })
            });

            if (res.ok) {
                lastAnalyzeResult = await res.text();
            } else {
                showToast('Lỗi analyze', 'error');
                resetButton(copyBtn);
                return;
            }
        } catch (err) {
            showToast('Lỗi: ' + err.message, 'error');
            resetButton(copyBtn);
            return;
        }
        resetButton(copyBtn);
    }

    // Copy to clipboard using ClipboardItem
    try {
        const blob = new Blob([lastAnalyzeResult], { type: 'text/plain' });
        const item = new ClipboardItem({ 'text/plain': blob });
        await navigator.clipboard.write([item]);

        copyBtn.classList.add('copied');
        copyIcon.textContent = '✓';
        copyText.textContent = 'Copied';
        showToast('Đã copy project.txt', 'success');

        setTimeout(() => {
            copyBtn.classList.remove('copied');
            copyIcon.textContent = '📋';
            copyText.textContent = 'Copy Text';
        }, 2000);
    } catch (err) {
        try {
            await navigator.clipboard.writeText(lastAnalyzeResult);
            copyBtn.classList.add('copied');
            copyIcon.textContent = '✓';
            copyText.textContent = 'Copied';
            showToast('Đã copy project.txt', 'success');

            setTimeout(() => {
                copyBtn.classList.remove('copied');
                copyIcon.textContent = '📋';
                copyText.textContent = 'Copy Text';
            }, 2000);
        } catch (fallbackErr) {
            showToast('Lỗi copy: ' + fallbackErr.message, 'error');
        }
    }
}

async function copyAsFile(filename, content) {
    const blob = new Blob([content], {
        type: "application/octet-stream"
    });

    const item = new ClipboardItem(
        { [blob.type]: blob },
        {
            type: "application/octet-stream",
            presentationStyle: "attachment",
            name: filename
        }
    );

    await navigator.clipboard.write([item]);
}

async function copyAnalyzeAsFile() {
    const copyBtn = event.target.closest('.btn-copy');
    const copyIcon = document.getElementById('analyze-file-icon');
    const copyText = document.getElementById('analyze-file-text');

    if (!lastAnalyzeResult) {
        // Fetch if not already analyzed
        const path = document.getElementById('analyze-path').value;
        showLoading(copyBtn, copyBtn.innerHTML);

        try {
            const res = await fetch(`${API_BASE}/api/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path })
            });

            if (res.ok) {
                lastAnalyzeResult = await res.text();
            } else {
                showToast('Lỗi analyze', 'error');
                resetButton(copyBtn);
                return;
            }
        } catch (err) {
            showToast('Lỗi: ' + err.message, 'error');
            resetButton(copyBtn);
            return;
        }
        resetButton(copyBtn);
    }

    try {
        await copyAsFile("project.txt", lastAnalyzeResult);

        copyBtn.classList.add('copied');
        copyIcon.textContent = '✓';
        copyText.textContent = 'Copied';
        showToast('Đã copy file', 'success');

        setTimeout(() => {
            copyBtn.classList.remove('copied');
            copyIcon.textContent = '📄';
            copyText.textContent = 'Copy as File';
        }, 2000);
    } catch (err) {
        showToast('Lỗi copy: ' + err.message, 'error');
    }
}

async function testExecute() {
    const btn = event.target.closest('.btn');
    const bash = document.getElementById('execute-bash').value;

    if (!bash.trim()) {
        showToast('Vui lòng nhập bash script', 'error');
        return;
    }

    showLoading(btn, btn.innerHTML);
    try {
        const res = await fetch(`${API_BASE}/api/execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bash })
        });
        const data = await res.json();
        showResponse('execute-response', data, !res.ok || !data.success);

        if (data.success) {
            showToast('Thực thi thành công', 'success');
        } else {
            showToast('Thực thi thất bại', 'error');
        }
    } catch (err) {
        showResponse('execute-response', { error: err.message }, true);
        showToast('Lỗi: ' + err.message, 'error');
    }
    resetButton(btn);
}

async function executeFromClipboard() {
    const btn = event.target.closest('.btn');

    showLoading(btn, btn.innerHTML);

    try {
        const clipboardText = await navigator.clipboard.readText();

        if (!clipboardText || !clipboardText.trim()) {
            showToast('Clipboard trống!', 'error');
            showResponse('execute-response', {
                error: 'Clipboard is empty',
                message: 'Please copy a bash script to clipboard first'
            }, true);
            resetButton(btn);
            return;
        }

        document.getElementById('execute-bash').value = clipboardText;

        const res = await fetch(`${API_BASE}/api/execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bash: clipboardText })
        });
        const data = await res.json();
        showResponse('execute-response', data, !res.ok || !data.success);

        if (data.success) {
            showToast('Thực thi từ clipboard OK', 'success');
        } else {
            if (data.syntaxError) {
                showToast('Lỗi syntax script', 'error');
            } else {
                showToast('Thực thi thất bại', 'error');
            }
        }
    } catch (err) {
        if (err.name === 'NotAllowedError') {
            showToast('Không có quyền clipboard', 'error');
        } else {
            showResponse('execute-response', { error: err.message }, true);
            showToast('Lỗi: ' + err.message, 'error');
        }
    }
    resetButton(btn);
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    // Reset text content to remove potential icon junk
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.add('show');

    // Clear previous timeout if exists
    if (toast.timeoutId) clearTimeout(toast.timeoutId);

    toast.timeoutId = setTimeout(() => toast.classList.remove('show'), 3000);
}

// Check server status
async function checkServerStatus() {
    try {
        const res = await fetch(`${API_BASE}/health`);
        if (res.ok) {
            document.getElementById('status').textContent = '● Online';
            document.getElementById('status').style.background = 'rgba(52, 199, 89, 0.15)';
            document.getElementById('status').style.color = 'var(--ios-green)';
        }
    } catch {
        document.getElementById('status').textContent = '● Offline';
        document.getElementById('status').style.background = 'rgba(255, 59, 48, 0.15)';
        document.getElementById('status').style.color = 'var(--ios-red)';
    }
}
