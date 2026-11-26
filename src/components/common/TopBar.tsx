import React, { useState, lazy, Suspense } from 'react';
import { User } from '../../types';
import {
  LogOut,
  Layers,
  Activity,
  History,
  ShieldAlert,
  MoreVertical,
  User as UserIcon,
  ArrowLeft,
  UserPlus,
  DollarSign,
} from 'lucide-react';
import { BusinessIdentityBadge } from './BusinessIdentityBadge';
import { PWAInstallButton } from './PWAInstallPrompt';
import { useBackHandler, navigationHistory } from '../../services/navigationHistory';

const LoanModal = lazy(() =>
  import('./LoanModal').then((m) => ({ default: m.LoanModal }))
);

interface TopBarProps {
  currentUser: User | null;
  onLogout: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  pendingDiscrepanciesCount?: number;
  onUpdateProfile?: (updatedUser: User) => void;
  onOpenProfile: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentUser,
  onLogout,
  activeTab,
  setActiveTab,
  pendingDiscrepanciesCount = 0,
  onOpenProfile,
}) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);
  const [showLogoutMenu, setShowLogoutMenu] = useState(false);

  useBackHandler(isSettingsOpen, () => setIsSettingsOpen(false), 'topbar-settings-menu');
  useBackHandler(isProfileMenuOpen, () => setIsProfileMenuOpen(false), 'topbar-profile-menu');
  useBackHandler(isLoanModalOpen, () => setIsLoanModalOpen(false), 'loan-modal');
  useBackHandler(showLogoutMenu, () => setShowLogoutMenu(false), 'topbar-logout-menu');

  const isOwner = currentUser?.role === 'OWNER';

  interface NavItem {
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }

  const ownerNavItems: NavItem[] = [
    { id: 'overview', label: 'Pulse', icon: Activity },
    { id: 'handovers', label: 'Handovers', icon: History },
    { id: 'stock', label: 'Stock & Costs', icon: Layers },
    {
      id: 'discrepancies',
      label: 'Alerts',
      icon: ShieldAlert,
      badge: pendingDiscrepanciesCount > 0 ? pendingDiscrepanciesCount : undefined,
    },
  ];

  const workerNavItems: NavItem[] = [
    { id: 'counter', label: 'Counter', icon: Layers },
  ];

  const navItems = isOwner ? ownerNavItems : workerNavItems;

  const getIsActive = (itemId: string) => {
    if (itemId === 'stock') {
      return activeTab === 'stock' || activeTab === 'catalog';
    }
    if (itemId === 'handovers') {
      return activeTab === 'handovers' || activeTab === 'reports' || activeTab === 'shifts';
    }
    return activeTab === itemId;
  };

  const handleBackClick = () => {
    if (!isOwner || activeTab === 'counter' || !navigationHistory.canGoBack()) {
      setShowLogoutMenu((prev) => !prev);
      return;
    }
    navigationHistory.triggerBack();
  };

  return (
    <>
      <header className="sticky top-0 z-40 h-14 bg-ink/95 backdrop-blur-md border-b border-line px-2.5 sm:px-4 md:px-6 flex items-center pt-safe">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between gap-2">
          {/* Zone 1: Back / Logout Button & Bar Identity */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={handleBackClick}
                className={`min-w-[44px] min-h-[44px] rounded-xl transition-colors cursor-pointer flex items-center justify-center border ${
                  showLogoutMenu
                    ? 'bg-surface-3 text-content border-line-strong'
                    : 'text-muted hover:text-content hover:bg-surface-2 border-line bg-surface'
                }`}
                title="Navigation / Log Out"
                aria-label="Back or Log Out"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>

              {showLogoutMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowLogoutMenu(false)}
                  />
                  <div className="absolute left-0 top-full mt-1.5 z-50 w-44 rounded-xl bg-surface border border-line shadow-2xl py-1 text-xs animate-in fade-in zoom-in-95 duration-100">
                    <button
                      type="button"
                      onClick={() => {
                        setShowLogoutMenu(false);
                        onLogout();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-3 text-danger hover:bg-danger-tint transition-colors text-left cursor-pointer font-semibold"
                    >
                      <LogOut className="w-4 h-4 shrink-0" />
                      <span>Log Out</span>
                    </button>
                  </div>
                </>
              )}
            </div>
            <BusinessIdentityBadge />
          </div>

          {/* Zone 2: Desktop Single-Line Navigation */}
          {navItems.length > 1 && (
            <nav aria-label="Primary Navigation" className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = getIsActive(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={`min-h-[38px] px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-brand-tint text-content font-semibold border border-brand-line'
                        : 'text-muted hover:text-content hover:bg-surface border border-transparent'
                    }`}
                  >
                    <item.icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-brand-strong' : 'text-faint'}`} />
                    <span>{item.label}</span>
                    {item.badge !== undefined && (
                      <span className="font-mono text-[11px] font-bold text-danger tabular-nums ml-0.5">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          )}

          {/* Zone 3: Account & Settings */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {isOwner && activeTab !== 'counter' && <PWAInstallButton compact />}

            {currentUser && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                  className={`flex items-center gap-1.5 px-2.5 min-h-[42px] rounded-xl text-xs transition-colors border select-none cursor-pointer whitespace-nowrap ${
                    isProfileMenuOpen
                      ? 'bg-surface-2 border-brand-line text-content'
                      : 'bg-surface border-line text-muted hover:text-content hover:bg-surface-2'
                  }`}
                  title={`Account: ${currentUser.name}`}
                >
                  <UserIcon className={`w-3.5 h-3.5 shrink-0 ${isProfileMenuOpen ? 'text-brand-strong' : 'text-brand'}`} />
                  <span className="font-medium max-w-[84px] sm:max-w-[160px] truncate">
                    {currentUser.name.replace(/\s*\((?:Proprietor|Procreator|Owner)\)/gi, '').trim()}
                  </span>
                </button>

                {isProfileMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsProfileMenuOpen(false)}
                    />
                    <div className="absolute right-0 top-full mt-1.5 z-50 w-48 rounded-xl bg-surface border border-line shadow-2xl py-1 text-xs animate-in fade-in zoom-in-95 duration-100">
                      {isOwner && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsProfileMenuOpen(false);
                            setActiveTab('staff');
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-3 text-content hover:bg-surface-2 transition-colors text-left cursor-pointer"
                        >
                          <UserPlus className="w-3.5 h-3.5 text-info shrink-0" />
                          <span className="font-medium">Register Attendant</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setIsProfileMenuOpen(false);
                          onOpenProfile();
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-3 text-content hover:bg-surface-2 transition-colors text-left cursor-pointer ${isOwner ? 'border-t border-line-soft' : ''}`}
                      >
                        <UserIcon className="w-3.5 h-3.5 text-brand-strong shrink-0" />
                        <span className="font-medium">My Profile</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="relative">
              <button
                type="button"
                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                title="More"
                className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl transition-colors cursor-pointer ${
                  isSettingsOpen
                    ? 'bg-surface-2 text-content'
                    : 'text-muted hover:text-content hover:bg-surface-2'
                }`}
                aria-label="More Options"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {isSettingsOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsSettingsOpen(false)}
                  />

                  <div className="absolute right-0 top-full mt-1.5 z-50 w-44 rounded-xl bg-surface border border-line shadow-2xl py-1 text-xs animate-in fade-in zoom-in-95 duration-100">
                    <button
                      type="button"
                      onClick={() => {
                        setIsSettingsOpen(false);
                        setIsLoanModalOpen(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-3 text-content hover:bg-surface-2 transition-colors text-left cursor-pointer"
                    >
                      <DollarSign className="w-3.5 h-3.5 text-brand-strong shrink-0" />
                      <span className="font-medium">Loans</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Fixed Bottom Navigation Bar (Owner only, <= 58px + safe area) */}
      {isOwner && navItems.length > 1 && (
        <nav
          aria-label="Mobile Navigation"
          className="md:hidden fixed bottom-0 inset-x-0 z-40 min-h-[56px] pb-safe bg-ink/95 backdrop-blur-md border-t border-line px-1.5 py-1 flex items-center justify-around gap-1"
        >
          {navItems.map((item) => {
            const isActive = getIsActive(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`relative flex-1 min-h-[44px] px-1 text-[11px] font-medium rounded-xl transition-colors flex flex-col items-center justify-center gap-0.5 cursor-pointer whitespace-nowrap active:scale-95 ${
                  isActive
                    ? 'text-brand-strong bg-brand-tint/60 font-semibold'
                    : 'text-muted hover:text-content'
                }`}
              >
                <div className="relative">
                  <item.icon className="w-4 h-4 shrink-0" />
                  {item.badge !== undefined && (
                    <span className="absolute -top-1.5 -right-2.5 font-mono text-[10px] font-bold text-danger tabular-nums">
                      {item.badge}
                    </span>
                  )}
                </div>
                <span className="truncate max-w-full">{item.id === 'stock' ? 'Stock' : item.label}</span>
              </button>
            );
          })}
        </nav>
      )}

      {isLoanModalOpen && (
        <Suspense fallback={null}>
          <LoanModal
            isOpen={isLoanModalOpen}
            onClose={() => setIsLoanModalOpen(false)}
          />
        </Suspense>
      )}
    </>
  );
};

