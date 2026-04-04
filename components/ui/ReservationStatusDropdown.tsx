import React, { memo, useState, useRef, useEffect } from 'react';
import { ChevronDown, Clock, UserCheck, CheckCircle, UserX, Ban } from 'lucide-react';
import {
  ReservationStatus,
  RESERVATION_STATUS_CONFIG,
  normalizeReservationStatus
} from '../../src/types';

// ============================================
// RESERVATION STATUS DROPDOWN - Changement de statut
// ============================================

interface ReservationStatusDropdownProps {
  currentStatus: ReservationStatus | string;
  onStatusChange: (newStatus: ReservationStatus) => void;
  disabled?: boolean;
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

const ReservationStatusDropdown: React.FC<ReservationStatusDropdownProps> = memo(({
  currentStatus,
  onStatusChange,
  disabled = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Normaliser le statut
  const normalizedStatus = normalizeReservationStatus(currentStatus as string);
  const currentConfig = RESERVATION_STATUS_CONFIG[normalizedStatus];
  const allowedTransitions = currentConfig.allowedTransitions;

  // Fermer le dropdown quand on clique ailleurs
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Récupérer l'icône courante
  const CurrentIcon = IconMap[currentConfig.icon];

  // Si pas de transitions possibles, afficher juste le badge
  if (allowedTransitions.length === 0 || disabled) {
    return (
      <span
        className={`
          inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider
          ${currentConfig.bgColor} ${currentConfig.color} border ${currentConfig.borderColor}
          ${className}
        `}
        title={currentConfig.description}
      >
        {CurrentIcon && <CurrentIcon className="w-3.5 h-3.5" />}
        <span>{currentConfig.label}</span>
      </span>
    );
  }

  return (
    <div className={`relative inline-block ${className}`} ref={dropdownRef}>
      {/* Bouton principal */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider
          ${currentConfig.bgColor} ${currentConfig.color} border ${currentConfig.borderColor}
          hover:brightness-110 transition-all cursor-pointer
        `}
        title={`${currentConfig.description} - Cliquer pour changer`}
      >
        {CurrentIcon && <CurrentIcon className="w-3.5 h-3.5" />}
        <span>{currentConfig.label}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Menu déroulant */}
      {isOpen && (
        <div className="absolute z-50 mt-2 w-48 rounded-xl bg-zinc-900 border border-zinc-800 shadow-xl overflow-hidden">
          <div className="p-1">
            <div className="px-3 py-2 text-[10px] text-zinc-500 uppercase tracking-widest font-semibold border-b border-zinc-800 mb-1">
              Changer le statut
            </div>
            {allowedTransitions.map((status) => {
              const config = RESERVATION_STATUS_CONFIG[status];
              const Icon = IconMap[config.icon];

              return (
                <button
                  key={status}
                  onClick={() => {
                    onStatusChange(status);
                    setIsOpen(false);
                  }}
                  className={`
                    w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left
                    hover:bg-zinc-800 transition-colors
                    ${config.color}
                  `}
                >
                  {Icon && <Icon className="w-4 h-4" />}
                  <div>
                    <span className="text-xs font-semibold uppercase">{config.label}</span>
                    <p className="text-[10px] text-zinc-500 mt-0.5">{config.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});

ReservationStatusDropdown.displayName = 'ReservationStatusDropdown';

export default ReservationStatusDropdown;
