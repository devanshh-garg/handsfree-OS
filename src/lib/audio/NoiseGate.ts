export class NoiseGate {
  private audioContext: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  protected analyser: AnalyserNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  protected threshold: number = 0.01;
  private ratio: number = 10;
  protected attack: number = 0.003;
  protected release: number = 0.1;
  protected isGateOpen: boolean = false;
  protected envelope: number = 0;

  constructor(threshold: number = 0.01) {
    this.threshold = threshold;
    this.initializeAudioContext();
  }

  private async initializeAudioContext(): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.gainNode = this.audioContext.createGain();
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.8;

      // Set up audio processing chain
      this.processor.onaudioprocess = (event) => {
        this.processAudio(event);
      };

      console.log('Noise gate initialized successfully');
    } catch (error) {
      console.error('Failed to initialize noise gate:', error);
    }
  }

  private processAudio(event: AudioProcessingEvent): void {
    const inputBuffer = event.inputBuffer;
    const outputBuffer = event.outputBuffer;
    const inputData = inputBuffer.getChannelData(0);
    const outputData = outputBuffer.getChannelData(0);

    // Calculate RMS (Root Mean Square) for volume detection
    let sum = 0;
    for (let i = 0; i < inputData.length; i++) {
      sum += inputData[i] * inputData[i];
    }
    const rms = Math.sqrt(sum / inputData.length);

    // Gate logic
    const targetGain = rms > this.threshold ? 1 : 0;
    
    // Smooth envelope following
    if (targetGain > this.envelope) {
      // Attack
      this.envelope += (targetGain - this.envelope) * this.attack;
    } else {
      // Release
      this.envelope += (targetGain - this.envelope) * this.release;
    }

    // Apply gain reduction
    const gainReduction = this.envelope > 0.5 ? 1 : Math.pow(this.envelope / 0.5, this.ratio);

    // Process audio samples
    for (let i = 0; i < inputData.length; i++) {
      outputData[i] = inputData[i] * gainReduction;
    }

    // Update gate status
    this.isGateOpen = gainReduction > 0.1;
  }

  async connectToMediaStream(stream: MediaStream): Promise<MediaStreamAudioSourceNode | null> {
    if (!this.audioContext || !this.analyser || !this.gainNode || !this.processor) {
      console.error('Audio context not initialized');
      return null;
    }

    try {
      const source = this.audioContext.createMediaStreamSource(stream);
      
      // Connect audio nodes: source -> analyser -> processor -> gain -> destination
      source.connect(this.analyser);
      this.analyser.connect(this.processor);
      this.processor.connect(this.gainNode);
      this.gainNode.connect(this.audioContext.destination);

      return source;
    } catch (error) {
      console.error('Failed to connect to media stream:', error);
      return null;
    }
  }

  setThreshold(threshold: number): void {
    this.threshold = Math.max(0, Math.min(1, threshold));
  }

  setRatio(ratio: number): void {
    this.ratio = Math.max(1, Math.min(20, ratio));
  }

  setAttack(attack: number): void {
    this.attack = Math.max(0.001, Math.min(1, attack));
  }

  setRelease(release: number): void {
    this.release = Math.max(0.001, Math.min(5, release));
  }

  getGateStatus(): { isOpen: boolean; level: number; threshold: number } {
    return {
      isOpen: this.isGateOpen,
      level: this.envelope,
      threshold: this.threshold
    };
  }

  getFrequencyData(): Uint8Array | null {
    if (!this.analyser) return null;
    
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);
    return dataArray;
  }

  getWaveformData(): Uint8Array | null {
    if (!this.analyser) return null;
    
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteTimeDomainData(dataArray);
    return dataArray;
  }

  // Adaptive threshold based on environment noise
  enableAdaptiveThreshold(): void {
    if (!this.analyser) return;

    let noiseFloorSamples: number[] = [];
    const sampleInterval = setInterval(() => {
      const frequencyData = this.getFrequencyData();
      if (frequencyData) {
        // Calculate average frequency magnitude (noise floor estimate)
        const average = frequencyData.reduce((sum, value) => sum + value, 0) / frequencyData.length;
        noiseFloorSamples.push(average / 255); // Normalize to 0-1

        if (noiseFloorSamples.length > 50) { // Collect 50 samples
          // Calculate adaptive threshold (slightly above noise floor)
          const avgNoiseFloor = noiseFloorSamples.reduce((sum, val) => sum + val, 0) / noiseFloorSamples.length;
          this.threshold = Math.max(0.005, avgNoiseFloor * 1.5);
          
          console.log(`Adaptive threshold set to: ${this.threshold.toFixed(4)}`);
          clearInterval(sampleInterval);
        }
      }
    }, 100);

    // Clear after 10 seconds if not enough samples
    setTimeout(() => clearInterval(sampleInterval), 10000);
  }

  dispose(): void {
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    
    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }
    
    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }
    
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

