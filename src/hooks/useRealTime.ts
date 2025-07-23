import { useEffect, useCallback, useState } from 'react';
import { getSocketManager } from '@/lib/socket';
import { useOrderStore } from '@/stores/orderStore';
import { useTableStore } from '@/stores/tableStore';
import { useInventoryStore } from '@/stores/inventoryStore';

export function useRealTimeUpdates() {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  const updateOrderStatus = useOrderStore(state => state.updateOrderStatus);
  const updateTableStatus = useTableStore(state => state.updateTableStatus);
  const generateInventoryAlerts = useInventoryStore(state => state.generateAlerts);

  useEffect(() => {
    const socket = getSocketManager();
    
    // Connection status handlers
    const handleConnectionStatus = (data: any) => {
      setIsConnected(data.status === 'connected');
      if (data.status === 'error') {
        setConnectionError(data.error);
      } else {
        setConnectionError(null);
      }
    };

    // Order update handlers
    const handleOrderCreated = (data: any) => {
      console.log('New order created:', data);
      // Trigger UI notifications
      showNotification('New Order', `Order #${data.id} has been created`, 'info');
    };

    const handleOrderUpdated = (data: any) => {
      console.log('Order updated:', data);
      updateOrderStatus(data.orderId, data.status);
      showNotification('Order Updated', `Order #${data.orderId} is now ${data.status}`, 'success');
    };

    const handleOrderCompleted = (data: any) => {
      console.log('Order completed:', data);
      updateOrderStatus(data.orderId, 'completed');
      showNotification('Order Complete', `Order #${data.orderId} has been completed`, 'success');
    };

    // Table update handlers
    const handleTableStatusChanged = (data: any) => {
      console.log('Table status changed:', data);
      updateTableStatus(data.tableId, data.status);
      showNotification('Table Update', `Table ${data.tableId} is now ${data.status}`, 'info');
    };

    // Inventory alert handlers
    const handleInventoryAlert = (data: any) => {
      console.log('Inventory alert:', data);
      generateInventoryAlerts();
      showNotification('Inventory Alert', data.message, 'warning');
    };

    // Metrics update handlers
    const handleMetricsUpdated = (data: any) => {
      console.log('Metrics updated:', data);
      // Update metrics in stores if needed
    };

    // General notification handler
    const handleNewNotification = (data: any) => {
      console.log('New notification:', data);
      showNotification(data.title, data.message, data.type);
    };

    // Register event listeners
    socket.on('connection:status', handleConnectionStatus);
    socket.on('order:created', handleOrderCreated);
    socket.on('order:updated', handleOrderUpdated);
    socket.on('order:completed', handleOrderCompleted);
    socket.on('table:statusChanged', handleTableStatusChanged);
    socket.on('inventory:alert', handleInventoryAlert);
    socket.on('metric:updated', handleMetricsUpdated);
    socket.on('notification:new', handleNewNotification);

    // Set initial connection status
    setIsConnected(socket.getConnectionStatus() === 'connected');

    // Cleanup
    return () => {
      socket.off('connection:status', handleConnectionStatus);
      socket.off('order:created', handleOrderCreated);
      socket.off('order:updated', handleOrderUpdated);
      socket.off('order:completed', handleOrderCompleted);
      socket.off('table:statusChanged', handleTableStatusChanged);
      socket.off('inventory:alert', handleInventoryAlert);
      socket.off('metric:updated', handleMetricsUpdated);
      socket.off('notification:new', handleNewNotification);
    };
  }, [updateOrderStatus, updateTableStatus, generateInventoryAlerts]);

  // Optimistic UI update helper
  const performOptimisticUpdate = useCallback(async (
    action: () => void,
    rollback: () => void,
    socketEvent: string,
    data: any
  ) => {
    const socket = getSocketManager();
    
    try {
      // Perform optimistic update
      action();
      
      // Emit to server
      socket.emit(socketEvent, data);
      
      // If we don't get confirmation in 5 seconds, rollback
      setTimeout(() => {
        // In a real app, you'd track if the server confirmed the update
        // For now, we'll assume success
      }, 5000);
      
    } catch (error) {
      console.error('Optimistic update failed:', error);
      rollback();
    }
  }, []);

  return {
    isConnected,
    connectionError,
    performOptimisticUpdate
  };
}

// Connection status hook
export function useConnectionStatus() {
  const [status, setStatus] = useState<'connected' | 'disconnected' | 'connecting' | 'error'>('disconnected');

  useEffect(() => {
    const socket = getSocketManager();
    
    const handleStatusChange = (data: any) => {
      setStatus(data.status);
    };

    socket.on('connection:status', handleStatusChange);
    setStatus(socket.getConnectionStatus());

    return () => {
      socket.off('connection:status', handleStatusChange);
    };
  }, []);

  return status;
}

// Custom hook for specific socket events
export function useSocketEvent(event: string, handler: (data: any) => void) {
  useEffect(() => {
    const socket = getSocketManager();
    socket.on(event, handler);

    return () => {
      socket.off(event, handler);
    };
  }, [event, handler]);
}

// Notification helper (would integrate with a toast library)
function showNotification(title: string, message: string, type: 'info' | 'success' | 'warning' | 'error') {
  // For demo purposes, we'll use console.log
  // In a real app, you'd integrate with react-hot-toast or similar
  console.log(`[${type.toUpperCase()}] ${title}: ${message}`);
  
  // You could also dispatch to a notifications store
  if (typeof window !== 'undefined') {
    const notificationEvent = new CustomEvent('app:notification', {
      detail: { title, message, type, timestamp: new Date() }
    });
    window.dispatchEvent(notificationEvent);
  }
}