import { getAgentOrchestrator } from './AgentOrchestrator';

interface Order {
  id: string;
  tableId: string;
  items: OrderItem[];
  status: 'pending' | 'preparing' | 'ready' | 'served';
  priority: 'low' | 'normal' | 'high' | 'critical';
  estimatedPrepTime: number;
  orderTime: Date;
  complexity: number;
  specialRequests?: string[];
  allergens?: string[];
}

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  category: 'starter' | 'main' | 'dessert' | 'beverage';
  prepTime: number;
  complexity: number;
  ingredients: string[];
  station: 'grill' | 'curry' | 'cold' | 'beverage' | 'tandoor';
}

interface KitchenStation {
  id: string;
  name: string;
  capacity: number;
  currentLoad: number;
  efficiency: number;
  availableStaff: number;
  specializations: string[];
}

interface OptimizationResult {
  type: 'order_optimization';
  batches: OrderBatch[];
  totalEstimatedTime: number;
  efficiencyGain: string;
  recommendations: string[];
  kitchenAllocation: { [stationId: string]: OrderBatch[] };
  bottlenecks: Bottleneck[];
  suggestedActions: Action[];
}

interface OrderBatch {
  id: string;
  orders: Order[];
  estimatedTime: number;
  priority: 'low' | 'normal' | 'high' | 'critical';
  suggestedSequence: Order[];
  station: string;
  parallelizable: boolean;
  dependencies: string[];
}

interface Bottleneck {
  station: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  cause: string;
  suggestedResolution: string;
  estimatedDelay: number;
}

interface Action {
  type: 'prep_ingredients' | 'reallocate_staff' | 'prioritize_order' | 'parallel_cooking' | 'notify_customer';
  description: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  estimatedImpact: string;
  targetStation?: string;
  targetOrder?: string;
}

export class OrderOptimizationAgent {
  private kitchenStations: Map<string, KitchenStation> = new Map();
  private activeOptimizations: Map<string, OptimizationResult> = new Map();
  private performanceHistory: Array<{ timestamp: Date; efficiency: number; ordersProcessed: number }> = [];
  
  constructor() {
    this.initializeKitchenStations();
  }

