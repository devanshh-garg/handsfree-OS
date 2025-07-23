// Inventory Prediction Agent Web Worker
// Runs independently in background for inventory demand forecasting

let agentConfig = {};
let taskQueue = [];
let isProcessing = false;
let inventoryItems = new Map();
let seasonalTrends = new Map();
let demandForecasts = new Map();
let performanceMetrics = {
  accuracyRate: 0.85,
  alertsSent: 0,
  stockoutsPrevented: 0,
  costSavings: 0
};

// Initialize inventory data
function initializeInventoryData() {
  const sampleItems = [
    {
      id: 'onions',
      name: 'Onions',
      category: 'ingredients',
      currentStock: 25,
      unit: 'kg',
      costPerUnit: 30,
      supplier: 'Local Farm Co.',
      shelfLife: 14,
      minimumStock: 10,
      maximumStock: 50,
      lastRestocked: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      averageDailyUsage: 3.5,
      seasonalVariation: 1.0
    },
    {
      id: 'tomatoes',
      name: 'Tomatoes',
      category: 'ingredients',
      currentStock: 15,
      unit: 'kg',
      costPerUnit: 40,
      supplier: 'Fresh Produce Ltd.',
      shelfLife: 7,
      minimumStock: 8,
      maximumStock: 30,
      lastRestocked: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      averageDailyUsage: 4.2,
      seasonalVariation: 1.2
    },
    {
      id: 'paneer',
      name: 'Paneer',
      category: 'ingredients',
      currentStock: 8,
      unit: 'kg',
      costPerUnit: 250,
      supplier: 'Dairy Fresh',
      shelfLife: 5,
      minimumStock: 5,
      maximumStock: 20,
      lastRestocked: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      averageDailyUsage: 2.8,
      seasonalVariation: 1.1
    },
    {
      id: 'rice_basmati',
      name: 'Basmati Rice',
      category: 'ingredients',
      currentStock: 35,
      unit: 'kg',
      costPerUnit: 120,
      supplier: 'Premium Grains',
      shelfLife: 365,
      minimumStock: 20,
      maximumStock: 100,
      lastRestocked: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      averageDailyUsage: 5.0,
      seasonalVariation: 0.9
    },
    {
      id: 'milk',
      name: 'Milk',
      category: 'beverages',
      currentStock: 20,
      unit: 'liters',
      costPerUnit: 60,
      supplier: 'Dairy Fresh',
      shelfLife: 3,
      minimumStock: 15,
      maximumStock: 50,
      lastRestocked: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      averageDailyUsage: 8.5,
      seasonalVariation: 1.0
    }
  ];

  sampleItems.forEach(item => {
    inventoryItems.set(item.id, item);
  });
}

// Initialize seasonal trends
function initializeSeasonalTrends() {
  const items = ['onions', 'tomatoes', 'paneer', 'rice_basmati', 'milk'];
  
  items.forEach(itemId => {
    const seasonalData = generateSeasonalPattern(itemId);
    seasonalTrends.set(itemId, seasonalData);
  });
}

function generateSeasonalPattern(itemId) {
  switch (itemId) {
    case 'tomatoes':
      return [0.8, 0.9, 1.1, 1.3, 1.4, 1.2, 1.1, 1.0, 0.9, 0.8, 0.7, 0.8];
    case 'paneer':
      return [1.0, 1.0, 1.2, 1.0, 1.0, 1.0, 1.0, 1.1, 1.3, 1.4, 1.2, 1.1];
    default:
      return [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0].map(v => v + (Math.random() - 0.5) * 0.2);
  }
}

