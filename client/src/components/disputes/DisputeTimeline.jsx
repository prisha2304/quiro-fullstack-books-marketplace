import React from 'react';
import { 
  Clock, 
  CheckCircle2, 
  ShieldAlert, 
  MessageSquare, 
  Package, 
  RotateCcw, 
  CreditCard, 
  FileText,
  UserCheck
} from 'lucide-react';

const STATUS_ICONS = {
  OPEN: <Clock className="w-4 h-4 text-amber-500" />,
  UNDER_REVIEW: <ShieldAlert className="w-4 h-4 text-blue-500" />,
  WAITING_FOR_USER: <Clock className="w-4 h-4 text-orange-500" />,
  WAITING_FOR_SELLER: <Clock className="w-4 h-4 text-purple-500" />,
  RESOLVED: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
  REJECTED: <ShieldAlert className="w-4 h-4 text-rose-500" />,
  ESCALATED: <ShieldAlert className="w-4 h-4 text-red-600" />
};

const DisputeTimeline = ({ dispute, messages = [], transaction = {} }) => {
  if (!dispute) return null;

  const events = [];

  // 1. Transaction creation
  if (transaction?.order) {
    events.push({
      title: 'Order Placed',
      description: `Order #${transaction.order.id} placed by buyer (₹${transaction.order.total_price})`,
      date: transaction.order.created_at,
      icon: <Package className="w-4 h-4 text-slate-500" />,
      color: 'border-slate-200 bg-slate-100'
    });
  }

  // 2. Dispute Opened
  events.push({
    title: `Dispute #${dispute.dispute_code} Opened`,
    description: `Claim raised: "${dispute.reason}"`,
    date: dispute.created_at,
    icon: <ShieldAlert className="w-4 h-4 text-amber-600" />,
    color: 'border-amber-300 bg-amber-50'
  });

  // 3. Messages as timeline checkpoints
  messages.forEach(msg => {
    let roleLabel = 'Buyer';
    let iconColor = 'text-blue-600 bg-blue-50 border-blue-200';
    if (msg.sender_role === 'ADMIN') {
      roleLabel = 'Trust & Safety Admin';
      iconColor = 'text-indigo-600 bg-indigo-50 border-indigo-200';
    } else if (msg.sender_role === 'SELLER') {
      roleLabel = 'Seller';
      iconColor = 'text-purple-600 bg-purple-50 border-purple-200';
    }

    events.push({
      title: `${roleLabel} Update`,
      description: msg.message,
      date: msg.created_at,
      icon: <MessageSquare className="w-4 h-4" />,
      color: iconColor,
      isMessage: true
    });
  });

  // 4. Return Status Checkpoints
  if (dispute.return_status === 'RETURN_APPROVED') {
    events.push({
      title: 'Return Request Approved',
      description: 'The buyer has been authorized to ship the item back to the seller.',
      date: dispute.updated_at,
      icon: <RotateCcw className="w-4 h-4 text-emerald-600" />,
      color: 'border-emerald-300 bg-emerald-50'
    });
  }

  // 5. Refund Status Checkpoints
  if (dispute.refund_status === 'REFUNDED') {
    events.push({
      title: 'Refund Executed',
      description: `Refund of ₹${dispute.refund_amount} processed to original payment method.`,
      date: dispute.resolved_at || dispute.updated_at,
      icon: <CreditCard className="w-4 h-4 text-emerald-600" />,
      color: 'border-emerald-300 bg-emerald-50'
    });
  }

  // 6. Resolution Event
  if (dispute.status === 'RESOLVED') {
    events.push({
      title: 'Dispute Case Resolved',
      description: dispute.resolution_notes || 'All parties reached resolution and case is closed.',
      date: dispute.resolved_at || dispute.updated_at,
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
      color: 'border-emerald-400 bg-emerald-50'
    });
  }

  return (
    <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
      {events.map((evt, idx) => (
        <div key={idx} className="relative group text-left animate-in fade-in duration-200">
          {/* Node Icon */}
          <div className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center border ${evt.color} shadow-xs`}>
            {evt.icon}
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-black text-slate-800">{evt.title}</span>
              <span className="text-[10px] font-bold text-slate-400">
                {evt.date ? new Date(evt.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
              </span>
            </div>
            <p className="text-xs text-slate-600 font-medium mt-1 leading-relaxed">
              {evt.description}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default DisputeTimeline;
