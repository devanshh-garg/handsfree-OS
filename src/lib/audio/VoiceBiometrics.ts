interface BiometricProfile {
  id: string;
  userId: string;
  name: string;
  voiceTemplate: number[];
  enrollmentSamples: BiometricSample[];
  securityLevel: 'low' | 'medium' | 'high' | 'critical';
  permissions: string[];
  metadata: {
    department: string;
    role: string;
    enrollmentDate: string;
    lastAuthentication?: string;
    authenticationCount: number;
    failedAttempts: number;
    isActive: boolean;
  };
  biometricFeatures: {
    voicePrint: number[];
    pitchPattern: number[];
    speechRate: number;
    pausePattern: number[];
    pronunciationMarkers: number[];
    spectralFeatures: number[];
  };
  adaptiveModel: {
    baseTemplate: number[];
    variations: number[][];
    confidenceThreshold: number;
    lastUpdate: string;
  };
}

interface BiometricSample {
  id: string;
  audioData: Float32Array;
  duration: number;
  quality: number;
  timestamp: string;
  phrase: string;
  features: VoiceFeatures;
}

interface VoiceFeatures {
  mfcc: number[];
  pitch: number[];
  formants: number[];
  spectralCentroid: number[];
  spectralRolloff: number[];
  zcr: number[];
  energy: number[];
  jitter: number;
  shimmer: number;
  harmonicToNoiseRatio: number;
}

interface AuthenticationResult {
  success: boolean;
  userId: string | null;
  confidence: number;
  securityLevel: BiometricProfile['securityLevel'];
  permissions: string[];
  metadata: {
    userName: string;
    department: string;
    role: string;
    lastAuthentication: string;
    sessionId: string;
    timestamp: string;
  };
  warnings: string[];
  debugInfo?: {
    templateSimilarity: number;
    livenessPassed: boolean;
    qualityScore: number;
    processingTime: number;
  };
}

interface EnrollmentResult {
  success: boolean;
  profileId: string | null;
  quality: number;
  samplesCollected: number;
  requiredSamples: number;
  nextPhrase?: string;
  feedback: string;
}

interface SecurityThresholds {
  low: { confidence: number; samples: number };
  medium: { confidence: number; samples: number };
  high: { confidence: number; samples: number };
  critical: { confidence: number; samples: number };
}

export class VoiceBiometrics {
  private static instance: VoiceBiometrics;
  
  private profiles: Map<string, BiometricProfile> = new Map();
  private audioContext: AudioContext | null = null;
  private isInitialized: boolean = false;
  
  private securityThresholds: SecurityThresholds = {
    low: { confidence: 0.6, samples: 3 },
    medium: { confidence: 0.75, samples: 5 },
    high: { confidence: 0.85, samples: 8 },
    critical: { confidence: 0.95, samples: 12 }
  };

  private enrollmentPhrases = [
    'My voice is my passport, verify me',
    'I am the manager of this restaurant',
    'Table service is our priority',
    'Kitchen operations must run smoothly',
    'Customer satisfaction is everything',
    'Food safety comes first always',
    'Team coordination is essential',
    'Quality control is my responsibility'
  ];

  private authenticationPhrases = [
    'Authenticate my voice access',
    'Grant me system permissions',
    'Verify my identity now',
    'I need access to the system'
  ];

  // Demo profiles for restaurant staff
  private demoProfiles: Partial<BiometricProfile>[] = [
    {
      id: 'bio_manager_001',
      userId: 'manager_raj',
      name: 'Raj Kumar',
      securityLevel: 'critical',
      permissions: ['all_access', 'staff_management', 'financial_data', 'emergency_protocols'],
      metadata: {
        department: 'Management',
        role: 'Restaurant Manager',
        enrollmentDate: new Date().toISOString(),
        authenticationCount: 0,
        failedAttempts: 0,
        isActive: true
      }
    },
    {
      id: 'bio_chef_002',
      userId: 'chef_amit',
      name: 'Amit Singh',
      securityLevel: 'high',
      permissions: ['kitchen_management', 'inventory_access', 'staff_coordination'],
      metadata: {
        department: 'Kitchen',
        role: 'Head Chef',
        enrollmentDate: new Date().toISOString(),
        authenticationCount: 0,
        failedAttempts: 0,
        isActive: true
      }
    },
    {
      id: 'bio_waiter_003',
      userId: 'waiter_priya',
      name: 'Priya Sharma',
      securityLevel: 'medium',
      permissions: ['table_management', 'order_access', 'customer_service'],
      metadata: {
        department: 'Service',
        role: 'Senior Waiter',
        enrollmentDate: new Date().toISOString(),
        authenticationCount: 0,
        failedAttempts: 0,
        isActive: true
      }
    }
  ];

