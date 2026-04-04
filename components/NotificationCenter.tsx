import React, { useMemo, useEffect, useRef } from 'react';
import { useStore } from '../store/index';
import { Info, CheckCircle2, AlertTriangle, XCircle, X } from 'lucide-react';

// ============================================
// 🔔 NOTIFICATION CENTER - FRESH TOUCH
// ============================================

const NOTIFICATION_ICONS = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
} as const;

const NOTIFICATION_COLORS = {
  info: 'text-indigo-400',
  success: 'text-emerald-400',
  warning: 'text-orange-400',
  error: 'text-red-400',
} as const;

// ⏱️ Durée avant auto-dismiss (en ms)
const AUTO_DISMISS_DELAY = 3000;

const NotificationCenter: React.FC = () => {
  const { notifications, removeNotification, currentUser } = useStore();

  // Filtrer les notifications pour l'utilisateur actuel
  const visibleNotifications = useMemo(() => {
    if (!currentUser) return [];
    
    return notifications.filter(notif => {
      // 🔇 Sourdine : on ne montre que les erreurs et warnings (pas les success/info)
      if (notif.type === 'success' || notif.type === 'info' || notif.type === 'warning') return false;
      if (notif.targetUserId && notif.targetUserId !== currentUser.id) return false;
      if (notif.targetRoles && !notif.targetRoles.includes(currentUser.role)) return false;
      return true;
    });
  }, [notifications, currentUser]);

  // 🆕 Auto-dismiss après 3 secondes (sans recréer de timer pour les notifs déjà planifiées)
  const scheduledRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (visibleNotifications.length === 0) return;

    const timers: ReturnType<typeof setTimeout>[] = [];

    visibleNotifications.forEach(notif => {
      if (scheduledRef.current.has(notif.id)) return;
      scheduledRef.current.add(notif.id);
      timers.push(
        setTimeout(() => {
          scheduledRef.current.delete(notif.id);
          removeNotification(notif.id);
        }, AUTO_DISMISS_DELAY)
      );
    });

    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [visibleNotifications, removeNotification]);

  if (visibleNotifications.length === 0) return null;

  return (
    <div className="fixed top-20 right-4 z-[9999] flex flex-col gap-3 max-w-sm w-full">
      {visibleNotifications.map((notif) => {
        const Icon = NOTIFICATION_ICONS[notif.type];
        const colorClass = NOTIFICATION_COLORS[notif.type];
        
        return (
          <div 
            key={notif.id}
            className="bg-zinc-900/95 backdrop-blur-sm border border-zinc-800 rounded-xl p-4 shadow-lg flex gap-3 animate-in slide-in-from-right fade-in duration-300 relative group"
          >
            <div className="shrink-0 pt-0.5">
              <Icon className={`w-5 h-5 ${colorClass}`} />
            </div>
            
            <div className="flex-1">
              <h4 className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 mb-0.5">
                {notif.title}
              </h4>
              <p className="text-xs text-zinc-300 font-medium leading-relaxed">
                {notif.message}
              </p>
            </div>
            
            <button 
              onClick={() => removeNotification(notif.id)}
              className="shrink-0 text-zinc-600 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            
            {/* Progress bar - 3 secondes */}
            <div 
              className="absolute bottom-0 left-0 h-0.5 bg-white/30 rounded-full animate-[progress_3s_linear_forwards]" 
              style={{ width: '100%' }} 
            />
          </div>
        );
      })}
      
      <style>{`
        @keyframes progress {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
};

export default NotificationCenter;