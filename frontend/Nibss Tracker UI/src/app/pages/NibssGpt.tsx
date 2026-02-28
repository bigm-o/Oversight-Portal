import React, { useState, useEffect, useRef } from 'react';
import {
    Send, Plus, Trash2, Bot, User, Sparkles, Upload,
    FileText, Loader2, MessageSquare, Shield, Code2,
    AlertCircle, ChevronLeft, ChevronRight, History,
    MoreVertical, Settings, ExternalLink, Globe
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { gptService } from '@/services/gptService';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/app/components/ui/alert-dialog";
import { useGpt } from '@/contexts/GptContext';

const Typewriter = ({ text, onComplete }: { text: string; onComplete?: () => void }) => {
    const [displayedText, setDisplayedText] = useState('');
    const [index, setIndex] = useState(0);

    useEffect(() => {
        if (index < text.length) {
            const timeout = setTimeout(() => {
                setDisplayedText(prev => prev + text[index]);
                setIndex(prev => prev + 1);
            }, 5);
            return () => clearTimeout(timeout);
        } else {
            onComplete?.();
        }
    }, [index, text]);

    return (
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {displayedText}
        </ReactMarkdown>
    );
};

export function NibssGpt() {
    const { user } = useAuth();
    const {
        messages, isLoading, conversations, activeConversationId,
        fetchConversations, handleSelectConversation, handleNewChat,
        sendMessage, clearHistory, deleteConversation
    } = useGpt();

    const [input, setInput] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [convToDelete, setConvToDelete] = useState<number | null>(null);
    const [isClearAllConfirmOpen, setIsClearAllConfirmOpen] = useState(false);
    const [documents, setDocuments] = useState<any[]>([]);
    const [selectedDocIds, setSelectedDocIds] = useState<number[]>([]);
    const [isKnowledgeBaseVisible, setIsKnowledgeBaseVisible] = useState(true);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const isAdmin = user?.role === 'Admin' || user?.permissions?.admin;

    useEffect(() => {
        fetchConversations();
        fetchDocuments();

        const handleMainSidebarToggle = () => {
            setIsSidebarOpen(false);
        };

        window.addEventListener('mainSidebarToggle', handleMainSidebarToggle);
        return () => window.removeEventListener('mainSidebarToggle', handleMainSidebarToggle);
    }, [fetchConversations]);

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const fetchDocuments = async () => {
        try {
            const data = await gptService.getDocuments();
            setDocuments(data);
        } catch (error) {
            console.error('Error fetching documents:', error);
            toast.error('Failed to load global knowledge base documents');
        }
    };

    const handleTagDocument = (id: number) => {
        setSelectedDocIds(prev =>
            prev.includes(id) ? prev.filter(dId => dId !== id) : [...prev, id]
        );
    };

    const onSelectConversation = async (id: number) => {
        setIsSidebarOpen(false); // Close history sidebar
        await handleSelectConversation(id);
    };

    const onNewChat = () => {
        setIsSidebarOpen(false);
        handleNewChat();
    };

    const handleClearHistoryAction = () => {
        setIsClearAllConfirmOpen(true);
    };

    const confirmClearAll = async () => {
        await clearHistory();
        setIsClearAllConfirmOpen(false);
    };

    const handleSendMessage = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!input.trim() || isLoading) return;

        const content = input;
        setInput('');
        await sendMessage(content, selectedDocIds);
        setSelectedDocIds([]);
    };

    const handleDeleteConversation = (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        setConvToDelete(id);
    };

    const handleDeleteDocument = async (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        try {
            await gptService.deleteDocument(id);
            setDocuments(prev => prev.filter(d => d.id !== id));
            setSelectedDocIds(prev => prev.filter(dId => dId !== id));
            toast.success('Knowledge document removed');
        } catch (error) {
            toast.error('Failed to delete document');
        }
    };

    const confirmDeleteConversation = async () => {
        if (!convToDelete) return;
        await deleteConversation(convToDelete);
        setConvToDelete(null);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const allowedTypes = ['.pdf', '.docx', '.txt'];
        const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

        if (!allowedTypes.includes(extension)) {
            toast.error('Only PDF, DOCX, and TXT files are allowed');
            return;
        }

        setIsUploading(true);
        try {
            await gptService.uploadDocument(file);
            toast.success(`${file.name} ingested successfully`);
            fetchDocuments(); // Refresh documents after upload
        } catch (error: any) {
            toast.error(error.message || 'Upload failed');
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <div className="flex h-full w-full overflow-hidden bg-background antialiased">

            {/* Sidebar Transition */}
            <motion.aside
                initial={false}
                animate={{ width: isSidebarOpen ? 300 : 0, opacity: isSidebarOpen ? 1 : 0 }}
                className="h-full bg-white dark:bg-[#0b0c0d] border-r border-border/80 flex flex-col z-40 overflow-hidden shadow-xl"
            >
                <div className="p-5 flex items-center justify-between border-b border-border/50">
                    <button
                        onClick={onNewChat}
                        className="flex items-center gap-2 px-5 py-2 bg-green-700 hover:bg-green-800 text-white rounded-full transition-all text-xs font-bold shadow-md shadow-green-900/10"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        New Chat
                    </button>
                    <button
                        onClick={() => setIsSidebarOpen(false)}
                        className="p-1.5 hover:bg-muted dark:hover:bg-slate-800 rounded-full text-muted-foreground transition-colors"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-2 py-4 space-y-1 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                    <h3 className="px-5 text-[9px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-3">Past Sessions</h3>
                    {conversations.map((conv) => (
                        <div
                            key={conv.id}
                            onClick={() => onSelectConversation(conv.id)}
                            className={`group flex items-center gap-3 px-5 py-2.5 rounded-xl cursor-pointer transition-all text-xs ${activeConversationId === conv.id
                                ? 'bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 font-bold border border-green-100/30'
                                : 'hover:bg-muted/50 dark:hover:bg-white/5 text-foreground/80'
                                }`}
                        >
                            <MessageSquare className={`w-3.5 h-3.5 flex-shrink-0 ${activeConversationId === conv.id ? 'text-green-600' : 'text-muted-foreground/60'}`} />
                            <span className="truncate flex-1">{conv.title}</span>
                            <button
                                onClick={(e) => handleDeleteConversation(e, conv.id)}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 rounded-md transition-all"
                            >
                                <Trash2 className="w-3 h-3" />
                            </button>
                        </div>
                    ))}
                </div>

                <div className="p-4 border-t border-border/50 space-y-4 bg-muted/5">
                    {/* Documents List Added Here */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between px-1">
                            <h3 className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Global Knowledge</h3>
                            <button
                                onClick={() => setIsKnowledgeBaseVisible(!isKnowledgeBaseVisible)}
                                className="text-[9px] font-bold text-green-600 hover:text-green-700"
                            >
                                {isKnowledgeBaseVisible ? 'HIDE' : 'SHOW'}
                            </button>
                        </div>

                        <AnimatePresence>
                            {isKnowledgeBaseVisible && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="space-y-1 max-h-[200px] overflow-y-auto no-scrollbar"
                                >
                                    {documents.length === 0 ? (
                                        <div className="px-5 py-3 text-[10px] text-muted-foreground italic bg-muted/30 rounded-lg">
                                            No documents ingested yet.
                                        </div>
                                    ) : (
                                        documents.map((doc) => (
                                            <div
                                                key={doc.id}
                                                onClick={() => handleTagDocument(doc.id)}
                                                className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all border ${selectedDocIds.includes(doc.id)
                                                    ? 'bg-green-50 dark:bg-green-950/20 border-green-200/50 text-green-700 dark:text-green-400'
                                                    : 'bg-white dark:bg-white/5 border-border hover:border-green-500/50 text-foreground/70'
                                                    }`}
                                            >
                                                <FileText className={`w-3 h-3 ${selectedDocIds.includes(doc.id) ? 'text-green-600' : 'text-muted-foreground'}`} />
                                                <span className="text-[10px] font-bold truncate flex-1">{doc.title}</span>
                                                {isAdmin ? (
                                                    <button
                                                        onClick={(e) => handleDeleteDocument(e, doc.id)}
                                                        className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 rounded-md transition-all ml-1"
                                                    >
                                                        <Trash2 className="w-2.5 h-2.5 shadow-sm" />
                                                    </button>
                                                ) : (
                                                    selectedDocIds.includes(doc.id) && (
                                                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full shadow-[0_0_5px_#22c55e]" />
                                                    )
                                                )}
                                            </div>
                                        ))
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {isAdmin && (
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                            className="w-full flex items-center gap-3 px-5 py-3 bg-green-700 hover:bg-green-800 text-white rounded-xl transition-all text-xs font-bold shadow-lg shadow-green-900/10"
                        >
                            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                            Knowledge Ingestion
                        </button>
                    )}
                </div>
            </motion.aside>

            {/* Main Chat Area */}
            <div className={`flex-1 flex flex-col relative transition-all duration-500`}>

                {/* Header Area */}
                <div className="h-14 flex items-center justify-between px-6 sm:px-10 border-b border-border/40 bg-white dark:bg-card z-30 sticky top-0">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                                className="flex items-center gap-2 px-3 py-1.5 bg-green-700 hover:bg-green-800 text-white rounded-full shadow-md transition-all text-[11px] font-black uppercase tracking-widest"
                            >
                                <History className="w-3.5 h-3.5" />
                                {isSidebarOpen ? 'Hide History' : 'History'}
                            </button>
                            <button
                                onClick={handleClearHistoryAction}
                                title="Purge all history"
                                className="p-2 text-muted-foreground hover:text-red-500 transition-colors bg-muted/50 dark:bg-white/5 rounded-full"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        <div className="flex items-center gap-3 ml-4">
                            <div className="w-10 h-10 bg-green-50 dark:bg-green-950/30 rounded-xl flex items-center justify-center border border-green-100/20">
                                <Bot className="w-6 h-6 text-green-700 dark:text-green-500" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-xl font-black tracking-tight text-green-700 dark:text-green-500 uppercase leading-none">NIBSS GPT</span>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_#22c55e]" />
                                    <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-green-600/80 dark:text-green-400">Multi-Agent Intelligence Engine</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 px-3 py-1 bg-muted dark:bg-white/5 border border-border rounded-full">
                            <Shield className="w-3.5 h-3.5 text-green-700" />
                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground/80 dark:text-white">Governance Layer</span>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto no-scrollbar scroll-smooth pt-4">
                    <div className="max-w-3xl mx-auto w-full pb-32 px-6 sm:px-10">
                        {messages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center text-center space-y-6 pt-8">
                                <div className="w-16 h-16 bg-green-50 dark:bg-green-950/20 rounded-[1.5rem] flex items-center justify-center relative group shadow-sm border border-green-100/50">
                                    <Bot className="w-8 h-8 text-green-700 dark:text-green-500" />
                                    <div className="absolute -top-1 -right-1 w-6 h-6 bg-white border border-border rounded-lg flex items-center justify-center shadow-sm">
                                        <Sparkles className="w-3 h-3 text-green-600" />
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <h1 className="text-3xl sm:text-4xl font-black text-foreground tracking-tighter dark:text-white">
                                        Welcome {user?.firstName?.split(' ')[0]}
                                    </h1>
                                    <p className="text-sm sm:text-base text-muted-foreground max-w-lg mx-auto font-medium leading-relaxed dark:text-gray-300">
                                        Access real-time NIBSS intelligence. Analyze SLA delivery, JIRA tickets, and Incident trends with precision.
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl mt-8">
                                    {[
                                        { text: "Summarize active P1 incidents", icon: AlertCircle },
                                        { text: "Current project delivery status", icon: Code2 },
                                        { text: "Explain governance protocols", icon: Shield },
                                        { text: "Brief risk analysis of tickets", icon: FileText }
                                    ].map((item, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setInput(item.text)}
                                            className="flex items-center gap-4 p-4 text-sm sm:text-base font-bold text-left bg-white dark:bg-white/5 border border-border dark:border-white/10 rounded-2xl hover:border-green-500 hover:bg-green-50/50 dark:hover:bg-green-500/10 transition-all group shadow-sm"
                                        >
                                            <div className="w-10 h-10 rounded-xl bg-muted dark:bg-white/10 flex items-center justify-center group-hover:bg-green-100 dark:group-hover:bg-green-950 transition-colors">
                                                <item.icon className="w-5 h-5 text-muted-foreground group-hover:text-green-700 dark:group-hover:text-green-500" />
                                            </div>
                                            <span className="flex-1 text-foreground/80 group-hover:text-foreground dark:text-gray-200">{item.text}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            messages.map((msg, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                                    className={`flex gap-3 sm:gap-4 group ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                                >
                                    {/* Icon Container - Reduced Size */}
                                    <div className="w-9 h-9 rounded-2xl flex-shrink-0 flex items-center justify-center shadow-sm overflow-hidden border border-border/50">
                                        {msg.role === 'user' ? (
                                            <div className="w-full h-full bg-slate-900 flex items-center justify-center text-white text-[10px] font-black">
                                                {user?.firstName?.charAt(0) || 'U'}
                                            </div>
                                        ) : (
                                            <div className="w-full h-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                                <Bot className="w-4.5 h-4.5 text-green-700 dark:text-green-500" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Message Content */}
                                    <div className={`flex-1 space-y-2 pt-1 max-w-[85%] sm:max-w-[80%] ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                                        <div className={`flex items-center ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">
                                                {msg.role === 'user' ? 'User Identity' : 'NIBSS Intelligence Engine'}
                                            </span>
                                        </div>
                                        <div
                                            className={`text-[15px] leading-relaxed font-medium prose dark:prose-invert max-w-none
                                            ${msg.role === 'user'
                                                    ? 'bg-muted/40 dark:bg-white/5 px-4 py-3 rounded-2xl inline-block text-left text-foreground/90'
                                                    : 'text-foreground/90'}`}
                                        >
                                            {msg.isNew && msg.role === 'assistant' && !isLoading ? (
                                                <Typewriter text={msg.content} />
                                            ) : (
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                    {msg.content}
                                                </ReactMarkdown>
                                            )}
                                        </div>
                                        {msg.role === 'user' && (
                                            <div className="flex justify-end mt-1">
                                                <span className="text-[10px] text-muted-foreground/30 font-medium">00:14</span>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            ))
                        )}

                        {isLoading && (
                            <div className="flex gap-8">
                                <div className="w-12 h-12 rounded-2xl flex-shrink-0 bg-green-50 dark:bg-green-900/10 flex items-center justify-center border border-green-100/50 animate-pulse">
                                    <Bot className="w-6 h-6 text-green-700/30" />
                                </div>
                                <div className="flex-1 pt-2 space-y-4">
                                    <div className="h-2 w-24 bg-muted animate-pulse rounded-full" />
                                    <div className="space-y-3">
                                        <div className="h-3 w-full bg-muted/40 animate-pulse rounded-full" />
                                        <div className="h-3 w-5/6 bg-muted/40 animate-pulse rounded-full" />
                                        <div className="h-3 w-4/6 bg-muted/40 animate-pulse rounded-full" />
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} className="h-2" />
                    </div>
                </div>

                {/* Input Area - Absolute Bottom, Zero Gap */}
                <div className="absolute bottom-0 left-0 right-0 z-40 px-6 pb-2 pt-12 bg-gradient-to-t from-white dark:from-[#0b0c0d] via-white/95 dark:via-[#0b0c0d]/95 to-transparent pointer-events-none">
                    <div className="max-w-3xl mx-auto w-full pointer-events-auto">
                        <form
                            onSubmit={handleSendMessage}
                            className="bg-white dark:bg-[#1c1d1e] border border-border/80 dark:border-white/20 shadow-2xl rounded-[1.8rem] flex flex-col transition-all outline-none focus-within:ring-0 overflow-hidden"
                        >
                            {selectedDocIds.length > 0 && (
                                <div className="flex flex-wrap gap-2 px-4 pt-3 pb-1 border-b border-border/50 bg-muted/5">
                                    {selectedDocIds.map(id => {
                                        const doc = documents.find(d => d.id === id);
                                        return (
                                            <div key={id} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-xl text-[10px] font-bold border border-green-200/50">
                                                <FileText className="w-3 h-3" />
                                                <span className="max-w-[120px] truncate">{doc?.title}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleTagDocument(id)}
                                                    className="ml-1 p-0.5 hover:bg-green-200 dark:hover:bg-green-800 rounded-full transition-colors"
                                                >
                                                    <Trash2 className="w-2.5 h-2.5" />
                                                </button>
                                            </div>
                                        );
                                    })}
                                    <span className="text-[9px] font-bold text-muted-foreground/40 self-center ml-2 uppercase tracking-widest">Context Active</span>
                                </div>
                            )}
                            <div className="p-1.5 flex items-end gap-2">
                                <textarea
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSendMessage();
                                        }
                                    }}
                                    rows={1}
                                    placeholder="Consult NIBSS intelligence engine..."
                                    className="flex-1 bg-transparent border-none focus:ring-0 text-base py-3 px-4 max-h-40 resize-none placeholder:text-muted-foreground/40 font-semibold dark:text-white dark:placeholder:text-gray-500 outline-none shadow-none ring-0"
                                />
                                <button
                                    type="submit"
                                    disabled={isLoading || !input.trim()}
                                    className="w-10 h-10 bg-green-700 hover:bg-green-800 disabled:opacity-20 flex items-center justify-center rounded-2xl text-white transition-all shadow-md active:scale-95 flex-shrink-0 mb-0.5 mr-0.5"
                                >
                                    <Send className="w-5 h-5" />
                                </button>
                            </div>
                        </form>

                        <div className="mt-2 flex justify-center gap-10 text-[7px] font-black text-muted-foreground dark:text-gray-500 uppercase opacity-60 tracking-[0.4em]">
                            <span>ENTERPRISE AUDITED</span>
                            <span>GOVERNANCE SECURED</span>
                        </div>
                    </div>
                </div>

            </div>

            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
                accept=".pdf,.docx,.txt"
            />

            {/* Confirmation Dialogs */}
            <AlertDialog open={convToDelete !== null} onOpenChange={(open) => !open && setConvToDelete(null)}>
                <AlertDialogContent className="border-border/50">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-black text-foreground">Purge Conversation?</AlertDialogTitle>
                        <AlertDialogDescription className="text-sm font-medium text-muted-foreground">
                            This action will permanently delete this conversation from the NIBSS intelligence logs. This cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-4">
                        <AlertDialogCancel className="rounded-xl border-border/50 font-bold">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDeleteConversation}
                            className="bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-lg shadow-red-900/10"
                        >
                            Confirm Purge
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={isClearAllConfirmOpen} onOpenChange={setIsClearAllConfirmOpen}>
                <AlertDialogContent className="border-border/50">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-black text-foreground">Purge All Intelligence Logs?</AlertDialogTitle>
                        <AlertDialogDescription className="text-sm font-medium text-muted-foreground">
                            You are about to wipe your entire conversation history. This is an irreversible operation.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-4">
                        <AlertDialogCancel className="rounded-xl border-border/50 font-bold">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmClearAll}
                            className="bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-lg shadow-red-900/10"
                        >
                            Wipe All History
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
