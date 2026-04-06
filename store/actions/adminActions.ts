import type { StoreGet, StoreSet } from '../types';
import type { User, EveningEvent, Order, Client, Table } from '../../src/types';
import { OrderStatus, UserRole } from '../../src/types';
import { getTableZone, secureLog, secureError } from '../../src/utils';
import { supabase } from '../../supabaseConfig';
import { logSync } from '../helpers';

export const createAdminActions = (set: StoreSet, get: StoreGet) => ({

  addUser: async (u: User) => {
    const { clubId } = get();
    if (!clubId) return;
    try {
      // On ne passe pas d'id si c'est un short-id (ex: "user-abc") ; on laisse Postgres générer un UUID.
      // Si u.id est déjà un UUID valide (ex: édition), on l'utilise.
      const isUuid = typeof u.id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(u.id);
      const payload: Record<string, unknown> = {
        club_id: clubId,
        first_name: u.firstName,
        last_name: u.lastName,
        email: u.email,
        role: u.role,
        pin: u.pin,
        is_active: u.isActive !== false,
      };
      if (isUuid) payload.id = u.id;
      const { error } = await supabase.from('users').upsert(payload);
      if (error) secureError("[addUser] Error:", error);
    } catch (e) {
      secureError("[ERROR] [addUser] Error:", e);
    }
  },

  updateUser: async (u: User) => {
    try {
      await supabase.from('users').update({
        first_name: u.firstName,
        last_name: u.lastName,
        email: u.email,
        role: u.role,
        pin: u.pin,
        is_active: u.isActive !== false,
      }).eq('id', u.id);
    } catch (e) {
      secureError("[ERROR] [updateUser] Error:", e);
    }
  },

  deleteUser: async (userId: string) => {
    try {
      await supabase.from('users').delete().eq('id', userId);
      const currentUser = get().currentUser;
      get().logAction(currentUser?.id || '', currentUser?.firstName || '', 'DELETE_USER', `Utilisateur supprime: ${userId}`, 'high');
    } catch (e) {
      secureError("[ERROR] [deleteUser] Error:", e);
      throw e;
    }
  },

  deleteEvent: async (eventId: string) => {
    try {
      // Delete sub-data first
      await supabase.from('orders').delete().eq('event_id', eventId);
      await supabase.from('clients').delete().eq('event_id', eventId);
      await supabase.from('event_tables').delete().eq('event_id', eventId);
      await supabase.from('events').delete().eq('id', eventId);

      const user = get().currentUser;
      get().logAction(user?.id || '', user?.firstName || 'ADMIN', 'DELETE_EVENT', `Suppression archive ID: ${eventId}`, 'critical');
    } catch (e) {
      secureError("[ERROR] [deleteEvent] Error:", e);
    }
  },

  repairArchive: async (eventId: string) => {
    try {
      logSync(`Reparation archive ${eventId} - Lecture des donnees Supabase...`);

      const [ordersRes, clientsRes, tablesRes] = await Promise.all([
        supabase.from('orders').select('*').eq('event_id', eventId),
        supabase.from('clients').select('*').eq('event_id', eventId),
        supabase.from('event_tables').select('*').eq('event_id', eventId),
      ]);

      const archiveOrders = (ordersRes.data || []).map(mapOrderFromDb);
      const archiveClients = (clientsRes.data || []).map(mapClientFromDb);
      const archiveTables = (tablesRes.data || []).map(mapTableFromDb);
      const { users } = get();

      logSync(`Donnees trouvees: ${archiveOrders.length} commandes, ${archiveClients.length} clients, ${archiveTables.length} tables`);

      if (archiveOrders.length === 0) return;

      const detailedHistory = archiveOrders
        .filter(o => o.status === OrderStatus.SERVED || o.status === OrderStatus.SETTLED || o.status === OrderStatus.PENDING)
        .map(o => {
          const client = archiveClients.find(c => c.id === o.clientId);
          const table = archiveTables.find(t => t.id === o.tableId);
          const clientTable = !table && client?.tableId ? archiveTables.find(t => t.id === client.tableId) : null;
          const resolvedTable = table || clientTable;
          const waiter = users.find(u => u.id === o.waiterId);
          const tableNumber = resolvedTable?.number || '?';
          return {
            clientName: client?.name || 'Inconnu',
            tableNumber,
            zone: getTableZone(tableNumber, resolvedTable?.zone),
            apporteur: client?.businessProvider || '-',
            waiterName: waiter?.firstName || 'Inconnu',
            totalAmount: Number(o.totalAmount || 0),
            items: o.items?.map(i => `${i.quantity}x ${i.productName} (${i.size})`) || []
          };
        });

      if (detailedHistory.length === 0) return;

      const waiterStats = users
        .filter(u => u.role === UserRole.WAITER)
        .map(u => ({
          name: u.firstName,
          revenue: archiveOrders.filter(o => o.waiterId === u.id && (o.status === OrderStatus.SERVED || o.status === OrderStatus.SETTLED)).reduce((acc, o) => acc + (Number(o.totalAmount) || 0), 0),
          tablesCount: archiveClients.filter(c => c.waiterId === u.id).length
        }))
        .filter(s => s.revenue > 0);

      // Recalcul du CA depuis les commandes served/settled
      const totalRevenue = archiveOrders
        .filter(o => o.status === OrderStatus.SERVED || o.status === OrderStatus.SETTLED)
        .reduce((acc, o) => acc + (Number(o.totalAmount) || 0), 0);

      await supabase.from('events').update({
        detailed_history: detailedHistory,
        waiter_stats: waiterStats,
        client_count: archiveClients.length,
        order_count: archiveOrders.length,
        total_revenue: totalRevenue,
      }).eq('id', eventId);

      logSync(`Archive reparee: ${detailedHistory.length} entrees, CA: ${totalRevenue}E`);

      const user = get().currentUser;
      get().logAction(user?.id || '', user?.firstName || 'ADMIN', 'REPAIR_ARCHIVE', `Archive ${eventId} reparee: ${detailedHistory.length} entrees`, 'high');

    } catch (e) {
      secureError("[ERROR] [repairArchive] Error:", e);
    }
  },

  // Alias utilisé par le bouton "Recalculer" dans AdminDashboard
  recoverEvent: async (eventId: string) => {
    const self = get() as any;
    await self.repairArchive(eventId);
  },

  updateArchivedApporteur: async (eventId: string, clientName: string, newApporteur: string) => {
    try {
      const { data: eventData, error } = await supabase
        .from('events')
        .select('detailed_history')
        .eq('id', eventId)
        .single();

      if (error || !eventData) return;

      const history = (eventData.detailed_history as any[]) || [];

      const updatedHistory = history.map(entry => {
        if (entry.clientName === clientName) {
          return { ...entry, apporteur: newApporteur.toUpperCase() };
        }
        return entry;
      });

      await supabase.from('events').update({ detailed_history: updatedHistory }).eq('id', eventId);

      // Optimistic local update
      set(state => ({
        pastEvents: state.pastEvents.map(e =>
          e.id === eventId ? { ...e, detailedHistory: updatedHistory } : e
        )
      }));

      const user = get().currentUser;
      get().logAction(user?.id || '', user?.firstName || 'ADMIN', 'EDIT_ARCHIVE', `Modif apporteur pour ${clientName}: ${newApporteur}`, 'high');
    } catch (e) {
      secureError("[ERROR] [updateArchivedApporteur] Error:", e);
    }
  },

});

// Local mapping helpers for repairArchive
function mapOrderFromDb(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    eventId: (row.event_id as string) || '',
    clientId: (row.client_id as string) || '',
    tableId: (row.table_id as string) || '',
    waiterId: (row.waiter_id as string) || '',
    items: (row.items as any[]) || [],
    totalAmount: Number(row.total_amount) || 0,
    status: (row.status as string) || '',
  };
}

function mapClientFromDb(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    name: (row.name as string) || '',
    businessProvider: (row.business_provider as string) || '',
    tableId: (row.table_id as string) || '',
    waiterId: (row.waiter_id as string) || '',
    status: (row.status as string) || '',
    totalSpent: Number(row.total_spent) || 0,
    reservationId: (row.reservation_id as string) || '',
  };
}

function mapTableFromDb(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    number: (row.number as string) || '',
    zone: (row.zone as string) || '',
  };
}
