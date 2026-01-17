import React from 'react';
import { Plus, MessageSquare, Trash2, Settings, List, X, ExternalLink } from 'lucide-react';
import useStore from '../store/useStore';
import clsx from 'clsx';

export default function Sidebar({ onOpenSettings }) {
    const {
        chats,
        activeChatId,
        createNewChat,
        loadChat,
        deleteChat,
        sidebarOpen,
        setSidebarOpen,
        toggleSidebar
    } = useStore();

    const handleNewChat = () => {
        createNewChat();
        if (window.innerWidth < 768) setSidebarOpen(false);
    };

    const handleLoadChat = (id) => {
        loadChat(id);
        // handled in store for sidebar closing on mobile, but explicit here is fine too
    };

    return (
        <>
            {/* Mobile Overlay */}
            {sidebarOpen && (
                <div
                    className="md:hidden fixed inset-0 bg-black/50 z-20"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar Container */}
            <div className={clsx(
                "fixed md:static inset-y-0 left-0 z-30 w-[260px] bg-black border-r border-gray-800 flex flex-col transition-transform duration-300 transform",
                sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0 md:w-0 md:hidden"
            )}>
                {/* Header / New Chat */}
                <div className="p-3">
                    <button
                        onClick={handleNewChat}
                        className="w-full flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white p-3 rounded-lg border border-gray-700 transition-colors text-sm font-medium"
                    >
                        <Plus size={18} />
                        <span>New Chat</span>
                        <span className="flex-1 text-right text-xs opacity-50">Cmd+N</span>
                    </button>
                </div>

                {/* Chat List */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-2 space-y-1 scrollbar-thin scrollbar-thumb-gray-700">
                    {chats.length === 0 && (
                        <div className="text-gray-500 text-xs text-center mt-4">No chats yet</div>
                    )}
                    {chats.map((chat) => (
                        <div key={chat.id} className="relative group">
                            <button
                                onClick={() => handleLoadChat(chat.id)}
                                className={clsx(
                                    "w-full text-left flex items-center gap-3 p-3 rounded-lg text-sm transition-colors pr-8",
                                    activeChatId === chat.id ? "bg-gray-800 text-white" : "text-gray-300 hover:bg-gray-900"
                                )}
                            >
                                <MessageSquare size={16} className="shrink-0" />
                                <span className="truncate">{chat.title || 'New Chat'}</span>
                            </button>
                            {/* Delete button (visible on hover) */}
                            <button
                                onClick={(e) => { e.stopPropagation(); deleteChat(chat.id); }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-500 hover:text-red-400 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Delete chat"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="p-3 border-t border-gray-800 space-y-1">
                    <button
                        onClick={onOpenSettings}
                        className="w-full flex items-center gap-3 p-3 text-sm text-white hover:bg-gray-800 rounded-lg transition-colors"
                    >
                        <Settings size={18} />
                        <span>Settings</span>
                    </button>
                    <a
                        href="https://openrouter.ai/docs"
                        target="_blank"
                        rel="noreferrer"
                        className="w-full flex items-center gap-3 p-3 text-sm text-gray-400 hover:bg-gray-900 rounded-lg transition-colors"
                    >
                        <ExternalLink size={18} />
                        <span>API Docs</span>
                    </a>
                </div>
            </div>
        </>
    );
}
