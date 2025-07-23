import { getHinglishTokenizer, Token, TokenizationResult } from './HinglishTokenizer';
import { mockMenuItems, mockTables } from '@/lib/mockData';
import Fuse from 'fuse.js';

interface ExtractedEntity {
  type: EntityType;
  value: string;
  normalizedValue: string;
  confidence: number;
  span: [number, number];
  context?: EntityContext;
  alternatives?: string[];
}

interface EntityContext {
  relatedEntities: ExtractedEntity[];
  temporalContext?: 'past' | 'present' | 'future';
  spatialContext?: string; // e.g., "kitchen", "dining", "counter"
  intentContext?: string;
}

type EntityType = 
  | 'table'
  | 'menu_item'
  | 'quantity'
  | 'modifier'
  | 'person'
  | 'time'
  | 'currency'
  | 'ordinal'
  | 'location'
  | 'action'
  | 'status';

interface ExtractionRule {
  type: EntityType;
  patterns: RegExp[];
  postProcessor?: (match: RegExpMatchArray, text: string) => ExtractedEntity | null;
  priority: number;
  contextDependent?: boolean;
}

export class EntityExtractor {
  private tokenizer = getHinglishTokenizer();
  private menuFuse: Fuse<any>;
  private tableFuse: Fuse<any>;
  private staffNames: string[] = [];
  
  // Enhanced extraction rules for restaurant domain
  private readonly extractionRules: ExtractionRule[] = [
    // Table numbers with various patterns
    {
      type: 'table',
      patterns: [
        /table\s*(?:number\s*)?(\d+)/gi,
        /टेबल\s*(?:नंबर\s*)?(\d+)/gi,
        /(?:mez|table)\s*(?:no|number)?\s*(\d+)/gi,
        /table\s*(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)/gi,
        /table\s*(एक|दो|तीन|चार|पांच|छह|सात|आठ|नौ|दस)/gi
      ],
      priority: 9,
      postProcessor: (match, text) => this.processTableNumber(match, text)
    },

    // Menu items with fuzzy matching
    {
      type: 'menu_item',
      patterns: [
        /(?:order|add|bring|लाओ|dena|देना)\s+([a-zA-Z\u0900-\u097F\s]+?)(?:\s+(?:for|ke\s+liye|में))/gi,
        /(paneer|dal|rice|naan|roti|chai|lassi|samosa|tikka|biryani|curry|masala)/gi,
        /(पनीर|दाल|चावल|नान|रोटी|चाय|लस्सी|समोसा|टिक्का|बिरयानी)/gi
      ],
      priority: 8,
      postProcessor: (match, text) => this.processMenuItem(match, text)
    },

    // Quantities with units
    {
      type: 'quantity',
      patterns: [
        /(\d+)\s*(?:plate|glass|cup|bowl|piece|order|प्लेट|गिलास|कप|बाउल)/gi,
        /(one|two|three|four|five|six|seven|eight|nine|ten|एक|दो|तीन|चार|पांच|छह|सात|आठ|नौ|दस)\s*(?:plate|glass|cup|bowl|piece|order|प्लेट|गिलास|कप|बाउल)/gi,
        /(?:bring|लाओ|de|do)\s+(\d+)/gi
      ],
      priority: 7,
      postProcessor: (match, text) => this.processQuantity(match, text)
    },

    // Modifiers and special instructions
    {
      type: 'modifier',
      patterns: [
        /(extra|less|no|without|more|ज्यादा|कम|बिना|extra|special)/gi,
        /(spicy|mild|hot|cold|fresh|तीखा|कम\s+मसाला|गर्म|ठंडा|ताज़ा)/gi,
        /(half|full|आधा|पूरा|complete)/gi,
        /(jain|वेज|non-veg|नॉन-वेज)/gi
      ],
      priority: 6,
      postProcessor: (match, text) => this.processModifier(match, text)
    },

    // Time expressions
    {
      type: 'time',
      patterns: [
        /(?:at|में|pe)\s*(\d{1,2}:\d{2})/gi,
        /(?:after|baad\s+mein|बाद\s+में)\s*(\d+)\s*(?:minutes|min|मिनट)/gi,
        /(now|abhi|अभी|immediately|turant|तुरंत)/gi,
        /(morning|afternoon|evening|night|सुबह|दोपहर|शाम|रात)/gi
      ],
      priority: 5,
      postProcessor: (match, text) => this.processTime(match, text)
    },

    // Currency and prices
    {
      type: 'currency',
      patterns: [
        /(?:₹|rupees?|rs\.?)\s*(\d+(?:\.\d{2})?)/gi,
        /(\d+(?:\.\d{2})?)\s*(?:₹|rupees?|rs\.?)/gi,
        /(free|complimentary|मुफ्त|फ्री)/gi
      ],
      priority: 6,
      postProcessor: (match, text) => this.processCurrency(match, text)
    },

    // Status indicators
    {
      type: 'status',
      patterns: [
        /(ready|complete|done|finished|तैयार|पूरा|हो\s+गया|ready\s+hai)/gi,
        /(pending|waiting|processing|इंतज़ार|प्रतीक्षा)/gi,
        /(cancelled|cancel|रद्द|cancel\s+kar)/gi,
        /(served|delivered|दे\s+दिया|serve\s+kar\s+diya)/gi
      ],
      priority: 7,
      postProcessor: (match, text) => this.processStatus(match, text)
    },

    // Actions
    {
      type: 'action',
      patterns: [
        /(bring|get|add|remove|update|change|लाओ|ले\s+आओ|add\s+kar|remove\s+kar)/gi,
        /(clean|clear|साफ\s+करो|clear\s+kar)/gi,
        /(check|verify|देखो|check\s+kar)/gi,
        /(inform|tell|बताओ|inform\s+kar)/gi
      ],
      priority: 5,
      postProcessor: (match, text) => this.processAction(match, text)
    },

    // Person references
    {
      type: 'person',
      patterns: [
        /(waiter|server|chef|manager|customer|ग्राहक|वेटर|रसोइया|मैनेजर)/gi,
        /(sir|madam|sahib|sahiba|साहब|मैडम)/gi,
        /(table\s+\d+\s+(?:customer|guest|वाला|wala))/gi
      ],
      priority: 4,
      postProcessor: (match, text) => this.processPerson(match, text)
    },

    // Location/spatial references
    {
      type: 'location',
      patterns: [
        /(kitchen|counter|billing|entrance|रसोई|काउंटर|बिलिंग)/gi,
        /(inside|outside|corner|अंदर|बाहर|कॉर्नर)/gi,
        /(upstairs|downstairs|ऊपर|नीचे)/gi
      ],
      priority: 3,
      postProcessor: (match, text) => this.processLocation(match, text)
    }
  ];

