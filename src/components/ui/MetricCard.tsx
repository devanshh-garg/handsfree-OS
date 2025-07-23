'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { Card } from './Card';
import { cn, formatCurrency } from '@/lib/utils';

interface MetricCardProps {
  title: string;
  titleHindi?: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: LucideIcon;
  color?: 'saffron' | 'emerald' | 'gold' | 'crimson';
  format?: 'currency' | 'number' | 'percentage' | 'text';
  className?: string;
}

export function MetricCard({
  title,
  titleHindi,
  value,
  change,
  changeLabel,
  icon: Icon,
  color = 'saffron',
  format = 'number',
  className
}: MetricCardProps) {
  const formatValue = (val: string | number) => {
    if (typeof val === 'string') return val;
    
    switch (format) {
      case 'currency':
        return formatCurrency(val);
      case 'percentage':
        return `${val}%`;
      case 'number':
        return val.toLocaleString('en-IN');
      default:
        return val.toString();
    }
  };

  const colorClasses = {
    saffron: 'text-saffron bg-saffron/10',
    emerald: 'text-emerald bg-emerald/10',
    gold: 'text-gold bg-gold/10',
    crimson: 'text-crimson bg-crimson/10'
  };

  const changeColor = change !== undefined
    ? change > 0 
      ? 'text-emerald' 
      : change < 0 
        ? 'text-crimson' 
        : 'text-foreground-muted'
    : '';

  return (
    <Card hover className={cn('relative overflow-hidden', className)}>
      {/* Background Pattern */}
      <div className="absolute inset-0 pattern-bg opacity-30" />
      
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-sm font-medium text-foreground-muted mb-1">
              {title}
            </h3>
            {titleHindi && (
              <div className="text-xs text-foreground-muted font-devanagari">
                {titleHindi}
              </div>
            )}
          </div>
          
          {Icon && (
            <div className={cn('p-2 rounded-lg', colorClasses[color])}>
              <Icon className="w-4 h-4" />
            </div>
          )}
        </div>

        <div className="flex items-end justify-between">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-2xl font-bold text-foreground"
          >
            {formatValue(value)}
          </motion.div>

          {change !== undefined && (
            <div className="text-right">
              <div className={cn('text-sm font-medium', changeColor)}>
                {change > 0 ? '+' : ''}{change}
                {format === 'percentage' ? '%' : ''}
              </div>
              {changeLabel && (
                <div className="text-xs text-foreground-muted">
                  {changeLabel}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}