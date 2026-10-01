import React, { useState } from 'react';
import { store } from '../../services/store';
import { Building2, Copy, Check } from 'lucide-react';

export const BusinessIdentityBadge: React.FC = () => {
  const currentBiz = store.getCurrentBusiness();
  const [copied, setCopied] = useState(false);

  const handleCopyCode = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(currentBiz.connectCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-2 bg-[#0E1420] border border-slate-800 rounded-2xl p-1.5 pr-2.5">
      <div className="flex items-center gap-2 px-2 py-1">
        <div className="w-6 h-6 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
          <Building2 className="w-3.5 h-3.5" />
        </div>
        <div className="text-xs font-bold text-white truncate max-w-[150px] sm:max-w-[200px]">
          {currentBiz.name}
        </div>
      </div>

      {/* 6-Digit Connect Code Badge with 1-Click Copy */}
      <button
        onClick={handleCopyCode}
        title="Copy your bar's 6-digit connect code to link with partners"
        className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#151D2C] border border-slate-700/80 hover:border-emerald-500 text-[11px] font-mono text-slate-300 hover:text-emerald-400 transition-colors cursor-pointer shrink-0"
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
  );
};
