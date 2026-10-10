import React, { useState } from 'react';
import { store } from '../../services/store';
import { BusinessPartner, InterBusinessTransfer } from '../../types';
import {
  Building2,
  Phone,
  Copy,
  Check,
  Plus,
  ArrowRight,
  Truck,
  RotateCcw,
  CheckCircle2,
  Clock,
  XCircle,
  Banknote,
  Smartphone,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  Lock,
} from 'lucide-react';

export const PartnerBarsManager: React.FC = () => {
  const currentBiz = store.getCurrentBusiness();
  const partners = store.getPartners();
  const transfers = store.getInterBusinessTransfers();
  const shiftCodeInfo = store.getShiftTransferCode();

  const [connectInput, setConnectInput] = useState('');
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connectSuccess, setConnectSuccess] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Settlement modal state
  const [settlingPartner, setSettlingPartner] = useState<BusinessPartner | null>(null);
  const [settleAmount, setSettleAmount] = useState<string>('');
  const [settleMethod, setSettleMethod] = useState<'CASH' | 'MPESA'>('CASH');

  const handleCopyCode = () => {
    if (!shiftCodeInfo.code) return;
    navigator.clipboard.writeText(shiftCodeInfo.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleRegenerateCode = () => {
    try {
      store.regenerateShiftTransferCode();
      setConnectSuccess('New one-time shift transfer code generated.');
      setTimeout(() => setConnectSuccess(null), 4000);
    } catch (err: any) {
      setConnectError(err.message || 'Failed to rotate code.');
    }
  };

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    setConnectError(null);
    setConnectSuccess(null);

    if (!connectInput.trim()) return;

    try {
      const partner = store.connectPartner(connectInput);
      setConnectSuccess(`Successfully linked with ${partner.partnerName}! You can now exchange stock loans directly.`);
      setConnectInput('');
      setTimeout(() => setConnectSuccess(null), 5000);
    } catch (err: any) {
      setConnectError(err.message || 'Could not connect partner bar.');
    }
  };

  const handleSettleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlingPartner) return;
    const amt = parseFloat(settleAmount);
    if (isNaN(amt) || amt <= 0) return;

    store.settlePartnerBalance(settlingPartner.partnerBusinessId, amt, settleMethod);
    setSettlingPartner(null);
    setSettleAmount('');
  };

  return (
    <div className="space-y-6">
      {/* 1. Bar Identity & Quick Connect Header Card */}
      <div className="p-5 md:p-6 rounded-3xl bg-[#121824] border border-[#1E293B] shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">
              <Building2 className="w-4 h-4" />
              <span>Shift-Scoped Stock Transfers</span>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-white mt-1">
              {currentBiz.name}
            </h3>
            <p className="text-xs text-slate-400">
              One-time pairing code valid strictly for the active shift. Expires automatically when the shift closes.
            </p>
          </div>

          {/* One-Time Shift Code Box */}
          {shiftCodeInfo.isShiftActive ? (
            <div className="flex items-center gap-3 bg-[#0E1420] border border-slate-800 p-3 rounded-2xl">
              <div>
                <div className="flex items-center gap-1.5 text-[10px] uppercase font-mono text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>Shift One-Time Code</span>
                </div>
                <div className="text-xl font-mono font-bold text-emerald-400 tracking-widest mt-0.5">
                  {shiftCodeInfo.code}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <button
                  onClick={handleCopyCode}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title="Copy 1-Time Shift Code"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={handleRegenerateCode}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title="Rotate / Generate New Code"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-2xl bg-amber-950/30 border border-amber-800/60 text-xs text-amber-300 flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-400 shrink-0" />
              <div>
                <div className="font-bold">No Active Shift Open</div>
                <div className="text-[10px] text-amber-400/80">Open a shift on the Counter to generate a one-time transfer code.</div>
              </div>
            </div>
          )}
        </div>

        {/* Connect New Bar Input Form */}
        <form onSubmit={handleConnect} className="space-y-3">
          <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider">
            Link Neighboring Bar for Stock Transfers
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={connectInput}
              onChange={(e) => setConnectInput(e.target.value)}
              
              className="flex-1 bg-[#0E1420] border border-slate-700 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
            />
            <button
              type="submit"
              className="py-2.5 px-5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-lg shadow-emerald-950/40"
            >
              <Plus className="w-4 h-4" />
              <span>Link Bar</span>
            </button>
          </div>

          {connectError && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-800 text-xs text-red-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{connectError}</span>
            </div>
          )}

          {connectSuccess && (
            <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800 text-xs text-emerald-200 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{connectSuccess}</span>
            </div>
          )}
        </form>
      </div>

      {/* 2. Connected Partner Bars & Mutual Ledgers */}
      <div className="p-5 md:p-6 rounded-3xl bg-[#121824] border border-[#1E293B] space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Truck className="w-4 h-4 text-amber-400" />
              <span>Connected Partner Bars & Net Cost Balance</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Automated financial cost accounting for partner stock transfers
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-slate-400">
            {partners.length} Linked
          </span>
        </div>

        {partners.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-2xl">
            No partner bars connected yet. Enter a 6-digit bar code or phone number above to link with your first partner bar.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {partners.map((p) => {
              const owesUs = p.netTransferBalance > 0;
              const weOwe = p.netTransferBalance < 0;

              return (
                <div
                  key={p.id}
                  className="p-4 rounded-2xl bg-[#0E1420] border border-slate-800 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white">{p.partnerName}</h4>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-2">
                        <span>Code: {p.partnerConnectCode}</span>
                        {p.partnerPhone && (
                          <>
                            <span>·</span>
                            <span>{p.partnerPhone}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setSettlingPartner(p);
                        setSettleAmount(String(Math.abs(p.netTransferBalance) || ''));
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium transition-colors cursor-pointer"
                    >
                      Settle Balance
                    </button>
                  </div>

                  {/* Net Balance Pill Box */}
                  <div className="p-3 rounded-xl bg-[#151D2C] border border-slate-800 flex items-center justify-between font-mono text-xs">
                    <span className="text-slate-400 text-[11px]">Net Stock Balance:</span>
                    <div>
                      {owesUs ? (
                        <span className="font-bold text-emerald-400">
                          + KES {Math.abs(p.netTransferBalance).toLocaleString()} (They owe us)
                        </span>
                      ) : weOwe ? (
                        <span className="font-bold text-amber-400">
                          - KES {Math.abs(p.netTransferBalance).toLocaleString()} (We owe them)
                        </span>
                      ) : (
                        <span className="font-bold text-slate-400">
                          Balanced (KES 0)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Inter-Bar Transfer History Ledger */}
      <div className="p-5 md:p-6 rounded-3xl bg-[#121824] border border-[#1E293B] space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Inter-Bar Stock Transfer Ledger
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Itemized history of all dispatched and accepted deliveries
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400 font-bold">
            {transfers.length} Records
          </span>
        </div>

        {transfers.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-2xl">
            No stock transfers recorded yet. Dispatched deliveries will appear here.
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-800 rounded-2xl bg-[#0E1420]">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#151D2C] text-slate-400 font-mono text-[10px] uppercase border-b border-slate-800">
                <tr>
                  <th className="p-3">Time</th>
                  <th className="p-3">Direction</th>
                  <th className="p-3">Partner Bar</th>
                  <th className="p-3">Drink Transferred</th>
                  <th className="p-3 text-right">Stock Value</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono">
                {transfers.map((t) => {
                  const isOutbound = t.fromBusinessId === currentBiz.id;
                  return (
                    <tr key={t.id} className="hover:bg-slate-900/40">
                      <td className="p-3 text-slate-400">
                        {new Date(t.dispatchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        <div className="text-[10px] text-slate-600">
                          {new Date(t.dispatchedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </div>
                      </td>
                      <td className="p-3 font-sans">
                        {isOutbound ? (
                          <span className="text-amber-400 font-bold flex items-center gap-1">
                            <span>↗ Outbound (Transfer)</span>
                          </span>
                        ) : (
                          <span className="text-emerald-400 font-bold flex items-center gap-1">
                            <span>↙ Inbound (Transfer)</span>
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-sans font-semibold text-white">
                        {isOutbound ? t.toBusinessName : t.fromBusinessName}
                      </td>
                      <td className="p-3">
                        <span className="text-white font-bold">{t.quantity}x</span> {t.productName}
                      </td>
                      <td className="p-3 text-right font-bold text-slate-200">
                        KES {t.totalTransferValue.toLocaleString()}
                      </td>
                      <td className="p-3 text-center font-sans">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            t.status === 'ACCEPTED'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : t.status === 'PENDING'
                              ? 'bg-amber-950 text-amber-300 border border-amber-800'
                              : 'bg-red-950 text-red-400 border border-red-800'
                          }`}
                        >
                          {t.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Settle Balance Modal */}
      {settlingPartner && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121824] border border-[#1E293B] rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">
                Settle Balance with {settlingPartner.partnerName}
              </h3>
              <button
                onClick={() => setSettlingPartner(null)}
                className="p-1 text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSettleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Settlement Amount (KES)</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value)}
                  className="w-full bg-[#0E1420] border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold text-base focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Payment Method</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSettleMethod('CASH')}
                    className={`p-2.5 rounded-xl border text-center font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                      settleMethod === 'CASH'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                        : 'border-slate-800 text-slate-400'
                    }`}
                  >
                    <Banknote className="w-4 h-4" />
                    <span>Cash</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettleMethod('MPESA')}
                    className={`p-2.5 rounded-xl border text-center font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                      settleMethod === 'MPESA'
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                        : 'border-slate-800 text-slate-400'
                    }`}
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>M-Pesa</span>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs tracking-wide shadow-lg shadow-emerald-950/50 cursor-pointer"
              >
                Confirm Settlement
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
