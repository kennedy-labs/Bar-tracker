import React, { useState } from 'react';
import { MpesaAccount, MpesaAccountType } from '../../types';
import { store } from '../../services/store';
import {
 Smartphone,
 Plus,
 Edit2,
 Trash2,
 Check,
 Copy,
 Star,
 Receipt,
 Store,
 QrCode,
 ShieldCheck,
 AlertCircle,
 X,
 Printer,
 ExternalLink,
 Info,
} from 'lucide-react';

interface MpesaConfigManagerProps {
 onBack?: () => void;
}

export const MpesaConfigManager: React.FC<MpesaConfigManagerProps> = () => {
 const currentBiz = store.getCurrentBusiness();
 const accounts = store.getMpesaAccounts(false);
 const primaryAccount = store.getPrimaryMpesaAccount();

 // Modal state
 const [modalMode, setModalMode] = useState<'ADD' | 'EDIT' | null>(null);
 const [editingAccountId, setEditingAccountId] = useState<string | null>(null);

 // Form inputs
 const [accountName, setAccountName] = useState('');
 const [accountType, setAccountType] = useState<MpesaAccountType>('BUY_GOODS_TILL');
 const [identifier, setIdentifier] = useState('');
 const [accountNumber, setAccountNumber] = useState('');
 const [isPrimary, setIsPrimary] = useState(false);
 const [notes, setNotes] = useState('');
 const [formError, setFormError] = useState<string | null>(null);

 // Copy toast state
 const [copiedId, setCopiedId] = useState<string | null>(null);
 const [instructionsCopied, setInstructionsCopied] = useState(false);

 // Delete confirmation
 const [deletingId, setDeletingId] = useState<string | null>(null);

 const resetForm = () => {
 setAccountName('');
 setAccountType('BUY_GOODS_TILL');
 setIdentifier('');
 setAccountNumber('');
 setIsPrimary(false);
 setNotes('');
 setFormError(null);
 setEditingAccountId(null);
 setModalMode(null);
 };

 const handleOpenAdd = () => {
 setAccountName('');
 setAccountType('BUY_GOODS_TILL');
 setIdentifier('');
 setAccountNumber('');
 setIsPrimary(accounts.length === 0);
 setNotes('');
 setFormError(null);
 setEditingAccountId(null);
 setModalMode('ADD');
 };

 const handleOpenEdit = (acc: MpesaAccount) => {
 setEditingAccountId(acc.id);
 setAccountName(acc.accountName);
 setAccountType(acc.accountType);
 setIdentifier(acc.identifier);
 setAccountNumber(acc.accountNumber || '');
 setIsPrimary(Boolean(acc.isPrimary));
 setNotes(acc.notes || '');
 setFormError(null);
 setModalMode('EDIT');
 };

 const handleSave = (e: React.FormEvent) => {
 e.preventDefault();
 setFormError(null);

 const cleanName = accountName.trim();
 const cleanId = identifier.trim();
 const cleanAccNum = accountNumber.trim();

 if (!cleanName) {
 setFormError('Please enter a descriptive name for this M-Pesa account.');
 return;
 }

 if (!cleanId) {
 setFormError('Please enter the Till Number, Paybill Shortcode, or Phone Number.');
 return;
 }

 if (accountType === 'PAYBILL' && !cleanAccNum) {
 setFormError('Paybills require an Account Number/Name (e.g. "BAR" or "DRINKS").');
 return;
 }

 try {
 if (modalMode === 'ADD') {
 store.addMpesaAccount({
 accountName: cleanName,
 accountType,
 identifier: cleanId,
 accountNumber: accountType === 'PAYBILL' ? cleanAccNum : undefined,
 isPrimary,
 notes: notes.trim() || undefined,
 });
 } else if (modalMode === 'EDIT' && editingAccountId) {
 store.updateMpesaAccount(editingAccountId, {
 accountName: cleanName,
 accountType,
 identifier: cleanId,
 accountNumber: accountType === 'PAYBILL' ? cleanAccNum : undefined,
 isPrimary,
 notes: notes.trim() || undefined,
 });
 }
 resetForm();
 } catch (err: any) {
 setFormError(err.message || 'Failed to save M-Pesa account.');
 }
 };

 const handleSetPrimary = (accId: string) => {
 store.setPrimaryMpesaAccount(accId);
 };

 const handleDelete = (accId: string) => {
 if (accounts.length <= 1) {
 alert('You must have at least one configured M-Pesa account for bar shift reconciliation.');
 setDeletingId(null);
 return;
 }
 store.deleteMpesaAccount(accId);
 setDeletingId(null);
 };

 const copyToClipboard = (text: string, id: string) => {
 navigator.clipboard.writeText(text);
 setCopiedId(id);
 setTimeout(() => setCopiedId(null), 2500);
 };

 const getCustomerInstructions = (acc?: MpesaAccount) => {
 if (!acc) return '';
 if (acc.accountType === 'BUY_GOODS_TILL') {
 return `LIPA NA M-PESA\nBuy Goods and Services\nTill No: ${acc.identifier}\nStore: ${currentBiz.name}`;
 }
 if (acc.accountType === 'PAYBILL') {
 return `LIPA NA M-PESA\nPay Bill\nBusiness No: ${acc.identifier}\nAccount No: ${acc.accountNumber || 'BAR'}\nStore: ${currentBiz.name}`;
 }
 if (acc.accountType === 'POCHI_LA_BIASHARA') {
 return `LIPA NA M-PESA\nPochi la Biashara\nPhone No: ${acc.identifier}\nStore: ${currentBiz.name}`;
 }
 return `M-PESA: Send Money to ${acc.identifier} (${currentBiz.name})`;
 };

 const copyCustomerInstructions = () => {
 const text = getCustomerInstructions(primaryAccount);
 navigator.clipboard.writeText(text);
 setInstructionsCopied(true);
 setTimeout(() => setInstructionsCopied(false), 2500);
 };

 const getTypeBadge = (type: MpesaAccountType) => {
 switch (type) {
 case 'BUY_GOODS_TILL':
 return (
 <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold">
 <Store className="w-3.5 h-3.5" />
 <span>Buy Goods Till</span>
 </span>
 );
 case 'PAYBILL':
 return (
 <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-400 text-[11px] font-bold">
 <Receipt className="w-3.5 h-3.5" />
 <span>Paybill</span>
 </span>
 );
 case 'POCHI_LA_BIASHARA':
 return (
 <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-500/15 border border-teal-500/30 text-teal-400 text-[11px] font-bold">
 <Smartphone className="w-3.5 h-3.5" />
 <span>Pochi la Biashara</span>
 </span>
 );
 case 'SEND_MONEY':
 return (
 <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[11px] font-bold">
 <Smartphone className="w-3.5 h-3.5" />
 <span>Send Money</span>
 </span>
 );
 }
 };

 return (
 <div className="space-y-6 pb-24 md:pb-12">
 {/* 1. Top Header & Action Banner */}
 <div className="bg-[#121824] border border-[#1E293B] rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
 <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

 <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
 <div className="space-y-1">
 <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 font-bold flex items-center gap-1.5">
 <span>Safaricom Mobile Money</span>
 <span>·</span>
 <span className="text-slate-400">{currentBiz.name}</span>
 </div>
 <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
 <Smartphone className="w-7 h-7 text-emerald-400" />
 <span>M-Pesa Till & Paybill Configuration</span>
 </h2>
 <p className="text-xs sm:text-sm text-slate-400 max-w-xl">
 Configure your bar’s official Buy Goods Till, Paybill numbers, or Pochi accounts.
 These numbers appear on attendants’ terminals for customer payments and shift closing audits.
 </p>
 </div>

 <button
 onClick={handleOpenAdd}
 className="py-3 px-5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-emerald-950/60 transition-all active:scale-[0.98] cursor-pointer whitespace-nowrap"
 >
 <Plus className="w-4 h-4" />
 <span>Add M-Pesa Account</span>
 </button>
 </div>
 </div>

 {/* 2. Customer Counter Stand Preview Card */}
 {primaryAccount && (
 <div className="bg-gradient-to-r from-[#0F1E17] via-[#12241D] to-[#0F172A] border-2 border-emerald-500/40 rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
 <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
 <div className="flex items-start gap-4">
 <div className="w-14 h-14 rounded-2xl bg-emerald-500 text-slate-950 font-black flex flex-col items-center justify-center p-2 shrink-0 shadow-lg shadow-emerald-950/80">
 <span className="text-[9px] font-mono leading-none tracking-tighter uppercase font-bold">LIPA NA</span>
 <span className="text-xs font-black tracking-tight leading-none mt-0.5">M-PESA</span>
 </div>
 <div className="space-y-1">
 <div className="flex items-center gap-2">
 <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30 uppercase tracking-wide">
 Active Primary Till
 </span>
 <span className="text-xs text-slate-400">Shown to Customers & Staff</span>
 </div>
 <div className="flex items-baseline gap-3 flex-wrap">
 <span className="text-2xl sm:text-3xl font-black font-mono text-white tracking-wider">
 {primaryAccount.identifier}
 </span>
 {primaryAccount.accountNumber && (
 <span className="text-sm font-mono text-emerald-300 bg-emerald-950/60 px-2 py-1 rounded-lg border border-emerald-800/60">
 ACC: {primaryAccount.accountNumber}
 </span>
 )}
 <span className="text-xs text-slate-300 font-semibold">
 ({primaryAccount.accountName})
 </span>
 </div>
 <p className="text-xs text-emerald-400/80">
 {primaryAccount.accountType === 'BUY_GOODS_TILL' && 'Customer selects: Lipa na M-Pesa → Buy Goods and Services → Enter Till No.'}
 {primaryAccount.accountType === 'PAYBILL' && `Customer selects: Lipa na M-Pesa → Pay Bill → Bus. No ${primaryAccount.identifier} → Acc. ${primaryAccount.accountNumber || 'BAR'}`}
 {primaryAccount.accountType === 'POCHI_LA_BIASHARA' && 'Customer selects: Lipa na M-Pesa → Pochi la Biashara.'}
 </p>
 </div>
 </div>

 <div className="flex items-center gap-2 w-full md:w-auto justify-end">
 <button
 onClick={copyCustomerInstructions}
 className="py-2.5 px-4 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700/80 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow"
 >
 {instructionsCopied ? (
 <>
 <Check className="w-4 h-4 text-emerald-400" />
 <span className="text-emerald-400">Copied Instructions!</span>
 </>
 ) : (
 <>
 <Copy className="w-4 h-4 text-slate-400" />
 <span>Copy Stand Text</span>
 </>
 )}
 </button>
 <button
 onClick={() => window.print()}
 title="Print Bar Counter Stand"
 className="py-2.5 px-3.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 border border-slate-700/80 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow"
 >
 <Printer className="w-4 h-4 text-slate-400" />
 <span className="hidden sm:inline">Print Stand</span>
 </button>
 </div>
 </div>
 </div>
 )}

 {/* 3. Accounts List Cards */}
 <div className="space-y-3">
 <div className="flex items-center justify-between px-1">
 <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
 Configured Bar Channels ({accounts.length})
 </h3>
 <span className="text-[11px] text-slate-500">
 Click 'Make Primary' to designate default cashier till
 </span>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 {accounts.map((acc) => {
 const isAccPrimary = Boolean(acc.isPrimary);

 return (
 <div
 key={acc.id}
 className={`rounded-3xl p-5 border transition-all relative flex flex-col justify-between ${
 isAccPrimary
 ? 'bg-[#121A28] border-emerald-500/60 shadow-lg shadow-emerald-950/20'
 : 'bg-[#121824] border-[#1E293B] hover:border-slate-700'
 }`}
 >
 <div className="space-y-3">
 {/* Card Top: Name & Badges */}
 <div className="flex items-start justify-between gap-2">
 <div className="space-y-1">
 <div className="flex items-center gap-2 flex-wrap">
 {getTypeBadge(acc.accountType)}
 {isAccPrimary && (
 <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-black uppercase">
 <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
 <span>Primary Channel</span>
 </span>
 )}
 </div>
 <h4 className="text-base font-bold text-white tracking-tight">
 {acc.accountName}
 </h4>
 </div>

 {/* Quick Edit/Delete */}
 <div className="flex items-center gap-1 shrink-0">
 <button
 onClick={() => handleOpenEdit(acc)}
 title="Edit Account"
 className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
 >
 <Edit2 className="w-3.5 h-3.5" />
 </button>
 <button
 onClick={() => setDeletingId(acc.id)}
 title="Delete Account"
 className="p-2 rounded-xl bg-slate-800/80 hover:bg-red-950/60 text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
 >
 <Trash2 className="w-3.5 h-3.5" />
 </button>
 </div>
 </div>

 {/* Card Body: Identifiers */}
 <div className="p-3.5 rounded-2xl bg-[#0B0F17] border border-slate-800/80 flex items-center justify-between">
 <div>
 <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 block">
 {acc.accountType === 'BUY_GOODS_TILL' && 'Till Number'}
 {acc.accountType === 'PAYBILL' && 'Business Shortcode'}
 {acc.accountType === 'POCHI_LA_BIASHARA' && 'Pochi Mobile No.'}
 {acc.accountType === 'SEND_MONEY' && 'Phone Number'}
 </span>
 <div className="flex items-baseline gap-2 mt-0.5">
 <span className="text-xl font-black font-mono text-emerald-400 tracking-wider">
 {acc.identifier}
 </span>
 {acc.accountNumber && (
 <span className="text-xs font-mono text-slate-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
 Acc: {acc.accountNumber}
 </span>
 )}
 </div>
 </div>

 <button
 onClick={() => copyToClipboard(acc.identifier, acc.id)}
 className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition-colors cursor-pointer"
 title="Copy number"
 >
 {copiedId === acc.id ? (
 <Check className="w-4 h-4 text-emerald-400" />
 ) : (
 <Copy className="w-4 h-4" />
 )}
 </button>
 </div>

 {/* Notes / description */}
 {acc.notes && (
 <p className="text-xs text-slate-400 italic px-1">
 "{acc.notes}"
 </p>
 )}
 </div>

 {/* Card Bottom: Primary Toggle */}
 <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between mt-3">
 <div className="text-[11px] text-slate-500 font-mono">
 ID: {acc.id.split('-').slice(-2).join('-')}
 </div>

 {isAccPrimary ? (
 <span className="text-xs text-emerald-400 font-bold flex items-center gap-1.5">
 <ShieldCheck className="w-4 h-4 text-emerald-400" />
 <span>Default for Shifts</span>
 </span>
 ) : (
 <button
 onClick={() => handleSetPrimary(acc.id)}
 className="text-xs font-bold text-slate-300 hover:text-amber-400 py-1 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700/80 transition-colors flex items-center gap-1.5 cursor-pointer"
 >
 <Star className="w-3.5 h-3.5" />
 <span>Set as Primary</span>
 </button>
 )}
 </div>
 </div>
 );
 })}
 </div>
 </div>

 {/* 4. Delete Confirmation Dialog */}
 {deletingId && (
 <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
 <div className="bg-[#121824] border border-red-500/40 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
 <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 mx-auto">
 <Trash2 className="w-6 h-6" />
 </div>
 <div className="text-center space-y-1">
 <h3 className="text-lg font-black text-white">Delete M-Pesa Account?</h3>
 <p className="text-xs text-slate-400">
 Are you sure you want to remove this account? Previous shift reconciliation history will not be lost.
 </p>
 </div>
 <div className="grid grid-cols-2 gap-2 pt-2">
 <button
 onClick={() => setDeletingId(null)}
 className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 cursor-pointer"
 >
 Cancel
 </button>
 <button
 onClick={() => handleDelete(deletingId)}
 className="py-3 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-black text-white cursor-pointer shadow-lg shadow-red-950/60"
 >
 Confirm Delete
 </button>
 </div>
 </div>
 </div>
 )}

 {/* 5. ADD / EDIT M-PESA MODAL */}
 {modalMode && (
 <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
 <div className="bg-[#121824] border border-[#1E293B] rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-5 my-auto">
 {/* Modal Header */}
 <div className="flex items-center justify-between pb-3 border-b border-slate-800">
 <div className="flex items-center gap-2.5">
 <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
 <Smartphone className="w-5 h-5" />
 </div>
 <div>
 <h3 className="text-lg font-black text-white tracking-tight">
 {modalMode === 'ADD' ? 'Add M-Pesa Account' : 'Edit M-Pesa Account'}
 </h3>
 <p className="text-[11px] text-slate-400 font-mono">
 {currentBiz.name}
 </p>
 </div>
 </div>
 <button
 onClick={resetForm}
 className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
 >
 <X className="w-4 h-4" />
 </button>
 </div>

 {/* Error banner */}
 {formError && (
 <div className="p-3 rounded-2xl bg-red-950/80 border border-red-500/50 text-red-200 text-xs flex items-center gap-2">
 <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
 <span>{formError}</span>
 </div>
 )}

 <form onSubmit={handleSave} className="space-y-4">
 {/* Account Type Selector */}
 <div className="space-y-1.5">
 <label className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
 Account Type
 </label>
 <div className="grid grid-cols-2 gap-2">
 <button
 type="button"
 onClick={() => setAccountType('BUY_GOODS_TILL')}
 className={`p-3 rounded-2xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
 accountType === 'BUY_GOODS_TILL'
 ? 'bg-emerald-500/15 border-emerald-500 text-emerald-400 shadow-md shadow-emerald-950/30'
 : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
 }`}
 >
 <div className="flex items-center gap-1.5 text-xs font-black">
 <Store className="w-3.5 h-3.5" />
 <span>Buy Goods (Till)</span>
 </div>
 <span className="text-[10px] text-slate-400 font-normal leading-tight">
 Standard counter till (5-7 digits)
 </span>
 </button>

 <button
 type="button"
 onClick={() => setAccountType('PAYBILL')}
 className={`p-3 rounded-2xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
 accountType === 'PAYBILL'
 ? 'bg-sky-500/15 border-sky-500 text-sky-400 shadow-md shadow-sky-950/30'
 : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
 }`}
 >
 <div className="flex items-center gap-1.5 text-xs font-black">
 <Receipt className="w-3.5 h-3.5" />
 <span>Paybill</span>
 </div>
 <span className="text-[10px] text-slate-400 font-normal leading-tight">
 Shortcode + Account number
 </span>
 </button>

 <button
 type="button"
 onClick={() => setAccountType('POCHI_LA_BIASHARA')}
 className={`p-3 rounded-2xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
 accountType === 'POCHI_LA_BIASHARA'
 ? 'bg-teal-500/15 border-teal-500 text-teal-400 shadow-md shadow-teal-950/30'
 : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
 }`}
 >
 <div className="flex items-center gap-1.5 text-xs font-black">
 <Smartphone className="w-3.5 h-3.5" />
 <span>Pochi la Biashara</span>
 </div>
 <span className="text-[10px] text-slate-400 font-normal leading-tight">
 Safaricom business phone wallet
 </span>
 </button>

 <button
 type="button"
 onClick={() => setAccountType('SEND_MONEY')}
 className={`p-3 rounded-2xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
 accountType === 'SEND_MONEY'
 ? 'bg-amber-500/15 border-amber-500 text-amber-400 shadow-md shadow-amber-950/30'
 : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
 }`}
 >
 <div className="flex items-center gap-1.5 text-xs font-black">
 <Smartphone className="w-3.5 h-3.5" />
 <span>Send Money</span>
 </div>
 <span className="text-[10px] text-slate-400 font-normal leading-tight">
 Direct mobile float transfer
 </span>
 </button>
 </div>
 </div>

 {/* Account Label / Name */}
 <div className="space-y-1.5">
 <label className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
 Station / Account Name
 </label>
 <input
 type="text"
 value={accountName}
 onChange={(e) => setAccountName(e.target.value)}
 className="w-full py-3 px-3.5 rounded-2xl bg-slate-900 border border-slate-800 focus:border-emerald-500 text-white text-sm outline-none transition-colors"
 />
 </div>

 {/* Number / Identifier */}
 <div className="space-y-1.5">
 <label className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
 {accountType === 'BUY_GOODS_TILL' && 'Till Number'}
 {accountType === 'PAYBILL' && 'Business Paybill Number (Shortcode)'}
 {accountType === 'POCHI_LA_BIASHARA' && 'Pochi Mobile Number'}
 {accountType === 'SEND_MONEY' && 'Phone Number'}
 </label>
 <input
 type="text"
 value={identifier}
 onChange={(e) => setIdentifier(e.target.value)}
 className="w-full py-3 px-3.5 rounded-2xl bg-slate-900 border border-slate-800 focus:border-emerald-500 text-emerald-400 font-mono font-bold text-base outline-none tracking-wider transition-colors"
 />
 </div>

 {/* Conditional Paybill Account Number */}
 {accountType === 'PAYBILL' && (
 <div className="space-y-1.5 animate-in fade-in duration-150">
 <label className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center justify-between">
 <span>Paybill Account Number / Name</span>
 <span className="text-[10px] text-sky-400 normal-case">Required for Paybill</span>
 </label>
 <input
 type="text"
 value={accountNumber}
 onChange={(e) => setAccountNumber(e.target.value)}
 className="w-full py-3 px-3.5 rounded-2xl bg-slate-900 border border-slate-800 focus:border-sky-500 text-white font-mono text-sm outline-none transition-colors uppercase"
 />
 <span className="text-[10px] text-slate-500 block">
 What customers enter in the "Account Number" field on their phone.
 </span>
 </div>
 )}

 {/* Primary Toggle */}
 <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-3">
 <div className="space-y-0.5">
 <span className="text-xs font-bold text-white block">
 Make this the Primary M-Pesa Channel
 </span>
 <span className="text-[10px] text-slate-400 block leading-tight">
 Attendants will use this balance for shift opening & closing audits.
 </span>
 </div>
 <input
 type="checkbox"
 checked={isPrimary}
 onChange={(e) => setIsPrimary(e.target.checked)}
 className="w-5 h-5 accent-emerald-500 rounded cursor-pointer"
 />
 </div>

 {/* Placement / Notes */}
 <div className="space-y-1.5">
 <label className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
 Internal Placement Note (Optional)
 </label>
 <input
 type="text"
 value={notes}
 onChange={(e) => setNotes(e.target.value)}
 className="w-full py-2.5 px-3 rounded-xl bg-slate-900 border border-slate-800 focus:border-slate-600 text-slate-300 text-xs outline-none"
 />
 </div>

 {/* Modal Buttons */}
 <div className="grid grid-cols-2 gap-3 pt-2">
 <button
 type="button"
 onClick={resetForm}
 className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 cursor-pointer"
 >
 Cancel
 </button>
 <button
 type="submit"
 className="py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-950/60 transition-all active:scale-[0.98]"
 >
 <Check className="w-4 h-4" />
 <span>{modalMode === 'ADD' ? 'Add Account' : 'Save Changes'}</span>
 </button>
 </div>
 </form>
 </div>
 </div>
 )}
 </div>
 );
};
