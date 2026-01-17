import { create } from 'zustand';
import { storage } from '../services/storage';

const useStore = create((set, get) => ({
    // State
    apiKey: '',
    models: [],
    activeModel: 'openai/gpt-3.5-turbo', // Default backup
    chats: [], // List of { id, title, updatedAt }
    activeChatId: null,
    messages: [], // Current chat messages
    messages: [], // Current chat messages
    isLoading: false,
    isFetchingModels: false,
    sidebarOpen: true,

    // Actions
    init: async () => {
        const settings = await storage.getSettings();
        const chats = await storage.getChats();
        set({
            apiKey: settings.apiKey || '',
            activeModel: settings.activeModel || '',
            chats: chats.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)),
        });
        // Trigger fetch if key exists
        const state = get();
        if (state.apiKey) {
            state.fetchModels(state.apiKey);
        }
    },

    fetchModels: async (key) => {
        const apiKey = key || get().apiKey;
        if (!apiKey) return;

        set({ isFetchingModels: true });
        try {
            const { openRouter } = await import('../services/openrouter');
            const data = await openRouter.fetchModels(apiKey);
            const modelList = data.data.sort((a, b) => a.name.localeCompare(b.name));
            set({ models: modelList });

            // Set default if none active
            if (!get().activeModel && modelList.length > 0) {
                const defaultModel = modelList.find(m => m.id.includes('gpt-3.5')) || modelList[0];
                get().setActiveModel(defaultModel.id);
            }
        } catch (error) {
            console.error('Failed to fetch models:', error);
        } finally {
            set({ isFetchingModels: false });
        }
    },

    setApiKey: async (key) => {
        set({ apiKey: key });
        await storage.saveSettings({ ...await storage.getSettings(), apiKey: key });
    },

    setActiveModel: async (model) => {
        set({ activeModel: model });
        await storage.saveSettings({ ...await storage.getSettings(), activeModel: model });
    },

    setModels: (models) => set({ models }),

    setSidebarOpen: (isOpen) => set({ sidebarOpen: isOpen }),

    toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

    // Chat Actions
    createNewChat: async () => {
        const newChatId = crypto.randomUUID();
        const newChat = {
            id: newChatId,
            title: 'New Chat',
            updatedAt: new Date().toISOString(),
        };

        const updatedChats = [newChat, ...get().chats];
        set({
            chats: updatedChats,
            activeChatId: newChatId,
            messages: [],
        });

        await storage.saveChats(updatedChats);
        await storage.saveChatHistory(newChatId, []);
    },

    loadChat: async (chatId) => {
        const history = await storage.getChatHistory(chatId);
        set({
            activeChatId: chatId,
            messages: history,
        });
        // On mobile, maybe close sidebar automatically?
        if (window.innerWidth < 768) {
            set({ sidebarOpen: false });
        }
    },

    deleteChat: async (chatId) => {
        await storage.deleteChat(chatId);
        set((state) => ({
            chats: state.chats.filter((c) => c.id !== chatId),
            activeChatId: state.activeChatId === chatId ? null : state.activeChatId,
            messages: state.activeChatId === chatId ? [] : state.messages
        }));
    },

    addMessage: async (role, content, images = []) => {
        const { activeChatId, messages, chats } = get();
        if (!activeChatId) return;

        const newMessage = {
            id: crypto.randomUUID(),
            role,
            content,
            model: role === 'assistant' ? get().activeModel : undefined,
            images, // Array of base64 strings or URLs
            timestamp: new Date().toISOString(),
        };

        const updatedMessages = [...messages, newMessage];
        set({ messages: updatedMessages });

        await storage.saveChatHistory(activeChatId, updatedMessages);

        // Update chat title if it's the first user message and title is "New Chat"
        const currentChat = chats.find(c => c.id === activeChatId);
        if (currentChat && currentChat.title === 'New Chat' && role === 'user') {
            const newTitle = content.slice(0, 30) + (content.length > 30 ? '...' : '');
            const updatedChats = chats.map(c =>
                c.id === activeChatId ? { ...c, title: newTitle, updatedAt: newMessage.timestamp } : c
            );
            updatedChats.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
            set({ chats: updatedChats });
            await storage.saveChats(updatedChats);
        } else {
            // Just update timestamp
            const updatedChats = chats.map(c =>
                c.id === activeChatId ? { ...c, updatedAt: newMessage.timestamp } : c
            );
            updatedChats.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
            set({ chats: updatedChats });
            await storage.saveChats(updatedChats);
        }
    },

    updateLastMessage: (content, metadata = {}) => {
        const { messages } = get();
        if (messages.length === 0) return;

        const lastMsg = messages[messages.length - 1];
        const updatedLastMsg = { ...lastMsg, content, ...metadata };
        const updatedMessages = [...messages.slice(0, -1), updatedLastMsg];

        set({ messages: updatedMessages });
        // We don't save on every chunk to avoid IO thrashing, allow caller to save final
    },

    saveCurrentChat: async () => {
        const { activeChatId, messages } = get();
        if (activeChatId) {
            await storage.saveChatHistory(activeChatId, messages);
        }
    }

}));

export default useStore;
