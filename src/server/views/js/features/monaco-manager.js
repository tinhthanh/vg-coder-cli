import { API_BASE } from '../config.js';
import { showToast, getById } from '../utils.js';

let editor = null;
let models = new Map();
let isMonacoLoaded = false;

export function initMonaco() {
    if (typeof require !== 'undefined' && require.config) {
        require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' }});
    }
}

async function ensureEditor() {
    if (editor) return editor;

    return new Promise((resolve) => {
        const amdRequire = window.require;
        
        if (!amdRequire) {
            console.error('Monaco Loader not found');
            return;
        }

        amdRequire(['vs/editor/editor.main'], function () {
            const container = getById('monaco-container');
            if (!container) return;
            
            const currentTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'vs-dark' : 'vs';

            editor = monaco.editor.create(container, {
                value: '',
                language: 'plaintext',
                theme: currentTheme,
                automaticLayout: true,
                minimap: { enabled: true },
                fontSize: 13,
                fontFamily: 'Menlo, Monaco, "Courier New", monospace',
                scrollBeyondLastLine: false,
            });

            editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
                saveCurrentFile();
            });

            isMonacoLoaded = true;
            resolve(editor);
        });
    });
}

export async function openFileInMonaco(path) {
    const editorInstance = await ensureEditor();
    if (!editorInstance) return;

    if (models.has(path)) {
        const stored = models.get(path);
        editorInstance.setModel(stored.model);
        if (stored.viewState) {
            editorInstance.restoreViewState(stored.viewState);
        }
        editorInstance.focus();
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/read-file?path=${encodeURIComponent(path)}`);
        const data = await res.json();

        if (res.ok) {
            const language = getLanguageFromPath(path);
            const newModel = monaco.editor.createModel(data.content, language, monaco.Uri.file(path));
            models.set(path, { model: newModel, viewState: null });
            editorInstance.setModel(newModel);
        } else {
            showToast(`Error opening file: ${data.error}`, 'error');
        }
    } catch (err) {
        showToast(`Failed to load file: ${err.message}`, 'error');
    }
}

export function saveViewState(path) {
    if (editor && models.has(path)) {
        const viewState = editor.saveViewState();
        const stored = models.get(path);
        stored.viewState = viewState;
        models.set(path, stored);
    }
}

export function disposeModel(path) {
    if (models.has(path)) {
        const stored = models.get(path);
        stored.model.dispose();
        models.delete(path);
    }
}

export function updateMonacoTheme(theme) {
    if (editor) {
        monaco.editor.setTheme(theme === 'dark' ? 'vs-dark' : 'vs');
    }
}

async function saveCurrentFile() {
    const model = editor.getModel();
    if (!model) return;

    const content = model.getValue();
    const filePath = model.uri.fsPath;

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