// Enhanced noise gate with spectral gating
export class SpectralNoiseGate extends NoiseGate {
  private spectralThresholds: number[] = [];
  private frequencyBins: number = 32;

  constructor(threshold: number = 0.01) {
    super(threshold);
    this.initializeSpectralThresholds();
  }

  private initializeSpectralThresholds(): void {
    // Initialize frequency-specific thresholds
    // Lower frequencies (voice fundamentals) have lower thresholds
    for (let i = 0; i < this.frequencyBins; i++) {
      const frequency = (i / this.frequencyBins) * 22050; // Nyquist frequency
      
      if (frequency < 300) {
        // Very low frequencies - likely noise
        this.spectralThresholds[i] = this.threshold * 2;
      } else if (frequency < 3400) {
        // Voice frequency range - lower threshold
        this.spectralThresholds[i] = this.threshold * 0.7;
      } else {
        // Higher frequencies - normal threshold
        this.spectralThresholds[i] = this.threshold;
      }
    }
  }

  protected processSpectralAudio(event: AudioProcessingEvent): void {
    const inputBuffer = event.inputBuffer;
    const outputBuffer = event.outputBuffer;
    const inputData = inputBuffer.getChannelData(0);
    const outputData = outputBuffer.getChannelData(0);

    if (!this.analyser) return;

    // Get frequency domain data
    const frequencyData = this.getFrequencyData();
    if (!frequencyData) return;

    // Analyze each frequency bin
    let voiceEnergyDetected = false;
    const binSize = Math.floor(frequencyData.length / this.frequencyBins);

    for (let bin = 0; bin < this.frequencyBins; bin++) {
      const startIdx = bin * binSize;
      const endIdx = Math.min((bin + 1) * binSize, frequencyData.length);
      
      // Calculate average energy in this frequency bin
      let binEnergy = 0;
      for (let i = startIdx; i < endIdx; i++) {
        binEnergy += frequencyData[i];
      }
      binEnergy /= (endIdx - startIdx);
      binEnergy /= 255; // Normalize
      
      // Check against frequency-specific threshold
      if (binEnergy > this.spectralThresholds[bin]) {
        voiceEnergyDetected = true;
        break;
      }
    }

    // Apply gating based on spectral analysis
    const targetGain = voiceEnergyDetected ? 1 : 0;
    
    // Use parent class envelope following
    if (targetGain > this.envelope) {
      this.envelope += (targetGain - this.envelope) * this.attack;
    } else {
      this.envelope += (targetGain - this.envelope) * this.release;
    }

    const gainReduction = this.envelope;

    // Apply gain
    for (let i = 0; i < inputData.length; i++) {
      outputData[i] = inputData[i] * gainReduction;
    }

    this.isGateOpen = gainReduction > 0.1;
  }
}

// Factory function for creating appropriate noise gate
export function createNoiseGate(type: 'basic' | 'spectral' = 'basic', threshold: number = 0.01): NoiseGate {
  switch (type) {
    case 'spectral':
      return new SpectralNoiseGate(threshold);
    case 'basic':
    default:
      return new NoiseGate(threshold);
  }
}