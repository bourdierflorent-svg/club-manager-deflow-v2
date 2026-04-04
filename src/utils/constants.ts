/**
 * CONSTANTS - Constantes partagées
 * Fresh Touch Optimization - Day 1
 */

/**
 * Couleurs pour les graphiques Recharts
 */
export const CHART_COLORS = [
  '#ffffff',  // White (primary)
  '#a855f7',  // Violet
  '#ec4899',  // Rose
  '#f97316',  // Orange
  '#22c55e',  // Vert
  '#ef4444',  // Rouge
  '#3b82f6',  // Bleu
  '#14b8a6',  // Teal
];

/**
 * Styles communs pour les tooltips Recharts
 */
export const CHART_TOOLTIP_STYLE = {
  backgroundColor: '#0a0a0a',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '12px',
  color: '#ffffff'
};

/**
 * Configuration des colonnes Excel par défaut
 */
export const EXCEL_DEFAULT_COLUMNS = [
  { wch: 10 },   // Table
  { wch: 25 },   // Client
  { wch: 20 },   // Serveur
  { wch: 60 },   // Consommation
  { wch: 20 },   // Apporteur
  { wch: 15 },   // Total
];

/**
 * Tailles de bouteilles standards
 */
export const BOTTLE_SIZES = ['standard', 'magnum', 'jeroboam', 'mathusalem'] as const;

/** Type pour les tailles de bouteilles */
export type BottleSize = typeof BOTTLE_SIZES[number];

/**
 * Types de tables disponibles
 */
export const TABLE_TYPES = ['standard', 'vip', 'carré', 'bar'] as const;

/**
 * Messages d'erreur standardisés
 */
export const ERROR_MESSAGES = {
  GENERIC: 'Une erreur est survenue',
  NETWORK: 'Erreur de connexion',
  VALIDATION: 'Données invalides',
  NOT_FOUND: 'Élément introuvable',
  UNAUTHORIZED: 'Action non autorisée',
  CLIENT_CREATE: 'Impossible de créer le client',
  CLIENT_UPDATE: 'Impossible de modifier le client',
  CLIENT_DELETE: 'Impossible de supprimer le client',
  CLIENT_HAS_ORDERS: 'Impossible de supprimer : le client a des commandes servies',
  ORDER_CREATE: 'Impossible de créer la commande',
  ORDER_VALIDATE: 'Impossible de valider la commande',
  ORDER_CANCEL: 'Impossible d\'annuler la commande',
  TABLE_TRANSFER: 'Impossible de transférer la table',
  TABLE_FREE: 'Impossible de libérer la table',
  PAYMENT: 'Erreur lors du règlement',
} as const;

/**
 * Messages de confirmation standardisés
 */
export const CONFIRM_MESSAGES = {
  DELETE_CLIENT: (name: string) => `Supprimer le client ${name} et libérer la table ?`,
  DELETE_USER: (name: string) => `Supprimer l'utilisateur ${name} ?`,
  DELETE_ARCHIVE: 'ATTENTION : Supprimer cette archive est DÉFINITIF. Confirmer ?',
  FREE_TABLE: 'Confirmer la libération de la table ?',
  UNASSIGN_CLIENT: (name: string) => `Sortir ${name} de la table ? (Il retournera dans "Libres")`,
  CLOSE_EVENING: 'Attention : Cette action est irréversible. Les données actuelles seront archivées.',
  RESET_DATA: 'EFFACER TOUTES LES DONNÉES ? Cette action est irréversible.',
  CANCEL_ORDER: 'Annuler cette commande ?',
} as const;

/**
 * Messages de succès standardisés
 */
export const SUCCESS_MESSAGES = {
  CLIENT_CREATED: (name: string) => `Client ${name} ajouté.`,
  CLIENT_UPDATED: 'Nom du client mis à jour.',
  CLIENT_DELETED: (name: string) => `Client ${name} supprimé.`,
  ORDER_CREATED: 'Commande envoyée !',
  ORDER_VALIDATED: 'Commande validée.',
  ORDER_CANCELLED: 'Commande annulée.',
  TABLE_TRANSFERRED: 'Changement effectué.',
  TABLE_FREED: 'Table disponible.',
  TABLE_LINKED: 'Table ajoutée au client.',
  PAYMENT_SUCCESS: 'Règlement effectué.',
  USER_CREATED: 'Utilisateur créé.',
  USER_UPDATED: 'Profil mis à jour.',
  USER_DELETED: 'Utilisateur supprimé.',
  ARCHIVE_DELETED: 'Soirée supprimée.',
  EXPORT_PDF: 'Rapport PDF généré.',
  EXPORT_EXCEL: 'Fichier Excel généré.',
} as const;
