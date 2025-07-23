'use client';

interface ProactiveSuggestion {
  id: string;
  type: SuggestionType;
  title: string;
  description: string;
  confidence: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: 'operational' | 'customer_service' | 'efficiency' | 'safety' | 'revenue';
  trigger: string;
  suggestion: string;
  voicePrompt: string;
  actions: SuggestionAction[];
  context: {
    timeframe: string;
    location?: string;
    relevantData: any;
    patterns: string[];
  };
  metadata: {
    createdAt: string;
    expiresAt?: string;
    presentedAt?: string;
    acceptedAt?: string;
    dismissedAt?: string;
    language: 'en' | 'hi' | 'hinglish';
  };
  status: 'pending' | 'presented' | 'accepted' | 'dismissed' | 'expired';
}

interface SuggestionAction {
  id: string;
  type: 'voice_command' | 'system_action' | 'notification' | 'workflow';
  description: string;
  command?: string;
  parameters?: any;
  estimatedTime?: number;
}

interface ContextualPattern {
  id: string;
  name: string;
  description: string;
  conditions: PatternCondition[];
  suggestionTemplate: Partial<ProactiveSuggestion>;
  learningWeight: number;
  successRate: number;
  usage: {
    timesTriggered: number;
    timesAccepted: number;
    timesEffective: number;
  };
}

interface PatternCondition {
  type: 'time' | 'frequency' | 'sequence' | 'threshold' | 'context' | 'trend' | 'pattern';
  field: string;
  operator: 'gt' | 'lt' | 'eq' | 'contains' | 'pattern' | 'trend';
  value: any;
  weight: number;
}

interface OperationalInsight {
  type: 'peak_hours' | 'slow_period' | 'item_popularity' | 'table_turnover' | 'staff_efficiency';
  data: any;
  timestamp: string;
  confidence: number;
}

type SuggestionType = 
  | 'order_optimization'
  | 'table_management'
  | 'inventory_alert'
  | 'staff_scheduling'
  | 'customer_satisfaction'
  | 'revenue_opportunity'
  | 'efficiency_improvement'
  | 'maintenance_reminder'
  | 'training_suggestion'
  | 'safety_alert';

export class ProactiveAssistance {
  private static instance: ProactiveAssistance;
  
  private activeSuggestions: Map<string, ProactiveSuggestion> = new Map();
  private suggestionHistory: ProactiveSuggestion[] = [];
  private contextualPatterns: Map<string, ContextualPattern> = new Map();
  private operationalInsights: OperationalInsight[] = [];
  private learningData: Map<string, any> = new Map();
  private isActive: boolean = true;
  
