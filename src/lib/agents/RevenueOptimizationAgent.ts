interface MenuItem {
  id: string;
  name: string;
  category: 'starter' | 'main' | 'dessert' | 'beverage';
  basePrice: number;
  cost: number;
  profitMargin: number;
  popularity: number; // 0-1 scale
  preparationTime: number; // minutes
  ingredients: string[];
  allergens: string[];
  seasonalDemand: number[]; // 12 months multiplier
  elasticity: number; // price sensitivity (-1 to 1)
}

interface SalesData {
  itemId: string;
  quantity: number;
  revenue: number;
  timestamp: Date;
  tableId: string;
  customerType: 'new' | 'regular' | 'vip';
  discountApplied?: number;
  upsellSuccess?: boolean;
}

interface MarketConditions {
  competitorPricing: { [itemType: string]: number };
  economicIndex: number; // 0-1, higher = better economy
  seasonalFactor: number; // current seasonal multiplier
  demandLevel: 'low' | 'medium' | 'high' | 'peak';
  dayType: 'weekday' | 'weekend' | 'holiday';
  weatherImpact: number; // -0.5 to 0.5
}

interface RevenueOptimizationResult {
  type: 'revenue_optimization';
  currentRevenue: number;
  projectedRevenue: number;
  potentialIncrease: string;
  optimizedPricing: { [itemId: string]: PricingRecommendation };
  upsellOpportunities: UpsellOpportunity[];
  demandForecast: DemandForecast;
  profitabilityAnalysis: ProfitabilityAnalysis;
  marketPositioning: MarketPositioning;
  actionItems: RevenueActionItem[];
  riskAssessment: RiskAssessment;
}

interface PricingRecommendation {
  itemId: string;
  itemName: string;
  currentPrice: number;
  recommendedPrice: number;
  priceChange: number;
  priceChangePercent: number;
  reasoning: string;
  expectedImpact: {
    revenueChange: number;
    demandChange: number;
    profitChange: number;
  };
  confidence: number;
  implementationRisk: 'low' | 'medium' | 'high';
  testPeriod?: number; // days
}

interface UpsellOpportunity {
  id: string;
  type: 'combo' | 'upgrade' | 'addon' | 'complement';
  primaryItem: string;
  suggestedItems: string[];
  bundlePrice: number;
  individualPrice: number;
  discount: number;
  expectedUplift: string;
  customerSegment: 'all' | 'new' | 'regular' | 'vip';
  successProbability: number;
  profitImpact: number;
  description: string;
}

interface DemandForecast {
  period: 'daily' | 'weekly' | 'monthly';
  forecast: { [itemId: string]: number[] }; // quantities for next periods
  trendAnalysis: { [itemId: string]: 'increasing' | 'decreasing' | 'stable' };
  seasonalFactors: { [itemId: string]: number };
  confidenceInterval: { [itemId: string]: { lower: number; upper: number } };
}

interface ProfitabilityAnalysis {
  topPerformers: Array<{
    itemId: string;
    itemName: string;
    revenue: number;
    profit: number;
    profitMargin: number;
    volumeSold: number;
  }>;
  bottomPerformers: Array<{
    itemId: string;
    itemName: string;
    revenue: number;
    profit: number;
    profitMargin: number;
    volumeSold: number;
    improvementPotential: string;
  }>;
  categoryPerformance: { [category: string]: {
    totalRevenue: number;
    totalProfit: number;
    averageMargin: number;
    itemCount: number;
  }};
  overallMetrics: {
    totalRevenue: number;
    totalProfit: number;
    averageMargin: number;
    revenuePerItem: number;
  };
}

interface MarketPositioning {
  competitiveAnalysis: { [itemId: string]: {
    ourPrice: number;
    marketAverage: number;
    positioningStrategy: 'premium' | 'competitive' | 'value';
    priceAdvantage: number;
  }};
  valueProposition: string[];
  differentiationFactors: string[];
  marketShare: { [category: string]: number };
}

interface RevenueActionItem {
  id: string;
  type: 'pricing_adjustment' | 'menu_optimization' | 'upsell_training' | 'cost_reduction';
  priority: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  expectedImpact: number; // revenue impact
  implementationEffort: 'low' | 'medium' | 'high';
  timeframe: string;
  dependencies: string[];
  measurableGoal: string;
}

