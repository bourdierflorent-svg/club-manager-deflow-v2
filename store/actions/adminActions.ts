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
      // Delete sub-data first (toutes les tables liees a l'event)
      await supabase.from('orders').delete().eq('event_id', eventId);
      await supabase.from('clients').delete().eq('event_id', eventId);
      await supabase.from('event_tables').delete().eq('event_id', eventId);
      await supabase.from('caisses').delete().eq('event_id', eventId);

      // Delete l'event lui-meme
      const { error } = await supabase.from('events').delete().eq('id', eventId);
      if (error) {
        secureError("[deleteEvent] Supabase delete failed:", error);
        throw error;
      }

      // Mise à jour locale du store
      const { pastEvents } = get();
      set({ pastEvents: pastEvents.filter(ev => ev.id !== eventId) });

      const user = get().currentUser;
      get().logAction(user?.id || '', user?.firstName || 'ADMIN', 'DELETE_EVENT', `Suppression archive ID: ${eventId}`, 'critical');
    } catch (e) {
      secureError("[ERROR] [deleteEvent] Error:", e);
      throw e;
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

  // Utilisé par le bouton "Recalculer" dans AdminDashboard — même logique que repairArchive
  recoverEvent: async (eventId: string) => {
    const notify = (msg: string) => {
      try { get().addNotification({ type: 'info', title: 'RECALCUL', message: msg }); } catch {}
    };
    try {
      notify(`Début recalcul event ${eventId.slice(0, 8)}...`);

      const [ordersRes, clientsRes, tablesRes] = await Promise.all([
        supabase.from('orders').select('*').eq('event_id', eventId),
        supabase.from('clients').select('*').eq('event_id', eventId),
        supabase.from('event_tables').select('*').eq('event_id', eventId),
      ]);

      if (ordersRes.error) return { ok: false, error: `orders: ${ordersRes.error.message}` };
      if (clientsRes.error) return { ok: false, error: `clients: ${clientsRes.error.message}` };

      const archiveOrders = (ordersRes.data || []).map(mapOrderFromDb);
      const archiveClients = (clientsRes.data || []).map(mapClientFromDb);
      const archiveTables = (tablesRes.data || []).map(mapTableFromDb);
      const { users } = get();

      if (archiveOrders.length === 0) {
        // Diagnostic : chercher si des commandes existent pour des clients de cet event
        const clientIds = archiveClients.map(c => c.id);
        let orphanCount = 0;
        if (clientIds.length > 0) {
          const { data: orphans } = await supabase
            .from('orders')
            .select('id, event_id, client_id, status, total_amount')
            .in('client_id', clientIds.slice(0, 50))
            .limit(10);
          orphanCount = orphans?.length ?? 0;
          if (orphans && orphans.length > 0) {
            const sample = orphans[0];
            return { ok: false, orders: 0, error: `0 orders pour event_id=${eventId.slice(0,8)}, MAIS ${orphanCount} orders trouvées via client_id (event_id réel: ${sample.event_id?.slice(0,8)}, status: ${sample.status}, montant: ${sample.total_amount})` };
          }
        }
        return { ok: false, orders: 0, clients: archiveClients.length, error: `0 orders, ${archiveClients.length} clients, 0 orders orphelines` };
      }

      const servedSettled = archiveOrders.filter(o => o.status === OrderStatus.SERVED || o.status === OrderStatus.SETTLED);

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

      if (detailedHistory.length === 0) return { ok: false, orders: archiveOrders.length, served: servedSettled.length, error: 'detailedHistory vide' };

      const totalRevenue = servedSettled.reduce((acc, o) => acc + (Number(o.totalAmount) || 0), 0);

      const waiterStats = users
        .filter(u => u.role === UserRole.WAITER)
        .map(u => ({
          name: u.firstName,
          revenue: servedSettled.filter(o => o.waiterId === u.id).reduce((acc, o) => acc + (Number(o.totalAmount) || 0), 0),
          tablesCount: archiveClients.filter(c => c.waiterId === u.id).length
        }))
        .filter(s => s.revenue > 0);

      notify(`CA calcule: ${totalRevenue}E — ecriture en base...`);

      const { error: updateError } = await supabase.from('events').update({
        detailed_history: detailedHistory,
        waiter_stats: waiterStats,
        client_count: archiveClients.length,
        order_count: archiveOrders.length,
        total_revenue: totalRevenue,
      }).eq('id', eventId);

      if (updateError) { notify(`ERREUR update: ${updateError.message}`); return; }

      // Mise à jour optimiste du store local
      const { pastEvents } = get();
      const updatedPastEvents = pastEvents.map(ev =>
        ev.id === eventId
          ? { ...ev, totalRevenue, detailedHistory, waiterStats, clientCount: archiveClients.length, orderCount: archiveOrders.length }
          : ev
      );
      set({ pastEvents: updatedPastEvents });

      notify(`TERMINÉ: ${detailedHistory.length} entrées, CA: ${totalRevenue}E`);
      return { ok: true, orders: archiveOrders.length, served: servedSettled.length, revenue: totalRevenue };
    } catch (e: any) {
      notify(`EXCEPTION: ${e?.message || e}`);
      secureError("[ERROR] [recoverEvent] Error:", e);
      return { ok: false, error: e?.message };
    }
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
