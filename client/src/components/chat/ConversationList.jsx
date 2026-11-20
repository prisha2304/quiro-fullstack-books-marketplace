import React from 'react';
import { BookOpen, User, Search, MessageSquareOff } from 'lucide-react';
import UnreadBadge from './UnreadBadge';

const formatConversationTime = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'short' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const ConversationList = ({
  conversations = [],
  activeConversationId,
  onSelectConversation,
  loading = false,
  searchQuery = '',
  onSearchChange
}) => {
  const filtered = conversations.filter((c) => {
    const partnerName = c.partner?.full_name?.toLowerCase() || '';
    const bookTitle = c.book?.title?.toLowerCase() || '';
    const query = searchQuery.toLowerCase();
    return partnerName.includes(query) || bookTitle.includes(query);
  });

  if (loading) {
    return (
      <div className="p-3 space-y-2.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-2xl bg-white animate-pulse border border-slate-100">
            <div className="w-11 h-11 rounded-xl bg-slate-200 shrink-0"></div>
            <div className="flex-grow space-y-2 min-w-0">
              <div className="h-3 bg-slate-200 rounded w-1/2"></div>
              <div className="h-2.5 bg-slate-100 rounded w-4/5"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      
      {/* Search Filter Box */}
      <div className="p-3 border-b border-slate-100 bg-white">
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2 focus-within:bg-white focus-within:border-primary-600 focus-within:ring-2 focus-within:ring-primary-500/10 transition-all">
          <Search size={14} className="text-slate-400 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search chats by name or book..."
            className="bg-transparent border-none outline-none text-xs text-slate-800 placeholder:text-slate-400 w-full font-medium"
          />
        </div>
      </div>

      {/* Conversations Scrollable List */}
      <div className="flex-grow overflow-y-auto divide-y divide-slate-100/80 p-2 space-y-1">
        {filtered.length > 0 ? (
          filtered.map((conv) => {
            const isActive = conv.id === activeConversationId;
            const timeAgo = formatConversationTime(conv.updated_at || conv.created_at);
            const hasUnread = conv.unread_count > 0;

            return (
              <button
                key={conv.id}
                onClick={() => onSelectConversation(conv)}
                className={`w-full p-3 rounded-2xl flex items-start gap-3 text-left transition-all cursor-pointer border ${
                  isActive
                    ? 'bg-blue-50/80 border-primary-200 shadow-2xs'
                    : 'bg-white hover:bg-slate-50 border-transparent'
                }`}
              >
                {/* Partner Avatar / Book Thumbnail */}
                <div className="relative shrink-0">
                  {conv.partner?.profile_image ? (
                    <img
                      src={conv.partner.profile_image}
                      alt=""
                      className="w-11 h-11 rounded-xl object-cover border border-slate-200"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-xl bg-primary-50 text-primary-600 border border-primary-100 flex items-center justify-center font-bold text-sm">
                      {conv.partner?.full_name?.charAt(0) || 'U'}
                    </div>
                  )}

                  {/* Online dot indicator */}
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></span>
                </div>

                {/* Content */}
                <div className="flex-grow min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <h4 className={`text-xs truncate ${hasUnread ? 'font-black text-slate-900' : 'font-bold text-slate-800'}`}>
                      {conv.partner?.full_name || 'Marketplace Member'}
                    </h4>
                    <span className="text-[10px] text-slate-400 font-medium shrink-0">
                      {timeAgo}
                    </span>
                  </div>

                  {/* Optional Book Context Tag */}
                  {conv.book && (
                    <div className="flex items-center gap-1 text-[10px] font-bold text-primary-700 bg-blue-50 px-1.5 py-0.5 rounded-md mb-1 max-w-fit truncate border border-blue-100">
                      <BookOpen size={10} />
                      <span className="truncate">{conv.book.title}</span>
                    </div>
                  )}

                  {/* Last Message Preview */}
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-[11px] truncate ${hasUnread ? 'font-bold text-slate-900' : 'text-slate-500 font-normal'}`}>
                      {conv.last_message ? conv.last_message.message : 'Say hello to start chatting...'}
                    </p>
                    <UnreadBadge count={conv.unread_count} />
                  </div>
                </div>
              </button>
            );
          })
        ) : (
          <div className="p-8 text-center space-y-2">
            <MessageSquareOff size={28} className="text-slate-300 mx-auto" />
            <p className="text-xs font-bold text-slate-700">No conversations found</p>
            <p className="text-[11px] text-slate-400">
              {searchQuery ? 'Try a different search term' : 'Browse books and message sellers directly'}
            </p>
          </div>
        )}
      </div>

    </div>
  );
};

export default ConversationList;
