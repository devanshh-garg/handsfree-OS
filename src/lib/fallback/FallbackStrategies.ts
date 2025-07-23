'use client';

interface FallbackContext {
  errorType: ErrorType;
  originalInput: string;
  confidence: number;
  attemptCount: number;
  previousStrategies: string[];
  userContext: {
    language: 'en' | 'hi' | 'hinglish';
    speakerId?: string;
    sessionId: string;
    location?: string;
    urgency: 'low' | 'medium' | 'high' | 'critical';
  };
  systemState: {
    audioQuality: number;
    networkStatus: 'online' | 'offline' | 'degraded';
    processingLoad: number;
    availableServices: string[];
  };
  metadata: {
    timestamp: string;
    duration: number;
    audioMetadata?: any;
  };
}

interface FallbackStrategy {
  id: string;
  name: string;
  description: string;
  triggers: ErrorType[];
  priority: number;
  conditions?: (context: FallbackContext) => boolean;
  maxAttempts: number;
  timeout?: number;
  execute: (context: FallbackContext) => Promise<FallbackResult>;
  successCriteria: (result: any) => boolean;
  fallbackChain?: string[];
}

interface FallbackResult {
  success: boolean;
  confidence: number;
  response?: string;
  alternativeInput?: string;
  suggestedActions?: string[];
  requiresHumanIntervention: boolean;
  metadata: {
    strategyUsed: string;
    processingTime: number;
    fallbackLevel: number;
  };
}

interface ErrorPattern {
  type: ErrorType;
  patterns: RegExp[];
  indicators: string[];
  commonCauses: string[];
  suggestedFixes: string[];
}

type ErrorType = 
  | 'speech_recognition_failed'
  | 'low_confidence_recognition'
  | 'ambiguous_intent'
  | 'context_lost'
  | 'service_unavailable'
  | 'network_failure'
  | 'audio_quality_poor'
  | 'language_detection_failed'
  | 'timeout_error'
  | 'processing_overload'
  | 'unknown_command'
  | 'authentication_failed'
  | 'system_error';

export class FallbackStrategies {
  private static instance: FallbackStrategies;
  
  private strategies: Map<string, FallbackStrategy> = new Map();
  private errorPatterns: Map<ErrorType, ErrorPattern> = new Map();
  private fallbackHistory: Array<{
    context: FallbackContext;
    result: FallbackResult;
    timestamp: string;
  }> = [];
  private strategyUsageStats: Map<string, {
    attempts: number;
    successes: number;
    averageTime: number;
  }> = new Map();
  
