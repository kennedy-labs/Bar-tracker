import React from 'react';
import { User } from '../../types';
import {
  LayoutDashboard,
  Layers,
  SlidersHorizontal,
  Clock,
  Scale,
} from 'lucide-react';
import { PWAInstallButton } from './PWAInstallPrompt';

interface MobileBottomNavProps {
  currentUser: User | null;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenScaleModal: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentUser,
  activeTab,
  setActiveTab,
  onOpenScaleModal,
}) => {
  if (!currentUser) return null;

  const isOwner = currentUser.role === 'OWNER';

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
    { id: 'counter', label: 'Counter', icon: Layers },
    { id: 'history', label: 'History', icon: Clock },
  ];

  const navItems = isOwner ? ownerNavItems : workerNavItems;

  return (
    <nav
      aria-label="Mobile Navigation"
      className="fixed bottom-0 inset-x-0 z-40 bg-[#0B0F17]/95 backdrop-blur-lg border-t border-[#1E2638] px-3 py-1.5 md:hidden flex items-center justify-around gap-1 shadow-lg"
    >
      {navItems.map((item) => {
        const isSettingsCategory = ['settings', 'mpesa', 'partners', 'staff', 'database', 'profile'].includes(activeTab);
        const isActive =
          item.id === 'settings'
            ? isSettingsCategory
            : item.id === 'stock'
            ? activeTab === 'stock' || activeTab === 'catalog'
            : activeTab === item.id;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-all cursor-pointer ${
              isActive
                ? 'text-emerald-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <item.icon className={`w-5 h-5 mb-0.5 ${isActive ? 'text-emerald-400' : 'text-slate-500'}`} />
            <span className="text-[10px] tracking-tight">{item.label}</span>
          </button>
        );
      })}

      {/* Quick Keg/Weight Scale Tool on Mobile */}
      <button
        type="button"
        onClick={onOpenScaleModal}
        className="flex flex-col items-center justify-center flex-1 py-1 text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
        title="Weigh tank on scale"
      >
        <Scale className="w-5 h-5 mb-0.5 text-cyan-400" />
        <span className="text-[10px] tracking-tight font-medium">Scale (kg)</span>
      </button>

      {/* Mobile Install App Button */}
      <div className="flex flex-col items-center justify-center px-1">
        <PWAInstallButton compact />
      </div>
    </nav>
  );
};
