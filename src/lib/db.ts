import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface RestaurantDB extends DBSchema {
  orders: {
    key: string;
    value: any;
  };
  tables: {
    key: string;
    value: any;
  };
  inventory: {
    key: string;
    value: any;
  };
  voiceCommands: {
    key: string;
    value: any;
  };
  metrics: {
    key: string;
    value: any;
  };
}

let dbInstance: IDBPDatabase<RestaurantDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<RestaurantDB>> {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = await openDB<RestaurantDB>('restaurant-db', 1, {
    upgrade(db) {
      // Create object stores
      if (!db.objectStoreNames.contains('orders')) {
        db.createObjectStore('orders', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('tables')) {
        db.createObjectStore('tables', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('inventory')) {
        db.createObjectStore('inventory', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('voiceCommands')) {
        const voiceStore = db.createObjectStore('voiceCommands', { keyPath: 'id' });
        voiceStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
      if (!db.objectStoreNames.contains('metrics')) {
        const metricsStore = db.createObjectStore('metrics', { keyPath: 'timestamp' });
      }
    }
  });

  return dbInstance;
}

// Helper function to sanitize data for IndexedDB storage
function sanitizeForIndexedDB<T>(data: T): T {
  // Handle null/undefined at the root level
  if (data === null || data === undefined) {
    return {} as T;
  }
  
  // Handle primitive types
  if (typeof data !== 'object') {
    return data;
  }
  
  // Safely check for Date objects without using instanceof
  try {
    if (Object.prototype.toString.call(data) === '[object Date]') {
      return data;
    }
  } catch (e) {
    // If we can't check, treat as regular object
  }
  
  // Safely check for arrays
  try {
    if (Array.isArray(data)) {
      return data
        .filter(item => item !== null && item !== undefined) // Remove null/undefined items
        .map(item => sanitizeForIndexedDB(item)) as T;
    }
  } catch (e) {
    // If we can't check, treat as regular object
  }
  
  // Safely iterate over object properties
  try {
    const sanitized = {} as any;
    for (const [key, value] of Object.entries(data as any)) {
      if (value === null || value === undefined) {
        // Skip null/undefined values entirely to avoid DataCloneError
        // IndexedDB cannot clone null values
        continue;
      } else {
        sanitized[key] = sanitizeForIndexedDB(value);
      }
    }
    return sanitized as T;
  } catch (e) {
    // If we can't iterate, return the original data
    return data;
  }
}


// Generic CRUD operations
export async function saveToStore<T>(storeName: keyof RestaurantDB, data: T): Promise<void> {
  // Early validation to prevent null data
  if (data === null || data === undefined) {
    console.warn(`Attempted to save null/undefined data to store ${storeName}`);
    return;
  }

  try {
    const db = await getDB();
    const sanitizedData = sanitizeForIndexedDB(data);
    
    // Additional validation after sanitization
    if (sanitizedData === null || sanitizedData === undefined) {
      console.warn(`Sanitized data is null/undefined for store ${storeName}`);
      return;
    }
    
    await db.put(storeName as any, sanitizedData);
  } catch (error) {
    console.error(`Failed to save to store ${storeName}:`, error);
    
    // If it's a DataCloneError, try with a more aggressive sanitization
    if (error instanceof Error && error.name === 'DataCloneError') {
      try {
        const strictlySanitizedData = JSON.parse(JSON.stringify(data, (key, value) => {
          // Replace null/undefined with appropriate defaults
          if (value === null || value === undefined) {
            // Return empty string for string context, empty object for object context
            return '';
          }
          return value;
        }));
        
        await db.put(storeName as any, strictlySanitizedData);
        console.log(`Successfully saved to ${storeName} after strict sanitization`);
      } catch (retryError) {
        console.error(`Failed to save to store ${storeName} even after strict sanitization:`, retryError);
        throw retryError;
      }
    } else {
      throw error;
    }
  }
}

export async function getFromStore<T>(storeName: keyof RestaurantDB, key: string): Promise<T | undefined> {
  const db = await getDB();
  return await db.get(storeName, key);
}

export async function getAllFromStore<T>(storeName: keyof RestaurantDB): Promise<T[]> {
  const db = await getDB();
  return await db.getAll(storeName);
}

export async function deleteFromStore(storeName: keyof RestaurantDB, key: string): Promise<void> {
  const db = await getDB();
  await db.delete(storeName, key);
}

export async function clearStore(storeName: keyof RestaurantDB): Promise<void> {
  const db = await getDB();
  await db.clear(storeName);
}

// Data validation functions
export function validateOrder(order: any): boolean {
  return !!(
    order &&
    typeof order.id === 'string' &&
    typeof order.tableId === 'string' &&
    Array.isArray(order.items) &&
    typeof order.status === 'string' &&
    typeof order.totalAmount === 'number'
  );
}

export function validateTable(table: any): boolean {
  return !!(
    table &&
    typeof table.id === 'string' &&
    typeof table.number === 'number' &&
    typeof table.status === 'string'
  );
}

export function validateMenuItem(item: any): boolean {
  return !!(
    item &&
    typeof item.id === 'string' &&
    typeof item.name === 'string' &&
    typeof item.price === 'number' &&
    typeof item.category === 'string'
  );
}

// Enhanced get functions with validation
export async function getValidatedFromStore<T>(
  storeName: keyof RestaurantDB, 
  key: string,
  validator?: (data: any) => boolean
): Promise<T | undefined> {
  const db = await getDB();
  const data = await db.get(storeName, key);
  
  if (!data) return undefined;
  
  // Apply validation if provided
  if (validator && !validator(data)) {
    console.warn(`Invalid data found in ${storeName} for key ${key}:`, data);
    // Remove corrupted data
    await db.delete(storeName, key);
    return undefined;
  }
  
  return data;
}

export async function getAllValidatedFromStore<T>(
  storeName: keyof RestaurantDB,
  validator?: (data: any) => boolean
): Promise<T[]> {
  const db = await getDB();
  const allData = await db.getAll(storeName);
  
  if (!validator) return allData;
  
  // Filter out invalid data and clean up
  const validData: T[] = [];
  const keysToDelete: string[] = [];
  
  for (const item of allData) {
    if (validator(item)) {
      validData.push(item);
    } else {
      console.warn(`Invalid data found in ${storeName}:`, item);
      // Collect keys of corrupted data for cleanup
      if (item && typeof item === 'object' && 'id' in item) {
        keysToDelete.push((item as any).id);
      }
    }
  }
  
  // Clean up corrupted data
  for (const key of keysToDelete) {
    try {
      await db.delete(storeName, key);
      console.log(`Cleaned up corrupted data with key: ${key}`);
    } catch (error) {
      console.error(`Failed to delete corrupted data with key ${key}:`, error);
    }
  }
  
  return validData;
}

// Database cleanup and reset functions
export async function cleanupCorruptedData(): Promise<void> {
  console.log('Starting database cleanup...');
  
  try {
    // Clean up orders
    await getAllValidatedFromStore('orders', validateOrder);
    
    // Clean up tables  
    await getAllValidatedFromStore('tables', validateTable);
    
    // Clean up inventory
    await getAllValidatedFromStore('inventory', (item: any) => 
      item && typeof item.id === 'string' && typeof item.name === 'string'
    );
    
    console.log('Database cleanup completed');
  } catch (error) {
    console.error('Error during database cleanup:', error);
  }
}

export async function resetDatabase(): Promise<void> {
  console.log('Resetting database...');
  
  try {
    await clearStore('orders');
    await clearStore('tables');
    await clearStore('inventory');
    await clearStore('voiceCommands');
    await clearStore('metrics');
    
    console.log('Database reset completed');
  } catch (error) {
    console.error('Error resetting database:', error);
  }
}

// Specific helper functions
export async function getRecentVoiceCommands(limit: number = 50) {
  const db = await getDB();
  const tx = db.transaction('voiceCommands', 'readonly');
  const index = tx.store.index('timestamp');
  const commands = await index.getAll();
  return commands.slice(-limit).reverse(); // Get most recent first
}

export async function syncOfflineData(): Promise<void> {
  // This would sync with server when online
  // For demo purposes, we'll just log
  console.log('Syncing offline data...');
  
  try {
    const orders = await getAllFromStore('orders');
    const tables = await getAllFromStore('tables');
    const inventory = await getAllFromStore('inventory');
    
    // In a real app, you'd send this data to your server
    console.log('Offline data to sync:', { orders, tables, inventory });
  } catch (error) {
    console.error('Error syncing offline data:', error);
  }
}