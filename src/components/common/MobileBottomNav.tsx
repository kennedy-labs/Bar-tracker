import React from 'react';
import { User } from '../../types';

interface MobileBottomNavProps {
  currentUser?: User | null;
  activeTab?: string;
  setActiveTab?: (tab: string) => void;
}

/**
 * MobileBottomNav is deprecated: All navigation has been relocated to TopBar
 * for clean, phone-optimized top navigation without blocking screen real estate.
 */
export const MobileBottomNav: React.FC<MobileBottomNavProps> = () => {
  return null;
};
