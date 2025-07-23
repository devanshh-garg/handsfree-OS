import { getSentimentAnalyzer, SentimentResult } from '../nlp/SentimentAnalyzer';

interface CustomerInteraction {
  id: string;
  customerId?: string;
  tableId: string;
  staffMember: string;
  interactionType: 'order' | 'complaint' | 'feedback' | 'request' | 'emergency';
  timestamp: Date;
  description: string;
  sentiment?: SentimentResult;
  resolution?: string;
  resolutionTime?: number; // minutes
  escalated: boolean;
  satisfied: boolean;
}

interface ServiceMetrics {
  tableId: string;
  orderTime: Date;
  firstServiceTime?: Date;
  lastServiceTime?: Date;
  totalServiceTime: number; // minutes
  waitTime: number; // minutes
  serviceQuality: number; // 1-10 scale
  staffMember: string;
  customerFeedback?: string;
  issuesReported: number;
}

interface SatisfactionAnalysisResult {
  type: 'customer_satisfaction';
  overallScore: number;
  totalCustomers: number;
  satisfiedCustomers: number;
  dissatisfiedCustomers: number;
  neutralCustomers: number;
  averageServiceTime: number;
  issues: CustomerIssue[];
  recommendations: string[];
  staffPerformance: StaffPerformance[];
  trendAnalysis: TrendAnalysis;
  actionItems: ActionItem[];
  realTimeAlerts: RealTimeAlert[];
}

interface CustomerIssue {
  id: string;
  customerId?: string;
  tableId: string;
  issueType: 'service_delay' | 'food_quality' | 'staff_behavior' | 'billing' | 'other';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  reportedAt: Date;
  resolvedAt?: Date;
  resolutionTime?: number;
  staffInvolved: string[];
  customerSatisfaction: number; // 1-10
  preventable: boolean;
  rootCause?: string;
  status: 'reported' | 'investigating' | 'resolved' | 'escalated';
}

interface StaffPerformance {
  staffId: string;
  staffName: string;
  tablesServed: number;
  averageServiceTime: number;
  customerSatisfactionScore: number;
  complaintsReceived: number;
  commendationsReceived: number;
  efficiency: number; // 0-1
  areas: string[];
  strengths: string[];
  improvementAreas: string[];
}

interface TrendAnalysis {
  period: 'hourly' | 'daily' | 'weekly' | 'monthly';
  satisfactionTrend: 'improving' | 'declining' | 'stable';
  peakIssueHours: number[];
  commonIssueTypes: Array<{ type: string; frequency: number }>;
  seasonalPatterns: { [month: string]: number };
  correlations: Array<{ factor: string; impact: number; description: string }>;
}

interface ActionItem {
  id: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: 'staff_training' | 'process_improvement' | 'customer_follow_up' | 'system_update';
  description: string;
  assignedTo?: string;
  deadline: Date;
  estimatedImpact: string;
  status: 'pending' | 'in_progress' | 'completed';
}

interface RealTimeAlert {
  id: string;
  alertType: 'service_delay' | 'customer_complaint' | 'staff_overload' | 'quality_issue';
  severity: 'info' | 'warning' | 'critical' | 'emergency';
  message: string;
  tableId?: string;
  staffMember?: string;
  timestamp: Date;
  actionRequired: string;
  escalationRequired: boolean;
}

export class CustomerSatisfactionAgent {
  private interactions: Map<string, CustomerInteraction> = new Map();
  private serviceMetrics: Map<string, ServiceMetrics> = new Map();
  private customerIssues: Map<string, CustomerIssue> = new Map();
  private staffPerformance: Map<string, StaffPerformance> = new Map();
  private realTimeAlerts: RealTimeAlert[] = [];
  private satisfactionHistory: Array<{ timestamp: Date; score: number; customerCount: number }> = [];
  private sentimentAnalyzer = getSentimentAnalyzer();

  // Service time thresholds (minutes)
  private readonly SERVICE_THRESHOLDS = {
    excellent: 10,
    good: 15,
    acceptable: 25,
    poor: 35
  };

  constructor() {
    this.initializeStaffData();
    this.startRealTimeMonitoring();
  }

