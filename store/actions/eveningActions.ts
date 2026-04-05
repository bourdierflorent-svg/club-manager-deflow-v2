import type { StoreGet, StoreSet } from '../types';
import {
  OrderStatus, UserRole, TableStatus,
  ReservationStatus, normalizeReservationStatus
} from '../../src/types';
import { getTableZone, secureLog, secureError } from '../../src/utils';
import { supabase } from '../../supabaseConfig';
import { INITIAL_TABLES } from '../../mockData';
import { logSync, recalculateEventRevenue } from '../helpers';

export const createEveningActions = (set: StoreSet, get: StoreGet) => ({

  startEvening: async (date: string, name?: string) => {
    const user = get().currentUser;
    const { reservations, clubId } = get();
    if (!clubId) return;

    try {
      logSync("Demarrage nouvelle soiree");
      const eventDate = date || new Date().toISOString().split('T')[0];
      const newEvent = {
        club_id: clubId,
        date: eventDate,
        name: (name || 'SOIREE DEFLOWER').toUpperCase(),
        start_time: new Date().toISOString(),
        status: "active",
        total_revenue: 0
      };

      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .insert(newEvent)
        .select()
        .single();

      if (eventError || !eventData) {
        secureError("[ERROR] [startEvening] Insert event error:", eventError);
        return;
      }

      const eventId = eventData.id;

      // Copy template tables into event_tables (DB génère l'UUID)
      const templateTables = INITIAL_TABLES;
      const eventTables = templateTables.map(t => ({
        club_id: clubId,
        event_id: eventId,
        number: t.number,
        capacity: t.capacity,
        type: t.type,
        status: 'available',
        position_x: t.positionX || 0,
        position_y: t.positionY || 0,
        zone: t.zone || '',
      }));

      const { error: tablesError } = await supabase.from('event_tables').insert(eventTables);
      if (tablesError) {
        secureError('[startEvening] event_tables insert failed:', tablesError);
      }

      // Import today's reservations as clients
      const todayReservations = reservations.filter(
        r => r.date === eventDate &&
             normalizeReservationStatus(r.status) === ReservationStatus.EN_ATTENTE
      );

      if (todayReservations.length > 0) {
        logSync(`Import de ${todayReservations.length} reservations en liste clients...`);

        const clientInserts = todayReservations.map(resa => ({
          club_id: clubId,
          event_id: eventId,
          name: resa.clientName,
          business_provider: resa.businessProvider || '',
          table_id: null,
          waiter_id: null,
          status: 'pending',
          total_spent: 0,
          created_at: new Date().toISOString(),
          created_by_id: resa.createdById || null,
          created_by_name: resa.createdByName || null,
          from_reservation: true,
          reservation_id: resa.id,
          number_of_guests: resa.numberOfGuests || 1,
          phone_number: resa.phoneNumber || null,
          notes: resa.notes || null,
        }));

        const { error: clientsError } = await supabase.from('clients').insert(clientInserts);
        if (clientsError) {
          secureError('[startEvening] clients insert failed:', clientsError);
        } else {
          logSync(`${todayReservations.length} reservations importees en liste clients`);
        }
      }

      if (user) await get().logAction(user.id, `${user.firstName} ${user.lastName}`, 'EVENT_START', `Debut: ${newEvent.name}${todayReservations.length > 0 ? ` (+${todayReservations.length} resa)` : ''}`);
      logSync("Soiree demarree avec succes");

    } catch (e) {
      secureError("[ERROR] [startEvening] Error:", e);
    }
  },

  closeEvening: async () => {
    const { currentEvent, orders, clients, tables, users, clubId } = get();
    if (!currentEvent || !clubId) return;
    try {
      logSync("Fermeture de la soiree");
      logSync(`Donnees: ${orders.length} commandes, ${clients.length} clients, ${tables.length} tables`);
      const servedOrders = orders.filter(o => o.status === OrderStatus.SERVED || o.status === OrderStatus.SETTLED);
      logSync(`Commandes served/settled: ${servedOrders.length}`);
      const clientMap = new Map(clients.map(c => [c.id, c]));
      const tableMap = new Map(tables.map(t => [t.id, t]));
      const userMap = new Map(users.map(u => [u.id, u]));
      const detailedHistory = servedOrders.map(o => {
        const client = clientMap.get(o.clientId);
        const table = tableMap.get(o.tableId);
        const clientTable = !table && client?.tableId ? tableMap.get(client.tableId) : null;
        const resolvedTable = table || clientTable;
        const waiter = userMap.get(o.waiterId);
        const tableNumber = resolvedTable?.number || '?';
        return {
          clientName: client?.name || 'Inconnu',
          tableNumber,
          zone: getTableZone(tableNumber, resolvedTable?.zone),
          apporteur: client?.businessProvider || '-',
          waiterName: waiter?.firstName || 'Inconnu',
          totalAmount: Number(o.totalAmount || 0),
          items: o.items.map(i => {
            const base = `${i.quantity}x ${i.productName} (${i.size})`;
            return (i.unitPrice === 0 && i.originalPrice && i.originalPrice > 0)
              ? `${base} (OFFERT)`
              : base;
          })
        };
      });
      const totalOfferts = servedOrders.reduce((acc, o) =>
        acc + o.items.filter(i => i.unitPrice === 0 && i.originalPrice && i.originalPrice > 0)
          .reduce((sum, i) => sum + ((i.originalPrice || 0) * i.quantity), 0), 0);
      logSync(`DetailedHistory: ${detailedHistory.length} entrees`);
      const waiterStats = users.filter(u => u.role === UserRole.WAITER).map(u => ({
        name: u.firstName,
        revenue: servedOrders.filter(o => o.waiterId === u.id).reduce((acc, o) => acc + (Number(o.totalAmount) || 0), 0),
        tablesCount: clients.filter(c => c.waiterId === u.id).length
      })).filter(s => s.revenue > 0);

      await recalculateEventRevenue(currentEvent.id);

      // Re-fetch the event to get the final revenue
      const { data: finalEventData } = await supabase
        .from('events')
        .select('total_revenue')
        .eq('id', currentEvent.id)
        .single();
      const finalRevenue = Number(finalEventData?.total_revenue ?? 0);

      await supabase.from('events').update({
        name: currentEvent.name || 'SOIREE DEFLOWER',
        status: "closed",
        end_time: new Date().toISOString(),
        total_revenue: finalRevenue,
        client_count: clients.length,
        order_count: orders.length,
        detailed_history: detailedHistory,
        waiter_stats: waiterStats,
        total_offerts: totalOfferts
      }).eq('id', currentEvent.id);

      // Update reservations at close
      const { allReservations } = get();
      const eventDate = currentEvent.date || new Date().toISOString().split('T')[0];
      const todayResas = allReservations.filter(r => r.date === eventDate);

      for (const resa of todayResas) {
        const normalizedStatus = normalizeReservationStatus(resa.status);

        if (normalizedStatus === ReservationStatus.EN_ATTENTE) {
          await supabase.from('reservations').update({
            status: ReservationStatus.NO_SHOW,
            no_show_at: new Date().toISOString()
          }).eq('id', resa.id);
        }

        if (normalizedStatus === ReservationStatus.VENU || normalizedStatus === ReservationStatus.CONFIRME) {
          const linkedClient = clients.find(c => c.reservationId === resa.id);
          if (linkedClient) {
            const clientTotal = linkedClient.status === 'closed'
              ? linkedClient.totalSpent
              : servedOrders.filter(o => o.clientId === linkedClient.id).reduce((acc, o) => acc + o.totalAmount, 0);
            await supabase.from('reservations').update({
              total_spent: clientTotal
            }).eq('id', resa.id);
          }
        }
      }

      set({ currentEvent: null });
      logSync("Soiree fermee avec succes");
    } catch (e) {
      secureError("[ERROR] [closeEvening] Error:", e);
      throw e;
    }
  },

});
