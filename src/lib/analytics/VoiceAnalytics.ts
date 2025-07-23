'use client';

interface VoiceInteraction {
  id: string;
  sessionId: string;
  userId?: string;
  timestamp: string;
  type: InteractionType;
  input: {
    transcript: string;
    confidence: number;
    duration: number;
    audioQuality: number;
    language: 'en' | 'hi' | 'hinglish';
    speakerId?: string;
  };
  processing: {
    nlpTime: number;
    responseTime: number;
    modelLatency: number;
    cacheHit: boolean;
    errors?: string[];
  };
  outcome: {
    intent: string;
    confidence: number;
    successful: boolean;
    userSatisfaction?: number;
    fallbackUsed: boolean;
    humanHandoffRequired: boolean;
  };
  context: {
    location?: string;
    timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
    dayOfWeek: string;
    restaurantContext: {
      tableNumber?: number;
      orderStage?: string;
      staffMember?: string;
      rushPeriod: boolean;
    };
  };
  metadata: {
    deviceType?: string;
    browserInfo?: string;
    networkQuality?: number;
    backgroundNoise?: number;
  };
}

interface AnalyticsMetrics {
  usage: {
    totalInteractions: number;
    dailyActiveUsers: number;
    averageSessionDuration: number;
    peakUsageHours: number[];
    interactionsByType: { [key in InteractionType]: number };
    languageDistribution: { [key: string]: number };
  };
  performance: {
    averageResponseTime: number;
    averageConfidence: number;
    successRate: number;
    errorRate: number;
    fallbackRate: number;
    cacheHitRate: number;
    modelPerformance: {
      [modelName: string]: {
        averageLatency: number;
        accuracy: number;
        usage: number;
      };
    };
  };
  quality: {
    averageAudioQuality: number;
    recognitionAccuracy: number;
    userSatisfactionScore: number;
    commonIssues: Array<{
      issue: string;
      frequency: number;
      impact: 'low' | 'medium' | 'high';
    }>;
  };
  restaurant: {
    orderCompletionRate: number;
    averageOrderTime: number;
    customerServiceMetrics: {
      resolutionRate: number;
      escalationRate: number;
      satisfactionScore: number;
    };
    staffEfficiency: {
      responseTime: number;
      taskCompletionRate: number;
      voiceCommandUsage: number;
    };
    operationalInsights: {
      peakOrderTimes: string[];
      commonRequests: Array<{
        request: string;
        frequency: number;
      }>;
      tableUtilization: number;
    };
  };
}

interface AnalyticsReport {
  id: string;
  type: 'daily' | 'weekly' | 'monthly' | 'custom';
  period: {
    start: string;
    end: string;
  };
  metrics: AnalyticsMetrics;
  insights: AnalyticsInsight[];
  recommendations: AnalyticsRecommendation[];
  generatedAt: string;
}

interface AnalyticsInsight {
  id: string;
  category: 'performance' | 'usage' | 'quality' | 'business';
  title: string;
  description: string;
  impact: 'positive' | 'negative' | 'neutral';
  confidence: number;
  data: any;
  trendDirection: 'up' | 'down' | 'stable';
}

interface AnalyticsRecommendation {
  id: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: 'technical' | 'operational' | 'training' | 'business';
  title: string;
  description: string;
  expectedImpact: string;
  effort: 'low' | 'medium' | 'high';
  actions: string[];
}

interface AlertRule {
  id: string;
  name: string;
  condition: string;
  threshold: number;
  enabled: boolean;
  severity: 'info' | 'warning' | 'error' | 'critical';
  actions: Array<{
    type: 'email' | 'slack' | 'webhook' | 'sms';
    target: string;
  }>;
}

type InteractionType = 
  | 'order_placement'
  | 'table_service'
  | 'information_request'
  | 'complaint_handling'
  | 'staff_command'
  | 'emergency_request'
  | 'general_inquiry';

export class VoiceAnalytics {
  private static instance: VoiceAnalytics;
  
  private interactions: Map<string, VoiceInteraction> = new Map();
  private dailyMetrics: Map<string, Partial<AnalyticsMetrics>> = new Map();
  private reports: AnalyticsReport[] = [];
  private alertRules: Map<string, AlertRule> = new Map();
  private realTimeStats: AnalyticsMetrics;
  
