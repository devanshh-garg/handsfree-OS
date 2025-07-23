'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Users,
  ClipboardList,
  Search,
  X,
  Clock,
  ShoppingCart,
  User
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { VoiceButton, InlineVoiceButton } from '@/components/voice/VoiceButton';
import { QuickVoiceStatus } from '@/components/voice/VoiceStatus';
import { useOrderStore } from '@/stores/orderStore';
import { useTableStore } from '@/stores/tableStore';
import { useRealTimeUpdates } from '@/hooks/useRealTime';
import { formatCurrency, formatTime, cn, generateId, safeGetTableNumber, safeGetTableDisplayName, isValidOrder, sanitizeOrderForDisplay } from '@/lib/utils';
import { mockMenuItems } from '@/lib/mockData';
import { Order, OrderItem, MenuItem, Table } from '@/types';

export default function WaiterPage() {
  const { orders, addOrder, updateOrderStatus, loadOrders } = useOrderStore();
  const { tables, updateTableStatus, loadTables } = useTableStore();
  const [activeTab, setActiveTab] = useState<'tables' | 'orders' | 'menu'>('tables');
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [currentOrder, setCurrentOrder] = useState<OrderItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Enable real-time updates
  useRealTimeUpdates();

  useEffect(() => {
    loadOrders();
    loadTables();
  }, [loadOrders, loadTables]);

  const myOrders = orders
    .filter(order => isValidOrder(order))
    .filter(order => order.waiterName === 'Current Waiter' || order.waiterName === 'Ramesh')
    .map(order => sanitizeOrderForDisplay(order));

  const availableTables = tables.filter(table => table.status === 'available');
  const myTables = tables.filter(table => table.waiter === 'Ramesh');

  const filteredMenu = mockMenuItems.filter(item =>
    searchQuery === '' ||
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.nameHindi.includes(searchQuery)
  );

  const addToOrder = (menuItem: MenuItem, quantity: number = 1) => {
    const existingItem = currentOrder.find(item => item.menuItemId === menuItem.id);
    
    if (existingItem) {
      setCurrentOrder(prev => prev.map(item =>
        item.menuItemId === menuItem.id
          ? { ...item, quantity: item.quantity + quantity }
          : item
      ));
    } else {
      const newItem: OrderItem = {
        id: generateId('item-'),
        menuItemId: menuItem.id,
        menuItem,
        quantity,
        customizations: [],
        status: 'pending'
      };
      setCurrentOrder(prev => [...prev, newItem]);
    }
  };

  const removeFromOrder = (itemId: string) => {
    setCurrentOrder(prev => prev.filter(item => item.id !== itemId));
  };

  const submitOrder = () => {
    if (!selectedTable || currentOrder.length === 0) return;

    const order: Order = {
      id: generateId('order-'),
      tableId: selectedTable.id,
      items: currentOrder,
      status: 'pending',
      totalAmount: currentOrder.reduce((sum, item) => sum + (item.menuItem.price * item.quantity), 0),
      orderTime: new Date(),
      customerName: customerName || undefined,
      waiterName: 'Ramesh'
    };

    addOrder(order);
    updateTableStatus(selectedTable.id, 'occupied');
    
    // Reset form
    setCurrentOrder([]);
    setCustomerName('');
    setSelectedTable(null);
    setShowNewOrderModal(false);
    setActiveTab('orders');
  };

  const orderTotal = currentOrder.reduce((sum, item) => sum + (item.menuItem.price * item.quantity), 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <div className="sticky top-0 z-50 bg-background-secondary/90 backdrop-blur-sm border-b border-glass-border">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-saffron/20 rounded-lg flex items-center justify-center">
                <User className="w-5 h-5 text-saffron" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground">Waiter App</h1>
                <p className="text-xs text-foreground-muted font-devanagari">वेटर ऐप</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <QuickVoiceStatus />
              <VoiceButton size="sm" />
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="grid grid-cols-3 gap-1 bg-background rounded-lg p-1">
            {[
              { key: 'tables', label: 'Tables', labelHindi: 'टेबल', icon: Users },
              { key: 'orders', label: 'Orders', labelHindi: 'ऑर्डर', icon: ClipboardList },
              { key: 'menu', label: 'Menu', labelHindi: 'मेन्यू', icon: ShoppingCart }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={cn(
                  'flex flex-col items-center py-2 px-3 rounded-lg transition-all text-xs',
                  activeTab === tab.key
                    ? 'bg-saffron text-white shadow-lg'
                    : 'text-foreground-muted hover:text-foreground hover:bg-background-tertiary'
                )}
              >
                <tab.icon className="w-4 h-4 mb-1" />
                <span className="font-medium">{tab.label}</span>
                <span className="font-devanagari text-xs opacity-75">{tab.labelHindi}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4">
        <AnimatePresence mode="wait">
          {activeTab === 'tables' && (
            <TablesView
              tables={myTables}
              availableTables={availableTables}
              onTableSelect={(table) => {
                setSelectedTable(table);
                setShowNewOrderModal(true);
              }}
              onTableStatusChange={updateTableStatus}
              key="tables"
            />
          )}

          {activeTab === 'orders' && (
            <OrdersView
              orders={myOrders}
              onOrderStatusChange={updateOrderStatus}
              key="orders"
            />
          )}

          {activeTab === 'menu' && (
            <MenuView
              menuItems={filteredMenu}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onAddToOrder={addToOrder}
              key="menu"
            />
          )}
        </AnimatePresence>
      </div>

      {/* New Order Modal */}
      <AnimatePresence>
        {showNewOrderModal && selectedTable && (
          <NewOrderModal
            table={selectedTable}
            currentOrder={currentOrder}
            customerName={customerName}
            orderTotal={orderTotal}
            onCustomerNameChange={setCustomerName}
            onAddToOrder={addToOrder}
            onRemoveFromOrder={removeFromOrder}
            onSubmitOrder={submitOrder}
            onClose={() => {
              setShowNewOrderModal(false);
              setSelectedTable(null);
              setCurrentOrder([]);
              setCustomerName('');
            }}
          />
        )}
      </AnimatePresence>

      {/* Floating Action Button */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setActiveTab('menu')}
        className="fixed bottom-6 right-6 w-14 h-14 bg-saffron hover:bg-saffron-dark text-white rounded-full shadow-lg flex items-center justify-center z-40"
      >
        <Plus className="w-6 h-6" />
      </motion.button>
    </div>
  );
}

function TablesView({ 
  tables, 
  availableTables, 
  onTableSelect, 
  onTableStatusChange 
}: {
  tables: Table[];
  availableTables: Table[];
  onTableSelect: (table: Table) => void;
  onTableStatusChange: (tableId: string, status: Table['status']) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      {/* My Tables */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
          <Users className="w-5 h-5 text-saffron" />
          My Tables
          <span className="text-sm font-normal text-foreground-muted font-devanagari">
            मेरी टेबल
          </span>
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {tables.map((table) => (
            <TableCard
              key={table.id}
              table={table}
              onStatusChange={onTableStatusChange}
              onSelect={() => onTableSelect(table)}
            />
          ))}
        </div>
      </div>

      {/* Available Tables */}
      {availableTables.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-3">
            Available Tables
            <span className="text-sm font-normal text-foreground-muted font-devanagari ml-2">
              उपलब्ध टेबल
            </span>
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {availableTables.map((table) => (
              <TableCard
                key={table.id}
                table={table}
                onStatusChange={onTableStatusChange}
                onSelect={() => onTableSelect(table)}
                isAvailable
              />
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

function TableCard({ 
  table, 
  onStatusChange, 
  onSelect, 
  isAvailable = false 
}: {
  table: Table;
  onStatusChange: (tableId: string, status: Table['status']) => void;
  onSelect: () => void;
  isAvailable?: boolean;
}) {
  const statusColors = {
    available: 'border-emerald bg-emerald/5 text-emerald',
    occupied: 'border-saffron bg-saffron/5 text-saffron',
    reserved: 'border-gold bg-gold/5 text-gold',
    cleaning: 'border-foreground-muted bg-foreground-muted/5 text-foreground-muted'
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        'border-2 rounded-lg p-4 cursor-pointer transition-all',
        statusColors[table.status],
        isAvailable && 'opacity-75'
      )}
      onClick={onSelect}
    >
      <div className="text-center">
        <div className="text-2xl font-bold mb-1">
          {table.number}
        </div>
        <div className="text-sm mb-2">
          {table.capacity} seats
        </div>
        <div className="text-xs capitalize font-medium mb-2">
          {table.status}
        </div>
        {!isAvailable && (
          <div className="text-xs opacity-75">
            {table.waiter}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function OrdersView({ 
  orders, 
  onOrderStatusChange 
}: {
  orders: Order[];
  onOrderStatusChange: (orderId: string, status: any) => void;
}) {
  const activeOrders = orders.filter(o => !['completed', 'cancelled'].includes(o.status));
  const completedOrders = orders.filter(o => ['completed'].includes(o.status));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      {/* Active Orders */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
          <Clock className="w-5 h-5 text-saffron" />
          Active Orders ({activeOrders.length})
        </h2>
        <div className="space-y-3">
          {activeOrders.length === 0 ? (
            <div className="text-center py-8 text-foreground-muted">
              <ClipboardList className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No active orders</p>
            </div>
          ) : (
            activeOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onStatusChange={onOrderStatusChange}
              />
            ))
          )}
        </div>
      </div>

      {/* Completed Orders */}
      {completedOrders.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-3">
            Completed Today ({completedOrders.length})
          </h2>
          <div className="space-y-3">
            {completedOrders.slice(0, 3).map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onStatusChange={onOrderStatusChange}
                isCompleted
              />
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

function OrderCard({ 
  order, 
  onStatusChange, 
  isCompleted = false 
}: {
  order: Order;
  onStatusChange: (orderId: string, status: any) => void;
  isCompleted?: boolean;
}) {
  const statusColors = {
    pending: 'bg-foreground-muted/20 text-foreground-muted',
    confirmed: 'bg-emerald/20 text-emerald',
    preparing: 'bg-saffron/20 text-saffron',
    ready: 'bg-emerald/20 text-emerald',
    served: 'bg-emerald/20 text-emerald',
    completed: 'bg-emerald/20 text-emerald'
  };

  return (
    <Card className={cn('p-4', isCompleted && 'opacity-75')}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-saffron/20 rounded-lg flex items-center justify-center">
            <span className="text-saffron font-semibold">
              {safeGetTableNumber(order.tableId)}
            </span>
          </div>
          <div>
            <div className="font-semibold text-foreground">
              {safeGetTableDisplayName(order.tableId, order.customerName)}
            </div>
            <div className="text-sm text-foreground-muted">
              {order.items.length} items • {formatTime(new Date(order.orderTime))}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-semibold text-foreground">
            {formatCurrency(order.totalAmount)}
          </div>
          <div className={cn(
            'text-xs px-2 py-1 rounded-full',
            statusColors[order.status as keyof typeof statusColors]
          )}>
            {order.status}
          </div>
        </div>
      </div>

      <div className="space-y-2 mb-3">
        {order.items.slice(0, 3).map((item) => (
          <div key={item.id} className="flex justify-between text-sm">
            <span className="text-foreground">
              {item.quantity}x {item.menuItem.name}
            </span>
            <span className="text-foreground-muted">
              {formatCurrency(item.menuItem.price * item.quantity)}
            </span>
          </div>
        ))}
        {order.items.length > 3 && (
          <div className="text-xs text-foreground-muted">
            +{order.items.length - 3} more items
          </div>
        )}
      </div>

      {!isCompleted && (
        <div className="flex gap-2">
          {order.status === 'ready' && (
            <button
              onClick={() => onStatusChange(order.id, 'served')}
              className="flex-1 bg-emerald text-white px-3 py-2 rounded-lg text-sm font-medium"
            >
              Mark Served
            </button>
          )}
          {order.status === 'served' && (
            <button
              onClick={() => onStatusChange(order.id, 'completed')}
              className="flex-1 bg-emerald text-white px-3 py-2 rounded-lg text-sm font-medium"
            >
              Complete Order
            </button>
          )}
        </div>
      )}
    </Card>
  );
}

function MenuView({ 
  menuItems, 
  searchQuery, 
  onSearchChange, 
  onAddToOrder 
}: {
  menuItems: MenuItem[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onAddToOrder: (item: MenuItem, quantity: number) => void;
}) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  const categories = ['all', ...Array.from(new Set(menuItems.map(item => item.category)))];
  
  const filteredItems = selectedCategory === 'all' 
    ? menuItems 
    : menuItems.filter(item => item.category === selectedCategory);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-4"
    >
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-foreground-muted" />
        <input
          type="text"
          placeholder="Search menu items... | मेन्यू खोजें..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-background-secondary rounded-lg border border-glass-border text-sm focus:outline-none focus:border-saffron"
        />
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
              selectedCategory === category
                ? 'bg-saffron text-white'
                : 'bg-background-secondary text-foreground-muted hover:text-foreground'
            )}
          >
            {category === 'all' ? 'All' : category.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </button>
        ))}
      </div>

      {/* Menu Items */}
      <div className="space-y-3">
        {filteredItems.map((item) => (
          <MenuItemCard
            key={item.id}
            item={item}
            onAddToOrder={onAddToOrder}
          />
        ))}
      </div>
    </motion.div>
  );
}

function MenuItemCard({ 
  item, 
  onAddToOrder 
}: {
  item: MenuItem;
  onAddToOrder: (item: MenuItem, quantity: number) => void;
}) {
  const [quantity, setQuantity] = useState(1);

  return (
    <Card className="p-4">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <div className="font-semibold text-foreground mb-1">
            {item.name}
          </div>
          <div className="text-sm text-foreground-muted font-devanagari mb-2">
            {item.nameHindi}
          </div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg font-bold text-saffron">
              {formatCurrency(item.price)}
            </span>
            {item.isVeg && (
              <div className="w-4 h-4 border-2 border-emerald rounded flex items-center justify-center">
                <div className="w-2 h-2 bg-emerald rounded-full" />
              </div>
            )}
            {item.isJain && (
              <span className="text-xs bg-gold/20 text-gold px-2 py-1 rounded">
                Jain
              </span>
            )}
          </div>
          <div className="text-xs text-foreground-muted">
            {item.preparationTime}min • {item.spiceLevel}
          </div>
        </div>
        
        <div className="text-right">
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="w-8 h-8 bg-background-secondary rounded-full flex items-center justify-center"
            >
              -
            </button>
            <span className="w-8 text-center font-medium">{quantity}</span>
            <button
              onClick={() => setQuantity(quantity + 1)}
              className="w-8 h-8 bg-background-secondary rounded-full flex items-center justify-center"
            >
              +
            </button>
          </div>
          <button
            onClick={() => onAddToOrder(item, quantity)}
            disabled={!item.isAvailable}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              item.isAvailable
                ? 'bg-saffron text-white hover:bg-saffron-dark'
                : 'bg-foreground-muted/20 text-foreground-muted cursor-not-allowed'
            )}
          >
            {item.isAvailable ? 'Add' : 'Unavailable'}
          </button>
        </div>
      </div>
    </Card>
  );
}

function NewOrderModal({
  table,
  currentOrder,
  customerName,
  orderTotal,
  onCustomerNameChange,
  onAddToOrder,
  onRemoveFromOrder,
  onSubmitOrder,
  onClose
}: {
  table: Table;
  currentOrder: OrderItem[];
  customerName: string;
  orderTotal: number;
  onCustomerNameChange: (name: string) => void;
  onAddToOrder: (item: MenuItem, quantity: number) => void;
  onRemoveFromOrder: (itemId: string) => void;
  onSubmitOrder: () => void;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 z-50 flex items-end"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        className="w-full bg-background rounded-t-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-foreground">
                New Order - Table {table.number}
              </h2>
              <p className="text-foreground-muted font-devanagari">
                नया ऑर्डर
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 bg-foreground-muted/20 rounded-full flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Customer Name */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-foreground mb-2">
              Customer Name (Optional)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={customerName}
                onChange={(e) => onCustomerNameChange(e.target.value)}
                placeholder="Enter customer name..."
                className="flex-1 px-4 py-3 bg-background-secondary rounded-lg border border-glass-border focus:outline-none focus:border-saffron"
              />
              <InlineVoiceButton className="p-3" />
            </div>
          </div>

          {/* Order Items */}
          <div className="mb-6">
            <h3 className="font-semibold text-foreground mb-3">
              Order Items ({currentOrder.length})
            </h3>
            {currentOrder.length === 0 ? (
              <div className="text-center py-8 text-foreground-muted">
                <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No items added yet</p>
                <p className="text-sm">Go to Menu tab to add items</p>
              </div>
            ) : (
              <div className="space-y-3">
                {currentOrder.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-background-secondary rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium text-foreground">
                        {item.quantity}x {item.menuItem.name}
                      </div>
                      <div className="text-sm text-foreground-muted">
                        {formatCurrency(item.menuItem.price)} each
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">
                        {formatCurrency(item.menuItem.price * item.quantity)}
                      </span>
                      <button
                        onClick={() => onRemoveFromOrder(item.id)}
                        className="w-8 h-8 bg-crimson/20 hover:bg-crimson/30 text-crimson rounded-full flex items-center justify-center"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Order Summary */}
          {currentOrder.length > 0 && (
            <div className="border-t border-glass-border pt-4 mb-6">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold text-foreground">
                  Total Amount
                </span>
                <span className="text-xl font-bold text-saffron">
                  {formatCurrency(orderTotal)}
                </span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-background-secondary text-foreground rounded-lg font-medium"
            >
              Cancel
            </button>
            <button
              onClick={onSubmitOrder}
              disabled={currentOrder.length === 0}
              className={cn(
                'flex-1 px-6 py-3 rounded-lg font-medium transition-colors',
                currentOrder.length > 0
                  ? 'bg-saffron text-white hover:bg-saffron-dark'
                  : 'bg-foreground-muted/20 text-foreground-muted cursor-not-allowed'
              )}
            >
              Submit Order
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}