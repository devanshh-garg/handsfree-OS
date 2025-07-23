'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, VolumeX, Play, Pause } from 'lucide-react';

interface VoiceTooltipProps {
  text: string;
  voiceText?: string;
  language?: 'hindi' | 'english' | 'mixed';
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  autoPlay?: boolean;
  showOnHover?: boolean;
  className?: string;
}

interface VoiceTooltipContextType {
  globalMute: boolean;
  setGlobalMute: (mute: boolean) => void;
  playingTooltipId: string | null;
  setPlayingTooltipId: (id: string | null) => void;
}

const VoiceTooltipContext = React.createContext<VoiceTooltipContextType>({
  globalMute: false,
  setGlobalMute: () => {},
  playingTooltipId: null,
  setPlayingTooltipId: () => {}
});

export function VoiceTooltipProvider({ children }: { children: React.ReactNode }) {
  const [globalMute, setGlobalMute] = useState(false);
  const [playingTooltipId, setPlayingTooltipId] = useState<string | null>(null);

  return (
    <VoiceTooltipContext.Provider value={{
      globalMute,
      setGlobalMute,
      playingTooltipId,
      setPlayingTooltipId
    }}>
      {children}
      
      {/* Global Voice Control */}
      <motion.button
        onClick={() => setGlobalMute(!globalMute)}
        className={`fixed top-4 right-20 z-50 w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-colors ${
          globalMute 
            ? 'bg-red-500 hover:bg-red-600 text-white' 
            : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200'
        }`}
        title={globalMute ? 'Enable Voice Tooltips' : 'Mute Voice Tooltips'}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        {globalMute ? <VolumeX size={16} /> : <Volume2 size={16} />}
      </motion.button>
    </VoiceTooltipContext.Provider>
  );
}

