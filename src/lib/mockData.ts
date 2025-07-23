import { MenuItem, Order, Table, Restaurant, InventoryItem, OrderItem, RestaurantMetrics } from '@/types';

export const mockRestaurant: Restaurant = {
  id: 'ganesh-bhojanalaya',
  name: 'Shri Ganesh Bhojanalaya',
  nameHindi: 'श्री गणेश भोजनालय',
  address: 'Shop No. 15, Gandhi Market, Sector 22, Delhi - 110032',
  phone: '+91 98765 43210',
  tables: [],
  menu: []
};

export const mockMenuItems: MenuItem[] = [
  // Starters
  {
    id: 'starter-1',
    name: 'Samosa Chaat',
    nameHindi: 'समोसा चाट',
    description: 'Crispy samosas topped with tangy chutneys, onions, and sev',
    descriptionHindi: 'कुरकुरे समोसे के साथ खट्टी मीठी चटनी, प्याज और सेव',
    price: 120,
    category: 'starters',
    tags: ['popular', 'street-food', 'crunchy'],
    isVeg: true,
    isJain: false,
    spiceLevel: 'medium',
    preparationTime: 10,
    ingredients: ['samosa', 'tamarind chutney', 'mint chutney', 'onions', 'sev'],
    isAvailable: true
  },
  {
    id: 'starter-2',
    name: 'Paneer Tikka',
    nameHindi: 'पनीर टिक्का',
    description: 'Grilled cottage cheese cubes marinated in aromatic spices',
    descriptionHindi: 'सुगंधित मसालों में मैरिनेट किए गए ग्रिल्ड पनीर के टुकड़े',
    price: 280,
    category: 'starters',
    tags: ['tandoor', 'protein', 'grilled'],
    isVeg: true,
    isJain: true,
    spiceLevel: 'mild',
    preparationTime: 15,
    ingredients: ['paneer', 'yogurt', 'garam masala', 'ginger-garlic', 'bell peppers'],
    isAvailable: true
  },
  {
    id: 'starter-3',
    name: 'Aloo Tikki Chaat',
    nameHindi: 'आलू टिक्की चाट',
    description: 'Crispy potato patties with chickpeas and tangy sauces',
    descriptionHindi: 'कुरकुरी आलू की टिक्की के साथ छोले और खट्टी चटनी',
    price: 100,
    category: 'starters',
    tags: ['street-food', 'spicy', 'filling'],
    isVeg: true,
    isJain: false,
    spiceLevel: 'spicy',
    preparationTime: 12,
    ingredients: ['potato', 'chickpeas', 'chutneys', 'onions', 'coriander'],
    isAvailable: true
  },

  // Main Course
  {
    id: 'main-1',
    name: 'Dal Makhani',
    nameHindi: 'दाल मखनी',
    description: 'Rich and creamy black lentils slow-cooked with butter and cream',
    descriptionHindi: 'मक्खन और क्रीम के साथ धीमी आंच पर पकाई गई काली दाल',
    price: 220,
    category: 'main-course',
    tags: ['comfort-food', 'creamy', 'popular'],
    isVeg: true,
    isJain: false,
    spiceLevel: 'mild',
    preparationTime: 25,
    ingredients: ['black lentils', 'butter', 'cream', 'tomatoes', 'ginger-garlic'],
    isAvailable: true
  },
  {
    id: 'main-2',
    name: 'Palak Paneer',
    nameHindi: 'पालक पनीर',
    description: 'Fresh cottage cheese in a creamy spinach gravy',
    descriptionHindi: 'क्रीमी पालक की ग्रेवी में ताज़ा पनीर',
    price: 260,
    category: 'main-course',
    tags: ['healthy', 'green', 'nutritious'],
    isVeg: true,
    isJain: true,
    spiceLevel: 'mild',
    preparationTime: 20,
    ingredients: ['spinach', 'paneer', 'cream', 'garam masala', 'ginger'],
    isAvailable: true
  },
  {
    id: 'main-3',
    name: 'Chole Bhature',
    nameHindi: 'छोले भटूरे',
    description: 'Spicy chickpea curry served with fluffy fried bread',
    descriptionHindi: 'मसालेदार छोले के साथ फूले हुए भटूरे',
    price: 180,
    category: 'main-course',
    tags: ['punjabi', 'filling', 'spicy'],
    isVeg: true,
    isJain: false,
    spiceLevel: 'spicy',
    preparationTime: 18,
    ingredients: ['chickpeas', 'flour', 'onions', 'tomatoes', 'punjabi spices'],
    isAvailable: true
  },
  {
    id: 'main-4',
    name: 'Rajma Chawal',
    nameHindi: 'राजमा चावल',
    description: 'Kidney bean curry served with steamed basmati rice',
    descriptionHindi: 'स्टीम्ड बासमती चावल के साथ राजमा की करी',
    price: 160,
    category: 'main-course',
    tags: ['comfort-food', 'protein', 'homestyle'],
    isVeg: true,
    isJain: false,
    spiceLevel: 'medium',
    preparationTime: 22,
    ingredients: ['kidney beans', 'basmati rice', 'onions', 'tomatoes', 'spices'],
    isAvailable: true
  },

  // Rice & Breads
  {
    id: 'rice-1',
    name: 'Jeera Rice',
    nameHindi: 'जीरा चावल',
    description: 'Aromatic basmati rice tempered with cumin seeds',
    descriptionHindi: 'जीरे के साथ तड़का लगाया गया सुगंधित बासमती चावल',
    price: 120,
    category: 'rice-breads',
    tags: ['aromatic', 'light', 'fragrant'],
    isVeg: true,
    isJain: true,
    spiceLevel: 'mild',
    preparationTime: 15,
    ingredients: ['basmati rice', 'cumin seeds', 'ghee', 'bay leaves'],
    isAvailable: true
  },
  {
    id: 'bread-1',
    name: 'Butter Naan',
    nameHindi: 'बटर नान',
    description: 'Soft tandoor-baked bread brushed with butter',
    descriptionHindi: 'मक्खन लगी हुई नरम तंदूरी नान',
    price: 60,
    category: 'rice-breads',
    tags: ['tandoor', 'soft', 'buttery'],
    isVeg: true,
    isJain: true,
    spiceLevel: 'mild',
    preparationTime: 8,
    ingredients: ['flour', 'yeast', 'milk', 'butter'],
    isAvailable: true
  },
  {
    id: 'bread-2',
    name: 'Garlic Naan',
    nameHindi: 'गार्लिक नान',
    description: 'Tandoor bread topped with fresh garlic and cilantro',
    descriptionHindi: 'ताज़ा लहसुन और धनिया के साथ तंदूरी नान',
    price: 80,
    category: 'rice-breads',
    tags: ['tandoor', 'garlic', 'aromatic'],
    isVeg: true,
    isJain: true,
    spiceLevel: 'mild',
    preparationTime: 10,
    ingredients: ['flour', 'garlic', 'cilantro', 'butter'],
    isAvailable: true
  },

  // Beverages
  {
    id: 'beverage-1',
    name: 'Masala Chai',
    nameHindi: 'मसाला चाय',
    description: 'Traditional spiced tea brewed with milk and aromatic spices',
    descriptionHindi: 'दूध और सुगंधित मसालों के साथ पारंपरिक चाय',
    price: 25,
    category: 'beverages',
    tags: ['traditional', 'spiced', 'hot'],
    isVeg: true,
    isJain: true,
    spiceLevel: 'mild',
    preparationTime: 5,
    ingredients: ['tea leaves', 'milk', 'cardamom', 'ginger', 'sugar'],
    isAvailable: true
  },
  {
    id: 'beverage-2',
    name: 'Sweet Lassi',
    nameHindi: 'मीठी लस्सी',
    description: 'Refreshing yogurt-based drink with sugar and cardamom',
    descriptionHindi: 'चीनी और इलायची के साथ दही का ठंडा पेय',
    price: 80,
    category: 'beverages',
    tags: ['cooling', 'sweet', 'traditional'],
    isVeg: true,
    isJain: true,
    spiceLevel: 'mild',
    preparationTime: 3,
    ingredients: ['yogurt', 'sugar', 'cardamom', 'ice'],
    isAvailable: true
  },
  {
    id: 'beverage-3',
    name: 'Fresh Lime Soda',
    nameHindi: 'ताज़ा नींबू सोडा',
    description: 'Sparkling water with fresh lime juice and black salt',
    descriptionHindi: 'ताज़ा नींबू का रस और काला नमक के साथ सोडा',
    price: 60,
    category: 'beverages',
    tags: ['refreshing', 'tangy', 'cooling'],
    isVeg: true,
    isJain: true,
    spiceLevel: 'mild',
    preparationTime: 2,
    ingredients: ['lime juice', 'soda water', 'black salt', 'ice'],
    isAvailable: true
  },

  // Desserts
  {
    id: 'dessert-1',
    name: 'Gulab Jamun',
    nameHindi: 'गुलाब जामुन',
    description: 'Soft milk dumplings soaked in rose-flavored sugar syrup',
    descriptionHindi: 'गुलाब की खुशबू वाली चाशनी में भीगे हुए दूध के गोले',
    price: 100,
    category: 'desserts',
    tags: ['sweet', 'traditional', 'popular'],
    isVeg: true,
    isJain: true,
    spiceLevel: 'mild',
    preparationTime: 5,
    ingredients: ['milk powder', 'flour', 'sugar syrup', 'rose water', 'ghee'],
    isAvailable: true
  },
  {
    id: 'dessert-2',
    name: 'Kulfi',
    nameHindi: 'कुल्फी',
    description: 'Traditional Indian ice cream with cardamom and pistachios',
    descriptionHindi: 'इलायची और पिस्ता के साथ पारंपरिक भारतीय आइसक्रीम',
    price: 80,
    category: 'desserts',
    tags: ['cold', 'creamy', 'traditional'],
    isVeg: true,
    isJain: true,
    spiceLevel: 'mild',
    preparationTime: 2,
    ingredients: ['milk', 'cardamom', 'pistachios', 'sugar'],
    isAvailable: true
  }
];

