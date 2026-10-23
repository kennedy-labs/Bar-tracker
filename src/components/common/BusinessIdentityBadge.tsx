import React from 'react';
import { store } from '../../services/store';

export const BusinessIdentityBadge: React.FC = () => {
  const currentBiz = store.getCurrentBusiness();

  return (
    <div className="flex items-center gap-2 text-left select-none">
      <span className="text-sm font-bold tracking-tight text-white truncate max-w-[180px] sm:max-w-[260px]">
        {currentBiz.name}
      </span>
    </div>
  );
};
