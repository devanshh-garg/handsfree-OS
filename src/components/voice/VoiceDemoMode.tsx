'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Volume2, ChevronRight, X } from 'lucide-react';
import { useVoice } from '@/hooks/useVoice';
import { cn } from '@/lib/utils';
import { VoiceCommand } from '@/types';

interface DemoCommand {
  text: string;
  textHindi: string;
  category: string;
}

const demoCommands: DemoCommand[] = [
  // Order Commands
  { text: "Table 5 ready hai", textHindi: "टेबल ५ तैयार है", category: "Orders" },
  { text: "Table 3 ka order preparing", textHindi: "टेबल ३ का ऑर्डर बन रहा है", category: "Orders" },
  { text: "Mark table 2 order ready", textHindi: "टेबल २ का ऑर्डर तैयार करो", category: "Orders" },
  
  // Table Commands
  { text: "Table 4 clean karo", textHindi: "टेबल ४ साफ करो", category: "Tables" },
  { text: "Table 6 occupied hai", textHindi: "टेबल ६ व्यस्त है", category: "Tables" },
  { text: "Mark table 1 available", textHindi: "टेबल १ उपलब्ध करो", category: "Tables" },
  
  // Inventory Commands
  { text: "Paneer khatam ho gaya", textHindi: "पनीर खत्म हो गया", category: "Inventory" },
  { text: "Dal stock low hai", textHindi: "दाल स्टॉक कम है", category: "Inventory" },
  
  // Query Commands
  { text: "Today's revenue kitna hai", textHindi: "आज की आमदनी कितनी है", category: "Queries" },
  { text: "How many orders today", textHindi: "आज कितने ऑर्डर आए", category: "Queries" },
  { text: "Table 5 ka status", textHindi: "टेबल ५ का स्टेटस", category: "Queries" }
];

export function VoiceDemoMode({ className }: { className?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const { isSupported, processVoiceCommand } = useVoice();
  
  // Only show demo mode if speech recognition is not supported
  if (isSupported) return null;
  
  const categories = ['all', ...Array.from(new Set(demoCommands.map(cmd => cmd.category)))];
  const filteredCommands = selectedCategory === 'all' 
    ? demoCommands 
    : demoCommands.filter(cmd => cmd.category === selectedCategory);
  
  const simulateVoiceCommand = async (command: DemoCommand) => {
    // Show toast that we're simulating
    if (window.showToast) {
      window.showToast('info', 'Demo Mode', 'Simulating voice command...', 2000);
    }
    
    // Process the command using the hook's processVoiceCommand
    
    // Create a simulated voice command
    const simulatedCommand: VoiceCommand = {
      id: `demo-${Date.now()}`,
      command: command.text,
      language: command.text.includes('hai') || command.text.includes('karo') ? 'mixed' : 'english',
      confidence: 0.95,
      timestamp: new Date(),
      action: { type: 'query', subtype: 'demo' },
      parameters: {},
      success: false
    };
    
    // Process it through the normal flow
    await processVoiceCommand(simulatedCommand.command, simulatedCommand.confidence);
    
    // Simulate text-to-speech response
    const utterance = new SpeechSynthesisUtterance('Command executed successfully');
    utterance.lang = 'en-US';
    speechSynthesis.speak(utterance);
  };

  return (
    <>
      {/* Floating Demo Button */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        onClick={() => setIsOpen(true)}
        className={cn(
          'fixed bottom-6 left-6 p-4 bg-saffron hover:bg-saffron-dark text-white rounded-full shadow-lg z-40',
          'flex items-center gap-2',
          className
        )}
      >
        <MicOff className="w-5 h-5" />
        <span className="text-sm font-medium">Demo Mode</span>
      </motion.button>

      {/* Demo Panel */}
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
            
            {/* Panel */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 20 }}
              className="fixed left-0 top-0 h-full w-96 bg-background border-r border-glass-border shadow-xl z-50 overflow-hidden"
            >
              <div className="h-full flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-glass-border">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-foreground">
                      Voice Demo Mode
                    </h2>
                    <button
                      onClick={() => setIsOpen(false)}
                      className="p-2 hover:bg-background-secondary rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  
                  <div className="p-3 bg-saffron/10 border border-saffron/30 rounded-lg">
                    <p className="text-sm text-saffron">
                      <MicOff className="w-4 h-4 inline mr-1" />
                      Speech recognition not supported in your browser.
                      Click commands below to simulate voice input.
                    </p>
                  </div>
                </div>

                {/* Category Filter */}
                <div className="p-4 border-b border-glass-border">
                  <div className="flex gap-2 overflow-x-auto">
                    {categories.map((category) => (
                      <button
                        key={category}
                        onClick={() => setSelectedCategory(category)}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
                          selectedCategory === category
                            ? 'bg-saffron text-white'
                            : 'bg-background-secondary text-foreground-muted hover:text-foreground'
                        )}
                      >
                        {category === 'all' ? 'All' : category}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Commands List */}
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="space-y-2">
                    {filteredCommands.map((command, index) => (
                      <motion.button
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        onClick={() => simulateVoiceCommand(command)}
                        className="w-full p-4 bg-background-secondary hover:bg-background-tertiary rounded-lg transition-all text-left group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Mic className="w-4 h-4 text-saffron" />
                              <span className="font-medium text-foreground">
                                {command.text}
                              </span>
                            </div>
                            <div className="text-sm text-foreground-muted font-devanagari">
                              {command.textHindi}
                            </div>
                            <div className="text-xs text-foreground-muted mt-1">
                              {command.category}
                            </div>
                          </div>
                          <ChevronRight className="w-5 h-5 text-foreground-muted group-hover:text-saffron transition-colors" />
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-glass-border bg-background-secondary">
                  <div className="flex items-center gap-2 text-sm text-foreground-muted">
                    <Volume2 className="w-4 h-4" />
                    <span>Responses will be spoken aloud</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}