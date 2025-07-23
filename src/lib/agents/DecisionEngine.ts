interface DecisionContext {
  id: string;
  type: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  data: any;
  requiredAgents: string[];
  optionalAgents?: string[];
  timeout: number;
  threshold: number; // Minimum consensus percentage (0-1)
  createdAt: string;
  decidedAt?: string;
}

interface AgentVote {
  agentId: string;
  vote: 'approve' | 'reject' | 'abstain';
  confidence: number; // 0-1
  reasoning: string;
  data?: any;
  timestamp: string;
}

interface Decision {
  contextId: string;
  outcome: 'approved' | 'rejected' | 'timeout' | 'insufficient_votes';
  confidence: number;
  votes: AgentVote[];
  reasoning: string;
  finalData?: any;
  executionPlan?: any[];
  timestamp: string;
}

interface ConflictResolution {
  strategy: 'weighted_vote' | 'expert_override' | 'hierarchical' | 'majority_plus' | 'unanimous_required';
  weights?: { [agentId: string]: number };
  expertAgents?: string[];
  hierarchy?: string[];
}

export class DecisionEngine {
  private static instance: DecisionEngine;
  
  private pendingDecisions: Map<string, DecisionContext> = new Map();
  private votes: Map<string, AgentVote[]> = new Map();
  private decisions: Map<string, Decision> = new Map();
  private agentReliability: Map<string, number> = new Map();
  private decisionPatterns: Map<string, any> = new Map();
  
  private eventListeners: Map<string, Function[]> = new Map();
  private timeouts: Map<string, NodeJS.Timeout> = new Map();

  private constructor() {
    this.initializeAgentReliability();
    this.loadDecisionPatterns();
  }

  public static getInstance(): DecisionEngine {
    if (!DecisionEngine.instance) {
      DecisionEngine.instance = new DecisionEngine();
    }
    return DecisionEngine.instance;
  }

  public async requestDecision(context: Omit<DecisionContext, 'id' | 'createdAt'>): Promise<string> {
    const decisionId = this.generateDecisionId();
    
    const fullContext: DecisionContext = {
      ...context,
      id: decisionId,
      createdAt: new Date().toISOString()
    };

    this.pendingDecisions.set(decisionId, fullContext);
    this.votes.set(decisionId, []);

    // Set timeout for decision
    const timeoutHandle = setTimeout(() => {
      this.handleDecisionTimeout(decisionId);
    }, context.timeout);
    
    this.timeouts.set(decisionId, timeoutHandle);

    // Notify agents about the decision request
    await this.notifyAgentsForDecision(fullContext);
    
    await this.emit('decision:requested', { decisionId, context: fullContext });
    
    return decisionId;
  }

  public async submitVote(decisionId: string, vote: Omit<AgentVote, 'timestamp'>): Promise<boolean> {
    const context = this.pendingDecisions.get(decisionId);
    if (!context) {
      throw new Error(`Decision ${decisionId} not found`);
    }

    const votes = this.votes.get(decisionId) || [];
    
    // Check if agent already voted
    const existingVoteIndex = votes.findIndex(v => v.agentId === vote.agentId);
    if (existingVoteIndex !== -1) {
      // Update existing vote
      votes[existingVoteIndex] = {
        ...vote,
        timestamp: new Date().toISOString()
      };
    } else {
      // Add new vote
      votes.push({
        ...vote,
        timestamp: new Date().toISOString()
      });
    }

    this.votes.set(decisionId, votes);
    
    await this.emit('vote:submitted', { decisionId, vote, totalVotes: votes.length });

    // Check if we have enough votes to make a decision
    await this.evaluateDecision(decisionId);
    
    return true;
  }

  public async getDecision(decisionId: string): Promise<Decision | null> {
    return this.decisions.get(decisionId) || null;
  }

