import React, { useState } from 'react';
import { Discrepancy } from '../../types';
import { X, ShieldAlert, CheckCircle, Clock } from 'lucide-react';

interface DiscrepancyResolveModalProps {
  discrepancy: Discrepancy;
  onClose: () => void;
  onResolve: (id: string, notes: string, status: 'INVESTIGATING' | 'RESOLVED') => void;
}

export const DiscrepancyResolveModal: React.FC<DiscrepancyResolveModalProps> = ({
  discrepancy,
  onClose,
  onResolve,
}) => {
  const [notes, setNotes] = useState<string>(discrepancy.ownerNotes || '');
  const [status, setStatus] = useState<'INVESTIGATING' | 'RESOLVED'>('RESOLVED');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onResolve(discrepancy.id, notes, status);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#121824] border border-[#1E293B] rounded-3xl p-5 md:p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-400" />
            <h3 className="text-base font-bold text-white tracking-tight">Investigate Discrepancy</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="p-3 rounded-2xl bg-red-950/20 border border-red-800/40 text-xs space-y-1">
            <div className="font-bold text-white text-sm">{discrepancy.itemName}</div>
            <div className="text-slate-400">
              Reported: <span className="font-mono text-slate-300">{new Date(discrepancy.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
            </div>
            <div className="text-slate-400">
              Worker on duty: <span className="text-emerald-400">{discrepancy.workerName}</span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-red-900/40 font-mono">
              <span className="text-slate-400">Variance / Difference:</span>
              <span className="font-bold text-red-400">
                {discrepancy.variance} (KES {discrepancy.monetaryValue.toLocaleString()})
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Investigation Status
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setStatus('INVESTIGATING')}
                className={`p-2.5 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer ${
                  status === 'INVESTIGATING'
                    ? 'border-amber-500 bg-amber-950/40 text-amber-300 font-bold'
                    : 'border-slate-800 bg-slate-900 text-slate-400'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Mark Investigating</span>
              </button>

              <button
                type="button"
                onClick={() => setStatus('RESOLVED')}
                className={`p-2.5 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer ${
                  status === 'RESOLVED'
                    ? 'border-emerald-500 bg-emerald-950/40 text-emerald-400 font-bold'
                    : 'border-slate-800 bg-slate-900 text-slate-400'
                }`}
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Mark Resolved</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Owner Investigation Notes
            </label>
            <textarea
              rows={3}
              required
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Reviewed CCTV; confirmed 1 bottle was accidentally broken during rush hour and not recorded by attendant. Approved waiver."
              className="w-full bg-[#0E1420] border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <button
            type="submit"
            className="w-full h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 cursor-pointer"
          >
            <CheckCircle className="w-4 h-4" />
            <span>Save Resolution</span>
          </button>
        </form>
      </div>
    </div>
  );
};
