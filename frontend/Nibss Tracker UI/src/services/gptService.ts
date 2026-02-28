const API_BASE_URL = 'http://localhost:5001/api';

class GptService {
    private baseURL = API_BASE_URL;

    private getHeaders() {
        const token = localStorage.getItem('token');
        return {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        };
    }

    async chat(message: string, conversationId?: number, selectedDocumentIds?: number[]) {
        const response = await fetch(`${this.baseURL}/gpt/chat`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ message, conversationId, selectedDocumentIds }),
        });

        if (!response.ok) {
            throw new Error('Failed to chat with NIBSS GPT');
        }

        return response.json();
    }

    async chatStream(message: string, conversationId?: number, selectedDocumentIds?: number[], onChunk?: (text: string) => void) {
        const response = await fetch(`${this.baseURL}/gpt/chat-stream`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ message, conversationId, selectedDocumentIds }),
        });

        if (!response.ok) {
            throw new Error('Failed to start chat stream');
        }

        const reader = response.body?.getReader();
        if (!reader) return;

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const jsonStr = line.substring(6);
                    try {
                        const text = JSON.parse(jsonStr);
                        if (text) onChunk?.(text);
                    } catch (e) {
                        // Fallback if it's not JSON for some reason
                        if (jsonStr) onChunk?.(jsonStr);
                    }
                }
            }
        }
    }

    async getConversations() {
        const response = await fetch(`${this.baseURL}/gpt/conversations`, {
            method: 'GET',
            headers: this.getHeaders(),
        });

        if (!response.ok) {
            throw new Error('Failed to fetch conversations');
        }

        return response.json();
    }

    async getHistory(conversationId: number) {
        const response = await fetch(`${this.baseURL}/gpt/conversations/${conversationId}/history`, {
            method: 'GET',
            headers: this.getHeaders(),
        });

        if (!response.ok) {
            throw new Error('Failed to fetch history');
        }

        return response.json();
    }

    async deleteConversation(conversationId: number) {
        const response = await fetch(`${this.baseURL}/gpt/conversations/${conversationId}`, {
            method: 'DELETE',
            headers: this.getHeaders(),
        });

        if (!response.ok) {
            throw new Error('Failed to delete conversation');
        }

        return true;
    }

    async clearAllHistory() {
        const response = await fetch(`${this.baseURL}/gpt/conversations`, {
            method: 'DELETE',
            headers: this.getHeaders(),
        });

        if (!response.ok) {
            throw new Error('Failed to clear conversation history');
        }

        return true;
    }

    async uploadDocument(file: File) {
        const formData = new FormData();
        formData.append('file', file);

        const token = localStorage.getItem('token');
        const response = await fetch(`${this.baseURL}/gpt/documents/upload`, {
            method: 'POST',
            headers: {
                ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            },
            body: formData,
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(error || 'Failed to upload document');
        }

        return response.json();
    }

    async getDocuments() {
        const response = await fetch(`${this.baseURL}/gpt/all-ingested`, {
            method: 'GET',
            headers: this.getHeaders(),
        });

        if (!response.ok) {
            throw new Error('Failed to fetch documents');
        }

        return response.json();
    }

    async deleteDocument(id: number) {
        const response = await fetch(`${this.baseURL}/gpt/documents/${id}`, {
            method: 'DELETE',
            headers: this.getHeaders(),
        });

        if (!response.ok) {
            throw new Error('Failed to delete document');
        }

        return true;
    }
}

export const gptService = new GptService();
export default gptService;
