// Order Optimization Agent Web Worker
// Runs independently in background for order processing optimization

let agentConfig = {};
let taskQueue = [];
let isProcessing = false;
let kitchenStations = new Map();
let performanceHistory = [];

// Initialize kitchen stations
function initializeKitchenStations() {
  const stations = [
    {
      id: 'grill',
      name: 'Grill Station',
      capacity: 8,
      currentLoad: 0,
      efficiency: 0.85,
      availableStaff: 2,
      specializations: ['tandoor', 'kebabs', 'grilled items']
    },
    {
      id: 'curry',
      name: 'Curry Station', 
      capacity: 12,
      currentLoad: 0,
      efficiency: 0.90,
      availableStaff: 3,
      specializations: ['dal', 'curry', 'gravy dishes', 'rice']
    },
    {
      id: 'cold',
      name: 'Cold Station',
      capacity: 6,
      currentLoad: 0,
      efficiency: 0.95,
      availableStaff: 1,
      specializations: ['salads', 'cold appetizers', 'desserts']
    },
    {
      id: 'beverage',
      name: 'Beverage Station',
      capacity: 15,
      currentLoad: 0,
      efficiency: 0.98,
      availableStaff: 2,
      specializations: ['drinks', 'lassi', 'juices', 'tea', 'coffee']
    },
    {
      id: 'tandoor',
      name: 'Tandoor Station',
      capacity: 6,
      currentLoad: 0,
      efficiency: 0.80,
      availableStaff: 1,
      specializations: ['naan', 'roti', 'tandoori items']
    }
  ];

  stations.forEach(station => {
    kitchenStations.set(station.id, station);
  });
}