  // Core fallback strategies for restaurant voice system
  private coreStrategies: FallbackStrategy[] = [
    {
      id: 'audio_quality_enhancement',
      name: 'Audio Quality Enhancement',
      description: 'Improve audio quality through noise reduction and amplification',
      triggers: ['audio_quality_poor', 'speech_recognition_failed'],
      priority: 1,
      maxAttempts: 2,
      timeout: 5000,
      execute: async (context: FallbackContext) => {
        const startTime = Date.now();
        
        // Simulate audio enhancement
        const enhancedInput = await this.enhanceAudioQuality(context.originalInput, context.metadata.audioMetadata);
        
        if (enhancedInput.quality > 0.7) {
          return {
            success: true,
            confidence: enhancedInput.quality,
            alternativeInput: enhancedInput.processedAudio,
            requiresHumanIntervention: false,
            metadata: {
              strategyUsed: 'audio_quality_enhancement',
              processingTime: Date.now() - startTime,
              fallbackLevel: 1
            }
          };
        }
        
        return {
          success: false,
          confidence: enhancedInput.quality,
          requiresHumanIntervention: enhancedInput.quality < 0.3,
          metadata: {
            strategyUsed: 'audio_quality_enhancement',
            processingTime: Date.now() - startTime,
            fallbackLevel: 1
          }
        };
      },
      successCriteria: (result) => result.confidence > 0.7,
      fallbackChain: ['contextual_inference', 'clarification_request']
    },
    {
      id: 'contextual_inference',
      name: 'Contextual Inference',
      description: 'Infer intent using conversation history and context',
      triggers: ['low_confidence_recognition', 'ambiguous_intent', 'unknown_command'],
      priority: 2,
      maxAttempts: 1,
      execute: async (context: FallbackContext) => {
        const startTime = Date.now();
        
        const inference = await this.performContextualInference(context);
        
        if (inference.confidence > 0.6) {
          return {
            success: true,
            confidence: inference.confidence,
            response: inference.suggestedResponse,
            suggestedActions: inference.actions,
            requiresHumanIntervention: false,
            metadata: {
              strategyUsed: 'contextual_inference',
              processingTime: Date.now() - startTime,
              fallbackLevel: 2
            }
          };
        }
        
        return {
          success: false,
          confidence: inference.confidence,
          requiresHumanIntervention: inference.confidence < 0.3,
          metadata: {
            strategyUsed: 'contextual_inference',
            processingTime: Date.now() - startTime,
            fallbackLevel: 2
          }
        };
      },
      successCriteria: (result) => result.confidence > 0.6,
      fallbackChain: ['clarification_request', 'suggestion_menu']
    },
    {
      id: 'language_detection_retry',
      name: 'Language Detection Retry',
      description: 'Retry with different language models',
      triggers: ['language_detection_failed', 'speech_recognition_failed'],
      priority: 2,
      maxAttempts: 3,
      execute: async (context: FallbackContext) => {
        const startTime = Date.now();
        
        const languages = ['en', 'hi', 'hinglish'];
        const currentLang = context.userContext.language;
        const alternativeLanguages = languages.filter(lang => lang !== currentLang);
        
        for (const lang of alternativeLanguages) {
          const result = await this.retryWithLanguage(context.originalInput, lang as any);
          
          if (result.confidence > 0.7) {
            return {
              success: true,
              confidence: result.confidence,
              alternativeInput: result.transcription,
              response: this.getLanguageConfirmation(lang as any, result.transcription),
              requiresHumanIntervention: false,
              metadata: {
                strategyUsed: 'language_detection_retry',
                processingTime: Date.now() - startTime,
                fallbackLevel: 2
              }
            };
          }
        }
        
        return {
          success: false,
          confidence: 0.2,
          requiresHumanIntervention: true,
          metadata: {
            strategyUsed: 'language_detection_retry',
            processingTime: Date.now() - startTime,
            fallbackLevel: 2
          }
        };
      },
      successCriteria: (result) => result.confidence > 0.7
    },
    {
      id: 'clarification_request',
      name: 'Interactive Clarification',
      description: 'Ask user to clarify or repeat their request',
      triggers: ['ambiguous_intent', 'low_confidence_recognition', 'unknown_command'],
      priority: 3,
      maxAttempts: 2,
      execute: async (context: FallbackContext) => {
        const startTime = Date.now();
        
        const clarificationPrompt = this.generateClarificationPrompt(context);
        
        return {
          success: true,
          confidence: 0.8,
          response: clarificationPrompt,
          suggestedActions: ['listen_for_clarification', 'show_options'],
          requiresHumanIntervention: false,
          metadata: {
            strategyUsed: 'clarification_request',
            processingTime: Date.now() - startTime,
            fallbackLevel: 3
          }
        };
      },
      successCriteria: () => true, // Always considered successful as it prompts user
      fallbackChain: ['suggestion_menu', 'human_handoff']
    },
    {
      id: 'suggestion_menu',
      name: 'Contextual Suggestions Menu',
      description: 'Provide menu of likely actions based on context',
      triggers: ['unknown_command', 'ambiguous_intent', 'context_lost'],
      priority: 4,
      maxAttempts: 1,
      execute: async (context: FallbackContext) => {
        const startTime = Date.now();
        
        const suggestions = await this.generateContextualSuggestions(context);
        
        return {
          success: true,
          confidence: 0.7,
          response: this.formatSuggestionMenu(suggestions, context.userContext.language),
          suggestedActions: suggestions.map(s => s.action),
          requiresHumanIntervention: false,
          metadata: {
            strategyUsed: 'suggestion_menu',
            processingTime: Date.now() - startTime,
            fallbackLevel: 4
          }
        };
      },
      successCriteria: () => true,
      fallbackChain: ['simplified_interface', 'human_handoff']
    },
    {
      id: 'offline_mode',
      name: 'Offline Mode Fallback',
      description: 'Switch to cached responses and local processing',
      triggers: ['network_failure', 'service_unavailable'],
      priority: 2,
      maxAttempts: 1,
      conditions: (context) => context.systemState.networkStatus === 'offline',
      execute: async (context: FallbackContext) => {
        const startTime = Date.now();
        
        const offlineResponse = await this.processOfflineRequest(context);
        
        return {
          success: offlineResponse.found,
          confidence: offlineResponse.confidence,
          response: offlineResponse.response,
          suggestedActions: offlineResponse.actions,
          requiresHumanIntervention: !offlineResponse.found,
          metadata: {
            strategyUsed: 'offline_mode',
            processingTime: Date.now() - startTime,
            fallbackLevel: 2
          }
        };
      },
      successCriteria: (result) => result.success,
      fallbackChain: ['simplified_interface', 'human_handoff']
    },
    {
      id: 'simplified_interface',
      name: 'Simplified Voice Interface',
      description: 'Switch to basic commands and simpler interaction model',
      triggers: ['processing_overload', 'timeout_error', 'system_error'],
      priority: 5,
      maxAttempts: 1,
      execute: async (context: FallbackContext) => {
        const startTime = Date.now();
        
        const simplifiedResponse = this.activateSimplifiedMode(context);
        
        return {
          success: true,
          confidence: 0.9,
          response: simplifiedResponse.message,
          suggestedActions: simplifiedResponse.availableCommands,
          requiresHumanIntervention: false,
          metadata: {
            strategyUsed: 'simplified_interface',
            processingTime: Date.now() - startTime,
            fallbackLevel: 5
          }
        };
      },
      successCriteria: () => true,
      fallbackChain: ['human_handoff']
    },
    {
      id: 'text_input_fallback',
      name: 'Text Input Fallback',
      description: 'Offer text-based input as alternative to voice',
      triggers: ['speech_recognition_failed', 'audio_quality_poor'],
      priority: 6,
      maxAttempts: 1,
      conditions: (context) => context.attemptCount > 2,
      execute: async (context: FallbackContext) => {
        const startTime = Date.now();
        
        return {
          success: true,
          confidence: 0.95,
          response: this.getTextInputPrompt(context.userContext.language),
          suggestedActions: ['activate_text_input', 'show_keyboard'],
          requiresHumanIntervention: false,
          metadata: {
            strategyUsed: 'text_input_fallback',
            processingTime: Date.now() - startTime,
            fallbackLevel: 6
          }
        };
      },
      successCriteria: () => true,
      fallbackChain: ['human_handoff']
    },
    {
      id: 'human_handoff',
      name: 'Human Staff Handoff',
      description: 'Transfer to human staff member for assistance',
      triggers: ['authentication_failed', 'system_error'],
      priority: 10,
      maxAttempts: 1,
      execute: async (context: FallbackContext) => {
        const startTime = Date.now();
        
        const handoffMessage = this.prepareHandoffMessage(context);
        
        return {
          success: true,
          confidence: 1.0,
          response: handoffMessage,
          suggestedActions: ['notify_staff', 'create_support_ticket'],
          requiresHumanIntervention: true,
          metadata: {
            strategyUsed: 'human_handoff',
            processingTime: Date.now() - startTime,
            fallbackLevel: 10
          }
        };
      },
      successCriteria: () => true
    }
  ];

