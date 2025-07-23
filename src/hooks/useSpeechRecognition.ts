'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { 
  SpeechRecognition, 
  SpeechRecognitionEvent, 
  SpeechRecognitionErrorEvent,
  SpeechRecognitionErrorCode 
} from '@/types/speech';

export interface SpeechRecognitionConfig {
  continuous?: boolean;
  interimResults?: boolean;
  language?: string;
  maxAlternatives?: number;
  grammars?: string[];
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: SpeechRecognitionErrorCode, message: string) => void;
  onResult?: (transcript: string, confidence: number, isFinal: boolean) => void;
  onNoMatch?: () => void;
}

export interface SpeechRecognitionState {
  isListening: boolean;
  isSupported: boolean;
  transcript: string;
  finalTranscript: string;
  interimTranscript: string;
  confidence: number;
  error: string | null;
  browserSupport: {
    hasNative: boolean;
    hasWebkit: boolean;
    preferredImplementation: 'native' | 'webkit' | null;
  };
}

export interface SpeechRecognitionActions {
  start: () => Promise<void>;
  stop: () => void;
  abort: () => void;
  reset: () => void;
  resetTranscript: () => void;
  updateConfig: (config: Partial<SpeechRecognitionConfig>) => void;
}

export function useSpeechRecognition(
  initialConfig: SpeechRecognitionConfig = {}
): SpeechRecognitionState & SpeechRecognitionActions {
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const configRef = useRef<SpeechRecognitionConfig>(initialConfig);
  const [isInitialized, setIsInitialized] = useState(false);

  const [state, setState] = useState<SpeechRecognitionState>(() => {
    const browserSupport = detectBrowserSupport();
    return {
      isListening: false,
      isSupported: browserSupport.hasNative || browserSupport.hasWebkit,
      transcript: '',
      finalTranscript: '',
      interimTranscript: '',
      confidence: 0,
      error: null,
      browserSupport
    };
  });

  // Detect browser support for speech recognition
  function detectBrowserSupport() {
    if (typeof window === 'undefined') {
      return { hasNative: false, hasWebkit: false, preferredImplementation: null };
    }

    const hasNative = 'SpeechRecognition' in window;
    const hasWebkit = 'webkitSpeechRecognition' in window;
    
    let preferredImplementation: 'native' | 'webkit' | null = null;
    if (hasNative) {
      preferredImplementation = 'native';
    } else if (hasWebkit) {
      preferredImplementation = 'webkit';
    }

    return { hasNative, hasWebkit, preferredImplementation };
  }

  // Initialize speech recognition
  const initializeRecognition = useCallback(() => {
    if (!state.isSupported || recognitionRef.current) return;

    try {
      const SpeechRecognitionConstructor = 
        window.SpeechRecognition || window.webkitSpeechRecognition;
      
      if (!SpeechRecognitionConstructor) {
        throw new Error('Speech recognition not supported');
      }

      const recognition = new SpeechRecognitionConstructor();
      
      // Configure recognition
      recognition.continuous = configRef.current.continuous ?? true;
      recognition.interimResults = configRef.current.interimResults ?? true;
      recognition.lang = configRef.current.language ?? 'en-US';
      recognition.maxAlternatives = configRef.current.maxAlternatives ?? 1;

      // Set up grammars if provided
      if (configRef.current.grammars?.length) {
        try {
          const SpeechGrammarListConstructor = 
            window.SpeechGrammarList || window.webkitSpeechGrammarList;
          
          if (SpeechGrammarListConstructor) {
            const grammarList = new SpeechGrammarListConstructor();
            configRef.current.grammars.forEach(grammar => {
              grammarList.addFromString(grammar, 1);
            });
            recognition.grammars = grammarList;
          }
        } catch (grammarError) {
          console.warn('Failed to set up speech grammars:', grammarError);
        }
      }

      // Event handlers
      recognition.onstart = () => {
        setState(prev => ({ ...prev, isListening: true, error: null }));
        configRef.current.onStart?.();
      };

      recognition.onend = () => {
        setState(prev => ({ ...prev, isListening: false }));
        configRef.current.onEnd?.();
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        const errorMessage = getErrorMessage(event.error);
        setState(prev => ({ 
          ...prev, 
          error: errorMessage, 
          isListening: false 
        }));
        configRef.current.onError?.(event.error, errorMessage);
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = '';
        let interimTranscript = '';
        let maxConfidence = 0;

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const transcript = result[0].transcript;
          const confidence = result[0].confidence;

          if (result.isFinal) {
            finalTranscript += transcript;
            maxConfidence = Math.max(maxConfidence, confidence);
          } else {
            interimTranscript += transcript;
          }
        }

        setState(prev => ({
          ...prev,
          transcript: prev.transcript + finalTranscript,
          finalTranscript: finalTranscript,
          interimTranscript,
          confidence: maxConfidence || prev.confidence
        }));

        if (finalTranscript) {
          configRef.current.onResult?.(finalTranscript, maxConfidence, true);
        } else if (interimTranscript) {
          configRef.current.onResult?.(interimTranscript, 0, false);
        }
      };

      recognition.onnomatch = () => {
        configRef.current.onNoMatch?.();
      };

      recognitionRef.current = recognition;
      setIsInitialized(true);

    } catch (error) {
      console.error('Failed to initialize speech recognition:', error);
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to initialize speech recognition',
        isSupported: false 
      }));
    }
  }, [state.isSupported]);

  // Get human-readable error message
  function getErrorMessage(errorCode: SpeechRecognitionErrorCode): string {
    const errorMessages: Record<SpeechRecognitionErrorCode, string> = {
      'no-speech': 'No speech detected. Please try speaking louder or closer to the microphone.',
      'aborted': 'Speech recognition was aborted.',
      'audio-capture': 'Audio capture failed. Please check your microphone permissions.',
      'network': 'Network error occurred during speech recognition.',
      'not-allowed': 'Microphone access denied. Please allow microphone permissions.',
      'service-not-allowed': 'Speech recognition service is not allowed.',
      'bad-grammar': 'Speech grammar error occurred.',
      'language-not-supported': 'Language not supported for speech recognition.'
    };

    return errorMessages[errorCode] || `Speech recognition error: ${errorCode}`;
  }

  // Actions
  const start = useCallback(async (): Promise<void> => {
    if (!state.isSupported) {
      throw new Error('Speech recognition is not supported');
    }

    if (!recognitionRef.current) {
      initializeRecognition();
      // Wait a tick for initialization
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    if (!recognitionRef.current) {
      throw new Error('Failed to initialize speech recognition');
    }

    try {
      setState(prev => ({ ...prev, error: null }));
      recognitionRef.current.start();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start speech recognition';
      setState(prev => ({ ...prev, error: errorMessage }));
      throw error;
    }
  }, [state.isSupported, initializeRecognition]);

  const stop = useCallback(() => {
    if (recognitionRef.current && state.isListening) {
      recognitionRef.current.stop();
    }
  }, [state.isListening]);

  const abort = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.abort();
      setState(prev => ({ ...prev, isListening: false }));
    }
  }, []);

  const reset = useCallback(() => {
    setState(prev => ({
      ...prev,
      transcript: '',
      finalTranscript: '',
      interimTranscript: '',
      confidence: 0,
      error: null
    }));
  }, []);

  const resetTranscript = useCallback(() => {
    setState(prev => ({
      ...prev,
      transcript: '',
      finalTranscript: '',
      interimTranscript: ''
    }));
  }, []);

  const updateConfig = useCallback((newConfig: Partial<SpeechRecognitionConfig>) => {
    configRef.current = { ...configRef.current, ...newConfig };
    
    // If recognition is initialized and not listening, update its properties
    if (recognitionRef.current && !state.isListening) {
      const recognition = recognitionRef.current;
      if (newConfig.continuous !== undefined) recognition.continuous = newConfig.continuous;
      if (newConfig.interimResults !== undefined) recognition.interimResults = newConfig.interimResults;
      if (newConfig.language !== undefined) recognition.lang = newConfig.language;
      if (newConfig.maxAlternatives !== undefined) recognition.maxAlternatives = newConfig.maxAlternatives;
    }
  }, [state.isListening]);

  // Initialize on mount
  useEffect(() => {
    if (state.isSupported && !isInitialized) {
      initializeRecognition();
    }
  }, [state.isSupported, isInitialized, initializeRecognition]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
    };
  }, []);

  return {
    ...state,
    start,
    stop,
    abort,
    reset,
    resetTranscript,
    updateConfig
  };
}