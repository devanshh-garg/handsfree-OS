interface InventoryItem {
  id: string;
  name: string;
  category: 'ingredients' | 'beverages' | 'disposables' | 'condiments';
  currentStock: number;
  unit: string;
  costPerUnit: number;
  supplier: string;
  shelfLife: number; // days
  minimumStock: number;
  maximumStock: number;
  lastRestocked: Date;
  averageDailyUsage: number;
  seasonalVariation: number; // multiplier for seasonal demand
}

interface SalesPattern {
  hour: number;
  day: string;
  month: number;
  averageQuantity: number;
  itemsConsumed: { [itemId: string]: number };
}

interface PredictionResult {
  type: 'inventory_prediction';
  predictions: { [itemId: string]: ItemPrediction };
  alerts: InventoryAlert[];
  overallScore: number;
  topRecommendations: InventoryAlert[];
  restockSchedule: RestockRecommendation[];
  costOptimization: CostOptimization;
  wastageAnalysis: WastageAnalysis;
}

interface ItemPrediction {
  itemId: string;
  itemName: string;
  currentStock: number;
  predictedDemand: number;
  daysUntilStockout: number;
  confidenceLevel: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  seasonalFactor: number;
  recommendedOrderQuantity: number;
  optimalRestockDate: Date;
}

interface InventoryAlert {
  itemId: string;
  itemName: string;
  severity: 'info' | 'warning' | 'critical' | 'urgent';
  type: 'low_stock' | 'stockout' | 'overstocked' | 'expiring' | 'high_demand';
  message: string;
  suggestedAction: string;
  suggestedOrder?: number;
  priority: number;
  estimatedImpact: string;
  timeframe: string;
}

interface RestockRecommendation {
  itemId: string;
  itemName: string;
  recommendedQuantity: number;
  estimatedCost: number;
  suggestedDate: Date;
  supplier: string;
  reasoning: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

interface CostOptimization {
  potentialSavings: number;
  opportunities: Array<{
    type: 'bulk_order' | 'supplier_switch' | 'seasonal_timing' | 'waste_reduction';
    description: string;
    estimatedSaving: number;
    implementationEffort: 'low' | 'medium' | 'high';
  }>;
  totalOptimizationValue: number;
}

interface WastageAnalysis {
  totalWastage: number;
  wastedValue: number;
  topWastedItems: Array<{
    itemId: string;
    itemName: string;
    wastedQuantity: number;
    wastedValue: number;
    cause: 'expiration' | 'overstock' | 'damage' | 'spoilage';
  }>;
  preventionSuggestions: string[];
}

export class InventoryPredictionAgent {
  private inventoryItems: Map<string, InventoryItem> = new Map();
  private salesHistory: SalesPattern[] = [];
  private seasonalTrends: Map<string, number[]> = new Map(); // 12 months of multipliers
  private demandForecasts: Map<string, number[]> = new Map(); // 30-day rolling forecasts
  private performanceMetrics: {
    accuracyRate: number;
    alertsSent: number;
    stockoutsPrevented: number;
    costSavings: number;
  } = {
    accuracyRate: 0.85,
    alertsSent: 0,
    stockoutsPrevented: 0,
    costSavings: 0
  };

  constructor() {
    this.initializeInventoryData();
    this.initializeSeasonalTrends();
  }

