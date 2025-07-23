'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Clock,
  Flame,
  ShoppingCart,
  Plus,
  Minus,
  QrCode,
  Languages,
  Phone,
  MapPin,
  Utensils
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { formatCurrency, cn, generateQRCodeData } from '@/lib/utils';
import { mockMenuItems, mockRestaurant } from '@/lib/mockData';
import { MenuItem } from '@/types';
import QRCode from 'qrcode';

export default function MenuPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [language, setLanguage] = useState<'english' | 'hindi'>('english');
  const [cart, setCart] = useState<{ item: MenuItem; quantity: number }[]>([]);
  const [qrCode, setQrCode] = useState<string>('');
  const [tableNumber, setTableNumber] = useState(1);

  // Get table number from URL params in real app
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const table = params.get('table');
    if (table) {
      setTableNumber(parseInt(table));
    }
  }, []);

  // Generate QR code for sharing
  useEffect(() => {
    const generateQR = async () => {
      try {
        const qrData = generateQRCodeData(tableNumber, mockRestaurant.id);
        const qrDataURL = await QRCode.toDataURL(qrData, {
          width: 200,
          margin: 2,
          color: {
            dark: '#ff9500',
            light: '#0f0a0a'
          }
        });
        setQrCode(qrDataURL);
      } catch (error) {
        console.error('Error generating QR code:', error);
      }
    };
    generateQR();
  }, [tableNumber]);

  const categories = ['all', ...Array.from(new Set(mockMenuItems.map(item => item.category)))];
  
  const filteredItems = mockMenuItems.filter(item => {
    const matchesSearch = searchQuery === '' || 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.nameHindi.includes(searchQuery) ||
      item.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    
    return matchesSearch && matchesCategory && item.isAvailable;
  });

  const addToCart = (item: MenuItem) => {
    const existingItem = cart.find(cartItem => cartItem.item.id === item.id);
    if (existingItem) {
      setCart(prev => prev.map(cartItem =>
        cartItem.item.id === item.id
          ? { ...cartItem, quantity: cartItem.quantity + 1 }
          : cartItem
      ));
    } else {
      setCart(prev => [...prev, { item, quantity: 1 }]);
    }
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => prev.filter(cartItem => cartItem.item.id !== itemId));
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(itemId);
    } else {
      setCart(prev => prev.map(cartItem =>
        cartItem.item.id === itemId
          ? { ...cartItem, quantity }
          : cartItem
      ));
    }
  };

  const cartTotal = cart.reduce((sum, cartItem) => sum + (cartItem.item.price * cartItem.quantity), 0);
  const cartItemCount = cart.reduce((sum, cartItem) => sum + cartItem.quantity, 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/90 backdrop-blur-sm border-b border-glass-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {language === 'english' ? mockRestaurant.name : mockRestaurant.nameHindi}
              </h1>
              <div className="flex items-center gap-4 text-sm text-foreground-muted">
                <div className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  <span>Table {tableNumber}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Phone className="w-4 h-4" />
                  <span>{mockRestaurant.phone}</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => setLanguage(language === 'english' ? 'hindi' : 'english')}
                className="p-2 bg-glass hover:bg-glass-hover rounded-lg transition-colors"
              >
                <Languages className="w-5 h-5 text-saffron" />
              </button>
              
              {qrCode && (
                <div className="relative group">
                  <button className="p-2 bg-glass hover:bg-glass-hover rounded-lg transition-colors">
                    <QrCode className="w-5 h-5 text-saffron" />
                  </button>
                  <div className="absolute right-0 top-full mt-2 p-4 bg-background border border-glass-border rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto">
                    <Image src={qrCode} alt="Menu QR Code" width={128} height={128} />
                    <p className="text-xs text-foreground-muted mt-2 text-center">Share Menu</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-foreground-muted" />
            <input
              type="text"
              placeholder={language === 'english' ? 'Search menu items...' : 'मेन्यू खोजें...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-background-secondary rounded-lg border border-glass-border focus:outline-none focus:border-saffron"
            />
          </div>

          {/* Category Filter */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
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
                {category === 'all' 
                  ? (language === 'english' ? 'All' : 'सभी')
                  : category.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())
                }
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Menu Items */}
      <div className="container mx-auto px-4 py-6 pb-32">
        <div className="grid gap-4">
          <AnimatePresence>
            {filteredItems.map((item, index) => (
              <MenuItemCard
                key={item.id}
                item={item}
                language={language}
                cartQuantity={cart.find(cartItem => cartItem.item.id === item.id)?.quantity || 0}
                onAddToCart={() => addToCart(item)}
                onUpdateQuantity={(quantity) => updateQuantity(item.id, quantity)}
                index={index}
              />
            ))}
          </AnimatePresence>
        </div>

        {filteredItems.length === 0 && (
          <div className="text-center py-12 text-foreground-muted">
            <Utensils className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg">
              {language === 'english' ? 'No items found' : 'कोई आइटम नहीं मिला'}
            </p>
            <p className="text-sm">
              {language === 'english' ? 'Try a different search or category' : 'दूसरी खोज या श्रेणी आज़माएं'}
            </p>
          </div>
        )}
      </div>

      {/* Cart Drawer */}
      <AnimatePresence>
        {cart.length > 0 && (
          <CartDrawer
            cart={cart}
            language={language}
            total={cartTotal}
            itemCount={cartItemCount}
            tableNumber={tableNumber}
            onUpdateQuantity={updateQuantity}
            onRemoveItem={removeFromCart}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

interface MenuItemCardProps {
  item: MenuItem;
  language: 'english' | 'hindi';
  cartQuantity: number;
  onAddToCart: () => void;
  onUpdateQuantity: (quantity: number) => void;
  index: number;
}

function MenuItemCard({ 
  item, 
  language, 
  cartQuantity, 
  onAddToCart, 
  onUpdateQuantity,
  index 
}: MenuItemCardProps) {
  const spiceIcons = {
    'mild': 1,
    'medium': 2,
    'spicy': 3,
    'very-spicy': 4
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ delay: index * 0.1 }}
    >
      <Card className="p-4 hover:shadow-lg transition-shadow">
        <div className="flex gap-4">
          {/* Item Info */}
          <div className="flex-1">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="font-semibold text-foreground text-lg">
                  {language === 'english' ? item.name : item.nameHindi}
                </h3>
                {language === 'english' && (
                  <p className="text-sm text-foreground-muted font-devanagari">
                    {item.nameHindi}
                  </p>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                {item.isVeg && (
                  <div className="w-5 h-5 border-2 border-emerald rounded flex items-center justify-center">
                    <div className="w-2.5 h-2.5 bg-emerald rounded-full" />
                  </div>
                )}
                {item.isJain && (
                  <span className="text-xs bg-gold/20 text-gold px-2 py-1 rounded-full">
                    Jain
                  </span>
                )}
                <div className="flex items-center gap-1">
                  {Array.from({ length: spiceIcons[item.spiceLevel] }).map((_, i) => (
                    <Flame key={i} className="w-3 h-3 text-crimson" />
                  ))}
                </div>
              </div>
            </div>

            <p className="text-sm text-foreground-muted mb-3 line-clamp-2">
              {language === 'english' ? item.description : item.descriptionHindi}
            </p>

            <div className="flex items-center gap-4 mb-3">
              <div className="text-xl font-bold text-saffron">
                {formatCurrency(item.price)}
              </div>
              
              <div className="flex items-center gap-1 text-sm text-foreground-muted">
                <Clock className="w-4 h-4" />
                <span>{item.preparationTime} min</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-1">
              {item.tags.slice(0, 3).map((tag) => (
                <span 
                  key={tag} 
                  className="text-xs bg-background-secondary text-foreground-muted px-2 py-1 rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Add to Cart */}
          <div className="flex flex-col items-end justify-between">
            {cartQuantity === 0 ? (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onAddToCart}
                className="bg-saffron hover:bg-saffron-dark text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                {language === 'english' ? 'Add' : 'जोड़ें'}
              </motion.button>
            ) : (
              <div className="flex items-center gap-2 bg-saffron/10 border border-saffron/30 rounded-lg p-1">
                <button
                  onClick={() => onUpdateQuantity(cartQuantity - 1)}
                  className="w-8 h-8 bg-saffron text-white rounded-md flex items-center justify-center hover:bg-saffron-dark transition-colors"
                >
                  <Minus className="w-4 h-4" />
                </button>
                
                <span className="w-8 text-center font-semibold text-saffron">
                  {cartQuantity}
                </span>
                
                <button
                  onClick={() => onUpdateQuantity(cartQuantity + 1)}
                  className="w-8 h-8 bg-saffron text-white rounded-md flex items-center justify-center hover:bg-saffron-dark transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

interface CartDrawerProps {
  cart: { item: MenuItem; quantity: number }[];
  language: 'english' | 'hindi';
  total: number;
  itemCount: number;
  tableNumber: number;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onRemoveItem: (itemId: string) => void;
}

function CartDrawer({ 
  cart, 
  language, 
  total, 
  itemCount, 
  tableNumber,
  onUpdateQuantity, 
  onRemoveItem 
}: CartDrawerProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleOrder = () => {
    // In a real app, this would integrate with the ordering system
    alert(`Order placed for Table ${tableNumber}!\nTotal: ${formatCurrency(total)}\nItems: ${itemCount}`);
  };

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      className="fixed bottom-0 left-0 right-0 z-50"
    >
      {/* Cart Summary */}
      <div 
        className="bg-saffron text-white p-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <ShoppingCart className="w-4 h-4" />
            </div>
            <div>
              <div className="font-semibold">
                {itemCount} {language === 'english' ? 'items' : 'आइटम'}
              </div>
              <div className="text-sm opacity-90">
                {language === 'english' ? 'View cart' : 'कार्ट देखें'}
              </div>
            </div>
          </div>
          
          <div className="text-right">
            <div className="font-bold text-lg">
              {formatCurrency(total)}
            </div>
            <div className="text-sm opacity-90">
              {language === 'english' ? 'Total' : 'कुल'}
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Cart */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="bg-background border-t border-glass-border overflow-hidden"
          >
            <div className="container mx-auto p-4 max-h-80 overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground">
                  {language === 'english' ? 'Your Order' : 'आपका ऑर्डर'}
                </h3>
                <button
                  onClick={() => setIsExpanded(false)}
                  className="text-foreground-muted hover:text-foreground"
                >
                  ×
                </button>
              </div>

              <div className="space-y-3 mb-4">
                {cart.map(({ item, quantity }) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-background-secondary rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium text-foreground">
                        {language === 'english' ? item.name : item.nameHindi}
                      </div>
                      <div className="text-sm text-foreground-muted">
                        {formatCurrency(item.price)} × {quantity}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">
                        {formatCurrency(item.price * quantity)}
                      </span>
                      
                      <div className="flex items-center gap-1 bg-background rounded-lg p-1">
                        <button
                          onClick={() => onUpdateQuantity(item.id, quantity - 1)}
                          className="w-6 h-6 bg-saffron text-white rounded flex items-center justify-center text-sm"
                        >
                          -
                        </button>
                        <span className="w-8 text-center text-sm font-medium">
                          {quantity}
                        </span>
                        <button
                          onClick={() => onUpdateQuantity(item.id, quantity + 1)}
                          className="w-6 h-6 bg-saffron text-white rounded flex items-center justify-center text-sm"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-glass-border pt-4 mb-4">
                <div className="flex justify-between items-center text-lg font-bold">
                  <span className="text-foreground">
                    {language === 'english' ? 'Total' : 'कुल'}
                  </span>
                  <span className="text-saffron">
                    {formatCurrency(total)}
                  </span>
                </div>
              </div>

              <button
                onClick={handleOrder}
                className="w-full bg-saffron hover:bg-saffron-dark text-white py-3 rounded-lg font-semibold transition-colors"
              >
                {language === 'english' 
                  ? `Place Order - Table ${tableNumber}` 
                  : `ऑर्डर दें - टेबल ${tableNumber}`
                }
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}