export const mockTables: Table[] = [
  { id: 'table-1', number: 1, capacity: 2, status: 'occupied', waiter: 'Ramesh' },
  { id: 'table-2', number: 2, capacity: 4, status: 'available', waiter: 'Priya' },
  { id: 'table-3', number: 3, capacity: 6, status: 'reserved', waiter: 'Amit' },
  { id: 'table-4', number: 4, capacity: 4, status: 'occupied', waiter: 'Sunita' },
  { id: 'table-5', number: 5, capacity: 2, status: 'cleaning', waiter: 'Ramesh' },
  { id: 'table-6', number: 6, capacity: 8, status: 'available', waiter: 'Priya' },
  { id: 'table-7', number: 7, capacity: 4, status: 'occupied', waiter: 'Amit' },
  { id: 'table-8', number: 8, capacity: 2, status: 'available', waiter: 'Sunita' }
];

export const mockOrders: Order[] = [
  {
    id: 'order-1',
    tableId: 'table-1',
    items: [
      {
        id: 'item-1',
        menuItemId: 'main-1',
        menuItem: mockMenuItems.find(item => item.id === 'main-1')!,
        quantity: 2,
        customizations: ['extra spicy'],
        status: 'preparing',
        notes: 'No onions'
      },
      {
        id: 'item-2',
        menuItemId: 'bread-1',
        menuItem: mockMenuItems.find(item => item.id === 'bread-1')!,
        quantity: 4,
        customizations: [],
        status: 'ready',
      }
    ],
    status: 'preparing',
    totalAmount: 680,
    orderTime: new Date('2024-01-20T19:30:00'),
    estimatedCompletionTime: new Date('2024-01-20T20:00:00'),
    customerName: 'Sharma Ji',
    waiterName: 'Ramesh',
    specialInstructions: 'Table prefers less oil in food'
  },
  {
    id: 'order-2',
    tableId: 'table-4',
    items: [
      {
        id: 'item-3',
        menuItemId: 'main-3',
        menuItem: mockMenuItems.find(item => item.id === 'main-3')!,
        quantity: 1,
        customizations: [],
        status: 'served',
      },
      {
        id: 'item-4',
        menuItemId: 'beverage-1',
        menuItem: mockMenuItems.find(item => item.id === 'beverage-1')!,
        quantity: 2,
        customizations: ['extra sugar'],
        status: 'served',
      }
    ],
    status: 'completed',
    totalAmount: 230,
    orderTime: new Date('2024-01-20T18:45:00'),
    customerName: 'Gupta Family',
    waiterName: 'Sunita'
  }
];