  constructor() {
    this.initializeFuzzyMatchers();
    this.loadStaffNames();
  }

  private initializeFuzzyMatchers(): void {
    // Initialize fuzzy matcher for menu items
    this.menuFuse = new Fuse(mockMenuItems, {
      keys: [
        { name: 'name', weight: 0.4 },
        { name: 'nameHindi', weight: 0.4 },
        { name: 'tags', weight: 0.2 }
      ],
      threshold: 0.4,
      includeScore: true,
      ignoreLocation: true
    });

    // Initialize fuzzy matcher for tables
    this.tableFuse = new Fuse(mockTables, {
      keys: ['number', 'section'],
      threshold: 0.3,
      includeScore: true
    });
  }

  private loadStaffNames(): void {
    // In a real app, this would load from database
    this.staffNames = [
      'राज', 'अमित', 'सुमित्रा', 'प्रिया', 'राम', 'श्याम',
      'raj', 'amit', 'sumitra', 'priya', 'ram', 'shyam'
    ];
  }

  async extractEntities(text: string, context?: any): Promise<ExtractedEntity[]> {
    // First tokenize the text for better analysis
    const tokenizationResult = this.tokenizer.tokenize(text);
    
    // Extract entities using rule-based approach
    const ruleBasedEntities = this.extractUsingRules(text);
    
    // Extract entities using fuzzy matching
    const fuzzyEntities = await this.extractUsingFuzzyMatching(text, tokenizationResult);
    
    // Extract entities using context
    const contextualEntities = this.extractUsingContext(text, context, tokenizationResult);
    
    // Combine and deduplicate entities
    const allEntities = [...ruleBasedEntities, ...fuzzyEntities, ...contextualEntities];
    const deduplicatedEntities = this.deduplicateEntities(allEntities);
    
    // Post-process and validate entities
    const validatedEntities = this.validateEntities(deduplicatedEntities, text);
    
    // Add entity relationships
    return this.addEntityRelationships(validatedEntities);
  }

  private extractUsingRules(text: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];
    
    // Sort rules by priority (higher first)
    const sortedRules = [...this.extractionRules].sort((a, b) => b.priority - a.priority);
    
