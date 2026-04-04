/**
 * components/CommisDashboard.tsx
 * Dashboard minimal pour les commis
 * Acces uniquement au plan de table Club + commandes
 */

import React, { useState, useCallback, memo } from 'react';
import { useStore } from '../store/index';
import { Client, Table } from '../src/types';

// Composants UI
import TableMap from './TableMap';

// Modals
import { ClientDetailModal, OrderModal } from './modals';

// Icones
import { ClipboardList } from 'lucide-react';

// ============================================
// TYPES
// ============================================

type ModalType = 'none' | 'clientDetail' | 'order';

// ============================================
// COMPOSANT PRINCIPAL
// ============================================

const CommisDashboard: React.FC = () => {
  // ========== STORE ==========
  const currentUser = useStore(state => state.currentUser);
  const clients = useStore(state => state.clients);
  const tables = useStore(state => state.tables);
  const orders = useStore(state => state.orders);
  const products = useStore(state => state.products);

  // ========== ETATS ==========
  const [activeModal, setActiveModal] = useState<ModalType>('none');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);

  // ========== HANDLERS ==========
  const closeModal = useCallback(() => {
    setActiveModal('none');
    setSelectedClient(null);
    setSelectedTable(null);
  }, []);

  const openClientDetail = useCallback((client: Client, table?: Table) => {
    setSelectedClient(client);
    setSelectedTable(table || null);
    setActiveModal('clientDetail');
  }, []);

  // 🔧 FIX: Priorité aux clients actifs pour éviter qu'un ancien client encaissé masque le nouveau
  const handleTableClickOnMap = useCallback((table: Table) => {
    const client = clients.find(c =>
      (c.tableId === table.id || c.linkedTableIds?.includes(table.id)) &&
      (c.status === 'assigned' || c.status === 'pending')
    ) || clients.find(c =>
      (c.tableId === table.id || c.linkedTableIds?.includes(table.id)) &&
      c.status === 'closed'
    );
    if (client) {
      openClientDetail(client, table);
    }
    // Table libre → rien (le commis ne cree pas de client)
  }, [clients, openClientDetail]);

  // ========== RENDER ==========
  return (
    <div className="space-y-4 p-4 md:p-6 max-w-4xl mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="bg-zinc-800 p-3 rounded-xl">
          <ClipboardList className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-white uppercase tracking-tighter">Commandes</h1>
          <p className="text-zinc-500 text-xs font-semibold uppercase">
            {currentUser?.firstName || 'Commis'}
          </p>
        </div>
      </div>

      {/* Plan de table (zone club forcee) */}
      <TableMap
        tables={tables}
        clients={clients}
        onTableClick={handleTableClickOnMap}
        currentUserId={currentUser?.id}
        forceZone="club"
      />

      {/* MODALS */}
      <ClientDetailModal
        isOpen={activeModal === 'clientDetail'}
        client={selectedClient}
        table={selectedTable || tables.find(t => t.id === selectedClient?.tableId)}
        orders={orders}
        onClose={closeModal}
        onOpenOrder={() => setActiveModal('order')}
        onOpenTransfer={() => {}}
        onOpenHandover={() => {}}
        onOpenLinkTable={() => {}}
        onUnassign={() => {}}
        onSettle={() => {}}
        onFreeTable={() => {}}
        canOrder={true}
        hideManagementActions={true}
      />

      <OrderModal
        isOpen={activeModal === 'order'}
        client={selectedClient}
        products={products}
        onClose={closeModal}
      />
    </div>
  );
};

export default memo(CommisDashboard);
