import type { StoreGet, StoreSet } from '../types';
import type { Table } from '../../src/types';
import { TableStatus } from '../../src/types';
import { secureLog, secureError } from '../../src/utils';
import { supabase } from '../../supabaseConfig';
import { logSync } from '../helpers';

export const createTableActions = (set: StoreSet, get: StoreGet) => ({

  updateTableStatus: async (id: string, status: TableStatus) => {
    const { currentEvent } = get();
    if (!currentEvent) {
      secureLog("[WARN] [updateTableStatus] Pas d'event actif");
      return;
    }
    try {
      await supabase.from('event_tables').update({ status }).eq('id', id);
      logSync(`Table ${id} -> ${status}`);
    } catch (e) {
      secureError("[ERROR] [updateTableStatus] Error:", e);
    }
  },

  updateTablePosition: async (id: string, x: number, y: number) => {
    const { currentEvent } = get();
    if (!currentEvent) return;
    try {
      await supabase.from('event_tables').update({ position_x: x, position_y: y }).eq('id', id);
    } catch (e) {
      secureError("[ERROR] [updateTablePosition] Error:", e);
    }
  },

  freeTable: async (tableId: string) => {
    const { currentEvent, clients } = get();
    if (!currentEvent) return;

    try {
      logSync(`Liberation table ${tableId}`);
      const allClientsOnTable = clients.filter(c =>
        c.tableId === tableId || (c.linkedTableIds && c.linkedTableIds.includes(tableId))
      );

      for (const c of allClientsOnTable) {
        if (c.tableId === tableId) {
          await supabase.from('clients').update({ table_id: '', linked_table_ids: [] }).eq('id', c.id);
          if (c.linkedTableIds) {
            for (const tId of c.linkedTableIds) {
              const otherOnLinked = clients.filter(cl =>
                cl.id !== c.id &&
                (cl.tableId === tId || (cl.linkedTableIds && cl.linkedTableIds.includes(tId)))
              );
              if (otherOnLinked.length === 0) {
                await supabase.from('event_tables').update({ status: TableStatus.AVAILABLE }).eq('id', tId);
              }
            }
          }
        } else if (c.linkedTableIds && c.linkedTableIds.includes(tableId)) {
          const newLinked = c.linkedTableIds.filter(tId => tId !== tableId);
          await supabase.from('clients').update({ linked_table_ids: newLinked }).eq('id', c.id);
        }
      }

      await supabase.from('event_tables').update({ status: TableStatus.AVAILABLE }).eq('id', tableId);
    } catch (e) {
      secureError("[ERROR] [freeTable] Error:", e);
    }
  },

  addTable: async (newTable: Table) => {
    const { currentEvent, clubId } = get();
    if (!currentEvent || !clubId) return;
    try {
      await supabase.from('event_tables').upsert({
        id: newTable.id,
        club_id: clubId,
        event_id: currentEvent.id,
        number: newTable.number,
        capacity: newTable.capacity,
        type: newTable.type,
        status: newTable.status || 'available',
        position_x: newTable.positionX || 0,
        position_y: newTable.positionY || 0,
        zone: newTable.zone || '',
      });
      const user = get().currentUser;
      get().logAction(user?.id || '', user?.firstName || 'ADMIN', 'ADD_TABLE', `Ajout table ${newTable.number} a chaud`, 'high');
    } catch (e) {
      secureError("[ERROR] [addTable] Error:", e);
    }
  },

});
