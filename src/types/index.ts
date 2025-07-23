// Core Restaurant Types
export interface Restaurant {
  id: string;
  name: string;
  nameHindi: string;
  address: string;
  phone: string;
  tables: Table[];
  menu: MenuItem[];
}

export interface Table {
  id: string;
  number: number;
  capacity: number;
  status: 'available' | 'occupied' | 'reserved' | 'cleaning';
  currentOrder?: Order;
  waiter?: string;
}

export interface MenuItem {
  id: string;
  name: string;
  nameHindi: string;
  description: string;
  descriptionHindi: string;
  price: number;
  category: MenuCategory;
  tags: string[];
  isVeg: boolean;
  isJain: boolean;
  spiceLevel: 'mild' | 'medium' | 'spicy' | 'very-spicy';
  preparationTime: number; // in minutes
  ingredients: string[];
  image?: string;
  isAvailable: boolean;
}

export type MenuCategory = 
  | 'starters' 
  | 'main-course' 
  | 'rice-breads' 
  | 'beverages' 
  | 'desserts' 
  | 'specials';

export interface Order {
  id: string;
  tableId: string;
  items: OrderItem[];
  status: OrderStatus;
  totalAmount: number;
  orderTime: Date;
  estimatedCompletionTime?: Date;
  specialInstructions?: string;
  customerName?: string;
  waiterName: string;
  kitchenNotes?: string;
  isOptimistic?: boolean;
}

export interface OrderItem {
  id: string;
  menuItemId: string;
  menuItem: MenuItem;
  quantity: number;
  customizations: string[];
  status: ItemStatus;
  notes?: string;
}

export type OrderStatus = 
  | 'pending' 
  | 'confirmed' 
  | 'preparing' 
  | 'ready' 
  | 'served' 
  | 'completed' 
  | 'cancelled';

export type ItemStatus = 
  | 'pending' 
  | 'preparing' 
  | 'ready' 
  | 'served';

// Voice System Types
export interface VoiceCommand {
  id: string;
  command: string;
  language: 'hindi' | 'english' | 'mixed';
  confidence: number;
  timestamp: Date;
  action: VoiceAction;
  parameters: Record<string, any>;
  success: boolean;
  response?: string;
}

export interface VoiceAction {
  type: 'order' | 'table' | 'inventory' | 'navigation' | 'query';
  subtype: string;
  target?: string;
}

export interface VoiceState {
  isListening: boolean;
  isProcessing: boolean;
  currentCommand?: string;
  lastResponse?: string;
  error?: string | null;
  history: VoiceCommand[];
}

// Real-time Events
export interface SocketEvent {
  type: 'order:created' | 'order:updated' | 'order:completed' | 
        'inventory:alert' | 'table:statusChanged' | 
        'metric:updated' | 'notification:new';
  payload: any;
  timestamp: Date;
  userId?: string;
}

// Analytics & Metrics
export interface RestaurantMetrics {
  dailyRevenue: number;
  ordersCompleted: number;
  avgOrderTime: number;
  popularItems: MenuItem[];
  tableUtilization: number;
  customerSatisfaction: number;
  timestamp: Date;
}

// Inventory
export interface InventoryItem {
  id: string;
  name: string;
  nameHindi: string;
  quantity: number;
  unit: string;
  minThreshold: number;
  supplier: string;
  lastRestocked: Date;
  expiryDate?: Date;
}

// User Roles
export interface User {
  id: string;
  name: string;
  role: 'owner' | 'manager' | 'waiter' | 'chef' | 'cashier';
  isActive: boolean;
  lastActive: Date;
}

// UI State Types
export interface UIState {
  theme: 'dark' | 'light';
  language: 'hindi' | 'english';
  currentPage: string;
  sidebarOpen: boolean;
  notifications: Notification[];
}

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  isRead: boolean;
  action?: {
    label: string;
    callback: () => void;
  };
}

// Component Props Types
export interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
}

export interface VoiceButtonProps extends BaseComponentProps {
  onCommand: (command: VoiceCommand) => void;
  isActive?: boolean;
  language?: 'hindi' | 'english' | 'mixed';
}

export interface OrderCardProps extends BaseComponentProps {
  order: Order;
  onStatusChange: (orderId: string, status: OrderStatus) => void;
  showActions?: boolean;
}

export interface MenuItemCardProps extends BaseComponentProps {
  item: MenuItem;
  onAddToOrder?: (item: MenuItem, quantity: number) => void;
  showPrice?: boolean;
}