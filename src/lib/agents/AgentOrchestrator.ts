interface AgentMessage {
  id: string;
  type: 'task' | 'response' | 'update' | 'error';
  agentId: string;
  payload: any;
  timestamp: Date;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

interface AgentConfig {
  id: string;
  name: string;
  workerScript: string;
  capabilities: string[];
  maxConcurrentTasks: number;
  enabled: boolean;
}

interface TaskResult {
  taskId: string;
  agentId: string;
  success: boolean;
  result?: any;
  error?: string;
  executionTime: number;
  confidence?: number;
}

interface AgentPerformanceMetrics {
  agentId: string;
  tasksCompleted: number;
  averageResponseTime: number;
  successRate: number;
  currentLoad: number;
  lastActive: Date;
}

export class AgentOrchestrator {
  private agents: Map<string, Worker> = new Map();
  private agentConfigs: Map<string, AgentConfig> = new Map();
  private taskQueue: AgentMessage[] = [];
  private pendingTasks: Map<string, AgentMessage> = new Map();
  private agentMetrics: Map<string, AgentPerformanceMetrics> = new Map();
  private messageHandlers: Map<string, Function[]> = new Map();
  private isInitialized = false;

  // Restaurant-specific agent configurations
  private readonly defaultAgentConfigs: AgentConfig[] = [
    {
      id: 'order-optimizer',
      name: 'Order Optimization Agent',
      workerScript: '/workers/orderOptimizationAgent.js',
      capabilities: ['order_batching', 'kitchen_efficiency', 'time_estimation'],
      maxConcurrentTasks: 3,
      enabled: true
    },
    {
      id: 'inventory-predictor',
      name: 'Inventory Prediction Agent',
      workerScript: '/workers/inventoryPredictionAgent.js',
      capabilities: ['stock_prediction', 'demand_forecasting', 'alert_generation'],
      maxConcurrentTasks: 2,
      enabled: true
    },
    {
      id: 'customer-satisfaction',
      name: 'Customer Satisfaction Agent',
      workerScript: '/workers/customerSatisfactionAgent.js',
      capabilities: ['service_monitoring', 'satisfaction_scoring', 'feedback_analysis'],
      maxConcurrentTasks: 5,
      enabled: true
    },
    {
      id: 'revenue-optimizer',
      name: 'Revenue Optimization Agent',
      workerScript: '/workers/revenueOptimizationAgent.js',
      capabilities: ['dynamic_pricing', 'upsell_suggestions', 'profit_analysis'],
      maxConcurrentTasks: 2,
      enabled: true
    }
  ];

  constructor() {
    this.setupMessageHandlers();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Initialize all configured agents
      for (const config of this.defaultAgentConfigs) {
        if (config.enabled) {
          await this.createAgent(config);
        }
      }

      // Start task processing
      this.startTaskProcessor();
      
      // Initialize performance monitoring
      this.startPerformanceMonitoring();

      this.isInitialized = true;
      console.log('AI Agent Orchestrator initialized with', this.agents.size, 'agents');
    } catch (error) {
      console.error('Failed to initialize Agent Orchestrator:', error);
      throw error;
    }
  }

  private async createAgent(config: AgentConfig): Promise<void> {
    try {
      // Create the worker (fallback to inline worker if file doesn't exist)
      const worker = await this.createWorkerFromScript(config.workerScript, config.id);
      
      // Set up message handling
      worker.onmessage = (event) => this.handleAgentMessage(config.id, event.data);
      worker.onerror = (error) => this.handleAgentError(config.id, error);

      // Initialize the agent
      worker.postMessage({
        type: 'init',
        config: {
          agentId: config.id,
          capabilities: config.capabilities,
          maxConcurrentTasks: config.maxConcurrentTasks
        }
      });

      this.agents.set(config.id, worker);
      this.agentConfigs.set(config.id, config);
      
      // Initialize metrics
      this.agentMetrics.set(config.id, {
        agentId: config.id,
        tasksCompleted: 0,
        averageResponseTime: 0,
        successRate: 1.0,
        currentLoad: 0,
        lastActive: new Date()
      });

      console.log(`Agent ${config.name} (${config.id}) initialized successfully`);
    } catch (error) {
      console.error(`Failed to create agent ${config.id}:`, error);
    }
  }

  private async createWorkerFromScript(scriptPath: string, agentType: string): Promise<Worker> {
    // Try to load the external script first
    try {
      return new Worker(scriptPath);
    } catch (error) {
      console.warn(`External worker script not found for ${agentType}, creating inline worker`);
      
      // Create inline worker as fallback
      const workerCode = this.generateInlineWorkerCode(agentType);
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      
      return new Worker(workerUrl);
    }
  }

  private generateInlineWorkerCode(agentType: string): string {
    // Generate agent-specific worker code
    const baseWorkerCode = `
      let agentConfig = {};
      let taskQueue = [];
      let isProcessing = false;

      self.onmessage = function(event) {
        const { type, config, task } = event.data;
        
        switch (type) {
          case 'init':
            agentConfig = config;
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
          const result = await ${this.getAgentProcessorFunction(agentType)}(task);
          
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

        // Process next task
        setTimeout(() => processNextTask(), 10);
      }

      ${this.getAgentSpecificCode(agentType)}
    `;

    return baseWorkerCode;
  }

  private getAgentProcessorFunction(agentType: string): string {
    switch (agentType) {
      case 'order-optimizer':
        return 'processOrderOptimization';
      case 'inventory-predictor':
        return 'processInventoryPrediction';
      case 'customer-satisfaction':
        return 'processCustomerSatisfaction';
      case 'revenue-optimizer':
        return 'processRevenueOptimization';
      default:
        return 'processGenericTask';
    }
  }

  private getAgentSpecificCode(agentType: string): string {
    switch (agentType) {
      case 'order-optimizer':
        return `
          async function processOrderOptimization(task) {
            const { orders, tables, kitchenStatus } = task.data;
            
            // Simulate order batching optimization
            const batches = [];
            const maxBatchSize = 5;
            
            for (let i = 0; i < orders.length; i += maxBatchSize) {
              const batch = orders.slice(i, i + maxBatchSize);
              const estimatedTime = batch.length * 3 + Math.random() * 5; // 3-8 mins per batch
              
              batches.push({
                orders: batch,
                estimatedTime: Math.round(estimatedTime),
                priority: batch.some(o => o.priority === 'high') ? 'high' : 'normal',
                suggestedSequence: batch.sort((a, b) => a.complexity - b.complexity)
              });
            }
            
            return {
              type: 'order_optimization',
              batches,
              totalEstimatedTime: batches.reduce((sum, b) => sum + b.estimatedTime, 0),
              efficiencyGain: Math.round(Math.random() * 20 + 10) + '%',
              recommendations: [
                'Prep common ingredients in bulk',
                'Prioritize high-margin items',
                'Consider kitchen capacity'
              ]
            };
          }
        `;

      case 'inventory-predictor':
        return `
          async function processInventoryPrediction(task) {
            const { currentInventory, salesHistory, seasonalTrends } = task.data;
            
            // Simulate demand prediction
            const predictions = {};
            const alerts = [];
            
            Object.entries(currentInventory).forEach(([item, quantity]) => {
              const historicalAvg = Math.random() * 10 + 5; // Mock historical average
              const trendMultiplier = 1 + (Math.random() - 0.5) * 0.3; // ±15% trend
              const predictedDemand = historicalAvg * trendMultiplier;
              
              predictions[item] = {
                currentStock: quantity,
                predictedDemand: Math.round(predictedDemand),
                daysUntilStockout: Math.round(quantity / predictedDemand),
                confidenceLevel: Math.random() * 0.3 + 0.7 // 70-100%
              };
              
              if (quantity < predictedDemand * 2) {
                alerts.push({
                  item,
                  severity: quantity < predictedDemand ? 'critical' : 'warning',
                  message: \`\${item} may run out in \${Math.round(quantity / predictedDemand)} days\`,
                  suggestedOrder: Math.round(predictedDemand * 7) // 1 week supply
                });
              }
            });
            
            return {
              type: 'inventory_prediction',
              predictions,
              alerts,
              overallScore: Math.round(Math.random() * 30 + 70), // 70-100% efficiency
              topRecommendations: alerts.slice(0, 3)
            };
          }
        `;

      case 'customer-satisfaction':
        return `
          async function processCustomerSatisfaction(task) {
            const { orders, serviceTimes, feedback } = task.data;
            
            // Simulate satisfaction scoring
            let totalScore = 0;
            let scoreCount = 0;
            const issues = [];
            
            orders.forEach(order => {
              const serviceTime = serviceTimes[order.id] || 0;
              let orderScore = 100;
              
              // Penalize long service times
              if (serviceTime > 30) orderScore -= 20;
              if (serviceTime > 45) orderScore -= 30;
              
              // Random satisfaction factors
              orderScore += (Math.random() - 0.5) * 20;
              orderScore = Math.max(0, Math.min(100, orderScore));
              
              totalScore += orderScore;
              scoreCount++;
              
              if (orderScore < 70) {
                issues.push({
                  orderId: order.id,
                  tableId: order.tableId,
                  issue: serviceTime > 30 ? 'Slow service' : 'Quality concerns',
                  score: orderScore,
                  recommendation: 'Follow up with customer'
                });
              }
            });
            
            const averageScore = scoreCount > 0 ? totalScore / scoreCount : 85;
            
            return {
              type: 'customer_satisfaction',
              averageScore: Math.round(averageScore),
              totalOrders: scoreCount,
              issues: issues.slice(0, 5),
              trend: Math.random() > 0.5 ? 'improving' : 'declining',
              recommendations: [
                'Monitor service times closely',
                'Train staff on customer interaction',
                'Follow up on negative feedback'
              ]
            };
          }
        `;

      case 'revenue-optimizer':
        return `
          async function processRevenueOptimization(task) {
            const { salesData, menuItems, marketConditions } = task.data;
            
            // Simulate revenue optimization
            const recommendations = [];
            const pricingAdjustments = {};
            
            menuItems.forEach(item => {
              const currentPrice = item.price;
              const demand = Math.random() * 100; // Mock demand
              const profitMargin = (currentPrice - item.cost) / currentPrice;
              
              let suggestedPrice = currentPrice;
              let reasoning = 'Maintain current price';
              
              if (demand > 80 && profitMargin < 0.6) {
                suggestedPrice = currentPrice * 1.1;
                reasoning = 'High demand, increase price';
              } else if (demand < 30 && profitMargin > 0.4) {
                suggestedPrice = currentPrice * 0.95;
                reasoning = 'Low demand, decrease price to boost sales';
              }
              
              if (Math.abs(suggestedPrice - currentPrice) > 0.01) {
                pricingAdjustments[item.id] = {
                  currentPrice,
                  suggestedPrice: Math.round(suggestedPrice),
                  expectedImpact: Math.round((Math.random() * 10 + 5)) + '% revenue change',
                  reasoning
                };
              }
            });
            
            // Generate upsell opportunities
            const upsellSuggestions = [
              { combo: 'Dal + Rice + Naan', discount: '10%', expectedUplift: '15%' },
              { combo: 'Chai + Samosa', discount: '5%', expectedUplift: '8%' },
              { combo: 'Paneer + Lassi', discount: '8%', expectedUplift: '12%' }
            ];
            
            return {
              type: 'revenue_optimization',
              pricingAdjustments,
              upsellSuggestions,
              totalPotentialIncrease: Math.round(Math.random() * 15 + 5) + '%',
              topRecommendations: Object.values(pricingAdjustments).slice(0, 3)
            };
          }
        `;

      default:
        return `
          async function processGenericTask(task) {
            // Generic task processing
            await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 400));
            
            return {
              type: 'generic_result',
              processed: true,
              timestamp: new Date().toISOString()
            };
          }
        `;
    }
  }

  private setupMessageHandlers(): void {
    // Set up global message handlers for different message types
    this.on('task_complete', (agentId: string, message: any) => {
      this.handleTaskCompletion(agentId, message);
    });

    this.on('agent_ready', (agentId: string, message: any) => {
      console.log(`Agent ${agentId} is ready`);
    });

    this.on('agent_error', (agentId: string, error: any) => {
      console.error(`Agent ${agentId} error:`, error);
    });
  }

  private handleAgentMessage(agentId: string, message: any): void {
    // Update metrics
    const metrics = this.agentMetrics.get(agentId);
    if (metrics) {
      metrics.lastActive = new Date();
    }

    // Emit to registered handlers
    this.emit(message.type, agentId, message);
  }

  private handleAgentError(agentId: string, error: any): void {
    console.error(`Worker error in agent ${agentId}:`, error);
    this.emit('agent_error', agentId, error);
  }

  private handleTaskCompletion(agentId: string, message: any): void {
    const pendingTask = this.pendingTasks.get(message.taskId);
    if (pendingTask) {
      this.pendingTasks.delete(message.taskId);
      
      // Update metrics
      const metrics = this.agentMetrics.get(agentId);
      if (metrics) {
        metrics.tasksCompleted++;
        metrics.averageResponseTime = (metrics.averageResponseTime + message.executionTime) / 2;
        metrics.successRate = (metrics.successRate * 0.9 + (message.success ? 1 : 0) * 0.1);
        metrics.currentLoad = this.pendingTasks.size;
      }

      // Emit completion event
      this.emit('task_result', agentId, {
        taskId: message.taskId,
        agentId,
        success: message.success,
        result: message.result,
        error: message.error,
        executionTime: message.executionTime
      });
    }
  }

  // Public API
  async assignTask(capability: string, taskData: any, priority: 'low' | 'medium' | 'high' | 'critical' = 'medium'): Promise<string> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Find capable agents
    const capableAgents = Array.from(this.agentConfigs.values())
      .filter(config => config.capabilities.includes(capability) && config.enabled);

    if (capableAgents.length === 0) {
      throw new Error(`No agents available for capability: ${capability}`);
    }

    // Select best agent based on current load and performance
    const selectedAgent = this.selectBestAgent(capableAgents);
    
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const task: AgentMessage = {
      id: taskId,
      type: 'task',
      agentId: selectedAgent.id,
      payload: {
        capability,
        data: taskData,
        assignedAgent: selectedAgent.id
      },
      priority,
      timestamp: new Date()
    };

    // Add to pending tasks
    this.pendingTasks.set(taskId, task);

    // Send to worker
    const worker = this.agents.get(selectedAgent.id);
    if (worker) {
      worker.postMessage({
        type: 'task',
        task
      });
    }

    return taskId;
  }

  private selectBestAgent(capableAgents: AgentConfig[]): AgentConfig {
    // Simple load balancing - select agent with lowest current load
    let bestAgent = capableAgents[0];
    let lowestLoad = Infinity;

    for (const agent of capableAgents) {
      const metrics = this.agentMetrics.get(agent.id);
      if (metrics && metrics.currentLoad < lowestLoad) {
        lowestLoad = metrics.currentLoad;
        bestAgent = agent;
      }
    }

    return bestAgent;
  }

  // Event system
  on(eventType: string, handler: Function): void {
    if (!this.messageHandlers.has(eventType)) {
      this.messageHandlers.set(eventType, []);
    }
    this.messageHandlers.get(eventType)!.push(handler);
  }

  off(eventType: string, handler: Function): void {
    const handlers = this.messageHandlers.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  private emit(eventType: string, ...args: any[]): void {
    const handlers = this.messageHandlers.get(eventType);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(...args);
        } catch (error) {
          console.error(`Error in event handler for ${eventType}:`, error);
        }
      });
    }
  }

  private startTaskProcessor(): void {
    // Process queued tasks periodically
    setInterval(() => {
      if (this.taskQueue.length > 0) {
        // Sort by priority
        this.taskQueue.sort((a, b) => {
          const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        });

        // Process high priority tasks first
        // Implementation would go here
      }
    }, 1000);
  }

  private startPerformanceMonitoring(): void {
    setInterval(() => {
      // Log performance metrics
      const metrics = Array.from(this.agentMetrics.values());
      const totalTasks = metrics.reduce((sum, m) => sum + m.tasksCompleted, 0);
      const avgResponseTime = metrics.reduce((sum, m) => sum + m.averageResponseTime, 0) / metrics.length;
      
      console.log(`Agent Performance: ${totalTasks} tasks completed, ${Math.round(avgResponseTime)}ms avg response`);
    }, 60000); // Every minute
  }

  // Utility methods
  getAgentStatus(): { [agentId: string]: AgentPerformanceMetrics } {
    const status: { [agentId: string]: AgentPerformanceMetrics } = {};
    this.agentMetrics.forEach((metrics, agentId) => {
      status[agentId] = { ...metrics };
    });
    return status;
  }

  async shutdown(): Promise<void> {
    // Shutdown all agents
    const shutdownPromises = Array.from(this.agents.entries()).map(([agentId, worker]) => {
      return new Promise<void>((resolve) => {
        worker.postMessage({ type: 'shutdown' });
        worker.terminate();
        resolve();
      });
    });

    await Promise.all(shutdownPromises);
    
    this.agents.clear();
    this.agentConfigs.clear();
    this.agentMetrics.clear();
    this.isInitialized = false;
    
    console.log('Agent Orchestrator shutdown complete');
  }
}

// Singleton instance
let agentOrchestrator: AgentOrchestrator | null = null;

export function getAgentOrchestrator(): AgentOrchestrator {
  if (!agentOrchestrator) {
    agentOrchestrator = new AgentOrchestrator();
  }
  return agentOrchestrator;
}

export type { AgentMessage, AgentConfig, TaskResult, AgentPerformanceMetrics };