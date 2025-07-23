'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
// Using built-in browser types instead of our custom ones to avoid conflicts
// Our types file provides fallbacks for browsers that don't have these built-in

export interface SpeechSynthesisConfig {
  voice?: SpeechSynthesisVoice | null;
  pitch?: number;
  rate?: number;
  volume?: number;
  lang?: string;
  onStart?: (event: SpeechSynthesisEvent) => void;
  onEnd?: (event: SpeechSynthesisEvent) => void;
  onError?: (error: SpeechSynthesisErrorCode, message: string) => void;
  onPause?: (event: SpeechSynthesisEvent) => void;
  onResume?: (event: SpeechSynthesisEvent) => void;
  onBoundary?: (event: SpeechSynthesisEvent) => void;
  onMark?: (event: SpeechSynthesisEvent) => void;
}

export interface SpeechSynthesisState {
  isSupported: boolean;
  speaking: boolean;
  pending: boolean;
  paused: boolean;
  voices: SpeechSynthesisVoice[];
  currentUtterance: string | null;
  error: string | null;
  voicesLoaded: boolean;
}

export interface UtteranceOptions extends Omit<SpeechSynthesisConfig, 'onStart' | 'onEnd' | 'onError'> {
  onStart?: (event: SpeechSynthesisEvent) => void;
  onEnd?: (event: SpeechSynthesisEvent) => void;
  onError?: (error: SpeechSynthesisErrorCode, message: string) => void;
}

export interface SpeechSynthesisActions {
  speak: (text: string, options?: UtteranceOptions) => Promise<void>;
  cancel: () => void;
  pause: () => void;
  resume: () => void;
  getVoices: () => SpeechSynthesisVoice[];
  getVoiceByName: (name: string) => SpeechSynthesisVoice | null;
  getVoicesByLang: (lang: string) => SpeechSynthesisVoice[];
  updateConfig: (config: Partial<SpeechSynthesisConfig>) => void;
}

