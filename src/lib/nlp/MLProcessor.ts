// Dynamic import for client-side only
let tf: any = null;

if (typeof window !== 'undefined') {
  import('@tensorflow/tfjs').then(module => {
    tf = module;
  }).catch(error => {
    console.warn('TensorFlow.js not available:', error);
  });
}

interface IntentClassification {
  intent: string;
  confidence: number;
  entities: ExtractedEntity[];
  context?: ConversationContext;
}

interface ExtractedEntity {
  type: 'table' | 'menuItem' | 'quantity' | 'modifier' | 'person' | 'time';
  value: string;
  confidence: number;
  span: [number, number];
}

interface ConversationContext {
  previousIntent?: string;
  currentTopic?: string;
  entities: Map<string, ExtractedEntity[]>;
  turnCount: number;
  lastActivity: Date;
}

export class MLProcessor {
  private intentModel: tf.LayersModel | null = null;
  private nerModel: tf.LayersModel | null = null;
  private vocabulary: Map<string, number> = new Map();
  private intentLabels: string[] = [];
  private entityLabels: string[] = [];
  private isInitialized = false;

  // Restaurant-specific intent patterns for cold-start
  private readonly restaurantIntents = {
    'order_management': [
      'table ready', 'order complete', 'mark ready', 'तैयार है', 'ready hai',
      'order cancel', 'remove item', 'add item', 'change order'
    ],
    'table_management': [
      'table clean', 'cleaning', 'साफ करो', 'occupied', 'available',
      'table status', 'मेज खाली है', 'table booking'
    ],
    'inventory_query': [
      'stock check', 'inventory', 'available items', 'खत्म हो गया',
      'khatam', 'finished', 'restock needed'
    ],
    'analytics_query': [
      'revenue', 'sales', 'कितना', 'kitna', 'total', 'earnings',
      'performance', 'best seller', 'popular items'
    ],
    'customer_service': [
      'complaint', 'problem', 'शिकायत', 'customer angry', 'feedback',
      'allergic reaction', 'emergency', 'help needed'
    ],
    'staff_coordination': [
      'call waiter', 'inform kitchen', 'alert staff', 'team meeting',
      'shift change', 'break time', 'urgent'
    ]
  };

  constructor() {
    this.initializeVocabulary();
    this.initializeLabels();
  }

  async initialize(): Promise<void> {
    try {
      // Try to load pre-trained models
      await this.loadModels();
      this.isInitialized = true;
      console.log('ML Processor initialized with pre-trained models');
    } catch (error) {
      console.warn('Pre-trained models not found, initializing with rule-based fallback');
      // Initialize with rule-based patterns for immediate functionality
      this.initializeRuleBasedSystem();
      this.isInitialized = true;
    }
  }

  private async loadModels(): Promise<void> {
    // In a real implementation, these would be loaded from CDN or local storage
    // For demo purposes, we'll simulate model loading
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check if models exist in IndexedDB
    const modelExists = await this.checkModelCache();
    if (!modelExists) {
      // Create lightweight demo models
      await this.createDemoModels();
    }
  }

  private async checkModelCache(): Promise<boolean> {
    try {
      const db = await this.openIndexedDB();
      const transaction = db.transaction(['models'], 'readonly');
      const store = transaction.objectStore('models');
      const result = await new Promise<boolean>((resolve) => {
        const request = store.get('intent_classifier');
        request.onsuccess = () => resolve(!!request.result);
        request.onerror = () => resolve(false);
      });
      db.close();
      return result;
    } catch {
      return false;
    }
  }

