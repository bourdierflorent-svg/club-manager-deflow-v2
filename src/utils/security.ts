/**
 * SECURITY - Module de sécurité centralisé
 *
 * Fonctionnalités:
 * - Rate limiting des tentatives de connexion
 * - Gestion de session avec expiration
 * - Validation et sanitization des entrées
 * - Chiffrement des données sensibles
 */

// ============================================
// 1. RATE LIMITING - Protection brute-force
// ============================================

interface LoginAttempt {
  count: number;
  firstAttempt: number;
  lockedUntil: number | null;
}

const LOGIN_ATTEMPTS: Map<string, LoginAttempt> = new Map();
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 5 * 60 * 1000; // 5 minutes
const ATTEMPT_WINDOW = 15 * 60 * 1000; // 15 minutes

/**
 * Vérifie si un utilisateur peut tenter de se connecter
 */
export const canAttemptLogin = (userId: string): { allowed: boolean; remainingTime?: number; attemptsLeft?: number } => {
  const attempt = LOGIN_ATTEMPTS.get(userId);
  const now = Date.now();

  if (!attempt) {
    return { allowed: true, attemptsLeft: MAX_ATTEMPTS };
  }

  // Vérifier si le lockout est actif
  if (attempt.lockedUntil && now < attempt.lockedUntil) {
    const remainingTime = Math.ceil((attempt.lockedUntil - now) / 1000);
    return { allowed: false, remainingTime };
  }

  // Réinitialiser si la fenêtre de tentatives est expirée
  if (now - attempt.firstAttempt > ATTEMPT_WINDOW) {
    LOGIN_ATTEMPTS.delete(userId);
    return { allowed: true, attemptsLeft: MAX_ATTEMPTS };
  }

  // Réinitialiser si le lockout est terminé
  if (attempt.lockedUntil && now >= attempt.lockedUntil) {
    LOGIN_ATTEMPTS.delete(userId);
    return { allowed: true, attemptsLeft: MAX_ATTEMPTS };
  }

  const attemptsLeft = MAX_ATTEMPTS - attempt.count;
  return { allowed: attemptsLeft > 0, attemptsLeft: Math.max(0, attemptsLeft) };
};

/**
 * Enregistre une tentative de connexion échouée
 */
export const recordFailedAttempt = (userId: string): { locked: boolean; lockoutDuration?: number } => {
  const now = Date.now();
  const attempt = LOGIN_ATTEMPTS.get(userId);

  if (!attempt) {
    LOGIN_ATTEMPTS.set(userId, {
      count: 1,
      firstAttempt: now,
      lockedUntil: null,
    });
    return { locked: false };
  }

  // Réinitialiser si la fenêtre est expirée
  if (now - attempt.firstAttempt > ATTEMPT_WINDOW) {
    LOGIN_ATTEMPTS.set(userId, {
      count: 1,
      firstAttempt: now,
      lockedUntil: null,
    });
    return { locked: false };
  }

  attempt.count += 1;

  // Verrouiller si trop de tentatives
  if (attempt.count >= MAX_ATTEMPTS) {
    attempt.lockedUntil = now + LOCKOUT_DURATION;
    return { locked: true, lockoutDuration: LOCKOUT_DURATION / 1000 };
  }

  return { locked: false };
};

/**
 * Réinitialise les tentatives après une connexion réussie
 */
export const resetLoginAttempts = (userId: string): void => {
  LOGIN_ATTEMPTS.delete(userId);
};

// ============================================
// 2. GESTION DE SESSION AVEC EXPIRATION
// ============================================

const SESSION_KEY = 'lr_session';
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes d'inactivité
const SESSION_MAX_AGE = 8 * 60 * 60 * 1000; // 8 heures max (durée d'une soirée)

interface SecureSession {
  userId: string;
  userData: string; // Données chiffrées
  createdAt: number;
  lastActivity: number;
  expiresAt: number;
}

/**
 * Crée une session sécurisée
 */
export const createSession = (userId: string, userData: object): void => {
  const now = Date.now();
  const encryptedData = encryptData(JSON.stringify(userData));

  const session: SecureSession = {
    userId,
    userData: encryptedData,
    createdAt: now,
    lastActivity: now,
    expiresAt: now + SESSION_MAX_AGE,
  };

  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
};

