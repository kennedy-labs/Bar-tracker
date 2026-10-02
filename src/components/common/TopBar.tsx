import React from 'react';
import { User } from '../../types';
import { store } from '../../services/store';
import {
  Wine,
  LogOut,
  Wifi,
  WifiOff,
  LayoutDashboard,
  Clock,
  Building2,
  Users,
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
    { id: 'catalog', label: 'Drinks & Stock', icon: Wine },
    {
      id: 'partners',
      label: 'Partner Bars',
      icon: Building2,
      badge: incomingTransfersCount > 0 ? incomingTransfersCount : undefined,
    },
    { id: 'staff', label: 'Staff PINs', icon: Users },
  ];

  const workerNavItems: NavItem[] = [
    {
      id: 'counter',
      label: 'My Shift',
      icon: Wine,
      badge: incomingTransfersCount > 0 ? incomingTransfersCount : undefined,
    },
    { id: 'history', label: 'Past Shifts', icon: Clock },
  ];

  const navItems: NavItem[] = currentUser?.role === 'OWNER' ? ownerNavItems : workerNavItems;

  return (
    <>
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
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`px-3 py-2 text-xs font-semibold rounded-xl transition-colors whitespace-nowrap flex items-center gap-2 cursor-pointer ${
                    activeTab === item.id
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                  {item.badge !== undefined && (
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
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex-1 py-1.5 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer relative ${
                isActive ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'text-emerald-400 scale-110' : 'text-slate-400'}`} />
                {item.badge !== undefined && (
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