  private initializeStaffData(): void {
    const sampleStaff = [
      { id: 'staff_1', name: 'Rahul Kumar' },
      { id: 'staff_2', name: 'Priya Sharma' },
      { id: 'staff_3', name: 'Amit Singh' },
      { id: 'staff_4', name: 'Sneha Gupta' },
      { id: 'staff_5', name: 'Vikram Patel' }
    ];

    sampleStaff.forEach(staff => {
      this.staffPerformance.set(staff.id, {
        staffId: staff.id,
        staffName: staff.name,
        tablesServed: 0,
        averageServiceTime: 0,
        customerSatisfactionScore: 8.5,
        complaintsReceived: 0,
        commendationsReceived: 0,
        efficiency: 0.85,
        areas: [],
        strengths: [],
        improvementAreas: []
      });
    });
  }

  private startRealTimeMonitoring(): void {
    // Monitor service times and generate alerts
    setInterval(() => {
      this.checkServiceDelays();
      this.monitorStaffWorkload();
      this.detectAnomalies();
    }, 30000); // Check every 30 seconds

    // Cleanup old alerts
    setInterval(() => {
      this.cleanupOldAlerts();
    }, 300000); // Every 5 minutes
  }

  async analyzeCustomerSatisfaction(context?: {
    timeRange?: { start: Date; end: Date };
    tableIds?: string[];
    staffMembers?: string[];
    includeRealTime?: boolean;
  }): Promise<SatisfactionAnalysisResult> {
    console.log('Customer Satisfaction Agent: Analyzing satisfaction metrics');

    // Filter data based on context
    const relevantInteractions = this.filterInteractions(context);
    const relevantMetrics = this.filterServiceMetrics(context);
    const relevantIssues = this.filterIssues(context);

    // Calculate overall satisfaction score
    const overallScore = this.calculateOverallScore(relevantInteractions, relevantMetrics);

    // Categorize customers
    const customerCategorization = this.categorizeCustomers(relevantInteractions);

    // Calculate average service time
    const averageServiceTime = this.calculateAverageServiceTime(relevantMetrics);

    // Analyze staff performance
    const staffPerformance = this.analyzeStaffPerformance(relevantInteractions, relevantMetrics);

    // Generate recommendations
    const recommendations = this.generateRecommendations(relevantIssues, staffPerformance, overallScore);

    // Perform trend analysis
    const trendAnalysis = this.analyzeTrends(relevantInteractions, relevantIssues);

    // Generate action items
    const actionItems = this.generateActionItems(relevantIssues, staffPerformance);

    // Get real-time alerts if requested
    const realTimeAlerts = context?.includeRealTime ? [...this.realTimeAlerts] : [];

    const result: SatisfactionAnalysisResult = {
      type: 'customer_satisfaction',
      overallScore: Math.round(overallScore * 10) / 10,
      totalCustomers: relevantInteractions.length,
      satisfiedCustomers: customerCategorization.satisfied,
      dissatisfiedCustomers: customerCategorization.dissatisfied,
      neutralCustomers: customerCategorization.neutral,
      averageServiceTime: Math.round(averageServiceTime * 10) / 10,
      issues: Array.from(relevantIssues.values()).sort((a, b) => b.reportedAt.getTime() - a.reportedAt.getTime()),
      recommendations,
      staffPerformance: Array.from(staffPerformance.values()),
      trendAnalysis,
      actionItems,
      realTimeAlerts
    };

    // Update satisfaction history
    this.updateSatisfactionHistory(overallScore, relevantInteractions.length);

    return result;
  }

