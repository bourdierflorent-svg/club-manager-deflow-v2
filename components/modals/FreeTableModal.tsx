/**
 * components/modals/FreeTableModal.tsx
 * Modal affichee au clic sur une table libre
 * Permet d'installer un client existant (en attente) ou de creer un nouveau client
 */

import React, { useEffect, useState, useMemo } from 'react';
import { X, UserPlus, UserCheck, ArrowLeft, Search, Clock } from 'lucide-react';
import { Table, User, Client } from '../../src/types';

// ============================================
// TYPES
// ============================================

type ModalStep = 'choice' | 'existing' | 'newClient';

interface FreeTableModalProps {
  isOpen: boolean;
  onClose: () => void;
  table: Table | null;
  /** Clients en attente de table (status pending, pas de tableId) */
  pendingClients: Client[];
  /** Assigner un client existant a cette table */
  onAssignExisting: (clientId: string, waiterId?: string) => void;
  /** Creer un nouveau client (cree aussi la resa du jour) */
  onCreateClient: (name: string, apporteur?: string, waiterId?: string) => void;
  waiters?: User[];
  autoWaiterId?: string;
}

// ============================================
// COMPOSANT
// ============================================

const FreeTableModal: React.FC<FreeTableModalProps> = ({
  isOpen,
  onClose,
  table,
  pendingClients,
  onAssignExisting,
  onCreateClient,
  waiters = [],
  autoWaiterId,
}) => {
  const [step, setStep] = useState<ModalStep>('choice');

  // --- Existing client selection ---
  const [selectedClientId, setSelectedClientId] = useState('');
  const [existingWaiterId, setExistingWaiterId] = useState(autoWaiterId || '');
  const [searchExisting, setSearchExisting] = useState('');

  // --- New client form ---
  const [clientName, setClientName] = useState('');
  const [clientApporteur, setClientApporteur] = useState('');
  const [selectedWaiterId, setSelectedWaiterId] = useState(autoWaiterId || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset complet à chaque ouverture
  useEffect(() => {
    if (isOpen) {
      setStep('choice');
      setSelectedClientId('');
      setExistingWaiterId(autoWaiterId || '');
      setSearchExisting('');
      setClientName('');
      setClientApporteur('');
      setSelectedWaiterId(autoWaiterId || '');
      setIsSubmitting(false);
    }
  }, [isOpen, autoWaiterId]);

  const goBack = () => {
    setStep('choice');
    setSelectedClientId('');
    setSearchExisting('');
  };

  // Filtered pending clients
  const filteredPending = useMemo(() => {
    if (!searchExisting.trim()) return pendingClients;
    const q = searchExisting.toLowerCase();
    return pendingClients.filter(c => c.name.toLowerCase().includes(q));
  }, [pendingClients, searchExisting]);

  // Fermeture AVANT action pour garantir la fermeture du modal
  const handleAssignExisting = () => {
    if (!selectedClientId) return;
    const clientId = selectedClientId;
    const waiterId = existingWaiterId || undefined;
    onClose();
    onAssignExisting(clientId, waiterId);
  };

  const handleSubmitNewClient = () => {
    if (!clientName.trim() || isSubmitting) return;
    setIsSubmitting(true);
    const name = clientName.trim();
    const apporteur = clientApporteur.trim() || undefined;
    const waiterId = selectedWaiterId || undefined;
    onClose();
    onCreateClient(name, apporteur, waiterId);
  };

  if (!isOpen || !table) return null;

  const tableLabel = table.number.toUpperCase().startsWith('BAR')
    ? table.number.toUpperCase()
    : `TABLE ${table.number}`;

  return (
    <div className="fixed inset-0 z-[500] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-t-2xl sm:rounded-2xl p-8 w-full max-w-md modal-enter max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex justify-between items-center mb-6 shrink-0">
          <div className="flex items-center gap-3">
            {step !== 'choice' && (
              <button onClick={goBack} className="text-zinc-500 hover:text-white transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <h3 className="text-2xl font-semibold text-white">
                {tableLabel}
              </h3>
              <p className="text-emerald-500 text-xs font-medium">
                Libre
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* === STEP: CHOIX === */}
        {step === 'choice' && (
          <div className="space-y-3">
            <button
              onClick={() => setStep('existing')}
              className="w-full flex items-center gap-4 p-5 rounded-lg border-2 border-zinc-800 hover:border-emerald-500/50 bg-zinc-800 hover:bg-emerald-500/10 transition-all group"
            >
              <div className="w-12 h-12 rounded-lg bg-emerald-500/20 flex items-center justify-center group-hover:bg-emerald-500/30 transition-all">
                <UserCheck className="w-6 h-6 text-emerald-400" />
              </div>
              <div className="text-left">
                <p className="text-white font-medium text-sm">Installer un client</p>
                <p className="text-zinc-500 text-xs">Choisir un client en attente de table</p>
              </div>
              {pendingClients.length > 0 && (
                <span className="ml-auto bg-emerald-500/20 text-emerald-400 text-xs font-medium px-2.5 py-1 rounded-full">
                  {pendingClients.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setStep('newClient')}
              className="w-full flex items-center gap-4 p-5 rounded-lg border-2 border-zinc-800 hover:border-blue-500/50 bg-zinc-800 hover:bg-blue-500/10 transition-all group"
            >
              <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/30 transition-all">
                <UserPlus className="w-6 h-6 text-blue-400" />
              </div>
              <div className="text-left">
                <p className="text-white font-medium text-sm">Nouveau client</p>
                <p className="text-zinc-500 text-xs">Creer et installer directement</p>
              </div>
            </button>
          </div>
        )}

        {/* === STEP: CLIENT EXISTANT === */}
        {step === 'existing' && (
          <div className="flex flex-col flex-1 min-h-0 space-y-4">
            {/* Barre de recherche */}
            {pendingClients.length > 3 && (
              <div className="relative shrink-0">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  placeholder="RECHERCHER..."
                  value={searchExisting}
                  onChange={e => setSearchExisting(e.target.value.toUpperCase())}
                  className="w-full bg-zinc-800 border-2 border-zinc-700 rounded-lg py-3 pl-11 pr-4 text-white font-bold uppercase outline-none focus:border-zinc-500 transition-colors text-sm"
                  autoFocus
                />
              </div>
            )}

            {/* Selection serveur si pas auto */}
            {!autoWaiterId && waiters.length > 0 && (
              <select
                value={existingWaiterId}
                onChange={e => setExistingWaiterId(e.target.value)}
                className="w-full bg-zinc-800 border-2 border-zinc-700 rounded-lg py-3 px-4 text-white font-bold uppercase outline-none focus:border-zinc-500 transition-colors text-sm shrink-0"
              >
                <option value="">-- Serveur (optionnel) --</option>
                {waiters.map(w => (
                  <option key={w.id} value={w.id}>{w.firstName} {w.lastName}</option>
                ))}
              </select>
            )}

            {/* Liste des clients en attente */}
            <div className="flex-1 overflow-y-auto space-y-2 no-scrollbar">
              {filteredPending.length === 0 ? (
                <div className="py-12 text-center">
                  <Clock className="w-10 h-10 mx-auto text-zinc-800 mb-3" />
                  <p className="text-zinc-500 font-bold uppercase text-sm">
                    {pendingClients.length === 0 ? 'Aucun client en attente' : 'Aucun resultat'}
                  </p>
                </div>
              ) : (
                filteredPending.map(client => (
                  <button
                    key={client.id}
                    onClick={() => setSelectedClientId(client.id)}
                    className={`w-full p-4 rounded-lg flex items-center gap-3 border-2 transition-all text-left ${
                      selectedClientId === client.id
                        ? 'bg-emerald-500/20 border-emerald-500'
                        : 'bg-zinc-800 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      selectedClientId === client.id ? 'bg-emerald-500/30' : 'bg-zinc-800'
                    }`}>
                      <UserCheck className={`w-5 h-5 ${selectedClientId === client.id ? 'text-emerald-400' : 'text-zinc-500'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium text-sm truncate ${
                        selectedClientId === client.id ? 'text-white' : 'text-zinc-400'
                      }`}>
                        {client.name}
                      </p>
                      {client.businessProvider && (
                        <p className="text-zinc-500 text-xs font-bold truncate">
                          P: {client.businessProvider}
                        </p>
                      )}
                    </div>
                    {selectedClientId === client.id && (
                      <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                        <UserCheck className="w-3.5 h-3.5 text-white" />
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>

            {/* Badge table + Bouton confirmer */}
            <div className="shrink-0 space-y-3 pt-2">
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                <p className="text-emerald-400 text-xs font-medium text-center">
                  {tableLabel}
                </p>
              </div>

              <button
                onClick={handleAssignExisting}
                disabled={!selectedClientId}
                className="w-full bg-emerald-600 disabled:opacity-30 text-white py-5 rounded-lg font-medium uppercase active:scale-95 transition-all"
              >
                Installer a cette table
              </button>
            </div>
          </div>
        )}

        {/* === STEP: NOUVEAU CLIENT === */}
        {step === 'newClient' && (
          <div className="space-y-4">
            <input
              type="text"
              placeholder="NOM DU CLIENT"
              value={clientName}
              onChange={e => setClientName(e.target.value.toUpperCase())}
              className="w-full bg-zinc-800 border-2 border-zinc-700 rounded-lg py-5 px-6 text-white font-medium text-xl uppercase outline-none focus:border-zinc-500 transition-colors"
              autoFocus
            />
            <input
              type="text"
              placeholder="APPORTEUR (OPTIONNEL)"
              value={clientApporteur}
              onChange={e => setClientApporteur(e.target.value.toUpperCase())}
              className="w-full bg-zinc-800 border-2 border-zinc-700 rounded-lg py-4 px-6 text-white font-medium uppercase outline-none focus:border-zinc-500 transition-colors"
            />

            {/* Selection serveur : visible seulement si pas de autoWaiterId ET serveurs disponibles */}
            {!autoWaiterId && waiters.length > 0 && (
              <select
                value={selectedWaiterId}
                onChange={e => setSelectedWaiterId(e.target.value)}
                className="w-full bg-zinc-800 border-2 border-zinc-700 rounded-lg py-4 px-6 text-white font-medium uppercase outline-none focus:border-zinc-500 transition-colors"
              >
                <option value="">-- Serveur (optionnel) --</option>
                {waiters.map(w => (
                  <option key={w.id} value={w.id}>{w.firstName} {w.lastName}</option>
                ))}
              </select>
            )}

            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <p className="text-blue-400 text-xs font-medium text-center">
                {tableLabel} — Ajout dans les resas du jour
              </p>
            </div>

            <button
              onClick={handleSubmitNewClient}
              disabled={!clientName.trim() || isSubmitting}
              className="w-full bg-blue-600 disabled:opacity-30 text-white py-5 rounded-lg font-medium uppercase active:scale-95 transition-all"
            >
              {isSubmitting ? 'Installation...' : 'Creer et installer'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FreeTableModal;
