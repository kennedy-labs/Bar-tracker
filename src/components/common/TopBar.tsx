import React from 'react';
import { User, Role } from '../../types';
import { store } from '../../services/store';
import {
  Wifi,
  WifiOff,
  LogOut,
  RefreshCw,
  Wine,
  ShieldAlert,
  SlidersHorizontal,
} from 'lucide-react';

import { BusinessIdentityBadge } from './BusinessIdentityBadge';

interface TopBarProps {
  currentUser: User | null;
  onLogout: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  pendingDiscrepanciesCount: number;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentUser,
  onLogout,
  activeTab,
  setActiveTab,
  pendingDiscrepanciesCount,
}) => {
  const isOnline = store.isOnline();
  const offlineQueueCount = store.getOfflineQueueCount();
  const incomingTransfersCount = store.getPendingIncomingTransfers().length;

  const handleToggleOnline = () => {
    store.toggleOnlineStatus();
  };

  interface NavItem {
    id: string;
    label: string;
    badge?: number;
  }

  const ownerNavItems: NavItem[] = [
    { id: 'overview', label: 'Command Center' },
    { id: 'staff', label: 'Staff & Security' },
    { id: 'partners', label: 'Partner Bars & Transfers', badge: incomingTransfersCount > 0 ? incomingTransfersCount : undefined },
    { id: 'events', label: 'Live Ticker' },
    {
      id: 'discrepancies',
      label: 'Discrepancy Radar',
      badge: pendingDiscrepanciesCount > 0 ? pendingDiscrepanciesCount : undefined,
    },
    { id: 'shifts', label: 'Shift Ledgers' },
    { id: 'stock', label: 'Stock Audit' },
    { id: 'catalog', label: 'Pricing & Catalog' },
  ];

  const workerNavItems: NavItem[] = [
    { id: 'counter', label: 'Counter Station', badge: incomingTransfersCount > 0 ? incomingTransfersCount : undefined },
    { id: 'history', label: 'My Shift History' },
  ];

  const navItems: NavItem[] = currentUser?.role === 'OWNER' ? ownerNavItems : workerNavItems;

  return (
    <header className="sticky top-0 z-50 bg-[#0B0F17]/95 backdrop-blur-md border-b border-[#1E293B] px-4 md:px-6 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Zone 1: Single text element wordmark + Business Switcher */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Wine className="w-4 h-4" />
            </div>
            <span className="text-base font-bold tracking-tight text-white hidden sm:inline">
              Bar Tracker
            </span>
          </div>

          {/* Business Identity & 6-Digit Connect Code Badge */}
          <BusinessIdentityBadge />
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === item.id
                  ? 'bg-slate-800 text-white font-semibold border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <span>{item.label}</span>
              {item.badge !== undefined && (
                <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Zone 3: Primary Actions (Offline Toggle, Reset, User, Logout) */}
        <div className="flex items-center gap-2">
          {/* Connectivity Status Indicator */}
          <div
            title={
              isOnline
                ? 'System Online · Real-time synchronization active'
                : `Offline Mode · ${offlineQueueCount} local record(s) queued for sync`
            }
            className={`px-2.5 py-1 text-xs font-mono rounded-lg border transition-all flex items-center gap-1.5 ${
              isOnline
                ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/50'
                : 'bg-amber-950/50 text-amber-300 border-amber-800 animate-pulse'
            }`}
          >
            {isOnline ? (
              <>
                <Wifi className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Online</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5" />
                <span>Offline {offlineQueueCount > 0 && `(${offlineQueueCount})`}</span>
              </>
            )}
          </div>

          {/* Current User Profile & Sign Out */}
          {currentUser && (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
              <div className="hidden sm:block text-right">
                <div className="text-xs font-semibold text-slate-200 truncate max-w-[130px]">
                  {currentUser.name.split(' ')[0]}
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  @{currentUser.username} · {currentUser.role === 'OWNER' ? 'Proprietor' : 'Attendant'}
                </div>
              </div>
              <button
                onClick={onLogout}
                title="Sign Out / Lock Terminal"
                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-red-400 border border-slate-800 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Secondary Tab Navigation */}
      <div className="lg:hidden flex items-center gap-1 overflow-x-auto pt-2 mt-2 border-t border-slate-800/60 no-scrollbar">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === item.id
                ? 'bg-slate-800 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>{item.label}</span>
            {item.badge !== undefined && (
              <span className="px-1.5 py-0.2 rounded-full bg-red-500 text-white text-[10px] font-bold">
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </div>
    </header>
  );
};
