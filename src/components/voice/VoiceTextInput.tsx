'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Keyboard, Send, X, Mic } from 'lucide-react';
import { useVoice } from '@/hooks/useVoice';
import { cn } from '@/lib/utils';

interface VoiceTextInputProps {
  className?: string;
}

export function VoiceTextInput({ className }: VoiceTextInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { processVoiceCommand } = useVoice();

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || isProcessing) return;

    setIsProcessing(true);
    try {
      // Process as if it was a voice command
      await processVoiceCommand(text.trim(), 1.0);
      setText('');
      setIsOpen(false);
      
      if (window.showToast) {
        window.showToast('success', 'Command Processed', 'Text command executed successfully', 3000);
      }
    } catch (error) {
      if (window.showToast) {
        window.showToast('error', 'Command Failed', 'Failed to process text command', 3000);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const suggestions = [
    "Table 5 ready hai",
    "Table 3 clean karo",
    "Today's revenue",
    "Paneer stock low hai",
    "Table 2 occupied"
  ];

  return (
    <>
      {/* Floating Text Input Button */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(true)}
        className={cn(
          'fixed bottom-6 right-24 p-3 bg-gold hover:bg-gold-dark text-white rounded-full shadow-lg z-40',
          className
        )}
      >
        <Keyboard className="w-5 h-5" />
      </motion.button>

      {/* Text Input Modal */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/50 z-50"
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-lg z-50"
            >
              <div className="glass rounded-2xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-glass-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gold/20 rounded-lg">
                        <Keyboard className="w-5 h-5 text-gold" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-foreground">
                          Type Voice Command
                        </h3>
                        <p className="text-sm text-foreground-muted font-devanagari">
                          आवाज़ कमांड टाइप करें
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsOpen(false)}
                      className="p-2 hover:bg-background-secondary rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5 text-foreground-muted" />
                    </button>
                  </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6">
                  <div className="relative">
                    <input
                      ref={inputRef}
                      type="text"
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder="Type your command here..."
                      className="w-full px-4 py-3 pr-12 bg-background-secondary rounded-lg border border-glass-border focus:outline-none focus:border-gold transition-colors"
                      disabled={isProcessing}
                    />
                    <button
                      type="submit"
                      disabled={!text.trim() || isProcessing}
                      className={cn(
                        'absolute right-2 top-1/2 transform -translate-y-1/2 p-2 rounded-lg transition-all',
                        text.trim() && !isProcessing
                          ? 'bg-gold hover:bg-gold-dark text-white'
                          : 'bg-background-tertiary text-foreground-muted cursor-not-allowed'
                      )}
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Suggestions */}
                  <div className="mt-4">
                    <p className="text-sm text-foreground-muted mb-2">
                      Quick commands:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {suggestions.map((suggestion, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => setText(suggestion)}
                          className="px-3 py-1.5 bg-background-secondary hover:bg-background-tertiary rounded-full text-sm text-foreground-muted hover:text-foreground transition-all"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tip */}
                  <div className="mt-4 p-3 bg-gold/10 border border-gold/30 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Mic className="w-4 h-4 text-gold mt-0.5" />
                      <p className="text-sm text-gold">
                        Tip: For best experience, use voice commands by clicking the microphone button
                      </p>
                    </div>
                  </div>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

// Inline text input for forms
export function InlineVoiceTextInput({ 
  onSubmit,
  placeholder = "Type or speak command...",
  className
}: {
  onSubmit: (text: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [text, setText] = useState('');
  const { isListening } = useVoice();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) {
      onSubmit(text.trim());
      setText('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className={cn('relative', className)}>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-2 pr-20 bg-background-secondary rounded-lg border border-glass-border focus:outline-none focus:border-saffron transition-colors"
        disabled={isListening}
      />
      <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
        <button
          type="submit"
          disabled={!text.trim()}
          className={cn(
            'p-1.5 rounded transition-all',
            text.trim()
              ? 'text-saffron hover:bg-saffron/10'
              : 'text-foreground-muted cursor-not-allowed'
          )}
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </form>
  );
}