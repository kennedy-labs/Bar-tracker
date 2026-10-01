import React, { useState } from 'react';
import { store } from '../../services/store';
import {
  Building2,
  Copy,
  Check,
  ChevronDown,
  Sparkles,
} from 'lucide-react';

export const BusinessSwitcher: React.FC = () => {
  const currentBiz = store.getCurrentBusiness();
  const allBusinesses = store.getBusinesses();
  const [copied, setCopied] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleCopyCode = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(currentBiz.connectCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative inline-block text-left">
      <div className="flex items-center gap-2 bg-[#0E1420] border border-slate-800 rounded-2xl p-1.5 pr-2.5">
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-2 hover:bg-slate-800/60 px-2 py-1 rounded-xl transition-colors cursor-pointer text-left"
        >
          <div className="w-6 h-6 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Building2 className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="text-xs font-bold text-white flex items-center gap-1">
              <span>{currentBiz.name}</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </div>
          </div>
        </button>

        {/* 6-Digit Connect Code Badge with 1-Click Copy */}
        <button
          onClick={handleCopyCode}
          title="Click to copy your 6-digit Bar Connect Code"
          className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#151D2C] border border-slate-700/80 hover:border-emerald-500 text-[11px] font-mono text-slate-300 hover:text-emerald-400 transition-colors cursor-pointer"
        >
          <span className="text-[10px] text-slate-500 uppercase">Code:</span>
          <span className="font-bold text-emerald-400 tracking-wider">{currentBiz.connectCode}</span>
          {copied ? (
            <Check className="w-3 h-3 text-emerald-400" />
          ) : (
            <Copy className="w-3 h-3 text-slate-400" />
          )}
        </button>
      </div>

      {/* Switcher Dropdown */}
      {dropdownOpen && (
        <div className="absolute left-0 mt-2 w-72 bg-[#121824] border border-slate-800 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95">
          <div className="px-3 py-2 border-b border-slate-800 text-[11px] text-slate-400">
            <div className="font-bold text-white uppercase tracking-wider text-[10px]">
              Switch Establishment
            </div>
            <span>Switch bars to test peer-to-peer stock dispatch & acceptance</span>
          </div>

          <div className="mt-1 space-y-1">
            {allBusinesses.map((b) => (
              <button
                key={b.id}
                onClick={() => {
                  store.setCurrentBusiness(b.id);
                  setDropdownOpen(false);
                }}
                className={`w-full p-2.5 rounded-xl text-left flex items-center justify-between text-xs transition-colors cursor-pointer ${
                  b.id === currentBiz.id
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-white font-bold'
                    : 'hover:bg-slate-800 text-slate-300'
                }`}
              >
                <div>
                  <div className="font-semibold text-white">{b.name}</div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                    Code: {b.connectCode} · {b.phone}
                  </div>
                </div>
                {b.id === currentBiz.id && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