export function VoiceTooltip({
  text,
  voiceText,
  language = 'mixed',
  children,
  position = 'top',
  autoPlay = false,
  showOnHover = true,
  className = ''
}: VoiceTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);
  const tooltipId = useRef(`tooltip-${Math.random().toString(36).substr(2, 9)}`);
  const speechUtterance = useRef<SpeechSynthesisUtterance | null>(null);
  const hoverTimeout = useRef<NodeJS.Timeout | null>(null);
  
  const { globalMute, playingTooltipId, setPlayingTooltipId } = React.useContext(VoiceTooltipContext);

  const actualVoiceText = voiceText || text;

  // Voice synthesis setup
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const utterance = new SpeechSynthesisUtterance(actualVoiceText);
    
    // Configure voice based on language
    const voices = speechSynthesis.getVoices();
    let selectedVoice = voices[0];
    
    switch (language) {
      case 'hindi':
        selectedVoice = voices.find(v => v.lang.startsWith('hi')) || 
                      voices.find(v => v.name.includes('Hindi')) || 
                      voices[0];
        utterance.rate = 0.8;
        utterance.pitch = 1.0;
        break;
      case 'english':
        selectedVoice = voices.find(v => v.lang.startsWith('en-IN')) ||
                      voices.find(v => v.lang.startsWith('en-US')) ||
                      voices[0];
        utterance.rate = 0.9;
        utterance.pitch = 1.1;
        break;
      case 'mixed':
      default:
        selectedVoice = voices.find(v => v.lang.startsWith('en-IN')) ||
                      voices.find(v => v.name.includes('Indian')) ||
                      voices[0];
        utterance.rate = 0.85;
        utterance.pitch = 1.05;
        break;
    }
    
    utterance.voice = selectedVoice;
    utterance.volume = 0.8;
    
    utterance.onstart = () => {
      setIsPlaying(true);
      setPlayingTooltipId(tooltipId.current);
    };
    
    utterance.onend = () => {
      setIsPlaying(false);
      setPlayingTooltipId(null);
      setHasPlayed(true);
    };
    
    utterance.onerror = () => {
      setIsPlaying(false);
      setPlayingTooltipId(null);
    };
    
    speechUtterance.current = utterance;

    return () => {
      if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
      }
    };
  }, [actualVoiceText, language, setPlayingTooltipId]);

  const playVoice = () => {
    if (globalMute || !speechUtterance.current) return;
    
    // Stop any currently playing tooltip
    if (speechSynthesis.speaking) {
      speechSynthesis.cancel();
    }
    
    speechSynthesis.speak(speechUtterance.current);
  };

  const stopVoice = () => {
    if (speechSynthesis.speaking) {
      speechSynthesis.cancel();
    }
    setIsPlaying(false);
    setPlayingTooltipId(null);
  };

  const handleMouseEnter = () => {
    if (!showOnHover) return;
    
    hoverTimeout.current = setTimeout(() => {
      setIsVisible(true);
      
      // Auto-play if enabled and not muted and no other tooltip is playing
      if (autoPlay && !globalMute && !playingTooltipId && !hasPlayed) {
        setTimeout(() => playVoice(), 500); // Small delay for better UX
      }
    }, 300); // Delay to prevent accidental triggers
  };

  const handleMouseLeave = () => {
    if (hoverTimeout.current) {
      clearTimeout(hoverTimeout.current);
    }
    
    setIsVisible(false);
    
    // Stop voice if this tooltip is playing
    if (playingTooltipId === tooltipId.current) {
      stopVoice();
    }
  };

  const handleClick = () => {
    if (!isVisible) {
      setIsVisible(true);
    }
    
    if (isPlaying) {
      stopVoice();
    } else {
      playVoice();
    }
  };

  const getTooltipPosition = () => {
    switch (position) {
      case 'top':
        return 'bottom-full left-1/2 transform -translate-x-1/2 mb-2';
      case 'bottom':
        return 'top-full left-1/2 transform -translate-x-1/2 mt-2';
      case 'left':
        return 'right-full top-1/2 transform -translate-y-1/2 mr-2';
      case 'right':
        return 'left-full top-1/2 transform -translate-y-1/2 ml-2';
      default:
        return 'bottom-full left-1/2 transform -translate-x-1/2 mb-2';
    }
  };

  const getArrowClasses = () => {
    switch (position) {
      case 'top':
        return 'top-full left-1/2 transform -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-gray-800';
      case 'bottom':
        return 'bottom-full left-1/2 transform -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-gray-800';
      case 'left':
        return 'left-full top-1/2 transform -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-gray-800';
      case 'right':
        return 'right-full top-1/2 transform -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-gray-800';
      default:
        return 'top-full left-1/2 transform -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-gray-800';
    }
  };

  return (
    <div 
      className={`relative inline-block ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      
      <AnimatePresence>
        {isVisible && (
          <motion.div
            className={`absolute z-50 ${getTooltipPosition()}`}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
          >
            <div className="bg-gray-800 text-white px-3 py-2 rounded-lg shadow-lg max-w-xs">
              <div className="flex items-center gap-2">
                <p className="text-sm flex-1">{text}</p>
                
                {!globalMute && (
                  <button
                    onClick={handleClick}
                    className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                      isPlaying 
                        ? 'bg-red-500 hover:bg-red-600' 
                        : 'bg-blue-500 hover:bg-blue-600'
                    }`}
                    title={isPlaying ? 'Stop' : 'Play'}
                  >
                    {isPlaying ? <Pause size={10} /> : <Play size={10} />}
                  </button>
                )}
              </div>
              
              {/* Language indicator */}
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs opacity-60">
                  {language === 'mixed' ? 'हिं/En' : language === 'hindi' ? 'हिंदी' : 'English'}
                </span>
                
                {isPlaying && (
                  <motion.div
                    className="flex items-center gap-1"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    {[1, 2, 3].map((i) => (
                      <motion.div
                        key={i}
                        className="w-1 h-3 bg-green-400 rounded-full"
                        animate={{
                          scaleY: [0.3, 1, 0.3],
                          opacity: [0.5, 1, 0.5]
                        }}
                        transition={{
                          duration: 0.6,
                          repeat: Infinity,
                          delay: i * 0.1
                        }}
                      />
                    ))}
                  </motion.div>
                )}
              </div>
            </div>
            
            {/* Arrow */}
            <div className={`absolute w-0 h-0 border-4 ${getArrowClasses()}`} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Preset voice tooltips for common restaurant actions
