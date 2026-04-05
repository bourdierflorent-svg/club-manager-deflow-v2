import type { StoreGet, StoreSet } from '../types';
import type { CreateReservationData, Reservation } from '../../src/types';
import { ReservationStatus, normalizeReservationStatus } from '../../src/types';
import {
  validateName, validatePhone, validateNote,
  secureLog, secureError
} from '../../src/utils';
import { supabase } from '../../supabaseConfig';
import { logSync } from '../helpers';

export const createReservationActions = (set: StoreSet, get: StoreGet) => ({

  createReservation: async (data: CreateReservationData) => {
    const { currentUser, clubId } = get();
    if (!clubId) return;

    const nameValidation = validateName(data.clientName);
    if (!nameValidation.valid) return;

    let sanitizedProvider = '';
    if (data.businessProvider && data.businessProvider.trim()) {
      const providerValidation = validateName(data.businessProvider);
      if (!providerValidation.valid) return;
      sanitizedProvider = providerValidation.sanitized || '';
    }

    const phoneValidation = validatePhone(data.phoneNumber || '');
    if (!phoneValidation.valid) return;

    const notesValidation = validateNote(data.notes || '');
    if (!notesValidation.valid) return;

    const tablePrefValidation = validateNote(data.tablePreference || '');
    if (!tablePrefValidation.valid) return;

    try {
      secureLog(`Creation reservation: ${nameValidation.sanitized} pour le ${data.date}`);

      const reservation = {
        club_id: clubId,
        client_name: nameValidation.sanitized || data.clientName.toUpperCase(),
        business_provider: sanitizedProvider,
        date: data.date,
        time: data.time || null,
        number_of_guests: data.numberOfGuests || 1,
        notes: notesValidation.sanitized || null,
        table_preference: tablePrefValidation.sanitized || null,
        phone_number: phoneValidation.sanitized || null,
        status: ReservationStatus.EN_ATTENTE,
        created_at: new Date().toISOString(),
        created_by_id: currentUser?.id || null,
        created_by_name: currentUser?.firstName || 'ADMIN',
      };

      const { data: insertedResa, error: resaError } = await supabase
        .from('reservations')
        .insert(reservation)
        .select('id')
        .single();
      if (resaError || !insertedResa) {
        secureError('[createReservation] Insert failed:', resaError);
        return;
      }
      const reservationId = insertedResa.id;

      const { currentEvent } = get();

      if (currentEvent && data.date === currentEvent.date) {
        const newClient = {
          club_id: clubId,
          event_id: currentEvent.id,
          name: nameValidation.sanitized || data.clientName.toUpperCase(),
          business_provider: sanitizedProvider,
          table_id: null,
          waiter_id: null,
          status: 'pending',
          total_spent: 0,
          arrival_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          created_by_id: currentUser?.id || null,
          created_by_name: currentUser?.firstName || 'ADMIN',
          from_reservation: true,
          reservation_id: reservationId,
          number_of_guests: data.numberOfGuests || 1,
          phone_number: phoneValidation.sanitized || null,
          notes: notesValidation.sanitized || null,
        };

        const { error: clientError } = await supabase.from('clients').insert(newClient);
        if (clientError) {
          secureError('[createReservation] Client insert failed:', clientError);
        }

        secureLog(`Client cree depuis reservation: ${nameValidation.sanitized}`);
      }

      secureLog(`Reservation creee: ${nameValidation.sanitized}`);

      get().logAction(
        currentUser?.id || '',
        currentUser?.firstName || 'ADMIN',
        'CREATE_RESERVATION',
        `Reservation: ${nameValidation.sanitized} pour le ${data.date}${currentEvent && data.date === currentEvent.date ? ' (+ client Live)' : ''}`,
        'normal'
      );

    } catch (e) {
      secureError('[createReservation] Error:', e);
    }
  },

  updateReservation: async (id: string, data: Partial<Reservation>) => {
    const sanitizedData: Record<string, unknown> = {};

    if (data.clientName) {
      const nameValidation = validateName(data.clientName);
      if (!nameValidation.valid) return;
      sanitizedData.client_name = nameValidation.sanitized;
    }

    if (data.businessProvider) {
      const providerValidation = validateName(data.businessProvider);
      if (!providerValidation.valid) return;
      sanitizedData.business_provider = providerValidation.sanitized;
    }

    if (data.phoneNumber !== undefined) {
      const phoneValidation = validatePhone(data.phoneNumber || '');
      if (!phoneValidation.valid) return;
      sanitizedData.phone_number = phoneValidation.sanitized;
    }

    if (data.notes !== undefined) {
      const notesValidation = validateNote(data.notes || '');
      if (!notesValidation.valid) return;
      sanitizedData.notes = notesValidation.sanitized;
    }

    try {
      // Build the Supabase update payload, converting camelCase -> snake_case for other fields
      const { clientName, businessProvider, phoneNumber, notes, ...otherData } = data;
      const snakeOther: Record<string, unknown> = {};
      if (otherData.date !== undefined) snakeOther.date = otherData.date;
      if (otherData.time !== undefined) snakeOther.time = otherData.time;
      if (otherData.numberOfGuests !== undefined) snakeOther.number_of_guests = otherData.numberOfGuests;
      if (otherData.tablePreference !== undefined) snakeOther.table_preference = otherData.tablePreference;
      if (otherData.status !== undefined) snakeOther.status = otherData.status;

      await supabase.from('reservations').update({
        ...snakeOther,
        ...sanitizedData,
      }).eq('id', id);

      // Sync to live client if evening active
      const { currentEvent, clients } = get();
      if (currentEvent) {
        const linkedClient = clients.find(c => c.reservationId === id);
        if (linkedClient) {
          const clientUpdate: Record<string, unknown> = {};
          if (sanitizedData.client_name) clientUpdate.name = sanitizedData.client_name;
          if (sanitizedData.business_provider !== undefined) clientUpdate.business_provider = sanitizedData.business_provider;
          if (Object.keys(clientUpdate).length > 0) {
            await supabase.from('clients').update(clientUpdate).eq('id', linkedClient.id);
            // Optimistic local update
            set({
              clients: clients.map(c =>
                c.id === linkedClient.id ? { ...c, ...(sanitizedData.client_name ? { name: sanitizedData.client_name as string } : {}), ...(sanitizedData.business_provider !== undefined ? { businessProvider: sanitizedData.business_provider as string } : {}) } as typeof c : c
              )
            });
          }
        }
      }

      logSync(`Reservation ${id} mise a jour`);
    } catch (e) {
      secureError("[ERROR] [updateReservation] Error:", e);
    }
  },

  markReservationArrived: async (id: string) => {
    const { currentUser, allReservations } = get();
    const reservation = allReservations.find(r => r.id === id);

    if (!reservation) return;

    const normalizedStatus = normalizeReservationStatus(reservation.status);
    if (normalizedStatus !== ReservationStatus.EN_ATTENTE) return;

    try {
      await supabase.from('reservations').update({
        status: ReservationStatus.CONFIRME,
        arrived_at: new Date().toISOString()
      }).eq('id', id);

      logSync(`Reservation ${id} - client arrive`);

      get().logAction(
        currentUser?.id || '',
        currentUser?.firstName || 'STAFF',
        'MARK_ARRIVED',
        `Client arrive: ${reservation.clientName}`,
        'normal'
      );
    } catch (e) {
      secureError("[ERROR] [markReservationArrived] Error:", e);
    }
  },

  markReservationRefused: async (id: string) => {
    const { currentUser, allReservations } = get();
    const reservation = allReservations.find(r => r.id === id);
    if (!reservation) return;

    try {
      await supabase.from('reservations').update({
        status: ReservationStatus.RECALE,
        refused_at: new Date().toISOString()
      }).eq('id', id);

      logSync(`Reservation ${id} - client recale`);

      get().logAction(
        currentUser?.id || '',
        currentUser?.firstName || 'STAFF',
        'MARK_REFUSED',
        `Client recale: ${reservation.clientName}`,
        'normal'
      );
    } catch (e) {
      secureError("[ERROR] [markReservationRefused] Error:", e);
    }
  },

  markReservationVenu: async (id: string) => {
    const { currentUser, allReservations } = get();
    const reservation = allReservations.find(r => r.id === id);
    if (!reservation) return;

    const normalizedStatus = normalizeReservationStatus(reservation.status);
    if (normalizedStatus !== ReservationStatus.CONFIRME) return;

    try {
      await supabase.from('reservations').update({
        status: ReservationStatus.VENU,
        confirmed_at: new Date().toISOString()
      }).eq('id', id);

      logSync(`Reservation ${id} - client a commande (venu)`);

      get().logAction(
        currentUser?.id || '',
        currentUser?.firstName || 'STAFF',
        'MARK_VENU',
        `Client venu (a commande): ${reservation.clientName}`,
        'normal'
      );
    } catch (e) {
      secureError("[ERROR] [markReservationVenu] Error:", e);
    }
  },

  markReservationNoShow: async (id: string) => {
    const { currentUser, allReservations } = get();
    const reservation = allReservations.find(r => r.id === id);
    if (!reservation) return;

    try {
      await supabase.from('reservations').update({
        status: ReservationStatus.NO_SHOW,
        no_show_at: new Date().toISOString()
      }).eq('id', id);

      logSync(`Reservation ${id} marquee NO_SHOW`);

      get().logAction(
        currentUser?.id || '',
        currentUser?.firstName || 'STAFF',
        'NOSHOW_RESERVATION',
        `Non venu: ${reservation.clientName}`,
        'normal'
      );
    } catch (e) {
      secureError("[ERROR] [markReservationNoShow] Error:", e);
    }
  },

  deleteReservation: async (id: string) => {
    const { currentUser, currentEvent, clients, allReservations } = get();
    const reservation = allReservations.find(r => r.id === id);

    try {
      // Delete linked live client if evening active
      if (currentEvent) {
        const linkedClient = clients.find(c => c.reservationId === id);
        if (linkedClient) {
          if (linkedClient.tableId) {
            await supabase.from('event_tables').update({ status: 'available' }).eq('id', linkedClient.tableId);
          }
          await supabase.from('clients').delete().eq('id', linkedClient.id);
          logSync(`Client Live ${linkedClient.name} supprime (lie a resa ${id})`);
        }
      }

      await supabase.from('reservations').delete().eq('id', id);

      logSync(`Reservation ${id} supprimee definitivement`);

      get().logAction(
        currentUser?.id || '',
        currentUser?.firstName || 'ADMIN',
        'DELETE_RESERVATION',
        `Suppression: ${reservation?.clientName || id}`,
        'high'
      );
    } catch (e) {
      secureError("[ERROR] [deleteReservation] Error:", e);
    }
  },

  getReservationsForDate: (date: string) => {
    const { allReservations } = get();
    return allReservations.filter(r => {
      const normalizedStatus = normalizeReservationStatus(r.status);
      return r.date === date &&
        (normalizedStatus === ReservationStatus.EN_ATTENTE || normalizedStatus === ReservationStatus.CONFIRME || normalizedStatus === ReservationStatus.VENU);
    });
  },

});
