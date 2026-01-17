import React, { useState } from 'react';
import { X } from 'lucide-react';
import useStore from '../store/useStore';

export default function SettingsModal({ onClose }) {
    const { apiKey, setApiKey, fetchModels } = useStore();
    const [keyInput, setKeyInput] = useState(apiKey);
    const [error, setError] = useState('');

    const handleSaveKey = async () => {
        if (!keyInput.trim()) return;
        setApiKey(keyInput.trim());
        await fetchModels(keyInput.trim());
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-gray-800 text-white w-full max-w-md rounded-lg p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-200">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white">
                    <X size={20} />
                </button>

                <h2 className="text-xl font-bold mb-4">Settings</h2>

                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        OpenRouter API Key
                    </label>
                    <div className="flex gap-2">
                        <input
                            type="password"
                            value={keyInput}
                            onChange={(e) => setKeyInput(e.target.value)}
                            className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white outline-none focus:border-blue-500"
                            placeholder="sk-or-..."
                        />
                        <button
                            onClick={handleSaveKey}
                            disabled={!keyInput}
                            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded font-medium disabled:opacity-50"
                        >
                            Save
                        </button>
                    </div>
                    {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
                    <p className="text-gray-500 text-xs mt-2">
                        Key is stored locally in your browser.
                    </p>
                </div>

                <div className="mt-6 flex justify-end">
                    <button
                        onClick={onClose}
                        className="text-gray-300 hover:text-white px-4 py-2"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
