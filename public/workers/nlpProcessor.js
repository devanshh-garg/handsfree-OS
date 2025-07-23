// NLP Processor Web Worker
// Handles natural language processing tasks in background

let agentConfig = {};
let taskQueue = [];
let isProcessing = false;
let vocabulary = new Map();
let restaurantIntents = {};
let entityPatterns = {};

// Initialize NLP data
function initializeNLPData() {
  // Restaurant-specific intent patterns
  restaurantIntents = {
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

  // Build vocabulary
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
    vocabulary.set(word.toLowerCase(), index);
  });

  // Entity extraction patterns
  entityPatterns = {
    table: /table\s*(\d+)|टेबल\s*(\d+)/i,
    quantity: /(\d+)\s*(plate|glass|cup|प्लेट|गिलास)|(?:one|two|three|four|five|एक|दो|तीन|चार|पांच)\s*(plate|glass|cup|प्लेट|गिलास)/i,
    menuItems: ['paneer', 'dal', 'rice', 'naan', 'chai', 'lassi', 'samosa', 'tikka'],
    modifiers: ['spicy', 'mild', 'hot', 'cold', 'extra', 'less', 'no', 'मसालेदार', 'कम', 'ज्यादा']
  };
}

// Main message handler
self.onmessage = function(event) {
  const { type, config, task, data } = event.data;
  
  switch (type) {
    case 'init':
      agentConfig = config;
      initializeNLPData();
      self.postMessage({
        type: 'ready',
        agentId: config.agentId
      });
      break;
      
    case 'task':
      taskQueue.push(task);
      if (!isProcessing) {
        processNextTask();
      }
      break;
      
    case 'process_text':
      processTextDirectly(data);
      break;
      
    case 'shutdown':
      self.close();
      break;
  }
};

async function processNextTask() {
  if (taskQueue.length === 0) {
    isProcessing = false;
    return;
  }

  isProcessing = true;
  const task = taskQueue.shift();
  const startTime = Date.now();

  try {
    const result = await processNLPTask(task);
    
    self.postMessage({
      type: 'task_complete',
      taskId: task.id,
      success: true,
      result: result,
      executionTime: Date.now() - startTime
    });
  } catch (error) {
    self.postMessage({
      type: 'task_complete',
      taskId: task.id,
      success: false,
      error: error.message,
      executionTime: Date.now() - startTime
    });
  }

  setTimeout(() => processNextTask(), 10);
}

async function processNLPTask(task) {
  const { text, context, operation } = task.data;
  
  switch (operation) {
    case 'intent_classification':
      return await classifyIntent(text, context);
    case 'entity_extraction':
      return await extractEntities(text, context);
    case 'sentiment_analysis':
      return await analyzeSentiment(text, context);
    case 'tokenization':
      return await tokenizeText(text);
    case 'complete_analysis':
      return await performCompleteAnalysis(text, context);
    default:
      throw new Error(`Unknown NLP operation: ${operation}`);
  }
}

async function processTextDirectly(data) {
  const { text, context, requestId } = data;
  
  try {
    const result = await performCompleteAnalysis(text, context);
    
    self.postMessage({
      type: 'text_processed',
      requestId,
      success: true,
      result
    });
  } catch (error) {
    self.postMessage({
      type: 'text_processed',
      requestId,
      success: false,
      error: error.message
    });
  }
}

async function performCompleteAnalysis(text, context) {
  const processedText = preprocessText(text);
  
  // Perform all NLP operations
  const intentResult = await classifyIntent(processedText, context);
  const entities = await extractEntities(processedText, context);
  const sentiment = await analyzeSentiment(processedText, context);
  const tokens = await tokenizeText(processedText);
  const complexity = calculateComplexity(processedText);
  const language = detectLanguage(text);
  
  return {
    type: 'complete_nlp_analysis',
    originalText: text,
    processedText,
    intent: intentResult,
    entities,
    sentiment,
    tokens,
    complexity,
    language,
    confidence: Math.min(intentResult.confidence, sentiment.confidence),
    processingTime: Date.now()
  };
}

function preprocessText(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s\u0900-\u097F]/g, ' ') // Keep alphanumeric and Devanagari
    .replace(/\s+/g, ' ')
    .trim();
}

