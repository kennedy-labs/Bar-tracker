import React, { useState, useEffect } from 'react';
import { User } from './types';
import { store } from './services/store';
import { authService } from './services/auth';
import { AuthScreen } from './components/auth/AuthScreen';
import { TopBar } from './components/common/TopBar';
import { WorkerTerminal } from './components/worker/WorkerTerminal';
import { OwnerDashboard } from './components/owner/OwnerDashboard';
import { EditProfileModal } from './components/common/EditProfileModal';


import { navigationHistory } from './services/navigationHistory';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      if (typeof window !== 'undefined') {
        const path = window.location.pathname.toLowerCase();
        const hash = window.location.hash.toLowerCase();
        const search = window.location.search.toLowerCase();
        if (
          path.includes('signup') ||
          path.includes('register') ||
          hash.includes('signup') ||
          hash.includes('register') ||
          search.includes('signup') ||
          search.includes('register')
        ) {
          return null;
        }
      }

      // Check active in-memory session
      const session = authService.getActiveSession();
      if (session && session.userId && session.username) {
        const authenticUser = store.validateSessionUser(session.userId, session.username);
        if (authenticUser) {
          if (authenticUser.businessId) {
            store.setCurrentBusiness(authenticUser.businessId);
          }
          return authenticUser;
        }
      }
      return null;
    } catch {
      return null;
    }
  });

  const [activeTab, setActiveTab] = useState<string>(() => {
    try {
      const saved = sessionStorage.getItem('bar_tracker_active_tab');
      if (saved) return saved;
    } catch {
      // ignore
    }
    const session = authService.getActiveSession();
    if (session?.role === 'OWNER') return 'overview';
    return 'start';
  });

  const handleTabChange = (newTab: string) => {
    if (newTab !== activeTab) {
      navigationHistory.pushTab(newTab);
      setActiveTab(newTab);
      try {
        sessionStorage.setItem('bar_tracker_active_tab', newTab);
      } catch {
        // ignore
      }
    }
  };

  const handleLogout = () => {
    authService.destroySession();
    store.clearActiveSessionCache();
    setCurrentUser(null);
    handleTabChange('start');
  };

  const handleLogin = (user: User) => {
    // Re-verify authoritative user
    const authentic = store.validateSessionUser(user.id, user.username) || user;
    setCurrentUser(authentic);
    if (authentic.businessId) {
      store.setCurrentBusiness(authentic.businessId);
    }
    authService.createSession(authentic);
    // Set appropriate initial tab
    if (authentic.role === 'OWNER') {
      handleTabChange('overview');
    } else {
      handleTabChange('counter');
    }
  };

  const handleUpdateProfile = (updatedUser: User) => {
    setCurrentUser(updatedUser);
    authService.createSession(updatedUser);
  };

  // Connect tab changes with phone back-button navigation

  // tick triggers re-render whenever store state mutates
  const [, setTick] = useState<number>(0);
  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      setTick((t) => t + 1);
    });
    return unsubscribe;
  }, []);

  // Connect tab changes with phone back-button navigation
  useEffect(() => {
    navigationHistory.setInitialTab(activeTab);
    const unsub = navigationHistory.subscribeTabChange((prevTab) => {
      setActiveTab(prevTab);
      try {
        sessionStorage.setItem('bar_tracker_active_tab', prevTab);
      } catch {
        // ignore
      }
    });
    return unsub;
  }, []);

  // Strict route/tab authorization guard: prevent cross-role tab penetration
  useEffect(() => {
    if (!currentUser) return;

    // Asynchronous Authoritative Role Verification
    // Prevents local storage role escalation / tampering
    const verifyUser = async () => {
      const authoritative = await store.verifyAuthoritativeUser(currentUser.id);
      if (!authoritative || authoritative.isArchived) {
        handleLogout();
        return;
      }
      if (authoritative.role !== currentUser.role) {
        // Role mismatch: update state and session to authoritative record
        setCurrentUser(authoritative);
        authService.createSession(authoritative);
      }
    };
    verifyUser();

    const ownerTabs = [
      'overview',
      'shifts',
      'stock',
      'settings',
      'catalog',
      'partners',
      'staff',
      'profile',
      'launch',
    ];
    const workerTabs = ['counter', 'history'];

    if (currentUser.role === 'WORKER' && !workerTabs.includes(activeTab)) {
      handleTabChange('counter');
    } else if (currentUser.role === 'OWNER' && (workerTabs.includes(activeTab) || activeTab === 'mpesa')) {
      handleTabChange('overview');
    }
  }, [currentUser, activeTab]);

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const discrepancies = store.getDiscrepancies({ status: 'FLAGGED' });

  // If not logged in, show production Authentication Screen
  if (!currentUser) {
    return <AuthScreen onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-ink text-content flex flex-col font-sans">
      {/* Universal Top Bar adhering to Top Bar Contract */}
      <TopBar
        currentUser={currentUser}
        onLogout={handleLogout}
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        pendingDiscrepanciesCount={discrepancies.length}
        onUpdateProfile={handleUpdateProfile}
        onOpenProfile={() => setIsProfileModalOpen(true)}
      />

      {/* Main Workspace Body */}
      <main className="flex-1 px-3 py-3 sm:p-4 md:p-6 max-w-7xl mx-auto w-full pb-8 md:pb-12">
        {currentUser.role === 'OWNER' ? (
          <OwnerDashboard
            currentUser={currentUser}
            activeTab={activeTab}
            setActiveTab={handleTabChange}
            onUpdateProfile={handleUpdateProfile}
          />
        ) : (
          <WorkerTerminal
            currentUser={currentUser}
            activeTab={activeTab}
            setActiveTab={handleTabChange}
          />
        )}
      </main>

      {/* Root-Level Edit Profile Modal (Ensures it appears on top of all workspace lists & content) */}
      <EditProfileModal
        currentUser={currentUser}
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        onLogout={handleLogout}
        onSuccess={(updated) => {
          handleUpdateProfile(updated);
        }}
      />
    </div>
  );
}
