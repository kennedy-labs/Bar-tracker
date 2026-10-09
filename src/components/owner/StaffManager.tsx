import React, { useState } from 'react';
import { User, Role } from '../../types';
import { store } from '../../services/store';
import {
 Users,
 UserPlus,
 Shield,
 KeyRound,
 Trash2,
 Edit2,
 Check,
 X,
 AlertCircle,
 ShieldCheck,
 Lock,
} from 'lucide-react';

interface StaffManagerProps {
 currentUser: User;
}

export const StaffManager: React.FC<StaffManagerProps> = ({ currentUser }) => {
 const currentBizId = currentUser.businessId || store.getCurrentBusinessId();
 const users = store.getUsers().filter((u) => !u.businessId || u.businessId === currentBizId);

 const [showAddModal, setShowAddModal] = useState(false);
 const [editingUser, setEditingUser] = useState<User | null>(null);

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
 setSuccessToast(`Staff account for ${newUser.name} (@${newUser.username}) created successfully.`);
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
 setSuccessToast(`Account details for @${editUsername} updated successfully.`);
 setTimeout(() => setSuccessToast(null), 5000);
 } catch (err: any) {
 setFormError(err.message || 'Failed to update staff member.');
 }
 };

 const handleDeleteUser = (user: User) => {
 if (!confirm(`Are you sure you want to revoke access for ${user.name} (@${user.username})?`)) return;

 try {
 store.deleteUser(user.id);
 setSuccessToast(`Access revoked for ${user.name}.`);
 setTimeout(() => setSuccessToast(null), 5000);
 } catch (err: any) {
 alert(err.message || 'Failed to remove user.');
 }
 };

 return (
 <div className="space-y-6">
 {/* Toast Alert */}
 {successToast && (
 <div className="p-4 rounded-2xl bg-emerald-950/80 border border-emerald-500 text-emerald-200 text-xs flex items-center justify-between shadow-xl animate-in fade-in">
 <div className="flex items-center gap-2">
 <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
 <span className="font-medium">{successToast}</span>
 </div>
 <button onClick={() => setSuccessToast(null)} className="p-1 hover:text-white">
 <X className="w-3.5 h-3.5" />
 </button>
 </div>
 )}

 {/* Staff Management Header */}
 <div className="p-5 md:p-6 rounded-3xl bg-[#121824] border border-[#1E293B] shadow-xl space-y-4">
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
 <div>
 <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">
 <Shield className="w-4 h-4" />
 <span>Production Access & Staff Governance</span>
 </div>
 <h3 className="text-base sm:text-lg font-bold text-white mt-1">
 Authorized Staff & Security Credentials
 </h3>
 <p className="text-xs text-slate-400">
 Manage bartenders, cashiers, and proprietor credentials. All PINs and logins are securely enforced.
 </p>
 </div>

 <button
 onClick={handleOpenAdd}
 className="py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-lg shadow-emerald-950/40 shrink-0"
 >
 <UserPlus className="w-4 h-4" />
 <span>Add New Staff Account</span>
 </button>
 </div>

 {/* Staff Table */}
 <div className="overflow-x-auto border border-slate-800 rounded-2xl bg-[#0E1420]">
 <table className="w-full text-xs text-left">
 <thead className="bg-[#151D2C] text-slate-400 font-mono text-[10px] uppercase border-b border-slate-800">
 <tr>
 <th className="p-3.5">Staff Name</th>
 <th className="p-3.5">Username</th>
 <th className="p-3.5">Role</th>
 <th className="p-3.5">Terminal PIN</th>
 <th className="p-3.5 text-right">Actions</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-800">
 {users.map((user) => (
 <tr key={user.id} className="hover:bg-slate-900/40">
 <td className="p-3.5 font-semibold text-white">
 <div className="flex items-center gap-2">
 <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-300">
 {user.role === 'OWNER' ? '👑' : '🍸'}
 </div>
 <div>
 <div>{user.name}</div>
 {user.id === currentUser.id && (
 <span className="text-[10px] text-emerald-400 font-mono">(Your active session)</span>
 )}
 </div>
 </div>
 </td>
 <td className="p-3.5 font-mono text-slate-300">
 @{user.username}
 </td>
 <td className="p-3.5">
 <span
 className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono ${
 user.role === 'OWNER'
 ? 'bg-blue-950/70 text-blue-300 border border-blue-800/80'
 : 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/80'
 }`}
 >
 {user.role === 'OWNER' ? 'PROPRIETOR' : 'COUNTER BARTENDER'}
 </span>
 </td>
 <td className="p-3.5 font-mono text-slate-400">
 •••• <span className="text-[10px] text-slate-500">(Encrypted)</span>
 </td>
 <td className="p-3.5 text-right space-x-2">
 <button
 onClick={() => handleStartEdit(user)}
 className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
 title="Edit Credentials"
 >
 <Edit2 className="w-3.5 h-3.5" />
 </button>
 {user.id !== currentUser.id && (
 <button
 onClick={() => handleDeleteUser(user)}
 className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-red-950/30 transition-colors cursor-pointer"
 title="Revoke Access"
 >
 <Trash2 className="w-3.5 h-3.5" />
 </button>
 )}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>

 {/* Add Staff Modal */}
 {showAddModal && (
 <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
 <div className="bg-[#121824] border border-[#1E293B] rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
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
 <label className="block text-slate-300 font-semibold mb-1">Role & Authority</label>
 <select
 value={role}
 onChange={(e) => setRole(e.target.value as Role)}
 className="w-full bg-[#0E1420] border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
 >
 <option value="WORKER">Worker / Bartender (Counter Terminal Only)</option>
 <option value="OWNER">Owner / Proprietor (Full Executive Access)</option>
 </select>
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

 <div>
 <label className="block text-slate-300 font-semibold mb-1">Optional Web Password</label>
 <input
 type="password"
 value={password}
 onChange={(e) => setPassword(e.target.value)}
 className="w-full bg-[#0E1420] border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
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
 <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
 <div className="bg-[#121824] border border-[#1E293B] rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
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
 <label className="block text-slate-300 font-semibold mb-1">Username</label>
 <input
 type="text"
 required
 value={editUsername}
 onChange={(e) => setEditUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
 className="w-full bg-[#0E1420] border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-emerald-500"
 />
 </div>

 <div>
 <label className="block text-slate-300 font-semibold mb-1">Role</label>
 <select
 value={editRole}
 onChange={(e) => setEditRole(e.target.value as Role)}
 className="w-full bg-[#0E1420] border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
 >
 <option value="WORKER">Worker / Bartender</option>
 <option value="OWNER">Owner / Proprietor</option>
 </select>
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
