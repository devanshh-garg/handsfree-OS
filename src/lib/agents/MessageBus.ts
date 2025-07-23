interface Message {
  id: string;
  type: string;
  agentId: string;
  targetAgent?: string;
  payload: any;
  timestamp: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  requiresResponse?: boolean;
  correlationId?: string;
  timeout?: number;
}

interface MessageRoute {
  pattern: string | RegExp;
  handler: (message: Message) => Promise<void>;
  priority: number;
}

interface Agent {
  id: string;
  worker?: Worker;
  status: 'idle' | 'busy' | 'error' | 'shutdown';
  messageQueue: Message[];
  capabilities: string[];
  lastHeartbeat: string;
}

export class MessageBus {
  private static instance: MessageBus;
  
  private agents: Map<string, Agent> = new Map();
  private messageHistory: Message[] = [];
  private routes: MessageRoute[] = [];
  private eventListeners: Map<string, Function[]> = new Map();
  private pendingResponses: Map<string, {
    resolve: (value: any) => void;
    reject: (error: any) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();
  
  private persistence: boolean = true;
  private maxHistorySize: number = 1000;
  private heartbeatInterval: number = 30000;
  private heartbeatTimer?: NodeJS.Timeout;

  private constructor() {
    this.startHeartbeat();
    this.setupGlobalErrorHandling();
  }

  public static getInstance(): MessageBus {
    if (!MessageBus.instance) {
      MessageBus.instance = new MessageBus();
    }
    return MessageBus.instance;
  }

  public async registerAgent(agentId: string, worker?: Worker, capabilities: string[] = []): Promise<void> {
    const agent: Agent = {
      id: agentId,
      worker,
      status: 'idle',
      messageQueue: [],
      capabilities,
      lastHeartbeat: new Date().toISOString()
    };

    this.agents.set(agentId, agent);

    if (worker) {
      this.setupWorkerEventHandlers(agentId, worker);
    }

    await this.emit('agent:registered', { agentId, capabilities });
    console.log(`MessageBus: Agent ${agentId} registered with capabilities:`, capabilities);
  }

  public async unregisterAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.status = 'shutdown';
      
      if (agent.worker) {
        agent.worker.postMessage({ type: 'shutdown' });
        agent.worker.terminate();
      }

      this.agents.delete(agentId);
      await this.emit('agent:unregistered', { agentId });
      console.log(`MessageBus: Agent ${agentId} unregistered`);
    }
  }

  public async sendMessage(message: Omit<Message, 'id' | 'timestamp'>): Promise<string> {
    const fullMessage: Message = {
      ...message,
      id: this.generateMessageId(),
      timestamp: new Date().toISOString()
    };

    this.messageHistory.push(fullMessage);
    this.trimMessageHistory();

    if (message.targetAgent) {
      await this.routeToSpecificAgent(fullMessage);
    } else {
      await this.broadcastMessage(fullMessage);
    }

    await this.emit('message:sent', fullMessage);
    return fullMessage.id;
  }

  public async sendMessageAndWaitForResponse(
    message: Omit<Message, 'id' | 'timestamp' | 'requiresResponse'>,
    timeout: number = 10000
  ): Promise<any> {
    const messageWithResponse = {
      ...message,
      requiresResponse: true,
      timeout
    };

    const messageId = await this.sendMessage(messageWithResponse);
    
    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.pendingResponses.delete(messageId);
        reject(new Error(`Message timeout after ${timeout}ms`));
      }, timeout);

      this.pendingResponses.set(messageId, {
        resolve,
        reject,
        timeout: timeoutHandle
      });
    });
  }

  public async sendResponse(originalMessageId: string, agentId: string, response: any): Promise<void> {
    const responseMessage: Message = {
      id: this.generateMessageId(),
      type: 'response',
      agentId,
      payload: response,
      timestamp: new Date().toISOString(),
      priority: 'medium',
      correlationId: originalMessageId
    };

    const pendingResponse = this.pendingResponses.get(originalMessageId);
    if (pendingResponse) {
      clearTimeout(pendingResponse.timeout);
      this.pendingResponses.delete(originalMessageId);
      pendingResponse.resolve(response);
    }

    this.messageHistory.push(responseMessage);
    await this.emit('response:sent', responseMessage);
  }

  public addRoute(pattern: string | RegExp, handler: (message: Message) => Promise<void>, priority: number = 0): void {
    this.routes.push({ pattern, handler, priority });
    this.routes.sort((a, b) => b.priority - a.priority);
  }

  public removeRoute(pattern: string | RegExp): void {
    this.routes = this.routes.filter(route => route.pattern !== pattern);
  }

  public on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  public off(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  public async broadcast(type: string, payload: any, priority: 'low' | 'medium' | 'high' | 'critical' = 'medium'): Promise<void> {
    await this.sendMessage({
      type,
      agentId: 'system',
      payload,
      priority
    });
  }

  public getAgentStatus(): { [agentId: string]: Agent } {
    const status: { [agentId: string]: Agent } = {};
    this.agents.forEach((agent, agentId) => {
      status[agentId] = { ...agent };
    });
    return status;
  }

  public getMessageHistory(limit: number = 100, agentId?: string, messageType?: string): Message[] {
    let filtered = [...this.messageHistory];

    if (agentId) {
      filtered = filtered.filter(msg => msg.agentId === agentId || msg.targetAgent === agentId);
    }

    if (messageType) {
      filtered = filtered.filter(msg => msg.type === messageType);
    }

    return filtered
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  public getQueueStatus(): { [agentId: string]: number } {
    const queueStatus: { [agentId: string]: number } = {};
    this.agents.forEach((agent, agentId) => {
      queueStatus[agentId] = agent.messageQueue.length;
    });
    return queueStatus;
  }

  public async flushQueues(): Promise<void> {
    for (const [agentId, agent] of this.agents.entries()) {
      while (agent.messageQueue.length > 0) {
        const message = agent.messageQueue.shift()!;
        await this.deliverMessage(agentId, message);
      }
    }
  }

  public async pauseAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (agent && agent.status !== 'shutdown') {
      agent.status = 'busy';
      await this.emit('agent:paused', { agentId });
    }
  }

  public async resumeAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (agent && agent.status === 'busy') {
      agent.status = 'idle';
      await this.processQueuedMessages(agentId);
      await this.emit('agent:resumed', { agentId });
    }
  }

  public getCapabilityMap(): { [capability: string]: string[] } {
    const capabilityMap: { [capability: string]: string[] } = {};
    
    this.agents.forEach((agent, agentId) => {
      agent.capabilities.forEach(capability => {
        if (!capabilityMap[capability]) {
          capabilityMap[capability] = [];
        }
        capabilityMap[capability].push(agentId);
      });
    });

    return capabilityMap;
  }

  public async findAgentsByCapability(capability: string): Promise<string[]> {
    const matchingAgents: string[] = [];
    
    this.agents.forEach((agent, agentId) => {
      if (agent.capabilities.includes(capability) && agent.status !== 'shutdown') {
        matchingAgents.push(agentId);
      }
    });

    return matchingAgents.sort((a, b) => {
      const agentA = this.agents.get(a)!;
      const agentB = this.agents.get(b)!;
      
      if (agentA.status === 'idle' && agentB.status !== 'idle') return -1;
      if (agentA.status !== 'idle' && agentB.status === 'idle') return 1;
      
      return agentA.messageQueue.length - agentB.messageQueue.length;
    });
  }

  private async routeToSpecificAgent(message: Message): Promise<void> {
    const agent = this.agents.get(message.targetAgent!);
    
    if (!agent) {
      await this.emit('error', new Error(`Agent ${message.targetAgent} not found`));
      return;
    }

    if (agent.status === 'shutdown') {
      await this.emit('error', new Error(`Agent ${message.targetAgent} is shutdown`));
      return;
    }

    if (agent.status === 'idle') {
      await this.deliverMessage(message.targetAgent!, message);
    } else {
      agent.messageQueue.push(message);
      this.sortMessageQueue(agent);
    }
  }

  private async broadcastMessage(message: Message): Promise<void> {
    const deliveryPromises: Promise<void>[] = [];

    for (const [agentId, agent] of this.agents.entries()) {
      if (agent.status !== 'shutdown' && agentId !== message.agentId) {
        if (agent.status === 'idle') {
          deliveryPromises.push(this.deliverMessage(agentId, message));
        } else {
          agent.messageQueue.push(message);
          this.sortMessageQueue(agent);
        }
      }
    }

    await Promise.allSettled(deliveryPromises);
  }

  private async deliverMessage(agentId: string, message: Message): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    try {
      if (agent.worker) {
        agent.worker.postMessage({
          type: 'message',
          message
        });
      }

      for (const route of this.routes) {
        if (this.matchesRoute(message, route.pattern)) {
          await route.handler(message);
        }
      }

      await this.emit('message:delivered', { agentId, message });
    } catch (error) {
      await this.emit('error', error);
      agent.status = 'error';
    }
  }

  private async processQueuedMessages(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent || agent.status !== 'idle') return;

    while (agent.messageQueue.length > 0 && agent.status === 'idle') {
      const message = agent.messageQueue.shift()!;
      await this.deliverMessage(agentId, message);
    }
  }

  private sortMessageQueue(agent: Agent): void {
    const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    
    agent.messageQueue.sort((a, b) => {
      const aPriority = priorityOrder[a.priority];
      const bPriority = priorityOrder[b.priority];
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }
      
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });
  }

  private matchesRoute(message: Message, pattern: string | RegExp): boolean {
    if (typeof pattern === 'string') {
      return message.type === pattern || message.type.includes(pattern);
    } else {
      return pattern.test(message.type);
    }
  }

  private setupWorkerEventHandlers(agentId: string, worker: Worker): void {
    worker.onmessage = async (event) => {
      const { type, data, messageId } = event.data;
      
      switch (type) {
        case 'ready':
          await this.updateAgentStatus(agentId, 'idle');
          break;
          
        case 'response':
          if (messageId) {
            await this.sendResponse(messageId, agentId, data);
          }
          break;
          
        case 'message':
          await this.sendMessage({
            type: data.type || 'worker_message',
            agentId,
            payload: data,
            priority: data.priority || 'medium'
          });
          break;
          
        case 'error':
          await this.updateAgentStatus(agentId, 'error');
          await this.emit('error', new Error(`Worker ${agentId}: ${data}`));
          break;
          
        case 'heartbeat':
          await this.updateAgentHeartbeat(agentId);
          break;
      }
    };

    worker.onerror = async (error) => {
      await this.updateAgentStatus(agentId, 'error');
      await this.emit('error', error);
    };
  }

  private async updateAgentStatus(agentId: string, status: Agent['status']): Promise<void> {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.status = status;
      
      if (status === 'idle') {
        await this.processQueuedMessages(agentId);
      }
      
      await this.emit('agent:status_changed', { agentId, status });
    }
  }

  private async updateAgentHeartbeat(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.lastHeartbeat = new Date().toISOString();
    }
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(async () => {
      const now = Date.now();
      const staleThreshold = this.heartbeatInterval * 2;

      for (const [agentId, agent] of this.agents.entries()) {
        const lastHeartbeat = new Date(agent.lastHeartbeat).getTime();
        
        if (now - lastHeartbeat > staleThreshold && agent.status !== 'shutdown') {
          await this.emit('agent:stale', { agentId, lastHeartbeat: agent.lastHeartbeat });
          agent.status = 'error';
        }
      }
    }, this.heartbeatInterval);
  }

  private setupGlobalErrorHandling(): void {
    this.on('error', (error) => {
      console.error('MessageBus Error:', error);
    });
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private trimMessageHistory(): void {
    if (this.messageHistory.length > this.maxHistorySize) {
      this.messageHistory = this.messageHistory.slice(-this.maxHistorySize);
    }
  }

  private async emit(event: string, data?: any): Promise<void> {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const promises = listeners.map(callback => {
        try {
          return callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
          return Promise.resolve();
        }
      });
      
      await Promise.allSettled(promises);
    }
  }

  public shutdown(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    this.pendingResponses.forEach(({ timeout }) => {
      clearTimeout(timeout);
    });
    this.pendingResponses.clear();

    this.agents.forEach((agent, agentId) => {
      this.unregisterAgent(agentId);
    });

    this.eventListeners.clear();
    this.routes = [];
    this.messageHistory = [];
  }
}