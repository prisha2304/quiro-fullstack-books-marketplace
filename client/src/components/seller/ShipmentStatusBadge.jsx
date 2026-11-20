import React from 'react';

const ShipmentStatusBadge = ({ status }) => {
  const getBadgeStyle = () => {
    switch ((status || '').toUpperCase()) {
      case 'DELIVERED':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'OUT_FOR_DELIVERY':
      case 'IN_TRANSIT':
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
      case 'SHIPPED':
      case 'PACKED':
      case 'READY_TO_SHIP':
        return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30';
      case 'PROCESSING':
      case 'CONFIRMED':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'CANCELLED':
      case 'REFUNDED':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
    }
  };

  const formatText = (text) => {
    return (text || 'PROCESSING').replace(/_/g, ' ').toUpperCase();
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getBadgeStyle()}`}>
      {formatText(status)}
    </span>
  );
};

export default ShipmentStatusBadge;
