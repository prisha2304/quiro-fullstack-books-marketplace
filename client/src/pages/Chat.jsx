import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import messageService from '../services/messageService';
import ChatSidebar from '../components/chat/ChatSidebar';
import ChatWindow from '../components/chat/ChatWindow';
import toast from 'react-hot-toast';

const Chat = () => {
  const { user } = useAuth();
  const { socket } = useSocket() || {};
  const location = useLocation();

  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);

  // Load conversations on mount
  useEffect(() => {
    if (user) {
      loadConversations();
    }
  }, [user]);

  // Real-time WebSocket message listener
  useEffect(() => {
    if (!socket) return;

    const handleIncomingMessage = (newMsg) => {
      // If message belongs to active conversation
      if (activeConversation && newMsg.conversation_id === activeConversation.id) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        // Auto mark read if we are looking at this conversation
        messageService.markRead(newMsg.id).catch(() => {});
      }

      // Update conversation list last message preview
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === newMsg.conversation_id) {
            const isCurrentChat = activeConversation?.id === c.id;
            return {
              ...c,
              last_message: newMsg,
              updated_at: newMsg.created_at,
              unread_count: isCurrentChat ? 0 : (c.unread_count || 0) + 1
            };
          }
          return c;
        }).sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
      );
    };

    socket.on('message', handleIncomingMessage);

    return () => {
      socket.off('message', handleIncomingMessage);
    };
  }, [socket, activeConversation]);

  const loadConversations = async () => {
    try {
      setLoadingConversations(true);
      const res = await messageService.getConversations();
      const list = res.data || [];
      setConversations(list);

      // Auto-select first conversation or check location state
      const targetConvId = location.state?.conversationId;
      if (targetConvId) {
        const found = list.find((c) => c.id === targetConvId);
        if (found) handleSelectConversation(found);
      } else if (list.length > 0 && window.innerWidth >= 768 && !activeConversation) {
        handleSelectConversation(list[0]);
      }
    } catch (err) {
      console.error('Failed to load conversations', err);
      toast.error('Failed to load conversations');
    } finally {
      setLoadingConversations(false);
    }
  };

  const handleSelectConversation = async (conv) => {
    setActiveConversation(conv);
    // Reset unread count locally
    setConversations((prev) =>
      prev.map((c) => (c.id === conv.id ? { ...c, unread_count: 0 } : c))
    );

    try {
      setLoadingMessages(true);
      const res = await messageService.getMessages(conv.id);
      setMessages(res.data.messages || []);
    } catch (err) {
      console.error('Failed to load messages', err);
      toast.error('Failed to load messages');
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleSendMessage = async (text) => {
    if (!activeConversation || !text) return;

    try {
      setSending(true);
      const res = await messageService.sendMessage({
        conversationId: activeConversation.id,
        receiverId: activeConversation.partner?.id,
        bookId: activeConversation.book?.id,
        message: text
      });

      const newMsg = res.data;
      setMessages((prev) => [...prev, newMsg]);

      // Update conversation in sidebar
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConversation.id
            ? { ...c, last_message: newMsg, updated_at: newMsg.created_at }
            : c
        ).sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
      );
    } catch (err) {
      console.error('Failed to send message', err);
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const totalUnread = conversations.reduce((acc, c) => acc + (c.unread_count || 0), 0);

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-6 py-6 h-[calc(100vh-85px)] min-h-[550px] animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200/80 rounded-3xl shadow-soft overflow-hidden h-full flex flex-col md:flex-row">
        
        {/* Left Sidebar: Conversations (Hidden on mobile if active conversation is open) */}
        <div className={`h-full ${activeConversation ? 'hidden md:flex' : 'flex'} w-full md:w-80 lg:w-96 shrink-0`}>
          <ChatSidebar
            conversations={conversations}
            activeConversationId={activeConversation?.id}
            onSelectConversation={handleSelectConversation}
            loading={loadingConversations}
            totalUnread={totalUnread}
          />
        </div>

        {/* Right Window: Active Chat (Full screen on mobile when selected) */}
        <div className={`h-full flex-grow ${!activeConversation ? 'hidden md:flex' : 'flex'} min-w-0`}>
          <ChatWindow
            conversation={activeConversation}
            messages={messages}
            currentUser={user}
            onSendMessage={handleSendMessage}
            onBack={() => setActiveConversation(null)}
            loading={loadingMessages}
            sending={sending}
          />
        </div>

      </div>
    </div>
  );
};

export default Chat;
