interface SentimentResult {
  sentiment: 'positive' | 'negative' | 'neutral';
  confidence: number;
  emotion: 'happy' | 'angry' | 'frustrated' | 'satisfied' | 'excited' | 'calm' | 'worried' | 'neutral';
  intensity: number; // 0-1
  categories: {
    service: number;
    food: number;
    ambiance: number;
    pricing: number;
    staff: number;
  };
  urgency: 'low' | 'medium' | 'high' | 'critical';
  keywords: string[];
}

interface FeedbackContext {
  customerType?: 'new' | 'regular' | 'vip';
  orderValue?: number;
  serviceTime?: number;
  previousFeedback?: SentimentResult[];
  tableNumber?: number;
  staffMember?: string;
}

export class SentimentAnalyzer {
  private positivePatterns: Map<string, number> = new Map();
  private negativePatterns: Map<string, number> = new Map();
  private emotionPatterns: Map<string, string> = new Map();
  private urgencyPatterns: Map<string, number> = new Map();
  private categoryPatterns: Map<string, string[]> = new Map();
  private isInitialized = false;

  constructor() {
    this.initializePatterns();
  }

  private initializePatterns(): void {
    // Positive sentiment patterns (English + Hindi + Hinglish)
    this.positivePatterns.set('excellent', 0.9);
    this.positivePatterns.set('amazing', 0.9);
    this.positivePatterns.set('fantastic', 0.9);
    this.positivePatterns.set('outstanding', 0.9);
    this.positivePatterns.set('perfect', 0.8);
    this.positivePatterns.set('great', 0.8);
    this.positivePatterns.set('good', 0.7);
    this.positivePatterns.set('nice', 0.7);
    this.positivePatterns.set('love', 0.8);
    this.positivePatterns.set('loved', 0.8);
    this.positivePatterns.set('delicious', 0.8);
    this.positivePatterns.set('tasty', 0.8);
    this.positivePatterns.set('fresh', 0.6);
    this.positivePatterns.set('quick', 0.6);
    this.positivePatterns.set('fast', 0.6);
    this.positivePatterns.set('helpful', 0.7);
    this.positivePatterns.set('friendly', 0.7);
    this.positivePatterns.set('polite', 0.7);
    
    // Hindi positive patterns
    this.positivePatterns.set('बहुत अच्छा', 0.9);
    this.positivePatterns.set('उत्कृष्ट', 0.9);
    this.positivePatterns.set('शानदार', 0.9);
    this.positivePatterns.set('मज़ेदार', 0.8);
    this.positivePatterns.set('स्वादिष्ट', 0.8);
    this.positivePatterns.set('अच्छा', 0.7);
    this.positivePatterns.set('सुंदर', 0.7);
    this.positivePatterns.set('खुश', 0.8);
    
    // Hinglish positive patterns
    this.positivePatterns.set('bahut accha', 0.9);
    this.positivePatterns.set('ekdum mast', 0.9);
    this.positivePatterns.set('bilkul perfect', 0.8);
    this.positivePatterns.set('too good', 0.8);
    this.positivePatterns.set('superb hai', 0.8);
    this.positivePatterns.set('mazedaar', 0.8);
    this.positivePatterns.set('accha laga', 0.7);

    // Negative sentiment patterns
    this.negativePatterns.set('terrible', 0.9);
    this.negativePatterns.set('awful', 0.9);
    this.negativePatterns.set('horrible', 0.9);
    this.negativePatterns.set('disgusting', 0.9);
    this.negativePatterns.set('worst', 0.9);
    this.negativePatterns.set('bad', 0.7);
    this.negativePatterns.set('poor', 0.7);
    this.negativePatterns.set('slow', 0.6);
    this.negativePatterns.set('cold', 0.6);
    this.negativePatterns.set('expensive', 0.5);
    this.negativePatterns.set('overpriced', 0.7);
    this.negativePatterns.set('rude', 0.8);
    this.negativePatterns.set('unprofessional', 0.8);
    this.negativePatterns.set('disappointed', 0.7);
    this.negativePatterns.set('unsatisfied', 0.7);
    this.negativePatterns.set('complain', 0.6);
    this.negativePatterns.set('complaint', 0.6);
    this.negativePatterns.set('problem', 0.6);
    this.negativePatterns.set('issue', 0.5);
    
    // Hindi negative patterns
    this.negativePatterns.set('बुरा', 0.7);
    this.negativePatterns.set('गंदा', 0.8);
    this.negativePatterns.set('बकवास', 0.8);
    this.negativePatterns.set('खराब', 0.7);
    this.negativePatterns.set('गलत', 0.6);
    this.negativePatterns.set('धीमा', 0.6);
    this.negativePatterns.set('महंगा', 0.5);
    this.negativePatterns.set('शिकायत', 0.7);
    this.negativePatterns.set('परेशानी', 0.6);
    
    // Hinglish negative patterns
    this.negativePatterns.set('bahut ganda', 0.8);
    this.negativePatterns.set('bilkul bakwas', 0.9);
    this.negativePatterns.set('kharab hai', 0.7);
    this.negativePatterns.set('bohot slow', 0.6);
    this.negativePatterns.set('too expensive', 0.7);
    this.negativePatterns.set('not good', 0.6);

    // Emotion patterns
    this.emotionPatterns.set('excited', 'excited');
    this.emotionPatterns.set('happy', 'happy');
    this.emotionPatterns.set('satisfied', 'satisfied');
    this.emotionPatterns.set('calm', 'calm');
    this.emotionPatterns.set('angry', 'angry');
    this.emotionPatterns.set('frustrated', 'frustrated');
    this.emotionPatterns.set('worried', 'worried');
    this.emotionPatterns.set('upset', 'angry');
    this.emotionPatterns.set('furious', 'angry');
    this.emotionPatterns.set('annoyed', 'frustrated');
    this.emotionPatterns.set('concerned', 'worried');
    this.emotionPatterns.set('thrilled', 'excited');
    this.emotionPatterns.set('delighted', 'happy');
    this.emotionPatterns.set('pleased', 'satisfied');
    
    // Hindi emotions
    this.emotionPatterns.set('खुश', 'happy');
    this.emotionPatterns.set('गुस्सा', 'angry');
    this.emotionPatterns.set('परेशान', 'worried');
    this.emotionPatterns.set('संतुष्ट', 'satisfied');
    this.emotionPatterns.set('उत्साहित', 'excited');
    
    // Hinglish emotions
    this.emotionPatterns.set('khush hai', 'happy');
    this.emotionPatterns.set('gussa hai', 'angry');
    this.emotionPatterns.set('pareshan hai', 'worried');
    this.emotionPatterns.set('santusht', 'satisfied');

    // Urgency patterns
    this.urgencyPatterns.set('emergency', 1.0);
    this.urgencyPatterns.set('urgent', 0.9);
    this.urgencyPatterns.set('immediately', 0.9);
    this.urgencyPatterns.set('asap', 0.8);
    this.urgencyPatterns.set('quickly', 0.7);
    this.urgencyPatterns.set('soon', 0.6);
    this.urgencyPatterns.set('manager', 0.8);
    this.urgencyPatterns.set('complaint', 0.7);
    this.urgencyPatterns.set('refund', 0.8);
    this.urgencyPatterns.set('cancel', 0.7);
    
    // Hindi urgency
    this.urgencyPatterns.set('तुरंत', 0.9);
    this.urgencyPatterns.set('जल्दी', 0.7);
    this.urgencyPatterns.set('अभी', 0.8);
    this.urgencyPatterns.set('मैनेजर', 0.8);
    this.urgencyPatterns.set('शिकायत', 0.7);
    
    // Hinglish urgency
    this.urgencyPatterns.set('abhi chahiye', 0.9);
    this.urgencyPatterns.set('jaldi karo', 0.7);
    this.urgencyPatterns.set('manager ko bulao', 0.8);

    // Category patterns
    this.categoryPatterns.set('service', [
      'service', 'waiter', 'staff', 'server', 'attention', 'help', 'rude', 'polite', 'friendly',
      'सेवा', 'स्टाफ', 'वेटर', 'मदद', 'staff hai', 'service acchi', 'waiter bura'
    ]);
    
    this.categoryPatterns.set('food', [
      'food', 'taste', 'flavor', 'delicious', 'spicy', 'fresh', 'cold', 'hot', 'quality', 'cooking',
      'dal', 'rice', 'naan', 'paneer', 'curry', 'masala', 'roti', 'sabzi',
      'खाना', 'स्वाद', 'मसाला', 'गर्म', 'ठंडा', 'ताज़ा', 'खाना accha', 'taste kharab', 'bilkul fresh'
    ]);
    
    this.categoryPatterns.set('ambiance', [
      'atmosphere', 'ambiance', 'music', 'lighting', 'noise', 'crowded', 'peaceful', 'clean', 'dirty',
      'माहौल', 'साफ', 'गंदा', 'शांत', 'ambiance accha', 'bahut shor', 'clean nahi hai'
    ]);
    
    this.categoryPatterns.set('pricing', [
      'price', 'cost', 'expensive', 'cheap', 'value', 'money', 'bill', 'overpriced', 'reasonable',
      'कीमत', 'महंगा', 'सस्ता', 'पैसा', 'बिल', 'price zyada', 'bahut mehenga', 'value for money'
    ]);
    
    this.categoryPatterns.set('staff', [
      'manager', 'chef', 'waiter', 'cashier', 'behavior', 'attitude', 'professional', 'training',
      'मैनेजर', 'रसोइया', 'व्यवहार', 'staff ka behavior', 'manager se baat', 'waiter rude hai'
    ]);

    this.isInitialized = true;
  }

