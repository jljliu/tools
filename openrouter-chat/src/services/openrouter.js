const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1';

export const openRouter = {
    async fetchModels(apiKey) {
        const response = await fetch(`${OPENROUTER_API_URL}/models`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${apiKey}`,
            },
        });

        if (!response.ok) {
            throw new Error('Failed to fetch models');
        }

        return response.json();
    },

    async streamChat(apiKey, model, messages, onChunk) {
        const response = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
                'HTTP-Referer': window.location.origin, // Required by OpenRouter
                'X-Title': 'OpenRouter Chat App',
            },
            body: JSON.stringify({
                model,
                messages,
                stream: true,
            }),
        });

        if (!response.ok) {
            let errorBody;
            try {
                errorBody = await response.text();
            } catch (e) {
                errorBody = response.statusText;
            }
            throw new Error(`Chat error: ${response.status} - ${errorBody}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop(); // Keep the last incomplete line in buffer

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith('data: ')) continue;

                const dataStr = trimmed.slice(6); // Remove 'data: '
                if (dataStr === '[DONE]') continue;

                try {
                    const json = JSON.parse(dataStr);
                    const content = json.choices[0]?.delta?.content || '';
                    const usage = json.usage || null;

                    if (content || usage) {
                        onChunk(content, usage);
                    }
                } catch (e) {
                    console.error('Error parsing stream chunk:', e);
                }
            }
        }
    },
};