    for (const rule of sortedRules) {
      for (const pattern of rule.patterns) {
        let match;
        pattern.lastIndex = 0; // Reset regex
        
        while ((match = pattern.exec(text)) !== null) {
          const entity = rule.postProcessor 
            ? rule.postProcessor(match, text)
            : this.createBasicEntity(rule.type, match, text);
            
          if (entity) {
            entities.push(entity);
          }
          
          // Prevent infinite loop for global patterns
          if (!pattern.global) break;
        }
      }
    }
    
    return entities;
  }

  private async extractUsingFuzzyMatching(text: string, tokenResult: TokenizationResult): Promise<ExtractedEntity[]> {
    const entities: ExtractedEntity[] = [];
    
    // Extract menu items using fuzzy matching
    const menuMatches = this.menuFuse.search(text);
    for (const match of menuMatches.slice(0, 3)) { // Top 3 matches
      if (match.score && match.score < 0.3) {
        const item = match.item;
        const index = text.toLowerCase().indexOf(item.name.toLowerCase());
        
        if (index !== -1) {
          entities.push({
            type: 'menu_item',
            value: item.name,
            normalizedValue: item.name,
            confidence: 1 - match.score,
            span: [index, index + item.name.length],
            alternatives: [item.nameHindi]
          });
        }
      }
    }
    
    return entities;
  }

  private extractUsingContext(text: string, context: any, tokenResult: TokenizationResult): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];
    
    if (!context) return entities;
    
    // Use conversation context to infer missing entities
    if (context.previousEntities) {
      const previousTables = context.previousEntities.filter((e: any) => e.type === 'table');
      const previousItems = context.previousEntities.filter((e: any) => e.type === 'menu_item');
      
      // If no table mentioned but action requires one, use context
      const hasTableEntity = tokenResult.tokens.some(t => 
        /table|टेबल/i.test(t.text) || /\d+/.test(t.text)
      );
      
      if (!hasTableEntity && previousTables.length > 0) {
        const recentTable = previousTables[0];
        entities.push({
          ...recentTable,
          confidence: recentTable.confidence * 0.7, // Reduce confidence for inferred
          context: { ...recentTable.context, temporalContext: 'past' }
        });
      }
    }
    
    return entities;
  }

  // Entity post-processors
  private processTableNumber(match: RegExpMatchArray, text: string): ExtractedEntity | null {
    const tableNumber = this.parseNumber(match[1]);
    if (tableNumber < 1 || tableNumber > 20) return null; // Reasonable table range
    
    return {
      type: 'table',
      value: match[1],
      normalizedValue: tableNumber.toString(),
      confidence: 0.95,
      span: [match.index!, match.index! + match[0].length],
      alternatives: [tableNumber.toString(), `table ${tableNumber}`, `टेबल ${tableNumber}`]
    };
  }

  private processMenuItem(match: RegExpMatchArray, text: string): ExtractedEntity | null {
    const itemName = match[1] || match[0];
    const cleanName = itemName.trim().toLowerCase();
    
    // Validate against known menu items
    const menuMatch = this.menuFuse.search(cleanName);
    const confidence = menuMatch.length > 0 && menuMatch[0].score! < 0.3 
      ? 1 - menuMatch[0].score! 
      : 0.6;
    
    return {
      type: 'menu_item',
      value: itemName,
      normalizedValue: menuMatch.length > 0 ? menuMatch[0].item.name : cleanName,
      confidence,
      span: [match.index!, match.index! + match[0].length],
      alternatives: menuMatch.slice(0, 2).map(m => m.item.name)
    };
  }

  private processQuantity(match: RegExpMatchArray, text: string): ExtractedEntity | null {
    const quantity = this.parseNumber(match[1]);
    if (quantity < 1 || quantity > 50) return null; // Reasonable quantity range
    
    return {
      type: 'quantity',
      value: match[1],
      normalizedValue: quantity.toString(),
      confidence: 0.9,
      span: [match.index!, match.index! + match[0].length]
    };
  }

  private processModifier(match: RegExpMatchArray, text: string): ExtractedEntity | null {
    const modifier = match[1] || match[0];
    
    // Normalize common modifiers
    const normalizedModifiers: { [key: string]: string } = {
      'ज्यादा': 'extra',
      'कम': 'less', 
      'बिना': 'without',
      'तीखा': 'spicy',
      'गर्म': 'hot',
      'ठंडा': 'cold',
      'आधा': 'half',
      'पूरा': 'full'
    };
    
    return {
      type: 'modifier',
      value: modifier,
      normalizedValue: normalizedModifiers[modifier.toLowerCase()] || modifier.toLowerCase(),
      confidence: 0.85,
      span: [match.index!, match.index! + match[0].length]
    };
  }

  private processTime(match: RegExpMatchArray, text: string): ExtractedEntity | null {
    const timeValue = match[1] || match[0];
    
    return {
      type: 'time',
      value: timeValue,
      normalizedValue: this.normalizeTime(timeValue),
      confidence: 0.8,
      span: [match.index!, match.index! + match[0].length]
    };
  }

  private processCurrency(match: RegExpMatchArray, text: string): ExtractedEntity | null {
    const amount = match[1] || match[0];
    const numericAmount = parseFloat(amount.replace(/[^\d.]/g, ''));
    
    if (isNaN(numericAmount)) return null;
    
    return {
      type: 'currency',
      value: amount,
      normalizedValue: numericAmount.toString(),
      confidence: 0.9,
      span: [match.index!, match.index! + match[0].length]
    };
  }

  private processStatus(match: RegExpMatchArray, text: string): ExtractedEntity | null {
    const status = match[1] || match[0];
    
    // Normalize status values
    const normalizedStatuses: { [key: string]: string } = {
      'तैयार': 'ready',
      'पूरा': 'complete',
      'हो गया': 'done',
      'ready hai': 'ready',
      'इंतज़ार': 'waiting',
      'रद्द': 'cancelled',
      'दे दिया': 'served'
    };
    
    return {
      type: 'status',
      value: status,
      normalizedValue: normalizedStatuses[status.toLowerCase()] || status.toLowerCase(),
      confidence: 0.85,
      span: [match.index!, match.index! + match[0].length]
    };
  }

  private processAction(match: RegExpMatchArray, text: string): ExtractedEntity | null {
    const action = match[1] || match[0];
    
    // Normalize actions
    const normalizedActions: { [key: string]: string } = {
      'लाओ': 'bring',
      'ले आओ': 'get',
      'add kar': 'add',
      'remove kar': 'remove',
      'साफ करो': 'clean',
      'देखो': 'check',
      'बताओ': 'inform'
    };
    
    return {
      type: 'action',
      value: action,
      normalizedValue: normalizedActions[action.toLowerCase()] || action.toLowerCase(),
      confidence: 0.8,
      span: [match.index!, match.index! + match[0].length]
    };
  }

  private processPerson(match: RegExpMatchArray, text: string): ExtractedEntity | null {
    const person = match[1] || match[0];
    
    return {
      type: 'person',
      value: person,
      normalizedValue: person.toLowerCase(),
      confidence: 0.75,
      span: [match.index!, match.index! + match[0].length]
    };
  }

  private processLocation(match: RegExpMatchArray, text: string): ExtractedEntity | null {
    const location = match[1] || match[0];
    
    return {
      type: 'location',
      value: location,
      normalizedValue: location.toLowerCase(),
      confidence: 0.8,
      span: [match.index!, match.index! + match[0].length]
    };
  }

  private createBasicEntity(type: EntityType, match: RegExpMatchArray, text: string): ExtractedEntity {
    return {
      type,
      value: match[1] || match[0],
      normalizedValue: (match[1] || match[0]).toLowerCase(),
      confidence: 0.7,
      span: [match.index!, match.index! + match[0].length]
    };
  }

  private deduplicateEntities(entities: ExtractedEntity[]): ExtractedEntity[] {
    const deduplicated: ExtractedEntity[] = [];
    
    for (const entity of entities) {
      const existing = deduplicated.find(e => 
        e.type === entity.type && 
        this.spansOverlap(e.span, entity.span)
      );
      
      if (!existing) {
        deduplicated.push(entity);
      } else if (entity.confidence > existing.confidence) {
        // Replace with higher confidence entity
        const index = deduplicated.indexOf(existing);
        deduplicated[index] = entity;
      }
    }
    
    return deduplicated.sort((a, b) => a.span[0] - b.span[0]);
  }

  private validateEntities(entities: ExtractedEntity[], text: string): ExtractedEntity[] {
    return entities.filter(entity => {
      // Basic validation rules
      if (entity.confidence < 0.3) return false;
      if (entity.span[1] <= entity.span[0]) return false;
      
      // Type-specific validation
      switch (entity.type) {
        case 'table':
          const tableNum = parseInt(entity.normalizedValue);
          return tableNum >= 1 && tableNum <= 20;
          
        case 'quantity':
          const quantity = parseInt(entity.normalizedValue);
          return quantity >= 1 && quantity <= 50;
          
        case 'currency':
          const amount = parseFloat(entity.normalizedValue);
          return amount >= 0 && amount <= 10000;
          
        default:
          return true;
      }
    });
  }

  private addEntityRelationships(entities: ExtractedEntity[]): ExtractedEntity[] {
    // Add contextual relationships between entities
    return entities.map(entity => {
      const relatedEntities = entities.filter(e => 
        e !== entity && 
        Math.abs(e.span[0] - entity.span[0]) < 50 // Within 50 characters
      );
      
      return {
        ...entity,
        context: {
          relatedEntities,
          temporalContext: this.inferTemporalContext(entity, entities),
          spatialContext: this.inferSpatialContext(entity, entities)
        }
      };
    });
  }

  // Helper methods
  private parseNumber(str: string): number {
    const numberMap: { [key: string]: number } = {
      'one': 1, 'एक': 1, 'two': 2, 'दो': 2, 'three': 3, 'तीन': 3,
      'four': 4, 'चार': 4, 'five': 5, 'पांच': 5, 'six': 6, 'छह': 6,
      'seven': 7, 'सात': 7, 'eight': 8, 'आठ': 8, 'nine': 9, 'नौ': 9,
      'ten': 10, 'दस': 10
    };
    
    return numberMap[str.toLowerCase()] || parseInt(str) || 0;
  }

  private normalizeTime(timeStr: string): string {
    // Handle various time formats
    if (/^\d{1,2}:\d{2}$/.test(timeStr)) {
      return timeStr;
    }
    
    const timeMap: { [key: string]: string } = {
      'now': 'immediate',
      'abhi': 'immediate',
      'अभी': 'immediate',
      'morning': '09:00',
      'सुबह': '09:00',
      'afternoon': '14:00',
      'दोपहर': '14:00',
      'evening': '18:00',
      'शाम': '18:00',
      'night': '21:00',
      'रात': '21:00'
    };
    
    return timeMap[timeStr.toLowerCase()] || timeStr;
  }

  private spansOverlap(span1: [number, number], span2: [number, number]): boolean {
    return !(span1[1] <= span2[0] || span2[1] <= span1[0]);
  }

  private inferTemporalContext(entity: ExtractedEntity, allEntities: ExtractedEntity[]): 'past' | 'present' | 'future' | undefined {
    // Look for temporal indicators near the entity
    const timeEntities = allEntities.filter(e => e.type === 'time');
    if (timeEntities.length === 0) return 'present'; // Default
    
    // Simple heuristic based on proximity to time entities
    const nearbyTime = timeEntities.find(t => 
      Math.abs(t.span[0] - entity.span[0]) < 30
    );
    
    if (nearbyTime) {
      if (nearbyTime.normalizedValue === 'immediate') return 'present';
      return 'future';
    }
    
    return 'present';
  }

  private inferSpatialContext(entity: ExtractedEntity, allEntities: ExtractedEntity[]): string | undefined {
    const locationEntities = allEntities.filter(e => e.type === 'location');
    const nearbyLocation = locationEntities.find(l => 
      Math.abs(l.span[0] - entity.span[0]) < 40
    );
    
    return nearbyLocation?.normalizedValue;
  }

  // Public utility methods
  getEntityTypes(): EntityType[] {
    return Array.from(new Set(this.extractionRules.map(rule => rule.type)));
  }

  getExtractionStats(entities: ExtractedEntity[]): {
    totalEntities: number;
    averageConfidence: number;
    entityDistribution: { [key in EntityType]?: number };
  } {
    const distribution: { [key in EntityType]?: number } = {};
    
    entities.forEach(entity => {
      distribution[entity.type] = (distribution[entity.type] || 0) + 1;
    });
    
    return {
      totalEntities: entities.length,
      averageConfidence: entities.reduce((sum, e) => sum + e.confidence, 0) / entities.length,
      entityDistribution: distribution
    };
  }
}

// Singleton instance
let entityExtractor: EntityExtractor | null = null;

export function getEntityExtractor(): EntityExtractor {
  if (!entityExtractor) {
    entityExtractor = new EntityExtractor();
  }
  return entityExtractor;
}

export type { ExtractedEntity, EntityType, EntityContext };