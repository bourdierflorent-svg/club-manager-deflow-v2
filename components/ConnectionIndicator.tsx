import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useStore } from '../store/index';
import { Wifi, WifiOff, RefreshCw, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';

// ============================================
// 🔌 INDICATEUR DE CONNEXION - FRESH TOUCH
// ============================================

interface ConnectionStatus {
  color: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
  bgHover: string;
  icon: typeof Wifi;
  label: string;
  description: string;
}

const STATUS_CONFIG = {
  offline: {
    color: 'red',
    bgColor: 'bg-red-500',
    borderColor: 'border-red-500/30',
    textColor: 'text-red-400',
    bgHover: 'hover:bg-red-500/20',
    icon: WifiOff,
    label: 'HORS LIGNE',
    description: 'Mode hors-ligne - Actions sauvegardées localement'
  },
  pending: {
    color: 'orange',
    bgColor: 'bg-orange-500',
    borderColor: 'border-orange-500/30',
    textColor: 'text-orange-400',
    bgHover: 'hover:bg-orange-500/20',
    icon: AlertTriangle,
    label: 'SYNC EN COURS',
    description: 'Commandes en attente de synchronisation'
  },
  syncError: {
    color: 'red',
    bgColor: 'bg-red-500',
    borderColor: 'border-red-500/30',
    textColor: 'text-red-400',
    bgHover: 'hover:bg-red-500/20',
    icon: WifiOff,
    label: 'ERREUR SYNC',
    description: 'Des commandes n\'ont pas pu être synchronisées'
  },
  slow: {
    color: 'yellow',
    bgColor: 'bg-yellow-500',
    borderColor: 'border-yellow-500/30',
    textColor: 'text-yellow-400',
    bgHover: 'hover:bg-yellow-500/20',
    icon: AlertTriangle,
    label: 'SYNC LENTE',
    description: 'Données peut-être pas à jour'
  },
  online: {
    color: 'green',
    bgColor: 'bg-emerald-500',
    borderColor: 'border-emerald-500/30',
    textColor: 'text-emerald-400',
    bgHover: 'hover:bg-emerald-500/20',
    icon: Wifi,
    label: 'CONNECTÉ',
    description: 'Synchronisation en temps réel'
  }
} as const;

const SYNC_TIMEOUT_MS = 30000; // 30 secondes

const ConnectionIndicator: React.FC = () => {
  const { isOnline, lastSyncTime, forceResync, pendingWritesCount, syncErrorCount } = useStore();
  const [showDetails, setShowDetails] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [timeSinceSync, setTimeSinceSync] = useState('');

  // Calcul du temps depuis la dernière sync
  useEffect(() => {
    const updateTimeSinceSync = () => {
      if (!lastSyncTime) {
        setTimeSinceSync('Jamais');
        return;
      }

      const diffMs = Date.now() - new Date(lastSyncTime).getTime();
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);

      if (diffSec < 10) setTimeSinceSync('À l\'instant');
      else if (diffSec < 60) setTimeSinceSync(`${diffSec}s`);
      else if (diffMin < 60) setTimeSinceSync(`${diffMin}min`);
      else setTimeSinceSync('> 1h');
    };

    updateTimeSinceSync();
    const interval = setInterval(updateTimeSinceSync, 5000);
    return () => clearInterval(interval);
  }, [lastSyncTime]);

  // Détermination du statut
  const status: ConnectionStatus = useMemo(() => {
    if (!isOnline) return STATUS_CONFIG.offline;
    if (syncErrorCount > 0) return STATUS_CONFIG.syncError;
    if (pendingWritesCount > 0) return STATUS_CONFIG.pending;

    if (lastSyncTime) {
      const diffMs = Date.now() - new Date(lastSyncTime).getTime();
      if (diffMs > SYNC_TIMEOUT_MS) return STATUS_CONFIG.slow;
    }

    return STATUS_CONFIG.online;
  }, [isOnline, lastSyncTime, pendingWritesCount, syncErrorCount]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    setTimeout(() => forceResync(), 300);
  }, [forceResync]);

  const StatusIcon = status.icon;

  return (
    <div className="relative">
      {/* Bouton principal */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${status.borderColor} ${status.bgHover} transition-all duration-300 active:scale-95 ${showDetails ? 'bg-zinc-800/50' : 'bg-transparent'} ${!isOnline ? 'bg-red-500/15 animate-pulse' : ''}`}
      >
        <div className="relative">
          <div className={`w-2 h-2 rounded-full ${status.bgColor} ${isOnline ? 'animate-pulse' : ''}`} />
          {isOnline && (
            <div className={`absolute inset-0 w-2 h-2 rounded-full ${status.bgColor} animate-ping opacity-50`} />
          )}
        </div>
        <span className={`hidden sm:block text-[10px] font-semibold uppercase tracking-wider ${status.textColor}`}>
          {status.label}
        </span>
        <StatusIcon className={`w-4 h-4 ${status.textColor}`} />
      </button>

      {/* Panel de détails */}
      {showDetails && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowDetails(false)} />
          
          <div className="absolute top-full right-0 mt-2 z-50 w-72 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl shadow-lg overflow-hidden">
              
              {/* Header */}
              <div className={`px-4 py-3 border-b border-zinc-800/50 flex items-center gap-3 ${isOnline ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                <div className={`p-2 rounded-xl ${isOnline ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
                  <StatusIcon className={`w-5 h-5 ${status.textColor}`} />
                </div>
                <div>
                  <p className={`text-sm font-semibold uppercase tracking-tight ${status.textColor}`}>
                    {status.label}
                  </p>
                  <p className="text-[10px] text-zinc-500">{status.description}</p>
                </div>
              </div>

              {/* Infos */}
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-zinc-500">
                    <Clock className="w-4 h-4" />
                    <span className="text-xs font-medium">Dernière sync</span>
                  </div>
                  <span className={`text-xs font-semibold ${
                    timeSinceSync === 'À l\'instant' ? 'text-emerald-400' : 
                    timeSinceSync === '> 1h' ? 'text-red-400' : 'text-white'
                  }`}>
                    {timeSinceSync}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-zinc-500">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-xs font-medium">Firestore</span>
                  </div>
                  <span className={`text-xs font-semibold ${isOnline ? 'text-emerald-400' : 'text-red-400'}`}>
                    {isOnline ? 'Connecté' : 'Déconnecté'}
                  </span>
                </div>

                {pendingWritesCount > 0 && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-orange-500">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="text-xs font-medium">En attente</span>
                    </div>
                    <span className="text-xs font-semibold text-orange-400">
                      {pendingWritesCount} commande(s)
                    </span>
                  </div>
                )}

                {syncErrorCount > 0 && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-red-500">
                      <WifiOff className="w-4 h-4" />
                      <span className="text-xs font-medium">Erreurs sync</span>
                    </div>
                    <span className="text-xs font-semibold text-red-400">
                      {syncErrorCount}
                    </span>
                  </div>
                )}

                {lastSyncTime && (
                  <div className="pt-2 border-t border-zinc-800/50">
                    <p className="text-[10px] text-zinc-600 text-center">
                      Sync: {new Date(lastSyncTime).toLocaleTimeString('fr-FR')}
                    </p>
                  </div>
                )}
              </div>

              {/* Bouton Refresh */}
              <div className="p-3 border-t border-zinc-800/50 bg-zinc-800/50">
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm uppercase tracking-wide transition-all duration-300 active:scale-95 ${
                    isRefreshing 
                      ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed' 
                      : 'bg-white text-black hover:bg-white shadow-lg shadow-white/20'
                  }`}
                >
                  <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  {isRefreshing ? 'Actualisation...' : 'Forcer Refresh'}
                </button>
              </div>

              {/* Message hors ligne */}
              {!isOnline && (
                <div className="px-4 py-3 bg-amber-500/10 border-t border-amber-500/20">
                  <p className="text-[11px] text-amber-200 text-center leading-relaxed font-medium">
                    Vos actions sont sauvegardees localement et seront synchronisees au retour du reseau.
                  </p>
                  <p className="text-[10px] text-zinc-600 text-center mt-1">
                    Verifiez votre connexion WiFi ou 4G
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ConnectionIndicator;
