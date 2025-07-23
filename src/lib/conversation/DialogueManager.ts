'use client';

interface ConversationState {
  id: string;
  userId?: string;
  sessionId: string;
  currentContext: string;
  intent: string;
  entities: { [key: string]: any };
  conversationHistory: ConversationTurn[];
  metadata: {
    startTime: string;
    lastActivity: string;
    language: 'en' | 'hi' | 'hinglish';
    customerType?: 'new' | 'returning' | 'vip';
    urgency: 'low' | 'medium' | 'high' | 'critical';
  };
  contextStack: ConversationContext[];
  flags: {
    needsHumanHandoff: boolean;
    repeatCount: number;
    clarificationNeeded: boolean;
    emotionalState: 'positive' | 'neutral' | 'negative' | 'frustrated';
    lastSuccessfulTask?: string;
  };
}

interface ConversationTurn {
  id: string;
  timestamp: string;
  speaker: 'user' | 'assistant';
  content: string;
  intent?: string;
  entities?: any[];
  confidence: number;
  context: string;
  audioMetadata?: {
    duration: number;
    quality: number;
    emotion?: string;
    speakerId?: string;
  };
}

interface ConversationContext {
  name: string;
  type: 'task' | 'clarification' | 'error_recovery' | 'handoff' | 'emergency';
  data: { [key: string]: any };
  priority: number;
  expiresAt?: string;
  parentContext?: string;
}

interface DialogueFlow {
  id: string;
  name: string;
  type: 'linear' | 'branching' | 'adaptive';
  steps: DialogueStep[];
  conditions?: { [key: string]: any };
  fallbackStrategies: string[];
}

interface DialogueStep {
  id: string;
  name: string;
  prompt: string;
  expectedInputs: string[];
  validation?: (input: string, context: ConversationState) => boolean;
  nextSteps: { [condition: string]: string };
  retryLimit: number;
  timeout?: number;
  required: boolean;
}

interface FlowTransition {
  fromContext: string;
  toContext: string;
  condition: string;
  action?: (state: ConversationState) => Promise<void>;
  priority: number;
}

export class DialogueManager {
  private static instance: DialogueManager;
  
  private conversations: Map<string, ConversationState> = new Map();
  private dialogueFlows: Map<string, DialogueFlow> = new Map();
  private transitions: FlowTransition[] = [];
  private contextHandlers: Map<string, (state: ConversationState, input: string) => Promise<any>> = new Map();
  
