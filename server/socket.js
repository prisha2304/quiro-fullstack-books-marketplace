const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');

let io;
// userId -> { sockets: Set(), lastSeen: Date }
const userPresence = new Map();

const init = (server) => {
    const configuredClient = process.env.CLIENT_URL || 'http://localhost:5173';
    const allowedOrigins = [
        configuredClient,
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:3000',
        'http://localhost:5000'
    ];

    io = socketIo(server, {
        cors: {
            origin: (origin, callback) => {
                if (!origin || allowedOrigins.includes(origin)) {
                    callback(null, true);
                } else {
                    callback(new Error('CORS origin rejected by WebSocket gateway'));
                }
            },
            methods: ["GET", "POST"],
            credentials: true
        },
        pingTimeout: 30000,
        pingInterval: 10000
    });

    // JWT Handshake Authentication Middleware
    io.use((socket, next) => {
        const token = socket.handshake.auth?.token ||
                      socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '');

        if (!token) {
            // Allow guest socket connection for public broadcasts, but without authenticated private room access
            socket.userId = null;
            return next();
        }

        try {
            if (!process.env.JWT_SECRET) {
                return next(new Error('WebSocket authentication misconfigured: Missing JWT_SECRET'));
            }
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            socket.userId = String(decoded.id);
            return next();
        } catch (err) {
            console.warn('[Socket.IO Auth] Handshake rejected: invalid/expired token');
            return next(new Error('Authentication failed: Invalid or expired token'));
        }
    });

    io.on('connection', (socket) => {
        // Derive user identity strictly from verified JWT token
        let currentUserId = socket.userId ? String(socket.userId) : null;

        socket.on('join', (claimedUserId) => {
            // Disallow joining if unauthenticated
            if (!socket.userId) {
                return;
            }

            // Bind strictly to authenticated token ID ΓÇö prevent client from spoofing another user's room
            currentUserId = String(socket.userId);

            // Join personal room for atomic targeted broadcasts
            socket.join(`user_${currentUserId}`);

            if (!userPresence.has(currentUserId)) {
                userPresence.set(currentUserId, { sockets: new Set(), lastSeen: new Date() });
            }
            userPresence.get(currentUserId).sockets.add(socket.id);

            // Broadcast USER_ONLINE to all clients
            io.emit('USER_ONLINE', {
                userId: currentUserId,
                isOnline: true,
                timestamp: new Date()
            });

            // Send list of currently online user IDs to the connected client
            const onlineUserIds = Array.from(userPresence.entries())
                .filter(([_, data]) => data.sockets.size > 0)
                .map(([uid]) => uid);

            socket.emit('ONLINE_USERS_LIST', onlineUserIds);
        });

        // Typing indicators
        socket.on('typing', ({ conversationId, receiverId }) => {
            if (receiverId) {
                io.to(`user_${receiverId}`).emit('typing', { conversationId, senderId: currentUserId });
            }
        });

        socket.on('stop_typing', ({ conversationId, receiverId }) => {
            if (receiverId) {
                io.to(`user_${receiverId}`).emit('stop_typing', { conversationId, senderId: currentUserId });
            }
        });

        // Read receipt broadcast
        socket.on('MESSAGE_READ', ({ conversationId, messageId, senderId }) => {
            if (senderId) {
                io.to(`user_${senderId}`).emit('MESSAGE_READ', {
                    conversationId,
                    messageId,
                    readBy: currentUserId,
                    readAt: new Date()
                });
            }
        });

        socket.on('disconnect', () => {
            if (currentUserId && userPresence.has(currentUserId)) {
                const presence = userPresence.get(currentUserId);
                presence.sockets.delete(socket.id);

                if (presence.sockets.size === 0) {
                    presence.lastSeen = new Date();
                    io.emit('USER_OFFLINE', {
                        userId: currentUserId,
                        isOnline: false,
                        lastSeen: presence.lastSeen
                    });
                }
            }
        });
    });

    return io;
};

const sendNotification = (userId, notification) => {
    if (!io || !userId) return;
    io.to(`user_${userId}`).emit('NOTIFICATION_NEW', notification);
    io.to(`user_${userId}`).emit('NOTIFICATION_CREATED', notification);
    io.to(`user_${userId}`).emit('notification', notification);
};

const sendNotificationCountUpdate = (userId, unreadCount) => {
    if (!io || !userId) return;
    io.to(`user_${userId}`).emit('NOTIFICATION_COUNT_UPDATE', { unreadCount });
};

const broadcastCommunityActivity = (activity) => {
    if (!io) return;
    io.emit('COMMUNITY_ACTIVITY', activity);
};

const sendMessage = (receiverId, message) => {
    if (!io || !receiverId) return;
    const isReceiverOnline = userPresence.has(String(receiverId)) && userPresence.get(String(receiverId)).sockets.size > 0;
    const enrichedMessage = {
        ...message,
        status: isReceiverOnline ? 'delivered' : 'sent'
    };

    io.to(`user_${receiverId}`).emit('MESSAGE_RECEIVED', enrichedMessage);
    io.to(`user_${receiverId}`).emit('message', enrichedMessage);
    io.to(`user_${receiverId}`).emit('new_message', enrichedMessage);
    return enrichedMessage;
};

const notifyMessageRead = (senderId, readData) => {
    if (!io || !senderId) return;
    io.to(`user_${senderId}`).emit('MESSAGE_READ', readData);
};

const isUserOnline = (userId) => {
    const presence = userPresence.get(String(userId));
    return presence ? presence.sockets.size > 0 : false;
};

const getLastSeen = (userId) => {
    const presence = userPresence.get(String(userId));
    return presence ? presence.lastSeen : null;
};

module.exports = {
    init,
    sendNotification,
    sendNotificationCountUpdate,
    broadcastCommunityActivity,
    sendMessage,
    notifyMessageRead,
    isUserOnline,
    getLastSeen,
    getIo: () => io
};
