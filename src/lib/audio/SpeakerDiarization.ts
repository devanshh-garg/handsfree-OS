interface SpeakerProfile {
  id: string;
  name: string;
  voicePrint: number[];
  characteristics: {
    fundamentalFrequency: number;
    spectralCentroid: number;
    spectralRolloff: number;
    mfccCoefficients: number[];
    formantFrequencies: number[];
  };
  enrollmentDate: string;
  confidence: number;
  sampleCount: number;
  metadata?: {
    role?: string;
    department?: string;
    shift?: string;
    permissions?: string[];
  };
}

interface SpeechSegment {
  id: string;
  startTime: number;
  endTime: number;
  duration: number;
  audioData: Float32Array;
  speakerId?: string;
  confidence: number;
  features: AudioFeatures;
  transcript?: string;
}

interface AudioFeatures {
  mfcc: number[];
  pitch: number[];
  energy: number[];
  spectralFeatures: {
    centroid: number[];
    rolloff: number[];
    flux: number[];
    bandwidth: number[];
  };
  voiceActivityDetection: boolean[];
}

interface DiarizationResult {
  segments: SpeechSegment[];
  speakers: {
    id: string;
    segments: number;
    totalDuration: number;
    confidence: number;
    name?: string;
  }[];
  totalDuration: number;
  overlapDetected: boolean;
  qualityScore: number;
}

interface DiarizationConfig {
  minSegmentDuration: number;
  maxSpeakers: number;
  overlapThreshold: number;
  silenceThreshold: number;
  frameSize: number;
  hopSize: number;
  enableVAD: boolean;
  clusteringMethod: 'kmeans' | 'hierarchical' | 'spectral';
}

export class SpeakerDiarization {
  private static instance: SpeakerDiarization;
  
  private speakerProfiles: Map<string, SpeakerProfile> = new Map();
  private audioContext: AudioContext | null = null;
  private config: DiarizationConfig;
  private isInitialized: boolean = false;
  
  // Restaurant staff profiles (mock data for demo)
  private defaultProfiles: SpeakerProfile[] = [
    {
      id: 'manager_001',
      name: 'Raj Kumar (Manager)',
      voicePrint: [0.8, 0.3, 0.6, 0.9, 0.2, 0.7, 0.4, 0.8, 0.5, 0.3],
      characteristics: {
        fundamentalFrequency: 140,
        spectralCentroid: 2500,
        spectralRolloff: 4000,
        mfccCoefficients: [12.5, -8.3, 4.7, -2.1, 6.8, -3.4, 1.9, -5.2, 3.6, -1.8],
        formantFrequencies: [730, 1090, 2440]
      },
      enrollmentDate: new Date().toISOString(),
      confidence: 0.92,
      sampleCount: 15,
      metadata: {
        role: 'Manager',
        department: 'Management',
        shift: 'All',
        permissions: ['order_management', 'staff_coordination', 'emergency_protocols']
      }
    },
    {
      id: 'waiter_002',
      name: 'Priya Sharma (Waiter)',
      voicePrint: [0.4, 0.8, 0.2, 0.6, 0.9, 0.3, 0.7, 0.5, 0.8, 0.4],
      characteristics: {
        fundamentalFrequency: 220,
        spectralCentroid: 3200,
        spectralRolloff: 5200,
        mfccCoefficients: [10.2, -6.7, 8.1, -4.3, 5.9, -7.2, 2.8, -3.5, 4.1, -2.6],
        formantFrequencies: [850, 1220, 2890]
      },
      enrollmentDate: new Date().toISOString(),
      confidence: 0.87,
      sampleCount: 12,
      metadata: {
        role: 'Waiter',
        department: 'Service',
        shift: 'Day',
        permissions: ['table_management', 'order_taking', 'customer_service']
      }
    },
    {
      id: 'chef_003',
      name: 'Amit Singh (Chef)',
      voicePrint: [0.6, 0.2, 0.9, 0.4, 0.7, 0.8, 0.3, 0.6, 0.2, 0.9],
      characteristics: {
        fundamentalFrequency: 125,
        spectralCentroid: 2100,
        spectralRolloff: 3800,
        mfccCoefficients: [14.8, -9.2, 3.4, -6.7, 8.1, -2.9, 5.3, -4.8, 2.7, -3.1],
        formantFrequencies: [680, 980, 2200]
      },
      enrollmentDate: new Date().toISOString(),
      confidence: 0.89,
      sampleCount: 18,
      metadata: {
        role: 'Chef',
        department: 'Kitchen',
        shift: 'Day',
        permissions: ['kitchen_management', 'order_preparation', 'inventory_alerts']
      }
    }
  ];

