import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { gptService } from '@/services/gptService';
import { toast } from 'sonner';

interface Message {
    role: 'user' | 'assistant';
    content: string;
    createdAt?: string;
    isNew?: boolean;
}

interface Conversation {
    id: number;
    title: string;
    updatedAt: string;
}

interface GptContextType {
    messages: Message[];
    isLoading: boolean;
    conversations: Conversation[];
    activeConversationId: number | null;
    fetchConversations: () => Promise<void>;
    handleSelectConversation: (id: number) => Promise<void>;
    handleNewChat: () => void;
    sendMessage: (content: string, selectedDocIds: number[]) => Promise<void>;
    clearHistory: () => Promise<void>;
    deleteConversation: (id: number) => Promise<void>;
}

const GptContext = createContext<GptContextType | undefined>(undefined);

export function GptProvider({ children }: { children: React.ReactNode }) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activeConversationId, setActiveConversationId] = useState<number | null>(null);

    const fetchConversations = useCallback(async () => {
        try {
            const data = await gptService.getConversations();
            setConversations(data);
        } catch (error) {
            console.error('Error fetching conversations:', error);
        }
    }, []);

    const handleSelectConversation = async (id: number) => {
        try {
            setIsLoading(true);
            setActiveConversationId(id);
            const history = await gptService.getHistory(id);
            setMessages(history.map((m: any) => ({ ...m, isNew: false })));
        } catch (error) {
            toast.error('Failed to load conversation history');
        } finally {
            setIsLoading(false);
        }
    };

    const handleNewChat = () => {
        setActiveConversationId(null);
        setMessages([]);
    };

    const sendMessage = async (content: string, selectedDocIds: number[]) => {
        if (!content.trim() || isLoading) return;

        const newUserMsg: Message = { role: 'user', content: content.trim(), isNew: false };
        const placeholderAssistantMsg: Message = { role: 'assistant', content: '', isNew: true };

        setMessages(prev => [...prev, newUserMsg, placeholderAssistantMsg]);
        setIsLoading(true);

        let accumulatedResponse = '';
        let isNewChat = !activeConversationId;

        try {
            await gptService.chatStream(
                content.trim(),
                activeConversationId || undefined,
                selectedDocIds,
                (chunk) => {
                    if (chunk.startsWith('__METADATA__')) {
                        try {
                            const metadata = JSON.parse(chunk.substring(12));
                            if (metadata.conversationId) {
                                setActiveConversationId(metadata.conversationId);
                                fetchConversations();
                            }
                        } catch (e) {
                            console.error('Failed to parse metadata', e);
                        }
                        return;
                    }

                    accumulatedResponse += chunk;
                    setMessages(prev => {
                        const newMessages = [...prev];
                        const lastMsg = newMessages[newMessages.length - 1];
                        if (lastMsg.role === 'assistant') {
                            lastMsg.content = accumulatedResponse;
                        }
                        return newMessages;
                    });
                }
            );

            // After stream finishes, maybe refresh conversations if it was new
            if (isNewChat) {
                fetchConversations();
            }
        } catch (error) {
            toast.error('Failed to get response from AI');
            console.error(error);
            setMessages(prev => prev.filter(m => m.content !== '')); // Remove failed assistant msg
        } finally {
            setIsLoading(false);
            setMessages(prev => {
                const newMessages = [...prev];
                const lastMsg = newMessages[newMessages.length - 1];
                if (lastMsg && lastMsg.role === 'assistant') {
                    lastMsg.isNew = false;
                }
                return newMessages;
            });
        }

    };

    const clearHistory = async () => {
        try {
            await gptService.clearAllHistory();
            setConversations([]);
            handleNewChat();
            toast.success('All history cleared');
        } catch (error) {
            toast.error('Failed to clear history');
        }
    };

    const deleteConversation = async (id: number) => {
        try {
            await gptService.deleteConversation(id);
            setConversations(prev => prev.filter(c => c.id !== id));
            if (activeConversationId === id) {
                handleNewChat();
            }
            toast.success('Chat deleted');
        } catch (error) {
            toast.error('Failed to delete chat');
        }
    };

    return (
        <GptContext.Provider value={{
            messages,
            isLoading,
            conversations,
            activeConversationId,
            fetchConversations,
            handleSelectConversation,
            handleNewChat,
            sendMessage,
            clearHistory,
            deleteConversation
        }}>
            {children}
        </GptContext.Provider>
    );
}

export const useGpt = () => {
    const context = useContext(GptContext);
    if (!context) {
        throw new Error('useGpt must be used within a GptProvider');
    }
    return context;
};
