import React, { useState, useEffect } from 'react';
import { User } from './types';
import { store } from './services/store';
import { AuthScreen } from './components/auth/AuthScreen';
import { TopBar } from './components/common/TopBar';
import { WorkerTerminal } from './components/worker/WorkerTerminal';
import { OwnerDashboard } from './components/owner/OwnerDashboard';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('bartracker_session_user');
      if (saved) {
        const u = JSON.parse(saved);
        if (u.businessId) {
          store.setCurrentBusiness(u.businessId);
        }
        return u;
      }
      return null;
    } catch {
      return null;
    }
  });

  const [activeTab, setActiveTab] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('bartracker_session_user');
      if (saved) {
        const u = JSON.parse(saved);
        if (u.role === 'OWNER') return 'overview';
        const active = store.getActiveShift();
        if (!active) return 'start';
        return active.counterFinished ? 'end_shift' : 'counter';
      }
    } catch {
      // fallback
    }
    return 'start';
  });
  // tick triggers re-render whenever store state mutates
  const [, setTick] = useState<number>(0);

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      setTick((t) => t + 1);
    });
    return unsubscribe;
  }, []);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    if (user.businessId) {
      store.setCurrentBusiness(user.businessId);
    }
    try {
      localStorage.setItem('bartracker_session_user', JSON.stringify(user));
    } catch (err) {
      console.error(err);
    }
    // Set appropriate initial tab
    if (user.role === 'OWNER') {
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
    setCurrentUser(null);
    try {
      localStorage.removeItem('bartracker_session_user');
    } catch (err) {
      console.error(err);
    }
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
      <main className="flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full">
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
