/**
 * FORMATTERS - Fonctions de formatage centralisées
 * Fresh Touch Optimization - Day 1
 */

/**
 * Formate un montant en devise EUR (sans centimes)
 * Gère les string, number et undefined
 */
export const formatCurrency = (amount: number | string | undefined): string => {
  const value = typeof amount === 'string'
    ? parseFloat(amount.replace(',', '.'))
    : amount;

  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(Math.round(value || 0));
};

/**
 * Formate une date en français
 */
export const formatDate = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('fr-FR');
};

/**
 * Formate une heure (HH:MM)
 */
export const formatTime = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
};

/**
 * Formate un numéro de table pour l'affichage
 */
export const formatTableNumber = (tableNumber: string): string => {
  return tableNumber.toUpperCase().startsWith('BAR') 
    ? tableNumber 
    : `TABLE ${tableNumber}`;
};
