import { useEffect, useRef } from 'react';

const SW_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
const VERSION_KEY = 'deflower_app_version';

/**
 * Hook de gestion du Service Worker + cache-busting iOS standalone
 * - Enregistre le SW et écoute les mises à jour
 * - Vérifie version.json au démarrage et quand l'app redevient visible
 * - Force le rechargement si une nouvelle version est détectée
 */
export function useServiceWorker() {
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const isReloading = useRef(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    let swIntervalId: number | undefined;

    // ============================================
    // 1. Enregistrement du Service Worker
    // ============================================
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      registrationRef.current = registration;

      // Écoute les nouvelles versions du SW
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'activated' && !isReloading.current) {
            isReloading.current = true;
            window.location.reload();
          }
        });
      });

      // Vérification périodique des mises à jour SW
      swIntervalId = window.setInterval(() => {
        registration.update();
      }, SW_CHECK_INTERVAL);
    });

    // ============================================
    // 2. Rechargement automatique si nouveau SW prend le contrôle
    // ============================================
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!isReloading.current) {
        isReloading.current = true;
        window.location.reload();
      }
    });

    // ============================================
    // 3. Vérification de version via version.json
    // ============================================
    const checkVersion = async () => {
      try {
        const response = await fetch(`/version.json?t=${Date.now()}`, {
          cache: 'no-store',
        });
        if (!response.ok) return;

        const data = await response.json();
        const serverVersion = data.version;
        const storedVersion = sessionStorage.getItem(VERSION_KEY);

        if (!storedVersion) {
          // Premier chargement → stocker la version
          sessionStorage.setItem(VERSION_KEY, serverVersion);
          return;
        }

        if (storedVersion !== serverVersion) {
          // Nouvelle version détectée → clear cache + reload
          sessionStorage.setItem(VERSION_KEY, serverVersion);

          if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage('CLEAR_CACHE');
          }

          if (!isReloading.current) {
            isReloading.current = true;
            window.location.reload();
          }
        }
      } catch {
        // Silencieux si offline ou erreur réseau
      }
    };

    // Vérifier au démarrage
    checkVersion();

    // ============================================
    // 4. Écoute visibilitychange (CRUCIAL pour iOS standalone)
    // ============================================
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkVersion();
        registrationRef.current?.update();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // ============================================
    // 5. Backup: focus event
    // ============================================
    const handleFocus = () => {
      checkVersion();
    };
    window.addEventListener('focus', handleFocus);

    // ============================================
    // 6. Gestion du bfcache iOS (pageshow)
    // ============================================
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        checkVersion();
        registrationRef.current?.update();
      }
    };
    window.addEventListener('pageshow', handlePageShow);

    return () => {
      if (swIntervalId !== undefined) clearInterval(swIntervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, []);
}
