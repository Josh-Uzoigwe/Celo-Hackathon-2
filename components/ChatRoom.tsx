import React, { useState, useEffect, useRef } from 'react';
import { Send, MessageSquare, Wifi, WifiOff } from 'lucide-react';
import Gun from 'gun';

// Initialize Gun with a more robust list of public peers
const gun = Gun({
    peers: [
        'https://gun-manhattan.herokuapp.com/gun',
        'https://gun-eu.herokuapp.com/gun',
        'https://gunjs.herokuapp.com/gun',
        'https://peer.wallie.io/gun',
        'https://plato.design/gun'
    ],
    localStorage: true // Enable local storage for better persistence
});

interface Message {
    id: string;
    user: string;
    text: string;
    timestamp: number;
    isMe: boolean;
}

export const ChatRoom: React.FC<{ userAddress: string }> = ({ userAddress }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [isConnected, setIsConnected] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        // Connection status check (approximate)
        const checkConnection = () => {
            // @ts-ignore - Gun internal API
            const peers = gun._.opt.peers;
            const connected = Object.values(peers).some((peer: any) => peer.wire && peer.wire.readyState === 1);
            setIsConnected(connected);
        };

        const interval = setInterval(checkConnection, 2000);
        checkConnection(); // Initial check

        // Subscribe to chat updates
        const chatNode = gun.get('celopulse-chat-v2'); // Bumped version for clean slate

        const handleMessage = (data: any, id: string) => {
            if (!data || !data.text) return;

            const newMessage: Message = {
                id: id,
                user: data.user,
                text: data.text,
                timestamp: data.timestamp,
                isMe: data.userAddress === userAddress
            };

            setMessages(prev => {
                // Avoid duplicates
                if (prev.some(m => m.id === id)) return prev;
                // Add and sort by timestamp
                return [...prev, newMessage].sort((a, b) => a.timestamp - b.timestamp).slice(-50); // Keep last 50
            });
        };

        chatNode.map().on(handleMessage);

        return () => {
            chatNode.off();
            clearInterval(interval);
        };
    }, [userAddress]);

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputText.trim()) return;

        const timestamp = Date.now();
        const userDisplay = userAddress ? `${userAddress.slice(0, 4)}...${userAddress.slice(-3)}` : 'Guest';

        const messageData = {
            user: userDisplay,
            userAddress: userAddress || 'guest',
            text: inputText,
            timestamp: timestamp
        };

        // Save to Gun
        gun.get('celopulse-chat-v2').set(messageData);

        setInputText('');
    };

    return (
        <div className="flex flex-col h-[600px] bg-slate-900/50 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-white/10 flex items-center gap-2 bg-slate-900/80">
                <MessageSquare className="w-5 h-5 text-indigo-500" />
                <h3 className="font-bold text-white">Trollbox (P2P)</h3>
                <div className="ml-auto flex items-center gap-2">
                    {isConnected ? (
                        <span className="text-xs text-emerald-500 flex items-center gap-1">
                            <Wifi size={14} />
                            <span className="hidden sm:inline">Connected</span>
                        </span>
                    ) : (
                        <span className="text-xs text-amber-500 flex items-center gap-1">
                            <WifiOff size={14} />
                            <span className="hidden sm:inline">Connecting...</span>
                        </span>
                    )}
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                {messages.length === 0 && (
                    <div className="text-center text-slate-500 text-sm py-10">
                        No messages yet. Be the first to say hi!
                    </div>
                )}
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex flex-col ${msg.isMe ? 'items-end' : 'items-start'}`}>
                        <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs font-bold ${msg.isMe ? 'text-indigo-400' : 'text-slate-400'}`}>
                                {msg.user}
                            </span>
                            <span className="text-[10px] text-slate-600">
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                        <div className={`px-4 py-2 rounded-2xl max-w-[85%] text-sm ${msg.isMe
                            ? 'bg-indigo-600 text-white rounded-tr-none'
                            : 'bg-slate-800 text-slate-200 rounded-tl-none border border-white/5'
                            }`}>
                            {msg.text}
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSend} className="p-4 bg-slate-900/80 border-t border-white/10">
                <div className="relative">
                    <input
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="Say something..."
                        className="w-full bg-slate-800 text-white placeholder-slate-500 rounded-xl pl-4 pr-12 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 border border-white/5"
                    />
                    <button
                        type="submit"
                        disabled={!inputText.trim()}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50 disabled:hover:bg-indigo-500 transition-colors"
                    >
                        <Send size={16} />
                    </button>
                </div>
            </form>
        </div>
    );
};
