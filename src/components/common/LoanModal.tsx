import React, { useState } from 'react';
import { Loan } from '../../types';
import { store } from '../../services/store';
import { X, Plus, CheckCircle2 } from 'lucide-react';

interface LoanModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LoanModal: React.FC<LoanModalProps> = ({ isOpen, onClose }) => {
  const [loans, setLoans] = useState(store.getLoans());
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  if (!isOpen) return null;

  const handleAdd = () => {
    if (!name || !amount) return;
    store.recordLoan({ name, amount: parseFloat(amount), note });
    setLoans(store.getLoans());
    setName('');
    setAmount('');
    setNote('');
  };

  const handleMarkPaid = (id: string) => {
    store.deleteLoan(id);
    setLoans(store.getLoans());
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#121824] border border-[#1E293B] rounded-3xl w-full max-w-sm p-5 space-y-5 shadow-2xl my-auto">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold text-white tracking-tight">Loans</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Add Loan Form */}
        <div className="space-y-3 bg-[#0E1420] p-4 rounded-2xl border border-slate-800">
          <input type="text" placeholder="Name" value={name} onChange={e => setName(e.target.value)} className="w-full bg-[#151D2C] p-2.5 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500 border border-slate-700" />
          <input type="number" placeholder="Amount (KES)" value={amount} onChange={e => setAmount(e.target.value)} className="w-full bg-[#151D2C] p-2.5 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500 border border-slate-700" />
          <input type="text" placeholder="Note (optional)" value={note} onChange={e => setNote(e.target.value)} className="w-full bg-[#151D2C] p-2 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500 border border-slate-700" />
          <button onClick={handleAdd} className="w-full bg-emerald-600 hover:bg-emerald-500 py-2.5 rounded-xl font-bold text-white flex items-center justify-center gap-2 text-sm cursor-pointer transition-all active:scale-95">
            <Plus className="w-4 h-4"/> Add Loan
          </button>
        </div>

        {/* List */}
        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {loans.length === 0 ? (
            <p className="text-center text-slate-500 text-xs py-4">No active loans.</p>
          ) : (
            loans.map(l => (
              <div key={l.id} className="flex justify-between items-center bg-[#0E1420] p-3 rounded-2xl border border-slate-800">
                <div className="min-w-0 mr-2">
                  <div className="text-white font-bold text-sm truncate">{l.name}</div>
                  <div className="text-amber-400 font-mono text-xs font-semibold">KES {l.amount.toLocaleString()}</div>
                  {l.note && <div className="text-slate-500 text-[10px] truncate">{l.note}</div>}
                </div>
                <button onClick={() => handleMarkPaid(l.id)} className="text-emerald-400 text-[10px] font-bold bg-emerald-950/50 hover:bg-emerald-900 border border-emerald-900 px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition-colors">
                  <CheckCircle2 className="w-3 h-3"/> Paid
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
