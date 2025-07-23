import Fuse from 'fuse.js';
import { VoiceCommand, VoiceAction } from '@/types';
import { mockMenuItems } from '@/lib/mockData';

interface VoiceProcessorConfig {
  wakeWords: string[];
  confidenceThreshold: number;
  maxListeningTime: number;
  language: string;
  noiseGateThreshold: number;
}

export class VoiceProcessor {
  private recognition: (window.SpeechRecognition | window.webkitSpeechRecognition) | null = null;
  private synthesis: SpeechSynthesis | null = null;
  private isListening = false;
  private isProcessing = false;
  private config: VoiceProcessorConfig;
  private audioContext: AudioContext | null = null;
  private noiseGate: GainNode | null = null;
  private wakeWordDetector: WakeWordDetector | null = null;
  
  // Fuzzy matching for restaurant vocabulary
  private menuFuse: Fuse<any> | null = null;
  private commandFuse: Fuse<any> | null = null;

  constructor(config: Partial<VoiceProcessorConfig> = {}) {
    this.config = {
      wakeWords: ['hey restaurant', 'restaurant system', 'गणेश', 'गणेश भोजनालय'],
      confidenceThreshold: 0.7,
      maxListeningTime: 10000,
      language: 'hi-IN',
      noiseGateThreshold: 0.01,
      ...config
    };

    this.initializeSpeechRecognition();
    this.initializeSpeechSynthesis();
    this.initializeAudioProcessing();
    this.initializeFuzzyMatching();
  }

  private initializeSpeechRecognition() {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.error('Speech Recognition not supported in this browser');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 3;
    this.recognition.lang = this.config.language;

    // Support for multiple languages
    this.recognition.grammars = this.createGrammar();
  }

  private createGrammar(): typeof SpeechGrammarList | undefined {
    if (typeof window === 'undefined') return;

    const SpeechGrammarList = window.SpeechGrammarList || (window as any).webkitSpeechGrammarList;
    
    if (!SpeechGrammarList) return;

    const grammarList = new SpeechGrammarList();
    
    // Restaurant-specific grammar
    const restaurantGrammar = `
      #JSGF V1.0; grammar restaurant;
      public <command> = <action> <target> | <query>;
      <action> = order | table | ready | clean | add | remove | update;
      <target> = <tableNumber> | <menuItem> | <status>;
      <tableNumber> = table (one | two | three | four | five | six | seven | eight | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8);
      <menuItem> = paneer | dal | rice | naan | chai | lassi | samosa | tikka;
      <status> = ready | preparing | served | available | occupied | cleaning;
      <query> = revenue | sales | orders | status;
    `;
    
    grammarList.addFromString(restaurantGrammar, 1);
    return grammarList;
  }

  private initializeSpeechSynthesis() {
    if (typeof window === 'undefined') return;
    
    this.synthesis = window.speechSynthesis;
  }

