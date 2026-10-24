import React, { useState } from 'react';
import { User } from '../../types';
import {
  LogOut,
  Layers,
  Clock,
  History,
  LayoutDashboard,
  MoreVertical,
  User as UserIcon,
  RefreshCw,
  FileText,
  ArrowLeft,
  UserPlus,
} from 'lucide-react';
import { BusinessIdentityBadge } from './BusinessIdentityBadge';
import { EditProfileModal } from './EditProfileModal';
import { PWAInstallButton } from './PWAInstallPrompt';
import { useBackHandler, navigationHistory } from '../../services/navigationHistory';

interface TopBarProps {
  currentUser: User | null;
  onLogout: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  pendingDiscrepanciesCount?: number;
  onUpdateProfile?: (updatedUser: User) => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentUser,
  onLogout,
  activeTab,
  setActiveTab,
  onUpdateProfile,
}) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Close settings menu and profile modal on phone back navigation
  useBackHandler(isSettingsOpen, () => setIsSettingsOpen(false), 'topbar-settings-menu');
  useBackHandler(isProfileMenuOpen, () => setIsProfileMenuOpen(false), 'topbar-profile-menu');
  useBackHandler(isProfileModalOpen, () => setIsProfileModalOpen(false), 'edit-profile-modal');

  const isOwner = currentUser?.role === 'OWNER';

  interface NavItem {
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }

  const ownerNavItems: NavItem[] = [
    { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'stock', label: 'Stock', icon: Layers },
    { id: 'reports', label: 'Reports', icon: FileText },
  ];

  const workerNavItems: NavItem[] = [
    { id: 'counter', label: 'Counter', icon: Layers },
  ];

  const navItems = isOwner ? ownerNavItems : workerNavItems;

  const getIsActive = (itemId: string) => {
    if (itemId === 'stock') {
      return activeTab === 'stock' || activeTab === 'catalog';
    }
    return activeTab === itemId;
  };

  return (
    <header className="sticky top-0 z-40 bg-ink/95 backdrop-blur-md border-b border-line px-3 sm:px-4 md:px-6 py-2.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Zone 1: Universal Back / Undo Button & Bar Name */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => navigationHistory.triggerBack()}
            className="p-1.5 -ml-1 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 active:scale-90 transition-all cursor-pointer flex items-center justify-center border border-slate-700/60 bg-[#121824]"
            title="Back / Undo (Previous Page)"
            aria-label="Back / Undo"
          >
            <ArrowLeft className="w-4 h-4 text-slate-200" />
          </button>
          <BusinessIdentityBadge />
        </div>

        {/* Zone 2: Navigation Links (Desktop) */}
        <nav className="hidden md:flex items-center gap-1 sm:gap-2">
          {navItems.map((item) => {
            const isActive = getIsActive(item.id);

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

        {/* Zone 3: Read-Only Owner Name & 3-Dot Settings Menu */}
        <div className="flex items-center gap-2 shrink-0">
          {/* PWA Install Button (Header) */}
          <div className="hidden sm:block">
            <PWAInstallButton />
          </div>

          {/* Interactive Profile Icon & Owner/User Name Label */}
          {currentUser && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all border select-none cursor-pointer ${
                  isProfileMenuOpen
                    ? 'bg-surface-2 border-brand-tint text-content'
                    : 'bg-surface border-line text-muted hover:text-content hover:bg-surface-2'
                }`}
                title={`Account: ${currentUser.name}`}
              >
                <UserIcon className={`w-3.5 h-3.5 shrink-0 ${isProfileMenuOpen ? 'text-brand-strong' : 'text-brand-strong/60'}`} />
                <span className="font-medium max-w-[120px] sm:max-w-[160px] truncate">
                  {currentUser.name.replace(/\s*\((?:Proprietor|Procreator|Owner)\)/gi, '').trim()}
                </span>
              </button>

              {/* Profile Context Dropdown */}
              {isProfileMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsProfileMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-1.5 z-50 w-48 rounded-xl bg-[#121824] border border-[#1E293B] shadow-2xl py-1 text-xs animate-in fade-in zoom-in-95 duration-100">
                    {isOwner && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsProfileMenuOpen(false);
                          setActiveTab('staff');
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-slate-200 hover:text-white hover:bg-slate-800 transition-colors text-left cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                        <span className="font-medium">Register Attendant</span>
                      </button>
                    )}
                    
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        setIsProfileModalOpen(true);
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-slate-200 hover:text-white hover:bg-slate-800 transition-colors text-left cursor-pointer ${isOwner ? 'border-t border-slate-800' : ''}`}
                    >
                      <UserIcon className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="font-medium">My Profile</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Settings Trigger: Three Vertical Dots (in logout position) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              title="Settings"
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                isSettingsOpen
                  ? 'bg-surface-2 text-content'
                  : 'text-muted hover:text-content hover:bg-surface-2'
              }`}
              aria-label="Settings"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {/* Settings Dropdown: ONLY TWO ITEMS (My Profile, Log Out) */}
            {isSettingsOpen && (
              <>
                {/* Backdrop to close on tap outside */}
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsSettingsOpen(false)}
                />

                <div className="absolute right-0 top-full mt-1.5 z-50 w-44 rounded-xl bg-[#121824] border border-[#1E293B] shadow-2xl py-1 text-xs animate-in fade-in zoom-in-95 duration-100">
                  <button
                    type="button"
                    onClick={() => {
                      setIsSettingsOpen(false);
                      window.location.reload();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-slate-200 hover:text-white hover:bg-slate-800 transition-colors text-left cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <span className="font-medium">Refresh App</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsSettingsOpen(false);
                      onLogout();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-red-400 hover:text-red-300 hover:bg-red-950/30 transition-colors text-left cursor-pointer border-t border-slate-800"
                  >
                    <LogOut className="w-3.5 h-3.5 text-red-400 shrink-0" />
                    <span className="font-medium">Log Out</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Phone Navigation Bar (Moved to Top Bar for mobile phones) */}
      <nav aria-label="Mobile Top Navigation" className="md:hidden mt-2 pt-2 border-t border-line/60 flex items-center justify-around gap-1.5">
        {navItems.map((item) => {
          const isActive = getIsActive(item.id);

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                isActive
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-surface border border-transparent'
              }`}
            >
              <item.icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-emerald-400' : 'text-slate-500'}`} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Edit Profile Modal Triggered from Settings */}
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
    </header>
  );
};
