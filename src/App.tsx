import React, { useState, useEffect } from 'react';
import { User } from './types';
import { store } from './services/store';
import { PinAuthScreen } from './components/auth/PinAuthScreen';
import { TopBar } from './components/common/TopBar';
import { WorkerTerminal } from './components/worker/WorkerTerminal';
import { OwnerDashboard } from './components/owner/OwnerDashboard';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('pombetrack_active_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [activeTab, setActiveTab] = useState<string>('overview');
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
    try {
      localStorage.setItem('pombetrack_active_user', JSON.stringify(user));
    } catch (err) {
      console.error(err);
    }
    // Set appropriate initial tab
    setActiveTab(user.role === 'OWNER' ? 'overview' : 'counter');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    try {
      localStorage.removeItem('pombetrack_active_user');
    } catch (err) {
      console.error(err);
    }
  };

  const users = store.getUsers();
  const discrepancies = store.getDiscrepancies({ status: 'FLAGGED' });

  // If not logged in, show PIN Authentication Keypad Screen
  if (!currentUser) {
    return <PinAuthScreen users={users} onLogin={handleLogin} />;
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
          <WorkerTerminal currentUser={currentUser} />
        )}
      </main>

      {/* Quick Role Switcher Bar for rapid auditing & evaluation */}
      <div className="py-2.5 px-4 bg-[#0E1420] border-t border-slate-900 text-center text-xs text-slate-500 flex flex-wrap items-center justify-center gap-3">
        <span className="font-mono text-[11px] text-slate-400">
          Current: <strong className="text-white">{currentUser.name}</strong> ({currentUser.role})
        </span>
        <span className="text-slate-700">|</span>
        <button
          onClick={() => {
            const owner = users.find((u) => u.role === 'OWNER');
            if (owner) handleLogin(owner);
          }}
          className="text-emerald-400 hover:underline cursor-pointer font-medium"
        >
          Switch to Owner Dashboard (PIN: 8888)
        </button>
        <span className="text-slate-700">|</span>
        <button
          onClick={() => {
            const worker = users.find((u) => u.role === 'WORKER');
            if (worker) handleLogin(worker);
          }}
          className="text-amber-400 hover:underline cursor-pointer font-medium"
        >
          Switch to Worker Terminal (PIN: 1234)
        </button>
        <span className="text-slate-700">|</span>
        <button
          onClick={handleLogout}
          className="text-slate-400 hover:text-white cursor-pointer"
        >
          Lock / Keypad
        </button>
      </div>
    </div>
  );
}
