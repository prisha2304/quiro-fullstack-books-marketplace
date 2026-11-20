import React, { useState, useEffect } from 'react';
import sellerOperationsService from '../../services/sellerOperationsService';
import SellerVerificationStatus from './SellerVerificationStatus';
import SellerProfileCompletion from './SellerProfileCompletion';
import { UserCheck, Send, Award, Shield } from 'lucide-react';

const SellerOnboarding = ({ onCompleted }) => {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [onboardingData, setOnboardingData] = useState(null);
  const [completeness, setCompleteness] = useState({ score: 0, suggestions: [] });
  const [formData, setFormData] = useState({
    seller_display_name: '',
    seller_bio: '',
    campus_department: '',
    phone: ''
  });
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const loadOnboarding = async () => {
    try {
      setLoading(true);
      const res = await sellerOperationsService.getOnboarding();
      if (res.success) {
        setOnboardingData(res.onboarding);
        setCompleteness(res.completeness);
        setFormData({
          seller_display_name: res.onboarding.seller_display_name || '',
          seller_bio: res.onboarding.seller_bio || '',
          campus_department: res.onboarding.campus_department || '',
          phone: ''
        });
      }
    } catch (err) {
      console.error('Failed to load onboarding info:', err);
      setError('Unable to load onboarding status.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOnboarding();
  }, []);

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      const res = await sellerOperationsService.submitOnboarding(formData);
      if (res.success) {
        setMessage('Seller verification submitted successfully! Our campus moderators will verify your details.');
        await loadOnboarding();
        if (onCompleted) onCompleted();
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4 p-6 bg-slate-900/60 rounded-2xl border border-slate-800">
        <div className="h-6 bg-slate-800 rounded w-1/3"></div>
        <div className="h-20 bg-slate-800 rounded"></div>
        <div className="h-32 bg-slate-800 rounded"></div>
      </div>
    );
  }

  const isSubmitted = onboardingData?.seller_status === 'SUBMITTED' || onboardingData?.seller_status === 'UNDER_REVIEW';

  return (
    <div className="space-y-6">
      {/* Verification Status Card */}
      <SellerVerificationStatus 
        status={onboardingData?.seller_status || 'NOT_STARTED'} 
        reviewedAt={onboardingData?.verification_reviewed_at}
        rejectionReason={onboardingData?.rejection_reason}
      />

      {/* Completeness Score */}
      <SellerProfileCompletion 
        score={completeness.score} 
        suggestions={completeness.suggestions} 
      />

      {/* Onboarding / Profile Form */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-md">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Campus Seller Onboarding</h3>
            <p className="text-xs text-slate-400">
              Provide student-friendly profile details to establish trust across the campus marketplace
            </p>
          </div>
        </div>

        {message && (
          <div className="p-4 mb-5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center gap-2">
            <Award className="w-5 h-5 flex-shrink-0" />
            <span>{message}</span>
          </div>
        )}

        {error && (
          <div className="p-4 mb-5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Seller Display Name / Store Name *
              </label>
              <input
                type="text"
                name="seller_display_name"
                value={formData.seller_display_name}
                onChange={handleChange}
                placeholder="e.g. Alex (CS Dept 2025)"
                required
                className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Campus Department / College *
              </label>
              <input
                type="text"
                name="campus_department"
                value={formData.campus_department}
                onChange={handleChange}
                placeholder="e.g. Engineering Block A / IIT"
                required
                className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Contact Phone (For instant order handoffs)
            </label>
            <input
              type="text"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="+91 98765 43210"
              className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Seller Bio & Notes (Syllabus books, condition promise)
            </label>
            <textarea
              name="seller_bio"
              rows={3}
              value={formData.seller_bio}
              onChange={handleChange}
              placeholder="Hi! I am selling 2nd & 3rd year engineering and economics textbooks. All books include solved exam notes and are in great condition!"
              className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors resize-none"
            />
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Shield className="w-4 h-4 text-indigo-400" />
              <span>Simple campus verification — no Aadhaar/PAN required.</span>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-medium text-sm rounded-xl shadow-lg shadow-indigo-500/25 flex items-center gap-2 disabled:opacity-50 transition-all cursor-pointer"
            >
              <Send className="w-4 h-4" />
              {submitting ? 'Submitting...' : isSubmitted ? 'Update Details' : 'Submit for Verification'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SellerOnboarding;