  // Restaurant-specific conversation flows
  private restaurantFlows: DialogueFlow[] = [
    {
      id: 'order_taking',
      name: 'Order Taking Process',
      type: 'branching',
      steps: [
        {
          id: 'greet_customer',
          name: 'Customer Greeting',
          prompt: 'Welcome! How can I help you today?',
          expectedInputs: ['order', 'menu', 'question', 'complaint'],
          nextSteps: {
            'order': 'collect_order_details',
            'menu': 'provide_menu_info',
            'question': 'handle_inquiry',
            'complaint': 'escalate_complaint'
          },
          retryLimit: 2,
          required: true
        },
        {
          id: 'collect_order_details',
          name: 'Order Collection',
          prompt: 'What would you like to order?',
          expectedInputs: ['food_item', 'drink', 'quantity', 'special_request'],
          nextSteps: {
            'complete': 'confirm_order',
            'incomplete': 'ask_for_more',
            'unclear': 'clarify_order'
          },
          retryLimit: 3,
          required: true
        },
        {
          id: 'confirm_order',
          name: 'Order Confirmation',
          prompt: 'Let me confirm your order...',
          expectedInputs: ['confirm', 'modify', 'cancel'],
          nextSteps: {
            'confirm': 'process_payment',
            'modify': 'collect_order_details',
            'cancel': 'order_cancelled'
          },
          retryLimit: 2,
          required: true
        }
      ],
      conditions: { customerType: 'any' },
      fallbackStrategies: ['human_handoff', 'order_form_fallback']
    },
    {
      id: 'table_service',
      name: 'Table Service Management',
      type: 'adaptive',
      steps: [
        {
          id: 'identify_table',
          name: 'Table Identification',
          prompt: 'Which table needs assistance?',
          expectedInputs: ['table_number', 'table_description'],
          nextSteps: {
            'identified': 'service_request',
            'unclear': 'clarify_table'
          },
          retryLimit: 2,
          required: true
        },
        {
          id: 'service_request',
          name: 'Service Request Details',
          prompt: 'What does the table need?',
          expectedInputs: ['water', 'menu', 'bill', 'complaint', 'special_request'],
          nextSteps: {
            'water': 'dispatch_water',
            'menu': 'bring_menu',
            'bill': 'process_bill',
            'complaint': 'handle_complaint'
          },
          retryLimit: 2,
          required: true
        }
      ],
      conditions: { context: 'service' },
      fallbackStrategies: ['manager_notification', 'service_fallback']
    },
    {
      id: 'inventory_check',
      name: 'Inventory Management',
      type: 'linear',
      steps: [
        {
          id: 'identify_item',
          name: 'Item Identification',
          prompt: 'Which item do you want to check?',
          expectedInputs: ['ingredient', 'dish', 'category'],
          nextSteps: { 'any': 'check_availability' },
          retryLimit: 2,
          required: true
        },
        {
          id: 'check_availability',
          name: 'Availability Check',
          prompt: 'Checking inventory...',
          expectedInputs: ['continue'],
          nextSteps: { 'any': 'report_status' },
          retryLimit: 1,
          required: false
        }
      ],
      conditions: { role: 'staff' },
      fallbackStrategies: ['manual_check', 'inventory_system_fallback']
    }
  ];

  private constructor() {
    this.initializeFlows();
    this.setupContextHandlers();
    this.initializeTransitions();
  }

  public static getInstance(): DialogueManager {
    if (!DialogueManager.instance) {
      DialogueManager.instance = new DialogueManager();
    }
    return DialogueManager.instance;
  }

  private initializeFlows(): void {
    this.restaurantFlows.forEach(flow => {
      this.dialogueFlows.set(flow.id, flow);
    });
    
    console.log('DialogueManager: Initialized with', this.dialogueFlows.size, 'dialogue flows');
  }

  private setupContextHandlers(): void {
    // Order taking context handler
    this.contextHandlers.set('order_taking', async (state: ConversationState, input: string) => {
      const orderData = this.extractOrderInformation(input);
      
      if (orderData.items.length > 0) {
        state.entities.currentOrder = {
          ...state.entities.currentOrder,
          items: [...(state.entities.currentOrder?.items || []), ...orderData.items]
        };
        
        return {
          response: `Added ${orderData.items.length} items to your order. Anything else?`,
          nextAction: 'continue_order',
          confidence: 0.9
        };
      }
      
      return {
        response: "I didn't catch that. Could you repeat your order?",
        nextAction: 'retry_input',
        confidence: 0.3
      };
    });

    // Table service context handler
    this.contextHandlers.set('table_service', async (state: ConversationState, input: string) => {
      const serviceRequest = this.parseServiceRequest(input);
      
      if (serviceRequest.table && serviceRequest.request) {
        state.entities.serviceRequest = serviceRequest;
        
        return {
          response: `Got it. Table ${serviceRequest.table} needs ${serviceRequest.request}. I'll notify the staff.`,
          nextAction: 'dispatch_service',
          confidence: 0.95
        };
      }
      
      return {
        response: "Could you specify which table and what they need?",
        nextAction: 'clarify_service',
        confidence: 0.4
      };
    });

    // Emergency context handler
    this.contextHandlers.set('emergency', async (state: ConversationState, input: string) => {
      const emergencyType = this.classifyEmergency(input);
      
      state.metadata.urgency = 'critical';
      state.flags.needsHumanHandoff = true;
      
      return {
        response: `Emergency protocol activated for ${emergencyType}. Alerting management immediately.`,
        nextAction: 'emergency_escalation',
        confidence: 1.0
      };
    });
  }

