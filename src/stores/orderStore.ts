import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { subscribeWithSelector } from 'zustand/middleware';
import { Order, OrderStatus, OrderItem } from '@/types';
import { mockOrders } from '@/lib/mockData';
import { saveToStore, getAllFromStore } from '@/lib/db';

interface OrderState {
  orders: Order[];
  loading: boolean;
  error: string | null;
  
  // Actions
  addOrder: (order: Order) => void;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  updateItemStatus: (orderId: string, itemId: string, status: OrderItem['status']) => void;
  addItemToOrder: (orderId: string, item: OrderItem) => void;
  removeItemFromOrder: (orderId: string, itemId: string) => void;
  loadOrders: () => Promise<void>;
  saveOrders: () => Promise<void>;
  getOrdersByStatus: (status: OrderStatus) => Order[];
  getOrdersByTable: (tableId: string) => Order[];
  calculateOrderTotal: (orderId: string) => number;
}

export const useOrderStore = create<OrderState>()(
  subscribeWithSelector(
    immer((set, get) => ({
      orders: mockOrders,
      loading: false,
      error: null,

      addOrder: (order: Order) => set((state) => {
        state.orders.push(order);
        // Auto-save to IndexedDB
        saveToStore('orders', order);
      }),

      updateOrderStatus: (orderId: string, status: OrderStatus) => set((state) => {
        const order = state.orders.find(o => o.id === orderId);
        if (order) {
          // Store previous status for rollback
          const previousStatus = order.status;
          
          // Optimistic update
          order.status = status;
          order.isOptimistic = true;
          
          if (status === 'completed') {
            order.estimatedCompletionTime = new Date();
          }
          
          // Auto-save to IndexedDB
          saveToStore('orders', order).catch((error) => {
            // Rollback on error
            console.error('Failed to save order status:', error);
            set((state) => {
              const rollbackOrder = state.orders.find(o => o.id === orderId);
              if (rollbackOrder) {
                rollbackOrder.status = previousStatus;
                rollbackOrder.isOptimistic = false;
              }
            });
            
            if (window.showToast) {
              window.showToast('error', 'Update Failed', 'Failed to update order status', 3000);
            }
          });
          
          // Remove optimistic flag after a delay
          setTimeout(() => {
            set((state) => {
              const updatedOrder = state.orders.find(o => o.id === orderId);
              if (updatedOrder) {
                updatedOrder.isOptimistic = false;
              }
            });
          }, 300);
        }
      }),

      updateItemStatus: (orderId: string, itemId: string, status: OrderItem['status']) => set((state) => {
        const order = state.orders.find(o => o.id === orderId);
        if (order) {
          const item = order.items.find(i => i.id === itemId);
          if (item) {
            item.status = status;
            
            // Update order status based on item statuses
            const allServed = order.items.every(i => i.status === 'served');
            const anyPreparing = order.items.some(i => i.status === 'preparing');
            const allReady = order.items.every(i => i.status === 'ready' || i.status === 'served');
            
            if (allServed) {
              order.status = 'served';
            } else if (allReady) {
              order.status = 'ready';
            } else if (anyPreparing) {
              order.status = 'preparing';
            }
            
            // Auto-save to IndexedDB
            saveToStore('orders', order);
          }
        }
      }),

      addItemToOrder: (orderId: string, item: OrderItem) => set((state) => {
        const order = state.orders.find(o => o.id === orderId);
        if (order) {
          order.items.push(item);
          order.totalAmount = get().calculateOrderTotal(orderId);
          // Auto-save to IndexedDB
          saveToStore('orders', order);
        }
      }),

      removeItemFromOrder: (orderId: string, itemId: string) => set((state) => {
        const order = state.orders.find(o => o.id === orderId);
        if (order) {
          order.items = order.items.filter(i => i.id !== itemId);
          order.totalAmount = get().calculateOrderTotal(orderId);
          // Auto-save to IndexedDB
          saveToStore('orders', order);
        }
      }),

      loadOrders: async () => {
        set((state) => {
          state.loading = true;
          state.error = null;
        });

        try {
          const savedOrders = await getAllFromStore<Order>('orders');
          
          // Filter out any orders with missing critical fields
          const validOrders = savedOrders.filter(order => 
            order && order.id && order.tableId && order.items && order.orderTime
          );
          
          set((state) => {
            // Use saved orders if they exist and are valid, otherwise use mock data
            state.orders = validOrders.length > 0 ? validOrders : mockOrders;
            state.loading = false;
          });
          
          console.log(`Loaded ${validOrders.length} valid orders from database`);
        } catch (error) {
          console.error('Error loading orders:', error);
          set((state) => {
            state.error = 'Failed to load orders';
            state.loading = false;
            // Fall back to mock data on error
            state.orders = mockOrders;
          });
        }
      },

      saveOrders: async () => {
        try {
          const { orders } = get();
          for (const order of orders) {
            await saveToStore('orders', order);
          }
        } catch (error) {
          set((state) => {
            state.error = 'Failed to save orders';
          });
        }
      },

      getOrdersByStatus: (status: OrderStatus) => {
        return get().orders.filter(order => order.status === status);
      },

      getOrdersByTable: (tableId: string) => {
        return get().orders.filter(order => order.tableId === tableId);
      },

      calculateOrderTotal: (orderId: string) => {
        const order = get().orders.find(o => o.id === orderId);
        if (!order) return 0;
        
        return order.items.reduce((total, item) => {
          return total + (item.menuItem.price * item.quantity);
        }, 0);
      }
    }))
  )
);

// Subscribe to changes for real-time sync
useOrderStore.subscribe(
  (state) => state.orders,
  (orders) => {
    // Emit socket events for real-time updates
    if (typeof window !== 'undefined' && window.socket) {
      window.socket.emit('orders:updated', orders);
    }
  }
);