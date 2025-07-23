'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Volume2, VolumeX, MessageCircle, X, Zap, Brain } from 'lucide-react';
import { useVoiceStore } from '@/stores/voiceStore';
import { getEnhancedVoiceProcessor } from '@/lib/nlp/EnhancedVoiceProcessor';

interface FloatingVoiceAssistantProps {
  defaultPosition?: { x: number; y: number };
  theme?: 'light' | 'dark' | 'auto';
  personality?: 'professional' | 'friendly' | 'casual';
}

interface AssistantPersonality {
  avatar: string;
  greeting: string[];
  responses: {
    listening: string[];
    processing: string[];
    success: string[];
    error: string[];
  };
  colors: {
    primary: string;
    secondary: string;
    accent: string;
  };
}

export function FloatingVoiceAssistant({ 
  defaultPosition = { x: window.innerWidth - 100, y: window.innerHeight - 100 },
  theme = 'auto',
  personality = 'friendly'
}: FloatingVoiceAssistantProps) {
  const { 
    isListening, 
    isProcessing, 
    currentCommand, 
    lastResponse, 
    error,
    history,
    startListening,
    stopListening
  } = useVoiceStore();

  const [isExpanded, setIsExpanded] = useState(false);
  const [position, setPosition] = useState(defaultPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(true);
  const [speechEnabled, setSpeechEnabled] = useState(true);
  const [currentPersonality, setCurrentPersonality] = useState<AssistantPersonality>();
  const [animationState, setAnimationState] = useState<'idle' | 'listening' | 'processing' | 'speaking'>('idle');
  
  const containerRef = useRef<HTMLDivElement>(null);
  const speechSynthesis = useRef<SpeechSynthesis | null>(null);

  // Define personality configurations
  const personalities: { [key: string]: AssistantPersonality } = {
    professional: {
      avatar: '👨‍💼',
      greeting: [
        'Good day! How may I assist you?',
        'नमस्ते! आप कैसे मदद कर सकते हैं?',
        'How can I be of service today?'
      ],
      responses: {
        listening: ['I\'m listening...', 'सुन रहा हूँ...', 'Please go ahead'],
        processing: ['Processing your request...', 'आपका अनुरोध प्रोसेस कर रहा हूँ...', 'One moment please'],
        success: ['Task completed successfully', 'कार्य सफलतापूर्वक पूरा हुआ', 'Done!'],
        error: ['I apologize, there was an error', 'क्षमा करें, कोई त्रुटि हुई', 'Let me try again']
      },
      colors: {
        primary: 'bg-blue-600',
        secondary: 'bg-blue-100',
        accent: 'text-blue-600'
      }
    },
    friendly: {
      avatar: '🤖',
      greeting: [
        'Hey there! Ready to help! 😊',
        'हैलो! मैं यहाँ मदद के लिए हूँ! 😊',
        'Hi! What can I do for you today?',
        'Namaste! कैसे help कर सकता हूँ?'
      ],
      responses: {
        listening: ['I\'m all ears! 👂', 'बोलिए, सुन रहा हूँ! 👂', 'Go ahead, I\'m listening!'],
        processing: ['Thinking... 🤔', 'सोच रहा हूँ... 🤔', 'Give me a sec! ⚡'],
        success: ['Awesome! ✨', 'बहुत बढ़िया! ✨', 'Got it done! 🎉'],
        error: ['Oops! Let me try again 🔄', 'अरे! फिर से try करता हूँ 🔄', 'Hmm, something went wrong 😅']
      },
      colors: {
        primary: 'bg-emerald-500',
        secondary: 'bg-emerald-50',
        accent: 'text-emerald-600'
      }
    },
    casual: {
      avatar: '😎',
      greeting: [
        'Yo! What\'s up?',
        'क्या हाल है?',
        'Hey buddy!',
        'Sup! Ready to rock? 🚀'
      ],
      responses: {
        listening: ['Yeah, I\'m listening', 'हाँ भाई, बोलो', 'Shoot!'],
        processing: ['Hold up, processing...', 'रुको, देखता हूँ...', 'Working on it...'],
        success: ['Boom! Done! 💥', 'हो गया! 💥', 'Easy peasy! ✌️'],
        error: ['Ah man, something\'s up', 'यार, कुछ गड़बड़ है', 'Oopsie! 🤪']
      },
      colors: {
        primary: 'bg-purple-500',
        secondary: 'bg-purple-50',
        accent: 'text-purple-600'
      }
    }
  };

  useEffect(() => {
    setCurrentPersonality(personalities[personality]);
    
    // Initialize speech synthesis
    if (typeof window !== 'undefined') {
      speechSynthesis.current = window.speechSynthesis;
    }
  }, [personality]);

  useEffect(() => {
    // Update animation state based on voice processing status
    if (isListening) {
      setAnimationState('listening');
    } else if (isProcessing) {
      setAnimationState('processing');
    } else if (lastResponse && Date.now() - new Date(history[0]?.timestamp || 0).getTime() < 3000) {
      setAnimationState('speaking');
      speakResponse(lastResponse);
    } else {
      setAnimationState('idle');
    }
  }, [isListening, isProcessing, lastResponse, history]);

  const speakResponse = (text: string) => {
    if (!speechEnabled || !speechSynthesis.current) return;

    // Cancel any ongoing speech
    speechSynthesis.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const voices = speechSynthesis.current.getVoices();
    
    // Try to find Hindi or Indian English voice
    const hindiVoice = voices.find(voice => voice.lang.startsWith('hi'));
    const indianEnglishVoice = voices.find(voice => 
      voice.lang.includes('en-IN') || voice.name.includes('Indian')
    );
    
    utterance.voice = hindiVoice || indianEnglishVoice || voices[0];
    utterance.rate = 0.9;
    utterance.pitch = 1.1;
    utterance.volume = 0.8;

    utterance.onend = () => {
      setAnimationState('idle');
    };

    speechSynthesis.current.speak(utterance);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    
    setIsDragging(true);
    const rect = containerRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    
    setPosition({
      x: Math.max(0, Math.min(window.innerWidth - 80, e.clientX - dragOffset.x)),
      y: Math.max(0, Math.min(window.innerHeight - 80, e.clientY - dragOffset.y))
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const getRandomResponse = (responseType: keyof AssistantPersonality['responses']) => {
    if (!currentPersonality) return '';
    const responses = currentPersonality.responses[responseType];
    return responses[Math.floor(Math.random() * responses.length)];
  };

  const getAnimationVariants = () => {
    const baseScale = isExpanded ? 1.2 : 1;
    
    switch (animationState) {
      case 'listening':
        return {
          scale: [baseScale, baseScale * 1.1, baseScale],
          rotate: [0, 5, -5, 0],
          transition: { duration: 0.6, repeat: Infinity }
        };
      case 'processing':
        return {
          scale: [baseScale, baseScale * 0.95, baseScale],
          opacity: [1, 0.7, 1],
          transition: { duration: 0.8, repeat: Infinity }
        };
      case 'speaking':
        return {
          scale: [baseScale, baseScale * 1.05, baseScale],
          y: [0, -2, 0],
          transition: { duration: 0.4, repeat: Infinity }
        };
      default:
        return {
          scale: baseScale,
          rotate: 0,
          opacity: 1
        };
    }
  };

  if (!isVisible || !currentPersonality) return null;

  return (
    <div className="fixed z-50 pointer-events-none">
      <motion.div
        ref={containerRef}
        className="pointer-events-auto"
        style={{
          left: position.x,
          top: position.y
        }}
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.5 }}
        drag={!isExpanded}
        dragMomentum={false}
        dragElastic={0.1}
        onMouseDown={handleMouseDown}
      >
        {/* Main Assistant Circle */}
        <motion.div
          className={`relative w-16 h-16 rounded-full ${currentPersonality.colors.primary} shadow-lg cursor-pointer flex items-center justify-center text-white text-2xl select-none`}
          animate={getAnimationVariants()}
          onClick={() => setIsExpanded(!isExpanded)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <span className="text-xl">{currentPersonality.avatar}</span>
          
          {/* Status Indicators */}
          <div className="absolute -top-1 -right-1">
            {isListening && (
              <motion.div
                className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 0.5, repeat: Infinity }}
              >
                <Mic size={8} className="text-white" />
              </motion.div>
            )}
            {isProcessing && (
              <motion.div
                className="w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                <Brain size={8} className="text-white" />
              </motion.div>
            )}
          </div>

          {/* Voice Wave Animation */}
          {isListening && (
            <div className="absolute inset-0 rounded-full">
              {[1, 2, 3].map((i) => (
                <motion.div
                  key={i}
                  className="absolute inset-0 rounded-full border-2 border-red-300"
                  initial={{ scale: 1, opacity: 0.7 }}
                  animate={{ 
                    scale: [1, 1.5, 2],
                    opacity: [0.7, 0.3, 0]
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    delay: i * 0.5
                  }}
                />
              ))}
            </div>
          )}
        </motion.div>

        {/* Expanded Panel */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              className="absolute bottom-20 right-0 w-80 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
              initial={{ opacity: 0, scale: 0.8, transformOrigin: "bottom right" }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
            >
              {/* Header */}
              <div className={`${currentPersonality.colors.primary} text-white p-4 flex items-center justify-between`}>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{currentPersonality.avatar}</span>
                  <div>
                    <h3 className="font-semibold">Voice Assistant</h3>
                    <p className="text-xs opacity-80">
                      {getRandomResponse(isListening ? 'listening' : isProcessing ? 'processing' : 'success')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsExpanded(false)}
                  className="p-1 hover:bg-white/20 rounded-full transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Content */}
              <div className="p-4 space-y-4">
                {/* Voice Controls */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleListening}
                    disabled={isProcessing}
                    className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg transition-all ${
                      isListening 
                        ? 'bg-red-500 text-white hover:bg-red-600' 
                        : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                    } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                    {isListening ? 'Stop' : 'Start'} Listening
                  </button>
                  
                  <button
                    onClick={() => setSpeechEnabled(!speechEnabled)}
                    className={`p-3 rounded-lg transition-colors ${
                      speechEnabled 
                        ? 'bg-blue-500 text-white hover:bg-blue-600' 
                        : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                    title={speechEnabled ? 'Disable Speech' : 'Enable Speech'}
                  >
                    {speechEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                  </button>
                </div>

                {/* Current Command */}
                {(currentCommand || isProcessing) && (
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <MessageCircle size={14} className="text-gray-500" />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {isProcessing ? 'Processing...' : 'Last Command'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {currentCommand || 'Analyzing your voice input...'}
                    </p>
                  </div>
                )}

                {/* Response */}
                {lastResponse && !isProcessing && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{currentPersonality.avatar}</span>
                      <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                        Response
                      </span>
                    </div>
                    <p className="text-sm text-blue-600 dark:text-blue-400">
                      {lastResponse}
                    </p>
                  </div>
                )}

                {/* Error Display */}
                {error && (
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-red-500">⚠️</span>
                      <span className="text-sm font-medium text-red-700 dark:text-red-300">
                        Error
                      </span>
                    </div>
                    <p className="text-sm text-red-600 dark:text-red-400">
                      {error}
                    </p>
                  </div>
                )}

                {/* Quick Actions */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Quick Commands
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { text: 'Check table status', command: 'table status check karo' },
                      { text: 'Today\'s revenue', command: 'aaj ka revenue kitna hai' },
                      { text: 'Kitchen status', command: 'kitchen status batao' },
                      { text: 'Inventory alert', command: 'inventory check karo' }
                    ].map((action, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          if (!isListening && !isProcessing) {
                            // Simulate voice command
                            useVoiceStore.getState().processVoiceCommand(action.command, 0.95);
                          }
                        }}
                        disabled={isListening || isProcessing}
                        className="text-xs p-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {action.text}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Minimize/Hide Button */}
        <button
          onClick={() => setIsVisible(false)}
          className="absolute -top-2 -left-2 w-6 h-6 bg-gray-500 hover:bg-gray-600 text-white rounded-full flex items-center justify-center text-xs transition-colors"
          title="Hide Assistant"
        >
          ×
        </button>
      </motion.div>

      {/* Hidden Assistant Indicator */}
      {!isVisible && (
        <motion.button
          onClick={() => setIsVisible(true)}
          className="fixed bottom-4 right-4 w-12 h-12 bg-gray-600 hover:bg-gray-700 text-white rounded-full flex items-center justify-center shadow-lg transition-colors"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          title="Show Voice Assistant"
        >
          <Zap size={20} />
        </motion.button>
      )}
    </div>
  );
}