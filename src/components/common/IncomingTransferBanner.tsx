import React, { useState } from 'react';
import { InterBusinessTransfer } from '../../types';
import { store } from '../../services/store';
import { PackageCheck, X, Truck } from 'lucide-react';

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
      setSuccessToast(`Accepted ${t.quantity}x ${t.productName} into bar inventory.`);
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to accept transfer');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = (t: InterBusinessTransfer) => {
    if (!confirm(`Decline delivery of ${t.quantity}x ${t.productName} from ${t.fromBusinessName}?`)) return;
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
    <div className="space-y-2">
      {successToast && (
        <div className="p-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-xs flex items-center justify-between shadow-sm">
          <span>{successToast}</span>
          <button onClick={() => setSuccessToast(null)} className="p-1 text-slate-400 hover:text-white cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {transfers.map((t) => (
        <div
          key={t.id}
          className="p-3.5 sm:p-4 rounded-xl bg-[#111622] border border-[#1E2638] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
        >
          <div className="flex items-center gap-2.5">
            <Truck className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <div className="font-semibold text-white">
                Incoming Delivery: {t.quantity}x {t.productName}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                From: {t.fromBusinessName} · Dispatched by {t.senderWorkerName}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => handleAccept(t)}
              disabled={processingId === t.id}
              className="py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <PackageCheck className="w-3.5 h-3.5" />
              <span>Accept Stock</span>
            </button>

            <button
              onClick={() => handleReject(t)}
              disabled={processingId === t.id}
              className="py-1.5 px-3 rounded-lg bg-[#161F30] hover:bg-rose-950/50 hover:text-rose-300 text-slate-400 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
            >
              <span>Decline</span>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
