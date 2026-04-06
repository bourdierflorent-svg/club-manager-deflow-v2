/**
 * 📁 hooks/useClientActions.ts
 * Hook pour les actions sur les clients
 * 
 * @description Centralise toutes les actions liées aux clients avec
 * les callbacks mémorisés et la gestion des erreurs.
 */

import { useCallback } from 'react';
import { useStore } from '../../store';
import { Client, OrderStatus } from '../types';
import { ERROR_MESSAGES, CONFIRM_MESSAGES } from '../utils';

// ============================================
// 📝 TYPES
// ============================================

export interface UseClientActionsReturn {
  /** Créer un nouveau client */
  handleCreateClient: (
    name: string,
    apporteur?: string,
    tableId?: string,
    waiterId?: string
  ) => Promise<void>;
  
  /** Assigner un client à une table et un serveur */
  handleAssignClient: (
    clientId: string, 
    tableId: string, 
    waiterId: string
  ) => Promise<boolean>;
  
  /** Transférer un client vers une autre table */
  handleTransferClient: (
    clientId: string, 
    newTableId: string
  ) => Promise<boolean>;
  
  /** Transférer un client vers un autre serveur */
  handleHandoverClient: (
    clientId: string, 
    newWaiterId: string
  ) => Promise<void>;
  
  /** Lier une table supplémentaire à un client */
  handleLinkTable: (
    clientId: string, 
    tableId: string
  ) => Promise<void>;
  
  /** Délier une table annexe d'un client */
  handleUnlinkTable: (
    clientId: string, 
    tableId: string
  ) => Promise<void>;
  
  /** Désassigner un client de sa table */
  handleUnassignClient: (
    clientId: string,
    skipConfirm?: boolean
  ) => Promise<void>;
  
  /** Supprimer un client */
  handleDeleteClient: (
    clientId: string,
    skipConfirm?: boolean
  ) => Promise<boolean>;
  
  /** Régler le paiement d'un client */
  handleSettlePayment: (clientId: string) => Promise<void>;
  
  /** Libérer la table d'un client */
  handleFreeTable: (
    tableId: string,
    skipConfirm?: boolean
  ) => Promise<void>;
  
  /** Mettre à jour le nom d'un client */
  handleUpdateClientName: (
    clientId: string, 
    newName: string
  ) => Promise<void>;
  
  /** Vérifier si un client peut être supprimé */
  canDeleteClient: (clientId: string) => boolean;
  
  /** Vérifier si un client a des commandes servies */
  hasServedOrders: (clientId: string) => boolean;
}

// ============================================
// 🎣 HOOK PRINCIPAL
// ============================================

/**
 * Hook pour les actions sur les clients
 * 
 * @example
 * const { 
 *   handleCreateClient, 
 *   handleTransferClient,
 *   canDeleteClient 
 * } = useClientActions();
 * 
 * // Créer un client
 * handleCreateClient('DUPONT', 'PROMO1', 'table-1', 'waiter-1');
 * 
 * // Transférer
 * const success = await handleTransferClient('client-1', 'table-2');
 */
