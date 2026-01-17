import { get, set, del, update } from 'idb-keyval';

const SETTINGS_KEY = 'settings';
const CHATS_KEY = 'chats'; // Stores array of chat metadata (id, title, date)

export const storage = {
    // Settings (API Key, selected model, etc.)
    getSettings: async () => {
        return (await get(SETTINGS_KEY)) || {};
    },
    saveSettings: async (settings) => {
        return set(SETTINGS_KEY, settings);
    },

    // Chat Metadata
    getChats: async () => {
        return (await get(CHATS_KEY)) || [];
    },
    saveChats: async (chats) => {
        return set(CHATS_KEY, chats);
    },

    // Specific Chat History (Keyed by chat ID)
    getChatHistory: async (chatId) => {
        return (await get(`chat_${chatId}`)) || [];
    },
    saveChatHistory: async (chatId, messages) => {
        return set(`chat_${chatId}`, messages);
    },
    deleteChat: async (chatId) => {
        await del(`chat_${chatId}`);
        // Also remove from chats list
        await update(CHATS_KEY, (val) => (val || []).filter((c) => c.id !== chatId));
    },

    clearAll: async () => {
        // This is destructive, be careful
        // For now, maybe just clear keys we know?
        // Using idb-keyval clear() clears everything in the store, which is fine for this app
        const { clear } = await import('idb-keyval');
        return clear();
    }
};
