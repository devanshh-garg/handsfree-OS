import { getMLProcessor } from './MLProcessor';
import { getHinglishTokenizer } from './HinglishTokenizer';
import { getEntityExtractor } from './EntityExtractor';
import { getContextManager } from './ContextManager';
import { getAgentOrchestrator } from '../agents/AgentOrchestrator';
import { VoiceCommand, VoiceAction } from '@/types';

interface EnhancedVoiceCommand extends VoiceCommand {
  nlpAnalysis: NLPAnalysis;
  contextId: string;
  agentRecommendations?: AgentRecommendation[];
  multiTurnContext?: MultiTurnContext;
}

interface NLPAnalysis {
  tokenization: any;
  intentClassification: any;
  entityExtraction: any;
  languageDetection: {
    primary: 'hindi' | 'english' | 'mixed';
    confidence: number;
    dialectVariant?: string;
  };
  sentimentAnalysis?: {
    sentiment: 'positive' | 'negative' | 'neutral';
    confidence: number;
    emotionalTone?: string[];
  };
}

interface AgentRecommendation {
  agentType: string;
  capability: string;
  data: any;
  priority: 'low' | 'medium' | 'high' | 'critical';
  reasoning: string;
}

interface MultiTurnContext {
  isFollowup: boolean;
  previousCommands: string[];
  expectedResponse?: string;
  clarificationNeeded?: boolean;
  processType?: string;
}

export class EnhancedVoiceProcessor {
  private mlProcessor = getMLProcessor();
  private tokenizer = getHinglishTokenizer();
  private entityExtractor = getEntityExtractor();
  private contextManager = getContextManager();
  private agentOrchestrator = getAgentOrchestrator();
  
  private isInitialized = false;
  private activeContexts: Map<string, string> = new Map(); // sessionId -> contextId

