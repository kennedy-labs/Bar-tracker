import React, { useState, useEffect } from 'react';
import { User } from '../../types';
import { store } from '../../services/store';
import { firestoreSync, FirestoreSyncStatus } from '../../services/firestoreSync';
import {
  Wine,
  LogOut,
  Wifi,
  WifiOff,
  LayoutDashboard,
  Clock,
  Building2,
  Users,
  PlayCircle,
  ClipboardCheck,
  Layers,
  Lock,
  Smartphone,
  Cloud,
  CloudOff,
  RefreshCw,
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
}) => {
  const [blockedToast, setBlockedToast] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<FirestoreSyncStatus>(firestoreSync.getStatus());
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [syncToast, setSyncToast] = useState<string | null>(null);

  useEffect(() => {
    return firestoreSync.subscribeStatus((st) => setSyncStatus(st));
  }, []);

  const handleManualSync = async () => {
    if (isManualSyncing) return;
    setIsManualSyncing(true);
    setSyncToast('Uploading local data to Firestore...');
    try {
      const res = await store.uploadAllToFirestore();
      setSyncToast(res.message);
      setTimeout(() => setSyncToast(null), 4000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setSyncToast(`Sync failed: ${message}`);
      setTimeout(() => setSyncToast(null), 4000);
    } finally {
      setIsManualSyncing(false);
    }
  };

  const isOnline = store.isOnline();
  const incomingTransfersCount = store.getPendingIncomingTransfers().length;

  interface NavItem {
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }

  const ownerNavItems: NavItem[] = [
    { id: 'overview', label: 'Summary', icon: LayoutDashboard },
    { id: 'shifts', label: 'Shifts', icon: Clock },
    { id: 'stock', label: 'Stock', icon: Layers },
    {
      id: 'settings',
      label: 'Bar Setup',
      icon: SlidersHorizontal,
      badge: incomingTransfersCount > 0 ? incomingTransfersCount : undefined,
    },
  ];

  const workerNavItems: NavItem[] = [
    { id: 'start', label: 'Start Screen', icon: PlayCircle },
    {
      id: 'counter',
      label: 'Active Counter',
      icon: Wine,
      badge: incomingTransfersCount > 0 ? incomingTransfersCount : undefined,
    },
    { id: 'end_shift', label: 'End of Shift', icon: ClipboardCheck },
    { id: 'history', label: 'Past Shifts', icon: Clock },
  ];

  const isWorker = currentUser?.role !== 'OWNER';
  const activeShift = store.getActiveShift();

  // Progressive work routine lock checks for workers
  const checkTabLockStatus = (tabId: string): { isLocked: boolean; reason?: string } => {
    if (!isWorker) return { isLocked: false };
    if (tabId === 'history') return { isLocked: false };

    if (!activeShift) {
      if (tabId === 'counter') {
        return { isLocked: true, reason: 'Open a shift first to access the Active Counter.' };
      }
      if (tabId === 'end_shift') {
        return { isLocked: true, reason: 'Open a shift and serve on the counter before ending a shift.' };
      }
      return { isLocked: false };
    }

    // Active shift in progress
    if (tabId === 'end_shift' && !activeShift.counterFinished) {
      return {
        isLocked: true,
        reason: 'Work routine is progressive. Finish the Active Counter at the bottom of the page before proceeding to End of Shift.',
      };
    }

    return { isLocked: false };
  };

  const handleNavClick = (tabId: string) => {
    const ownerTabs = ['overview', 'shifts', 'stock', 'settings', 'catalog', 'mpesa', 'partners', 'staff'];
    if (currentUser?.role !== 'OWNER' && ownerTabs.includes(tabId)) {
      setBlockedToast('Access Denied: Owner credentials required for this section.');
      setTimeout(() => setBlockedToast(null), 4000);
      return;
    }

    const { isLocked, reason } = checkTabLockStatus(tabId);
    if (isLocked) {
      setBlockedToast(reason || 'This step is locked. Follow the work routine progressively.');
      setTimeout(() => setBlockedToast(null), 4000);
      return;
    }
    setActiveTab(tabId);
  };

  const navItems: NavItem[] = currentUser?.role === 'OWNER' ? ownerNavItems : workerNavItems;

  return (
    <>
      {/* Blocked Toast Alert */}
      {blockedToast && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-amber-950/95 border border-amber-500 text-amber-200 text-xs font-semibold shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top duration-200 max-w-md text-center">
          <Lock className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{blockedToast}</span>
        </div>
      )}

      {/* Cloud Sync Toast Alert */}
      {syncToast && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-slate-900/95 border border-emerald-500 text-emerald-200 text-xs font-semibold shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top duration-200 max-w-md text-center">
          <Cloud className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{syncToast}</span>
        </div>
      )}

      {/* Top Header Bar */}
      <header className="sticky top-0 z-40 bg-[#0B0F17]/95 backdrop-blur-md border-b border-[#1E293B] px-3.5 md:px-6 py-2.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Bar Identity */}
          <div className="flex items-center gap-2">
            <BusinessIdentityBadge />
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const { isLocked, reason } = checkTabLockStatus(item.id);
              const isSettingsCategory = ['settings', 'catalog', 'mpesa', 'partners', 'staff'].includes(activeTab);
              const isActive = item.id === 'settings' ? isSettingsCategory : activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  title={isLocked ? reason : item.label}
                  className={`px-3 py-2 text-xs font-semibold rounded-xl transition-all whitespace-nowrap flex items-center gap-2 ${
                    isLocked
                      ? 'opacity-40 cursor-not-allowed text-slate-500 bg-slate-900/30'
                      : isActive
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold cursor-pointer'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 cursor-pointer'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                  {isLocked && <Lock className="w-3 h-3 text-slate-500 shrink-0" />}
                  {item.badge !== undefined && !isLocked && (
                    <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right: Connectivity & Logout */}
          <div className="flex items-center gap-2">
            {/* Cloud Sync Status */}
            <button
              onClick={currentUser?.role === 'OWNER' ? handleManualSync : undefined}
              title={
                currentUser?.role === 'OWNER'
                  ? 'Click to sync all local data to Firestore Cloud'
                  : 'Firestore Cloud Sync Active'
              }
              disabled={isManualSyncing}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] transition-all ${
                currentUser?.role === 'OWNER' ? 'cursor-pointer hover:border-slate-700' : 'cursor-default'
              } ${
                syncStatus.isSyncing || isManualSyncing
                  ? 'bg-amber-950/30 border-amber-600/50 text-amber-300'
                  : syncStatus.error
                  ? 'bg-red-950/30 border-red-600/50 text-red-300'
                  : 'bg-[#0E1420] border-slate-800 text-slate-300'
              }`}
            >
              {syncStatus.isSyncing || isManualSyncing ? (
                <>
                  <RefreshCw className="w-3 h-3 text-amber-400 animate-spin" />
                  <span className="text-[10px] text-amber-300 font-medium">Syncing...</span>
                </>
              ) : syncStatus.error ? (
                <>
                  <CloudOff className="w-3 h-3 text-red-400" />
                  <span className="text-[10px] text-red-300 font-medium">Sync Issue</span>
                </>
              ) : (
                <>
                  <Cloud className="w-3 h-3 text-emerald-400" />
                  <span className="text-[10px] text-emerald-300 font-medium">
                    {currentUser?.role === 'OWNER' ? 'Cloud Sync' : 'Live'}
                  </span>
                </>
              )}
            </button>

            {/* Simple Connection Dot */}
            <div
              title={isOnline ? 'Online' : 'Offline'}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#0E1420] border border-slate-800 text-[11px] text-slate-300"
            >
              {isOnline ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span className="hidden sm:inline text-slate-400 text-[10px]">Online</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                  <span className="text-amber-400 text-[10px]">Offline</span>
                </>
              )}
            </div>

            {/* Current User & Logout */}
            {currentUser && (
              <div className="flex items-center gap-2 pl-1.5 border-l border-slate-800">
                <div className="text-right">
                  <div className="text-xs font-bold text-slate-200 truncate max-w-[100px] sm:max-w-[130px]">
                    {currentUser.name.split(' ')[0]}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {currentUser.role === 'OWNER' ? 'Owner' : 'Bartender'}
                  </div>
                </div>
                <button
                  onClick={onLogout}
                  title="Sign Out"
                  className="p-2 rounded-xl bg-slate-900 hover:bg-red-950/60 text-slate-400 hover:text-red-400 border border-slate-800 hover:border-red-800/80 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Fixed Bottom Navigation Bar (Ultra-Simple for Phone Thumbs) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0B0F17]/98 backdrop-blur-lg border-t border-[#1E293B] px-2 py-1.5 flex items-center justify-around shadow-2xl">
        {navItems.map((item) => {
          const Icon = item.icon;
          const { isLocked, reason } = checkTabLockStatus(item.id);
          const isSettingsCategory = ['settings', 'catalog', 'mpesa', 'partners', 'staff'].includes(activeTab);
          const isActive = item.id === 'settings' ? isSettingsCategory : activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              title={isLocked ? reason : item.label}
              className={`flex-1 py-1.5 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all relative ${
                isLocked
                  ? 'opacity-35 cursor-not-allowed text-slate-600'
                  : isActive
                  ? 'text-emerald-400 font-bold cursor-pointer'
                  : 'text-slate-400 hover:text-slate-200 cursor-pointer'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'text-emerald-400 scale-110' : 'text-slate-400'}`} />
                {isLocked && (
                  <span className="absolute -top-1 -right-2 w-3.5 h-3.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400 flex items-center justify-center">
                    <Lock className="w-2 h-2" />
                  </span>
                )}
                {item.badge !== undefined && !isLocked && (
                  <span className="absolute -top-1 -right-2 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] tracking-tight">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
