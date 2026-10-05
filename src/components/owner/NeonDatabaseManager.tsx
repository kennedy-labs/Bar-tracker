import React, { useState, useEffect } from 'react';
import { neonService, NeonState } from '../../services/neon';
import { store } from '../../services/store';
import {
  Database,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Zap,
  Server,
  CloudUpload,
  CloudDownload,
  Trash2,
  ExternalLink,
  ShieldCheck,
  Check,
  Key,
} from 'lucide-react';

export const NeonDatabaseManager: React.FC = () => {
  const [neonState, setNeonState] = useState<NeonState>(neonService.getStatus());
  const [inputUrl, setInputUrl] = useState<string>(() => {
    return neonService.getSavedDatabaseUrl() || '';
  });
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [initResult, setInitResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);

  useEffect(() => {
    return neonService.subscribeStatus((st) => {
      setNeonState(st);
      if (st.databaseUrl && !inputUrl) {
        setInputUrl(st.databaseUrl);
      }
    });
  }, []);

  const handleTestConnection = async () => {
    if (!inputUrl.trim()) {
      setTestResult({ success: false, message: 'Please enter a Neon PostgreSQL connection URL.' });
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await neonService.testConnection(inputUrl.trim());
      if (res.success) {
        setTestResult({
          success: true,
          message: `Connected successfully to Neon database "${res.database}" (${res.latencyMs}ms latency).`,
        });
      } else {
        setTestResult({ success: false, message: res.error || 'Connection failed.' });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setTestResult({ success: false, message: msg });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveUrl = () => {
    if (inputUrl.trim()) {
      neonService.setDatabaseUrl(inputUrl.trim());
      setTestResult({ success: true, message: 'Neon Database URL saved.' });
    } else {
      neonService.setDatabaseUrl(null);
      setTestResult({ success: true, message: 'Neon Database URL cleared. Switched to clean local mode.' });
    }
  };

  const handleInitSchema = async () => {
    setIsInitializing(true);
    setInitResult(null);
    try {
      const res = await neonService.initSchema(inputUrl.trim() || undefined);
      setInitResult(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setInitResult({ success: false, message: msg });
    } finally {
      setIsInitializing(false);
    }
  };

  const handleSyncToNeon = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const res = await store.uploadAllToNeon();
      setSyncResult(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setSyncResult({ success: false, message: msg });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleWipeAllLocalData = () => {
    store.purgeAllData();
    setShowWipeConfirm(false);
    window.location.reload();
  };

  const isConnected = neonState.status === 'CONNECTED';

  return (
    <div className="space-y-6">
      {/* 1. Header Card */}
      <div className="p-6 rounded-3xl bg-[#121824] border border-[#1E293B] shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-lg">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white tracking-tight">Neon Serverless PostgreSQL</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-cyan-950/80 border border-cyan-500/40 text-cyan-300">
                  SQL Database
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Disconnected from Firebase. Connect your Neon Postgres database URL for cloud persistence.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div
              className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 text-xs font-semibold ${
                isConnected
                  ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                  : neonState.status === 'ERROR'
                  ? 'bg-red-950/60 border-red-500/50 text-red-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-emerald-400 animate-pulse' : neonState.status === 'ERROR' ? 'bg-red-400' : 'bg-slate-500'
                }`}
              />
              <span>
                {isConnected
                  ? `Connected (${neonState.latencyMs ? `${neonState.latencyMs}ms` : 'Active'})`
                  : neonState.status === 'ERROR'
                  ? 'Connection Issue'
                  : 'Local Clean Storage'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Connection String Configuration */}
      <div className="p-6 rounded-3xl bg-[#121824] border border-[#1E293B] shadow-xl space-y-4">
        <div className="flex items-center gap-2 text-slate-300 text-sm font-bold">
          <Key className="w-4 h-4 text-cyan-400" />
          <span>Neon Database Connection URL</span>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          Provide your connection string from the{' '}
          <a
            href="https://console.neon.tech"
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-400 hover:underline inline-flex items-center gap-1 font-medium"
          >
            Neon Console <ExternalLink className="w-3 h-3" />
          </a>
          . Format: <code className="text-cyan-300 font-mono text-[11px] bg-cyan-950/40 px-1.5 py-0.5 rounded">postgresql://user:password@ep-xyz.neon.tech/neondb?sslmode=require</code>
        </p>

        <div className="space-y-2">
          <input
            type="password"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            placeholder="postgresql://username:password@ep-name.region.neon.tech/neondb?sslmode=require"
            className="w-full px-4 py-3 rounded-xl bg-[#0A0D14] border border-slate-700/80 text-white font-mono text-xs placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTesting || !inputUrl.trim()}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer disabled:opacity-40"
          >
            {isTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-amber-400" />}
            <span>Test Connection</span>
          </button>

          <button
            type="button"
            onClick={handleSaveUrl}
            className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-lg shadow-cyan-950/50 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Save & Apply URL</span>
          </button>
        </div>

        {testResult && (
          <div
            className={`p-3.5 rounded-xl text-xs flex items-start gap-2.5 mt-2 ${
              testResult.success
                ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-200'
                : 'bg-red-950/60 border border-red-500/40 text-red-200'
            }`}
          >
            {testResult.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            )}
            <div>{testResult.message}</div>
          </div>
        )}
      </div>

      {/* 3. Schema & Table Management */}
      <div className="p-6 rounded-3xl bg-[#121824] border border-[#1E293B] shadow-xl space-y-4">
        <div className="flex items-center gap-2 text-slate-300 text-sm font-bold">
          <Server className="w-4 h-4 text-cyan-400" />
          <span>PostgreSQL Tables & Schema DDL</span>
        </div>

        <p className="text-xs text-slate-400">
          Ensure your Neon PostgreSQL database has the proper relational tables created (businesses, users, products, inventory, shifts, expenses, and mpesa_accounts).
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
          {['businesses', 'users', 'products', 'inventory', 'shifts', 'expenses', 'mpesa_accounts', 'operational_events'].map(
            (tbl) => (
              <div
                key={tbl}
                className="p-2.5 rounded-xl bg-[#0A0D14] border border-slate-800 text-slate-300 flex items-center gap-1.5"
              >
                <Database className="w-3 h-3 text-cyan-400" />
                <span>{tbl}</span>
              </div>
            )
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleInitSchema}
            disabled={isInitializing || !inputUrl.trim()}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer disabled:opacity-40"
          >
            {isInitializing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />}
            <span>Initialize Neon Schema (CREATE TABLES)</span>
          </button>

          <button
            type="button"
            onClick={handleSyncToNeon}
            disabled={isSyncing || !inputUrl.trim()}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-950/50 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-40"
          >
            {isSyncing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CloudUpload className="w-3.5 h-3.5" />}
            <span>Sync Local Establishment Data to Neon</span>
          </button>
        </div>

        {initResult && (
          <div
            className={`p-3.5 rounded-xl text-xs flex items-start gap-2.5 mt-2 ${
              initResult.success
                ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-200'
                : 'bg-red-950/60 border border-red-500/40 text-red-200'
            }`}
          >
            {initResult.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            )}
            <div>{initResult.message}</div>
          </div>
        )}

        {syncResult && (
          <div
            className={`p-3.5 rounded-xl text-xs flex items-start gap-2.5 mt-2 ${
              syncResult.success
                ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-200'
                : 'bg-red-950/60 border border-red-500/40 text-red-200'
            }`}
          >
            {syncResult.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            )}
            <div>{syncResult.message}</div>
          </div>
        )}
      </div>

      {/* 4. Total Clean Slate / Purge Data Tool */}
      <div className="p-6 rounded-3xl bg-red-950/20 border border-red-900/40 shadow-xl space-y-3">
        <div className="flex items-center gap-2 text-red-300 text-sm font-bold">
          <Trash2 className="w-4 h-4 text-red-400" />
          <span>Clean Start: Purge All Local Data</span>
        </div>
        <p className="text-xs text-slate-400">
          Want to start completely fresh? This will delete all local businesses, users, shifts, and products, returning you directly to the clean business signup page with zero mock data.
        </p>

        {!showWipeConfirm ? (
          <button
            type="button"
            onClick={() => setShowWipeConfirm(true)}
            className="px-4 py-2 rounded-xl bg-red-950/60 hover:bg-red-900 text-red-300 border border-red-800 text-xs font-bold transition-all cursor-pointer"
          >
            Purge All Data & Start Fresh
          </button>
        ) : (
          <div className="p-4 rounded-2xl bg-red-950/80 border border-red-700 space-y-3">
            <div className="text-xs text-red-200 font-bold">
              Are you sure? This will wipe all local data and take you to the clean business signup page.
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleWipeAllLocalData}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg transition-all cursor-pointer"
              >
                Yes, Purge Everything & Restart
              </button>
              <button
                type="button"
                onClick={() => setShowWipeConfirm(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
