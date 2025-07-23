import { io, Socket } from 'socket.io-client';
import { SocketEvent } from '@/types';
import React from 'react';

class SocketManager {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private connectionStatus: 'connected' | 'disconnected' | 'connecting' | 'error' = 'disconnected';
  private listeners: Map<string, Function[]> = new Map();

  constructor() {
    if (typeof window !== 'undefined') {
      this.connect();
    }
  }

  connect() {
    if (this.socket?.connected) {
      return;
    }

    this.connectionStatus = 'connecting';
    this.socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || window.location.origin, {
      transports: ['websocket', 'polling'],
      timeout: 5000,
      autoConnect: true,
      forceNew: false
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket?.id);
      this.connectionStatus = 'connected';
      this.reconnectAttempts = 0;
      this.notifyListeners('connection:status', { status: 'connected' });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      this.connectionStatus = 'disconnected';
      this.notifyListeners('connection:status', { status: 'disconnected', reason });
      
      // Auto-reconnect for certain disconnect reasons
      if (reason === 'io server disconnect') {
        // Server initiated disconnect - don't auto-reconnect
        return;
      }
      
      this.attemptReconnect();
    });

    this.socket.on('connect_error', (error) => {
      console.warn('Socket connection error (will retry):', error.message);
      this.connectionStatus = 'disconnected';
      this.notifyListeners('connection:status', { status: 'disconnected', error: error.message });
      
      // Only attempt reconnect if it's not a permanent error
      if (!error.message.includes('server error') && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.attemptReconnect();
      }
    });

    // Restaurant-specific events
    this.socket.on('order:created', (data) => {
      this.notifyListeners('order:created', data);
    });

    this.socket.on('order:updated', (data) => {
      this.notifyListeners('order:updated', data);
    });

    this.socket.on('order:completed', (data) => {
      this.notifyListeners('order:completed', data);
    });

    this.socket.on('table:statusChanged', (data) => {
      this.notifyListeners('table:statusChanged', data);
    });

    this.socket.on('inventory:alert', (data) => {
      this.notifyListeners('inventory:alert', data);
    });

    this.socket.on('metric:updated', (data) => {
      this.notifyListeners('metric:updated', data);
    });

    this.socket.on('notification:new', (data) => {
      this.notifyListeners('notification:new', data);
    });
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff
    
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      if (this.socket && !this.socket.connected) {
        this.socket.connect();
      }
    }, delay);
  }

  emit(event: string, data?: any) {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn('Socket not connected, cannot emit event:', event);
      // Store event for when connection is restored
      this.scheduleOfflineEvent(event, data);
    }
  }

  private scheduleOfflineEvent(event: string, data: any) {
    // In a real app, you'd queue events and send them when reconnected
    console.log('Scheduling offline event:', event, data);
  }

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  off(event: string, callback?: Function) {
    if (!callback) {
      this.listeners.delete(event);
      return;
    }

    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  private notifyListeners(event: string, data: any) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in socket event callback:', error);
        }
      });
    }
  }

  getConnectionStatus() {
    return this.connectionStatus;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.connectionStatus = 'disconnected';
  }

  // Restaurant-specific helper methods
  emitOrderUpdate(orderId: string, updates: any) {
    this.emit('order:update', { orderId, updates, timestamp: new Date() });
  }

  emitTableStatusChange(tableId: string, status: string, waiter?: string) {
    this.emit('table:statusChange', { tableId, status, waiter, timestamp: new Date() });
  }

  emitInventoryAlert(itemId: string, alertType: string, message: string) {
    this.emit('inventory:alert', { itemId, alertType, message, timestamp: new Date() });
  }

  joinRoom(room: string) {
    this.emit('join:room', room);
  }

  leaveRoom(room: string) {
    this.emit('leave:room', room);
  }
}

// Create singleton instance
let socketManager: SocketManager | null = null;

export function getSocketManager(): SocketManager {
  if (!socketManager) {
    socketManager = new SocketManager();
  }
  return socketManager;
}

// React hook for socket connection status
export function useSocketStatus() {
  const [status, setStatus] = React.useState<'connected' | 'disconnected' | 'connecting' | 'error'>('disconnected');

  React.useEffect(() => {
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

// React hook for socket events
export function useSocketEvent(event: string, callback: Function) {
  React.useEffect(() => {
    const socket = getSocketManager();
    socket.on(event, callback);

    return () => {
      socket.off(event, callback);
    };
  }, [event, callback]);
}

// Make socket available globally for stores
declare global {
  interface Window {
    socket: SocketManager;
  }
}

if (typeof window !== 'undefined') {
  window.socket = getSocketManager();
}

export default getSocketManager;