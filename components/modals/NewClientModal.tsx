/**
 * 📁 components/modals/NewClientModal.tsx
 * Modal pour créer un nouveau client
 */

import React, { useCallback, useState } from 'react';
import { X } from 'lucide-react';

// ============================================
// 📝 TYPES
// ============================================

interface NewClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string, apporteur?: string) => void;
  isLoading?: boolean;
}

// ============================================
// 🎯 COMPOSANT PRINCIPAL
// ============================================

const NewClientModal: React.FC<NewClientModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
}) => {
  const [name, setName] = useState('');
  const [apporteur, setApporteur] = useState('');

  const handleSubmit = useCallback(() => {
    if (name.trim()) {
      onSubmit(name.trim(), apporteur.trim() || undefined);
      setName('');
      setApporteur('');
    }
  }, [name, apporteur, onSubmit]);

  const handleClose = useCallback(() => {
    setName('');
    setApporteur('');
    onClose();
  }, [onClose]);

  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value.toUpperCase());
  }, []);

  const handleApporteurChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setApporteur(e.target.value.toUpperCase());
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[500] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-t-2xl sm:rounded-2xl p-8 w-full max-w-md">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-semibold text-white">
            Nouvelle Résa
          </h3>
          <button 
            onClick={handleClose} 
            className="text-zinc-500 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Formulaire */}
        <div className="space-y-4">
          <input
            type="text"
            placeholder="NOM DU CLIENT"
            value={name}
            onChange={handleNameChange}
            className="w-full bg-zinc-800 border-2 border-zinc-700 rounded-lg py-5 px-6 text-white font-medium text-xl uppercase outline-none focus:border-zinc-500 transition-colors"
            autoFocus
          />
          <input
            type="text"
            placeholder="APPORTEUR (OPTIONNEL)"
            value={apporteur}
            onChange={handleApporteurChange}
            className="w-full bg-zinc-800 border-2 border-zinc-700 rounded-lg py-4 px-6 text-white font-medium uppercase outline-none focus:border-zinc-500 transition-colors"
          />
        </div>

        {/* Bouton Submit */}
        <button
          onClick={handleSubmit}
          disabled={!name.trim() || isLoading}
          className="w-full mt-6 bg-emerald-600 disabled:opacity-30 text-white py-5 rounded-lg font-medium uppercase active:scale-95 transition-all"
        >
          {isLoading ? 'Création...' : 'Créer Réservation'}
        </button>
      </div>
    </div>
  );
};

export default NewClientModal;
