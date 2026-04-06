import type { StoreGet, StoreSet } from '../types';
import type {
  User, Product, Table, Client, Order, Reservation,
  EveningEvent, AuditLog
} from '../../src/types';
import { ReservationStatus, normalizeReservationStatus } from '../../src/types';
import { secureLog, secureError } from '../../src/utils';
import { supabase } from '../../supabaseConfig';
import { INITIAL_TABLES } from '../../mockData';
import { logSync } from '../helpers';

/**
 * Enrich past events with revenue, client count, and order count computed
 * from the orders and clients tables. This ensures correct values even when
 * the summary columns on the events table are missing or stale.
 */
// Fetch all rows from a table, paginating past the 1000-row Supabase limit
async function fetchAllRows(queryBuilder: any): Promise<any[]> {
  const allRows: any[] = [];
  const pageSize = 1000;
  let offset = 0;
  while (true) {
    const { data, error } = await queryBuilder.range(offset, offset + pageSize - 1);
    if (error || !data || data.length === 0) break;
    allRows.push(...data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return allRows;
}

async function enrichPastEventsWithRevenue(events: ReturnType<typeof mapEventFromDb>[]) {
  if (events.length === 0) return events;

  const eventIds = events.map(e => e.id);

  // Fetch caisses, orders, clients and users in parallel (with pagination)
  const [allCaisses, allOrders, allClients, allUsers, allEventTables] = await Promise.all([
    supabase
      .from('caisses')
      .select('event_id, ttc, saved_ok, ca_salle, ca_lounge')
      .in('event_id', eventIds)
      .then(r => r.data || []),
    fetchAllRows(
      supabase
        .from('orders')
        .select('event_id, client_id, waiter_id, table_id, total_amount, status, items')
        .in('event_id', eventIds)
        .in('status', ['served', 'settled'])
    ),
    fetchAllRows(
      supabase
        .from('clients')
        .select('id, event_id, name, business_provider, table_id, waiter_id')
        .in('event_id', eventIds)
    ),
    supabase
      .from('users')
      .select('id, first_name, role')
      .then(r => r.data || []),
    fetchAllRows(
      supabase
        .from('event_tables')
        .select('id, event_id, number, zone')
        .in('event_id', eventIds)
    ),
  ]) as [any[], any[], any[], any[], any[]];

  // Build caisse map: eventId -> ttc (source of truth when available)
  const caisseMap = new Map<string, number>();
  if (allCaisses) {
    for (const c of allCaisses) {
      const eid = c.event_id as string;
      const ttc = Number(c.ttc) || 0;
      if (c.saved_ok || ttc > 0) caisseMap.set(eid, ttc);
    }
  }

  // Build revenue map: eventId -> total revenue from orders
  const revenueMap = new Map<string, number>();
  const orderCountMap = new Map<string, number>();
  if (allOrders) {
    for (const o of allOrders) {
      const eid = o.event_id as string;
      const amount = Number(o.total_amount) || 0;
      revenueMap.set(eid, (revenueMap.get(eid) || 0) + amount);
      orderCountMap.set(eid, (orderCountMap.get(eid) || 0) + 1);
    }
  }

  // Build user name map
  const userNameMap = new Map<string, string>();
  for (const u of allUsers) userNameMap.set(u.id, u.first_name || 'Inconnu');

  // Build event_table id -> {number, zone} map
  const tableInfoMap = new Map<string, { number: string; zone: string }>();
  for (const t of allEventTables) tableInfoMap.set(t.id, { number: t.number || '?', zone: t.zone || 'club' });

  // Group clients by event
  const clientsByEvent = new Map<string, any[]>();
  const clientById = new Map<string, any>();
  for (const c of allClients) {
    const eid = c.event_id as string;
    if (!clientsByEvent.has(eid)) clientsByEvent.set(eid, []);
    clientsByEvent.get(eid)!.push(c);
    clientById.set(c.id, c);
  }

  // Group orders by event
  const ordersByEvent = new Map<string, any[]>();
  for (const o of allOrders) {
    const eid = o.event_id as string;
    if (!ordersByEvent.has(eid)) ordersByEvent.set(eid, []);
    ordersByEvent.get(eid)!.push(o);
  }

  // Enrich each event
  return events.map(event => {
    const caisseTTC = caisseMap.get(event.id);
    const caisseData = allCaisses.find((c: any) => c.event_id === event.id);
    const eventOrders = ordersByEvent.get(event.id) || [];
    const eventClients = clientsByEvent.get(event.id) || [];
    const orderRevenue = eventOrders.reduce((sum: number, o: any) => sum + (Number(o.total_amount) || 0), 0);

    let totalRevenue: number;
    if (caisseTTC != null && caisseTTC > 0) {
      totalRevenue = caisseTTC;
    } else if (event.totalRevenue > 0) {
      totalRevenue = event.totalRevenue;
    } else {
      totalRevenue = orderRevenue;
    }

    // Reconstruct detailedHistory from orders + clients
    const detailedHistory = event.detailedHistory && event.detailedHistory.length > 0
      ? event.detailedHistory
      : eventOrders.map((o: any) => {
          const client = o.client_id ? clientById.get(o.client_id) : null;
          const waiterName = o.waiter_id ? (userNameMap.get(o.waiter_id) || 'Inconnu') : 'Inconnu';
          // Resolve table: try order's table_id first, then client's table_id
          const tableId = o.table_id || client?.table_id;
          const tableInfo = tableId ? tableInfoMap.get(tableId) : null;
          return {
            clientName: client?.name || 'Client de passage',
            tableNumber: tableInfo?.number || '?',
            zone: tableInfo?.zone || 'club',
            apporteur: client?.business_provider || '-',
            waiterName: waiterName.toUpperCase(),
            totalAmount: Number(o.total_amount) || 0,
            items: (o.items || []).map((i: any) =>
              `${i.quantity || 1}x ${i.productName || 'Article'} (${i.size || 'standard'})`
            ),
          };
        });

    // Reconstruct waiterStats
    const waiterStats = event.waiterStats && event.waiterStats.length > 0
      ? event.waiterStats
      : (() => {
          const waiterMap = new Map<string, { name: string; revenue: number; tables: number }>();
          for (const o of eventOrders) {
            const wId = o.waiter_id;
            if (!wId) continue;
            const name = (userNameMap.get(wId) || 'Inconnu').toUpperCase();
            if (!waiterMap.has(wId)) waiterMap.set(wId, { name, revenue: 0, tables: 0 });
            const w = waiterMap.get(wId)!;
            w.revenue += Number(o.total_amount) || 0;
          }
          // Count tables (unique clients) per waiter
          for (const c of eventClients) {
            if (c.waiter_id && waiterMap.has(c.waiter_id)) {
              waiterMap.get(c.waiter_id)!.tables++;
            }
          }
          return Array.from(waiterMap.values())
            .filter(w => w.revenue > 0)
            .sort((a, b) => b.revenue - a.revenue);
        })();

    return {
      ...event,
      totalRevenue,
      clientCount: eventClients.length || event.clientCount,
      orderCount: eventOrders.length || event.orderCount,
      detailedHistory,
      waiterStats,
    };
  });
}

export const createSupabaseActions = (set: StoreSet, get: StoreGet) => ({

  initializeFromSupabase: () => {
    logSync("Initialisation des listeners Supabase Realtime");

    // We run the async init inside a sync wrapper (returns cleanup)
    let cleanedUp = false;
    const channels: ReturnType<typeof supabase.channel>[] = [];

    const init = async () => {
      try {
        // --- Fetch club_id for Deflow ---
        const { data: clubData, error: clubError } = await supabase
          .from('clubs')
          .select('id')
          .eq('name', 'Deflow')
          .single();

        if (clubError || !clubData) {
          secureError('[initializeFromSupabase] Could not find Deflow club:', clubError);
          set({ isOnline: false });
          return;
        }

        const clubId = clubData.id;
        set({ clubId });
        logSync(`Club ID fetched: ${clubId}`);

        if (cleanedUp) return;

        // --- Initial fetch: Users ---
        const { data: users } = await supabase
          .from('users')
          .select('*')
          .eq('club_id', clubId);
        if (users && users.length > 0) {
          set({ users: users.map(mapUserFromDb), lastSyncTime: new Date().toISOString() });
          logSync(`Users synced: ${users.length} utilisateurs`);
        }

        // --- Realtime: Users ---
        const usersChannel = supabase.channel('users-changes')
          .on('postgres_changes', {
            event: '*', schema: 'public', table: 'users',
            filter: `club_id=eq.${clubId}`
          }, async () => {
            const { data } = await supabase.from('users').select('*').eq('club_id', clubId);
            if (data && data.length > 0) {
              set({ users: data.map(mapUserFromDb), lastSyncTime: new Date().toISOString() });
            }
          })
          .subscribe();
        channels.push(usersChannel);

        // --- Initial fetch + Realtime: Reservations (global, not event-specific) ---
        const { data: allReservations } = await supabase
          .from('reservations')
          .select('*')
          .eq('club_id', clubId);
        if (allReservations) {
          const mapped = allReservations.map(mapReservationFromDb);
          const activeReservations = mapped.filter(r => {
            const normalizedStatus = normalizeReservationStatus(r.status);
            return normalizedStatus !== ReservationStatus.CONFIRME &&
                   normalizedStatus !== ReservationStatus.NO_SHOW &&
                   normalizedStatus !== ReservationStatus.RECALE;
          });
          set({ reservations: activeReservations, allReservations: mapped });
          logSync(`Reservations synced: ${activeReservations.length} actives / ${mapped.length} total`);
        }

        const reservationsChannel = supabase.channel('reservations-changes')
          .on('postgres_changes', {
            event: '*', schema: 'public', table: 'reservations',
            filter: `club_id=eq.${clubId}`
          }, async () => {
            const { data } = await supabase.from('reservations').select('*').eq('club_id', clubId);
            if (data) {
              const mapped = data.map(mapReservationFromDb);
              const activeReservations = mapped.filter(r => {
                const normalizedStatus = normalizeReservationStatus(r.status);
                return normalizedStatus !== ReservationStatus.CONFIRME &&
                       normalizedStatus !== ReservationStatus.NO_SHOW &&
                       normalizedStatus !== ReservationStatus.RECALE;
              });
              set({ reservations: activeReservations, allReservations: mapped });
            }
          })
          .subscribe();
        channels.push(reservationsChannel);

        // --- Track active event and its sub-data ---
        let currentEventId: string | null = null;
        const eventDataChannels: ReturnType<typeof supabase.channel>[] = [];

        const cleanupEventChannels = () => {
          eventDataChannels.forEach(ch => {
            try { supabase.removeChannel(ch); } catch (e) { secureLog('Cleanup error:', e); }
          });
          eventDataChannels.length = 0;
        };

        const subscribeToEventData = async (eventId: string) => {
          cleanupEventChannels();
          currentEventId = eventId;

          // Fetch event tables
          const { data: tables } = await supabase
            .from('event_tables')
            .select('*')
            .eq('event_id', eventId);
          set({ tables: (tables || []).map(mapTableFromDb), lastSyncTime: new Date().toISOString() });
          logSync(`Tables synced: ${(tables || []).length} tables`);

          // Fetch clients
          const { data: clients } = await supabase
            .from('clients')
            .select('*')
            .eq('event_id', eventId);
          set({ clients: (clients || []).map(mapClientFromDb), lastSyncTime: new Date().toISOString() });
          logSync(`Clients synced: ${(clients || []).length} clients`);

          // Cleanup tables orphelines: occupied mais aucun client actif dessus
          if (tables && clients) {
            const activeClientTableIds = new Set<string>();
            for (const c of clients) {
              if ((c as any).status !== 'closed') {
                if (c.table_id) activeClientTableIds.add(c.table_id as string);
                const linked = (c as any).linked_table_ids;
                if (Array.isArray(linked)) linked.forEach((id: string) => activeClientTableIds.add(id));
              }
            }
            const orphanTables = tables.filter((t: any) =>
              t.status === 'occupied' && !activeClientTableIds.has(t.id)
            );
            if (orphanTables.length > 0) {
              logSync(`Nettoyage ${orphanTables.length} table(s) orpheline(s)`);
              for (const t of orphanTables) {
                await supabase.from('event_tables').update({ status: 'available' }).eq('id', (t as any).id);
              }
            }
          }

          // Fetch orders
          const { data: orders } = await supabase
            .from('orders')
            .select('*')
            .eq('event_id', eventId);
          set({ orders: (orders || []).map(mapOrderFromDb), lastSyncTime: new Date().toISOString() });
          logSync(`Orders synced: ${(orders || []).length} commandes`);

          // Realtime: event_tables
          const tablesChannel = supabase.channel(`event-tables-${eventId}`)
            .on('postgres_changes', {
              event: '*', schema: 'public', table: 'event_tables',
              filter: `event_id=eq.${eventId}`
            }, async () => {
              const { data } = await supabase.from('event_tables').select('*').eq('event_id', eventId);
              if (data) set({ tables: data.map(mapTableFromDb), lastSyncTime: new Date().toISOString() });
            })
            .subscribe();
          eventDataChannels.push(tablesChannel);

          // Realtime: clients
          const clientsChannel = supabase.channel(`event-clients-${eventId}`)
            .on('postgres_changes', {
              event: '*', schema: 'public', table: 'clients',
              filter: `event_id=eq.${eventId}`
            }, async () => {
              const { data } = await supabase.from('clients').select('*').eq('event_id', eventId);
              if (data) set({ clients: data.map(mapClientFromDb), lastSyncTime: new Date().toISOString() });
            })
            .subscribe();
          eventDataChannels.push(clientsChannel);

          // Realtime: orders
          const ordersChannel = supabase.channel(`event-orders-${eventId}`)
            .on('postgres_changes', {
              event: '*', schema: 'public', table: 'orders',
              filter: `event_id=eq.${eventId}`
            }, async () => {
              const { data } = await supabase.from('orders').select('*').eq('event_id', eventId);
              if (data) set({ orders: data.map(mapOrderFromDb), lastSyncTime: new Date().toISOString() });
            })
            .subscribe();
          eventDataChannels.push(ordersChannel);
        };

        // --- PRIORITE: Initial fetch Active Event (AVANT les archives) ---
        const { data: activeEvents } = await supabase
          .from('events')
          .select('*')
          .eq('club_id', clubId)
          .eq('status', 'active')
          .limit(1);

        if (activeEvents && activeEvents.length > 0) {
          const event = mapEventFromDb(activeEvents[0]);
          set({ currentEvent: event, isOnline: true });
          logSync(`Event actif detecte: ${event.id}`);
          await subscribeToEventData(event.id);
        } else {
          logSync('Aucun event actif');
          set({ currentEvent: null, clients: [], orders: [], tables: INITIAL_TABLES, isOnline: true });
        }

        // --- Initial fetch + Realtime: Past Events (protege, ne bloque pas l'init) ---
        try {
          const { data: pastEvents } = await supabase
            .from('events')
            .select('*')
            .eq('club_id', clubId)
            .eq('status', 'closed')
            .order('date', { ascending: false })
            .limit(200);
          if (pastEvents) {
            const mapped = pastEvents.map(mapEventFromDb);
            const enriched = await enrichPastEventsWithRevenue(mapped);
            set({ pastEvents: enriched });
          }
        } catch (archiveError) {
          secureError('[initializeFromSupabase] Archive enrichment failed (non-blocking):', archiveError);
        }

        const pastEventsChannel = supabase.channel('past-events-changes')
          .on('postgres_changes', {
            event: '*', schema: 'public', table: 'events',
            filter: `club_id=eq.${clubId}`
          }, async () => {
            try {
              const { data } = await supabase
                .from('events')
                .select('*')
                .eq('club_id', clubId)
                .eq('status', 'closed')
                .order('date', { ascending: false })
                .limit(200);
              if (data) {
                const mapped = data.map(mapEventFromDb);
                const enriched = await enrichPastEventsWithRevenue(mapped);
                set({ pastEvents: enriched });
              }
            } catch (e) {
              secureError('[pastEventsChannel] Enrichment error:', e);
            }
          })
          .subscribe();
        channels.push(pastEventsChannel);

        // Realtime: Active event changes
        const activeEventChannel = supabase.channel('active-event-changes')
          .on('postgres_changes', {
            event: '*', schema: 'public', table: 'events',
            filter: `club_id=eq.${clubId}`
          }, async () => {
            set({ isOnline: true });
            const { data: events } = await supabase
              .from('events')
              .select('*')
              .eq('club_id', clubId)
              .eq('status', 'active')
              .limit(1);

            if (events && events.length > 0) {
              const event = mapEventFromDb(events[0]);
              set({ currentEvent: event });

              if (currentEventId !== event.id) {
                logSync(`Changement d'event: ${currentEventId} -> ${event.id}`);
                await subscribeToEventData(event.id);
              }
            } else {
              if (get().currentEvent) {
                cleanupEventChannels();
                currentEventId = null;
                set({ currentEvent: null, clients: [], orders: [], tables: INITIAL_TABLES });
              }
            }

            // Also re-fetch past events
            const { data: pastEventsData } = await supabase
              .from('events')
              .select('*')
              .eq('club_id', clubId)
              .eq('status', 'closed')
              .order('date', { ascending: false })
              .limit(200);
            if (pastEventsData) {
              const mapped = pastEventsData.map(mapEventFromDb);
              const enriched = await enrichPastEventsWithRevenue(mapped);
              set({ pastEvents: enriched });
            }
          })
          .subscribe();
        channels.push(activeEventChannel);

        // --- Initial load + Realtime: Invoices ---
        await get().loadInvoices();

        const invoicesChannel = supabase.channel('invoices-changes')
          .on('postgres_changes', {
            event: '*', schema: 'public', table: 'invoices',
            filter: `club_id=eq.${clubId}`
          }, async () => {
            await get().loadInvoices();
          })
          .subscribe();
        channels.push(invoicesChannel);

      } catch (error) {
        secureError('[initializeFromSupabase] Error:', error);
        set({ isOnline: false });
      }
    };

    init();

    // Cleanup function
    return () => {
      cleanedUp = true;
      logSync('Cleanup des listeners Supabase');
      supabase.removeAllChannels();
    };
  },

});

// --- Mapping helpers: Supabase snake_case -> App camelCase ---

function mapUserFromDb(row: Record<string, unknown>): User {
  return {
    id: row.id as string,
    firstName: (row.first_name as string) || '',
    lastName: (row.last_name as string) || '',
    email: (row.email as string) || '',
    role: (row.role as string) || 'waiter',
    pin: (row.pin as string) || '',
    isActive: row.is_active !== false,
    clubId: (row.club_id as string) || '',
  } as User;
}

function mapEventFromDb(row: Record<string, unknown>): EveningEvent {
  return {
    id: row.id as string,
    date: (row.date as string) || '',
    name: (row.name as string) || '',
    startTime: (row.start_time as string) || '',
    endTime: (row.end_time as string) || '',
    status: (row.status as string) || '',
    totalRevenue: Number(row.total_revenue) || 0,
    clientCount: Number(row.client_count) || 0,
    orderCount: Number(row.order_count) || 0,
    detailedHistory: (row.detailed_history as unknown[]) || [],
    waiterStats: (row.waiter_stats as unknown[]) || [],
    totalOfferts: Number(row.total_offerts) || 0,
  } as EveningEvent;
}

function mapTableFromDb(row: Record<string, unknown>): Table {
  return {
    id: row.id as string,
    number: (row.number as string) || '',
    capacity: Number(row.capacity) || 0,
    type: (row.type as string) || '',
    status: (row.status as string) || 'available',
    positionX: Number(row.position_x) || 0,
    positionY: Number(row.position_y) || 0,
    zone: (row.zone as string) || '',
  } as Table;
}

function mapClientFromDb(row: Record<string, unknown>): Client {
  return {
    id: row.id as string,
    eventId: (row.event_id as string) || '',
    name: (row.name as string) || '',
    businessProvider: (row.business_provider as string) || '',
    tableId: (row.table_id as string) || '',
    waiterId: (row.waiter_id as string) || '',
    status: (row.status as string) || 'pending',
    totalSpent: Number(row.total_spent) || 0,
    arrivalAt: (row.arrival_at as string) || '',
    notes: (row.notes as string) || '',
    phoneNumber: (row.phone_number as string) || '',
    numberOfGuests: Number(row.number_of_guests) || 1,
    tablePreference: (row.table_preference as string) || '',
    fromReservation: Boolean(row.from_reservation),
    reservationId: (row.reservation_id as string) || '',
    customerId: (row.customer_id as string) || '',
    apporteurId: (row.apporteur_id as string) || '',
    linkedTableIds: (row.linked_table_ids as string[]) || [],
    createdById: (row.created_by_id as string) || '',
    createdByName: (row.created_by_name as string) || '',
    minimumSpend: row.minimum_spend != null ? Number(row.minimum_spend) : undefined,
  } as Client;
}

function mapOrderFromDb(row: Record<string, unknown>): Order {
  return {
    id: row.id as string,
    eventId: (row.event_id as string) || '',
    clientId: (row.client_id as string) || '',
    tableId: (row.table_id as string) || '',
    waiterId: (row.waiter_id as string) || '',
    items: (row.items as unknown[]) || [],
    note: (row.note as string) || '',
    totalAmount: Number(row.total_amount) || 0,
    status: (row.status as string) || '',
    createdAt: (row.created_at as string) || '',
    validatedAt: (row.validated_at as string) || '',
    cancelReason: (row.cancel_reason as string) || '',
    removedItems: (row.removed_items as unknown[]) || [],
    customerId: (row.customer_id as string) || '',
  } as Order;
}

function mapReservationFromDb(row: Record<string, unknown>): Reservation {
  return {
    id: row.id as string,
    clientName: (row.client_name as string) || '',
    businessProvider: (row.business_provider as string) || '',
    date: (row.date as string) || '',
    time: (row.time as string) || '',
    numberOfGuests: Number(row.number_of_guests) || 1,
    notes: (row.notes as string) || '',
    tablePreference: (row.table_preference as string) || '',
    phoneNumber: (row.phone_number as string) || '',
    status: (row.status as string) || '',
    createdAt: (row.created_at as string) || '',
    createdById: (row.created_by_id as string) || '',
    createdByName: (row.created_by_name as string) || '',
    customerId: (row.customer_id as string) || '',
    apporteurId: (row.apporteur_id as string) || '',
    tableId: (row.table_id as string) || '',
    eventId: (row.event_id as string) || '',
    totalSpent: Number(row.total_spent) || 0,
    minimumSpend: row.minimum_spend != null ? Number(row.minimum_spend) : undefined,
  } as Reservation;
}
