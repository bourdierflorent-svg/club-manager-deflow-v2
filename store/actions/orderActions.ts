import type { StoreGet, StoreSet } from '../types';
import type { OrderItem, RemovedOrderItem } from '../../src/types';
import {
  OrderStatus, TableStatus, UserRole,
  ReservationStatus, normalizeReservationStatus
} from '../../src/types';
import { secureLog, secureError } from '../../src/utils';
import { supabase } from '../../supabaseConfig';
import { logSync, recalculateEventRevenue } from '../helpers';

export const createOrderActions = (set: StoreSet, get: StoreGet) => ({

  createOrder: async (cId: string, tId: string, wId: string, items: OrderItem[], note?: string) => {
    const { currentEvent, currentUser, clients, clubId } = get();
    if (!currentEvent || !clubId) return;

    const client = clients.find(c => c.id === cId);
    if (!client) {
      secureLog(`[WARN] [createOrder] Client introuvable: ${cId}`);
      return;
    }

    if (client.status === 'closed') {
      secureLog(`[WARN] [createOrder] Client deja regle: ${client.name}`);
      return;
    }

    if (!client.tableId) {
      secureLog(`[WARN] [createOrder] Client sans table: ${client.name}`);
      return;
    }

    if (!client.waiterId) {
      secureLog(`[WARN] [createOrder] Client sans serveur: ${client.name}`);
      return;
    }

    if (tId && tId !== client.tableId) {
      secureLog(`[WARN] [createOrder] RACE CONDITION: Table changee pendant creation commande`);
      return;
    }

    const isAdmin = currentUser?.role === UserRole.ADMIN;
    const isManager = currentUser?.role === UserRole.MANAGER;
    const isAssignedWaiter = client.waiterId === currentUser?.id;

    if (!isAdmin && !isManager && wId && wId !== client.waiterId) {
      secureLog(`[WARN] [createOrder] RACE CONDITION: Serveur change pendant creation commande`);
      return;
    }

    if (!isAdmin && !isManager && !isAssignedWaiter) {
      secureLog(`[WARN] [createOrder] Permission refusee: ${currentUser?.firstName} n'est pas autorise pour ${client.name}`);
      return;
    }

    if (!items || items.length === 0) {
      secureLog(`[WARN] [createOrder] Tentative de commande vide pour ${client.name}`);
      return;
    }

    try {
      logSync(`Nouvelle commande pour client ${client.name} (table ${client.tableId})`);

      // Annotation commis/CDR : préfixer la note pour identifier l'auteur
      const isCommis = currentUser?.role === UserRole.COMMIS;
      const isCdrOnOtherClient = currentUser?.role === UserRole.WAITER && !isAssignedWaiter;
      const orderNote = isCommis
        ? `[COMMIS: ${currentUser?.firstName || 'Commis'}] ${note || ''}`.trim()
        : isCdrOnOtherClient
          ? `[CDR: ${currentUser?.firstName || 'CDR'}] ${note || ''}`.trim()
          : (note || '');

      const nowIso = new Date().toISOString();
      const order = {
        club_id: clubId,
        event_id: currentEvent.id,
        client_id: cId,
        table_id: client.tableId,
        waiter_id: client.waiterId,
        customer_id: client.customerId || null,
        items,
        note: orderNote,
        total_amount: items.reduce((acc, i) => acc + i.subtotal, 0),
        status: OrderStatus.SERVED,
        created_at: nowIso,
        validated_at: nowIso
      };
      const { error: insertError } = await supabase.from('orders').insert(order);
      if (insertError) {
        secureError("[ERROR] [createOrder] Insert error:", insertError);
        get().addNotification({ type: 'error', title: 'ERREUR', message: 'Commande non créée' });
        return;
      }

      // Auto-validation : table → SERVED
      if (client.tableId) {
        const { error: tableErr } = await supabase.from('event_tables')
          .update({ status: TableStatus.SERVED })
          .eq('id', client.tableId);
        if (tableErr) secureError("[WARN] [createOrder] Table status update error:", tableErr);
      }

      // Recalcul du CA de la soirée
      await recalculateEventRevenue(currentEvent.id);

      // Auto-confirmation : si le client vient d'une réservation, passer à CONFIRME
      if (client.reservationId) {
        const { allReservations } = get();
        const reservation = allReservations.find(r => r.id === client.reservationId);

        if (reservation) {
          const normalizedStatus = normalizeReservationStatus(reservation.status);
          if (normalizedStatus === ReservationStatus.EN_ATTENTE ||
              normalizedStatus === ReservationStatus.VENU) {
            const { error: confirmErr } = await supabase.from('reservations').update({
              status: ReservationStatus.CONFIRME,
              confirmed_at: nowIso
            }).eq('id', client.reservationId);
            if (confirmErr) {
              secureError("[ERROR] [createOrder] Auto-confirm error:", confirmErr);
            } else {
              logSync(`Reservation ${client.reservationId} auto-confirmée (1ère commande)`);
              get().addNotification({
                type: 'success',
                title: 'CLIENT CONFIRMÉ',
                message: `${client.name} a passé sa première commande`
              });
            }
          }
        }
      }
    } catch (e) {
      secureError("[ERROR] [createOrder] Error:", e);
      get().addNotification({ type: 'error', title: 'ERREUR', message: 'Commande non créée' });
    }
  },

  removeItemFromPendingOrder: async (orderId: string, itemId: string) => {
    const { currentEvent, orders } = get();
    if (!currentEvent) return;
    const order = orders.find(o => o.id === orderId);
    if (!order || order.status !== OrderStatus.PENDING) return;

    let updatedItems = [...order.items];
    const itemIndex = updatedItems.findIndex(i => i.id === itemId);
    if (itemIndex > -1) {
      const item = updatedItems[itemIndex];
      if (item.quantity > 1) {
        updatedItems[itemIndex] = { ...item, quantity: item.quantity - 1, subtotal: (item.quantity - 1) * item.unitPrice };
      } else {
        updatedItems.splice(itemIndex, 1);
      }

      if (updatedItems.length === 0) {
        await supabase.from('orders').update({
          status: OrderStatus.CANCELLED, cancel_reason: 'VIDE PAR MANAGER'
        }).eq('id', orderId);
      } else {
        const newTotal = updatedItems.reduce((acc, i) => acc + i.subtotal, 0);
        await supabase.from('orders').update({
          items: updatedItems, total_amount: newTotal
        }).eq('id', orderId);
      }
    }
  },

  removeItemFromServedOrder: async (orderId: string, itemId: string) => {
    const { currentEvent, orders, currentUser } = get();
    if (!currentEvent) return;
    const order = orders.find(o => o.id === orderId);
    if (!order || (order.status !== OrderStatus.SERVED && order.status !== OrderStatus.SETTLED)) return;

    let updatedItems = [...order.items];
    const itemIndex = updatedItems.findIndex(i => i.id === itemId);
    if (itemIndex > -1) {
      const item = updatedItems[itemIndex];
      let actionDetail = '';

      const existingRemovedItems = order.removedItems || [];
      let removedItem: RemovedOrderItem;

      if (item.quantity > 1) {
        updatedItems[itemIndex] = { ...item, quantity: item.quantity - 1, subtotal: (item.quantity - 1) * item.unitPrice };
        actionDetail = `Retrait 1 unite de ${item.productName}`;
        removedItem = {
          ...item, quantity: 1, subtotal: item.unitPrice,
          removedAt: new Date().toISOString(),
          removedBy: currentUser?.firstName || 'MANAGER'
        };
      } else {
        updatedItems.splice(itemIndex, 1);
        actionDetail = `Retrait article complet ${item.productName}`;
        removedItem = {
          ...item,
          removedAt: new Date().toISOString(),
          removedBy: currentUser?.firstName || 'MANAGER'
        };
      }

      const updatedRemovedItems = [...existingRemovedItems, removedItem];

      if (updatedItems.length === 0) {
        await supabase.from('orders').update({
          status: OrderStatus.CANCELLED,
          cancel_reason: 'TOUS ARTICLES RETIRES PAR MANAGER',
          items: updatedItems,
          total_amount: 0,
          removed_items: updatedRemovedItems
        }).eq('id', orderId);
      } else {
        const newTotal = updatedItems.reduce((acc, i) => acc + i.subtotal, 0);
        await supabase.from('orders').update({
          items: updatedItems,
          total_amount: newTotal,
          removed_items: updatedRemovedItems
        }).eq('id', orderId);
      }
      await recalculateEventRevenue(currentEvent.id);
      get().logAction(currentUser?.id || '', currentUser?.firstName || '', 'EDIT_SERVED_ORDER', actionDetail, 'high');
    }
  },

  updateServedItemPrice: async (orderId: string, itemId: string, newPrice: number, reason: string) => {
    const { currentEvent, orders, currentUser } = get();
    if (!currentEvent) return;
    const order = orders.find(o => o.id === orderId);
    if (!order || (order.status !== OrderStatus.SERVED && order.status !== OrderStatus.SETTLED)) return;

    if (newPrice < 0 || !isFinite(newPrice)) return;

    let updatedItems = [...order.items];
    const itemIndex = updatedItems.findIndex(i => i.id === itemId);
    if (itemIndex > -1) {
      const item = updatedItems[itemIndex];
      const oldPrice = item.unitPrice;
      const newSubtotal = newPrice * item.quantity;
      updatedItems[itemIndex] = {
        ...item,
        unitPrice: newPrice,
        subtotal: newSubtotal,
        originalPrice: item.originalPrice || item.unitPrice,
      };
      const newTotal = updatedItems.reduce((acc, i) => acc + i.subtotal, 0);

      await supabase.from('orders').update({
        items: updatedItems, total_amount: newTotal
      }).eq('id', orderId);

      await recalculateEventRevenue(currentEvent.id);
      const actionLabel = newPrice === 0 ? 'OFFERT' : 'UPDATE_PRICE';
      const detail = newPrice === 0
        ? `${item.productName} OFFERT (valeur: ${oldPrice}E). Raison: ${reason.toUpperCase()}`
        : `Prix ${item.productName} modifie : ${oldPrice}E -> ${newPrice}E. Raison: ${reason.toUpperCase()}`;
      get().logAction(currentUser?.id || '', currentUser?.firstName || '', actionLabel, detail, 'high');
    }
  },

  validateOrder: async (oId: string, correctedPrices?: { itemId: string, price: number }[]) => {
    const { currentEvent, orders } = get();
    if (!currentEvent) return;
    const order = orders.find(o => o.id === oId);
    if (!order) return;
    if (order.status !== OrderStatus.PENDING) return;

    try {
      logSync(`Validation commande ${oId}`);
      let updatedItems = [...order.items];
      if (correctedPrices && correctedPrices.length > 0) {
        updatedItems = order.items.map(item => {
          const correction = correctedPrices.find(c => c.itemId === item.id);
          if (correction) {
            const newUnitPrice = isNaN(correction.price) ? item.unitPrice : correction.price;
            const newSubtotal = newUnitPrice * item.quantity;
            return { ...item, unitPrice: newUnitPrice, subtotal: newSubtotal };
          }
          return item;
        });
      }
      const updatedTotal = updatedItems.reduce((acc, i) => acc + i.subtotal, 0);

      const { error: updateError } = await supabase.from('orders').update({
        status: OrderStatus.SERVED,
        validated_at: new Date().toISOString(),
        items: updatedItems,
        total_amount: updatedTotal
      }).eq('id', oId);
      if (updateError) {
        secureError('[validateOrder] Update failed:', updateError);
        return;
      }

      if (order.tableId) {
        await supabase.from('event_tables').update({ status: TableStatus.SERVED }).eq('id', order.tableId);
      }

      await recalculateEventRevenue(currentEvent.id);

      // --- Stock auto-decrement ---
      const { stockItems } = get();
      if (stockItems.length > 0) {
        const stockDecrements = updatedItems
          .filter(item => item.productId && item.size)
          .map(item => {
            const stockItemId = `${item.productId}_${item.size}`;
            const stockItem = stockItems.find(si => si.id === stockItemId);
            if (!stockItem) return null;
            return get().createStockMovement({
              stockItemId,
              type: 'vip_order',
              quantity: item.quantity,
              direction: 'out',
              orderId: oId,
            }).catch(err => {
              secureError(`Stock ignore pour ${stockItemId}:`, err);
            });
          })
          .filter(Boolean);

        if (stockDecrements.length > 0) {
          await Promise.allSettled(stockDecrements);
        }
      }
    } catch (e) {
      secureError("[ERROR] [validateOrder] Error:", e);
    }
  },

  cancelOrder: async (oId: string, reason: string) => {
    const { currentEvent, orders, clients } = get();
    if (currentEvent) {
      const order = orders.find(o => o.id === oId);
      if (!order || order.status === OrderStatus.CANCELLED) return;
      try {
        const { error: cancelError } = await supabase.from('orders').update({
          status: OrderStatus.CANCELLED,
          cancel_reason: reason.toUpperCase()
        }).eq('id', oId);
        if (cancelError) {
          secureError('[cancelOrder] Update failed:', cancelError);
          return;
        }

        await recalculateEventRevenue(currentEvent.id);

        // Recheck table status after cancelling a served/settled order
        if ((order.status === OrderStatus.SERVED || order.status === OrderStatus.SETTLED) && order.tableId) {
          const remainingServed = orders.some(o =>
            o.id !== oId && o.tableId === order.tableId &&
            (o.status === OrderStatus.SERVED || o.status === OrderStatus.SETTLED)
          );
          if (!remainingServed) {
            const hasActiveClient = clients.some(c =>
              c.tableId === order.tableId && c.status !== 'closed'
            );
            const newStatus = hasActiveClient ? TableStatus.OCCUPIED : TableStatus.AVAILABLE;
            await supabase.from('event_tables').update({ status: newStatus }).eq('id', order.tableId);
          }
        }

        // --- Stock auto-reincrement ---
        if (order && (order.status === OrderStatus.SERVED || order.status === OrderStatus.SETTLED)) {
          const { stockItems } = get();
          if (stockItems.length > 0) {
            const stockIncrements = order.items
              .filter(item => item.productId && item.size)
              .map(item => {
                const stockItemId = `${item.productId}_${item.size}`;
                const stockItem = stockItems.find(si => si.id === stockItemId);
                if (!stockItem) return null;
                return get().createStockMovement({
                  stockItemId,
                  type: 'vip_order_cancel',
                  quantity: item.quantity,
                  direction: 'in',
                  orderId: oId,
                }).catch(err => {
                  secureError(`Stock reincrement ignore pour ${stockItemId}:`, err);
                });
              })
              .filter(Boolean);

            if (stockIncrements.length > 0) {
              await Promise.allSettled(stockIncrements);
            }
          }
        }
      } catch (e) {
        secureError("[ERROR] [cancelOrder] Error:", e);
      }
    }
  },

});
