import React, { useState, useEffect } from 'react';
import { Clock, ShieldCheck, AlertCircle } from 'lucide-react';

const InventoryReservationNotice = ({ ttlMinutes = 15, onExpire }) => {
    const [secondsLeft, setSecondsLeft] = useState(ttlMinutes * 60);

    useEffect(() => {
        const timer = setInterval(() => {
            setSecondsLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    if (onExpire) onExpire();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [ttlMinutes, onExpire]);

    const minutes = Math.floor(secondsLeft / 60);
    const seconds = secondsLeft % 60;

    return (
        <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl flex items-center justify-between text-xs text-amber-900 shadow-sm animate-fadeIn">
            <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600 shrink-0 animate-pulse" />
                <span>
                    <strong>Inventory Reserved:</strong> Items are held for your checkout
                </span>
            </div>
            <div className="flex items-center gap-1 font-mono font-bold bg-amber-100/80 px-2 py-0.5 rounded text-amber-800 border border-amber-300/60">
                <span>{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}</span>
            </div>
        </div>
    );
};

export default InventoryReservationNotice;
