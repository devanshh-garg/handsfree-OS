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
      
      // Skip interim commands
      if (command.action.subtype === 'interim') {
        return;
      }
      
      // Execute the voice command
      const response = await executeVoiceCommand(command);
      command.response = response;
      command.success = true;
      
      addCommand(command);
      setLastResponse(response);
      setError(null);
      
      // Show success toast
      if (typeof window !== 'undefined' && window.showToast) {
        window.showToast('success', 'Command Executed', response, 4000);
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Voice command failed';
      command.response = errorMessage;
      command.success = false;
      
      addCommand(command);
      setError(errorMessage);
      
      // Show error toast
      if (typeof window !== 'undefined' && window.showToast) {
        window.showToast('error', 'Command Failed', errorMessage, 5000);
      }
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
          // Get current orders state
          const { orders } = useOrderStore.getState();
          const tableOrders = orders.filter(o => 
            o.tableId === `table-${params.tableNumber}` && 
            (o.status === 'preparing' || o.status === 'pending')
          );
          
          if (tableOrders.length === 0) {
            return `Table ${params.tableNumber} पर कोई active order नहीं है`;
          }
          
          // Mark all preparing orders as ready
          for (const order of tableOrders) {
            updateOrderStatus(order.id, 'ready');
            console.log(`Marked order ${order.id} as ready`);
          }
          
          // Emit socket event for real-time updates
          if (typeof window !== 'undefined' && (window as any).socket) {
            (window as any).socket.emit('order:update', {
              tableId: `table-${params.tableNumber}`,
              status: 'ready',
              timestamp: new Date()
            });
          }
          
          return `Table ${params.tableNumber} के सभी orders ready mark कर दिए गए हैं`;
        }
        throw new Error('Table number not specified');

      case 'mark_preparing':
        if (params.tableNumber) {
          const { orders } = useOrderStore.getState();
          const tableOrders = orders.filter(o => 
            o.tableId === `table-${params.tableNumber}` && 
            o.status === 'pending'
          );
          
          if (tableOrders.length === 0) {
            return `Table ${params.tableNumber} पर कोई pending order नहीं है`;
          }
          
          for (const order of tableOrders) {
            updateOrderStatus(order.id, 'preparing');
            console.log(`Marked order ${order.id} as preparing`);
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
          const { orders } = useOrderStore.getState();
          const targetOrder = orders.find(o => 
            o.tableId === `table-${params.tableNumber}` && 
            o.status !== 'completed'
          );
          
          if (targetOrder) {
            addItemToOrder(targetOrder.id, newItem);
            console.log(`Added item to order ${targetOrder.id}`);
          } else {
            // Create new order if none exists
            const newOrder = {
              id: `order-${Date.now()}`,
              tableId: `table-${params.tableNumber}`,
              items: [newItem],
              status: 'pending' as const,
              totalAmount: params.menuItem.price * (params.quantity || 1),
              orderTime: new Date(),
              waiterName: 'Voice Assistant'
            };
            useOrderStore.getState().addOrder(newOrder);
            console.log('Created new order via voice');
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
          
          // Emit socket event
          if (typeof window !== 'undefined' && (window as any).socket) {
            (window as any).socket.emit('table:statusChange', {
              tableId: `table-${params.tableNumber}`,
              status: 'cleaning',
              timestamp: new Date()
            });
          }
          
          return `Table ${params.tableNumber} को cleaning के लिए mark कर दिया गया है`;
        }
        throw new Error('Table number not specified');

      case 'mark_occupied':
        if (params.tableNumber) {
          updateTableStatus(`table-${params.tableNumber}`, 'occupied');
          
          // Emit socket event
          if (typeof window !== 'undefined' && (window as any).socket) {
            (window as any).socket.emit('table:statusChange', {
              tableId: `table-${params.tableNumber}`,
              status: 'occupied',
              timestamp: new Date()
            });
          }
          
          return `Table ${params.tableNumber} को occupied mark कर दिया गया है`;
        }
        throw new Error('Table number not specified');

      case 'mark_available':
        if (params.tableNumber) {
          updateTableStatus(`table-${params.tableNumber}`, 'available');
          
          // Emit socket event
          if (typeof window !== 'undefined' && (window as any).socket) {
            (window as any).socket.emit('table:statusChange', {
              tableId: `table-${params.tableNumber}`,
              status: 'available',
              timestamp: new Date()
            });
          }
          
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
          // Update inventory quantity if specified
          if (params.quantity !== undefined) {
            updateItemQuantity(params.itemName, params.quantity);
          }
          
          // Emit socket event
          if (typeof window !== 'undefined' && (window as any).socket) {
            (window as any).socket.emit('inventory:alert', {
              itemName: params.itemName,
              alertType: 'manual_update',
              quantity: params.quantity,
              message: `${params.itemName} inventory updated via voice command`,
              timestamp: new Date()
            });
          }
          
          return `${params.itemName} की inventory को update कर दिया गया है`;
        }
        throw new Error('Item name not specified');

      case 'low_stock_alert':
        // Add alert to inventory store
        const alert = {
          id: `alert-${Date.now()}`,
          type: 'low_stock' as const,
          itemId: `item-${Date.now()}`,
          itemName: params.itemName || 'Multiple items',
          message: 'Low stock alert generated via voice',
          severity: 'high' as const,
          timestamp: new Date()
        };
        useInventoryStore.getState().addAlert(alert);
        
        // Emit socket event
        if (typeof window !== 'undefined' && (window as any).socket) {
          (window as any).socket.emit('inventory:alert', alert);
        }
        
        return 'Low stock alert को team को भेज दिया गया है';

      default:
        throw new Error(`Unknown inventory command: ${subtype}`);
    }
  };

  const handleNavigationCommand = async (subtype: string, params: Record<string, any>): Promise<string> => {
    // Get router instance if in browser
    if (typeof window !== 'undefined') {
      const router = require('next/navigation').useRouter();
      
      switch (subtype) {
        case 'navigate':
          let targetPath = '/';
          let pageName = '';
          
          // Map common navigation requests to routes
          if (params.page) {
            const page = params.page.toLowerCase();
            if (page.includes('dashboard') || page.includes('home')) {
              targetPath = '/dashboard';
              pageName = 'Dashboard';
            } else if (page.includes('kitchen') || page.includes('किचन')) {
              targetPath = '/kitchen';
              pageName = 'Kitchen';
            } else if (page.includes('waiter') || page.includes('वेटर')) {
              targetPath = '/waiter';
              pageName = 'Waiter';
            } else if (page.includes('menu') || page.includes('मेन्यू')) {
              targetPath = '/menu';
              pageName = 'Menu';
            }
          }
          
          // Navigate to the page
          router.push(targetPath);
          
          return `${pageName || params.page} page पर जा रहे हैं`;
        
        case 'back':
          router.back();
          return 'पिछले page पर वापस जा रहे हैं';
        
        case 'refresh':
          router.refresh();
          return 'Page refresh हो रहा है';
        
        default:
          return 'Navigation command processed';
      }
    }
    
    return 'Navigation not available';
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
      // First request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Stop the stream immediately - we just needed to trigger permission
      stream.getTracks().forEach(track => track.stop());
      
      // Update store state
      startListening();
      
      // Initialize and start the voice processor
      const voiceProcessor = getVoiceProcessor();
      
      // Set up the callback that will receive voice commands
      await voiceProcessor.startListening(async (command: VoiceCommand) => {
        // Process the command through our handler
        await handleVoiceCommand(command);
      });
      
      console.log('Voice recognition started successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start listening';
      
      // Provide user-friendly error messages
      if (errorMessage.includes('Permission denied') || errorMessage.includes('NotAllowedError')) {
        setError('Microphone access denied. Please allow microphone permissions to use voice commands.');
      } else if (errorMessage.includes('NotFoundError')) {
        setError('No microphone found. Please connect a microphone to use voice commands.');
      } else {
        setError(errorMessage);
      }
      
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
    let audioContext: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let microphone: MediaStreamAudioSourceNode | null = null;
    let dataArray: Uint8Array | null = null;
    
    const setupAudioAnalysis = async () => {
      try {
        // Get microphone stream
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // Create audio context and analyser
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        
        // Connect microphone to analyser
        microphone = audioContext.createMediaStreamSource(stream);
        microphone.connect(analyser);
        
        // Create data array for frequency data
        const bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
        
        const updateAudioLevel = () => {
          if (!analyser || !dataArray) return;
          
          // Get frequency data
          analyser.getByteFrequencyData(dataArray);
          
          // Calculate average volume
          const sum = dataArray.reduce((acc, val) => acc + val, 0);
          const average = sum / dataArray.length;
          
          // Normalize to 0-100 range with some amplification
          const normalizedLevel = Math.min(100, (average / 256) * 200);
          
          setAudioLevel(normalizedLevel);
          animationId = requestAnimationFrame(updateAudioLevel);
        };
        
        updateAudioLevel();
        
      } catch (error) {
        console.error('Failed to setup audio analysis:', error);
        // Fallback to simulated levels
        const updateSimulatedLevel = () => {
          const level = Math.random() * 50 + 25;
          setAudioLevel(level);
          animationId = requestAnimationFrame(updateSimulatedLevel);
        };
        updateSimulatedLevel();
      }
    };
    
    setupAudioAnalysis();

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
      if (audioContext) {
        audioContext.close();
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
    clearError: () => setError(null),
    processVoiceCommand
  };
}