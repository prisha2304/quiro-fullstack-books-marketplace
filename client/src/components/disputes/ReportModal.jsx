import React, { useState } from 'react';
import { ShieldAlert, X, AlertTriangle, CheckCircle2, Loader2, Upload } from 'lucide-react';
import disputeService from '../../services/disputeService';
import toast from 'react-hot-toast';

const REPORT_REASONS = {
  book: [
    'Fake / Misleading Listing',
    'Incorrect Book Condition',
    'Wrong Edition / ISBN Mismatch',
    'Suspicious Pricing',
    'Duplicate Listing',
    'Prohibited / Inappropriate Content',
    'Copyright Concern'
  ],
  seller: [
    'Fraud / Scam Activity',
    'Item Misrepresentation',
    'Harassment / Abusive Behavior',
    'Repeated Order Cancellation / Non-Delivery',
    'Fake Profile Information'
  ],
  buyer: [
    'Payment Problem / Fraud',
    'Harassment / Abusive Communication',
    'Repeated Unjustified Return Claims'
  ],
  review: [
    'Spam / Advertising',
    'Fake / Manipulated Review',
    'Abusive or Inappropriate Language',
    'Irrelevant / Off-topic Content'
  ],
  order: [
    'Wrong Item Received',
    'Damaged / Defective Book',
    'Missing Item from Package',
    'Item Significantly Different from Description',
    'Delivery / Tracking Issue',
    'Payment Double Charged'
  ],
  swap: [
    'Wrong Book Sent',
    'Damaged Book Received',
    'Counterpart Did Not Ship',
    'Severe Condition Misrepresentation'
  ]
};

const ReportModal = ({ isOpen, onClose, targetType = 'book', targetId, targetTitle = '', onSuccess }) => {
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const reasonsList = REPORT_REASONS[targetType] || REPORT_REASONS.book;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason) {
      toast.error('Please select a report reason');
      return;
    }

    setSubmitting(true);
    try {
      await disputeService.createReport({
        targetType,
        targetId,
        reason,
        description,
        evidenceUrl: evidenceUrl.trim() || null
      });

      toast.success('Report submitted successfully. Our Trust & Safety team will investigate.');
      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to submit report');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200/80 text-left overflow-hidden relative animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
              <ShieldAlert size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                Report {targetType === 'book' ? 'Listing' : targetType.toUpperCase()}
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                {targetTitle ? `Target: "${targetTitle.slice(0, 35)}..."` : 'Help keep QUIRO safe for all readers.'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Reason Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Reason for Report <span className="text-red-500">*</span>
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
            >
              <option value="">Select a specific issue...</option>
              {reasonsList.map((r, idx) => (
                <option key={idx} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Detailed Explanation <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide relevant context, page differences, or specific interaction details..."
              rows={3}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all resize-none"
            />
          </div>

          {/* Evidence URL */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Image / Screenshot Link <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              type="url"
              value={evidenceUrl}
              onChange={(e) => setEvidenceUrl(e.target.value)}
              placeholder="https://... image evidence of damage or discrepancy"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
            />
          </div>

          <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-3 flex items-start gap-2.5 text-[11px] text-slate-500">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <span>
              All reports are logged and reviewed by the QUIRO Safety &amp; Verification Team. False reports may be penalized under our community guidelines.
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="bg-amber-600 hover:bg-amber-700 text-white px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Submit Report</span>
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};

export default ReportModal;
