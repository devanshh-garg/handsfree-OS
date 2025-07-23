// Revenue Optimization Agent Web Worker
// Runs independently in background for revenue optimization analysis

let agentConfig = {};
let taskQueue = [];
let isProcessing = false;
let menuItems = new Map();
let salesHistory = [];
let marketConditions = {};
let pricingHistory = [];
let upsellPerformance = new Map();

// Pricing optimization parameters
const OPTIMIZATION_PARAMETERS = {
  maxPriceIncrease: 0.15, // 15% max increase
  maxPriceDecrease: 0.10, // 10% max decrease
  minProfitMargin: 0.30, // 30% minimum margin
  elasticityThreshold: 0.3, // high elasticity threshold
  testPeriodDays: 14, // A/B test period
  confidenceThreshold: 0.75 // minimum confidence for recommendations
};

// Initialize menu data
function initializeMenuData() {
  const sampleItems = [
    {
      id: 'samosa',
      name: 'Vegetable Samosa',
      category: 'starter',
      basePrice: 120,
      cost: 35,
      profitMargin: 0.71,
      popularity: 0.85,
      preparationTime: 15,
      ingredients: ['potato', 'peas', 'spices', 'pastry'],
      allergens: ['gluten'],
      seasonalDemand: [1.1, 1.0, 0.9, 0.8, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.2],
      elasticity: -0.4
    },
    {
      id: 'paneer_tikka',
      name: 'Paneer Tikka',
      category: 'starter',
      basePrice: 280,
      cost: 110,
      profitMargin: 0.61,
      popularity: 0.78,
      preparationTime: 25,
      ingredients: ['paneer', 'yogurt', 'spices', 'capsicum'],
      allergens: ['dairy'],
      seasonalDemand: [0.9, 0.9, 1.0, 1.1, 1.2, 1.1, 1.0, 1.0, 1.1, 1.2, 1.1, 1.0],
      elasticity: -0.6
    },
    {
      id: 'dal_makhani',
      name: 'Dal Makhani',
      category: 'main',
      basePrice: 320,
      cost: 85,
      profitMargin: 0.73,
      popularity: 0.92,
      preparationTime: 35,
      ingredients: ['black_dal', 'butter', 'cream', 'spices'],
      allergens: ['dairy'],
      seasonalDemand: [1.2, 1.1, 1.0, 0.9, 0.8, 0.9, 1.0, 1.0, 1.1, 1.2, 1.3, 1.2],
      elasticity: -0.3
    },
    {
      id: 'chicken_biryani',
      name: 'Chicken Biryani',
      category: 'main',
      basePrice: 450,
      cost: 180,
      profitMargin: 0.60,
      popularity: 0.88,
      preparationTime: 45,
      ingredients: ['basmati_rice', 'chicken', 'yogurt', 'spices'],
      allergens: ['dairy'],
      seasonalDemand: [1.0, 1.0, 1.1, 1.2, 1.3, 1.2, 1.1, 1.0, 1.0, 1.1, 1.2, 1.1],
      elasticity: -0.5
    },
    {
      id: 'masala_chai',
      name: 'Masala Chai',
      category: 'beverage',
      basePrice: 60,
      cost: 15,
      profitMargin: 0.75,
      popularity: 0.95,
      preparationTime: 8,
      ingredients: ['tea', 'milk', 'spices', 'sugar'],
      allergens: ['dairy'],
      seasonalDemand: [1.4, 1.3, 1.1, 0.9, 0.7, 0.6, 0.7, 0.8, 1.0, 1.2, 1.3, 1.4],
      elasticity: -0.2
    },
    {
      id: 'gulab_jamun',
      name: 'Gulab Jamun',
      category: 'dessert',
      basePrice: 140,
      cost: 40,
      profitMargin: 0.71,
      popularity: 0.68,
      preparationTime: 20,
      ingredients: ['milk_powder', 'flour', 'sugar_syrup', 'ghee'],
      allergens: ['dairy', 'gluten'],
      seasonalDemand: [1.2, 1.1, 1.0, 1.0, 0.9, 1.0, 1.0, 1.1, 1.2, 1.3, 1.2, 1.3],
      elasticity: -0.5
    }
  ];

  sampleItems.forEach(item => {
    menuItems.set(item.id, item);
  });
}

