import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { InventoryItem } from '@/types';
import { mockInventory } from '@/lib/mockData';
import { saveToStore, getAllFromStore } from '@/lib/db';

interface InventoryState {
  items: InventoryItem[];
  alerts: InventoryAlert[];
  loading: boolean;
  error: string | null;
  
  // Actions
  updateItemQuantity: (itemId: string, quantity: number) => void;
  addItem: (item: InventoryItem) => void;
  removeItem: (itemId: string) => void;
  restockItem: (itemId: string, quantity: number) => void;
  loadInventory: () => Promise<void>;
  saveInventory: () => Promise<void>;
  
  // Getters
  getLowStockItems: () => InventoryItem[];
  getExpiringItems: (days?: number) => InventoryItem[];
  generateAlerts: () => void;
  getTotalValue: () => number;
}

interface InventoryAlert {
  id: string;
  type: 'low_stock' | 'expiring' | 'expired';
  itemId: string;
  itemName: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
  timestamp: Date;
}

export const useInventoryStore = create<InventoryState>()(
  immer((set, get) => ({
    items: mockInventory,
    alerts: [],
    loading: false,
    error: null,

    updateItemQuantity: (itemId: string, quantity: number) => set((state) => {
      const item = state.items.find(i => i.id === itemId);
      if (item) {
        item.quantity = Math.max(0, quantity);
        // Auto-save to IndexedDB
        saveToStore('inventory', item);
        
        // Generate alerts after update
        get().generateAlerts();
      }
    }),

    addItem: (item: InventoryItem) => set((state) => {
      state.items.push(item);
      // Auto-save to IndexedDB
      saveToStore('inventory', item);
    }),

    removeItem: (itemId: string) => set((state) => {
      state.items = state.items.filter(i => i.id !== itemId);
    }),

    restockItem: (itemId: string, quantity: number) => set((state) => {
      const item = state.items.find(i => i.id === itemId);
      if (item) {
        item.quantity += quantity;
        item.lastRestocked = new Date();
        // Auto-save to IndexedDB
        saveToStore('inventory', item);
        
        // Generate alerts after restock
        get().generateAlerts();
      }
    }),

    loadInventory: async () => {
      set((state) => {
        state.loading = true;
        state.error = null;
      });

      try {
        const savedItems = await getAllFromStore<InventoryItem>('inventory');
        set((state) => {
          state.items = savedItems.length > 0 ? savedItems : mockInventory;
          state.loading = false;
        });
        
        // Generate alerts after loading
        get().generateAlerts();
      } catch (error) {
        set((state) => {
          state.error = 'Failed to load inventory';
          state.loading = false;
        });
      }
    },

    saveInventory: async () => {
      try {
        const { items } = get();
        for (const item of items) {
          await saveToStore('inventory', item);
        }
      } catch (error) {
        set((state) => {
          state.error = 'Failed to save inventory';
        });
      }
    },

    getLowStockItems: () => {
      return get().items.filter(item => item.quantity <= item.minThreshold);
    },

    getExpiringItems: (days: number = 3) => {
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + days);
      
      return get().items.filter(item => 
        item.expiryDate && 
        new Date(item.expiryDate) <= threeDaysFromNow
      );
    },

    generateAlerts: () => set((state) => {
      const alerts: InventoryAlert[] = [];
      const now = new Date();
      
      // Low stock alerts
      const lowStockItems = get().getLowStockItems();
      lowStockItems.forEach(item => {
        alerts.push({
          id: `low-stock-${item.id}`,
          type: 'low_stock',
          itemId: item.id,
          itemName: item.name,
          message: `${item.name} stock is low (${item.quantity} ${item.unit} remaining)`,
          severity: item.quantity === 0 ? 'high' : 'medium',
          timestamp: now
        });
      });
      
      // Expiring items alerts
      const expiringItems = get().getExpiringItems();
      expiringItems.forEach(item => {
        if (item.expiryDate) {
          const daysUntilExpiry = Math.ceil(
            (new Date(item.expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          );
          
          alerts.push({
            id: `expiring-${item.id}`,
            type: daysUntilExpiry <= 0 ? 'expired' : 'expiring',
            itemId: item.id,
            itemName: item.name,
            message: daysUntilExpiry <= 0 
              ? `${item.name} has expired`
              : `${item.name} expires in ${daysUntilExpiry} day(s)`,
            severity: daysUntilExpiry <= 0 ? 'high' : daysUntilExpiry <= 1 ? 'high' : 'medium',
            timestamp: now
          });
        }
      });
      
      state.alerts = alerts;
    }),

    getTotalValue: () => {
      // This would calculate total inventory value if we had cost prices
      // For now, just return the count
      return get().items.reduce((total, item) => total + item.quantity, 0);
    }
  }))
);