  async analyzeSentiment(text: string, context?: FeedbackContext): Promise<SentimentResult> {
    if (!this.isInitialized) {
      this.initializePatterns();
    }

    const processedText = this.preprocessText(text);
    const words = processedText.split(' ');
    
    // Calculate sentiment scores
    const sentimentScores = this.calculateSentimentScores(words);
    const emotion = this.detectEmotion(words, processedText);
    const urgency = this.calculateUrgency(words, processedText, context);
    const categories = this.categorizeContent(words, processedText);
    const keywords = this.extractKeywords(words);
    
    // Determine overall sentiment
    const netSentiment = sentimentScores.positive - sentimentScores.negative;
    let sentiment: 'positive' | 'negative' | 'neutral';
    let confidence: number;
    
    if (Math.abs(netSentiment) < 0.2) {
      sentiment = 'neutral';
      confidence = 1 - Math.abs(netSentiment);
    } else if (netSentiment > 0) {
      sentiment = 'positive';
      confidence = Math.min(netSentiment, 1);
    } else {
      sentiment = 'negative';
      confidence = Math.min(Math.abs(netSentiment), 1);
    }
    
    // Apply context-based adjustments
    if (context) {
      const contextAdjustment = this.applyContextualAdjustments(
        sentiment, confidence, context, urgency
      );
      sentiment = contextAdjustment.sentiment;
      confidence = contextAdjustment.confidence;
    }
    
    return {
      sentiment,
      confidence: Math.max(0.1, Math.min(1, confidence)),
      emotion: emotion.emotion,
      intensity: emotion.intensity,
      categories,
      urgency,
      keywords
    };
  }