  async recordCustomerInteraction(interaction: Omit<CustomerInteraction, 'id' | 'timestamp' | 'sentiment'>): Promise<string> {
    const interactionId = `int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Analyze sentiment if description contains feedback
    let sentiment: SentimentResult | undefined;
    if (interaction.description && interaction.description.length > 10) {
      try {
        sentiment = await this.sentimentAnalyzer.analyzeSentiment(
          interaction.description,
          {
            customerType: 'regular', // Could be enhanced with actual customer data
            serviceTime: 0, // Could be enhanced with actual service time
            tableNumber: parseInt(interaction.tableId.replace('table', ''))
          }
        );
      } catch (error) {
        console.warn('Failed to analyze sentiment:', error);
      }
    }

    const fullInteraction: CustomerInteraction = {
      id: interactionId,
      timestamp: new Date(),
      sentiment,
      ...interaction
    };

    this.interactions.set(interactionId, fullInteraction);

    // Create issue if it's a complaint or negative feedback
    if (interaction.interactionType === 'complaint' || 
        (sentiment && sentiment.sentiment === 'negative')) {
      await this.createIssueFromInteraction(fullInteraction);
    }

    // Update staff performance
    this.updateStaffPerformance(interaction.staffMember, fullInteraction);

    // Generate real-time alerts if necessary
    await this.checkForRealTimeAlerts(fullInteraction);

    return interactionId;
  }

  async recordServiceMetrics(metrics: Omit<ServiceMetrics, 'totalServiceTime' | 'waitTime'>): Promise<void> {
    const totalServiceTime = metrics.lastServiceTime && metrics.firstServiceTime 
      ? (metrics.lastServiceTime.getTime() - metrics.firstServiceTime.getTime()) / (1000 * 60)
      : 0;

    const waitTime = metrics.firstServiceTime 
      ? (metrics.firstServiceTime.getTime() - metrics.orderTime.getTime()) / (1000 * 60)
      : 0;

    const fullMetrics: ServiceMetrics = {
      ...metrics,
      totalServiceTime,
      waitTime
    };

    this.serviceMetrics.set(metrics.tableId, fullMetrics);

    // Generate alerts for poor service times
    if (waitTime > this.SERVICE_THRESHOLDS.poor) {
      this.generateServiceDelayAlert(fullMetrics);
    }
  }

  private filterInteractions(context?: any): CustomerInteraction[] {
    let interactions = Array.from(this.interactions.values());

    if (context?.timeRange) {
      interactions = interactions.filter(
        int => int.timestamp >= context.timeRange.start && int.timestamp <= context.timeRange.end
      );
    }

    if (context?.tableIds) {
      interactions = interactions.filter(int => context.tableIds.includes(int.tableId));
    }

    if (context?.staffMembers) {
      interactions = interactions.filter(int => context.staffMembers.includes(int.staffMember));
    }

    return interactions;
  }

  private filterServiceMetrics(context?: any): ServiceMetrics[] {
    let metrics = Array.from(this.serviceMetrics.values());

    if (context?.timeRange) {
      metrics = metrics.filter(
        metric => metric.orderTime >= context.timeRange.start && metric.orderTime <= context.timeRange.end
      );
    }

    if (context?.tableIds) {
      metrics = metrics.filter(metric => context.tableIds.includes(metric.tableId));
    }

    if (context?.staffMembers) {
      metrics = metrics.filter(metric => context.staffMembers.includes(metric.staffMember));
    }

    return metrics;
  }

  private filterIssues(context?: any): Map<string, CustomerIssue> {
    const filteredIssues = new Map<string, CustomerIssue>();

    this.customerIssues.forEach((issue, id) => {
      let include = true;

      if (context?.timeRange && include) {
        include = issue.reportedAt >= context.timeRange.start && issue.reportedAt <= context.timeRange.end;
      }

      if (context?.tableIds && include) {
        include = context.tableIds.includes(issue.tableId);
      }

      if (context?.staffMembers && include) {
        include = issue.staffInvolved.some(staff => context.staffMembers.includes(staff));
      }

      if (include) {
        filteredIssues.set(id, issue);
      }
    });

    return filteredIssues;
  }

  private calculateOverallScore(interactions: CustomerInteraction[], metrics: ServiceMetrics[]): number {
    if (interactions.length === 0 && metrics.length === 0) return 8.5; // Default score

    let totalScore = 0;
    let scoreCount = 0;

    // Score based on interactions
    interactions.forEach(interaction => {
      let interactionScore = 8.5; // Default

      if (interaction.sentiment) {
        switch (interaction.sentiment.sentiment) {
          case 'positive':
            interactionScore = 7 + (interaction.sentiment.confidence * 3); // 7-10
            break;
          case 'negative':
            interactionScore = 5 - (interaction.sentiment.confidence * 3); // 2-5
            break;
          case 'neutral':
            interactionScore = 6 + (interaction.sentiment.confidence * 1); // 6-7
            break;
        }
      }

      // Adjust based on interaction type
      switch (interaction.interactionType) {
        case 'complaint':
          interactionScore = Math.min(interactionScore, 4); // Cap at 4 for complaints
          break;
        case 'emergency':
          interactionScore = Math.min(interactionScore, 3); // Cap at 3 for emergencies
          break;
        default:
          break;
      }

      // Adjust based on resolution
      if (interaction.resolution && interaction.satisfied) {
        interactionScore = Math.min(10, interactionScore + 1);
      } else if (interaction.resolution && !interaction.satisfied) {
        interactionScore = Math.max(1, interactionScore - 2);
      }

      totalScore += interactionScore;
      scoreCount++;
    });

    // Score based on service metrics
    metrics.forEach(metric => {
      let serviceScore = metric.serviceQuality || 8.5;

      // Adjust based on service time
      if (metric.waitTime <= this.SERVICE_THRESHOLDS.excellent) {
        serviceScore = Math.min(10, serviceScore + 1);
      } else if (metric.waitTime > this.SERVICE_THRESHOLDS.poor) {
        serviceScore = Math.max(1, serviceScore - 2);
      }

      totalScore += serviceScore;
      scoreCount++;
    });

    return scoreCount > 0 ? totalScore / scoreCount : 8.5;
  }

  private categorizeCustomers(interactions: CustomerInteraction[]): {
    satisfied: number;
    dissatisfied: number;
    neutral: number;
  } {
    let satisfied = 0;
    let dissatisfied = 0;
    let neutral = 0;

    interactions.forEach(interaction => {
      if (interaction.sentiment) {
        switch (interaction.sentiment.sentiment) {
          case 'positive':
            satisfied++;
            break;
          case 'negative':
            dissatisfied++;
            break;
          case 'neutral':
            neutral++;
            break;
        }
      } else if (interaction.satisfied === true) {
        satisfied++;
      } else if (interaction.satisfied === false) {
        dissatisfied++;
      } else {
        neutral++;
      }
    });

    return { satisfied, dissatisfied, neutral };
  }

  private calculateAverageServiceTime(metrics: ServiceMetrics[]): number {
    if (metrics.length === 0) return 0;

    const totalTime = metrics.reduce((sum, metric) => sum + metric.waitTime, 0);
    return totalTime / metrics.length;
  }

  private analyzeStaffPerformance(
    interactions: CustomerInteraction[], 
    metrics: ServiceMetrics[]
  ): Map<string, StaffPerformance> {
    const performanceMap = new Map<string, StaffPerformance>();

    // Initialize with existing staff data
    this.staffPerformance.forEach((perf, staffId) => {
      performanceMap.set(staffId, { ...perf });
    });

    // Analyze interactions
    interactions.forEach(interaction => {
      const staff = performanceMap.get(interaction.staffMember);
      if (staff) {
        if (interaction.interactionType === 'complaint') {
          staff.complaintsReceived++;
        }

        if (interaction.sentiment) {
          if (interaction.sentiment.sentiment === 'positive') {
            staff.commendationsReceived++;
          }
        }
      }
    });

    // Analyze service metrics
    const staffMetrics: { [staffId: string]: ServiceMetrics[] } = {};
    metrics.forEach(metric => {
      if (!staffMetrics[metric.staffMember]) {
        staffMetrics[metric.staffMember] = [];
      }
      staffMetrics[metric.staffMember].push(metric);
    });

    Object.entries(staffMetrics).forEach(([staffId, staffMetricsList]) => {
      const staff = performanceMap.get(staffId);
      if (staff) {
        staff.tablesServed = staffMetricsList.length;
        staff.averageServiceTime = staffMetricsList.reduce((sum, m) => sum + m.waitTime, 0) / staffMetricsList.length;
        
        const avgQuality = staffMetricsList.reduce((sum, m) => sum + (m.serviceQuality || 8.5), 0) / staffMetricsList.length;
        staff.customerSatisfactionScore = avgQuality;

        // Calculate efficiency
        const goodServiceCount = staffMetricsList.filter(m => m.waitTime <= this.SERVICE_THRESHOLDS.good).length;
        staff.efficiency = goodServiceCount / staffMetricsList.length;

        // Identify strengths and improvement areas
        staff.strengths = this.identifyStaffStrengths(staff);
        staff.improvementAreas = this.identifyImprovementAreas(staff);
      }
    });

    return performanceMap;
  }

  private identifyStaffStrengths(staff: StaffPerformance): string[] {
    const strengths: string[] = [];

    if (staff.efficiency >= 0.9) strengths.push('Excellent service timing');
    if (staff.customerSatisfactionScore >= 9) strengths.push('High customer satisfaction');
    if (staff.complaintsReceived === 0) strengths.push('Zero complaints received');
    if (staff.commendationsReceived >= 3) strengths.push('Multiple customer commendations');
    if (staff.averageServiceTime <= this.SERVICE_THRESHOLDS.excellent) strengths.push('Fast service delivery');

    return strengths;
  }

  private identifyImprovementAreas(staff: StaffPerformance): string[] {
    const areas: string[] = [];

    if (staff.efficiency < 0.7) areas.push('Service timing needs improvement');
    if (staff.customerSatisfactionScore < 7) areas.push('Customer interaction skills');
    if (staff.complaintsReceived >= 2) areas.push('Complaint handling and prevention');
    if (staff.averageServiceTime > this.SERVICE_THRESHOLDS.acceptable) areas.push('Speed of service');

    return areas;
  }

  private generateRecommendations(
    issues: Map<string, CustomerIssue>, 
    staffPerformance: Map<string, StaffPerformance>,
    overallScore: number
  ): string[] {
    const recommendations: string[] = [];

    // Overall score recommendations
    if (overallScore < 7) {
      recommendations.push('Critical: Overall satisfaction below acceptable level - immediate action required');
    } else if (overallScore < 8) {
      recommendations.push('Moderate improvement needed in customer satisfaction metrics');
    }

    // Issue-based recommendations
    const criticalIssues = Array.from(issues.values()).filter(i => i.severity === 'critical').length;
    const unresolvedIssues = Array.from(issues.values()).filter(i => i.status !== 'resolved').length;

    if (criticalIssues > 0) {
      recommendations.push(`${criticalIssues} critical issues require immediate attention`);
    }

    if (unresolvedIssues > 5) {
      recommendations.push('High number of unresolved issues - review escalation process');
    }

    // Staff performance recommendations
    const underperformingStaff = Array.from(staffPerformance.values())
      .filter(s => s.customerSatisfactionScore < 7 || s.efficiency < 0.7);

    if (underperformingStaff.length > 0) {
      recommendations.push(`${underperformingStaff.length} staff members need additional training`);
    }

    // Service time recommendations
    const slowStaff = Array.from(staffPerformance.values())
      .filter(s => s.averageServiceTime > this.SERVICE_THRESHOLDS.acceptable);

    if (slowStaff.length >= 2) {
      recommendations.push('Multiple staff showing slow service times - review workflow efficiency');
    }

    // Process improvement recommendations
    const serviceDelayIssues = Array.from(issues.values())
      .filter(i => i.issueType === 'service_delay').length;

    if (serviceDelayIssues > 3) {
      recommendations.push('Frequent service delays - consider kitchen capacity or process optimization');
    }

    return recommendations.slice(0, 8); // Top 8 recommendations
  }

  private analyzeTrends(interactions: CustomerInteraction[], issues: Map<string, CustomerIssue>): TrendAnalysis {
    // Simple trend analysis - could be enhanced with more sophisticated algorithms
    const recentInteractions = interactions.filter(
      int => Date.now() - int.timestamp.getTime() < 7 * 24 * 60 * 60 * 1000 // Last 7 days
    );

    const olderInteractions = interactions.filter(
      int => Date.now() - int.timestamp.getTime() >= 7 * 24 * 60 * 60 * 1000
    );

    // Calculate satisfaction trend
    const recentAvgScore = this.calculateAverageScoreFromInteractions(recentInteractions);
    const olderAvgScore = this.calculateAverageScoreFromInteractions(olderInteractions);

    let satisfactionTrend: TrendAnalysis['satisfactionTrend'] = 'stable';
    if (recentAvgScore > olderAvgScore + 0.5) satisfactionTrend = 'improving';
    else if (recentAvgScore < olderAvgScore - 0.5) satisfactionTrend = 'declining';

    // Identify peak issue hours
    const hourlyIssues: { [hour: number]: number } = {};
    Array.from(issues.values()).forEach(issue => {
      const hour = issue.reportedAt.getHours();
      hourlyIssues[hour] = (hourlyIssues[hour] || 0) + 1;
    });

    const peakIssueHours = Object.entries(hourlyIssues)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([hour]) => parseInt(hour));

    // Common issue types
    const issueTypes: { [type: string]: number } = {};
    Array.from(issues.values()).forEach(issue => {
      issueTypes[issue.issueType] = (issueTypes[issue.issueType] || 0) + 1;
    });

    const commonIssueTypes = Object.entries(issueTypes)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([type, frequency]) => ({ type, frequency }));

    return {
      period: 'daily',
      satisfactionTrend,
      peakIssueHours,
      commonIssueTypes,
      seasonalPatterns: {}, // Placeholder for seasonal analysis
      correlations: [
        { factor: 'Service time', impact: -0.7, description: 'Longer service times correlate with lower satisfaction' },
        { factor: 'Staff experience', impact: 0.6, description: 'Experienced staff show higher satisfaction rates' }
      ]
    };
  }

  private calculateAverageScoreFromInteractions(interactions: CustomerInteraction[]): number {
    if (interactions.length === 0) return 8.5;

    let totalScore = 0;
    let scoreCount = 0;

    interactions.forEach(interaction => {
      if (interaction.sentiment) {
        let score = 8.5;
        switch (interaction.sentiment.sentiment) {
          case 'positive':
            score = 8 + (interaction.sentiment.confidence * 2);
            break;
          case 'negative':
            score = 4 - (interaction.sentiment.confidence * 2);
            break;
          case 'neutral':
            score = 6.5;
            break;
        }
        totalScore += score;
        scoreCount++;
      }
    });

    return scoreCount > 0 ? totalScore / scoreCount : 8.5;
  }

  private generateActionItems(
    issues: Map<string, CustomerIssue>, 
    staffPerformance: Map<string, StaffPerformance>
  ): ActionItem[] {
    const actionItems: ActionItem[] = [];
    let itemId = 1;

    // Critical issues require immediate action
    Array.from(issues.values())
      .filter(issue => issue.severity === 'critical' && issue.status !== 'resolved')
      .forEach(issue => {
        actionItems.push({
          id: `action_${itemId++}`,
          priority: 'critical',
          category: 'customer_follow_up',
          description: `Resolve critical issue: ${issue.description}`,
          assignedTo: issue.staffInvolved[0],
          deadline: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours
          estimatedImpact: 'Prevent customer churn',
          status: 'pending'
        });
      });

    // Staff training for underperformers
    Array.from(staffPerformance.values())
      .filter(staff => staff.customerSatisfactionScore < 7)
      .forEach(staff => {
        actionItems.push({
          id: `action_${itemId++}`,
          priority: 'high',
          category: 'staff_training',
          description: `Additional training for ${staff.staffName} - focus on customer service`,
          assignedTo: 'training_manager',
          deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week
          estimatedImpact: 'Improve customer satisfaction scores',
          status: 'pending'
        });
      });

    // Process improvements for common issues
    const serviceDelayCount = Array.from(issues.values())
      .filter(i => i.issueType === 'service_delay').length;

    if (serviceDelayCount > 3) {
      actionItems.push({
        id: `action_${itemId++}`,
        priority: 'medium',
        category: 'process_improvement',
        description: 'Review and optimize service delivery process',
        assignedTo: 'operations_manager',
        deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 2 weeks
        estimatedImpact: 'Reduce service delays by 30%',
        status: 'pending'
      });
    }

    return actionItems.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  private async createIssueFromInteraction(interaction: CustomerInteraction): Promise<void> {
    const issueId = `issue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    let severity: CustomerIssue['severity'] = 'medium';
    let issueType: CustomerIssue['issueType'] = 'other';

    // Determine severity and type from sentiment and interaction
    if (interaction.sentiment) {
      if (interaction.sentiment.urgency === 'critical') severity = 'critical';
      else if (interaction.sentiment.urgency === 'high') severity = 'high';
      else if (interaction.sentiment.urgency === 'medium') severity = 'medium';
      else severity = 'low';

      // Categorize based on sentiment categories
      const categories = interaction.sentiment.categories;
      const maxCategory = Object.entries(categories).reduce((maxEntry, [cat, score]) => 
        score > maxEntry[1] ? [cat, score] : maxEntry
      )[0];

      switch (maxCategory) {
        case 'service':
          issueType = 'service_delay';
          break;
        case 'food':
          issueType = 'food_quality';
          break;
        case 'staff':
          issueType = 'staff_behavior';
          break;
        default:
          issueType = 'other';
          break;
      }
    }

    if (interaction.interactionType === 'emergency') {
      severity = 'critical';
    }

    const issue: CustomerIssue = {
      id: issueId,
      customerId: interaction.customerId,
      tableId: interaction.tableId,
      issueType,
      severity,
      description: interaction.description,
      reportedAt: interaction.timestamp,
      staffInvolved: [interaction.staffMember],
      customerSatisfaction: interaction.sentiment ? this.sentimentToSatisfactionScore(interaction.sentiment) : 5,
      preventable: true, // Default assumption
      status: 'reported'
    };

    this.customerIssues.set(issueId, issue);

    // Generate real-time alert for critical issues
    if (severity === 'critical') {
      await this.generateCriticalIssueAlert(issue);
    }
  }

