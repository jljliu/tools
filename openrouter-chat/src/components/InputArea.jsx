import React, { useState, useRef, useEffect } from 'react';
import { Send, Image as ImageIcon, X, ChevronDown, ChevronUp, Bot, Search } from 'lucide-react';
import clsx from 'clsx';
import useStore from '../store/useStore';

export default function InputArea({ onSend, isLoading }) {
    const { models, activeModel, setActiveModel, isFetchingModels } = useStore();
    const [input, setInput] = useState('');
    const [images, setImages] = useState([]); // Array of base64 strings
    const [showModelMenu, setShowModelMenu] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const textareaRef = useRef(null);
    const fileInputRef = useRef(null);
    const modelMenuRef = useRef(null);
    const searchInputRef = useRef(null);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
        }
    }, [input]);

    // Focus search when menu opens
    useEffect(() => {
        if (showModelMenu && searchInputRef.current) {
            // Small timeout to allow render
            setTimeout(() => searchInputRef.current?.focus(), 50);
        }
    }, [showModelMenu]);

    // Click outside listener for model menu
    useEffect(() => {
        function handleClickOutside(event) {
            if (modelMenuRef.current && !modelMenuRef.current.contains(event.target)) {
                setShowModelMenu(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleSend = () => {
        if ((!input.trim() && images.length === 0) || isLoading) return;

        onSend(input, images);
        setInput('');
        setImages([]);
        // Reset height
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
    };

    const handleFileSelect = (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        files.forEach(file => {
            const reader = new FileReader();
            reader.onloadend = () => {
                setImages(prev => [...prev, reader.result]);
            };
            reader.readAsDataURL(file);
        });
        // Reset input so same file can be selected again if removed
        e.target.value = null;
    };

    const removeImage = (index) => {
        setImages(prev => prev.filter((_, i) => i !== index));
    };

    const currentModelName = models.find(m => m.id === activeModel)?.name || activeModel || 'Select Model';

    const filteredModels = models.filter(m =>
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.id.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="w-full max-w-4xl mx-auto p-4 bg-gray-900 flex flex-col gap-2">
            {/* Model Selector */}
            <div className="relative self-start" ref={modelMenuRef}>
                <button
                    onClick={() => setShowModelMenu(!showModelMenu)}
                    className="flex items-center gap-2 text-xs font-medium text-gray-400 hover:text-white bg-gray-800/50 hover:bg-gray-800 px-3 py-1.5 rounded-full transition-colors border border-transparent hover:border-gray-700"
                    title="Change Model"
                >
                    <Bot size={14} />
                    <span className="max-w-[200px] truncate">{isFetchingModels ? 'Loading Models...' : currentModelName}</span>
                    {showModelMenu ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {showModelMenu && (
                    <div className="absolute bottom-full mb-2 left-0 w-72 max-h-[400px] bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden z-50 flex flex-col">
                        <div className="p-2 border-b border-gray-700 bg-gray-800 sticky top-0 z-10">
                            <div className="relative">
                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search models..."
                                    className="w-full bg-gray-900 border border-gray-700 rounded text-xs text-white pl-8 pr-2 py-1.5 focus:outline-none focus:border-blue-500 placeholder:text-gray-500"
                                    onClick={(e) => e.stopPropagation()}
                                />
                            </div>
                        </div>

                        <div className="overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 min-h-0">
                            {filteredModels.length > 0 ? (
                                filteredModels.map(model => (
                                    <button
                                        key={model.id}
                                        onClick={() => { setActiveModel(model.id); setShowModelMenu(false); setSearchQuery(''); }}
                                        className={clsx(
                                            "w-full text-left px-4 py-2.5 text-sm hover:bg-gray-700 transition-colors border-l-2",
                                            activeModel === model.id ? "bg-gray-700/50 text-white border-green-500" : "text-gray-300 border-transparent"
                                        )}
                                    >
                                        <div className="font-medium truncate">{model.name}</div>
                                        <div className="text-[10px] text-gray-500 truncate">{model.id}</div>
                                    </button>
                                ))
                            ) : (
                                <div className="p-4 text-center text-sm text-gray-500">
                                    {isFetchingModels ? 'Loading...' : 'No models found.'}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Image Previews */}
            {images.length > 0 && (
                <div className="flex gap-2 overflow-x-auto mb-2 pb-2">
                    {images.map((img, idx) => (
                        <div key={idx} className="relative shrink-0 group">
                            <img src={img} alt="preview" className="h-16 w-16 object-cover rounded-md border border-gray-700" />
                            <button
                                onClick={() => removeImage(idx)}
                                className="absolute -top-1 -right-1 bg-gray-800 text-white rounded-full p-0.5 shadow hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <X size={12} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <div className={clsx("relative flex items-end gap-2 bg-gray-800 p-3 rounded-xl border", isLoading ? "border-gray-700 opacity-70" : "border-gray-700 focus-within:border-gray-500")}>
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-gray-700 shrink-0 transition-colors"
                    title="Attach image"
                >
                    <ImageIcon size={20} />
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*"
                        multiple
                        onChange={handleFileSelect}
                    />
                </button>

                <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`Message ${currentModelName}...`}
                    rows={1}
                    disabled={isLoading}
                    className="w-full bg-transparent text-white border-0 focus:ring-0 resize-none py-2 max-h-[200px] overflow-y-auto scrollbar-hide text-base"
                />

                <button
                    onClick={handleSend}
                    disabled={(!input.trim() && images.length === 0) || isLoading}
                    className={clsx(
                        "p-2 rounded-lg shrink-0 transition-all",
                        (!input.trim() && images.length === 0) || isLoading
                            ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                            : "bg-white text-gray-900 hover:opacity-90"
                    )}
                >
                    <Send size={18} />
                </button>
            </div>
            <div className="text-center text-xs text-gray-500 mt-1">
                AI can make mistakes. Consider checking important information.
            </div>
        </div>
    );
}