  private preprocessText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s\u0900-\u097F]/g, ' ') // Keep alphanumeric, spaces, and Devanagari
      .replace(/\s+/g, ' ')
      .trim();
  }

  private calculateSentimentScores(words: string[]): { positive: number; negative: number } {
    let positiveScore = 0;
    let negativeScore = 0;
    let totalWords = words.length;
    
    // Check individual words
    words.forEach(word => {
      const posScore = this.positivePatterns.get(word) || 0;
      const negScore = this.negativePatterns.get(word) || 0;
      
      positiveScore += posScore;
      negativeScore += negScore;
    });
    
    // Check bi-grams and tri-grams
    for (let i = 0; i < words.length - 1; i++) {
      const bigram = `${words[i]} ${words[i + 1]}`;
      const posScore = this.positivePatterns.get(bigram) || 0;
      const negScore = this.negativePatterns.get(bigram) || 0;
      
      positiveScore += posScore;
      negativeScore += negScore;
      
      if (i < words.length - 2) {
        const trigram = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
        const posTri = this.positivePatterns.get(trigram) || 0;
        const negTri = this.negativePatterns.get(trigram) || 0;
        
        positiveScore += posTri;
        negativeScore += negTri;
      }
    }
    
    // Normalize by text length
    const normalizationFactor = Math.max(1, totalWords / 10);
    
    return {
      positive: positiveScore / normalizationFactor,
      negative: negativeScore / normalizationFactor
    };
  }

  private detectEmotion(words: string[], fullText: string): { emotion: SentimentResult['emotion']; intensity: number } {
    const emotionScores: { [key: string]: number } = {
      happy: 0, angry: 0, frustrated: 0, satisfied: 0,
      excited: 0, calm: 0, worried: 0, neutral: 0
    };
    
    // Check for emotion keywords
    words.forEach(word => {
      const emotion = this.emotionPatterns.get(word);
      if (emotion && emotionScores.hasOwnProperty(emotion)) {
        emotionScores[emotion] += 1;
      }
    });
    
    // Check for bi-grams
    for (let i = 0; i < words.length - 1; i++) {
      const bigram = `${words[i]} ${words[i + 1]}`;
      const emotion = this.emotionPatterns.get(bigram);
      if (emotion && emotionScores.hasOwnProperty(emotion)) {
        emotionScores[emotion] += 1.5; // Bi-grams get higher weight
      }
    }
    
    // Contextual emotion detection
    if (fullText.includes('!!!') || fullText.includes('URGENT')) {
      emotionScores.angry += 2;
    }
    
    if (fullText.includes('please') || fullText.includes('पृष्ठ')) {
      emotionScores.worried += 1;
    }
    
    // Find dominant emotion
    const maxEmotion = Object.entries(emotionScores).reduce((max, [emotion, score]) => 
      score > max.score ? { emotion, score } : max
    , { emotion: 'neutral', score: 0 });
    
    const totalEmotionScore = Object.values(emotionScores).reduce((sum, score) => sum + score, 0);
    const intensity = totalEmotionScore > 0 ? maxEmotion.score / totalEmotionScore : 0.3;
    
    return {
      emotion: maxEmotion.emotion as SentimentResult['emotion'],
      intensity: Math.min(1, intensity)
    };
  }

  private calculateUrgency(words: string[], fullText: string, context?: FeedbackContext): SentimentResult['urgency'] {
    let urgencyScore = 0;
    
    // Check for urgency keywords
    words.forEach(word => {
      const score = this.urgencyPatterns.get(word) || 0;
      urgencyScore += score;
    });
    
    // Check bi-grams
    for (let i = 0; i < words.length - 1; i++) {
      const bigram = `${words[i]} ${words[i + 1]}`;
      const score = this.urgencyPatterns.get(bigram) || 0;
      urgencyScore += score;
    }
    
    // Contextual urgency indicators
    if (fullText.includes('!!!') || /[A-Z]{3,}/.test(fullText)) {
      urgencyScore += 0.5;
    }
    
    if (context?.serviceTime && context.serviceTime > 45) {
      urgencyScore += 0.3;
    }
    
    if (context?.customerType === 'vip') {
      urgencyScore += 0.2;
    }
    
    // Determine urgency level
    if (urgencyScore >= 0.8) return 'critical';
    if (urgencyScore >= 0.5) return 'high';
    if (urgencyScore >= 0.3) return 'medium';
    return 'low';
  }

  private categorizeContent(words: string[], fullText: string): SentimentResult['categories'] {
    const categories: SentimentResult['categories'] = {
      service: 0, food: 0, ambiance: 0, pricing: 0, staff: 0
    };
    
    Object.entries(this.categoryPatterns).forEach(([category, patterns]) => {
      let score = 0;
      
      patterns.forEach(pattern => {
        const patternWords = pattern.split(' ');
        
        if (patternWords.length === 1) {
          // Single word pattern
          if (words.includes(pattern)) {
            score += 1;
          }
        } else {
          // Multi-word pattern
          if (fullText.includes(pattern)) {
            score += 1.5; // Multi-word patterns get higher weight
          }
        }
      });
      
      categories[category as keyof SentimentResult['categories']] = 
        Math.min(1, score / Math.max(1, words.length / 20));
    });
    
    return categories;
  }

  private extractKeywords(words: string[]): string[] {
    const keywords: string[] = [];
    const stopWords = new Set([
      'the', 'is', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'a', 'an', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
      'was', 'were', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'और', 'है', 'में', 'को', 'का', 'की', 'के', 'से', 'पर', 'यह', 'वह', 'मैं', 'तुम', 'हम'
    ]);
    
    // Extract meaningful words (length > 2, not stop words)
    words.forEach(word => {
      if (word.length > 2 && !stopWords.has(word)) {
        // Check if it's a known pattern
        const isImportant = this.positivePatterns.has(word) || 
                           this.negativePatterns.has(word) ||
                           this.emotionPatterns.has(word) ||
                           this.urgencyPatterns.has(word);
        
        if (isImportant || word.length > 4) {
          keywords.push(word);
        }
      }
    });
    
    // Remove duplicates and limit to top 10
    return [...new Set(keywords)].slice(0, 10);
  }

  private applyContextualAdjustments(
    sentiment: SentimentResult['sentiment'], 
    confidence: number, 
    context: FeedbackContext,
    urgency: SentimentResult['urgency']
  ): { sentiment: SentimentResult['sentiment']; confidence: number } {
    let adjustedSentiment = sentiment;
    let adjustedConfidence = confidence;
    
    // VIP customers - increase confidence
    if (context.customerType === 'vip') {
      adjustedConfidence = Math.min(1, confidence * 1.1);
    }
    
    // High order value but negative sentiment - increase urgency weight
    if (context.orderValue && context.orderValue > 1000 && sentiment === 'negative') {
      adjustedConfidence = Math.min(1, confidence * 1.2);
    }
    
    // Long service time influences sentiment
    if (context.serviceTime && context.serviceTime > 30) {
      if (sentiment === 'positive') {
        adjustedConfidence *= 0.9; // Reduce confidence in positive feedback
      } else if (sentiment === 'negative') {
        adjustedConfidence = Math.min(1, confidence * 1.1); // Increase confidence in negative
      }
    }
    
    // Previous feedback pattern
    if (context.previousFeedback && context.previousFeedback.length > 0) {
      const recentNegative = context.previousFeedback
        .slice(-3)
        .filter(f => f.sentiment === 'negative').length;
      
      if (recentNegative >= 2 && sentiment === 'negative') {
        adjustedConfidence = Math.min(1, confidence * 1.15);
      }
    }
    
    // Critical urgency affects sentiment confidence
    if (urgency === 'critical') {
      adjustedConfidence = Math.min(1, confidence * 1.2);
      if (sentiment === 'neutral') {
        adjustedSentiment = 'negative'; // Critical urgency unlikely to be neutral
      }
    }
    
    return {
      sentiment: adjustedSentiment,
      confidence: Math.max(0.1, Math.min(1, adjustedConfidence))
    };
  }

  // Utility methods
  async batchAnalyze(feedbackList: Array<{ text: string; context?: FeedbackContext }>): Promise<SentimentResult[]> {
    const results = await Promise.all(
      feedbackList.map(feedback => this.analyzeSentiment(feedback.text, feedback.context))
    );
    
    return results;
  }

  generateInsights(results: SentimentResult[]): {
    overallSentiment: { positive: number; negative: number; neutral: number };
    dominantEmotions: Array<{ emotion: string; count: number }>;
    urgentIssues: number;
    categoryBreakdown: SentimentResult['categories'];
    recommendations: string[];
  } {
    if (results.length === 0) {
      return {
        overallSentiment: { positive: 0, negative: 0, neutral: 0 },
        dominantEmotions: [],
        urgentIssues: 0,
        categoryBreakdown: { service: 0, food: 0, ambiance: 0, pricing: 0, staff: 0 },
        recommendations: []
      };
    }

    // Calculate overall sentiment distribution
    const sentimentCounts = results.reduce((acc, result) => {
      acc[result.sentiment]++;
      return acc;
    }, { positive: 0, negative: 0, neutral: 0 });

    const total = results.length;
    const overallSentiment = {
      positive: sentimentCounts.positive / total,
      negative: sentimentCounts.negative / total,
      neutral: sentimentCounts.neutral / total
    };

    // Count emotions
    const emotionCounts = results.reduce((acc, result) => {
      acc[result.emotion] = (acc[result.emotion] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });

    const dominantEmotions = Object.entries(emotionCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([emotion, count]) => ({ emotion, count }));

    // Count urgent issues
    const urgentIssues = results.filter(r => r.urgency === 'high' || r.urgency === 'critical').length;

    // Average category scores
    const categoryBreakdown = results.reduce((acc, result) => {
      Object.keys(acc).forEach(category => {
        acc[category as keyof SentimentResult['categories']] += 
          result.categories[category as keyof SentimentResult['categories']];
      });
      return acc;
    }, { service: 0, food: 0, ambiance: 0, pricing: 0, staff: 0 });

    Object.keys(categoryBreakdown).forEach(category => {
      categoryBreakdown[category as keyof SentimentResult['categories']] /= total;
    });

    // Generate recommendations
    const recommendations: string[] = [];
    
    if (overallSentiment.negative > 0.3) {
      recommendations.push('High negative sentiment detected - immediate management attention required');
    }
    
    if (urgentIssues > 0) {
      recommendations.push(`${urgentIssues} urgent issues need immediate resolution`);
    }
    
    if (categoryBreakdown.service > 0.6) {
      recommendations.push('Service-related feedback is prominent - focus on staff training');
    }
    
    if (categoryBreakdown.food > 0.6) {
      recommendations.push('Food quality concerns identified - kitchen review recommended');
    }
    
    if (dominantEmotions[0]?.emotion === 'angry' && dominantEmotions[0].count > total * 0.2) {
      recommendations.push('High anger levels detected - consider customer compensation');
    }

    return {
      overallSentiment,
      dominantEmotions,
      urgentIssues,
      categoryBreakdown,
      recommendations
    };
  }
}

// Singleton instance
let sentimentAnalyzer: SentimentAnalyzer | null = null;

export function getSentimentAnalyzer(): SentimentAnalyzer {
  if (!sentimentAnalyzer) {
    sentimentAnalyzer = new SentimentAnalyzer();
  }
  return sentimentAnalyzer;
}

export type { SentimentResult, FeedbackContext };