  private sentimentToSatisfactionScore(sentiment: SentimentResult): number {
    switch (sentiment.sentiment) {
      case 'positive':
        return Math.round(7 + (sentiment.confidence * 3)); // 7-10
      case 'negative':
        return Math.round(Math.max(1, 5 - (sentiment.confidence * 3))); // 1-5
      case 'neutral':
        return Math.round(5 + (sentiment.confidence * 1)); // 5-6
      default:
        return 5;
    }
  }

  private updateStaffPerformance(staffMember: string, interaction: CustomerInteraction): void {
    const staff = this.staffPerformance.get(staffMember);
    if (staff) {
      // Update will be done in analyzeStaffPerformance method
      // This is a placeholder for real-time updates
    }
  }

  private async checkForRealTimeAlerts(interaction: CustomerInteraction): Promise<void> {
    // Generate alerts based on interaction type and sentiment
    if (interaction.interactionType === 'emergency') {
      this.realTimeAlerts.push({
        id: `alert_${Date.now()}`,
        alertType: 'customer_complaint',
        severity: 'emergency',
        message: `Emergency reported at ${interaction.tableId}`,
        tableId: interaction.tableId,
        staffMember: interaction.staffMember,
        timestamp: new Date(),
        actionRequired: 'Immediate manager intervention required',
        escalationRequired: true
      });
    }

    if (interaction.sentiment && interaction.sentiment.sentiment === 'negative' && interaction.sentiment.urgency === 'critical') {
      this.realTimeAlerts.push({
        id: `alert_${Date.now()}`,
        alertType: 'customer_complaint',
        severity: 'critical',
        message: `Critical customer complaint at ${interaction.tableId}`,
        tableId: interaction.tableId,
        staffMember: interaction.staffMember,
        timestamp: new Date(),
        actionRequired: 'Immediate resolution and follow-up required',
        escalationRequired: false
      });
    }
  }