/**
 * Récupère la session si valide
 */
export const getSession = (): { valid: boolean; user?: object; reason?: string } => {
  try {
    const sessionStr = localStorage.getItem(SESSION_KEY);
    if (!sessionStr) {
      return { valid: false, reason: 'no_session' };
    }

    const session: SecureSession = JSON.parse(sessionStr);
    const now = Date.now();

    // Vérifier l'expiration absolue
    if (now > session.expiresAt) {
      clearSession();
      return { valid: false, reason: 'session_expired' };
    }

    // Vérifier l'inactivité
    if (now - session.lastActivity > SESSION_TIMEOUT) {
      clearSession();
      return { valid: false, reason: 'inactivity_timeout' };
    }

    // Déchiffrer les données utilisateur
    const decryptedData = decryptData(session.userData);
    if (!decryptedData) {
      clearSession();
      return { valid: false, reason: 'decryption_failed' };
    }

    const user = JSON.parse(decryptedData);
    return { valid: true, user };
  } catch {
    clearSession();
    return { valid: false, reason: 'invalid_session' };
  }
};

/**
 * Met à jour l'activité de la session
 */
export const updateSessionActivity = (): void => {
  try {
    const sessionStr = localStorage.getItem(SESSION_KEY);
    if (!sessionStr) return;

    const session: SecureSession = JSON.parse(sessionStr);
    session.lastActivity = Date.now();
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Ignorer les erreurs silencieusement
  }
};

/**
 * Supprime la session
 */
export const clearSession = (): void => {
  localStorage.removeItem(SESSION_KEY);
  // Nettoyer aussi l'ancien format pour rétrocompatibilité
  localStorage.removeItem('lr_user');
};

/**
 * Retourne le temps restant avant expiration (en secondes)
 */
export const getSessionTimeRemaining = (): number | null => {
  try {
    const sessionStr = localStorage.getItem(SESSION_KEY);
    if (!sessionStr) return null;

    const session: SecureSession = JSON.parse(sessionStr);
    const now = Date.now();

    const timeUntilInactivity = SESSION_TIMEOUT - (now - session.lastActivity);
    const timeUntilExpiry = session.expiresAt - now;

    return Math.min(timeUntilInactivity, timeUntilExpiry) / 1000;
  } catch {
    return null;
  }
};

// ============================================
// 3. VALIDATION ET SANITIZATION
// ============================================

/**
 * Sanitize une chaîne pour éviter les injections XSS
 */
export const sanitizeString = (input: string): string => {
  if (typeof input !== 'string') return '';

  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .trim();
};

/**
 * Sanitize pour affichage (moins strict, garde les caractères courants)
 */
export const sanitizeForDisplay = (input: string): string => {
  if (typeof input !== 'string') return '';

  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .trim();
};

/**
 * Valide un nom (client, utilisateur, etc.)
 */
export const validateName = (name: string): { valid: boolean; error?: string; sanitized?: string } => {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Le nom est requis' };
  }

  const trimmed = name.trim();

  if (trimmed.length < 2) {
    return { valid: false, error: 'Le nom doit contenir au moins 2 caractères' };
  }

  if (trimmed.length > 100) {
    return { valid: false, error: 'Le nom ne peut pas dépasser 100 caractères' };
  }

  // Vérifier les caractères dangereux
  if (/<script|javascript:|on\w+=/i.test(trimmed)) {
    return { valid: false, error: 'Caractères non autorisés détectés' };
  }

  return { valid: true, sanitized: sanitizeForDisplay(trimmed).toUpperCase() };
};

/**
 * Valide un numéro de téléphone
 */
export const validatePhone = (phone: string): { valid: boolean; error?: string; sanitized?: string } => {
  if (!phone) {
    return { valid: true, sanitized: '' }; // Optionnel
  }

  // Garder uniquement les chiffres et le +
  const cleaned = phone.replace(/[^\d+]/g, '');

  if (cleaned.length > 0 && cleaned.length < 10) {
    return { valid: false, error: 'Numéro de téléphone invalide' };
  }

  if (cleaned.length > 15) {
    return { valid: false, error: 'Numéro de téléphone trop long' };
  }

  return { valid: true, sanitized: cleaned };
};

/**
 * Valide une note/commentaire
 */
