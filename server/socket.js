const socketIo = require('socket.io');

let io;
// userId -> { sockets: Set(), lastSeen: Date }
const userPresence = new Map();

const init = (server) => {
    io = socketIo(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        },
        pingTimeout: 30000,
        pingInterval: 10000
    });

    io.on('connection', (socket) => {
        let currentUserId = null;

        socket.on('join', (userId) => {
            if (!userId) return;
            currentUserId = String(userId);

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
