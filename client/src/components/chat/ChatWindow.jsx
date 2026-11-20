import React, { useState, useRef, useEffect } from 'react';
import { 
  ArrowLeft, 
  Send, 
  BookOpen, 
  ShoppingBag, 
  ShieldCheck, 
  Sparkles, 
  MoreVertical, 
  ExternalLink,
  MessageCircle,
  Clock,
  CheckCircle2
} from 'lucide-react';
import { Link } from 'react-router-dom';
import MessageBubble from './MessageBubble';
import { useSocket } from '../../context/SocketContext';
import { formatCurrency } from '../../utils/format';

const QUICK_PROMPTS = [
  'Is this book still available?',
  'Can you ship it today?',
  'Are the pages clean and unmarked?',
  'Would you consider a swap?'
];

const formatLastSeen = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const now = new Date();
  const diffMinutes = Math.floor((now - d) / (1000 * 60));

  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const ChatWindow = ({
  conversation,
  messages = [],
  currentUser,
  onSendMessage,
  onBack,
  loading = false,
  sending = false
}) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);
  const { isUserOnline = () => false, getUserLastSeen = () => null } = useSocket() || {};

  // Auto-scroll to bottom
  const scrollToBottom = (behavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    scrollToBottom('auto');
  }, [conversation?.id]);

  useEffect(() => {
    scrollToBottom('smooth');
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputText.trim() || sending) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const handleQuickPrompt = (prompt) => {
    if (sending) return;
    onSendMessage(prompt);
  };

  if (!conversation) {
    return (
      <div className="flex-grow flex flex-col items-center justify-center p-8 text-center bg-[#FAFAF9]">
        <div className="w-16 h-16 rounded-3xl bg-blue-50 text-primary-600 flex items-center justify-center mb-4 shadow-soft">
          <MessageCircle size={32} />
        </div>
        <h3 className="text-base font-bold text-slate-800">Your Conversations</h3>
        <p className="text-xs text-slate-500 max-w-sm mt-1 leading-relaxed">
          Select a chat from the sidebar or click "Message Seller" on any book page to coordinate orders and book swaps.
        </p>
      </div>
    );
  }

  const partner = conversation.partner || {};
  const book = conversation.book;
  const isOnline = isUserOnline(partner.id);
  const lastSeen = getUserLastSeen(partner.id);

  return (
    <div className="flex-grow flex flex-col h-full bg-[#FAFAF9] overflow-hidden">
      
      {/* Header Bar */}
      <header className="p-3.5 sm:px-6 bg-white border-b border-slate-200/80 flex items-center justify-between shrink-0 shadow-2xs z-10">
        <div className="flex items-center gap-3 min-w-0">
          
          {/* Mobile Back Button */}
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 md:hidden cursor-pointer"
            title="Back to conversations"
          >
            <ArrowLeft size={18} />
          </button>

          {/* Partner Avatar */}
          <div className="relative shrink-0">
            {partner.profile_image ? (
              <img
                src={partner.profile_image}
                alt=""
                className="w-10 h-10 rounded-xl object-cover border border-slate-200"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-600 border border-primary-100 flex items-center justify-center font-bold text-sm">
                {partner.full_name?.charAt(0) || 'U'}
              </div>
            )}
            
            {/* Real-Time Online / Offline dot indicator */}
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white transition-colors duration-300 ${
                isOnline ? 'bg-emerald-500' : 'bg-slate-300'
              }`}
            ></span>
          </div>

          {/* Partner Info */}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-bold text-slate-900 truncate">
                {partner.full_name || 'Marketplace Member'}
              </h3>
              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-100">
                <ShieldCheck size={10} /> Verified
              </span>
            </div>
            
            {/* Dynamic Online / Last Seen status */}
            <p className="text-[10px] text-slate-500 truncate flex items-center gap-1 font-medium">
              {isOnline ? (
                <span className="text-emerald-600 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Online
                </span>
              ) : lastSeen ? (
                <span className="text-slate-400">Offline · Last seen {formatLastSeen(lastSeen)}</span>
              ) : (
                <span className="text-slate-400">{partner.college || 'Offline'}</span>
              )}
            </p>
          </div>
        </div>

        {/* Action button */}
        {book && (
          <Link
            to={`/book/${book.id}`}
            className="hidden sm:flex items-center gap-1 text-[11px] font-bold text-primary-600 hover:text-primary-700 bg-blue-50/80 hover:bg-blue-100/80 px-2.5 py-1.5 rounded-lg border border-blue-100 transition-all"
          >
            <span>View Book</span>
            <ExternalLink size={12} />
          </Link>
        )}
      </header>

      {/* Book Context Banner (If attached to a book) */}
      {book && (
        <div className="bg-white/80 backdrop-blur-xs border-b border-slate-200/60 px-4 py-2.5 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src={book.cover_image || 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=120'}
              alt=""
              className="w-8 h-10 object-cover rounded-md border border-slate-200 shrink-0"
            />
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 truncate">{book.title}</p>
              <p className="text-[10px] text-slate-500 font-medium">by {book.author || 'Author'}</p>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="text-xs font-black text-slate-900">
              {formatCurrency(book.price || 0)}
            </span>
            <span className="block text-[9px] text-emerald-600 font-bold uppercase">In Stock</span>
          </div>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-grow overflow-y-auto p-4 sm:p-6 space-y-3">
        {loading ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-10 bg-slate-200/80 rounded-2xl w-2/3"></div>
            <div className="h-10 bg-primary-100 rounded-2xl w-1/2 ml-auto"></div>
            <div className="h-12 bg-slate-200/80 rounded-2xl w-3/4"></div>
          </div>
        ) : messages.length > 0 ? (
          messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isOwn={msg.sender_id === currentUser?.id}
            />
          ))
        ) : (
          <div className="py-12 text-center text-slate-400 space-y-1">
            <p className="text-xs font-semibold">No messages yet in this conversation.</p>
            <p className="text-[11px]">Send a message to coordinate book exchange details.</p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts Bar */}
      {messages.length <= 2 && (
        <div className="px-4 py-1.5 flex items-center gap-1.5 overflow-x-auto custom-scrollbar shrink-0 bg-white/50 border-t border-slate-100">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest shrink-0 mr-1 flex items-center gap-1">
            <Sparkles size={11} className="text-amber-500" /> Suggestions:
          </span>
          {QUICK_PROMPTS.map((prompt, i) => (
            <button
              key={i}
              onClick={() => handleQuickPrompt(prompt)}
              className="text-[11px] font-medium text-slate-600 bg-white hover:bg-primary-50 hover:text-primary-600 px-2.5 py-1 rounded-full border border-slate-200/80 shrink-0 transition-colors cursor-pointer shadow-2xs"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Message Composer Footer */}
      <footer className="p-3 sm:p-4 bg-white border-t border-slate-200/80 shrink-0">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type a message..."
            className="flex-grow bg-slate-50 border border-slate-200/80 rounded-xl px-4 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:bg-white focus:border-primary-600 focus:ring-2 focus:ring-primary-500/10 transition-all font-medium"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={!inputText.trim() || sending}
            className="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white p-2.5 rounded-xl font-bold transition-all shadow-sm active:scale-[0.98] cursor-pointer shrink-0 flex items-center justify-center"
            title="Send Message"
          >
            <Send size={16} />
          </button>
        </form>
      </footer>

    </div>
  );
};

export default ChatWindow;
