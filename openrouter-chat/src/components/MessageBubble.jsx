import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { User, Bot } from 'lucide-react';
import clsx from 'clsx';
import useStore from '../store/useStore';
// Standard highlighter CSS is needed or we can rely on tailwind typography, 
// strictly speaking rehype-highlight adds classes `hljs ...`, so we might need a basic highlight.js css imported in index.css
// But for now, we'll assume basic styling or no verify strict highlighting yet.

export default function MessageBubble({ message }) {
    const { models } = useStore();
    const isUser = message.role === 'user';

    // Calculate cost if usage and model info is available
    let cost = null;
    if (message.usage && message.model) {
        const modelInfo = models.find(m => m.id === message.model);
        if (modelInfo?.pricing) {
            const { prompt, completion } = modelInfo.pricing;
            const promptCost = (message.usage.prompt_tokens || 0) * parseFloat(prompt);
            const completionCost = (message.usage.completion_tokens || 0) * parseFloat(completion);
            cost = promptCost + completionCost;
        }
    }

    return (
        <div className={clsx("flex gap-4 w-full p-4 border-b border-gray-800", isUser ? "bg-gray-800/30" : "bg-transparent")}>
            <div className={clsx("w-8 h-8 rounded-full flex items-center justify-center shrink-0", isUser ? "bg-gray-700" : "bg-green-600")}>
                {isUser ? <User size={18} /> : <Bot size={18} />}
            </div>

            <div className="flex-1 min-w-0 overflow-x-auto space-y-2">
                <div className="font-bold text-sm text-white mb-1">
                    {isUser ? 'You' : 'OpenRouter'}
                </div>

                {/* Images */}
                {message.images && message.images.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                        {message.images.map((img, idx) => (
                            <img key={idx} src={img} alt="User upload" className="max-w-xs max-h-64 rounded bg-black/50 object-contain" />
                        ))}
                    </div>
                )}

                <div className="prose prose-invert prose-sm max-w-none break-words text-gray-100/90 leading-7">
                    <ReactMarkdown
                        // remarkPlugins={[remarkGfm]}
                        // rehypePlugins={[rehypeHighlight]}
                        components={{
                            code({ node, inline, className, children, ...props }) {
                                const match = /language-(\w+)/.exec(className || '')
                                return !inline && match ? (
                                    <div className="rounded-md overflow-hidden bg-[#1e1e1e] my-2 border border-gray-700">
                                        <div className="w-full bg-gray-800 px-3 py-1 flex justify-between items-center text-xs text-gray-400 border-b border-gray-700">
                                            <span>{match[1]}</span>
                                        </div>
                                        <code className={className} {...props}>
                                            {children}
                                        </code>
                                    </div>
                                ) : (
                                    <code className={clsx(className, "bg-gray-800 px-1 py-0.5 rounded text-sm")} {...props}>
                                        {children}
                                    </code>
                                )
                            }
                        }}
                    >
                        {message.content}
                    </ReactMarkdown>
                </div>

                {/* Metadata Footer */}
                {(message.model || message.usage) && (
                    <div className="mt-2 pt-2 border-t border-gray-800/50 text-[10px] text-gray-500 font-mono flex flex-wrap gap-x-4 gap-y-1">
                        {message.model && (
                            <span className="text-gray-400">{message.model}</span>
                        )}
                        {message.usage && (
                            <>
                                <span title="Prompt Tokens">In: {message.usage.prompt_tokens || 0}</span>
                                <span title="Completion Tokens">Out: {message.usage.completion_tokens || 0}</span>
                                <span title="Total Tokens">Total: {message.usage.total_tokens || ((message.usage.prompt_tokens || 0) + (message.usage.completion_tokens || 0))}</span>
                            </>
                        )}
                        {cost !== null && (
                            <span className="text-green-500/80">
                                ${cost.toFixed(6)}
                            </span>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