  private constructor() {
    this.initializeStrategies();
    this.initializeErrorPatterns();
  }

  public static getInstance(): FallbackStrategies {
    if (!FallbackStrategies.instance) {
      FallbackStrategies.instance = new FallbackStrategies();
    }
    return FallbackStrategies.instance;
  }

  private initializeStrategies(): void {
    this.coreStrategies.forEach(strategy => {
      this.strategies.set(strategy.id, strategy);
      this.strategyUsageStats.set(strategy.id, {
        attempts: 0,
        successes: 0,
        averageTime: 0
      });
    });
    
    console.log('FallbackStrategies: Initialized with', this.strategies.size, 'fallback strategies');
  }

  private initializeErrorPatterns(): void {
    const patterns: Array<[ErrorType, ErrorPattern]> = [
      ['speech_recognition_failed', {
        type: 'speech_recognition_failed',
        patterns: [/could not recognize/i, /speech not detected/i, /audio input failed/i],
        indicators: ['silence_detected', 'noise_threshold_exceeded', 'recognition_timeout'],
        commonCauses: ['poor audio quality', 'background noise', 'microphone issues'],
        suggestedFixes: ['improve microphone positioning', 'reduce background noise', 'speak more clearly']
      }],
      ['low_confidence_recognition', {
        type: 'low_confidence_recognition',
        patterns: [/low confidence/i, /uncertain recognition/i, /multiple matches/i],
        indicators: ['confidence_below_threshold', 'ambiguous_phonemes'],
        commonCauses: ['unclear speech', 'accent variations', 'similar sounding words'],
        suggestedFixes: ['repeat more clearly', 'use different phrasing', 'confirm interpretation']
      }],
      ['ambiguous_intent', {
        type: 'ambiguous_intent',
        patterns: [/multiple intents/i, /unclear request/i, /ambiguous command/i],
        indicators: ['multiple_intent_matches', 'context_insufficient'],
        commonCauses: ['vague commands', 'missing context', 'complex requests'],
        suggestedFixes: ['be more specific', 'break down complex requests', 'provide context']
      }],
      ['network_failure', {
        type: 'network_failure',
        patterns: [/network error/i, /connection failed/i, /timeout/i],
        indicators: ['connection_lost', 'api_timeout', 'service_unreachable'],
        commonCauses: ['internet connectivity', 'server issues', 'network congestion'],
        suggestedFixes: ['check internet connection', 'retry request', 'use offline mode']
      }]
    ];

    patterns.forEach(([type, pattern]) => {
      this.errorPatterns.set(type, pattern);
    });
  }

