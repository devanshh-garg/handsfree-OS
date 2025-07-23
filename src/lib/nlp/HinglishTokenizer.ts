interface TokenizationResult {
  tokens: Token[];
  languages: LanguageSpan[];
  codeSwichPoints: number[];
  normalizedText: string;
}

interface Token {
  text: string;
  type: 'word' | 'number' | 'punctuation' | 'unknown';
  language: 'hindi' | 'english' | 'mixed' | 'numeric';
  position: [number, number];
  isTransliterated?: boolean;
  confidence: number;
}

interface LanguageSpan {
  start: number;
  end: number;
  language: 'hindi' | 'english';
  confidence: number;
}

interface TransliterationRule {
  pattern: RegExp;
  replacement: string;
  reverse?: string;
}

export class HinglishTokenizer {
  private readonly hindiCharRange = /[\u0900-\u097F]/;
  private readonly englishCharRange = /[a-zA-Z]/;
  private readonly numberRange = /[\d०-९]/;
  
  // Common Hinglish transliteration patterns
  private readonly transliterationRules: TransliterationRule[] = [
    // Common Hindi words in English
    { pattern: /\bkaro\b/gi, replacement: 'करो', reverse: 'karo' },
    { pattern: /\bhai\b/gi, replacement: 'है', reverse: 'hai' },
    { pattern: /\bho\b/gi, replacement: 'हो', reverse: 'ho' },
    { pattern: /\bgaya\b/gi, replacement: 'गया', reverse: 'gaya' },
    { pattern: /\bkya\b/gi, replacement: 'क्या', reverse: 'kya' },
    { pattern: /\bkitna\b/gi, replacement: 'कितना', reverse: 'kitna' },
    { pattern: /\bready\b/gi, replacement: 'रेडी', reverse: 'ready' },
    
    // Restaurant specific terms
    { pattern: /\btable\b/gi, replacement: 'टेबल', reverse: 'table' },
    { pattern: /\border\b/gi, replacement: 'आर्डर', reverse: 'order' },
    { pattern: /\bmenu\b/gi, replacement: 'मेनू', reverse: 'menu' },
    { pattern: /\bbill\b/gi, replacement: 'बिल', reverse: 'bill' },
    
    // Food items
    { pattern: /\bpaneer\b/gi, replacement: 'पनीर', reverse: 'paneer' },
    { pattern: /\bdal\b/gi, replacement: 'दाल', reverse: 'dal' },
    { pattern: /\brice\b/gi, replacement: 'चावल', reverse: 'rice' },
    { pattern: /\bnaan\b/gi, replacement: 'नान', reverse: 'naan' },
    { pattern: /\bchai\b/gi, replacement: 'चाय', reverse: 'chai' },
    
    // Numbers
    { pattern: /\bek\b/gi, replacement: 'एक', reverse: 'ek' },
    { pattern: /\bdo\b/gi, replacement: 'दो', reverse: 'do' },
    { pattern: /\bteen\b/gi, replacement: 'तीन', reverse: 'teen' },
    { pattern: /\bchar\b/gi, replacement: 'चार', reverse: 'char' },
    { pattern: /\bpaanch\b/gi, replacement: 'पांच', reverse: 'paanch' },
  ];

  // Common code-switching patterns in restaurant context
  private readonly codeSwitchPatterns = [
    /table\s+(\d+)\s+(pe|mein|ko)/gi,     // "table 5 pe"
    /(\d+)\s+(glass|plate)\s+(de|do|kar)/gi,  // "2 glass de do"
    /(ready|complete)\s+(hai|ho|kar|karo)/gi, // "ready hai"
    /(clean|clear)\s+(kar|karo|kiye)/gi,      // "clean karo"
    /(check|update)\s+(kar|karo|kiye)/gi,     // "check karo"
  ];

  // Regional dialect variations
  private readonly dialectVariations: { [key: string]: string[] } = {
    // Mumbai/Bombay Hindi
    'mumbai': ['bhai', 'yaar', 'ekdum', 'jaldi', 'thik', 'accha'],
    
    // Delhi Hindi  
    'delhi': ['yaar', 'achha', 'theek', 'kya baat', 'bas', 'haan'],
    
    // Punjabi influenced
    'punjabi': ['veer', 'tussi', 'karo ji', 'sat sri akal', 'vadiya'],
    
    // South Indian influenced
    'south': ['anna', 'ayyo', 'arre', 'aiyo', 'super', 'nice']
  };

