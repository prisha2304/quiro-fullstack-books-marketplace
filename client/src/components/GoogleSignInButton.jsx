

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const GoogleSignInButton = ({ text = "Continue with Google" }) => {
  const { loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const btnContainerRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [buttonRendered, setButtonRendered] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const isConfigured = Boolean(
    googleClientId &&
    !googleClientId.includes('placeholder') &&
    googleClientId.trim().length > 0
  );

  const handleCredentialResponse = useCallback(async (response) => {
    if (!response.credential) return;
    setLoading(true);
    try {
      const user = await loginWithGoogle(response.credential);
      toast.success('Welcome, ' + (user?.full_name || 'Reader') + '!');
      if (user.role === 'ADMIN') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Google Sign-In failed');
    } finally {
      setLoading(false);
    }
  }, [loginWithGoogle, navigate]);

  useEffect(() => {
    if (!isConfigured) return;

    let checkInterval = null;
    let isCancelled = false;

    const renderGoogleButton = () => {
      if (isCancelled || !btnContainerRef.current) return false;

      if (!window.google?.accounts?.id) {
        return false;
      }

      try {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleCredentialResponse,
          auto_select: false
        });

        // Determine button width: Google GIS requires integer width in pixels (min 200, max 400)
        const containerWidth = btnContainerRef.current.offsetWidth || 360;
        const buttonWidth = Math.min(Math.max(Math.floor(containerWidth), 200), 400);

        btnContainerRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(btnContainerRef.current, {
          theme: 'outline',
          size: 'large',
          width: buttonWidth,
          text: text.toLowerCase().includes('up') ? 'signup_with' : 'signin_with',
          shape: 'rectangular',
          logo_alignment: 'left'
        });

        setButtonRendered(true);
        setLoadError(false);
        return true;
      } catch (err) {
        console.error('Google Sign-In renderButton error:', err);
        return false;
      }
    };

    // 1. Try rendering immediately if GIS script is already loaded
    if (!renderGoogleButton()) {
      // 2. Poll until Google GIS script is ready (every 100ms for up to 6 seconds)
      let attempts = 0;
      checkInterval = setInterval(() => {
        attempts++;
        if (renderGoogleButton()) {
          clearInterval(checkInterval);
        } else if (attempts >= 60) {
          clearInterval(checkInterval);
          if (!isCancelled) {
            setLoadError(true);
          }
        }
      }, 100);
    }

    return () => {
      isCancelled = true;
      if (checkInterval) clearInterval(checkInterval);
    };
  }, [isConfigured, googleClientId, text, handleCredentialResponse]);

  const handleUnconfiguredClick = () => {
    toast((t) => (
      <div className="text-xs space-y-1">
        <p className="font-bold text-slate-800">Google OAuth Setup Required</p>
        <p className="text-slate-600">Add <code>VITE_GOOGLE_CLIENT_ID</code> in <code>client/.env</code> and <code>GOOGLE_CLIENT_ID</code> in <code>server/.env</code> to activate Google Sign-In.</p>
        <p className="text-slate-400">See <code>docs/PHASE15_CREDENTIAL_SETUP.md</code> for instructions.</p>
      </div>
    ), { duration: 6000, icon: 'ℹ️' });
  };

  if (!isConfigured) {
    return (
      <button
        type="button"
        onClick={handleUnconfiguredClick}
        className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 transition-colors shadow-xs text-sm font-semibold text-slate-700 active:scale-[0.99]"
      >
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
        </svg>
        <span>{text}</span>
        <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded ml-auto">Local Setup</span>
      </button>
    );
  }

  if (loadError) {
    return (
      <div className="w-full text-center space-y-2">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-amber-200 rounded-xl bg-amber-50/50 hover:bg-amber-100/50 transition-colors text-sm font-semibold text-amber-800"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
          </svg>
          <span>Retry Google Sign-In</span>
        </button>
        <p className="text-[11px] text-slate-400">Google services could not be reached. Check network or ad blocker.</p>
      </div>
    );
  }

  return (
    <div className="w-full relative flex justify-center min-h-[44px]">
      {/* Loading placeholder rendered only while GIS prepares the official button */}
      {!buttonRendered && (
        <div className="absolute inset-0 w-full h-11 border border-slate-200 rounded-xl bg-slate-50 animate-pulse flex items-center justify-center text-xs text-slate-400 pointer-events-none">
          {loading ? 'Signing in with Google...' : 'Loading Google Sign-In...'}
        </div>
      )}
      {/* Dedicated unmanaged DOM container for Google GIS iframe */}
      <div
        ref={btnContainerRef}
        className="w-full flex justify-center"
        style={{ minHeight: '44px' }}
      />
    </div>
  );
};

export default GoogleSignInButton;