export const mockInventory: InventoryItem[] = [
  {
    id: 'inv-1',
    name: 'Basmati Rice',
    nameHindi: 'बासमती चावल',
    quantity: 50,
    unit: 'kg',
    minThreshold: 10,
    supplier: 'Delhi Grain Suppliers',
    lastRestocked: new Date('2024-01-15'),
    expiryDate: new Date('2024-06-15')
  },
  {
    id: 'inv-2',
    name: 'Paneer',
    nameHindi: 'पनीर',
    quantity: 5,
    unit: 'kg',
    minThreshold: 8,
    supplier: 'Fresh Dairy Co.',
    lastRestocked: new Date('2024-01-19'),
    expiryDate: new Date('2024-01-22')
  },
  {
    id: 'inv-3',
    name: 'Tomatoes',
    nameHindi: 'टमाटर',
    quantity: 15,
    unit: 'kg',
    minThreshold: 5,
    supplier: 'Gandhi Market Vendors',
    lastRestocked: new Date('2024-01-20'),
    expiryDate: new Date('2024-01-23')
  }
];

export const mockMetrics: RestaurantMetrics = {
  dailyRevenue: 25480,
  ordersCompleted: 47,
  avgOrderTime: 18.5,
  popularItems: [
    mockMenuItems.find(item => item.id === 'main-1')!,
    mockMenuItems.find(item => item.id === 'main-3')!,
    mockMenuItems.find(item => item.id === 'beverage-1')!
  ],
  tableUtilization: 75.5,
  customerSatisfaction: 4.6,
  timestamp: new Date()
};

// Voice command examples for testing
export const mockVoiceCommands = [
  "Table 5 ka order ready hai",
  "Paneer tikka add karo table 3 mein",
  "Kitchen mein tomato khatam ho gaya",
  "Table 2 ki payment complete kar do",
  "Today ka revenue kitna hai",
  "Gulab jamun available hai kya"
];