  private constructor() {
    this.config = {
      minSegmentDuration: 0.5, // seconds
      maxSpeakers: 10,
      overlapThreshold: 0.3,
      silenceThreshold: -40, // dB
      frameSize: 2048,
      hopSize: 512,
      enableVAD: true,
      clusteringMethod: 'kmeans'
    };
  }

  public static getInstance(): SpeakerDiarization {
    if (!SpeakerDiarization.instance) {
      SpeakerDiarization.instance = new SpeakerDiarization();
    }
    return SpeakerDiarization.instance;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Load default speaker profiles
      this.defaultProfiles.forEach(profile => {
        this.speakerProfiles.set(profile.id, profile);
      });

      this.isInitialized = true;
      console.log('SpeakerDiarization: Initialized with', this.speakerProfiles.size, 'speaker profiles');
    } catch (error) {
      console.error('SpeakerDiarization: Initialization failed', error);
      throw error;
    }
  }

  public async processAudioStream(audioData: Float32Array, sampleRate: number = 16000): Promise<DiarizationResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Step 1: Voice Activity Detection
      const vadResults = this.detectVoiceActivity(audioData, sampleRate);
      
      // Step 2: Segment audio based on VAD
      const speechSegments = this.segmentAudio(audioData, vadResults, sampleRate);
      
      // Step 3: Extract features for each segment
      const segmentsWithFeatures = await Promise.all(
        speechSegments.map(segment => this.extractFeatures(segment, sampleRate))
      );
      
      // Step 4: Speaker identification/clustering
      const identifiedSegments = await this.identifySpeakers(segmentsWithFeatures);
      
      // Step 5: Post-processing and cleanup
      const finalSegments = this.postProcessSegments(identifiedSegments);
      
      // Step 6: Generate result summary
      const result = this.generateDiarizationResult(finalSegments, audioData.length / sampleRate);
      
      return result;
    } catch (error) {
      console.error('SpeakerDiarization: Processing failed', error);
      throw error;
    }
  }

  public async enrollSpeaker(
    audioData: Float32Array,
    speakerId: string,
    speakerName: string,
    metadata?: SpeakerProfile['metadata'],
    sampleRate: number = 16000
  ): Promise<boolean> {
    try {
      // Extract voice features from enrollment audio
      const features = await this.extractVoiceFeatures(audioData, sampleRate);
      
      // Create or update speaker profile
      const profile: SpeakerProfile = {
        id: speakerId,
        name: speakerName,
        voicePrint: this.generateVoicePrint(features),
        characteristics: {
          fundamentalFrequency: this.calculateF0(audioData, sampleRate),
          spectralCentroid: features.spectralFeatures.centroid[0] || 0,
          spectralRolloff: features.spectralFeatures.rolloff[0] || 0,
          mfccCoefficients: features.mfcc.slice(0, 12),
          formantFrequencies: this.extractFormants(audioData, sampleRate)
        },
        enrollmentDate: new Date().toISOString(),
        confidence: 0.95, // High confidence for new enrollment
        sampleCount: 1,
        metadata: metadata || {}
      };

      // If speaker already exists, update profile
      const existingProfile = this.speakerProfiles.get(speakerId);
      if (existingProfile) {
        profile.voicePrint = this.updateVoicePrint(existingProfile.voicePrint, profile.voicePrint);
        profile.sampleCount = existingProfile.sampleCount + 1;
        profile.confidence = Math.min(0.98, existingProfile.confidence + 0.02);
      }

      this.speakerProfiles.set(speakerId, profile);
      
      console.log(`SpeakerDiarization: Enrolled speaker ${speakerName} (${speakerId})`);
      return true;
    } catch (error) {
      console.error('SpeakerDiarization: Speaker enrollment failed', error);
      return false;
    }
  }

  public getSpeakerProfile(speakerId: string): SpeakerProfile | null {
    return this.speakerProfiles.get(speakerId) || null;
  }

  public getAllSpeakers(): SpeakerProfile[] {
    return Array.from(this.speakerProfiles.values());
  }

  public async identifyCurrentSpeaker(audioData: Float32Array, sampleRate: number = 16000): Promise<{
    speakerId: string | null;
    confidence: number;
    speakerName?: string;
  }> {
    try {
      const features = await this.extractVoiceFeatures(audioData, sampleRate);
      const voicePrint = this.generateVoicePrint(features);
      
      let bestMatch: { id: string; confidence: number; name: string } | null = null;
      
      for (const [id, profile] of this.speakerProfiles.entries()) {
        const similarity = this.calculateVoiceSimilarity(voicePrint, profile.voicePrint);
        
        if (!bestMatch || similarity > bestMatch.confidence) {
          bestMatch = {
            id,
            confidence: similarity,
            name: profile.name
          };
        }
      }
      
      // Return match only if confidence is above threshold
      if (bestMatch && bestMatch.confidence > 0.6) {
        return {
          speakerId: bestMatch.id,
          confidence: bestMatch.confidence,
          speakerName: bestMatch.name
        };
      }
      
      return {
        speakerId: null,
        confidence: 0
      };
    } catch (error) {
      console.error('SpeakerDiarization: Speaker identification failed', error);
      return {
        speakerId: null,
        confidence: 0
      };
    }
  }

  public removeSpeaker(speakerId: string): boolean {
    return this.speakerProfiles.delete(speakerId);
  }

  public updateConfig(newConfig: Partial<DiarizationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  public getConfig(): DiarizationConfig {
    return { ...this.config };
  }

  // Private methods for audio processing

  private detectVoiceActivity(audioData: Float32Array, sampleRate: number): boolean[] {
    const frameSize = this.config.frameSize;
    const hopSize = this.config.hopSize;
    const numFrames = Math.floor((audioData.length - frameSize) / hopSize) + 1;
    const vadResults: boolean[] = [];

    for (let i = 0; i < numFrames; i++) {
      const start = i * hopSize;
      const end = Math.min(start + frameSize, audioData.length);
      const frame = audioData.slice(start, end);
      
      // Calculate frame energy
      const energy = this.calculateEnergy(frame);
      const energyDb = 20 * Math.log10(energy + 1e-10);
      
      // Calculate spectral features for more robust VAD
      const spectralCentroid = this.calculateSpectralCentroid(frame, sampleRate);
      const spectralFlux = i > 0 ? this.calculateSpectralFlux(frame, audioData.slice((i-1) * hopSize, start + frameSize)) : 0;
      
      // Combine multiple features for VAD decision
      const isVoice = energyDb > this.config.silenceThreshold && 
                     spectralCentroid > 500 && 
                     spectralCentroid < 8000;
      
      vadResults.push(isVoice);
    }

    return vadResults;
  }

  private segmentAudio(audioData: Float32Array, vadResults: boolean[], sampleRate: number): SpeechSegment[] {
    const hopSize = this.config.hopSize;
    const minSegmentSamples = this.config.minSegmentDuration * sampleRate;
    const segments: SpeechSegment[] = [];
    
    let segmentStart = -1;
    let segmentId = 0;

    for (let i = 0; i < vadResults.length; i++) {
      const audioStart = i * hopSize;
      
      if (vadResults[i] && segmentStart === -1) {
        // Start of speech segment
        segmentStart = audioStart;
      } else if (!vadResults[i] && segmentStart !== -1) {
        // End of speech segment
        const segmentEnd = audioStart;
        const segmentLength = segmentEnd - segmentStart;
        
        if (segmentLength >= minSegmentSamples) {
          const segmentAudio = audioData.slice(segmentStart, segmentEnd);
          
          segments.push({
            id: `segment_${segmentId++}`,
            startTime: segmentStart / sampleRate,
            endTime: segmentEnd / sampleRate,
            duration: segmentLength / sampleRate,
            audioData: segmentAudio,
            confidence: 0,
            features: {
              mfcc: [],
              pitch: [],
              energy: [],
              spectralFeatures: {
                centroid: [],
                rolloff: [],
                flux: [],
                bandwidth: []
              },
              voiceActivityDetection: []
            }
          });
        }
        
        segmentStart = -1;
      }
    }

    // Handle case where segment extends to end of audio
    if (segmentStart !== -1) {
      const segmentEnd = audioData.length;
      const segmentLength = segmentEnd - segmentStart;
      
      if (segmentLength >= minSegmentSamples) {
        const segmentAudio = audioData.slice(segmentStart, segmentEnd);
        
        segments.push({
          id: `segment_${segmentId++}`,
          startTime: segmentStart / sampleRate,
          endTime: segmentEnd / sampleRate,
          duration: segmentLength / sampleRate,
          audioData: segmentAudio,
          confidence: 0,
          features: {
            mfcc: [],
            pitch: [],
            energy: [],
            spectralFeatures: {
              centroid: [],
              rolloff: [],
              flux: [],
              bandwidth: []
            },
            voiceActivityDetection: []
          }
        });
      }
    }

    return segments;
  }

  private async extractFeatures(segment: SpeechSegment, sampleRate: number): Promise<SpeechSegment> {
    const features = await this.extractVoiceFeatures(segment.audioData, sampleRate);
    return {
      ...segment,
      features
    };
  }

  private async extractVoiceFeatures(audioData: Float32Array, sampleRate: number): Promise<AudioFeatures> {
    // This is a simplified feature extraction
    // In a real implementation, you'd use proper DSP libraries
    
    const frameSize = 1024;
    const hopSize = 512;
    const numFrames = Math.floor((audioData.length - frameSize) / hopSize) + 1;
    
    const mfcc: number[] = [];
    const pitch: number[] = [];
    const energy: number[] = [];
    const spectralCentroid: number[] = [];
    const spectralRolloff: number[] = [];
    const spectralFlux: number[] = [];
    const spectralBandwidth: number[] = [];
    const vad: boolean[] = [];

    for (let i = 0; i < numFrames; i++) {
      const start = i * hopSize;
      const end = Math.min(start + frameSize, audioData.length);
      const frame = audioData.slice(start, end);
      
      // Calculate various features
      energy.push(this.calculateEnergy(frame));
      spectralCentroid.push(this.calculateSpectralCentroid(frame, sampleRate));
      spectralRolloff.push(this.calculateSpectralRolloff(frame, sampleRate));
      spectralBandwidth.push(this.calculateSpectralBandwidth(frame, sampleRate));
      pitch.push(this.calculateF0(frame, sampleRate));
      
      if (i > 0) {
        const prevFrame = audioData.slice((i-1) * hopSize, start + frameSize);
        spectralFlux.push(this.calculateSpectralFlux(frame, prevFrame));
      } else {
        spectralFlux.push(0);
      }
      
      // Calculate MFCC (simplified version)
      mfcc.push(...this.calculateMFCC(frame, sampleRate).slice(0, 2)); // First 2 coefficients
      
      // Voice activity detection
      const frameEnergy = 20 * Math.log10(energy[i] + 1e-10);
      vad.push(frameEnergy > this.config.silenceThreshold);
    }

    return {
      mfcc,
      pitch,
      energy,
      spectralFeatures: {
        centroid: spectralCentroid,
        rolloff: spectralRolloff,
        flux: spectralFlux,
        bandwidth: spectralBandwidth
      },
      voiceActivityDetection: vad
    };
  }

  private async identifySpeakers(segments: SpeechSegment[]): Promise<SpeechSegment[]> {
    const identifiedSegments: SpeechSegment[] = [];

    for (const segment of segments) {
      const voicePrint = this.generateVoicePrint(segment.features);
      let bestMatch: { id: string; confidence: number } | null = null;

      // Compare with known speakers
      for (const [speakerId, profile] of this.speakerProfiles.entries()) {
        const similarity = this.calculateVoiceSimilarity(voicePrint, profile.voicePrint);
        
        if (!bestMatch || similarity > bestMatch.confidence) {
          bestMatch = { id: speakerId, confidence: similarity };
        }
      }

      // Assign speaker if confidence is above threshold
      if (bestMatch && bestMatch.confidence > 0.5) {
        identifiedSegments.push({
          ...segment,
          speakerId: bestMatch.id,
          confidence: bestMatch.confidence
        });
      } else {
        // Create unknown speaker
        const unknownId = `unknown_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        identifiedSegments.push({
          ...segment,
          speakerId: unknownId,
          confidence: 0.3
        });
      }
    }

    return identifiedSegments;
  }

  private postProcessSegments(segments: SpeechSegment[]): SpeechSegment[] {
    // Merge adjacent segments from the same speaker
    const mergedSegments: SpeechSegment[] = [];
    
    for (let i = 0; i < segments.length; i++) {
      const current = segments[i];
      
      if (mergedSegments.length === 0) {
        mergedSegments.push(current);
        continue;
      }
      
      const last = mergedSegments[mergedSegments.length - 1];
      
      // Check if we should merge with previous segment
      const timeDiff = current.startTime - last.endTime;
      const sameSpeaker = current.speakerId === last.speakerId;
      const closeInTime = timeDiff < 1.0; // Less than 1 second gap
      
      if (sameSpeaker && closeInTime) {
        // Merge segments
        const mergedAudio = new Float32Array(last.audioData.length + current.audioData.length);
        mergedAudio.set(last.audioData, 0);
        mergedAudio.set(current.audioData, last.audioData.length);
        
        last.endTime = current.endTime;
        last.duration = last.endTime - last.startTime;
        last.audioData = mergedAudio;
        last.confidence = Math.max(last.confidence, current.confidence);
      } else {
        mergedSegments.push(current);
      }
    }
    
    return mergedSegments;
  }

  private generateDiarizationResult(segments: SpeechSegment[], totalDuration: number): DiarizationResult {
    const speakerStats = new Map<string, {
      segments: number;
      totalDuration: number;
      maxConfidence: number;
      name?: string;
    }>();

    // Calculate speaker statistics
    for (const segment of segments) {
      if (!segment.speakerId) continue;
      
      const stats = speakerStats.get(segment.speakerId) || {
        segments: 0,
        totalDuration: 0,
        maxConfidence: 0
      };
      
      stats.segments++;
      stats.totalDuration += segment.duration;
      stats.maxConfidence = Math.max(stats.maxConfidence, segment.confidence);
      
      // Add speaker name if known
      const profile = this.speakerProfiles.get(segment.speakerId);
      if (profile) {
        stats.name = profile.name;
      }
      
      speakerStats.set(segment.speakerId, stats);
    }

    // Check for overlapping segments
    let overlapDetected = false;
    for (let i = 0; i < segments.length - 1; i++) {
      const current = segments[i];
      const next = segments[i + 1];
      
      if (current.endTime > next.startTime) {
        overlapDetected = true;
        break;
      }
    }

    // Calculate quality score
    const avgConfidence = segments.reduce((sum, seg) => sum + seg.confidence, 0) / segments.length;
    const speakerConsistency = speakerStats.size <= this.config.maxSpeakers ? 1.0 : 0.5;
    const qualityScore = Math.round((avgConfidence * 0.7 + speakerConsistency * 0.3) * 100) / 100;

    return {
      segments,
      speakers: Array.from(speakerStats.entries()).map(([id, stats]) => ({
        id,
        segments: stats.segments,
        totalDuration: Math.round(stats.totalDuration * 100) / 100,
        confidence: Math.round(stats.maxConfidence * 100) / 100,
        name: stats.name
      })),
      totalDuration: Math.round(totalDuration * 100) / 100,
      overlapDetected,
      qualityScore
    };
  }

  // Audio analysis utility methods

  private calculateEnergy(frame: Float32Array): number {
    let energy = 0;
    for (let i = 0; i < frame.length; i++) {
      energy += frame[i] * frame[i];
    }
    return Math.sqrt(energy / frame.length);
  }

  private calculateSpectralCentroid(frame: Float32Array, sampleRate: number): number {
    const fft = this.simpleFFT(frame);
    let numerator = 0;
    let denominator = 0;
    
    for (let i = 0; i < fft.length / 2; i++) {
      const magnitude = Math.sqrt(fft[i * 2] ** 2 + fft[i * 2 + 1] ** 2);
      const frequency = (i * sampleRate) / fft.length;
      
      numerator += frequency * magnitude;
      denominator += magnitude;
    }
    
    return denominator > 0 ? numerator / denominator : 0;
  }

  private calculateSpectralRolloff(frame: Float32Array, sampleRate: number): number {
    const fft = this.simpleFFT(frame);
    const magnitudes: number[] = [];
    
    for (let i = 0; i < fft.length / 2; i++) {
      magnitudes.push(Math.sqrt(fft[i * 2] ** 2 + fft[i * 2 + 1] ** 2));
    }
    
    const totalEnergy = magnitudes.reduce((sum, mag) => sum + mag, 0);
    const threshold = totalEnergy * 0.85; // 85th percentile
    
    let cumulativeEnergy = 0;
    for (let i = 0; i < magnitudes.length; i++) {
      cumulativeEnergy += magnitudes[i];
      if (cumulativeEnergy >= threshold) {
        return (i * sampleRate) / (magnitudes.length * 2);
      }
    }
    
    return sampleRate / 2;
  }

  private calculateSpectralBandwidth(frame: Float32Array, sampleRate: number): number {
    const centroid = this.calculateSpectralCentroid(frame, sampleRate);
    const fft = this.simpleFFT(frame);
    
    let numerator = 0;
    let denominator = 0;
    
    for (let i = 0; i < fft.length / 2; i++) {
      const magnitude = Math.sqrt(fft[i * 2] ** 2 + fft[i * 2 + 1] ** 2);
      const frequency = (i * sampleRate) / fft.length;
      
      numerator += ((frequency - centroid) ** 2) * magnitude;
      denominator += magnitude;
    }
    
    return denominator > 0 ? Math.sqrt(numerator / denominator) : 0;
  }

  private calculateSpectralFlux(frame1: Float32Array, frame2: Float32Array): number {
    const fft1 = this.simpleFFT(frame1);
    const fft2 = this.simpleFFT(frame2);
    
    let flux = 0;
    const minLength = Math.min(fft1.length, fft2.length);
    
    for (let i = 0; i < minLength / 2; i++) {
      const mag1 = Math.sqrt(fft1[i * 2] ** 2 + fft1[i * 2 + 1] ** 2);
      const mag2 = Math.sqrt(fft2[i * 2] ** 2 + fft2[i * 2 + 1] ** 2);
      flux += (mag2 - mag1) ** 2;
    }
    
    return Math.sqrt(flux);
  }

  private calculateF0(frame: Float32Array, sampleRate: number): number {
    // Simplified pitch detection using autocorrelation
    const minPeriod = Math.floor(sampleRate / 500); // ~500 Hz max
    const maxPeriod = Math.floor(sampleRate / 50);  // ~50 Hz min
    
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

  private calculateMFCC(frame: Float32Array, sampleRate: number): number[] {
    // Simplified MFCC calculation - returns mock coefficients
    // In a real implementation, this would involve mel-scale filtering and DCT
    const fft = this.simpleFFT(frame);
    const mfccCoeffs: number[] = [];
    
    // Extract first few spectral features as MFCC approximation
    for (let i = 0; i < 12; i++) {
      const index = Math.floor((i + 1) * fft.length / 24);
      if (index < fft.length / 2) {
        const magnitude = Math.sqrt(fft[index * 2] ** 2 + fft[index * 2 + 1] ** 2);
        mfccCoeffs.push(Math.log(magnitude + 1e-10));
      } else {
        mfccCoeffs.push(0);
      }
    }
    
    return mfccCoeffs;
  }

  private extractFormants(frame: Float32Array, sampleRate: number): number[] {
    // Simplified formant extraction - returns estimated formant frequencies
    // This is a mock implementation; real formant detection requires LPC analysis
    const fft = this.simpleFFT(frame);
    const formants: number[] = [];
    
    // Find peaks in the spectrum (simplified formant detection)
    const magnitudes: number[] = [];
    for (let i = 0; i < fft.length / 2; i++) {
      magnitudes.push(Math.sqrt(fft[i * 2] ** 2 + fft[i * 2 + 1] ** 2));
    }
    
    // Find top 3 peaks (approximating F1, F2, F3)
    const peaks: { freq: number; magnitude: number }[] = [];
    
    for (let i = 2; i < magnitudes.length - 2; i++) {
      if (magnitudes[i] > magnitudes[i-1] && magnitudes[i] > magnitudes[i+1] &&
          magnitudes[i] > magnitudes[i-2] && magnitudes[i] > magnitudes[i+2]) {
        const frequency = (i * sampleRate) / (magnitudes.length * 2);
        if (frequency > 200 && frequency < 4000) { // Typical formant range
          peaks.push({ freq: frequency, magnitude: magnitudes[i] });
        }
      }
    }
    
    // Sort by magnitude and take top 3
    peaks.sort((a, b) => b.magnitude - a.magnitude);
    peaks.slice(0, 3).forEach(peak => formants.push(peak.freq));
    
    // Fill with default values if not enough peaks found
    while (formants.length < 3) {
      formants.push(0);
    }
    
    return formants;
  }

  private generateVoicePrint(features: AudioFeatures): number[] {
    // Create a simplified voice print from various features
    const voicePrint: number[] = [];
    
    // Average MFCC coefficients
    const mfccChunks = Math.ceil(features.mfcc.length / 10);
    for (let i = 0; i < 10; i++) {
      const start = i * mfccChunks;
      const end = Math.min(start + mfccChunks, features.mfcc.length);
      const chunk = features.mfcc.slice(start, end);
      const avg = chunk.length > 0 ? chunk.reduce((sum, val) => sum + val, 0) / chunk.length : 0;
      voicePrint.push(this.normalize(avg, -20, 20));
    }
    
    return voicePrint;
  }

  private calculateVoiceSimilarity(voicePrint1: number[], voicePrint2: number[]): number {
    if (voicePrint1.length !== voicePrint2.length) {
      return 0;
    }
    
    // Calculate cosine similarity
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < voicePrint1.length; i++) {
      dotProduct += voicePrint1[i] * voicePrint2[i];
      norm1 += voicePrint1[i] * voicePrint1[i];
      norm2 += voicePrint2[i] * voicePrint2[i];
    }
    
    const similarity = dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
    return Math.max(0, Math.min(1, (similarity + 1) / 2)); // Normalize to 0-1 range
  }

  private updateVoicePrint(existingPrint: number[], newPrint: number[]): number[] {
    // Weighted average of existing and new voice prints
    const weight = 0.8; // Give more weight to existing print
    return existingPrint.map((val, i) => val * weight + newPrint[i] * (1 - weight));
  }

  private normalize(value: number, min: number, max: number): number {
    return Math.max(0, Math.min(1, (value - min) / (max - min)));
  }

  private simpleFFT(signal: Float32Array): Float32Array {
    // Simplified FFT implementation - in practice, use a proper FFT library
    const N = signal.length;
    const fft = new Float32Array(N * 2); // Real and imaginary parts
    
    // This is a placeholder - real implementation would use proper FFT algorithm
    for (let k = 0; k < N; k++) {
      let realSum = 0;
      let imagSum = 0;
      
      for (let n = 0; n < N; n++) {
        const angle = (-2 * Math.PI * k * n) / N;
        realSum += signal[n] * Math.cos(angle);
        imagSum += signal[n] * Math.sin(angle);
      }
      
      fft[k * 2] = realSum;
      fft[k * 2 + 1] = imagSum;
    }
    
    return fft;
  }

  public shutdown(): void {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.speakerProfiles.clear();
    this.isInitialized = false;
  }
}