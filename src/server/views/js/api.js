import { API_BASE } from './config.js';

export async function analyzeProject(path, specificFiles = null) {
    const res = await fetch(`${API_BASE}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, specificFiles })
    });
    if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Analyze failed');
    }
    return await res.text();
}

export async function executeScript(bash) {
    const res = await fetch(`${API_BASE}/api/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bash })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Execute failed');
    return data;
}

export async function checkHealth() {
    try {
        const res = await fetch(`${API_BASE}/health`);
        return res.ok;
    } catch {
        return false;
    }
}

export async function getStructure(path) {
    const res = await fetch(`${API_BASE}/api/structure?path=${encodeURIComponent(path)}`);
    if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to get structure');
    }
    return await res.json();
}

export async function getGitStatus() {
    const res = await fetch(`${API_BASE}/api/git/status`);
    if (!res.ok) throw new Error('Failed to fetch status');
    return await res.json();
}

export async function getGitDiff(file = null, type = 'working') {
    let url = `${API_BASE}/api/git/diff?type=${type}`;
    if (file) url += `&file=${encodeURIComponent(file)}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to get git diff');
    return data.diff;
}

export async function stageFile(files) {
    const res = await fetch(`${API_BASE}/api/git/stage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: Array.isArray(files) ? files : [files] })
    });
    return res.ok;
}

export async function unstageFile(files) {
    const res = await fetch(`${API_BASE}/api/git/unstage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: Array.isArray(files) ? files : [files] })
    });
    return res.ok;
}

export async function discardChange(files) {
    const res = await fetch(`${API_BASE}/api/git/discard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: Array.isArray(files) ? files : [files] })
    });
    if (!res.ok) throw new Error('Discard failed');
    return res.ok;
}

export async function commitChanges(message) {
    const res = await fetch(`${API_BASE}/api/git/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
    });
    if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Commit failed');
    }
    return true;
}

export async function gitPush(remote = 'origin', branch = null) {
    const res = await fetch(`${API_BASE}/api/git/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remote, branch })
    });
    if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Push failed');
    }
    return await res.json();
}

export async function saveTreeState(excludedPaths) {
    const res = await fetch(`${API_BASE}/api/tree-state/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ excludedPaths })
    });
    if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save tree state');
    }
    return await res.json();
}

export async function loadTreeState() {
    const res = await fetch(`${API_BASE}/api/tree-state/load`);
    if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to load tree state');
    }
    return await res.json();
}

export async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
    } catch (err) {
        throw new Error('Clipboard write failed');
    }
}

export async function readFromClipboard() {
    return await navigator.clipboard.readText();
}

export async function countTokens(text) {
    const res = await fetch(`${API_BASE}/api/count-tokens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
    });
    if (!res.ok) {
        throw new Error('Failed to count tokens');
    }
    const data = await res.json();
    return data.tokens || 0;
}