  public async waitForDecision(decisionId: string, timeout: number = 30000): Promise<Decision> {
    return new Promise((resolve, reject) => {
      const existingDecision = this.decisions.get(decisionId);
      if (existingDecision) {
        resolve(existingDecision);
        return;
      }

      const timeoutHandle = setTimeout(() => {
        reject(new Error(`Decision ${decisionId} timeout after ${timeout}ms`));
      }, timeout);

      const checkDecision = () => {
        const decision = this.decisions.get(decisionId);
        if (decision) {
          clearTimeout(timeoutHandle);
          resolve(decision);
        } else {
          setTimeout(checkDecision, 100);
        }
      };

      checkDecision();
    });
  }

  public async resolveConflict(
    decisionId: string,
    resolution: ConflictResolution
  ): Promise<Decision> {
    const context = this.pendingDecisions.get(decisionId);
    const votes = this.votes.get(decisionId);
    
    if (!context || !votes) {
      throw new Error(`Decision ${decisionId} not found`);
    }

    const decision = await this.applyConflictResolution(context, votes, resolution);
    
    this.decisions.set(decisionId, decision);
    this.cleanup(decisionId);
    
    await this.emit('decision:resolved', decision);
    
    return decision;
  }

  public getAgentReliability(agentId: string): number {
    return this.agentReliability.get(agentId) || 0.5;
  }

  public updateAgentReliability(agentId: string, outcome: 'correct' | 'incorrect'): void {
    const current = this.agentReliability.get(agentId) || 0.5;
    
    const adjustment = outcome === 'correct' ? 0.05 : -0.05;
    const updated = Math.max(0.1, Math.min(1.0, current + adjustment));
    
    this.agentReliability.set(agentId, updated);
    
    console.log(`DecisionEngine: Updated ${agentId} reliability to ${updated.toFixed(3)}`);
  }