  public async handleError(context: FallbackContext): Promise<FallbackResult> {
    console.log(`FallbackStrategies: Handling error type ${context.errorType}, attempt ${context.attemptCount}`);
    
    try {
      // Find applicable strategies
      const applicableStrategies = this.findApplicableStrategies(context);
      
      if (applicableStrategies.length === 0) {
        return this.createDefaultFallback(context);
      }

      // Try strategies in priority order
      for (const strategy of applicableStrategies) {
        if (context.previousStrategies.includes(strategy.id)) {
          continue; // Skip already tried strategies
        }

        if (strategy.conditions && !strategy.conditions(context)) {
          continue; // Skip if conditions not met
        }

        try {
          const result = await this.executeStrategy(strategy, context);
          
          // Record usage statistics
          this.updateStrategyStats(strategy.id, result);
          
          // Record in history
          this.fallbackHistory.push({
            context,
            result,
            timestamp: new Date().toISOString()
          });

          if (result.success) {
            console.log(`FallbackStrategies: Strategy ${strategy.id} succeeded with confidence ${result.confidence}`);
            return result;
          }

          // If strategy failed but has fallback chain, try next in chain
          if (strategy.fallbackChain && result.metadata.fallbackLevel < 8) {
            const nextContext = {
              ...context,
              previousStrategies: [...context.previousStrategies, strategy.id],
              attemptCount: context.attemptCount + 1
            };

            for (const nextStrategyId of strategy.fallbackChain) {
              const nextStrategy = this.strategies.get(nextStrategyId);
              if (nextStrategy && !context.previousStrategies.includes(nextStrategyId)) {
                nextContext.errorType = this.inferErrorTypeForStrategy(nextStrategy);
                return await this.handleError(nextContext);
              }
            }
          }

        } catch (error) {
          console.error(`FallbackStrategies: Strategy ${strategy.id} execution failed`, error);
          continue;
        }
      }

      // If all strategies failed, return human handoff
      return await this.executeStrategy(
        this.strategies.get('human_handoff')!,
        context
      );

    } catch (error) {
      console.error('FallbackStrategies: Critical error in handleError', error);
      return this.createEmergencyFallback(context);
    }
  }

  public async recoverFromError(
    originalError: any,
    userInput: string,
    systemContext: any
  ): Promise<FallbackResult> {
    const errorType = this.classifyError(originalError);
    
    const context: FallbackContext = {
      errorType,
      originalInput: userInput,
      confidence: 0,
      attemptCount: 1,
      previousStrategies: [],
      userContext: {
        language: systemContext.language || 'en',
        speakerId: systemContext.speakerId,
        sessionId: systemContext.sessionId || 'unknown',
        location: systemContext.location,
        urgency: systemContext.urgency || 'medium'
      },
      systemState: {
        audioQuality: systemContext.audioQuality || 0.5,
        networkStatus: systemContext.networkStatus || 'online',
        processingLoad: systemContext.processingLoad || 0.5,
        availableServices: systemContext.availableServices || []
      },
      metadata: {
        timestamp: new Date().toISOString(),
        duration: systemContext.duration || 0,
        audioMetadata: systemContext.audioMetadata
      }
    };

    return await this.handleError(context);
  }