// Main message handler
self.onmessage = function(event) {
  const { type, config, task } = event.data;
  
  switch (type) {
    case 'init':
      agentConfig = config;
      initializeKitchenStations();
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
      
    case 'get_status':
      self.postMessage({
        type: 'status',
        data: {
          taskQueue: taskQueue.length,
          kitchenStations: Array.from(kitchenStations.values()),
          performance: performanceHistory.slice(-10)
        }
      });
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
    const result = await processOrderOptimization(task);
    
    // Update performance history
    performanceHistory.push({
      timestamp: new Date().toISOString(),
      executionTime: Date.now() - startTime,
      ordersProcessed: result.batches.reduce((sum, batch) => sum + batch.orders.length, 0),
      efficiency: result.efficiencyGain
    });
    
    // Keep only last 50 entries
    if (performanceHistory.length > 50) {
      performanceHistory = performanceHistory.slice(-50);
    }
    
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

  // Process next task after small delay
  setTimeout(() => processNextTask(), 10);
}

async function processOrderOptimization(task) {
  const { orders, context } = task.data;
  
  // Reset station loads
  kitchenStations.forEach(station => {
    station.currentLoad = 0;
  });
  
  // Analyze and optimize orders
  const analyzedOrders = analyzeOrders(orders);
  const prioritizedOrders = prioritizeOrders(analyzedOrders, context);
  const batches = createOptimizedBatches(prioritizedOrders);
  const kitchenAllocation = allocateToStations(batches);
  const bottlenecks = identifyBottlenecks();
  const recommendations = generateRecommendations(batches, bottlenecks, context);
  const suggestedActions = generateActions(batches, bottlenecks);
  const metrics = calculateEfficiencyMetrics(orders, batches);
  
  return {
    type: 'order_optimization',
    batches,
    totalEstimatedTime: metrics.totalTime,
    efficiencyGain: `${metrics.efficiencyGain}%`,
    recommendations,
    kitchenAllocation,
    bottlenecks,
    suggestedActions
  };
}

function analyzeOrders(orders) {
  return orders.map(order => {
    let totalComplexity = 0;
    let totalPrepTime = 0;
    const requiredStations = new Set();
    
    order.items.forEach(item => {
      totalComplexity += (item.complexity || 1) * item.quantity;
      totalPrepTime += (item.prepTime || 10) * item.quantity;
      requiredStations.add(item.station || 'curry');
    });
    
    // Adjust for special requests
    if (order.specialRequests && order.specialRequests.length > 0) {
      totalComplexity *= 1.2;
      totalPrepTime *= 1.1;
    }
    
    return {
      ...order,
      complexity: totalComplexity,
      estimatedPrepTime: totalPrepTime,
      requiredStations: Array.from(requiredStations)
    };
  });
}

function prioritizeOrders(orders, context) {
  return orders.sort((a, b) => {
    // Priority ranking
    const priorityWeight = { critical: 4, high: 3, normal: 2, low: 1 };
    const priorityDiff = priorityWeight[b.priority || 'normal'] - priorityWeight[a.priority || 'normal'];
    
    if (priorityDiff !== 0) return priorityDiff;
    
    // Order time (older orders first)
    const timeA = new Date(a.orderTime).getTime();
    const timeB = new Date(b.orderTime).getTime();
    const timeDiff = timeA - timeB;
    if (Math.abs(timeDiff) > 300000) return timeDiff; // 5 minutes threshold
    
    // Complexity (simpler orders first for quick wins)
    const complexityDiff = a.complexity - b.complexity;
    if (Math.abs(complexityDiff) > 5) return complexityDiff;
    
    return 0;
  });
}

function createOptimizedBatches(orders) {
  const batches = [];
  const processedOrders = new Set();
  
  // Group orders by station compatibility
  const stationGroups = {};
  
  orders.forEach(order => {
    if (processedOrders.has(order.id)) return;
    
    const primaryStation = determinePrimaryStation(order);
    
    if (!stationGroups[primaryStation]) {
      stationGroups[primaryStation] = [];
    }
    
    stationGroups[primaryStation].push(order);
  });
  
  // Create batches for each station
  Object.entries(stationGroups).forEach(([station, stationOrders]) => {
    const stationCapacity = kitchenStations.get(station)?.capacity || 5;
    
    let currentBatch = [];
    let currentBatchComplexity = 0;
    let batchIndex = 0;
    
    for (const order of stationOrders) {
      const wouldExceedCapacity = currentBatch.length >= stationCapacity;
      const wouldExceedComplexity = currentBatchComplexity + order.complexity > 20;
      
      if (wouldExceedCapacity || wouldExceedComplexity) {
        if (currentBatch.length > 0) {
          batches.push(createBatch(currentBatch, station, batchIndex++));
        }
        
        currentBatch = [order];
        currentBatchComplexity = order.complexity;
      } else {
        currentBatch.push(order);
        currentBatchComplexity += order.complexity;
      }
      
      processedOrders.add(order.id);
    }
    
    if (currentBatch.length > 0) {
      batches.push(createBatch(currentBatch, station, batchIndex));
    }
  });
  
  return batches;
}

function determinePrimaryStation(order) {
  const stationComplexity = {};
  
  order.items.forEach(item => {
    const station = item.station || 'curry';
    if (!stationComplexity[station]) {
      stationComplexity[station] = 0;
    }
    stationComplexity[station] += (item.complexity || 1) * item.quantity;
  });
  
  return Object.entries(stationComplexity).reduce((max, [station, complexity]) => 
    complexity > (stationComplexity[max] || 0) ? station : max
  , order.requiredStations[0] || 'curry');
}

function createBatch(orders, station, index) {
  const totalTime = orders.reduce((sum, order) => sum + order.estimatedPrepTime, 0);
  const maxPriority = orders.reduce((max, order) => {
    const priorityWeight = { critical: 4, high: 3, normal: 2, low: 1 };
    const currentWeight = priorityWeight[max] || 1;
    const orderWeight = priorityWeight[order.priority || 'normal'];
    return orderWeight > currentWeight ? order.priority : max;
  }, 'low');
  
  const uniqueStations = new Set();
  orders.forEach(order => {
    order.requiredStations.forEach(s => uniqueStations.add(s));
  });
  
  const parallelizable = uniqueStations.size > 1;
  const suggestedSequence = [...orders].sort((a, b) => a.complexity - b.complexity);
  
  return {
    id: `batch_${station}_${index}`,
    orders: orders,
    estimatedTime: parallelizable ? Math.max(...orders.map(o => o.estimatedPrepTime)) : totalTime,
    priority: maxPriority,
    suggestedSequence: suggestedSequence,
    station,
    parallelizable,
    dependencies: []
  };
}

function allocateToStations(batches) {
  const allocation = {};
  
  // Initialize allocation map
  kitchenStations.forEach((station, stationId) => {
    allocation[stationId] = [];
  });
  
  // Allocate batches to stations
  batches.forEach(batch => {
    const station = kitchenStations.get(batch.station);
    if (station) {
      allocation[batch.station].push(batch);
      station.currentLoad += batch.orders.length;
    }
  });
  
  return allocation;
}

function identifyBottlenecks() {
  const bottlenecks = [];
  
  kitchenStations.forEach((station, stationId) => {
    const utilizationRate = station.currentLoad / station.capacity;
    const staffRatio = station.currentLoad / station.availableStaff;
    
    let severity = 'low';
    let cause = '';
    let suggestedResolution = '';
    let estimatedDelay = 0;
    
    if (utilizationRate > 0.9) {
      severity = 'critical';
      cause = 'Station over capacity';
      suggestedResolution = 'Redistribute orders to other stations or add temporary capacity';
      estimatedDelay = Math.round((utilizationRate - 0.9) * 30);
    } else if (utilizationRate > 0.7) {
      severity = 'high';
      cause = 'High utilization rate';
      suggestedResolution = 'Monitor closely and prepare backup options';
      estimatedDelay = Math.round((utilizationRate - 0.7) * 15);
    } else if (staffRatio > 3) {
      severity = 'medium';
      cause = 'Insufficient staff for current load';
      suggestedResolution = 'Reallocate staff from less busy stations';
      estimatedDelay = Math.round((staffRatio - 3) * 5);
    }
    
    if (severity !== 'low') {
      bottlenecks.push({
        station: station.name,
        severity,
        cause,
        suggestedResolution,
        estimatedDelay
      });
    }
  });
  
  return bottlenecks;
}

function generateRecommendations(batches, bottlenecks, context) {
  const recommendations = [];
  
  const totalOrders = batches.reduce((sum, batch) => sum + batch.orders.length, 0);
  const parallelBatches = batches.filter(b => b.parallelizable).length;
  
  if (parallelBatches > 0) {
    recommendations.push(`${parallelBatches} batches can be prepared in parallel for faster service`);
  }
  
  if (totalOrders > 20) {
    recommendations.push('High order volume detected - consider prep-ahead strategy for common ingredients');
  }
  
  bottlenecks.forEach(bottleneck => {
    if (bottleneck.severity === 'critical' || bottleneck.severity === 'high') {
      recommendations.push(`${bottleneck.station}: ${bottleneck.suggestedResolution}`);
    }
  });
  
  if (context?.peakHours) {
    recommendations.push('Peak hours detected - prioritize quick-prep items and pre-made components');
  }
  
  return recommendations;
}

function generateActions(batches, bottlenecks) {
  const actions = [];
  
  // Ingredient prep actions
  const commonIngredients = identifyCommonIngredients(batches);
  if (commonIngredients.length > 0) {
    actions.push({
      type: 'prep_ingredients',
      description: `Pre-prep common ingredients: ${commonIngredients.join(', ')}`,
      urgency: 'medium',
      estimatedImpact: '15-20% time reduction'
    });
  }
  
  // Staff reallocation actions
  bottlenecks.forEach(bottleneck => {
    if (bottleneck.severity === 'high' || bottleneck.severity === 'critical') {
      actions.push({
        type: 'reallocate_staff',
        description: `Move additional staff to ${bottleneck.station}`,
        urgency: bottleneck.severity === 'critical' ? 'critical' : 'high',
        estimatedImpact: `Reduce delay by ${Math.round(bottleneck.estimatedDelay * 0.6)} minutes`,
        targetStation: bottleneck.station
      });
    }
  });
  
  return actions;
}

function identifyCommonIngredients(batches) {
  const ingredientCount = {};
  
  batches.forEach(batch => {
    batch.orders.forEach(order => {
      order.items.forEach(item => {
        if (item.ingredients) {
          item.ingredients.forEach(ingredient => {
            ingredientCount[ingredient] = (ingredientCount[ingredient] || 0) + item.quantity;
          });
        }
      });
    });
  });
  
  return Object.entries(ingredientCount)
    .filter(([, count]) => count >= 3)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([ingredient]) => ingredient);
}

function calculateEfficiencyMetrics(originalOrders, batches) {
  const optimizedTime = Math.max(...batches.map(batch => batch.estimatedTime));
  const baselineTime = originalOrders.reduce((sum, order) => sum + (order.estimatedPrepTime || 15), 0);
  
  const efficiency = baselineTime > 0 ? optimizedTime / baselineTime : 1;
  const efficiencyGain = Math.round((1 - efficiency) * 100);
  
  return {
    totalTime: optimizedTime,
    efficiency,
    efficiencyGain: Math.max(0, efficiencyGain)
  };
}

// Initialize when worker starts
console.log('Order Optimization Agent worker initialized');