import { useState, useEffect, useCallback, useRef } from 'react';
import { AgentManager } from '@/lib/agents/AgentManager';

interface TaskSubmission {
  type: string;
  data: any;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  timeout?: number;
}

interface UseAgentManagerReturn {
  // Task management
  submitTask: (task: TaskSubmission) => Promise<string>;
  getTaskResult: (taskId: string, timeout?: number) => Promise<any>;
  getTaskStatus: (taskId: string) => Promise<any>;
  
  // Agent coordination
  coordinateAgents: (scenario: string, context: any) => Promise<any>;
  broadcastUpdate: (type: string, data: any) => Promise<void>;
  
  // System status
  systemStatus: any;
  agentStatuses: { [agentId: string]: any };
  
  // State
  isConnected: boolean;
  isProcessing: boolean;
  lastError: string | null;
  
  // Utilities
  clearError: () => void;
  refreshStatus: () => Promise<void>;
}

export function useAgentManager(): UseAgentManagerReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [systemStatus, setSystemStatus] = useState<any>(null);
  const [agentStatuses, setAgentStatuses] = useState<{ [agentId: string]: any }>({});
  
  const agentManagerRef = useRef<AgentManager | null>(null);
  const statusIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize AgentManager
  useEffect(() => {
    const initializeManager = async () => {
      try {
        agentManagerRef.current = AgentManager.getInstance();
        setIsConnected(true);
        setLastError(null);
        
        // Start status monitoring
        statusIntervalRef.current = setInterval(async () => {
          await refreshStatus();
        }, 5000);
        
        // Initial status load
        await refreshStatus();
      } catch (error) {
        setLastError(error instanceof Error ? error.message : 'Failed to initialize AgentManager');
        setIsConnected(false);
      }
    };

    initializeManager();

    return () => {
      if (statusIntervalRef.current) {
        clearInterval(statusIntervalRef.current);
      }
    };
  }, []);

  const submitTask = useCallback(async (task: TaskSubmission): Promise<string> => {
    if (!agentManagerRef.current) {
      throw new Error('AgentManager not initialized');
    }

    setIsProcessing(true);
    setLastError(null);

    try {
      const taskId = await agentManagerRef.current.submitTask({
        type: task.type,
        data: task.data,
        priority: task.priority || 'medium',
        timeout: task.timeout,
        retries: 3
      });

      return taskId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to submit task';
      setLastError(errorMessage);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const getTaskResult = useCallback(async (taskId: string, timeout?: number): Promise<any> => {
    if (!agentManagerRef.current) {
      throw new Error('AgentManager not initialized');
    }

    setIsProcessing(true);
    setLastError(null);

    try {
      const result = await agentManagerRef.current.getTaskResult(taskId, timeout);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get task result';
      setLastError(errorMessage);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const getTaskStatus = useCallback(async (taskId: string) => {
    if (!agentManagerRef.current) {
      throw new Error('AgentManager not initialized');
    }

    try {
      return await agentManagerRef.current.getTaskStatus(taskId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get task status';
      setLastError(errorMessage);
      throw error;
    }
  }, []);

  const coordinateAgents = useCallback(async (scenario: string, context: any): Promise<any> => {
    if (!agentManagerRef.current) {
      throw new Error('AgentManager not initialized');
    }

    setIsProcessing(true);
    setLastError(null);

    try {
      const result = await agentManagerRef.current.coordinateAgents(scenario, context);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to coordinate agents';
      setLastError(errorMessage);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const broadcastUpdate = useCallback(async (type: string, data: any): Promise<void> => {
    if (!agentManagerRef.current) {
      throw new Error('AgentManager not initialized');
    }

    try {
      await agentManagerRef.current.broadcastUpdate(type, data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to broadcast update';
      setLastError(errorMessage);
      throw error;
    }
  }, []);

  const refreshStatus = useCallback(async (): Promise<void> => {
    if (!agentManagerRef.current) {
      return;
    }

    try {
      const status = agentManagerRef.current.getSystemStatus();
      setSystemStatus(status);
      setAgentStatuses(status.agents || {});
      setLastError(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to refresh status';
      setLastError(errorMessage);
    }
  }, []);

  const clearError = useCallback(() => {
    setLastError(null);
  }, []);

  return {
    // Task management
    submitTask,
    getTaskResult,
    getTaskStatus,
    
    // Agent coordination
    coordinateAgents,
    broadcastUpdate,
    
    // System status
    systemStatus,
    agentStatuses,
    
    // State
    isConnected,
    isProcessing,
    lastError,
    
    // Utilities
    clearError,
    refreshStatus
  };
}

// Specialized hooks for common use cases
export function useOrderOptimization() {
  const agentManager = useAgentManager();

  const optimizeOrders = useCallback(async (orders: any[], context?: any) => {
    return await agentManager.coordinateAgents('order_processing', { orders, ...context });
  }, [agentManager]);

  return {
    optimizeOrders,
    isProcessing: agentManager.isProcessing,
    lastError: agentManager.lastError,
    clearError: agentManager.clearError
  };
}

export function useCustomerFeedbackAnalysis() {
  const agentManager = useAgentManager();

  const analyzeFeedback = useCallback(async (feedback: string, context?: any) => {
    return await agentManager.coordinateAgents('customer_feedback', { feedback, ...context });
  }, [agentManager]);

  return {
    analyzeFeedback,
    isProcessing: agentManager.isProcessing,
    lastError: agentManager.lastError,
    clearError: agentManager.clearError
  };
}

export function useInventoryPrediction() {
  const agentManager = useAgentManager();

  const predictInventory = useCallback(async (context?: any) => {
    return await agentManager.submitTask({
      type: 'predict_inventory',
      data: { context },
      priority: 'medium'
    }).then(taskId => agentManager.getTaskResult(taskId));
  }, [agentManager]);

  const checkInventoryAlerts = useCallback(async (context?: any) => {
    return await agentManager.coordinateAgents('inventory_alert', context);
  }, [agentManager]);

  return {
    predictInventory,
    checkInventoryAlerts,
    isProcessing: agentManager.isProcessing,
    lastError: agentManager.lastError,
    clearError: agentManager.clearError
  };
}

export function useRevenueAnalysis() {
  const agentManager = useAgentManager();

  const analyzeRevenue = useCallback(async (timeRange: any, context?: any) => {
    return await agentManager.coordinateAgents('revenue_analysis', { timeRange, ...context });
  }, [agentManager]);

  return {
    analyzeRevenue,
    isProcessing: agentManager.isProcessing,
    lastError: agentManager.lastError,
    clearError: agentManager.clearError
  };
}

export function useNLPProcessing() {
  const agentManager = useAgentManager();

  const processText = useCallback(async (text: string, operation: string = 'complete_analysis', context?: any) => {
    return await agentManager.submitTask({
      type: 'analyze_text',
      data: { text, operation, context },
      priority: 'high'
    }).then(taskId => agentManager.getTaskResult(taskId));
  }, [agentManager]);

  const analyzeIntent = useCallback(async (text: string, context?: any) => {
    return await agentManager.submitTask({
      type: 'analyze_text',
      data: { text, operation: 'intent_classification', context },
      priority: 'high'
    }).then(taskId => agentManager.getTaskResult(taskId));
  }, [agentManager]);

  const extractEntities = useCallback(async (text: string, context?: any) => {
    return await agentManager.submitTask({
      type: 'analyze_text',
      data: { text, operation: 'entity_extraction', context },
      priority: 'medium'
    }).then(taskId => agentManager.getTaskResult(taskId));
  }, [agentManager]);

  const analyzeSentiment = useCallback(async (text: string, context?: any) => {
    return await agentManager.submitTask({
      type: 'analyze_text',
      data: { text, operation: 'sentiment_analysis', context },
      priority: 'high'
    }).then(taskId => agentManager.getTaskResult(taskId));
  }, [agentManager]);

  return {
    processText,
    analyzeIntent,
    extractEntities,
    analyzeSentiment,
    isProcessing: agentManager.isProcessing,
    lastError: agentManager.lastError,
    clearError: agentManager.clearError
  };
}

export function useAgentStatus() {
  const agentManager = useAgentManager();

  return {
    systemStatus: agentManager.systemStatus,
    agentStatuses: agentManager.agentStatuses,
    isConnected: agentManager.isConnected,
    refreshStatus: agentManager.refreshStatus,
    lastError: agentManager.lastError
  };
}