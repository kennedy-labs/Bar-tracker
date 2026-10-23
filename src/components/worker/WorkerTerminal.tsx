import React from 'react';
import { User } from '../../types';
import { UnifiedStockLedger } from './UnifiedStockLedger';
import { StartScreen } from './StartScreen';
import { store } from '../../services/store';

interface WorkerTerminalProps {
  currentUser: User;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const WorkerTerminal: React.FC<WorkerTerminalProps> = ({
  currentUser,
  activeTab,
  setActiveTab,
}) => {
  const activeShift = store.getActiveShift();

  if (activeTab === 'start') {
    return (
      <StartScreen
        currentUser={currentUser}
        onStartShift={() => setActiveTab('counter')}
        onGoToCounter={() => setActiveTab('counter')}
        onGoToEndShift={() => setActiveTab('counter')} // It handles internal redirection
      />
    );
  }

  return (
    <UnifiedStockLedger
      currentUser={currentUser}
    />
  );
};
