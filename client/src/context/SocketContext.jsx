import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [lastSeenMap, setLastSeenMap] = useState(new Map());
  const { user } = useAuth();
  const socketRef = useRef(null);

  useEffect(() => {
    if (!user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
      }
      return;
    }

    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
    const authToken = user?.token || localStorage.getItem('token');
    const newSocket = io(socketUrl, {
      auth: { token: authToken },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      autoConnect: true
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    newSocket.on('connect', () => {
      newSocket.emit('join', user.id);
    });

    // Initial list of online users
    newSocket.on('ONLINE_USERS_LIST', (userIds) => {
      setOnlineUsers(new Set(userIds.map(String)));
    });

    // Presence updates
    newSocket.on('USER_ONLINE', ({ userId }) => {
      setOnlineUsers((prev) => new Set(prev).add(String(userId)));
    });

    newSocket.on('USER_OFFLINE', ({ userId, lastSeen }) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        next.delete(String(userId));
        return next;
      });
      if (lastSeen) {
        setLastSeenMap((prev) => new Map(prev).set(String(userId), new Date(lastSeen)));
      }
    });

    return () => {
      newSocket.off('connect');
      newSocket.off('ONLINE_USERS_LIST');
      newSocket.off('USER_ONLINE');
      newSocket.off('USER_OFFLINE');
      newSocket.disconnect();
      socketRef.current = null;
    };
  }, [user]);

  const isUserOnline = useCallback(
    (userId) => {
      if (!userId) return false;
      return onlineUsers.has(String(userId));
    },
    [onlineUsers]
  );

  const getUserLastSeen = useCallback(
    (userId) => {
      if (!userId) return null;
      return lastSeenMap.get(String(userId)) || null;
    },
    [lastSeenMap]
  );

  const value = {
    socket,
    onlineUsers,
    isUserOnline,
    getUserLastSeen
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

export const useSocket = () => useContext(SocketContext) || {};
export default SocketContext;
