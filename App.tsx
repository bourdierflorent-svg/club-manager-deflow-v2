import React, { Component, useEffect, useState, useMemo, useCallback, lazy, Suspense } from 'react';
import { useStore } from './store/index';
import { UserRole } from './src/types';
import Login from './components/Auth';
import Layout from './components/Layout';
import { AlertCircle, RefreshCcw, Calendar, Clock, LogOut, FileText, ClipboardList, Download } from 'lucide-react';
import { useSessionMonitor } from './src/hooks';
import { useServiceWorker } from './src/hooks/useServiceWorker';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ToastProvider } from './components/ui';

// ============================================
// LAZY LOADING - Code-splitting par dashboard
// Chaque dashboard charge dans un chunk separe
// ============================================

const HostessDashboard = lazy(() => import('./components/HostessDashboard'));
const WaiterDashboard = lazy(() => import('./components/WaiterDashboard'));
const ManagerDashboard = lazy(() => import('./components/ManagerDashboard'));
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));
const ViewerDashboard = lazy(() => import('./components/ViewerDashboard'));
const BarmaidDashboard = lazy(() => import('./components/BarmaidDashboard'));
const CommisDashboard = lazy(() => import('./components/CommisDashboard'));
const ReservationsManager = lazy(() => import('./components/ReservationsManager'));
const HubClientsPage = lazy(() => import('./components/HubClientsPage'));

// ============================================
// LOADING SCREEN
// ============================================
const LoadingScreen = () => (
  <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
    <div className="text-center space-y-4">
      <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto" />
      <p className="text-white text-sm font-black uppercase tracking-widest">
        Chargement...
      </p>
    </div>
  </div>
);

// ============================================
// ERROR BOUNDARY
// ============================================
interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  declare props: ErrorBoundaryProps;
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0a0a0a] p-20 text-center space-y-4 flex flex-col items-center justify-center">
          <AlertCircle className="w-16 h-16 text-red-500" />
          <p className="text-red-500 font-bold text-lg">Une erreur est survenue.</p>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl transition-colors"
          >
            <RefreshCcw className="w-5 h-5" /> Recharger
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ============================================
// DASHBOARD WRAPPER (Suspense + ErrorBoundary)
// ============================================
const DashboardWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ErrorBoundary>
    <Suspense fallback={<LoadingScreen />}>
      <div className="min-h-screen bg-[#0a0a0a] text-white selection:bg-white selection:text-black">
        {children}
      </div>
    </Suspense>
  </ErrorBoundary>
);

