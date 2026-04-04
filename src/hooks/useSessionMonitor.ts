/**
 * useSessionMonitor - Hook de surveillance de session
 *
 * Gère:
 * - Auto-logout après inactivité (30 min)
 * - Expiration de session max (8h)
 * - Avertissement avant expiration
 * - Mise à jour de l'activité sur interactions
 */

import { useEffect, useCallback, useRef, useState } from 'react';
import {
  getSession,
  updateSessionActivity,
  clearSession,
  getSessionTimeRemaining,
} from '../utils';

interface UseSessionMonitorOptions {
  /** Callback appelé lors de l'auto-logout */
  onSessionExpired?: () => void;
  /** Callback appelé X secondes avant expiration */
  onSessionWarning?: (secondsRemaining: number) => void;
  /** Secondes avant expiration pour déclencher l'avertissement */
  warningThreshold?: number;
  /** Intervalle de vérification en ms */
  checkInterval?: number;
}

interface SessionMonitorState {
  /** Temps restant en secondes */
  timeRemaining: number | null;
  /** Session sur le point d'expirer */
  isExpiringSoon: boolean;
  /** Session expirée */
  isExpired: boolean;
}

export const useSessionMonitor = (options: UseSessionMonitorOptions = {}) => {
  const {
    onSessionExpired,
    onSessionWarning,
    warningThreshold = 300, // 5 minutes
    checkInterval = 30000, // 30 secondes
  } = options;

  const [state, setState] = useState<SessionMonitorState>({
    timeRemaining: null,
    isExpiringSoon: false,
    isExpired: false,
  });

  const warningShownRef = useRef(false);
  const lastActivityRef = useRef(Date.now());

  /**
   * Vérifie l'état de la session
   */
  const checkSession = useCallback(() => {
    const sessionResult = getSession();

    if (!sessionResult.valid) {
      setState({
        timeRemaining: null,
        isExpiringSoon: false,
        isExpired: true,
      });

      if (onSessionExpired) {
        onSessionExpired();
      }
      return;
    }

    const remaining = getSessionTimeRemaining();

    if (remaining !== null) {
      const isExpiringSoon = remaining <= warningThreshold;

      setState({
        timeRemaining: Math.floor(remaining),
        isExpiringSoon,
        isExpired: false,
      });

      // Déclencher l'avertissement une seule fois
      if (isExpiringSoon && !warningShownRef.current && onSessionWarning) {
        warningShownRef.current = true;
        onSessionWarning(Math.floor(remaining));
      }

      // Réinitialiser le flag d'avertissement si on repasse au-dessus du seuil
      if (!isExpiringSoon) {
        warningShownRef.current = false;
      }
    }
  }, [onSessionExpired, onSessionWarning, warningThreshold]);

  /**
   * Met à jour l'activité utilisateur
   */
  const recordActivity = useCallback(() => {
    const now = Date.now();
    // Éviter les mises à jour trop fréquentes (max 1 par seconde)
    if (now - lastActivityRef.current < 1000) return;

    lastActivityRef.current = now;
    updateSessionActivity();
    warningShownRef.current = false; // Réinitialiser l'avertissement

    // Recalculer le temps restant
    const remaining = getSessionTimeRemaining();
    if (remaining !== null) {
      setState(prev => ({
        ...prev,
        timeRemaining: Math.floor(remaining),
        isExpiringSoon: false,
      }));
    }
  }, []);

  /**
   * Prolonge manuellement la session
   */
  const extendSession = useCallback(() => {
    recordActivity();
  }, [recordActivity]);

  // Vérification périodique de la session
  useEffect(() => {
    // Vérification initiale
    checkSession();

    // Intervalle de vérification
    const intervalId = setInterval(checkSession, checkInterval);

    return () => clearInterval(intervalId);
  }, [checkSession, checkInterval]);

  // Écouter les interactions utilisateur pour mettre à jour l'activité
  useEffect(() => {
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];

    const handleActivity = () => {
      recordActivity();
    };

    events.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [recordActivity]);

  return {
    ...state,
    extendSession,
    recordActivity,
    formatTimeRemaining: () => {
      if (state.timeRemaining === null) return '--:--';
      const minutes = Math.floor(state.timeRemaining / 60);
      const seconds = state.timeRemaining % 60;
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    },
  };
};

export default useSessionMonitor;
