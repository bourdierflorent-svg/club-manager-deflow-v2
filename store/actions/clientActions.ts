import type { StoreGet, StoreSet } from '../types';
import {
  TableStatus, OrderStatus, ReservationStatus, HubCustomerSnapshot, HubApporteurSnapshot
} from '../../src/types';
import { generateShortId, validateName, secureLog, secureError, writeVisitToHub, createHubCustomerAuto } from '../../src/utils';
import { supabase } from '../../supabaseConfig';
import { logSync, isTableFreeableBy, recalculateEventRevenue } from '../helpers';

export const createClientActions = (set: StoreSet, get: StoreGet) => ({

  assignClient: async (cId: string, tId: string, wId: string) => {
    const { currentEvent, clients, clubId } = get();
    if (!currentEvent || !clubId) {
      secureLog("[WARN] [assignClient] Pas d'event actif");
      return false;
    }

    const client = clients.find(c => c.id === cId);
    if (!client) {
      secureLog("[WARN] [assignClient] Client non trouve");
      return false;
    }

    const { tables } = get();
    const targetTable = tables.find(t => t.id === tId);
    if (targetTable && targetTable.status === TableStatus.OCCUPIED) {
      const otherClientOnTable = clients.find(c =>
        c.id !== cId && c.status !== 'closed' &&
        (c.tableId === tId || (c.linkedTableIds && c.linkedTableIds.includes(tId)))
      );
      if (otherClientOnTable) {
        return false;
      }
    }

    try {
      const oldTableId = client.tableId;
      const isSameTable = oldTableId === tId;

      logSync(`Assignation client ${client.name} -> table ${tId} (waiter: ${wId})`, {
        oldTableId, isSameTable, hadWaiter: !!client.waiterId
      });

      // Update client
      await supabase.from('clients').update({
        table_id: tId,
        waiter_id: wId,
        status: 'assigned'
      }).eq('id', cId);

      // Free old table if different
      if (oldTableId && !isSameTable) {
        logSync(`Liberation ancienne table ${oldTableId}`);
        await supabase.from('event_tables').update({ status: TableStatus.AVAILABLE }).eq('id', oldTableId);
      }

      // Occupy new table
      await supabase.from('event_tables').update({ status: TableStatus.OCCUPIED }).eq('id', tId);

      // Update reservation if first assignment
      if (client.reservationId && !oldTableId) {
        logSync(`Reservation ${client.reservationId} -> Client arrive (CONFIRME)`);
        await supabase.from('reservations').update({
          status: ReservationStatus.CONFIRME,
          arrived_at: new Date().toISOString()
        }).eq('id', client.reservationId);
      }

      logSync(`Assignation reussie: ${client.name} sur table ${tId}`);
      return true;

    } catch (e) {
      secureError("[ERROR] [assignClient] Error:", e);
      return false;
    }
  },

  createClient: async (n: string, p?: string, t?: string, w?: string, hubCustomerId?: string | null, hubSnapshot?: HubCustomerSnapshot | null, apporteurId?: string | null, apporteurSnapshot?: HubApporteurSnapshot | null) => {
    const { currentEvent, currentUser, clubId } = get();
    if (!currentEvent || !clubId) return;

    const nameValidation = validateName(n);
    if (!nameValidation.valid) return;

    let sanitizedProvider = '';
    if (p && p.trim()) {
      const providerValidation = validateName(p);
      if (!providerValidation.valid) return;
      sanitizedProvider = providerValidation.sanitized || '';
    }

    try {
      secureLog(`Creation client + reservation: ${nameValidation.sanitized}`);

      // Auto-create Hub customer if not already linked
      let finalHubCustomerId = hubCustomerId;
      if (!finalHubCustomerId) {
        try {
          const parts = (nameValidation.sanitized || n).split(' ');
          const result = await createHubCustomerAuto({
            lastName: parts[0] || '',
            firstName: parts.slice(1).join(' ') || '',
          });
          finalHubCustomerId = result.customerId;
          secureLog(`Hub customer auto-cree: ${result.customerId}`);
        } catch (hubErr) {
          secureError('[WARN] Hub auto-create failed (non-blocking):', hubErr);
        }
      }

      const clientId = generateShortId('client');
      const reservationId = generateShortId('resa');

      // Create reservation
      await supabase.from('reservations').insert({
        id: reservationId,
        club_id: clubId,
        event_id: currentEvent.id,
        client_name: nameValidation.sanitized || n.toUpperCase(),
        business_provider: sanitizedProvider,
        date: currentEvent.date,
        time: '',
        number_of_guests: 1,
        notes: '',
        table_preference: '',
        phone_number: '',
        status: ReservationStatus.EN_ATTENTE,
        created_at: new Date().toISOString(),
        created_by_id: currentUser?.id || '',
        created_by_name: currentUser?.firstName || 'ADMIN',
      });

      // Create client
      await supabase.from('clients').insert({
        id: clientId,
        club_id: clubId,
        event_id: currentEvent.id,
        name: nameValidation.sanitized || n.toUpperCase(),
        business_provider: sanitizedProvider,
        table_id: t || '',
        waiter_id: w || '',
        status: (t && w) ? 'assigned' : 'pending',
        total_spent: 0,
        arrival_at: new Date().toISOString(),
        created_by_id: currentUser?.id || '',
        created_by_name: currentUser?.firstName || '',
        from_reservation: true,
        reservation_id: reservationId,
        customer_id: finalHubCustomerId || null,
        apporteur_id: apporteurId || null,
      });

      if (t) {
        await supabase.from('event_tables').update({ status: TableStatus.OCCUPIED }).eq('id', t);
        await supabase.from('reservations').update({
          status: ReservationStatus.CONFIRME,
          arrived_at: new Date().toISOString()
        }).eq('id', reservationId);
      }

      logSync(`Client + reservation crees: ${n}`);

    } catch (e) {
      secureError("[ERROR] [createClient] Error:", e);
    }
  },

  updateClientName: async (clientId: string, newName: string) => {
    const { currentEvent, clients } = get();
    if (!currentEvent) return;

    const nameValidation = validateName(newName);
    if (!nameValidation.valid) return;

    try {
      const client = clients.find(c => c.id === clientId);
      const sanitized = nameValidation.sanitized || newName.toUpperCase();

      await supabase.from('clients').update({ name: sanitized }).eq('id', clientId);

      if (client?.reservationId) {
        await supabase.from('reservations').update({ client_name: sanitized }).eq('id', client.reservationId);
      }
    } catch (e) {
      secureError('[updateClientName] Error:', e);
    }
  },

  updateClientFull: async (clientId: string, data: { name: string; businessProvider: string; customerId?: string | null }) => {
    const { currentEvent, clients } = get();
    if (!currentEvent) return;

    const client = clients.find(c => c.id === clientId);
    if (!client) return;

    const nameValidation = validateName(data.name);
    if (!nameValidation.valid) return;

    const sanitizedName = nameValidation.sanitized || data.name.toUpperCase();
    const sanitizedApporteur = data.businessProvider.trim().toUpperCase();
    const newCustomerId = data.customerId ?? client.customerId ?? null;

    try {
      await supabase.from('clients').update({
        name: sanitizedName,
        business_provider: sanitizedApporteur,
        customer_id: newCustomerId,
      }).eq('id', clientId);

      if (client.reservationId) {
        await supabase.from('reservations').update({
          client_name: sanitizedName,
          business_provider: sanitizedApporteur,
        }).eq('id', client.reservationId);
      }
    } catch (e) {
      secureError('[updateClientFull] Error:', e);
    }
  },

  updateClientBusinessProvider: async (clientId: string, newApporteur: string) => {
    const { currentEvent, clients } = get();
    if (!currentEvent) return;

    const sanitized = newApporteur.trim().toUpperCase();
    try {
      const client = clients.find(c => c.id === clientId);

      await supabase.from('clients').update({ business_provider: sanitized }).eq('id', clientId);

      if (client?.reservationId) {
        await supabase.from('reservations').update({ business_provider: sanitized }).eq('id', client.reservationId);
      }
    } catch (e) {
      secureError('[updateClientBusinessProvider] Error:', e);
    }
  },

  removeClient: async (clientId: string) => {
    const { currentEvent, clients, currentUser } = get();
    if (!currentEvent) return;
    const client = clients.find(c => c.id === clientId);
    if (!client) return;

    try {
      logSync(`Suppression client: ${client.name}`);

      // Free tables
      if (client.tableId) {
        await supabase.from('event_tables').update({ status: TableStatus.AVAILABLE }).eq('id', client.tableId);
      }
      if (client.linkedTableIds && client.linkedTableIds.length > 0) {
        for (const tId of client.linkedTableIds) {
          await supabase.from('event_tables').update({ status: TableStatus.AVAILABLE }).eq('id', tId);
        }
      }

      // Delete orders for this client
      await supabase.from('orders').delete().eq('event_id', currentEvent.id).eq('client_id', clientId);

      // Delete linked reservation
      if (client.reservationId) {
        await supabase.from('reservations').delete().eq('id', client.reservationId);
      } else {
        const { allReservations } = get();
        const matchingResa = allReservations?.find(r =>
          r.clientName?.toUpperCase() === client.name?.toUpperCase() &&
          r.date === currentEvent.date
        );
        if (matchingResa) {
          await supabase.from('reservations').delete().eq('id', matchingResa.id);
        }
      }

      // Delete client
      await supabase.from('clients').delete().eq('id', clientId);

      get().logAction(currentUser?.id || '', currentUser?.firstName || '', 'DELETE_CLIENT', `Suppression client: ${client.name}`, 'high');
    } catch (e) {
      secureError("[ERROR] [removeClient] Error:", e);
    }
  },

  unassignClient: async (clientId: string) => {
    const { currentEvent, clients } = get();
    if (!currentEvent) return;
    const client = clients.find(c => c.id === clientId);
    if (!client) return;

    try {
      logSync(`Desassignation client: ${client.name}`);

      await supabase.from('clients').update({
        table_id: null, waiter_id: null, status: 'pending', linked_table_ids: []
      }).eq('id', clientId);

      if (client.tableId) {
        if (isTableFreeableBy(clients, clientId, client.tableId)) {
          await supabase.from('event_tables').update({ status: TableStatus.AVAILABLE }).eq('id', client.tableId);
        }
      }
      if (client.linkedTableIds) {
        for (const tId of client.linkedTableIds) {
          if (isTableFreeableBy(clients, clientId, tId)) {
            await supabase.from('event_tables').update({ status: TableStatus.AVAILABLE }).eq('id', tId);
          }
        }
      }

      const user = get().currentUser;
      get().logAction(user?.id || '', user?.firstName || 'STAFF', 'UNASSIGN', `Client ${client.name} retire de table`, 'normal');
    } catch (e) {
      secureError("[ERROR] [unassignClient] Error:", e);
    }
  },

  unlinkTableFromClient: async (clientId: string, tableId: string) => {
    const { currentEvent, clients, tables } = get();
    if (!currentEvent) return;
    const client = clients.find(c => c.id === clientId);
    if (!client) return;

    if (!client.linkedTableIds || !client.linkedTableIds.includes(tableId)) {
      secureLog("[WARN] [unlinkTableFromClient] Table non trouvee dans linkedTableIds");
      return;
    }

    try {
      const table = tables.find(t => t.id === tableId);
      logSync(`Deliaison table ${table?.number || tableId} du client ${client.name}`);

      const newLinkedTableIds = client.linkedTableIds.filter(id => id !== tableId);

      await supabase.from('clients').update({ linked_table_ids: newLinkedTableIds }).eq('id', clientId);
      await supabase.from('event_tables').update({ status: TableStatus.AVAILABLE }).eq('id', tableId);

      const user = get().currentUser;
      get().logAction(user?.id || '', user?.firstName || 'STAFF', 'UNLINK_TABLE', `Table ${table?.number || tableId} deliee de ${client.name}`, 'normal');
    } catch (e) {
      secureError("[ERROR] [unlinkTableFromClient] Error:", e);
    }
  },

  linkTableToClient: async (clientId: string, tableId: string) => {
    const { currentEvent, clients } = get();
    if (!currentEvent) return;
    const client = clients.find(c => c.id === clientId);
    if (!client) return;

    const currentLinks = client.linkedTableIds || [];
    if (currentLinks.includes(tableId)) return;

    try {
      logSync(`Liaison table ${tableId} -> client ${client.name}`);
      const newLinks = [...currentLinks, tableId];

      await supabase.from('clients').update({ linked_table_ids: newLinks }).eq('id', clientId);
      await supabase.from('event_tables').update({ status: TableStatus.OCCUPIED }).eq('id', tableId);
    } catch (e) {
      secureError("[ERROR] [linkTableToClient] Error:", e);
    }
  },

  transferClient: async (cId: string, tId: string) => {
    const { currentEvent, clients, orders } = get();
    if (!currentEvent) return false;
    const c = clients.find(cl => cl.id === cId);
    if (!c) return false;
    const oldTableId = c.tableId;

    try {
      logSync(`Transfert client ${c.name} vers table ${tId}`);

      if (oldTableId) {
        const otherClientsOnTable = clients.filter(cl => cl.id !== cId && cl.tableId === oldTableId && cl.status !== 'closed');
        if (otherClientsOnTable.length === 0) {
          await supabase.from('event_tables').update({ status: TableStatus.AVAILABLE }).eq('id', oldTableId);
        }
      }

      await supabase.from('clients').update({ table_id: tId }).eq('id', cId);
      await supabase.from('event_tables').update({ status: TableStatus.OCCUPIED }).eq('id', tId);

      // Update orders tableId
      const clientOrders = orders.filter(o => o.clientId === cId);
      for (const order of clientOrders) {
        await supabase.from('orders').update({ table_id: tId }).eq('id', order.id);
      }

      get().logAction(get().currentUser?.id || '', get().currentUser?.firstName || '', 'TRANSFER', `Client ${c.name} transfere vers ${tId}`);
      return true;
    } catch (e) {
      secureError("[ERROR] [transferClient] Error:", e);
      return false;
    }
  },

  handoverClient: async (cId: string, wId: string) => {
    const { currentEvent } = get();
    if (!currentEvent) return;
    try {
      logSync(`Handover client vers waiter ${wId}`);

      await supabase.from('clients').update({ waiter_id: wId }).eq('id', cId);

      // Update all orders for this client
      await supabase.from('orders').update({ waiter_id: wId }).eq('event_id', currentEvent.id).eq('client_id', cId);

      get().logAction(get().currentUser?.id || '', get().currentUser?.firstName || '', 'HANDOVER', `Client transfere`);
    } catch (e) {
      secureError("[ERROR] [handoverClient] Error:", e);
    }
  },

  settlePayment: async (cId: string) => {
    const { currentEvent, orders, clients } = get();
    if (!currentEvent) return;
    const c = clients.find(cl => cl.id === cId);
    if (!c) return;

    const pendingOrders = orders.filter(o => o.clientId === cId && o.status === OrderStatus.PENDING);
    if (pendingOrders.length > 0) {
      const pendingTotal = pendingOrders.reduce((acc, o) => acc + o.totalAmount, 0);
      secureLog(`[WARN] [settlePayment] Client ${c.name} a ${pendingOrders.length} commande(s) en attente (${pendingTotal.toFixed(0)}E)`);
      return;
    }

    try {
      logSync(`Reglement client ${c.name}`);
      const servedOrders = orders.filter(o => o.clientId === cId && o.status === OrderStatus.SERVED);
      const settledOrders = orders.filter(o => o.clientId === cId && o.status === OrderStatus.SETTLED);
      const total = servedOrders.reduce((acc, o) => acc + o.totalAmount, 0) + settledOrders.reduce((acc, o) => acc + o.totalAmount, 0);

      // Settle served orders
      for (const o of servedOrders) {
        await supabase.from('orders').update({ status: OrderStatus.SETTLED }).eq('id', o.id);
      }

      // Close client
      await supabase.from('clients').update({
        status: 'closed',
        total_spent: total,
        last_settled_at: new Date().toISOString(),
      }).eq('id', cId);

      // Free tables
      if (c.tableId) {
        if (isTableFreeableBy(clients, cId, c.tableId)) {
          logSync(`Liberation table principale ${c.tableId}`);
          await supabase.from('event_tables').update({ status: TableStatus.AVAILABLE }).eq('id', c.tableId);
        }
      }

      if (c.linkedTableIds && c.linkedTableIds.length > 0) {
        logSync(`Liberation tables liees: ${c.linkedTableIds.join(', ')}`);
        for (const tId of c.linkedTableIds) {
          if (isTableFreeableBy(clients, cId, tId)) {
            await supabase.from('event_tables').update({ status: TableStatus.AVAILABLE }).eq('id', tId);
          }
        }
      }

      await recalculateEventRevenue(currentEvent.id);

      logSync(`Client ${c.name} encaisse: ${total}E, tables liberees`);

      // Fire-and-forget Hub visit
      if (c.customerId) {
        const sOrders = orders.filter(o => o.clientId === cId && o.status === OrderStatus.SERVED);
        const allItems = sOrders.flatMap(o => o.items.map(i => ({
          productName: i.productName,
          size: i.size,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        })));
        writeVisitToHub({
          customerId: c.customerId,
          eventId: currentEvent.id,
          clientId: cId,
          amount: total,
          items: allItems,
        }).catch(err =>
          console.warn('[HubVisit] Non-blocking failure:', err.message)
        );
      }

    } catch (e) {
      secureError("[ERROR] [settlePayment] Error:", e);
    }
  },

  reopenClient: async (cId: string) => {
    const { currentEvent, clients, orders, currentUser } = get();
    if (!currentEvent) return;

    const client = clients.find(cl => cl.id === cId);
    if (!client) return;

    if (client.status !== 'closed') return;

    try {
      logSync(`Reouverture client ${client.name} par ${currentUser?.firstName || 'ADMIN'}`);

      await supabase.from('clients').update({ status: 'assigned' }).eq('id', cId);

      if (client.tableId) {
        const hasServedOrders = orders.some(
          o => o.clientId === cId && (o.status === OrderStatus.SERVED || o.status === OrderStatus.SETTLED)
        );
        const newTableStatus = hasServedOrders ? TableStatus.SERVED : TableStatus.OCCUPIED;
        await supabase.from('event_tables').update({ status: newTableStatus }).eq('id', client.tableId);
      }

      if (client.linkedTableIds && client.linkedTableIds.length > 0) {
        for (const tId of client.linkedTableIds) {
          await supabase.from('event_tables').update({ status: TableStatus.OCCUPIED }).eq('id', tId);
        }
      }

      get().logAction(
        currentUser?.id || '',
        currentUser?.firstName || 'ADMIN',
        'REOPEN_CLIENT',
        `Reouverture client: ${client.name} (table ${client.tableId || 'aucune'})`,
        'critical'
      );
    } catch (e) {
      secureError("[ERROR] [reopenClient] Error:", e);
    }
  },

});
