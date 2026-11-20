import React from 'react';
import { CheckCircle2, MapPin } from 'lucide-react';
import ShipmentStatusBadge from './ShipmentStatusBadge';

const ShipmentTimeline = ({ timeline }) => {
  if (!timeline || !timeline.hasShipment) {
    return (
      <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 text-center text-xs text-slate-400">
        Order is being processed by the seller. Tracking details will update once packaged.
      </div>
    );
  }

  const steps = [
    { label: 'Label Created', key: 'LABEL_CREATED' },
    { label: 'In Transit', key: 'IN_TRANSIT' },
    { label: 'Out for Delivery', key: 'OUT_FOR_DELIVERY' },
    { label: 'Delivered', key: 'DELIVERED' }
  ];

  const currentStatus = (timeline.status || '').toUpperCase();

  const getStepStatus = (index) => {
    const statusMap = {
      'LABEL_CREATED': 0,
      'SHIPPED': 1,
      'IN_TRANSIT': 1,
      'OUT_FOR_DELIVERY': 2,
      'DELIVERED': 3
    };
    const currentIdx = statusMap[currentStatus] !== undefined ? statusMap[currentStatus] : 0;
    if (index < currentIdx) return 'completed';
    if (index === currentIdx) return 'current';
    return 'upcoming';
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-md">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Tracking:</span>
            <span className="text-xs font-mono font-bold text-indigo-400">{timeline.trackingNumber}</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">Carrier: {timeline.carrier} ({timeline.mode || 'MOCK'})</p>
        </div>
        <ShipmentStatusBadge status={timeline.status} />
      </div>

      {/* Visual Stepper */}
      <div className="grid grid-cols-4 gap-2 mb-6 text-center">
        {steps.map((step, idx) => {
          const state = getStepStatus(idx);
          return (
            <div key={idx} className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-1.5 border transition-all ${
                state === 'completed'
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                  : state === 'current'
                  ? 'bg-indigo-500/20 border-indigo-400 text-indigo-300 ring-2 ring-indigo-500/30'
                  : 'bg-slate-800 border-slate-700 text-slate-500'
              }`}>
                {state === 'completed' ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <span className="text-xs font-bold">{idx + 1}</span>
                )}
              </div>
              <span className={`text-[11px] font-medium ${state === 'upcoming' ? 'text-slate-500' : 'text-slate-200'}`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Live Event Timeline */}
      {timeline.events && timeline.events.length > 0 && (
        <div className="space-y-3 pt-3 border-t border-slate-800">
          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Tracking History</h4>
          <div className="relative pl-4 space-y-3 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
            {timeline.events.map((evt, idx) => (
              <div key={idx} className="relative pl-4">
                <div className="absolute -left-[14px] top-1.5 w-2 h-2 rounded-full bg-indigo-500 ring-2 ring-slate-900" />
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-200">{evt.description}</p>
                  <span className="text-[10px] text-slate-500">
                    {evt.event_time ? new Date(evt.event_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>
                {evt.location && (
                  <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3 text-slate-500" />
                    {evt.location}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ShipmentTimeline;
