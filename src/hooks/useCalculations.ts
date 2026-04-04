/**
 * 📍 hooks/useCalculations.ts
 * Hooks pour les calculs mémorisés
 * 
 * @description Centralise tous les calculs (stats waiters, promoters, etc.)
 * VERSION 2.1 - CORRIGÉ pour la récupération de clients
 */

import { useMemo } from 'react';
import { useStore } from '../../store';
import { 
  OrderStatus, 
  TableStatus, 
  UserRole,
  Client,
  Order,
  Table,
  User,
  EveningEvent
} from '../types';
import { 
  calculateWaiterStats, 
  calculatePromoterStats,
  calculateArchiveWaiterStats,
  filterWaiterTables,
  WaiterStat,
  PromoterStat 
} from '../utils';

// ============================================
// 📊 STATS GLOBALES
// ============================================

/**
 * Hook pour les statistiques des serveurs (soirée en cours)
 * @returns Stats triées par CA décroissant
 */
export const useWaiterStats = (): WaiterStat[] => {
  const users = useStore(state => state.users);
  const orders = useStore(state => state.orders);
  
  return useMemo(() => {
    return calculateWaiterStats(users, orders);
  }, [users, orders]);
};

/**
 * Hook pour les statistiques des apporteurs/promoteurs
 * @returns Stats triées par CA décroissant
 */
export const usePromoterStats = (): PromoterStat[] => {
  const clients = useStore(state => state.clients);
  const orders = useStore(state => state.orders);
  
  return useMemo(() => {
    return calculatePromoterStats(clients, orders);
  }, [clients, orders]);
};

/**
 * Hook pour les statistiques des serveurs depuis une archive
 * @param event - Événement archivé
 * @returns Stats par serveur
 */
export const useArchiveWaiterStats = (event: EveningEvent | null): WaiterStat[] => {
  return useMemo(() => {
    if (!event) return [];
    return calculateArchiveWaiterStats(event);
  }, [event]);
};

// ============================================
// 📋 LISTES FILTRÉES
// ============================================

/**
 * Hook pour les tables disponibles (status AVAILABLE)
 * @returns Tables avec statut "available"
 */
export const useAvailableTables = (): Table[] => {
  const tables = useStore(state => state.tables);
  
  return useMemo(() => {
    return tables.filter(t => t.status === TableStatus.AVAILABLE);
  }, [tables]);
};

/**
 * 🆕 Hook pour les tables disponibles POUR UN CLIENT SPÉCIFIQUE
 * Inclut la table déjà assignée au client (pour récupération)
 * 
 * @param clientId - ID du client (optionnel)
 * @returns Tables disponibles + table actuelle du client
 */
export const useAvailableTablesForClient = (clientId?: string): Table[] => {
  const tables = useStore(state => state.tables);
  const clients = useStore(state => state.clients);
  
  return useMemo(() => {
    // Tables avec status AVAILABLE
    const availableTables = tables.filter(t => t.status === TableStatus.AVAILABLE);
    
    // Si pas de client spécifié, retourner juste les tables dispo
    if (!clientId) return availableTables;
    
    // Trouver le client
    const client = clients.find(c => c.id === clientId);
    if (!client || !client.tableId) return availableTables;
    
    // Si le client a déjà une table, l'ajouter aux options si pas déjà présente
    const clientTable = tables.find(t => t.id === client.tableId);
    if (clientTable && !availableTables.find(t => t.id === clientTable.id)) {
      return [clientTable, ...availableTables];
    }
    
    return availableTables;
  }, [tables, clients, clientId]);
};

/**
 * Hook pour les clients actifs (non réglés)
 * @returns Clients avec statut !== "closed"
 */
export const useActiveClients = (): Client[] => {
  const clients = useStore(state => state.clients);
  
  return useMemo(() => {
    return clients.filter(c => c.status !== 'closed');
  }, [clients]);
};

/**
 * Hook pour les clients en attente d'assignation
 * @returns Clients sans table ou sans serveur
 */
export const usePendingClients = (): Client[] => {
  const clients = useStore(state => state.clients);
  
  return useMemo(() => {
    return clients.filter(c => 
      c.status !== 'closed' && (!c.tableId || !c.waiterId)
    );
  }, [clients]);
};

/**
 * Hook pour les serveurs actifs
 * @returns Utilisateurs avec rôle "chef de rang" et isActive
 */
export const useActiveWaiters = (): User[] => {
  const users = useStore(state => state.users);
  
  return useMemo(() => {
    return users.filter(u => u.role === UserRole.WAITER && u.isActive);
  }, [users]);
};

/**
 * Hook pour les commandes en attente de validation
 * @returns Commandes avec statut "pending"
 */
export const usePendingOrders = (): Order[] => {
  const orders = useStore(state => state.orders);
  
  return useMemo(() => {
    return orders.filter(o => o.status === OrderStatus.PENDING);
  }, [orders]);
};

/**
 * Hook pour les commandes servies (non réglées)
 * @returns Commandes avec statut "served" et client non réglé
 */
