'use client';

import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  Users,
  ShoppingBag,
  AlertTriangle,
  Activity,
  DollarSign
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { MetricCard } from '@/components/ui/MetricCard';
import { VoiceButton } from '@/components/voice/VoiceButton';
import { VoiceStatus } from '@/components/voice/VoiceStatus';
import { VoiceHistory } from '@/components/voice/VoiceHistory';
import { useOrderStore } from '@/stores/orderStore';
import { useTableStore } from '@/stores/tableStore';
import { useInventoryStore } from '@/stores/inventoryStore';
import { useRealTimeUpdates } from '@/hooks/useRealTime';
import { formatCurrency, formatTime, safeGetTableNumber, safeGetTableDisplayName, isValidOrder, sanitizeOrderForDisplay } from '@/lib/utils';

export default function DashboardPage() {
  const { orders, loadOrders } = useOrderStore();
  const { tables, loadTables, getTableUtilization } = useTableStore();
  const { items: inventory, alerts, loadInventory } = useInventoryStore();
  
  // Enable real-time updates
  useRealTimeUpdates();

  useEffect(() => {
    loadOrders();
    loadTables();
    loadInventory();
  }, [loadOrders, loadTables, loadInventory]);

  // Calculate metrics
  const todayOrders = orders
    .filter(order => isValidOrder(order))
    .map(order => sanitizeOrderForDisplay(order))
    .filter(order => {
      const orderDate = new Date(order.orderTime);
      const today = new Date();
      return orderDate.toDateString() === today.toDateString();
    });

  const todayRevenue = todayOrders.reduce((sum, order) => sum + order.totalAmount, 0);
  const avgOrderValue = todayOrders.length > 0 ? todayRevenue / todayOrders.length : 0;
  const pendingOrders = orders.filter(o => ['pending', 'preparing'].includes(o.status)).length;
  const tableUtilization = getTableUtilization();
  
  // Get recent orders for display
  const recentOrders = [...orders]
    .sort((a, b) => new Date(b.orderTime).getTime() - new Date(a.orderTime).getTime())
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-background pattern-bg">
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8"
        >
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Dashboard
            </h1>
            <p className="text-foreground-muted font-devanagari text-lg">
              श्री गणेश भोजनालय - मालिक का केंद्र
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <VoiceStatus variant="compact" />
            <VoiceButton size="lg" />
          </div>
        </motion.div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <MetricCard
              title="Today's Revenue"
              titleHindi="आज की आमदनी"
              value={todayRevenue}
              format="currency"
              icon={DollarSign}
              color="emerald"
              change={12.5}
              changeLabel="vs yesterday"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <MetricCard
              title="Orders Today"
              titleHindi="आज के ऑर्डर"
              value={todayOrders.length}
              format="number"
              icon={ShoppingBag}
              color="saffron"
              change={8}
              changeLabel="new orders"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <MetricCard
              title="Table Utilization"
              titleHindi="टेबल का उपयोग"
              value={tableUtilization}
              format="percentage"
              icon={Users}
              color="gold"
              change={-2.1}
              changeLabel="vs last hour"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <MetricCard
              title="Avg Order Value"
              titleHindi="औसत ऑर्डर वैल्यू"
              value={avgOrderValue}
              format="currency"
              icon={TrendingUp}
              color="emerald"
              change={5.3}
              changeLabel="improvement"
            />
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-8">
            {/* Recent Orders */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-saffron" />
                    Recent Orders
                    <span className="text-sm font-normal text-foreground-muted font-devanagari">
                      हाल के ऑर्डर
                    </span>
                  </CardTitle>
                  <div className="text-sm text-foreground-muted">
                    {pendingOrders} pending
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {recentOrders.map((order, index) => (
                      <motion.div
                        key={order.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex items-center justify-between p-4 bg-background-secondary rounded-lg hover:bg-background-tertiary transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-saffron/20 rounded-lg flex items-center justify-center">
                            <span className="text-saffron font-semibold">
                              {safeGetTableNumber(order.tableId)}
                            </span>
                          </div>
                          <div>
                            <div className="font-medium text-foreground">
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
                          <div className={`text-xs px-2 py-1 rounded-full ${
                            order.status === 'completed' ? 'bg-emerald/20 text-emerald' :
                            order.status === 'preparing' ? 'bg-saffron/20 text-saffron' :
                            order.status === 'ready' ? 'bg-gold/20 text-gold' :
                            'bg-foreground-muted/20 text-foreground-muted'
                          }`}>
                            {order.status}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Table Status */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-emerald" />
                    Table Status
                    <span className="text-sm font-normal text-foreground-muted font-devanagari">
                      टेबल की स्थिति
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-4">
                    {tables.map((table) => (
                      <motion.div
                        key={table.id}
                        whileHover={{ scale: 1.05 }}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          table.status === 'available' ? 'bg-emerald/10 border-emerald/30 text-emerald' :
                          table.status === 'occupied' ? 'bg-saffron/10 border-saffron/30 text-saffron' :
                          table.status === 'reserved' ? 'bg-gold/10 border-gold/30 text-gold' :
                          'bg-foreground-muted/10 border-foreground-muted/30 text-foreground-muted'
                        }`}
                      >
                        <div className="text-center">
                          <div className="text-2xl font-bold mb-1">
                            {table.number}
                          </div>
                          <div className="text-xs">
                            {table.capacity} seats
                          </div>
                          <div className="text-xs mt-1 capitalize">
                            {table.status}
                          </div>
                          {table.waiter && (
                            <div className="text-xs mt-1 opacity-75">
                              {table.waiter}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Right Column */}
          <div className="space-y-8">
            {/* Voice System */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
            >
              <VoiceStatus variant="full" />
            </motion.div>

            {/* Inventory Alerts */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-crimson" />
                    Inventory Alerts
                    <span className="text-sm font-normal text-foreground-muted font-devanagari">
                      इन्वेंटरी अलर्ट
                    </span>
                  </CardTitle>
                  <div className="text-sm text-crimson">
                    {alerts.length} alerts
                  </div>
                </CardHeader>
                <CardContent>
                  {alerts.length === 0 ? (
                    <div className="text-center py-6 text-foreground-muted">
                      <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>No inventory alerts</p>
                      <p className="text-xs font-devanagari">कोई इन्वेंटरी अलर्ट नहीं</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {alerts.slice(0, 5).map((alert, index) => (
                        <motion.div
                          key={alert.id}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className={`p-3 rounded-lg border ${
                            alert.severity === 'high' ? 'bg-crimson/10 border-crimson/30' :
                            alert.severity === 'medium' ? 'bg-saffron/10 border-saffron/30' :
                            'bg-foreground-muted/10 border-foreground-muted/30'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <AlertTriangle className={`w-4 h-4 mt-0.5 ${
                              alert.severity === 'high' ? 'text-crimson' :
                              alert.severity === 'medium' ? 'text-saffron' :
                              'text-foreground-muted'
                            }`} />
                            <div className="flex-1">
                              <div className="font-medium text-foreground text-sm">
                                {alert.itemName}
                              </div>
                              <div className="text-xs text-foreground-muted">
                                {alert.message}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Voice History */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 }}
            >
              <VoiceHistory maxItems={10} />
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}