import React, { useState } from 'react';
import { CheckSquare, Square } from 'lucide-react';
import ShipmentStatusBadge from './ShipmentStatusBadge';

const FulfillmentQueue = ({ orders = [], onStatusUpdate, onBulkUpdate }) => {
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [updating, setUpdating] = useState(false);

  const toggleSelect = (id) => {
    setSelectedOrders(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedOrders.length === orders.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(orders.map(o => o.id));
    }
  };

  const handleBulkAction = async (nextStatus) => {
    if (selectedOrders.length === 0) return;
    setUpdating(true);
    try {
      await onBulkUpdate({ orderIds: selectedOrders, nextStatus });
      setSelectedOrders([]);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800">
        <div>
          <h3 className="text-base font-bold text-white">Order Fulfillment Queue</h3>
          <p className="text-xs text-slate-400">Process student orders step-by-step to maintain high SLA ratings</p>
        </div>

        {/* Bulk Action Controls */}
        {orders.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={selectAll}
              className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800 border border-slate-700"
            >
              {selectedOrders.length === orders.length ? 'Deselect All' : 'Select All'}
            </button>
            {selectedOrders.length > 0 && (
              <div className="flex items-center gap-1.5">
                <button
                  disabled={updating}
                  onClick={() => handleBulkAction('processing')}
                  className="px-2.5 py-1 bg-amber-600/80 hover:bg-amber-500 text-white text-xs font-semibold rounded-lg disabled:opacity-50"
                >
                  Mark Processing ({selectedOrders.length})
                </button>
                <button
                  disabled={updating}
                  onClick={() => handleBulkAction('packed')}
                  className="px-2.5 py-1 bg-indigo-600/80 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg disabled:opacity-50"
                >
                  Mark Packed ({selectedOrders.length})
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {orders.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-500">
          No orders pending fulfillment in this queue.
        </div>
      ) : (
        <div className="divide-y divide-slate-800/60">
          {orders.map((order) => {
            const isSelected = selectedOrders.includes(order.id);
            return (
              <div key={order.id} className="py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-slate-800/30 px-2 rounded-xl transition-colors">
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => toggleSelect(order.id)}
                    className="mt-1 text-slate-400 hover:text-white"
                  >
                    {isSelected ? <CheckSquare className="w-4 h-4 text-indigo-400" /> : <Square className="w-4 h-4" />}
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">Order #{order.id}</span>
                      <ShipmentStatusBadge status={order.status} />
                    </div>
                    <p className="text-xs text-slate-300 mt-0.5 font-medium">{order.book_title || 'Book Title'}</p>
                    <p className="text-[11px] text-slate-500">
                      Buyer: {order.buyer_name} ({order.buyer_college || 'Campus'}) • ₹{order.total_price}
                    </p>
                  </div>
                </div>

                {/* Status Action Buttons */}
                <div className="flex items-center gap-2 pl-7 md:pl-0">
                  {order.status === 'confirmed' && (
                    <button
                      onClick={() => onStatusUpdate(order.id, 'processing')}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-lg transition-colors"
                    >
                      Start Processing
                    </button>
                  )}
                  {order.status === 'processing' && (
                    <button
                      onClick={() => onStatusUpdate(order.id, 'packed')}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-colors"
                    >
                      Mark Packed
                    </button>
                  )}
                  {order.status === 'packed' && (
                    <button
                      onClick={() => onStatusUpdate(order.id, 'shipped')}
                      className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-lg transition-colors"
                    >
                      Dispatch & Ship
                    </button>
                  )}
                  {order.status === 'shipped' && (
                    <button
                      onClick={() => onStatusUpdate(order.id, 'delivered')}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors"
                    >
                      Mark Delivered
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default FulfillmentQueue;
