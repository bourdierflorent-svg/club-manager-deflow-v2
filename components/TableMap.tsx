import React, { useRef, useEffect, useState, useMemo, useCallback, memo } from 'react';
import { Table, TableStatus, Client, OrderStatus } from '../src/types';
import { useStore } from '../store/index';
import { isBarTable } from '../src/utils';
import { Link, ZoomIn, ZoomOut, RotateCcw, Music, Wine } from 'lucide-react';

// ============================================
// 📍 TYPES
// ============================================

interface TableMapProps {
  tables: Table[];
  clients: Client[];
  onTableClick?: (table: Table) => void;
  selectedTableId?: string;
  isEditMode?: boolean;
  currentUserId?: string;
  forceZone?: 'club' | 'bar';
}

interface TableIndicators {
  hasPending: boolean;
  status: TableStatus | 'closed';
}

interface TableBadgeProps {
  client: Client;
  isMainTable: boolean;
  isBar: boolean;
  waiterInitial: string;
  currentTotal: number;
  indicators: TableIndicators;
  badgeBelow?: boolean;
  badgeLeft?: boolean;
}

interface SingleTableProps {
  table: Table;
  client: Client | undefined;
  isSelected: boolean;
  indicators: TableIndicators;
  isEditMode: boolean;
  waiterInitial: string;
  currentTotal: number;
  onTableClick?: (table: Table) => void;
  onMouseDown: (e: React.MouseEvent, tableId: string) => void;
}

// ============================================
// 🎨 STYLES CONSTANTS
// ============================================

const TABLE_STYLES = {
  base: "transition-all duration-300 transform",
  selected: "scale-125 z-50 ring-2 md:ring-4 ring-white ring-offset-2 md:ring-offset-4 ring-offset-zinc-950",
  hover: "hover:scale-110 z-10",
  editMode: "cursor-move",
  closed: "bg-purple-600 border-purple-400 text-white shadow-[0_0_10px_rgba(147,51,234,0.5)]",
  pending: "bg-gradient-to-br from-blue-900/80 to-blue-950/90 border-blue-500/50 text-white shadow-[0_0_10px_rgba(37,99,235,0.3)] animate-pulse",
  served: "bg-gradient-to-br from-red-900/80 to-red-950/90 border-red-500/50 text-white shadow-[0_0_10px_rgba(220,38,38,0.3)]",
  occupied: "bg-gradient-to-br from-white/20 to-zinc-400/30 border-white/40 text-white shadow-[0_0_10px_rgba(212,175,55,0.2)]",
  available: "bg-emerald-950/20 border-emerald-500/30 text-emerald-500/40 shadow-[0_0_5px_rgba(16,185,129,0.05)]",
} as const;

const SIZE_CLASSES = {
  bar: {
    container: 'w-[8%] sm:w-[7%] md:w-[6%] lg:w-[6%] rounded-[0.4rem] sm:rounded-[0.5rem] md:rounded-[0.6rem]',
    font: 'text-[7px] sm:text-[8px] md:text-[10px]',
  },
  standard: {
    container: 'w-[8%] sm:w-[7.5%] md:w-[7.5%] lg:w-[8%] rounded-[0.5rem] sm:rounded-[0.7rem] md:rounded-[0.8rem]',
    font: 'text-[8px] sm:text-[9px] md:text-xs lg:text-sm',
  },
} as const;

// Tables dont le badge s'affiche en dessous (au lieu d'au-dessus)
const BADGE_BELOW_TABLES = new Set(['2', '4', '6', '7b', '9', '21', '24', '25b', '31', 'bar2', 'bar4', 'bar6', 'bar8']);
const BADGE_ABOVE_BAR_TABLES = new Set(['bar1', 'bar3', 'bar5', 'bar7']);
// Tables dont le badge s'affiche à gauche (bord droit de la map)
const BADGE_LEFT_TABLES = new Set(['bar8', 'bar9', 'bar10']);

