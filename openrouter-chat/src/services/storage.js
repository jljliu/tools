import { get, set, del, update } from 'idb-keyval';

const SETTINGS_KEY = 'settings';
const CHATS_KEY = 'chats'; // Stores array of chat metadata (id, title, date)

export const storage = {
    // Helper to safely execute storage operations
    async safeGet(key, fallback = null) {
        try {
            return (await get(key)) || fallback;
        } catch (error) {
            console.warn(`Storage access failed for key "${key}":`, error);
            return fallback;
        }
    },

    async safeSet(key, value) {
        try {
            return await set(key, value);
        } catch (error) {
            console.warn(`Storage save failed for key "${key}":`, error);
        }
    },

    // Settings (API Key, selected model, etc.)
    getSettings: async () => {
        return await storage.safeGet(SETTINGS_KEY, {});
    },
    saveSettings: async (settings) => {
        return await storage.safeSet(SETTINGS_KEY, settings);
    },

    // Chat Metadata
    getChats: async () => {
        return await storage.safeGet(CHATS_KEY, []);
    },
    saveChats: async (chats) => {
        return await storage.safeSet(CHATS_KEY, chats);
    },

    // Specific Chat History (Keyed by chat ID)
    getChatHistory: async (chatId) => {
        return await storage.safeGet(`chat_${chatId}`, []);
    },
    saveChatHistory: async (chatId, messages) => {
        return await storage.safeSet(`chat_${chatId}`, messages);
    },
    deleteChat: async (chatId) => {
        try {
            await del(`chat_${chatId}`);
            // Also remove from chats list
            await update(CHATS_KEY, (val) => (val || []).filter((c) => c.id !== chatId));
        } catch (error) {
            console.warn(`Storage delete failed for chat "${chatId}":`, error);
        }
    },

    clearAll: async () => {
        try {
            const { clear } = await import('idb-keyval');
            return await clear();
        } catch (error) {
            console.warn('Storage clear failed:', error);
        }
    }
};
