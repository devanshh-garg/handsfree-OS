// Web Speech API TypeScript declarations
// This file provides comprehensive type definitions for the browser's Web Speech API

interface SpeechRecognition extends EventTarget {
  // Properties
  continuous: boolean;
  grammars: SpeechGrammarList;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  serviceURI: string;

  // Methods
  abort(): void;
  start(): void;
  stop(): void;

  // Event handlers
  onaudioend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onaudiostart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
  onnomatch: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onsoundend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onsoundstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onspeechend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onspeechstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
}

interface SpeechRecognitionStatic {
  new(): SpeechRecognition;
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: SpeechRecognitionErrorCode;
  readonly message: string;
}

type SpeechRecognitionErrorCode = 
  | 'no-speech'
  | 'aborted'
  | 'audio-capture'
  | 'network'
  | 'not-allowed'
  | 'service-not-allowed'
  | 'bad-grammar'
  | 'language-not-supported';

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly confidence: number;
  readonly transcript: string;
}

interface SpeechGrammarList {
  readonly length: number;
  addFromString(string: string, weight?: number): void;
  addFromURI(src: string, weight?: number): void;
  item(index: number): SpeechGrammar;
  [index: number]: SpeechGrammar;
}

interface SpeechGrammarListStatic {
  new(): SpeechGrammarList;
}

interface SpeechGrammar {
  src: string;
  weight: number;
}

interface SpeechGrammarStatic {
  new(): SpeechGrammar;
}

// Speech Synthesis API
interface SpeechSynthesis extends EventTarget {
  readonly paused: boolean;
  readonly pending: boolean;
  readonly speaking: boolean;

  cancel(): void;
  getVoices(): SpeechSynthesisVoice[];
  pause(): void;
  resume(): void;
  speak(utterance: SpeechSynthesisUtterance): void;

  onvoiceschanged: ((this: SpeechSynthesis, ev: Event) => any) | null;
}

interface SpeechSynthesisUtterance extends EventTarget {
  lang: string;
  pitch: number;
  rate: number;
  text: string;
  voice: SpeechSynthesisVoice | null;
  volume: number;

  onboundary: ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisEvent) => any) | null;
  onend: ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisEvent) => any) | null;
  onerror: ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisErrorEvent) => any) | null;
  onmark: ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisEvent) => any) | null;
  onpause: ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisEvent) => any) | null;
  onresume: ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisEvent) => any) | null;
  onstart: ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisEvent) => any) | null;
}

interface SpeechSynthesisUtteranceStatic {
  new(text?: string): SpeechSynthesisUtterance;
}

interface SpeechSynthesisEvent extends Event {
  readonly charIndex: number;
  readonly charLength: number;
  readonly elapsedTime: number;
  readonly name: string;
  readonly utterance: SpeechSynthesisUtterance;
}

interface SpeechSynthesisErrorEvent extends SpeechSynthesisEvent {
  readonly error: SpeechSynthesisErrorCode;
}

type SpeechSynthesisErrorCode = 
  | 'canceled'
  | 'interrupted'
  | 'audio-busy'
  | 'audio-hardware'
  | 'network'
  | 'synthesis-unavailable'
  | 'synthesis-failed'
  | 'language-unavailable'
  | 'voice-unavailable'
  | 'text-too-long'
  | 'invalid-argument';

interface SpeechSynthesisVoice {
  readonly default: boolean;
  readonly lang: string;
  readonly localService: boolean;
  readonly name: string;
  readonly voiceURI: string;
}

// Global interface extensions
declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionStatic;
    webkitSpeechRecognition: SpeechRecognitionStatic;
    SpeechGrammarList: SpeechGrammarListStatic;
    webkitSpeechGrammarList: SpeechGrammarListStatic;
    SpeechGrammar: SpeechGrammarStatic;
    speechSynthesis: SpeechSynthesis;
    SpeechSynthesisUtterance: SpeechSynthesisUtteranceStatic;
  }
}

// Vendor-specific interfaces
interface webkitSpeechRecognition extends SpeechRecognition {}
interface webkitSpeechGrammarList extends SpeechGrammarList {}
interface webkitSpeechGrammar extends SpeechGrammar {}

declare var SpeechRecognition: SpeechRecognitionStatic;
declare var webkitSpeechRecognition: SpeechRecognitionStatic;
declare var SpeechGrammarList: SpeechGrammarListStatic;
declare var webkitSpeechGrammarList: SpeechGrammarListStatic;
declare var SpeechGrammar: SpeechGrammarStatic;
declare var SpeechSynthesisUtterance: SpeechSynthesisUtteranceStatic;

// Export types for use in other modules
export {
  SpeechRecognition,
  SpeechRecognitionEvent,
  SpeechRecognitionErrorEvent,
  SpeechRecognitionErrorCode,
  SpeechRecognitionResult,
  SpeechRecognitionAlternative,
  SpeechGrammarList,
  SpeechGrammar,
  SpeechSynthesis,
  SpeechSynthesisUtterance,
  SpeechSynthesisEvent,
  SpeechSynthesisErrorEvent,
  SpeechSynthesisErrorCode,
  SpeechSynthesisVoice
};