  private initializeInventoryData(): void {
    const sampleItems: InventoryItem[] = [
      // Ingredients
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
        lastRestocked: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
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
        lastRestocked: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
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
        lastRestocked: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
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
        lastRestocked: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        averageDailyUsage: 5.0,
        seasonalVariation: 0.9
      },
      {
        id: 'dal_yellow',
        name: 'Yellow Dal',
        category: 'ingredients',
        currentStock: 22,
        unit: 'kg',
        costPerUnit: 80,
        supplier: 'Premium Grains',
        shelfLife: 180,
        minimumStock: 15,
        maximumStock: 60,
        lastRestocked: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        averageDailyUsage: 3.2,
        seasonalVariation: 0.95
      },
      // Beverages
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
        lastRestocked: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        averageDailyUsage: 8.5,
        seasonalVariation: 1.0
      },
      {
        id: 'tea_leaves',
        name: 'Tea Leaves',
        category: 'beverages',
        currentStock: 2.5,
        unit: 'kg',
        costPerUnit: 800,
        supplier: 'Tea Garden Direct',
        shelfLife: 90,
        minimumStock: 1,
        maximumStock: 10,
        lastRestocked: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        averageDailyUsage: 0.3,
        seasonalVariation: 1.3
      },
      // Condiments
      {
        id: 'garam_masala',
        name: 'Garam Masala',
        category: 'condiments',
        currentStock: 0.8,
        unit: 'kg',
        costPerUnit: 1200,
        supplier: 'Spice Masters',
        shelfLife: 180,
        minimumStock: 0.5,
        maximumStock: 3,
        lastRestocked: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        averageDailyUsage: 0.15,
        seasonalVariation: 1.1
      },
      {
        id: 'oil_cooking',
        name: 'Cooking Oil',
        category: 'ingredients',
        currentStock: 8,
        unit: 'liters',
        costPerUnit: 150,
        supplier: 'Oil Depot',
        shelfLife: 365,
        minimumStock: 5,
        maximumStock: 25,
        lastRestocked: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        averageDailyUsage: 1.2,
        seasonalVariation: 1.0
      }
    ];

