'use client';

interface BatchOperation {
  id: string;
  type: BatchOperationType;
  description: string;
  targets: BatchTarget[];
  parameters: { [key: string]: any };
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'partial';
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  createdBy: string;
  results: BatchResult[];
  metadata: {
    totalTargets: number;
    successCount: number;
    failureCount: number;
    estimatedDuration?: number;
    actualDuration?: number;
    language: 'en' | 'hi' | 'hinglish';
    voiceCommand?: string;
  };
}

interface BatchTarget {
  id: string;
  type: 'table' | 'order' | 'item' | 'customer' | 'staff' | 'inventory';
  identifier: string | number;
  data?: any;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';
  result?: any;
  error?: string;
}

interface BatchResult {
  targetId: string;
  success: boolean;
  message: string;
  timestamp: string;
  data?: any;
  error?: string;
}

interface BatchRule {
  id: string;
  name: string;
  pattern: RegExp;
  type: BatchOperationType;
  extractor: (input: string) => {
    targets: any[];
    parameters: any;
    confidence: number;
  };
  validator?: (targets: any[], parameters: any) => boolean;
  description: string;
}

type BatchOperationType = 
  | 'mark_orders_ready'
  | 'update_table_status' 
  | 'assign_staff'
  | 'update_inventory'
  | 'send_notifications'
  | 'clear_tables'
  | 'mark_items_unavailable'
  | 'process_payments'
  | 'update_customer_status'
  | 'bulk_order_modification';

export class BatchProcessor {
  private static instance: BatchProcessor;
  
  private activeOperations: Map<string, BatchOperation> = new Map();
  private operationHistory: BatchOperation[] = [];
  private batchRules: BatchRule[] = [];
  private maxConcurrentOperations: number = 5;
  private processingQueue: string[] = [];
  
