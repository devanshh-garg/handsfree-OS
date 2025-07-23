import { ExtractedEntity } from './EntityExtractor';

interface ConversationContext {
  conversationId: string;
  sessionId: string;
  userId?: string;
  startTime: Date;
  lastActivity: Date;
  turnCount: number;
  
  // Intent history and patterns
  intentHistory: IntentTurn[];
  currentTopic?: string;
  topicStack: string[];
  
  // Entity memory
  entityMemory: EntityMemory;
  
  // Restaurant-specific context
  restaurantContext: RestaurantContext;
  
  // Conversation state
  conversationState: ConversationState;
  
  // Preferences and personalization
  userPreferences: UserPreferences;
}

interface IntentTurn {
  turnNumber: number;
  timestamp: Date;
  intent: string;
  confidence: number;
  entities: ExtractedEntity[];
  fulfilled: boolean;
  requiresFollowup: boolean;
}

interface EntityMemory {
  // Short-term memory (current conversation)
  currentEntities: Map<string, ExtractedEntity[]>;
  
  // Medium-term memory (current session)
  sessionEntities: Map<string, ExtractedEntity[]>;
  
  // Long-term memory (across sessions)
  persistentEntities: Map<string, ExtractedEntity[]>;
  
  // Entity relationships
  entityRelations: Map<string, string[]>;
}

interface RestaurantContext {
  currentShift: 'morning' | 'afternoon' | 'evening' | 'night';
  busyLevel: 'low' | 'medium' | 'high' | 'peak';
  activeStaff: string[];
  occupiedTables: number[];
  pendingOrders: string[];
  kitchenStatus: 'available' | 'busy' | 'overwhelmed';
  inventoryAlerts: string[];
}

interface ConversationState {
  waitingForConfirmation: boolean;
  confirmationContext?: any;
  multiStepProcess?: MultiStepProcess;
  clarificationNeeded?: ClarificationRequest;
  lastSystemResponse?: string;
}

interface MultiStepProcess {
  processType: 'order_taking' | 'table_booking' | 'complaint_handling' | 'inventory_check';
  currentStep: number;
  totalSteps: number;
  collectedData: Map<string, any>;
  nextExpectedInput: string[];
}

interface ClarificationRequest {
  type: 'ambiguous_entity' | 'missing_entity' | 'conflicting_entities' | 'low_confidence';
  message: string;
  options?: string[];
  entity?: ExtractedEntity;
}

interface UserPreferences {
  preferredLanguage: 'hindi' | 'english' | 'mixed';
  responseStyle: 'formal' | 'casual' | 'friendly';
  verbosity: 'brief' | 'normal' | 'detailed';
  personalizedGreeting?: string;
  frequentRequests: string[];
}