async function classifyIntent(text, context) {
  const words = text.split(' ');
  
  let bestIntent = 'unknown';
  let bestScore = 0;
  
  // Rule-based intent matching
  for (const [intent, patterns] of Object.entries(restaurantIntents)) {
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
  
  // Calculate confidence
  const confidence = Math.min(bestScore, 0.95); // Cap confidence for rule-based
  
  return {
    intent: bestIntent,
    confidence,
    alternatives: generateAlternativeIntents(text, bestIntent, bestScore),
    reasoning: `Matched patterns in ${bestIntent} category`
  };
}

function generateAlternativeIntents(text, bestIntent, bestScore) {
  const alternatives = [];
  
  for (const [intent, patterns] of Object.entries(restaurantIntents)) {
    if (intent === bestIntent) continue;
    
    let score = 0;
    for (const pattern of patterns) {
      if (text.includes(pattern.toLowerCase())) {
        score += 1;
      }
    }
    score = score / patterns.length;
    
    if (score > 0.1) {
      alternatives.push({
        intent,
        confidence: Math.min(score, 0.95)
      });
    }
  }
  
  return alternatives.sort((a, b) => b.confidence - a.confidence).slice(0, 3);
}

async function extractEntities(text, context) {
  const entities = [];
  
  // Table number extraction
  const tableMatch = text.match(entityPatterns.table);
  if (tableMatch) {
    const tableNum = tableMatch[1] || tableMatch[2];
    entities.push({
      type: 'table',
      value: tableNum,
      confidence: 0.9,
      span: [tableMatch.index, tableMatch.index + tableMatch[0].length],
      normalized: `table_${tableNum}`
    });
  }
  
  // Quantity extraction
  const quantityMatch = text.match(entityPatterns.quantity);
  if (quantityMatch) {
    const quantity = quantityMatch[1] || wordToNumber(quantityMatch[0]);
    entities.push({
      type: 'quantity',
      value: quantity,
      confidence: 0.85,
      span: [quantityMatch.index, quantityMatch.index + quantityMatch[0].length],
      normalized: parseInt(quantity) || 1
    });
  }
  
  // Menu item extraction
  entityPatterns.menuItems.forEach(item => {
    if (text.includes(item)) {
      const index = text.indexOf(item);
      entities.push({
        type: 'menuItem',
        value: item,
        confidence: 0.8,
        span: [index, index + item.length],
        normalized: item.replace(/\s+/g, '_').toLowerCase()
      });
    }
  });
  
  // Modifier extraction
  entityPatterns.modifiers.forEach(modifier => {
    if (text.includes(modifier)) {
      const index = text.indexOf(modifier);
      entities.push({
        type: 'modifier',
        value: modifier,
        confidence: 0.75,
        span: [index, index + modifier.length],
        normalized: modifier.toLowerCase()
      });
    }
  });
  
  // Time expressions
  const timePatterns = [
    /(\d+)\s*(minutes?|mins?|मिनट)/i,
    /(\d+)\s*(hours?|hrs?|घंटे)/i,
    /(now|abhi|अभी)/i,
    /(later|baad\s*mein|बाद\s*में)/i
  ];
  
  timePatterns.forEach(pattern => {
    const match = text.match(pattern);
    if (match) {
      entities.push({
        type: 'time',
        value: match[0],
        confidence: 0.7,
        span: [match.index, match.index + match[0].length],
        normalized: normalizeTime(match[0])
      });
    }
  });
  
  return entities.sort((a, b) => b.confidence - a.confidence);
}

function wordToNumber(word) {
  const numberMap = {
    'one': '1', 'एक': '1',
    'two': '2', 'दो': '2',
    'three': '3', 'तीन': '3',
    'four': '4', 'चार': '4',
    'five': '5', 'पांच': '5'
  };
  
  return numberMap[word.toLowerCase()] || '1';
}

function normalizeTime(timeStr) {
  if (timeStr.includes('hour') || timeStr.includes('घंटे')) {
    const hours = parseInt(timeStr) || 1;
    return { value: hours * 60, unit: 'minutes' };
  } else if (timeStr.includes('minute') || timeStr.includes('मिनट')) {
    const minutes = parseInt(timeStr) || 1;
    return { value: minutes, unit: 'minutes' };
  } else if (timeStr.includes('now') || timeStr.includes('abhi') || timeStr.includes('अभी')) {
    return { value: 0, unit: 'minutes' };
  } else {
    return { value: 30, unit: 'minutes' }; // Default
  }
}

async function analyzeSentiment(text, context) {
  const positiveWords = [
    'good', 'great', 'excellent', 'amazing', 'love', 'perfect', 'wonderful',
    'accha', 'bahut accha', 'mast', 'shaandaar', 'बहुत अच्छा', 'शानदार'
  ];
  
  const negativeWords = [
    'bad', 'terrible', 'awful', 'hate', 'worst', 'slow', 'disappointed',
    'kharab', 'ganda', 'bakwas', 'खराब', 'गंदा', 'बकवास'
  ];
  
  const words = text.split(/\s+/);
  let positiveScore = 0;
  let negativeScore = 0;
  
  words.forEach(word => {
    positiveWords.forEach(pw => {
      if (word.includes(pw) || pw.includes(word)) positiveScore++;
    });
    negativeWords.forEach(nw => {
      if (word.includes(nw) || nw.includes(word)) negativeScore++;
    });
  });
  
  let sentiment = 'neutral';
  let confidence = 0.6;
  let intensity = 0.5;
  
  if (positiveScore > negativeScore) {
    sentiment = 'positive';
    confidence = Math.min(0.9, 0.6 + (positiveScore - negativeScore) * 0.1);
    intensity = Math.min(1.0, 0.5 + (positiveScore * 0.1));
  } else if (negativeScore > positiveScore) {
    sentiment = 'negative';
    confidence = Math.min(0.9, 0.6 + (negativeScore - positiveScore) * 0.1);
    intensity = Math.min(1.0, 0.5 + (negativeScore * 0.1));
  }
  
  // Determine emotion
  let emotion = 'neutral';
  if (sentiment === 'positive') {
    if (text.includes('love') || text.includes('amazing')) emotion = 'excited';
    else if (text.includes('good') || text.includes('accha')) emotion = 'happy';
    else emotion = 'satisfied';
  } else if (sentiment === 'negative') {
    if (text.includes('hate') || text.includes('terrible')) emotion = 'angry';
    else if (text.includes('slow') || text.includes('wait')) emotion = 'frustrated';
    else emotion = 'disappointed';
  }
  
  // Determine urgency
  let urgency = 'low';
  if (text.includes('emergency') || text.includes('urgent') || text.includes('अर्जेंट')) {
    urgency = 'critical';
  } else if (text.includes('complaint') || text.includes('problem') || text.includes('शिकायत')) {
    urgency = 'high';
  } else if (text.includes('slow') || text.includes('wait') || text.includes('धीमा')) {
    urgency = 'medium';
  }
  
  // Categorize content
  const categories = {
    service: 0.2,
    food: 0.2,
    ambiance: 0.2,
    pricing: 0.2,
    staff: 0.2
  };
  
  if (text.includes('service') || text.includes('waiter') || text.includes('सेवा')) {
    categories.service = 0.8;
  }
  if (text.includes('food') || text.includes('taste') || text.includes('खाना') || text.includes('स्वाद')) {
    categories.food = 0.8;
  }
  if (text.includes('atmosphere') || text.includes('noise') || text.includes('माहौल')) {
    categories.ambiance = 0.8;
  }
  if (text.includes('price') || text.includes('expensive') || text.includes('कीमत') || text.includes('महंगा')) {
    categories.pricing = 0.8;
  }
  if (text.includes('staff') || text.includes('rude') || text.includes('स्टाफ')) {
    categories.staff = 0.8;
  }
  
  // Extract keywords
  const keywords = words
    .filter(word => word.length > 3)
    .filter(word => !['this', 'that', 'with', 'have', 'been', 'और', 'में', 'का'].includes(word))
    .slice(0, 5);
  
  return {
    sentiment,
    confidence: Math.round(confidence * 100) / 100,
    emotion,
    intensity: Math.round(intensity * 100) / 100,
    urgency,
    categories,
    keywords,
    scores: {
      positive: positiveScore,
      negative: negativeScore,
      neutral: words.length - positiveScore - negativeScore
    }
  };
}

async function tokenizeText(text) {
  const words = text.split(/\s+/);
  const tokens = [];
  
  words.forEach((word, index) => {
    if (word.length === 0) return;
    
    const token = {
      text: word,
      position: index,
      isHindi: /[\u0900-\u097F]/.test(word),
      isEnglish: /^[a-zA-Z]+$/.test(word),
      isNumber: /^\d+$/.test(word),
      isHinglish: /[a-zA-Z]/.test(word) && /[\u0900-\u097F]/.test(word),
      length: word.length,
      vocabId: vocabulary.get(word.toLowerCase())
    };
    
    // Determine token type
    if (token.isNumber) {
      token.type = 'number';
    } else if (entityPatterns.menuItems.includes(word.toLowerCase())) {
      token.type = 'menu_item';
    } else if (entityPatterns.modifiers.includes(word.toLowerCase())) {
      token.type = 'modifier';
    } else if (token.isHindi) {
      token.type = 'hindi_word';
    } else if (token.isEnglish) {
      token.type = 'english_word';
    } else {
      token.type = 'mixed';
    }
    
    tokens.push(token);
  });
  
  return {
    tokens,
    totalTokens: tokens.length,
    hindiTokens: tokens.filter(t => t.isHindi).length,
    englishTokens: tokens.filter(t => t.isEnglish).length,
    hinglishTokens: tokens.filter(t => t.isHinglish).length,
    numberTokens: tokens.filter(t => t.isNumber).length,
    languageDistribution: {
      hindi: tokens.filter(t => t.isHindi).length / tokens.length,
      english: tokens.filter(t => t.isEnglish).length / tokens.length,
      mixed: tokens.filter(t => t.isHinglish).length / tokens.length
    }
  };
}

function calculateComplexity(text) {
  const words = text.split(/\s+/);
  const sentences = text.split(/[.!?।]/).filter(s => s.trim().length > 0);
  
  // Lexical diversity
  const uniqueWords = new Set(words.map(w => w.toLowerCase()));
  const lexicalDiversity = uniqueWords.size / words.length;
  
  // Average word length
  const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;
  
  // Average sentence length
  const avgSentenceLength = words.length / sentences.length;
  
  // Code-switching complexity (Hindi-English mixing)
  const hindiWords = words.filter(word => /[\u0900-\u097F]/.test(word)).length;
  const englishWords = words.filter(word => /^[a-zA-Z]+$/.test(word)).length;
  const codeSwitchingRatio = Math.min(hindiWords, englishWords) / words.length;
  
  // Overall complexity score (0-1)
  const complexityScore = (
    lexicalDiversity * 0.3 +
    Math.min(avgWordLength / 10, 1) * 0.2 +
    Math.min(avgSentenceLength / 20, 1) * 0.3 +
    codeSwitchingRatio * 0.2
  );
  
  return {
    score: Math.round(complexityScore * 100) / 100,
    lexicalDiversity: Math.round(lexicalDiversity * 100) / 100,
    avgWordLength: Math.round(avgWordLength * 10) / 10,
    avgSentenceLength: Math.round(avgSentenceLength * 10) / 10,
    codeSwitchingRatio: Math.round(codeSwitchingRatio * 100) / 100,
    level: complexityScore < 0.3 ? 'simple' : complexityScore < 0.6 ? 'moderate' : 'complex'
  };
}

function detectLanguage(text) {
  const words = text.split(/\s+/);
  const totalWords = words.length;
  
  const hindiWords = words.filter(word => /[\u0900-\u097F]/.test(word)).length;
  const englishWords = words.filter(word => /^[a-zA-Z]+$/.test(word)).length;
  const mixedWords = words.filter(word => /[a-zA-Z]/.test(word) && /[\u0900-\u097F]/.test(word)).length;
  
  const hindiRatio = hindiWords / totalWords;
  const englishRatio = englishWords / totalWords;
  const mixedRatio = mixedWords / totalWords;
  
  let primaryLanguage = 'unknown';
  let confidence = 0;
  
  if (hindiRatio > 0.6) {
    primaryLanguage = 'hindi';
    confidence = hindiRatio;
  } else if (englishRatio > 0.6) {
    primaryLanguage = 'english';
    confidence = englishRatio;
  } else if (hindiRatio + englishRatio > 0.5) {
    primaryLanguage = 'hinglish';
    confidence = hindiRatio + englishRatio;
  } else {
    primaryLanguage = 'mixed';
    confidence = 0.5;
  }
  
  return {
    primary: primaryLanguage,
    confidence: Math.round(confidence * 100) / 100,
    distribution: {
      hindi: Math.round(hindiRatio * 100) / 100,
      english: Math.round(englishRatio * 100) / 100,
      mixed: Math.round(mixedRatio * 100) / 100
    },
    scriptTypes: {
      devanagari: hindiWords > 0,
      latin: englishWords > 0,
      mixed: mixedWords > 0
    }
  };
}

console.log('NLP Processor worker initialized');