  tokenize(text: string): TokenizationResult {
    // Clean and prepare text
    const cleanedText = this.preprocessText(text);
    
    // Identify language spans
    const languageSpans = this.identifyLanguageSpans(cleanedText);
    
    // Detect code-switch points
    const codeSwitchPoints = this.detectCodeSwitchPoints(cleanedText);
    
    // Tokenize based on language awareness
    const tokens = this.performTokenization(cleanedText, languageSpans);
    
    // Normalize mixed content
    const normalizedText = this.normalizeText(cleanedText, tokens);
    
    return {
      tokens,
      languages: languageSpans,
      codeSwichPoints: codeSwitchPoints,
      normalizedText
    };
  }

  private preprocessText(text: string): string {
    return text
      .trim()
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      // Handle common contractions
      .replace(/won't/gi, 'will not')
      .replace(/can't/gi, 'cannot')
      .replace(/n't/gi, ' not')
      // Handle Hindi numerals
      .replace(/[०-९]/g, (match) => {
        const hindiToEnglish = { '०': '0', '१': '1', '२': '2', '३': '3', '४': '4', '५': '5', '६': '6', '७': '7', '८': '8', '९': '9' };
        return hindiToEnglish[match as keyof typeof hindiToEnglish] || match;
      });
  }

  private identifyLanguageSpans(text: string): LanguageSpan[] {
    const spans: LanguageSpan[] = [];
    let currentSpan: LanguageSpan | null = null;
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      let charLang: 'hindi' | 'english' | null = null;
      
      if (this.hindiCharRange.test(char)) {
        charLang = 'hindi';
      } else if (this.englishCharRange.test(char)) {
        charLang = 'english';
      }
      
      if (charLang) {
        if (!currentSpan || currentSpan.language !== charLang) {
          // Close previous span
          if (currentSpan) {
            currentSpan.end = i;
            spans.push(currentSpan);
          }
          
          // Start new span
          currentSpan = {
            start: i,
            end: i,
            language: charLang,
            confidence: 0.9
          };
        }
      } else if (currentSpan && /\s/.test(char)) {
        // Continue current span through whitespace
        continue;
      } else if (currentSpan) {
        // End current span at non-letter character
        currentSpan.end = i;
        spans.push(currentSpan);
        currentSpan = null;
      }
    }
    
    // Close final span
    if (currentSpan) {
      currentSpan.end = text.length;
      spans.push(currentSpan);
    }
    
    return this.mergeNearbySpans(spans);
  }

  private mergeNearbySpans(spans: LanguageSpan[]): LanguageSpan[] {
    if (spans.length < 2) return spans;
    
    const merged: LanguageSpan[] = [];
    let current = spans[0];
    
    for (let i = 1; i < spans.length; i++) {
      const next = spans[i];
      
      // Merge if same language and close together
      if (current.language === next.language && (next.start - current.end) <= 3) {
        current.end = next.end;
        current.confidence = Math.max(current.confidence, next.confidence);
      } else {
        merged.push(current);
        current = next;
      }
    }
    
    merged.push(current);
    return merged;
  }

  private detectCodeSwitchPoints(text: string): number[] {
    const switchPoints: number[] = [];
    
    // Look for common code-switching patterns
    this.codeSwitchPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        switchPoints.push(match.index);
        pattern.lastIndex = match.index + 1; // Avoid infinite loop
      }
    });
    