  private checkServiceDelays(): void {
    const currentTime = Date.now();
    
    this.serviceMetrics.forEach((metrics, tableId) => {
      const timeSinceOrder = (currentTime - metrics.orderTime.getTime()) / (1000 * 60); // minutes
      
      if (!metrics.firstServiceTime && timeSinceOrder > this.SERVICE_THRESHOLDS.poor) {
        this.realTimeAlerts.push({
          id: `alert_${Date.now()}`,
          alertType: 'service_delay',
          severity: 'warning',
          message: `Service delay at ${tableId} - ${Math.round(timeSinceOrder)} minutes since order`,
          tableId,
          staffMember: metrics.staffMember,
          timestamp: new Date(),
          actionRequired: 'Check order status and provide update to customer',
          escalationRequired: timeSinceOrder > this.SERVICE_THRESHOLDS.poor + 10
        });
      }
    });
  }

  private monitorStaffWorkload(): void {
    // Check if any staff member is handling too many tables
    const staffWorkload: { [staffId: string]: number } = {};
    
    this.serviceMetrics.forEach(metrics => {
      if (!metrics.lastServiceTime) { // Active orders only
        staffWorkload[metrics.staffMember] = (staffWorkload[metrics.staffMember] || 0) + 1;
      }
    });

    Object.entries(staffWorkload).forEach(([staffId, tableCount]) => {
      if (tableCount > 6) { // Threshold for overload
        const staff = this.staffPerformance.get(staffId);
        this.realTimeAlerts.push({
          id: `alert_${Date.now()}`,
          alertType: 'staff_overload',
          severity: 'warning',
          message: `${staff?.staffName || staffId} handling ${tableCount} tables - potential overload`,
          staffMember: staffId,
          timestamp: new Date(),
          actionRequired: 'Consider redistributing tables or providing assistance',
          escalationRequired: false
        });
      }
    });
  }

