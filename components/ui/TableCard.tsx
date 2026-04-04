import React, { memo, useCallback, useMemo } from 'react';
import { Table, Client } from '../../src/types';
import { Link } from 'lucide-react';

interface TableCardProps {
  table: Table;
  client: Client;
  isLinkedTable?: boolean;
  onClick: (client: Client, table: Table, isLinked: boolean) => void;
  renderIcon?: (tableNumber: string) => React.ReactNode;
  total?: number;
}

const TableCard: React.FC<TableCardProps> = memo(({
  table,
  client,
  isLinkedTable = false,
  onClick,
  renderIcon,
  total = 0,
}) => {
  const isClosed = client.status === 'closed';

  const handleClick = useCallback(() => {
    onClick(client, table, isLinkedTable);
  }, [onClick, client, table, isLinkedTable]);

  const defaultRenderIcon = useMemo(() => {
    const isBar = table.number.toUpperCase().startsWith('BAR');
    if (isBar) {
      return (
        <div className="flex flex-col items-center justify-center leading-none">
          <span className="text-[9px] text-zinc-500 mb-0.5">BAR</span>
          <span className="text-xl md:text-2xl font-semibold">
            {table.number.replace(/BAR/i, '').trim()}
          </span>
        </div>
      );
    }
    return <span className="text-xl md:text-3xl font-semibold">T{table.number}</span>;
  }, [table.number]);

  const borderAccent = isClosed
    ? 'border-l-emerald-500'
    : 'border-l-zinc-600';

  return (
    <button
      onClick={handleClick}
      className={`
        relative aspect-square rounded-xl flex flex-col items-center justify-center
        transition-colors active:scale-[0.98] overflow-hidden
        bg-zinc-900 border border-zinc-800 border-l-[3px] ${borderAccent}
        hover:border-zinc-700 hover:bg-zinc-800/50
        ${isClosed ? 'text-emerald-400' : 'text-white'}
      `}
    >
      {/* Badge table liee */}
      {isLinkedTable && (
        <span className="absolute top-2 right-2 bg-blue-500/10 text-blue-400 p-1 rounded-md border border-blue-500/20">
          <Link className="w-3 h-3" />
        </span>
      )}

      {/* Badge clos */}
      {isClosed && !isLinkedTable && (
        <span className="absolute top-2 right-2 text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-md border border-emerald-500/20">
          Clos
        </span>
      )}

      {/* Numero de table */}
      {renderIcon ? renderIcon(table.number) : defaultRenderIcon}

      {/* Nom du client */}
      <p className="text-[10px] md:text-xs mt-2 text-zinc-400 truncate max-w-full px-2">
        {client.name}
      </p>

      {/* Total */}
      {total > 0 && (
        <span className="mt-1 text-sm md:text-base font-semibold tabular-nums">
          {total.toFixed(0)}€
        </span>
      )}
    </button>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.table.id === nextProps.table.id &&
    prevProps.table.number === nextProps.table.number &&
    prevProps.client.id === nextProps.client.id &&
    prevProps.client.name === nextProps.client.name &&
    prevProps.client.status === nextProps.client.status &&
    prevProps.isLinkedTable === nextProps.isLinkedTable &&
    prevProps.total === nextProps.total
  );
});

TableCard.displayName = 'TableCard';

export default TableCard;