  // Restaurant-specific batch rules
  private restaurantRules: BatchRule[] = [
    {
      id: 'mark_orders_ready_range',
      name: 'Mark Orders Ready (Table Range)',
      pattern: /mark\s+(?:all\s+)?(?:orders?|items?)\s+(?:for\s+)?tables?\s+(\d+)\s+to\s+(\d+)\s+(?:as\s+)?ready/i,
      type: 'mark_orders_ready',
      extractor: (input: string) => {
        const match = input.match(/tables?\s+(\d+)\s+to\s+(\d+)/i);
        if (match) {
          const start = parseInt(match[1]);
          const end = parseInt(match[2]);
          const targets = [];
          
          for (let i = start; i <= end; i++) {
            targets.push({
              id: `table_${i}`,
              type: 'table',
              identifier: i,
              data: { tableNumber: i }
            });
          }
          
          return {
            targets,
            parameters: { status: 'ready', tableRange: [start, end] },
            confidence: 0.95
          };
        }
        return { targets: [], parameters: {}, confidence: 0 };
      },
      validator: (targets, params) => targets.length > 0 && targets.length <= 20,
      description: 'Mark all orders ready for a range of tables'
    },
    {
      id: 'mark_specific_items_ready',
      name: 'Mark Specific Items Ready',
      pattern: /mark\s+(?:all\s+)?(\w+(?:\s+\w+)*)\s+(?:orders?|items?)\s+(?:as\s+)?ready/i,
      type: 'mark_orders_ready',
      extractor: (input: string) => {
        const match = input.match(/mark\s+(?:all\s+)?(\w+(?:\s+\w+)*)\s+(?:orders?|items?)/i);
        if (match) {
          const itemName = match[1].trim();
          // Mock: Find all orders with this item
          const targets = this.findOrdersByItem(itemName);
          
          return {
            targets,
            parameters: { status: 'ready', itemType: itemName },
            confidence: 0.9
          };
        }
        return { targets: [], parameters: {}, confidence: 0 };
      },
      description: 'Mark all orders containing specific items as ready'
    },
    {
      id: 'clear_tables_range',
      name: 'Clear Table Range',
      pattern: /clear\s+(?:all\s+)?tables?\s+(\d+)\s+(?:to|through|\-)\s+(\d+)/i,
      type: 'clear_tables',
      extractor: (input: string) => {
        const match = input.match(/tables?\s+(\d+)\s+(?:to|through|\-)\s+(\d+)/i);
        if (match) {
          const start = parseInt(match[1]);
          const end = parseInt(match[2]);
          const targets = [];
          
          for (let i = start; i <= end; i++) {
            targets.push({
              id: `table_${i}`,
              type: 'table',
              identifier: i,
              data: { tableNumber: i, action: 'clear' }
            });
          }
          
          return {
            targets,
            parameters: { action: 'clear', tableRange: [start, end] },
            confidence: 0.92
          };
        }
        return { targets: [], parameters: {}, confidence: 0 };
      },
      description: 'Clear and reset a range of tables'
    },
    {
      id: 'update_table_status_bulk',
      name: 'Update Multiple Table Status',
      pattern: /(?:set|mark|update)\s+tables?\s+((?:\d+(?:\s*,\s*|\s+and\s+|\s+)*)+)\s+(?:as\s+|to\s+)(\w+)/i,
      type: 'update_table_status',
      extractor: (input: string) => {
        const match = input.match(/tables?\s+((?:\d+(?:\s*,\s*|\s+and\s+|\s+)*)+)\s+(?:as\s+|to\s+)(\w+)/i);
        if (match) {
          const tableNumbers = match[1].split(/[,\s]+/).map(n => parseInt(n.trim())).filter(n => !isNaN(n));
          const status = match[2].toLowerCase();
          
          const targets = tableNumbers.map(num => ({
            id: `table_${num}`,
            type: 'table' as const,
            identifier: num,
            data: { tableNumber: num, newStatus: status }
          }));
          
          return {
            targets,
            parameters: { newStatus: status, tableNumbers },
            confidence: 0.88
          };
        }
        return { targets: [], parameters: {}, confidence: 0 };
      },
      description: 'Update status for multiple specific tables'
    },
    {
      id: 'mark_items_unavailable',
      name: 'Mark Items Unavailable',
      pattern: /(?:mark|set)\s+(?:all\s+)?(\w+(?:\s+\w+)*)\s+(?:as\s+)?(?:unavailable|out\s+of\s+stock|sold\s+out)/i,
      type: 'mark_items_unavailable',
      extractor: (input: string) => {
        const match = input.match(/(?:mark|set)\s+(?:all\s+)?(\w+(?:\s+\w+)*)\s+(?:as\s+)?(?:unavailable|out|sold)/i);
        if (match) {
          const itemName = match[1].trim();
          const targets = [{
            id: `item_${itemName.replace(/\s+/g, '_')}`,
            type: 'item' as const,
            identifier: itemName,
            data: { itemName, newStatus: 'unavailable' }
          }];
          
          return {
            targets,
            parameters: { itemName, newStatus: 'unavailable' },
            confidence: 0.85
          };
        }
        return { targets: [], parameters: {}, confidence: 0 };
      },
      description: 'Mark menu items as unavailable'
    },
    {
      id: 'assign_staff_to_tables',
      name: 'Assign Staff to Table Range',
      pattern: /assign\s+(\w+(?:\s+\w+)*)\s+to\s+tables?\s+(\d+)\s+(?:to|through|\-)\s+(\d+)/i,
      type: 'assign_staff',
      extractor: (input: string) => {
        const match = input.match(/assign\s+(\w+(?:\s+\w+)*)\s+to\s+tables?\s+(\d+)\s+(?:to|through|\-)\s+(\d+)/i);
        if (match) {
          const staffName = match[1].trim();
          const start = parseInt(match[2]);
          const end = parseInt(match[3]);
          const targets = [];
          
          for (let i = start; i <= end; i++) {
            targets.push({
              id: `table_${i}`,
              type: 'table' as const,
              identifier: i,
              data: { tableNumber: i, assignedStaff: staffName }
            });
          }
          
          return {
            targets,
            parameters: { staffName, tableRange: [start, end] },
            confidence: 0.9
          };
        }
        return { targets: [], parameters: {}, confidence: 0 };
      },
      description: 'Assign staff member to a range of tables'
    },
    {
      id: 'send_notifications_bulk',
      name: 'Send Bulk Notifications',
      pattern: /(?:send|notify)\s+(?:all\s+)?(?:customers?|tables?)\s+(?:at\s+tables?\s+)?((?:\d+(?:\s*,\s*|\s+and\s+|\s+)*)+)\s+(?:that|about)\s+(.+)/i,
      type: 'send_notifications',
      extractor: (input: string) => {
        const match = input.match(/(?:tables?\s+)?((?:\d+(?:\s*,\s*|\s+and\s+|\s+)*)+)\s+(?:that|about)\s+(.+)/i);
        if (match) {
          const tableNumbers = match[1].split(/[,\s]+/).map(n => parseInt(n.trim())).filter(n => !isNaN(n));
          const message = match[2].trim();
          
          const targets = tableNumbers.map(num => ({
            id: `table_${num}`,
            type: 'table' as const,
            identifier: num,
            data: { tableNumber: num, message }
          }));
          
          return {
            targets,
            parameters: { message, tableNumbers },
            confidence: 0.8
          };
        }
        return { targets: [], parameters: {}, confidence: 0 };
      },
      description: 'Send notifications to multiple tables'
    }
  ];