  // Data retention settings
  private readonly RETENTION_DAYS = 90;
  private readonly MAX_INTERACTIONS = 100000;
  
  // Default alert rules
  private defaultAlertRules: AlertRule[] = [
    {
      id: 'low_success_rate',
      name: 'Low Success Rate Alert',
      condition: 'success_rate < threshold',
      threshold: 0.85,
      enabled: true,
      severity: 'warning',
      actions: [{ type: 'email', target: 'admin@restaurant.com' }]
    },
    {
      id: 'high_error_rate',
      name: 'High Error Rate Alert',
      condition: 'error_rate > threshold',
      threshold: 0.1,
      enabled: true,
      severity: 'error',
      actions: [{ type: 'slack', target: '#alerts' }]
    },
    {
      id: 'slow_response_time',
      name: 'Slow Response Time Alert',
      condition: 'avg_response_time > threshold',
      threshold: 3000,
      enabled: true,
      severity: 'warning',
      actions: [{ type: 'email', target: 'tech@restaurant.com' }]
    },
    {
      id: 'low_user_satisfaction',
      name: 'Low User Satisfaction Alert',
      condition: 'user_satisfaction < threshold',
      threshold: 3.5,
      enabled: true,
      severity: 'error',
      actions: [{ type: 'email', target: 'manager@restaurant.com' }]
    }
  ];

  private constructor() {
    this.initializeAnalytics();
    this.startPeriodicReporting();
  }

  public static getInstance(): VoiceAnalytics {
    if (!VoiceAnalytics.instance) {
      VoiceAnalytics.instance = new VoiceAnalytics();
    }
    return VoiceAnalytics.instance;
  }

  private initializeAnalytics(): void {
    // Initialize alert rules
    this.defaultAlertRules.forEach(rule => {
      this.alertRules.set(rule.id, rule);
    });

    // Initialize real-time stats
    this.realTimeStats = this.createEmptyMetrics();
    
    console.log('VoiceAnalytics: Initialized with', this.alertRules.size, 'alert rules');
  }

  private startPeriodicReporting(): void {
    // Generate daily reports at midnight
    setInterval(() => {
      const now = new Date();
      if (now.getHours() === 0 && now.getMinutes() === 0) {
        this.generateDailyReport();
      }
    }, 60000); // Check every minute

    // Update real-time stats every 30 seconds
    setInterval(() => {
      this.updateRealTimeStats();
      this.checkAlerts();
    }, 30000);

    // Clean up old data daily
    setInterval(() => {
      this.cleanupOldData();
    }, 24 * 60 * 60 * 1000);
  }