// Initialize market conditions
function initializeMarketConditions() {
  marketConditions = {
    competitorPricing: {
      'starter': 150,
      'main': 350,
      'beverage': 80,
      'dessert': 120
    },
    economicIndex: 0.75,
    seasonalFactor: 1.1,
    demandLevel: 'medium',
    dayType: 'weekday',
    weatherImpact: 0.0
  };
}

// Generate historical sales data
function generateHistoricalSalesData() {
  const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  for (let day = 0; day < 30; day++) {
    const date = new Date(startDate.getTime() + day * 24 * 60 * 60 * 1000);
    const transactionCount = Math.floor(Math.random() * 30) + 20;
    
    for (let i = 0; i < transactionCount; i++) {
      const items = Array.from(menuItems.values());
      const randomItem = items[Math.floor(Math.random() * items.length)];
      
      const quantity = randomItem.popularity > 0.8 ? 
        Math.floor(Math.random() * 3) + 1 : 
        Math.floor(Math.random() * 2) + 1;
      
      salesHistory.push({
        itemId: randomItem.id,
        quantity,
        revenue: randomItem.basePrice * quantity,
        timestamp: new Date(date.getTime() + Math.random() * 24 * 60 * 60 * 1000).toISOString(),
        tableId: `table${Math.floor(Math.random() * 20) + 1}`,
        customerType: Math.random() > 0.7 ? 'regular' : Math.random() > 0.9 ? 'vip' : 'new',
        discountApplied: Math.random() > 0.8 ? Math.random() * 0.1 : 0,
        upsellSuccess: Math.random() > 0.7
      });
    }
  }
}

