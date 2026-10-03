import React, { useState, useRef, useEffect } from 'react';
import { store } from '../../services/store';
import { Building2, ChevronDown, Check, Store } from 'lucide-react';

export const BusinessIdentityBadge: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const currentBiz = store.getCurrentBusiness();
  const businesses = store.getBusinesses();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectBiz = (bizId: string) => {
    store.setCurrentBusiness(bizId);
    setIsOpen(false);
  };

  const handleRegisterNew = () => {
    setIsOpen(false);
    localStorage.removeItem('bartracker_session_user');
    window.location.hash = 'signup';
    window.location.reload();
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-[#0E1420] hover:bg-[#151D2C] border border-slate-800 rounded-2xl px-3 py-1.5 shadow-sm transition-colors cursor-pointer text-left"
        title="Switch Bar Establishment or Register New Business"
      >
        <div className="w-6 h-6 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
          <Building2 className="w-3.5 h-3.5" />
        </div>
        <div className="text-xs font-bold text-white tracking-wide truncate max-w-[120px] sm:max-w-[180px]">
          {currentBiz.name}
        </div>
        <ChevronDown className="w-3 h-3 text-slate-400" />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-64 bg-[#121824] border border-slate-800 rounded-2xl p-2 shadow-2xl z-50 animate-in fade-in">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 border-b border-slate-800">
            Establishments ({businesses.length})
          </div>
          <div className="py-1 max-h-48 overflow-y-auto space-y-0.5">
            {businesses.map((b) => (
              <button
                key={b.id}
                onClick={() => handleSelectBiz(b.id)}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition-colors cursor-pointer text-left ${
                  b.id === currentBiz.id
                    ? 'bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/30'
                    : 'text-slate-300 hover:bg-[#151D2C]'
                }`}
              >
                <div className="truncate">
                  <div className="truncate">{b.name}</div>
                  {b.address && <div className="text-[10px] text-slate-500 truncate">{b.address}</div>}
                </div>
                {b.id === currentBiz.id && <Check className="w-3.5 h-3.5 shrink-0" />}
              </button>
            ))}
          </div>
          <div className="border-t border-slate-800 pt-1 mt-1">
            <button
              onClick={handleRegisterNew}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs text-emerald-400 hover:bg-emerald-500/10 font-bold transition-colors cursor-pointer text-left"
            >
              <Store className="w-3.5 h-3.5" />
              <span>+ Register New Bar (Owner)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