export class ContextManager {
  private contexts: Map<string, ConversationContext> = new Map();
  private readonly MAX_CONTEXTS = 100;
  private readonly CONTEXT_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  private readonly MAX_ENTITY_AGE = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    // Cleanup old contexts periodically
    setInterval(() => this.cleanupOldContexts(), 5 * 60 * 1000); // Every 5 minutes
  }

  // Context lifecycle management
  createContext(sessionId: string, userId?: string): ConversationContext {
    const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const context: ConversationContext = {
      conversationId,
      sessionId,
      userId,
      startTime: new Date(),
      lastActivity: new Date(),
      turnCount: 0,
      
      intentHistory: [],
      topicStack: [],
      
      entityMemory: {
        currentEntities: new Map(),
        sessionEntities: new Map(),
        persistentEntities: new Map(),
        entityRelations: new Map()
      },
      
      restaurantContext: this.getRestaurantContext(),
      
      conversationState: {
        waitingForConfirmation: false
      },
      
      userPreferences: this.getDefaultPreferences()
    };
    
    this.contexts.set(conversationId, context);
    this.pruneContextsIfNeeded();
    
    return context;
  }

  getContext(conversationId: string): ConversationContext | null {
    const context = this.contexts.get(conversationId);
    if (context) {
      context.lastActivity = new Date();
      return context;
    }
    return null;
  }

  updateContext(conversationId: string, update: Partial<ConversationContext>): void {
    const context = this.contexts.get(conversationId);
    if (context) {
      Object.assign(context, update);
      context.lastActivity = new Date();
    }
  }

  // Intent and turn management
  addIntentTurn(conversationId: string, intent: string, confidence: number, entities: ExtractedEntity[]): void {
    const context = this.getContext(conversationId);
    if (!context) return;
    
    context.turnCount++;
    
    const turn: IntentTurn = {
      turnNumber: context.turnCount,
      timestamp: new Date(),
      intent,
      confidence,
      entities,
      fulfilled: false,
      requiresFollowup: this.requiresFollowup(intent, entities)
    };
    
    context.intentHistory.push(turn);
    
    // Update topic tracking
    this.updateTopicTracking(context, intent);
    
    // Update entity memory
    this.updateEntityMemory(context, entities);
    
    // Keep only recent intent history
    if (context.intentHistory.length > 20) {
      context.intentHistory = context.intentHistory.slice(-20);
    }
  }

  private updateTopicTracking(context: ConversationContext, intent: string): void {
    const topicMap: { [key: string]: string } = {
      'order_management': 'orders',
      'table_management': 'tables', 
      'inventory_query': 'inventory',
      'analytics_query': 'analytics',
      'customer_service': 'service',
      'staff_coordination': 'staff'
    };
    
    const newTopic = topicMap[intent];
    if (newTopic && newTopic !== context.currentTopic) {
      if (context.currentTopic) {
        context.topicStack.push(context.currentTopic);
      }
      context.currentTopic = newTopic;
      
      // Keep topic stack manageable
      if (context.topicStack.length > 5) {
        context.topicStack = context.topicStack.slice(-5);
      }
    }
  }

  private updateEntityMemory(context: ConversationContext, entities: ExtractedEntity[]): void {
    const memory = context.entityMemory;
    
    entities.forEach(entity => {
      const entityType = entity.type;
      
      // Add to current entities
      if (!memory.currentEntities.has(entityType)) {
        memory.currentEntities.set(entityType, []);
      }
      memory.currentEntities.get(entityType)!.push(entity);
      
      // Add to session entities
      if (!memory.sessionEntities.has(entityType)) {
        memory.sessionEntities.set(entityType, []);
      }
      memory.sessionEntities.get(entityType)!.push(entity);
      
      // Keep only recent entities in current memory
      const currentList = memory.currentEntities.get(entityType)!;
      if (currentList.length > 10) {
        memory.currentEntities.set(entityType, currentList.slice(-10));
      }
    });
    
    // Build entity relationships
    this.buildEntityRelationships(context, entities);
  }

  private buildEntityRelationships(context: ConversationContext, entities: ExtractedEntity[]): void {
    const relations = context.entityMemory.entityRelations;
    
    // Create relationships between co-occurring entities
    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const entity1 = entities[i];
        const entity2 = entities[j];
        
        const key1 = `${entity1.type}:${entity1.normalizedValue}`;
        const key2 = `${entity2.type}:${entity2.normalizedValue}`;
        
        // Add bidirectional relationships
        if (!relations.has(key1)) relations.set(key1, []);
        if (!relations.has(key2)) relations.set(key2, []);
        
        relations.get(key1)!.push(key2);
        relations.get(key2)!.push(key1);
      }
    }
  }

  // Entity resolution and inference
  resolveEntity(conversationId: string, entityType: string, partialValue?: string): ExtractedEntity | null {
    const context = this.getContext(conversationId);
    if (!context) return null;
    
    const memory = context.entityMemory;
    
    // First check current entities
    const currentEntities = memory.currentEntities.get(entityType) || [];
    if (partialValue) {
      const match = currentEntities.find(e => 
        e.normalizedValue.includes(partialValue.toLowerCase()) ||
        e.value.toLowerCase().includes(partialValue.toLowerCase())
      );
      if (match) return match;
    } else if (currentEntities.length > 0) {
      return currentEntities[currentEntities.length - 1]; // Most recent
    }
    
    // Then check session entities
    const sessionEntities = memory.sessionEntities.get(entityType) || [];
    if (partialValue) {
      const match = sessionEntities.find(e => 
        e.normalizedValue.includes(partialValue.toLowerCase())
      );
      if (match) return match;
    } else if (sessionEntities.length > 0) {
      return sessionEntities[sessionEntities.length - 1];
    }
    
    return null;
  }

  inferMissingEntities(conversationId: string, requiredEntities: string[]): ExtractedEntity[] {
    const context = this.getContext(conversationId);
    if (!context) return [];
    
    const inferred: ExtractedEntity[] = [];
    
    for (const entityType of requiredEntities) {
      const resolved = this.resolveEntity(conversationId, entityType);
      if (resolved) {
        // Reduce confidence for inferred entities
        inferred.push({
          ...resolved,
          confidence: resolved.confidence * 0.7
        });
      }
    }
    
    return inferred;
  }

  // Multi-step process management
  startMultiStepProcess(conversationId: string, processType: MultiStepProcess['processType']): void {
    const context = this.getContext(conversationId);
    if (!context) return;
    
    const processSteps: { [key: string]: { steps: number, expectedInputs: string[][] } } = {
      'order_taking': {
        steps: 4,
        expectedInputs: [
          ['table', 'customer'],
          ['menu_item', 'quantity'],
          ['modifier', 'special_instructions'],
          ['confirmation']
        ]
      },
      'table_booking': {
        steps: 3,
        expectedInputs: [
          ['person', 'quantity'],
          ['time'],
          ['confirmation']
        ]
      },
      'complaint_handling': {
        steps: 3,
        expectedInputs: [
          ['table', 'issue_description'],
          ['action_required'],
          ['resolution_confirmation']
        ]
      },
      'inventory_check': {
        steps: 2,
        expectedInputs: [
          ['menu_item', 'ingredient'],
          ['status_update']
        ]
      }
    };
    
    const processConfig = processSteps[processType];
    if (!processConfig) return;
    
    context.conversationState.multiStepProcess = {
      processType,
      currentStep: 1,
      totalSteps: processConfig.steps,
      collectedData: new Map(),
      nextExpectedInput: processConfig.expectedInputs[0]
    };
  }

  advanceMultiStepProcess(conversationId: string, collectedData: Map<string, any>): boolean {
    const context = this.getContext(conversationId);
    if (!context || !context.conversationState.multiStepProcess) return false;
    
    const process = context.conversationState.multiStepProcess;
    
    // Merge collected data
    collectedData.forEach((value, key) => {
      process.collectedData.set(key, value);
    });
    
    process.currentStep++;
    
    if (process.currentStep > process.totalSteps) {
      // Process complete
      context.conversationState.multiStepProcess = undefined;
      return true;
    }
    
    // Update expected input for next step
    const processSteps: { [key: string]: string[][] } = {
      'order_taking': [['table', 'customer'], ['menu_item', 'quantity'], ['modifier'], ['confirmation']],
      'table_booking': [['person', 'quantity'], ['time'], ['confirmation']],
      'complaint_handling': [['table', 'issue'], ['action'], ['confirmation']],
      'inventory_check': [['menu_item'], ['status']]
    };
    
    const expectedInputs = processSteps[process.processType];
    if (expectedInputs && process.currentStep - 1 < expectedInputs.length) {
      process.nextExpectedInput = expectedInputs[process.currentStep - 1];
    }
    
    return false;
  }

  // Clarification management
  requestClarification(conversationId: string, request: ClarificationRequest): void {
    const context = this.getContext(conversationId);
    if (!context) return;
    
    context.conversationState.clarificationNeeded = request;
  }

  resolveClarification(conversationId: string, resolution: any): void {
    const context = this.getContext(conversationId);
    if (!context) return;
    
    context.conversationState.clarificationNeeded = undefined;
    // Process resolution...
  }

  // Context analysis and insights
  getConversationInsights(conversationId: string): {
    dominantTopics: string[];
    frequentEntities: { type: string; value: string; count: number }[];
    conversationFlow: string[];
    userEngagement: 'high' | 'medium' | 'low';
    preferredLanguage: string;
  } {
    const context = this.getContext(conversationId);
    if (!context) {
      return {
        dominantTopics: [],
        frequentEntities: [],
        conversationFlow: [],
        userEngagement: 'low',
        preferredLanguage: 'english'
      };
    }
    
    // Analyze dominant topics
    const topicCounts = new Map<string, number>();
    context.intentHistory.forEach(turn => {
      const topic = this.getTopicFromIntent(turn.intent);
      topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
    });
    
    const dominantTopics = Array.from(topicCounts.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([topic]) => topic);
    
    // Analyze frequent entities
    const entityCounts = new Map<string, number>();
    context.entityMemory.currentEntities.forEach((entities, type) => {
      entities.forEach(entity => {
        const key = `${type}:${entity.normalizedValue}`;
        entityCounts.set(key, (entityCounts.get(key) || 0) + 1);
      });
    });
    
    const frequentEntities = Array.from(entityCounts.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([key, count]) => {
        const [type, value] = key.split(':');
        return { type, value, count };
      });
    
    // Determine user engagement
    const avgConfidence = context.intentHistory.reduce((sum, turn) => sum + turn.confidence, 0) / context.intentHistory.length;
    const engagementScore = (context.turnCount / 10) + (avgConfidence * 2);
    const userEngagement = engagementScore > 1.5 ? 'high' : engagementScore > 0.8 ? 'medium' : 'low';
    
    return {
      dominantTopics,
      frequentEntities,
      conversationFlow: context.topicStack.concat(context.currentTopic || []),
      userEngagement,
      preferredLanguage: context.userPreferences.preferredLanguage
    };
  }

  // Utility methods
  private requiresFollowup(intent: string, entities: ExtractedEntity[]): boolean {
    const followupIntents = ['order_management', 'table_booking', 'complaint_handling'];
    return followupIntents.includes(intent) && entities.length < 2; // Needs more information
  }

  private getTopicFromIntent(intent: string): string {
    const intentTopicMap: { [key: string]: string } = {
      'order_management': 'orders',
      'table_management': 'tables',
      'inventory_query': 'inventory',
      'analytics_query': 'analytics',
      'customer_service': 'service',
      'staff_coordination': 'staff'
    };
    
    return intentTopicMap[intent] || 'general';
  }

  private getRestaurantContext(): RestaurantContext {
    const hour = new Date().getHours();
    let currentShift: RestaurantContext['currentShift'];
    
    if (hour < 11) currentShift = 'morning';
    else if (hour < 16) currentShift = 'afternoon';
    else if (hour < 21) currentShift = 'evening';
    else currentShift = 'night';
    
    return {
      currentShift,
      busyLevel: 'medium', // Would be dynamic in real app
      activeStaff: ['राम', 'श्याम', 'गीता'],
      occupiedTables: [1, 3, 5, 7],
      pendingOrders: [],
      kitchenStatus: 'available',
      inventoryAlerts: []
    };
  }

  private getDefaultPreferences(): UserPreferences {
    return {
      preferredLanguage: 'mixed',
      responseStyle: 'friendly',
      verbosity: 'normal',
      frequentRequests: []
    };
  }

  private cleanupOldContexts(): void {
    const now = Date.now();
    const contextsToDelete: string[] = [];
    
    this.contexts.forEach((context, id) => {
      if (now - context.lastActivity.getTime() > this.CONTEXT_TIMEOUT) {
        contextsToDelete.push(id);
      }
    });
    
    contextsToDelete.forEach(id => this.contexts.delete(id));
  }

  private pruneContextsIfNeeded(): void {
    if (this.contexts.size > this.MAX_CONTEXTS) {
      // Remove oldest contexts
      const sortedContexts = Array.from(this.contexts.entries())
        .sort(([,a], [,b]) => a.lastActivity.getTime() - b.lastActivity.getTime());
      
      const toRemove = sortedContexts.slice(0, this.contexts.size - this.MAX_CONTEXTS);
      toRemove.forEach(([id]) => this.contexts.delete(id));
    }
  }

  // Public API methods
  getActiveContexts(): string[] {
    return Array.from(this.contexts.keys());
  }

  getContextStats(): {
    totalContexts: number;
    averageTurns: number;
    mostActiveContext: string | null;
  } {
    const contexts = Array.from(this.contexts.values());
    
    return {
      totalContexts: contexts.length,
      averageTurns: contexts.reduce((sum, c) => sum + c.turnCount, 0) / contexts.length,
      mostActiveContext: contexts.sort((a, b) => b.turnCount - a.turnCount)[0]?.conversationId || null
    };
  }
}

// Singleton instance
let contextManager: ContextManager | null = null;

export function getContextManager(): ContextManager {
  if (!contextManager) {
    contextManager = new ContextManager();
  }
  return contextManager;
}

export type { 
  ConversationContext, 
  IntentTurn, 
  EntityMemory, 
  RestaurantContext,
  MultiStepProcess,
  ClarificationRequest,
  UserPreferences
};