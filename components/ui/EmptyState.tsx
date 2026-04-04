import React, { memo } from 'react';
import {
  Users, Calendar, History, ShoppingBag, Search,
  FileText, Inbox, Coffee, Wine, ClipboardList,
  UserPlus, Plus, ArrowRight, LucideIcon
} from 'lucide-react';

// ============================================
// EMPTY STATE COMPONENTS - Professional UX
// ============================================

// ============================================
// 📝 TYPES
// ============================================

interface EmptyStateProps {
  type?: 'clients' | 'orders' | 'archives' | 'reservations' | 'search' | 'team' | 'products' | 'logs' | 'generic';
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  className?: string;
}

interface LegacyEmptyStateProps {
  message: string;
  icon?: LucideIcon;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'glass' | 'minimal';
}

// ============================================
// 🎨 ILLUSTRATIONS
// ============================================

const illustrations = {
  clients: (
    <div className="relative">
      <div className="absolute inset-0 bg-zinc-800 rounded-full blur-3xl" />
      <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-zinc-700/30 to-zinc-800/20 border border-zinc-800 flex items-center justify-center">
        <Users className="w-10 h-10 text-zinc-500" />
      </div>
      <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-zinc-900 border-2 border-zinc-700 flex items-center justify-center">
        <Coffee className="w-4 h-4 text-zinc-500" />
      </div>
    </div>
  ),
  orders: (
    <div className="relative">
      <div className="absolute inset-0 bg-emerald-500/10 rounded-full blur-3xl" />
      <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border border-emerald-500/20 flex items-center justify-center">
        <ShoppingBag className="w-10 h-10 text-emerald-500/60" />
      </div>
      <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-zinc-900 border-2 border-emerald-500/30 flex items-center justify-center">
        <Wine className="w-4 h-4 text-emerald-500/60" />
      </div>
    </div>
  ),
  archives: (
    <div className="relative">
      <div className="absolute inset-0 bg-purple-500/10 rounded-full blur-3xl" />
      <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-purple-500/20 to-purple-500/5 border border-purple-500/20 flex items-center justify-center">
        <History className="w-10 h-10 text-purple-500/60" />
      </div>
      <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-zinc-900 border-2 border-purple-500/30 flex items-center justify-center">
        <FileText className="w-4 h-4 text-purple-500/60" />
      </div>
    </div>
  ),
  reservations: (
    <div className="relative">
      <div className="absolute inset-0 bg-blue-500/10 rounded-full blur-3xl" />
      <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-blue-500/20 to-blue-500/5 border border-blue-500/20 flex items-center justify-center">
        <Calendar className="w-10 h-10 text-blue-500/60" />
      </div>
    </div>
  ),
  search: (
    <div className="relative">
      <div className="absolute inset-0 bg-zinc-800/50 rounded-full blur-3xl" />
      <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-zinc-700/20 to-zinc-800/10 border border-zinc-800 flex items-center justify-center">
        <Search className="w-10 h-10 text-zinc-500" />
      </div>
    </div>
  ),
  team: (
    <div className="relative">
      <div className="absolute inset-0 bg-zinc-800 rounded-full blur-3xl" />
      <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-zinc-700/30 to-zinc-800/20 border border-zinc-800 flex items-center justify-center">
        <Users className="w-10 h-10 text-zinc-500" />
      </div>
      <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-zinc-900 border-2 border-zinc-700 flex items-center justify-center">
        <UserPlus className="w-4 h-4 text-zinc-500" />
      </div>
    </div>
  ),
  products: (
    <div className="relative">
      <div className="absolute inset-0 bg-amber-500/10 rounded-full blur-3xl" />
      <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-amber-500/20 to-amber-500/5 border border-amber-500/20 flex items-center justify-center">
        <Wine className="w-10 h-10 text-amber-500/60" />
      </div>
    </div>
  ),
  logs: (
    <div className="relative">
      <div className="absolute inset-0 bg-slate-500/10 rounded-full blur-3xl" />
      <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-slate-500/20 to-slate-500/5 border border-slate-500/20 flex items-center justify-center">
        <ClipboardList className="w-10 h-10 text-slate-500/60" />
      </div>
    </div>
  ),
  generic: (
    <div className="relative">
      <div className="absolute inset-0 bg-zinc-800/50 rounded-full blur-3xl" />
      <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-zinc-700/20 to-zinc-800/10 border border-zinc-800 flex items-center justify-center">
        <Inbox className="w-10 h-10 text-zinc-500" />
      </div>
    </div>
  ),
};

