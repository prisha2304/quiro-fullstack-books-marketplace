import React from 'react';
import { Check, CheckCheck } from 'lucide-react';

const MessageBubble = ({ message, isOwn }) => {
  const timeFormatted = message.created_at
    ? new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  // Determine read receipt status: 'seen' | 'delivered' | 'sent'
  const isSeen = message.is_read || message.status === 'seen';
  const isDelivered = message.status === 'delivered' || isSeen;

  return (
    <div className={`flex w-full ${isOwn ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-1 duration-150`}>
      <div className={`max-w-[78%] sm:max-w-[68%] flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
        
        {/* Message Bubble Container */}
        <div
          className={`px-4 py-2.5 rounded-2xl text-xs leading-relaxed font-medium shadow-soft break-words ${
            isOwn
              ? 'bg-primary-600 text-white rounded-br-xs'
              : 'bg-white text-slate-800 border border-slate-200/80 rounded-bl-xs'
          }`}
        >
          <p className="whitespace-pre-wrap">{message.message}</p>

          {/* Time & Read Receipts */}
          <div
            className={`flex items-center gap-1 mt-1 text-[9px] font-semibold justify-end select-none ${
              isOwn ? 'text-primary-100' : 'text-slate-400'
            }`}
          >
            <span>{timeFormatted}</span>

            {isOwn && (
              <span className="flex items-center" title={isSeen ? 'Seen' : isDelivered ? 'Delivered' : 'Sent'}>
                {isSeen ? (
                  // Seen: Double check in white
                  <CheckCheck size={13} className="text-white shrink-0" />
                ) : isDelivered ? (
                  // Delivered: Double check in light blue
                  <CheckCheck size={13} className="text-primary-200 shrink-0" />
                ) : (
                  // Sent: Single check in light blue
                  <Check size={13} className="text-primary-200 shrink-0" />
                )}
              </span>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default MessageBubble;
