// Customer Satisfaction Agent Web Worker
// Runs independently in background for customer satisfaction monitoring

let agentConfig = {};
let taskQueue = [];
let isProcessing = false;
let interactions = new Map();
let serviceMetrics = new Map();
let customerIssues = new Map();
let staffPerformance = new Map();
let realTimeAlerts = [];
let satisfactionHistory = [];

// Service time thresholds (minutes)
const SERVICE_THRESHOLDS = {
  excellent: 10,
  good: 15,
  acceptable: 25,
  poor: 35
};

// Initialize staff data
function initializeStaffData() {
  const sampleStaff = [
    { id: 'staff_1', name: 'Rahul Kumar' },
    { id: 'staff_2', name: 'Priya Sharma' },
    { id: 'staff_3', name: 'Amit Singh' },
    { id: 'staff_4', name: 'Sneha Gupta' },
    { id: 'staff_5', name: 'Vikram Patel' }
  ];

  sampleStaff.forEach(staff => {
    staffPerformance.set(staff.id, {
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

// Start real-time monitoring
function startRealTimeMonitoring() {
  setInterval(() => {
    checkServiceDelays();
    monitorStaffWorkload();
    detectAnomalies();
  }, 30000);

  setInterval(() => {
    cleanupOldAlerts();
  }, 300000);
}

// Main message handler
self.onmessage = function(event) {
  const { type, config, task, data } = event.data;
  
  switch (type) {
    case 'init':
      agentConfig = config;
      initializeStaffData();
      startRealTimeMonitoring();
      self.postMessage({
        type: 'ready',
        agentId: config.agentId
      });
      break;
      
    case 'task':
      taskQueue.push(task);
      if (!isProcessing) {
        processNextTask();
      }
      break;
      
    case 'record_interaction':
      recordCustomerInteraction(data);
      break;
      
    case 'record_service_metrics':
      recordServiceMetrics(data);
      break;
      
    case 'get_alerts':
      self.postMessage({
        type: 'alerts',
        data: realTimeAlerts
      });
      break;
      
    case 'shutdown':
      self.close();
      break;
  }
};

async function processNextTask() {
  if (taskQueue.length === 0) {
    isProcessing = false;
    return;
  }

  isProcessing = true;
  const task = taskQueue.shift();
  const startTime = Date.now();

  try {
    const result = await processCustomerSatisfaction(task);
    
    self.postMessage({
      type: 'task_complete',
      taskId: task.id,
      success: true,
      result: result,
      executionTime: Date.now() - startTime
    });
  } catch (error) {
    self.postMessage({
      type: 'task_complete',
      taskId: task.id,
      success: false,
      error: error.message,
      executionTime: Date.now() - startTime
    });
  }

  setTimeout(() => processNextTask(), 10);
}

async function processCustomerSatisfaction(task) {
  const { context } = task.data;
  
  // Filter data based on context
  const relevantInteractions = filterInteractions(context);
  const relevantMetrics = filterServiceMetrics(context);
  const relevantIssues = filterIssues(context);
  
  // Calculate overall satisfaction score
  const overallScore = calculateOverallScore(relevantInteractions, relevantMetrics);
  
  // Categorize customers
  const customerCategorization = categorizeCustomers(relevantInteractions);
  
  // Calculate average service time
  const averageServiceTime = calculateAverageServiceTime(relevantMetrics);
  
  // Analyze staff performance
  const staffPerformanceAnalysis = analyzeStaffPerformance(relevantInteractions, relevantMetrics);
  
  // Generate recommendations
  const recommendations = generateRecommendations(relevantIssues, staffPerformanceAnalysis, overallScore);
  
  // Perform trend analysis
  const trendAnalysis = analyzeTrends(relevantInteractions, relevantIssues);
  
  // Generate action items
  const actionItems = generateActionItems(relevantIssues, staffPerformanceAnalysis);
  
  // Get real-time alerts if requested
  const includeRealTime = context?.includeRealTime || false;
  const alerts = includeRealTime ? [...realTimeAlerts] : [];
  
  // Update satisfaction history
  updateSatisfactionHistory(overallScore, relevantInteractions.length);
  
  return {
    type: 'customer_satisfaction',
    overallScore: Math.round(overallScore * 10) / 10,
    totalCustomers: relevantInteractions.length,
    satisfiedCustomers: customerCategorization.satisfied,
    dissatisfiedCustomers: customerCategorization.dissatisfied,
    neutralCustomers: customerCategorization.neutral,
    averageServiceTime: Math.round(averageServiceTime * 10) / 10,
    issues: Array.from(relevantIssues.values()).sort((a, b) => new Date(b.reportedAt) - new Date(a.reportedAt)),
    recommendations,
    staffPerformance: Array.from(staffPerformanceAnalysis.values()),
    trendAnalysis,
    actionItems,
    realTimeAlerts: alerts
  };
}

async function recordCustomerInteraction(interactionData) {
  const interactionId = `int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Analyze sentiment if description contains feedback
  let sentiment;
  if (interactionData.description && interactionData.description.length > 10) {
    sentiment = await analyzeSentiment(interactionData.description);
  }
  
  const fullInteraction = {
    id: interactionId,
    timestamp: new Date().toISOString(),
    sentiment,
    ...interactionData
  };
  
  interactions.set(interactionId, fullInteraction);
  
  // Create issue if it's a complaint or negative feedback
  if (interactionData.interactionType === 'complaint' || 
      (sentiment && sentiment.sentiment === 'negative')) {
    await createIssueFromInteraction(fullInteraction);
  }
  
  // Generate real-time alerts if necessary
  await checkForRealTimeAlerts(fullInteraction);
  
  return interactionId;
}

async function recordServiceMetrics(metricsData) {
  const totalServiceTime = metricsData.lastServiceTime && metricsData.firstServiceTime 
    ? (new Date(metricsData.lastServiceTime) - new Date(metricsData.firstServiceTime)) / (1000 * 60)
    : 0;

  const waitTime = metricsData.firstServiceTime 
    ? (new Date(metricsData.firstServiceTime) - new Date(metricsData.orderTime)) / (1000 * 60)
    : 0;

  const fullMetrics = {
    ...metricsData,
    totalServiceTime,
    waitTime
  };

  serviceMetrics.set(metricsData.tableId, fullMetrics);

  // Generate alerts for poor service times
  if (waitTime > SERVICE_THRESHOLDS.poor) {
    generateServiceDelayAlert(fullMetrics);
  }
}

// Simple sentiment analysis function
async function analyzeSentiment(text) {
  const positiveWords = ['good', 'great', 'excellent', 'amazing', 'love', 'perfect', 'accha', 'mast'];
  const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'worst', 'slow', 'kharab', 'ganda'];
  
  const words = text.toLowerCase().split(/\s+/);
  let positiveScore = 0;
  let negativeScore = 0;
  
  words.forEach(word => {
    if (positiveWords.some(pw => word.includes(pw))) positiveScore++;
    if (negativeWords.some(nw => word.includes(nw))) negativeScore++;
  });
  
  let sentiment = 'neutral';
  let confidence = 0.6;
  
  if (positiveScore > negativeScore) {
    sentiment = 'positive';
    confidence = Math.min(0.9, 0.6 + (positiveScore - negativeScore) * 0.1);
  } else if (negativeScore > positiveScore) {
    sentiment = 'negative';
    confidence = Math.min(0.9, 0.6 + (negativeScore - positiveScore) * 0.1);
  }
  
  // Determine urgency based on keywords
  let urgency = 'low';
  if (text.includes('emergency') || text.includes('urgent')) urgency = 'critical';
  else if (text.includes('complaint') || text.includes('problem')) urgency = 'high';
  else if (text.includes('slow') || text.includes('wait')) urgency = 'medium';
  
  return {
    sentiment,
    confidence,
    urgency,
    emotion: sentiment === 'positive' ? 'happy' : sentiment === 'negative' ? 'angry' : 'neutral',
    intensity: confidence,
    categories: {
      service: text.includes('service') || text.includes('waiter') ? 0.8 : 0.2,
      food: text.includes('food') || text.includes('taste') ? 0.8 : 0.2,
      ambiance: text.includes('atmosphere') || text.includes('noise') ? 0.8 : 0.2,
      pricing: text.includes('price') || text.includes('expensive') ? 0.8 : 0.2,
      staff: text.includes('staff') || text.includes('rude') ? 0.8 : 0.2
    },
    keywords: words.filter(w => w.length > 3).slice(0, 5)
  };
}

function filterInteractions(context) {
  let filteredInteractions = Array.from(interactions.values());
  
  if (context?.timeRange) {
    const start = new Date(context.timeRange.start);
    const end = new Date(context.timeRange.end);
    filteredInteractions = filteredInteractions.filter(
      int => new Date(int.timestamp) >= start && new Date(int.timestamp) <= end
    );
  }
  
  if (context?.tableIds) {
    filteredInteractions = filteredInteractions.filter(int => context.tableIds.includes(int.tableId));
  }
  
  if (context?.staffMembers) {
    filteredInteractions = filteredInteractions.filter(int => context.staffMembers.includes(int.staffMember));
  }
  
  return filteredInteractions;
}

function filterServiceMetrics(context) {
  let filteredMetrics = Array.from(serviceMetrics.values());
  
  if (context?.timeRange) {
    const start = new Date(context.timeRange.start);
    const end = new Date(context.timeRange.end);
    filteredMetrics = filteredMetrics.filter(
      metric => new Date(metric.orderTime) >= start && new Date(metric.orderTime) <= end
    );
  }
  
  return filteredMetrics;
}

function filterIssues(context) {
  const filteredIssues = new Map();
  
  customerIssues.forEach((issue, id) => {
    let include = true;
    
    if (context?.timeRange && include) {
      const start = new Date(context.timeRange.start);
      const end = new Date(context.timeRange.end);
      include = new Date(issue.reportedAt) >= start && new Date(issue.reportedAt) <= end;
    }
    
    if (include) {
      filteredIssues.set(id, issue);
    }
  });
  
  return filteredIssues;
}

function calculateOverallScore(interactions, metrics) {
  if (interactions.length === 0 && metrics.length === 0) return 8.5;
  
  let totalScore = 0;
  let scoreCount = 0;
  
  // Score based on interactions
  interactions.forEach(interaction => {
    let interactionScore = 8.5;
    
    if (interaction.sentiment) {
      switch (interaction.sentiment.sentiment) {
        case 'positive':
          interactionScore = 7 + (interaction.sentiment.confidence * 3);
          break;
        case 'negative':
          interactionScore = 5 - (interaction.sentiment.confidence * 3);
          break;
        case 'neutral':
          interactionScore = 6 + (interaction.sentiment.confidence * 1);
          break;
      }
    }
    
    // Adjust based on interaction type
    switch (interaction.interactionType) {
      case 'complaint':
        interactionScore = Math.min(interactionScore, 4);
        break;
      case 'emergency':
        interactionScore = Math.min(interactionScore, 3);
        break;
    }
    
    totalScore += interactionScore;
    scoreCount++;
  });
  
  // Score based on service metrics
  metrics.forEach(metric => {
    let serviceScore = metric.serviceQuality || 8.5;
    
    if (metric.waitTime <= SERVICE_THRESHOLDS.excellent) {
      serviceScore = Math.min(10, serviceScore + 1);
    } else if (metric.waitTime > SERVICE_THRESHOLDS.poor) {
      serviceScore = Math.max(1, serviceScore - 2);
    }
    
    totalScore += serviceScore;
    scoreCount++;
  });
  
  return scoreCount > 0 ? totalScore / scoreCount : 8.5;
}

function categorizeCustomers(interactions) {
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

function calculateAverageServiceTime(metrics) {
  if (metrics.length === 0) return 0;
  
  const totalTime = metrics.reduce((sum, metric) => sum + metric.waitTime, 0);
  return totalTime / metrics.length;
}

function analyzeStaffPerformance(interactions, metrics) {
  const performanceMap = new Map();
  
  // Initialize with existing staff data
  staffPerformance.forEach((perf, staffId) => {
    performanceMap.set(staffId, { ...perf });
  });
  
  // Analyze interactions
  interactions.forEach(interaction => {
    const staff = performanceMap.get(interaction.staffMember);
    if (staff) {
      if (interaction.interactionType === 'complaint') {
        staff.complaintsReceived++;
      }
      
      if (interaction.sentiment && interaction.sentiment.sentiment === 'positive') {
        staff.commendationsReceived++;
      }
    }
  });
  
  // Analyze service metrics
  const staffMetrics = {};
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
      const goodServiceCount = staffMetricsList.filter(m => m.waitTime <= SERVICE_THRESHOLDS.good).length;
      staff.efficiency = goodServiceCount / staffMetricsList.length;
      
      // Identify strengths and improvement areas
      staff.strengths = identifyStaffStrengths(staff);
      staff.improvementAreas = identifyImprovementAreas(staff);
    }
  });
  
  return performanceMap;
}

function identifyStaffStrengths(staff) {
  const strengths = [];
  
  if (staff.efficiency >= 0.9) strengths.push('Excellent service timing');
  if (staff.customerSatisfactionScore >= 9) strengths.push('High customer satisfaction');
  if (staff.complaintsReceived === 0) strengths.push('Zero complaints received');
  if (staff.commendationsReceived >= 3) strengths.push('Multiple customer commendations');
  if (staff.averageServiceTime <= SERVICE_THRESHOLDS.excellent) strengths.push('Fast service delivery');
  
  return strengths;
}

function identifyImprovementAreas(staff) {
  const areas = [];
  
  if (staff.efficiency < 0.7) areas.push('Service timing needs improvement');
  if (staff.customerSatisfactionScore < 7) areas.push('Customer interaction skills');
  if (staff.complaintsReceived >= 2) areas.push('Complaint handling and prevention');
  if (staff.averageServiceTime > SERVICE_THRESHOLDS.acceptable) areas.push('Speed of service');
  
  return areas;
}

function generateRecommendations(issues, staffPerformanceMap, overallScore) {
  const recommendations = [];
  
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
  const underperformingStaff = Array.from(staffPerformanceMap.values())
    .filter(s => s.customerSatisfactionScore < 7 || s.efficiency < 0.7);
  
  if (underperformingStaff.length > 0) {
    recommendations.push(`${underperformingStaff.length} staff members need additional training`);
  }
  
  return recommendations.slice(0, 8);
}

function analyzeTrends(interactions, issues) {
  // Simple trend analysis
  const recentInteractions = interactions.filter(
    int => Date.now() - new Date(int.timestamp).getTime() < 7 * 24 * 60 * 60 * 1000
  );
  
  const olderInteractions = interactions.filter(
    int => Date.now() - new Date(int.timestamp).getTime() >= 7 * 24 * 60 * 60 * 1000
  );
  
  const recentAvgScore = calculateAverageScoreFromInteractions(recentInteractions);
  const olderAvgScore = calculateAverageScoreFromInteractions(olderInteractions);
  
  let satisfactionTrend = 'stable';
  if (recentAvgScore > olderAvgScore + 0.5) satisfactionTrend = 'improving';
  else if (recentAvgScore < olderAvgScore - 0.5) satisfactionTrend = 'declining';
  
  // Identify peak issue hours
  const hourlyIssues = {};
  Array.from(issues.values()).forEach(issue => {
    const hour = new Date(issue.reportedAt).getHours();
    hourlyIssues[hour] = (hourlyIssues[hour] || 0) + 1;
  });
  
  const peakIssueHours = Object.entries(hourlyIssues)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([hour]) => parseInt(hour));
  
  // Common issue types
  const issueTypes = {};
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
    seasonalPatterns: {},
    correlations: [
      { factor: 'Service time', impact: -0.7, description: 'Longer service times correlate with lower satisfaction' },
      { factor: 'Staff experience', impact: 0.6, description: 'Experienced staff show higher satisfaction rates' }
    ]
  };
}

function calculateAverageScoreFromInteractions(interactions) {
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

function generateActionItems(issues, staffPerformanceMap) {
  const actionItems = [];
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
        deadline: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        estimatedImpact: 'Prevent customer churn',
        status: 'pending'
      });
    });
  
  // Staff training for underperformers
  Array.from(staffPerformanceMap.values())
    .filter(staff => staff.customerSatisfactionScore < 7)
    .forEach(staff => {
      actionItems.push({
        id: `action_${itemId++}`,
        priority: 'high',
        category: 'staff_training',
        description: `Additional training for ${staff.staffName} - focus on customer service`,
        assignedTo: 'training_manager',
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        estimatedImpact: 'Improve customer satisfaction scores',
        status: 'pending'
      });
    });
  
  return actionItems.sort((a, b) => {
    const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    return priorityOrder[b.priority] - priorityOrder[a.priority];
  });
}

async function createIssueFromInteraction(interaction) {
  const issueId = `issue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  let severity = 'medium';
  let issueType = 'other';
  
  if (interaction.sentiment) {
    if (interaction.sentiment.urgency === 'critical') severity = 'critical';
    else if (interaction.sentiment.urgency === 'high') severity = 'high';
    else if (interaction.sentiment.urgency === 'medium') severity = 'medium';
    else severity = 'low';
    
    const categories = interaction.sentiment.categories;
    const maxCategory = Object.entries(categories).reduce((max, [cat, score]) => 
      score > categories[max] ? cat : max
    );
    
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
    }
  }
  
  if (interaction.interactionType === 'emergency') {
    severity = 'critical';
  }
  
  const issue = {
    id: issueId,
    customerId: interaction.customerId,
    tableId: interaction.tableId,
    issueType,
    severity,
    description: interaction.description,
    reportedAt: interaction.timestamp,
    staffInvolved: [interaction.staffMember],
    customerSatisfaction: sentimentToSatisfactionScore(interaction.sentiment),
    preventable: true,
    status: 'reported'
  };
  
  customerIssues.set(issueId, issue);
  
  if (severity === 'critical') {
    await generateCriticalIssueAlert(issue);
  }
}

function sentimentToSatisfactionScore(sentiment) {
  if (!sentiment) return 5;
  
  switch (sentiment.sentiment) {
    case 'positive':
      return Math.round(7 + (sentiment.confidence * 3));
    case 'negative':
      return Math.round(Math.max(1, 5 - (sentiment.confidence * 3)));
    case 'neutral':
      return Math.round(5 + (sentiment.confidence * 1));
    default:
      return 5;
  }
}

async function checkForRealTimeAlerts(interaction) {
  if (interaction.interactionType === 'emergency') {
    realTimeAlerts.push({
      id: `alert_${Date.now()}`,
      alertType: 'customer_complaint',
      severity: 'emergency',
      message: `Emergency reported at ${interaction.tableId}`,
      tableId: interaction.tableId,
      staffMember: interaction.staffMember,
      timestamp: new Date().toISOString(),
      actionRequired: 'Immediate manager intervention required',
      escalationRequired: true
    });
  }
  
  if (interaction.sentiment && interaction.sentiment.sentiment === 'negative' && interaction.sentiment.urgency === 'critical') {
    realTimeAlerts.push({
      id: `alert_${Date.now()}`,
      alertType: 'customer_complaint',
      severity: 'critical',
      message: `Critical customer complaint at ${interaction.tableId}`,
      tableId: interaction.tableId,
      staffMember: interaction.staffMember,
      timestamp: new Date().toISOString(),
      actionRequired: 'Immediate resolution and follow-up required',
      escalationRequired: false
    });
  }
}

function checkServiceDelays() {
  const currentTime = Date.now();
  
  serviceMetrics.forEach((metrics, tableId) => {
    const timeSinceOrder = (currentTime - new Date(metrics.orderTime).getTime()) / (1000 * 60);
    
    if (!metrics.firstServiceTime && timeSinceOrder > SERVICE_THRESHOLDS.poor) {
      realTimeAlerts.push({
        id: `alert_${Date.now()}`,
        alertType: 'service_delay',
        severity: 'warning',
        message: `Service delay at ${tableId} - ${Math.round(timeSinceOrder)} minutes since order`,
        tableId,
        staffMember: metrics.staffMember,
        timestamp: new Date().toISOString(),
        actionRequired: 'Check order status and provide update to customer',
        escalationRequired: timeSinceOrder > SERVICE_THRESHOLDS.poor + 10
      });
    }
  });
}

function monitorStaffWorkload() {
  const staffWorkload = {};
  
  serviceMetrics.forEach(metrics => {
    if (!metrics.lastServiceTime) {
      staffWorkload[metrics.staffMember] = (staffWorkload[metrics.staffMember] || 0) + 1;
    }
  });
  
  Object.entries(staffWorkload).forEach(([staffId, tableCount]) => {
    if (tableCount > 6) {
      const staff = staffPerformance.get(staffId);
      realTimeAlerts.push({
        id: `alert_${Date.now()}`,
        alertType: 'staff_overload',
        severity: 'warning',
        message: `${staff?.staffName || staffId} handling ${tableCount} tables - potential overload`,
        staffMember: staffId,
        timestamp: new Date().toISOString(),
        actionRequired: 'Consider redistributing tables or providing assistance',
        escalationRequired: false
      });
    }
  });
}

function detectAnomalies() {
  const recentInteractions = Array.from(interactions.values())
    .filter(int => Date.now() - new Date(int.timestamp).getTime() < 60 * 60 * 1000);
  
  const negativeInteractions = recentInteractions.filter(
    int => int.sentiment && int.sentiment.sentiment === 'negative'
  ).length;
  
  if (negativeInteractions >= 3) {
    realTimeAlerts.push({
      id: `alert_${Date.now()}`,
      alertType: 'quality_issue',
      severity: 'critical',
      message: `${negativeInteractions} negative customer interactions in the last hour`,
      timestamp: new Date().toISOString(),
      actionRequired: 'Investigate potential systematic issue',
      escalationRequired: true
    });
  }
}

function generateServiceDelayAlert(metrics) {
  realTimeAlerts.push({
    id: `alert_${Date.now()}`,
    alertType: 'service_delay',
    severity: 'warning',
    message: `Poor service time at ${metrics.tableId} - ${Math.round(metrics.waitTime)} minutes`,
    tableId: metrics.tableId,
    staffMember: metrics.staffMember,
    timestamp: new Date().toISOString(),
    actionRequired: 'Follow up with customer and explain delay',
    escalationRequired: false
  });
}

async function generateCriticalIssueAlert(issue) {
  realTimeAlerts.push({
    id: `alert_${Date.now()}`,
    alertType: 'customer_complaint',
    severity: 'critical',
    message: `Critical issue reported: ${issue.description.substring(0, 50)}...`,
    tableId: issue.tableId,
    timestamp: new Date().toISOString(),
    actionRequired: 'Manager intervention required immediately',
    escalationRequired: true
  });
}

function cleanupOldAlerts() {
  const cutoffTime = Date.now() - 2 * 60 * 60 * 1000;
  realTimeAlerts = realTimeAlerts.filter(
    alert => new Date(alert.timestamp).getTime() > cutoffTime
  );
}

function updateSatisfactionHistory(score, customerCount) {
  satisfactionHistory.push({
    timestamp: new Date().toISOString(),
    score,
    customerCount
  });
  
  if (satisfactionHistory.length > 100) {
    satisfactionHistory = satisfactionHistory.slice(-100);
  }
}

console.log('Customer Satisfaction Agent worker initialized');