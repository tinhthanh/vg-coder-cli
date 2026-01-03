/**
 * Chat History Manager
 * Manages chat sessions in localStorage
 */

const STORAGE_PREFIX = 'vg-dashboard-chat-';
const METADATA_KEY = 'vg-dashboard-chat-metadata';
const MAX_CHAT_AGE_DAYS = 30;
const MAX_TITLE_LENGTH = 50;

/**
 * Generate unique chat ID
 * @returns {string} Chat ID
 */
export function generateChatId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15) + 
                 Math.random().toString(36).substring(2, 15);
  return `${timestamp}${random}`;
}

/**
 * Generate chat title from messages
 * @param {Array} messages - Chat messages
 * @returns {string} Chat title
 */
function generateTitle(messages) {
  if (!messages || messages.length === 0) return 'New Chat';
  const firstUserMsg = messages.find(m => m.role === 'user');
  if (!firstUserMsg) return 'New Chat';
  
  let title = firstUserMsg.content.trim();
  if (title.length > MAX_TITLE_LENGTH) {
    title = title.substring(0, MAX_TITLE_LENGTH) + '...';
  }
  return title;
}

/**
 * Get metadata
 * @returns {object} Metadata object
 */
function getMetadata() {
  try {
    const data = localStorage.getItem(METADATA_KEY);
    return data ? JSON.parse(data) : { allChatIds: [], lastAccessedChatId: null };
  } catch (error) {
    console.error('[ChatHistory] Failed to get metadata:', error);
    return { allChatIds: [], lastAccessedChatId: null };
  }
}

/**
 * Update metadata
 * @param {object} updates - Updates to apply
 */
function updateMetadata(updates) {
  const metadata = getMetadata();
  Object.assign(metadata, updates);
  try {
    localStorage.setItem(METADATA_KEY, JSON.stringify(metadata));
  } catch (error) {
    console.error('[ChatHistory] Failed to update metadata:', error);
    handleStorageError(error);
  }
}

/**
 * Handle storage errors
 * @param {Error} error - Error object
 */
function handleStorageError(error) {
  if (error.name === 'QuotaExceededError') {
    console.warn('[ChatHistory] Storage quota exceeded, cleaning up...');
    const deletedCount = cleanupOldChats(7);
    if (deletedCount > 0) {
      console.log(`[ChatHistory] Cleaned up ${deletedCount} old chats`);
    } else {
      console.error('[ChatHistory] Storage full and no old chats to cleanup!');
      alert('⚠️ Bộ nhớ đã đầy! Vui lòng xóa bớt lịch sử chat cũ.');
    }
  }
}

/**
 * Save chat to localStorage
 * @param {string} chatId - Chat ID
 * @param {Array} messages - Messages array
 * @param {object} options - Additional options
 * @returns {boolean} Success status
 */
export function saveChat(chatId, messages, options = {}) {
  if (!chatId) {
    console.error('[ChatHistory] Cannot save chat without ID');
    return false;
  }

  const now = Date.now();
  const key = STORAGE_PREFIX + chatId;

  let chatData;
  try {
    const existing = localStorage.getItem(key);
    chatData = existing ? JSON.parse(existing) : { id: chatId, createdAt: now };
  } catch (error) {
    console.error('[ChatHistory] Failed to load existing chat:', error);
    chatData = { id: chatId, createdAt: now };
  }

  chatData.messages = messages;
  chatData.updatedAt = now;
  chatData.title = options.title || generateTitle(messages);

  try {
    localStorage.setItem(key, JSON.stringify(chatData));
    const metadata = getMetadata();
    if (!metadata.allChatIds.includes(chatId)) {
      metadata.allChatIds.push(chatId);
    }
    metadata.lastAccessedChatId = chatId;
    updateMetadata(metadata);
    return true;
  } catch (error) {
    console.error('[ChatHistory] Failed to save chat:', error);
    handleStorageError(error);
    return false;
  }
}

/**
 * Load chat from localStorage
 * @param {string} chatId - Chat ID
 * @returns {object|null} Chat data
 */
export function loadChat(chatId) {
  if (!chatId) return null;

  const key = STORAGE_PREFIX + chatId;
  try {
    const data = localStorage.getItem(key);
    if (!data) {
      console.warn(`[ChatHistory] Chat not found: ${chatId}`);
      return null;
    }

    const chatData = JSON.parse(data);
    if (!chatData.messages || !Array.isArray(chatData.messages)) {
      console.error('[ChatHistory] Invalid chat data structure');
      return null;
    }

    updateMetadata({ lastAccessedChatId: chatId });

    return {
      messages: chatData.messages,
      metadata: {
        title: chatData.title,
        createdAt: chatData.createdAt,
        updatedAt: chatData.updatedAt,
      }
    };
  } catch (error) {
    console.error('[ChatHistory] Failed to load chat:', error);
    return null;
  }
}

/**
 * Delete chat from localStorage
 * @param {string} chatId - Chat ID
 * @returns {boolean} Success status
 */
export function deleteChat(chatId) {
  if (!chatId) return false;

  const key = STORAGE_PREFIX + chatId;
  try {
    localStorage.removeItem(key);
    const metadata = getMetadata();
    metadata.allChatIds = metadata.allChatIds.filter(id => id !== chatId);
    if (metadata.lastAccessedChatId === chatId) {
      metadata.lastAccessedChatId = null;
    }
    updateMetadata(metadata);
    return true;
  } catch (error) {
    console.error('[ChatHistory] Failed to delete chat:', error);
    return false;
  }
}

/**
 * Cleanup old chats
 * @param {number} maxAgeDays - Max age in days
 * @returns {number} Number of chats deleted
 */
export function cleanupOldChats(maxAgeDays = MAX_CHAT_AGE_DAYS) {
  const cutoffTime = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);
  const metadata = getMetadata();
  let deletedCount = 0;

  for (const chatId of [...metadata.allChatIds]) {
    const key = STORAGE_PREFIX + chatId;
    try {
      const data = localStorage.getItem(key);
      if (data) {
        const chatData = JSON.parse(data);
        if (chatData.updatedAt < cutoffTime) {
          deleteChat(chatId);
          deletedCount++;
        }
      }
    } catch (error) {
      console.error(`[ChatHistory] Failed to check chat ${chatId}:`, error);
    }
  }

  return deletedCount;
}

/**
 * Get all chat IDs
 * @returns {Array<string>} Array of chat IDs
 */
export function getAllChatIds() {
  const metadata = getMetadata();
  return metadata.allChatIds;
}

/**
 * Get last accessed chat ID
 * @returns {string|null} Last chat ID
 */
export function getLastChatId() {
  const metadata = getMetadata();
  return metadata.lastAccessedChatId;
}
