import React, { memo, useCallback } from 'react';
import { Client, Table } from '../../src/types';
import { Clock, History, User, Edit3, Trash2, Plus, ArrowRightLeft, MapPin } from 'lucide-react';

interface ClientCardProps {
  client: Client;
  table?: Table;
  waiterName?: string;
  onPrimaryAction?: (client: Client) => void;
  onEdit?: (client: Client) => void;
  onDelete?: (client: Client) => void;
  onAssign?: (client: Client) => void;
  onTransfer?: (client: Client) => void;
  primaryActionLabel?: string;
  primaryActionColor?: 'emerald' | 'blue' | 'gold' | 'red';
  showWaiter?: boolean;
  showTable?: boolean;
  showArrivalTime?: boolean;
  variant?: 'default' | 'compact' | 'detailed';
  isAssignedToMe?: boolean;
}

const ACTION_COLORS = {
  emerald: 'bg-emerald-600 text-white hover:bg-emerald-500',
  blue: 'bg-blue-600 text-white hover:bg-blue-500',
  gold: 'bg-white text-zinc-900 hover:bg-zinc-200',
  red: 'bg-red-600 text-white hover:bg-red-500',
} as const;

const ClientCard: React.FC<ClientCardProps> = memo(({
  client,
  table,
  waiterName,
  onPrimaryAction,
  onEdit,
  onDelete,
  onAssign,
  onTransfer,
  primaryActionLabel = 'Action',
  primaryActionColor = 'emerald',
  showWaiter = false,
  showTable = true,
  showArrivalTime = false,
  variant = 'default',
  isAssignedToMe = false,
}) => {
  const isClosed = client.status === 'closed';

  const handlePrimaryAction = useCallback(() => {
    onPrimaryAction?.(client);
  }, [onPrimaryAction, client]);

  const handleEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.(client);
  }, [onEdit, client]);

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.(client);
  }, [onDelete, client]);

  const handleAssign = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onAssign?.(client);
  }, [onAssign, client]);

  const handleTransfer = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onTransfer?.(client);
  }, [onTransfer, client]);

  const arrivalTime = new Date(client.arrivalAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });

  // ============================================
  // COMPACT
  // ============================================
  if (variant === 'compact') {
    return (
      <div className={`
        bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center justify-between gap-3
        ${isClosed ? 'opacity-50' : ''}
      `}>
        <div className="flex-1 min-w-0">
          <p className="text-base font-medium text-white truncate">
            {client.name}
          </p>
          {showArrivalTime && (
            <p className="text-xs text-zinc-500 mt-0.5">
              Arrive {arrivalTime}
            </p>
          )}
        </div>
        {onPrimaryAction && !isClosed && (
          <button
            onClick={handlePrimaryAction}
            className={`px-3 py-1.5 rounded-lg font-medium text-xs active:scale-[0.98] transition-all ${ACTION_COLORS[primaryActionColor]}`}
          >
            {primaryActionLabel}
          </button>
        )}
      </div>
    );
  }

  // ============================================
  // DEFAULT
  // ============================================
  return (
    <div className={`
      bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between
      transition-colors gap-4
      ${isClosed ? 'opacity-40' : 'hover:border-zinc-700'}
    `}>
      {/* Infos client */}
      <div className="flex-1 min-w-0 w-full">
        <div className="flex items-center gap-2 mb-1.5">
          <h3 className={`text-lg font-medium truncate ${isClosed ? 'text-zinc-500 line-through' : 'text-white'}`}>
            {client.name}
          </h3>
          {client.createdByName && (
            <span className="text-[10px] text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded shrink-0">
              {client.createdByName.split(' ')[0]}
            </span>
          )}
        </div>

        {/* Metadata */}
        <div className="flex flex-wrap items-center gap-1.5">
          {client.businessProvider && (
            <span className="text-xs text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded-md border border-zinc-700 truncate max-w-[150px]">
              {client.businessProvider}
            </span>
          )}

          {isClosed ? (
            <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md flex items-center gap-1.5 border border-emerald-500/20">
              <History className="w-3 h-3" /> Encaisse
            </span>
          ) : showTable && table ? (
            <span className="text-xs text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded-md flex items-center gap-1.5 border border-zinc-700">
              <MapPin className="w-3 h-3" /> Table {table.number}
            </span>
          ) : showTable && !table ? (
            <span className="text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md flex items-center gap-1.5 border border-amber-500/20">
              <Clock className="w-3 h-3" /> En attente
            </span>
          ) : null}

          {showWaiter && waiterName && (
            <span className="text-xs text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md flex items-center gap-1.5 border border-indigo-500/20">
              <User className="w-3 h-3" /> {waiterName}
            </span>
          )}

          {showArrivalTime && (
            <span className="text-xs text-zinc-500">
              {isAssignedToMe ? 'A installer' : 'Libre'} · {arrivalTime}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      {!isClosed && (
        <div className="flex gap-1.5 shrink-0">
          {onEdit && (
            <button
              onClick={handleEdit}
              className="p-2.5 rounded-lg text-zinc-500 hover:text-amber-400 hover:bg-zinc-800 transition-colors"
              title="Modifier"
            >
              <Edit3 className="w-4 h-4" />
            </button>
          )}

          {onAssign && !table && (
            <button
              onClick={handleAssign}
              className="p-2.5 rounded-lg text-zinc-500 hover:text-emerald-400 hover:bg-zinc-800 transition-colors"
              title="Installer"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}

          {onTransfer && table && (
            <button
              onClick={handleTransfer}
              className="p-2.5 rounded-lg text-zinc-500 hover:text-blue-400 hover:bg-zinc-800 transition-colors"
              title="Transferer"
            >
              <ArrowRightLeft className="w-4 h-4" />
            </button>
          )}

          {onDelete && (
            <button
              onClick={handleDelete}
              className="p-2.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors"
              title="Supprimer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          {onPrimaryAction && (
            <button
              onClick={handlePrimaryAction}
              className={`px-4 py-2.5 rounded-lg font-medium text-sm active:scale-[0.98] transition-all ${ACTION_COLORS[primaryActionColor]}`}
            >
              {primaryActionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.client.id === nextProps.client.id &&
    prevProps.client.name === nextProps.client.name &&
    prevProps.client.status === nextProps.client.status &&
    prevProps.client.businessProvider === nextProps.client.businessProvider &&
    prevProps.table?.id === nextProps.table?.id &&
    prevProps.waiterName === nextProps.waiterName &&
    prevProps.primaryActionLabel === nextProps.primaryActionLabel &&
    prevProps.isAssignedToMe === nextProps.isAssignedToMe
  );
});

ClientCard.displayName = 'ClientCard';

export default ClientCard;
