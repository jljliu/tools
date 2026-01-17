import React, { useRef, useEffect } from 'react';
import MessageBubble from './MessageBubble';
import InputArea from './InputArea';
import useStore from '../store/useStore';
import { Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

export default function ChatArea() {
    const {
        messages,
        activeChatId,
        addMessage,
        updateLastMessage,
        saveCurrentChat,
        apiKey,
        activeModel,
        isLoading,
        sidebarOpen,
        toggleSidebar
    } = useStore();

    const bottomRef = useRef(null);
    const scrollContainerRef = useRef(null);
    const shouldScrollRef = useRef(true);

    // Check if user is at bottom before update
    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const handleScroll = () => {
            const { scrollTop, scrollHeight, clientHeight } = container;
            // Strict tolerance to allow easier "escape" from auto-scroll
            const isAtBottom = scrollHeight - scrollTop - clientHeight <= 10;
            shouldScrollRef.current = isAtBottom;
        };

        container.addEventListener('scroll', handleScroll);
        return () => container.removeEventListener('scroll', handleScroll);
    }, []);

    // Scroll after messages update if we should
    useEffect(() => {
        if (shouldScrollRef.current) {
            bottomRef.current?.scrollIntoView({ behavior: 'auto' });
        }
    }, [messages]);

    const handleSend = async (text, images) => {
        if (!apiKey) {
            alert('Please set your OpenRouter API key in settings.');
            return;
        }

        try {
            useStore.setState({ isLoading: true });

            // Add user message locally
            await addMessage('user', text, images);

            // Prepare context for API
            // Filter out images for context if model doesn't support vision? 
            // For simplicity, we assume text-only context for history, and multimodal for active request if implemented
            // But OpenRouter supports array content for multimodal.
            // Let's format the last message properly.

            const apiMessages = messages.map(m => ({
                role: m.role,
                content: m.images?.length ? [
                    { type: 'text', text: m.content },
                    ...m.images.map(img => ({ type: 'image_url', image_url: { url: img } }))
                ] : m.content
            }));

            // Append current new message
            const newMessageContent = images.length ? [
                { type: 'text', text: text },
                ...images.map(img => ({ type: 'image_url', image_url: { url: img } }))
            ] : text;

            apiMessages.push({ role: 'user', content: newMessageContent });

            // Add placeholder AI message
            await addMessage('assistant', '');

            // Stream
            const { openRouter } = await import('../services/openrouter');
            let fullResponse = '';

            await openRouter.streamChat(apiKey, activeModel, apiMessages, (chunk, usage) => {
                fullResponse += chunk;
                updateLastMessage(fullResponse, usage ? { usage } : undefined);
            });

            // Final save
            await saveCurrentChat();

        } catch (error) {
            console.error(error);
            updateLastMessage(`Error: ${error.message}`);
        } finally {
            useStore.setState({ isLoading: false });
        }
    };

    const WelcomeScreen = () => (
        <div className="flex flex-col items-center justify-center h-full text-center text-white px-4">
            <div className="bg-white/10 p-4 rounded-full mb-6">
                <span className="text-4xl">🤖</span>
            </div>
            <h2 className="text-2xl font-bold mb-2">Welcome to OpenRouter Chat</h2>
            <p className="text-gray-400 max-w-md">
                Start a conversation by typing a message below. You configure your API key in the settings.
            </p>
        </div>
    );

    return (
        <div className="flex-1 flex flex-col h-full bg-gray-900 relative">
            {/* Top Bar (Mobile/Toggle) */}
            <div className="sticky top-0 z-10 p-2 text-white flex items-center md:hidden">
                <button onClick={toggleSidebar} className="p-2 hover:bg-gray-800 rounded-lg">
                    <Menu size={24} />
                </button>
                <span className="font-semibold ml-2">OpenRouter Chat</span>
            </div>

            {/* Desktop Toggle (Overlay top-left) */}
            <div className="hidden md:block absolute top-2 left-2 z-10">
                {!sidebarOpen && (
                    <button
                        onClick={toggleSidebar}
                        className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg"
                        title="Open Sidebar"
                    >
                        <PanelLeftOpen size={24} />
                    </button>
                )}
                {sidebarOpen && (
                    <button
                        onClick={toggleSidebar}
                        className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg"
                        title="Close Sidebar"
                    >
                        <PanelLeftClose size={24} />
                    </button>
                )}
            </div>

            {/* Messages */}
            <div
                ref={scrollContainerRef}
                className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 pt-10 md:pt-4"
            >
                {!activeChatId || messages.length === 0 ? (
                    <WelcomeScreen />
                ) : (
                    <div className="max-w-3xl mx-auto min-h-full pb-4">
                        {messages.map((msg) => (
                            <MessageBubble key={msg.id} message={msg} />
                        ))}
                        <div ref={bottomRef} className="h-4" />
                    </div>
                )}
            </div>

            {/* Input */}
            <div className="shrink-0 pb-6 pt-2 bg-gradient-to-t from-gray-900 via-gray-900 to-transparent">
                <InputArea onSend={handleSend} isLoading={isLoading} />
            </div>
        </div>
    );
}