  public getStrategyAnalytics(): {
    strategies: Array<{
      id: string;
      name: string;
      attempts: number;
      successRate: number;
      avgProcessingTime: number;
    }>;
    mostEffective: string;
    leastEffective: string;
    totalFallbacks: number;
  } {
    const strategies = Array.from(this.strategies.entries()).map(([id, strategy]) => {
      const stats = this.strategyUsageStats.get(id)!;
      return {
        id,
        name: strategy.name,
        attempts: stats.attempts,
        successRate: stats.attempts > 0 ? stats.successes / stats.attempts : 0,
        avgProcessingTime: stats.averageTime
      };
    });

    const successRates = strategies.map(s => ({ id: s.id, rate: s.successRate }));
    const mostEffective = successRates.reduce((a, b) => a.rate > b.rate ? a : b).id;
    const leastEffective = successRates.reduce((a, b) => a.rate < b.rate ? a : b).id;

    return {
      strategies,
      mostEffective,
      leastEffective,
      totalFallbacks: this.fallbackHistory.length
    };
  }

  // Private helper methods

  private findApplicableStrategies(context: FallbackContext): FallbackStrategy[] {
    return Array.from(this.strategies.values())
      .filter(strategy => 
        strategy.triggers.includes(context.errorType) &&
        context.attemptCount <= strategy.maxAttempts
      )
      .sort((a, b) => a.priority - b.priority);
  }

  private async executeStrategy(strategy: FallbackStrategy, context: FallbackContext): Promise<FallbackResult> {
    const stats = this.strategyUsageStats.get(strategy.id)!;
    stats.attempts++;

    const result = await strategy.execute(context);
    
    if (result.success && strategy.successCriteria(result)) {
      stats.successes++;
    }

    // Update average processing time
    stats.averageTime = (stats.averageTime * (stats.attempts - 1) + result.metadata.processingTime) / stats.attempts;

    return result;
  }

  private updateStrategyStats(strategyId: string, result: FallbackResult): void {
    // Already handled in executeStrategy
  }

  private classifyError(error: any): ErrorType {
    const errorMessage = String(error.message || error).toLowerCase();
    
    if (errorMessage.includes('speech') || errorMessage.includes('recognition')) {
      return 'speech_recognition_failed';
    }
    if (errorMessage.includes('confidence') || errorMessage.includes('uncertain')) {
      return 'low_confidence_recognition';
    }
    if (errorMessage.includes('network') || errorMessage.includes('connection')) {
      return 'network_failure';
    }
    if (errorMessage.includes('timeout') || errorMessage.includes('slow')) {
      return 'timeout_error';
    }
    if (errorMessage.includes('audio') || errorMessage.includes('quality')) {
      return 'audio_quality_poor';
    }
    if (errorMessage.includes('language') || errorMessage.includes('locale')) {
      return 'language_detection_failed';
    }
    if (errorMessage.includes('context') || errorMessage.includes('lost')) {
      return 'context_lost';
    }
    if (errorMessage.includes('auth') || errorMessage.includes('permission')) {
      return 'authentication_failed';
    }
    if (errorMessage.includes('service') || errorMessage.includes('unavailable')) {
      return 'service_unavailable';
    }
    if (errorMessage.includes('overload') || errorMessage.includes('busy')) {
      return 'processing_overload';
    }
    
    return 'system_error';
  }

  private async enhanceAudioQuality(input: string, audioMetadata: any): Promise<{
    processedAudio: string;
    quality: number;
  }> {
    // Mock audio enhancement - in production, use actual DSP libraries
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const baseQuality = audioMetadata?.quality || Math.random() * 0.4 + 0.3;
    const enhancement = Math.random() * 0.3 + 0.2;
    const finalQuality = Math.min(1.0, baseQuality + enhancement);
    
    return {
      processedAudio: input, // In production, would be enhanced audio
      quality: finalQuality
    };
  }

