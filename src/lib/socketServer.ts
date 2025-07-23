// Mock Socket.io server for demo purposes
// In production, this would be a separate Node.js server

import { Server as SocketIOServer } from 'socket.io';
import { createServer } from 'http';

export class MockSocketServer {
  private io: SocketIOServer | null = null;
  private server: any = null;
  private isRunning = false;

  constructor() {
    if (typeof window === 'undefined') {
      this.setupServer();
    }
  }

  private setupServer() {
    // This is a mock implementation for demo
    // In a real app, you'd have a separate Express/Node.js server
    console.log('Mock Socket.io server initialized');
  }

  start() {
    if (this.isRunning) return;
    
    console.log('Starting mock Socket.io server...');
    this.isRunning = true;
    
    // Simulate server responses for demo
    this.simulateServerEvents();
  }

  private simulateServerEvents() {
    // Simulate real-time updates for demo
    setInterval(() => {
      if (typeof window !== 'undefined' && window.socket) {
        // Simulate random order updates
        const randomOrderId = `order-${Math.floor(Math.random() * 5) + 1}`;
        const statuses = ['preparing', 'ready', 'served'];
        const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
        
        // This would normally come from the server
        const orderUpdateEvent = new CustomEvent('socket:order:updated', {
          detail: {
            orderId: randomOrderId,
            status: randomStatus,
            timestamp: new Date()
          }
        });
        
        window.dispatchEvent(orderUpdateEvent);
      }
    }, 10000); // Every 10 seconds

    // Simulate table status changes
    setInterval(() => {
      if (typeof window !== 'undefined' && window.socket) {
        const randomTableId = `table-${Math.floor(Math.random() * 8) + 1}`;
        const statuses = ['available', 'occupied', 'cleaning'];
        const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
        
        const tableUpdateEvent = new CustomEvent('socket:table:statusChanged', {
          detail: {
            tableId: randomTableId,
            status: randomStatus,
            timestamp: new Date()
          }
        });
        
        window.dispatchEvent(tableUpdateEvent);
      }
    }, 15000); // Every 15 seconds

    // Simulate inventory alerts
    setInterval(() => {
      if (typeof window !== 'undefined' && window.socket) {
        const items = ['Paneer', 'Tomatoes', 'Basmati Rice'];
        const randomItem = items[Math.floor(Math.random() * items.length)];
        
        const inventoryAlertEvent = new CustomEvent('socket:inventory:alert', {
          detail: {
            itemName: randomItem,
            alertType: 'low_stock',
            message: `${randomItem} stock is running low`,
            timestamp: new Date()
          }
        });
        
        window.dispatchEvent(inventoryAlertEvent);
      }
    }, 30000); // Every 30 seconds
  }

  stop() {
    if (this.server) {
      this.server.close();
    }
    this.isRunning = false;
    console.log('Mock Socket.io server stopped');
  }
}

// Demo server instance
let mockServer: MockSocketServer | null = null;

export function startMockServer() {
  if (!mockServer) {
    mockServer = new MockSocketServer();
  }
  mockServer.start();
  return mockServer;
}

export function stopMockServer() {
  if (mockServer) {
    mockServer.stop();
    mockServer = null;
  }
}