  constructor() {
    this.setupEventListeners();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Initialize all NLP components
      await Promise.all([
        this.mlProcessor.initialize(),
        this.agentOrchestrator.initialize()
      ]);

      this.isInitialized = true;
      console.log('Enhanced Voice Processor initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Enhanced Voice Processor:', error);
      throw error;
    }
  }

  async processVoiceCommand(
    transcript: string, 
    confidence: number, 
    sessionId: string = 'default',
    userId?: string
  ): Promise<EnhancedVoiceCommand> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();

    try {
      // Get or create conversation context
      let contextId = this.activeContexts.get(sessionId);
      if (!contextId) {
        const context = this.contextManager.createContext(sessionId, userId);
        contextId = context.conversationId;
        this.activeContexts.set(sessionId, contextId);
      }

      // Phase 1: Advanced Tokenization and Language Analysis
      const tokenizationResult = this.tokenizer.tokenize(transcript);
      
      // Phase 2: Intent Classification with Context
      const context = this.contextManager.getContext(contextId);
      const intentClassification = await this.mlProcessor.classifyIntent(transcript, context);
      
      // Phase 3: Entity Extraction with Context Awareness
      const entities = await this.entityExtractor.extractEntities(transcript, {
        previousEntities: context?.entityMemory.currentEntities,
        conversationContext: context
      });

      // Phase 4: Language and Sentiment Analysis
      const languageAnalysis = this.performLanguageAnalysis(tokenizationResult);
      const sentimentAnalysis = this.performSentimentAnalysis(transcript, entities);

      // Phase 5: Context Management
      this.contextManager.addIntentTurn(contextId, intentClassification.intent, intentClassification.confidence, entities);
      
      // Phase 6: Multi-turn Conversation Handling
      const multiTurnContext = this.analyzeMultiTurnContext(contextId, intentClassification, entities);
      
      // Phase 7: Agent Recommendations
      const agentRecommendations = await this.generateAgentRecommendations(intentClassification, entities, context);

      // Phase 8: Generate Enhanced Voice Command
      const enhancedCommand: EnhancedVoiceCommand = {
        id: `enhanced_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        command: transcript,
        language: languageAnalysis.primary,
        confidence,
        timestamp: new Date(),
        action: this.convertToVoiceAction(intentClassification),
        parameters: this.extractActionParameters(entities),
        success: true,
        response: await this.generateIntelligentResponse(intentClassification, entities, context),
        
        // Enhanced fields
        nlpAnalysis: {
          tokenization: tokenizationResult,
          intentClassification,
          entityExtraction: entities,
          languageDetection: languageAnalysis,
          sentimentAnalysis
        },
        contextId,
        agentRecommendations,
        multiTurnContext
      };

      // Phase 9: Execute Agent Tasks (if needed)
      await this.executeAgentTasks(agentRecommendations);

      // Phase 10: Update Performance Metrics
      this.updateProcessingMetrics(Date.now() - startTime, enhancedCommand);

      return enhancedCommand;

    } catch (error) {
      console.error('Error in enhanced voice processing:', error);
      
      // Fallback to basic processing
      return this.createFallbackCommand(transcript, confidence, sessionId, error);
    }
  }

  private performLanguageAnalysis(tokenizationResult: any): NLPAnalysis['languageDetection'] {
    const stats = this.tokenizer.getTokenizationStats(tokenizationResult);
    const total = stats.totalTokens;
    
    let primary: 'hindi' | 'english' | 'mixed';
    let confidence: number;
    
    if (stats.mixedTokens > total * 0.3) {
      primary = 'mixed';
      confidence = stats.mixedTokens / total;
    } else if (stats.hindiTokens > stats.englishTokens) {
      primary = 'hindi';
      confidence = stats.hindiTokens / total;
    } else {
      primary = 'english';
      confidence = stats.englishTokens / total;
    }

    // Detect dialect variant
    const dialectVariant = this.tokenizer.identifyDialect(tokenizationResult.tokens);

    return {
      primary,
      confidence: Math.min(confidence * 1.2, 1.0), // Boost confidence slightly
      dialectVariant: dialectVariant !== 'standard' ? dialectVariant : undefined
    };
  }

  private performSentimentAnalysis(transcript: string, entities: any[]): NLPAnalysis['sentimentAnalysis'] {
    // Simple rule-based sentiment analysis
    const positiveWords = ['good', 'great', 'excellent', 'perfect', 'amazing', 'अच्छा', 'बहुत बढ़िया', 'perfect'];
    const negativeWords = ['bad', 'terrible', 'awful', 'slow', 'cold', 'बुरा', 'खराब', 'गलत', 'problem'];
    const neutralWords = ['okay', 'fine', 'normal', 'ठीक', 'सामान्य'];

    const lowerTranscript = transcript.toLowerCase();
    
    let positiveScore = 0;
    let negativeScore = 0;
    let neutralScore = 0;

    positiveWords.forEach(word => {
      if (lowerTranscript.includes(word)) positiveScore++;
    });

    negativeWords.forEach(word => {
      if (lowerTranscript.includes(word)) negativeScore++;
    });

    neutralWords.forEach(word => {
      if (lowerTranscript.includes(word)) neutralScore++;
    });

    // Determine overall sentiment
    let sentiment: 'positive' | 'negative' | 'neutral';
    let confidence: number;

    if (positiveScore > negativeScore && positiveScore > neutralScore) {
      sentiment = 'positive';
      confidence = positiveScore / (positiveScore + negativeScore + neutralScore + 1);
    } else if (negativeScore > positiveScore && negativeScore > neutralScore) {
      sentiment = 'negative';
      confidence = negativeScore / (positiveScore + negativeScore + neutralScore + 1);
    } else {
      sentiment = 'neutral';
      confidence = 0.6;
    }

    // Detect emotional tone
    const emotionalTones: string[] = [];
    if (lowerTranscript.includes('urgent') || lowerTranscript.includes('जल्दी')) {
      emotionalTones.push('urgent');
    }
    if (lowerTranscript.includes('please') || lowerTranscript.includes('कृपया')) {
      emotionalTones.push('polite');
    }
    if (lowerTranscript.includes('sorry') || lowerTranscript.includes('माफ़')) {
      emotionalTones.push('apologetic');
    }

    return {
      sentiment,
      confidence,
      emotionalTone: emotionalTones.length > 0 ? emotionalTones : undefined
    };
  }

  private analyzeMultiTurnContext(contextId: string, intentClassification: any, entities: any[]): MultiTurnContext {
    const context = this.contextManager.getContext(contextId);
    if (!context) {
      return { isFollowup: false, previousCommands: [] };
    }

    const recentIntents = context.intentHistory.slice(-3).map(turn => turn.intent);
    const isFollowup = recentIntents.length > 1 && this.isRelatedIntent(recentIntents);

    // Check if clarification is needed
    const clarificationNeeded = intentClassification.confidence < 0.7 || 
                               entities.length === 0 && this.requiresEntities(intentClassification.intent);

    // Determine if we're in a multi-step process
    const multiStepProcess = context.conversationState.multiStepProcess;

    return {
      isFollowup,
      previousCommands: context.intentHistory.slice(-3).map(turn => turn.intent),
      clarificationNeeded,
      processType: multiStepProcess?.processType,
      expectedResponse: this.getExpectedResponse(context, intentClassification)
    };
  }

  private isRelatedIntent(intents: string[]): boolean {
    const relatedGroups = [
      ['order_management', 'table_management'],
      ['inventory_query', 'analytics_query'],
      ['customer_service', 'staff_coordination']
    ];

    return relatedGroups.some(group => 
      intents.every(intent => group.includes(intent))
    );
  }

  private requiresEntities(intent: string): boolean {
    const entityRequiredIntents = ['order_management', 'table_management', 'inventory_query'];
    return entityRequiredIntents.includes(intent);
  }

  private getExpectedResponse(context: any, intentClassification: any): string | undefined {
    if (context.conversationState.multiStepProcess) {
      const process = context.conversationState.multiStepProcess;
      return `Expected: ${process.nextExpectedInput.join(' or ')}`;
    }

    if (intentClassification.confidence < 0.7) {
      return 'Please clarify your request';
    }

    return undefined;
  }

  private async generateAgentRecommendations(
    intentClassification: any, 
    entities: any[], 
    context: any
  ): Promise<AgentRecommendation[]> {
    const recommendations: AgentRecommendation[] = [];

    // Order optimization recommendations
    if (intentClassification.intent === 'order_management') {
      recommendations.push({
        agentType: 'order-optimizer',
        capability: 'order_batching',
        data: { 
          orders: context?.restaurantContext?.pendingOrders || [],
          kitchenStatus: context?.restaurantContext?.kitchenStatus || 'available'
        },
        priority: 'medium',
        reasoning: 'Order-related command detected, optimizing kitchen workflow'
      });
    }

    // Inventory predictions
    if (intentClassification.intent === 'inventory_query' || 
        entities.some(e => e.type === 'menu_item')) {
      recommendations.push({
        agentType: 'inventory-predictor',
        capability: 'stock_prediction',
        data: {
          requestedItems: entities.filter(e => e.type === 'menu_item').map(e => e.normalizedValue)
        },
        priority: 'high',
        reasoning: 'Inventory query detected, checking stock levels'
      });
    }

    // Customer satisfaction monitoring
    if (intentClassification.intent === 'customer_service' ||
        entities.some(e => e.type === 'person' && e.normalizedValue.includes('customer'))) {
      recommendations.push({
        agentType: 'customer-satisfaction',
        capability: 'service_monitoring',
        data: {
          tableId: entities.find(e => e.type === 'table')?.normalizedValue,
          issueType: intentClassification.intent
        },
        priority: 'high',
        reasoning: 'Customer service issue detected, monitoring satisfaction'
      });
    }

    return recommendations;
  }

  private async executeAgentTasks(recommendations: AgentRecommendation[]): Promise<void> {
    // Execute high-priority recommendations immediately
    const highPriorityTasks = recommendations.filter(r => r.priority === 'high' || r.priority === 'critical');
    
    const taskPromises = highPriorityTasks.map(async (rec) => {
      try {
        const taskId = await this.agentOrchestrator.assignTask(rec.capability, rec.data, rec.priority);
        console.log(`Assigned ${rec.capability} task to ${rec.agentType}: ${taskId}`);
        return taskId;
      } catch (error) {
        console.warn(`Failed to assign task to ${rec.agentType}:`, error);
        return null;
      }
    });

    await Promise.allSettled(taskPromises);
  }

  private convertToVoiceAction(intentClassification: any): VoiceAction {
    // Convert ML intent classification to VoiceAction format
    const [type, subtype] = intentClassification.intent.split('_');
    
    return {
      type: type as any,
      subtype: subtype || 'default'
    };
  }

  private extractActionParameters(entities: any[]): Record<string, any> {
    const parameters: Record<string, any> = {};

    entities.forEach(entity => {
      switch (entity.type) {
        case 'table':
          parameters.tableNumber = parseInt(entity.normalizedValue);
          break;
        case 'menu_item':
          parameters.itemName = entity.normalizedValue;
          if (entity.alternatives) {
            parameters.itemAlternatives = entity.alternatives;
          }
          break;
        case 'quantity':
          parameters.quantity = parseInt(entity.normalizedValue);
          break;
        case 'modifier':
          if (!parameters.modifiers) parameters.modifiers = [];
          parameters.modifiers.push(entity.normalizedValue);
          break;
        case 'time':
          parameters.timeReference = entity.normalizedValue;
          break;
        case 'person':
          parameters.personReference = entity.normalizedValue;
          break;
        case 'currency':
          parameters.amount = parseFloat(entity.normalizedValue);
          break;
        case 'status':
          parameters.statusUpdate = entity.normalizedValue;
          break;
      }
    });

    return parameters;
  }

  private async generateIntelligentResponse(
    intentClassification: any, 
    entities: any[], 
    context: any
  ): Promise<string> {
    const intent = intentClassification.intent;
    const confidence = intentClassification.confidence;
    
    // Use context to generate more intelligent responses
    const userPrefs = context?.userPreferences || { preferredLanguage: 'mixed', responseStyle: 'friendly' };
    
    // Generate context-aware responses
    if (confidence < 0.7) {
      return this.generateClarificationResponse(intent, entities, userPrefs);
    }

    return this.generateConfidentResponse(intent, entities, context, userPrefs);
  }

  private generateClarificationResponse(intent: string, entities: any[], userPrefs: any): string {
    const clarificationTemplates = {
      hindi: {
        table_missing: 'कौन सा टेबल? कृपया टेबल नंबर बताएं।',
        item_missing: 'कौन सा आइटम? मेनू से कुछ चुनें।',
        general: 'कृपया अपनी बात और स्पष्ट करें।'
      },
      english: {
        table_missing: 'Which table? Please specify the table number.',
        item_missing: 'Which item? Please choose from the menu.',
        general: 'Could you please clarify your request?'
      },
      mixed: {
        table_missing: 'कौन सा table? Please specify table number.',
        item_missing: 'Which item चाहिए? Menu से choose करें।',
        general: 'कृपया clarify करें - what do you need?'
      }
    };

    const templates = clarificationTemplates[userPrefs.preferredLanguage] || clarificationTemplates.mixed;
    
    if (intent.includes('table') && !entities.find(e => e.type === 'table')) {
      return templates.table_missing;
    }
    
    if (intent.includes('order') && !entities.find(e => e.type === 'menu_item')) {
      return templates.item_missing;
    }
    
    return templates.general;
  }

  private generateConfidentResponse(intent: string, entities: any[], context: any, userPrefs: any): string {
    const responseTemplates = {
      order_management: {
        hindi: 'आपका आर्डर प्रोसेस कर दिया गया है।',
        english: 'Your order has been processed.',
        mixed: 'आपका order process हो गया है।'
      },
      table_management: {
        hindi: 'टेबल की स्थिति अपडेट कर दी गई है।',
        english: 'Table status has been updated.',
        mixed: 'Table status update कर दिया है।'
      },
      inventory_query: {
        hindi: 'स्टॉक की जानकारी मिल गई है।',
        english: 'Stock information retrieved.',
        mixed: 'Stock information मिल गई है।'
      }
    };

    const templates = responseTemplates[intent as keyof typeof responseTemplates];
    if (templates) {
      return templates[userPrefs.preferredLanguage] || templates.mixed;
    }

    return userPrefs.preferredLanguage === 'hindi' ? 
           'कमांड पूरी हो गई है।' : 
           'Command completed successfully.';
  }

  private createFallbackCommand(transcript: string, confidence: number, sessionId: string, error: any): EnhancedVoiceCommand {
    return {
      id: `fallback_${Date.now()}`,
      command: transcript,
      language: 'mixed',
      confidence: confidence * 0.5, // Reduce confidence for fallback
      timestamp: new Date(),
      action: { type: 'query', subtype: 'unknown' },
      parameters: {},
      success: false,
      response: 'Sorry, I could not process your request. Please try again.',
      
      nlpAnalysis: {
        tokenization: null,
        intentClassification: null,
        entityExtraction: null,
        languageDetection: { primary: 'mixed', confidence: 0.5 }
      },
      contextId: sessionId,
      multiTurnContext: { isFollowup: false, previousCommands: [] }
    };
  }

  private updateProcessingMetrics(processingTime: number, command: EnhancedVoiceCommand): void {
    // Log performance metrics for monitoring
    console.log(`Enhanced Voice Processing: ${processingTime}ms, Confidence: ${command.confidence}, Intent: ${command.nlpAnalysis.intentClassification?.intent}`);
  }

  private setupEventListeners(): void {
    // Listen to agent task completions
    this.agentOrchestrator.on('task_result', (agentId: string, result: any) => {
      console.log(`Agent ${agentId} completed task:`, result.success ? 'Success' : 'Failed');
    });
  }

  // Public utility methods
  async getProcessingStats(): Promise<{
    totalProcessed: number;
    averageProcessingTime: number;
    accuracyRate: number;
    activeContexts: number;
  }> {
    const agentStatus = this.agentOrchestrator.getAgentStatus();
    const contextStats = this.contextManager.getContextStats();
    
    return {
      totalProcessed: Object.values(agentStatus).reduce((sum, agent) => sum + agent.tasksCompleted, 0),
      averageProcessingTime: Object.values(agentStatus).reduce((sum, agent) => sum + agent.averageResponseTime, 0) / Object.keys(agentStatus).length,
      accuracyRate: Object.values(agentStatus).reduce((sum, agent) => sum + agent.successRate, 0) / Object.keys(agentStatus).length,
      activeContexts: contextStats.totalContexts
    };
  }

  async shutdown(): Promise<void> {
    await this.agentOrchestrator.shutdown();
    this.activeContexts.clear();
    this.isInitialized = false;
    console.log('Enhanced Voice Processor shutdown complete');
  }
}

// Singleton instance
let enhancedVoiceProcessor: EnhancedVoiceProcessor | null = null;

export function getEnhancedVoiceProcessor(): EnhancedVoiceProcessor {
  if (!enhancedVoiceProcessor) {
    enhancedVoiceProcessor = new EnhancedVoiceProcessor();
  }
  return enhancedVoiceProcessor;
}

export type { EnhancedVoiceCommand, NLPAnalysis, AgentRecommendation, MultiTurnContext };