  public getDecisionHistory(limit: number = 50, decisionType?: string): Decision[] {
    let decisions = Array.from(this.decisions.values());
    
    if (decisionType) {
      decisions = decisions.filter(d => {
        const context = this.pendingDecisions.get(d.contextId);
        return context?.type === decisionType;
      });
    }
    
    return decisions
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  public getDecisionMetrics(): any {
    const decisions = Array.from(this.decisions.values());
    const total = decisions.length;
    
    if (total === 0) {
      return {
        total: 0,
        approved: 0,
        rejected: 0,
        timeouts: 0,
        averageTime: 0,
        consensusRate: 0
      };
    }
    
    const approved = decisions.filter(d => d.outcome === 'approved').length;
    const rejected = decisions.filter(d => d.outcome === 'rejected').length;
    const timeouts = decisions.filter(d => d.outcome === 'timeout').length;
    
    const avgTime = decisions.reduce((sum, d) => {
      const context = this.pendingDecisions.get(d.contextId);
      if (context) {
        return sum + (new Date(d.timestamp).getTime() - new Date(context.createdAt).getTime());
      }
      return sum;
    }, 0) / total;
    
    const consensusRate = (approved + rejected) / total;
    
    return {
      total,
      approved,
      rejected,
      timeouts,
      averageTime: Math.round(avgTime),
      consensusRate: Math.round(consensusRate * 100) / 100
    };
  }

  private async evaluateDecision(decisionId: string): Promise<void> {
    const context = this.pendingDecisions.get(decisionId);
    const votes = this.votes.get(decisionId) || [];
    
    if (!context) return;

    // Check if all required agents have voted
    const requiredVotes = context.requiredAgents.filter(agentId =>
      votes.some(v => v.agentId === agentId)
    );
    
    const hasAllRequired = requiredVotes.length === context.requiredAgents.length;
    const hasMinimumVotes = votes.length >= Math.max(2, context.requiredAgents.length);
    
    if (hasAllRequired || hasMinimumVotes) {
      const decision = await this.calculateDecision(context, votes);
      
      this.decisions.set(decisionId, decision);
      this.cleanup(decisionId);
      
      await this.emit('decision:made', decision);
    }
  }

  private async calculateDecision(context: DecisionContext, votes: AgentVote[]): Promise<Decision> {
    const approvalVotes = votes.filter(v => v.vote === 'approve');
    const rejectionVotes = votes.filter(v => v.vote === 'reject');
    const abstainVotes = votes.filter(v => v.vote === 'abstain');
    
    // Apply agent reliability weighting
    const weightedApproval = approvalVotes.reduce((sum, vote) => {
      const reliability = this.agentReliability.get(vote.agentId) || 0.5;
      return sum + (vote.confidence * reliability);
    }, 0);
    
    const weightedRejection = rejectionVotes.reduce((sum, vote) => {
      const reliability = this.agentReliability.get(vote.agentId) || 0.5;
      return sum + (vote.confidence * reliability);
    }, 0);
    
    const totalWeight = weightedApproval + weightedRejection;
    const approvalRatio = totalWeight > 0 ? weightedApproval / totalWeight : 0;
    
    let outcome: Decision['outcome'] = 'rejected';
    let confidence = 0;
    let reasoning = '';
    
    if (approvalRatio >= context.threshold) {
      outcome = 'approved';
      confidence = approvalRatio;
      reasoning = `Consensus achieved with ${Math.round(approvalRatio * 100)}% weighted approval`;
    } else if (votes.length < context.requiredAgents.length) {
      outcome = 'insufficient_votes';
      confidence = 0;
      reasoning = `Insufficient votes: ${votes.length}/${context.requiredAgents.length} required agents`;
    } else {
      outcome = 'rejected';
      confidence = 1 - approvalRatio;
      reasoning = `Rejected with ${Math.round((1 - approvalRatio) * 100)}% weighted rejection`;
    }
    
    // Generate execution plan if approved
    let executionPlan: any[] = [];
    if (outcome === 'approved') {
      executionPlan = this.generateExecutionPlan(context, approvalVotes);
    }
    
    // Combine data from approval votes
    const finalData = this.combineVoteData(approvalVotes);
    
    return {
      contextId: context.id,
      outcome,
      confidence: Math.round(confidence * 100) / 100,
      votes,
      reasoning,
      finalData,
      executionPlan,
      timestamp: new Date().toISOString()
    };
  }

  private generateExecutionPlan(context: DecisionContext, approvalVotes: AgentVote[]): any[] {
    const plan: any[] = [];
    
    switch (context.type) {
      case 'order_modification':
        plan.push({
          step: 1,
          action: 'validate_order_changes',
          agent: 'orderOptimization',
          data: context.data
        });
        plan.push({
          step: 2,
          action: 'update_kitchen_stations',
          agent: 'orderOptimization',
          data: { changes: context.data.modifications }
        });
        plan.push({
          step: 3,
          action: 'notify_customer',
          agent: 'customerSatisfaction',
          data: { tableId: context.data.tableId, changes: context.data.modifications }
        });
        break;
        
      case 'inventory_emergency_order':
        plan.push({
          step: 1,
          action: 'calculate_optimal_quantity',
          agent: 'inventoryPrediction',
          data: context.data
        });
        plan.push({
          step: 2,
          action: 'find_best_supplier',
          agent: 'revenueOptimization',
          data: { item: context.data.item, urgency: 'high' }
        });
        plan.push({
          step: 3,
          action: 'place_emergency_order',
          agent: 'inventoryPrediction',
          data: { approved: true }
        });
        break;
        
      case 'staff_reallocation':
        plan.push({
          step: 1,
          action: 'analyze_current_workload',
          agent: 'orderOptimization',
          data: context.data
        });
        plan.push({
          step: 2,
          action: 'optimize_staff_assignment',
          agent: 'orderOptimization',
          data: { reallocation: context.data.changes }
        });
        break;
        
      default:
        plan.push({
          step: 1,
          action: 'execute_decision',
          agent: 'system',
          data: context.data
        });
    }
    
    return plan;
  }

  private combineVoteData(approvalVotes: AgentVote[]): any {
    const combinedData: any = {};
    
    approvalVotes.forEach(vote => {
      if (vote.data) {
        Object.keys(vote.data).forEach(key => {
          if (!combinedData[key]) {
            combinedData[key] = [];
          }
          combinedData[key].push({
            agentId: vote.agentId,
            value: vote.data[key],
            confidence: vote.confidence
          });
        });
      }
    });
    
    // Calculate weighted averages for numeric values
    Object.keys(combinedData).forEach(key => {
      const values = combinedData[key];
      if (values.length > 0 && typeof values[0].value === 'number') {
        const weightedSum = values.reduce((sum: number, item: any) => 
          sum + (item.value * item.confidence), 0);
        const totalWeight = values.reduce((sum: number, item: any) => 
          sum + item.confidence, 0);
        
        combinedData[key] = totalWeight > 0 ? weightedSum / totalWeight : values[0].value;
      }
    });
    
    return combinedData;
  }

  private async applyConflictResolution(
    context: DecisionContext,
    votes: AgentVote[],
    resolution: ConflictResolution
  ): Promise<Decision> {
    switch (resolution.strategy) {
      case 'weighted_vote':
        return await this.resolveByWeightedVote(context, votes, resolution.weights || {});
        
      case 'expert_override':
        return await this.resolveByExpertOverride(context, votes, resolution.expertAgents || []);
        
      case 'hierarchical':
        return await this.resolveByHierarchy(context, votes, resolution.hierarchy || []);
        
      case 'majority_plus':
        return await this.resolveByMajorityPlus(context, votes);
        
      case 'unanimous_required':
        return await this.resolveByUnanimous(context, votes);
        
      default:
        throw new Error(`Unknown conflict resolution strategy: ${resolution.strategy}`);
    }
  }

  private async resolveByWeightedVote(
    context: DecisionContext,
    votes: AgentVote[],
    weights: { [agentId: string]: number }
  ): Promise<Decision> {
    const approvalWeight = votes
      .filter(v => v.vote === 'approve')
      .reduce((sum, vote) => sum + ((weights[vote.agentId] || 1) * vote.confidence), 0);
    
    const rejectionWeight = votes
      .filter(v => v.vote === 'reject')
      .reduce((sum, vote) => sum + ((weights[vote.agentId] || 1) * vote.confidence), 0);
    
    const totalWeight = approvalWeight + rejectionWeight;
    const approvalRatio = totalWeight > 0 ? approvalWeight / totalWeight : 0;
    
    return {
      contextId: context.id,
      outcome: approvalRatio >= context.threshold ? 'approved' : 'rejected',
      confidence: Math.max(approvalRatio, 1 - approvalRatio),
      votes,
      reasoning: `Weighted vote resolution: ${Math.round(approvalRatio * 100)}% approval`,
      timestamp: new Date().toISOString()
    };
  }

  private async resolveByExpertOverride(
    context: DecisionContext,
    votes: AgentVote[],
    expertAgents: string[]
  ): Promise<Decision> {
    const expertVotes = votes.filter(v => expertAgents.includes(v.agentId));
    
    if (expertVotes.length === 0) {
      return await this.calculateDecision(context, votes);
    }
    
    const expertApproval = expertVotes.filter(v => v.vote === 'approve').length;
    const expertTotal = expertVotes.length;
    const expertRatio = expertApproval / expertTotal;
    
    return {
      contextId: context.id,
      outcome: expertRatio >= 0.5 ? 'approved' : 'rejected',
      confidence: Math.max(expertRatio, 1 - expertRatio),
      votes,
      reasoning: `Expert override: ${expertApproval}/${expertTotal} experts approved`,
      timestamp: new Date().toISOString()
    };
  }

  private async resolveByHierarchy(
    context: DecisionContext,
    votes: AgentVote[],
    hierarchy: string[]
  ): Promise<Decision> {
    for (const agentId of hierarchy) {
      const vote = votes.find(v => v.agentId === agentId);
      if (vote && vote.vote !== 'abstain') {
        return {
          contextId: context.id,
          outcome: vote.vote === 'approve' ? 'approved' : 'rejected',
          confidence: vote.confidence,
          votes,
          reasoning: `Hierarchical decision by ${agentId}`,
          timestamp: new Date().toISOString()
        };
      }
    }
    
    return await this.calculateDecision(context, votes);
  }

  private async resolveByMajorityPlus(
    context: DecisionContext,
    votes: AgentVote[]
  ): Promise<Decision> {
    const approvalVotes = votes.filter(v => v.vote === 'approve').length;
    const totalVotes = votes.filter(v => v.vote !== 'abstain').length;
    
    const supermajorityThreshold = 0.67;
    const approvalRatio = totalVotes > 0 ? approvalVotes / totalVotes : 0;
    
    return {
      contextId: context.id,
      outcome: approvalRatio >= supermajorityThreshold ? 'approved' : 'rejected',
      confidence: Math.max(approvalRatio, 1 - approvalRatio),
      votes,
      reasoning: `Supermajority required: ${Math.round(approvalRatio * 100)}% approval`,
      timestamp: new Date().toISOString()
    };
  }

  private async resolveByUnanimous(
    context: DecisionContext,
    votes: AgentVote[]
  ): Promise<Decision> {
    const nonAbstainVotes = votes.filter(v => v.vote !== 'abstain');
    const approvalVotes = votes.filter(v => v.vote === 'approve');
    
    const isUnanimous = nonAbstainVotes.length > 0 && approvalVotes.length === nonAbstainVotes.length;
    
    return {
      contextId: context.id,
      outcome: isUnanimous ? 'approved' : 'rejected',
      confidence: isUnanimous ? 1.0 : 0.0,
      votes,
      reasoning: isUnanimous ? 'Unanimous approval' : 'Unanimous approval required but not achieved',
      timestamp: new Date().toISOString()
    };
  }

  private async handleDecisionTimeout(decisionId: string): Promise<void> {
    const context = this.pendingDecisions.get(decisionId);
    const votes = this.votes.get(decisionId) || [];
    
    if (!context) return;
    
    const decision: Decision = {
      contextId: context.id,
      outcome: 'timeout',
      confidence: 0,
      votes,
      reasoning: `Decision timeout after ${context.timeout}ms`,
      timestamp: new Date().toISOString()
    };
    
    this.decisions.set(decisionId, decision);
    this.cleanup(decisionId);
    
    await this.emit('decision:timeout', decision);
  }

  private async notifyAgentsForDecision(context: DecisionContext): Promise<void> {
    const allAgents = [...context.requiredAgents, ...(context.optionalAgents || [])];
    
    for (const agentId of allAgents) {
      await this.emit('decision:vote_request', {
        decisionId: context.id,
        agentId,
        context,
        isRequired: context.requiredAgents.includes(agentId)
      });
    }
  }

  private cleanup(decisionId: string): void {
    this.pendingDecisions.delete(decisionId);
    
    const timeoutHandle = this.timeouts.get(decisionId);
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
      this.timeouts.delete(decisionId);
    }
  }

