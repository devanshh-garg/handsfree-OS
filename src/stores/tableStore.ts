import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { Table } from '@/types';
import { mockTables } from '@/lib/mockData';
import { saveToStore, getAllFromStore } from '@/lib/db';

interface TableState {
  tables: Table[];
  loading: boolean;
  error: string | null;
  
  // Actions
  updateTableStatus: (tableId: string, status: Table['status']) => void;
  assignWaiter: (tableId: string, waiterName: string) => void;
  addTable: (table: Table) => void;
  removeTable: (tableId: string) => void;
  loadTables: () => Promise<void>;
  saveTables: () => Promise<void>;
  
  // Getters
  getAvailableTables: () => Table[];
  getOccupiedTables: () => Table[];
  getTablesByWaiter: (waiterName: string) => Table[];
  getTableUtilization: () => number;
}

export const useTableStore = create<TableState>()(
  immer((set, get) => ({
    tables: mockTables,
    loading: false,
    error: null,

    updateTableStatus: (tableId: string, status: Table['status']) => set((state) => {
      const table = state.tables.find(t => t.id === tableId);
      if (table) {
        table.status = status;
        // Auto-save to IndexedDB
        saveToStore('tables', table);
      }
    }),

    assignWaiter: (tableId: string, waiterName: string) => set((state) => {
      const table = state.tables.find(t => t.id === tableId);
      if (table) {
        table.waiter = waiterName;
        // Auto-save to IndexedDB
        saveToStore('tables', table);
      }
    }),

    addTable: (table: Table) => set((state) => {
      state.tables.push(table);
      // Auto-save to IndexedDB
      saveToStore('tables', table);
    }),

    removeTable: (tableId: string) => set((state) => {
      state.tables = state.tables.filter(t => t.id !== tableId);
    }),

    loadTables: async () => {
      set((state) => {
        state.loading = true;
        state.error = null;
      });

      try {
        const savedTables = await getAllFromStore<Table>('tables');
        set((state) => {
          state.tables = savedTables.length > 0 ? savedTables : mockTables;
          state.loading = false;
        });
      } catch (error) {
        set((state) => {
          state.error = 'Failed to load tables';
          state.loading = false;
        });
      }
    },

    saveTables: async () => {
      try {
        const { tables } = get();
        for (const table of tables) {
          await saveToStore('tables', table);
        }
      } catch (error) {
        set((state) => {
          state.error = 'Failed to save tables';
        });
      }
    },

    getAvailableTables: () => {
      return get().tables.filter(table => table.status === 'available');
    },

    getOccupiedTables: () => {
      return get().tables.filter(table => table.status === 'occupied');
    },

    getTablesByWaiter: (waiterName: string) => {
      return get().tables.filter(table => table.waiter === waiterName);
    },

    getTableUtilization: () => {
      const { tables } = get();
      const occupiedCount = tables.filter(t => t.status === 'occupied').length;
      return tables.length > 0 ? (occupiedCount / tables.length) * 100 : 0;
    }
  }))
);