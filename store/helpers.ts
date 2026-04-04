import type { User, Client } from '../src/types';
import { OrderStatus } from '../src/types';
import {
  getSession,
  updateSessionActivity,
  secureLog,
  secureError,
} from '../src/utils';
import { supabase } from '../supabaseConfig';

export const getStoredUser = (): User | null => {
  const sessionResult = getSession();

  if (!sessionResult.valid) {
    if (localStorage.getItem('lr_user')) {
      localStorage.removeItem('lr_user');
    }
    return null;
  }

  updateSessionActivity();

  return sessionResult.user as User;
};

export const recalculateEventRevenue = async (eventId: string) => {
    if (!eventId) return;
    try {
      const { data: servedOrders, error } = await supabase
        .from('orders')
        .select('*')
        .eq('event_id', eventId)
        .in('status', [OrderStatus.SERVED, OrderStatus.SETTLED]);

      if (error) throw error;
      if (!servedOrders) return;

      const totalRev = servedOrders.reduce((acc, o) => {
        const amount = Number(o.total_amount);
        return acc + (isNaN(amount) ? 0 : amount);
      }, 0);

      await supabase
        .from('events')
        .update({ total_revenue: totalRev })
        .eq('id', eventId);

      const ordersByClient = new Map<string, number>();
      servedOrders.forEach(o => {
        const clientId = o.client_id;
        const amount = Number(o.total_amount);
        if (!isNaN(amount)) {
          ordersByClient.set(clientId, (ordersByClient.get(clientId) || 0) + amount);
        }
      });

      const { data: closedClients } = await supabase
        .from('clients')
        .select('*')
        .eq('event_id', eventId)
        .eq('status', 'closed');

      if (closedClients) {
        for (const client of closedClients) {
          const currentTotalSpent = client.total_spent || 0;
          const correctTotalSpent = ordersByClient.get(client.id) || 0;

          if (Math.abs(currentTotalSpent - correctTotalSpent) > 0.01) {
            await supabase
              .from('clients')
              .update({ total_spent: correctTotalSpent })
              .eq('id', client.id);
            secureLog(`[recalculateEventRevenue] Client ${client.id}: ${currentTotalSpent} -> ${correctTotalSpent}`);
          }
        }
      }
    } catch (error) {
      secureError('[recalculateEventRevenue] Erreur recalcul CA:', error);
    }
};

export const logSync = (message: string, data?: unknown) => {
  secureLog(`[SYNC] ${message}`, data);
};

export const isTableFreeableBy = (clients: Client[], excludeClientId: string, tableId: string): boolean => {
  return !clients.some(cl =>
    cl.id !== excludeClientId && cl.status !== 'closed' &&
    (cl.tableId === tableId || (cl.linkedTableIds && cl.linkedTableIds.includes(tableId)))
  );
};
