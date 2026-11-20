import React from 'react';
import { CheckCircle2, AlertCircle, Clock, RotateCcw, XCircle } from 'lucide-react';

const PaymentStatus = ({ status, amount, currency = 'INR', className = '' }) => {
    const getBadgeConfig = () => {
        const s = (status || '').toUpperCase();
        switch (s) {
            case 'CAPTURED':
            case 'PAID':
                return {
                    label: 'Captured & Paid',
                    bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                    icon: CheckCircle2
                };
            case 'PENDING':
            case 'AUTHORIZED':
                return {
                    label: 'Processing',
                    bg: 'bg-amber-50 text-amber-700 border-amber-200',
                    icon: Clock
                };
            case 'FAILED':
                return {
                    label: 'Failed',
                    bg: 'bg-rose-50 text-rose-700 border-rose-200',
                    icon: XCircle
                };
            case 'REFUNDED':
                return {
                    label: 'Refunded',
                    bg: 'bg-purple-50 text-purple-700 border-purple-200',
                    icon: RotateCcw
                };
            case 'PARTIALLY_REFUNDED':
                return {
                    label: 'Partially Refunded',
                    bg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
                    icon: RotateCcw
                };
            default:
                return {
                    label: status || 'Pending',
                    bg: 'bg-slate-50 text-slate-750 border-slate-200',
                    icon: AlertCircle
                };
        }
    };

    const config = getBadgeConfig();
    const Icon = config.icon;

    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${config.bg} ${className}`}>
            <Icon className="w-3.5 h-3.5" />
            <span>{config.label}</span>
        </span>
    );
};

export default PaymentStatus;