export const useServedOrders = (): Order[] => {
  const orders = useStore(state => state.orders);
  const clients = useStore(state => state.clients);
  
  return useMemo(() => {
    const closedClientIds = new Set(
      clients.filter(c => c.status === 'closed').map(c => c.id)
    );
    return orders.filter(o => 
      (o.status === OrderStatus.SERVED || o.status === OrderStatus.SETTLED) && !closedClientIds.has(o.clientId)
    );
  }, [orders, clients]);
};

// ============================================
// 👤 DONNÉES SPÉCIFIQUES UTILISATEUR
// ============================================

/**
 * Hook pour les tables d'un serveur spécifique
 * @param waiterId - ID du serveur (optionnel, utilise currentUser par défaut)
 * @returns Tables assignées au serveur
 */
export const useWaiterTables = (waiterId?: string): Table[] => {
  const tables = useStore(state => state.tables);
  const clients = useStore(state => state.clients);
  const currentUser = useStore(state => state.currentUser);
  
  const effectiveWaiterId = waiterId || currentUser?.id;
  
  return useMemo(() => {
    if (!effectiveWaiterId) return [];
    return filterWaiterTables(tables, clients, effectiveWaiterId);
  }, [tables, clients, effectiveWaiterId]);
};

/**
 * Hook pour les clients d'un serveur
 * @param waiterId - ID du serveur
 * @returns Clients assignés au serveur
 */
export const useWaiterClients = (waiterId?: string): Client[] => {
  const clients = useStore(state => state.clients);
  const currentUser = useStore(state => state.currentUser);
  
  const effectiveWaiterId = waiterId || currentUser?.id;
  
  return useMemo(() => {
    if (!effectiveWaiterId) return [];
    return clients.filter(c => 
      c.waiterId === effectiveWaiterId && c.status !== 'closed'
    );
  }, [clients, effectiveWaiterId]);
};

/**
 * Hook pour le CA encaissé d'un serveur
 * @param waiterId - ID du serveur
 * @returns Montant total encaissé
 */
export const useWaiterSettledRevenue = (waiterId?: string): number => {
  const clients = useStore(state => state.clients);
  const currentUser = useStore(state => state.currentUser);
  
  const effectiveWaiterId = waiterId || currentUser?.id;
  
  return useMemo(() => {
    if (!effectiveWaiterId) return 0;
    return clients
      .filter(c => c.status === 'closed' && c.waiterId === effectiveWaiterId)
      .reduce((acc, c) => acc + c.totalSpent, 0);
  }, [clients, effectiveWaiterId]);
};

/**
 * Hook pour le CA en attente d'un serveur
 * @param waiterId - ID du serveur
 * @returns Montant total en attente
 */
export const useWaiterPendingRevenue = (waiterId?: string): number => {
  const orders = useStore(state => state.orders);
  const clients = useStore(state => state.clients);
  const currentUser = useStore(state => state.currentUser);
  
  const effectiveWaiterId = waiterId || currentUser?.id;
  
  return useMemo(() => {
    if (!effectiveWaiterId) return 0;
    
    const closedClientIds = new Set(
      clients.filter(c => c.status === 'closed').map(c => c.id)
    );
    
    return orders
      .filter(o => 
        (o.status === OrderStatus.SERVED || o.status === OrderStatus.SETTLED) &&
        o.waiterId === effectiveWaiterId &&
        !closedClientIds.has(o.clientId)
      )
      .reduce((acc, o) => acc + o.totalAmount, 0);
  }, [orders, clients, effectiveWaiterId]);
};

/**
 * Hook pour les items vendus par un serveur
 * @param waiterId - ID du serveur
 * @returns Items agrégés par produit
 */
export const useWaiterSoldItems = (waiterId?: string): SoldItem[] => {
  const orders = useStore(state => state.orders);
  const currentUser = useStore(state => state.currentUser);
  
  const effectiveWaiterId = waiterId || currentUser?.id;
  
  return useMemo(() => {
    if (!effectiveWaiterId) return [];
    
    const itemMap: Record<string, SoldItem> = {};
    
    const myOrders = orders.filter(
      o => o.waiterId === effectiveWaiterId && (o.status === OrderStatus.SERVED || o.status === OrderStatus.SETTLED)
    );
    
    myOrders.forEach(order => {
      order.items.forEach(item => {
        const key = `${item.productName}-${item.size}`;
        if (!itemMap[key]) {
          itemMap[key] = { 
            key,
            name: item.productName, 
            size: item.size, 
            quantity: 0, 
            total: 0 
          };
        }
        itemMap[key].quantity += item.quantity;
        itemMap[key].total += item.subtotal;
      });
    });
    
    return Object.values(itemMap).sort((a, b) => b.quantity - a.quantity);
  }, [orders, effectiveWaiterId]);
};

export interface SoldItem {
  key: string;
  name: string;
  size: string;
  quantity: number;
  total: number;
}