  private initializeAgentReliability(): void {
    const agents = [
      'orderOptimization',
      'inventoryPrediction',
      'customerSatisfaction',
      'revenueOptimization',
      'nlpProcessor'
    ];
    
    agents.forEach(agentId => {
      this.agentReliability.set(agentId, 0.8); // Start with high reliability
    });
  }

  private loadDecisionPatterns(): void {
    // Load common decision patterns for faster processing
    this.decisionPatterns.set('order_modification', {
      requiredAgents: ['orderOptimization', 'inventoryPrediction'],
      optionalAgents: ['customerSatisfaction'],
      threshold: 0.7,
      timeout: 15000
    });
    
    this.decisionPatterns.set('inventory_emergency_order', {
      requiredAgents: ['inventoryPrediction', 'revenueOptimization'],
      optionalAgents: ['orderOptimization'],
      threshold: 0.8,
      timeout: 10000
    });
    
    this.decisionPatterns.set('staff_reallocation', {
      requiredAgents: ['orderOptimization'],
      optionalAgents: ['customerSatisfaction'],
      threshold: 0.6,
      timeout: 20000
    });
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

  private async emit(event: string, data?: any): Promise<void> {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const promises = listeners.map(callback => {
        try {
          return callback(data);
        } catch (error) {
          console.error(`Error in DecisionEngine event listener for ${event}:`, error);
          return Promise.resolve();
        }
      });
      
      await Promise.allSettled(promises);
    }
  }

  private generateDecisionId(): string {
    return `decision_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  public shutdown(): void {
    this.timeouts.forEach(timeout => clearTimeout(timeout));
    this.timeouts.clear();
    this.pendingDecisions.clear();
    this.votes.clear();
    this.eventListeners.clear();
  }
}