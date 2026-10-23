import React, { useState } from 'react';
import { User, StockAdditionRecord } from '../../types';
import { store } from '../../services/store';
import {
 PackagePlus,
 PackageMinus,
 Lock,
 CheckCircle,
 AlertTriangle,
 Clock,
 Wine,
 Trash2,
 ShieldCheck,
 Search,
} from 'lucide-react';

interface RestockAuditManagerProps {
 currentUser: User;
}

export const RestockAuditManager: React.FC<RestockAuditManagerProps> = ({ currentUser }) => {
 const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'SAVED'>('ALL');
 const [search, setSearch] = useState('');
 const [toastMessage, setToastMessage] = useState<string | null>(null);

 const additions = store.getStockAdditions();

 const handleSaveAndLock = (additionId: string) => {
 store.saveAndLockStockAddition(additionId, currentUser.name);
 setToastMessage('Stock addition verified, saved, and permanently locked (immutable).');
 setTimeout(() => setToastMessage(null), 4000);
 };

 const handleDeletePending = (additionId: string) => {
 try {
 store.deleteStockAddition(additionId);
 setToastMessage('Pending addition cancelled and inventory reverted.');
 setTimeout(() => setToastMessage(null), 4000);
 } catch (err: any) {
 alert(err.message || 'Cannot delete immutable addition.');
 }
 };

 const filteredAdditions = additions.filter((a) => {
 if (filter === 'PENDING' && a.status !== 'PENDING_OWNER_CONFIRMATION') return false;
 if (filter === 'SAVED' && a.status !== 'SAVED_LOCKED') return false;

 if (search.trim()) {
 const q = search.toLowerCase();
 return (
 a.productName.toLowerCase().includes(q) ||
 a.workerName.toLowerCase().includes(q) ||
 (a.shiftNumber && a.shiftNumber.toLowerCase().includes(q))
 );
 }
 return true;
 });

 const pendingCount = additions.filter((a) => a.status === 'PENDING_OWNER_CONFIRMATION').length;
 const savedCount = additions.filter((a) => a.status === 'SAVED_LOCKED').length;

 return (
 <div className="p-4 sm:p-6 rounded-3xl bg-[#121824] border border-[#1E293B] shadow-xl space-y-4">
 {/* Toast */}
 {toastMessage && (
 <div className="p-3.5 rounded-2xl bg-emerald-950/90 border border-emerald-500 text-emerald-200 text-xs flex items-center gap-2 shadow-lg animate-in fade-in">
 <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
 <span className="font-bold">{toastMessage}</span>
 </div>
 )}

 {/* Header */}
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
 <div>
 <div className="flex items-center gap-2">
 <span className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
 <PackagePlus className="w-4 h-4" />
 </span>
 <h3 className="text-base font-bold text-white tracking-tight">
 Worker Restock Deliveries & Immutability Audit
 </h3>
 </div>
 <p className="text-xs text-slate-400 mt-0.5">
 When workers add counter stock, records appear here. Saving an addition locks it permanently as immutable to deletion.
 </p>
 </div>

 {/* Filter Pills */}
 <div className="flex items-center gap-1.5 shrink-0">
 <button
 onClick={() => setFilter('ALL')}
 className={`py-1.5 px-3 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
 filter === 'ALL'
 ? 'bg-slate-700 text-white font-bold'
 : 'bg-[#0E1420] text-slate-400 hover:text-white border border-slate-800'
 }`}
 >
 All ({additions.length})
 </button>
 <button
 onClick={() => setFilter('PENDING')}
 className={`py-1.5 px-3 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
 filter === 'PENDING'
 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
 : 'bg-[#0E1420] text-slate-400 hover:text-white border border-slate-800'
 }`}
 >
 Pending ({pendingCount})
 </button>
 <button
 onClick={() => setFilter('SAVED')}
 className={`py-1.5 px-3 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
 filter === 'SAVED'
 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
 : 'bg-[#0E1420] text-slate-400 hover:text-white border border-slate-800'
 }`}
 >
 Saved & Locked ({savedCount})
 </button>
 </div>
 </div>

 {/* Search Input */}
 <div className="relative max-w-sm">
 <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
 <input
 type="text"
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 className="w-full bg-[#0E1420] border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
 />
 </div>

 {/* Restock List */}
 <div className="space-y-2.5">
 {filteredAdditions.length === 0 ? (
 <div className="text-center py-8 text-xs text-slate-500 bg-[#0E1420] rounded-2xl border border-slate-800/80">
 No restock delivery records found in this category.
 </div>
 ) : (
 filteredAdditions.map((item) => {
 const isSaved = item.status === 'SAVED_LOCKED' || item.isImmutable;

 return (
 <div
 key={item.id}
 className={`p-3.5 sm:p-4 rounded-2xl bg-[#0E1420] border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
 isSaved
 ? 'border-slate-800'
 : 'border-amber-500/40 bg-amber-950/10'
 }`}
 >
 <div className="min-w-0 flex-1">
 <div className="flex items-center gap-2 flex-wrap">
 <span className="font-bold text-sm text-white flex items-center gap-1.5">
 <Wine className="w-3.5 h-3.5 text-emerald-400" />
 <span>{item.productName}</span>
 </span>

 {item.quantity < 0 || item.adjustmentType === 'REDUCE' ? (
 <span className="font-mono font-black text-rose-400 text-xs px-2 py-0.5 rounded-lg bg-rose-950/60 border border-rose-800 flex items-center gap-1">
 <PackageMinus className="w-3 h-3" />
 <span>{item.quantity} units (Reduced)</span>
 </span>
 ) : (
 <span className="font-mono font-black text-emerald-400 text-xs px-2 py-0.5 rounded-lg bg-emerald-950/60 border border-emerald-800 flex items-center gap-1">
 <PackagePlus className="w-3 h-3" />
 <span>+{item.quantity} units (Restocked)</span>
 </span>
 )}

 {isSaved ? (
 <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded font-bold bg-emerald-950 text-emerald-400 border border-emerald-700 flex items-center gap-1">
 <Lock className="w-3 h-3" />
 <span>Saved · Immutable</span>
 </span>
 ) : (
 <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded font-bold bg-amber-950 text-amber-300 border border-amber-700 flex items-center gap-1 animate-pulse">
 <Clock className="w-3 h-3" />
 <span>Awaiting Owner Save</span>
 </span>
 )}
 </div>

 <div className="text-[11px] text-slate-400 font-mono mt-1 flex flex-wrap items-center gap-2">
 <span>Shift Restock</span>
 <span>·</span>
 <span>Attendant: <strong className="text-slate-300">{item.workerName}</strong></span>
 <span>·</span>
 {item.reason && (
 <>
 <span className="text-cyan-400 font-sans">Reason: {item.reason}</span>
 <span>·</span>
 </>
 )}
 <span>{new Date(item.timestamp).toLocaleString()}</span>
 </div>

 {isSaved && item.savedAt && (
 <div className="text-[10px] text-slate-500 font-mono mt-0.5 flex items-center gap-1">
 <ShieldCheck className="w-3 h-3 text-emerald-400" />
 <span>
 Verified and locked by {item.savedBy || 'Owner'} on {new Date(item.savedAt).toLocaleTimeString()}
 </span>
 </div>
 )}
 </div>

 {/* Actions */}
 <div className="flex items-center gap-2 shrink-0">
 {!isSaved ? (
 <>
 <button
 onClick={() => handleSaveAndLock(item.id)}
 className="py-2 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-950/50 cursor-pointer transition-all active:scale-95"
 >
 <Lock className="w-3.5 h-3.5" />
 <span>Save & Lock</span>
 </button>

 <button
 onClick={() => handleDeletePending(item.id)}
 className="py-2 px-2.5 rounded-xl bg-[#151D2C] hover:bg-red-950/60 border border-slate-700 hover:border-red-800 text-slate-400 hover:text-red-300 text-xs font-semibold cursor-pointer"
 title="Delete pending addition"
 >
 <Trash2 className="w-3.5 h-3.5" />
 </button>
 </>
 ) : (
 <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400 px-3 py-1.5 rounded-xl bg-[#121824] border border-slate-800">
 <Lock className="w-3 h-3 text-emerald-400" />
 <span>Immutable (Locked)</span>
 </div>
 )}
 </div>
 </div>
 );
 })
 )}
 </div>
 </div>
 );
};
