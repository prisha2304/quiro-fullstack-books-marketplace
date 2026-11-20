import React, { useState } from 'react';
import { MessageSquare, Sparkles } from 'lucide-react';
import ConversationList from './ConversationList';

const ChatSidebar = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  loading,
  totalUnread
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <aside className="w-full md:w-80 lg:w-96 bg-white border-r border-slate-200/80 flex flex-col h-full shrink-0">
      
      {/* Sidebar Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center font-bold">
            <MessageSquare size={16} />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-900 tracking-tight">Messages</h2>
            <span className="text-[10px] text-slate-400 font-medium">Direct Peer Chat</span>
          </div>
        </div>

        {totalUnread > 0 && (
          <span className="px-2 py-0.5 bg-rose-600 text-white font-black text-[10px] rounded-full shadow-2xs">
            {totalUnread} unread
          </span>
        )}
      </div>

      {/* Conversation List Engine */}
      <div className="flex-grow overflow-hidden">
        <ConversationList
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelectConversation={onSelectConversation}
          loading={loading}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      </div>

    </aside>
  );
};

export default ChatSidebar;