// Main message handler
self.onmessage = function(event) {
  const { type, config, task, data } = event.data;
  
  switch (type) {
    case 'init':
      agentConfig = config;
      initializeMenuData();
      initializeMarketConditions();
      generateHistoricalSalesData();
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
      
    case 'update_market_conditions':
      marketConditions = { ...marketConditions, ...data };
      break;
      
    case 'record_sale':
      recordSale(data);
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
    const result = await processRevenueOptimization(task);
    
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

async function processRevenueOptimization(task) {
  const { context } = task.data;
  
  // Update market conditions if provided
  if (context?.marketConditions) {
    marketConditions = { ...marketConditions, ...context.marketConditions };
  }
  
  const analysisWindow = context?.analysisWindow || 30;
  const relevantSales = getRelevantSalesData(analysisWindow);
  
  // Calculate current revenue metrics
  const currentRevenue = calculateCurrentRevenue(relevantSales);
  
  // Generate pricing recommendations
  const optimizedPricing = await generatePricingRecommendations(relevantSales, context);
  
  // Identify upselling opportunities
  const upsellOpportunities = identifyUpsellOpportunities(relevantSales);
  
  // Create demand forecast
  const demandForecast = generateDemandForecast(relevantSales);
  
  // Analyze profitability
  const profitabilityAnalysis = analyzeProfitability(relevantSales);
  
  // Assess market positioning
  const marketPositioning = assessMarketPositioning();
  
  // Calculate projected revenue with optimizations
  const projectedRevenue = calculateProjectedRevenue(currentRevenue, optimizedPricing, upsellOpportunities);
  
  // Generate actionable items
  const actionItems = generateRevenueActionItems(optimizedPricing, upsellOpportunities, profitabilityAnalysis);
  
  // Assess implementation risks
  const riskAssessment = assessImplementationRisks(optimizedPricing, context?.riskTolerance || 'medium');
  
  const potentialIncrease = ((projectedRevenue - currentRevenue) / currentRevenue * 100).toFixed(1);
  
  return {
    type: 'revenue_optimization',
    currentRevenue: Math.round(currentRevenue),
    projectedRevenue: Math.round(projectedRevenue),
    potentialIncrease: `${potentialIncrease}%`,
    optimizedPricing,
    upsellOpportunities,
    demandForecast,
    profitabilityAnalysis,
    marketPositioning,
    actionItems,
    riskAssessment
  };
}

function getRelevantSalesData(days) {
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return salesHistory.filter(sale => new Date(sale.timestamp) >= cutoffDate);
}

function calculateCurrentRevenue(salesData) {
  return salesData.reduce((total, sale) => total + sale.revenue, 0);
}

async function generatePricingRecommendations(salesData, context) {
  const recommendations = {};

  for (const [itemId, item] of menuItems.entries()) {
    const itemSales = salesData.filter(sale => sale.itemId === itemId);
    
    if (itemSales.length < 5) continue;

    const recommendation = await optimizeItemPricing(item, itemSales, context);
    if (recommendation) {
      recommendations[itemId] = recommendation;
    }
  }

  return recommendations;
}

async function optimizeItemPricing(item, salesData, context) {
  const totalQuantity = salesData.reduce((sum, sale) => sum + sale.quantity, 0);
  const totalRevenue = salesData.reduce((sum, sale) => sum + sale.revenue, 0);
  
  // Calculate demand elasticity
  const elasticity = calculateDemandElasticity(item, salesData);
  
  // Consider market conditions
  const marketAdjustment = calculateMarketAdjustment(item);
  
  // Calculate optimal price
  let recommendedPrice = calculateOptimalPrice(item, elasticity, marketAdjustment);
  
  // Apply constraints
  recommendedPrice = applyPricingConstraints(item, recommendedPrice);
  
  const priceChange = recommendedPrice - item.basePrice;
  const priceChangePercent = (priceChange / item.basePrice) * 100;
  
  // Skip if change is too small
  if (Math.abs(priceChangePercent) < 2) return null;
  
  // Calculate expected impact
  const expectedImpact = calculateExpectedImpact(item, recommendedPrice, elasticity);
  
  // Determine confidence and risk
  const confidence = calculateRecommendationConfidence(item, salesData, elasticity);
  const implementationRisk = assessPricingRisk(item, priceChangePercent);
  
  if (confidence < OPTIMIZATION_PARAMETERS.confidenceThreshold) return null;

  return {
    itemId: item.id,
    itemName: item.name,
    currentPrice: item.basePrice,
    recommendedPrice: Math.round(recommendedPrice),
    priceChange: Math.round(priceChange),
    priceChangePercent: Math.round(priceChangePercent * 10) / 10,
    reasoning: generatePricingReasoning(item, priceChangePercent, marketAdjustment),
    expectedImpact,
    confidence: Math.round(confidence * 100) / 100,
    implementationRisk,
    testPeriod: implementationRisk === 'high' ? OPTIMIZATION_PARAMETERS.testPeriodDays : undefined
  };
}

function calculateDemandElasticity(item, salesData) {
  const demandVariation = calculateDemandVariation(salesData);
  const baseElasticity = item.elasticity;
  
  const adjustedElasticity = baseElasticity * (1 + demandVariation * 0.2);
  
  return Math.max(-1, Math.min(1, adjustedElasticity));
}

function calculateDemandVariation(salesData) {
  if (salesData.length < 7) return 0;
  
  const dailyTotals = {};
  
  salesData.forEach(sale => {
    const dateKey = new Date(sale.timestamp).toDateString();
    dailyTotals[dateKey] = (dailyTotals[dateKey] || 0) + sale.quantity;
  });
  
  const quantities = Object.values(dailyTotals);
  const mean = quantities.reduce((sum, q) => sum + q, 0) / quantities.length;
  const variance = quantities.reduce((sum, q) => sum + Math.pow(q - mean, 2), 0) / quantities.length;
  const stdDev = Math.sqrt(variance);
  
  return mean > 0 ? stdDev / mean : 0;
}

function calculateMarketAdjustment(item) {
  const competitorPrice = marketConditions.competitorPricing[item.category];
  const priceRatio = item.basePrice / competitorPrice;
  
  let adjustment = 1.0;
  
  // Economic conditions adjustment
  adjustment *= (0.8 + 0.4 * marketConditions.economicIndex);
  
  // Seasonal adjustment
  adjustment *= marketConditions.seasonalFactor;
  
  // Demand level adjustment
  switch (marketConditions.demandLevel) {
    case 'peak':
      adjustment *= 1.15;
      break;
    case 'high':
      adjustment *= 1.08;
      break;
    case 'low':
      adjustment *= 0.92;
      break;
  }
  
  // Competitive positioning
  if (priceRatio < 0.8) adjustment *= 1.05;
  else if (priceRatio > 1.2) adjustment *= 0.95;
  
  return adjustment;
}

function calculateOptimalPrice(item, elasticity, marketAdjustment) {
  const basePriceAdjusted = item.basePrice * marketAdjustment;
  
  // Consider elasticity
  const elasticityFactor = 1 + (Math.abs(elasticity) - 0.5) * 0.1;
  
  // Consider profit margin optimization
  const marginOptimization = item.profitMargin < 0.5 ? 1.05 : 1.0;
  
  return basePriceAdjusted * elasticityFactor * marginOptimization;
}

function applyPricingConstraints(item, recommendedPrice) {
  const maxIncrease = item.basePrice * (1 + OPTIMIZATION_PARAMETERS.maxPriceIncrease);
  const maxDecrease = item.basePrice * (1 - OPTIMIZATION_PARAMETERS.maxPriceDecrease);
  
  // Ensure minimum profit margin
  const minPriceForMargin = item.cost / (1 - OPTIMIZATION_PARAMETERS.minProfitMargin);
  
  let constrainedPrice = Math.max(minPriceForMargin, Math.min(maxIncrease, Math.max(maxDecrease, recommendedPrice)));
  
  // Round to nearest 10
  constrainedPrice = Math.round(constrainedPrice / 10) * 10;
  
  return constrainedPrice;
}

function calculateExpectedImpact(item, newPrice, elasticity) {
  const priceChangePercent = (newPrice - item.basePrice) / item.basePrice;
  
  // Estimate demand change using elasticity
  const demandChangePercent = elasticity * priceChangePercent;
  
  // Calculate revenue change
  const revenueChangePercent = priceChangePercent + demandChangePercent + (priceChangePercent * demandChangePercent);
  
  // Calculate profit change
  const newMargin = (newPrice - item.cost) / newPrice;
  const profitChangePercent = (newMargin / item.profitMargin - 1) * (1 + demandChangePercent);
  
  return {
    revenueChange: Math.round(revenueChangePercent * 100 * 10) / 10,
    demandChange: Math.round(demandChangePercent * 100 * 10) / 10,
    profitChange: Math.round(profitChangePercent * 100 * 10) / 10
  };
}

function calculateRecommendationConfidence(item, salesData, elasticity) {
  let confidence = 0.8;
  
  const dataPoints = salesData.length;
  if (dataPoints > 50) confidence += 0.1;
  else if (dataPoints < 20) confidence -= 0.2;
  
  if (item.popularity > 0.8) confidence += 0.1;
  else if (item.popularity < 0.5) confidence -= 0.1;
  
  if (Math.abs(elasticity) < 0.3) confidence += 0.1;
  else if (Math.abs(elasticity) > 0.6) confidence -= 0.1;
  
  return Math.max(0, Math.min(1, confidence));
}

function assessPricingRisk(item, priceChangePercent) {
  const absChange = Math.abs(priceChangePercent);
  
  if (absChange > 10 || (priceChangePercent > 0 && Math.abs(item.elasticity) > 0.5)) {
    return 'high';
  } else if (absChange > 5 || Math.abs(item.elasticity) > 0.3) {
    return 'medium';
  } else {
    return 'low';
  }
}

function generatePricingReasoning(item, priceChangePercent, marketAdjustment) {
  const reasons = [];
  
  if (priceChangePercent > 0) {
    if (item.popularity > 0.8) reasons.push('High demand item can support price increase');
    if (marketAdjustment > 1.05) reasons.push('Market conditions favor price increase');
    if (item.profitMargin < 0.5) reasons.push('Low margin item needs price optimization');
  } else {
    if (item.popularity < 0.6) reasons.push('Low demand suggests price reduction may boost sales');
    if (marketAdjustment < 0.95) reasons.push('Market conditions suggest competitive pricing');
    if (Math.abs(item.elasticity) > 0.5) reasons.push('Price-sensitive item benefits from lower pricing');
  }
  
  if (marketConditions.demandLevel === 'peak') {
    reasons.push('Peak demand period allows for premium pricing');
  }
  
  return reasons.join('; ') || 'Based on demand analysis and market conditions';
}

function identifyUpsellOpportunities(salesData) {
  const opportunities = [];
  
  // Generate predefined combo opportunities
  const comboOpportunities = [
    {
      id: 'combo_1',
      type: 'combo',
      primaryItem: 'Dal Makhani',
      suggestedItems: ['Masala Chai'],
      bundlePrice: 350,
      individualPrice: 380,
      discount: 8,
      expectedUplift: '15-20%',
      customerSegment: 'all',
      successProbability: 0.6,
      profitImpact: 185,
      description: 'Dal Makhani + Masala Chai combo with 8% discount'
    },
    {
      id: 'combo_2',
      type: 'combo',
      primaryItem: 'Chicken Biryani',
      suggestedItems: ['Gulab Jamun'],
      bundlePrice: 560,
      individualPrice: 590,
      discount: 5,
      expectedUplift: '12-18%',
      customerSegment: 'all', 
      successProbability: 0.5,
      profitImpact: 340,
      description: 'Chicken Biryani + Gulab Jamun combo with 5% discount'
    }
  ];
  
  opportunities.push(...comboOpportunities);
  
  // Generate complement opportunities
  const complementOpportunities = [
    {
      id: 'complement_1',
      type: 'complement',
      primaryItem: 'Paneer Tikka',
      suggestedItems: ['Masala Chai'],
      bundlePrice: 340,
      individualPrice: 340,
      discount: 0,
      expectedUplift: '10%',
      customerSegment: 'all',
      successProbability: 0.3,
      profitImpact: 45,
      description: 'Suggest Masala Chai with Paneer Tikka'
    }
  ];
  
  opportunities.push(...complementOpportunities);
  
  return opportunities.sort((a, b) => b.profitImpact - a.profitImpact).slice(0, 10);
}

function generateDemandForecast(salesData) {
  const forecast = {};
  const trendAnalysis = {};
  const seasonalFactors = {};
  const confidenceInterval = {};
  
  menuItems.forEach((item, itemId) => {
    const itemSales = salesData.filter(sale => sale.itemId === itemId);
    
    if (itemSales.length >= 7) {
      // Generate 7-day forecast
      const weeklyForecast = generateItemForecast(item, itemSales);
      forecast[itemId] = weeklyForecast;
      
      // Analyze trend
      trendAnalysis[itemId] = analyzeSalesTrend(itemSales);
      
      // Get seasonal factor
      const currentMonth = new Date().getMonth();
      seasonalFactors[itemId] = item.seasonalDemand[currentMonth];
      
      // Calculate confidence interval
      const avgDaily = weeklyForecast.reduce((sum, val) => sum + val, 0) / 7;
      const variance = calculateForecastVariance(itemSales);
      confidenceInterval[itemId] = {
        lower: Math.max(0, avgDaily - variance),
        upper: avgDaily + variance
      };
    }
  });
  
  return {
    period: 'daily',
    forecast,
    trendAnalysis,
    seasonalFactors,
    confidenceInterval
  };
}

function generateItemForecast(item, salesData) {
  const recentDays = 7;
  
  // Group by day
  const salesByDay = {};
  salesData.forEach(sale => {
    const dateKey = new Date(sale.timestamp).toDateString();
    salesByDay[dateKey] = (salesByDay[dateKey] || 0) + sale.quantity;
  });
  
  const sortedDates = Object.keys(salesByDay).sort();
  const recentSales = sortedDates.slice(-recentDays).map(date => salesByDay[date]);
  
  if (recentSales.length === 0) return Array(7).fill(0);
  
  const avgDaily = recentSales.reduce((sum, val) => sum + val, 0) / recentSales.length;
  
  // Apply seasonal and popularity adjustments
  const currentMonth = new Date().getMonth();
  const seasonalAdjustment = item.seasonalDemand[currentMonth];
  const forecastBase = avgDaily * seasonalAdjustment * item.popularity;
  
  // Generate 7-day forecast with variation
  return Array(7).fill(0).map(() => {
    const dayVariation = 0.8 + Math.random() * 0.4;
    return Math.max(0, Math.round(forecastBase * dayVariation));
  });
}

function analyzeSalesTrend(salesData) {
  if (salesData.length < 14) return 'stable';
  
  const sortedSales = salesData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const midPoint = Math.floor(sortedSales.length / 2);
  
  const firstHalf = sortedSales.slice(0, midPoint);
  const secondHalf = sortedSales.slice(midPoint);
  
  const firstHalfAvg = firstHalf.reduce((sum, sale) => sum + sale.quantity, 0) / firstHalf.length;
  const secondHalfAvg = secondHalf.reduce((sum, sale) => sum + sale.quantity, 0) / secondHalf.length;
  
  const changePercent = (secondHalfAvg - firstHalfAvg) / firstHalfAvg;
  
  if (changePercent > 0.15) return 'increasing';
  if (changePercent < -0.15) return 'decreasing';
  return 'stable';
}

function calculateForecastVariance(salesData) {
  const dailyTotals = {};
  
  salesData.forEach(sale => {
    const dateKey = new Date(sale.timestamp).toDateString();
    dailyTotals[dateKey] = (dailyTotals[dateKey] || 0) + sale.quantity;
  });
  
  const quantities = Object.values(dailyTotals);
  if (quantities.length < 2) return 0;
  
  const mean = quantities.reduce((sum, q) => sum + q, 0) / quantities.length;
  const variance = quantities.reduce((sum, q) => sum + Math.pow(q - mean, 2), 0) / quantities.length;
  
  return Math.sqrt(variance);
}

function analyzeProfitability(salesData) {
  const itemPerformance = {};
  
  // Calculate performance metrics for each item
  salesData.forEach(sale => {
    const item = menuItems.get(sale.itemId);
    if (item) {
      if (!itemPerformance[sale.itemId]) {
        itemPerformance[sale.itemId] = { revenue: 0, quantity: 0, profit: 0 };
      }
      
      itemPerformance[sale.itemId].revenue += sale.revenue;
      itemPerformance[sale.itemId].quantity += sale.quantity;
      itemPerformance[sale.itemId].profit += (item.basePrice - item.cost) * sale.quantity;
    }
  });
  
  // Create performers array
  const performers = Object.entries(itemPerformance).map(([itemId, perf]) => {
    const item = menuItems.get(itemId);
    return {
      itemId,
      itemName: item.name,
      revenue: perf.revenue,
      profit: perf.profit,
      profitMargin: perf.profit / perf.revenue,
      volumeSold: perf.quantity
    };
  });
  
  const sortedByProfit = [...performers].sort((a, b) => b.profit - a.profit);
  const topPerformers = sortedByProfit.slice(0, 5);
  
  const bottomPerformers = sortedByProfit.slice(-3).map(performer => ({
    ...performer,
    improvementPotential: calculateImprovementPotential(performer.itemId)
  }));
  
  // Category performance
  const categoryPerformance = {};
  
  performers.forEach(performer => {
    const item = menuItems.get(performer.itemId);
    const category = item.category;
    
    if (!categoryPerformance[category]) {
      categoryPerformance[category] = {
        totalRevenue: 0,
        totalProfit: 0,
        averageMargin: 0,
        itemCount: 0
      };
    }
    
    categoryPerformance[category].totalRevenue += performer.revenue;
    categoryPerformance[category].totalProfit += performer.profit;
    categoryPerformance[category].itemCount++;
  });
  
  // Calculate average margins for categories
  Object.keys(categoryPerformance).forEach(category => {
    const cat = categoryPerformance[category];
    cat.averageMargin = cat.totalProfit / cat.totalRevenue;
  });
  
  // Overall metrics
  const totalRevenue = performers.reduce((sum, p) => sum + p.revenue, 0);
  const totalProfit = performers.reduce((sum, p) => sum + p.profit, 0);
  
  return {
    topPerformers,
    bottomPerformers,
    categoryPerformance,
    overallMetrics: {
      totalRevenue: Math.round(totalRevenue),
      totalProfit: Math.round(totalProfit),
      averageMargin: Math.round((totalProfit / totalRevenue) * 1000) / 10,
      revenuePerItem: Math.round(totalRevenue / performers.length)
    }
  };
}

function calculateImprovementPotential(itemId) {
  const item = menuItems.get(itemId);
  if (!item) return 'Unknown';
  
  const improvements = [];
  
  if (item.profitMargin < 0.5) improvements.push('Increase pricing');
  if (item.popularity < 0.6) improvements.push('Marketing boost');
  if (item.preparationTime > 30) improvements.push('Process optimization');
  
  return improvements.join(', ') || 'Menu repositioning';
}

function assessMarketPositioning() {
  const competitiveAnalysis = {};
  
  menuItems.forEach((item, itemId) => {
    const marketAverage = marketConditions.competitorPricing[item.category];
    const priceRatio = item.basePrice / marketAverage;
    
    let positioningStrategy;
    if (priceRatio > 1.15) positioningStrategy = 'premium';
    else if (priceRatio < 0.85) positioningStrategy = 'value';
    else positioningStrategy = 'competitive';
    
    competitiveAnalysis[itemId] = {
      ourPrice: item.basePrice,
      marketAverage,
      positioningStrategy,
      priceAdvantage: Math.round((item.basePrice - marketAverage) / marketAverage * 100)
    };
  });
  
  return {
    competitiveAnalysis,
    valueProposition: [
      'Authentic Indian cuisine with premium ingredients',
      'Fast service with traditional flavors',
      'Customizable spice levels for all preferences'
    ],
    differentiationFactors: [
      'Fresh daily preparation',
      'Regional specialty dishes',
      'Extensive vegetarian options'
    ],
    marketShare: {
      'starter': 0.18,
      'main': 0.22,
      'beverage': 0.15,
      'dessert': 0.12
    }
  };
}

function calculateProjectedRevenue(currentRevenue, pricingRecommendations, upsellOpportunities) {
  let projectedRevenue = currentRevenue;
  
  // Apply pricing changes
  Object.values(pricingRecommendations).forEach(rec => {
    const revenueImpact = (currentRevenue * 0.1) * (rec.expectedImpact.revenueChange / 100);
    projectedRevenue += revenueImpact;
  });
  
  // Apply upsell opportunities
  const upsellImpact = upsellOpportunities.reduce((sum, opp) => {
    const estimatedMonthlyImpact = opp.profitImpact * 30 * opp.successProbability;
    return sum + estimatedMonthlyImpact;
  }, 0);
  
  projectedRevenue += upsellImpact;
  
  return projectedRevenue;
}

function generateRevenueActionItems(pricingRecommendations, upsellOpportunities, profitabilityAnalysis) {
  const actionItems = [];
  let itemId = 1;
  
  // High-impact pricing changes
  Object.values(pricingRecommendations)
    .filter(rec => Math.abs(rec.expectedImpact.revenueChange) > 5)
    .forEach(rec => {
      actionItems.push({
        id: `revenue_action_${itemId++}`,
        type: 'pricing_adjustment',
        priority: rec.implementationRisk === 'high' ? 'medium' : 'high',
        description: `Adjust ${rec.itemName} price to ₹${rec.recommendedPrice}`,
        expectedImpact: Math.abs(rec.expectedImpact.revenueChange),
        implementationEffort: rec.implementationRisk === 'high' ? 'medium' : 'low',
        timeframe: rec.testPeriod ? `${rec.testPeriod}-day test period` : 'Immediate',
        dependencies: rec.implementationRisk === 'high' ? ['A/B testing setup'] : [],
        measurableGoal: `${rec.expectedImpact.revenueChange > 0 ? 'Increase' : 'Decrease'} revenue by ${Math.abs(rec.expectedImpact.revenueChange)}%`
      });
    });
  
  // Top upsell opportunities
  upsellOpportunities.slice(0, 3).forEach(opp => {
    actionItems.push({
      id: `revenue_action_${itemId++}`,
      type: 'upsell_training',
      priority: 'medium',
      description: `Train staff on ${opp.description}`,
      expectedImpact: opp.profitImpact * 30,
      implementationEffort: 'medium',
      timeframe: '2 weeks training + 1 month monitoring',
      dependencies: ['Staff training materials', 'POS system updates'],
      measurableGoal: `Achieve ${opp.expectedUplift} uplift in average order value`
    });
  });
  
  return actionItems.sort((a, b) => {
    const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    return priorityOrder[b.priority] - priorityOrder[a.priority];
  });
}

function assessImplementationRisks(pricingRecommendations, riskTolerance) {
  const pricingRisks = [];
  
  // Assess individual pricing risks
  Object.values(pricingRecommendations).forEach(rec => {
    if (rec.priceChangePercent > 8) {
      pricingRisks.push({
        type: 'customer_churn',
        probability: rec.implementationRisk === 'high' ? 'high' : 'medium',
        impact: 'high',
        description: `${rec.itemName} price increase of ${rec.priceChangePercent}% may reduce demand`,
        mitigation: 'Implement gradual price increase over 2-3 weeks'
      });
    }
    
    if (rec.priceChangePercent < -5) {
      pricingRisks.push({
        type: 'brand_perception',
        probability: 'medium',
        impact: 'medium',
        description: `${rec.itemName} price decrease may signal quality concerns`,
        mitigation: 'Position as promotional pricing or value offering'
      });
    }
  });
  
  // Market risks
  const marketRisks = [
    {
      factor: 'Economic downturn',
      impact: -0.15,
      timeframe: '3-6 months',
      contingencyPlan: 'Introduce value menu options'
    },
    {
      factor: 'New competitor entry',
      impact: -0.08,
      timeframe: '1-3 months',
      contingencyPlan: 'Enhance differentiation and customer loyalty programs'
    }
  ];
  
  // Calculate overall risk score
  const pricingRiskScore = pricingRisks.length * 2;
  const marketRiskScore = marketRisks.reduce((sum, risk) => sum + Math.abs(risk.impact) * 10, 0);
  const overallRiskScore = Math.min(10, pricingRiskScore + marketRiskScore);
  
  // Adjust based on risk tolerance
  const toleranceMultiplier = { low: 1.3, medium: 1.0, high: 0.7 };
  const adjustedRiskScore = overallRiskScore * toleranceMultiplier[riskTolerance];
  
  return {
    pricingRisks,
    marketRisks,
    overallRiskScore: Math.round(adjustedRiskScore * 10) / 10
  };
}

function recordSale(saleData) {
  const sale = {
    ...saleData,
    timestamp: new Date().toISOString()
  };
  
  salesHistory.push(sale);
  
  // Keep only last 90 days of data
  const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  salesHistory = salesHistory.filter(s => new Date(s.timestamp) >= cutoffDate);
}

console.log('Revenue Optimization Agent worker initialized');