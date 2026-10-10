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
  User as UserIcon,
  Scale,
} from 'lucide-react';
import { BusinessIdentityBadge } from './BusinessIdentityBadge';
import { EditProfileModal } from './EditProfileModal';
import { WeightCalculatorModal } from './WeightCalculatorModal';

interface TopBarProps {
  currentUser: User | null;
  onLogout: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  pendingDiscrepanciesCount: number;
  onUpdateProfile?: (updatedUser: User) => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentUser,
  onLogout,
  activeTab,
  setActiveTab,
  onUpdateProfile,
}) => {
  const [neonState, setNeonState] = useState<NeonState>(neonService.getStatus());
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isWeightModalOpen, setIsWeightModalOpen] = useState(false);

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
    <header className="sticky top-0 z-40 bg-ink/95 backdrop-blur-md border-b border-line px-4 md:px-6 py-2.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center shrink-0">
          <BusinessIdentityBadge />
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="flex items-center gap-1 sm:gap-2">
          {navItems.map((item) => {
            const isSettingsCategory = ['settings', 'mpesa', 'partners', 'staff', 'database', 'profile'].includes(activeTab);
            const isActive = item.id === 'settings' ? isSettingsCategory : (item.id === 'stock' ? (activeTab === 'stock' || activeTab === 'catalog') : activeTab === item.id);

            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-brand-tint text-content font-semibold'
                    : 'text-muted hover:text-content hover:bg-surface'
                }`}
              >
                <item.icon className={`w-3.5 h-3.5 ${isActive ? 'text-brand-strong' : 'text-faint'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Account & Session Action */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Quick Weight & Keg Scale Valuation Tool */}
          <button
            type="button"
            onClick={() => setIsWeightModalOpen(true)}
            title="Keg & Weight Calculator: Weigh tank on scale to calculate remaining value (e.g. 31kg × KES 150 = KES 4,650)"
            className="flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg text-xs bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-800/60 hover:border-cyan-600/80 text-cyan-300 transition-colors cursor-pointer"
          >
            <Scale className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="font-semibold hidden sm:inline">Scale (kg)</span>
          </button>

          {/* User Profile Button / Edit Credentials Trigger */}
          {currentUser && (
            <button
              type="button"
              onClick={() => setIsProfileModalOpen(true)}
              title="Click to edit name, username, and password/PIN credentials"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-surface hover:bg-surface-2 border border-line hover:border-line-strong text-muted transition-colors cursor-pointer group"
            >
              <UserIcon className="w-3.5 h-3.5 text-brand-strong group-hover:text-brand shrink-0" />
              <span className="font-medium text-content max-w-[110px] sm:max-w-[150px] truncate">
                {currentUser?.name || 'Staff'}
              </span>
              <span className="text-faint hidden sm:inline">·</span>
              <span className="text-[10px] text-muted hidden sm:inline uppercase font-mono">
                {isOwner ? 'Owner' : 'Attendant'}
              </span>
            </button>
          )}

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
              className="text-[11px] font-mono text-muted hover:text-content flex items-center gap-1 cursor-pointer transition-colors"
            >
              {isManualSyncing ? (
                <RefreshCw className="w-3 h-3 text-info animate-spin" />
              ) : neonState.status === 'CONNECTED' ? (
                <span className="w-1.5 h-1.5 rounded-full bg-success" />
              ) : (
                <CloudOff className="w-3 h-3 text-warn" />
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
            className="p-1.5 text-muted hover:text-danger hover:bg-surface-2 rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {currentUser && (
        <EditProfileModal
          currentUser={currentUser}
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          onSuccess={(updated) => {
            if (onUpdateProfile) {
              onUpdateProfile(updated);
            }
          }}
        />
      )}

      {/* Weight & Keg Scale Valuation Modal */}
      <WeightCalculatorModal
        isOpen={isWeightModalOpen}
        onClose={() => setIsWeightModalOpen(false)}
      />
    </header>
  );
};
