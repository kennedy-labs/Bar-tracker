import React, { useState } from 'react';
import { User } from '../../types';
import { store } from '../../services/store';
import {
  X,
  User as UserIcon,
  Lock,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  ShieldCheck,
  Building2,
  Loader2,
} from 'lucide-react';

interface EditProfileModalProps {
  currentUser: User;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedUser: User) => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  currentUser,
  isOpen,
  onClose,
  onSuccess,
}) => {
  if (!isOpen) return null;

  const isOwner = currentUser.role === 'OWNER';
  const business = store.getCurrentBusiness();

  // Profile basic info
  const [name, setName] = useState(currentUser.name || '');
  const [username, setUsername] = useState(currentUser.username || '');

  // Credentials - Owner password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Credentials - Attendant PIN
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  // Optional worker password toggle
  const [showWorkerPasswordFields, setShowWorkerPasswordFields] = useState(false);
  const [workerNewPassword, setWorkerNewPassword] = useState('');
  const [workerConfirmPassword, setWorkerConfirmPassword] = useState('');

  // Visibility toggles
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [showCurrentPin, setShowCurrentPin] = useState(false);
  const [showNewPin, setShowNewPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);

  // States
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanName = name.trim();
    const cleanUsername = username.trim().toLowerCase();

    // 1. Basic validation
    if (!cleanName) {
      setError('Full Name is required.');
      return;
    }

    if (!cleanUsername) {
      setError('Username is required.');
      return;
    }

    if (!/^[a-z0-9_]{3,24}$/.test(cleanUsername)) {
      setError('Username must be 3 to 24 characters (lowercase letters, numbers, or underscores).');
      return;
    }

    // Check username uniqueness if changed
    const allUsers = store.getUsers();
    if (
      cleanUsername !== currentUser.username.toLowerCase() &&
      allUsers.some((u) => u.id !== currentUser.id && u.username.toLowerCase() === cleanUsername)
    ) {
      setError(`Username "${cleanUsername}" is already taken.`);
      return;
    }

    const updates: Partial<User> = {
      name: cleanName,
      username: cleanUsername,
    };

    setIsSaving(true);

    try {
      // 2. Validate and handle credentials update
      if (isOwner) {
        const wantsPasswordChange = newPassword.trim().length > 0;
        if (wantsPasswordChange) {
          if (!currentPassword.trim()) {
            setError('Please enter your current password to verify identity.');
            setIsSaving(false);
            return;
          }

          const isCurrentValid = await store.verifyUserCredential(currentUser.id, currentPassword);
          if (!isCurrentValid) {
            setError('Current password does not match.');
            setIsSaving(false);
            return;
          }

          if (newPassword.trim().length < 6) {
            setError('New password must be at least 6 characters.');
            setIsSaving(false);
            return;
          }

          if (newPassword !== confirmPassword) {
            setError('New password and confirm password do not match.');
            setIsSaving(false);
            return;
          }

          updates.password = newPassword.trim();
        }
      } else {
        // Counter attendant PIN update
        const wantsPinChange = newPin.trim().length > 0;
        if (wantsPinChange) {
          if (!currentPin.trim()) {
            setError('Please enter your current PIN to verify identity.');
            setIsSaving(false);
            return;
          }

          const isCurrentValid = await store.verifyUserCredential(currentUser.id, currentPin);
          if (!isCurrentValid) {
            setError('Current PIN does not match.');
            setIsSaving(false);
            return;
          }

          const cleanNewPin = newPin.trim();
          if (!/^\d{4,6}$/.test(cleanNewPin)) {
            setError('New PIN must be between 4 and 6 numeric digits.');
            setIsSaving(false);
            return;
          }

          if (cleanNewPin !== confirmPin.trim()) {
            setError('New PIN and confirmation PIN do not match.');
            setIsSaving(false);
            return;
          }

          updates.pinCode = cleanNewPin;
        }

        // Optional worker password change
        if (showWorkerPasswordFields && workerNewPassword.trim().length > 0) {
          if (workerNewPassword.trim().length < 6) {
            setError('New password must be at least 6 characters.');
            setIsSaving(false);
            return;
          }
          if (workerNewPassword !== workerConfirmPassword) {
            setError('Worker passwords do not match.');
            setIsSaving(false);
            return;
          }
          updates.password = workerNewPassword.trim();
        }
      }

      // 3. Commit updates to store & trigger cloud database synchronization
      const updatedUser = await store.updateUser(currentUser.id, updates);

      // Keep username in local helper if it was remembered
      try {
        localStorage.setItem('bartracker_saved_username', cleanUsername);
      } catch {
        // ignore
      }

      setSuccessMsg('Profile and credentials updated successfully.');
      onSuccess(updatedUser);

      // Close modal after brief confirmation feedback
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update profile.';
      setError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-lg bg-[#0E1420] border border-[#1E293B] rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800/80 flex items-center justify-between bg-[#121824]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-800/90 border border-slate-700/80 flex items-center justify-center text-slate-200">
              <UserIcon className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
                Edit Profile & Credentials
              </h2>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                    isOwner
                      ? 'bg-purple-950 text-purple-300 border border-purple-800'
                      : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  }`}
                >
                  {isOwner ? 'Bar Owner' : 'Counter Attendant'}
                </span>
                {business && (
                  <span className="flex items-center gap-1 text-[11px] text-slate-400 truncate">
                    <Building2 className="w-3 h-3 text-slate-500" />
                    {business.name}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-red-950/70 border border-red-800 text-red-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
              <div className="font-medium leading-relaxed">{error}</div>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-950/70 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <div className="font-semibold">{successMsg}</div>
            </div>
          )}

          {/* Section 1: Identity */}
          <div className="space-y-3.5">
            <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 pb-1 border-b border-slate-800">
              Personal Information
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-[#151D2C] border border-slate-700 rounded-xl text-white text-sm font-medium focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Username
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                className="w-full px-3 py-2 bg-[#151D2C] border border-slate-700 rounded-xl text-white text-sm font-mono focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
          </div>

          {/* Section 2: Security Credentials */}
          <div className="space-y-3.5 pt-2">
            <div className="flex items-center justify-between pb-1 border-b border-slate-800">
              <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                <span>Security Credentials</span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                Leave blank to keep unchanged
              </span>
            </div>

            {isOwner ? (
              /* Owner Password Fields */
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Current Password
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPass ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full px-3 py-2 pr-10 bg-[#151D2C] border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPass(!showCurrentPass)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer p-1"
                    >
                      {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPass ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-3 py-2 pr-10 bg-[#151D2C] border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPass(!showNewPass)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer p-1"
                      >
                        {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPass ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-3 py-2 pr-10 bg-[#151D2C] border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPass(!showConfirmPass)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer p-1"
                      >
                        {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Attendant PIN Fields */
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Current Security PIN
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPin ? 'text' : 'password'}
                      inputMode="numeric"
                      maxLength={6}
                      value={currentPin}
                      onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
                      className="w-full px-3 py-2 pr-10 bg-[#151D2C] border border-slate-700 rounded-xl text-white text-sm font-mono tracking-widest focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPin(!showCurrentPin)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer p-1"
                    >
                      {showCurrentPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      New 4-Digit Security PIN
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPin ? 'text' : 'password'}
                        inputMode="numeric"
                        maxLength={6}
                        value={newPin}
                        onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                        className="w-full px-3 py-2 pr-10 bg-[#151D2C] border border-slate-700 rounded-xl text-white text-sm font-mono tracking-widest focus:outline-none focus:border-emerald-500 transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPin(!showNewPin)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer p-1"
                      >
                        {showNewPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Confirm New Security PIN
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPin ? 'text' : 'password'}
                        inputMode="numeric"
                        maxLength={6}
                        value={confirmPin}
                        onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                        className="w-full px-3 py-2 pr-10 bg-[#151D2C] border border-slate-700 rounded-xl text-white text-sm font-mono tracking-widest focus:outline-none focus:border-emerald-500 transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPin(!showConfirmPin)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer p-1"
                      >
                        {showConfirmPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Optional Web Password for Attendants */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setShowWorkerPasswordFields(!showWorkerPasswordFields)}
                    className="text-xs text-slate-400 hover:text-emerald-400 flex items-center gap-1.5 cursor-pointer font-mono"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>{showWorkerPasswordFields ? 'Hide Web Password Options' : 'Set or Change Web Password'}</span>
                  </button>

                  {showWorkerPasswordFields && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 p-3 rounded-xl bg-[#090D14] border border-slate-800">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                          New Web Password
                        </label>
                        <input
                          type="password"
                          value={workerNewPassword}
                          onChange={(e) => setWorkerNewPassword(e.target.value)}
                          className="w-full px-3 py-2 bg-[#151D2C] border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                          Confirm Web Password
                        </label>
                        <input
                          type="password"
                          value={workerConfirmPassword}
                          onChange={(e) => setWorkerConfirmPassword(e.target.value)}
                          className="w-full px-3 py-2 bg-[#151D2C] border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
