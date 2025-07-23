interface EmotionResult {
  primaryEmotion: EmotionType;
  confidence: number;
  emotionScores: { [key in EmotionType]: number };
  arousal: number; // 0-1, low to high energy
  valence: number; // 0-1, negative to positive
  intensity: number; // 0-1, calm to intense
  metadata: {
    voiceQuality: 'clear' | 'distorted' | 'noisy' | 'whispered' | 'shouted';
    speechRate: 'very_slow' | 'slow' | 'normal' | 'fast' | 'very_fast';
    pitchLevel: 'very_low' | 'low' | 'normal' | 'high' | 'very_high';
    volume: 'whisper' | 'quiet' | 'normal' | 'loud' | 'shouting';
    articulationClarity: number; // 0-1
    stressLevel: number; // 0-1
  };
  temporalAnalysis: {
    emotionTimeline: Array<{
      timestamp: number;
      emotion: EmotionType;
      intensity: number;
    }>;
    emotionTransitions: number;
    stabilityScore: number;
  };
  contextualFactors: {
    background: 'restaurant' | 'kitchen' | 'office' | 'unknown';
    socialContext: 'formal' | 'informal' | 'professional' | 'personal';
    urgency: 'low' | 'medium' | 'high' | 'critical';
  };
}

type EmotionType = 
  | 'neutral' 
  | 'happy' 
  | 'sad' 
  | 'angry' 
  | 'frustrated' 
  | 'excited' 
  | 'calm' 
  | 'anxious' 
  | 'confident' 
  | 'tired' 
  | 'surprised' 
  | 'disgusted'
  | 'stressed'
  | 'satisfied'
  | 'impatient';

interface AudioFeatures {
  pitch: {
    mean: number;
    std: number;
    range: number;
    contour: number[];
  };
  energy: {
    mean: number;
    std: number;
    peaks: number[];
    dynamics: number;
  };
  spectral: {
    centroid: number[];
    rolloff: number[];
    flux: number[];
    bandwidth: number[];
    mfcc: number[];
  };
  prosodic: {
    speechRate: number;
    pauseDuration: number[];
    stressPattern: number[];
    rhythm: number[];
  };
  voiceQuality: {
    jitter: number;
    shimmer: number;
    harmonicToNoiseRatio: number;
    spectralSlope: number;
  };
}

interface EmotionModel {
  emotion: EmotionType;
  audioPatterns: {
    pitch: { min: number; max: number; typical: number };
    energy: { min: number; max: number; typical: number };
    speechRate: { min: number; max: number; typical: number };
    spectralFeatures: number[];
    voiceQualityThresholds: {
      jitter: number;
      shimmer: number;
      hnr: number;
    };
  };
  linguisticMarkers: {
    keywords: string[];
    hindiKeywords: string[];
    toneIndicators: string[];
  };
  contextualFactors: {
    common_situations: string[];
    triggers: string[];
  };
}

interface CustomerSatisfactionMetrics {
  satisfactionScore: number; // 0-10
  serviceQuality: number; // 0-10
  emotionalState: EmotionType;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendations: string[];
  alerts: Array<{
    type: 'satisfaction' | 'complaint' | 'escalation' | 'praise';
    message: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
  }>;
}

export class EmotionDetection {
  private static instance: EmotionDetection;
  
  private audioContext: AudioContext | null = null;
  private isInitialized: boolean = false;
  private emotionModels: Map<EmotionType, EmotionModel> = new Map();
  private recentEmotions: Array<{ emotion: EmotionType; timestamp: number; confidence: number }> = [];
  
  // Restaurant-specific emotion patterns
  private restaurantEmotionPatterns = {
    customer_satisfaction: {
      positive: ['happy', 'satisfied', 'excited', 'calm'],
      negative: ['angry', 'frustrated', 'disgusted', 'impatient'],
      neutral: ['neutral']
    },
    staff_stress_levels: {
      low: ['calm', 'confident', 'happy'],
      medium: ['neutral', 'tired'],
      high: ['stressed', 'anxious', 'frustrated'],
      critical: ['angry', 'exhausted']
    },
    service_urgency: {
      routine: ['calm', 'neutral', 'happy'],
      priority: ['confident', 'focused'],
      urgent: ['anxious', 'stressed'],
      emergency: ['panicked', 'critical']
    }
  };

  private constructor() {}