export const useClientActions = (): UseClientActionsReturn => {
  // Store actions
  const createClient = useStore(state => state.createClient);
  const assignClient = useStore(state => state.assignClient);
  const transferClient = useStore(state => state.transferClient);
  const handoverClient = useStore(state => state.handoverClient);
  const linkTableToClient = useStore(state => state.linkTableToClient);
  const unlinkTableFromClient = useStore(state => state.unlinkTableFromClient);
  const unassignClient = useStore(state => state.unassignClient);
  const removeClient = useStore(state => state.removeClient);
  const settlePayment = useStore(state => state.settlePayment);
  const freeTable = useStore(state => state.freeTable);
  const updateClientName = useStore(state => state.updateClientName);
  const addNotification = useStore(state => state.addNotification);
  
  // Store data
  const orders = useStore(state => state.orders);
  const clients = useStore(state => state.clients);

  /**
   * Vérifier si un client a des commandes servies
   */
  const hasServedOrders = useCallback((clientId: string): boolean => {
    return orders.some(
      o => o.clientId === clientId && (o.status === OrderStatus.SERVED || o.status === OrderStatus.SETTLED)
    );
  }, [orders]);

  /**
   * Vérifier si un client peut être supprimé
   */
  const canDeleteClient = useCallback((clientId: string): boolean => {
    return !hasServedOrders(clientId);
  }, [hasServedOrders]);

  /**
   * Créer un nouveau client
   */
  const handleCreateClient = useCallback(async (
    name: string,
    apporteur?: string,
    tableId?: string,
    waiterId?: string
  ) => {
    if (!name.trim()) {
      addNotification({
        type: 'error',
        title: 'ERREUR',
        message: 'Le nom du client est requis',
      });
      return;
    }

    try {
      await createClient(name, apporteur, tableId, waiterId);
    } catch {
      addNotification({ type: 'error', title: 'ERREUR', message: 'Action échouée' });
    }
  }, [createClient, addNotification]);

  /**
   * Assigner un client à une table et un serveur
   */
  const handleAssignClient = useCallback(async (
    clientId: string,
    tableId: string,
    waiterId: string
  ): Promise<boolean> => {
    if (!clientId || !tableId || !waiterId) {
      addNotification({
        type: 'error',
        title: 'ERREUR',
        message: 'Veuillez sélectionner une table et un serveur',
      });
      return false;
    }
    
    const success = await assignClient(clientId, tableId, waiterId);
    if (!success) {
      addNotification({
        type: 'error',
        title: 'ASSIGNATION IMPOSSIBLE',
        message: 'La table est déjà occupée ou une erreur est survenue',
      });
    }
    return success;
  }, [assignClient, addNotification]);

  /**
   * Transférer un client vers une autre table
   */
  const handleTransferClient = useCallback(async (
    clientId: string,
    newTableId: string
  ): Promise<boolean> => {
    if (!clientId || !newTableId) {
      addNotification({
        type: 'error',
        title: 'ERREUR',
        message: 'Veuillez sélectionner une table',
      });
      return false;
    }
    
    return await transferClient(clientId, newTableId);
  }, [transferClient, addNotification]);

  /**
   * Transférer un client vers un autre serveur
   */
  const handleHandoverClient = useCallback(async (
    clientId: string,
    newWaiterId: string
  ): Promise<void> => {
    if (!clientId || !newWaiterId) {
      addNotification({
        type: 'error',
        title: 'ERREUR',
        message: 'Veuillez sélectionner un serveur',
      });
      return;
    }
    
    await handoverClient(clientId, newWaiterId);
  }, [handoverClient, addNotification]);

  /**
   * Lier une table supplémentaire à un client
   */
  const handleLinkTable = useCallback(async (
    clientId: string,
    tableId: string
  ): Promise<void> => {
    if (!clientId || !tableId) {
      addNotification({
        type: 'error',
        title: 'ERREUR',
        message: 'Veuillez sélectionner une table',
      });
      return;
    }
    
    await linkTableToClient(clientId, tableId);
  }, [linkTableToClient, addNotification]);

  /**
   * Délier une table annexe d'un client
   */
  const handleUnlinkTable = useCallback(async (
    clientId: string,
    tableId: string
  ): Promise<void> => {
    if (!clientId || !tableId) {
      addNotification({
        type: 'error',
        title: 'ERREUR',
        message: 'Paramètres manquants pour délier la table',
      });
      return;
    }
    
    await unlinkTableFromClient(clientId, tableId);
  }, [unlinkTableFromClient, addNotification]);

  /**
   * Désassigner un client de sa table
   */
  const handleUnassignClient = useCallback(async (
    clientId: string,
    skipConfirm: boolean = false
  ): Promise<void> => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;
    
    if (!skipConfirm) {
      const confirmed = window.confirm(
        CONFIRM_MESSAGES.UNASSIGN_CLIENT(client.name)
      );
      if (!confirmed) return;
    }
    
    await unassignClient(clientId);
  }, [clients, unassignClient]);

  /**
   * Supprimer un client
   */
  const handleDeleteClient = useCallback(async (
    clientId: string,
    skipConfirm: boolean = false
  ): Promise<boolean> => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return false;
    
    // Vérifier si suppression possible
    if (!canDeleteClient(clientId)) {
      addNotification({
        type: 'error',
        title: 'ACTION IMPOSSIBLE',
        message: ERROR_MESSAGES.CLIENT_HAS_ORDERS,
      });
      return false;
    }
    
    if (!skipConfirm) {
      const confirmed = window.confirm(CONFIRM_MESSAGES.DELETE_CLIENT(client.name));
      if (!confirmed) return false;
    }
    
    await removeClient(clientId);
    return true;
  }, [clients, canDeleteClient, removeClient, addNotification]);

  /**
   * Régler le paiement d'un client
   */
  const handleSettlePayment = useCallback(async (clientId: string) => {
    if (!clientId) return;
    try {
      await settlePayment(clientId);
    } catch {
      addNotification({ type: 'error', title: 'ERREUR', message: 'Action échouée' });
    }
  }, [settlePayment, addNotification]);

  /**
   * Libérer la table d'un client
   */
  const handleFreeTable = useCallback(async (
    tableId: string,
    skipConfirm: boolean = false
  ): Promise<void> => {
    if (!tableId) return;
    
    if (!skipConfirm) {
      const confirmed = window.confirm(CONFIRM_MESSAGES.FREE_TABLE);
      if (!confirmed) return;
    }
    
    await freeTable(tableId);
  }, [freeTable]);

  /**
   * Mettre à jour le nom d'un client
   */
  const handleUpdateClientName = useCallback(async (
    clientId: string,
    newName: string
  ): Promise<void> => {
    if (!clientId || !newName.trim()) return;
    await updateClientName(clientId, newName);
  }, [updateClientName]);

  return {
    handleCreateClient,
    handleAssignClient,
    handleTransferClient,
    handleHandoverClient,
    handleLinkTable,
    handleUnlinkTable,
    handleUnassignClient,
    handleDeleteClient,
    handleSettlePayment,
    handleFreeTable,
    handleUpdateClientName,
    canDeleteClient,
    hasServedOrders,
  };
};

// ============================================
// 🎣 HOOKS SPÉCIALISÉS
// ============================================

/**
 * Hook pour les actions spécifiques au serveur sur ses clients
 */
export const useWaiterClientActions = () => {
  const currentUser = useStore(state => state.currentUser);
  const clients = useStore(state => state.clients);
  const clientActions = useClientActions();
  
  /**
   * Créer un client directement assigné au serveur courant
   */
  const createMyClient = useCallback((
    name: string,
    apporteur?: string
  ) => {
    if (!currentUser) return;
    clientActions.handleCreateClient(name, apporteur, undefined, currentUser.id);
  }, [currentUser, clientActions]);
  
  /**
   * Vérifier si un client m'appartient
   */
  const isMyClient = useCallback((clientId: string): boolean => {
    const client = clients.find(c => c.id === clientId);
    return client?.waiterId === currentUser?.id;
  }, [clients, currentUser]);
  
  return {
    ...clientActions,
    createMyClient,
    isMyClient,
    currentUserId: currentUser?.id,
  };
};