  // Pattern definitions for restaurant operations
  private defaultPatterns: ContextualPattern[] = [
    {
      id: 'rush_hour_prep',
      name: 'Rush Hour Preparation',
      description: 'Suggest preparation activities before peak hours',
      conditions: [
        { type: 'time', field: 'hour', operator: 'eq', value: 11, weight: 0.8 },
        { type: 'context', field: 'day_type', operator: 'eq', value: 'weekday', weight: 0.6 }
      ],
      suggestionTemplate: {
        type: 'operational' as any,
        title: 'Rush Hour Preparation',
        category: 'efficiency',
        priority: 'high',
        voicePrompt: 'Lunch rush is approaching. Would you like me to help prepare?'
      },
      learningWeight: 1.0,
      successRate: 0.85,
      usage: { timesTriggered: 0, timesAccepted: 0, timesEffective: 0 }
    },
    {
      id: 'table_turnover_optimization',
      name: 'Table Turnover Optimization',
      description: 'Suggest faster table turnover during busy periods',
      conditions: [
        { type: 'threshold', field: 'occupied_table_percentage', operator: 'gt', value: 0.8, weight: 0.9 },
        { type: 'frequency', field: 'wait_time_avg', operator: 'gt', value: 15, weight: 0.7 }
      ],
      suggestionTemplate: {
        type: 'table_management',
        title: 'Optimize Table Turnover',
        category: 'efficiency',
        priority: 'high',
        voicePrompt: 'Tables are filling up. I can help optimize turnover times.'
      },
      learningWeight: 1.2,
      successRate: 0.78,
      usage: { timesTriggered: 0, timesAccepted: 0, timesEffective: 0 }
    },
    {
      id: 'inventory_prediction',
      name: 'Inventory Prediction Alert',
      description: 'Predict and alert about potential stock shortages',
      conditions: [
        { type: 'trend', field: 'item_consumption_rate', operator: 'gt', value: 0.7, weight: 0.85 },
        { type: 'threshold', field: 'current_stock_level', operator: 'lt', value: 0.3, weight: 0.9 }
      ],
      suggestionTemplate: {
        type: 'inventory_alert',
        title: 'Potential Stock Shortage',
        category: 'operational',
        priority: 'medium',
        voicePrompt: 'Based on current usage, we might run low on some items soon.'
      },
      learningWeight: 1.1,
      successRate: 0.82,
      usage: { timesTriggered: 0, timesAccepted: 0, timesEffective: 0 }
    },
    {
      id: 'customer_satisfaction_followup',
      name: 'Customer Satisfaction Follow-up',
      description: 'Suggest follow-up actions for customer satisfaction',
      conditions: [
        { type: 'sequence', field: 'recent_complaints', operator: 'gt', value: 2, weight: 0.8 },
        { type: 'time', field: 'since_last_followup', operator: 'gt', value: 30, weight: 0.6 }
      ],
      suggestionTemplate: {
        type: 'customer_satisfaction',
        title: 'Customer Follow-up Needed',
        category: 'customer_service',
        priority: 'medium',
        voicePrompt: 'I noticed some customer concerns. Should we follow up?'
      },
      learningWeight: 0.9,
      successRate: 0.73,
      usage: { timesTriggered: 0, timesAccepted: 0, timesEffective: 0 }
    },
    {
      id: 'upselling_opportunity',
      name: 'Upselling Opportunity',
      description: 'Suggest upselling opportunities based on order patterns',
      conditions: [
        { type: 'pattern', field: 'order_composition', operator: 'contains', value: 'main_without_drink', weight: 0.7 },
        { type: 'context', field: 'table_spending_pattern', operator: 'eq', value: 'medium_high', weight: 0.6 }
      ],
      suggestionTemplate: {
        type: 'revenue_opportunity',
        title: 'Upselling Opportunity',
        category: 'revenue',
        priority: 'low',
        voicePrompt: 'I see an opportunity to suggest additional items to customers.'
      },
      learningWeight: 0.8,
      successRate: 0.65,
      usage: { timesTriggered: 0, timesAccepted: 0, timesEffective: 0 }
    },
    {
      id: 'staff_efficiency_alert',
      name: 'Staff Efficiency Alert',
      description: 'Alert about potential staff efficiency issues',
      conditions: [
        { type: 'threshold', field: 'average_service_time', operator: 'gt', value: 20, weight: 0.8 },
        { type: 'frequency', field: 'customer_wait_complaints', operator: 'gt', value: 3, weight: 0.7 }
      ],
      suggestionTemplate: {
        type: 'staff_scheduling',
        title: 'Staff Efficiency Review',
        category: 'efficiency',
        priority: 'medium',
        voicePrompt: 'Service times are increasing. Would you like to review staff assignments?'
      },
      learningWeight: 1.0,
      successRate: 0.71,
      usage: { timesTriggered: 0, timesAccepted: 0, timesEffective: 0 }
    },
    {
      id: 'maintenance_reminder',
      name: 'Equipment Maintenance Reminder',
      description: 'Remind about scheduled maintenance or potential issues',
      conditions: [
        { type: 'time', field: 'days_since_maintenance', operator: 'gt', value: 30, weight: 0.9 },
        { type: 'frequency', field: 'equipment_issues', operator: 'gt', value: 1, weight: 0.6 }
      ],
      suggestionTemplate: {
        type: 'maintenance_reminder',
        title: 'Maintenance Due',
        category: 'operational',
        priority: 'medium',
        voicePrompt: 'Some equipment might need maintenance attention.'
      },
      learningWeight: 0.7,
      successRate: 0.88,
      usage: { timesTriggered: 0, timesAccepted: 0, timesEffective: 0 }
    }
  ];

  private constructor() {
    this.initializePatterns();
    this.startPeriodicAnalysis();
  }

  public static getInstance(): ProactiveAssistance {
    if (!ProactiveAssistance.instance) {
      ProactiveAssistance.instance = new ProactiveAssistance();
    }
    return ProactiveAssistance.instance;
  }

  private initializePatterns(): void {
    this.defaultPatterns.forEach(pattern => {
      this.contextualPatterns.set(pattern.id, pattern);
    });
    
    console.log('ProactiveAssistance: Initialized with', this.contextualPatterns.size, 'contextual patterns');
  }