  private constructor() {
    this.initializeRules();
  }

  public static getInstance(): BatchProcessor {
    if (!BatchProcessor.instance) {
      BatchProcessor.instance = new BatchProcessor();
    }
    return BatchProcessor.instance;
  }

  private initializeRules(): void {
    this.batchRules = [...this.restaurantRules];
    console.log('BatchProcessor: Initialized with', this.batchRules.length, 'batch rules');
  }

  public async processBatchCommand(
    input: string,
    context: {
      userId: string;
      language?: 'en' | 'hi' | 'hinglish';
      location?: string;
    }
  ): Promise<{
    recognized: boolean;
    operation?: BatchOperation;
    confidence: number;
    estimatedTargets?: number;
    previewActions?: string[];
  }> {
    try {
      // Find matching rule
      let bestMatch: {
        rule: BatchRule;
        extraction: any;
        confidence: number;
      } | null = null;

      for (const rule of this.batchRules) {
        if (rule.pattern.test(input)) {
          const extraction = rule.extractor(input);
          
          if (extraction.confidence > 0 && extraction.targets.length > 0) {
            // Validate if validator exists
            if (rule.validator && !rule.validator(extraction.targets, extraction.parameters)) {
              continue;
            }
            
            if (!bestMatch || extraction.confidence > bestMatch.confidence) {
              bestMatch = {
                rule,
                extraction,
                confidence: extraction.confidence
              };
            }
          }
        }
      }

      if (!bestMatch || bestMatch.confidence < 0.7) {
        return {
          recognized: false,
          confidence: bestMatch?.confidence || 0
        };
      }

      // Create batch operation
      const operation = await this.createBatchOperation({
        type: bestMatch.rule.type,
        description: bestMatch.rule.description,
        targets: bestMatch.extraction.targets,
        parameters: bestMatch.extraction.parameters,
        createdBy: context.userId,
        language: context.language || 'en',
        voiceCommand: input
      });

      // Generate preview actions
      const previewActions = this.generatePreviewActions(operation);

      return {
        recognized: true,
        operation,
        confidence: bestMatch.confidence,
        estimatedTargets: operation.targets.length,
        previewActions
      };

    } catch (error) {
      console.error('BatchProcessor: Error processing batch command', error);
      return {
        recognized: false,
        confidence: 0
      };
    }
  }

