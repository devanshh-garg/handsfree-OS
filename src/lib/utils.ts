import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = '₹'): string {
  return `${currency}${amount.toLocaleString('en-IN')}`;
}

export function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }).format(date);
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(date);
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function getStatusColor(status: string): string {
  const statusColors: Record<string, string> = {
    // Order statuses
    pending: 'text-gold bg-gold/10 border-gold/20',
    confirmed: 'text-emerald bg-emerald/10 border-emerald/20',
    preparing: 'text-saffron bg-saffron/10 border-saffron/20',
    ready: 'text-emerald-light bg-emerald-light/10 border-emerald-light/20',
    served: 'text-emerald-dark bg-emerald-dark/10 border-emerald-dark/20',
    completed: 'text-emerald bg-emerald/10 border-emerald/20',
    cancelled: 'text-crimson bg-crimson/10 border-crimson/20',
    
    // Table statuses
    available: 'text-emerald bg-emerald/10 border-emerald/20',
    occupied: 'text-saffron bg-saffron/10 border-saffron/20',
    reserved: 'text-gold bg-gold/10 border-gold/20',
    cleaning: 'text-foreground-muted bg-foreground-muted/10 border-foreground-muted/20',
    
    // Inventory statuses
    in_stock: 'text-emerald bg-emerald/10 border-emerald/20',
    low_stock: 'text-saffron bg-saffron/10 border-saffron/20',
    out_of_stock: 'text-crimson bg-crimson/10 border-crimson/20',
    expiring: 'text-gold bg-gold/10 border-gold/20',
    expired: 'text-crimson bg-crimson/10 border-crimson/20'
  };
  
  return statusColors[status] || 'text-foreground-muted bg-foreground-muted/10 border-foreground-muted/20';
}

export function getSpiceLevelColor(level: 'mild' | 'medium' | 'spicy' | 'very-spicy'): string {
  const spiceColors: Record<string, string> = {
    mild: 'text-emerald',
    medium: 'text-saffron',
    spicy: 'text-gold',
    'very-spicy': 'text-crimson'
  };
  
  return spiceColors[level] || 'text-foreground-muted';
}

export function generateId(prefix = ''): string {
  return `${prefix}${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(null, args), wait);
  };
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func.apply(null, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

export function calculateOrderTime(orderTime: Date, preparationTimes: number[]): Date {
  const totalPrepTime = Math.max(...preparationTimes, 10); // Minimum 10 minutes
  const estimatedTime = new Date(orderTime);
  estimatedTime.setMinutes(estimatedTime.getMinutes() + totalPrepTime);
  return estimatedTime;
}

export function getTableUtilization(tables: any[]): number {
  if (!tables.length) return 0;
  const occupiedCount = tables.filter(t => t.status === 'occupied').length;
  return Math.round((occupiedCount / tables.length) * 100);
}

export function generateQRCodeData(tableNumber: number, restaurantId: string): string {
  return JSON.stringify({
    restaurantId,
    tableNumber,
    timestamp: Date.now(),
    type: 'menu'
  });
}

export function parseVoiceConfidence(confidence: number): 'low' | 'medium' | 'high' {
  if (confidence >= 0.8) return 'high';
  if (confidence >= 0.6) return 'medium';
  return 'low';
}

export function getLanguageFlag(language: 'hindi' | 'english' | 'mixed'): string {
  const flags: Record<string, string> = {
    hindi: '🇮🇳',
    english: '🇺🇸',
    mixed: '🌐'
  };
  return flags[language] || '🌐';
}

// Safe utility functions for handling potentially corrupted data
export function safeGetTableNumber(tableId: string | null | undefined): string {
  if (!tableId || typeof tableId !== 'string') {
    console.warn('Invalid tableId provided:', tableId);
    return 'Unknown';
  }
  
  try {
    const parts = tableId.split('-');
    return parts.length > 1 ? parts[1] : tableId;
  } catch (error) {
    console.error('Error parsing tableId:', tableId, error);
    return 'Error';
  }
}

export function safeGetTableDisplayName(tableId: string | null | undefined, customerName?: string): string {
  const tableNumber = safeGetTableNumber(tableId);
  
  if (customerName) {
    return customerName;
  }
  
  return tableNumber === 'Unknown' || tableNumber === 'Error' 
    ? 'Invalid Order' 
    : `Table ${tableNumber}`;
}

// Validate order data at runtime
export function isValidOrder(order: any): order is { id: string; tableId: string; items: any[]; status: string; totalAmount: number } {
  return !!(
    order &&
    typeof order.id === 'string' &&
    typeof order.tableId === 'string' &&
    Array.isArray(order.items) &&
    typeof order.status === 'string' &&
    typeof order.totalAmount === 'number'
  );
}

// Safe utility to handle corrupted orders
export function sanitizeOrderForDisplay(order: any): any {
  if (!order || typeof order !== 'object') {
    return {
      id: 'invalid-order',
      tableId: 'unknown',
      items: [],
      status: 'error',
      totalAmount: 0,
      orderTime: new Date(),
      waiterName: 'Unknown'
    };
  }

  return {
    ...order,
    tableId: order.tableId || 'unknown',
    items: Array.isArray(order.items) ? order.items : [],
    status: order.status || 'error',
    totalAmount: typeof order.totalAmount === 'number' ? order.totalAmount : 0,
    orderTime: order.orderTime instanceof Date ? order.orderTime : new Date(),
    waiterName: order.waiterName || 'Unknown'
  };
}