const defaultContent = {
  clients: {
    title: 'Aucun client ce soir',
    description: 'Les clients apparaîtront ici une fois enregistrés par l\'hôtesse.',
  },
  orders: {
    title: 'Aucune commande',
    description: 'Les commandes en attente apparaîtront ici.',
  },
  archives: {
    title: 'Aucune archive',
    description: 'Les soirées clôturées seront archivées ici.',
  },
  reservations: {
    title: 'Aucune réservation',
    description: 'Les réservations à venir apparaîtront ici.',
  },
  search: {
    title: 'Aucun résultat',
    description: 'Essayez de modifier votre recherche.',
  },
  team: {
    title: 'Aucun membre',
    description: 'Ajoutez des membres à votre équipe.',
  },
  products: {
    title: 'Aucun produit',
    description: 'Configurez votre carte de produits.',
  },
  logs: {
    title: 'Aucune activité',
    description: 'L\'historique des actions apparaîtra ici.',
  },
  generic: {
    title: 'Rien à afficher',
    description: 'Aucun élément disponible pour le moment.',
  },
};

// ============================================
// 🧩 NEW PROFESSIONAL EMPTY STATE
// ============================================

export const EmptyStatePro: React.FC<EmptyStateProps> = ({
  type = 'generic',
  title,
  description,
  action,
  className = '',
}) => {
  const content = defaultContent[type];
  const illustration = illustrations[type];

  return (
    <div className={`flex flex-col items-center justify-center py-16 px-8 text-center ${className}`}>
      {/* Illustration */}
      <div className="mb-8 animate-float">
        {illustration}
      </div>

      {/* Text */}
      <h3 className="text-xl font-semibold text-zinc-300 uppercase tracking-tight mb-2">
        {title || content.title}
      </h3>
      <p className="text-sm text-zinc-500 max-w-xs leading-relaxed">
        {description || content.description}
      </p>

      {/* Action Button */}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-8 flex items-center gap-2 bg-white hover:bg-zinc-200 text-black px-6 py-3 rounded-xl font-semibold uppercase text-xs shadow-lg hover:shadow-xl hover:scale-105 transition-all group"
        >
          {action.icon || <Plus className="w-4 h-4" />}
          {action.label}
          <ArrowRight className="w-4 h-4 opacity-0 -ml-2 group-hover:opacity-100 group-hover:ml-0 transition-all" />
        </button>
      )}
    </div>
  );
};

// Compact Empty State for smaller areas
export const EmptyStateCompact: React.FC<{
  icon?: React.ReactNode;
  message: string;
  className?: string;
}> = ({ icon, message, className = '' }) => (
  <div className={`flex flex-col items-center justify-center py-8 text-center ${className}`}>
    <div className="w-12 h-12 rounded-full bg-zinc-800/50 flex items-center justify-center mb-3">
      {icon || <Inbox className="w-5 h-5 text-zinc-600" />}
    </div>
    <p className="text-xs text-zinc-500 font-semibold uppercase tracking-widest">
      {message}
    </p>
  </div>
);

// ============================================
// 🎨 LEGACY STYLES (backwards compatibility)
// ============================================

const SIZE_CLASSES = {
  sm: {
    container: 'py-16',
    icon: 'w-8 h-8 mb-3',
    text: 'text-xs tracking-[0.3em]',
  },
  md: {
    container: 'py-24',
    icon: 'w-12 h-12 mb-4',
    text: 'text-sm tracking-[0.4em]',
  },
  lg: {
    container: 'py-32',
    icon: 'w-16 h-16 mb-6',
    text: 'text-base tracking-[0.4em]',
  },
} as const;

const VARIANT_CLASSES = {
  default: 'bg-zinc-900 border border-zinc-800 rounded-xl',
  glass: 'bg-zinc-900 border border-zinc-800 rounded-xl',
  minimal: '',
} as const;

// ============================================
// 🧩 LEGACY COMPOSANT (backwards compatibility)
// ============================================

const EmptyState: React.FC<LegacyEmptyStateProps> = memo(({
  message,
  icon: Icon = Inbox,
  size = 'md',
  variant = 'default',
}) => {
  const sizeClasses = SIZE_CLASSES[size];
  const variantClasses = VARIANT_CLASSES[variant];

  return (
    <div className={`${sizeClasses.container} text-center ${variantClasses}`}>
      <Icon className={`${sizeClasses.icon} mx-auto text-zinc-600`} />
      <p className={`${sizeClasses.text} text-zinc-600 font-semibold uppercase`}>
        {message}
      </p>
    </div>
  );
});

EmptyState.displayName = 'EmptyState';

export default EmptyState;
