import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useStore } from '../store/index';
import { Flower2, Delete, ChevronRight, Lock, AlertTriangle } from 'lucide-react';
import { canAttemptLogin, recordFailedAttempt, resetLoginAttempts } from '../src/utils';

// ============================================
// AUTH - DEFLOWER (avec rate limiting)
// ============================================

const PIN_LENGTH = 4;

const Auth: React.FC = () => {
  const { users, login } = useStore();
  const [selectedUser, setSelectedUser] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [lockoutTime, setLockoutTime] = useState<number | null>(null);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number>(5);

  // Utilisateurs actifs triés
  const sortedUsers = useMemo(() =>
    [...users]
      .filter(u => u.isActive)
      .sort((a, b) => a.firstName.localeCompare(b.firstName)),
    [users]
  );

  // Countdown pour le lockout
  useEffect(() => {
    if (lockoutTime === null || lockoutTime <= 0) return;

    const interval = setInterval(() => {
      setLockoutTime(prev => {
        if (prev === null || prev <= 1) {
          setError(null);
          setAttemptsRemaining(5);
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [lockoutTime]);

  // Vérifier le statut du rate limiting quand l'utilisateur change
  useEffect(() => {
    if (selectedUser) {
      const status = canAttemptLogin(selectedUser);
      if (!status.allowed && status.remainingTime) {
        setLockoutTime(status.remainingTime);
        setError(`Compte verrouillé. Réessayez dans ${status.remainingTime}s`);
      } else {
        setLockoutTime(null);
        setAttemptsRemaining(status.attemptsLeft ?? 5);
      }
    }
  }, [selectedUser]);

  const handlePinClick = useCallback((num: string) => {
    if (pin.length >= PIN_LENGTH) return;
    if (lockoutTime !== null && lockoutTime > 0) return;

    const newPin = pin + num;
    setPin(newPin);

    if (newPin.length === PIN_LENGTH) {
      if (!selectedUser) {
        setError('Veuillez sélectionner un utilisateur');
        setPin('');
        return;
      }

      // Vérifier le rate limiting avant la tentative
      const canAttempt = canAttemptLogin(selectedUser);
      if (!canAttempt.allowed) {
        setLockoutTime(canAttempt.remainingTime ?? 300);
        setError(`Trop de tentatives. Réessayez dans ${canAttempt.remainingTime}s`);
        setPin('');
        return;
      }

      const success = login(newPin, selectedUser);
      if (!success) {
        // Enregistrer l'échec et vérifier si verrouillage
        const result = recordFailedAttempt(selectedUser);

        if (result.locked) {
          setLockoutTime(result.lockoutDuration ?? 300);
          setError(`Compte verrouillé pendant ${Math.ceil((result.lockoutDuration ?? 300) / 60)} minutes`);
        } else {
          const remaining = canAttemptLogin(selectedUser).attemptsLeft ?? 0;
          setAttemptsRemaining(remaining);
          setError(`Code PIN incorrect (${remaining} tentative${remaining > 1 ? 's' : ''} restante${remaining > 1 ? 's' : ''})`);
        }
        setPin('');
      } else {
        // Connexion réussie: réinitialiser les tentatives
        resetLoginAttempts(selectedUser);
        setLockoutTime(null);
        setAttemptsRemaining(5);
      }
    }
  }, [pin, selectedUser, login, lockoutTime]);

  const handleBackspace = useCallback(() => {
    setPin(prev => prev.slice(0, -1));
  }, []);

  const handleUserChange = useCallback((userId: string) => {
    setSelectedUser(userId);
    setError(null);
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative Blur Effects */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-zinc-800/50 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-white/3 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[200px] h-[200px] bg-white/3 rounded-full blur-[80px] pointer-events-none" />

      <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-xl p-10 shadow-lg fade-in-scale">
        {/* Header - Premium Design */}
        <div className="flex flex-col items-center mb-10">
          <div className="relative">
            <div className="absolute inset-0 bg-white/30 rounded-xl blur-xl animate-pulse" />
            <div className="relative bg-white p-5 rounded-xl">
              <Flower2 className="w-12 h-12 text-black" />
            </div>
          </div>
          <h1 className="text-4xl font-semibold text-white tracking-tighter uppercase mt-6 tracking-tight">DEFLOWER</h1>
          <div className="flex items-center gap-3 mt-3">
            <div className="w-6 h-px bg-zinc-700"></div>
            <p className="text-zinc-400 text-[10px] font-semibold tracking-[0.4em] uppercase">Table Manager</p>
            <div className="w-6 h-px bg-zinc-700"></div>
          </div>
        </div>

        {/* Error / Lockout Warning */}
        {error && (
          <div className={`${lockoutTime ? 'bg-orange-500/10 border-orange-500/30' : 'bg-red-500/10 border-red-500/30'} border text-center py-3 rounded-xl mb-8`}>
            <div className="flex items-center justify-center gap-2">
              {lockoutTime ? (
                <Lock className="w-4 h-4 text-orange-500" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-500" />
              )}
              <span className={`${lockoutTime ? 'text-orange-500' : 'text-red-500'} text-xs font-semibold uppercase tracking-widest`}>
                {error}
              </span>
            </div>
            {lockoutTime && lockoutTime > 0 && (
              <div className="mt-2 text-orange-400 text-lg font-semibold">
                {Math.floor(lockoutTime / 60)}:{(lockoutTime % 60).toString().padStart(2, '0')}
              </div>
            )}
          </div>
        )}

        {/* Attempts remaining indicator */}
        {!lockoutTime && selectedUser && attemptsRemaining < 5 && (
          <div className="bg-zinc-800 border border-zinc-700 text-zinc-400 text-center py-2 rounded-xl mb-4 text-xs font-medium">
            {attemptsRemaining} tentative{attemptsRemaining > 1 ? 's' : ''} restante{attemptsRemaining > 1 ? 's' : ''}
          </div>
        )}

        {/* User Select */}
        <div className="mb-8">
          <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.2em] mb-3 ml-2">
            Sélectionner Membre
          </label>
          <div className="relative">
            <select
              className="w-full bg-zinc-800 border-2 border-zinc-800 text-white py-5 px-6 rounded-xl focus:outline-none focus:border-white transition-all appearance-none font-semibold text-lg uppercase"
              value={selectedUser}
              onChange={(e) => handleUserChange(e.target.value)}
            >
              <option value="">-- CHOISIR --</option>
              {sortedUsers.map(u => (
                <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
              ))}
            </select>
            <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none">
              <ChevronRight className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        {/* PIN Dots - Premium Animation */}
        <div className="flex justify-center gap-5 mb-10">
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full transition-all duration-300 ${
                pin.length > i
                  ? 'bg-white scale-125'
                  : 'bg-zinc-800 border border-zinc-800'
              }`}
            />
          ))}
        </div>

        {/* Keypad - Premium Design */}
        <div className={`grid grid-cols-3 gap-4 ${lockoutTime ? 'opacity-50 pointer-events-none' : ''}`}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
            <button
              key={num}
              onClick={() => handlePinClick(num)}
              disabled={!!lockoutTime}
              className="h-20 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 text-white text-3xl font-semibold transition-all active:scale-95 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {num}
            </button>
          ))}
          <div className="h-20" />
          <button
            onClick={() => handlePinClick('0')}
            disabled={!!lockoutTime}
            className="h-20 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 text-white text-3xl font-semibold transition-all active:scale-95 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            0
          </button>
          <button
            onClick={handleBackspace}
            disabled={!!lockoutTime}
            className="h-20 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white flex items-center justify-center transition-all active:scale-95 border border-zinc-700 hover:border-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Delete className="w-8 h-8" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Auth;
