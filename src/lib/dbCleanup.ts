// Database cleanup utilities
import { resetDatabase, cleanupCorruptedData } from './db';

// Auto-cleanup function that can be called on app startup
export async function performStartupCleanup(): Promise<void> {
  try {
    console.log('Performing startup database cleanup...');
    await cleanupCorruptedData();
    console.log('Startup cleanup completed successfully');
  } catch (error) {
    console.error('Startup cleanup failed:', error);
    // If cleanup fails, we might need a full reset
    console.log('Attempting full database reset...');
    try {
      await resetDatabase();
      console.log('Database reset completed');
    } catch (resetError) {
      console.error('Database reset failed:', resetError);
    }
  }
}

// Manual cleanup functions for debugging
export async function manualCleanup(): Promise<void> {
  console.log('Starting manual database cleanup...');
  await cleanupCorruptedData();
  console.log('Manual cleanup completed');
}

export async function manualReset(): Promise<void> {
  console.log('Starting manual database reset...');
  await resetDatabase();
  console.log('Manual reset completed');
}

// Add to window for debugging in browser console
if (typeof window !== 'undefined') {
  (window as any).dbCleanup = {
    cleanup: manualCleanup,
    reset: manualReset,
    startup: performStartupCleanup
  };
}