export function useSpeechSynthesis(
  initialConfig: SpeechSynthesisConfig = {}
): SpeechSynthesisState & SpeechSynthesisActions {
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const configRef = useRef<SpeechSynthesisConfig>(initialConfig);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const voicesLoadedRef = useRef<boolean>(false);

  const [state, setState] = useState<SpeechSynthesisState>(() => ({
    isSupported: typeof window !== 'undefined' && 'speechSynthesis' in window,
    speaking: false,
    pending: false,
    paused: false,
    voices: [],
    currentUtterance: null,
    error: null,
    voicesLoaded: false
  }));

  // Initialize speech synthesis
  const initializeSynthesis = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setState(prev => ({ ...prev, isSupported: false }));
      return;
    }

    synthRef.current = window.speechSynthesis;

    // Load voices
    const loadVoices = () => {
      const voices = synthRef.current?.getVoices() || [];
      voicesLoadedRef.current = true;
      setState(prev => ({ 
        ...prev, 
        voices,
        voicesLoaded: true 
      }));
    };

    // Some browsers load voices asynchronously
    if (synthRef.current && synthRef.current.getVoices().length > 0) {
      loadVoices();
    } else if (synthRef.current) {
      synthRef.current.onvoiceschanged = loadVoices;
    }

    // Update state periodically to reflect synthesis status
    const updateState = () => {
      if (synthRef.current) {
        setState(prev => ({
          ...prev,
          speaking: synthRef.current!.speaking,
          pending: synthRef.current!.pending,
          paused: synthRef.current!.paused
        }));
      }
    };

    const statusInterval = setInterval(updateState, 100);

    return () => {
      clearInterval(statusInterval);
      if (synthRef.current) {
        synthRef.current.onvoiceschanged = null;
      }
    };
  }, []);

  // Get human-readable error message
  function getErrorMessage(errorCode: SpeechSynthesisErrorCode): string {
    const errorMessages: Record<SpeechSynthesisErrorCode, string> = {
      'canceled': 'Speech synthesis was canceled.',
      'interrupted': 'Speech synthesis was interrupted.',
      'audio-busy': 'Audio system is busy. Please try again.',
      'audio-hardware': 'Audio hardware error occurred.',
      'network': 'Network error during speech synthesis.',
      'synthesis-unavailable': 'Speech synthesis service is unavailable.',
      'synthesis-failed': 'Speech synthesis failed.',
      'language-unavailable': 'Selected language is not available for speech synthesis.',
      'voice-unavailable': 'Selected voice is not available.',
      'text-too-long': 'Text is too long for speech synthesis.',
      'invalid-argument': 'Invalid argument provided to speech synthesis.',
      'not-allowed': 'Speech synthesis not allowed by browser permissions.'
    };

    return errorMessages[errorCode] || `Speech synthesis error: ${errorCode}`;
  }

  // Create utterance with configuration
  const createUtterance = useCallback((
    text: string, 
    options: UtteranceOptions = {}
  ): SpeechSynthesisUtterance => {
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Apply configuration
    const config = { ...configRef.current, ...options };
    
    if (config.voice) utterance.voice = config.voice;
    if (config.pitch !== undefined) utterance.pitch = Math.max(0, Math.min(2, config.pitch));
    if (config.rate !== undefined) utterance.rate = Math.max(0.1, Math.min(10, config.rate));
    if (config.volume !== undefined) utterance.volume = Math.max(0, Math.min(1, config.volume));
    if (config.lang) utterance.lang = config.lang;

    // Set up event handlers
    utterance.onstart = (event: SpeechSynthesisEvent) => {
      setState(prev => ({ ...prev, currentUtterance: text, error: null }));
      config.onStart?.(event);
      configRef.current.onStart?.(event);
    };

    utterance.onend = (event: SpeechSynthesisEvent) => {
      setState(prev => ({ ...prev, currentUtterance: null }));
      currentUtteranceRef.current = null;
      config.onEnd?.(event);
      configRef.current.onEnd?.(event);
    };

    utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
      const errorMessage = getErrorMessage(event.error);
      setState(prev => ({ 
        ...prev, 
        error: errorMessage,
        currentUtterance: null 
      }));
      currentUtteranceRef.current = null;
      config.onError?.(event.error, errorMessage);
      configRef.current.onError?.(event.error, errorMessage);
    };

    utterance.onpause = (event: SpeechSynthesisEvent) => {
      config.onPause?.(event);
      configRef.current.onPause?.(event);
    };

    utterance.onresume = (event: SpeechSynthesisEvent) => {
      config.onResume?.(event);
      configRef.current.onResume?.(event);
    };

    utterance.onboundary = (event: SpeechSynthesisEvent) => {
      config.onBoundary?.(event);
      configRef.current.onBoundary?.(event);
    };

    utterance.onmark = (event: SpeechSynthesisEvent) => {
      config.onMark?.(event);
      configRef.current.onMark?.(event);
    };

    return utterance;
  }, []);

  // Actions
  const speak = useCallback(async (
    text: string, 
    options: UtteranceOptions = {}
  ): Promise<void> => {
    if (!state.isSupported || !synthRef.current) {
      throw new Error('Speech synthesis is not supported');
    }

    if (!text.trim()) {
      throw new Error('Cannot speak empty text');
    }

    // Cancel any current speech
    if (synthRef.current.speaking) {
      synthRef.current.cancel();
    }

    setState(prev => ({ ...prev, error: null }));

    try {
      const utterance = createUtterance(text, options);
      currentUtteranceRef.current = utterance;
      
      // Return a promise that resolves when speech ends or rejects on error
      return new Promise((resolve, reject) => {
        const originalOnEnd = utterance.onend;
        const originalOnError = utterance.onerror;

        utterance.onend = (event) => {
          if (originalOnEnd) {
            originalOnEnd.call(utterance, event);
          }
          resolve();
        };

        utterance.onerror = (event) => {
          if (originalOnError) {
            originalOnError.call(utterance, event);
          }
          reject(new Error(getErrorMessage(event.error)));
        };

        synthRef.current!.speak(utterance);
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start speech synthesis';
      setState(prev => ({ ...prev, error: errorMessage }));
      throw error;
    }
  }, [state.isSupported, createUtterance]);

  const cancel = useCallback(() => {
    if (synthRef.current) {
      synthRef.current.cancel();
      currentUtteranceRef.current = null;
      setState(prev => ({ ...prev, currentUtterance: null }));
    }
  }, []);

  const pause = useCallback(() => {
    if (synthRef.current && state.speaking) {
      synthRef.current.pause();
    }
  }, [state.speaking]);

  const resume = useCallback(() => {
    if (synthRef.current && state.paused) {
      synthRef.current.resume();
    }
  }, [state.paused]);

  const getVoices = useCallback((): SpeechSynthesisVoice[] => {
    return synthRef.current?.getVoices() || [];
  }, []);

  const getVoiceByName = useCallback((name: string): SpeechSynthesisVoice | null => {
    const voices = getVoices();
    return voices.find(voice => voice.name === name) || null;
  }, [getVoices]);

  const getVoicesByLang = useCallback((lang: string): SpeechSynthesisVoice[] => {
    const voices = getVoices();
    return voices.filter(voice => voice.lang.startsWith(lang));
  }, [getVoices]);

  const updateConfig = useCallback((newConfig: Partial<SpeechSynthesisConfig>) => {
    configRef.current = { ...configRef.current, ...newConfig };
  }, []);

  // Initialize on mount
  useEffect(() => {
    const cleanup = initializeSynthesis();
    return cleanup;
  }, [initializeSynthesis]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (synthRef.current) {
        synthRef.current.cancel();
        synthRef.current.onvoiceschanged = null;
      }
      currentUtteranceRef.current = null;
    };
  }, []);

  // Handle browser tab visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && synthRef.current?.speaking) {
        // Pause speech when tab becomes hidden to prevent issues
        synthRef.current.pause();
      } else if (!document.hidden && synthRef.current?.paused) {
        // Resume speech when tab becomes visible
        synthRef.current.resume();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return {
    ...state,
    speak,
    cancel,
    pause,
    resume,
    getVoices,
    getVoiceByName,
    getVoicesByLang,
    updateConfig
  };
}