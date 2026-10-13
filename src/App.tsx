import React, { useState, useEffect } from 'react';
import { User } from './types';
import { store } from './services/store';
import { authService } from './services/auth';
import { AuthScreen } from './components/auth/AuthScreen';
import { TopBar } from './components/common/TopBar';
import { MobileBottomNav } from './components/common/MobileBottomNav';
import { WeightCalculatorModal } from './components/common/WeightCalculatorModal';
import { WorkerTerminal } from './components/worker/WorkerTerminal';
import { OwnerDashboard } from './components/owner/OwnerDashboard';


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
    const session = authService.getActiveSession();
    if (session?.role === 'OWNER') return 'overview';
    return 'counter';
  });

  // Strict route/tab authorization guard: prevent cross-role tab penetration
  useEffect(() => {
    if (!currentUser) return;
    const ownerTabs = [
      'overview',
      'shifts',
      'stock',
      'settings',
      'catalog',
      'mpesa',
      'partners',
      'staff',
      'profile',
    ];
    const workerTabs = ['counter', 'history'];

    if (currentUser.role === 'WORKER' && !workerTabs.includes(activeTab)) {
      setActiveTab('counter');
    } else if (currentUser.role === 'OWNER' && workerTabs.includes(activeTab)) {
      setActiveTab('overview');
    }
  }, [currentUser, activeTab]);

  // tick triggers re-render whenever store state mutates
  const [, setTick] = useState<number>(0);

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      setTick((t) => t + 1);
      // Auto-guard worker to counter sheet or history
      const user = authService.getActiveSession();
      if (user?.role === 'WORKER') {
        if (activeTab !== 'counter' && activeTab !== 'history') {
          setActiveTab('counter');
        }
      }
    });
    return unsubscribe;
  }, [activeTab]);

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash.includes('signup') || hash.includes('register')) {
        setCurrentUser(null);
      }
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

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
      setActiveTab('overview');
    } else {
      setActiveTab('counter');
    }
  };

  const handleLogout = () => {
    authService.destroySession();
    store.clearActiveSessionCache();
    setCurrentUser(null);
    setActiveTab('start');
  };

  const handleUpdateProfile = (updatedUser: User) => {
    setCurrentUser(updatedUser);
    authService.createSession(updatedUser);
  };

  const discrepancies = store.getDiscrepancies({ status: 'FLAGGED' });
  const [isMobileScaleOpen, setIsMobileScaleOpen] = useState(false);

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
        setActiveTab={setActiveTab}
        pendingDiscrepanciesCount={discrepancies.length}
        onUpdateProfile={handleUpdateProfile}
      />

      {/* Main Workspace Body */}
      <main className="flex-1 px-3 py-3 sm:p-4 md:p-6 max-w-7xl mx-auto w-full pb-28 md:pb-12">
        {currentUser.role === 'OWNER' ? (
          <OwnerDashboard
            currentUser={currentUser}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            onUpdateProfile={handleUpdateProfile}
          />
        ) : (
          <WorkerTerminal
            currentUser={currentUser}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />
        )}
      </main>

      {/* Mobile Sticky Bottom Navigation (Android / Mobile viewports) */}
      <MobileBottomNav
        currentUser={currentUser}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenScaleModal={() => setIsMobileScaleOpen(true)}
      />

      {/* Global Weight Calculator Modal triggered from Mobile Navigation */}
      <WeightCalculatorModal
        isOpen={isMobileScaleOpen}
        onClose={() => setIsMobileScaleOpen(false)}
      />
    </div>
  );
}
