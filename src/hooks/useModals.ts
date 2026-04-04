/**
 * 📁 hooks/useModals.ts
 * Hook pour la gestion centralisée des modals
 * 
 * @description Remplace les 7-10 useState par dashboard par un seul hook.
 * Permet d'avoir au maximum une modal ouverte à la fois et de passer
 * des données contextuelles.
 * 
 * @example
 * const { modal, openModal, closeModal, isOpen } = useModals();
 * 
 * // Ouvrir une modal avec des données
 * openModal('clientDetail', { client: selectedClient });
 * 
 * // Vérifier si une modal spécifique est ouverte
 * if (isOpen('clientDetail')) { ... }
 * 
 * // Fermer la modal
 * closeModal();
 */

import { useState, useCallback, useMemo } from 'react';
import { Client, Table, User, Order } from '../types';

// ============================================
// 📝 TYPES
// ============================================

/**
 * Types de modals disponibles dans l'application
 */
export type ModalType = 
  // Modals Client
  | 'newClient'
  | 'clientDetail'
  | 'editClient'
  | 'deleteClient'
  // Modals Assignation
  | 'assignClient'
  | 'transferClient'
  | 'handoverClient'
  | 'linkTable'
  | 'unassignClient'
  // Modals Commande
  | 'newOrder'
  | 'orderDetail'
  | 'validateOrder'
  | 'cancelOrder'
  // Modals Table
  | 'freeTable'
  | 'addTable'
  // Modals Utilisateur
  | 'newUser'
  | 'editUser'
  | 'deleteUser'
  // Modals Soirée
  | 'startEvening'
  | 'closeEvening'
  // Modals Divers
  | 'confirm'
  | 'export'
  | 'archiveDetail';

/**
 * Données contextuelles possibles pour les modals
 */
export interface ModalData {
  // Client
  client?: Client;
  clientId?: string;
  clientName?: string;
  // Table
  table?: Table;
  tableId?: string;
  // User
  user?: User;
  userId?: string;
  // Order
  order?: Order;
  orderId?: string;
  // Confirmation
  confirmTitle?: string;
  confirmMessage?: string;
  confirmAction?: () => void | Promise<void>;
  confirmDanger?: boolean;
  // Archive
  eventId?: string;
  // Divers
  preSelectedTableId?: string;
  preSelectedWaiterId?: string;
  [key: string]: any;
}

/**
 * État de la modal
 */
export interface ModalState {
  type: ModalType | null;
  data: ModalData;
  isOpen: boolean;
}

/**
 * Retour du hook useModals
 */
export interface UseModalsReturn {
  /** État actuel de la modal */
  modal: ModalState;
  /** Ouvre une modal avec des données optionnelles */
  openModal: (type: ModalType, data?: ModalData) => void;
  /** Ferme la modal actuelle */
  closeModal: () => void;
  /** Vérifie si une modal spécifique est ouverte */
  isOpen: (type: ModalType) => boolean;
  /** Vérifie si une modal quelconque est ouverte */
  isAnyOpen: boolean;
  /** Données de la modal actuelle */
  data: ModalData;
  /** Type de la modal actuelle */
  currentType: ModalType | null;
}

// ============================================
// 🎣 HOOK PRINCIPAL
// ============================================

/**
 * Hook pour gérer les modals de façon centralisée
 * 
 * @returns Objet avec les méthodes et état de la modal
 */
export const useModals = (): UseModalsReturn => {
  const [modal, setModal] = useState<ModalState>({
    type: null,
    data: {},
    isOpen: false,
  });

  /**
   * Ouvre une modal avec des données optionnelles
   */
  const openModal = useCallback((type: ModalType, data: ModalData = {}) => {
    setModal({
      type,
      data,
      isOpen: true,
    });
  }, []);

  /**
   * Ferme la modal actuelle et reset les données
   */
  const closeModal = useCallback(() => {
    setModal({
      type: null,
      data: {},
      isOpen: false,
    });
  }, []);

  /**
   * Vérifie si une modal spécifique est ouverte
   */
  const isOpen = useCallback((type: ModalType): boolean => {
    return modal.isOpen && modal.type === type;
  }, [modal.isOpen, modal.type]);

  /**
   * Valeurs mémorisées pour éviter les re-renders
   */
  const isAnyOpen = useMemo(() => modal.isOpen, [modal.isOpen]);
  const data = useMemo(() => modal.data, [modal.data]);
  const currentType = useMemo(() => modal.type, [modal.type]);

  return {
    modal,
    openModal,
    closeModal,
    isOpen,
    isAnyOpen,
    data,
    currentType,
  };
};

// ============================================
// 🎣 HOOKS SPÉCIALISÉS
// ============================================

/**
 * Hook simplifié pour une modal de confirmation
 * 
 * @example
 * const { confirm, ConfirmModalProps } = useConfirmModal();
 * 
 * // Utilisation
 * const handleDelete = () => {
 *   confirm({
 *     title: 'Supprimer ?',
 *     message: 'Cette action est irréversible.',
 *     onConfirm: () => deleteClient(id),
 *     danger: true,
 *   });
 * };
 */
export interface ConfirmOptions {
  title: string;
  message: string;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

export interface UseConfirmModalReturn {
  isOpen: boolean;
  options: ConfirmOptions | null;
  confirm: (options: ConfirmOptions) => void;
  close: () => void;
  handleConfirm: () => Promise<void>;
}

export const useConfirmModal = (): UseConfirmModalReturn => {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const confirm = useCallback((opts: ConfirmOptions) => {
    setOptions(opts);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    if (options?.onCancel) {
      options.onCancel();
    }
    setIsOpen(false);
    setOptions(null);
  }, [options]);

  const handleConfirm = useCallback(async () => {
    if (!options?.onConfirm) return;
    
    setIsLoading(true);
    try {
      await options.onConfirm();
      setIsOpen(false);
      setOptions(null);
    } catch (error) {
      console.error('Confirm action failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, [options]);

  return {
    isOpen,
    options,
    confirm,
    close,
    handleConfirm,
  };
};

// ============================================
// 🔧 TYPES UTILITAIRES POUR LES MODALS
// ============================================

/**
 * Props de base pour tous les composants Modal
 */
export interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Props pour ClientDetailModal
 */
export interface ClientDetailModalProps extends BaseModalProps {
  client: Client | null;
  onTransfer?: () => void;
  onHandover?: () => void;
  onLinkTable?: () => void;
  onUnassign?: () => void;
  onDelete?: () => void;
  onSettle?: () => void;
  onNewOrder?: () => void;
}

/**
 * Props pour TransferModal
 */
export interface TransferModalProps extends BaseModalProps {
  client: Client | null;
  availableTables: Table[];
  onTransfer: (tableId: string) => void;
}

/**
 * Props pour HandoverModal
 */
export interface HandoverModalProps extends BaseModalProps {
  client: Client | null;
  waiters: User[];
  currentWaiterId?: string;
  onHandover: (waiterId: string) => void;
}

/**
 * Props pour AssignModal
 */
export interface AssignModalProps extends BaseModalProps {
  client: Client | null;
  availableTables: Table[];
  waiters: User[];
  onAssign: (tableId: string, waiterId: string) => void;
}

/**
 * Props pour ConfirmModal
 */
export interface ConfirmModalProps extends BaseModalProps {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
}

/**
 * Props pour NewClientModal
 */
export interface NewClientModalProps extends BaseModalProps {
  preSelectedTableId?: string;
  preSelectedWaiterId?: string;
  availableTables: Table[];
  waiters: User[];
  onSubmit: (name: string, apporteur: string, tableId?: string, waiterId?: string) => void;
}
