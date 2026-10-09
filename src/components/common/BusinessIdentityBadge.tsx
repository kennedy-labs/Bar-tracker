import React from 'react';
import { store } from '../../services/store';
import { Building2 } from 'lucide-react';

export const BusinessIdentityBadge: React.FC = () => {
  const currentBiz = store.getCurrentBusiness();

  return (
    <div className="flex items-center gap-2 text-left select-none">
      <span className="text-sm font-bold tracking-tight text-white">
        Bar Track
      </span>
      <span className="text-slate-600 text-xs font-light">/</span>
      <span className="text-xs font-medium text-slate-400 truncate max-w-[140px] sm:max-w-[220px]">
        {currentBiz.name}
      </span>
    </div>
  );
};