interface RiskAssessment {
  pricingRisks: Array<{
    type: 'customer_churn' | 'competitor_response' | 'demand_drop' | 'brand_perception';
    probability: 'low' | 'medium' | 'high';
    impact: 'low' | 'medium' | 'high';
    description: string;
    mitigation: string;
  }>;
  marketRisks: Array<{
    factor: string;
    impact: number;
    timeframe: string;
    contingencyPlan: string;
  }>;
  overallRiskScore: number; // 0-10
}

export class RevenueOptimizationAgent {
  private menuItems: Map<string, MenuItem> = new Map();
  private salesHistory: SalesData[] = [];
  private marketConditions: MarketConditions;
  private pricingHistory: Array<{ date: Date; itemId: string; price: number; revenue: number }> = [];
  private upsellPerformance: Map<string, { attempts: number; successes: number; revenue: number }> = new Map();
  
  // Pricing optimization parameters
  private readonly OPTIMIZATION_PARAMETERS = {
    maxPriceIncrease: 0.15, // 15% max increase
    maxPriceDecrease: 0.10, // 10% max decrease
    minProfitMargin: 0.30, // 30% minimum margin
    elasticityThreshold: 0.3, // high elasticity threshold
    testPeriodDays: 14, // A/B test period
    confidenceThreshold: 0.75 // minimum confidence for recommendations
  };

  constructor() {
    this.initializeMenuData();
    this.initializeMarketConditions();
    this.generateHistoricalSalesData();
  }

