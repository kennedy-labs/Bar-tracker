import React, { useState } from 'react';
import { InterBusinessTransfer } from '../../types';
import { store } from '../../services/store';
import {
  PackageCheck,
  Check,
  X,
  Truck,
  ArrowRight,
  ShieldCheck,
  Building2,
} from 'lucide-react';

interface IncomingTransferBannerProps {
  transfers: InterBusinessTransfer[];
}

export const IncomingTransferBanner: React.FC<IncomingTransferBannerProps> = ({ transfers }) => {
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  if (transfers.length === 0 && !successToast) return null;

  const handleAccept = (t: InterBusinessTransfer) => {
    setProcessingId(t.id);
    try {
      store.acceptInterBusinessTransfer(t.id);
      setSuccessToast(`Accepted ${t.quantity}x ${t.productName} into your bar stock! Cost value of KES ${t.totalCostValue.toLocaleString()} added.`);
      setTimeout(() => setSuccessToast(null), 5000);
    } catch (err: any) {
      alert(err.message || 'Failed to accept transfer');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = (t: InterBusinessTransfer) => {
    if (!confirm(`Reject incoming delivery of ${t.quantity}x ${t.productName} from ${t.fromBusinessName}?`)) return;
    setProcessingId(t.id);
    try {
      store.rejectInterBusinessTransfer(t.id, 'Declined by bartender');
    } catch (err: any) {
      alert(err.message || 'Failed to reject transfer');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-3">
      {successToast && (
        <div className="p-3.5 rounded-2xl bg-emerald-950/80 border border-emerald-500 text-emerald-200 text-xs flex items-center justify-between shadow-xl animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-medium">{successToast}</span>
          </div>
          <button onClick={() => setSuccessToast(null)} className="p-1 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {transfers.map((t) => (
        <div
          key={t.id}
          className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-emerald-950/60 via-[#15232d] to-[#121824] border-2 border-emerald-500/80 shadow-2xl space-y-3 relative overflow-hidden"
        >
          {/* Top Status */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shrink-0">
                <Truck className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                    Incoming Stock Transfer
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-900/60 text-emerald-300 border border-emerald-700">
                    Awaiting 1-Tap Acceptance
                  </span>
                </div>
                <div className="text-sm font-bold text-white mt-0.5 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-slate-400" />
                  <span>From: <strong className="text-emerald-300">{t.fromBusinessName}</strong></span>
                </div>
              </div>
            </div>

            <div className="text-right text-[11px] text-slate-400 font-mono">
              <div>Sent by {t.senderWorkerName}</div>
              <div className="text-[10px] text-slate-500">
                {new Date(t.dispatchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>

          {/* Transfer Details Banner */}
          <div className="p-3 rounded-2xl bg-[#0E1420]/80 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div>
              <div className="font-bold text-white text-sm">
                {t.quantity}x {t.productName}
              </div>
              {t.notes && (
                <div className="text-[11px] text-slate-400 italic mt-0.5">
                  Remark: "{t.notes}"
                </div>
              )}
            </div>

            <div className="font-mono text-right shrink-0">
              <div className="text-[10px] text-slate-400 uppercase">Cost Value To Be Added</div>
              <div className="text-sm font-bold text-emerald-400">
                KES {t.totalCostValue.toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-500">
                (KES {t.unitCost} / unit)
              </div>
            </div>
          </div>

          {/* 1-Tap Action Buttons */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => handleAccept(t)}
              disabled={processingId === t.id}
              className="flex-1 py-3 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs sm:text-sm tracking-wide shadow-lg shadow-emerald-950/60 flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
            >
              <PackageCheck className="w-4 h-4 shrink-0" />
              <span>✓ 1-Tap Accept & Add to Bar Stock</span>
            </button>

            <button
              onClick={() => handleReject(t)}
              disabled={processingId === t.id}
              className="py-3 px-4 rounded-2xl bg-slate-800/80 hover:bg-red-950/60 hover:text-red-300 hover:border-red-800 text-slate-300 font-semibold text-xs border border-slate-700 flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <X className="w-4 h-4" />
              <span>Decline</span>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
