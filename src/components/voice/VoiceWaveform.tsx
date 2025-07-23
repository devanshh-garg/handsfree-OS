'use client';

import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useVoice } from '@/hooks/useVoice';
import { cn } from '@/lib/utils';

interface VoiceWaveformProps {
  className?: string;
  barCount?: number;
  height?: number;
  color?: string;
  animated?: boolean;
}

export function VoiceWaveform({ 
  className,
  barCount = 20,
  height = 40,
  color = 'saffron',
  animated = true
}: VoiceWaveformProps) {
  const { isListening, audioLevel } = useVoice();
  const barsRef = useRef<number[]>(new Array(barCount).fill(0));

  useEffect(() => {
    if (!isListening || !animated) {
      barsRef.current = new Array(barCount).fill(0);
      return;
    }

    const interval = setInterval(() => {
      // Simulate realistic audio waveform
      barsRef.current = barsRef.current.map((_, index) => {
        const baseLevel = Math.sin((Date.now() / 1000) * 2 + index * 0.5) * 0.3 + 0.7;
        const randomVariation = Math.random() * 0.4;
        const audioInfluence = (audioLevel / 100) * 0.6;
        
        return Math.max(0.1, Math.min(1, baseLevel + randomVariation + audioInfluence));
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isListening, audioLevel, barCount, animated]);

  const colorClasses = {
    saffron: 'bg-saffron',
    emerald: 'bg-emerald',
    gold: 'bg-gold',
    crimson: 'bg-crimson'
  };

  return (
    <div 
      className={cn(
        'flex items-end justify-center gap-1',
        className
      )}
      style={{ height }}
    >
      {Array.from({ length: barCount }).map((_, index) => (
        <motion.div
          key={index}
          className={cn(
            'w-1 rounded-full transition-all duration-150',
            colorClasses[color as keyof typeof colorClasses] || 'bg-saffron',
            !isListening && 'opacity-30'
          )}
          animate={{
            height: isListening && animated 
              ? `${(barsRef.current[index] || 0.1) * height}px`
              : '4px'
          }}
          transition={{
            duration: 0.1,
            ease: 'easeOut'
          }}
        />
      ))}
    </div>
  );
}

// Circular waveform for a more modern look
export function CircularVoiceWaveform({ 
  className,
  size = 100,
  strokeWidth = 2,
  color = 'saffron'
}: {
  className?: string;
  size?: number;
  strokeWidth?: number;
  color?: string;
}) {
  const { isListening, audioLevel } = useVoice();
  const pathRef = useRef<string>('');

  useEffect(() => {
    if (!isListening) return;

    const interval = setInterval(() => {
      const centerX = size / 2;
      const centerY = size / 2;
      const radius = (size / 2) - strokeWidth * 2;
      const points = 64;
      
      let path = `M ${centerX + radius} ${centerY}`;
      
      for (let i = 0; i <= points; i++) {
        const angle = (i / points) * Math.PI * 2;
        const waveHeight = Math.sin((Date.now() / 1000) * 3 + i * 0.2) * 10 + (audioLevel / 100) * 15;
        const x = centerX + Math.cos(angle) * (radius + waveHeight);
        const y = centerY + Math.sin(angle) * (radius + waveHeight);
        
        if (i === 0) {
          path = `M ${x} ${y}`;
        } else {
          path += ` L ${x} ${y}`;
        }
      }
      
      path += ' Z';
      pathRef.current = path;
    }, 50);

    return () => clearInterval(interval);
  }, [isListening, audioLevel, size, strokeWidth]);

  const colorClasses = {
    saffron: 'stroke-saffron',
    emerald: 'stroke-emerald',
    gold: 'stroke-gold',
    crimson: 'stroke-crimson'
  };

  return (
    <div className={cn('relative', className)}>
      <svg width={size} height={size} className="absolute inset-0">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={(size / 2) - strokeWidth}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="opacity-20"
        />
        
        {/* Animated waveform */}
        {isListening && (
          <motion.path
            d={pathRef.current}
            fill="none"
            strokeWidth={strokeWidth}
            className={cn(
              colorClasses[color as keyof typeof colorClasses] || 'stroke-saffron',
              'opacity-80'
            )}
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.8 }}
            transition={{ duration: 0.5 }}
          />
        )}
      </svg>
      
      {/* Center dot */}
      <div 
        className={cn(
          'absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 rounded-full',
          isListening ? 'bg-saffron' : 'bg-foreground-muted',
          'transition-all duration-300'
        )}
        style={{ 
          width: strokeWidth * 3, 
          height: strokeWidth * 3 
        }}
      />
    </div>
  );
}

// Mini waveform for status indicators
export function MiniVoiceWaveform({ 
  className,
  isActive = false 
}: {
  className?: string;
  isActive?: boolean;
}) {
  return (
    <div className={cn('flex items-center gap-0.5', className)}>
      {Array.from({ length: 4 }).map((_, index) => (
        <motion.div
          key={index}
          className="w-0.5 bg-current rounded-full"
          animate={isActive ? {
            height: [2, 8, 4, 12, 6, 2],
            opacity: [0.3, 1, 0.7, 1, 0.5, 0.3]
          } : {
            height: 2,
            opacity: 0.3
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            delay: index * 0.1,
            ease: 'easeInOut'
          }}
        />
      ))}
    </div>
  );
}