  private initializeMenuData(): void {
    const sampleItems: MenuItem[] = [
      // Starters
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
      // Main courses
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
        id: 'paneer_butter_masala',
        name: 'Paneer Butter Masala',
        category: 'main',
        basePrice: 380,
        cost: 140,
        profitMargin: 0.63,
        popularity: 0.82,
        preparationTime: 30,
        ingredients: ['paneer', 'tomato', 'butter', 'cream', 'spices'],
        allergens: ['dairy'],
        seasonalDemand: [1.1, 1.0, 1.0, 1.0, 0.9, 1.0, 1.0, 1.0, 1.1, 1.2, 1.1, 1.1],
        elasticity: -0.4
      },
      // Beverages
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
        id: 'mango_lassi',
        name: 'Mango Lassi',
        category: 'beverage',
        basePrice: 120,
        cost: 35,
        profitMargin: 0.71,
        popularity: 0.72,
        preparationTime: 5,
        ingredients: ['yogurt', 'mango', 'sugar', 'cardamom'],
        allergens: ['dairy'],
        seasonalDemand: [0.6, 0.7, 0.9, 1.2, 1.4, 1.3, 1.2, 1.1, 1.0, 0.8, 0.7, 0.6],
        elasticity: -0.3
      },
      // Desserts
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
      this.menuItems.set(item.id, item);
    });
  }

  private initializeMarketConditions(): void {
    this.marketConditions = {
      competitorPricing: {
        'starter': 150,
        'main': 350,
        'beverage': 80,
        'dessert': 120
      },
      economicIndex: 0.75,
      seasonalFactor: 1.1, // Current season
      demandLevel: 'medium',
      dayType: 'weekday',
      weatherImpact: 0.0
    };
  }

  private generateHistoricalSalesData(): void {
    // Generate 30 days of sample sales data
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    for (let day = 0; day < 30; day++) {
      const date = new Date(startDate.getTime() + day * 24 * 60 * 60 * 1000);
      
      // Generate 20-50 transactions per day
      const transactionCount = Math.floor(Math.random() * 30) + 20;
      
      for (let i = 0; i < transactionCount; i++) {
        const items = Array.from(this.menuItems.values());
        const randomItem = items[Math.floor(Math.random() * items.length)];
        
        // Adjust quantity based on popularity
        const quantity = randomItem.popularity > 0.8 ? 
          Math.floor(Math.random() * 3) + 1 : 
          Math.floor(Math.random() * 2) + 1;
        
        this.salesHistory.push({
          itemId: randomItem.id,
          quantity,
          revenue: randomItem.basePrice * quantity,
          timestamp: new Date(date.getTime() + Math.random() * 24 * 60 * 60 * 1000),
          tableId: `table${Math.floor(Math.random() * 20) + 1}`,
          customerType: Math.random() > 0.7 ? 'regular' : Math.random() > 0.9 ? 'vip' : 'new',
          discountApplied: Math.random() > 0.8 ? Math.random() * 0.1 : 0,
          upsellSuccess: Math.random() > 0.7
        });
      }
    }
  }

  async optimizeRevenue(context?: {
    analysisWindow?: number; // days
    targetItems?: string[];
    optimizationGoal?: 'revenue' | 'profit' | 'volume';
    riskTolerance?: 'low' | 'medium' | 'high';
    marketConditions?: Partial<MarketConditions>;
  }): Promise<RevenueOptimizationResult> {
    console.log('Revenue Optimization Agent: Analyzing revenue optimization opportunities');

    // Update market conditions if provided
    if (context?.marketConditions) {
      this.marketConditions = { ...this.marketConditions, ...context.marketConditions };
    }

    const analysisWindow = context?.analysisWindow || 30;
    const relevantSales = this.getRelevantSalesData(analysisWindow);
    
    // Calculate current revenue metrics
    const currentRevenue = this.calculateCurrentRevenue(relevantSales);
    
    // Generate pricing recommendations
    const optimizedPricing = await this.generatePricingRecommendations(relevantSales, context);
    
    // Identify upselling opportunities
    const upsellOpportunities = this.identifyUpsellOpportunities(relevantSales);
    
    // Create demand forecast
    const demandForecast = this.generateDemandForecast(relevantSales);
    
    // Analyze profitability
    const profitabilityAnalysis = this.analyzeProfitability(relevantSales);
    
    // Assess market positioning
    const marketPositioning = this.assessMarketPositioning();
    
    // Calculate projected revenue with optimizations
    const projectedRevenue = this.calculateProjectedRevenue(currentRevenue, optimizedPricing, upsellOpportunities);
    
    // Generate actionable items
    const actionItems = this.generateRevenueActionItems(optimizedPricing, upsellOpportunities, profitabilityAnalysis);
    
    // Assess implementation risks
    const riskAssessment = this.assessImplementationRisks(optimizedPricing, context?.riskTolerance || 'medium');

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

  private getRelevantSalesData(days: number): SalesData[] {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return this.salesHistory.filter(sale => sale.timestamp >= cutoffDate);
  }

  private calculateCurrentRevenue(salesData: SalesData[]): number {
    return salesData.reduce((total, sale) => total + sale.revenue, 0);
  }

  private async generatePricingRecommendations(
    salesData: SalesData[], 
    context?: any
  ): Promise<{ [itemId: string]: PricingRecommendation }> {
    const recommendations: { [itemId: string]: PricingRecommendation } = {};

    for (const [itemId, item] of this.menuItems.entries()) {
      const itemSales = salesData.filter(sale => sale.itemId === itemId);
      
      if (itemSales.length < 5) continue; // Skip items with insufficient data

      const recommendation = await this.optimizeItemPricing(item, itemSales, context);
      if (recommendation) {
        recommendations[itemId] = recommendation;
      }
    }

    return recommendations;
  }

  private async optimizeItemPricing(
    item: MenuItem, 
    salesData: SalesData[], 
    context?: any
  ): Promise<PricingRecommendation | null> {
    // Calculate current performance metrics
    const totalQuantity = salesData.reduce((sum, sale) => sum + sale.quantity, 0);
    const totalRevenue = salesData.reduce((sum, sale) => sum + sale.revenue, 0);
    const averagePrice = totalRevenue / totalQuantity;
    
    // Analyze demand elasticity from historical data
    const elasticity = this.calculateDemandElasticity(item, salesData);
    
    // Consider market conditions
    const marketAdjustment = this.calculateMarketAdjustment(item);
    
    // Calculate optimal price
    let recommendedPrice = this.calculateOptimalPrice(item, elasticity, marketAdjustment);
    
    // Apply constraints
    recommendedPrice = this.applyPricingConstraints(item, recommendedPrice);
    
    const priceChange = recommendedPrice - item.basePrice;
    const priceChangePercent = (priceChange / item.basePrice) * 100;
    
    // Skip if change is too small
    if (Math.abs(priceChangePercent) < 2) return null;
    
    // Calculate expected impact
    const expectedImpact = this.calculateExpectedImpact(item, recommendedPrice, elasticity);
    
    // Determine confidence and risk
    const confidence = this.calculateRecommendationConfidence(item, salesData, elasticity);
    const implementationRisk = this.assessPricingRisk(item, priceChangePercent);
    
    if (confidence < this.OPTIMIZATION_PARAMETERS.confidenceThreshold) return null;

    return {
      itemId: item.id,
      itemName: item.name,
      currentPrice: item.basePrice,
      recommendedPrice: Math.round(recommendedPrice),
      priceChange: Math.round(priceChange),
      priceChangePercent: Math.round(priceChangePercent * 10) / 10,
      reasoning: this.generatePricingReasoning(item, priceChangePercent, marketAdjustment),
      expectedImpact,
      confidence: Math.round(confidence * 100) / 100,
      implementationRisk,
      testPeriod: implementationRisk === 'high' ? this.OPTIMIZATION_PARAMETERS.testPeriodDays : undefined
    };
  }

  private calculateDemandElasticity(item: MenuItem, salesData: SalesData[]): number {
    // Simplified elasticity calculation - in practice would use more sophisticated methods
    const demandVariation = this.calculateDemandVariation(salesData);
    const baseElasticity = item.elasticity;
    
    // Adjust based on actual demand patterns
    const adjustedElasticity = baseElasticity * (1 + demandVariation * 0.2);
    
    return Math.max(-1, Math.min(1, adjustedElasticity));
  }

  private calculateDemandVariation(salesData: SalesData[]): number {
    if (salesData.length < 7) return 0;
    
    const dailyTotals: { [date: string]: number } = {};
    
    salesData.forEach(sale => {
      const dateKey = sale.timestamp.toDateString();
      dailyTotals[dateKey] = (dailyTotals[dateKey] || 0) + sale.quantity;
    });
    
    const quantities = Object.values(dailyTotals);
    const mean = quantities.reduce((sum, q) => sum + q, 0) / quantities.length;
    const variance = quantities.reduce((sum, q) => sum + Math.pow(q - mean, 2), 0) / quantities.length;
    const stdDev = Math.sqrt(variance);
    
    return mean > 0 ? stdDev / mean : 0; // Coefficient of variation
  }

  private calculateMarketAdjustment(item: MenuItem): number {
    const competitorPrice = this.marketConditions.competitorPricing[item.category];
    const priceRatio = item.basePrice / competitorPrice;
    
    let adjustment = 1.0;
    
    // Economic conditions adjustment
    adjustment *= (0.8 + 0.4 * this.marketConditions.economicIndex);
    
    // Seasonal adjustment
    adjustment *= this.marketConditions.seasonalFactor;
    
    // Demand level adjustment
    switch (this.marketConditions.demandLevel) {
      case 'peak':
        adjustment *= 1.15;
        break;
      case 'high':
        adjustment *= 1.08;
        break;
      case 'low':
        adjustment *= 0.92;
        break;
      default:
        break;
    }
    
    // Competitive positioning
    if (priceRatio < 0.8) adjustment *= 1.05; // We're underpriced
    else if (priceRatio > 1.2) adjustment *= 0.95; // We're overpriced
    
    return adjustment;
  }

  private calculateOptimalPrice(item: MenuItem, elasticity: number, marketAdjustment: number): number {
    // Simplified optimal pricing formula
    const basePriceAdjusted = item.basePrice * marketAdjustment;
    
    // Consider elasticity - less elastic items can support higher prices
    const elasticityFactor = 1 + (Math.abs(elasticity) - 0.5) * 0.1;
    
    // Consider profit margin optimization
    const marginOptimization = item.profitMargin < 0.5 ? 1.05 : 1.0;
    
    return basePriceAdjusted * elasticityFactor * marginOptimization;
  }

  private applyPricingConstraints(item: MenuItem, recommendedPrice: number): number {
    const maxIncrease = item.basePrice * (1 + this.OPTIMIZATION_PARAMETERS.maxPriceIncrease);
    const maxDecrease = item.basePrice * (1 - this.OPTIMIZATION_PARAMETERS.maxPriceDecrease);
    
    // Ensure minimum profit margin
    const minPriceForMargin = item.cost / (1 - this.OPTIMIZATION_PARAMETERS.minProfitMargin);
    
    let constrainedPrice = Math.max(minPriceForMargin, Math.min(maxIncrease, Math.max(maxDecrease, recommendedPrice)));
    
    // Round to nearest 10
    constrainedPrice = Math.round(constrainedPrice / 10) * 10;
    
    return constrainedPrice;
  }

  private calculateExpectedImpact(item: MenuItem, newPrice: number, elasticity: number): PricingRecommendation['expectedImpact'] {
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

  private calculateRecommendationConfidence(item: MenuItem, salesData: SalesData[], elasticity: number): number {
    let confidence = 0.8; // Base confidence
    
    // More data = higher confidence
    const dataPoints = salesData.length;
    if (dataPoints > 50) confidence += 0.1;
    else if (dataPoints < 20) confidence -= 0.2;
    
    // Popular items = higher confidence
    if (item.popularity > 0.8) confidence += 0.1;
    else if (item.popularity < 0.5) confidence -= 0.1;
    
    // Lower elasticity = higher confidence (less price sensitive)
    if (Math.abs(elasticity) < 0.3) confidence += 0.1;
    else if (Math.abs(elasticity) > 0.6) confidence -= 0.1;
    
    return Math.max(0, Math.min(1, confidence));
  }

  private assessPricingRisk(item: MenuItem, priceChangePercent: number): PricingRecommendation['implementationRisk'] {
    const absChange = Math.abs(priceChangePercent);
    
    if (absChange > 10 || (priceChangePercent > 0 && Math.abs(item.elasticity) > 0.5)) {
      return 'high';
    } else if (absChange > 5 || Math.abs(item.elasticity) > 0.3) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  private generatePricingReasoning(item: MenuItem, priceChangePercent: number, marketAdjustment: number): string {
    const reasons: string[] = [];
    
    if (priceChangePercent > 0) {
      if (item.popularity > 0.8) reasons.push('High demand item can support price increase');
      if (marketAdjustment > 1.05) reasons.push('Market conditions favor price increase');
      if (item.profitMargin < 0.5) reasons.push('Low margin item needs price optimization');
    } else {
      if (item.popularity < 0.6) reasons.push('Low demand suggests price reduction may boost sales');
      if (marketAdjustment < 0.95) reasons.push('Market conditions suggest competitive pricing');
      if (Math.abs(item.elasticity) > 0.5) reasons.push('Price-sensitive item benefits from lower pricing');
    }
    
    if (this.marketConditions.demandLevel === 'peak') {
      reasons.push('Peak demand period allows for premium pricing');
    }
    
    return reasons.join('; ') || 'Based on demand analysis and market conditions';
  }

  private identifyUpsellOpportunities(salesData: SalesData[]): UpsellOpportunity[] {
    const opportunities: UpsellOpportunity[] = [];
    
    // Analyze common item combinations
    const itemCombinations = this.analyzeItemCombinations(salesData);
    
    // Generate combo opportunities
    const comboOpportunities = this.generateComboOpportunities(itemCombinations);
    opportunities.push(...comboOpportunities);
    
    // Generate complement opportunities
    const complementOpportunities = this.generateComplementOpportunities();
    opportunities.push(...complementOpportunities);
    
    // Generate upgrade opportunities
    const upgradeOpportunities = this.generateUpgradeOpportunities();
    opportunities.push(...upgradeOpportunities);
    
    return opportunities.sort((a, b) => b.profitImpact - a.profitImpact).slice(0, 10);
  }

  private analyzeItemCombinations(salesData: SalesData[]): { [combo: string]: number } {
    // Group sales by table and time to find items ordered together
    const orderGroups: { [key: string]: string[] } = {};
    
    salesData.forEach(sale => {
      const timeWindow = Math.floor(sale.timestamp.getTime() / (30 * 60 * 1000)); // 30-minute windows
      const key = `${sale.tableId}_${timeWindow}`;
      
      if (!orderGroups[key]) orderGroups[key] = [];
      for (let i = 0; i < sale.quantity; i++) {
        orderGroups[key].push(sale.itemId);
      }
    });
    
    const combinations: { [combo: string]: number } = {};
    
    Object.values(orderGroups).forEach(items => {
      if (items.length > 1) {
        // Count all pairs in this order
        for (let i = 0; i < items.length; i++) {
          for (let j = i + 1; j < items.length; j++) {
            const combo = [items[i], items[j]].sort().join('_');
            combinations[combo] = (combinations[combo] || 0) + 1;
          }
        }
      }
    });
    
    return combinations;
  }

  private generateComboOpportunities(combinations: { [combo: string]: number }): UpsellOpportunity[] {
    const opportunities: UpsellOpportunity[] = [];
    
    Object.entries(combinations)
      .filter(([, count]) => count >= 5) // Minimum frequency
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .forEach(([combo, frequency], index) => {
        const [item1Id, item2Id] = combo.split('_');
        const item1 = this.menuItems.get(item1Id);
        const item2 = this.menuItems.get(item2Id);
        
        if (item1 && item2) {
          const individualPrice = item1.basePrice + item2.basePrice;
          const discount = 0.1; // 10% combo discount
          const bundlePrice = Math.round(individualPrice * (1 - discount));
          
          opportunities.push({
            id: `combo_${index + 1}`,
            type: 'combo',
            primaryItem: item1.name,
            suggestedItems: [item2.name],
            bundlePrice,
            individualPrice,
            discount: discount * 100,
            expectedUplift: '15-20%',
            customerSegment: 'all',
            successProbability: Math.min(0.8, frequency / 20),
            profitImpact: bundlePrice - (item1.cost + item2.cost),
            description: `${item1.name} + ${item2.name} combo with ${discount * 100}% discount`
          });
        }
      });
    
    return opportunities;
  }

  private generateComplementOpportunities(): UpsellOpportunity[] {
    const opportunities: UpsellOpportunity[] = [];
    
    // Predefined complementary pairs
    const complements = [
      { primary: 'dal_makhani', complement: 'masala_chai', uplift: '12%' },
      { primary: 'chicken_biryani', complement: 'mango_lassi', uplift: '18%' },
      { primary: 'paneer_tikka', complement: 'gulab_jamun', uplift: '10%' },
      { primary: 'samosa', complement: 'masala_chai', uplift: '25%' }
    ];
    
    complements.forEach((pair, index) => {
      const primary = this.menuItems.get(pair.primary);
      const complement = this.menuItems.get(pair.complement);
      
      if (primary && complement) {
        opportunities.push({
          id: `complement_${index + 1}`,
          type: 'complement',
          primaryItem: primary.name,
          suggestedItems: [complement.name],
          bundlePrice: primary.basePrice + complement.basePrice,
          individualPrice: primary.basePrice + complement.basePrice,
          discount: 0,
          expectedUplift: pair.uplift,
          customerSegment: 'all',
          successProbability: 0.3,
          profitImpact: complement.basePrice - complement.cost,
          description: `Suggest ${complement.name} with ${primary.name}`
        });
      }
    });
    
    return opportunities;
  }

  private generateUpgradeOpportunities(): UpsellOpportunity[] {
    const opportunities: UpsellOpportunity[] = [];
    
    // Define upgrade paths
    const upgrades = [
      { from: 'samosa', to: 'paneer_tikka', description: 'Upgrade to premium appetizer' },
      { from: 'masala_chai', to: 'mango_lassi', description: 'Try our signature lassi' }
    ];
    
    upgrades.forEach((upgrade, index) => {
      const fromItem = this.menuItems.get(upgrade.from);
      const toItem = this.menuItems.get(upgrade.to);
      
      if (fromItem && toItem) {
        const priceDiff = toItem.basePrice - fromItem.basePrice;
        
        opportunities.push({
          id: `upgrade_${index + 1}`,
          type: 'upgrade',
          primaryItem: fromItem.name,
          suggestedItems: [toItem.name],
          bundlePrice: toItem.basePrice,
          individualPrice: fromItem.basePrice,
          discount: 0,
          expectedUplift: '8-12%',
          customerSegment: 'regular',
          successProbability: 0.2,
          profitImpact: priceDiff - (toItem.cost - fromItem.cost),
          description: upgrade.description
        });
      }
    });
    
    return opportunities;
  }

  private generateDemandForecast(salesData: SalesData[]): DemandForecast {
    const forecast: { [itemId: string]: number[] } = {};
    const trendAnalysis: { [itemId: string]: 'increasing' | 'decreasing' | 'stable' } = {};
    const seasonalFactors: { [itemId: string]: number } = {};
    const confidenceInterval: { [itemId: string]: { lower: number; upper: number } } = {};
    
    this.menuItems.forEach((item, itemId) => {
      const itemSales = salesData.filter(sale => sale.itemId === itemId);
      
      if (itemSales.length >= 7) {
        // Generate 7-day forecast
        const weeklyForecast = this.generateItemForecast(item, itemSales);
        forecast[itemId] = weeklyForecast;
        
        // Analyze trend
        trendAnalysis[itemId] = this.analyzeSalesTrend(itemSales);
        
        // Get seasonal factor
        const currentMonth = new Date().getMonth();
        seasonalFactors[itemId] = item.seasonalDemand[currentMonth];
        
        // Calculate confidence interval
        const avgDaily = weeklyForecast.reduce((sum, val) => sum + val, 0) / 7;
        const variance = this.calculateForecastVariance(itemSales);
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

  private generateItemForecast(item: MenuItem, salesData: SalesData[]): number[] {
    // Simple moving average with trend adjustment
    const recentDays = 7;
    const dailyTotals: number[] = [];
    
    // Group by day
    const salesByDay: { [date: string]: number } = {};
    salesData.forEach(sale => {
      const dateKey = sale.timestamp.toDateString();
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
    
    // Generate 7-day forecast with some variation
    return Array(7).fill(0).map((_, index) => {
      const dayVariation = 0.8 + Math.random() * 0.4; // ±20% variation
      return Math.max(0, Math.round(forecastBase * dayVariation));
    });
  }

  private analyzeSalesTrend(salesData: SalesData[]): 'increasing' | 'decreasing' | 'stable' {
    if (salesData.length < 14) return 'stable';
    
    // Compare first half vs second half
    const sortedSales = salesData.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
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

  private calculateForecastVariance(salesData: SalesData[]): number {
    // Calculate daily quantity variance for confidence intervals
    const dailyTotals: { [date: string]: number } = {};
    
    salesData.forEach(sale => {
      const dateKey = sale.timestamp.toDateString();
      dailyTotals[dateKey] = (dailyTotals[dateKey] || 0) + sale.quantity;
    });
    
    const quantities = Object.values(dailyTotals);
    if (quantities.length < 2) return 0;
    
    const mean = quantities.reduce((sum, q) => sum + q, 0) / quantities.length;
    const variance = quantities.reduce((sum, q) => sum + Math.pow(q - mean, 2), 0) / quantities.length;
    
    return Math.sqrt(variance); // Standard deviation
  }

  private analyzeProfitability(salesData: SalesData[]): ProfitabilityAnalysis {
    const itemPerformance: { [itemId: string]: {
      revenue: number;
      quantity: number;
      profit: number;
    }} = {};
    
    // Calculate performance metrics for each item
    salesData.forEach(sale => {
      const item = this.menuItems.get(sale.itemId);
      if (item) {
        if (!itemPerformance[sale.itemId]) {
          itemPerformance[sale.itemId] = { revenue: 0, quantity: 0, profit: 0 };
        }
        
        itemPerformance[sale.itemId].revenue += sale.revenue;
        itemPerformance[sale.itemId].quantity += sale.quantity;
        itemPerformance[sale.itemId].profit += (item.basePrice - item.cost) * sale.quantity;
      }
    });
    
    // Create top and bottom performers
    const performers = Object.entries(itemPerformance).map(([itemId, perf]) => {
      const item = this.menuItems.get(itemId)!;
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
      improvementPotential: this.calculateImprovementPotential(performer.itemId)
    }));
    
    // Category performance
    const categoryPerformance: ProfitabilityAnalysis['categoryPerformance'] = {};
    
    performers.forEach(performer => {
      const item = this.menuItems.get(performer.itemId)!;
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

  private calculateImprovementPotential(itemId: string): string {
    const item = this.menuItems.get(itemId);
    if (!item) return 'Unknown';
    
    const improvements: string[] = [];
    
    if (item.profitMargin < 0.5) improvements.push('Increase pricing');
    if (item.popularity < 0.6) improvements.push('Marketing boost');
    if (item.preparationTime > 30) improvements.push('Process optimization');
    
    return improvements.join(', ') || 'Menu repositioning';
  }

  private assessMarketPositioning(): MarketPositioning {
    const competitiveAnalysis: MarketPositioning['competitiveAnalysis'] = {};
    
    this.menuItems.forEach((item, itemId) => {
      const marketAverage = this.marketConditions.competitorPricing[item.category];
      const priceRatio = item.basePrice / marketAverage;
      
      let positioningStrategy: 'premium' | 'competitive' | 'value';
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

  private calculateProjectedRevenue(
    currentRevenue: number, 
    pricingRecommendations: { [itemId: string]: PricingRecommendation },
    upsellOpportunities: UpsellOpportunity[]
  ): number {
    let projectedRevenue = currentRevenue;
    
    // Apply pricing changes
    Object.values(pricingRecommendations).forEach(rec => {
      const revenueImpact = (currentRevenue * 0.1) * (rec.expectedImpact.revenueChange / 100); // Assume 10% of revenue per item
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

  private generateRevenueActionItems(
    pricingRecommendations: { [itemId: string]: PricingRecommendation },
    upsellOpportunities: UpsellOpportunity[],
    profitabilityAnalysis: ProfitabilityAnalysis
  ): RevenueActionItem[] {
    const actionItems: RevenueActionItem[] = [];
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
        expectedImpact: opp.profitImpact * 30, // Monthly impact
        implementationEffort: 'medium',
        timeframe: '2 weeks training + 1 month monitoring',
        dependencies: ['Staff training materials', 'POS system updates'],
        measurableGoal: `Achieve ${opp.expectedUplift} uplift in average order value`
      });
    });
    
    // Menu optimization for bottom performers  
    profitabilityAnalysis.bottomPerformers.forEach(performer => {
      actionItems.push({
        id: `revenue_action_${itemId++}`,
        type: 'menu_optimization',
        priority: 'low',
        description: `Optimize or replace ${performer.itemName}`,
        expectedImpact: performer.revenue * 0.2, // 20% improvement potential
        implementationEffort: 'high',
        timeframe: '1-2 months analysis and implementation',
        dependencies: ['Market research', 'Recipe development'],
        measurableGoal: `Improve ${performer.itemName} profitability by 20%`
      });
    });
    
    return actionItems.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  private assessImplementationRisks(
    pricingRecommendations: { [itemId: string]: PricingRecommendation },
    riskTolerance: 'low' | 'medium' | 'high'
  ): RiskAssessment {
    const pricingRisks: RiskAssessment['pricingRisks'] = [];
    
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
    const marketRisks: RiskAssessment['marketRisks'] = [
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
      },
      {
        factor: 'Supply cost inflation',
        impact: -0.12,
        timeframe: '2-4 months',
        contingencyPlan: 'Diversify suppliers and optimize portions'
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

  // Public utility methods
  updateMarketConditions(conditions: Partial<MarketConditions>): void {
    this.marketConditions = { ...this.marketConditions, ...conditions };
  }

  recordSale(saleData: Omit<SalesData, 'timestamp'>): void {
    const sale: SalesData = {
      ...saleData,
      timestamp: new Date()
    };
    
    this.salesHistory.push(sale);
    
    // Update upsell performance if applicable
    if (sale.upsellSuccess) {
      const key = sale.itemId;
      const current = this.upsellPerformance.get(key) || { attempts: 0, successes: 0, revenue: 0 };
      current.successes++;
      current.revenue += sale.revenue;
      this.upsellPerformance.set(key, current);
    }
    
    // Keep only last 90 days of data
    const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    this.salesHistory = this.salesHistory.filter(s => s.timestamp >= cutoffDate);
  }

  getMenuPerformance(): { [itemId: string]: {
    totalRevenue: number;
    totalQuantity: number;
    averagePrice: number;
    profitMargin: number;
  }} {
    const performance: { [itemId: string]: any } = {};
    
    this.menuItems.forEach((item, itemId) => {
      const itemSales = this.salesHistory.filter(sale => sale.itemId === itemId);
      const totalRevenue = itemSales.reduce((sum, sale) => sum + sale.revenue, 0);
      const totalQuantity = itemSales.reduce((sum, sale) => sum + sale.quantity, 0);
      
      performance[itemId] = {
        totalRevenue,
        totalQuantity,
        averagePrice: totalQuantity > 0 ? totalRevenue / totalQuantity : item.basePrice,
        profitMargin: item.profitMargin
      };
    });
    
    return performance;
  }

  async processTask(task: any): Promise<RevenueOptimizationResult> {
    const { context } = task.data;
    return await this.optimizeRevenue(context);
  }
}

// Singleton instance
let revenueOptimizationAgent: RevenueOptimizationAgent | null = null;

export function getRevenueOptimizationAgent(): RevenueOptimizationAgent {
  if (!revenueOptimizationAgent) {
    revenueOptimizationAgent = new RevenueOptimizationAgent();
  }
  return revenueOptimizationAgent;
}

export type { 
  MenuItem, 
  SalesData, 
  MarketConditions, 
  RevenueOptimizationResult, 
  PricingRecommendation,
  UpsellOpportunity,
  DemandForecast,
  ProfitabilityAnalysis,
  MarketPositioning,
  RevenueActionItem,
  RiskAssessment
};