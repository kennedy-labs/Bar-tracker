import React, { useState, useEffect } from 'react';
import { User } from '../../types';
import { store } from '../../services/store';
import {
  Wine,
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  KeyRound,
  Delete,
  Building2,
  Store,
  Sparkles,
  Check,
  ArrowLeft,
  FileText,
} from 'lucide-react';

interface AuthScreenProps {
  onLogin: (user: User) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin }) => {
  const [viewMode, setViewMode] = useState<'SIGN_IN' | 'REGISTER'>(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname.toLowerCase();
      const hash = window.location.hash.toLowerCase();
      const search = window.location.search.toLowerCase();
      if (
        path.includes('signup') ||
        path.includes('register') ||
        hash.includes('signup') ||
        hash.includes('register') ||
        search.includes('signup') ||
        search.includes('register')
      ) {
        return 'REGISTER';
      }
    }
    return 'SIGN_IN';
  });
  const [authMode, setAuthMode] = useState<'CREDENTIALS' | 'KEYPAD'>('CREDENTIALS');

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

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash.includes('signup') || hash.includes('register')) {
        setViewMode('REGISTER');
      } else if (hash.includes('signin') || hash.includes('login')) {
        setViewMode('SIGN_IN');
      }
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // Sign In Form State
  const [username, setUsername] = useState<string>(() => {
    return localStorage.getItem('bartracker_saved_username') || '';
  });
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [rememberUser, setRememberUser] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [shake, setShake] = useState<boolean>(false);

  // Keypad State
  const [keypadUser, setKeypadUser] = useState<string>('');
  const [keypadPin, setKeypadPin] = useState<string>('');

  // Owner Business Registration State
  const [regBusinessName, setRegBusinessName] = useState<string>('');
  const [regPhone, setRegPhone] = useState<string>('');
  const [regAddress, setRegAddress] = useState<string>('');
  const [regOwnerName, setRegOwnerName] = useState<string>('');
  const [regUsername, setRegUsername] = useState<string>('');
  const [regPassword, setRegPassword] = useState<string>('');
  const [regShowPassword, setRegShowPassword] = useState<boolean>(false);
  const [regPinCode, setRegPinCode] = useState<string>('');
  const [regCatalogChoice, setRegCatalogChoice] = useState<'BLANK' | 'TEMPLATE'>('BLANK');
  const [regDrinksText, setRegDrinksText] = useState<string>('');
  const [isSubmittingReg, setIsSubmittingReg] = useState<boolean>(false);

  // Rate-Limiting & Brute-Force Protection State
  const [failedAttempts, setFailedAttempts] = useState<number>(() => {
    return parseInt(sessionStorage.getItem('bartracker_failed_attempts') || '0', 10);
  });
  const [lockoutRemaining, setLockoutRemaining] = useState<number>(() => {
    const until = parseInt(sessionStorage.getItem('bartracker_lockout_until') || '0', 10);
    const diff = Math.ceil((until - Date.now()) / 1000);
    return diff > 0 ? diff : 0;
  });

  useEffect(() => {
    if (lockoutRemaining <= 0) return;
    const timer = setInterval(() => {
      setLockoutRemaining((prev) => {
        if (prev <= 1) {
          sessionStorage.removeItem('bartracker_lockout_until');
          sessionStorage.setItem('bartracker_failed_attempts', '0');
          setFailedAttempts(0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutRemaining]);

  const recordFailedAttempt = () => {
    const nextAttempts = failedAttempts + 1;
    setFailedAttempts(nextAttempts);
    sessionStorage.setItem('bartracker_failed_attempts', String(nextAttempts));

    if (nextAttempts >= 5) {
      const lockUntil = Date.now() + 30000; // 30-second lockout
      sessionStorage.setItem('bartracker_lockout_until', String(lockUntil));
      setLockoutRemaining(30);
      triggerError('Security Lockout: Too many failed attempts. Access temporarily restricted for 30 seconds.');
    } else {
      triggerError(`Incorrect credentials. (${5 - nextAttempts} attempt${5 - nextAttempts === 1 ? '' : 's'} remaining)`);
    }
  };

  const recordSuccess = () => {
    setFailedAttempts(0);
    sessionStorage.removeItem('bartracker_failed_attempts');
    sessionStorage.removeItem('bartracker_lockout_until');
  };

  // All active registered users
  const users = store.getUsers().filter((u) => !u.isArchived);

  // Keypad is strictly for counter workers/bartenders to prevent PIN guessing against proprietor accounts
  const keypadStaff = users.filter((u) => u.role !== 'OWNER');

  const handleCredentialsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutRemaining > 0) return;
    setErrorMsg('');

    if (!username.trim() || !password.trim()) {
      setErrorMsg('Please enter both your username and password/PIN.');
      return;
    }

    const authenticatedUser = store.authenticateUser(username, password);
    if (authenticatedUser) {
      recordSuccess();
      if (rememberUser) {
        localStorage.setItem('bartracker_saved_username', username.trim());
      } else {
        localStorage.removeItem('bartracker_saved_username');
      }
      onLogin(authenticatedUser);
    } else {
      recordFailedAttempt();
    }
  };

  const handleKeypadDigit = (digit: string) => {
    if (lockoutRemaining > 0) return;
    if (keypadPin.length < 6) {
      const nextPin = keypadPin + digit;
      setKeypadPin(nextPin);
      setErrorMsg('');

      if (nextPin.length >= 4 && keypadUser) {
        const user = store.authenticateUser(keypadUser, nextPin);
        if (user) {
          if (user.role === 'OWNER') {
            triggerError('Proprietor accounts must authenticate via Username & Password.');
            setKeypadPin('');
            return;
          }
          recordSuccess();
          onLogin(user);
        } else if (nextPin.length === 6) {
          setKeypadPin('');
          recordFailedAttempt();
        }
      }
    }
  };

  const handleKeypadSubmit = () => {
    if (lockoutRemaining > 0) return;
    if (!keypadUser) {
      setErrorMsg('Please select your staff username first.');
      return;
    }
    const user = store.authenticateUser(keypadUser, keypadPin);
    if (user) {
      if (user.role === 'OWNER') {
        triggerError('Proprietor accounts must authenticate via Username & Password.');
        setKeypadPin('');
        return;
      }
      recordSuccess();
      onLogin(user);
    } else {
      setKeypadPin('');
      recordFailedAttempt();
    }
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    try {
      setIsSubmittingReg(true);
      const { user } = store.registerNewBusiness({
        businessName: regBusinessName,
        phone: regPhone,
        address: regAddress,
        ownerName: regOwnerName,
        ownerUsername: regUsername,
        ownerPassword: regPassword,
        ownerPinCode: regPinCode,
        seedCatalogTemplate: regCatalogChoice === 'TEMPLATE',
        initialDrinksText: regCatalogChoice === 'BLANK' ? regDrinksText : undefined,
      });
      recordSuccess();
      onLogin(user);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      triggerError(message);
    } finally {
      setIsSubmittingReg(false);
    }
  };

  const triggerError = (msg: string) => {
    setShake(true);
    setErrorMsg(msg);
    setTimeout(() => {
      setShake(false);
    }, 600);
  };

  // Keyboard shortcut listener for Keypad Mode
  useEffect(() => {
    if (viewMode !== 'SIGN_IN' || authMode !== 'KEYPAD') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) {
        handleKeypadDigit(e.key);
      } else if (e.key === 'Backspace') {
        setKeypadPin((prev) => prev.slice(0, -1));
        setErrorMsg('');
      } else if (e.key === 'Enter') {
        handleKeypadSubmit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, authMode, keypadPin, keypadUser]);

  return (
    <div className="min-h-screen bg-[#0B0F17] flex flex-col items-center justify-center p-4 selection:bg-emerald-500/20">
      <div className="w-full max-w-lg">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-3 shadow-lg shadow-emerald-950/50">
            {viewMode === 'REGISTER' ? <Store className="w-7 h-7" /> : <Wine className="w-7 h-7" />}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            {viewMode === 'REGISTER' ? 'Register New Bar Establishment' : 'Bar Tracker POS'}
          </h1>
          <p className="text-xs text-slate-400 mt-1 flex items-center justify-center gap-1.5 font-mono">
            {viewMode === 'REGISTER' ? (
              <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Proprietor (Owner) Sign Up · Direct Stock & Cash Control</span>
              </span>
            ) : (
              <span className="text-slate-400">Inventory, Handover & Cash Control System</span>
            )}
          </p>
        </div>

        {/* Top View Mode Switcher */}
        <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-[#0E1420] border border-slate-800 mb-4 text-xs font-semibold">
          <button
            type="button"
            onClick={() => switchMode('SIGN_IN')}
            className={`py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
              viewMode === 'SIGN_IN'
                ? 'bg-[#151D2C] text-white shadow-sm font-bold border border-slate-700/80 ring-1 ring-slate-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserIcon className="w-4 h-4 text-sky-400" />
            <div className="text-left">
              <div className="text-xs leading-none">Terminal Sign In</div>
              <div className="text-[10px] text-slate-400 font-normal mt-0.5">Staff & Owners</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => switchMode('REGISTER')}
            className={`py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
              viewMode === 'REGISTER'
                ? 'bg-emerald-500/20 text-emerald-300 shadow-sm font-bold border border-emerald-500/50 ring-1 ring-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Store className="w-4 h-4 text-emerald-400" />
            <div className="text-left">
              <div className="text-xs leading-none">Owner Sign Up</div>
              <div className="text-[10px] text-emerald-400/80 font-normal mt-0.5">Register Bar</div>
            </div>
          </button>
        </div>

        {/* Card Box */}
        <div
          className={`bg-[#121824] border border-[#1E293B] rounded-3xl p-5 sm:p-7 shadow-2xl transition-transform ${
            shake ? 'animate-shake' : ''
          }`}
        >
          {/* Rate-Limit Security Lockout Banner */}
          {lockoutRemaining > 0 && viewMode === 'SIGN_IN' && (
            <div className="mb-4 p-3.5 rounded-2xl bg-amber-950/80 border border-amber-600/80 text-xs text-amber-200 flex items-center justify-between shadow-lg animate-in fade-in">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
                <span className="font-semibold">Security Lockout Active</span>
              </div>
              <span className="font-mono font-black text-xs text-amber-300 bg-amber-900/80 px-2.5 py-1 rounded-xl border border-amber-700/80 tabular-nums">
                Retry in {lockoutRemaining}s
              </span>
            </div>
          )}

          {errorMsg && (
            <div className="mb-4 p-3 rounded-2xl bg-red-950/60 border border-red-800/80 text-xs text-red-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* VIEW MODE 1: REGISTER NEW BUSINESS (OWNER ONLY) */}
          {viewMode === 'REGISTER' ? (
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              {/* Owner-Only Notice */}
              <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-600/40 text-amber-200 text-xs flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-amber-300">Proprietor (Owner) Registration Only</div>
                  <p className="text-[11px] text-amber-200/90 mt-0.5 leading-relaxed">
                    Counter attendants and bartenders do <strong>not</strong> sign up here. Only bar owners create businesses. As the owner, you will register your attendants and issue their terminal PINs inside your Admin Dashboard under <strong>Staff Management</strong>.
                  </p>
                </div>
              </div>

              <div className="pb-3 border-b border-slate-800">
                <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" />
                  <span>1. Bar Establishment Profile</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Configure your bar's identity. Attendants will be added later in Admin.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Bar / Establishment Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={regBusinessName}
                    onChange={(e) => setRegBusinessName(e.target.value)}
                    placeholder="e.g. Club Havana, Highlands Lounge"
                    className="w-full bg-[#0E1420] border border-slate-800 focus:border-emerald-500 rounded-2xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      Contact Phone Number *
                    </label>
                    <input
                      type="text"
                      required
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="e.g. 0722 841 902"
                      className="w-full bg-[#0E1420] border border-slate-800 focus:border-emerald-500 rounded-2xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      Town / Location Address
                    </label>
                    <input
                      type="text"
                      value={regAddress}
                      onChange={(e) => setRegAddress(e.target.value)}
                      placeholder="e.g. Westlands, Nairobi"
                      className="w-full bg-[#0E1420] border border-slate-800 focus:border-emerald-500 rounded-2xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 pb-2 border-b border-slate-800">
                <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>2. Proprietor (Owner) Credentials</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Your master account for full executive control and shift audits.
                </p>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      Proprietor Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={regOwnerName}
                      onChange={(e) => setRegOwnerName(e.target.value)}
                      placeholder="e.g. Maina Mwangi"
                      className="w-full bg-[#0E1420] border border-slate-800 focus:border-emerald-500 rounded-2xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      Admin Login Username *
                    </label>
                    <input
                      type="text"
                      required
                      value={regUsername}
                      onChange={(e) => setRegUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      placeholder="e.g. maina"
                      className="w-full bg-[#0E1420] border border-slate-800 focus:border-emerald-500 rounded-2xl px-4 py-2.5 text-sm text-white font-mono placeholder-slate-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      Web Password (min 6 chars) *
                    </label>
                    <div className="relative">
                      <input
                        type={regShowPassword ? 'text' : 'password'}
                        required
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="Master password"
                        className="w-full bg-[#0E1420] border border-slate-800 focus:border-emerald-500 rounded-2xl pl-3.5 pr-10 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setRegShowPassword(!regShowPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1 cursor-pointer"
                      >
                        {regShowPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      Terminal Security PIN (4-6 digits) *
                    </label>
                    <input
                      type="password"
                      required
                      maxLength={6}
                      value={regPinCode}
                      onChange={(e) => setRegPinCode(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="e.g. 8888"
                      className="w-full bg-[#0E1420] border border-slate-800 focus:border-emerald-500 rounded-2xl px-4 py-2.5 text-sm text-white font-mono tracking-widest placeholder-slate-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* 3. Catalog Choice */}
              <div className="pt-2 pb-1 border-t border-slate-800">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  3. Initial Drinks Catalog Setup
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div
                    onClick={() => setRegCatalogChoice('BLANK')}
                    className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                      regCatalogChoice === 'BLANK'
                        ? 'bg-emerald-950/40 border-emerald-500 ring-1 ring-emerald-500/50'
                        : 'bg-[#0E1420] border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Blank Clean Slate</span>
                      </span>
                      {regCatalogChoice === 'BLANK' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                      Start fresh with zero sample items. Paste or enter your real drinks & prices right away.
                    </p>
                  </div>

                  <div
                    onClick={() => setRegCatalogChoice('TEMPLATE')}
                    className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                      regCatalogChoice === 'TEMPLATE'
                        ? 'bg-emerald-950/40 border-emerald-500 ring-1 ring-emerald-500/50'
                        : 'bg-[#0E1420] border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Wine className="w-3.5 h-3.5 text-blue-400" />
                        <span>Kenyan Bar Template</span>
                      </span>
                      {regCatalogChoice === 'TEMPLATE' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                      Pre-load popular Kenyan beers, ciders, spirits, and soft drinks with default prices.
                    </p>
                  </div>
                </div>

                {regCatalogChoice === 'BLANK' && (
                  <div className="mt-3 p-3.5 rounded-2xl bg-[#0E1420] border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Optional: Paste Real Products & Prices Now</span>
                      </label>
                      <span className="text-[10px] text-slate-500 font-mono">
                        (or paste later in Admin)
                      </span>
                    </div>
                    <textarea
                      rows={4}
                      value={regDrinksText}
                      onChange={(e) => setRegDrinksText(e.target.value)}
                      placeholder={`Tusker Lager, 250\nWhite Cap, 260\nGuinness 500ml, 300\nGilbeys 750ml, 1600\nJameson 750ml, 2800, 2200`}
                      className="w-full bg-[#121824] border border-slate-800 focus:border-emerald-500 rounded-xl p-3 text-xs text-white font-mono placeholder-slate-600 focus:outline-none resize-none leading-relaxed"
                    />
                    <div className="text-[10px] text-slate-400 flex items-center justify-between">
                      <span>Format: Drink Name, SellingPrice (e.g. Tusker, 250)</span>
                      {regDrinksText.trim() && (
                        <span className="text-emerald-400 font-bold">
                          {store.parseBulkDrinksText(regDrinksText).filter((d) => d.name.trim() && d.sellingPrice > 0).length} valid drinks detected
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Staff Notice */}
              <div className="p-3 rounded-2xl bg-[#0E1420] border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
                <UserIcon className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-200">Staff & Bartender Registration:</strong>{' '}
                  Counter attendants and bartenders can be registered directly inside your Owner Dashboard under{' '}
                  <span className="text-emerald-400 font-mono">Bar Setup &rarr; Staff</span>.
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmittingReg}
                className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 text-slate-950 font-bold text-sm tracking-wide shadow-lg shadow-emerald-950/60 flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
              >
                <span>{isSubmittingReg ? 'Provisioning Establishment...' : 'Register Business & Open Dashboard 🚀'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => switchMode('SIGN_IN')}
                  className="text-xs text-slate-400 hover:text-slate-200 flex items-center justify-center gap-1 mx-auto cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Already registered? Back to Terminal Sign In</span>
                </button>
              </div>
            </form>
          ) : (
            /* VIEW MODE 2: SIGN IN (CREDENTIALS OR KEYPAD) */
            <>
              {/* Auth Mode Sub-Tabs */}
              <div className="flex rounded-2xl bg-[#0E1420] border border-slate-800 p-1 mb-4 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('CREDENTIALS');
                    setErrorMsg('');
                  }}
                  className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    authMode === 'CREDENTIALS'
                      ? 'bg-[#151D2C] text-white shadow-sm font-bold border border-slate-700/60'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <UserIcon className="w-3.5 h-3.5" />
                  <span>Username & Password</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('KEYPAD');
                    setErrorMsg('');
                  }}
                  className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    authMode === 'KEYPAD'
                      ? 'bg-[#151D2C] text-white shadow-sm font-bold border border-slate-700/60'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Terminal Quick PIN</span>
                </button>
              </div>

              {/* MODE 1: Standard Username & Password / PIN Form */}
              {authMode === 'CREDENTIALS' ? (
                <form onSubmit={handleCredentialsSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                      Username
                    </label>
                    <div className="relative">
                      <UserIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="text"
                        required
                        disabled={lockoutRemaining > 0}
                        autoFocus
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Enter your username"
                        autoCapitalize="none"
                        autoCorrect="off"
                        className="w-full bg-[#0E1420] border border-slate-800 focus:border-emerald-500 disabled:opacity-50 rounded-2xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                        Password or Security PIN
                      </label>
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        disabled={lockoutRemaining > 0}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter password or 4-digit PIN"
                        className="w-full bg-[#0E1420] border border-slate-800 focus:border-emerald-500 disabled:opacity-50 rounded-2xl pl-10 pr-11 py-3 text-sm text-white placeholder-slate-500 focus:outline-none transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer p-1"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={rememberUser}
                        onChange={(e) => setRememberUser(e.target.checked)}
                        className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-0 w-3.5 h-3.5"
                      />
                      <span>Remember username on this terminal</span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={lockoutRemaining > 0}
                    className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-sm tracking-wide shadow-lg shadow-emerald-950/60 flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer mt-2"
                  >
                    <span>
                      {lockoutRemaining > 0 ? `Locked Out (${lockoutRemaining}s)` : 'Sign In to Terminal'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              ) : (
                /* MODE 2: Terminal Quick PIN Keypad (For touchscreen POS) */
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                      Select Staff Member
                    </label>
                    <select
                      value={keypadUser}
                      disabled={lockoutRemaining > 0}
                      onChange={(e) => {
                        setKeypadUser(e.target.value);
                        setKeypadPin('');
                        setErrorMsg('');
                      }}
                      className="w-full bg-[#0E1420] border border-slate-800 focus:border-emerald-500 disabled:opacity-50 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none"
                    >
                      <option value="">-- Choose your staff name --</option>
                      {keypadStaff.map((u) => (
                        <option key={u.id} value={u.username}>
                          {u.name} (Counter Bartender)
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Proprietor / Owner accounts must use Username & Password tab.
                    </p>
                  </div>

                  {/* PIN Indicator Dots */}
                  <div className="flex justify-center items-center gap-3 py-3">
                    {[0, 1, 2, 3].map((idx) => (
                      <div
                        key={idx}
                        className={`w-3.5 h-3.5 rounded-full transition-all duration-150 ${
                          keypadPin.length > idx
                            ? 'bg-emerald-400 ring-4 ring-emerald-500/20 scale-110'
                            : 'bg-slate-800 border border-slate-700'
                        }`}
                      />
                    ))}
                  </div>

                  {/* Tactical Numpad */}
                  <div className="grid grid-cols-3 gap-2.5">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                      <button
                        key={num}
                        type="button"
                        disabled={lockoutRemaining > 0}
                        onClick={() => handleKeypadDigit(String(num))}
                        className="h-13 rounded-2xl bg-[#151D2C] hover:bg-[#1E293B] disabled:opacity-40 active:scale-95 text-white text-lg font-bold font-mono transition-all border border-slate-800/80 hover:border-slate-700 flex items-center justify-center cursor-pointer shadow-sm"
                      >
                        {num}
                      </button>
                    ))}

                    <button
                      type="button"
                      disabled={lockoutRemaining > 0}
                      onClick={() => {
                        setKeypadPin('');
                        setErrorMsg('');
                      }}
                      className="h-13 rounded-2xl bg-[#0E1420] hover:bg-[#151D2C] disabled:opacity-40 active:scale-95 text-slate-400 text-xs font-semibold uppercase tracking-wider transition-all border border-slate-800 flex items-center justify-center cursor-pointer"
                    >
                      Clear
                    </button>

                    <button
                      type="button"
                      disabled={lockoutRemaining > 0}
                      onClick={() => handleKeypadDigit('0')}
                      className="h-13 rounded-2xl bg-[#151D2C] hover:bg-[#1E293B] disabled:opacity-40 active:scale-95 text-white text-lg font-bold font-mono transition-all border border-slate-800/80 hover:border-slate-700 flex items-center justify-center cursor-pointer shadow-sm"
                    >
                      0
                    </button>

                    <button
                      type="button"
                      disabled={lockoutRemaining > 0}
                      onClick={() => setKeypadPin((prev) => prev.slice(0, -1))}
                      className="h-13 rounded-2xl bg-[#0E1420] hover:bg-[#151D2C] disabled:opacity-40 active:scale-95 text-slate-400 hover:text-slate-200 transition-all border border-slate-800 flex items-center justify-center cursor-pointer"
                    >
                      <Delete className="w-5 h-5" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleKeypadSubmit}
                    disabled={lockoutRemaining > 0 || !keypadUser || keypadPin.length < 4}
                    className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 text-slate-950 disabled:text-slate-500 font-bold text-sm tracking-wide shadow-lg shadow-emerald-950/60 flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer mt-1"
                  >
                    <span>
                      {lockoutRemaining > 0 ? `Locked Out (${lockoutRemaining}s)` : 'Authorize & Clock In'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* New Owner Registration Callout when on Sign In */}
        {viewMode === 'SIGN_IN' && (
          <div className="mt-4 p-5 rounded-3xl bg-gradient-to-br from-[#121824] via-[#151D2C] to-[#0E1522] border-2 border-emerald-500/30 text-center space-y-2.5 shadow-xl ring-1 ring-emerald-500/20">
            <div className="text-xs font-bold text-white flex items-center justify-center gap-1.5 uppercase tracking-wider">
              <Store className="w-4 h-4 text-emerald-400" />
              <span>Are you a new bar proprietor?</span>
            </div>
            <p className="text-xs text-slate-300 max-w-sm mx-auto leading-relaxed">
              Register your establishment to start with a clean slate for your real products, set your prices, and add your counter attendants.
            </p>
            <button
              type="button"
              onClick={() => switchMode('REGISTER')}
              className="w-full py-3 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-emerald-950/50 active:scale-[0.98]"
            >
              <Sparkles className="w-4 h-4" />
              <span>Register Your Bar (Owner Sign Up) &rarr;</span>
            </button>
          </div>
        )}

        {/* Security Notice */}
        <div className="text-center mt-5 text-xs text-slate-500 flex items-center justify-center gap-1.5 font-mono">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500/70" />
          <span>Encrypted Session · Operational Audit Active</span>
        </div>
      </div>
    </div>
  );
};