// ============================================
// WAITER - VUE SANS SOIRÉE (Résa + Récap)
// ============================================
const WaiterNoEventView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'resa' | 'recap' | 'clients'>('resa');
  const pastEvents = useStore(state => state.pastEvents);

  // Bouteilles de la dernière soirée
  const lastEventBottles = useMemo(() => {
    const sorted = [...pastEvents].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const lastEvent = sorted[0];
    if (!lastEvent?.detailedHistory) return { items: [], date: '', name: '' };

    const itemMap: Record<string, { name: string; size: string; quantity: number }> = {};
    lastEvent.detailedHistory.forEach((entry: any) => {
      if (entry.structuredItems) {
        entry.structuredItems.forEach((si: any) => {
          const key = `${si.productName}-${si.size}`;
          if (!itemMap[key]) {
            itemMap[key] = { name: si.productName, size: si.size, quantity: 0 };
          }
          itemMap[key].quantity += si.quantity;
        });
      }
    });
    return {
      items: Object.values(itemMap).sort((a, b) => b.quantity - a.quantity),
      date: lastEvent.date,
      name: lastEvent.name || 'Derniere soiree',
    };
  }, [pastEvents]);

  const exportBottlesPDF = useCallback(() => {
    if (lastEventBottles.items.length === 0) return;
    const doc = new jsPDF();
    const totalBottles = lastEventBottles.items.reduce((acc, i) => acc + i.quantity, 0);

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('DEFLOWER - Recap Bouteilles', 14, 20);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`${lastEventBottles.name} - ${new Date(lastEventBottles.date).toLocaleDateString('fr-FR')}`, 14, 30);
    doc.text(`Total: ${totalBottles} bouteille${totalBottles > 1 ? 's' : ''}`, 14, 38);

    autoTable(doc, {
      head: [['Bouteille', 'Taille', 'Quantite']],
      body: lastEventBottles.items.map(item => [item.name, item.size, `${item.quantity}`]),
      startY: 46,
      styles: { fontSize: 10, cellPadding: 3 },
      headStyles: { fillColor: [30, 30, 30] as [number, number, number], textColor: [255, 255, 255] as [number, number, number], fontStyle: 'bold' as const },
      alternateRowStyles: { fillColor: [245, 245, 245] as [number, number, number] },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 8;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`TOTAL: ${totalBottles} bouteille${totalBottles > 1 ? 's' : ''}`, 14, finalY);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Genere le ${new Date().toLocaleDateString('fr-FR')}`, 14, doc.internal.pageSize.height - 10);
    doc.save(`Recap_Bouteilles_${lastEventBottles.date}.pdf`);
  }, [lastEventBottles]);

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-4xl mx-auto">
      {/* Message d'info */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-6 flex items-center gap-4">
        <div className="bg-amber-500/20 p-4 rounded-full">
          <AlertCircle className="w-8 h-8 text-amber-500" />
        </div>
        <div>
          <h2 className="text-xl font-black text-white uppercase tracking-tight">Aucune soiree active</h2>
          <p className="text-white/50 text-sm mt-1">En attendant l'ouverture, consultez les reservations.</p>
        </div>
      </div>

      {/* Onglets */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('resa')}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black uppercase transition-all ${activeTab === 'resa' ? 'bg-white text-black' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
        >
          <Calendar className="w-4 h-4" /> Reservations
        </button>
        <button
          onClick={() => setActiveTab('recap')}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black uppercase transition-all ${activeTab === 'recap' ? 'bg-white text-black' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
        >
          <ClipboardList className="w-4 h-4" /> Recap Bouteilles
        </button>
        <button
          onClick={() => setActiveTab('clients')}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black uppercase transition-all ${activeTab === 'clients' ? 'bg-white text-black' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
        >
          Clients
        </button>
      </div>

      {/* Contenu */}
      {activeTab === 'resa' && (
        <Suspense fallback={<LoadingScreen />}>
          <ReservationsManager />
        </Suspense>
      )}

      {activeTab === 'recap' && (
        <div className="space-y-4">
          {lastEventBottles.items.length === 0 ? (
            <p className="text-center text-white/20 py-20 font-black uppercase tracking-widest">Aucune donnee disponible</p>
          ) : (
            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black text-white uppercase">Recap Bouteilles</h3>
                  <p className="text-xs text-white/40 mt-0.5">{lastEventBottles.name} — {new Date(lastEventBottles.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-lg">
                    {lastEventBottles.items.reduce((acc, i) => acc + i.quantity, 0)} bouteilles
                  </span>
                  <button
                    onClick={exportBottlesPDF}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all text-xs font-black uppercase"
                  >
                    <Download className="w-3.5 h-3.5" /> PDF
                  </button>
                </div>
              </div>
              <div className="divide-y divide-white/5">
                {lastEventBottles.items.map((item, idx) => (
                  <div key={idx} className="px-5 py-3 flex justify-between items-center">
                    <div>
                      <span className="text-white font-medium text-sm">{item.name}</span>
                      <span className="text-white/30 text-sm ml-2">({item.size})</span>
                    </div>
                    <span className="text-white/70 font-bold tabular-nums text-sm">{item.quantity}x</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'clients' && (
        <Suspense fallback={<div className="p-8 text-center text-white/30">Chargement...</div>}>
          <HubClientsPage />
        </Suspense>
      )}
    </div>
  );
};

// ============================================
// SESSION EXPIRING WARNING MODAL
// ============================================
const SessionWarningModal: React.FC<{
  timeRemaining: number;
  onExtend: () => void;
  onLogout: () => void;
}> = ({ timeRemaining, onExtend, onLogout }) => {
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#111111] border-2 border-amber-500/50 rounded-3xl p-8 max-w-md w-full mx-4 shadow-2xl">
        <div className="text-center space-y-6">
          <div className="bg-amber-500/20 p-4 rounded-full w-fit mx-auto">
            <Clock className="w-12 h-12 text-amber-500" />
          </div>

          <div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight">
              Session expire bientot
            </h2>
            <p className="text-white/60 mt-2">
              Votre session va expirer dans
            </p>
          </div>

          <div className="text-5xl font-black text-amber-500">
            {minutes}:{seconds.toString().padStart(2, '0')}
          </div>

          <div className="flex gap-4">
            <button
              onClick={onExtend}
              className="flex-1 bg-white hover:bg-gray-400 text-black font-black py-4 px-6 rounded-2xl transition-all uppercase tracking-wider"
            >
              Continuer
            </button>
            <button
              onClick={onLogout}
              className="flex-1 bg-white/10 hover:bg-white/20 text-white font-black py-4 px-6 rounded-2xl transition-all uppercase tracking-wider flex items-center justify-center gap-2"
            >
              <LogOut className="w-5 h-5" />
              Deconnexion
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const { currentUser, currentEvent, initializeFromSupabase, logout } = useStore();
  const [error, setError] = useState<string | null>(null);
  const [showSessionWarning, setShowSessionWarning] = useState(false);
  const [warningTimeLeft, setWarningTimeLeft] = useState(300);

  // PWA Service Worker + cache-busting iOS standalone
  useServiceWorker();

  // Gestion de l'expiration de session
  const handleSessionExpired = useCallback(() => {
    logout();
  }, [logout]);

  const handleSessionWarning = useCallback((secondsRemaining: number) => {
    setWarningTimeLeft(secondsRemaining);
    setShowSessionWarning(true);
  }, []);

  // Hook de surveillance de session (seulement si connecté)
  const { timeRemaining, isExpiringSoon, extendSession } = useSessionMonitor({
    onSessionExpired: currentUser ? handleSessionExpired : undefined,
    onSessionWarning: currentUser ? handleSessionWarning : undefined,
    warningThreshold: 300, // 5 minutes avant expiration
    checkInterval: 10000, // Vérifier toutes les 10 secondes
  });

  // Mettre à jour le temps restant dans le warning modal
  useEffect(() => {
    if (showSessionWarning && timeRemaining !== null) {
      setWarningTimeLeft(timeRemaining);
    }
  }, [showSessionWarning, timeRemaining]);

  // Fermer le warning si on n'est plus en zone critique
  useEffect(() => {
    if (!isExpiringSoon) {
      setShowSessionWarning(false);
    }
  }, [isExpiringSoon]);

  const handleExtendSession = useCallback(() => {
    extendSession();
    setShowSessionWarning(false);
  }, [extendSession]);

  const handleLogoutFromWarning = useCallback(() => {
    setShowSessionWarning(false);
    logout();
  }, [logout]);

  // Initialisation Supabase
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    try {
      unsubscribe = initializeFromSupabase();
    } catch (e) {
      console.error("App Initialization Error:", e);
      setError("Erreur lors de la synchronisation des donnees.");
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [initializeFromSupabase]);

  // Rendu du dashboard selon le role
  const renderDashboard = () => {
    try {
      if (!currentUser) return <Login />;

      // Pas de soiree active pour les roles non-admin -> Afficher les reservations
      // EXCEPTION: L'hôtesse a accès à son dashboard complet (Archives + Réservations) même sans soirée
      if (!currentEvent && currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.VIEWER && currentUser.role !== UserRole.HOSTESS) {
        // Commis : message simple sans réservations
        if (currentUser.role === UserRole.COMMIS) {
          return (
            <DashboardWrapper>
              <div className="p-4 md:p-6 max-w-4xl mx-auto">
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-6 flex items-center gap-4">
                  <div className="bg-amber-500/20 p-4 rounded-full">
                    <AlertCircle className="w-8 h-8 text-amber-500" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white uppercase tracking-tight">
                      Aucune soiree active
                    </h2>
                    <p className="text-white/50 text-sm mt-1">
                      La soiree n'a pas encore demarre.
                    </p>
                  </div>
                </div>
              </div>
            </DashboardWrapper>
          );
        }

        // Chef de rang : Résa + Récap Soirées
        if (currentUser.role === UserRole.WAITER) {
          return (
            <DashboardWrapper>
              <WaiterNoEventView />
            </DashboardWrapper>
          );
        }

        return (
          <DashboardWrapper>
            <div className="space-y-6 p-4 md:p-6 max-w-4xl mx-auto">
              {/* Message d'info */}
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-6 flex items-center gap-4">
                <div className="bg-amber-500/20 p-4 rounded-full">
                  <AlertCircle className="w-8 h-8 text-amber-500" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-white uppercase tracking-tight">
                    Aucune soiree active
                  </h2>
                  <p className="text-white/50 text-sm mt-1">
                    En attendant l'ouverture, vous pouvez gerer les reservations ci-dessous.
                  </p>
                </div>
              </div>

              {/* ReservationsManager */}
              <Suspense fallback={<LoadingScreen />}>
                <ReservationsManager />
              </Suspense>

              {/* Hub Clients */}
              <Suspense fallback={<div className="p-8 text-center text-white/30">Chargement...</div>}>
                <HubClientsPage />
              </Suspense>
            </div>
          </DashboardWrapper>
        );
      }

      // Routage par role avec Suspense
      const dashboard = (() => {
        switch (currentUser.role) {
          case UserRole.HOSTESS:
            return <HostessDashboard />;
          case UserRole.WAITER:
            return <WaiterDashboard />;
          case UserRole.MANAGER:
            return <ManagerDashboard />;
          case UserRole.ADMIN:
            return <AdminDashboard />;
          case UserRole.VIEWER:
            return <ViewerDashboard />;
          case UserRole.BARMAID:
            return <BarmaidDashboard />;
          case UserRole.COMMIS:
            return <CommisDashboard />;
          default:
            console.warn("Unknown role:", currentUser.role);
            return (
              <div className="p-20 text-center text-white">
                Role non reconnu : {currentUser.role}
              </div>
            );
        }
      })();

      return (
        <DashboardWrapper>
          {dashboard}
        </DashboardWrapper>
      );
    } catch (e) {
      console.error("Dashboard Rendering Error:", e);
      return (
        <div className="min-h-screen bg-[#0a0a0a] p-20 text-center space-y-4 flex flex-col items-center justify-center">
          <p className="text-red-500 font-bold text-lg">Une erreur est survenue lors de l'affichage.</p>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-white/10 hover:bg-white/20 px-6 py-3 rounded-xl transition-colors"
          >
            Recharger
          </button>
        </div>
      );
    }
  };

  // Ecran d'erreur globale
  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-10">
        <div className="text-center space-y-6">
          <AlertCircle className="w-20 h-20 text-red-500 mx-auto" />
          <h2 className="text-2xl font-black text-white">{error}</h2>
          <button 
            onClick={() => { localStorage.clear(); window.location.reload(); }} 
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl mx-auto transition-colors"
          >
            <RefreshCcw className="w-5 h-5" /> Reinitialiser et Recharger
          </button>
        </div>
      </div>
    );
  }

  return (
    <ToastProvider>
      <div className="min-h-screen bg-[#0a0a0a] text-white selection:bg-white selection:text-black">
        {/* Modal d'avertissement de session */}
        {showSessionWarning && currentUser && (
          <SessionWarningModal
            timeRemaining={warningTimeLeft}
            onExtend={handleExtendSession}
            onLogout={handleLogoutFromWarning}
          />
        )}

        {currentUser ? (
          <Layout>
            {renderDashboard()}
          </Layout>
        ) : (
          <Login />
        )}
      </div>
    </ToastProvider>
  );
};

export default App;