  public async executeBatchOperation(operationId: string, confirm: boolean = false): Promise<{
    success: boolean;
    results: BatchResult[];
    summary: string;
  }> {
    const operation = this.activeOperations.get(operationId);
    if (!operation) {
      throw new Error(`Operation ${operationId} not found`);
    }

    if (!confirm && operation.targets.length > 5) {
      return {
        success: false,
        results: [],
        summary: `Operation affects ${operation.targets.length} targets. Please confirm to proceed.`
      };
    }

    try {
      operation.status = 'processing';
      operation.startedAt = new Date().toISOString();
      
      console.log(`BatchProcessor: Executing ${operation.type} for ${operation.targets.length} targets`);

      // Process targets in parallel with concurrency limit
      const results: BatchResult[] = [];
      const batchSize = 3; // Process 3 targets at a time
      
      for (let i = 0; i < operation.targets.length; i += batchSize) {
        const batch = operation.targets.slice(i, i + batchSize);
        const batchPromises = batch.map(target => this.processTarget(operation, target));
        
        const batchResults = await Promise.allSettled(batchPromises);
        
        batchResults.forEach((result, index) => {
          const target = batch[index];
          
          if (result.status === 'fulfilled') {
            target.status = 'completed';
            target.result = result.value;
            
            results.push({
              targetId: target.id,
              success: true,
              message: `Successfully processed ${target.type} ${target.identifier}`,
              timestamp: new Date().toISOString(),
              data: result.value
            });
            
            operation.metadata.successCount++;
          } else {
            target.status = 'failed';
            target.error = result.reason?.message || 'Unknown error';
            
            results.push({
              targetId: target.id,
              success: false,
              message: `Failed to process ${target.type} ${target.identifier}`,
              timestamp: new Date().toISOString(),
              error: target.error
            });
            
            operation.metadata.failureCount++;
          }
        });

        // Add small delay between batches
        if (i + batchSize < operation.targets.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Update operation status
      operation.results = results;
      operation.completedAt = new Date().toISOString();
      operation.metadata.actualDuration = Date.now() - new Date(operation.startedAt).getTime();
      
      if (operation.metadata.failureCount === 0) {
        operation.status = 'completed';
      } else if (operation.metadata.successCount > 0) {
        operation.status = 'partial';
      } else {
        operation.status = 'failed';
      }

      // Move to history
      this.operationHistory.push(operation);
      this.activeOperations.delete(operationId);

      const summary = this.generateOperationSummary(operation);
      
      console.log(`BatchProcessor: Operation ${operationId} completed - ${summary}`);

      return {
        success: operation.status === 'completed' || operation.status === 'partial',
        results,
        summary
      };

    } catch (error) {
      console.error(`BatchProcessor: Error executing operation ${operationId}`, error);
      
      operation.status = 'failed';
      operation.completedAt = new Date().toISOString();
      
      return {
        success: false,
        results: [],
        summary: `Operation failed: ${error}`
      };
    }
  }

  public async cancelBatchOperation(operationId: string): Promise<boolean> {
    const operation = this.activeOperations.get(operationId);
    if (!operation) return false;

    if (operation.status === 'processing') {
      // Mark remaining targets as skipped
      operation.targets.forEach(target => {
        if (target.status === 'pending') {
          target.status = 'skipped';
        }
      });
    }

    operation.status = 'failed';
    operation.completedAt = new Date().toISOString();
    
    this.operationHistory.push(operation);
    this.activeOperations.delete(operationId);

    console.log(`BatchProcessor: Operation ${operationId} cancelled`);
    return true;
  }

  public getActiveOperations(): BatchOperation[] {
    return Array.from(this.activeOperations.values());
  }

  public getOperationHistory(limit: number = 20): BatchOperation[] {
    return this.operationHistory.slice(-limit);
  }

  public getBatchCapabilities(): { 
    supportedOperations: string[];
    maxTargets: number;
    examples: string[];
  } {
    return {
      supportedOperations: this.batchRules.map(rule => rule.name),
      maxTargets: 50,
      examples: [
        "Mark all orders for tables 1 to 5 as ready",
        "Clear tables 10 through 15",
        "Set tables 2, 4, 6 as occupied",
        "Mark pizza unavailable",
        "Assign John to tables 1 to 8",
        "Send all customers at tables 1, 2, 3 that their food is ready"
      ]
    };
  }

  // Private helper methods

  private async createBatchOperation(data: {
    type: BatchOperationType;
    description: string;
    targets: any[];
    parameters: any;
    createdBy: string;
    language: 'en' | 'hi' | 'hinglish';
    voiceCommand: string;
  }): Promise<BatchOperation> {
    const operation: BatchOperation = {
      id: `batch_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type: data.type,
      description: data.description,
      targets: data.targets.map(target => ({
        ...target,
        status: 'pending' as const
      })),
      parameters: data.parameters,
      status: 'pending',
      createdAt: new Date().toISOString(),
      createdBy: data.createdBy,
      results: [],
      metadata: {
        totalTargets: data.targets.length,
        successCount: 0,
        failureCount: 0,
        estimatedDuration: data.targets.length * 500, // 500ms per target
        language: data.language,
        voiceCommand: data.voiceCommand
      }
    };

    this.activeOperations.set(operation.id, operation);
    return operation;
  }

  private async processTarget(operation: BatchOperation, target: BatchTarget): Promise<any> {
    target.status = 'processing';
    
    // Simulate processing based on operation type
    switch (operation.type) {
      case 'mark_orders_ready':
        return await this.processMarkOrdersReady(target, operation.parameters);
        
      case 'clear_tables':
        return await this.processClearTables(target, operation.parameters);
        
      case 'update_table_status':
        return await this.processUpdateTableStatus(target, operation.parameters);
        
      case 'assign_staff':
        return await this.processAssignStaff(target, operation.parameters);
        
      case 'mark_items_unavailable':
        return await this.processMarkItemsUnavailable(target, operation.parameters);
        
      case 'send_notifications':
        return await this.processSendNotifications(target, operation.parameters);
        
      default:
        throw new Error(`Unsupported operation type: ${operation.type}`);
    }
  }

  private async processMarkOrdersReady(target: BatchTarget, parameters: any): Promise<any> {
    // Mock processing
    await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));
    
    console.log(`BatchProcessor: Marked orders ready for ${target.type} ${target.identifier}`);
    
    return {
      action: 'mark_ready',
      target: target.identifier,
      status: 'ready',
      timestamp: new Date().toISOString()
    };
  }

  private async processClearTables(target: BatchTarget, parameters: any): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 200));
    
    console.log(`BatchProcessor: Cleared table ${target.identifier}`);
    
    return {
      action: 'clear_table',
      tableNumber: target.identifier,
      status: 'available',
      clearedAt: new Date().toISOString()
    };
  }

  private async processUpdateTableStatus(target: BatchTarget, parameters: any): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, 150 + Math.random() * 100));
    
    console.log(`BatchProcessor: Updated table ${target.identifier} status to ${parameters.newStatus}`);
    
    return {
      action: 'update_status',
      tableNumber: target.identifier,
      previousStatus: 'unknown',
      newStatus: parameters.newStatus,
      updatedAt: new Date().toISOString()
    };
  }

  private async processAssignStaff(target: BatchTarget, parameters: any): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 150));
    
    console.log(`BatchProcessor: Assigned ${parameters.staffName} to table ${target.identifier}`);
    
    return {
      action: 'assign_staff',
      tableNumber: target.identifier,
      staffMember: parameters.staffName,
      assignedAt: new Date().toISOString()
    };
  }

  private async processMarkItemsUnavailable(target: BatchTarget, parameters: any): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    console.log(`BatchProcessor: Marked ${parameters.itemName} as unavailable`);
    
    return {
      action: 'mark_unavailable',
      itemName: parameters.itemName,
      status: 'unavailable',
      updatedAt: new Date().toISOString()
    };
  }

  private async processSendNotifications(target: BatchTarget, parameters: any): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, 250 + Math.random() * 200));
    
    console.log(`BatchProcessor: Sent notification to table ${target.identifier}: ${parameters.message}`);
    
    return {
      action: 'send_notification',
      tableNumber: target.identifier,
      message: parameters.message,
      sentAt: new Date().toISOString()
    };
  }

  private generatePreviewActions(operation: BatchOperation): string[] {
    const actions: string[] = [];
    
    switch (operation.type) {
      case 'mark_orders_ready':
        actions.push(`Mark orders ready for ${operation.targets.length} targets`);
        break;
      case 'clear_tables':
        actions.push(`Clear ${operation.targets.length} tables`);
        break;
      case 'update_table_status':
        actions.push(`Update status for ${operation.targets.length} tables`);
        break;
      case 'assign_staff':
        actions.push(`Assign staff to ${operation.targets.length} tables`);
        break;
      case 'mark_items_unavailable':
        actions.push(`Mark ${operation.parameters.itemName} as unavailable`);
        break;
      case 'send_notifications':
        actions.push(`Send notifications to ${operation.targets.length} tables`);
        break;
    }

    actions.push(`Estimated completion time: ${Math.ceil(operation.metadata.estimatedDuration! / 1000)} seconds`);
    
    return actions;
  }

  private generateOperationSummary(operation: BatchOperation): string {
    const { successCount, failureCount, totalTargets } = operation.metadata;
    const duration = operation.metadata.actualDuration ? Math.ceil(operation.metadata.actualDuration / 1000) : 0;
    
    return `${successCount}/${totalTargets} targets processed successfully in ${duration}s${failureCount > 0 ? ` (${failureCount} failures)` : ''}`;
  }

  private findOrdersByItem(itemName: string): any[] {
    // Mock implementation - in production, query actual order system
    const mockOrders = [
      { id: 'order_1', tableNumber: 3, items: ['pizza', 'salad'] },
      { id: 'order_2', tableNumber: 7, items: ['pizza', 'drink'] },
      { id: 'order_3', tableNumber: 12, items: ['burger', 'fries'] }
    ];

    return mockOrders
      .filter(order => order.items.some(item => 
        item.toLowerCase().includes(itemName.toLowerCase())
      ))
      .map(order => ({
        id: order.id,
        type: 'order',
        identifier: order.id,
        data: { tableNumber: order.tableNumber, items: order.items }
      }));
  }

  public shutdown(): void {
    this.activeOperations.clear();
    this.operationHistory = [];
    this.batchRules = [];
    console.log('BatchProcessor: Shutdown complete');
  }
}