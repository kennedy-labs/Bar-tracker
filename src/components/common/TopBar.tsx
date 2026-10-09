import React, { useState, useEffect } from 'react';
import { User } from '../../types';
import { store } from '../../services/store';
import { neonService, NeonState } from '../../services/neon';
import {
  LogOut,
  Layers,
  Clock,
  LayoutDashboard,
  SlidersHorizontal,
  RefreshCw,
  Database,
  CloudOff,
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
}) => {
  const [neonState, setNeonState] = useState<NeonState>(neonService.getStatus());
  const [isManualSyncing, setIsManualSyncing] = useState(false);

  useEffect(() => {
    return neonService.subscribeStatus((st) => setNeonState(st));
  }, []);

  const handleManualSync = async () => {
    if (isManualSyncing) return;
    setIsManualSyncing(true);
    try {
      await store.uploadAllToNeon();
    } catch {
      // silent
    } finally {
      setIsManualSyncing(false);
    }
  };

  const isOwner = currentUser?.role === 'OWNER';

  interface NavItem {
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }

  const ownerNavItems: NavItem[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'stock', label: 'Stock Audit', icon: Layers },
    { id: 'settings', label: 'Bar Setup', icon: SlidersHorizontal },
  ];

  const workerNavItems: NavItem[] = [
    { id: 'counter', label: 'Counter Sheet', icon: Layers },
    { id: 'history', label: 'Past Shifts', icon: Clock },
  ];

  const navItems = isOwner ? ownerNavItems : workerNavItems;

  return (
    <header className="sticky top-0 z-40 bg-[#0B0F17]/95 backdrop-blur-md border-b border-[#1E2638] px-4 md:px-6 py-2.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center shrink-0">
          <BusinessIdentityBadge />
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="flex items-center gap-1 sm:gap-2">
          {navItems.map((item) => {
            const isSettingsCategory = ['settings', 'catalog', 'mpesa', 'partners', 'staff'].includes(activeTab);
            const isActive = item.id === 'settings' ? isSettingsCategory : activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-[#161F30] text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#121824]'
                }`}
              >
                <item.icon className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-400' : 'text-slate-500'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Account & Session Action */}
        <div className="flex items-center gap-3 shrink-0">
          {/* User Identifier */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400">
            <span className="font-medium text-slate-200">{currentUser?.name || 'Staff'}</span>
            <span className="text-slate-600">·</span>
            <span className="text-[11px] text-slate-500">{isOwner ? 'Owner' : 'Attendant'}</span>
          </div>

          {/* Quiet Sync Indicator for Owner */}
          {isOwner && (
            <button
              onClick={handleManualSync}
              disabled={isManualSyncing}
              title={
                neonState.status === 'CONNECTED'
                  ? 'Cloud Synced with Neon PostgreSQL'
                  : 'Click to trigger cloud synchronization'
              }
              className="text-[11px] font-mono text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer transition-colors"
            >
              {isManualSyncing ? (
                <RefreshCw className="w-3 h-3 text-cyan-400 animate-spin" />
              ) : neonState.status === 'CONNECTED' ? (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              ) : (
                <CloudOff className="w-3 h-3 text-amber-400" />
              )}
              <span className="hidden md:inline">
                {isManualSyncing ? 'Syncing...' : 'Synced'}
              </span>
            </button>
          )}

          {/* Clean Logout */}
          <button
            onClick={onLogout}
            title="Sign out of system"
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-[#151D2C] rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