// Main message handler
self.onmessage = function(event) {
  const { type, config, task } = event.data;
  
  switch (type) {
    case 'init':
      agentConfig = config;
      initializeInventoryData();
      initializeSeasonalTrends();
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
      
    case 'shutdown':
      self.close();
      break;
      
    case 'update_stock':
      const { itemId, newQuantity } = event.data;
      updateInventoryLevel(itemId, newQuantity);
      break;
      
    case 'record_usage':
      const { itemId: usageItemId, quantityUsed } = event.data;
      recordUsage(usageItemId, quantityUsed);
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
    const result = await processInventoryPrediction(task);
    
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

async function processInventoryPrediction(task) {
  const { context } = task.data;
  
  const currentMonth = new Date().getMonth();
  const predictions = {};
  const alerts = [];
  const restockSchedule = [];
  
  // Analyze each inventory item
  for (const [itemId, item] of inventoryItems.entries()) {
    const prediction = await predictItemDemand(item, currentMonth, context);
    predictions[itemId] = prediction;
    
    // Generate alerts based on prediction
    const itemAlerts = generateAlertsForItem(item, prediction);
    alerts.push(...itemAlerts);
    
    // Generate restock recommendations
    if (prediction.daysUntilStockout <= 7 || prediction.currentStock <= item.minimumStock) {
      const restockRec = generateRestockRecommendation(item, prediction);
      restockSchedule.push(restockRec);
    }
  }
  
  // Sort alerts by priority
  alerts.sort((a, b) => b.priority - a.priority);
  
  // Calculate overall inventory health score
  const overallScore = calculateOverallScore(predictions);
  
  // Generate cost optimization analysis
  const costOptimization = analyzeCostOptimization(predictions, restockSchedule);
  
  // Analyze wastage patterns
  const wastageAnalysis = analyzeWastage(predictions);
  
  // Update performance metrics
  performanceMetrics.alertsSent += alerts.length;
  
  return {
    type: 'inventory_prediction',
    predictions,
    alerts,
    overallScore,
    topRecommendations: alerts.slice(0, 5),
    restockSchedule: restockSchedule.sort((a, b) => new Date(a.suggestedDate) - new Date(b.suggestedDate)),
    costOptimization,
    wastageAnalysis
  };
}

async function predictItemDemand(item, currentMonth, context) {
  // Get seasonal factor
  const seasonalFactors = seasonalTrends.get(item.id) || Array(12).fill(1);
  const seasonalFactor = seasonalFactors[currentMonth];
  
  // Base prediction on historical usage
  let predictedDailyDemand = item.averageDailyUsage * seasonalFactor;
  
  // Apply context-based adjustments
  if (context) {
    predictedDailyDemand = applyContextualAdjustments(predictedDailyDemand, item, context);
  }
  
  const predictedWeeklyDemand = predictedDailyDemand * 7;
  const daysUntilStockout = item.currentStock / predictedDailyDemand;
  
  // Determine trend
  const trend = determineTrend(item.id);
  
  // Calculate confidence
  const confidenceLevel = calculateConfidence(item.id, seasonalFactor);
  
  // Recommend order quantity
  const recommendedOrderQuantity = Math.max(
    item.minimumStock,
    Math.ceil(predictedWeeklyDemand * 2 * 1.1)
  );
  
  // Calculate optimal restock date
  const daysToMinimum = Math.max(0, (item.currentStock - item.minimumStock) / predictedDailyDemand);
  const optimalRestockDate = new Date(Date.now() + daysToMinimum * 24 * 60 * 60 * 1000).toISOString();
  
  return {
    itemId: item.id,
    itemName: item.name,
    currentStock: item.currentStock,
    predictedDemand: Math.round(predictedWeeklyDemand * 100) / 100,
    daysUntilStockout: Math.round(daysUntilStockout * 10) / 10,
    confidenceLevel: Math.round(confidenceLevel * 100) / 100,
    trend,
    seasonalFactor: Math.round(seasonalFactor * 100) / 100,
    recommendedOrderQuantity,
    optimalRestockDate
  };
}

function applyContextualAdjustments(baseDemand, item, context) {
  let adjustedDemand = baseDemand;
  
  // Staffing level impact
  if (context.staffingLevel) {
    const staffMultiplier = 0.7 + (context.staffingLevel * 0.3);
    adjustedDemand *= staffMultiplier;
  }
  
  // Day type impact
  if (context.dayType) {
    switch (context.dayType) {
      case 'weekend':
        adjustedDemand *= 1.4;
        break;
      case 'holiday':
        adjustedDemand *= 1.8;
        break;
    }
  }
  
  // Promotional items boost
  if (context.promotionalItems && context.promotionalItems.includes(item.id)) {
    adjustedDemand *= 2.0;
  }
  
  // Upcoming events impact
  if (context.upcomingEvents) {
    const eventMultiplier = 1 + (context.upcomingEvents.length * 0.2);
    adjustedDemand *= eventMultiplier;
  }
  
  return adjustedDemand;
}

function determineTrend(itemId) {
  const recentUsage = demandForecasts.get(itemId) || [];
  
  if (recentUsage.length < 5) return 'stable';
  
  const recent = recentUsage.slice(-5);
  const older = recentUsage.slice(-10, -5);
  
  const recentAvg = recent.reduce((sum, val) => sum + val, 0) / recent.length;
  const olderAvg = older.length > 0 ? older.reduce((sum, val) => sum + val, 0) / older.length : recentAvg;
  
  const changePercent = (recentAvg - olderAvg) / olderAvg;
  
  if (changePercent > 0.1) return 'increasing';
  if (changePercent < -0.1) return 'decreasing';
  return 'stable';
}

function calculateConfidence(itemId, seasonalFactor) {
  let confidence = performanceMetrics.accuracyRate;
  
  // Adjust based on seasonal certainty
  if (Math.abs(seasonalFactor - 1) > 0.3) {
    confidence *= 0.9;
  }
  
  return Math.max(0.5, Math.min(1.0, confidence));
}

function generateAlertsForItem(item, prediction) {
  const alerts = [];
  
  // Critical stockout alert
  if (prediction.daysUntilStockout <= 1) {
    alerts.push({
      itemId: item.id,
      itemName: item.name,
      severity: 'urgent',
      type: 'stockout',
      message: `${item.name} will run out in ${prediction.daysUntilStockout.toFixed(1)} days`,
      suggestedAction: 'Emergency restock required immediately',
      suggestedOrder: prediction.recommendedOrderQuantity,
      priority: 10,
      estimatedImpact: 'Service disruption',
      timeframe: 'Immediate'
    });
  }
  // Low stock warning
  else if (prediction.currentStock <= item.minimumStock) {
    alerts.push({
      itemId: item.id,
      itemName: item.name,
      severity: 'critical',
      type: 'low_stock',
      message: `${item.name} below minimum stock level (${item.currentStock} ${item.unit})`,
      suggestedAction: `Order ${prediction.recommendedOrderQuantity} ${item.unit} within 2 days`,
      suggestedOrder: prediction.recommendedOrderQuantity,
      priority: 8,
      estimatedImpact: 'Potential stockout',
      timeframe: '2-3 days'
    });
  }
  else if (prediction.daysUntilStockout <= 3) {
    alerts.push({
      itemId: item.id,
      itemName: item.name,
      severity: 'warning',
      type: 'low_stock',
      message: `${item.name} running low - ${prediction.daysUntilStockout.toFixed(1)} days remaining`,
      suggestedAction: `Schedule restock of ${prediction.recommendedOrderQuantity} ${item.unit}`,
      suggestedOrder: prediction.recommendedOrderQuantity,
      priority: 6,
      estimatedImpact: 'Service risk',
      timeframe: '3-5 days'
    });
  }
  
  // Expiration alert
  const daysSinceRestock = (Date.now() - new Date(item.lastRestocked).getTime()) / (24 * 60 * 60 * 1000);
  const daysUntilExpiry = item.shelfLife - daysSinceRestock;
  
  if (daysUntilExpiry <= 2 && item.currentStock > prediction.predictedDemand) {
    alerts.push({
      itemId: item.id,
      itemName: item.name,
      severity: 'warning',
      type: 'expiring',
      message: `${item.name} may expire in ${daysUntilExpiry.toFixed(1)} days with excess stock`,
      suggestedAction: 'Use in promotions or reduce next order',
      priority: 5,
      estimatedImpact: 'Waste prevention',
      timeframe: '1-2 days'
    });
  }
  
  return alerts;
}

function generateRestockRecommendation(item, prediction) {
  let urgency = 'medium';
  
  if (prediction.daysUntilStockout <= 1) urgency = 'critical';
  else if (prediction.daysUntilStockout <= 3) urgency = 'high';
  else if (prediction.daysUntilStockout <= 7) urgency = 'medium';
  else urgency = 'low';
  
  const estimatedCost = prediction.recommendedOrderQuantity * item.costPerUnit;
  
  let reasoning = `Based on ${prediction.predictedDemand.toFixed(1)} ${item.unit}/week demand`;
  if (prediction.seasonalFactor !== 1) {
    reasoning += ` with ${((prediction.seasonalFactor - 1) * 100).toFixed(0)}% seasonal adjustment`;
  }
  
  return {
    itemId: item.id,
    itemName: item.name,
    recommendedQuantity: prediction.recommendedOrderQuantity,
    estimatedCost,
    suggestedDate: prediction.optimalRestockDate,
    supplier: item.supplier,
    reasoning,
    urgency
  };
}

function calculateOverallScore(predictions) {
  const items = Object.values(predictions);
  if (items.length === 0) return 100;
  
  let totalScore = 0;
  let criticalIssues = 0;
  
  items.forEach(prediction => {
    let itemScore = 100;
    
    if (prediction.daysUntilStockout <= 1) {
      itemScore -= 50;
      criticalIssues++;
    } else if (prediction.daysUntilStockout <= 3) {
      itemScore -= 30;
    } else if (prediction.daysUntilStockout <= 7) {
      itemScore -= 15;
    }
    
    itemScore *= prediction.confidenceLevel;
    totalScore += itemScore;
  });
  
  const averageScore = totalScore / items.length;
  const finalScore = averageScore - (criticalIssues * 10);
  
  return Math.max(0, Math.min(100, Math.round(finalScore)));
}

function analyzeCostOptimization(predictions, restockSchedule) {
  const opportunities = [];
  let potentialSavings = 0;
  
  // Bulk order opportunities
  const totalOrderValue = restockSchedule.reduce((sum, rec) => sum + rec.estimatedCost, 0);
  
  if (totalOrderValue > 5000) {
    const bulkSaving = totalOrderValue * 0.08;
    opportunities.push({
      type: 'bulk_order',
      description: 'Combine orders for bulk discount',
      estimatedSaving: bulkSaving,
      implementationEffort: 'low'
    });
    potentialSavings += bulkSaving;
  }
  
  // Seasonal timing opportunities
  Object.values(predictions).forEach(prediction => {
    if (prediction.seasonalFactor < 0.9) {
      const item = inventoryItems.get(prediction.itemId);
      if (item) {
        const seasonalSaving = item.costPerUnit * prediction.recommendedOrderQuantity * 0.1;
        opportunities.push({
          type: 'seasonal_timing',
          description: `Buy ${item.name} during low-demand season`,
          estimatedSaving: seasonalSaving,
          implementationEffort: 'medium'
        });
        potentialSavings += seasonalSaving;
      }
    }
  });
  
  return {
    potentialSavings: Math.round(potentialSavings),
    opportunities: opportunities.slice(0, 5),
    totalOptimizationValue: Math.round(potentialSavings * 12)
  };
}

function analyzeWastage(predictions) {
  const topWastedItems = [];
  let totalWastage = 0;
  let wastedValue = 0;
  
  Object.values(predictions).forEach(prediction => {
    const item = inventoryItems.get(prediction.itemId);
    if (!item) return;
    
    if (item.shelfLife <= 7 && prediction.currentStock > prediction.predictedDemand) {
      const excessStock = prediction.currentStock - prediction.predictedDemand;
      const wastedQuantity = Math.min(excessStock, item.currentStock * 0.1);
      const wastedItemValue = wastedQuantity * item.costPerUnit;
      
      if (wastedQuantity > 0) {
        topWastedItems.push({
          itemId: item.id,
          itemName: item.name,
          wastedQuantity: Math.round(wastedQuantity * 10) / 10,
          wastedValue: Math.round(wastedItemValue),
          cause: item.shelfLife <= 3 ? 'spoilage' : 'expiration'
        });
        
        totalWastage += wastedQuantity;
        wastedValue += wastedItemValue;
      }
    }
  });
  
  const preventionSuggestions = [
    'Implement FIFO (First In, First Out) rotation system',
    'Adjust portion sizes based on actual consumption',
    'Create daily specials for items nearing expiry'
  ];
  
  return {
    totalWastage: Math.round(totalWastage * 10) / 10,
    wastedValue: Math.round(wastedValue),
    topWastedItems: topWastedItems.sort((a, b) => b.wastedValue - a.wastedValue).slice(0, 5),
    preventionSuggestions: preventionSuggestions.slice(0, 3)
  };
}

function updateInventoryLevel(itemId, newQuantity) {
  const item = inventoryItems.get(itemId);
  if (item) {
    item.currentStock = newQuantity;
    return true;
  }
  return false;
}

function recordUsage(itemId, quantityUsed) {
  const item = inventoryItems.get(itemId);
  if (item) {
    item.currentStock = Math.max(0, item.currentStock - quantityUsed);
    
    const forecast = demandForecasts.get(itemId) || [];
    forecast.push(quantityUsed);
    if (forecast.length > 30) forecast.shift();
    demandForecasts.set(itemId, forecast);
  }
}

console.log('Inventory Prediction Agent worker initialized');