/**
 * Agent Panel - AI Chat Interface
 * Provides chat UI with markdown rendering, file upload, and history management
 */

import { getById } from '../utils.js';
import * as ChatHistory from '../utils/chat-history-manager.js';
// Import markdown-it and mermaid from npm packages (bundled by webpack)
import markdownit from 'markdown-it';
import mermaid from 'mermaid';

// State
let messages = [];
let selectedFiles = [];
let isProcessing = false;
let currentChatId = null;
let autoSaveTimeout = null;
let md = null; // markdown-it instance

// Initialize markdown-it with safe settings
function initMarkdown() {
    if (md) return md;
    
    md = markdownit({
        html: false,        // Disable HTML tags for security
        breaks: true,       // Convert line breaks to <br>
        linkify: true,      // Auto-convert URLs to links
        typographer: true   // Smart quotes
    });
    
    console.log('[AgentPanel] markdown-it initialized');
    return md;
}

// Initialize mermaid with dark theme
function initMermaid() {
    try {
        mermaid.initialize({
            startOnLoad: false,      // Manual trigger
            theme: 'dark',           // Dark theme
            securityLevel: 'loose',  // Allow shadow DOM interaction
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif'
        });
        console.log('[AgentPanel] mermaid initialized');
    } catch (error) {
        console.error('[AgentPanel] Failed to initialize mermaid:', error);
    }
}

/**
 * Initialize Agent Panel
 */
export function initAgentPanel() {
    // Initialize libraries immediately
    initMarkdown();
    initMermaid();
    
    // Listen for panel open event
    document.addEventListener('tool-panel-opened', (e) => {
        if (e.detail.panelId === 'agent' && e.detail.side === 'right') {
            renderAgentPanel();
        }
    });

    console.log('[AgentPanel] Initialized');
}

/**
 * Render Agent Panel UI
 */
async function renderAgentPanel() {
    const container = getById('agent-panel-content');
    if (!container) {
        console.error('[AgentPanel] Container not found');
        return;
    }

    // Check if already rendered
    if (container.querySelector('.agent-chat-messages')) {
        console.log('[AgentPanel] Already rendered');
        return;
    }

    // Create UI
    container.innerHTML = `
        <div class="agent-chat-messages" id="agent-messages"></div>
        
        <div class="agent-chat-input-area">
            <div class="agent-input-wrapper" id="agent-input-wrapper">
                <div class="agent-file-list" id="agent-file-list"></div>
                <textarea 
                    class="agent-chat-textarea" 
                    id="agent-chat-input" 
                    placeholder="Nhập tin nhắn..."
                ></textarea>
                <div class="agent-input-controls">
                    <div class="agent-input-actions">
                        <input id="agent-file-input" type="file" multiple style="display: none" />
                        <button class="agent-btn" id="agent-file-btn" title="Attach files">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                            </svg>
                        </button>
                        <button class="agent-btn" id="agent-clear-btn" title="Clear chat">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </div>
                    <button class="agent-send-btn" id="agent-send-btn" title="Send message">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="19" x2="12" y2="5"></line>
                            <polyline points="5 12 12 5 19 12"></polyline>
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    `;

    // Attach event listeners
    attachEventListeners();
    
    // Load last chat or start fresh
    await initializeChatSession();
    
    // Render messages
    renderMessages();

    console.log('[AgentPanel] Rendered successfully');
}

/**
 * Attach event listeners
 */
function attachEventListeners() {
    // Send button
    const sendBtn = getById('agent-send-btn');
    if (sendBtn) {
        sendBtn.addEventListener('click', () => {
            if (!isProcessing) sendMessage();
        });
    }

    // Input enter key
    const input = getById('agent-chat-input');
    if (input) {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!isProcessing) sendMessage();
            }
        });

        // Auto-expand textarea
        input.addEventListener('input', function() {
            this.style.height = '40px';
            if (this.scrollHeight > 40) {
                this.style.height = Math.min(this.scrollHeight, 120) + 'px';
            }
        });
    }

    // File button
    const fileBtn = getById('agent-file-btn');
    const fileInput = getById('agent-file-input');
    if (fileBtn && fileInput) {
        fileBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => {
            handleAddFiles(e.target.files);
            fileInput.value = '';
        });
    }

    // Clear button
    const clearBtn = getById('agent-clear-btn');
    if (clearBtn) {
        clearBtn.addEventListener('click', handleClearChat);
    }

    // Drag & drop
    const dropZone = getById('agent-input-wrapper');
    if (dropZone) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, false);
        });

        dropZone.addEventListener('dragover', () => {
            if (!isProcessing) dropZone.classList.add('drag-active');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('drag-active');
        });

        dropZone.addEventListener('drop', (e) => {
            dropZone.classList.remove('drag-active');
            if (isProcessing) return;
            handleAddFiles(e.dataTransfer.files);
        });
    }
}

/**
 * Initialize chat session
 */
