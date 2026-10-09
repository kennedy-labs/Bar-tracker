import React, { useState } from 'react';
import { User } from '../../types';
import { store } from '../../services/store';
import { neonService, NeonState } from '../../services/neon';
import {
  User as UserIcon,
  Lock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Building2,
  Database,
  CloudOff,
  Loader2,
} from 'lucide-react';

interface ProfileManagerProps {
  currentUser: User;
  onUpdateProfile?: (updatedUser: User) => void;
}

export const ProfileManager: React.FC<ProfileManagerProps> = ({
  currentUser,
  onUpdateProfile,
}) => {
  const business = store.getCurrentBusiness();
  const [neonState, setNeonState] = useState<NeonState>(neonService.getStatus());

  React.useEffect(() => {
    return neonService.subscribeStatus((st) => setNeonState(st));
  }, []);

  // Form State
  const [name, setName] = useState(currentUser.name || '');
  const [username, setUsername] = useState(currentUser.username || '');

  // Password fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Visibility toggles
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  // Status
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanName = name.trim();
    const cleanUsername = username.trim().toLowerCase();

    if (!cleanName) {
      setError('Full Name is required.');
      return;
    }

    if (!cleanUsername) {
      setError('Username is required.');
      return;
    }

    if (!/^[a-z0-9_]{3,24}$/.test(cleanUsername)) {
      setError('Username must be 3 to 24 characters (lowercase letters, digits, underscore).');
      return;
    }

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
      const wantsPasswordChange = newPassword.trim().length > 0;
      if (wantsPasswordChange) {
        if (!currentPassword.trim()) {
          setError('Please provide your current password to verify identity.');
          setIsSaving(false);
          return;
        }

        const isCurrentValid = await store.verifyUserCredential(currentUser.id, currentPassword);
        if (!isCurrentValid) {
          setError('Current password is incorrect.');
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

      const updatedUser = await store.updateUser(currentUser.id, updates);

      try {
        localStorage.setItem('bartracker_saved_username', cleanUsername);
      } catch {
        // ignore
      }

      if (onUpdateProfile) {
        onUpdateProfile(updatedUser);
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccessMsg('Profile and credentials updated and synced to database.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update profile.';
      setError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Overview Card */}
      <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-[#121824] border border-[#1E293B] shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#151D2C] border border-slate-700/80 flex items-center justify-center text-emerald-400 shrink-0">
              <UserIcon className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                My Profile & Account Security
              </h2>
              <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-purple-950 text-purple-300 border border-purple-800">
                  Bar Owner
                </span>
                {business && (
                  <span className="flex items-center gap-1 text-[11px] text-slate-300 font-medium">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    {business.name}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono">
            <div className="px-2.5 py-1 rounded-lg bg-[#0E1420] border border-slate-800 text-slate-400 flex items-center gap-1.5">
              {neonState.status === 'CONNECTED' ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-emerald-400 font-medium">Cloud Database Connected</span>
                </>
              ) : (
                <>
                  <CloudOff className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-amber-400">Local Cache Mode</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="mt-5 space-y-6">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-950/70 border border-red-800 text-red-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
              <div className="font-medium leading-relaxed">{error}</div>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-950/70 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <div className="font-semibold">{successMsg}</div>
            </div>
          )}

          {/* Personal Info Grid */}
          <div className="space-y-4">
            <div className="text-xs font-mono uppercase tracking-wider text-slate-400 pb-1 border-b border-slate-800/80">
              Personal Information
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#0E1420] border border-slate-700/80 rounded-xl text-white text-sm font-medium focus:outline-none focus:border-emerald-500 transition-colors"
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
                  className="w-full px-3.5 py-2.5 bg-[#0E1420] border border-slate-700/80 rounded-xl text-white text-sm font-mono focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Security Credentials */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between pb-1 border-b border-slate-800/80">
              <div className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                <span>Password & Security</span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                Leave blank to keep unchanged
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Current Password
              </label>
              <div className="relative max-w-md">
                <input
                  type={showCurrentPass ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 pr-10 bg-[#0E1420] border border-slate-700/80 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors"
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 pr-10 bg-[#0E1420] border border-slate-700/80 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors"
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
                    className="w-full px-3.5 py-2.5 pr-10 bg-[#0E1420] border border-slate-700/80 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors"
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

          {/* Action Row */}
          <div className="pt-4 flex items-center justify-end border-t border-slate-800">
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Updates...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Update Profile & Credentials</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
