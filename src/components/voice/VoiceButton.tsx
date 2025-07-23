'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Loader2, Volume2 } from 'lucide-react';
import { useVoice } from '@/hooks/useVoice';
import { cn } from '@/lib/utils';

interface VoiceButtonProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'ghost';
  showStatus?: boolean;
}

export function VoiceButton({ 
  className, 
  size = 'md', 
  variant = 'primary',
  showStatus = true 
}: VoiceButtonProps) {
  const {
    isSupported,
    isListening,
    isProcessing,
    currentCommand,
    lastResponse,
    error,
    audioLevel,
    startListening,
    stopListening,
    clearError
  } = useVoice();

  const handleClick = () => {
    if (error) {
      clearError();
      return;
    }
    
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const sizeClasses = {
    sm: 'w-12 h-12 text-sm',
    md: 'w-16 h-16 text-lg',
    lg: 'w-20 h-20 text-xl'
  };

  const variantClasses = {
    primary: 'bg-gradient-to-br from-saffron to-saffron-dark hover:from-saffron-light hover:to-saffron shadow-lg shadow-saffron/25',
    secondary: 'bg-gradient-to-br from-emerald to-emerald-dark hover:from-emerald-light hover:to-emerald shadow-lg shadow-emerald/25',
    ghost: 'bg-glass hover:bg-glass-hover border border-glass-border'
  };

  if (!isSupported) {
    return (
      <div className={cn(
        'flex items-center justify-center rounded-full cursor-not-allowed opacity-50',
        sizeClasses[size],
        'bg-gray-600',
        className
      )}>
        <MicOff className="w-1/2 h-1/2 text-gray-400" />
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Main Voice Button */}
      <motion.button
        onClick={handleClick}
        className={cn(
          'relative flex items-center justify-center rounded-full transition-all duration-300 cursor-pointer overflow-hidden',
          sizeClasses[size],
          variantClasses[variant],
          error && 'bg-gradient-to-br from-crimson to-crimson-dark shadow-lg shadow-crimson/25',
          className
        )}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        animate={isListening ? { scale: [1, 1.1, 1] } : {}}
        transition={{ 
          duration: isListening ? 1.5 : 0.2, 
          repeat: isListening ? Infinity : 0,
          ease: "easeInOut"
        }}
      >
        {/* Audio Level Visualization */}
        <AnimatePresence>
          {isListening && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 rounded-full"
            >
              {/* Pulse Rings */}
              {[...Array(3)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute inset-0 rounded-full border-2 border-white/30"
                  animate={{
                    scale: [1, 2, 2.5],
                    opacity: [0.8, 0.3, 0]
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    delay: i * 0.5,
                    ease: "easeOut"
                  }}
                />
              ))}
              
              {/* Audio Level Bar */}
              <motion.div
                className="absolute inset-2 rounded-full bg-white/20"
                animate={{
                  scale: 1 + (audioLevel / 200)
                }}
                transition={{ duration: 0.1 }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Icon */}
        <div className="relative z-10 text-white">
          {isProcessing ? (
            <Loader2 className="w-1/2 h-1/2 animate-spin" />
          ) : error ? (
            <MicOff className="w-1/2 h-1/2" />
          ) : isListening ? (
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              <Mic className="w-1/2 h-1/2" />
            </motion.div>
          ) : (
            <Mic className="w-1/2 h-1/2" />
          )}
        </div>

        {/* Hindi Text Overlay */}
        {size === 'lg' && (
          <div className="absolute bottom-1 text-xs font-devanagari text-white/80">
            {isListening ? 'सुन रहा है' : 'बोलें'}
          </div>
        )}
      </motion.button>

      {/* Status Display */}
      <AnimatePresence>
        {showStatus && (isListening || isProcessing || currentCommand || lastResponse || error) && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            className="absolute top-full mt-2 left-1/2 transform -translate-x-1/2 w-64 z-50"
          >
            <div className="glass rounded-lg p-3 shadow-lg">
              {error && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-crimson-light text-sm">
                    <MicOff className="w-4 h-4" />
                    <span>{error}</span>
                  </div>
                  {error.includes('permission') && (
                    <div className="text-xs text-foreground-muted">
                      Click the microphone button in your browser's address bar to allow access
                    </div>
                  )}
                </div>
              )}
              
              {isProcessing && (
                <div className="flex items-center gap-2 text-saffron-light text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>प्रोसेसिंग...</span>
                </div>
              )}
              
              {currentCommand && (
                <div className="text-emerald-light text-sm">
                  <div className="text-xs text-foreground-muted mb-1">कमांड:</div>
                  <div>&quot;{currentCommand}&quot;</div>
                </div>
              )}
              
              {lastResponse && !currentCommand && !isProcessing && (
                <div className="text-foreground-secondary text-sm">
                  <div className="flex items-center gap-1 text-xs text-foreground-muted mb-1">
                    <Volume2 className="w-3 h-3" />
                    <span>रिस्पॉन्स:</span>
                  </div>
                  <div>&quot;{lastResponse}&quot;</div>
                </div>
              )}
              
              {isListening && !currentCommand && (
                <div className="flex items-center gap-2 text-saffron-light text-sm">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  >
                    <Mic className="w-4 h-4" />
                  </motion.div>
                  <span>आपकी आवाज़ सुन रहा हूँ...</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Smaller inline voice button for forms
export function InlineVoiceButton({ 
  onCommand, 
  className,
  disabled = false 
}: { 
  onCommand?: (command: string) => void;
  className?: string;
  disabled?: boolean;
}) {
  const { isListening, startListening, stopListening } = useVoice();

  const handleClick = () => {
    if (disabled) return;
    
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <motion.button
      onClick={handleClick}
      disabled={disabled}
      className={cn(
        'p-2 rounded-lg transition-all duration-200',
        isListening 
          ? 'bg-saffron text-white shadow-lg shadow-saffron/25' 
          : 'bg-glass hover:bg-glass-hover text-foreground-muted hover:text-foreground',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      whileHover={disabled ? {} : { scale: 1.05 }}
      whileTap={disabled ? {} : { scale: 0.95 }}
    >
      {isListening ? (
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
        >
          <Mic className="w-4 h-4" />
        </motion.div>
      ) : (
        <Mic className="w-4 h-4" />
      )}
    </motion.button>
  );
}