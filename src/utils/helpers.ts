/**
 * HELPERS - Fonctions utilitaires génériques
 * Fresh Touch Optimization - Day 1
 */

import { EveningEvent, User, Order, Client, Table, UserRole, OrderStatus, ClientStatus } from '../types';

/**
 * Génère un ID court unique avec préfixe optionnel
 */
export const generateShortId = (prefix: string = ''): string => {
  const id = Math.random().toString(36).substr(2, 9);
  return prefix ? `${prefix}-${id}` : id;
};

/**
 * Génère un ID pour les commandes
 */
export const generateOrderId = (): string => generateShortId('order');

/**
 * Génère un ID pour les items de commande
 */
export const generateItemId = (): string => generateShortId('item');

/**
 * Génère un ID pour les saisies manuelles
 */
export const generateManualId = (): string => generateShortId('manual');

/**
 * Agrège les données d'un événement pour les rapports PDF/Excel
 * Regroupe les commandes par client et consolide les items
 */
export const aggregateEventData = (event: EveningEvent): AggregatedClientData[] => {
  const rawData = event.detailedHistory || [];
  const clientMap = new Map<string, AggregatedClientData>();

  rawData.forEach(entry => {
    const clientName = entry.clientName || 'Inconnu';
    const zone = entry.zone || getTableZone(entry.tableNumber);
    // Clé unique par client + table pour séparer les zones si un client change de table
    const key = `${clientName}||${entry.tableNumber}`;

    if (!clientMap.has(key)) {
      clientMap.set(key, {
        clientName: clientName,
        tableNumber: entry.tableNumber,
        waiterName: entry.waiterName || '',
        apporteur: entry.apporteur,
        totalAmount: 0,
        consolidatedItems: {} as Record<string, number>,
        zone: zone
      });
    }

    const clientData = clientMap.get(key)!;
    clientData.totalAmount += entry.totalAmount;

    if (entry.items && Array.isArray(entry.items)) {
      entry.items.forEach((itemStr: string) => {
        const match = itemStr.match(/^(\d+)x (.+)$/);
        if (match) {
          const qty = parseInt(match[1], 10);
          const name = match[2];
          clientData.consolidatedItems[name] = (clientData.consolidatedItems[name] || 0) + qty;
        } else {
          clientData.consolidatedItems[itemStr] = (clientData.consolidatedItems[itemStr] || 0) + 1;
        }
      });
    }
  });

  // Trier par numéro de table
  return Array.from(clientMap.values()).sort((a, b) => {
    const tableA = parseInt(a.tableNumber.replace(/\D/g, '')) || 0;
    const tableB = parseInt(b.tableNumber.replace(/\D/g, '')) || 0;
    return tableA - tableB;
  });
};

/**
 * Calcule le total d'un tableau d'items
 */
export const calculateItemsTotal = (items: { subtotal: number }[]): number => {
  return items.reduce((acc, item) => acc + item.subtotal, 0);
};

/**
 * Vérifie si une table est de petite taille (BAR, sous-tables, tables spéciales)
 */
export const isBarTable = (tableNumber: string): boolean => {
  const upper = tableNumber.toUpperCase();
  return upper.startsWith('BAR') || upper.endsWith('B') || upper === 'PDJ' || upper === 'P1';
};

/**
 * Retourne la zone d'une table
 */
export const getTableZone = (tableNumber: string, tableZone?: string): 'club' | 'bar' => {
  if (tableZone === 'club' || tableZone === 'bar') return tableZone;
  return tableNumber.toUpperCase().startsWith('BAR') ? 'bar' : 'club';
};

/**
 * Tronque un texte avec ellipsis
 */
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
};

/**
 * Debounce function pour éviter les appels trop fréquents
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// ============================================
// 📊 TYPES POUR LES STATS
// ============================================

export interface WaiterStat {
  name: string;
  revenue: number;
}

export interface PromoterStat {
  name: string;
  revenue: number;
  tables: number;
}

export interface AggregatedClientData {
  clientName: string;
  tableNumber: string;
  waiterName: string;
  apporteur: string;
  totalAmount: number;
  consolidatedItems: Record<string, number>;
  zone: 'club' | 'bar';
}

// ============================================
// 📊 FONCTIONS DE CALCUL DE STATS
// ============================================

/**
 * Calcule les stats des serveurs pour la soirée en cours
 */
export const calculateWaiterStats = (
  users: User[],
  orders: Order[]
): WaiterStat[] => {
  return users
    .filter(u => u.role === UserRole.WAITER)
    .map(u => ({
      name: u.firstName,
      revenue: orders
        .filter(o => o.waiterId === u.id && (o.status === OrderStatus.SERVED || o.status === OrderStatus.SETTLED))
        .reduce((acc, o) => acc + (Number(o.totalAmount) || 0), 0)
    }))
    .sort((a, b) => b.revenue - a.revenue);
};

/**
 * Calcule les stats des apporteurs/promoteurs
 */
export const calculatePromoterStats = (
  clients: Client[],
  orders: Order[]
): PromoterStat[] => {
  const stats = new Map<string, { revenue: number; tables: number }>();

  clients.forEach(client => {
    const apporteur = client.businessProvider?.toUpperCase();
    if (!apporteur) return;

    let clientRevenue = 0;
    if (client.status === ClientStatus.CLOSED) {
      clientRevenue = client.totalSpent;
    } else {
      clientRevenue = orders
        .filter(o => o.clientId === client.id && (o.status === OrderStatus.SERVED || o.status === OrderStatus.SETTLED))
        .reduce((acc, o) => acc + o.totalAmount, 0);
    }
    
    if (clientRevenue > 0) {
      const current = stats.get(apporteur) || { revenue: 0, tables: 0 };
      stats.set(apporteur, {
        revenue: current.revenue + clientRevenue,
        tables: current.tables + 1
      });
    }
  });
  
  return Array.from(stats.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.revenue - a.revenue);
};

/**
 * Calcule les stats des serveurs depuis une archive
 */
export const calculateArchiveWaiterStats = (
  event: EveningEvent
): WaiterStat[] => {
  if (!event.detailedHistory) return [];
  
  const stats: Record<string, number> = {};
  
  event.detailedHistory.forEach(entry => {
    const wName = entry.waiterName || 'Non Spécifié';
    stats[wName] = (stats[wName] || 0) + entry.totalAmount;
  });
  
  return Object.entries(stats)
    .map(([name, revenue]) => ({ name, revenue }))
    .sort((a, b) => b.revenue - a.revenue);
};

/**
 * Filtre les tables assignées à un serveur
 */
export const filterWaiterTables = (
  tables: Table[],
  clients: Client[],
  waiterId: string
): Table[] => {
  const waiterClientTableIds = new Set(
    clients
      .filter(c => c.waiterId === waiterId && c.status !== ClientStatus.CLOSED)
      .flatMap(c => [c.tableId, ...(c.linkedTableIds || [])])
      .filter(Boolean)
  );
  
  return tables.filter(t => waiterClientTableIds.has(t.id));
};