  public static getInstance(): EmotionDetection {
    if (!EmotionDetection.instance) {
      EmotionDetection.instance = new EmotionDetection();
    }
    return EmotionDetection.instance;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Initialize emotion models
      this.initializeEmotionModels();
      
      this.isInitialized = true;
      console.log('EmotionDetection: Initialized with', this.emotionModels.size, 'emotion models');
    } catch (error) {
      console.error('EmotionDetection: Initialization failed', error);
      throw error;
    }
  }

  public async analyzeEmotion(
    audioData: Float32Array,
    textTranscript?: string,
    context?: {
      speaker?: string;
      environment?: 'restaurant' | 'kitchen' | 'office';
      situation?: string;
      previousEmotion?: EmotionType;
    },
    sampleRate: number = 16000
  ): Promise<EmotionResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Extract audio features
      const audioFeatures = await this.extractAudioFeatures(audioData, sampleRate);
      
      // Analyze emotion from audio
      const audioEmotionScores = this.analyzeAudioEmotion(audioFeatures);
      
      // Analyze emotion from text if available
      const textEmotionScores = textTranscript 
        ? this.analyzeTextEmotion(textTranscript)
        : this.createNeutralEmotionScores();
      
      // Combine audio and text analysis
      const combinedScores = this.combineEmotionScores(audioEmotionScores, textEmotionScores);
      
      // Apply contextual adjustments
      const contextualScores = this.applyContextualFactors(combinedScores, audioFeatures, context);
      
      // Determine primary emotion
      const primaryEmotion = this.getPrimaryEmotion(contextualScores);
      const confidence = contextualScores[primaryEmotion];
      
      // Calculate arousal and valence
      const { arousal, valence } = this.calculateArousalValence(primaryEmotion, audioFeatures);
      
      // Calculate intensity
      const intensity = this.calculateEmotionIntensity(primaryEmotion, audioFeatures);
      
      // Generate metadata
      const metadata = this.generateVoiceMetadata(audioFeatures);
      
      // Perform temporal analysis
      const temporalAnalysis = this.performTemporalAnalysis(primaryEmotion, confidence, audioFeatures);
      
      // Determine contextual factors
      const contextualFactors = this.determineContextualFactors(audioFeatures, textTranscript, context);
      
      const result: EmotionResult = {
        primaryEmotion,
        confidence: Math.round(confidence * 100) / 100,
        emotionScores: this.roundEmotionScores(contextualScores),
        arousal: Math.round(arousal * 100) / 100,
        valence: Math.round(valence * 100) / 100,
        intensity: Math.round(intensity * 100) / 100,
        metadata,
        temporalAnalysis,
        contextualFactors
      };

      // Store for temporal analysis
      this.updateEmotionHistory(primaryEmotion, confidence);
      
      return result;
    } catch (error) {
      console.error('EmotionDetection: Analysis failed', error);
      return this.createDefaultEmotionResult();
    }
  }

  public async analyzeCustomerSatisfaction(
    emotionResult: EmotionResult,
    textTranscript?: string,
    serviceContext?: {
      orderTime?: number;
      waitTime?: number;
      staffMember?: string;
      tableId?: string;
      issueType?: string;
    }
  ): Promise<CustomerSatisfactionMetrics> {
    const satisfactionScore = this.calculateSatisfactionScore(emotionResult);
    const serviceQuality = this.calculateServiceQuality(emotionResult, serviceContext);
    const riskLevel = this.assessRiskLevel(emotionResult, satisfactionScore);
    const recommendations = this.generateSatisfactionRecommendations(emotionResult, satisfactionScore);
    const alerts = this.generateSatisfactionAlerts(emotionResult, satisfactionScore, serviceContext);

    return {
      satisfactionScore: Math.round(satisfactionScore * 10) / 10,
      serviceQuality: Math.round(serviceQuality * 10) / 10,
      emotionalState: emotionResult.primaryEmotion,
      riskLevel,
      recommendations,
      alerts
    };
  }

  public async detectStaffStress(
    emotionResult: EmotionResult,
    staffMember: string,
    workContext?: {
      shift?: 'morning' | 'afternoon' | 'evening' | 'night';
      workload?: 'light' | 'moderate' | 'heavy';
      duration?: number; // hours worked
    }
  ): Promise<{
    stressLevel: 'low' | 'medium' | 'high' | 'critical';
    burnoutRisk: number; // 0-1
    recommendations: string[];
    interventions: Array<{
      type: 'break' | 'support' | 'reallocation' | 'medical';
      priority: 'low' | 'medium' | 'high' | 'urgent';
      description: string;
    }>;
  }> {
    const stressIndicators = this.calculateStressIndicators(emotionResult);
    const stressLevel = this.categorizeStressLevel(stressIndicators);
    const burnoutRisk = this.calculateBurnoutRisk(emotionResult, stressIndicators, workContext);
    
    return {
      stressLevel,
      burnoutRisk: Math.round(burnoutRisk * 100) / 100,
      recommendations: this.generateStressRecommendations(stressLevel, emotionResult),
      interventions: this.generateStressInterventions(stressLevel, burnoutRisk, workContext)
    };
  }

  public getEmotionTrends(timeWindow: number = 3600000): { // 1 hour default
    emotion: EmotionType;
    frequency: number;
    avgConfidence: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  }[] {
    const cutoffTime = Date.now() - timeWindow;
    const recentEmotions = this.recentEmotions.filter(e => e.timestamp > cutoffTime);
    
    const emotionCounts = new Map<EmotionType, number>();
    const emotionConfidences = new Map<EmotionType, number[]>();
    
    recentEmotions.forEach(({ emotion, confidence }) => {
      emotionCounts.set(emotion, (emotionCounts.get(emotion) || 0) + 1);
      
      if (!emotionConfidences.has(emotion)) {
        emotionConfidences.set(emotion, []);
      }
      emotionConfidences.get(emotion)!.push(confidence);
    });
    
    const trends: Array<{
      emotion: EmotionType;
      frequency: number;
      avgConfidence: number;
      trend: 'increasing' | 'decreasing' | 'stable';
    }> = [];

    for (const [emotion, count] of emotionCounts.entries()) {
      const confidences = emotionConfidences.get(emotion) || [];
      const avgConfidence = confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
      
      // Simple trend calculation based on recent vs earlier occurrences
      const halfWindow = recentEmotions.length / 2;
      const earlierCount = recentEmotions.slice(0, halfWindow).filter(e => e.emotion === emotion).length;
      const laterCount = recentEmotions.slice(halfWindow).filter(e => e.emotion === emotion).length;
      
      let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
      if (laterCount > earlierCount * 1.2) trend = 'increasing';
      else if (laterCount < earlierCount * 0.8) trend = 'decreasing';
      
      trends.push({
        emotion,
        frequency: count,
        avgConfidence: Math.round(avgConfidence * 100) / 100,
        trend
      });
    }
    
    return trends.sort((a, b) => b.frequency - a.frequency);
  }

  public async realTimeEmotionMonitoring(
    callback: (emotion: EmotionResult) => void,
    options: {
      interval: number; // ms
      threshold: number; // confidence threshold
      emotionsToWatch: EmotionType[];
    }
  ): Promise<() => void> {
    // This would integrate with continuous audio stream in a real implementation
    // For now, returning a mock monitoring function
    
    const monitoringInterval = setInterval(() => {
      // In real implementation, this would process live audio
      const mockEmotion = this.createMockEmotionResult();
      
      if (mockEmotion.confidence >= options.threshold &&
          options.emotionsToWatch.includes(mockEmotion.primaryEmotion)) {
        callback(mockEmotion);
      }
    }, options.interval);

    return () => clearInterval(monitoringInterval);
  }

  // Private methods

  private initializeEmotionModels(): void {
    const models: Array<[EmotionType, EmotionModel]> = [
      ['neutral', {
        emotion: 'neutral',
        audioPatterns: {
          pitch: { min: 80, max: 300, typical: 150 },
          energy: { min: 0.1, max: 0.6, typical: 0.3 },
          speechRate: { min: 120, max: 180, typical: 150 },
          spectralFeatures: [1000, 2000, 3000],
          voiceQualityThresholds: { jitter: 0.02, shimmer: 0.03, hnr: 15 }
        },
        linguisticMarkers: {
          keywords: ['okay', 'sure', 'alright', 'fine'],
          hindiKeywords: ['ठीक', 'हाँ', 'अच्छा'],
          toneIndicators: ['steady', 'calm', 'even']
        },
        contextualFactors: {
          common_situations: ['routine_interaction', 'normal_conversation'],
          triggers: ['baseline_state', 'no_strong_emotion']
        }
      }],
      ['happy', {
        emotion: 'happy',
        audioPatterns: {
          pitch: { min: 120, max: 400, typical: 220 },
          energy: { min: 0.4, max: 0.9, typical: 0.6 },
          speechRate: { min: 140, max: 220, typical: 180 },
          spectralFeatures: [1200, 2400, 3600],
          voiceQualityThresholds: { jitter: 0.015, shimmer: 0.025, hnr: 18 }
        },
        linguisticMarkers: {
          keywords: ['great', 'excellent', 'wonderful', 'amazing', 'love', 'perfect'],
          hindiKeywords: ['शानदार', 'बहुत अच्छा', 'खुशी', 'मस्त'],
          toneIndicators: ['bright', 'upbeat', 'cheerful']
        },
        contextualFactors: {
          common_situations: ['positive_feedback', 'satisfaction', 'praise'],
          triggers: ['good_service', 'expectations_met', 'pleasant_surprise']
        }
      }],
      ['angry', {
        emotion: 'angry',
        audioPatterns: {
          pitch: { min: 100, max: 500, typical: 200 },
          energy: { min: 0.6, max: 1.0, typical: 0.8 },
          speechRate: { min: 160, max: 300, typical: 220 },
          spectralFeatures: [800, 1600, 4000],
          voiceQualityThresholds: { jitter: 0.04, shimmer: 0.06, hnr: 10 }
        },
        linguisticMarkers: {
          keywords: ['terrible', 'awful', 'disgusting', 'unacceptable', 'ridiculous'],
          hindiKeywords: ['गुस्सा', 'बुरा', 'गलत', 'नाराज़'],
          toneIndicators: ['harsh', 'sharp', 'aggressive']
        },
        contextualFactors: {
          common_situations: ['complaint', 'poor_service', 'long_wait'],
          triggers: ['frustration', 'unmet_expectations', 'rudeness']
        }
      }],
      ['frustrated', {
        emotion: 'frustrated',
        audioPatterns: {
          pitch: { min: 90, max: 350, typical: 180 },
          energy: { min: 0.4, max: 0.8, typical: 0.6 },
          speechRate: { min: 130, max: 250, typical: 190 },
          spectralFeatures: [900, 1800, 3500],
          voiceQualityThresholds: { jitter: 0.03, shimmer: 0.04, hnr: 12 }
        },
        linguisticMarkers: {
          keywords: ['why', 'again', 'still', 'waiting', 'slow', 'problem'],
          hindiKeywords: ['क्यों', 'फिर', 'धीमा', 'परेशानी'],
          toneIndicators: ['strained', 'tense', 'exasperated']
        },
        contextualFactors: {
          common_situations: ['delays', 'repeated_issues', 'miscommunication'],
          triggers: ['inefficiency', 'confusion', 'multiple_attempts']
        }
      }],
      ['satisfied', {
        emotion: 'satisfied',
        audioPatterns: {
          pitch: { min: 100, max: 280, typical: 160 },
          energy: { min: 0.3, max: 0.7, typical: 0.5 },
          speechRate: { min: 120, max: 170, typical: 145 },
          spectralFeatures: [1100, 2200, 3300],
          voiceQualityThresholds: { jitter: 0.018, shimmer: 0.028, hnr: 16 }
        },
        linguisticMarkers: {
          keywords: ['good', 'nice', 'satisfied', 'pleased', 'thank you'],
          hindiKeywords: ['संतुष्ट', 'खुश', 'धन्यवाद', 'अच्छा लगा'],
          toneIndicators: ['content', 'pleased', 'relaxed']
        },
        contextualFactors: {
          common_situations: ['service_completion', 'expectation_met', 'positive_outcome'],
          triggers: ['quality_service', 'timely_delivery', 'polite_interaction']
        }
      }],
      ['anxious', {
        emotion: 'anxious',
        audioPatterns: {
          pitch: { min: 120, max: 400, typical: 250 },
          energy: { min: 0.2, max: 0.6, typical: 0.4 },
          speechRate: { min: 180, max: 280, typical: 230 },
          spectralFeatures: [1300, 2600, 3900],
          voiceQualityThresholds: { jitter: 0.035, shimmer: 0.045, hnr: 11 }
        },
        linguisticMarkers: {
          keywords: ['worried', 'nervous', 'concerned', 'anxious', 'scared'],
          hindiKeywords: ['चिंता', 'डर', 'परेशान', 'घबराहट'],
          toneIndicators: ['shaky', 'uncertain', 'tremulous']
        },
        contextualFactors: {
          common_situations: ['uncertainty', 'new_situation', 'high_stakes'],
          triggers: ['unknown_outcome', 'time_pressure', 'unfamiliarity']
        }
      }]
    ];

    models.forEach(([emotion, model]) => {
      this.emotionModels.set(emotion, model);
    });
  }

  private async extractAudioFeatures(audioData: Float32Array, sampleRate: number): Promise<AudioFeatures> {
    const frameSize = 1024;
    const hopSize = 512;
    const numFrames = Math.floor((audioData.length - frameSize) / hopSize) + 1;
    
    const features: AudioFeatures = {
      pitch: { mean: 0, std: 0, range: 0, contour: [] },
      energy: { mean: 0, std: 0, peaks: [], dynamics: 0 },
      spectral: { centroid: [], rolloff: [], flux: [], bandwidth: [], mfcc: [] },
      prosodic: { speechRate: 0, pauseDuration: [], stressPattern: [], rhythm: [] },
      voiceQuality: { jitter: 0, shimmer: 0, harmonicToNoiseRatio: 0, spectralSlope: 0 }
    };

    const pitchValues: number[] = [];
    const energyValues: number[] = [];
    
    // Frame-based analysis
    for (let i = 0; i < numFrames; i++) {
      const start = i * hopSize;
      const end = Math.min(start + frameSize, audioData.length);
      const frame = audioData.slice(start, end);
      
      // Pitch analysis
      const pitch = this.calculatePitch(frame, sampleRate);
      pitchValues.push(pitch);
      
      // Energy analysis
      const energy = this.calculateEnergy(frame);
      energyValues.push(energy);
      
      // Spectral features
      features.spectral.centroid.push(this.calculateSpectralCentroid(frame, sampleRate));
      features.spectral.rolloff.push(this.calculateSpectralRolloff(frame, sampleRate));
      
      if (i > 0) {
        const prevFrame = audioData.slice((i-1) * hopSize, start + frameSize);
        features.spectral.flux.push(this.calculateSpectralFlux(frame, prevFrame));
      }
    }

    // Calculate pitch statistics
    const validPitch = pitchValues.filter(p => p > 0);
    features.pitch.mean = this.calculateMean(validPitch);
    features.pitch.std = this.calculateStandardDeviation(validPitch);
    features.pitch.range = Math.max(...validPitch) - Math.min(...validPitch);
    features.pitch.contour = validPitch;

    // Calculate energy statistics
    features.energy.mean = this.calculateMean(energyValues);
    features.energy.std = this.calculateStandardDeviation(energyValues);
    features.energy.peaks = this.findPeaks(energyValues);
    features.energy.dynamics = features.energy.std / features.energy.mean;

    // Prosodic features
    features.prosodic.speechRate = this.estimateSpeechRate(audioData, sampleRate);
    features.prosodic.pauseDuration = this.detectPauses(energyValues, sampleRate);
    
    // Voice quality features
    features.voiceQuality.jitter = this.calculateJitter(validPitch);
    features.voiceQuality.shimmer = this.calculateShimmer(energyValues);
    features.voiceQuality.harmonicToNoiseRatio = this.calculateHNR(audioData, sampleRate);
    features.voiceQuality.spectralSlope = this.calculateSpectralSlope(audioData, sampleRate);

    return features;
  }

  private analyzeAudioEmotion(features: AudioFeatures): { [key in EmotionType]: number } {
    const scores: { [key in EmotionType]: number } = {} as any;
    
    // Initialize all emotions with base score
    const emotions: EmotionType[] = ['neutral', 'happy', 'sad', 'angry', 'frustrated', 'excited', 'calm', 'anxious', 'confident', 'tired', 'surprised', 'disgusted', 'stressed', 'satisfied', 'impatient'];
    emotions.forEach(emotion => scores[emotion] = 0.1);

    // Analyze each emotion model
    for (const [emotion, model] of this.emotionModels.entries()) {
      let score = 0.1; // Base score
      
      // Pitch matching
      const pitchScore = this.calculateFeatureMatch(
        features.pitch.mean,
        model.audioPatterns.pitch.min,
        model.audioPatterns.pitch.max,
        model.audioPatterns.pitch.typical
      );
      score += pitchScore * 0.3;
      
      // Energy matching
      const energyScore = this.calculateFeatureMatch(
        features.energy.mean,
        model.audioPatterns.energy.min,
        model.audioPatterns.energy.max,
        model.audioPatterns.energy.typical
      );
      score += energyScore * 0.3;
      
      // Speech rate matching
      const speechRateScore = this.calculateFeatureMatch(
        features.prosodic.speechRate,
        model.audioPatterns.speechRate.min,
        model.audioPatterns.speechRate.max,
        model.audioPatterns.speechRate.typical
      );
      score += speechRateScore * 0.2;
      
      // Voice quality matching
      const voiceQualityScore = this.calculateVoiceQualityMatch(features.voiceQuality, model.audioPatterns.voiceQualityThresholds);
      score += voiceQualityScore * 0.2;
      
      scores[emotion] = Math.min(1.0, score);
    }

    // Normalize scores
    const totalScore = Object.values(scores).reduce((sum, score) => sum + score, 0);
    if (totalScore > 0) {
      Object.keys(scores).forEach(emotion => {
        scores[emotion as EmotionType] = scores[emotion as EmotionType] / totalScore;
      });
    }

    return scores;
  }

  private analyzeTextEmotion(text: string): { [key in EmotionType]: number } {
    const scores: { [key in EmotionType]: number } = {} as any;
    const emotions: EmotionType[] = ['neutral', 'happy', 'sad', 'angry', 'frustrated', 'excited', 'calm', 'anxious', 'confident', 'tired', 'surprised', 'disgusted', 'stressed', 'satisfied', 'impatient'];
    
    // Initialize with neutral
    emotions.forEach(emotion => scores[emotion] = emotion === 'neutral' ? 0.8 : 0.02);
    
    const lowerText = text.toLowerCase();
    
    // Check against emotion models
    for (const [emotion, model] of this.emotionModels.entries()) {
      let textScore = 0.02;
      
      // Check English keywords
      const englishMatches = model.linguisticMarkers.keywords.filter(keyword => 
        lowerText.includes(keyword)
      ).length;
      
      // Check Hindi keywords
      const hindiMatches = model.linguisticMarkers.hindiKeywords.filter(keyword => 
        text.includes(keyword)
      ).length;
      
      const totalMatches = englishMatches + hindiMatches;
      if (totalMatches > 0) {
        textScore = Math.min(0.9, 0.1 + totalMatches * 0.2);
      }
      
      scores[emotion] = textScore;
    }
    
    // Normalize scores
    const totalScore = Object.values(scores).reduce((sum, score) => sum + score, 0);
    if (totalScore > 0) {
      Object.keys(scores).forEach(emotion => {
        scores[emotion as EmotionType] = scores[emotion as EmotionType] / totalScore;
      });
    }
    
    return scores;
  }

  private combineEmotionScores(
    audioScores: { [key in EmotionType]: number },
    textScores: { [key in EmotionType]: number },
    audioWeight: number = 0.7
  ): { [key in EmotionType]: number } {
    const combined: { [key in EmotionType]: number } = {} as any;
    const textWeight = 1 - audioWeight;
    
    Object.keys(audioScores).forEach(emotion => {
      const emotionKey = emotion as EmotionType;
      combined[emotionKey] = 
        audioScores[emotionKey] * audioWeight + 
        textScores[emotionKey] * textWeight;
    });
    
    return combined;
  }

  private applyContextualFactors(
    scores: { [key in EmotionType]: number },
    features: AudioFeatures,
    context?: any
  ): { [key in EmotionType]: number } {
    const adjusted = { ...scores };
    
    // Restaurant context adjustments
    if (context?.environment === 'restaurant') {
      // Boost customer service related emotions
      adjusted.frustrated *= 1.2;
      adjusted.impatient *= 1.2;
      adjusted.satisfied *= 1.1;
      adjusted.happy *= 1.1;
    }
    
    if (context?.environment === 'kitchen') {
      // Kitchen stress factors
      adjusted.stressed *= 1.3;
      adjusted.frustrated *= 1.2;
      adjusted.tired *= 1.1;
    }
    
    // Time-based adjustments (mock)
    const hour = new Date().getHours();
    if (hour > 22 || hour < 6) { // Late night/early morning
      adjusted.tired *= 1.3;
      adjusted.stressed *= 1.1;
    }
    
    // Previous emotion continuity
    if (context?.previousEmotion && this.recentEmotions.length > 0) {
      const recentEmotion = this.recentEmotions[this.recentEmotions.length - 1].emotion;
      if (recentEmotion === context.previousEmotion) {
        adjusted[recentEmotion] *= 1.1; // Slight boost for emotional continuity
      }
    }
    
    return adjusted;
  }

  private getPrimaryEmotion(scores: { [key in EmotionType]: number }): EmotionType {
    let maxEmotion: EmotionType = 'neutral';
    let maxScore = 0;
    
    Object.entries(scores).forEach(([emotion, score]) => {
      if (score > maxScore) {
        maxScore = score;
        maxEmotion = emotion as EmotionType;
      }
    });
    
    return maxEmotion;
  }

  private calculateArousalValence(emotion: EmotionType, features: AudioFeatures): { arousal: number; valence: number } {
    // Arousal (energy level) calculation
    let arousal = 0.5; // Default neutral
    
    // High arousal emotions
    if (['angry', 'excited', 'anxious', 'stressed', 'surprised'].includes(emotion)) {
      arousal = 0.7 + (features.energy.mean * 0.3);
    }
    // Low arousal emotions
    else if (['calm', 'tired', 'sad'].includes(emotion)) {
      arousal = 0.2 + (features.energy.mean * 0.2);
    }
    // Medium arousal emotions
    else {
      arousal = 0.4 + (features.energy.mean * 0.2);
    }
    
    // Valence (positive/negative) calculation
    let valence = 0.5; // Default neutral
    
    // Positive valence emotions
    if (['happy', 'excited', 'satisfied', 'confident', 'calm'].includes(emotion)) {
      valence = 0.7 + Math.min(0.3, features.pitch.mean / 300);
    }
    // Negative valence emotions
    else if (['angry', 'sad', 'frustrated', 'anxious', 'disgusted', 'stressed'].includes(emotion)) {
      valence = 0.3 - Math.min(0.2, features.voiceQuality.jitter * 10);
    }
    
    return {
      arousal: Math.max(0, Math.min(1, arousal)),
      valence: Math.max(0, Math.min(1, valence))
    };
  }

  private calculateEmotionIntensity(emotion: EmotionType, features: AudioFeatures): number {
    let intensity = 0.5; // Base intensity
    
    // Energy-based intensity
    intensity += features.energy.dynamics * 0.3;
    
    // Pitch variation-based intensity
    if (features.pitch.std > 0) {
      intensity += (features.pitch.std / features.pitch.mean) * 0.2;
    }
    
    // Voice quality-based intensity (distortion indicates higher intensity)
    intensity += features.voiceQuality.jitter * 5;
    intensity += features.voiceQuality.shimmer * 5;
    
    // Emotion-specific adjustments
    if (['angry', 'excited', 'anxious'].includes(emotion)) {
      intensity *= 1.2;
    } else if (['calm', 'tired'].includes(emotion)) {
      intensity *= 0.8;
    }
    
    return Math.max(0, Math.min(1, intensity));
  }

  private generateVoiceMetadata(features: AudioFeatures): EmotionResult['metadata'] {
    return {
      voiceQuality: this.classifyVoiceQuality(features),
      speechRate: this.classifySpeechRate(features.prosodic.speechRate),
      pitchLevel: this.classifyPitchLevel(features.pitch.mean),
      volume: this.classifyVolume(features.energy.mean),
      articulationClarity: this.calculateArticulationClarity(features),
      stressLevel: this.calculateStressLevel(features)
    };
  }

  private performTemporalAnalysis(
    primaryEmotion: EmotionType,
    confidence: number,
    features: AudioFeatures
  ): EmotionResult['temporalAnalysis'] {
    // Mock temporal analysis - in real implementation, this would track changes over time
    const timeline = [
      { timestamp: 0, emotion: primaryEmotion, intensity: confidence * 0.8 },
      { timestamp: 0.5, emotion: primaryEmotion, intensity: confidence },
      { timestamp: 1.0, emotion: primaryEmotion, intensity: confidence * 0.9 }
    ];
    
    return {
      emotionTimeline: timeline,
      emotionTransitions: 0, // Number of emotion changes
      stabilityScore: 0.8 // How stable the emotion is over time
    };
  }

  private determineContextualFactors(
    features: AudioFeatures,
    textTranscript?: string,
    context?: any
  ): EmotionResult['contextualFactors'] {
    return {
      background: context?.environment || 'restaurant',
      socialContext: this.inferSocialContext(features, textTranscript),
      urgency: this.assessUrgency(features, textTranscript)
    };
  }

  // Customer satisfaction specific methods

  private calculateSatisfactionScore(emotionResult: EmotionResult): number {
    const emotionScores = emotionResult.emotionScores;
    
    // Positive emotions contribute positively
    let score = 5; // Neutral baseline
    score += emotionScores.happy * 4;
    score += emotionScores.satisfied * 3.5;
    score += emotionScores.excited * 3;
    score += emotionScores.calm * 2;
    score += emotionScores.confident * 2.5;
    
    // Negative emotions contribute negatively
    score -= emotionScores.angry * 4;
    score -= emotionScores.frustrated * 3.5;
    score -= emotionScores.disgusted * 4;
    score -= emotionScores.impatient * 3;
    score -= emotionScores.stressed * 2.5;
    score -= emotionScores.anxious * 2;
    
    // Adjust for intensity
    if (emotionResult.intensity > 0.7) {
      if (emotionResult.valence > 0.6) {
        score += 1; // High intensity positive
      } else {
        score -= 2; // High intensity negative
      }
    }
    
    return Math.max(0, Math.min(10, score));
  }

  private calculateServiceQuality(
    emotionResult: EmotionResult,
    serviceContext?: any
  ): number {
    let quality = this.calculateSatisfactionScore(emotionResult);
    
    // Adjust based on service context
    if (serviceContext?.waitTime) {
      if (serviceContext.waitTime > 30) quality -= 2; // Long wait
      else if (serviceContext.waitTime < 10) quality += 1; // Quick service
    }
    
    if (serviceContext?.issueType) {
      switch (serviceContext.issueType) {
        case 'food_quality':
          quality -= 2;
          break;
        case 'service_delay':
          quality -= 1.5;
          break;
        case 'staff_behavior':
          quality -= 3;
          break;
      }
    }
    
    return Math.max(0, Math.min(10, quality));
  }

  private assessRiskLevel(
    emotionResult: EmotionResult,
    satisfactionScore: number
  ): CustomerSatisfactionMetrics['riskLevel'] {
    if (satisfactionScore < 3 || 
        emotionResult.emotionScores.angry > 0.6 ||
        emotionResult.emotionScores.disgusted > 0.5) {
      return 'critical';
    }
    
    if (satisfactionScore < 5 ||
        emotionResult.emotionScores.frustrated > 0.5 ||
        emotionResult.emotionScores.impatient > 0.6) {
      return 'high';
    }
    
    if (satisfactionScore < 7 ||
        emotionResult.emotionScores.anxious > 0.4) {
      return 'medium';
    }
    
    return 'low';
  }

  private generateSatisfactionRecommendations(
    emotionResult: EmotionResult,
    satisfactionScore: number
  ): string[] {
    const recommendations: string[] = [];
    
    if (satisfactionScore < 5) {
      recommendations.push('Immediate manager intervention required');
      recommendations.push('Offer compensation or service recovery');
    }
    
    if (emotionResult.emotionScores.frustrated > 0.5) {
      recommendations.push('Expedite service and provide clear communication');
    }
    
    if (emotionResult.emotionScores.impatient > 0.5) {
      recommendations.push('Reduce wait times and provide regular updates');
    }
    
    if (emotionResult.emotionScores.happy > 0.6) {
      recommendations.push('Capitalize on positive experience - ask for feedback/review');
    }
    
    return recommendations;
  }

  private generateSatisfactionAlerts(
    emotionResult: EmotionResult,
    satisfactionScore: number,
    serviceContext?: any
  ): CustomerSatisfactionMetrics['alerts'] {
    const alerts: CustomerSatisfactionMetrics['alerts'] = [];
    
    if (emotionResult.emotionScores.angry > 0.7) {
      alerts.push({
        type: 'escalation',
        message: 'Customer showing signs of anger - immediate attention required',
        priority: 'critical'
      });
    }
    
    if (satisfactionScore < 3) {
      alerts.push({
        type: 'complaint',
        message: 'Very low satisfaction detected - potential complaint',
        priority: 'high'
      });
    }
    
    if (emotionResult.emotionScores.satisfied > 0.7) {
      alerts.push({
        type: 'praise',
        message: 'Highly satisfied customer - opportunity for positive feedback',
        priority: 'low'
      });
    }
    
    return alerts;
  }

  // Utility methods for audio analysis

  private calculatePitch(frame: Float32Array, sampleRate: number): number {
    // Simplified pitch detection using autocorrelation
    const minPeriod = Math.floor(sampleRate / 500);
    const maxPeriod = Math.floor(sampleRate / 50);
    
    let maxCorrelation = 0;
    let bestPeriod = 0;
    
    for (let period = minPeriod; period <= maxPeriod && period < frame.length / 2; period++) {
      let correlation = 0;
      for (let i = 0; i < frame.length - period; i++) {
        correlation += frame[i] * frame[i + period];
      }
      
      if (correlation > maxCorrelation) {
        maxCorrelation = correlation;
        bestPeriod = period;
      }
    }
    
    return bestPeriod > 0 ? sampleRate / bestPeriod : 0;
  }

  private calculateEnergy(frame: Float32Array): number {
    let energy = 0;
    for (let i = 0; i < frame.length; i++) {
      energy += frame[i] * frame[i];
    }
    return Math.sqrt(energy / frame.length);
  }

  private calculateSpectralCentroid(frame: Float32Array, sampleRate: number): number {
    // Mock implementation - would use FFT in real system
    return 1500 + Math.random() * 1000;
  }

  private calculateSpectralRolloff(frame: Float32Array, sampleRate: number): number {
    // Mock implementation
    return 3000 + Math.random() * 2000;
  }

  private calculateSpectralFlux(frame1: Float32Array, frame2: Float32Array): number {
    // Mock implementation
    return Math.random() * 0.1;
  }

  private calculateMean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private calculateStandardDeviation(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = this.calculateMean(values);
    const squaredDiffs = values.map(val => (val - mean) ** 2);
    return Math.sqrt(this.calculateMean(squaredDiffs));
  }

  private findPeaks(values: number[]): number[] {
    const peaks: number[] = [];
    for (let i = 1; i < values.length - 1; i++) {
      if (values[i] > values[i-1] && values[i] > values[i+1] && values[i] > 0.1) {
        peaks.push(i);
      }
    }
    return peaks;
  }

  private estimateSpeechRate(audioData: Float32Array, sampleRate: number): number {
    // Mock speech rate estimation
    return 140 + Math.random() * 80; // 140-220 words per minute
  }

  private detectPauses(energyValues: number[], sampleRate: number): number[] {
    // Mock pause detection
    return [0.2, 0.5, 0.3]; // Pause durations in seconds
  }

  private calculateJitter(pitchValues: number[]): number {
    if (pitchValues.length < 2) return 0;
    
    let sumDiff = 0;
    for (let i = 1; i < pitchValues.length; i++) {
      sumDiff += Math.abs(pitchValues[i] - pitchValues[i-1]);
    }
    
    const avgPitch = this.calculateMean(pitchValues);
    return avgPitch > 0 ? (sumDiff / (pitchValues.length - 1)) / avgPitch : 0;
  }

  private calculateShimmer(energyValues: number[]): number {
    if (energyValues.length < 2) return 0;
    
    let sumDiff = 0;
    for (let i = 1; i < energyValues.length; i++) {
      sumDiff += Math.abs(energyValues[i] - energyValues[i-1]);
    }
    
    const avgEnergy = this.calculateMean(energyValues);
    return avgEnergy > 0 ? (sumDiff / (energyValues.length - 1)) / avgEnergy : 0;
  }

  private calculateHNR(audioData: Float32Array, sampleRate: number): number {
    // Mock HNR calculation
    return 12 + Math.random() * 8; // 12-20 dB
  }

  private calculateSpectralSlope(audioData: Float32Array, sampleRate: number): number {
    // Mock spectral slope calculation
    return -0.01 + Math.random() * 0.02; // -0.01 to 0.01
  }

  private calculateFeatureMatch(
    value: number,
    min: number,
    max: number,
    typical: number
  ): number {
    if (value >= min && value <= max) {
      // Distance from typical value
      const distance = Math.abs(value - typical) / (max - min);
      return 1 - distance;
    }
    return 0;
  }

  private calculateVoiceQualityMatch(
    quality: AudioFeatures['voiceQuality'],
    thresholds: EmotionModel['audioPatterns']['voiceQualityThresholds']
  ): number {
    let score = 0;
    
    // Jitter matching
    if (quality.jitter <= thresholds.jitter * 1.5) score += 0.33;
    
    // Shimmer matching
    if (quality.shimmer <= thresholds.shimmer * 1.5) score += 0.33;
    
    // HNR matching
    if (quality.harmonicToNoiseRatio >= thresholds.hnr * 0.8) score += 0.34;
    
    return score;
  }

  // Classification methods

  private classifyVoiceQuality(features: AudioFeatures): EmotionResult['metadata']['voiceQuality'] {
    if (features.voiceQuality.harmonicToNoiseRatio < 8) return 'noisy';
    if (features.energy.mean < 0.1) return 'whispered';
    if (features.energy.mean > 0.8) return 'shouted';
    if (features.voiceQuality.jitter > 0.05 || features.voiceQuality.shimmer > 0.06) return 'distorted';
    return 'clear';
  }

  private classifySpeechRate(rate: number): EmotionResult['metadata']['speechRate'] {
    if (rate < 100) return 'very_slow';
    if (rate < 130) return 'slow';
    if (rate < 180) return 'normal';
    if (rate < 220) return 'fast';
    return 'very_fast';
  }

  private classifyPitchLevel(pitch: number): EmotionResult['metadata']['pitchLevel'] {
    if (pitch < 100) return 'very_low';
    if (pitch < 150) return 'low';
    if (pitch < 250) return 'normal';
    if (pitch < 350) return 'high';
    return 'very_high';
  }

  private classifyVolume(energy: number): EmotionResult['metadata']['volume'] {
    if (energy < 0.1) return 'whisper';
    if (energy < 0.3) return 'quiet';
    if (energy < 0.7) return 'normal';
    if (energy < 0.9) return 'loud';
    return 'shouting';
  }

  private calculateArticulationClarity(features: AudioFeatures): number {
    // Based on spectral characteristics and voice quality
    let clarity = 0.5;
    
    if (features.voiceQuality.harmonicToNoiseRatio > 15) clarity += 0.2;
    if (features.voiceQuality.jitter < 0.02) clarity += 0.15;
    if (features.voiceQuality.shimmer < 0.03) clarity += 0.15;
    
    return Math.max(0, Math.min(1, clarity));
  }

  private calculateStressLevel(features: AudioFeatures): number {
    let stress = 0;
    
    // High jitter and shimmer indicate stress
    stress += features.voiceQuality.jitter * 10;
    stress += features.voiceQuality.shimmer * 10;
    
    // High pitch variability can indicate stress
    if (features.pitch.std > 50) stress += 0.2;
    
    // Fast speech rate can indicate stress
    if (features.prosodic.speechRate > 200) stress += 0.3;
    
    return Math.max(0, Math.min(1, stress));
  }

  private inferSocialContext(features: AudioFeatures, textTranscript?: string): EmotionResult['contextualFactors']['socialContext'] {
    // Simple heuristics for social context
    if (features.prosodic.speechRate < 120 && features.pitch.mean < 200) return 'formal';
    if (textTranscript?.includes('sir') || textTranscript?.includes('madam')) return 'professional';
    if (features.energy.mean > 0.7) return 'informal';
    return 'personal';
  }

  private assessUrgency(features: AudioFeatures, textTranscript?: string): EmotionResult['contextualFactors']['urgency'] {
    let urgencyScore = 0;
    
    // Fast speech indicates urgency
    if (features.prosodic.speechRate > 200) urgencyScore += 2;
    
    // High energy indicates urgency
    if (features.energy.mean > 0.7) urgencyScore += 2;
    
    // High pitch indicates urgency
    if (features.pitch.mean > 300) urgencyScore += 1;
    
    // Text-based urgency indicators
    if (textTranscript) {
      const urgentWords = ['urgent', 'emergency', 'quickly', 'now', 'immediately', 'तुरंत', 'जल्दी'];
      const urgentMatches = urgentWords.filter(word => textTranscript.toLowerCase().includes(word)).length;
      urgencyScore += urgentMatches;
    }
    
    if (urgencyScore >= 4) return 'critical';
    if (urgencyScore >= 2) return 'high';
    if (urgencyScore >= 1) return 'medium';
    return 'low';
  }

  // Stress analysis methods

  private calculateStressIndicators(emotionResult: EmotionResult): number {
    let stressLevel = 0;
    
    // Emotion-based stress indicators
    stressLevel += emotionResult.emotionScores.stressed * 0.4;
    stressLevel += emotionResult.emotionScores.anxious * 0.3;
    stressLevel += emotionResult.emotionScores.frustrated * 0.2;
    stressLevel += emotionResult.emotionScores.angry * 0.1;
    
    // Voice quality indicators
    stressLevel += emotionResult.metadata.stressLevel * 0.3;
    
    // Arousal and intensity
    if (emotionResult.arousal > 0.7 && emotionResult.valence < 0.4) {
      stressLevel += 0.2; // High arousal, negative valence
    }
    
    return Math.max(0, Math.min(1, stressLevel));
  }

  private categorizeStressLevel(stressIndicators: number): 'low' | 'medium' | 'high' | 'critical' {
    if (stressIndicators > 0.8) return 'critical';
    if (stressIndicators > 0.6) return 'high';
    if (stressIndicators > 0.3) return 'medium';
    return 'low';
  }

  private calculateBurnoutRisk(
    emotionResult: EmotionResult,
    stressIndicators: number,
    workContext?: any
  ): number {
    let burnoutRisk = stressIndicators * 0.6;
    
    // Work context factors
    if (workContext?.duration && workContext.duration > 10) {
      burnoutRisk += 0.2; // Long work hours
    }
    
    if (workContext?.workload === 'heavy') {
      burnoutRisk += 0.1;
    }
    
    // Emotional exhaustion indicators
    if (emotionResult.emotionScores.tired > 0.6) burnoutRisk += 0.1;
    if (emotionResult.emotionScores.frustrated > 0.5) burnoutRisk += 0.1;
    
    return Math.max(0, Math.min(1, burnoutRisk));
  }

  private generateStressRecommendations(
    stressLevel: 'low' | 'medium' | 'high' | 'critical',
    emotionResult: EmotionResult
  ): string[] {
    const recommendations: string[] = [];
    
    switch (stressLevel) {
      case 'critical':
        recommendations.push('Immediate break required - remove from active duty');
        recommendations.push('Manager consultation needed');
        recommendations.push('Consider medical evaluation');
        break;
      case 'high':
        recommendations.push('Schedule extended break');
        recommendations.push('Reduce workload if possible');
        recommendations.push('Provide emotional support');
        break;
      case 'medium':
        recommendations.push('Monitor closely');
        recommendations.push('Offer short break');
        break;
      case 'low':
        recommendations.push('Continue normal operations');
        break;
    }
    
    return recommendations;
  }

  private generateStressInterventions(
    stressLevel: 'low' | 'medium' | 'high' | 'critical',
    burnoutRisk: number,
    workContext?: any
  ): Array<{
    type: 'break' | 'support' | 'reallocation' | 'medical';
    priority: 'low' | 'medium' | 'high' | 'urgent';
    description: string;
  }> {
    const interventions: Array<{
      type: 'break' | 'support' | 'reallocation' | 'medical';
      priority: 'low' | 'medium' | 'high' | 'urgent';
      description: string;
    }> = [];
    
    if (stressLevel === 'critical') {
      interventions.push({
        type: 'medical',
        priority: 'urgent',
        description: 'Immediate medical or psychological evaluation required'
      });
    }
    
    if (stressLevel === 'high' || stressLevel === 'critical') {
      interventions.push({
        type: 'break',
        priority: 'high',
        description: 'Extended break (30+ minutes) required immediately'
      });
    }
    
    if (burnoutRisk > 0.7) {
      interventions.push({
        type: 'reallocation',
        priority: 'high',
        description: 'Reassign to less demanding tasks or different shift'
      });
    }
    
    if (stressLevel === 'medium' || stressLevel === 'high') {
      interventions.push({
        type: 'support',
        priority: 'medium',
        description: 'Provide peer support or supervisor check-in'
      });
    }
    
    return interventions;
  }

  // Utility methods

  private createNeutralEmotionScores(): { [key in EmotionType]: number } {
    const scores: { [key in EmotionType]: number } = {} as any;
    const emotions: EmotionType[] = ['neutral', 'happy', 'sad', 'angry', 'frustrated', 'excited', 'calm', 'anxious', 'confident', 'tired', 'surprised', 'disgusted', 'stressed', 'satisfied', 'impatient'];
    
    emotions.forEach(emotion => {
      scores[emotion] = emotion === 'neutral' ? 0.9 : 0.01;
    });
    
    return scores;
  }

  private roundEmotionScores(scores: { [key in EmotionType]: number }): { [key in EmotionType]: number } {
    const rounded: { [key in EmotionType]: number } = {} as any;
    
    Object.entries(scores).forEach(([emotion, score]) => {
      rounded[emotion as EmotionType] = Math.round(score * 100) / 100;
    });
    
    return rounded;
  }

  private createDefaultEmotionResult(): EmotionResult {
    return {
      primaryEmotion: 'neutral',
      confidence: 0.5,
      emotionScores: this.createNeutralEmotionScores(),
      arousal: 0.5,
      valence: 0.5,
      intensity: 0.5,
      metadata: {
        voiceQuality: 'clear',
        speechRate: 'normal',
        pitchLevel: 'normal',
        volume: 'normal',
        articulationClarity: 0.7,
        stressLevel: 0.3
      },
      temporalAnalysis: {
        emotionTimeline: [],
        emotionTransitions: 0,
        stabilityScore: 0.5
      },
      contextualFactors: {
        background: 'restaurant',
        socialContext: 'professional',
        urgency: 'low'
      }
    };
  }

  private createMockEmotionResult(): EmotionResult {
    const emotions: EmotionType[] = ['neutral', 'happy', 'frustrated', 'satisfied', 'impatient'];
    const randomEmotion = emotions[Math.floor(Math.random() * emotions.length)];
    
    const scores = this.createNeutralEmotionScores();
    scores[randomEmotion] = 0.7 + Math.random() * 0.3;
    
    return {
      primaryEmotion: randomEmotion,
      confidence: 0.7 + Math.random() * 0.3,
      emotionScores: scores,
      arousal: Math.random(),
      valence: Math.random(),
      intensity: Math.random(),
      metadata: {
        voiceQuality: 'clear',
        speechRate: 'normal',
        pitchLevel: 'normal',
        volume: 'normal',
        articulationClarity: 0.7 + Math.random() * 0.3,
        stressLevel: Math.random() * 0.5
      },
      temporalAnalysis: {
        emotionTimeline: [],
        emotionTransitions: 0,
        stabilityScore: 0.7 + Math.random() * 0.3
      },
      contextualFactors: {
        background: 'restaurant',
        socialContext: 'professional',
        urgency: 'low'
      }
    };
  }

  private updateEmotionHistory(emotion: EmotionType, confidence: number): void {
    this.recentEmotions.push({
      emotion,
      confidence,
      timestamp: Date.now()
    });
    
    // Keep only last 100 emotions
    if (this.recentEmotions.length > 100) {
      this.recentEmotions = this.recentEmotions.slice(-100);
    }
  }

  public shutdown(): void {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.emotionModels.clear();
    this.recentEmotions = [];
    this.isInitialized = false;
  }
}