  public async trackInteraction(interaction: Omit<VoiceInteraction, 'id' | 'timestamp'>): Promise<string> {
    const interactionId = `interaction_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    
    const fullInteraction: VoiceInteraction = {
      id: interactionId,
      timestamp: new Date().toISOString(),
      ...interaction
    };

    this.interactions.set(interactionId, fullInteraction);
    
    // Update real-time metrics
    this.updateMetricsWithInteraction(fullInteraction);
    
    // Check if we need to trim interactions
    if (this.interactions.size > this.MAX_INTERACTIONS) {
      this.trimOldInteractions();
    }

    console.log(`VoiceAnalytics: Tracked interaction ${interactionId} (${interaction.type})`);
    
    return interactionId;
  }

  public async generateReport(
    type: 'daily' | 'weekly' | 'monthly' | 'custom',
    period?: { start: string; end: string }
  ): Promise<AnalyticsReport> {
    const reportId = `report_${type}_${Date.now()}`;
    
    let startDate: Date;
    let endDate: Date = new Date();
    
    if (period) {
      startDate = new Date(period.start);
      endDate = new Date(period.end);
    } else {
      switch (type) {
        case 'daily':
          startDate = new Date();
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'weekly':
          startDate = new Date();
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'monthly':
          startDate = new Date();
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        default:
          startDate = new Date();
          startDate.setDate(startDate.getDate() - 1);
      }
    }

    const periodInteractions = this.getInteractionsInPeriod(startDate, endDate);
    const metrics = this.calculateMetrics(periodInteractions);
    const insights = await this.generateInsights(metrics, periodInteractions);
    const recommendations = await this.generateRecommendations(metrics, insights);

    const report: AnalyticsReport = {
      id: reportId,
      type,
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      metrics,
      insights,
      recommendations,
      generatedAt: new Date().toISOString()
    };

    this.reports.push(report);
    
    // Keep only last 50 reports
    if (this.reports.length > 50) {
      this.reports.shift();
    }

    console.log(`VoiceAnalytics: Generated ${type} report for ${periodInteractions.length} interactions`);
    
    return report;
  }

  public getRealTimeMetrics(): AnalyticsMetrics {
    return { ...this.realTimeStats };
  }

  public getInteractionsByType(type: InteractionType, limit: number = 100): VoiceInteraction[] {
    return Array.from(this.interactions.values())
      .filter(interaction => interaction.type === type)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  public searchInteractions(query: {
    userId?: string;
    sessionId?: string;
    type?: InteractionType;
    dateRange?: { start: string; end: string };
    minConfidence?: number;
    successful?: boolean;
  }): VoiceInteraction[] {
    return Array.from(this.interactions.values()).filter(interaction => {
      if (query.userId && interaction.userId !== query.userId) return false;
      if (query.sessionId && interaction.sessionId !== query.sessionId) return false;
      if (query.type && interaction.type !== query.type) return false;
      if (query.minConfidence && interaction.input.confidence < query.minConfidence) return false;
      if (query.successful !== undefined && interaction.outcome.successful !== query.successful) return false;
      
      if (query.dateRange) {
        const interactionDate = new Date(interaction.timestamp);
        const startDate = new Date(query.dateRange.start);
        const endDate = new Date(query.dateRange.end);
        if (interactionDate < startDate || interactionDate > endDate) return false;
      }
      
      return true;
    });
  }

  public getTopFailureReasons(limit: number = 10): Array<{
    reason: string;
    count: number;
    percentage: number;
  }> {
    const failedInteractions = Array.from(this.interactions.values())
      .filter(interaction => !interaction.outcome.successful);
    
    const reasonCounts = new Map<string, number>();
    
    failedInteractions.forEach(interaction => {
      if (interaction.processing.errors && interaction.processing.errors.length > 0) {
        interaction.processing.errors.forEach(error => {
          reasonCounts.set(error, (reasonCounts.get(error) || 0) + 1);
        });
      } else {
        const reason = interaction.outcome.fallbackUsed ? 'fallback_required' : 'unknown_error';
        reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
      }
    });

    const total = failedInteractions.length;
    
    return Array.from(reasonCounts.entries())
      .map(([reason, count]) => ({
        reason,
        count,
        percentage: (count / total) * 100
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  public getUserJourney(userId: string): Array<{
    interaction: VoiceInteraction;
    sessionDuration: number;
    previousInteractions: number;
  }> {
    const userInteractions = Array.from(this.interactions.values())
      .filter(interaction => interaction.userId === userId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return userInteractions.map((interaction, index) => {
      const sessionInteractions = userInteractions.filter(
        (i, idx) => idx <= index && i.sessionId === interaction.sessionId
      );
      
      const sessionStart = new Date(sessionInteractions[0].timestamp);
      const currentTime = new Date(interaction.timestamp);
      const sessionDuration = currentTime.getTime() - sessionStart.getTime();

      return {
        interaction,
        sessionDuration,
        previousInteractions: sessionInteractions.length - 1
      };
    });
  }

  public exportData(format: 'json' | 'csv', options: {
    includeInteractions?: boolean;
    includeMetrics?: boolean;
    dateRange?: { start: string; end: string };
  } = {}): string {
    const data: any = {
      exportDate: new Date().toISOString(),
      totalInteractions: this.interactions.size,
      realTimeMetrics: this.realTimeStats
    };

    if (options.includeInteractions) {
      let interactions = Array.from(this.interactions.values());
      
      if (options.dateRange) {
        const startDate = new Date(options.dateRange.start);
        const endDate = new Date(options.dateRange.end);
        interactions = interactions.filter(interaction => {
          const interactionDate = new Date(interaction.timestamp);
          return interactionDate >= startDate && interactionDate <= endDate;
        });
      }
      
      data.interactions = interactions;
    }

    if (options.includeMetrics) {
      data.dailyMetrics = Object.fromEntries(this.dailyMetrics);
      data.recentReports = this.reports.slice(-5);
    }

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    } else {
      // Simplified CSV export
      return this.convertToCSV(data.interactions || []);
    }
  }

  // Private helper methods

  private createEmptyMetrics(): AnalyticsMetrics {
    return {
      usage: {
        totalInteractions: 0,
        dailyActiveUsers: 0,
        averageSessionDuration: 0,
        peakUsageHours: [],
        interactionsByType: {
          order_placement: 0,
          table_service: 0,
          information_request: 0,
          complaint_handling: 0,
          staff_command: 0,
          emergency_request: 0,
          general_inquiry: 0
        },
        languageDistribution: {}
      },
      performance: {
        averageResponseTime: 0,
        averageConfidence: 0,
        successRate: 0,
        errorRate: 0,
        fallbackRate: 0,
        cacheHitRate: 0,
        modelPerformance: {}
      },
      quality: {
        averageAudioQuality: 0,
        recognitionAccuracy: 0,
        userSatisfactionScore: 0,
        commonIssues: []
      },
      restaurant: {
        orderCompletionRate: 0,
        averageOrderTime: 0,
        customerServiceMetrics: {
          resolutionRate: 0,
          escalationRate: 0,
          satisfactionScore: 0
        },
        staffEfficiency: {
          responseTime: 0,
          taskCompletionRate: 0,
          voiceCommandUsage: 0
        },
        operationalInsights: {
          peakOrderTimes: [],
          commonRequests: [],
          tableUtilization: 0
        }
      }
    };
  }

  private updateMetricsWithInteraction(interaction: VoiceInteraction): void {
    // Update usage metrics
    this.realTimeStats.usage.totalInteractions++;
    this.realTimeStats.usage.interactionsByType[interaction.type]++;
    
    const lang = interaction.input.language;
    this.realTimeStats.usage.languageDistribution[lang] = 
      (this.realTimeStats.usage.languageDistribution[lang] || 0) + 1;

    // Update performance metrics
    const totalInteractions = this.realTimeStats.usage.totalInteractions;
    
    this.realTimeStats.performance.averageResponseTime = 
      (this.realTimeStats.performance.averageResponseTime * (totalInteractions - 1) + 
       interaction.processing.responseTime) / totalInteractions;

    this.realTimeStats.performance.averageConfidence = 
      (this.realTimeStats.performance.averageConfidence * (totalInteractions - 1) + 
       interaction.outcome.confidence) / totalInteractions;

    if (interaction.outcome.successful) {
      this.realTimeStats.performance.successRate = 
        (this.realTimeStats.performance.successRate * (totalInteractions - 1) + 1) / totalInteractions;
    } else {
      this.realTimeStats.performance.errorRate = 
        (this.realTimeStats.performance.errorRate * (totalInteractions - 1) + 1) / totalInteractions;
    }

    if (interaction.outcome.fallbackUsed) {
      this.realTimeStats.performance.fallbackRate = 
        (this.realTimeStats.performance.fallbackRate * (totalInteractions - 1) + 1) / totalInteractions;
    }

    if (interaction.processing.cacheHit) {
      this.realTimeStats.performance.cacheHitRate = 
        (this.realTimeStats.performance.cacheHitRate * (totalInteractions - 1) + 1) / totalInteractions;
    }

    // Update quality metrics
    this.realTimeStats.quality.averageAudioQuality = 
      (this.realTimeStats.quality.averageAudioQuality * (totalInteractions - 1) + 
       interaction.input.audioQuality) / totalInteractions;

    if (interaction.outcome.userSatisfaction) {
      this.realTimeStats.quality.userSatisfactionScore = 
        (this.realTimeStats.quality.userSatisfactionScore * (totalInteractions - 1) + 
         interaction.outcome.userSatisfaction) / totalInteractions;
    }
  }

  private getInteractionsInPeriod(start: Date, end: Date): VoiceInteraction[] {
    return Array.from(this.interactions.values()).filter(interaction => {
      const interactionDate = new Date(interaction.timestamp);
      return interactionDate >= start && interactionDate <= end;
    });
  }

  private calculateMetrics(interactions: VoiceInteraction[]): AnalyticsMetrics {
    if (interactions.length === 0) {
      return this.createEmptyMetrics();
    }

    const metrics = this.createEmptyMetrics();

    // Calculate usage metrics
    metrics.usage.totalInteractions = interactions.length;
    
    const uniqueUsers = new Set(interactions.map(i => i.userId).filter(Boolean));
    metrics.usage.dailyActiveUsers = uniqueUsers.size;

    // Calculate session durations
    const sessionDurations = this.calculateSessionDurations(interactions);
    metrics.usage.averageSessionDuration = sessionDurations.length > 0 
      ? sessionDurations.reduce((sum, dur) => sum + dur, 0) / sessionDurations.length 
      : 0;

    // Calculate interactions by type
    interactions.forEach(interaction => {
      metrics.usage.interactionsByType[interaction.type]++;
      
      const lang = interaction.input.language;
      metrics.usage.languageDistribution[lang] = 
        (metrics.usage.languageDistribution[lang] || 0) + 1;
    });

    // Calculate performance metrics
    const responseTimes = interactions.map(i => i.processing.responseTime);
    metrics.performance.averageResponseTime = 
      responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;

    const confidences = interactions.map(i => i.outcome.confidence);
    metrics.performance.averageConfidence = 
      confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;

    const successfulInteractions = interactions.filter(i => i.outcome.successful);
    metrics.performance.successRate = successfulInteractions.length / interactions.length;

    const errorInteractions = interactions.filter(i => !i.outcome.successful);
    metrics.performance.errorRate = errorInteractions.length / interactions.length;

    const fallbackInteractions = interactions.filter(i => i.outcome.fallbackUsed);
    metrics.performance.fallbackRate = fallbackInteractions.length / interactions.length;

    const cacheHitInteractions = interactions.filter(i => i.processing.cacheHit);
    metrics.performance.cacheHitRate = cacheHitInteractions.length / interactions.length;

    // Calculate quality metrics
    const audioQualities = interactions.map(i => i.input.audioQuality);
    metrics.quality.averageAudioQuality = 
      audioQualities.reduce((sum, quality) => sum + quality, 0) / audioQualities.length;

    const confidencesForAccuracy = interactions.map(i => i.input.confidence);
    metrics.quality.recognitionAccuracy = 
      confidencesForAccuracy.reduce((sum, conf) => sum + conf, 0) / confidencesForAccuracy.length;

    const satisfactionScores = interactions
      .map(i => i.outcome.userSatisfaction)
      .filter(score => score !== undefined) as number[];
    
    if (satisfactionScores.length > 0) {
      metrics.quality.userSatisfactionScore = 
        satisfactionScores.reduce((sum, score) => sum + score, 0) / satisfactionScores.length;
    }

    // Calculate restaurant-specific metrics
    const orderInteractions = interactions.filter(i => i.type === 'order_placement');
    const completedOrders = orderInteractions.filter(i => i.outcome.successful);
    metrics.restaurant.orderCompletionRate = orderInteractions.length > 0 
      ? completedOrders.length / orderInteractions.length 
      : 0;

    const orderTimes = orderInteractions.map(i => i.processing.responseTime);
    metrics.restaurant.averageOrderTime = orderTimes.length > 0 
      ? orderTimes.reduce((sum, time) => sum + time, 0) / orderTimes.length 
      : 0;

    return metrics;
  }

  private calculateSessionDurations(interactions: VoiceInteraction[]): number[] {
    const sessionMap = new Map<string, VoiceInteraction[]>();
    
    interactions.forEach(interaction => {
      if (!sessionMap.has(interaction.sessionId)) {
        sessionMap.set(interaction.sessionId, []);
      }
      sessionMap.get(interaction.sessionId)!.push(interaction);
    });

    return Array.from(sessionMap.values()).map(sessionInteractions => {
      if (sessionInteractions.length === 0) return 0;
      
      sessionInteractions.sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      
      const firstInteraction = sessionInteractions[0];
      const lastInteraction = sessionInteractions[sessionInteractions.length - 1];
      
      return new Date(lastInteraction.timestamp).getTime() - 
             new Date(firstInteraction.timestamp).getTime();
    });
  }

  private async generateInsights(
    metrics: AnalyticsMetrics, 
    interactions: VoiceInteraction[]
  ): Promise<AnalyticsInsight[]> {
    const insights: AnalyticsInsight[] = [];

    // Performance insights
    if (metrics.performance.successRate < 0.9) {
      insights.push({
        id: `insight_success_rate_${Date.now()}`,
        category: 'performance',
        title: 'Low Success Rate Detected',
        description: `Success rate is ${(metrics.performance.successRate * 100).toFixed(1)}%, below the target of 90%`,
        impact: 'negative',
        confidence: 0.9,
        data: { successRate: metrics.performance.successRate },
        trendDirection: 'down'
      });
    }

    // Usage insights
    const mostUsedType = Object.entries(metrics.usage.interactionsByType)
      .sort(([,a], [,b]) => b - a)[0];
    
    if (mostUsedType) {
      insights.push({
        id: `insight_usage_${Date.now()}`,
        category: 'usage',
        title: 'Primary Use Case Identified',
        description: `${mostUsedType[0]} accounts for ${((mostUsedType[1] / metrics.usage.totalInteractions) * 100).toFixed(1)}% of interactions`,
        impact: 'positive',
        confidence: 0.8,
        data: { topInteractionType: mostUsedType[0], percentage: (mostUsedType[1] / metrics.usage.totalInteractions) * 100 },
        trendDirection: 'stable'
      });
    }

    // Quality insights
    if (metrics.quality.averageAudioQuality < 0.7) {
      insights.push({
        id: `insight_audio_quality_${Date.now()}`,
        category: 'quality',
        title: 'Audio Quality Issues',
        description: `Average audio quality is ${(metrics.quality.averageAudioQuality * 100).toFixed(1)}%, suggesting microphone or environment issues`,
        impact: 'negative',
        confidence: 0.85,
        data: { audioQuality: metrics.quality.averageAudioQuality },
        trendDirection: 'down'
      });
    }

    return insights;
  }

  private async generateRecommendations(
    metrics: AnalyticsMetrics, 
    insights: AnalyticsInsight[]
  ): Promise<AnalyticsRecommendation[]> {
    const recommendations: AnalyticsRecommendation[] = [];

    // Performance recommendations
    if (metrics.performance.successRate < 0.9) {
      recommendations.push({
        id: `rec_success_rate_${Date.now()}`,
        priority: 'high',
        category: 'technical',
        title: 'Improve Recognition Accuracy',
        description: 'Implement additional training data and model fine-tuning to improve success rates',
        expectedImpact: 'Increase success rate by 5-10%',
        effort: 'medium',
        actions: [
          'Collect more training data from failed interactions',
          'Fine-tune NLP models with restaurant-specific vocabulary',
          'Implement context-aware fallback strategies'
        ]
      });
    }

    // Audio quality recommendations
    if (metrics.quality.averageAudioQuality < 0.7) {
      recommendations.push({
        id: `rec_audio_quality_${Date.now()}`,
        priority: 'medium',
        category: 'operational',
        title: 'Improve Audio Environment',
        description: 'Address environmental factors affecting voice recognition quality',
        expectedImpact: 'Improve recognition accuracy by 10-15%',
        effort: 'low',
        actions: [
          'Install noise-canceling microphones',
          'Create quiet zones for voice interactions',
          'Train staff on optimal speaking techniques'
        ]
      });
    }

    // Usage optimization recommendations
    const topInteractionType = Object.entries(metrics.usage.interactionsByType)
      .sort(([,a], [,b]) => b - a)[0];
    
    if (topInteractionType && topInteractionType[1] / metrics.usage.totalInteractions > 0.5) {
      recommendations.push({
        id: `rec_optimize_${topInteractionType[0]}_${Date.now()}`,
        priority: 'medium',
        category: 'business',
        title: `Optimize ${topInteractionType[0]} Experience`,
        description: `Focus on improving the ${topInteractionType[0]} workflow as it represents the majority of interactions`,
        expectedImpact: 'Improve overall user experience and efficiency',
        effort: 'medium',
        actions: [
          `Streamline ${topInteractionType[0]} process`,
          'Add shortcuts for common requests',
          'Implement predictive suggestions'
        ]
      });
    }

    return recommendations;
  }

  private updateRealTimeStats(): void {
    // This would typically recalculate stats from recent interactions
    const recentInteractions = Array.from(this.interactions.values())
      .filter(interaction => {
        const interactionTime = new Date(interaction.timestamp).getTime();
        const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
        return interactionTime > fiveMinutesAgo;
      });

    if (recentInteractions.length > 0) {
      // Update peak usage hours
      const currentHour = new Date().getHours();
      if (!this.realTimeStats.usage.peakUsageHours.includes(currentHour)) {
        this.realTimeStats.usage.peakUsageHours.push(currentHour);
        this.realTimeStats.usage.peakUsageHours.sort((a, b) => a - b);
        
        // Keep only top 5 peak hours
        if (this.realTimeStats.usage.peakUsageHours.length > 5) {
          this.realTimeStats.usage.peakUsageHours.pop();
        }
      }
    }
  }

  private checkAlerts(): void {
    for (const [ruleId, rule] of this.alertRules.entries()) {
      if (!rule.enabled) continue;

      let shouldAlert = false;
      
      switch (rule.condition) {
        case 'success_rate < threshold':
          shouldAlert = this.realTimeStats.performance.successRate < rule.threshold;
          break;
        case 'error_rate > threshold':
          shouldAlert = this.realTimeStats.performance.errorRate > rule.threshold;
          break;
        case 'avg_response_time > threshold':
          shouldAlert = this.realTimeStats.performance.averageResponseTime > rule.threshold;
          break;
        case 'user_satisfaction < threshold':
          shouldAlert = this.realTimeStats.quality.userSatisfactionScore < rule.threshold;
          break;
      }

      if (shouldAlert) {
        this.triggerAlert(rule);
      }
    }
  }

  private triggerAlert(rule: AlertRule): void {
    console.warn(`VoiceAnalytics Alert: ${rule.name} - ${rule.condition} (threshold: ${rule.threshold})`);
    
    // In production, this would send actual alerts
    rule.actions.forEach(action => {
      console.log(`Alert action: ${action.type} to ${action.target}`);
    });
  }

  private async generateDailyReport(): Promise<void> {
    try {
      const report = await this.generateReport('daily');
      console.log(`VoiceAnalytics: Generated daily report ${report.id}`);
    } catch (error) {
      console.error('VoiceAnalytics: Error generating daily report', error);
    }
  }

  private trimOldInteractions(): void {
    const interactions = Array.from(this.interactions.entries())
      .sort(([,a], [,b]) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    const excessCount = interactions.length - this.MAX_INTERACTIONS;
    
    for (let i = 0; i < excessCount; i++) {
      this.interactions.delete(interactions[i][0]);
    }
    
    console.log(`VoiceAnalytics: Trimmed ${excessCount} old interactions`);
  }

  private cleanupOldData(): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.RETENTION_DAYS);
    
    let removedCount = 0;
    
    for (const [id, interaction] of this.interactions.entries()) {
      if (new Date(interaction.timestamp) < cutoffDate) {
        this.interactions.delete(id);
        removedCount++;
      }
    }
    
    if (removedCount > 0) {
      console.log(`VoiceAnalytics: Cleaned up ${removedCount} old interactions`);
    }
  }

  private convertToCSV(interactions: VoiceInteraction[]): string {
    if (interactions.length === 0) return '';
    
    const headers = [
      'id', 'timestamp', 'type', 'transcript', 'confidence', 
      'successful', 'responseTime', 'language'
    ];
    
    const rows = interactions.map(interaction => [
      interaction.id,
      interaction.timestamp,
      interaction.type,
      `"${interaction.input.transcript.replace(/"/g, '""')}"`,
      interaction.input.confidence,
      interaction.outcome.successful,
      interaction.processing.responseTime,
      interaction.input.language
    ]);
    
    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  public getReports(limit: number = 10): AnalyticsReport[] {
    return this.reports
      .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime())
      .slice(0, limit);
  }

  public addAlertRule(rule: Omit<AlertRule, 'id'>): string {
    const ruleId = `rule_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    this.alertRules.set(ruleId, { ...rule, id: ruleId });
    console.log(`VoiceAnalytics: Added alert rule ${ruleId}`);
    return ruleId;
  }

  public updateAlertRule(ruleId: string, updates: Partial<AlertRule>): boolean {
    const rule = this.alertRules.get(ruleId);
    if (!rule) return false;
    
    this.alertRules.set(ruleId, { ...rule, ...updates });
    console.log(`VoiceAnalytics: Updated alert rule ${ruleId}`);
    return true;
  }

  public deleteAlertRule(ruleId: string): boolean {
    const deleted = this.alertRules.delete(ruleId);
    if (deleted) {
      console.log(`VoiceAnalytics: Deleted alert rule ${ruleId}`);
    }
    return deleted;
  }

  public shutdown(): void {
    this.interactions.clear();
    this.dailyMetrics.clear();
    this.reports = [];
    this.alertRules.clear();
    console.log('VoiceAnalytics: Shutdown complete');
  }
}