  private detectAnomalies(): void {
    // Detect unusual patterns in recent interactions
    const recentInteractions = Array.from(this.interactions.values())
      .filter(int => Date.now() - int.timestamp.getTime() < 60 * 60 * 1000); // Last hour

    const negativeInteractions = recentInteractions.filter(
      int => int.sentiment && int.sentiment.sentiment === 'negative'
    ).length;

    // Alert if too many negative interactions in short time
    if (negativeInteractions >= 3) {
      this.realTimeAlerts.push({
        id: `alert_${Date.now()}`,
        alertType: 'quality_issue',
        severity: 'critical',
        message: `${negativeInteractions} negative customer interactions in the last hour`,
        timestamp: new Date(),
        actionRequired: 'Investigate potential systematic issue',
        escalationRequired: true
      });
    }
  }

  private generateServiceDelayAlert(metrics: ServiceMetrics): void {
    this.realTimeAlerts.push({
      id: `alert_${Date.now()}`,
      alertType: 'service_delay',
      severity: 'warning',
      message: `Poor service time at ${metrics.tableId} - ${Math.round(metrics.waitTime)} minutes`,
      tableId: metrics.tableId,
      staffMember: metrics.staffMember,
      timestamp: new Date(),
      actionRequired: 'Follow up with customer and explain delay',
      escalationRequired: false
    });
  }

