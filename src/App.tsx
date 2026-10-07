import React, { useState, useEffect } from 'react';
import { User } from './types';
import { store } from './services/store';
import { authService } from './services/auth';
import { AuthScreen } from './components/auth/AuthScreen';
import { TopBar } from './components/common/TopBar';
import { WorkerTerminal } from './components/worker/WorkerTerminal';
import { OwnerDashboard } from './components/owner/OwnerDashboard';

// Helper to sanitize session user and prevent credential leakage into LocalStorage
const sanitizeSessionUser = (user: User): Partial<User> => {
  return authService.sanitizeUser(user);
};

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

      // First check active cryptographic session token
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

      const saved = localStorage.getItem('bartracker_session_user');
      if (saved) {
        const u = JSON.parse(saved);
        if (u && u.id && u.username) {
          const authenticUser = store.validateSessionUser(u.id, u.username);
          if (authenticUser) {
            if (authenticUser.businessId) {
              store.setCurrentBusiness(authenticUser.businessId);
            }
            return authenticUser;
          }
        }
        localStorage.removeItem('bartracker_session_user');
      }
      return null;
    } catch {
      localStorage.removeItem('bartracker_session_user');
      return null;
    }
  });

  const [activeTab, setActiveTab] = useState<string>(() => {
    try {
      if (typeof window !== 'undefined') {
        const savedTab = sessionStorage.getItem('bartrack_active_tab');
        if (savedTab && ['start', 'counter', 'end_shift', 'history', 'overview', 'shifts', 'stock', 'settings', 'catalog', 'mpesa', 'partners', 'staff'].includes(savedTab)) {
          return savedTab;
        }
      }
      const saved = localStorage.getItem('bartracker_session_user');
      if (saved) {
        const u = JSON.parse(saved);
        if (u && u.id && u.username) {
          const authenticUser = store.validateSessionUser(u.id, u.username);
          if (authenticUser) {
            if (authenticUser.role === 'OWNER') return 'overview';
            const active = store.getActiveShift();
            if (!active) return 'start';
            return active.counterFinished ? 'end_shift' : 'counter';
          }
        }
      }
    } catch {
      // fallback
    }
    return 'start';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('bartrack_active_tab', activeTab);
    }
  }, [activeTab]);

  // Strict route/tab authorization guard: prevent cross-role tab penetration
  useEffect(() => {
    if (!currentUser) return;
    const ownerTabs = ['overview', 'shifts', 'stock', 'settings', 'catalog', 'mpesa', 'partners', 'staff'];
    const workerTabs = ['start', 'counter', 'end_shift', 'history'];

    if (currentUser.role === 'WORKER' && ownerTabs.includes(activeTab)) {
      setActiveTab('start');
    } else if (currentUser.role === 'OWNER' && workerTabs.includes(activeTab)) {
      setActiveTab('overview');
    }
  }, [currentUser, activeTab]);

  // tick triggers re-render whenever store state mutates
  const [, setTick] = useState<number>(0);

  // Initial live cloud synchronization on application launch
  useEffect(() => {
    store.syncWithCloud(true);
  }, []);

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      setTick((t) => t + 1);
      // Auto-detect active shift if worker was on start screen
      const user = authService.getActiveSession();
      if (user?.role === 'WORKER') {
        const active = store.getActiveShift();
        if (active && activeTab === 'start') {
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
    try {
      localStorage.setItem('bartracker_session_user', JSON.stringify(sanitizeSessionUser(authentic)));
    } catch (err) {
      console.error(err);
    }
    // Set appropriate initial tab
    if (authentic.role === 'OWNER') {
      setActiveTab('overview');
    } else {
      const active = store.getActiveShift();
      if (!active) {
        setActiveTab('start');
      } else {
        setActiveTab(active.counterFinished ? 'end_shift' : 'counter');
      }
    }
  };

  const handleLogout = () => {
    authService.destroySession();
    setCurrentUser(null);
    try {
      localStorage.removeItem('bartracker_session_user');
    } catch (err) {
      console.error(err);
    }
    setActiveTab('start');
  };

  const discrepancies = store.getDiscrepancies({ status: 'FLAGGED' });

  // If not logged in, show production Authentication Screen
  if (!currentUser) {
    return <AuthScreen onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex flex-col font-sans">
      {/* Universal Top Bar adhering to Top Bar Contract */}
      <TopBar
        currentUser={currentUser}
        onLogout={handleLogout}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        pendingDiscrepanciesCount={discrepancies.length}
      />

      {/* Main Workspace Body */}
      <main className="flex-1 px-3 py-3 sm:p-4 md:p-6 max-w-7xl mx-auto w-full pb-28 md:pb-12">
        {currentUser.role === 'OWNER' ? (
          <OwnerDashboard
            currentUser={currentUser}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />
        ) : (
          <WorkerTerminal
            currentUser={currentUser}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />
        )}
      </main>
    </div>
  );
}