    sampleItems.forEach(item => {
      this.inventoryItems.set(item.id, item);
    });
  }

  private initializeSeasonalTrends(): void {
    // Initialize with historical seasonal patterns (simplified)
    const items = ['onions', 'tomatoes', 'paneer', 'rice_basmati', 'dal_yellow', 'milk', 'tea_leaves'];
    
    items.forEach(itemId => {
      // Sample seasonal multipliers for 12 months (Jan-Dec)
      // Values > 1 indicate higher demand, < 1 indicate lower demand
      const seasonalData = this.generateSeasonalPattern(itemId);
      this.seasonalTrends.set(itemId, seasonalData);
    });
  }

  private generateSeasonalPattern(itemId: string): number[] {
    // Generate realistic seasonal patterns based on item type
    const basePattern = [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0];
    
    switch (itemId) {
      case 'tomatoes':
        // Higher in summer months
        return [0.8, 0.9, 1.1, 1.3, 1.4, 1.2, 1.1, 1.0, 0.9, 0.8, 0.7, 0.8];
      case 'tea_leaves':
        // Higher in winter months
        return [1.4, 1.3, 1.1, 0.9, 0.8, 0.7, 0.7, 0.8, 0.9, 1.1, 1.3, 1.4];
      case 'paneer':
        // Higher during festival seasons
        return [1.0, 1.0, 1.2, 1.0, 1.0, 1.0, 1.0, 1.1, 1.3, 1.4, 1.2, 1.1];
      default:
        // Slight variations for other items
        return basePattern.map(v => v + (Math.random() - 0.5) * 0.2);
    }
  }

  async predictInventoryNeeds(context?: {
    upcomingEvents?: string[];
    weatherForecast?: string;
    staffingLevel?: number;
    promotionalItems?: string[];
    dayType?: 'weekday' | 'weekend' | 'holiday';
  }): Promise<PredictionResult> {
    console.log('Inventory Prediction Agent: Analyzing inventory needs');

    const currentMonth = new Date().getMonth();
    const predictions: { [itemId: string]: ItemPrediction } = {};
    const alerts: InventoryAlert[] = [];
    const restockSchedule: RestockRecommendation[] = [];

    // Analyze each inventory item
    for (const [itemId, item] of this.inventoryItems.entries()) {
      const prediction = await this.predictItemDemand(item, currentMonth, context);
      predictions[itemId] = prediction;

      // Generate alerts based on prediction
      const itemAlerts = this.generateAlertsForItem(item, prediction);
      alerts.push(...itemAlerts);

      // Generate restock recommendations
      if (prediction.daysUntilStockout <= 7 || prediction.currentStock <= item.minimumStock) {
        const restockRec = this.generateRestockRecommendation(item, prediction);
        restockSchedule.push(restockRec);
      }
    }

    // Sort alerts by priority
    alerts.sort((a, b) => b.priority - a.priority);

    // Calculate overall inventory health score
    const overallScore = this.calculateOverallScore(predictions);

    // Generate cost optimization analysis
    const costOptimization = this.analyzeCostOptimization(predictions, restockSchedule);

    // Analyze wastage patterns
    const wastageAnalysis = this.analyzeWastage(predictions);

    const result: PredictionResult = {
      type: 'inventory_prediction',
      predictions,
      alerts,
      overallScore,
      topRecommendations: alerts.slice(0, 5),
      restockSchedule: restockSchedule.sort((a, b) => a.suggestedDate.getTime() - b.suggestedDate.getTime()),
      costOptimization,
      wastageAnalysis
    };

    // Update performance metrics
    this.performanceMetrics.alertsSent += alerts.length;

    return result;
  }

  private async predictItemDemand(
    item: InventoryItem, 
    currentMonth: number, 
    context?: any
  ): Promise<ItemPrediction> {
    // Get seasonal factor
    const seasonalFactors = this.seasonalTrends.get(item.id) || Array(12).fill(1);
    const seasonalFactor = seasonalFactors[currentMonth];

    // Base prediction on historical usage
    let predictedDailyDemand = item.averageDailyUsage * seasonalFactor;

    // Apply context-based adjustments
    if (context) {
      predictedDailyDemand = this.applyContextualAdjustments(predictedDailyDemand, item, context);
    }

    const predictedWeeklyDemand = predictedDailyDemand * 7;
    const daysUntilStockout = item.currentStock / predictedDailyDemand;

    // Determine trend based on recent usage patterns
    const trend = this.determineTrend(item.id);

    // Calculate confidence based on historical accuracy and data quality
    const confidenceLevel = this.calculateConfidence(item.id, seasonalFactor);

    // Recommend order quantity (1-2 weeks supply + buffer)
    const recommendedOrderQuantity = Math.max(
      item.minimumStock,
      Math.ceil(predictedWeeklyDemand * 2 * 1.1) // 10% buffer
    );

    // Calculate optimal restock date (when stock hits minimum)
    const daysToMinimum = Math.max(0, (item.currentStock - item.minimumStock) / predictedDailyDemand);
    const optimalRestockDate = new Date(Date.now() + daysToMinimum * 24 * 60 * 60 * 1000);

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

  private applyContextualAdjustments(baseDemand: number, item: InventoryItem, context: any): number {
    let adjustedDemand = baseDemand;

    // Weather impact
    if (context.weatherForecast) {
      if (context.weatherForecast.includes('hot') && ['tea_leaves'].includes(item.id)) {
        adjustedDemand *= 0.7; // Less tea in hot weather
      } else if (context.weatherForecast.includes('cold') && ['tea_leaves', 'garam_masala'].includes(item.id)) {
        adjustedDemand *= 1.3; // More warm items in cold weather
      }
    }

    // Staffing level impact
    if (context.staffingLevel) {
      const staffMultiplier = 0.7 + (context.staffingLevel * 0.3); // 70% base + 30% variable
      adjustedDemand *= staffMultiplier;
    }

    // Day type impact
    if (context.dayType) {
      switch (context.dayType) {
        case 'weekend':
          adjustedDemand *= 1.4; // 40% more on weekends
          break;
        case 'holiday':
          adjustedDemand *= 1.8; // 80% more on holidays
          break;
        default:
          // Weekday - no change
          break;
      }
    }

    // Promotional items boost
    if (context.promotionalItems && context.promotionalItems.includes(item.id)) {
      adjustedDemand *= 2.0; // Double demand for promoted items
    }

    // Upcoming events impact
    if (context.upcomingEvents) {
      const eventMultiplier = 1 + (context.upcomingEvents.length * 0.2);
      adjustedDemand *= eventMultiplier;
    }

    return adjustedDemand;
  }

  private determineTrend(itemId: string): 'increasing' | 'decreasing' | 'stable' {
    // Simple trend analysis based on recent usage (simplified)
    const recentUsage = this.demandForecasts.get(itemId) || [];
    
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

  private calculateConfidence(itemId: string, seasonalFactor: number): number {
    // Base confidence on historical accuracy
    let confidence = this.performanceMetrics.accuracyRate;

    // Adjust based on seasonal certainty
    if (Math.abs(seasonalFactor - 1) > 0.3) {
      confidence *= 0.9; // Reduce confidence for high seasonal variation
    }

    // Adjust based on item characteristics
    const item = this.inventoryItems.get(itemId);
    if (item) {
      if (item.shelfLife < 7) {
        confidence *= 0.8; // Less confident for perishable items
      }
      if (item.category === 'condiments') {
        confidence *= 1.1; // More confident for stable items
      }
    }

    return Math.max(0.5, Math.min(1.0, confidence));
  }

  private generateAlertsForItem(item: InventoryItem, prediction: ItemPrediction): InventoryAlert[] {
    const alerts: InventoryAlert[] = [];

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
    // Low stock warning
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

    // High demand alert
    if (prediction.trend === 'increasing' && prediction.predictedDemand > item.averageDailyUsage * 7 * 1.5) {
      alerts.push({
        itemId: item.id,
        itemName: item.name,
        severity: 'info',
        type: 'high_demand',
        message: `${item.name} showing increased demand trend`,
        suggestedAction: 'Consider increasing order quantities',
        priority: 4,
        estimatedImpact: 'Inventory optimization',
        timeframe: 'Next order cycle'
      });
    }

    // Expiration alert
    const daysSinceRestock = (Date.now() - item.lastRestocked.getTime()) / (24 * 60 * 60 * 1000);
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

    // Overstock alert
    if (item.currentStock > item.maximumStock) {
      alerts.push({
        itemId: item.id,
        itemName: item.name,
        severity: 'info',
        type: 'overstocked',
        message: `${item.name} overstocked (${item.currentStock} vs max ${item.maximumStock})`,
        suggestedAction: 'Skip next order cycle or use in specials',
        priority: 3,
        estimatedImpact: 'Cost optimization',
        timeframe: 'Next week'
      });
    }

    return alerts;
  }

  private generateRestockRecommendation(item: InventoryItem, prediction: ItemPrediction): RestockRecommendation {
    let urgency: RestockRecommendation['urgency'] = 'medium';
    
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

  private calculateOverallScore(predictions: { [itemId: string]: ItemPrediction }): number {
    const items = Object.values(predictions);
    if (items.length === 0) return 100;

    let totalScore = 0;
    let criticalIssues = 0;

    items.forEach(prediction => {
      let itemScore = 100;

      // Penalize low stock situations
      if (prediction.daysUntilStockout <= 1) {
        itemScore -= 50;
        criticalIssues++;
      } else if (prediction.daysUntilStockout <= 3) {
        itemScore -= 30;
      } else if (prediction.daysUntilStockout <= 7) {
        itemScore -= 15;
      }

      // Adjust for trend confidence
      itemScore *= prediction.confidenceLevel;

      totalScore += itemScore;
    });

    const averageScore = totalScore / items.length;
    
    // Apply penalty for critical issues
    const finalScore = averageScore - (criticalIssues * 10);

    return Math.max(0, Math.min(100, Math.round(finalScore)));
  }

  private analyzeCostOptimization(
    predictions: { [itemId: string]: ItemPrediction },
    restockSchedule: RestockRecommendation[]
  ): CostOptimization {
    const opportunities: CostOptimization['opportunities'] = [];
    let potentialSavings = 0;

    // Bulk order opportunities
    const totalOrderValue = restockSchedule.reduce((sum, rec) => sum + rec.estimatedCost, 0);
    if (totalOrderValue > 5000) {
      const bulkSaving = totalOrderValue * 0.08; // 8% bulk discount
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
        const item = this.inventoryItems.get(prediction.itemId);
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

    // Waste reduction opportunities
    const wasteReduction = this.identifyWasteOpportunities();
    if (wasteReduction > 0) {
      opportunities.push({
        type: 'waste_reduction',
        description: 'Implement FIFO and better portion control',
        estimatedSaving: wasteReduction,
        implementationEffort: 'medium'
      });
      potentialSavings += wasteReduction;
    }

    return {
      potentialSavings: Math.round(potentialSavings),
      opportunities: opportunities.slice(0, 5), // Top 5 opportunities
      totalOptimizationValue: Math.round(potentialSavings * 12) // Annual value
    };
  }

  private analyzeWastage(predictions: { [itemId: string]: ItemPrediction }): WastageAnalysis {
    const topWastedItems: WastageAnalysis['topWastedItems'] = [];
    let totalWastage = 0;
    let wastedValue = 0;

    // Analyze items with high waste potential
    Object.values(predictions).forEach(prediction => {
      const item = this.inventoryItems.get(prediction.itemId);
      if (!item) return;

      // Estimate wastage for perishable items with excess stock
      if (item.shelfLife <= 7 && prediction.currentStock > prediction.predictedDemand) {
        const excessStock = prediction.currentStock - prediction.predictedDemand;
        const wastedQuantity = Math.min(excessStock, item.currentStock * 0.1); // Max 10% waste
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
      'Create daily specials for items nearing expiry',
      'Improve storage conditions to extend shelf life',
      'Train staff on proper handling procedures'
    ];

    return {
      totalWastage: Math.round(totalWastage * 10) / 10,
      wastedValue: Math.round(wastedValue),
      topWastedItems: topWastedItems.sort((a, b) => b.wastedValue - a.wastedValue).slice(0, 5),
      preventionSuggestions: preventionSuggestions.slice(0, 3)
    };
  }

  private identifyWasteOpportunities(): number {
    // Estimate waste reduction potential based on inventory turnover
    let totalWasteReduction = 0;

    this.inventoryItems.forEach(item => {
      if (item.shelfLife <= 7) { // Focus on perishables
        const estimatedWaste = item.averageDailyUsage * 0.1; // Assume 10% waste
        const wasteValue = estimatedWaste * item.costPerUnit * 30; // Monthly waste
        totalWasteReduction += wasteValue * 0.5; // 50% reduction potential
      }
    });

    return totalWasteReduction;
  }

  // Public utility methods
  getInventoryStatus(): { [itemId: string]: InventoryItem } {
    const status: { [itemId: string]: InventoryItem } = {};
    this.inventoryItems.forEach((item, id) => {
      status[id] = { ...item };
    });
    return status;
  }

  updateInventoryLevel(itemId: string, newQuantity: number): boolean {
    const item = this.inventoryItems.get(itemId);
    if (item) {
      item.currentStock = newQuantity;
      return true;
    }
    return false;
  }

  recordUsage(itemId: string, quantityUsed: number): void {
    const item = this.inventoryItems.get(itemId);
    if (item) {
      item.currentStock = Math.max(0, item.currentStock - quantityUsed);
      
      // Update demand forecast
      const forecast = this.demandForecasts.get(itemId) || [];
      forecast.push(quantityUsed);
      if (forecast.length > 30) forecast.shift(); // Keep last 30 days
      this.demandForecasts.set(itemId, forecast);
    }
  }

  getPerformanceMetrics(): typeof this.performanceMetrics {
    return { ...this.performanceMetrics };
  }

  async processTask(task: any): Promise<PredictionResult> {
    const { context } = task.data;
    return await this.predictInventoryNeeds(context);
  }
}

// Singleton instance
let inventoryPredictionAgent: InventoryPredictionAgent | null = null;

export function getInventoryPredictionAgent(): InventoryPredictionAgent {
  if (!inventoryPredictionAgent) {
    inventoryPredictionAgent = new InventoryPredictionAgent();
  }
  return inventoryPredictionAgent;
}

export type { 
  InventoryItem, 
  PredictionResult, 
  ItemPrediction, 
  InventoryAlert, 
  RestockRecommendation,
  CostOptimization,
  WastageAnalysis
};