  private startPeriodicAnalysis(): void {
    // Run analysis every 5 minutes
    setInterval(() => {
      if (this.isActive) {
        this.analyzeAndSuggest();
      }
    }, 5 * 60 * 1000);
    
    // Initial analysis after 30 seconds
    setTimeout(() => {
      if (this.isActive) {
        this.analyzeAndSuggest();
      }
    }, 30000);
  }

  public async analyzeAndSuggest(context?: any): Promise<ProactiveSuggestion[]> {
    if (!this.isActive) return [];

    try {
      // Gather current operational context
      const operationalContext = await this.gatherOperationalContext(context);
      
      // Analyze patterns and generate suggestions
      const newSuggestions: ProactiveSuggestion[] = [];
      
      for (const [patternId, pattern] of this.contextualPatterns.entries()) {
        const matchScore = this.evaluatePatternMatch(pattern, operationalContext);
        
        if (matchScore > 0.7) {
          const suggestion = await this.generateSuggestion(pattern, operationalContext, matchScore);
          
          if (suggestion && !this.isDuplicateSuggestion(suggestion)) {
            newSuggestions.push(suggestion);
            this.activeSuggestions.set(suggestion.id, suggestion);
            pattern.usage.timesTriggered++;
          }
        }
      }

      // Sort by priority and confidence
      newSuggestions.sort((a, b) => {
        const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
        const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
        
        if (priorityDiff !== 0) return priorityDiff;
        return b.confidence - a.confidence;
      });

      // Limit to top 3 suggestions to avoid overwhelming
      const topSuggestions = newSuggestions.slice(0, 3);
      
      if (topSuggestions.length > 0) {
        console.log(`ProactiveAssistance: Generated ${topSuggestions.length} new suggestions`);
      }

      return topSuggestions;
      
    } catch (error) {
      console.error('ProactiveAssistance: Error in analysis', error);
      return [];
    }
  }

  public async presentSuggestion(
    suggestionId: string,
    method: 'voice' | 'visual' | 'both' = 'both'
  ): Promise<{
    success: boolean;
    response?: string;
    actions?: SuggestionAction[];
  }> {
    const suggestion = this.activeSuggestions.get(suggestionId);
    if (!suggestion) {
      return { success: false };
    }

    suggestion.status = 'presented';
    suggestion.metadata.presentedAt = new Date().toISOString();

    const response = this.formatSuggestionForPresentation(suggestion, method);
    
    console.log(`ProactiveAssistance: Presented suggestion ${suggestionId} via ${method}`);
    
    return {
      success: true,
      response,
      actions: suggestion.actions
    };
  }

  public async acceptSuggestion(
    suggestionId: string,
    userFeedback?: string
  ): Promise<{
    success: boolean;
    executedActions: string[];
  }> {
    const suggestion = this.activeSuggestions.get(suggestionId);
    if (!suggestion) {
      return { success: false, executedActions: [] };
    }

    suggestion.status = 'accepted';
    suggestion.metadata.acceptedAt = new Date().toISOString();

    // Execute suggestion actions
    const executedActions: string[] = [];
    
    for (const action of suggestion.actions) {
      try {
        await this.executeSuggestionAction(action);
        executedActions.push(action.description);
      } catch (error) {
        console.error(`ProactiveAssistance: Error executing action ${action.id}`, error);
      }
    }

    // Update pattern success rate
    this.updatePatternLearning(suggestion, true, userFeedback);
    
    // Move to history
    this.suggestionHistory.push(suggestion);
    this.activeSuggestions.delete(suggestionId);

    console.log(`ProactiveAssistance: Accepted suggestion ${suggestionId}, executed ${executedActions.length} actions`);
    
    return {
      success: true,
      executedActions
    };
  }

  public async dismissSuggestion(
    suggestionId: string,
    reason?: string
  ): Promise<boolean> {
    const suggestion = this.activeSuggestions.get(suggestionId);
    if (!suggestion) return false;

    suggestion.status = 'dismissed';
    suggestion.metadata.dismissedAt = new Date().toISOString();

    // Update pattern learning with dismissal feedback
    this.updatePatternLearning(suggestion, false, reason);
    
    // Move to history
    this.suggestionHistory.push(suggestion);
    this.activeSuggestions.delete(suggestionId);

    console.log(`ProactiveAssistance: Dismissed suggestion ${suggestionId}, reason: ${reason || 'none'}`);
    
    return true;
  }