export function OrderTooltip({ children, tableNumber }: { children: React.ReactNode; tableNumber?: number }) {
  return (
    <VoiceTooltip
      text={`Click to place order${tableNumber ? ` for table ${tableNumber}` : ''}`}
      voiceText={`Order place करने के लिए click करें${tableNumber ? ` table ${tableNumber} के लिए` : ''}`}
      language="mixed"
      autoPlay={false}
    >
      {children}
    </VoiceTooltip>
  );
}

export function StatusTooltip({ children, status }: { children: React.ReactNode; status: string }) {
  const statusMessages = {
    pending: { text: 'Order is pending', voice: 'Order pending है' },
    preparing: { text: 'Being prepared in kitchen', voice: 'Kitchen में prepare हो रहा है' },
    ready: { text: 'Order is ready to serve', voice: 'Order ready है, serve करें' },
    served: { text: 'Order has been served', voice: 'Order serve हो गया है' }
  };

  const message = statusMessages[status as keyof typeof statusMessages] || 
                  { text: `Status: ${status}`, voice: `Status: ${status}` };

  return (
    <VoiceTooltip
      text={message.text}
      voiceText={message.voice}
      language="mixed"
      autoPlay={true}
    >
      {children}
    </VoiceTooltip>
  );
}

export function MenuTooltip({ children, itemName, price }: { 
  children: React.ReactNode; 
  itemName: string; 
  price: number;
}) {
  return (
    <VoiceTooltip
      text={`${itemName} - ₹${price}`}
      voiceText={`${itemName} - ${price} rupees`}
      language="mixed"
      position="right"
    >
      {children}
    </VoiceTooltip>
  );
}

export function TableTooltip({ children, tableNumber, status, occupancy }: { 
  children: React.ReactNode; 
  tableNumber: number;
  status: string;
  occupancy?: number;
}) {
  const statusText = {
    available: 'खाली है',
    occupied: 'occupied है',
    cleaning: 'साफ हो रहा है',
    reserved: 'reserved है'
  };

  return (
    <VoiceTooltip
      text={`Table ${tableNumber} - ${status}${occupancy ? ` (${occupancy} guests)` : ''}`}
      voiceText={`Table ${tableNumber} ${statusText[status as keyof typeof statusText] || status}${occupancy ? `, ${occupancy} guests` : ''}`}
      language="mixed"
      position="top"
      autoPlay={true}
    >
      {children}
    </VoiceTooltip>
  );
}

// Hook for programmatic voice tooltip control
export function useVoiceTooltip() {
  const context = React.useContext(VoiceTooltipContext);
  
  const speak = (text: string, language: 'hindi' | 'english' | 'mixed' = 'mixed') => {
    if (context.globalMute) return;
    
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = speechSynthesis.getVoices();
    
    let selectedVoice = voices[0];
    switch (language) {
      case 'hindi':
        selectedVoice = voices.find(v => v.lang.startsWith('hi')) || voices[0];
        break;
      case 'english':
        selectedVoice = voices.find(v => v.lang.startsWith('en')) || voices[0];
        break;
      case 'mixed':
        selectedVoice = voices.find(v => v.lang.startsWith('en-IN')) || voices[0];
        break;
    }
    
    utterance.voice = selectedVoice;
    utterance.rate = 0.85;
    utterance.pitch = 1.05;
    utterance.volume = 0.8;
    
    speechSynthesis.speak(utterance);
  };

  return {
    speak,
    isGlobalMute: context.globalMute,
    setGlobalMute: context.setGlobalMute
  };
}