/**
 * 📁 components/modals/WaiterSelectionModal.tsx
 * Modal pour transférer un client à un autre serveur
 */

import React, { memo, useCallback, useState } from 'react';
import { User } from '../../src/types';
import { X } from 'lucide-react';

// ============================================
// 📝 TYPES
// ============================================

interface WaiterSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (waiterId: string) => void;
  waiters: User[];
  clientName: string;
  currentUserId?: string;
  isLoading?: boolean;
}

// ============================================
// 🧩 SOUS-COMPOSANT: WaiterButton
// ============================================

interface WaiterButtonProps {
  waiter: User;
  isSelected: boolean;
  onSelect: (waiterId: string) => void;
}

const WaiterButton: React.FC<WaiterButtonProps> = memo(({
  waiter,
  isSelected,
  onSelect,
}) => {
  const handleClick = useCallback(() => {
    onSelect(waiter.id);
  }, [onSelect, waiter.id]);

  return (
    <button
      onClick={handleClick}
      className={`w-full py-6 px-8 rounded-lg font-semibold text-xl flex justify-between items-center border-2 transition-all ${
        isSelected
          ? 'bg-white border-white text-black'
          : 'bg-zinc-800 border-zinc-800 text-white'
      }`}
    >
      <span>{waiter.firstName} {waiter.lastName}</span>
    </button>
  );
}, (prev, next) => (
  prev.waiter.id === next.waiter.id &&
  prev.isSelected === next.isSelected
));

WaiterButton.displayName = 'WaiterButton';

// ============================================
// 🎯 COMPOSANT PRINCIPAL
// ============================================

const WaiterSelectionModal: React.FC<WaiterSelectionModalProps> = memo(({
  isOpen,
  onClose,
  onSubmit,
  waiters,
  clientName,
  currentUserId,
  isLoading = false,
}) => {
  const [selectedWaiterId, setSelectedWaiterId] = useState('');

  // Filtrer le serveur actuel
  const availableWaiters = waiters.filter(w => w.id !== currentUserId);

  const handleSubmit = useCallback(() => {
    if (selectedWaiterId) {
      onSubmit(selectedWaiterId);
      setSelectedWaiterId('');
    }
  }, [selectedWaiterId, onSubmit]);

  const handleClose = useCallback(() => {
    setSelectedWaiterId('');
    onClose();
  }, [onClose]);

  const handleSelectWaiter = useCallback((waiterId: string) => {
    setSelectedWaiterId(waiterId);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[600] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-t-2xl sm:rounded-2xl p-10 w-full max-w-md h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h3 className="text-2xl font-semibold text-white">Changer Serveur</h3>
            <p className="text-zinc-400 text-xs font-bold">{clientName}</p>
          </div>
          <button 
            onClick={handleClose} 
            className="text-zinc-500 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Liste des serveurs */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
          {availableWaiters.length === 0 ? (
            <div className="text-center py-16 text-zinc-600 font-medium">
              Aucun autre serveur disponible
            </div>
          ) : (
            availableWaiters.map(waiter => (
              <WaiterButton
                key={waiter.id}
                waiter={waiter}
                isSelected={selectedWaiterId === waiter.id}
                onSelect={handleSelectWaiter}
              />
            ))
          )}
        </div>

        {/* Bouton Submit */}
        <button
          onClick={handleSubmit}
          disabled={!selectedWaiterId || isLoading}
          className="w-full mt-6 bg-emerald-600 disabled:opacity-30 text-white py-5 rounded-lg font-medium uppercase transition-all active:scale-95"
        >
          {isLoading ? 'Chargement...' : 'Transférer'}
        </button>
      </div>
    </div>
  );
});

WaiterSelectionModal.displayName = 'WaiterSelectionModal';

export default WaiterSelectionModal;
