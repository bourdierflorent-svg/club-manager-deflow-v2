/**
 * 📁 components/modals/TableSelectionModal.tsx
 * Modal réutilisable pour sélectionner une table
 * 
 * VERSION 2.1 CORRIGÉE:
 * - Affiche la table actuelle du client si elle existe
 * - Pré-sélectionne la table actuelle pour faciliter la récupération
 */

import React, { memo, useCallback, useState, useEffect } from 'react';
import { Table } from '../../src/types';
import { X, CheckCircle2 } from 'lucide-react';

// ============================================
// 📝 TYPES
// ============================================

export type TableSelectionVariant = 'assign' | 'transfer' | 'link';

interface TableSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (tableId: string) => void;
  tables: Table[];
  clientName: string;
  variant: TableSelectionVariant;
  isLoading?: boolean;
  currentTableId?: string; // 🆕 Table actuelle du client
}

// ============================================
// 🎨 CONFIG PAR VARIANT
// ============================================

const VARIANT_CONFIG = {
  assign: {
    title: 'Installer Client',
    buttonLabel: 'Installer',
    buttonColor: 'bg-emerald-600',
    selectedColor: 'bg-white border-white text-black',
  },
  transfer: {
    title: 'Transférer Table',
    buttonLabel: 'Transférer',
    buttonColor: 'bg-emerald-600',
    selectedColor: 'bg-white border-white text-black',
  },
  link: {
    title: 'Lier une Table',
    buttonLabel: 'Lier la Table',
    buttonColor: 'bg-blue-600',
    selectedColor: 'bg-blue-500 border-blue-500 text-white',
  },
} as const;

// ============================================
// 🧩 SOUS-COMPOSANT: TableButton
// ============================================

interface TableButtonProps {
  table: Table;
  isSelected: boolean;
  isCurrentTable: boolean; // 🆕
  onSelect: (tableId: string) => void;
  selectedColor: string;
}

const TableButton: React.FC<TableButtonProps> = memo(({
  table,
  isSelected,
  isCurrentTable,
  onSelect,
  selectedColor,
}) => {
  const handleClick = useCallback(() => {
    onSelect(table.id);
  }, [onSelect, table.id]);

  return (
    <button
      onClick={handleClick}
      className={`w-full py-6 px-8 rounded-lg font-semibold text-2xl flex justify-between items-center border-2 transition-all ${
        isSelected ? selectedColor : isCurrentTable ? 'bg-emerald-900/30 border-emerald-500/50 text-emerald-400' : 'bg-zinc-800 border-zinc-800 text-white'
      }`}
    >
      <div className="flex items-center gap-3">
        <span>{table.number.toUpperCase().startsWith('BAR') ? table.number : `T${table.number}`}</span>
        {/* 🆕 Badge table actuelle */}
        {isCurrentTable && (
          <span className="text-xs px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-lg uppercase font-bold flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Actuelle
          </span>
        )}
      </div>
    </button>
  );
}, (prev, next) => (
  prev.table.id === next.table.id &&
  prev.isSelected === next.isSelected &&
  prev.isCurrentTable === next.isCurrentTable
));

TableButton.displayName = 'TableButton';

// ============================================
// 🎯 COMPOSANT PRINCIPAL
// ============================================

const TableSelectionModal: React.FC<TableSelectionModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  tables,
  clientName,
  variant,
  isLoading = false,
  currentTableId, // 🆕
}) => {
  const [selectedTableId, setSelectedTableId] = useState('');
  const config = VARIANT_CONFIG[variant];

  // 🆕 Pré-sélectionner la table actuelle du client si elle existe
  useEffect(() => {
    if (isOpen && currentTableId && variant === 'assign') {
      // Vérifier que la table est dans la liste
      const tableExists = tables.find(t => t.id === currentTableId);
      if (tableExists) {
        setSelectedTableId(currentTableId);
      }
    }
  }, [isOpen, currentTableId, tables, variant]);

  const handleSubmit = useCallback(() => {
    if (selectedTableId) {
      onSubmit(selectedTableId);
      setSelectedTableId('');
    }
  }, [selectedTableId, onSubmit]);

  const handleClose = useCallback(() => {
    setSelectedTableId('');
    onClose();
  }, [onClose]);

  const handleSelectTable = useCallback((tableId: string) => {
    setSelectedTableId(tableId);
  }, []);

  if (!isOpen) return null;

  // 🆕 Trier les tables: table actuelle en premier
  const sortedTables = [...tables].sort((a, b) => {
    if (a.id === currentTableId) return -1;
    if (b.id === currentTableId) return 1;
    return 0;
  });

  return (
    <div className="fixed inset-0 z-[600] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-t-2xl sm:rounded-2xl p-10 w-full max-w-md h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h3 className="text-2xl font-semibold text-white">{config.title}</h3>
            <p className="text-zinc-400 text-xs font-bold">{clientName}</p>
          </div>
          <button 
            onClick={handleClose} 
            className="text-zinc-500 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* 🆕 Message si récupération avec table existante */}
        {currentTableId && variant === 'assign' && (
          <div className="mb-4 p-3 bg-emerald-900/20 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-bold">
            💡 Ce client a déjà une table assignée. Sélectionnez-la pour le récupérer directement.
          </div>
        )}

        {/* Liste des tables */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
          {tables.length === 0 ? (
            <div className="text-center py-16 text-zinc-600 font-medium">
              Aucune table disponible
            </div>
          ) : (
            sortedTables.map(table => (
              <TableButton
                key={table.id}
                table={table}
                isSelected={selectedTableId === table.id}
                isCurrentTable={table.id === currentTableId}
                onSelect={handleSelectTable}
                selectedColor={config.selectedColor}
              />
            ))
          )}
        </div>

        {/* Bouton Submit */}
        <button
          onClick={handleSubmit}
          disabled={!selectedTableId || isLoading}
          className={`w-full mt-6 ${config.buttonColor} disabled:opacity-30 text-white py-5 rounded-lg font-medium uppercase transition-all active:scale-95`}
        >
          {isLoading ? 'Chargement...' : config.buttonLabel}
        </button>
      </div>
    </div>
  );
};

export default TableSelectionModal;