export const validateNote = (note: string): { valid: boolean; error?: string; sanitized?: string } => {
  if (!note) {
    return { valid: true, sanitized: '' };
  }

  if (note.length > 500) {
    return { valid: false, error: 'La note ne peut pas dépasser 500 caractères' };
  }

  return { valid: true, sanitized: sanitizeForDisplay(note) };
};

/**
 * Valide un PIN
 */
export const validatePin = (pin: string): { valid: boolean; error?: string } => {
  if (!pin || typeof pin !== 'string') {
    return { valid: false, error: 'PIN requis' };
  }

  if (!/^\d{4}$/.test(pin)) {
    return { valid: false, error: 'Le PIN doit contenir exactement 4 chiffres' };
  }

  // Vérifier les PIN trop simples
  const simplePins = ['0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999', '1234', '4321', '0123', '9876'];
  if (simplePins.includes(pin)) {
    return { valid: false, error: 'Ce PIN est trop simple, choisissez-en un autre' };
  }

  return { valid: true };
};

/**
 * Valide un montant
 */
export const validateAmount = (amount: number): { valid: boolean; error?: string } => {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return { valid: false, error: 'Montant invalide' };
  }

  if (amount < 0) {
    return { valid: false, error: 'Le montant ne peut pas être négatif' };
  }

  if (amount > 1000000) {
    return { valid: false, error: 'Montant trop élevé' };
  }

  return { valid: true };
};

// ============================================
// 4. CHIFFREMENT DES DONNÉES SENSIBLES
// ============================================

// Clé de chiffrement dérivée (en production, utiliser une clé plus robuste)
const ENCRYPTION_KEY = 'LR_2026_S3cur3_K3y_!@#';

/**
 * Chiffre des données sensibles (XOR + Base64)
 * Note: Pour une sécurité maximale en production, utiliser Web Crypto API
 */
export const encryptData = (data: string): string => {
  try {
    let encrypted = '';
    for (let i = 0; i < data.length; i++) {
      encrypted += String.fromCharCode(
        data.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length)
      );
    }
    return btoa(encodeURIComponent(encrypted));
  } catch {
    return '';
  }
};

/**
 * Déchiffre des données
 */
export const decryptData = (encryptedData: string): string | null => {
  try {
    const decoded = decodeURIComponent(atob(encryptedData));
    let decrypted = '';
    for (let i = 0; i < decoded.length; i++) {
      decrypted += String.fromCharCode(
        decoded.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length)
      );
    }
    return decrypted;
  } catch {
    return null;
  }
};

/**
 * Hash simple pour les données non réversibles (comme comparaison de PIN)
 * Note: En production, utiliser bcrypt côté serveur
 */
export const hashData = (data: string): string => {
  let hash = 0;
  const salt = 'LR_SALT_2026';
  const saltedData = salt + data + salt;

  for (let i = 0; i < saltedData.length; i++) {
    const char = saltedData.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }

  return Math.abs(hash).toString(36);
};

// ============================================
// 5. UTILITAIRES DE SÉCURITÉ
// ============================================

/**
 * Génère un ID sécurisé (utilise crypto si disponible)
 */
export const generateSecureId = (prefix: string = ''): string => {
  let randomPart: string;

  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    randomPart = crypto.randomUUID().replace(/-/g, '').substring(0, 12);
  } else {
    // Fallback pour les anciens navigateurs
    randomPart = Array.from({ length: 12 }, () =>
      Math.floor(Math.random() * 36).toString(36)
    ).join('');
  }

  return prefix ? `${prefix}-${randomPart}` : randomPart;
};

/**
 * Vérifie si l'environnement est en production
 */
export const isProduction = (): boolean => {
  return import.meta.env.PROD === true;
};

/**
 * Logger sécurisé qui ne log rien en production
 */
export const secureLog = (message: string, data?: unknown): void => {
  if (!isProduction()) {
    console.log(`[DEV] ${message}`, data ?? '');
  }
};

/**
 * Logger d'erreur (toujours actif mais sans données sensibles en prod)
 */
export const secureError = (message: string, error?: unknown): void => {
  if (isProduction()) {
    console.error(`[ERROR] ${message}`);
  } else {
    console.error(`[ERROR] ${message}`, error ?? '');
  }
};
