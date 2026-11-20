import React, { useState, useEffect } from 'react';
import AIChatButton from './AIChatButton';
import AIChatWindow from './AIChatWindow';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const AIChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeBookContext, setActiveBookContext] = useState(null);
  const { user } = useAuth();

  // Retrieve or create persistent guest session ID
  const getSessionId = () => {
    let sid = localStorage.getItem('booknest_ai_session_id');
    if (!sid) {
      sid = 'session_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now();
      localStorage.setItem('booknest_ai_session_id', sid);
    }
    return sid;
  };

  useEffect(() => {
    fetchHistory();
  }, [user]);

  // Listen to custom event from BookDetails page to prime AI context
  useEffect(() => {
    const handleContextTrigger = (e) => {
      const { book, prompt } = e.detail || {};
      if (book) {
        setActiveBookContext(book);
        setIsOpen(true);
        if (prompt) {
          handleSendMessage(prompt, book);
        }
      }
    };

    window.addEventListener('open-nestai-book-context', handleContextTrigger);
    return () => window.removeEventListener('open-nestai-book-context', handleContextTrigger);
  }, [messages]);

  const fetchHistory = async () => {
    try {
      const sessionId = getSessionId();
      const res = await api.get('/ai/history', {
        params: { sessionId }
      });
      setMessages(res.data || []);
    } catch (err) {
      console.error('Failed to load AI history', err);
    }
  };

  const handleSendMessage = async (text, bookContextOverride = null) => {
    if (!text.trim()) return;

    const effectiveBook = bookContextOverride || activeBookContext;
    const userMessage = { message: text, response: '', recommended_books: [], created_at: new Date().toISOString() };
    
    // Maintain conversational context window (last 10 messages)
    const recentContext = messages.slice(-10).map(m => ({ message: m.message, response: m.response }));

    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    try {
      const sessionId = getSessionId();
      const res = await api.post('/ai/chat', {
        message: text,
        sessionId,
        bookId: effectiveBook ? effectiveBook.id : null,
        currentBookContext: effectiveBook ? {
          id: effectiveBook.id,
          title: effectiveBook.title,
          author: effectiveBook.author,
          genre: effectiveBook.genre,
          price: effectiveBook.price,
          rating: effectiveBook.rating,
          condition: effectiveBook.condition
        } : null,
        context: recentContext
      });

      const aiResponse = res.data;
      setMessages((prev) =>
        prev.map((msg, idx) => (idx === prev.length - 1 ? aiResponse : msg))
      );
    } catch (err) {
      toast.error('AI assistant is temporarily unavailable. Please try again.');
      setMessages((prev) =>
        prev.map((msg, idx) =>
          idx === prev.length - 1
            ? {
                ...msg,
                response: "I couldn't complete the query right now. Please try again in a moment!"
              }
            : msg
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = async () => {
    try {
      const sessionId = getSessionId();
      await api.delete('/ai/history', {
        params: { sessionId }
      });
      setMessages([]);
      setActiveBookContext(null);
      toast.success('Chat history cleared');
    } catch (err) {
      toast.error('Failed to clear history');
    }
  };

  return (
    <>
      <AIChatWindow
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        messages={messages}
        onSendMessage={handleSendMessage}
        onClearHistory={handleClearHistory}
        loading={loading}
        activeBookContext={activeBookContext}
      />
      <AIChatButton
        isOpen={isOpen}
        onClick={() => setIsOpen(!isOpen)}
      />
    </>
  );
};

export default AIChatWidget;
