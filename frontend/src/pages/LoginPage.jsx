import { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { setCredentials } from '../store/authSlice.js';
import { api } from '../services/api.js';
import { Coins, KeyRound, Mail, ArrowRight, ShieldCheck, Clock, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const dispatch = useDispatch();
  const [step, setStep] = useState(1); // 1: Email, 2: 6-Digit Code
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [remainingAttempts, setRemainingAttempts] = useState(5);
  const [countdown, setCountdown] = useState(600); // 10 minutes

  useEffect(() => {
    let timer;
    if (step === 2 && countdown > 0) {
      timer = setInterval(() => setCountdown(c => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [step, countdown]);

  const formatTimer = (sec) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleRequestCode = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;

    setError('');
    setMessage('');
    setLoading(true);

    try {
      const res = await api.requestCode(email.trim());
      setMessage(res.message);
      setStep(2);
      setCountdown(600);
      setRemainingAttempts(5);
    } catch (err) {
      setError(err.message || 'Failed to request magic code.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    if (!code.trim() || code.length !== 6) {
      setError('Please enter a valid 6-digit code.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await api.verifyCode(email.trim(), code.trim());
      dispatch(setCredentials({ token: res.token, user: res.user }));
    } catch (err) {
      setError(err.message || 'Invalid code.');
      if (err.data?.remainingAttempts !== undefined) {
        setRemainingAttempts(err.data.remainingAttempts);
      }
    } finally {
      setLoading(false);
    }
  };

  const fillTestUser = (testEmail) => {
    setEmail(testEmail);
    setError('');
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 border border-slate-100">
        
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-amber-500/30">
            <Coins className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Swarn Sathi</h1>
          <p className="text-sm text-slate-500 mt-1">Branch Console • Secure Passwordless Login</p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Authentication Error</p>
              <p className="text-rose-700 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Step 1: Request Code */}
        {step === 1 ? (
          <form onSubmit={handleRequestCode} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Staff Email Address
              </label>
              <div className="relative">
                <Mail className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  required
                  placeholder="name@swarnsathi.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold text-sm rounded-xl transition-all shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? 'Sending Code...' : 'Send Magic Code'}
              <ArrowRight className="w-4 h-4" />
            </button>

            {/* Quick-fill accounts for demo */}
            <div className="pt-4 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider text-center">
                Demo Quick-Fill Accounts:
              </p>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => fillTestUser('staff@swarnsathi.com')}
                  className="px-2 py-1.5 text-xs font-medium rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer"
                >
                  Branch Staff
                </button>
                <button
                  type="button"
                  onClick={() => fillTestUser('manager@swarnsathi.com')}
                  className="px-2 py-1.5 text-xs font-medium rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors cursor-pointer"
                >
                  Manager
                </button>
                <button
                  type="button"
                  onClick={() => fillTestUser('admin@swarnsathi.com')}
                  className="px-2 py-1.5 text-xs font-medium rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 transition-colors cursor-pointer"
                >
                  Admin
                </button>
              </div>
            </div>
          </form>
        ) : (
          /* Step 2: Verify 6-Digit Code */
          <form onSubmit={handleVerifyCode} className="space-y-5">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
              <p className="font-semibold mb-0.5">Code Dispatched!</p>
              <p>Check your <strong>backend terminal console</strong> where the 6-digit code has been printed.</p>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-sm font-semibold text-slate-700">Enter 6-Digit Magic Code</label>
                <div className="flex items-center gap-1 text-xs font-medium text-amber-700">
                  <Clock className="w-3.5 h-3.5" />
                  {formatTimer(countdown)}
                </div>
              </div>
              <div className="relative">
                <KeyRound className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  required
                  maxLength={6}
                  autoFocus
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 tracking-widest text-lg font-mono focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none transition-all text-center"
                />
              </div>
              <p className="text-xs text-slate-500 mt-1.5 text-right">
                Attempts remaining: <span className="font-bold text-slate-700">{remainingAttempts}</span>/5
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold text-sm rounded-xl transition-all shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? 'Verifying...' : 'Sign In to Console'}
              <ShieldCheck className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => { setStep(1); setCode(''); setError(''); }}
              className="w-full text-xs text-slate-500 hover:text-slate-800 transition-colors text-center cursor-pointer"
            >
              ← Back to change email
            </button>
          </form>
        )}

      </div>
    </div>
  );
}