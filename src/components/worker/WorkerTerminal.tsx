import React, { useState } from 'react';
import { User } from '../../types';
import { GuidedCounterWorkspace } from './GuidedCounterWorkspace';
import { StartScreen } from './StartScreen';

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
  const [openWizardOnEnter, setOpenWizardOnEnter] = useState(false);

  if (activeTab === 'start') {
    return (
      <StartScreen
        currentUser={currentUser}
        onStartShift={() => {
          setOpenWizardOnEnter(false);
          setActiveTab('counter');
        }}
        onGoToCounter={() => {
          setOpenWizardOnEnter(false);
          setActiveTab('counter');
        }}
        onGoToEndShift={() => {
          setOpenWizardOnEnter(true);
          setActiveTab('counter');
        }}
      />
    );
  }

  return (
    <GuidedCounterWorkspace
      currentUser={currentUser}
      initialOpenWizard={openWizardOnEnter}
    />
  );
};