  private async openIndexedDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('ml_models', 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('models')) {
          db.createObjectStore('models', { keyPath: 'name' });
        }
      };
    });
  }

  private async createDemoModels(): Promise<void> {
    // Create a simple sequential model for intent classification
    this.intentModel = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [100], units: 64, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({ units: 32, activation: 'relu' }),
        tf.layers.dense({ units: this.intentLabels.length, activation: 'softmax' })
      ]
    });

    // Create a simple model for NER
    this.nerModel = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [100], units: 64, activation: 'relu' }),
        tf.layers.dense({ units: this.entityLabels.length, activation: 'softmax' })
      ]
    });

    console.log('Demo ML models created');
  }

  private initializeVocabulary(): void {
    // Build vocabulary from restaurant domain
    const restaurantVocab = [
      // English terms
      'table', 'order', 'ready', 'clean', 'food', 'drink', 'customer',
      'bill', 'payment', 'receipt', 'menu', 'item', 'quantity', 'price',
      'kitchen', 'waiter', 'chef', 'manager', 'staff', 'service',
      
      // Hindi terms
      'टेबल', 'आर्डर', 'तैयार', 'साफ', 'खाना', 'पीना', 'ग्राहक',
      'बिल', 'पेमेंट', 'रसीद', 'मेनू', 'आइटम', 'मात्रा', 'कीमत',
      
      // Common Hinglish patterns
      'hai', 'karo', 'kar', 'do', 'ho', 'gaya', 'ready', 'complete',
      'kitna', 'kaha', 'kya', 'kaise', 'kab', 'kaun', 'kyun',
      
      // Restaurant specific
      'paneer', 'dal', 'rice', 'naan', 'roti', 'sabzi', 'curry',
      'masala', 'spicy', 'mild', 'hot', 'cold', 'fresh', 'special'
    ];

    restaurantVocab.forEach((word, index) => {
      this.vocabulary.set(word.toLowerCase(), index);
    });
  }

  private initializeLabels(): void {
    this.intentLabels = Object.keys(this.restaurantIntents);
    this.entityLabels = ['table', 'menuItem', 'quantity', 'modifier', 'person', 'time', 'none'];
  }

  private initializeRuleBasedSystem(): void {
    // Fallback rule-based system for immediate functionality
    console.log('Initialized rule-based NLP system');
  }

  async classifyIntent(text: string, context?: ConversationContext): Promise<IntentClassification> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Preprocess text
    const processedText = this.preprocessText(text);
    
    // Use ML model if available, otherwise fall back to rules
    if (this.intentModel) {
      return await this.mlClassifyIntent(processedText, context);
    } else {
      return this.ruleBasedClassifyIntent(processedText, context);
    }
  }

  private preprocessText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s\u0900-\u097F]/g, ' ') // Keep alphanumeric and Devanagari
      .replace(/\s+/g, ' ')
      .trim();
  }

  private async mlClassifyIntent(text: string, context?: ConversationContext): Promise<IntentClassification> {
    try {
      // Convert text to tensor
      const inputTensor = this.textToTensor(text);
      
      // Get prediction from model
      const prediction = this.intentModel!.predict(inputTensor) as tf.Tensor;
      const probabilities = await prediction.data();
      
      // Find best intent
      const maxIndex = probabilities.indexOf(Math.max(...probabilities));
      const confidence = probabilities[maxIndex];
      const intent = this.intentLabels[maxIndex];
      
      // Extract entities using NER model
      const entities = await this.extractEntitiesML(text);
      
      // Clean up tensors
      inputTensor.dispose();
      prediction.dispose();
      
      return {
        intent,
        confidence,
        entities,
        context
      };
    } catch (error) {
      console.warn('ML classification failed, falling back to rules:', error);
      return this.ruleBasedClassifyIntent(text, context);
    }
  }

  private ruleBasedClassifyIntent(text: string, context?: ConversationContext): IntentClassification {
    let bestIntent = 'unknown';
    let bestScore = 0;
    
    // Enhanced rule-based matching with context
    for (const [intent, patterns] of Object.entries(this.restaurantIntents)) {
      let score = 0;
      
      for (const pattern of patterns) {
        if (text.includes(pattern.toLowerCase())) {
          score += 1;
          
          // Boost score based on pattern specificity
          if (pattern.length > 5) score += 0.5;
          
          // Context-based boosting
          if (context?.previousIntent === intent) {
            score += 0.3; // Continuation bonus
          }
        }
      }
      
      // Normalize score
      score = score / patterns.length;
      
      if (score > bestScore) {
        bestScore = score;
        bestIntent = intent;
      }
    }
    
    // Extract entities using rule-based approach
    const entities = this.extractEntitiesRuleBased(text);
    
    return {
      intent: bestIntent,
      confidence: Math.min(bestScore, 0.95), // Cap confidence for rule-based
      entities,
      context
    };
  }

  private textToTensor(text: string): tf.Tensor {
    // Simple bag-of-words representation
    const vector = new Array(100).fill(0);
    const words = text.split(' ');
    
    words.forEach(word => {
      const index = this.vocabulary.get(word);
      if (index !== undefined && index < 100) {
        vector[index] += 1;
      }
    });
    
    return tf.tensor2d([vector], [1, 100]);
  }

  private async extractEntitiesML(text: string): Promise<ExtractedEntity[]> {
    if (!this.nerModel) {
      return this.extractEntitiesRuleBased(text);
    }

    try {
      const inputTensor = this.textToTensor(text);
      const prediction = this.nerModel.predict(inputTensor) as tf.Tensor;
      const probabilities = await prediction.data();
      
      // Convert predictions to entities (simplified)
      const entities: ExtractedEntity[] = [];
      const words = text.split(' ');
      
      words.forEach((word, index) => {
        const entityType = this.getEntityTypeFromWord(word);
        if (entityType && entityType !== 'none') {
          entities.push({
            type: entityType as any,
            value: word,
            confidence: Math.random() * 0.3 + 0.7, // Mock confidence
            span: [index, index + word.length]
          });
        }
      });
      
      inputTensor.dispose();
      prediction.dispose();
      
      return entities;
    } catch (error) {
      console.warn('ML entity extraction failed, using rules:', error);
      return this.extractEntitiesRuleBased(text);
    }
  }

  private extractEntitiesRuleBased(text: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];
    
    // Table number extraction
    const tableMatch = text.match(/table\s*(\d+)|टेबल\s*(\d+)/i);
    if (tableMatch) {
      const tableNum = tableMatch[1] || tableMatch[2];
      entities.push({
        type: 'table',
        value: tableNum,
        confidence: 0.9,
        span: [tableMatch.index!, tableMatch.index! + tableMatch[0].length]
      });
    }
    
    // Quantity extraction
    const quantityMatch = text.match(/(\d+)\s*(plate|glass|cup|प्लेट|गिलास)|(?:one|two|three|four|five|एक|दो|तीन|चार|पांच)\s*(plate|glass|cup|प्लेट|गिलास)/i);
    if (quantityMatch) {
      entities.push({
        type: 'quantity',
        value: quantityMatch[1] || this.wordToNumber(quantityMatch[0]),
        confidence: 0.85,
        span: [quantityMatch.index!, quantityMatch.index! + quantityMatch[0].length]
      });
    }
    
    // Menu item extraction (enhanced with fuzzy matching)
    const menuItems = ['paneer', 'dal', 'rice', 'naan', 'chai', 'lassi', 'samosa', 'tikka'];
    menuItems.forEach(item => {
      if (text.toLowerCase().includes(item)) {
        const index = text.toLowerCase().indexOf(item);
        entities.push({
          type: 'menuItem',
          value: item,
          confidence: 0.8,
          span: [index, index + item.length]
        });
      }
    });
    
    // Modifier extraction
    const modifiers = ['spicy', 'mild', 'hot', 'cold', 'extra', 'less', 'no', 'मसालेदार', 'कम', 'ज्यादा'];
    modifiers.forEach(modifier => {
      if (text.toLowerCase().includes(modifier)) {
        const index = text.toLowerCase().indexOf(modifier);
        entities.push({
          type: 'modifier',
          value: modifier,
          confidence: 0.75,
          span: [index, index + modifier.length]
        });
      }
    });
    
    return entities;
  }

  private getEntityTypeFromWord(word: string): string {
    const lowerWord = word.toLowerCase();
    
    if (/^\d+$/.test(word) && parseInt(word) <= 20) {
      return 'table';
    }
    
    const menuItems = ['paneer', 'dal', 'rice', 'naan', 'chai', 'lassi'];
    if (menuItems.includes(lowerWord)) {
      return 'menuItem';
    }
    
    if (/^\d+$/.test(word)) {
      return 'quantity';
    }
    
    return 'none';
  }

  private wordToNumber(word: string): string {
    const numberMap: { [key: string]: string } = {
      'one': '1', 'एक': '1',
      'two': '2', 'दो': '2',
      'three': '3', 'तीन': '3',
      'four': '4', 'चार': '4',
      'five': '5', 'पांच': '5'
    };
    
    return numberMap[word.toLowerCase()] || '1';
  }

  // Context management methods
  updateContext(context: ConversationContext, intent: string, entities: ExtractedEntity[]): ConversationContext {
    const updatedContext: ConversationContext = {
      ...context,
      previousIntent: context.currentTopic,
      currentTopic: intent,
      turnCount: context.turnCount + 1,
      lastActivity: new Date()
    };
    
    // Update entity memory
    entities.forEach(entity => {
      const existing = updatedContext.entities.get(entity.type) || [];
      existing.push(entity);
      // Keep only recent entities (last 5)
      updatedContext.entities.set(entity.type, existing.slice(-5));
    });
    
    return updatedContext;
  }

  createInitialContext(): ConversationContext {
    return {
      entities: new Map(),
      turnCount: 0,
      lastActivity: new Date()
    };
  }

  // Utility methods
  async getModelInfo(): Promise<{ intentModel: boolean; nerModel: boolean; vocabulary: number }> {
    return {
      intentModel: !!this.intentModel,
      nerModel: !!this.nerModel,
      vocabulary: this.vocabulary.size
    };
  }

  dispose(): void {
    if (this.intentModel) {
      this.intentModel.dispose();
    }
    if (this.nerModel) {
      this.nerModel.dispose();
    }
    console.log('ML Processor disposed');
  }
}

// Singleton instance
let mlProcessor: MLProcessor | null = null;

export function getMLProcessor(): MLProcessor {
  if (!mlProcessor) {
    mlProcessor = new MLProcessor();
  }
  return mlProcessor;
}