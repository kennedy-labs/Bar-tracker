import React, { useState } from 'react';
import { User, Role } from '../../types';
import { store } from '../../services/store';
import { useBackHandler } from '../../services/navigationHistory';
import {
  Users,
  UserPlus,
  Trash2,
  Edit2,
  X,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';

interface StaffManagerProps {
  currentUser: User;
}

export const StaffManager: React.FC<StaffManagerProps> = ({ currentUser }) => {
  const currentBizId = currentUser.businessId || store.getCurrentBusinessId();
  // Filter out owners to only show staff/attendants
  const users = store.getUsers().filter((u) => (!u.businessId || u.businessId === currentBizId) && u.role !== 'OWNER');

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Phone back-button integration: close staff modals on phone back
  useBackHandler(showAddModal, () => setShowAddModal(false), 'staff-add-modal');
  useBackHandler(Boolean(editingUser), () => setEditingUser(null), 'staff-edit-modal');

  // New User Form State
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<Role>('WORKER');
  const [pinCode, setPinCode] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Edit State
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editPin, setEditPin] = useState('');
  const [editRole, setEditRole] = useState<Role>('WORKER');

  const handleOpenAdd = () => {
    setName('');
    setUsername('');
    setRole('WORKER');
    setPinCode('');
    setPassword('');
    setFormError(null);
    setShowAddModal(true);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim() || !username.trim() || !pinCode.trim()) {
      setFormError('Please fill in full name, username, and security PIN.');
      return;
    }

    if (pinCode.length < 4) {
      setFormError('Security PIN must be at least 4 digits.');
      return;
    }

    try {
      const newUser = await store.addUser({
        name: name.trim(),
        username: username.trim().toLowerCase(),
        role,
        pinCode: pinCode.trim(),
        password: password.trim() || undefined,
        businessId: currentBizId,
      });

      setShowAddModal(false);
      setSuccessToast(`Staff account for ${newUser.name} created successfully.`);
      setTimeout(() => setSuccessToast(null), 5000);
    } catch (err: any) {
      setFormError(err.message || 'Failed to create staff member.');
    }
  };

  const handleStartEdit = (user: User) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditUsername(user.username);
    setEditPin('');
    setEditRole(user.role);
    setFormError(null);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      const updates: Partial<User> = {
        name: editName.trim(),
        username: editUsername.trim().toLowerCase(),
        role: editRole,
      };
      if (editPin.trim()) {
        updates.pinCode = editPin.trim();
      }
      await store.updateUser(editingUser.id, updates);

      setEditingUser(null);
      setSuccessToast(`Account details for ${editName} updated successfully.`);
      setTimeout(() => setSuccessToast(null), 5000);
    } catch (err: any) {
      setFormError(err.message || 'Failed to update staff member.');
    }
  };

  const handleDeleteUser = (user: User) => {
    if (!confirm(`Are you sure you want to revoke access for ${user.name}?`)) return;

    try {
      store.deleteUser(user.id);
      setSuccessToast(`Access revoked for ${user.name}.`);
      setTimeout(() => setSuccessToast(null), 5000);
    } catch (err: any) {
      alert(err.message || 'Failed to remove user.');
    }
  };

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* Toast Alert */}
      {successToast && (
        <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500 text-emerald-200 text-xs flex items-center justify-between shadow-xl animate-in fade-in">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="font-medium">{successToast}</span>
          </div>
          <button onClick={() => setSuccessToast(null)} className="p-1 hover:text-white">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Staff Management - Subtle Header */}
      <div className="p-4 rounded-2xl bg-[#121824] border border-[#1E293B] shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
            <Users className="w-4 h-4 text-emerald-400" />
            <span>Staff Attendants</span>
          </div>

          <button
            onClick={handleOpenAdd}
            className="py-1.5 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[10px] sm:text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
          >
            <UserPlus className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span>Add Attendant</span>
          </button>
        </div>

        {/* Staff Table - Simplified to show only Name */}
        <div className="mt-3 overflow-hidden border border-slate-800/60 rounded-xl bg-[#0E1420]">
          <table className="w-full text-xs text-left">
            <tbody className="divide-y divide-slate-800/60">
              {users.length === 0 ? (
                <tr>
                  <td className="p-8 text-center text-slate-500 italic text-[11px]">No attendants registered yet.</td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-900/30 transition-colors">
                    <td className="p-3 font-medium text-slate-200">
                      <div className="flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded-lg bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400">
                          🍸
                        </div>
                        <div className="text-sm font-semibold">{user.name}</div>
                      </div>
                    </td>
                    <td className="p-3 text-right space-x-1">
                      <button
                        onClick={() => handleStartEdit(user)}
                        className="p-1.5 text-slate-500 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Edit"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user)}
                        className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-red-950/30 transition-colors cursor-pointer"
                        title="Remove"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Staff Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121824] border border-[#1E293B] rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Create Staff Account</h3>
              </div>
              <button onClick={() => setShowAddModal(false)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-red-950/40 border border-red-800 text-xs text-red-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleAddSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#0E1420] border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Username (Login ID)</label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  className="w-full bg-[#0E1420] border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-emerald-500"
                />
                <span className="text-[10px] text-slate-500">Lowercase letters and numbers only</span>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Terminal Security PIN (4-6 digits)</label>
                <input
                  type="password"
                  required
                  maxLength={6}
                  value={pinCode}
                  onChange={(e) => setPinCode(e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-full bg-[#0E1420] border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-base tracking-widest focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs tracking-wide shadow-lg shadow-emerald-950/40 cursor-pointer"
                >
                  Create Staff Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Staff Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121824] border border-[#1E293B] rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">Edit Staff Credentials</h3>
              <button onClick={() => setEditingUser(null)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-red-950/40 border border-red-800 text-xs text-red-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-[#0E1420] border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Update Security PIN (4-6 digits)</label>
                <input
                  type="password"
                  required
                  maxLength={6}
                  value={editPin}
                  onChange={(e) => setEditPin(e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-full bg-[#0E1420] border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-base tracking-widest focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs tracking-wide shadow-lg shadow-emerald-950/40 cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