  private async generateCriticalIssueAlert(issue: CustomerIssue): Promise<void> {
    this.realTimeAlerts.push({
      id: `alert_${Date.now()}`,
      alertType: 'customer_complaint',
      severity: 'critical',
      message: `Critical issue reported: ${issue.description.substring(0, 50)}...`,
      tableId: issue.tableId,
      timestamp: new Date(),
      actionRequired: 'Manager intervention required immediately',
      escalationRequired: true
    });
  }

  private cleanupOldAlerts(): void {
    const cutoffTime = Date.now() - 2 * 60 * 60 * 1000; // 2 hours ago
    this.realTimeAlerts = this.realTimeAlerts.filter(
      alert => alert.timestamp.getTime() > cutoffTime
    );
  }

  private updateSatisfactionHistory(score: number, customerCount: number): void {
    this.satisfactionHistory.push({
      timestamp: new Date(),
      score,
      customerCount
    });

    // Keep only last 100 entries
    if (this.satisfactionHistory.length > 100) {
      this.satisfactionHistory = this.satisfactionHistory.slice(-100);
    }
  }

  // Public utility methods
  getRealTimeAlerts(): RealTimeAlert[] {
    return [...this.realTimeAlerts];
  }

  getCustomerIssues(): CustomerIssue[] {
    return Array.from(this.customerIssues.values());
  }