async function initializeChatSession() {
    // Try to load last chat
    const lastChatId = ChatHistory.getLastChatId();
    
    if (lastChatId) {
        console.log(`[AgentPanel] Loading last chat: ${lastChatId}`);
        currentChatId = lastChatId;
        
        const chatData = ChatHistory.loadChat(currentChatId);
        if (chatData && chatData.messages) {
            messages = chatData.messages;
            console.log(`[AgentPanel] Loaded ${messages.length} messages`);
        } else {
            messages = [];
        }
    } else {
        console.log('[AgentPanel] Starting fresh chat');
        messages = [];
        currentChatId = null;
    }
}

/**
 * Render messages
 */
function renderMessages() {
    const container = getById('agent-messages');
    if (!container) return;

    if (messages.length === 0) {
        container.innerHTML = `
            <div class="agent-chat-empty">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
                </svg>
                <span>Kéo thả file hoặc nhập tin nhắn</span>
            </div>
        `;
        return;
    }

    container.innerHTML = messages.map(msg => {
        const isUser = msg.role === 'user';
        const contentHtml = isUser ? escapeHtml(msg.content) : md.render(msg.content);
        
        return `
            <div class="agent-message ${msg.role}">
                <div class="agent-message-content">
                    <div class="markdown-body">${contentHtml}</div>
                    <div class="agent-message-meta">
                        <span>${msg.timestamp}</span>
                        <span>${getStatusIcon(msg.status, msg.role)}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // Process mermaid diagrams
    processMermaidDiagrams(container);
    
    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
}

/**
 * Process mermaid diagrams
 * Uses mermaid.render() which is more compatible with shadow DOM
 */
async function processMermaidDiagrams(container) {
    const mermaidCodeBlocks = container.querySelectorAll('code.language-mermaid');
    if (mermaidCodeBlocks.length === 0) return;

    console.log(`[AgentPanel] Found ${mermaidCodeBlocks.length} mermaid diagram(s)`);

    for (let i = 0; i < mermaidCodeBlocks.length; i++) {
        const codeBlock = mermaidCodeBlocks[i];
        const code = codeBlock.textContent;
        const preElement = codeBlock.parentElement;
        
        if (!preElement || preElement.tagName !== 'PRE') {
            continue;
        }

        try {
            // Use mermaid.render() which is more compatible with shadow DOM
            const id = `agent-mermaid-${Date.now()}-${i}`;
            const { svg, bindFunctions } = await mermaid.render(id, code);
            
            // Create wrapper div for mermaid
            const wrapper = document.createElement('div');
            wrapper.className = 'agent-mermaid';
            wrapper.innerHTML = svg;
            
            // Replace pre/code with wrapper
            preElement.replaceWith(wrapper);
            
            // Bind any interactive functions if present
            if (bindFunctions) {
                bindFunctions(wrapper);
            }
            
            console.log(`[AgentPanel] Rendered mermaid diagram ${i + 1}`);
        } catch (err) {
            console.error(`[AgentPanel] Mermaid render error (diagram ${i + 1}):`, err);
            
            // On error, show error message instead of broken diagram
            const errorDiv = document.createElement('div');
            errorDiv.className = 'agent-mermaid-error';
            errorDiv.style.cssText = 'color: #ef4444; padding: 12px; background: #2a1515; border-radius: 8px; border: 1px solid #7f1d1d; margin: 8px 0;';
            errorDiv.textContent = `Mermaid rendering error: ${err.message}`;
            preElement.replaceWith(errorDiv);
        }
    }
}

/**
 * Send message
 */
async function sendMessage() {
    const input = getById('agent-chat-input');
    const prompt = input.value.trim();
    
    if (!prompt && selectedFiles.length === 0) return;
    
    if (!window.AIChat) {
        alert('❌ AIChat engine chưa được inject!');
        return;
    }

    // Generate chat ID for first message
    const isFirstMessage = messages.length === 0;

    let userMsg = prompt;
    if (selectedFiles.length > 0) {
        userMsg += `\n\n📎 Files: ${selectedFiles.map(f => f.name).join(', ')}`;
    }

    addMessage('user', userMsg, 'sending');
    
    const payloadFiles = [...selectedFiles];
    input.value = '';
    selectedFiles = [];
    renderFileList();
    setProcessing(true);

    try {
        updateLastMessage({ status: 'done' });
        addMessage('assistant', '...', 'processing');
        
        await window.AIChat.send({ prompt, files: payloadFiles });
        await new Promise(r => setTimeout(r, 1000));

        const aiResponse = await window.AIChat.copyLastTurnAsMarkdown();
        updateLastMessage({ content: aiResponse || '(AI không trả về nội dung)', status: 'done' });

        // Create chat ID after first message
        if (isFirstMessage && !currentChatId) {
            currentChatId = ChatHistory.generateChatId();
            console.log(`[AgentPanel] Created new chat: ${currentChatId}`);
        }
    } catch (error) {
        console.error('[AgentPanel] Error sending message:', error);

        const errorHtml = `
            <div class="agent-error-box">
                <div class="agent-error-title">❌ Lỗi: ${escapeHtml(error.message)}</div>
                <button onclick="window.retryAgentMessage()" class="agent-retry-btn">
                    🔄 Thử lại (Retry)
                </button>
            </div>
        `;
        updateLastMessage({ content: errorHtml, status: 'error' });
    } finally {
        setProcessing(false);
    }
}

/**
 * Retry message
 */
window.retryAgentMessage = async function() {
    if (!window.AIChat) {
        alert('❌ AIChat engine chưa sẵn sàng!');
        return;
    }

    console.log('[AgentPanel] Retrying...');
    setProcessing(true);

    try {
        updateLastMessage({ content: '🔄 Đang thử lại...', status: 'processing' });

        const aiResponse = await window.AIChat.copyLastTurnAsMarkdown();
        updateLastMessage({ content: aiResponse || '(AI không trả về nội dung)', status: 'done' });

        console.log('[AgentPanel] Retry successful');
    } catch (error) {
        console.error('[AgentPanel] Retry failed:', error);

        const errorHtml = `
            <div class="agent-error-box">
                <div class="agent-error-title">❌ Vẫn lỗi: ${escapeHtml(error.message)}</div>
                <button onclick="window.retryAgentMessage()" class="agent-retry-btn">
                    🔄 Thử lại (Retry)
                </button>
            </div>
        `;
        updateLastMessage({ content: errorHtml, status: 'error' });
    } finally {
        setProcessing(false);
    }
};

/**
 * Add message
 */
function addMessage(role, content, status = 'done') {
    messages.push({
        id: Date.now(),
        role,
        content,
        status,
        timestamp: new Date().toLocaleTimeString('vi-VN')
    });
    renderMessages();
    autoSaveChat();
}

/**
 * Update last message
 */
function updateLastMessage(updates) {
    if (messages.length === 0) return;
    Object.assign(messages[messages.length - 1], updates);
    renderMessages();
    autoSaveChat();
}

/**
 * Auto-save chat
 */
function autoSaveChat() {
    if (!currentChatId) return;

    if (autoSaveTimeout) {
        clearTimeout(autoSaveTimeout);
    }

    autoSaveTimeout = setTimeout(() => {
        const success = ChatHistory.saveChat(currentChatId, messages);
        if (success) {
            console.log(`[AgentPanel] Auto-saved chat ${currentChatId}`);
        }
    }, 500);
}

/**
 * Clear chat
 */
function handleClearChat() {
    if (!confirm('Xóa toàn bộ lịch sử chat?')) return;

    if (currentChatId) {
        ChatHistory.deleteChat(currentChatId);
        console.log(`[AgentPanel] Deleted chat ${currentChatId}`);
    }

    messages = [];
    selectedFiles = [];
    currentChatId = null;
    renderFileList();
    renderMessages();
}

/**
 * Handle add files
 */
function handleAddFiles(newFiles) {
    if (isProcessing) return;
    for (const file of newFiles) {
        selectedFiles.push(file);
    }
    renderFileList();
}

/**
 * Render file list
 */
function renderFileList() {
    const listContainer = getById('agent-file-list');
    if (!listContainer) return;

    listContainer.innerHTML = selectedFiles.map((file, index) => `
        <div class="agent-file-badge">
            <span class="agent-file-name">📎 ${file.name}</span>
            <span class="agent-file-size">(${(file.size / 1024).toFixed(0)}KB)</span>
            <button class="agent-file-remove" onclick="window.removeAgentFile(${index})">×</button>
        </div>
    `).join('');
}

/**
 * Remove file
 */
window.removeAgentFile = function(index) {
    if (isProcessing) return;
    selectedFiles.splice(index, 1);
    renderFileList();
};

/**
 * Set processing state
 */
function setProcessing(processing) {
    isProcessing = processing;
    
    const input = getById('agent-chat-input');
    const sendBtn = getById('agent-send-btn');
    const fileBtn = getById('agent-file-btn');
    const dropZone = getById('agent-input-wrapper');

    if (input) {
        input.disabled = processing;
        input.placeholder = processing ? 'AI đang suy nghĩ...' : 'Nhập tin nhắn...';
    }

    if (sendBtn) {
        sendBtn.disabled = processing;
        sendBtn.style.opacity = processing ? '0.3' : '1';
        
        if (processing) {
            sendBtn.innerHTML = `
                <svg class="agent-spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                </svg>
            `;
        } else {
            sendBtn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="19" x2="12" y2="5"></line>
                    <polyline points="5 12 12 5 19 12"></polyline>
                </svg>
            `;
        }
    }

    if (fileBtn) {
        fileBtn.disabled = processing;
    }

    if (dropZone) {
        dropZone.style.opacity = processing ? '0.5' : '1';
        dropZone.style.pointerEvents = processing ? 'none' : 'auto';
    }
}

/**
 * Get status icon
 */
function getStatusIcon(status, role) {
    if (status === 'sending') return '<span class="agent-status-sending">sending...</span>';
    if (status === 'processing') return '<span class="agent-status-processing">● thinking</span>';
    if (status === 'error') return '<span class="agent-status-error">failed</span>';
    return '';
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