  private initializeAudioProcessing() {
    if (typeof window === 'undefined') return;

    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.wakeWordDetector = new WakeWordDetector(this.config.wakeWords);
    } catch (error) {
      console.warn('Audio processing not available:', error);
    }
  }

  private initializeFuzzyMatching() {
    // Menu items fuzzy search
    this.menuFuse = new Fuse(mockMenuItems, {
      keys: [
        { name: 'name', weight: 0.4 },
        { name: 'nameHindi', weight: 0.4 },
        { name: 'tags', weight: 0.2 }
      ],
      threshold: 0.4,
      includeScore: true
    });

    // Command patterns for fuzzy matching
    const commandPatterns = [
      { pattern: 'table ready', action: 'order', subtype: 'mark_ready' },
      { pattern: 'order ready', action: 'order', subtype: 'mark_ready' },
      { pattern: 'add item', action: 'order', subtype: 'add_item' },
      { pattern: 'table clean', action: 'table', subtype: 'mark_cleaning' },
      { pattern: 'inventory update', action: 'inventory', subtype: 'update' },
      { pattern: 'show revenue', action: 'query', subtype: 'revenue' }
    ];

    this.commandFuse = new Fuse(commandPatterns, {
      keys: ['pattern'],
      threshold: 0.3,
      includeScore: true
    });
  }

  async startListening(callback: (command: VoiceCommand) => void): Promise<void> {
    if (!this.recognition || this.isListening) return;

    return new Promise((resolve, reject) => {
      this.isListening = true;
      
      this.recognition!.onstart = () => {
        console.log('Voice recognition started');
        resolve();
      };

      this.recognition!.onresult = (event: SpeechRecognitionEvent) => {
        this.handleSpeechResult(event, callback);
      };

      this.recognition!.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error);
        this.isListening = false;
        reject(new Error(event.error));
      };

      this.recognition!.onend = () => {
        console.log('Voice recognition ended');
        this.isListening = false;
      };

      // Set timeout for max listening time
      setTimeout(() => {
        if (this.isListening) {
          this.stopListening();
        }
      }, this.config.maxListeningTime);

      this.recognition!.start();
    });
  }

  private handleSpeechResult(event: SpeechRecognitionEvent, callback: (command: VoiceCommand) => void) {
    let finalTranscript = '';
    let interimTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const transcript = result[0].transcript;
      const confidence = result[0].confidence || 0.9; // Default confidence if not provided

      if (result.isFinal) {
        finalTranscript += transcript;
        
        console.log('Final transcript:', transcript, 'Confidence:', confidence);
        
        // Process the final transcript
        // Lower the threshold for testing (was 0.7)
        if (confidence >= 0.5) {
          this.processTranscript(transcript, confidence, callback);
        } else {
          console.log('Confidence too low:', confidence);
        }
      } else {
        interimTranscript += transcript;
      }
    }

    // Emit interim results for UI feedback
    if (interimTranscript && !finalTranscript) {
      console.log('Interim transcript:', interimTranscript);
      callback({
        id: `interim-${Date.now()}`,
        command: interimTranscript,
        language: this.detectLanguage(interimTranscript),
        confidence: 0.5,
        timestamp: new Date(),
        action: { type: 'query', subtype: 'interim' },
        parameters: {},
        success: false
      });
    }
  }

  private async processTranscript(transcript: string, confidence: number, callback: (command: VoiceCommand) => void) {
    this.isProcessing = true;

    try {
      // For development/testing: Allow commands without wake word if transcript is short
      const isShortCommand = transcript.split(' ').length <= 10;
      
      // Wake word detection - skip for short commands in dev
      if (!isShortCommand && !this.isWakeWordDetected(transcript)) {
        console.log('Wake word not detected in:', transcript);
        return;
      }

      // Clean and normalize transcript
      const cleanTranscript = this.cleanTranscript(transcript);
      console.log('Processing command:', cleanTranscript);
      
      // Parse the command using advanced NLP
      const action = this.parseAdvancedCommand(cleanTranscript);
      const parameters = this.extractAdvancedParameters(cleanTranscript);

      // Check if command is understood
      if (action.subtype === 'unknown' || confidence < 0.3) {
        console.log('Low confidence or unknown command');
        
        // Speak "didn't catch that" response
        const responses = [
          "माफ करें, मुझे समझ नहीं आया। कृपया फिर से बोलें।",
          "Sorry, I didn't catch that. Please try again.",
          "कृपया फिर से बोलें, स्पष्ट नहीं सुनाई दिया।",
          "Please repeat your command more clearly."
        ];
        
        const response = responses[Math.floor(Math.random() * responses.length)];
        await this.speakResponse(response);
        
        // Send retry prompt command
        callback({
          id: `cmd-retry-${Date.now()}`,
          command: cleanTranscript,
          language: this.detectLanguage(cleanTranscript),
          confidence,
          timestamp: new Date(),
          action: { type: 'query', subtype: 'retry' },
          parameters: {},
          success: false,
          response: response
        });
        
        return;
      }

      const command: VoiceCommand = {
        id: `cmd-${Date.now()}`,
        command: cleanTranscript,
        language: this.detectLanguage(cleanTranscript),
        confidence,
        timestamp: new Date(),
        action,
        parameters,
        success: true
      };

      console.log('Parsed command:', { action, parameters });
      
      // Call the callback to process the command
      callback(command);
      
      // Provide voice feedback
      await this.speakResponse(this.generateResponse(command));

    } catch (error) {
      console.error('Error processing transcript:', error);
      
      // Still call callback with error command
      callback({
        id: `cmd-error-${Date.now()}`,
        command: transcript,
        language: this.detectLanguage(transcript),
        confidence,
        timestamp: new Date(),
        action: { type: 'query', subtype: 'error' },
        parameters: {},
        success: false,
        response: 'Sorry, I could not process that command'
      });
    } finally {
      this.isProcessing = false;
    }
  }

  private isWakeWordDetected(transcript: string): boolean {
    const lowerTranscript = transcript.toLowerCase();
    return this.config.wakeWords.some(wakeWord => 
      lowerTranscript.includes(wakeWord.toLowerCase())
    );
  }

  private cleanTranscript(transcript: string): string {
    // Remove wake words and clean up the transcript
    let cleaned = transcript.toLowerCase();
    
    for (const wakeWord of this.config.wakeWords) {
      cleaned = cleaned.replace(wakeWord.toLowerCase(), '').trim();
    }

    // Handle common transcription errors for Indian English
    const corrections = {
      'table tree': 'table 3',
      'table ate': 'table 8',
      'table sex': 'table 6',
      'butter chicken': 'paneer',
      'ready hey': 'ready hai',
      'complete hey': 'complete hai'
    };

    for (const [error, correction] of Object.entries(corrections)) {
      cleaned = cleaned.replace(error, correction);
    }

    return cleaned.trim();
  }

  private parseAdvancedCommand(text: string): VoiceAction {
    // First try fuzzy matching with predefined patterns
    const fuzzyResult = this.commandFuse.search(text);
    
    if (fuzzyResult.length > 0 && fuzzyResult[0].score! < 0.3) {
      const match = fuzzyResult[0].item;
      return { type: match.action as any, subtype: match.subtype };
    }

    // Fallback to rule-based parsing with Hindi/English support
    const lowerText = text.toLowerCase();

    // Order-related commands (Hindi/English mixed)
    if (this.matchesPattern(lowerText, ['order', 'आर्डर', 'ready', 'तैयार', 'complete', 'पूरा'])) {
      if (this.matchesPattern(lowerText, ['ready', 'तैयार', 'complete', 'पूरा'])) {
        return { type: 'order', subtype: 'mark_ready' };
      }
      return { type: 'order', subtype: 'update' };
    }

    // Table-related commands
    if (this.matchesPattern(lowerText, ['table', 'टेबल', 'मेज'])) {
      if (this.matchesPattern(lowerText, ['clean', 'साफ', 'cleaning'])) {
        return { type: 'table', subtype: 'mark_cleaning' };
      }
      if (this.matchesPattern(lowerText, ['occupied', 'busy', 'व्यस्त'])) {
        return { type: 'table', subtype: 'mark_occupied' };
      }
      return { type: 'table', subtype: 'update_status' };
    }

    // Inventory commands
    if (this.matchesPattern(lowerText, ['inventory', 'stock', 'खत्म', 'khatam', 'finished'])) {
      return { type: 'inventory', subtype: 'update' };
    }

    // Query commands
    if (this.matchesPattern(lowerText, ['revenue', 'sales', 'कितना', 'kitna', 'how much', 'available'])) {
      return { type: 'query', subtype: 'information' };
    }

    return { type: 'query', subtype: 'unknown' };
  }

  private matchesPattern(text: string, patterns: string[]): boolean {
    return patterns.some(pattern => text.includes(pattern));
  }

  private extractAdvancedParameters(text: string): Record<string, any> {
    const params: Record<string, any> = {};

    // Extract table numbers (Hindi and English)
    const tablePatterns = [
      /table\s*(\d+)/i,
      /टेबल\s*(\d+)/i,
      /table\s*(one|two|three|four|five|six|seven|eight)/i,
      /table\s*(एक|दो|तीन|चार|पांच|छह|सात|आठ)/i
    ];

    for (const pattern of tablePatterns) {
      const match = text.match(pattern);
      if (match) {
        params.tableNumber = this.parseTableNumber(match[1]);
        break;
      }
    }

    // Extract menu items using fuzzy search
    const menuMatches = this.menuFuse.search(text);
    if (menuMatches.length > 0 && menuMatches[0].score! < 0.4) {
      params.menuItem = menuMatches[0].item;
      params.itemName = menuMatches[0].item.name;
    }

    // Extract quantities
    const quantityPatterns = [
      /(\d+)\s*(plate|glass|cup|प्लेट|गिलास)/i,
      /(one|two|three|four|five|एक|दो|तीन|चार|पांच)\s*(plate|glass|cup|प्लेट|गिलास)/i
    ];

    for (const pattern of quantityPatterns) {
      const match = text.match(pattern);
      if (match) {
        params.quantity = this.parseQuantity(match[1]);
        break;
      }
    }

    // Extract special instructions
    const specialInstructions = this.extractSpecialInstructions(text);
    if (specialInstructions.length > 0) {
      params.specialInstructions = specialInstructions;
    }

    return params;
  }

  private parseTableNumber(numberStr: string): number {
    const numberMap: { [key: string]: number } = {
      'one': 1, 'एक': 1,
      'two': 2, 'दो': 2,
      'three': 3, 'तीन': 3,
      'four': 4, 'चार': 4,
      'five': 5, 'पांच': 5,
      'six': 6, 'छह': 6,
      'seven': 7, 'सात': 7,
      'eight': 8, 'आठ': 8
    };

    return numberMap[numberStr.toLowerCase()] || parseInt(numberStr) || 0;
  }

  private parseQuantity(quantityStr: string): number {
    const quantityMap: { [key: string]: number } = {
      'one': 1, 'एक': 1,
      'two': 2, 'दो': 2,
      'three': 3, 'तीन': 3,
      'four': 4, 'चार': 4,
      'five': 5, 'पांच': 5
    };

    return quantityMap[quantityStr.toLowerCase()] || parseInt(quantityStr) || 1;
  }

  private extractSpecialInstructions(text: string): string[] {
    const instructions: string[] = [];
    
    // Common special instructions
    const instructionPatterns = [
      { pattern: /less spicy|कम मसाला|kam masala/i, instruction: 'less spicy' },
      { pattern: /extra spicy|ज्यादा मसाला|jyada masala/i, instruction: 'extra spicy' },
      { pattern: /no onion|बिना प्याज|bina pyaj/i, instruction: 'no onion' },
      { pattern: /jain|जैन/i, instruction: 'jain' },
      { pattern: /extra butter|ज्यादा मक्खन/i, instruction: 'extra butter' },
      { pattern: /half plate|आधा प्लेट/i, instruction: 'half plate' }
    ];

    for (const { pattern, instruction } of instructionPatterns) {
      if (pattern.test(text)) {
        instructions.push(instruction);
      }
    }

    return instructions;
  }

  private detectLanguage(text: string): 'hindi' | 'english' | 'mixed' {
    const hindiPattern = /[\u0900-\u097F]/;
    const englishPattern = /[a-zA-Z]/;
    
    const hasHindi = hindiPattern.test(text);
    const hasEnglish = englishPattern.test(text);
    
    if (hasHindi && hasEnglish) return 'mixed';
    if (hasHindi) return 'hindi';
    return 'english';
  }

  private generateResponse(command: VoiceCommand): string {
    const { action, parameters, language } = command;
    
    // Generate contextual responses in the same language
    const responses = {
      hindi: {
        'order:mark_ready': `टेबल ${parameters.tableNumber} का आर्डर तैयार है`,
        'table:mark_cleaning': `टेबल ${parameters.tableNumber} साफ करने के लिए मार्क किया गया है`,
        'inventory:update': `इन्वेंटरी अपडेट कर दी गई है`,
        default: 'कमांड प्रोसेस कर दी गई है'
      },
      english: {
        'order:mark_ready': `Table ${parameters.tableNumber} order is ready`,
        'table:mark_cleaning': `Table ${parameters.tableNumber} marked for cleaning`,
        'inventory:update': 'Inventory has been updated',
        default: 'Command processed successfully'
      },
      mixed: {
        'order:mark_ready': `Table ${parameters.tableNumber} का order ready है`,
        'table:mark_cleaning': `Table ${parameters.tableNumber} को cleaning के लिए mark कर दिया`,
        'inventory:update': 'Inventory update कर दी गई है',
        default: 'Command process हो गई है'
      }
    };

    const responseKey = `${action.type}:${action.subtype}`;
    const langResponses = responses[language] || responses.english;
    
    return langResponses[responseKey as keyof typeof langResponses] || langResponses.default;
  }

  async speakResponse(text: string): Promise<void> {
    if (!this.synthesis) return;

    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Try to use Hindi voice if available
      const voices = this.synthesis!.getVoices();
      const hindiVoice = voices.find(voice => voice.lang.startsWith('hi'));
      const englishVoice = voices.find(voice => voice.lang.startsWith('en'));
      
      utterance.voice = hindiVoice || englishVoice || voices[0];
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      utterance.volume = 0.8;

      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();

      this.synthesis!.speak(utterance);
    });
  }

  stopListening(): void {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
      this.isListening = false;
    }
  }

  getIsListening(): boolean {
    return this.isListening;
  }

  getIsProcessing(): boolean {
    return this.isProcessing;
  }
}

// Wake word detection class (simplified implementation)
class WakeWordDetector {
  private wakeWords: string[];

  constructor(wakeWords: string[]) {
    this.wakeWords = wakeWords;
  }

  detect(audioData: Float32Array): boolean {
    // In a real implementation, this would use ML models
    // For now, we'll use the speech recognition results
    return true;
  }
}

// Singleton instance
let voiceProcessor: VoiceProcessor | null = null;

export function getVoiceProcessor(): VoiceProcessor {
  if (!voiceProcessor) {
    voiceProcessor = new VoiceProcessor();
  }
  return voiceProcessor;
}