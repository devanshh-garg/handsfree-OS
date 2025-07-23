import { MessageBus } from './MessageBus';

interface AgentConfig {
  id: string;
  workerPath: string;
  capabilities: string[];
  priority: number;
  maxConcurrentTasks: number;
  restartOnError: boolean;
}

interface Task {
  id: string;
  type: string;
  data: any;
  priority: 'low' | 'medium' | 'high' | 'critical';
  timeout?: number;
  retries?: number;
  assignedAgent?: string;
  status: 'pending' | 'assigned' | 'running' | 'completed' | 'failed';
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  result?: any;
  error?: string;
}

export class AgentManager {
  private static instance: AgentManager;
  private messageBus: MessageBus;
  private agentConfigs: Map<string, AgentConfig> = new Map();
  private workers: Map<string, Worker> = new Map();
  private tasks: Map<string, Task> = new Map();
  private taskQueue: Task[] = [];
  private isProcessing: boolean = false;

  private constructor() {
    this.messageBus = MessageBus.getInstance();
    this.setupMessageRoutes();
    this.initializeAgents();
  }

  public static getInstance(): AgentManager {
    if (!AgentManager.instance) {
      AgentManager.instance = new AgentManager();
    }
    return AgentManager.instance;
  }

  private async initializeAgents(): Promise<void> {
    const agents: AgentConfig[] = [
      {
        id: 'orderOptimization',
        workerPath: '/workers/orderOptimizationAgent.js',
        capabilities: ['order_optimization', 'kitchen_management', 'batch_processing'],
        priority: 1,
        maxConcurrentTasks: 3,
        restartOnError: true
      },
      {
        id: 'inventoryPrediction',
        workerPath: '/workers/inventoryPredictionAgent.js',
        capabilities: ['inventory_analysis', 'demand_forecasting', 'stock_management'],
        priority: 2,
        maxConcurrentTasks: 2,
        restartOnError: true
      },
      {
        id: 'customerSatisfaction',
        workerPath: '/workers/customerSatisfactionAgent.js',
        capabilities: ['sentiment_analysis', 'customer_feedback', 'service_monitoring'],
        priority: 1,
        maxConcurrentTasks: 4,
        restartOnError: true
      },
      {
        id: 'revenueOptimization',
        workerPath: '/workers/revenueOptimizationAgent.js',
        capabilities: ['pricing_optimization', 'revenue_analysis', 'market_analysis'],
        priority: 3,
        maxConcurrentTasks: 2,
        restartOnError: true
      },
      {
        id: 'nlpProcessor',
        workerPath: '/workers/nlpProcessor.js',
        capabilities: ['nlp_processing', 'text_analysis', 'language_detection'],
        priority: 1,
        maxConcurrentTasks: 5,
        restartOnError: true
      }
    ];

    for (const config of agents) {
      await this.registerAgent(config);
    }

    console.log('AgentManager: All agents initialized');
  }

  public async registerAgent(config: AgentConfig): Promise<void> {
    try {
      const worker = new Worker(config.workerPath);
      
      worker.postMessage({
        type: 'init',
        config: {
          agentId: config.id,
          capabilities: config.capabilities,
          maxConcurrentTasks: config.maxConcurrentTasks
        }
      });

      this.agentConfigs.set(config.id, config);
      this.workers.set(config.id, worker);

      await this.messageBus.registerAgent(config.id, worker, config.capabilities);

      console.log(`AgentManager: Registered agent ${config.id}`);
    } catch (error) {
      console.error(`AgentManager: Failed to register agent ${config.id}:`, error);
      
      if (config.restartOnError) {
        setTimeout(() => this.registerAgent(config), 5000);
      }
    }
  }

