'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChefHat,
  CheckCircle,
  AlertCircle,
  Timer,
  Flame,
  Users,
  MessageSquare
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { VoiceButton } from '@/components/voice/VoiceButton';
import { VoiceWaveform } from '@/components/voice/VoiceWaveform';
import { QuickVoiceStatus } from '@/components/voice/VoiceStatus';
import { useOrderStore } from '@/stores/orderStore';
import { useRealTimeUpdates } from '@/hooks/useRealTime';
import { formatTime, formatCurrency, cn, safeGetTableNumber, safeGetTableDisplayName, isValidOrder, sanitizeOrderForDisplay } from '@/lib/utils';
import { Order, ItemStatus } from '@/types';

export default function KitchenPage() {
  const { orders, updateOrderStatus, updateItemStatus, loadOrders } = useOrderStore();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Enable real-time updates
  useRealTimeUpdates();

  useEffect(() => {
    loadOrders();
    
    // Update current time every minute
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(timer);
  }, [loadOrders]);

  // Filter orders for kitchen display with validation
  const activeOrders = orders
    .filter(order => isValidOrder(order))
    .filter(order => ['pending', 'confirmed', 'preparing'].includes(order.status))
    .map(order => sanitizeOrderForDisplay(order));

  const readyOrders = orders
    .filter(order => isValidOrder(order))
    .filter(order => order.status === 'ready')
    .map(order => sanitizeOrderForDisplay(order));

  const getOrderPriority = (order: Order): 'high' | 'medium' | 'low' => {
    const orderTime = new Date(order.orderTime);
    const minutesAgo = Math.floor((currentTime.getTime() - orderTime.getTime()) / (1000 * 60));
    
    if (minutesAgo > 30) return 'high';
    if (minutesAgo > 15) return 'medium';
    return 'low';
  };


  const handleMarkReady = (orderId: string) => {
    updateOrderStatus(orderId, 'ready');
  };

  const handleStartCooking = (orderId: string) => {
    updateOrderStatus(orderId, 'preparing');
  };

  const handleItemStatusChange = (orderId: string, itemId: string, status: ItemStatus) => {
    updateItemStatus(orderId, itemId, status);
  };

  return (
    <div className="min-h-screen bg-background pattern-bg">
      {/* Header */}
      <div className="border-b border-glass-border bg-background-secondary/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-saffron/20 rounded-lg flex items-center justify-center">
                <ChefHat className="w-6 h-6 text-saffron" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  Kitchen Display
                </h1>
                <p className="text-foreground-muted font-devanagari">
                  किचन डिस्प्ले सिस्टम
                </p>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <QuickVoiceStatus />
              
              <div className="text-right">
                <div className="text-sm text-foreground-muted">Current Time</div>
                <div className="text-lg font-semibold text-foreground">
                  {formatTime(currentTime)}
                </div>
              </div>

              <VoiceButton size="md" />
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        {/* Kitchen Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-lg p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <Timer className="w-5 h-5 text-saffron" />
              <span className="font-medium text-foreground-muted">Active Orders</span>
            </div>
            <div className="text-2xl font-bold text-saffron">
              {activeOrders.length}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass rounded-lg p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-5 h-5 text-emerald" />
              <span className="font-medium text-foreground-muted">Ready</span>
            </div>
            <div className="text-2xl font-bold text-emerald">
              {readyOrders.length}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass rounded-lg p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <Flame className="w-5 h-5 text-crimson" />
              <span className="font-medium text-foreground-muted">High Priority</span>
            </div>
            <div className="text-2xl font-bold text-crimson">
              {activeOrders.filter(o => getOrderPriority(o) === 'high').length}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass rounded-lg p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 text-gold" />
              <span className="font-medium text-foreground-muted">Avg Wait</span>
            </div>
            <div className="text-2xl font-bold text-gold">
              18m
            </div>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Active Orders Column */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Timer className="w-5 h-5 text-saffron" />
                  Active Orders
                  <span className="text-sm font-normal text-foreground-muted font-devanagari">
                    एक्टिव ऑर्डर
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-[800px] overflow-y-auto">
                  <AnimatePresence>
                    {activeOrders.length === 0 ? (
                      <div className="text-center py-12 text-foreground-muted">
                        <ChefHat className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No active orders</p>
                        <p className="text-sm font-devanagari">कोई एक्टिव ऑर्डर नहीं</p>
                      </div>
                    ) : (
                      activeOrders
                        .sort((a, b) => {
                          const priorityOrder = { high: 3, medium: 2, low: 1 };
                          return priorityOrder[getOrderPriority(b)] - priorityOrder[getOrderPriority(a)];
                        })
                        .map((order, index) => (
                          <KitchenOrderCard
                            key={order.id}
                            order={order}
                            priority={getOrderPriority(order)}
                            currentTime={currentTime}
                            onMarkReady={() => handleMarkReady(order.id)}
                            onStartCooking={() => handleStartCooking(order.id)}
                            onItemStatusChange={handleItemStatusChange}
                            onSelect={() => setSelectedOrder(order)}
                            isSelected={selectedOrder?.id === order.id}
                            index={index}
                          />
                        ))
                    )}
                  </AnimatePresence>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Ready Orders & Voice Commands */}
          <div className="space-y-8">
            {/* Ready Orders */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-emerald" />
                  Ready for Pickup
                  <span className="text-sm font-normal text-foreground-muted font-devanagari">
                    पिकअप रेडी
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {readyOrders.length === 0 ? (
                    <div className="text-center py-8 text-foreground-muted">
                      <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>No orders ready</p>
                    </div>
                  ) : (
                    readyOrders.map((order) => (
                      <motion.div
                        key={order.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="p-4 bg-emerald/10 border border-emerald/30 rounded-lg"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold text-emerald">
                              Table {safeGetTableNumber(order.tableId)}
                            </div>
                            <div className="text-sm text-foreground-muted">
                              {order.customerName} • {order.items.length} items
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-medium text-emerald">
                              Ready
                            </div>
                            <div className="text-xs text-foreground-muted">
                              {formatTime(order.estimatedCompletionTime || new Date())}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Voice Commands Panel */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-gold" />
                  Voice Commands
                  <span className="text-sm font-normal text-foreground-muted font-devanagari">
                    आवाज़ कमांड
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-center">
                    <VoiceWaveform />
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="p-3 bg-background-secondary rounded-lg">
                      <div className="font-medium text-foreground mb-1">Common Commands:</div>
                      <div className="space-y-1 text-foreground-muted">
                        <div>• &quot;Table 5 ready hai&quot;</div>
                        <div>• &quot;Dal makhani preparing&quot;</div>
                        <div>• &quot;Paneer tikka complete&quot;</div>
                        <div>• &quot;Table 3 ka order start karo&quot;</div>
                      </div>
                    </div>
                    
                    <div className="p-3 bg-background-secondary rounded-lg">
                      <div className="font-medium text-foreground mb-1 font-devanagari">हिंदी कमांड:</div>
                      <div className="space-y-1 text-foreground-muted font-devanagari">
                        <div>• &quot;टेबल ५ का खाना तैयार है&quot;</div>
                        <div>• &quot;दाल मखनी बन रहा है&quot;</div>
                        <div>• &quot;पनीर टिक्का पूरा हो गया&quot;</div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

interface KitchenOrderCardProps {
  order: Order;
  priority: 'high' | 'medium' | 'low';
  currentTime: Date;
  onMarkReady: () => void;
  onStartCooking: () => void;
  onItemStatusChange: (orderId: string, itemId: string, status: ItemStatus) => void;
  onSelect: () => void;
  isSelected: boolean;
  index: number;
}

function KitchenOrderCard({
  order,
  priority,
  currentTime,
  onMarkReady,
  onStartCooking,
  onItemStatusChange,
  onSelect,
  isSelected,
  index
}: KitchenOrderCardProps) {
  const orderTime = new Date(order.orderTime);
  const minutesAgo = Math.floor((currentTime.getTime() - orderTime.getTime()) / (1000 * 60));
  
  const priorityColors = {
    high: 'border-crimson bg-crimson/5',
    medium: 'border-saffron bg-saffron/5',
    low: 'border-emerald bg-emerald/5'
  };

  const statusColors = {
    pending: 'bg-foreground-muted/20 text-foreground-muted',
    preparing: 'bg-saffron/20 text-saffron',
    ready: 'bg-emerald/20 text-emerald',
    served: 'bg-emerald/20 text-emerald'
  };

  const groupedItems = getItemsGroupedByType(order);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className={cn(
        'border-2 rounded-lg p-4 cursor-pointer transition-all',
        priorityColors[priority],
        isSelected && 'ring-2 ring-saffron shadow-lg'
      )}
      onClick={onSelect}
    >
      {/* Order Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-saffron/20 rounded-lg flex items-center justify-center">
            <span className="text-saffron font-bold text-lg">
              {safeGetTableNumber(order.tableId)}
            </span>
          </div>
          <div>
            <div className="font-semibold text-foreground">
              {safeGetTableDisplayName(order.tableId, order.customerName)}
            </div>
            <div className="text-sm text-foreground-muted">
              {minutesAgo}m ago • {order.items.length} items • {formatCurrency(order.totalAmount)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {priority === 'high' && (
            <AlertCircle className="w-5 h-5 text-crimson" />
          )}
          <div className={cn(
            'px-2 py-1 rounded-full text-xs font-medium',
            statusColors[order.status as keyof typeof statusColors]
          )}>
            {order.status}
          </div>
        </div>
      </div>

      {/* Order Items */}
      <div className="space-y-3 mb-4">
        {Object.entries(groupedItems).map(([category, items]) => (
          <div key={category} className="bg-background-secondary rounded-lg p-3">
            <div className="text-sm font-medium text-foreground-muted mb-2 capitalize">
              {category.replace('-', ' ')}
            </div>
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-foreground font-medium">
                      {item.quantity}x {item.menuItem.name}
                    </span>
                    {item.customizations.length > 0 && (
                      <span className="text-xs text-saffron">
                        ({item.customizations.join(', ')})
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={item.status}
                      onChange={(e) => onItemStatusChange(order.id, item.id, e.target.value as ItemStatus)}
                      className="text-xs bg-background border border-glass-border rounded px-2 py-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option value="pending">Pending</option>
                      <option value="preparing">Preparing</option>
                      <option value="ready">Ready</option>
                      <option value="served">Served</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Special Instructions */}
      {order.specialInstructions && (
        <div className="mb-4 p-3 bg-gold/10 border border-gold/30 rounded-lg">
          <div className="text-sm font-medium text-gold mb-1">Special Instructions:</div>
          <div className="text-sm text-foreground">{order.specialInstructions}</div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        {order.status === 'pending' && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={(e) => {
              e.stopPropagation();
              onStartCooking();
            }}
            className="flex-1 bg-saffron hover:bg-saffron-dark text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            Start Cooking
          </motion.button>
        )}
        
        {order.status === 'preparing' && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={(e) => {
              e.stopPropagation();
              onMarkReady();
            }}
            className="flex-1 bg-emerald hover:bg-emerald-dark text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            Mark Ready
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

function getItemsGroupedByType(order: Order) {
  const grouped: { [key: string]: typeof order.items } = {};
  
  order.items.forEach(item => {
    const category = item.menuItem.category;
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(item);
  });

  return grouped;
}