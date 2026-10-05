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
  Clock,
  Database,
} from 'lucide-react';

interface AuthScreenProps {
  onLogin: (user: User) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin }) => {
  const hasExistingBusiness = store.hasAnyBusiness();

  // If no businesses exist in the system, automatically default to the clean Register/Onboarding view
  const [viewMode, setViewMode] = useState<'SIGN_IN' | 'REGISTER'>(() => {
    if (!hasExistingBusiness) return 'REGISTER';
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.toLowerCase();
      if (hash.includes('signup') || hash.includes('register')) {
        return 'REGISTER';
      }
    }
    return 'SIGN_IN';
  });

  const [authMode, setAuthMode] = useState<'CREDENTIALS' | 'KEYPAD'>('CREDENTIALS');

  // Sign In Form State
  const [username, setUsername] = useState<string>(() => {
    return localStorage.getItem('bartracker_saved_username') || '';
  });
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [rememberUser, setRememberUser] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [shake, setShake] = useState<boolean>(false);
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);

  // Keypad State (Staff identifier + PIN)
  const [keypadUser, setKeypadUser] = useState<string>('');
  const [keypadPin, setKeypadPin] = useState<string>('');

  // Lockout State
  const [lockoutSeconds, setLockoutSeconds] = useState<number>(0);

  // Owner Business Registration State (Clean start)
  const [regBusinessName, setRegBusinessName] = useState<string>('');
  const [regPhone, setRegPhone] = useState<string>('');
  const [regAddress, setRegAddress] = useState<string>('');
  const [regOwnerName, setRegOwnerName] = useState<string>('');
  const [regUsername, setRegUsername] = useState<string>('');
  const [regPassword, setRegPassword] = useState<string>('');
  const [regConfirmPassword, setRegConfirmPassword] = useState<string>('');
  const [regShowPassword, setRegShowPassword] = useState<boolean>(false);
  const [regPinCode, setRegPinCode] = useState<string>('');
  const [regCatalogChoice, setRegCatalogChoice] = useState<'BLANK' | 'CUSTOM'>('BLANK');
  const [regDrinksText, setRegDrinksText] = useState<string>('');
  const [isSubmittingReg, setIsSubmittingReg] = useState<boolean>(false);

  // Sync hash changes
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash.includes('signup') || hash.includes('register')) {
        setViewMode('REGISTER');
      } else if (hasExistingBusiness && (hash.includes('signin') || hash.includes('login'))) {
        setViewMode('SIGN_IN');
      }
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, [hasExistingBusiness]);

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
    if (mode === 'SIGN_IN' && !store.hasAnyBusiness()) {
      triggerError('Please set up your establishment first.');
      return;
    }
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

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (lockoutSeconds > 0) {
      triggerError(`Terminal temporarily locked. Please wait ${lockoutSeconds} seconds.`);
      return;
    }

    const cleanUsername = username.trim();
    const cleanPassword = password.trim();

    if (!cleanUsername || !cleanPassword) {
      triggerError('Please enter both your username and password/PIN.');
      return;
    }

    setIsAuthenticating(true);
    try {
      const authenticatedUser = await store.authenticateUser(cleanUsername, cleanPassword);
      if (authenticatedUser) {
        if (rememberUser) {
          localStorage.setItem('bartracker_saved_username', cleanUsername);
        } else {
          localStorage.removeItem('bartracker_saved_username');
        }
        if (authenticatedUser.businessId) {
          store.setCurrentBusiness(authenticatedUser.businessId);
        }
        onLogin(authenticatedUser);
      } else {
        const lockout = authService.getLockoutStatus(cleanUsername);
        if (lockout.isLocked) {
          setLockoutSeconds(lockout.secondsRemaining);
          triggerError(`Terminal locked due to 5 consecutive failed attempts. Wait ${lockout.secondsRemaining}s.`);
        } else {
          triggerError(`Invalid credentials. ${lockout.attemptsLeft} attempts remaining before temporary lockout.`);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      triggerError(msg);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleKeypadDigit = (digit: string) => {
    if (lockoutSeconds > 0) return;
    if (keypadPin.length < 6) {
      const nextPin = keypadPin + digit;
      setKeypadPin(nextPin);
      setErrorMsg('');

      if (nextPin.length >= 4 && keypadUser.trim()) {
        attemptKeypadLogin(keypadUser.trim(), nextPin);
      }
    }
  };

  const attemptKeypadLogin = async (staffUsername: string, pin: string) => {
    try {
      setIsAuthenticating(true);
      const user = await store.authenticateUser(staffUsername, pin);
      if (user) {
        if (user.role === 'OWNER') {
          triggerError('Proprietor executive accounts must authenticate via Username & Password.');
          setKeypadPin('');
          return;
        }
        if (user.businessId) {
          store.setCurrentBusiness(user.businessId);
        }
        onLogin(user);
      } else if (pin.length >= 4) {
        const lockout = authService.getLockoutStatus(staffUsername);
        if (lockout.isLocked) {
          setLockoutSeconds(lockout.secondsRemaining);
          triggerError(`Staff terminal locked due to repeated incorrect PIN attempts. Wait ${lockout.secondsRemaining}s.`);
          setKeypadPin('');
        } else {
          triggerError(`Incorrect PIN. ${lockout.attemptsLeft} attempts remaining.`);
          setKeypadPin('');
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      triggerError(msg);
      setKeypadPin('');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleKeypadSubmit = () => {
    if (!keypadUser.trim()) {
      triggerError('Please enter your Staff Username or Staff ID.');
      return;
    }
    if (keypadPin.length < 4) {
      triggerError('Security PIN must be at least 4 digits.');
      return;
    }
    attemptKeypadLogin(keypadUser.trim(), keypadPin);
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (regPassword !== regConfirmPassword) {
      triggerError('Passwords do not match. Please verify.');
      return;
    }

    try {
      setIsSubmittingReg(true);
      const { user } = await store.registerNewBusiness({
        businessName: regBusinessName,
        phone: regPhone,
        address: regAddress,
        ownerName: regOwnerName,
        ownerUsername: regUsername,
        ownerPassword: regPassword,
        ownerPinCode: regPinCode,
        initialDrinksText: regCatalogChoice === 'CUSTOM' ? regDrinksText : undefined,
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
      {/* Background radial gradient glow */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-emerald-950/20 via-transparent to-transparent"></div>

      <div className="w-full max-w-xl relative z-10 my-4 sm:my-8">
        {/* Header Branding */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/10 border border-emerald-500/30 shadow-2xl mb-3 shadow-emerald-950/50">
            <Wine className="w-7 h-7 text-emerald-400" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Bar Track
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-md mx-auto">
            Operations, Stock Audit & Reconciliation System
          </p>

          {!hasExistingBusiness && (
            <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-600/40 text-emerald-300 text-xs font-medium">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>Clean Start: Create Your Establishment</span>
            </div>
          )}
        </div>

        {/* View Switcher Tabs (Only if business exists) */}
        {hasExistingBusiness && (
          <div className="flex bg-[#0E1420] p-1 rounded-2xl border border-slate-800 mb-6 shadow-inner">
            <button
              onClick={() => switchMode('SIGN_IN')}
              className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                viewMode === 'SIGN_IN'
                  ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-lg shadow-emerald-950/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => switchMode('REGISTER')}
              className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                viewMode === 'REGISTER'
                  ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-lg shadow-emerald-950/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Register New Business
            </button>
          </div>
        )}

        {/* Error / Lockout Banner */}
        {errorMsg && (
          <div
            className={`p-3.5 sm:p-4 rounded-2xl mb-5 flex items-start gap-3 text-xs sm:text-sm shadow-xl transition-all ${
              shake ? 'animate-bounce' : ''
            } ${
              lockoutSeconds > 0
                ? 'bg-amber-950/80 border border-amber-500/60 text-amber-200'
                : 'bg-red-950/80 border border-red-500/60 text-red-200'
            }`}
          >
            {lockoutSeconds > 0 ? (
              <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 font-medium">{errorMsg}</div>
          </div>
        )}

        {/* ======================= VIEW MODE: SIGN IN ======================= */}
        {viewMode === 'SIGN_IN' && (
          <div className="bg-[#121824] border border-[#1E293B] rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/80 space-y-6">
            {/* Auth Sub-mode Selector: Password vs Keypad */}
            <div className="flex bg-[#0A0D14] p-1 rounded-xl border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('CREDENTIALS');
                  setErrorMsg('');
                }}
                className={`flex-1 py-2 rounded-lg font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  authMode === 'CREDENTIALS'
                    ? 'bg-slate-800 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Proprietor & Staff Login</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('KEYPAD');
                  setErrorMsg('');
                }}
                className={`flex-1 py-2 rounded-lg font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  authMode === 'KEYPAD'
                    ? 'bg-slate-800 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Staff Counter Keypad</span>
              </button>
            </div>

            {/* Sub-mode 1: Standard Username & Password */}
            {authMode === 'CREDENTIALS' && (
              <form onSubmit={handleCredentialsSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Username or Staff ID
                  </label>
                  <div className="relative">
                    <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="e.g. maina or attendant"
                      disabled={isAuthenticating || lockoutSeconds > 0}
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#0A0D14] border border-slate-700/80 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors text-sm"
                      autoFocus
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Password or PIN
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your security credential"
                      disabled={isAuthenticating || lockoutSeconds > 0}
                      className="w-full pl-10 pr-11 py-3 rounded-xl bg-[#0A0D14] border border-slate-700/80 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors text-sm font-mono"
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

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-400 hover:text-slate-300">
                    <input
                      type="checkbox"
                      checked={rememberUser}
                      onChange={(e) => setRememberUser(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-700 bg-[#0A0D14] text-emerald-500 focus:ring-0 focus:ring-offset-0"
                    />
                    <span>Remember username on this terminal</span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isAuthenticating || lockoutSeconds > 0}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-sm shadow-xl shadow-emerald-950/60 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                >
                  {isAuthenticating ? (
                    <span>Authenticating...</span>
                  ) : (
                    <>
                      <span>Access Terminal</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Sub-mode 2: Staff Keypad */}
            {authMode === 'KEYPAD' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Staff Username or Staff ID
                  </label>
                  <div className="relative">
                    <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={keypadUser}
                      onChange={(e) => setKeypadUser(e.target.value)}
                      placeholder="Enter your assigned staff username"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0A0D14] border border-slate-700/80 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-sm"
                      autoFocus
                    />
                  </div>
                </div>

                {/* PIN Dots Display */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Security PIN (4–6 Digits)
                  </label>
                  <div className="h-14 rounded-2xl bg-[#0A0D14] border border-slate-700/80 flex items-center justify-center gap-3 px-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div
                        key={i}
                        className={`w-3.5 h-3.5 rounded-full transition-all ${
                          i < keypadPin.length
                            ? 'bg-emerald-400 scale-110 shadow-md shadow-emerald-500/50'
                            : 'bg-slate-800 border border-slate-700'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Number Keypad Grid */}
                <div className="grid grid-cols-3 gap-2.5 pt-2">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                    <button
                      key={digit}
                      type="button"
                      onClick={() => handleKeypadDigit(digit)}
                      disabled={isAuthenticating || lockoutSeconds > 0}
                      className="h-14 rounded-2xl bg-[#161D2C] hover:bg-[#1E2738] active:bg-emerald-950/60 border border-slate-800 text-white text-xl font-bold font-mono transition-all flex items-center justify-center cursor-pointer shadow-sm active:scale-95 disabled:opacity-40"
                    >
                      {digit}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setKeypadPin('')}
                    disabled={isAuthenticating || lockoutSeconds > 0}
                    className="h-14 rounded-2xl bg-[#161D2C] hover:bg-red-950/40 text-slate-400 hover:text-red-300 border border-slate-800 text-xs font-bold transition-all flex items-center justify-center cursor-pointer active:scale-95 disabled:opacity-40"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => handleKeypadDigit('0')}
                    disabled={isAuthenticating || lockoutSeconds > 0}
                    className="h-14 rounded-2xl bg-[#161D2C] hover:bg-[#1E2738] active:bg-emerald-950/60 border border-slate-800 text-white text-xl font-bold font-mono transition-all flex items-center justify-center cursor-pointer active:scale-95 disabled:opacity-40"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={() => setKeypadPin((prev) => prev.slice(0, -1))}
                    disabled={isAuthenticating || lockoutSeconds > 0}
                    className="h-14 rounded-2xl bg-[#161D2C] hover:bg-slate-700/40 text-slate-400 hover:text-slate-200 border border-slate-800 transition-all flex items-center justify-center cursor-pointer active:scale-95 disabled:opacity-40"
                  >
                    <Delete className="w-5 h-5" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleKeypadSubmit}
                  disabled={isAuthenticating || lockoutSeconds > 0 || !keypadUser || keypadPin.length < 4}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-bold text-sm shadow-xl shadow-emerald-950/60 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>Authenticate PIN</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* ======================= VIEW MODE: REGISTER ======================= */}
        {viewMode === 'REGISTER' && (
          <div className="bg-[#121824] border border-[#1E293B] rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/80 space-y-6">
            <div className="border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">
                <Store className="w-4 h-4" />
                <span>New Establishment Onboarding</span>
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                Register Your Venue & Proprietor Account
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Zero pre-seeded mock records. Start clean with your own bar name, credentials, and catalog.
              </p>
            </div>

            <form onSubmit={handleRegisterSubmit} className="space-y-5">
              {/* Section 1: Business Details */}
              <div className="space-y-3.5">
                <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>1. Establishment Details</span>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Bar / Lounge / Establishment Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={regBusinessName}
                    onChange={(e) => setRegBusinessName(e.target.value)}
                    placeholder="e.g. Havilah Lounge & Bar"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A0D14] border border-slate-700/80 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">
                      Contact Phone <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="e.g. 0722 000 000"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A0D14] border border-slate-700/80 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">
                      Physical Location / Address
                    </label>
                    <input
                      type="text"
                      value={regAddress}
                      onChange={(e) => setRegAddress(e.target.value)}
                      placeholder="e.g. Westlands, Nairobi"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A0D14] border border-slate-700/80 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Owner Credentials */}
              <div className="space-y-3.5 pt-3 border-t border-slate-800">
                <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>2. Proprietor Executive Credentials</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">
                      Proprietor Full Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={regOwnerName}
                      onChange={(e) => setRegOwnerName(e.target.value)}
                      placeholder="e.g. Kenneth Tash"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A0D14] border border-slate-700/80 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">
                      Owner Username <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={regUsername}
                      onChange={(e) => setRegUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      placeholder="e.g. kennytash"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A0D14] border border-slate-700/80 text-white text-sm font-mono placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">
                      Password (min. 6 chars) <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={regShowPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3.5 pr-10 py-2.5 rounded-xl bg-[#0A0D14] border border-slate-700/80 text-white text-sm font-mono placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setRegShowPassword(!regShowPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                      >
                        {regShowPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1">
                      Confirm Password <span className="text-red-400">*</span>
                    </label>
                    <input
                      type={regShowPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className={`w-full px-3.5 py-2.5 rounded-xl bg-[#0A0D14] border text-white text-sm font-mono placeholder-slate-500 focus:outline-none transition-colors ${
                        regConfirmPassword && regPassword !== regConfirmPassword
                          ? 'border-red-500 focus:border-red-400'
                          : 'border-slate-700/80 focus:border-emerald-500'
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Emergency Security PIN (4–6 Digits) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    pattern="\d{4,6}"
                    maxLength={6}
                    value={regPinCode}
                    onChange={(e) => setRegPinCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="e.g. 9876 (Used for quick manager overrides)"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A0D14] border border-slate-700/80 text-white text-sm font-mono placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>

              {/* Section 3: Clean Initial Catalog Setup */}
              <div className="space-y-3.5 pt-3 border-t border-slate-800">
                <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Wine className="w-3.5 h-3.5 text-emerald-400" />
                  <span>3. Starting Beverage Catalog</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRegCatalogChoice('BLANK')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      regCatalogChoice === 'BLANK'
                        ? 'bg-emerald-950/40 border-emerald-500 text-emerald-200'
                        : 'bg-[#0A0D14] border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-bold text-xs flex items-center justify-between">
                      <span>Clean Slate</span>
                      {regCatalogChoice === 'BLANK' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 leading-tight">
                      Empty inventory. Add drinks in the Catalog Manager as bottles arrive.
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRegCatalogChoice('CUSTOM')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      regCatalogChoice === 'CUSTOM'
                        ? 'bg-emerald-950/40 border-emerald-500 text-emerald-200'
                        : 'bg-[#0A0D14] border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-bold text-xs flex items-center justify-between">
                      <span>Custom List</span>
                      {regCatalogChoice === 'CUSTOM' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 leading-tight">
                      Paste or type your initial bottles now (name, category, cost, price).
                    </div>
                  </button>
                </div>

                {regCatalogChoice === 'CUSTOM' && (
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">
                      Paste drinks list (One per line: Name, Category, Cost, Selling Price)
                    </label>
                    <textarea
                      rows={3}
                      value={regDrinksText}
                      onChange={(e) => setRegDrinksText(e.target.value)}
                      placeholder="Tusker Lager, BEER, 180, 250&#10;Guinness, BEER, 200, 300&#10;Jameson Irish Whiskey, SPIRIT, 2200, 3500"
                      className="w-full p-3 rounded-xl bg-[#0A0D14] border border-slate-700/80 text-white text-xs font-mono placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmittingReg}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-sm shadow-xl shadow-emerald-950/60 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingReg ? (
                    <span>Registering Establishment...</span>
                  ) : (
                    <>
                      <span>Complete Registration & Launch Desk</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Security & Neon PostgreSQL Architecture Footer */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-slate-500 text-[11px]">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>SHA-256 Salted Authentication</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-cyan-400" />
            <span>Neon Serverless PostgreSQL Ready</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            <span>Brute-Force Protected</span>
          </div>
        </div>
      </div>
    </div>
  );
};