  private constructor() {}

  public static getInstance(): VoiceBiometrics {
    if (!VoiceBiometrics.instance) {
      VoiceBiometrics.instance = new VoiceBiometrics();
    }
    return VoiceBiometrics.instance;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Initialize demo profiles with mock biometric data
      await this.initializeDemoProfiles();

      this.isInitialized = true;
      console.log('VoiceBiometrics: Initialized with', this.profiles.size, 'biometric profiles');
    } catch (error) {
      console.error('VoiceBiometrics: Initialization failed', error);
      throw error;
    }
  }

  public async startEnrollment(
    userId: string,
    userName: string,
    department: string,
    role: string,
    securityLevel: BiometricProfile['securityLevel'] = 'medium',
    permissions: string[] = []
  ): Promise<{ profileId: string; nextPhrase: string }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const profileId = `bio_${userId}_${Date.now()}`;
    
    const profile: BiometricProfile = {
      id: profileId,
      userId,
      name: userName,
      voiceTemplate: [],
      enrollmentSamples: [],
      securityLevel,
      permissions,
      metadata: {
        department,
        role,
        enrollmentDate: new Date().toISOString(),
        authenticationCount: 0,
        failedAttempts: 0,
        isActive: false // Will be activated after successful enrollment
      },
      biometricFeatures: {
        voicePrint: [],
        pitchPattern: [],
        speechRate: 0,
        pausePattern: [],
        pronunciationMarkers: [],
        spectralFeatures: []
      },
      adaptiveModel: {
        baseTemplate: [],
        variations: [],
        confidenceThreshold: this.securityThresholds[securityLevel].confidence,
        lastUpdate: new Date().toISOString()
      }
    };

    this.profiles.set(profileId, profile);
    
    console.log(`VoiceBiometrics: Started enrollment for ${userName} (${profileId})`);
    
    return {
      profileId,
      nextPhrase: this.enrollmentPhrases[0]
    };
  }

  public async addEnrollmentSample(
    profileId: string,
    audioData: Float32Array,
    phrase: string,
    sampleRate: number = 16000
  ): Promise<EnrollmentResult> {
    const profile = this.profiles.get(profileId);
    if (!profile) {
      return {
        success: false,
        profileId: null,
        quality: 0,
        samplesCollected: 0,
        requiredSamples: 0,
        feedback: 'Profile not found'
      };
    }

    try {
      // Extract voice features
      const features = await this.extractVoiceFeatures(audioData, sampleRate);
      
      // Calculate sample quality
      const quality = this.calculateSampleQuality(audioData, features);
      
      if (quality < 0.6) {
        return {
          success: false,
          profileId,
          quality,
          samplesCollected: profile.enrollmentSamples.length,
          requiredSamples: this.securityThresholds[profile.securityLevel].samples,
          feedback: 'Sample quality too low. Please speak clearly in a quiet environment.'
        };
      }

      // Add sample to enrollment
      const sample: BiometricSample = {
        id: `sample_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        audioData,
        duration: audioData.length / sampleRate,
        quality,
        timestamp: new Date().toISOString(),
        phrase,
        features
      };

      profile.enrollmentSamples.push(sample);
      
      const requiredSamples = this.securityThresholds[profile.securityLevel].samples;
      const samplesCollected = profile.enrollmentSamples.length;
      
      // Check if enrollment is complete
      if (samplesCollected >= requiredSamples) {
        await this.completeEnrollment(profileId);
        
        return {
          success: true,
          profileId,
          quality,
          samplesCollected,
          requiredSamples,
          feedback: 'Enrollment completed successfully! Your voice profile is now active.'
        };
      } else {
        // Provide next phrase
        const nextPhraseIndex = samplesCollected % this.enrollmentPhrases.length;
        
        return {
          success: true,
          profileId,
          quality,
          samplesCollected,
          requiredSamples,
          nextPhrase: this.enrollmentPhrases[nextPhraseIndex],
          feedback: `Sample ${samplesCollected}/${requiredSamples} recorded successfully.`
        };
      }
    } catch (error) {
      console.error('VoiceBiometrics: Enrollment sample processing failed', error);
      return {
        success: false,
        profileId,
        quality: 0,
        samplesCollected: profile.enrollmentSamples.length,
        requiredSamples: this.securityThresholds[profile.securityLevel].samples,
        feedback: 'Error processing voice sample. Please try again.'
      };
    }
  }

  public async authenticate(
    audioData: Float32Array,
    phrase?: string,
    sampleRate: number = 16000,
    allowedUsers?: string[]
  ): Promise<AuthenticationResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const sessionId = `auth_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    try {
      // Extract features from input audio
      const inputFeatures = await this.extractVoiceFeatures(audioData, sampleRate);
      
      // Calculate quality score
      const qualityScore = this.calculateSampleQuality(audioData, inputFeatures);
      
      if (qualityScore < 0.4) {
        return this.createFailedAuthResult(sessionId, 'Audio quality too low for authentication', startTime);
      }

      // Perform liveness detection
      const livenessPassed = await this.performLivenessDetection(audioData, inputFeatures);
      if (!livenessPassed) {
        return this.createFailedAuthResult(sessionId, 'Liveness detection failed', startTime);
      }

      // Generate voice template from input
      const inputTemplate = this.generateVoiceTemplate(inputFeatures);
      
      let bestMatch: {
        profile: BiometricProfile;
        similarity: number;
        confidence: number;
      } | null = null;

      // Compare against all active profiles (or filtered list)
      for (const profile of this.profiles.values()) {
        if (!profile.metadata.isActive) continue;
        if (allowedUsers && !allowedUsers.includes(profile.userId)) continue;

        const similarity = this.calculateTemplateSimilarity(inputTemplate, profile.voiceTemplate);
        const confidence = this.calculateAuthenticationConfidence(similarity, profile, inputFeatures);
        
        if (!bestMatch || confidence > bestMatch.confidence) {
          bestMatch = { profile, similarity, confidence };
        }
      }

      if (!bestMatch || bestMatch.confidence < bestMatch.profile.adaptiveModel.confidenceThreshold) {
        return this.createFailedAuthResult(sessionId, 'Voice not recognized or confidence too low', startTime);
      }

      // Successful authentication
      const profile = bestMatch.profile;
      
      // Update profile statistics
      profile.metadata.lastAuthentication = new Date().toISOString();
      profile.metadata.authenticationCount++;
      profile.metadata.failedAttempts = 0; // Reset failed attempts on success

      // Adaptive learning - update template with new sample
      await this.updateAdaptiveModel(profile, inputFeatures);

      const result: AuthenticationResult = {
        success: true,
        userId: profile.userId,
        confidence: Math.round(bestMatch.confidence * 100) / 100,
        securityLevel: profile.securityLevel,
        permissions: [...profile.permissions],
        metadata: {
          userName: profile.name,
          department: profile.metadata.department,
          role: profile.metadata.role,
          lastAuthentication: profile.metadata.lastAuthentication,
          sessionId,
          timestamp: new Date().toISOString()
        },
        warnings: this.generateSecurityWarnings(profile, bestMatch.confidence),
        debugInfo: {
          templateSimilarity: Math.round(bestMatch.similarity * 100) / 100,
          livenessPassed,
          qualityScore: Math.round(qualityScore * 100) / 100,
          processingTime: Date.now() - startTime
        }
      };

      console.log(`VoiceBiometrics: Authentication successful for ${profile.name} (confidence: ${result.confidence})`);
      return result;

    } catch (error) {
      console.error('VoiceBiometrics: Authentication failed', error);
      return this.createFailedAuthResult(sessionId, 'Authentication processing error', startTime);
    }
  }

  public async verifyIdentity(
    userId: string,
    audioData: Float32Array,
    sampleRate: number = 16000
  ): Promise<{ verified: boolean; confidence: number; profile?: BiometricProfile }> {
    const profile = Array.from(this.profiles.values()).find(p => p.userId === userId);
    
    if (!profile || !profile.metadata.isActive) {
      return { verified: false, confidence: 0 };
    }

    try {
      const inputFeatures = await this.extractVoiceFeatures(audioData, sampleRate);
      const inputTemplate = this.generateVoiceTemplate(inputFeatures);
      
      const similarity = this.calculateTemplateSimilarity(inputTemplate, profile.voiceTemplate);
      const confidence = this.calculateAuthenticationConfidence(similarity, profile, inputFeatures);
      
      const verified = confidence >= profile.adaptiveModel.confidenceThreshold;
      
      return {
        verified,
        confidence: Math.round(confidence * 100) / 100,
        profile: verified ? profile : undefined
      };
    } catch (error) {
      console.error('VoiceBiometrics: Identity verification failed', error);
      return { verified: false, confidence: 0 };
    }
  }

  public getAllProfiles(): BiometricProfile[] {
    return Array.from(this.profiles.values());
  }

  public getProfile(profileId: string): BiometricProfile | null {
    return this.profiles.get(profileId) || null;
  }

  public getUserProfile(userId: string): BiometricProfile | null {
    return Array.from(this.profiles.values()).find(p => p.userId === userId) || null;
  }

  public deactivateProfile(profileId: string): boolean {
    const profile = this.profiles.get(profileId);
    if (profile) {
      profile.metadata.isActive = false;
      console.log(`VoiceBiometrics: Deactivated profile ${profileId}`);
      return true;
    }
    return false;
  }

  public deleteProfile(profileId: string): boolean {
    const success = this.profiles.delete(profileId);
    if (success) {
      console.log(`VoiceBiometrics: Deleted profile ${profileId}`);
    }
    return success;
  }

  public updateSecurityLevel(profileId: string, newLevel: BiometricProfile['securityLevel']): boolean {
    const profile = this.profiles.get(profileId);
    if (profile) {
      profile.securityLevel = newLevel;
      profile.adaptiveModel.confidenceThreshold = this.securityThresholds[newLevel].confidence;
      console.log(`VoiceBiometrics: Updated security level for ${profileId} to ${newLevel}`);
      return true;
    }
    return false;
  }

  public getRandomAuthPhrase(): string {
    return this.authenticationPhrases[Math.floor(Math.random() * this.authenticationPhrases.length)];
  }

  public getSystemStats(): {
    totalProfiles: number;
    activeProfiles: number;
    totalAuthentications: number;
    averageConfidence: number;
    securityLevelDistribution: { [key: string]: number };
  } {
    const profiles = Array.from(this.profiles.values());
    const activeProfiles = profiles.filter(p => p.metadata.isActive);
    
    const totalAuthentications = profiles.reduce((sum, p) => sum + p.metadata.authenticationCount, 0);
    
    const securityLevels = { low: 0, medium: 0, high: 0, critical: 0 };
    profiles.forEach(p => securityLevels[p.securityLevel]++);

    return {
      totalProfiles: profiles.length,
      activeProfiles: activeProfiles.length,
      totalAuthentications,
      averageConfidence: 0.85, // Mock average
      securityLevelDistribution: securityLevels
    };
  }

  // Private methods

  private async initializeDemoProfiles(): Promise<void> {
    for (const demoProfile of this.demoProfiles) {
      const fullProfile: BiometricProfile = {
        ...demoProfile,
        voiceTemplate: this.generateMockVoiceTemplate(),
        enrollmentSamples: [],
        biometricFeatures: {
          voicePrint: this.generateMockVoicePrint(),
          pitchPattern: this.generateMockPitchPattern(),
          speechRate: 150 + Math.random() * 50,
          pausePattern: this.generateMockPausePattern(),
          pronunciationMarkers: this.generateMockPronunciationMarkers(),
          spectralFeatures: this.generateMockSpectralFeatures()
        },
        adaptiveModel: {
          baseTemplate: this.generateMockVoiceTemplate(),
          variations: [this.generateMockVoiceTemplate(), this.generateMockVoiceTemplate()],
          confidenceThreshold: this.securityThresholds[demoProfile.securityLevel!].confidence,
          lastUpdate: new Date().toISOString()
        }
      } as BiometricProfile;

      // Mark as active for demo
      fullProfile.metadata.isActive = true;
      
      this.profiles.set(fullProfile.id, fullProfile);
    }
  }

  private async completeEnrollment(profileId: string): Promise<void> {
    const profile = this.profiles.get(profileId);
    if (!profile) return;

    // Generate voice template from enrollment samples
    profile.voiceTemplate = this.generateTemplateFromSamples(profile.enrollmentSamples);
    
    // Extract biometric features
    profile.biometricFeatures = this.extractBiometricFeatures(profile.enrollmentSamples);
    
    // Initialize adaptive model
    profile.adaptiveModel.baseTemplate = [...profile.voiceTemplate];
    profile.adaptiveModel.variations = [profile.voiceTemplate];
    
    // Activate profile
    profile.metadata.isActive = true;
    
    console.log(`VoiceBiometrics: Completed enrollment for profile ${profileId}`);
  }

  private async extractVoiceFeatures(audioData: Float32Array, sampleRate: number): Promise<VoiceFeatures> {
    // This would typically use advanced DSP libraries
    // For demo purposes, we'll generate realistic mock features
    
    const frameSize = 1024;
    const hopSize = 512;
    const numFrames = Math.floor((audioData.length - frameSize) / hopSize) + 1;
    
    const features: VoiceFeatures = {
      mfcc: [],
      pitch: [],
      formants: [],
      spectralCentroid: [],
      spectralRolloff: [],
      zcr: [],
      energy: [],
      jitter: 0,
      shimmer: 0,
      harmonicToNoiseRatio: 0
    };

    // Extract frame-based features
    for (let i = 0; i < numFrames; i++) {
      const start = i * hopSize;
      const end = Math.min(start + frameSize, audioData.length);
      const frame = audioData.slice(start, end);
      
      // Calculate various features (simplified versions)
      features.energy.push(this.calculateEnergy(frame));
      features.pitch.push(this.calculatePitch(frame, sampleRate));
      features.spectralCentroid.push(this.calculateSpectralCentroid(frame, sampleRate));
      features.spectralRolloff.push(this.calculateSpectralRolloff(frame, sampleRate));
      features.zcr.push(this.calculateZeroCrossingRate(frame));
      
      // MFCC coefficients (simplified)
      const mfccFrame = this.calculateMFCC(frame, sampleRate);
      features.mfcc.push(...mfccFrame.slice(0, 2)); // First 2 coefficients per frame
    }

    // Calculate global features
    features.formants = this.extractFormants(audioData, sampleRate);
    features.jitter = this.calculateJitter(features.pitch);
    features.shimmer = this.calculateShimmer(features.energy);
    features.harmonicToNoiseRatio = this.calculateHNR(audioData, sampleRate);

    return features;
  }

  private generateVoiceTemplate(features: VoiceFeatures): number[] {
    const template: number[] = [];
    
    // Aggregate MFCC features
    const mfccAvg = this.calculateAverage(features.mfcc);
    template.push(mfccAvg);
    
    // Pitch statistics
    const pitchMean = this.calculateAverage(features.pitch.filter(p => p > 0));
    const pitchStd = this.calculateStandardDeviation(features.pitch.filter(p => p > 0));
    template.push(pitchMean, pitchStd);
    
    // Spectral features
    template.push(
      this.calculateAverage(features.spectralCentroid),
      this.calculateAverage(features.spectralRolloff),
      this.calculateAverage(features.zcr)
    );
    
    // Formant features
    template.push(...features.formants.slice(0, 3));
    
    // Voice quality features
    template.push(features.jitter, features.shimmer, features.harmonicToNoiseRatio);
    
    return template;
  }

  private calculateTemplateSimilarity(template1: number[], template2: number[]): number {
    if (template1.length !== template2.length) return 0;
    
    // Normalize templates
    const norm1 = this.normalizeVector(template1);
    const norm2 = this.normalizeVector(template2);
    
    // Calculate cosine similarity
    let dotProduct = 0;
    let norm1Sq = 0;
    let norm2Sq = 0;
    
    for (let i = 0; i < norm1.length; i++) {
      dotProduct += norm1[i] * norm2[i];
      norm1Sq += norm1[i] * norm1[i];
      norm2Sq += norm2[i] * norm2[i];
    }
    
    const similarity = dotProduct / (Math.sqrt(norm1Sq) * Math.sqrt(norm2Sq));
    return Math.max(0, Math.min(1, (similarity + 1) / 2));
  }

  private calculateAuthenticationConfidence(
    similarity: number,
    profile: BiometricProfile,
    inputFeatures: VoiceFeatures
  ): number {
    let confidence = similarity;
    
    // Apply security level adjustments
    switch (profile.securityLevel) {
      case 'low':
        confidence *= 1.1;
        break;
      case 'medium':
        confidence *= 1.0;
        break;
      case 'high':
        confidence *= 0.95;
        break;
      case 'critical':
        confidence *= 0.9;
        break;
    }
    
    // Quality bonus
    const qualityScore = this.calculateSampleQuality(new Float32Array(), inputFeatures);
    confidence += (qualityScore - 0.5) * 0.1;
    
    // Authentication history bonus (more authentications = higher confidence)
    const historyBonus = Math.min(0.05, profile.metadata.authenticationCount * 0.001);
    confidence += historyBonus;
    
    return Math.max(0, Math.min(1, confidence));
  }

  private async performLivenessDetection(audioData: Float32Array, features: VoiceFeatures): Promise<boolean> {
    // Simplified liveness detection
    // In a real system, this would check for:
    // - Natural speech patterns
    // - Micro-variations in voice
    // - Background noise characteristics
    // - Anti-spoofing measures
    
    const energyVariation = this.calculateStandardDeviation(features.energy);
    const pitchVariation = this.calculateStandardDeviation(features.pitch.filter(p => p > 0));
    
    // Check for sufficient variation (indicates live speech)
    const hasEnergyVariation = energyVariation > 0.01;
    const hasPitchVariation = pitchVariation > 5;
    const sufficientDuration = audioData.length > 16000; // > 1 second at 16kHz
    
    return hasEnergyVariation && hasPitchVariation && sufficientDuration;
  }

  private calculateSampleQuality(audioData: Float32Array, features: VoiceFeatures): number {
    let qualityScore = 0.5; // Base score
    
    // Signal-to-noise ratio estimate
    const avgEnergy = this.calculateAverage(features.energy);
    const energyStd = this.calculateStandardDeviation(features.energy);
    const snrEstimate = avgEnergy / (energyStd + 1e-10);
    
    if (snrEstimate > 10) qualityScore += 0.2;
    if (snrEstimate > 20) qualityScore += 0.1;
    
    // Pitch consistency (good for voice quality)
    const validPitch = features.pitch.filter(p => p > 50 && p < 500);
    const pitchConsistency = validPitch.length / features.pitch.length;
    qualityScore += pitchConsistency * 0.2;
    
    // Spectral richness
    const avgSpectralCentroid = this.calculateAverage(features.spectralCentroid);
    if (avgSpectralCentroid > 1000 && avgSpectralCentroid < 4000) {
      qualityScore += 0.1;
    }
    
    return Math.max(0, Math.min(1, qualityScore));
  }

  private async updateAdaptiveModel(profile: BiometricProfile, newFeatures: VoiceFeatures): Promise<void> {
    // Adaptive learning to improve template over time
    const newTemplate = this.generateVoiceTemplate(newFeatures);
    
    // Weighted average with existing template (90% old, 10% new)
    const adaptationRate = 0.1;
    for (let i = 0; i < profile.voiceTemplate.length && i < newTemplate.length; i++) {
      profile.voiceTemplate[i] = profile.voiceTemplate[i] * (1 - adaptationRate) + 
                                newTemplate[i] * adaptationRate;
    }
    
    // Add variation if significantly different
    const similarity = this.calculateTemplateSimilarity(newTemplate, profile.adaptiveModel.baseTemplate);
    if (similarity < 0.9 && profile.adaptiveModel.variations.length < 5) {
      profile.adaptiveModel.variations.push(newTemplate);
    }
    
    profile.adaptiveModel.lastUpdate = new Date().toISOString();
  }

  private generateTemplateFromSamples(samples: BiometricSample[]): number[] {
    if (samples.length === 0) return [];
    
    // Average features across all enrollment samples
    const allTemplates = samples.map(sample => this.generateVoiceTemplate(sample.features));
    
    const templateLength = allTemplates[0].length;
    const avgTemplate = new Array(templateLength).fill(0);
    
    for (const template of allTemplates) {
      for (let i = 0; i < templateLength; i++) {
        avgTemplate[i] += template[i] / allTemplates.length;
      }
    }
    
    return avgTemplate;
  }

  private extractBiometricFeatures(samples: BiometricSample[]): BiometricProfile['biometricFeatures'] {
    if (samples.length === 0) {
      return {
        voicePrint: [],
        pitchPattern: [],
        speechRate: 0,
        pausePattern: [],
        pronunciationMarkers: [],
        spectralFeatures: []
      };
    }
    
    // Aggregate features from all samples
    const allFeatures = samples.map(s => s.features);
    
    return {
      voicePrint: this.aggregateFeatures(allFeatures, 'mfcc'),
      pitchPattern: this.aggregateFeatures(allFeatures, 'pitch'),
      speechRate: this.calculateSpeechRate(samples),
      pausePattern: this.extractPausePattern(samples),
      pronunciationMarkers: this.extractPronunciationMarkers(allFeatures),
      spectralFeatures: this.aggregateFeatures(allFeatures, 'spectralCentroid')
    };
  }

  private createFailedAuthResult(sessionId: string, reason: string, startTime: number): AuthenticationResult {
    return {
      success: false,
      userId: null,
      confidence: 0,
      securityLevel: 'low',
      permissions: [],
      metadata: {
        userName: '',
        department: '',
        role: '',
        lastAuthentication: '',
        sessionId,
        timestamp: new Date().toISOString()
      },
      warnings: [reason],
      debugInfo: {
        templateSimilarity: 0,
        livenessPassed: false,
        qualityScore: 0,
        processingTime: Date.now() - startTime
      }
    };
  }

  private generateSecurityWarnings(profile: BiometricProfile, confidence: number): string[] {
    const warnings: string[] = [];
    
    if (confidence < profile.adaptiveModel.confidenceThreshold + 0.1) {
      warnings.push('Authentication confidence is close to threshold');
    }
    
    if (profile.metadata.failedAttempts > 2) {
      warnings.push('Multiple recent failed attempts detected');
    }
    
    if (profile.metadata.lastAuthentication) {
      const lastAuth = new Date(profile.metadata.lastAuthentication);
      const daysSinceLastAuth = (Date.now() - lastAuth.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysSinceLastAuth > 30) {
        warnings.push('Long time since last authentication');
      }
    }
    
    return warnings;
  }

  // Audio processing utility methods (simplified versions)

  private calculateEnergy(frame: Float32Array): number {
    let energy = 0;
    for (let i = 0; i < frame.length; i++) {
      energy += frame[i] * frame[i];
    }
    return Math.sqrt(energy / frame.length);
  }

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

  private calculateSpectralCentroid(frame: Float32Array, sampleRate: number): number {
    // Simplified spectral centroid calculation
    return 2000 + Math.random() * 1000; // Mock implementation
  }

  private calculateSpectralRolloff(frame: Float32Array, sampleRate: number): number {
    // Simplified spectral rolloff calculation
    return 3000 + Math.random() * 2000; // Mock implementation
  }

  private calculateZeroCrossingRate(frame: Float32Array): number {
    let crossings = 0;
    for (let i = 1; i < frame.length; i++) {
      if ((frame[i] >= 0) !== (frame[i-1] >= 0)) {
        crossings++;
      }
    }
    return crossings / frame.length;
  }

  private calculateMFCC(frame: Float32Array, sampleRate: number): number[] {
    // Simplified MFCC calculation - returns mock coefficients
    return Array.from({length: 12}, () => Math.random() * 20 - 10);
  }

  private extractFormants(audioData: Float32Array, sampleRate: number): number[] {
    // Mock formant extraction - would use LPC in real implementation
    return [700 + Math.random() * 200, 1200 + Math.random() * 300, 2500 + Math.random() * 500];
  }

  private calculateJitter(pitchValues: number[]): number {
    const validPitch = pitchValues.filter(p => p > 0);
    if (validPitch.length < 2) return 0;
    
    let sumDiff = 0;
    for (let i = 1; i < validPitch.length; i++) {
      sumDiff += Math.abs(validPitch[i] - validPitch[i-1]);
    }
    
    const avgPitch = this.calculateAverage(validPitch);
    return avgPitch > 0 ? (sumDiff / (validPitch.length - 1)) / avgPitch : 0;
  }

  private calculateShimmer(energyValues: number[]): number {
    if (energyValues.length < 2) return 0;
    
    let sumDiff = 0;
    for (let i = 1; i < energyValues.length; i++) {
      sumDiff += Math.abs(energyValues[i] - energyValues[i-1]);
    }
    
    const avgEnergy = this.calculateAverage(energyValues);
    return avgEnergy > 0 ? (sumDiff / (energyValues.length - 1)) / avgEnergy : 0;
  }

  private calculateHNR(audioData: Float32Array, sampleRate: number): number {
    // Simplified Harmonic-to-Noise Ratio calculation
    return 15 + Math.random() * 10; // Mock value in dB
  }

  // Statistical utility methods

  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private calculateStandardDeviation(values: number[]): number {
    if (values.length === 0) return 0;
    
    const mean = this.calculateAverage(values);
    const squaredDiffs = values.map(val => (val - mean) ** 2);
    const avgSquaredDiff = this.calculateAverage(squaredDiffs);
    
    return Math.sqrt(avgSquaredDiff);
  }

  private normalizeVector(vector: number[]): number[] {
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return magnitude > 0 ? vector.map(val => val / magnitude) : vector;
  }

  // Mock data generation methods for demo

  private generateMockVoiceTemplate(): number[] {
    return Array.from({length: 12}, () => Math.random() * 2 - 1);
  }

  private generateMockVoicePrint(): number[] {
    return Array.from({length: 20}, () => Math.random());
  }

  private generateMockPitchPattern(): number[] {
    return Array.from({length: 10}, () => 100 + Math.random() * 200);
  }

  private generateMockPausePattern(): number[] {
    return Array.from({length: 5}, () => Math.random() * 0.5);
  }

  private generateMockPronunciationMarkers(): number[] {
    return Array.from({length: 8}, () => Math.random());
  }

  private generateMockSpectralFeatures(): number[] {
    return Array.from({length: 6}, () => 1000 + Math.random() * 3000);
  }

  private aggregateFeatures(allFeatures: VoiceFeatures[], featureType: keyof VoiceFeatures): number[] {
    // Aggregate specific feature type across all samples
    const aggregated: number[] = [];
    
    for (const features of allFeatures) {
      const feature = features[featureType];
      if (Array.isArray(feature)) {
        aggregated.push(...feature.slice(0, 5)); // Take first 5 values
      }
    }
    
    return aggregated;
  }

  private calculateSpeechRate(samples: BiometricSample[]): number {
    // Estimate words per minute from samples
    const totalDuration = samples.reduce((sum, sample) => sum + sample.duration, 0);
    const estimatedWords = samples.length * 3; // Assume ~3 words per phrase
    
    return totalDuration > 0 ? (estimatedWords / totalDuration) * 60 : 0;
  }

  private extractPausePattern(samples: BiometricSample[]): number[] {
    // Extract pause characteristics from samples
    return samples.map(sample => Math.random() * 0.3); // Mock pause durations
  }

  private extractPronunciationMarkers(allFeatures: VoiceFeatures[]): number[] {
    // Extract pronunciation characteristics
    return Array.from({length: 10}, () => Math.random());
  }

  public shutdown(): void {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.profiles.clear();
    this.isInitialized = false;
  }
}