import React from 'react';

// ============================================
// SKELETON LOADING COMPONENTS - Professional UX
// ============================================

interface SkeletonProps {
  className?: string;
}

// Base Skeleton with shimmer animation
export const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => (
  <div
    className={`bg-zinc-800 rounded-xl relative overflow-hidden ${className}`}
  >
    <div
      className="absolute inset-0"
      style={{
        background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.05) 50%, transparent 100%)',
        animation: 'skeleton-shimmer 1.5s infinite',
      }}
    />
  </div>
);

// Card Skeleton
export const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`bg-zinc-900 border border-zinc-800 rounded-xl p-6 ${className}`}>
    <div className="flex items-center gap-4 mb-4">
      <Skeleton className="w-12 h-12 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
    <div className="space-y-3">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-4 w-4/6" />
    </div>
  </div>
);

// Stat Card Skeleton
export const SkeletonStatCard: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center ${className}`}>
    <Skeleton className="h-3 w-24 mx-auto mb-4" />
    <Skeleton className="h-10 w-32 mx-auto" />
  </div>
);

// Table Row Skeleton
export const SkeletonTableRow: React.FC = () => (
  <div className="flex items-center gap-4 p-4 border-b border-zinc-800">
    <Skeleton className="w-10 h-10 rounded-full" />
    <div className="flex-1 space-y-2">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-3 w-24" />
    </div>
    <Skeleton className="h-8 w-20 rounded-lg" />
  </div>
);

// List Skeleton
export const SkeletonList: React.FC<{ count?: number; type?: 'card' | 'row' }> = ({
  count = 3,
  type = 'card'
}) => (
  <div className={type === 'card' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-2'}>
    {Array.from({ length: count }).map((_, i) => (
      type === 'card' ? (
        <SkeletonCard key={i} />
      ) : (
        <SkeletonTableRow key={i} />
      )
    ))}
  </div>
);

// Client Card Skeleton
export const SkeletonClientCard: React.FC = () => (
  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-3">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-16 rounded-full" />
      </div>
      <div className="flex gap-1">
        <Skeleton className="w-8 h-8 rounded-lg" />
        <Skeleton className="w-8 h-8 rounded-lg" />
      </div>
    </div>
    <div className="flex items-center gap-4">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-6 w-16 rounded-lg" />
    </div>
  </div>
);

// KPI Grid Skeleton
export const SkeletonKPIGrid: React.FC = () => (
  <div className="grid grid-cols-3 gap-4">
    <SkeletonStatCard />
    <SkeletonStatCard />
    <SkeletonStatCard />
  </div>
);

// Full Page Loader
export const FullPageLoader: React.FC<{ message?: string }> = ({ message = 'Chargement...' }) => (
  <div className="fixed inset-0 bg-zinc-950/95 z-[9999] flex items-center justify-center">
    <div className="text-center">
      <div className="spinner-premium mx-auto mb-6" />
      <p className="text-zinc-400 font-semibold uppercase tracking-widest text-sm animate-pulse">
        {message}
      </p>
    </div>
  </div>
);

// Inline Loader
export const InlineLoader: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {
  const sizes = {
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-2',
    lg: 'w-10 h-10 border-3',
  };

  return (
    <div
      className={`${sizes[size]} border-zinc-800 border-t-white rounded-full animate-spin`}
    />
  );
};

// Button Loader (for inside buttons)
export const ButtonLoader: React.FC = () => (
  <div className="flex items-center gap-2">
    <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
    <span>Chargement...</span>
  </div>
);

export default Skeleton;
