import React from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('QUIRO Global Error Boundary Caught:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FAFAF9] flex items-center justify-center p-6 text-left">
          <div className="bg-white border border-slate-200/80 rounded-3xl p-8 max-w-lg w-full shadow-premium space-y-5">
            
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
              <AlertCircle size={24} />
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600">
                Application Exception
              </span>
              <h2 className="text-xl font-black text-slate-900 tracking-tight mt-0.5">
                Something didn't load properly
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                An unexpected interface error occurred. Our team has been notified, and your data remains secure in escrow.
              </p>
            </div>

            {process.env.NODE_ENV !== 'production' && this.state.error && (
              <pre className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-700 font-mono overflow-x-auto max-h-32">
                {this.state.error.toString()}
              </pre>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={this.handleReset}
                className="flex-1 bg-primary-600 hover:bg-primary-700 text-white py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-[0.98] cursor-pointer"
              >
                <RefreshCw size={14} />
                <span>Reload Page</span>
              </button>
              <a
                href="/"
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <Home size={14} />
                <span>Go to Home</span>
              </a>
            </div>

          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