// ============================================
// 🧩 SOUS-COMPOSANTS MÉMOÏSÉS
// ============================================

/**
 * ✅ Badge client - mémoïsé pour éviter re-render si props identiques
 */
const TableBadge: React.FC<TableBadgeProps> = memo(({
  client, isMainTable, isBar, waiterInitial, currentTotal, indicators, badgeBelow = false, badgeLeft = false
}) => {
  const containerClass = badgeLeft
    ? "absolute right-full mr-1 sm:mr-1.5 md:mr-2 top-1/2 -translate-y-1/2 whitespace-nowrap z-[60] hover:z-[100] flex items-center group"
    : badgeBelow
      ? "absolute top-full mt-1 sm:mt-1.5 md:mt-2 left-1/2 -translate-x-1/2 whitespace-nowrap z-[60] hover:z-[100] flex flex-col items-center group"
      : "absolute bottom-full mb-1 sm:mb-1.5 md:mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap z-[60] hover:z-[100] flex flex-col items-center group";

  if (isMainTable) {
    const dotColor = client.status === 'closed' 
      ? 'bg-purple-600' 
      : indicators.hasPending 
        ? 'bg-blue-500 animate-pulse' 
        : indicators.status === TableStatus.SERVED 
          ? 'bg-red-500' 
          : 'bg-white';

    return (
      <div className={containerClass}>
        <div className={`text-black px-1.5 py-0.5 sm:px-2 sm:py-1 md:px-2.5 md:py-1.5 rounded-md sm:rounded-lg md:rounded-xl shadow-xl border border-white flex items-center gap-1 sm:gap-1.5 md:gap-2 transition-all duration-200 ${client.status === 'closed' ? 'bg-purple-200' : 'bg-white'}`}>
          <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full shrink-0 ${dotColor}`} />
          <div className="flex flex-col items-start leading-none gap-0.5 sm:gap-0.5">
            <span className="text-[6px] sm:text-[8px] md:text-[9px] font-semibold uppercase tracking-tighter max-w-[45px] sm:max-w-[55px] md:max-w-[70px] truncate group-hover:max-w-none transition-all duration-300">
              {client.name}
            </span>
            <span className="text-[5px] sm:text-[6px] md:text-[7px] font-semibold uppercase opacity-70 flex items-center gap-0.5 sm:gap-1">
              {waiterInitial} <span className="text-zinc-400">•</span> {currentTotal}€
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={containerClass}>
      <div className="text-zinc-300 bg-black/60 backdrop-blur-sm px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-md sm:rounded-lg border border-zinc-800 flex items-center gap-1 shadow-lg">
        <Link className="w-2 h-2 sm:w-2.5 sm:h-2.5 md:w-3 md:h-3" />
        <span className="text-[5px] sm:text-[6px] md:text-[7px] font-semibold uppercase truncate max-w-[45px] sm:max-w-[50px]">
          {client.name}
        </span>
      </div>
    </div>
  );
});

TableBadge.displayName = 'TableBadge';

/**
 * ✅ Légende - mémoïsée (ne change jamais)
 * 🔧 CORRECTION v2.2 - Ajout du statut "Occupée"
 */
const TableLegend: React.FC = memo(() => (
  <div className="absolute bottom-2 sm:bottom-3 md:bottom-4 lg:bottom-6 left-1/2 -translate-x-1/2 w-[94%] sm:w-[94%] md:w-[92%] lg:w-[90%] flex justify-between items-center px-3 py-2 sm:px-3 sm:py-2 md:px-4 md:py-3 bg-zinc-950/95 backdrop-blur-2xl rounded-xl sm:rounded-xl md:rounded-xl border border-zinc-800 shadow-2xl z-0 overflow-x-auto no-scrollbar">
    {[
      { color: 'bg-blue-500 animate-pulse', text: 'Attente', textColor: 'text-blue-400' },
      { color: 'bg-amber-500', text: 'Occupée', textColor: 'text-amber-400' },
      { color: 'bg-red-600', text: 'Servi', textColor: 'text-red-400' },
      { color: 'bg-purple-600', text: 'Payé', textColor: 'text-purple-400' },
      { color: 'bg-emerald-500', text: 'Libre', textColor: 'text-emerald-500' },
    ].map(({ color, text, textColor }, index) => (
      <div key={text} className={`flex items-center gap-1.5 md:gap-1.5 shrink-0 ${index < 4 ? 'mr-2 sm:mr-3' : ''}`}>
        <div className={`w-2 h-2 sm:w-2 sm:h-2 rounded-full ${color}`} />
        <span className={`text-[7px] sm:text-[7px] md:text-[8px] font-semibold uppercase tracking-tighter ${textColor}`}>
          {text}
        </span>
      </div>
    ))}
  </div>
));

TableLegend.displayName = 'TableLegend';

/**
 * ✅ Table individuelle - mémoïsée pour éviter re-render des autres tables
 */
const SingleTable: React.FC<SingleTableProps> = memo(({
  table,
  client,
  isSelected,
  indicators,
  isEditMode,
  waiterInitial,
  currentTotal,
  onTableClick,
  onMouseDown,
}) => {
  const isReallyOccupied = client || indicators.status !== TableStatus.AVAILABLE;
  const isAvailable = !client && indicators.status === TableStatus.AVAILABLE;
  const isMainTable = client?.tableId === table.id;
  const isBar = isBarTable(table.number);
  const sizeClasses = isBar ? SIZE_CLASSES.bar : SIZE_CLASSES.standard;

  // Calcul des styles
  // 🔧 CORRECTION v2.3 - Vérifie aussi indicators.status pour OCCUPIED
  const tableStyles = useMemo(() => {
    let styles = TABLE_STYLES.base + ' ';
    styles += isSelected ? TABLE_STYLES.selected : TABLE_STYLES.hover;
    if (isEditMode) styles += ' ' + TABLE_STYLES.editMode;

    if (client?.status === 'closed') return styles + ' ' + TABLE_STYLES.closed;
    if (indicators.hasPending) return styles + ' ' + TABLE_STYLES.pending;
    if (indicators.status === TableStatus.SERVED) return styles + ' ' + TABLE_STYLES.served;
    // 🔧 FIX: Vérifie SOIT client.status === 'assigned' SOIT indicators.status === OCCUPIED
    if (client?.status === 'assigned' || indicators.status === TableStatus.OCCUPIED) return styles + ' ' + TABLE_STYLES.occupied;
    return styles + ' ' + TABLE_STYLES.available;
  }, [isSelected, isEditMode, client?.status, indicators.hasPending, indicators.status]);

  const handleClick = useCallback(() => {
    if (!isEditMode && onTableClick) {
      onTableClick(table);
    }
  }, [isEditMode, onTableClick, table]);

  const handleMouseDownLocal = useCallback((e: React.MouseEvent) => {
    onMouseDown(e, table.id);
  }, [onMouseDown, table.id]);

  return (
    <div
      data-table="true"
      onMouseDown={handleMouseDownLocal}
      onClick={handleClick}
      style={{ 
        left: `${table.positionX}%`, 
        top: `${table.positionY}%`,
        transform: 'translate(-50%, -50%)'
      }}
      className={`absolute ${sizeClasses.container} aspect-square border md:border-2 flex flex-col items-center justify-center cursor-pointer ${tableStyles}`}
    >
      {/* Badge client */}
      {client && (
        <TableBadge
          client={client}
          isMainTable={isMainTable}
          isBar={isBar}
          waiterInitial={waiterInitial}
          currentTotal={currentTotal}
          indicators={indicators}
          badgeBelow={BADGE_BELOW_TABLES.has(table.number.toLowerCase())}
          badgeLeft={BADGE_LEFT_TABLES.has(table.number.toLowerCase())}
        />
      )}

      {/* Indicateurs de statut */}
      <div className="absolute top-0.5 right-0.5 md:top-1 md:right-1 flex flex-col gap-0.5">
        {indicators.hasPending && (
          <div className="w-1 h-1 md:w-1.5 md:h-1.5 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,1)]" />
        )}
        {indicators.status === TableStatus.SERVED && client?.status !== 'closed' && (
          <div className="w-1 h-1 md:w-1.5 md:h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,1)]" />
        )}
      </div>

      {/* Numéro de table */}
      <span className={`${sizeClasses.font} font-semibold ${isReallyOccupied ? 'text-white' : 'text-inherit'}`}>
        {table.number}
      </span>

      {isAvailable && !isBar && (
        <span className="text-[3px] md:text-[5px] font-semibold uppercase tracking-widest opacity-40 -mt-0.5 md:-mt-1">
          LIBRE
        </span>
      )}
      
      {/* Points de capacité */}
      <div className="absolute bottom-0.5 md:bottom-1 flex gap-0.5">
        {Array.from({ length: Math.min(table.capacity, 4) }).map((_, i) => (
          <div 
            key={i} 
            className={`w-0.5 h-0.5 md:w-1 md:h-1 rounded-full ${
              isReallyOccupied 
                ? (client?.status === 'closed' ? 'bg-purple-400' : 'bg-white') 
                : 'bg-emerald-500/20'
            }`} 
          />
        ))}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // ✅ Comparaison personnalisée pour éviter re-renders inutiles
  return (
    prevProps.table.id === nextProps.table.id &&
    prevProps.table.positionX === nextProps.table.positionX &&
    prevProps.table.positionY === nextProps.table.positionY &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isEditMode === nextProps.isEditMode &&
    prevProps.client?.id === nextProps.client?.id &&
    prevProps.client?.status === nextProps.client?.status &&
    prevProps.client?.name === nextProps.client?.name &&
    prevProps.indicators.hasPending === nextProps.indicators.hasPending &&
    prevProps.indicators.status === nextProps.indicators.status &&
    prevProps.currentTotal === nextProps.currentTotal &&
    prevProps.waiterInitial === nextProps.waiterInitial
  );
});

SingleTable.displayName = 'SingleTable';

// ============================================
// 🎯 COMPOSANT PRINCIPAL MÉMOÏSÉ
// ============================================

const TableMap: React.FC<TableMapProps> = memo(({
  tables, clients, onTableClick, selectedTableId, isEditMode, currentUserId, forceZone
}) => {
  const { orders, updateTablePosition, users } = useStore();
  const mapRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const draggingTableId = useRef<string | null>(null);

  const [localTables, setLocalTables] = useState<Table[]>(tables);
  const [activeZone, setActiveZone] = useState<'club' | 'bar'>(forceZone || 'club');

  // Tables filtrées par zone active
  const zoneTables = useMemo(() =>
    localTables.filter(t => (t.zone || 'club') === activeZone),
    [localTables, activeZone]
  );

  // Reset zoom/pan quand on change de zone
  const handleZoneChange = useCallback((zone: 'club' | 'bar') => {
    setActiveZone(zone);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // 🔍 ZOOM & PAN STATE
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const lastPan = useRef({ x: 0, y: 0 });
  
  // 🤏 PINCH ZOOM STATE
  const isPinching = useRef(false);
  const initialPinchDistance = useRef(0);
  const initialPinchZoom = useRef(1);
  
  const ZOOM_MIN = 1;
  const ZOOM_MAX = 3;
  const ZOOM_STEP = 0.5;
  
  // Helper: calculer la distance entre deux touches
  const getTouchDistance = (touches: React.TouchList): number => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Sync avec le store quand pas en drag
  useEffect(() => {
    if (!draggingTableId.current) {
      setLocalTables(tables);
    }
  }, [tables]);

  // ✅ Mémoïsation du mapping client par table
  // 🔧 FIX: Les clients actifs (assigned/pending) ont priorité sur les clients closed
  // pour éviter qu'un ancien client encaissé masque le nouveau client transféré,
  // tout en gardant les closed pour l'affichage violet sur le plan
  const clientByTableId = useMemo(() => {
    const map = new Map<string, Client>();
    // Premier pass : clients closed (seront écrasés par les actifs si même table)
    clients.forEach(client => {
      if (client.status !== 'closed') return;
      if (client.tableId) {
        map.set(client.tableId, client);
      }
      client.linkedTableIds?.forEach(linkedId => {
        if (!map.has(linkedId)) {
          map.set(linkedId, client);
        }
      });
    });
    // Second pass : clients actifs écrasent les closed sur la même table
    clients.forEach(client => {
      if (client.status === 'closed') return;
      if (client.tableId) {
        map.set(client.tableId, client);
      }
      client.linkedTableIds?.forEach(linkedId => {
        if (!map.has(linkedId)) {
          map.set(linkedId, client);
        }
      });
    });
    return map;
  }, [clients]);

  // ✅ Mémoïsation des indicateurs par table
  // 🔧 CORRECTION v2.2 - Utilise table.status de Firebase + vérification locale des commandes
  const indicatorsByTableId = useMemo(() => {
    const map = new Map<string, TableIndicators>();
    localTables.forEach(table => {
      const client = clientByTableId.get(table.id);
      if (!client) {
        // Pas de client → Table libre
        map.set(table.id, { hasPending: false, status: TableStatus.AVAILABLE });
      } else if (client.status === 'closed') {
        // Client réglé → Status spécial "closed"
        map.set(table.id, { hasPending: false, status: 'closed' });
      } else {
        // Client assigné → Vérifie les commandes
        const clientOrders = orders.filter(o => o.clientId === client.id);
        const hasPending = clientOrders.some(o => o.status === OrderStatus.PENDING);
        const hasServed = clientOrders.some(o => o.status === OrderStatus.SERVED || o.status === OrderStatus.SETTLED);
        
        // Priorité : utilise table.status de Firebase, sinon recalcule localement
        // Si table.status === SERVED ou si on a des commandes servies → SERVED
        // Sinon → OCCUPIED (table occupée mais pas encore servie)
        const tableStatus = (table.status === TableStatus.SERVED || hasServed) 
          ? TableStatus.SERVED 
          : TableStatus.OCCUPIED;
        
        map.set(table.id, { hasPending, status: tableStatus });
      }
    });
    return map;
  }, [localTables, clientByTableId, orders]);

  // ✅ Mémoïsation des totaux par client
  const totalByClientId = useMemo(() => {
    const map = new Map<string, number>();
    clients.forEach(client => {
      if (client.status === 'closed') {
        map.set(client.id, client.totalSpent);
      } else {
        const total = orders
          .filter(o => o.clientId === client.id && (o.status === OrderStatus.SERVED || o.status === OrderStatus.SETTLED))
          .reduce((acc, o) => acc + o.totalAmount, 0);
        map.set(client.id, total);
      }
    });
    return map;
  }, [clients, orders]);

  // ✅ Mémoïsation des initiales serveur par client
  const waiterInitialByClientId = useMemo(() => {
    const map = new Map<string, string>();
    clients.forEach(client => {
      const waiter = users.find(u => u.id === client.waiterId);
      map.set(client.id, waiter ? waiter.firstName.substring(0, 2).toUpperCase() : '?');
    });
    return map;
  }, [clients, users]);

  // 🔍 ZOOM CONTROLS
  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(ZOOM_MAX, prev + ZOOM_STEP));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(prev => {
      const newZoom = Math.max(ZOOM_MIN, prev - ZOOM_STEP);
      if (newZoom === 1) setPan({ x: 0, y: 0 }); // Reset pan when back to 1x
      return newZoom;
    });
  }, []);

  const handleZoomReset = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // 🔍 PAN HANDLERS - Mouse only
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (zoom <= 1 || isEditMode) return;
    
    const target = e.target as HTMLElement;
    if (target.closest('[data-table]')) return;
    
    isPanning.current = true;
    lastPan.current = { ...pan };
    panStart.current = { x: e.clientX, y: e.clientY };
  }, [zoom, isEditMode, pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current || !mapRef.current) return;
    
    const rect = mapRef.current.getBoundingClientRect();
    const maxPan = (zoom - 1) * 50;
    
    const deltaX = e.clientX - panStart.current.x;
    const deltaY = e.clientY - panStart.current.y;
    
    setPan({
      x: Math.max(-maxPan, Math.min(maxPan, lastPan.current.x + (deltaX / rect.width) * 100)),
      y: Math.max(-maxPan, Math.min(maxPan, lastPan.current.y + (deltaY / rect.height) * 100))
    });
  }, [zoom]);

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  // 🤏 TOUCH HANDLERS (pan + pinch zoom)
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (isEditMode) return;
    
    const target = e.target as HTMLElement;
    if (target.closest('[data-table]')) return;
    
    // Pinch zoom avec 2 doigts
    if (e.touches.length === 2) {
      e.preventDefault();
      isPinching.current = true;
      isPanning.current = false;
      initialPinchDistance.current = getTouchDistance(e.touches);
      initialPinchZoom.current = zoom;
      return;
    }
    
    // Pan avec 1 doigt (seulement si zoomé)
    if (e.touches.length === 1 && zoom > 1) {
      isPanning.current = true;
      lastPan.current = { ...pan };
      panStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }, [zoom, isEditMode, pan]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    // Pinch zoom
    if (isPinching.current && e.touches.length === 2) {
      e.preventDefault();
      const currentDistance = getTouchDistance(e.touches);
      const scale = currentDistance / initialPinchDistance.current;
      let newZoom = initialPinchZoom.current * scale;
      newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, newZoom));
      
      if (newZoom <= 1) {
        setPan({ x: 0, y: 0 });
      }
      setZoom(newZoom);
      return;
    }
    
    // Pan
    if (isPanning.current && e.touches.length === 1 && mapRef.current) {
      const rect = mapRef.current.getBoundingClientRect();
      const maxPan = (zoom - 1) * 50;
      
      const deltaX = e.touches[0].clientX - panStart.current.x;
      const deltaY = e.touches[0].clientY - panStart.current.y;
      
      setPan({
        x: Math.max(-maxPan, Math.min(maxPan, lastPan.current.x + (deltaX / rect.width) * 100)),
        y: Math.max(-maxPan, Math.min(maxPan, lastPan.current.y + (deltaY / rect.height) * 100))
      });
    }
  }, [zoom]);

  const handleTouchEnd = useCallback(() => {
    isPinching.current = false;
    isPanning.current = false;
  }, []);

  // 🔍 WHEEL ZOOM
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      if (e.deltaY < 0) {
        setZoom(prev => Math.min(ZOOM_MAX, prev + 0.1));
      } else {
        setZoom(prev => {
          const newZoom = Math.max(ZOOM_MIN, prev - 0.1);
          if (newZoom <= 1) setPan({ x: 0, y: 0 });
          return newZoom;
        });
      }
    }
  }, []);

  // --- DRAG & DROP (edit mode) ---
  const handleTableDragStart = useCallback((e: React.MouseEvent, tableId: string) => {
    if (!isEditMode) return;
    e.preventDefault();
    draggingTableId.current = tableId;
  }, [isEditMode]);

  useEffect(() => {
    if (!isEditMode) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingTableId.current || !mapRef.current) return;
      
      const rect = mapRef.current.getBoundingClientRect();
      const x = Math.max(5, Math.min(95, ((e.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(5, Math.min(95, ((e.clientY - rect.top) / rect.height) * 100));
      
      setLocalTables(prev => prev.map(t => 
        t.id === draggingTableId.current 
          ? { ...t, positionX: Math.round(x), positionY: Math.round(y) } 
          : t
      ));
    };

    const handleMouseUp = () => {
      if (draggingTableId.current) {
        const table = localTables.find(t => t.id === draggingTableId.current);
        if (table) {
          updateTablePosition(table.id, table.positionX, table.positionY);
        }
      }
      draggingTableId.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isEditMode, localTables, updateTablePosition]);

  return (
    <div 
      ref={mapRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
      className={`relative w-full aspect-square sm:aspect-[4/3] lg:aspect-square bg-zinc-950 rounded-[1.5rem] sm:rounded-xl lg:rounded-xl border-[6px] sm:border-[8px] lg:border-[12px] border-zinc-900 overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)] select-none ${isEditMode ? 'ring-4 ring-indigo-500/50' : ''} ${zoom > 1 && !isEditMode ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
      {/* 🏷️ ZONE TABS (masqués si forceZone) */}
      {!isEditMode && !forceZone && (
        <div className="absolute top-1 left-1.5 sm:top-1.5 sm:left-2 md:top-2 md:left-3 z-[30] flex gap-1">
          <button
            onClick={() => handleZoneChange('club')}
            className={`px-2 py-1 sm:px-2.5 sm:py-1 rounded-md text-[8px] sm:text-[9px] font-semibold uppercase tracking-wider transition-all ${
              activeZone === 'club'
                ? 'bg-white text-black shadow-lg'
                : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-800 border border-zinc-800'
            }`}
          >
            Club
          </button>
          <button
            onClick={() => handleZoneChange('bar')}
            className={`px-2 py-1 sm:px-2.5 sm:py-1 rounded-md text-[8px] sm:text-[9px] font-semibold uppercase tracking-wider transition-all ${
              activeZone === 'bar'
                ? 'bg-white text-black shadow-lg'
                : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-800 border border-zinc-800'
            }`}
          >
            Bar
          </button>
        </div>
      )}

      {/* 🔍 ZOOM CONTROLS */}
      {!isEditMode && (
        <div className="absolute top-1/2 -translate-y-1/2 right-2 sm:right-2.5 md:right-3 z-[30] flex flex-col gap-1.5 sm:gap-1.5 md:gap-2">
          <button
            onClick={handleZoomIn}
            disabled={zoom >= ZOOM_MAX}
            className="w-9 h-9 sm:w-9 sm:h-9 md:w-10 md:h-10 bg-zinc-950/90 backdrop-blur-sm border border-zinc-700 rounded-lg flex items-center justify-center text-white hover:bg-zinc-800 hover:border-zinc-600 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ZoomIn className="w-4.5 h-4.5 sm:w-4.5 sm:h-4.5 md:w-5 md:h-5" />
          </button>
          
          {zoom > 1 && (
            <button
              onClick={handleZoomReset}
              className="w-9 h-9 sm:w-9 sm:h-9 md:w-10 md:h-10 bg-zinc-950/90 backdrop-blur-sm border border-zinc-700 rounded-lg flex items-center justify-center text-white hover:bg-zinc-800 hover:border-zinc-600 transition-all"
            >
              <RotateCcw className="w-4.5 h-4.5 sm:w-4.5 sm:h-4.5 md:w-5 md:h-5" />
            </button>
          )}
          
          <button
            onClick={handleZoomOut}
            disabled={zoom <= ZOOM_MIN}
            className="w-9 h-9 sm:w-9 sm:h-9 md:w-10 md:h-10 bg-zinc-950/90 backdrop-blur-sm border border-zinc-700 rounded-lg flex items-center justify-center text-white hover:bg-zinc-800 hover:border-zinc-600 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ZoomOut className="w-4.5 h-4.5 sm:w-4.5 sm:h-4.5 md:w-5 md:h-5" />
          </button>
          
          {/* Zoom level indicator */}
          {zoom > 1 && (
            <div className="text-center text-[10px] sm:text-[10px] md:text-xs font-semibold text-zinc-400 mt-1">
              {zoom.toFixed(1)}x
            </div>
          )}
        </div>
      )}

      {/* ZOOMABLE CONTENT WRAPPER */}
      <div 
        ref={contentRef}
        className="absolute inset-0 transition-transform duration-150 ease-out"
        style={{ 
          transform: `scale(${zoom}) translate(${pan.x}%, ${pan.y}%)`,
          transformOrigin: 'center center'
        }}
      >
        {/* Fond décoratif */}
        <div 
          className="absolute inset-0 opacity-20 pointer-events-none" 
          style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '20px 20px' }} 
        />
        
        {/* 🎵 Décor CLUB */}
        {activeZone === 'club' && (
          <>
            {/* DJ Booth - Left side */}
            <div className="absolute left-[2%] top-[30%] w-[10%] h-[18%] bg-zinc-900/80 border border-zinc-800 rounded-lg flex items-center justify-center">
              <div className="flex flex-col items-center gap-0.5">
                <Music className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 text-zinc-600" />
                <span className="text-[7px] sm:text-[9px] md:text-[11px] font-semibold text-zinc-600 uppercase tracking-widest">
                  DJ
                </span>
              </div>
            </div>

            {/* BAR - Right side */}
            <div className="absolute right-[1%] top-[22%] w-[5%] h-[45%] bg-zinc-900/80 border border-zinc-800 rounded-lg flex items-center justify-center">
              <span className="text-[7px] sm:text-[9px] md:text-[12px] font-semibold text-zinc-600 uppercase tracking-[0.2em]" style={{ writingMode: 'vertical-rl' }}>
                BAR
              </span>
            </div>
          </>
        )}

        {/* 🍸 Décor BAR - Comptoir en longueur */}
        {activeZone === 'bar' && (
          <div className="absolute left-[3%] top-[18%] w-[94%] h-[20%] bg-zinc-900/60 border-2 border-dashed border-zinc-800 rounded-xl flex items-center justify-center">
            <div className="flex items-center gap-2">
              <Wine className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-zinc-700" />
              <span className="text-[10px] sm:text-[12px] md:text-[16px] font-semibold text-zinc-700 uppercase tracking-[0.3em] sm:tracking-[0.5em]">
                COMPTOIR
              </span>
            </div>
          </div>
        )}

        {/* ✨ Deflower - Bottom center */}
        <div className="absolute bottom-[6%] left-1/2 -translate-x-1/2 pointer-events-none">
          <span className="text-[14px] sm:text-[18px] md:text-[24px] font-semibold italic text-white/[0.06]" style={{ fontFamily: 'cursive' }}>
            Deflower
          </span>
        </div>
        
        {/* Overlay mode édition */}
        {isEditMode && (
          <div className="absolute inset-0 bg-indigo-500/5 pointer-events-none z-[100] flex items-center justify-center">
            <p className="text-indigo-400 font-semibold uppercase text-xl opacity-20 rotate-12">
              MODE CONFIGURATION
            </p>
          </div>
        )}

        {/* --- RENDU DES TABLES (composants mémoïsés, filtrées par zone) --- */}
        {zoneTables.map(table => {
          const client = clientByTableId.get(table.id);
          const indicators = indicatorsByTableId.get(table.id) || { hasPending: false, status: TableStatus.AVAILABLE };
          const currentTotal = client ? (totalByClientId.get(client.id) || 0) : 0;
          const waiterInitial = client ? (waiterInitialByClientId.get(client.id) || '?') : '';

          return (
            <SingleTable
              key={table.id}
              table={table}
              client={client}
              isSelected={selectedTableId === table.id}
              indicators={indicators}
              isEditMode={isEditMode || false}
              waiterInitial={waiterInitial}
              currentTotal={currentTotal}
              onTableClick={onTableClick}
              onMouseDown={handleTableDragStart}
            />
          );
        })}
      </div>

      {/* Légende - en dehors du zoom */}
      {!isEditMode && <TableLegend />}
    </div>
  );
});

TableMap.displayName = 'TableMap';

export default TableMap;