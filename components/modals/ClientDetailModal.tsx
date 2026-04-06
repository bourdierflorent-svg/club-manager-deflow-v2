/**
 * 📁 components/modals/ClientDetailModal.tsx
 * Modal de détail d'un client avec ses commandes et actions
 */

import React, { useCallback, useMemo } from 'react';
import { Client, Table, Order, OrderStatus } from '../../src/types';
import { OrderCard } from '../ui';
import { X, Handshake, UserMinus, Link, Unlink, LogOut, Lock, RotateCw, XCircle } from 'lucide-react';

// ============================================
// 📝 TYPES
// ============================================

interface ClientDetailModalProps {
  isOpen: boolean;
  client: Client | null;
  table: Table | undefined;
  orders: Order[];
  onClose: () => void;
  // Actions
  onOpenOrder: () => void;
  onOpenTransfer: () => void;
  onOpenHandover: () => void;
  onOpenLinkTable: () => void;
  onUnassign: () => void;
  onSettle: () => void;
  onFreeTable: () => void;
  onReopen?: () => void;
  // 🔒 Permission de commande (serveur assigné ou admin)
  canOrder?: boolean;
  // 📌 Indique si on visualise une table liée (pas la principale)
  isLinkedTable?: boolean;
  // 🍸 Mode barmaid : masquer toutes les actions sauf Commande
  hideManagementActions?: boolean;
  // 💰 Permission d'encaisser (barmaid oui, commis non)
  canSettle?: boolean;
  // 🗑️ Callback annulation commande (si fourni, affiche un bouton annuler par commande)
  onCancelOrder?: (orderId: string) => void;
}

// ============================================
// 🎯 COMPOSANT PRINCIPAL
// ============================================

