import React, { useState, useEffect } from 'react';
import { User } from '../../types';
import { store } from '../../services/store';
import { authService } from '../../services/auth';
import {
  Wine,
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  Store,
  Clock,
} from 'lucide-react';
import { PWAInstallCard } from '../common/PWAInstallCard';

interface AuthScreenProps {
  onLogin: (user: User) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin }) => {
  const [, setHasExistingBusiness] = useState<boolean>(() => store.hasAnyBusiness());

  useEffect(() => {
    return store.subscribe(() => {
      const anyBiz = store.hasAnyBusiness();
      setHasExistingBusiness(anyBiz);
      if (!anyBiz) {
        setViewMode('REGISTER');
      }
    });
  }, []);

  const [viewMode, setViewMode] = useState<'SIGN_IN' | 'REGISTER'>(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.toLowerCase();
      if (hash.includes('signup') || hash.includes('register')) {
        return 'REGISTER';
      }
    }
    return store.hasAnyBusiness() ? 'SIGN_IN' : 'REGISTER';
  });

  // Sign In: The 3 Simple Inputs (Bar Name + Username + Password)
  const [businessName, setBusinessName] = useState<string>(() => {
    const biz = store.getCurrentBusiness();
    return biz && biz.name && biz.name !== 'My Bar Establishment' ? biz.name : '';
  });
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [shake, setShake] = useState<boolean>(false);
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [lockoutSeconds, setLockoutSeconds] = useState<number>(0);

  // Register New Bar State (Simple & direct)
  const [regBusinessName, setRegBusinessName] = useState<string>('');
  const [regOwnerName, setRegOwnerName] = useState<string>('');
  const [regPhone, setRegPhone] = useState<string>('');
  const [regUsername, setRegUsername] = useState<string>('');
  const [regPassword, setRegPassword] = useState<string>('');
  const [regConfirmPassword, setRegConfirmPassword] = useState<string>('');
  const [isSubmittingReg, setIsSubmittingReg] = useState<boolean>(false);

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const timer = setInterval(() => {
      setLockoutSeconds((prev) => {
        if (prev <= 1) {
          setErrorMsg('');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutSeconds]);

  const switchMode = (mode: 'SIGN_IN' | 'REGISTER') => {
    setViewMode(mode);
    setErrorMsg('');
    if (typeof window !== 'undefined') {
      try {
        window.location.hash = mode === 'REGISTER' ? 'signup' : 'signin';
      } catch {
        // ignore
      }
    }
  };

  const triggerError = (msg: string) => {
    setShake(true);
    setErrorMsg(msg);
    setTimeout(() => {
      setShake(false);
    }, 600);
  };

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (lockoutSeconds > 0) {
      triggerError(`Please wait ${lockoutSeconds} seconds before trying again.`);
      return;
    }

    const cleanBiz = businessName.trim();
    const cleanUsername = username.trim();
    const cleanPassword = password.trim();

    if (!cleanBiz || !cleanUsername || !cleanPassword) {
      triggerError('Please fill in Bar Name, Username, and Password.');
      return;
    }

    setIsAuthenticating(true);
    try {
      const authenticatedUser = await store.authenticateUser(cleanUsername, cleanPassword, cleanBiz);
      if (authenticatedUser) {
        if (authenticatedUser.businessId) {
          store.setCurrentBusiness(authenticatedUser.businessId);
        }
        onLogin(authenticatedUser);
      } else {
        const lockout = authService.getLockoutStatus(cleanUsername);
        if (lockout.isLocked) {
          setLockoutSeconds(lockout.secondsRemaining);
          triggerError(`Locked for ${lockout.secondsRemaining} seconds due to repeated failed attempts.`);
        } else {
          triggerError(`Wrong username or password. ${lockout.attemptsLeft} tries left.`);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      triggerError(msg);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanBiz = regBusinessName.trim();
    const cleanUsername = regUsername.trim().toLowerCase();
    const cleanPassword = regPassword.trim();

    if (!cleanBiz) {
      triggerError('Please enter your Bar Name.');
      return;
    }

    if (!cleanUsername) {
      triggerError('Please choose a Username.');
      return;
    }

    if (cleanPassword.length < 4) {
      triggerError('Password must be at least 4 characters.');
      return;
    }

    if (cleanPassword !== regConfirmPassword.trim()) {
      triggerError('Passwords do not match. Please retype password.');
      return;
    }

    try {
      setIsSubmittingReg(true);
      const { user } = await store.registerNewBusiness({
        businessName: cleanBiz,
        phone: regPhone.trim() || '0700000000',
        ownerName: regOwnerName.trim() || cleanUsername,
        ownerUsername: cleanUsername,
        ownerPassword: cleanPassword,
      });

      onLogin(user);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      triggerError(message);
    } finally {
      setIsSubmittingReg(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F17] flex flex-col items-center justify-center p-4 selection:bg-emerald-500/30">
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-emerald-950/20 via-transparent to-transparent"></div>

      <div className="w-full max-w-md relative z-10 my-4">
        {/* Simple friendly Header */}
        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 shadow-lg mb-2 shadow-emerald-950/40">
            <Wine className="w-6 h-6 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Bar Track
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Simple Bar Stock & Money Tracker
          </p>
        </div>

        {/* Top switch: Sign In vs Register */}
        <div className="flex bg-[#0E1420] p-1 rounded-2xl border border-slate-800 mb-4 shadow-inner">
          <button
            type="button"
            onClick={() => switchMode('SIGN_IN')}
            className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              viewMode === 'SIGN_IN'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => switchMode('REGISTER')}
            className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              viewMode === 'REGISTER'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Register New Bar
          </button>
        </div>

        {/* Error / Lockout Banner */}
        {errorMsg && (
          <div
            className={`p-3 rounded-2xl mb-4 flex items-start gap-2.5 text-xs shadow-lg transition-all ${
              shake ? 'animate-bounce' : ''
            } ${
              lockoutSeconds > 0
                ? 'bg-amber-950/90 border border-amber-500/70 text-amber-200'
                : 'bg-red-950/90 border border-red-500/70 text-red-200'
            }`}
          >
            {lockoutSeconds > 0 ? (
              <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 font-medium">{errorMsg}</div>
          </div>
        )}

        {/* ======================= VIEW MODE: SIGN IN (3 SIMPLE INPUTS) ======================= */}
        {viewMode === 'SIGN_IN' && (
          <div className="bg-[#121824] border border-[#1E293B] rounded-3xl p-5 sm:p-6 shadow-2xl">
            <form onSubmit={handleSignInSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Bar Name
                </label>
                <div className="relative">
                  <Store className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. Test bar"
                    disabled={isAuthenticating || lockoutSeconds > 0}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0A0D14] border border-slate-700 text-white focus:outline-none focus:border-emerald-500 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Username
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. worker or owner"
                    disabled={isAuthenticating || lockoutSeconds > 0}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0A0D14] border border-slate-700 text-white focus:outline-none focus:border-emerald-500 text-sm"
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    disabled={isAuthenticating || lockoutSeconds > 0}
                    className="w-full pl-10 pr-11 py-2.5 rounded-xl bg-[#0A0D14] border border-slate-700 text-white focus:outline-none focus:border-emerald-500 text-sm font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer p-1"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isAuthenticating || lockoutSeconds > 0}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-slate-950 font-black text-sm shadow-xl shadow-emerald-950/60 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              >
                {isAuthenticating ? (
                  <span>Signing In...</span>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* ======================= VIEW MODE: REGISTER NEW BAR ======================= */}
        {viewMode === 'REGISTER' && (
          <div className="bg-[#121824] border border-[#1E293B] rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-0.5">
                <Store className="w-4 h-4" />
                <span>New Bar Setup</span>
              </div>
              <h2 className="text-lg font-black text-white tracking-tight">
                Register Your Bar
              </h2>
            </div>

            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Bar Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Test bar"
                  value={regBusinessName}
                  onChange={(e) => setRegBusinessName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A0D14] border border-slate-700 text-white text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Owner Username <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. owner"
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A0D14] border border-slate-700 text-white text-sm font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Password <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    minLength={4}
                    placeholder="Password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A0D14] border border-slate-700 text-white text-sm font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Confirm Password <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    minLength={4}
                    placeholder="Retype password"
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A0D14] border border-slate-700 text-white text-sm font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmittingReg}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-slate-950 font-black text-sm shadow-xl shadow-emerald-950/60 transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                {isSubmittingReg ? (
                  <span>Setting Up Your Bar...</span>
                ) : (
                  <>
                    <span>Create Bar & Open</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* Dedicated PWA Install Card for Mobile Staff (Disappears once installed) */}
        <PWAInstallCard className="mt-3 sm:mt-4" />
      </div>
    </div>
  );
};