// ============================================
// 📈 STATS GLOBALES SOIRÉE
// ============================================

/**
 * Hook pour le CA total de la soirée
 * @returns CA total (servi)
 */
export const useTotalRevenue = (): number => {
  const orders = useStore(state => state.orders);
  
  return useMemo(() => {
    return orders
      .filter(o => o.status === OrderStatus.SERVED || o.status === OrderStatus.SETTLED)
      .reduce((acc, o) => acc + o.totalAmount, 0);
  }, [orders]);
};

/**
 * Hook pour le CA encaissé total
 * @returns CA encaissé
 */
export const useTotalSettledRevenue = (): number => {
  const clients = useStore(state => state.clients);
  
  return useMemo(() => {
    return clients
      .filter(c => c.status === 'closed')
      .reduce((acc, c) => acc + c.totalSpent, 0);
  }, [clients]);
};

/**
 * Hook pour le CA en attente total
 * @returns CA en attente
 */
export const useTotalPendingRevenue = (): number => {
  const totalRevenue = useTotalRevenue();
  const settledRevenue = useTotalSettledRevenue();
  
  return useMemo(() => {
    return totalRevenue - settledRevenue;
  }, [totalRevenue, settledRevenue]);
};

/**
 * Hook pour les compteurs de la soirée
 * @returns Objet avec tous les compteurs
 */
export const useEveningCounters = (): EveningCounters => {
  const clients = useStore(state => state.clients);
  const orders = useStore(state => state.orders);
  const tables = useStore(state => state.tables);
  
  return useMemo(() => ({
    totalClients: clients.length,
    activeClients: clients.filter(c => c.status !== 'closed').length,
    closedClients: clients.filter(c => c.status === 'closed').length,
    totalOrders: orders.length,
    pendingOrders: orders.filter(o => o.status === OrderStatus.PENDING).length,
    servedOrders: orders.filter(o => o.status === OrderStatus.SERVED || o.status === OrderStatus.SETTLED).length,
    cancelledOrders: orders.filter(o => o.status === OrderStatus.CANCELLED).length,
    totalTables: tables.length,
    availableTables: tables.filter(t => t.status === TableStatus.AVAILABLE).length,
    occupiedTables: tables.filter(t => t.status === TableStatus.OCCUPIED).length,
    servedTables: tables.filter(t => t.status === TableStatus.SERVED).length,
  }), [clients, orders, tables]);
};

export interface EveningCounters {
  totalClients: number;
  activeClients: number;
  closedClients: number;
  totalOrders: number;
  pendingOrders: number;
  servedOrders: number;
  cancelledOrders: number;
  totalTables: number;
  availableTables: number;
  occupiedTables: number;
  servedTables: number;
}

// ============================================
// 🔍 DONNÉES CLIENT SPÉCIFIQUE
// ============================================

/**
 * Hook pour obtenir les données complètes d'un client
 * @param clientId - ID du client
 * @returns Données agrégées du client
 */
export const useClientData = (clientId: string | null): ClientData | null => {
  const clients = useStore(state => state.clients);
  const orders = useStore(state => state.orders);
  const tables = useStore(state => state.tables);
  const users = useStore(state => state.users);
  
  return useMemo(() => {
    if (!clientId) return null;
    
    const client = clients.find(c => c.id === clientId);
    if (!client) return null;
    
    const clientOrders = orders.filter(o => o.clientId === clientId);
    const table = tables.find(t => t.id === client.tableId);
    const waiter = users.find(u => u.id === client.waiterId);
    const linkedTables = tables.filter(t => 
      client.linkedTableIds?.includes(t.id)
    );
    
    const pendingOrders = clientOrders.filter(o => o.status === OrderStatus.PENDING);
    const servedOrders = clientOrders.filter(o => o.status === OrderStatus.SERVED || o.status === OrderStatus.SETTLED);
    
    const totalServed = servedOrders.reduce((acc, o) => acc + o.totalAmount, 0);
    const totalPending = pendingOrders.reduce((acc, o) => acc + o.totalAmount, 0);
    
    return {
      client,
      table,
      linkedTables,
      waiter,
      orders: clientOrders,
      pendingOrders,
      servedOrders,
      totalServed,
      totalPending,
      grandTotal: totalServed + totalPending,
    };
  }, [clientId, clients, orders, tables, users]);
};

export interface ClientData {
  client: Client;
  table: Table | undefined;
  linkedTables: Table[];
  waiter: User | undefined;
  orders: Order[];
  pendingOrders: Order[];
  servedOrders: Order[];
  totalServed: number;
  totalPending: number;
  grandTotal: number;
}

// ============================================
// 📅 ARCHIVES
// ============================================

/**
 * Hook pour les événements passés triés
 * @returns Événements triés par date décroissante
 */
export const useSortedPastEvents = (): EveningEvent[] => {
  const pastEvents = useStore(state => state.pastEvents);
  
  return useMemo(() => {
    return [...pastEvents].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [pastEvents]);
};