const ClientDetailModal: React.FC<ClientDetailModalProps> = ({
  isOpen,
  client,
  table,
  orders,
  onClose,
  onOpenOrder,
  onOpenTransfer,
  onOpenHandover,
  onOpenLinkTable,
  onUnassign,
  onSettle,
  onFreeTable,
  onReopen,
  canOrder = true, // 🔒 Par défaut true pour rétrocompatibilité
  isLinkedTable = false, // 📌 Par défaut false
  hideManagementActions = false, // 🍸 Par défaut false
  canSettle = false, // 💰 Par défaut false
  onCancelOrder,
}) => {
  // Calcul du total
  const clientTotal = useMemo(() => {
    if (!client) return 0;
    if (client.status === 'closed') return client.totalSpent;
    return orders
      .filter(o => o.clientId === client.id && (o.status === OrderStatus.SERVED || o.status === OrderStatus.SETTLED))
      .reduce((acc, o) => acc + o.totalAmount, 0);
  }, [client, orders]);

  // Commandes du client triées
  const clientOrders = useMemo(() => {
    if (!client) return [];
    return orders
      .filter(o => o.clientId === client.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [client, orders]);

  const isClosed = client?.status === 'closed';
  const tableLabel = table?.number 
    ? (table.number.toUpperCase().startsWith('BAR') ? table.number : `Table ${table.number}`)
    : 'Sans Table';
  const tableLabelWithLink = isLinkedTable ? `${tableLabel} (liée)` : tableLabel;

  if (!isOpen || !client) return null;

  return (
    <div className="fixed inset-0 z-[500] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-t-2xl sm:rounded-xl p-8 w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-3xl font-semibold text-white">
              {client.name}
            </h3>
            <p className={`text-xs font-semibold mt-1 ${isLinkedTable ? 'text-orange-400' : 'text-zinc-400'}`}>
              {tableLabelWithLink}
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="text-zinc-500 hover:text-white transition-colors"
          >
            <X className="w-8 h-8" />
          </button>
        </div>

        {/* Total */}
        <div className="text-center py-6 bg-zinc-800 rounded-xl mb-6">
          <p className="text-xs text-zinc-500 font-semibold mb-1">Total Actuel</p>
          <p className="text-5xl font-semibold text-white">{clientTotal.toFixed(0)}€</p>
        </div>

        {/* Liste des commandes */}
        <div className="flex-1 overflow-y-auto space-y-3 mb-6 pr-2">
          {clientOrders.length === 0 ? (
            <div className="text-center py-10 text-zinc-600 font-medium text-sm">
              Aucune commande
            </div>
          ) : (
            clientOrders.map(order => (
              <div key={order.id}>
                <OrderCard order={order} />
                {onCancelOrder && (order.status === OrderStatus.SERVED || order.status === OrderStatus.SETTLED || order.status === OrderStatus.PENDING) && (
                  <button
                    onClick={() => onCancelOrder(order.id)}
                    className="mt-1 w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold uppercase transition-all"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Annuler la commande
                  </button>
                )}
                {order.status === OrderStatus.CANCELLED && order.cancelReason && (
                  <div className="mt-1 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                    <p className="text-red-400 text-xs font-semibold uppercase flex items-center gap-2 mb-1">
                      <XCircle className="w-3.5 h-3.5" /> Commande annulee
                    </p>
                    <p className="text-red-300/80 text-xs">Motif : {order.cancelReason}</p>
                    {order.cancelledByName && (
                      <p className="text-red-400/50 text-[10px] mt-1">
                        Par {order.cancelledByName}{order.cancelledAt ? ` - ${new Date(order.cancelledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Actions */}
        {isClosed ? (
          (!hideManagementActions || canSettle) && (
            <div className="flex gap-2">
              {!hideManagementActions && onReopen && (
                <button
                  onClick={onReopen}
                  className="flex-1 bg-amber-600 text-white py-5 rounded-lg font-medium uppercase flex items-center justify-center gap-3 active:scale-95 transition-all hover:bg-amber-500"
                >
                  <RotateCw className="w-5 h-5" /> Réouvrir
                </button>
              )}
              <button
                onClick={onFreeTable}
                className="flex-1 bg-purple-600 text-white py-5 rounded-lg font-medium uppercase flex items-center justify-center gap-3 active:scale-95 transition-all"
              >
                <LogOut className="w-5 h-5" /> Libérer Table
              </button>
            </div>
          )
        ) : hideManagementActions ? (
          /* 🍸 Mode restreint : Commande + Encaisser si autorisé */
          <div className="flex gap-2">
            <button
              onClick={onOpenOrder}
              className={`${canSettle ? 'flex-1' : 'w-full'} bg-white text-black py-5 rounded-lg font-medium text-sm uppercase active:scale-95 transition-all`}
            >
              + Commande
            </button>
            {canSettle && (
              <button
                onClick={onSettle}
                className="flex-1 bg-emerald-600 text-white py-5 rounded-lg font-medium text-sm uppercase active:scale-95 transition-all hover:bg-emerald-500"
              >
                Encaisser
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {/* Ligne 1: Actions principales */}
            <div className="grid grid-cols-3 gap-2">
              {/* 🔒 Bouton Commande - conditionné par canOrder */}
              {canOrder ? (
                <button
                  onClick={onOpenOrder}
                  className="bg-white text-black py-4 rounded-lg font-medium text-xs uppercase active:scale-95 transition-all"
                >
                  + Commande
                </button>
              ) : (
                <button
                  disabled
                  className="bg-zinc-800 text-zinc-500 py-4 rounded-lg font-medium text-xs uppercase cursor-not-allowed flex items-center justify-center gap-1"
                  title="Seul le serveur assigné peut commander"
                >
                  <Lock className="w-3 h-3" /> Commande
                </button>
              )}
              <button
                onClick={onOpenTransfer}
                className="bg-zinc-800 text-white py-4 rounded-lg font-medium text-xs uppercase active:scale-95 transition-all hover:bg-zinc-700"
              >
                Transférer
              </button>
              <button
                onClick={onOpenHandover}
                className="bg-zinc-800 text-white py-4 rounded-lg font-medium text-xs uppercase flex items-center justify-center gap-1 active:scale-95 transition-all hover:bg-zinc-700"
              >
                <Handshake className="w-4 h-4" />
              </button>
            </div>

            {/* Ligne 2: Actions secondaires + Encaisser */}
            <div className="flex gap-2">
              <button
                onClick={onUnassign}
                className={`p-4 rounded-lg active:scale-95 transition-all ${
                  isLinkedTable
                    ? 'bg-orange-500/10 text-orange-500 border border-orange-500/20 hover:bg-orange-500/20'
                    : 'bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20'
                }`}
                title={isLinkedTable ? "Délier cette table" : "Retirer de la table"}
              >
                {isLinkedTable ? <Unlink className="w-5 h-5" /> : <UserMinus className="w-5 h-5" />}
              </button>
              <button
                onClick={onOpenLinkTable}
                className="p-4 rounded-lg bg-blue-500/10 text-blue-500 border border-blue-500/20 active:scale-95 transition-all hover:bg-blue-500/20"
                title="Lier une table"
              >
                <Link className="w-5 h-5" />
              </button>
              <button
                onClick={onSettle}
                className="flex-1 bg-emerald-600 text-white py-4 rounded-lg font-medium uppercase active:scale-95 transition-all hover:bg-emerald-500"
              >
                Encaisser
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientDetailModal;
