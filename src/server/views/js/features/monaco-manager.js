import { API_BASE } from '../config.js';
import { showToast } from '../utils.js';

let editor = null;
let models = new Map(); // Map<filePath, { model: ITextModel, viewState: object }>
let isMonacoLoaded = false;

// Cấu hình đường dẫn cho AMD Loader của Monaco
export function initMonaco() {
    require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' }});
}

/**
 * Đảm bảo Editor đã được khởi tạo
 */
async function ensureEditor() {
    if (editor) return editor;

    return new Promise((resolve) => {
        require(['vs/editor/editor.main'], function () {
            const container = document.getElementById('monaco-container');
            
            // Xác định theme dựa trên theme hiện tại của web
            const currentTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'vs-dark' : 'vs';

            editor = monaco.editor.create(container, {
                value: '',
                language: 'plaintext',
                theme: currentTheme,
                automaticLayout: true, // Tự động resize
                minimap: { enabled: true },
                fontSize: 13,
                fontFamily: 'Menlo, Monaco, "Courier New", monospace',
                scrollBeyondLastLine: false,
            });

            // Lắng nghe phím tắt Ctrl+S / Cmd+S để lưu
            editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
                saveCurrentFile();
            });

            isMonacoLoaded = true;
            resolve(editor);
        });
    });
}

/**
 * Mở file vào Editor
 */
export async function openFileInMonaco(path) {
    const editorInstance = await ensureEditor();

    // 1. Nếu Model đã tồn tại trong bộ nhớ -> Dùng lại
    if (models.has(path)) {
        const stored = models.get(path);
        editorInstance.setModel(stored.model);
        if (stored.viewState) {
            editorInstance.restoreViewState(stored.viewState);
        }
        editorInstance.focus();
        return;
    }

    // 2. Nếu chưa -> Fetch nội dung từ Server
    try {
        const res = await fetch(`${API_BASE}/api/read-file?path=${encodeURIComponent(path)}`);
        const data = await res.json();

        if (res.ok) {
            // Xác định ngôn ngữ từ extension
            const language = getLanguageFromPath(path);
            
            // Tạo Model mới
            const newModel = monaco.editor.createModel(data.content, language, monaco.Uri.file(path));
            
            // Lưu vào cache
            models.set(path, { model: newModel, viewState: null });
            
            // Gán vào Editor
            editorInstance.setModel(newModel);
        } else {
            showToast(`Error opening file: ${data.error}`, 'error');
        }
    } catch (err) {
        showToast(`Failed to load file: ${err.message}`, 'error');
    }
}

/**
 * Lưu trạng thái View (Scroll, Cursor) trước khi chuyển tab
 */
export function saveViewState(path) {
    if (editor && models.has(path)) {
        const viewState = editor.saveViewState();
        const stored = models.get(path);
        stored.viewState = viewState;
        models.set(path, stored);
    }
}

/**
 * Giải phóng Model khi đóng Tab
 */
export function disposeModel(path) {
    if (models.has(path)) {
        const stored = models.get(path);
        stored.model.dispose(); // Quan trọng: Tránh memory leak
        models.delete(path);
    }
}

/**
 * Cập nhật Theme cho Monaco khi web đổi theme
 */
export function updateMonacoTheme(theme) {
    if (editor) {
        monaco.editor.setTheme(theme === 'dark' ? 'vs-dark' : 'vs');
    }
}

/**
 * Lưu file hiện tại
 */
async function saveCurrentFile() {
    const model = editor.getModel();
    if (!model) return;

    const content = model.getValue();
    const filePath = model.uri.fsPath; // Lấy path từ URI

    try {
        const res = await fetch(`${API_BASE}/api/save-file`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: filePath, content })
        });
        
        if (res.ok) {
            showToast('File saved successfully!', 'success');
        } else {
            showToast('Failed to save file', 'error');
        }
    } catch (err) {
        showToast('Error saving file: ' + err.message, 'error');
    }
}

// Helper: Map extension to Monaco Language
function getLanguageFromPath(path) {
    const ext = path.split('.').pop().toLowerCase();
    const map = {
        js: 'javascript', ts: 'typescript', html: 'html', css: 'css',
        json: 'json', md: 'markdown', py: 'python', java: 'java',
        sh: 'shell', xml: 'xml', sql: 'sql'
    };
    return map[ext] || 'plaintext';
}

export { editor };
