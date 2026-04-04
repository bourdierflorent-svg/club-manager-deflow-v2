import React, { memo } from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  icon: LucideIcon;
  value: string | number;
  label: string;
  color?: 'gold' | 'emerald' | 'amber' | 'indigo' | 'red' | 'blue' | 'purple' | 'white';
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
}

const COLOR_CLASSES = {
  gold: { icon: 'text-zinc-500', value: 'text-white' },
  emerald: { icon: 'text-emerald-500', value: 'text-emerald-400' },
  amber: { icon: 'text-amber-500', value: 'text-amber-400' },
  indigo: { icon: 'text-indigo-400', value: 'text-indigo-400' },
  red: { icon: 'text-red-500', value: 'text-red-400' },
  blue: { icon: 'text-blue-500', value: 'text-blue-400' },
  purple: { icon: 'text-purple-500', value: 'text-purple-400' },
  white: { icon: 'text-zinc-400', value: 'text-white' },
} as const;

const SIZE_CLASSES = {
  sm: {
    container: 'p-3 md:p-4',
    icon: 'w-4 h-4 mb-2',
    value: 'text-xl md:text-2xl',
    label: 'text-[11px]',
  },
  md: {
    container: 'p-4 md:p-5',
    icon: 'w-[18px] h-[18px] mb-2',
    value: 'text-2xl md:text-3xl',
    label: 'text-xs',
  },
  lg: {
    container: 'p-5 md:p-6',
    icon: 'w-5 h-5 mb-3',
    value: 'text-3xl md:text-4xl',
    label: 'text-xs',
  },
} as const;

const StatCard: React.FC<StatCardProps> = memo(({
  icon: Icon,
  value,
  label,
  color = 'gold',
  size = 'md',
  onClick,
}) => {
  const colorClasses = COLOR_CLASSES[color];
  const sizeClasses = SIZE_CLASSES[size];

  const Container = onClick ? 'button' : 'div';

  return (
    <Container
      onClick={onClick}
      className={`
        bg-zinc-900 border border-zinc-800 rounded-xl ${sizeClasses.container} text-center
        transition-colors
        ${onClick ? 'cursor-pointer hover:border-zinc-700 active:scale-[0.98]' : ''}
      `}
    >
      <Icon className={`${sizeClasses.icon} mx-auto ${colorClasses.icon}`} />
      <p className={`${sizeClasses.value} font-semibold ${colorClasses.value} tabular-nums tracking-tight`}>
        {value}
      </p>
      <p className={`${sizeClasses.label} text-zinc-500 mt-1`}>
        {label}
      </p>
    </Container>
  );
});

StatCard.displayName = 'StatCard';

export default StatCard;