  private initializeKitchenStations(): void {
    const stations: KitchenStation[] = [
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
      this.kitchenStations.set(station.id, station);
    });
  }

  async optimizeOrders(orders: Order[], context?: {
    peakHours?: boolean;
    staffAvailability?: number;
    specialEvents?: string[];
    customerWaitTimes?: { [tableId: string]: number };
  }): Promise<OptimizationResult> {
    console.log(`Order Optimization Agent: Processing ${orders.length} orders`);
    
    // Reset station loads
    this.resetStationLoads();
    
    // Analyze orders and group by optimization criteria
    const analyzedOrders = this.analyzeOrders(orders);
    const prioritizedOrders = this.prioritizeOrders(analyzedOrders, context);
    
    // Create optimized batches
    const batches = this.createOptimizedBatches(prioritizedOrders);
    
    // Allocate to kitchen stations
    const kitchenAllocation = this.allocateToStations(batches);
    
    // Identify bottlenecks
    const bottlenecks = this.identifyBottlenecks();
    
    // Generate actionable recommendations
    const recommendations = this.generateRecommendations(batches, bottlenecks, context);
    const suggestedActions = this.generateActions(batches, bottlenecks);
    
    // Calculate efficiency metrics
    const metrics = this.calculateEfficiencyMetrics(orders, batches);
    
    const result: OptimizationResult = {
      type: 'order_optimization',
      batches,
      totalEstimatedTime: metrics.totalTime,
      efficiencyGain: `${metrics.efficiencyGain}%`,
      recommendations,
      kitchenAllocation,
      bottlenecks,
      suggestedActions
    };
    
    // Store optimization result
    const optimizationId = `opt_${Date.now()}`;
    this.activeOptimizations.set(optimizationId, result);
    
    // Update performance history
    this.updatePerformanceHistory(orders.length, metrics.efficiency);
    
    return result;
  }

  private analyzeOrders(orders: Order[]): (Order & { requiredStations: string[] })[] {
    return orders.map(order => {
      // Calculate complexity based on items
      let totalComplexity = 0;
      let totalPrepTime = 0;
      const requiredStations = new Set<string>();
      
      order.items.forEach(item => {
        totalComplexity += item.complexity * item.quantity;
        totalPrepTime += item.prepTime * item.quantity;
        requiredStations.add(item.station);
      });
      
      // Adjust for special requests and allergens
      if (order.specialRequests && order.specialRequests.length > 0) {
        totalComplexity *= 1.2;
        totalPrepTime *= 1.1;
      }
      
      if (order.allergens && order.allergens.length > 0) {
        totalComplexity *= 1.3;
        totalPrepTime *= 1.15;
      }
      
      return {
        ...order,
        complexity: totalComplexity,
        estimatedPrepTime: totalPrepTime,
        requiredStations: Array.from(requiredStations)
      } as Order & { requiredStations: string[] };
    });
  }

  private prioritizeOrders(orders: (Order & { requiredStations: string[] })[], context?: any): (Order & { requiredStations: string[] })[] {
    return orders.sort((a, b) => {
      // Priority ranking: critical > high > normal > low
      const priorityWeight = { critical: 4, high: 3, normal: 2, low: 1 };
      const priorityDiff = priorityWeight[b.priority] - priorityWeight[a.priority];
      
      if (priorityDiff !== 0) return priorityDiff;
      
      // Order time (older orders first)
      const timeDiff = a.orderTime.getTime() - b.orderTime.getTime();
      if (Math.abs(timeDiff) > 300000) return timeDiff; // 5 minutes threshold
      
      // Complexity (simpler orders first for quick wins)
      const complexityDiff = a.complexity - b.complexity;
      if (Math.abs(complexityDiff) > 5) return complexityDiff;
      
      // Customer wait time consideration
      if (context?.customerWaitTimes) {
        const waitA = context.customerWaitTimes[a.tableId] || 0;
        const waitB = context.customerWaitTimes[b.tableId] || 0;
        if (Math.abs(waitA - waitB) > 10) return waitB - waitA; // Prioritize longer waits
      }
      
      return 0;
    });
  }

  private createOptimizedBatches(orders: (Order & { requiredStations: string[] })[]): OrderBatch[] {
    const batches: OrderBatch[] = [];
    const processedOrders = new Set<string>();
    
    // Group orders by station compatibility
    const stationGroups: { [station: string]: (Order & { requiredStations: string[] })[] } = {};
    
    orders.forEach(order => {
      if (processedOrders.has(order.id)) return;
      
      // Find primary station (most complex items)
      const primaryStation = this.determinePrimaryStation(order);
      
      if (!stationGroups[primaryStation]) {
        stationGroups[primaryStation] = [];
      }
      
      stationGroups[primaryStation].push(order);
    });
    
    // Create batches for each station
    Object.entries(stationGroups).forEach(([station, stationOrders]) => {
      const stationCapacity = this.kitchenStations.get(station)?.capacity || 5;
      
      // Split into batches based on capacity and complexity
      let currentBatch: (Order & { requiredStations: string[] })[] = [];
      let currentBatchComplexity = 0;
      let batchIndex = 0;
      
      for (const order of stationOrders) {
        const wouldExceedCapacity = currentBatch.length >= stationCapacity;
        const wouldExceedComplexity = currentBatchComplexity + order.complexity > 20;
        
        if (wouldExceedCapacity || wouldExceedComplexity) {
          // Create batch from current orders
          if (currentBatch.length > 0) {
            batches.push(this.createBatch(currentBatch, station, batchIndex++));
          }
          
          // Start new batch
          currentBatch = [order];
          currentBatchComplexity = order.complexity;
        } else {
          currentBatch.push(order);
          currentBatchComplexity += order.complexity;
        }
        
        processedOrders.add(order.id);
      }
      
      // Add remaining batch
      if (currentBatch.length > 0) {
        batches.push(this.createBatch(currentBatch, station, batchIndex));
      }
    });
    
    return batches;
  }

  private determinePrimaryStation(order: Order & { requiredStations: string[] }): string {
    // Find station with highest complexity items
    const stationComplexity: { [station: string]: number } = {};
    
    order.items.forEach(item => {
      if (!stationComplexity[item.station]) {
        stationComplexity[item.station] = 0;
      }
      stationComplexity[item.station] += item.complexity * item.quantity;
    });
    
    return Object.entries(stationComplexity).reduce((max, [station, complexity]) => 
      complexity > (stationComplexity[max] || 0) ? station : max
    , order.requiredStations[0]);
  }

  private createBatch(orders: (Order & { requiredStations: string[] })[], station: string, index: number): OrderBatch {
    const totalTime = orders.reduce((sum, order) => sum + order.estimatedPrepTime, 0);
    const maxPriority = orders.reduce((max, order) => {
      const priorityWeight = { critical: 4, high: 3, normal: 2, low: 1 };
      const currentWeight = priorityWeight[max];
      const orderWeight = priorityWeight[order.priority];
      return orderWeight > currentWeight ? order.priority : max;
    }, 'low' as Order['priority']);
    
    // Determine if orders can be prepared in parallel
    const uniqueStations = new Set<string>();
    orders.forEach(order => {
      order.requiredStations.forEach(s => uniqueStations.add(s));
    });
    
    const parallelizable = uniqueStations.size > 1;
    
    // Create optimized sequence (simple orders first, then complex)
    const suggestedSequence = [...orders].sort((a, b) => a.complexity - b.complexity);
    
    // Identify dependencies (orders that must wait for others)
    const dependencies: string[] = [];
    orders.forEach(order => {
      if (order.specialRequests?.includes('after other tables')) {
        dependencies.push(order.id);
      }
    });
    
    return {
      id: `batch_${station}_${index}`,
      orders: orders.map(order => ({ ...order, requiredStations: undefined }) as Order),
      estimatedTime: parallelizable ? Math.max(...orders.map(o => o.estimatedPrepTime)) : totalTime,
      priority: maxPriority,
      suggestedSequence: suggestedSequence.map(order => ({ ...order, requiredStations: undefined }) as Order),
      station,
      parallelizable,
      dependencies
    };
  }

  private allocateToStations(batches: OrderBatch[]): { [stationId: string]: OrderBatch[] } {
    const allocation: { [stationId: string]: OrderBatch[] } = {};
    
    // Initialize allocation map
    this.kitchenStations.forEach((_, stationId) => {
      allocation[stationId] = [];
    });
    
    // Allocate batches to stations
    batches.forEach(batch => {
      const station = this.kitchenStations.get(batch.station);
      if (station) {
        allocation[batch.station].push(batch);
        
        // Update station load
        station.currentLoad += batch.orders.length;
      }
    });
    
    return allocation;
  }

  private identifyBottlenecks(): Bottleneck[] {
    const bottlenecks: Bottleneck[] = [];
    
    this.kitchenStations.forEach((station, stationId) => {
      const utilizationRate = station.currentLoad / station.capacity;
      const staffRatio = station.currentLoad / station.availableStaff;
      
      let severity: Bottleneck['severity'] = 'low';
      let cause = '';
      let suggestedResolution = '';
      let estimatedDelay = 0;
      
      if (utilizationRate > 0.9) {
        severity = 'critical';
        cause = 'Station over capacity';
        suggestedResolution = 'Redistribute orders to other stations or add temporary capacity';
        estimatedDelay = Math.round((utilizationRate - 0.9) * 30); // Minutes
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

  private generateRecommendations(batches: OrderBatch[], bottlenecks: Bottleneck[], context?: any): string[] {
    const recommendations: string[] = [];
    
    // General optimization recommendations
    const totalOrders = batches.reduce((sum, batch) => sum + batch.orders.length, 0);
    const parallelBatches = batches.filter(b => b.parallelizable).length;
    
    if (parallelBatches > 0) {
      recommendations.push(`${parallelBatches} batches can be prepared in parallel for faster service`);
    }
    
    if (totalOrders > 20) {
      recommendations.push('High order volume detected - consider prep-ahead strategy for common ingredients');
    }
    
    // Bottleneck-specific recommendations
    bottlenecks.forEach(bottleneck => {
      if (bottleneck.severity === 'critical' || bottleneck.severity === 'high') {
        recommendations.push(`${bottleneck.station}: ${bottleneck.suggestedResolution}`);
      }
    });
    
    // Context-specific recommendations
    if (context?.peakHours) {
      recommendations.push('Peak hours detected - prioritize quick-prep items and pre-made components');
    }
    
    if (context?.staffAvailability && context.staffAvailability < 0.8) {
      recommendations.push('Limited staff availability - focus on simplified menu items and batch cooking');
    }
    
    // Performance-based recommendations
    const avgEfficiency = this.calculateAverageEfficiency();
    if (avgEfficiency < 0.75) {
      recommendations.push('Kitchen efficiency below optimal - review workflow and staff allocation');
    }
    
    return recommendations.slice(0, 10); // Limit to most important recommendations
  }

  private generateActions(batches: OrderBatch[], bottlenecks: Bottleneck[]): Action[] {
    const actions: Action[] = [];
    
    // Ingredient prep actions
    const commonIngredients = this.identifyCommonIngredients(batches);
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
    
    // Priority order actions
    const criticalOrders = batches.flatMap(b => b.orders.filter(o => o.priority === 'critical'));
    if (criticalOrders.length > 0) {
      actions.push({
        type: 'prioritize_order',
        description: `Fast-track ${criticalOrders.length} critical orders`,
        urgency: 'critical',
        estimatedImpact: 'Improved customer satisfaction',
        targetOrder: criticalOrders[0].id
      });
    }
    
    // Parallel cooking opportunities
    const parallelOpportunities = batches.filter(b => b.parallelizable && b.orders.length > 1);
    if (parallelOpportunities.length > 0) {
      actions.push({
        type: 'parallel_cooking',
        description: `Execute ${parallelOpportunities.length} batches in parallel across stations`,
        urgency: 'medium',
        estimatedImpact: '25-30% faster completion'
      });
    }
    
    return actions;
  }

  private identifyCommonIngredients(batches: OrderBatch[]): string[] {
    const ingredientCount: { [ingredient: string]: number } = {};
    
    batches.forEach(batch => {
      batch.orders.forEach(order => {
        order.items.forEach(item => {
          item.ingredients.forEach(ingredient => {
            ingredientCount[ingredient] = (ingredientCount[ingredient] || 0) + item.quantity;
          });
        });
      });
    });
    
    // Return ingredients used in 3+ orders
    return Object.entries(ingredientCount)
      .filter(([, count]) => count >= 3)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([ingredient]) => ingredient);
  }

  private calculateEfficiencyMetrics(originalOrders: Order[], batches: OrderBatch[]): {
    totalTime: number;
    efficiency: number;
    efficiencyGain: number;
  } {
    // Calculate optimized total time
    const optimizedTime = Math.max(...batches.map(batch => batch.estimatedTime));
    
    // Calculate baseline time (sequential processing)
    const baselineTime = originalOrders.reduce((sum, order) => sum + order.estimatedPrepTime, 0);
    
    const efficiency = baselineTime > 0 ? optimizedTime / baselineTime : 1;
    const efficiencyGain = Math.round((1 - efficiency) * 100);
    
    return {
      totalTime: optimizedTime,
      efficiency,
      efficiencyGain: Math.max(0, efficiencyGain)
    };
  }

  private resetStationLoads(): void {
    this.kitchenStations.forEach(station => {
      station.currentLoad = 0;
    });
  }

  private calculateAverageEfficiency(): number {
    if (this.performanceHistory.length === 0) return 0.8; // Default assumption
    
    const recentHistory = this.performanceHistory.slice(-10); // Last 10 optimizations
    const avgEfficiency = recentHistory.reduce((sum, entry) => sum + entry.efficiency, 0) / recentHistory.length;
    
    return avgEfficiency;
  }

  private updatePerformanceHistory(ordersProcessed: number, efficiency: number): void {
    this.performanceHistory.push({
      timestamp: new Date(),
      efficiency,
      ordersProcessed
    });
    
    // Keep only last 50 entries
    if (this.performanceHistory.length > 50) {
      this.performanceHistory = this.performanceHistory.slice(-50);
    }
  }

  // Public utility methods
  getStationStatus(): { [stationId: string]: KitchenStation } {
    const status: { [stationId: string]: KitchenStation } = {};
    this.kitchenStations.forEach((station, id) => {
      status[id] = { ...station };
    });
    return status;
  }

  getPerformanceMetrics(): {
    averageEfficiency: number;
    totalOrdersProcessed: number;
    recentOptimizations: number;
  } {
    const recentOptimizations = this.performanceHistory.filter(
      entry => Date.now() - entry.timestamp.getTime() < 3600000 // Last hour
    ).length;
    
    const totalOrdersProcessed = this.performanceHistory.reduce(
      (sum, entry) => sum + entry.ordersProcessed, 0
    );

    return {
      averageEfficiency: this.calculateAverageEfficiency(),
      totalOrdersProcessed,
      recentOptimizations
    };
  }

  async processTask(task: any): Promise<OptimizationResult> {
    const { orders, context } = task.data;
    return await this.optimizeOrders(orders, context);
  }
}

// Singleton instance
let orderOptimizationAgent: OrderOptimizationAgent | null = null;

export function getOrderOptimizationAgent(): OrderOptimizationAgent {
  if (!orderOptimizationAgent) {
    orderOptimizationAgent = new OrderOptimizationAgent();
  }
  return orderOptimizationAgent;
}

export type { Order, OrderItem, KitchenStation, OptimizationResult, OrderBatch, Bottleneck, Action };