  public getActiveSuggestions(priority?: 'low' | 'medium' | 'high' | 'urgent'): ProactiveSuggestion[] {
    const suggestions = Array.from(this.activeSuggestions.values());
    
    if (priority) {
      return suggestions.filter(s => s.priority === priority);
    }
    
    return suggestions.sort((a, b) => {
      const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  public getSuggestionHistory(limit: number = 20): ProactiveSuggestion[] {
    return this.suggestionHistory
      .slice(-limit)
      .sort((a, b) => new Date(b.metadata.createdAt).getTime() - new Date(a.metadata.createdAt).getTime());
  }

  public getPatternAnalytics(): {
    patterns: { id: string; name: string; successRate: number; usage: any }[];
    effectiveness: number;
    totalSuggestions: number;
    acceptanceRate: number;
  } {
    const patterns = Array.from(this.contextualPatterns.values()).map(p => ({
      id: p.id,
      name: p.name,
      successRate: p.successRate,
      usage: p.usage
    }));
    
    const totalSuggestions = this.suggestionHistory.length;
    const acceptedSuggestions = this.suggestionHistory.filter(s => s.status === 'accepted').length;
    const acceptanceRate = totalSuggestions > 0 ? acceptedSuggestions / totalSuggestions : 0;
    
    const averageSuccessRate = patterns.reduce((sum, p) => sum + p.successRate, 0) / patterns.length;
    
    return {
      patterns,
      effectiveness: averageSuccessRate,
      totalSuggestions,
      acceptanceRate
    };
  }

  public async addCustomPattern(pattern: Omit<ContextualPattern, 'usage'>): Promise<boolean> {
    try {
      const customPattern: ContextualPattern = {
        ...pattern,
        usage: { timesTriggered: 0, timesAccepted: 0, timesEffective: 0 }
      };
      
      this.contextualPatterns.set(pattern.id, customPattern);
      console.log(`ProactiveAssistance: Added custom pattern ${pattern.id}`);
      
      return true;
    } catch (error) {
      console.error('ProactiveAssistance: Error adding custom pattern', error);
      return false;
    }
  }

  // Private helper methods

  private async gatherOperationalContext(additionalContext?: any): Promise<any> {
    // Mock operational context - in production, gather from various systems
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();
    
    return {
      timestamp: now.toISOString(),
      hour,
      day_type: dayOfWeek >= 1 && dayOfWeek <= 5 ? 'weekday' : 'weekend',
      occupied_table_percentage: Math.random() * 0.4 + 0.6, // 60-100%
      wait_time_avg: Math.random() * 20 + 5, // 5-25 minutes
      item_consumption_rate: Math.random() * 0.5 + 0.5, // 50-100%
      current_stock_level: Math.random() * 0.6 + 0.2, // 20-80%
      recent_complaints: Math.floor(Math.random() * 5),
      since_last_followup: Math.random() * 60, // minutes
      order_composition: Math.random() > 0.5 ? 'main_without_drink' : 'complete',
      table_spending_pattern: ['low', 'medium', 'medium_high', 'high'][Math.floor(Math.random() * 4)],
      average_service_time: Math.random() * 15 + 10, // 10-25 minutes
      customer_wait_complaints: Math.floor(Math.random() * 6),
      days_since_maintenance: Math.floor(Math.random() * 45),
      equipment_issues: Math.floor(Math.random() * 3),
      ...additionalContext
    };
  }

  private evaluatePatternMatch(pattern: ContextualPattern, context: any): number {
    let totalScore = 0;
    let totalWeight = 0;

    for (const condition of pattern.conditions) {
      const conditionScore = this.evaluateCondition(condition, context);
      totalScore += conditionScore * condition.weight;
      totalWeight += condition.weight;
    }

    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  private evaluateCondition(condition: PatternCondition, context: any): number {
    const fieldValue = context[condition.field];
    
    if (fieldValue === undefined) return 0;

    switch (condition.operator) {
      case 'gt':
        return fieldValue > condition.value ? 1 : 0;
      case 'lt':
        return fieldValue < condition.value ? 1 : 0;
      case 'eq':
        return fieldValue === condition.value ? 1 : 0;
      case 'contains':
        return String(fieldValue).includes(String(condition.value)) ? 1 : 0;
      case 'pattern':
        return String(fieldValue).match(new RegExp(condition.value)) ? 1 : 0;
      case 'trend':
        // Simplified trend analysis
        return fieldValue > condition.value ? 1 : 0;
      default:
        return 0;
    }
  }

  private async generateSuggestion(
    pattern: ContextualPattern,
    context: any,
    matchScore: number
  ): Promise<ProactiveSuggestion | null> {
    try {
      const suggestion: ProactiveSuggestion = {
        id: `suggestion_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        type: this.determineSuggestionType(pattern, context),
        title: pattern.suggestionTemplate.title || pattern.name,
        description: this.generateDescription(pattern, context),
        confidence: matchScore * pattern.learningWeight,
        priority: pattern.suggestionTemplate.priority || 'medium',
        category: pattern.suggestionTemplate.category || 'operational',
        trigger: pattern.id,
        suggestion: this.generateSpecificSuggestion(pattern, context),
        voicePrompt: this.localizeVoicePrompt(pattern.suggestionTemplate.voicePrompt || '', 'en'),
        actions: this.generateSuggestionActions(pattern, context),
        context: {
          timeframe: this.generateTimeframe(context),
          location: context.location,
          relevantData: this.extractRelevantData(pattern, context),
          patterns: [pattern.id]
        },
        metadata: {
          createdAt: new Date().toISOString(),
          expiresAt: this.calculateExpirationTime(pattern),
          language: 'en'
        },
        status: 'pending'
      };

      return suggestion;
    } catch (error) {
      console.error('ProactiveAssistance: Error generating suggestion', error);
      return null;
    }
  }

  private determineSuggestionType(pattern: ContextualPattern, context: any): SuggestionType {
    // Map pattern types to suggestion types
    const typeMapping: { [key: string]: SuggestionType } = {
      'rush_hour_prep': 'order_optimization',
      'table_turnover_optimization': 'table_management',
      'inventory_prediction': 'inventory_alert',
      'customer_satisfaction_followup': 'customer_satisfaction',
      'upselling_opportunity': 'revenue_opportunity',
      'staff_efficiency_alert': 'staff_scheduling',
      'maintenance_reminder': 'maintenance_reminder'
    };

    return typeMapping[pattern.id] || 'efficiency_improvement';
  }

  private generateDescription(pattern: ContextualPattern, context: any): string {
    const descriptions: { [key: string]: string } = {
      'rush_hour_prep': `Lunch rush approaching at ${new Date().getHours()}:${new Date().getMinutes().toString().padStart(2, '0')}. Prepare stations and check inventory.`,
      'table_turnover_optimization': `${Math.round(context.occupied_table_percentage * 100)}% tables occupied with ${Math.round(context.wait_time_avg)} min average wait.`,
      'inventory_prediction': `Current consumption rate suggests potential shortage in popular items.`,
      'customer_satisfaction_followup': `${context.recent_complaints} recent complaints need follow-up attention.`,
      'upselling_opportunity': `Orders missing complementary items detected. Revenue opportunity identified.`,
      'staff_efficiency_alert': `Average service time: ${Math.round(context.average_service_time)} minutes. Consider staff reallocation.`,
      'maintenance_reminder': `Equipment maintenance overdue by ${context.days_since_maintenance} days.`
    };

    return descriptions[pattern.id] || pattern.description;
  }

  private generateSpecificSuggestion(pattern: ContextualPattern, context: any): string {
    const suggestions: { [key: string]: string } = {
      'rush_hour_prep': 'Pre-prepare popular items, ensure all stations are stocked, and brief staff on expected volume.',
      'table_turnover_optimization': 'Focus on quick service for current tables and consider pre-bussing completed courses.',
      'inventory_prediction': 'Check stock levels for high-consumption items and prepare backup options.',
      'customer_satisfaction_followup': 'Review recent complaints and implement immediate service recovery actions.',
      'upselling_opportunity': 'Train staff to suggest drinks, appetizers, or desserts with main course orders.',
      'staff_efficiency_alert': 'Review current staff assignments and consider redistributing tasks for better efficiency.',
      'maintenance_reminder': 'Schedule maintenance check for overdue equipment to prevent service disruptions.'
    };

    return suggestions[pattern.id] || 'Review current operations and implement improvements.';
  }

  private generateSuggestionActions(pattern: ContextualPattern, context: any): SuggestionAction[] {
    const actionTemplates: { [key: string]: SuggestionAction[] } = {
      'rush_hour_prep': [
        {
          id: 'prep_stations',
          type: 'voice_command',
          description: 'Prepare all cooking stations',
          command: 'prepare all stations for rush hour',
          estimatedTime: 300
        },
        {
          id: 'brief_staff',
          type: 'notification',
          description: 'Brief staff on expected volume',
          estimatedTime: 120
        }
      ],
      'table_turnover_optimization': [
        {
          id: 'expedite_service',
          type: 'system_action',
          description: 'Prioritize table service',
          parameters: { focus: 'quick_turnover' },
          estimatedTime: 180
        }
      ],
      'inventory_prediction': [
        {
          id: 'check_inventory',
          type: 'voice_command',
          description: 'Check inventory levels',
          command: 'check inventory for all high-consumption items',
          estimatedTime: 300
        }
      ]
    };

    return actionTemplates[pattern.id] || [];
  }

  private async executeSuggestionAction(action: SuggestionAction): Promise<void> {
    console.log(`ProactiveAssistance: Executing action ${action.id} - ${action.description}`);
    
    // Mock action execution - in production, integrate with actual systems
    await new Promise(resolve => setTimeout(resolve, 100));
    
    switch (action.type) {
      case 'voice_command':
        // Would integrate with voice command system
        break;
      case 'system_action':
        // Would trigger system operations
        break;
      case 'notification':
        // Would send notifications to staff
        break;
      case 'workflow':
        // Would trigger workflow automation
        break;
    }
  }

  private isDuplicateSuggestion(newSuggestion: ProactiveSuggestion): boolean {
    const activeTypes = Array.from(this.activeSuggestions.values()).map(s => s.type);
    return activeTypes.includes(newSuggestion.type);
  }

  private formatSuggestionForPresentation(suggestion: ProactiveSuggestion, method: 'voice' | 'visual' | 'both'): string {
    if (method === 'voice' || method === 'both') {
      return suggestion.voicePrompt;
    }
    
    return `${suggestion.title}: ${suggestion.description}`;
  }

  private updatePatternLearning(suggestion: ProactiveSuggestion, accepted: boolean, feedback?: string): void {
    const pattern = this.contextualPatterns.get(suggestion.trigger);
    if (!pattern) return;

    if (accepted) {
      pattern.usage.timesAccepted++;
      pattern.successRate = Math.min(1.0, pattern.successRate + 0.05);
    } else {
      pattern.successRate = Math.max(0.1, pattern.successRate - 0.02);
    }

    // Store feedback for future learning
    if (feedback) {
      this.learningData.set(`feedback_${suggestion.id}`, {
        patternId: pattern.id,
        accepted,
        feedback,
        timestamp: new Date().toISOString()
      });
    }
  }

  private generateTimeframe(context: any): string {
    const hour = context.hour;
    
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 22) return 'evening';
    return 'night';
  }

  private extractRelevantData(pattern: ContextualPattern, context: any): any {
    const relevantFields = pattern.conditions.map(c => c.field);
    const relevantData: any = {};
    
    relevantFields.forEach(field => {
      if (context[field] !== undefined) {
        relevantData[field] = context[field];
      }
    });
    
    return relevantData;
  }

  private calculateExpirationTime(pattern: ContextualPattern): string {
    // Most suggestions expire in 1 hour
    const expirationTime = new Date();
    expirationTime.setHours(expirationTime.getHours() + 1);
    return expirationTime.toISOString();
  }

  private localizeVoicePrompt(prompt: string, language: 'en' | 'hi' | 'hinglish'): string {
    // Simple localization - in production, use proper translation service
    if (language === 'hi') {
      const translations: { [key: string]: string } = {
        'Lunch rush is approaching. Would you like me to help prepare?': 'लंच रश आ रहा है। क्या मैं तैयारी में मदद करूं?',
        'Tables are filling up. I can help optimize turnover times.': 'टेबल भर रहे हैं। मैं टर्नओवर समय को अनुकूलित करने में मदद कर सकता हूं।'
      };
      return translations[prompt] || prompt;
    }
    
    if (language === 'hinglish') {
      const translations: { [key: string]: string } = {
        'Lunch rush is approaching. Would you like me to help prepare?': 'Lunch rush आने वाला है। क्या मैं prepare करने में help करूं?',
        'Tables are filling up. I can help optimize turnover times.': 'Tables भर रहे हैं। मैं turnover time optimize करने में help कर सकता।'
      };
      return translations[prompt] || prompt;
    }
    
    return prompt;
  }

  public setActive(active: boolean): void {
    this.isActive = active;
    console.log(`ProactiveAssistance: ${active ? 'Activated' : 'Deactivated'}`);
  }

  public shutdown(): void {
    this.isActive = false;
    this.activeSuggestions.clear();
    this.contextualPatterns.clear();
    this.operationalInsights = [];
    this.suggestionHistory = [];
    this.learningData.clear();
    console.log('ProactiveAssistance: Shutdown complete');
  }
}