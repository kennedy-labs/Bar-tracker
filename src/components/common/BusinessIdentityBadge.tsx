import React from 'react';
import { store } from '../../services/store';
import { Building2 } from 'lucide-react';

export const BusinessIdentityBadge: React.FC = () => {
  const currentBiz = store.getCurrentBusiness();

  return (
    <div className="flex items-center gap-2 bg-[#0E1420] border border-slate-800 rounded-2xl px-3 py-1.5 shadow-sm">
      <div className="w-6 h-6 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
        <Building2 className="w-3.5 h-3.5" />
      </div>
      <div className="text-xs font-bold text-white tracking-wide truncate max-w-[160px] sm:max-w-[220px]">
        {currentBiz.name}
      </div>
    </div>
  );
};
