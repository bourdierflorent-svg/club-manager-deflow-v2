import React, { useState, useMemo } from 'react';
import { useStore } from '../store/index';
import { OrderStatus } from '../src/types';
import { formatCurrency } from '../src/utils';
import { BarChart3, RotateCcw, Wine } from 'lucide-react';

// ============================================
// 📍 TYPES
// ============================================

type ViewMode = 'stats' | 'encours';

// ============================================
// 🧩 SOUS-COMPOSANTS
// ============================================

const NavButton: React.FC<{
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}> = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    className={`flex-1 py-2.5 rounded-xl font-medium text-xs transition-all flex items-center justify-center gap-2 ${
      active ? 'bg-white text-black' : 'text-zinc-500 hover:text-white hover:bg-zinc-800'
    }`}
  >
    {icon} {label}
  </button>
);

// ============================================
// 🎯 COMPOSANT PRINCIPAL
// ============================================

const ViewerDashboard: React.FC = () => {
  const orders = useStore(state => state.orders);

  const [activeView, setActiveView] = useState<ViewMode>('stats');

  // --- CALCULS MÉMORISÉS ---

  const totalRevenue = useMemo(() => {
    return orders
      .filter(o => o.status === OrderStatus.SERVED || o.status === OrderStatus.SETTLED)
      .reduce((acc, o) => acc + o.totalAmount, 0);
  }, [orders]);

  // Total bouteilles vendues (toutes confondues)
  const allBottles = useMemo(() => {
    const itemMap: Record<string, { name: string; size: string; quantity: number }> = {};
    orders
      .filter(o => o.status === OrderStatus.SERVED || o.status === OrderStatus.SETTLED)
      .forEach(order => {
        order.items.forEach(item => {
          const key = `${item.productName}-${item.size}`;
          if (!itemMap[key]) {
            itemMap[key] = { name: item.productName, size: item.size, quantity: 0 };
          }
          itemMap[key].quantity += item.quantity;
        });
      });
    return Object.values(itemMap).sort((a, b) => b.quantity - a.quantity);
  }, [orders]);

  // --- RENDU ---

  return (
    <div className="min-h-screen bg-zinc-900 text-white pb-20">

      {/* Header */}
      <div className="sticky top-0 z-50 bg-zinc-900/95 backdrop-blur-xl border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold uppercase tracking-tighter text-white">Viewer</h1>
          <span className="text-xs font-semibold px-3 py-1 rounded-full border uppercase bg-zinc-800 text-zinc-400 border-zinc-700 badge-pulse">
            Live
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right rounded-xl px-3 py-1">
            <p className="text-xs text-zinc-500 font-semibold uppercase">Total Validé</p>
            <p className="text-2xl font-semibold text-zinc-400 leading-none">{formatCurrency(totalRevenue)}</p>
          </div>

          <button
            onClick={() => window.location.reload()}
            className="bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-white p-2 rounded-xl transition-all active:scale-95 hover:border-zinc-700"
            title="Rafraîchir"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Navigation */}
      <div className="px-4 py-4 flex justify-center">
        <div className="bg-zinc-900 border border-zinc-800 p-1.5 rounded-xl flex gap-1 w-full max-w-lg">
          <NavButton
            active={activeView === 'stats'}
            onClick={() => setActiveView('stats')}
            icon={<BarChart3 className="w-3 h-3" />}
            label="Stats"
          />
          <NavButton
            active={activeView === 'encours'}
            onClick={() => setActiveView('encours')}
            icon={<Wine className="w-3 h-3" />}
            label="En cours"
          />
        </div>
      </div>

      {/* --- VUE STATS --- */}
      {activeView === 'stats' && (
        <div className="max-w-5xl mx-auto px-4 fade-in-up space-y-4">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl text-center">
            <p className="stat-value text-3xl md:text-4xl font-semibold text-emerald-400">{formatCurrency(totalRevenue)}</p>
            <p className="text-xs text-zinc-500 font-semibold uppercase mt-2">CA Global</p>
          </div>
        </div>
      )}

      {/* --- VUE EN COURS --- */}
      {activeView === 'encours' && (
        <div className="max-w-5xl mx-auto px-4 animate-in fade-in duration-500 space-y-4">
          {allBottles.length === 0 ? (
            <div className="py-24 text-center bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-600 font-semibold uppercase text-sm">
              Aucune bouteille vendue
            </div>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
                <h3 className="text-base font-semibold text-white uppercase">Bouteilles vendues</h3>
                <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-lg">
                  {allBottles.reduce((acc, i) => acc + i.quantity, 0)} bouteilles
                </span>
              </div>
              <div className="divide-y divide-zinc-800">
                {allBottles.map((item, idx) => (
                  <div key={idx} className="px-5 py-3 flex justify-between items-center">
                    <div>
                      <span className="text-white font-medium text-sm">{item.name}</span>
                      <span className="text-zinc-600 text-sm ml-2">({item.size})</span>
                    </div>
                    <span className="text-zinc-300 font-semibold tabular-nums text-sm">{item.quantity}x</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export default ViewerDashboard;