  resolveIssue(issueId: string, resolution: string, satisfied: boolean): boolean {
    const issue = this.customerIssues.get(issueId);
    if (issue) {
      issue.status = 'resolved';
      issue.resolvedAt = new Date();
      issue.resolutionTime = (issue.resolvedAt.getTime() - issue.reportedAt.getTime()) / (1000 * 60);
      
      // Update customer satisfaction based on resolution
      if (satisfied) {
        issue.customerSatisfaction = Math.min(10, issue.customerSatisfaction + 2);
      }
      
      return true;
    }
    return false;
  }

  async processTask(task: any): Promise<SatisfactionAnalysisResult> {
    const { context } = task.data;
    return await this.analyzeCustomerSatisfaction(context);
  }
}

// Singleton instance
let customerSatisfactionAgent: CustomerSatisfactionAgent | null = null;

export function getCustomerSatisfactionAgent(): CustomerSatisfactionAgent {
  if (!customerSatisfactionAgent) {
    customerSatisfactionAgent = new CustomerSatisfactionAgent();
  }
  return customerSatisfactionAgent;
}

export type { 
  CustomerInteraction, 
  ServiceMetrics, 
  SatisfactionAnalysisResult, 
  CustomerIssue, 
  StaffPerformance,
  TrendAnalysis,
  ActionItem,
  RealTimeAlert
};