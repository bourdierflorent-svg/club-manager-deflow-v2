import React from 'react';
import { useStore } from '../store/index';
import { LogOut, User, Flower2 } from 'lucide-react';
import NotificationCenter from './NotificationCenter';
import ConnectionIndicator from './ConnectionIndicator';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, logout, currentEvent } = useStore();

  if (!currentUser) return null;

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950">
      <NotificationCenter />

      <header className="sticky top-0 z-50 bg-zinc-950 border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
        {/* Logo et Event */}
        <div className="flex items-center gap-3">
          <div className="bg-white p-2 rounded-lg">
            <Flower2 className="w-5 h-5 text-zinc-950" />
          </div>
          <div>
            <h1 className="text-base font-semibold tracking-tight text-white">DEFLOWER</h1>
            {currentEvent && (
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                Live · {new Date(currentEvent.date).toLocaleDateString()}
              </div>
            )}
          </div>
        </div>

        {/* Actions droite */}
        <div className="flex items-center gap-2 sm:gap-3">
          <ConnectionIndicator />

          {/* Infos utilisateur (desktop) */}
          <div className="hidden md:flex flex-col items-end">
            <span className="text-sm font-medium text-white">
              {currentUser.firstName} {currentUser.lastName}
            </span>
            <span className="text-xs text-zinc-500">
              {currentUser.role}
            </span>
          </div>

          {/* Avatar */}
          <div className="w-9 h-9 rounded-lg bg-zinc-900 flex items-center justify-center border border-zinc-800">
            <span className="md:hidden text-zinc-400 font-medium text-xs">
              {currentUser.firstName.slice(0, 2).toUpperCase()}
            </span>
            <User className="hidden md:block w-4 h-4 text-zinc-500" />
          </div>

          {/* Deconnexion */}
          <button
            onClick={logout}
            className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full">
        {children}
      </main>

      <footer className="py-4 text-center text-[10px] text-zinc-700 border-t border-zinc-900">
        DEFLOWER &copy; 2025 · Club Manager by FB Global
      </footer>
    </div>
  );
};

export default Layout;