  public async submitTask(taskData: Omit<Task, 'id' | 'status' | 'createdAt'>): Promise<string> {
    const task: Task = {
      ...taskData,
      id: this.generateTaskId(),
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    this.tasks.set(task.id, task);
    this.taskQueue.push(task);
    this.sortTaskQueue();

    if (!this.isProcessing) {
      this.processTaskQueue();
    }

    return task.id;
  }

  public async getTaskStatus(taskId: string): Promise<Task | null> {
    return this.tasks.get(taskId) || null;
  }

  public async getTaskResult(taskId: string, timeout: number = 30000): Promise<any> {
    return new Promise((resolve, reject) => {
      const task = this.tasks.get(taskId);
      if (!task) {
        reject(new Error(`Task ${taskId} not found`));
        return;
      }

      if (task.status === 'completed') {
        resolve(task.result);
        return;
      }

      if (task.status === 'failed') {
        reject(new Error(task.error || 'Task failed'));
        return;
      }

      const timeoutHandle = setTimeout(() => {
        reject(new Error(`Task ${taskId} timeout after ${timeout}ms`));
      }, timeout);

      const checkStatus = () => {
        const currentTask = this.tasks.get(taskId);
        if (currentTask?.status === 'completed') {
          clearTimeout(timeoutHandle);
          resolve(currentTask.result);
        } else if (currentTask?.status === 'failed') {
          clearTimeout(timeoutHandle);
          reject(new Error(currentTask.error || 'Task failed'));
        } else {
          setTimeout(checkStatus, 100);
        }
      };

      checkStatus();
    });
  }

  public async findBestAgent(capability: string, taskType?: string): Promise<string | null> {
    const candidates = await this.messageBus.findAgentsByCapability(capability);
    
    if (candidates.length === 0) {
      return null;
    }

    const agentStatus = this.messageBus.getAgentStatus();
    const queueStatus = this.messageBus.getQueueStatus();

    const scoredCandidates = candidates.map(agentId => {
      const config = this.agentConfigs.get(agentId);
      const status = agentStatus[agentId];
      const queueLength = queueStatus[agentId] || 0;

      let score = config?.priority || 1;
      
      if (status?.status === 'idle') score += 10;
      else if (status?.status === 'busy') score += 5;
      else if (status?.status === 'error') score -= 20;

      score -= queueLength * 2;

      if (taskType && config?.capabilities.some(cap => cap.includes(taskType))) {
        score += 5;
      }

      return { agentId, score };
    });

    scoredCandidates.sort((a, b) => b.score - a.score);
    return scoredCandidates[0]?.agentId || null;
  }

  public async delegateTask(taskId: string, agentId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    task.assignedAgent = agentId;
    task.status = 'assigned';
    task.startedAt = new Date().toISOString();

    await this.messageBus.sendMessage({
      type: 'task',
      agentId: 'system',
      targetAgent: agentId,
      payload: {
        task: {
          id: taskId,
          type: task.type,
          data: task.data,
          priority: task.priority
        }
      },
      priority: task.priority
    });

    task.status = 'running';
    console.log(`AgentManager: Delegated task ${taskId} to agent ${agentId}`);
  }

  public async broadcastUpdate(type: string, data: any): Promise<void> {
    await this.messageBus.broadcast(`update:${type}`, data, 'medium');
  }

  public async coordinateAgents(scenario: string, context: any): Promise<any> {
    switch (scenario) {
      case 'order_processing':
        return await this.coordinateOrderProcessing(context);
      case 'customer_feedback':
        return await this.coordinateCustomerFeedback(context);
      case 'inventory_alert':
        return await this.coordinateInventoryAlert(context);
      case 'revenue_analysis':
        return await this.coordinateRevenueAnalysis(context);
      default:
        throw new Error(`Unknown coordination scenario: ${scenario}`);
    }
  }

  private async coordinateOrderProcessing(context: any): Promise<any> {
    const results = await Promise.allSettled([
      this.submitTaskAndWait({
        type: 'optimize_orders',
        data: { orders: context.orders, context },
        priority: 'high',
        timeout: 15000
      }),
      this.submitTaskAndWait({
        type: 'check_inventory',
        data: { orderIds: context.orders.map((o: any) => o.id) },
        priority: 'medium',
        timeout: 10000
      })
    ]);

    const optimization = results[0].status === 'fulfilled' ? results[0].value : null;
    const inventory = results[1].status === 'fulfilled' ? results[1].value : null;

    return {
      optimization,
      inventory,
      recommendations: this.generateOrderRecommendations(optimization, inventory)
    };
  }

  private async coordinateCustomerFeedback(context: any): Promise<any> {
    const nlpTaskId = await this.submitTask({
      type: 'analyze_text',
      data: { 
        text: context.feedback,
        operation: 'complete_analysis'
      },
      priority: 'high'
    });

    const nlpResult = await this.getTaskResult(nlpTaskId, 10000);

    const satisfactionTaskId = await this.submitTask({
      type: 'analyze_satisfaction',
      data: {
        feedback: {
          ...context,
          sentiment: nlpResult.sentiment,
          intent: nlpResult.intent
        }
      },
      priority: 'high'
    });

    const satisfactionResult = await this.getTaskResult(satisfactionTaskId, 15000);

    return {
      nlpAnalysis: nlpResult,
      satisfactionAnalysis: satisfactionResult,
      actionItems: this.generateFeedbackActions(nlpResult, satisfactionResult)
    };
  }

  private async coordinateInventoryAlert(context: any): Promise<any> {
    const predictionTaskId = await this.submitTask({
      type: 'predict_inventory',
      data: { context },
      priority: 'high'
    });

    const prediction = await this.getTaskResult(predictionTaskId, 12000);

    if (prediction.alerts?.some((alert: any) => alert.severity === 'urgent')) {
      await this.broadcastUpdate('critical_inventory', {
        alerts: prediction.alerts.filter((alert: any) => alert.severity === 'urgent'),
        timestamp: new Date().toISOString()
      });
    }

    return prediction;
  }

  private async coordinateRevenueAnalysis(context: any): Promise<any> {
    const [orderOptimization, inventoryData, customerData] = await Promise.allSettled([
      this.submitTaskAndWait({
        type: 'analyze_orders',
        data: { timeRange: context.timeRange },
        priority: 'medium'
      }),
      this.submitTaskAndWait({
        type: 'analyze_inventory_costs',
        data: { timeRange: context.timeRange },
        priority: 'medium'
      }),
      this.submitTaskAndWait({
        type: 'analyze_customer_satisfaction',
        data: { timeRange: context.timeRange },
        priority: 'medium'
      })
    ]);

    const revenueTaskId = await this.submitTask({
      type: 'optimize_revenue',
      data: {
        orderData: orderOptimization.status === 'fulfilled' ? orderOptimization.value : null,
        inventoryData: inventoryData.status === 'fulfilled' ? inventoryData.value : null,
        customerData: customerData.status === 'fulfilled' ? customerData.value : null,
        context
      },
      priority: 'high'
    });

    return await this.getTaskResult(revenueTaskId, 20000);
  }

  private async submitTaskAndWait(taskData: Omit<Task, 'id' | 'status' | 'createdAt'>): Promise<any> {
    const taskId = await this.submitTask(taskData);
    return await this.getTaskResult(taskId, taskData.timeout || 15000);
  }

  private generateOrderRecommendations(optimization: any, inventory: any): string[] {
    const recommendations: string[] = [];
    
    if (optimization?.bottlenecks?.length > 0) {
      recommendations.push('Kitchen bottlenecks detected - consider staff reallocation');
    }
    
    if (inventory?.alerts?.length > 0) {
      recommendations.push('Inventory alerts require attention before processing orders');
    }
    
    if (optimization?.efficiencyGain && parseInt(optimization.efficiencyGain) > 20) {
      recommendations.push('High efficiency gains possible with optimized batching');
    }
    
    return recommendations;
  }

  private generateFeedbackActions(nlpResult: any, satisfactionResult: any): any[] {
    const actions: any[] = [];
    
    if (nlpResult.sentiment?.sentiment === 'negative' && nlpResult.sentiment?.urgency === 'critical') {
      actions.push({
        type: 'immediate_response',
        priority: 'critical',
        description: 'Customer requires immediate attention'
      });
    }
    
    if (satisfactionResult.actionItems?.length > 0) {
      actions.push(...satisfactionResult.actionItems);
    }
    
    return actions;
  }

  private async processTaskQueue(): Promise<void> {
    if (this.isProcessing || this.taskQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.taskQueue.length > 0) {
      const task = this.taskQueue.shift()!;
      
      try {
        const bestAgent = await this.findBestAgent(
          this.getRequiredCapability(task.type),
          task.type
        );

        if (bestAgent) {
          await this.delegateTask(task.id, bestAgent);
        } else {
          task.status = 'failed';
          task.error = 'No suitable agent available';
          task.completedAt = new Date().toISOString();
        }
      } catch (error) {
        task.status = 'failed';
        task.error = error instanceof Error ? error.message : 'Unknown error';
        task.completedAt = new Date().toISOString();
      }

      await new Promise(resolve => setTimeout(resolve, 10));
    }

    this.isProcessing = false;
  }

  private getRequiredCapability(taskType: string): string {
    const capabilityMap: { [key: string]: string } = {
      'optimize_orders': 'order_optimization',
      'analyze_orders': 'order_optimization',
      'predict_inventory': 'inventory_analysis',
      'check_inventory': 'inventory_analysis',
      'analyze_inventory_costs': 'inventory_analysis',
      'analyze_satisfaction': 'sentiment_analysis',
      'analyze_customer_satisfaction': 'sentiment_analysis',
      'optimize_revenue': 'pricing_optimization',
      'analyze_text': 'nlp_processing',
      'process_text': 'nlp_processing'
    };

    return capabilityMap[taskType] || 'nlp_processing';
  }

  private setupMessageRoutes(): void {
    this.messageBus.addRoute('task_complete', async (message) => {
      const task = this.tasks.get(message.payload.taskId);
      if (task) {
        if (message.payload.success) {
          task.status = 'completed';
          task.result = message.payload.result;
        } else {
          task.status = 'failed';
          task.error = message.payload.error;
        }
        task.completedAt = new Date().toISOString();
      }
    }, 10);

    this.messageBus.addRoute(/^update:/, async (message) => {
      console.log(`AgentManager: Received update - ${message.type}:`, message.payload);
    }, 5);

    this.messageBus.on('agent:status_changed', (data) => {
      console.log(`AgentManager: Agent ${data.agentId} status changed to ${data.status}`);
      
      if (data.status === 'error') {
        this.handleAgentError(data.agentId);
      }
    });
  }

  private async handleAgentError(agentId: string): Promise<void> {
    const config = this.agentConfigs.get(agentId);
    if (config?.restartOnError) {
      console.log(`AgentManager: Restarting failed agent ${agentId}`);
      
      await this.messageBus.unregisterAgent(agentId);
      this.workers.delete(agentId);
      
      setTimeout(() => this.registerAgent(config), 2000);
    }
  }

  private sortTaskQueue(): void {
    const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    
    this.taskQueue.sort((a, b) => {
      const aPriority = priorityOrder[a.priority];
      const bPriority = priorityOrder[b.priority];
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }
      
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }

  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  public getSystemStatus(): any {
    return {
      agents: this.messageBus.getAgentStatus(),
      queues: this.messageBus.getQueueStatus(),
      tasks: {
        total: this.tasks.size,
        pending: Array.from(this.tasks.values()).filter(t => t.status === 'pending').length,
        running: Array.from(this.tasks.values()).filter(t => t.status === 'running').length,
        completed: Array.from(this.tasks.values()).filter(t => t.status === 'completed').length,
        failed: Array.from(this.tasks.values()).filter(t => t.status === 'failed').length
      },
      capabilities: this.messageBus.getCapabilityMap()
    };
  }

  public shutdown(): void {
    this.workers.forEach((worker, agentId) => {
      this.messageBus.unregisterAgent(agentId);
    });
    
    this.messageBus.shutdown();
    this.workers.clear();
    this.tasks.clear();
    this.taskQueue = [];
  }
}