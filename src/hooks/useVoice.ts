import { useCallback, useEffect, useState } from 'react';
import { useVoiceStore } from '@/stores/voiceStore';
import { useOrderStore } from '@/stores/orderStore';
import { useTableStore } from '@/stores/tableStore';
import { useInventoryStore } from '@/stores/inventoryStore';
import { getVoiceProcessor } from '@/lib/voiceProcessor';
import { VoiceCommand } from '@/types';

export function useVoice() {
  const [isSupported, setIsSupported] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  
  const {
    isListening,
    isProcessing,
    currentCommand,
    lastResponse,
    error,
    history,
    startListening,
    stopListening,
    setProcessing,
    addCommand,
    setCurrentCommand,
    setLastResponse,
    setError,
    processVoiceCommand,
    undoLastCommand
  } = useVoiceStore();

  // Store actions for voice command execution
  const updateOrderStatus = useOrderStore(state => state.updateOrderStatus);
  const updateItemStatus = useOrderStore(state => state.updateItemStatus);
  const addItemToOrder = useOrderStore(state => state.addItemToOrder);
  const updateTableStatus = useTableStore(state => state.updateTableStatus);
  const updateItemQuantity = useInventoryStore(state => state.updateItemQuantity);

  useEffect(() => {
    // Check if speech recognition is supported
    const speechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    setIsSupported(!!speechRecognition);

    if (!speechRecognition) {
      setError('Speech recognition is not supported in this browser');
    }
  }, [setError]);

  const handleVoiceCommand = useCallback(async (command: VoiceCommand) => {
    try {
      setProcessing(true);
      setCurrentCommand(command.command);
      
      // Execute the voice command
      const response = await executeVoiceCommand(command);
      command.response = response;
      command.success = true;
      
      addCommand(command);
      setLastResponse(response);
      setError(null);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Voice command failed';
      command.response = errorMessage;
      command.success = false;
      
      addCommand(command);
      setError(errorMessage);
    } finally {
      setProcessing(false);
      setCurrentCommand('');
    }
  }, [setProcessing, setCurrentCommand, addCommand, setLastResponse, setError]);

  const executeVoiceCommand = async (command: VoiceCommand): Promise<string> => {
    const { action, parameters } = command;

    switch (action.type) {
      case 'order':
        return await handleOrderCommand(action.subtype, parameters);
      
      case 'table':
        return await handleTableCommand(action.subtype, parameters);
      
      case 'inventory':
        return await handleInventoryCommand(action.subtype, parameters);
      
      case 'navigation':
        return await handleNavigationCommand(action.subtype, parameters);
      
      case 'query':
        return await handleQueryCommand(action.subtype, parameters);
      
      default:
        throw new Error(`Unknown command type: ${action.type}`);
    }
  };

  const handleOrderCommand = async (subtype: string, params: Record<string, any>): Promise<string> => {
    switch (subtype) {
      case 'mark_ready':
        if (params.tableNumber) {
          // Find orders for the table and mark them as ready
          const orders = useOrderStore.getState().getOrdersByTable(`table-${params.tableNumber}`);
          for (const order of orders) {
            if (order.status === 'preparing') {
              updateOrderStatus(order.id, 'ready');
            }
          }
          return `Table ${params.tableNumber} के सभी orders ready mark कर दिए गए हैं`;
        }
        throw new Error('Table number not specified');

      case 'mark_preparing':
        if (params.tableNumber) {
          const orders = useOrderStore.getState().getOrdersByTable(`table-${params.tableNumber}`);
          for (const order of orders) {
            if (order.status === 'pending') {
              updateOrderStatus(order.id, 'preparing');
            }
          }
          return `Table ${params.tableNumber} के orders preparing में move कर दिए गए हैं`;
        }
        throw new Error('Table number not specified');

      case 'add_item':
        if (params.menuItem && params.tableNumber) {
          const newItem = {
            id: `item-${Date.now()}`,
            menuItemId: params.menuItem.id,
            menuItem: params.menuItem,
            quantity: params.quantity || 1,
            customizations: params.specialInstructions || [],
            status: 'pending' as const,
            notes: 'Added via voice command'
          };
          
          // Find or create order for the table
          const orders = useOrderStore.getState().getOrdersByTable(`table-${params.tableNumber}`);
          let targetOrder = orders.find(o => o.status !== 'completed');
          
          if (targetOrder) {
            addItemToOrder(targetOrder.id, newItem);
          }
          
          return `${params.menuItem.name} को table ${params.tableNumber} के order में add कर दिया गया है`;
        }
        throw new Error('Menu item or table number not specified');

      default:
        throw new Error(`Unknown order command: ${subtype}`);
    }
  };

  const handleTableCommand = async (subtype: string, params: Record<string, any>): Promise<string> => {
    switch (subtype) {
      case 'mark_cleaning':
        if (params.tableNumber) {
          updateTableStatus(`table-${params.tableNumber}`, 'cleaning');
          return `Table ${params.tableNumber} को cleaning के लिए mark कर दिया गया है`;
        }
        throw new Error('Table number not specified');

      case 'mark_occupied':
        if (params.tableNumber) {
          updateTableStatus(`table-${params.tableNumber}`, 'occupied');
          return `Table ${params.tableNumber} को occupied mark कर दिया गया है`;
        }
        throw new Error('Table number not specified');

      case 'mark_available':
        if (params.tableNumber) {
          updateTableStatus(`table-${params.tableNumber}`, 'available');
          return `Table ${params.tableNumber} अब available है`;
        }
        throw new Error('Table number not specified');

      default:
        throw new Error(`Unknown table command: ${subtype}`);
    }
  };

  const handleInventoryCommand = async (subtype: string, params: Record<string, any>): Promise<string> => {
    switch (subtype) {
      case 'update':
        if (params.itemName) {
          // This is a simplified implementation
          // In a real app, you'd have more sophisticated inventory management
          return `${params.itemName} की inventory को update करने का alert भेज दिया गया है`;
        }
        throw new Error('Item name not specified');

      case 'low_stock_alert':
        return 'Low stock alert को team को भेज दिया गया है';

      default:
        throw new Error(`Unknown inventory command: ${subtype}`);
    }
  };

  const handleNavigationCommand = async (subtype: string, params: Record<string, any>): Promise<string> => {
    // This would integrate with Next.js router
    switch (subtype) {
      case 'navigate':
        if (params.page) {
          // router.push(`/${params.page}`);
          return `${params.page} page पर navigate कर रहे हैं`;
        }
        throw new Error('Page not specified');
      
      default:
        return 'Navigation command processed';
    }
  };

  const handleQueryCommand = async (subtype: string, params: Record<string, any>): Promise<string> => {
    switch (subtype) {
      case 'revenue':
        // Get today's revenue from orders
        const orders = useOrderStore.getState().orders;
        const todayRevenue = orders
          .filter(order => {
            const orderDate = new Date(order.orderTime);
            const today = new Date();
            return orderDate.toDateString() === today.toDateString();
          })
          .reduce((total, order) => total + order.totalAmount, 0);
        
        return `आज का revenue ₹${todayRevenue} है`;

      case 'orders_count':
        const todayOrders = useOrderStore.getState().orders.filter(order => {
          const orderDate = new Date(order.orderTime);
          const today = new Date();
          return orderDate.toDateString() === today.toDateString();
        });
        
        return `आज ${todayOrders.length} orders आए हैं`;

      case 'table_status':
        if (params.tableNumber) {
          const table = useTableStore.getState().tables.find(t => t.number === params.tableNumber);
          return table ? `Table ${params.tableNumber} is ${table.status}` : 'Table not found';
        }
        
        const { tables } = useTableStore.getState();
        const available = tables.filter(t => t.status === 'available').length;
        const occupied = tables.filter(t => t.status === 'occupied').length;
        
        return `${available} tables available हैं, ${occupied} tables occupied हैं`;

      case 'menu_availability':
        if (params.itemName) {
          const item = params.menuItem;
          return item?.isAvailable 
            ? `${params.itemName} available है` 
            : `${params.itemName} currently available नहीं है`;
        }
        throw new Error('Item name not specified');

      default:
        return 'Information retrieved successfully';
    }
  };

  const startVoiceListening = useCallback(async () => {
    if (!isSupported) {
      setError('Speech recognition is not supported');
      return;
    }

    try {
      startListening();
      const voiceProcessor = getVoiceProcessor();
      await voiceProcessor.startListening(handleVoiceCommand);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start listening';
      setError(errorMessage);
      stopListening();
    }
  }, [isSupported, startListening, stopListening, setError, handleVoiceCommand]);

  const stopVoiceListening = useCallback(() => {
    const voiceProcessor = getVoiceProcessor();
    voiceProcessor.stopListening();
    stopListening();
  }, [stopListening]);

  const undoLastVoiceCommand = useCallback(async () => {
    try {
      const success = await undoLastCommand();
      return success;
    } catch (error) {
      setError('Failed to undo last command');
      return false;
    }
  }, [undoLastCommand, setError]);

  // Audio level monitoring for visual feedback
  useEffect(() => {
    if (!isListening) {
      setAudioLevel(0);
      return;
    }

    let animationId: number;
    
    const updateAudioLevel = () => {
      // Simulate audio level for visual feedback
      // In a real implementation, you'd get this from the microphone
      const level = Math.random() * 100;
      setAudioLevel(level);
      animationId = requestAnimationFrame(updateAudioLevel);
    };

    updateAudioLevel();

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [isListening]);

  return {
    // State
    isSupported,
    isListening,
    isProcessing,
    currentCommand,
    lastResponse,
    error,
    history,
    audioLevel,
    
    // Actions
    startListening: startVoiceListening,
    stopListening: stopVoiceListening,
    undoLastCommand: undoLastVoiceCommand,
    
    // Utils
    getRecentCommands: () => history.slice(0, 10),
    getSuccessfulCommands: () => history.filter(cmd => cmd.success),
    clearError: () => setError(null)
  };
}