    return [...new Set(switchPoints)].sort((a, b) => a - b);
  }

  private performTokenization(text: string, languageSpans: LanguageSpan[]): Token[] {
    const tokens: Token[] = [];
    const words = text.split(/(\s+|[^\w\u0900-\u097F]+)/);
    let position = 0;
    
    for (const word of words) {
      if (word.trim()) {
        const tokenStart = position;
        const tokenEnd = position + word.length;
        
        // Determine language for this token
        const span = languageSpans.find(s => 
          tokenStart >= s.start && tokenEnd <= s.end
        );
        
        const token: Token = {
          text: word.trim(),
          type: this.getTokenType(word.trim()),
          language: this.getTokenLanguage(word.trim(), span),
          position: [tokenStart, tokenEnd],
          confidence: span?.confidence || 0.8
        };
        
        // Check if token is transliterated
        if (this.isTransliterated(word.trim())) {
          token.isTransliterated = true;
        }
        
        tokens.push(token);
      }
      position += word.length;
    }
    
    return tokens.filter(t => t.text.length > 0);
  }

  private getTokenType(word: string): Token['type'] {
    if (/^\d+$/.test(word)) return 'number';
    if (/^[^\w\u0900-\u097F]+$/.test(word)) return 'punctuation';
    if (this.englishCharRange.test(word) || this.hindiCharRange.test(word)) return 'word';
    return 'unknown';
  }

  private getTokenLanguage(word: string, span?: LanguageSpan): Token['language'] {
    if (/^\d+$/.test(word)) return 'numeric';
    
    const hasHindi = this.hindiCharRange.test(word);
    const hasEnglish = this.englishCharRange.test(word);
    
    if (hasHindi && hasEnglish) return 'mixed';
    if (hasHindi) return 'hindi';
    if (hasEnglish) return 'english';
    
    return span?.language || 'english';
  }

  private isTransliterated(word: string): boolean {
    return this.transliterationRules.some(rule => 
      rule.pattern.test(word)
    );
  }

  private normalizeText(text: string, tokens: Token[]): string {
    let normalized = text;
    
    // Apply transliteration rules
    this.transliterationRules.forEach(rule => {
      normalized = normalized.replace(rule.pattern, rule.replacement);
    });
    
    return normalized;
  }

  // Advanced tokenization features
  identifyDialect(tokens: Token[]): string {
    const dialectScores: { [key: string]: number } = {};
    
    // Initialize scores
    Object.keys(this.dialectVariations).forEach(dialect => {
      dialectScores[dialect] = 0;
    });
    
    // Score based on dialect-specific words
    tokens.forEach(token => {
      const word = token.text.toLowerCase();
      Object.entries(this.dialectVariations).forEach(([dialect, words]) => {
        if (words.includes(word)) {
          dialectScores[dialect] += 1;
        }
      });
    });
    
    // Find highest scoring dialect
    const topDialect = Object.entries(dialectScores)
      .sort(([,a], [,b]) => b - a)[0];
    
    return topDialect && topDialect[1] > 0 ? topDialect[0] : 'standard';
  }

  extractCodeSwitchingPatterns(tokens: Token[]): Array<{pattern: string, frequency: number}> {
    const patterns: Map<string, number> = new Map();
    
    // Look for language switching patterns
    for (let i = 0; i < tokens.length - 1; i++) {
      const current = tokens[i];
      const next = tokens[i + 1];
      
      if (current.language !== next.language && 
          current.language !== 'numeric' && 
          next.language !== 'numeric') {
        const pattern = `${current.language}->${next.language}`;
        patterns.set(pattern, (patterns.get(pattern) || 0) + 1);
      }
    }
    
    return Array.from(patterns.entries())
      .map(([pattern, frequency]) => ({ pattern, frequency }))
      .sort((a, b) => b.frequency - a.frequency);
  }

  // Utility methods for voice processing
  normalizeForASR(text: string): string {
    // Normalize text for better ASR recognition
    let normalized = text;
    
    // Convert common Hindi words to their English equivalents for ASR
    const asrMappings = {
      'तैयार': 'ready',
      'साफ': 'clean', 
      'आर्डर': 'order',
      'टेबल': 'table',
      'है': 'hai',
      'करो': 'karo',
      'दो': 'do'
    };
    
    Object.entries(asrMappings).forEach(([hindi, english]) => {
      normalized = normalized.replace(new RegExp(hindi, 'g'), english);
    });
    
    return normalized;
  }

  generatePhoneticVariations(word: string): string[] {
    // Generate common mispronunciations for Indian English
    const variations = [word];
    
    const phoneticRules = [
      { from: /v/g, to: 'w' },        // "very" -> "wery"
      { from: /w/g, to: 'v' },        // "what" -> "vhat"
      { from: /th/g, to: 'd' },       // "the" -> "de"
      { from: /z/g, to: 'j' },        // "zero" -> "jero"
      { from: /tion/g, to: 'san' },   // "station" -> "stasan"
    ];
    
    phoneticRules.forEach(rule => {
      const variation = word.replace(rule.from, rule.to);
      if (variation !== word) {
        variations.push(variation);
      }
    });
    
    return variations;
  }

  // Performance monitoring
  getTokenizationStats(result: TokenizationResult): {
    totalTokens: number;
    hindiTokens: number;
    englishTokens: number;
    mixedTokens: number;
    codeSwitchPoints: number;
    averageConfidence: number;
  } {
    const stats = {
      totalTokens: result.tokens.length,
      hindiTokens: result.tokens.filter(t => t.language === 'hindi').length,
      englishTokens: result.tokens.filter(t => t.language === 'english').length,
      mixedTokens: result.tokens.filter(t => t.language === 'mixed').length,
      codeSwitchPoints: result.codeSwichPoints.length,
      averageConfidence: result.tokens.reduce((sum, t) => sum + t.confidence, 0) / result.tokens.length
    };
    
    return stats;
  }
}

// Singleton instance
let hinglishTokenizer: HinglishTokenizer | null = null;

export function getHinglishTokenizer(): HinglishTokenizer {
  if (!hinglishTokenizer) {
    hinglishTokenizer = new HinglishTokenizer();
  }
  return hinglishTokenizer;
}

// Export types for use in other modules
export type { TokenizationResult, Token, LanguageSpan };