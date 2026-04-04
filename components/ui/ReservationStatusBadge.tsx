import React, { memo } from 'react';
import { Clock, UserCheck, CheckCircle, UserX, Ban } from 'lucide-react';
import {
  ReservationStatus,
  RESERVATION_STATUS_CONFIG,
  normalizeReservationStatus
} from '../../src/types';

// ============================================
// RESERVATION STATUS BADGE - Affichage du statut
// ============================================

interface ReservationStatusBadgeProps {
  status: ReservationStatus | string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  showLabel?: boolean;
  className?: string;
}

// Mapping des icônes
const IconMap = {
  Clock,
  UserCheck,
  CheckCircle,
  UserX,
  Ban,
} as const;

// Classes de taille
const SIZE_CLASSES = {
  sm: {
    container: 'px-2 py-0.5 text-xs gap-1',
    icon: 'w-3 h-3',
  },
  md: {
    container: 'px-3 py-1 text-xs gap-1.5',
    icon: 'w-3.5 h-3.5',
  },
  lg: {
    container: 'px-4 py-1.5 text-sm gap-2',
    icon: 'w-4 h-4',
  },
} as const;

const ReservationStatusBadge: React.FC<ReservationStatusBadgeProps> = memo(({
  status,
  size = 'md',
  showIcon = true,
  showLabel = true,
  className = '',
}) => {
  // Normaliser le statut (gère les anciennes valeurs)
  const normalizedStatus = normalizeReservationStatus(status as string);
  const config = RESERVATION_STATUS_CONFIG[normalizedStatus];
  const sizeClasses = SIZE_CLASSES[size];

  // Récupérer l'icône
  const IconComponent = IconMap[config.icon];

  return (
    <span
      className={`
        inline-flex items-center rounded-full font-bold uppercase tracking-wider
        ${config.bgColor} ${config.color} border ${config.borderColor}
        ${sizeClasses.container}
        ${className}
      `}
      title={config.description}
    >
      {showIcon && IconComponent && (
        <IconComponent className={sizeClasses.icon} />
      )}
      {showLabel && (
        <span>{config.label}</span>
      )}
    </span>
  );
});

ReservationStatusBadge.displayName = 'ReservationStatusBadge';

export default ReservationStatusBadge;