  private async performContextualInference(context: FallbackContext): Promise<{
    confidence: number;
    suggestedResponse: string;
    actions: string[];
  }> {
    // Mock contextual inference - in production, use conversation history and NLP
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const restaurantContext = {
      'order': { confidence: 0.8, response: 'It seems you want to place an order. What would you like?', actions: ['show_menu', 'take_order'] },
      'table': { confidence: 0.7, response: 'Are you asking about table availability or service?', actions: ['check_tables', 'call_waiter'] },
      'bill': { confidence: 0.9, response: 'Would you like to see your bill or make a payment?', actions: ['show_bill', 'process_payment'] },
      'help': { confidence: 0.6, response: 'I can help with orders, tables, or general questions. What do you need?', actions: ['show_help', 'call_staff'] }
    };

    const inputLower = context.originalInput.toLowerCase();
    for (const [keyword, inference] of Object.entries(restaurantContext)) {
      if (inputLower.includes(keyword)) {
        return inference;
      }
    }

    return {
      confidence: 0.3,
      suggestedResponse: 'I\'m not sure what you need. Could you please rephrase?',
      actions: ['clarify_request']
    };
  }

  private async retryWithLanguage(input: string, language: 'en' | 'hi' | 'hinglish'): Promise<{
    confidence: number;
    transcription: string;
  }> {
    // Mock language-specific recognition
    await new Promise(resolve => setTimeout(resolve, 400));
    
    const confidence = Math.random() * 0.4 + 0.5;
    return {
      confidence,
      transcription: input // In production, would be re-transcribed
    };
  }

  private getLanguageConfirmation(language: 'en' | 'hi' | 'hinglish', transcription: string): string {
    const confirmations = {
      en: `I understood: "${transcription}". Is this correct?`,
      hi: `मैं समझा: "${transcription}"। क्या यह सही है?`,
      hinglish: `मैं समझा: "${transcription}"। Is this सही है?`
    };
    
    return confirmations[language];
  }

  private generateClarificationPrompt(context: FallbackContext): string {
    const prompts = {
      en: [
        "I didn't catch that clearly. Could you please repeat?",
        "I'm not sure I understood. Could you rephrase that?",
        "Can you say that again more clearly?",
        "I need clarification. What exactly do you need help with?"
      ],
      hi: [
        "मैं यह स्पष्ट रूप से नहीं समझ पाया। कृपया दोहराएं?",
        "मुझे यकीन नहीं है कि मैं समझ गया। कृपया इसे दूसरे तरीके से कहें?",
        "कृपया इसे फिर से साफ-साफ कहें?",
        "मुझे स्पष्टीकरण चाहिए। आपको वास्तव में किस चीज़ में मदद चाहिए?"
      ],
      hinglish: [
        "मैं यह clearly नहीं समझ पाया। Please repeat करें?",
        "मुझे sure नहीं है कि मैं समझा। Please rephrase करें?",
        "Can you say that again more clearly?",
        "मुझे clarification चाहिए। आपको exactly क्या help चाहिए?"
      ]
    };

    const languagePrompts = prompts[context.userContext.language];
    const promptIndex = Math.min(context.attemptCount - 1, languagePrompts.length - 1);
    
    return languagePrompts[promptIndex];
  }

  private async generateContextualSuggestions(context: FallbackContext): Promise<Array<{
    text: string;
    action: string;
    confidence: number;
  }>> {
    // Mock contextual suggestions based on restaurant operations
    const suggestions = [
      { text: 'Place an order', action: 'start_order', confidence: 0.8 },
      { text: 'Check table availability', action: 'check_tables', confidence: 0.7 },
      { text: 'Call for service', action: 'call_waiter', confidence: 0.9 },
      { text: 'View menu', action: 'show_menu', confidence: 0.6 },
      { text: 'Ask about bill', action: 'show_bill', confidence: 0.5 }
    ];

    // In production, this would analyze context to provide relevant suggestions
    return suggestions.slice(0, 3);
  }

  private formatSuggestionMenu(suggestions: Array<{text: string; action: string}>, language: 'en' | 'hi' | 'hinglish'): string {
    const headers = {
      en: "Here are some things I can help with:",
      hi: "यहाँ कुछ चीज़ें हैं जिनमें मैं मदद कर सकता हूँ:",
      hinglish: "यहाँ कुछ चीज़ें हैं जिनमें मैं help कर सकता हूँ:"
    };

    const header = headers[language];
    const suggestionList = suggestions.map((s, i) => `${i + 1}. ${s.text}`).join('\n');
    
    return `${header}\n${suggestionList}`;
  }

