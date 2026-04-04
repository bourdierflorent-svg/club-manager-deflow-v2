import React, { memo, useCallback } from 'react';
import { Order, OrderStatus, OrderItem } from '../../src/types';
import { StickyNote, Edit3, Trash2 } from 'lucide-react';

interface OrderCardProps {
  order: Order;
  clientName?: string;
  waiterName?: string;
  tableNumber?: string;
  onEditItem?: (orderId: string, item: OrderItem) => void;
  onDeleteItem?: (orderId: string, itemId: string, productName: string) => void;
  showHeader?: boolean;
  showActions?: boolean;
  variant?: 'default' | 'compact' | 'detailed';
}

const STATUS_STYLES = {
  [OrderStatus.PENDING]: {
    container: 'border-amber-500/20',
    badge: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  },
  [OrderStatus.SERVED]: {
    container: 'border-emerald-500/20',
    badge: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  },
  [OrderStatus.SETTLED]: {
    container: 'bg-blue-500/5 border-blue-500/10',
    badge: 'bg-blue-500/20 text-blue-400',
  },
  [OrderStatus.CANCELLED]: {
    container: 'border-red-500/20',
    badge: 'bg-red-500/10 text-red-400 border border-red-500/20',
  },
} as const;

const STATUS_LABELS = {
  [OrderStatus.PENDING]: 'En attente',
  [OrderStatus.SERVED]: 'Servie',
  [OrderStatus.SETTLED]: 'Encaissé',
  [OrderStatus.CANCELLED]: 'Annulee',
} as const;

// Sub-component
interface OrderItemRowProps {
  item: OrderItem;
  orderId: string;
  isServed: boolean;
  onEdit?: (orderId: string, item: OrderItem) => void;
  onDelete?: (orderId: string, itemId: string, productName: string) => void;
}

const OrderItemRow: React.FC<OrderItemRowProps> = memo(({
  item, orderId, isServed, onEdit, onDelete,
}) => {
  const handleEdit = useCallback(() => { onEdit?.(orderId, item); }, [onEdit, orderId, item]);
  const handleDelete = useCallback(() => { onDelete?.(orderId, item.id, item.productName); }, [onDelete, orderId, item.id, item.productName]);

  return (
    <div className="flex items-center justify-between text-sm py-0.5">
      <span className="text-zinc-400">
        <span className="text-zinc-300 font-medium">{item.quantity}x</span>{' '}
        {item.productName}{' '}
        <span className="text-zinc-600">({item.size})</span>
      </span>
      <div className="flex items-center gap-2">
        <span className="text-zinc-300 tabular-nums">{item.subtotal}€</span>
        {isServed && onEdit && (
          <button onClick={handleEdit} className="text-zinc-600 hover:text-amber-400 transition-colors">
            <Edit3 className="w-3 h-3" />
          </button>
        )}
        {isServed && onDelete && (
          <button onClick={handleDelete} className="text-zinc-600 hover:text-red-400 transition-colors">
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
});
OrderItemRow.displayName = 'OrderItemRow';

const OrderCard: React.FC<OrderCardProps> = memo(({
  order,
  clientName,
  waiterName,
  tableNumber,
  onEditItem,
  onDeleteItem,
  showHeader = true,
  showActions = false,
  variant = 'default',
}) => {
  const statusStyle = STATUS_STYLES[order.status];
  const statusLabel = STATUS_LABELS[order.status];
  const isServed = order.status === OrderStatus.SERVED || order.status === OrderStatus.SETTLED;

  const orderTime = new Date(order.createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  // COMPACT
  if (variant === 'compact') {
    return (
      <div className={`bg-zinc-900 border ${statusStyle.container} rounded-xl p-3`}>
        <div className="flex items-center justify-between mb-1.5">
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md ${statusStyle.badge}`}>
            {statusLabel}
          </span>
          <span className="text-base font-semibold text-white tabular-nums">{order.totalAmount}€</span>
        </div>
        <div className="text-xs text-zinc-500">
          {order.items.length} article(s) · {orderTime}
        </div>
      </div>
    );
  }

  // DETAILED (Manager)
  if (variant === 'detailed') {
    return (
      <div className={`bg-zinc-900 border border-zinc-800 rounded-xl p-4 ${!isServed && order.status === OrderStatus.CANCELLED && 'opacity-50'}`}>
        <div className="flex items-center justify-between gap-4 mb-3">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${statusStyle.badge}`}>
              {statusLabel}
            </span>
            <span className="text-zinc-600 text-xs">{orderTime}</span>
          </div>
          <span className="text-base font-semibold text-white tabular-nums">{order.totalAmount}€</span>
        </div>

        {(clientName || tableNumber || waiterName) && (
          <div className="flex items-center gap-2 mb-3 text-sm">
            {tableNumber && (
              <span className="text-zinc-400 font-medium">
                {tableNumber.toUpperCase().startsWith('BAR') ? tableNumber : `T${tableNumber}`}
              </span>
            )}
            {clientName && <span className="text-white font-medium truncate">{clientName}</span>}
            {waiterName && <span className="text-zinc-600">· {waiterName}</span>}
          </div>
        )}

        <div className="space-y-0.5">
          {order.items.map(item => (
            <OrderItemRow
              key={item.id}
              item={item}
              orderId={order.id}
              isServed={isServed && showActions}
              onEdit={onEditItem}
              onDelete={onDeleteItem}
            />
          ))}
        </div>

        {order.note && (
          <div className="flex items-center gap-2 text-amber-400 text-xs mt-3 bg-amber-500/5 p-2 rounded-lg border border-amber-500/10">
            <StickyNote className="w-3 h-3 shrink-0" />
            <span className="italic">{order.note}</span>
          </div>
        )}

        {order.cancelReason && (
          <div className="mt-2 text-red-400 text-xs italic bg-red-500/5 p-2 rounded-lg border border-red-500/10">
            Motif: {order.cancelReason}
          </div>
        )}
      </div>
    );
  }

  // DEFAULT
  return (
    <div className={`bg-zinc-900 border ${statusStyle.container} rounded-xl p-4`}>
      {showHeader && (
        <div className="flex justify-between items-center mb-2">
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md ${statusStyle.badge}`}>
            {order.status}
          </span>
          <span className="text-xs text-zinc-600">{orderTime}</span>
        </div>
      )}

      <div className="space-y-0.5">
        {order.items.map(item => (
          <div key={item.id} className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">
              <span className="text-zinc-300 font-medium">{item.quantity}x</span>{' '}
              {item.productName}{' '}
              <span className="text-zinc-600">({item.size})</span>
            </span>
            <span className="text-zinc-300 tabular-nums">{item.subtotal}€</span>
          </div>
        ))}
      </div>

      {order.note && (
        <p className="text-xs text-amber-400/80 mt-2 italic flex items-center gap-1">
          <StickyNote className="w-3 h-3" /> {order.note}
        </p>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.order.id === nextProps.order.id &&
    prevProps.order.status === nextProps.order.status &&
    prevProps.order.totalAmount === nextProps.order.totalAmount &&
    prevProps.order.items.length === nextProps.order.items.length &&
    prevProps.variant === nextProps.variant &&
    prevProps.showActions === nextProps.showActions
  );
});

OrderCard.displayName = 'OrderCard';

export default OrderCard;