  private initializeTransitions(): void {
    this.transitions = [
      {
        fromContext: 'greeting',
        toContext: 'order_taking',
        condition: 'order_intent',
        priority: 1,
        action: async (state) => {
          await this.startFlow(state.sessionId, 'order_taking');
        }
      },
      {
        fromContext: 'order_taking',
        toContext: 'table_service',
        condition: 'service_request',
        priority: 2,
        action: async (state) => {
          await this.pushContext(state.sessionId, 'table_service', { preserveOrder: true });
        }
      },
      {
        fromContext: 'any',
        toContext: 'emergency',
        condition: 'emergency_detected',
        priority: 10,
        action: async (state) => {
          await this.forceContext(state.sessionId, 'emergency');
        }
      }
    ];
  }

  public async startConversation(sessionId: string, userId?: string, language: 'en' | 'hi' | 'hinglish' = 'en'): Promise<ConversationState> {
    const conversation: ConversationState = {
      id: `conv_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      userId,
      sessionId,
      currentContext: 'greeting',
      intent: 'initial',
      entities: {},
      conversationHistory: [],
      metadata: {
        startTime: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        language,
        urgency: 'low'
      },
      contextStack: [{
        name: 'greeting',
        type: 'task',
        data: {},
        priority: 1
      }],
      flags: {
        needsHumanHandoff: false,
        repeatCount: 0,
        clarificationNeeded: false,
        emotionalState: 'neutral'
      }
    };

    this.conversations.set(sessionId, conversation);
    
    // Start with greeting
    const greeting = this.generateGreeting(language);
    await this.addTurn(sessionId, 'assistant', greeting, 'greeting', [], 0.95);
    
    console.log(`DialogueManager: Started conversation ${conversation.id} for session ${sessionId}`);
    return conversation;
  }

  public async processInput(
    sessionId: string, 
    input: string, 
    audioMetadata?: any
  ): Promise<{
    response: string;
    context: string;
    confidence: number;
    actions: string[];
    needsHandoff: boolean;
  }> {
    const conversation = this.conversations.get(sessionId);
    if (!conversation) {
      throw new Error(`No conversation found for session ${sessionId}`);
    }

    try {
      // Update activity timestamp
      conversation.metadata.lastActivity = new Date().toISOString();
      
      // Analyze input for intent and entities
      const analysis = await this.analyzeInput(input, conversation);
      
      // Add user turn to history
      await this.addTurn(sessionId, 'user', input, conversation.currentContext, analysis.entities, analysis.confidence, audioMetadata);
      
      // Check for context transitions
      const transitionResult = await this.checkTransitions(conversation, analysis);
      if (transitionResult) {
        conversation.currentContext = transitionResult.newContext;
      }
      
      // Process input in current context
      const contextHandler = this.contextHandlers.get(conversation.currentContext);
      let result;
      
      if (contextHandler) {
        result = await contextHandler(conversation, input);
      } else {
        result = await this.handleGenericInput(conversation, input, analysis);
      }
      
      // Handle special actions
      const actions = await this.processActions(conversation, result.nextAction);
      
      // Add response turn
      await this.addTurn(sessionId, 'assistant', result.response, conversation.currentContext, [], result.confidence);
      
      // Update conversation flags
      this.updateConversationFlags(conversation, analysis, result);
      
      return {
        response: result.response,
        context: conversation.currentContext,
        confidence: result.confidence,
        actions,
        needsHandoff: conversation.flags.needsHumanHandoff
      };
      
    } catch (error) {
      console.error('DialogueManager: Error processing input', error);
      
      // Fallback response
      const fallbackResponse = this.generateFallbackResponse(conversation.metadata.language);
      await this.addTurn(sessionId, 'assistant', fallbackResponse, 'error', [], 0.1);
      
      return {
        response: fallbackResponse,
        context: 'error',
        confidence: 0.1,
        actions: ['error_recovery'],
        needsHandoff: true
      };
    }
  }

  public async switchContext(sessionId: string, newContext: string, data?: any): Promise<boolean> {
    const conversation = this.conversations.get(sessionId);
    if (!conversation) return false;

    // Save current context to stack
    if (conversation.currentContext !== newContext) {
      conversation.contextStack.push({
        name: conversation.currentContext,
        type: 'task',
        data: conversation.entities,
        priority: conversation.contextStack.length + 1
      });
    }

    // Switch to new context
    conversation.currentContext = newContext;
    if (data) {
      conversation.entities = { ...conversation.entities, ...data };
    }

    console.log(`DialogueManager: Switched to context ${newContext} for session ${sessionId}`);
    return true;
  }

  public async recoverConversation(sessionId: string, strategy: 'previous_context' | 'restart_flow' | 'human_handoff' = 'previous_context'): Promise<string> {
    const conversation = this.conversations.get(sessionId);
    if (!conversation) {
      return "I'm sorry, I can't recover this conversation. Please start again.";
    }

    switch (strategy) {
      case 'previous_context':
        if (conversation.contextStack.length > 1) {
          const previousContext = conversation.contextStack.pop();
          if (previousContext) {
            conversation.currentContext = previousContext.name;
            conversation.entities = { ...conversation.entities, ...previousContext.data };
            return `Let me go back to where we were. We were ${previousContext.name}.`;
          }
        }
        return "Let me restart our conversation. How can I help you?";

      case 'restart_flow':
        const currentFlow = this.dialogueFlows.get(conversation.currentContext);
        if (currentFlow && currentFlow.steps.length > 0) {
          const firstStep = currentFlow.steps[0];
          return `Let me start over. ${firstStep.prompt}`;
        }
        return "Let me restart. How can I help you today?";

      case 'human_handoff':
        conversation.flags.needsHumanHandoff = true;
        return "Let me connect you with a staff member who can better assist you.";

      default:
        return "I apologize for the confusion. How can I help you?";
    }
  }

  public getConversationHistory(sessionId: string, limit: number = 10): ConversationTurn[] {
    const conversation = this.conversations.get(sessionId);
    if (!conversation) return [];
    
    return conversation.conversationHistory.slice(-limit);
  }

  public getConversationState(sessionId: string): ConversationState | null {
    return this.conversations.get(sessionId) || null;
  }

  public async endConversation(sessionId: string, reason: string = 'user_ended'): Promise<void> {
    const conversation = this.conversations.get(sessionId);
    if (!conversation) return;

    // Log conversation end
    await this.addTurn(sessionId, 'assistant', 'Thank you for using our service!', 'closing', [], 1.0);
    
    // Archive conversation (in production, save to database)
    console.log(`DialogueManager: Ended conversation ${conversation.id}, reason: ${reason}`);
    
    // Remove from active conversations
    this.conversations.delete(sessionId);
  }

  // Private helper methods

  private async addTurn(
    sessionId: string, 
    speaker: 'user' | 'assistant', 
    content: string, 
    context: string, 
    entities: any[] = [], 
    confidence: number = 1.0,
    audioMetadata?: any
  ): Promise<void> {
    const conversation = this.conversations.get(sessionId);
    if (!conversation) return;

    const turn: ConversationTurn = {
      id: `turn_${Date.now()}_${Math.random().toString(36).substr(2, 3)}`,
      timestamp: new Date().toISOString(),
      speaker,
      content,
      entities,
      confidence,
      context,
      audioMetadata
    };

    conversation.conversationHistory.push(turn);
    
    // Keep history manageable
    if (conversation.conversationHistory.length > 50) {
      conversation.conversationHistory = conversation.conversationHistory.slice(-40);
    }
  }

  private async analyzeInput(input: string, conversation: ConversationState): Promise<{
    intent: string;
    entities: any[];
    confidence: number;
    sentiment: string;
  }> {
    // Mock NLP analysis - in production, integrate with real NLP service
    const lowerInput = input.toLowerCase();
    
    let intent = 'unknown';
    let confidence = 0.7;
    const entities: any[] = [];
    let sentiment = 'neutral';

    // Intent detection
    if (lowerInput.includes('order') || lowerInput.includes('want') || lowerInput.includes('get')) {
      intent = 'order_request';
      confidence = 0.9;
    } else if (lowerInput.includes('table') || lowerInput.includes('service')) {
      intent = 'service_request';
      confidence = 0.85;
    } else if (lowerInput.includes('emergency') || lowerInput.includes('help') || lowerInput.includes('urgent')) {
      intent = 'emergency';
      confidence = 0.95;
    } else if (lowerInput.includes('complaint') || lowerInput.includes('problem') || lowerInput.includes('wrong')) {
      intent = 'complaint';
      sentiment = 'negative';
      confidence = 0.8;
    }

    // Entity extraction
    const tableMatch = input.match(/table\s+(\d+)/i);
    if (tableMatch) {
      entities.push({ type: 'table_number', value: parseInt(tableMatch[1]) });
    }

    const foodItems = ['pizza', 'burger', 'pasta', 'salad', 'drink', 'water', 'coffee'];
    foodItems.forEach(item => {
      if (lowerInput.includes(item)) {
        entities.push({ type: 'food_item', value: item });
      }
    });

    return { intent, entities, confidence, sentiment };
  }

  private async checkTransitions(conversation: ConversationState, analysis: any): Promise<{ newContext: string } | null> {
    for (const transition of this.transitions) {
      if (transition.fromContext === 'any' || transition.fromContext === conversation.currentContext) {
        if (this.evaluateTransitionCondition(transition.condition, analysis, conversation)) {
          if (transition.action) {
            await transition.action(conversation);
          }
          return { newContext: transition.toContext };
        }
      }
    }
    return null;
  }

  private evaluateTransitionCondition(condition: string, analysis: any, conversation: ConversationState): boolean {
    switch (condition) {
      case 'order_intent':
        return analysis.intent === 'order_request';
      case 'service_request':
        return analysis.intent === 'service_request';
      case 'emergency_detected':
        return analysis.intent === 'emergency';
      default:
        return false;
    }
  }

  private async handleGenericInput(conversation: ConversationState, input: string, analysis: any): Promise<any> {
    // Default handler for contexts without specific handlers
    if (analysis.confidence < 0.5) {
      conversation.flags.clarificationNeeded = true;
      return {
        response: "I'm not sure I understood that. Could you please rephrase?",
        nextAction: 'clarification_needed',
        confidence: 0.3
      };
    }

    return {
      response: "I understand. How else can I help you?",
      nextAction: 'continue_conversation',
      confidence: 0.7
    };
  }

  private async processActions(conversation: ConversationState, action: string): Promise<string[]> {
    const actions: string[] = [];
    
    switch (action) {
      case 'dispatch_service':
        actions.push('notify_staff', 'log_service_request');
        break;
      case 'emergency_escalation':
        actions.push('alert_manager', 'log_emergency', 'activate_protocols');
        break;
      case 'continue_order':
        actions.push('update_order_system');
        break;
      case 'clarification_needed':
        conversation.flags.repeatCount++;
        actions.push('request_clarification');
        break;
    }
    
    return actions;
  }

  private updateConversationFlags(conversation: ConversationState, analysis: any, result: any): void {
    // Update emotional state
    if (analysis.sentiment === 'negative') {
      conversation.flags.emotionalState = conversation.flags.emotionalState === 'negative' ? 'frustrated' : 'negative';
    } else if (analysis.sentiment === 'positive') {
      conversation.flags.emotionalState = 'positive';
    }

    // Check for handoff conditions
    if (conversation.flags.repeatCount > 3 || conversation.flags.emotionalState === 'frustrated') {
      conversation.flags.needsHumanHandoff = true;
    }

    // Update urgency
    if (analysis.intent === 'emergency') {
      conversation.metadata.urgency = 'critical';
    } else if (analysis.intent === 'complaint') {
      conversation.metadata.urgency = 'high';
    }
  }

  private extractOrderInformation(input: string): { items: any[] } {
    const items: any[] = [];
    const lowerInput = input.toLowerCase();
    
    // Simple pattern matching for demo
    const patterns = [
      { pattern: /(\d+)?\s*(pizza|burger|pasta|salad|drink|coffee|water)/g, type: 'food_item' },
      { pattern: /table\s+(\d+)/g, type: 'table_number' }
    ];

    patterns.forEach(({ pattern, type }) => {
      let match;
      while ((match = pattern.exec(lowerInput)) !== null) {
        items.push({
          type,
          value: match[2] || match[1],
          quantity: match[1] ? parseInt(match[1]) : 1
        });
      }
    });

    return { items };
  }

  private parseServiceRequest(input: string): { table?: number; request?: string } {
    const tableMatch = input.match(/table\s+(\d+)/i);
    const table = tableMatch ? parseInt(tableMatch[1]) : undefined;
    
    const requests = ['water', 'menu', 'bill', 'help', 'check'];
    const request = requests.find(r => input.toLowerCase().includes(r));
    
    return { table, request };
  }

  private classifyEmergency(input: string): string {
    const lowerInput = input.toLowerCase();
    
    if (lowerInput.includes('fire')) return 'fire';
    if (lowerInput.includes('medical') || lowerInput.includes('injury')) return 'medical';
    if (lowerInput.includes('security') || lowerInput.includes('fight')) return 'security';
    
    return 'general';
  }

  private generateGreeting(language: 'en' | 'hi' | 'hinglish'): string {
    const greetings = {
      en: "Hello! Welcome to our restaurant. How can I help you today?",
      hi: "नमस्ते! हमारे रेस्टोरेंट में आपका स्वागत है। आज मैं आपकी कैसे मदद कर सकता हूँ?",
      hinglish: "Hello! Welcome to our restaurant. आज मैं आपकी कैसे help कर सकता हूँ?"
    };
    
    return greetings[language];
  }

  private generateFallbackResponse(language: 'en' | 'hi' | 'hinglish'): string {
    const responses = {
      en: "I apologize, but I'm having trouble understanding. Let me connect you with a staff member.",
      hi: "क्षमा करें, मुझे समझने में कठिनाई हो रही है। मैं आपको एक स्टाफ मेंबर से जोड़ता हूँ।",
      hinglish: "Sorry, मुझे समझने में problem हो रही है। Let me connect you with staff."
    };
    
    return responses[language];
  }

  private async startFlow(sessionId: string, flowId: string): Promise<void> {
    const flow = this.dialogueFlows.get(flowId);
    if (!flow) return;
    
    await this.switchContext(sessionId, flowId, { currentStep: 0 });
  }

  private async pushContext(sessionId: string, context: string, options: any = {}): Promise<void> {
    await this.switchContext(sessionId, context, options);
  }

  private async forceContext(sessionId: string, context: string): Promise<void> {
    const conversation = this.conversations.get(sessionId);
    if (!conversation) return;
    
    // Clear context stack and force new context
    conversation.contextStack = [{
      name: context,
      type: 'emergency',
      data: {},
      priority: 999
    }];
    conversation.currentContext = context;
  }

  public shutdown(): void {
    this.conversations.clear();
    this.dialogueFlows.clear();
    this.contextHandlers.clear();
    console.log('DialogueManager: Shutdown complete');
  }
}