  private async processOfflineRequest(context: FallbackContext): Promise<{
    found: boolean;
    confidence: number;
    response: string;
    actions: string[];
  }> {
    // Mock offline processing with cached responses
    const offlineResponses = {
      'menu': { response: 'Here are our popular items: Pizza, Burger, Pasta', actions: ['show_cached_menu'] },
      'hours': { response: 'We are open daily from 10 AM to 10 PM', actions: ['show_hours'] },
      'location': { response: 'We are located at 123 Main Street', actions: ['show_map'] },
      'contact': { response: 'You can call us at (555) 123-4567', actions: ['show_contact'] }
    };

    const inputLower = context.originalInput.toLowerCase();
    for (const [keyword, cachedResponse] of Object.entries(offlineResponses)) {
      if (inputLower.includes(keyword)) {
        return {
          found: true,
          confidence: 0.8,
          response: cachedResponse.response,
          actions: cachedResponse.actions
        };
      }
    }

    return {
      found: false,
      confidence: 0.1,
      response: 'This information is not available offline. Please check your connection.',
      actions: ['check_connection']
    };
  }

  private activateSimplifiedMode(context: FallbackContext): {
    message: string;
    availableCommands: string[];
  } {
    const messages = {
      en: 'Switching to simple mode. Use basic commands like: order, menu, bill, help',
      hi: 'सरल मोड में बदल रहे हैं। बुनियादी कमांड का इस्तेमाल करें जैसे: ऑर्डर, मेनू, बिल, मदद',
      hinglish: 'Simple mode में switch कर रहे हैं। Basic commands use करें जैसे: order, menu, bill, help'
    };

    return {
      message: messages[context.userContext.language],
      availableCommands: ['order', 'menu', 'bill', 'help', 'call_staff']
    };
  }

  private getTextInputPrompt(language: 'en' | 'hi' | 'hinglish'): string {
    const prompts = {
      en: 'Voice recognition is having trouble. Would you like to type your request instead?',
      hi: 'वॉयस रिकग्निशन में समस्या हो रही है। क्या आप अपना अनुरोध टाइप करना चाहेंगे?',
      hinglish: 'Voice recognition में problem हो रही है। क्या आप अपना request type करना चाहेंगे?'
    };

    return prompts[language];
  }

  private prepareHandoffMessage(context: FallbackContext): string {
    const messages = {
      en: 'I\'m having trouble helping you right now. Let me connect you with a staff member.',
      hi: 'मुझे अभी आपकी मदद करने में कठिनाई हो रही है। मैं आपको एक स्टाफ मेंबर से जोड़ता हूँ।',
      hinglish: 'मुझे अभी आपकी help करने में difficulty हो रही है। Let me connect you with staff member.'
    };

    return messages[context.userContext.language];
  }

  private createDefaultFallback(context: FallbackContext): FallbackResult {
    return {
      success: false,
      confidence: 0.1,
      response: 'I apologize, but I\'m unable to help right now. Please try again or contact staff.',
      requiresHumanIntervention: true,
      metadata: {
        strategyUsed: 'default_fallback',
        processingTime: 0,
        fallbackLevel: 99
      }
    };
  }

  private createEmergencyFallback(context: FallbackContext): FallbackResult {
    return {
      success: true,
      confidence: 1.0,
      response: 'System error occurred. Connecting you with staff immediately.',
      suggestedActions: ['emergency_staff_alert', 'create_incident_report'],
      requiresHumanIntervention: true,
      metadata: {
        strategyUsed: 'emergency_fallback',
        processingTime: 0,
        fallbackLevel: 100
      }
    };
  }

  private inferErrorTypeForStrategy(strategy: FallbackStrategy): ErrorType {
    return strategy.triggers[0] || 'system_error';
  }

  public getFallbackHistory(limit: number = 20): Array<{
    context: FallbackContext;
    result: FallbackResult;
    timestamp: string;
  }> {
    return this.fallbackHistory.slice(-limit);
  }

  public shutdown(): void {
    this.strategies.clear();
    this.errorPatterns.clear();
    this.fallbackHistory = [];
    this.strategyUsageStats.clear();
    console.log('FallbackStrategies: Shutdown complete');
  }
}