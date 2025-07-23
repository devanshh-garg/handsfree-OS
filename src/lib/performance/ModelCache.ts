'use client';

interface CacheEntry<T = any> {
  id: string;
  key: string;
  data: T;
  metadata: {
    createdAt: string;
    lastAccessed: string;
    accessCount: number;
    expiresAt?: string;
    size: number;
    priority: 'low' | 'medium' | 'high' | 'critical';
    tags: string[];
    version: string;
  };
  loadingState: 'loading' | 'loaded' | 'error' | 'stale';
  error?: string;
}

interface CacheConfig {
  maxSize: number; // Maximum cache size in bytes
  maxEntries: number; // Maximum number of entries
  defaultTTL: number; // Default time-to-live in milliseconds
  cleanupInterval: number; // Cleanup interval in milliseconds
  compressionEnabled: boolean;
  persistentStorage: boolean;
  evictionPolicy: 'lru' | 'lfu' | 'ttl' | 'priority';
}

interface LoaderFunction<T> {
  (key: string, options?: any): Promise<T>;
}

interface CacheStats {
  totalEntries: number;
  totalSize: number;
  hitCount: number;
  missCount: number;
  hitRate: number;
  evictionCount: number;
  loadingCount: number;
  errorCount: number;
  memoryUsage: {
    used: number;
    available: number;
    percentage: number;
  };
  performance: {
    averageLoadTime: number;
    averageAccessTime: number;
    slowestOperations: Array<{
      operation: string;
      duration: number;
      timestamp: string;
    }>;
  };
}

interface ModelMetadata {
  name: string;
  version: string;
  type: 'nlp' | 'speech' | 'ml' | 'audio' | 'decision';
  size: number;
  dependencies: string[];
  loadTime?: number;
  accuracy?: number;
  lastUpdated: string;
}

export class ModelCache {
  private static instance: ModelCache;
  
  private cache: Map<string, CacheEntry> = new Map();
  private accessOrder: string[] = []; // For LRU eviction
  private accessCount: Map<string, number> = new Map(); // For LFU eviction
  private loadingPromises: Map<string, Promise<any>> = new Map();
  private config: CacheConfig;
  private stats: CacheStats;
  private cleanupTimer?: NodeJS.Timeout;
  
  // Model-specific configurations
  private modelConfigs: Map<string, {
    loader: LoaderFunction<any>;
    ttl?: number;
    priority: 'low' | 'medium' | 'high' | 'critical';
    preload?: boolean;
    maxSize?: number;
  }> = new Map();

  // Restaurant voice system models
  private defaultModels = [
    {
      key: 'nlp_intent_classifier',
      name: 'Intent Classification Model',
      type: 'nlp' as const,
      loader: this.loadNLPModel.bind(this),
      priority: 'critical' as const,
      preload: true,
      ttl: 24 * 60 * 60 * 1000, // 24 hours
      maxSize: 50 * 1024 * 1024 // 50MB
    },
    {
      key: 'speech_recognition_model',
      name: 'Speech Recognition Model',
      type: 'speech' as const,
      loader: this.loadSpeechModel.bind(this),
      priority: 'critical' as const,
      preload: true,
      ttl: 12 * 60 * 60 * 1000, // 12 hours
      maxSize: 100 * 1024 * 1024 // 100MB
    },
    {
      key: 'emotion_detection_model',
      name: 'Emotion Detection Model',
      type: 'audio' as const,
      loader: this.loadEmotionModel.bind(this),
      priority: 'high' as const,
      preload: false,
      ttl: 6 * 60 * 60 * 1000, // 6 hours
      maxSize: 30 * 1024 * 1024 // 30MB
    },
    {
      key: 'order_optimization_model',
      name: 'Order Optimization ML Model',
      type: 'ml' as const,
      loader: this.loadMLModel.bind(this),
      priority: 'medium' as const,
      preload: false,
      ttl: 2 * 60 * 60 * 1000, // 2 hours
      maxSize: 20 * 1024 * 1024 // 20MB
    },
    {
      key: 'inventory_prediction_model',
      name: 'Inventory Prediction Model',
      type: 'ml' as const,
      loader: this.loadMLModel.bind(this),
      priority: 'medium' as const,
      preload: false,
      ttl: 4 * 60 * 60 * 1000, // 4 hours
      maxSize: 25 * 1024 * 1024 // 25MB
    },
    {
      key: 'customer_satisfaction_model',
      name: 'Customer Satisfaction Analysis Model',
      type: 'nlp' as const,
      loader: this.loadNLPModel.bind(this),
      priority: 'medium' as const,
      preload: false,
      ttl: 3 * 60 * 60 * 1000, // 3 hours
      maxSize: 15 * 1024 * 1024 // 15MB
    },
    {
      key: 'language_detection_model',
      name: 'Multi-language Detection Model',
      type: 'nlp' as const,
      loader: this.loadLanguageModel.bind(this),
      priority: 'high' as const,
      preload: true,
      ttl: 8 * 60 * 60 * 1000, // 8 hours
      maxSize: 40 * 1024 * 1024 // 40MB
    },
    {
      key: 'voice_biometrics_model',
      name: 'Voice Biometrics Model',
      type: 'audio' as const,
      loader: this.loadBiometricsModel.bind(this),
      priority: 'high' as const,
      preload: false,
      ttl: 24 * 60 * 60 * 1000, // 24 hours
      maxSize: 60 * 1024 * 1024 // 60MB
    }
  ];

  private constructor(config?: Partial<CacheConfig>) {
    this.config = {
      maxSize: 500 * 1024 * 1024, // 500MB default
      maxEntries: 100,
      defaultTTL: 60 * 60 * 1000, // 1 hour
      cleanupInterval: 5 * 60 * 1000, // 5 minutes
      compressionEnabled: true,
      persistentStorage: false,
      evictionPolicy: 'lru',
      ...config
    };

    this.stats = {
      totalEntries: 0,
      totalSize: 0,
      hitCount: 0,
      missCount: 0,
      hitRate: 0,
      evictionCount: 0,
      loadingCount: 0,
      errorCount: 0,
      memoryUsage: { used: 0, available: 0, percentage: 0 },
      performance: {
        averageLoadTime: 0,
        averageAccessTime: 0,
        slowestOperations: []
      }
    };

    this.initializeModels();
    this.startCleanupTimer();
  }

  public static getInstance(config?: Partial<CacheConfig>): ModelCache {
    if (!ModelCache.instance) {
      ModelCache.instance = new ModelCache(config);
    }
    return ModelCache.instance;
  }

  private initializeModels(): void {
    this.defaultModels.forEach(model => {
      this.modelConfigs.set(model.key, {
        loader: model.loader,
        ttl: model.ttl,
        priority: model.priority,
        preload: model.preload,
        maxSize: model.maxSize
      });
    });

    console.log('ModelCache: Initialized with', this.modelConfigs.size, 'model configurations');
    
    // Preload critical models
    this.preloadModels();
  }

  private async preloadModels(): Promise<void> {
    console.log('ModelCache: Starting model preloading...');
    
    const preloadPromises = this.defaultModels
      .filter(model => model.preload)
      .map(async model => {
        try {
          await this.get(model.key, { skipStats: true });
          console.log(`ModelCache: Preloaded ${model.name}`);
        } catch (error) {
          console.error(`ModelCache: Failed to preload ${model.name}`, error);
        }
      });

    await Promise.allSettled(preloadPromises);
    console.log('ModelCache: Model preloading completed');
  }

  public async get<T>(key: string, options: {
    skipStats?: boolean;
    forceReload?: boolean;
    timeout?: number;
  } = {}): Promise<T> {
    const startTime = Date.now();
    
    try {
      // Check if already loading
      if (this.loadingPromises.has(key)) {
        const result = await this.loadingPromises.get(key)!;
        this.updateAccessStats(key, startTime, false);
        return result;
      }

      // Check cache hit
      if (!options.forceReload && this.cache.has(key)) {
        const entry = this.cache.get(key)!;
        
        // Check if expired
        if (this.isExpired(entry)) {
          this.cache.delete(key);
          this.stats.totalSize -= entry.metadata.size;
          this.stats.totalEntries--;
        } else {
          // Cache hit
          this.updateAccessOrder(key);
          entry.metadata.lastAccessed = new Date().toISOString();
          entry.metadata.accessCount++;
          
          if (!options.skipStats) {
            this.updateAccessStats(key, startTime, true);
          }
          
          return entry.data;
        }
      }

      // Cache miss - load data
      const loadingPromise = this.loadModel<T>(key, options);
      this.loadingPromises.set(key, loadingPromise);
      
      try {
        const result = await loadingPromise;
        this.loadingPromises.delete(key);
        
        if (!options.skipStats) {
          this.updateAccessStats(key, startTime, false);
        }
        
        return result;
      } catch (error) {
        this.loadingPromises.delete(key);
        throw error;
      }

    } catch (error) {
      this.stats.errorCount++;
      console.error(`ModelCache: Error getting ${key}`, error);
      throw error;
    }
  }

  private async loadModel<T>(key: string, options: any = {}): Promise<T> {
    const config = this.modelConfigs.get(key);
    if (!config) {
      throw new Error(`No loader configured for model: ${key}`);
    }

    const startTime = Date.now();
    this.stats.loadingCount++;

    try {
      console.log(`ModelCache: Loading model ${key}...`);
      
      const data = await config.loader(key, options);
      const loadTime = Date.now() - startTime;
      
      // Estimate size (simplified)
      const size = this.estimateSize(data);
      
      // Create cache entry
      const entry: CacheEntry<T> = {
        id: `${key}_${Date.now()}`,
        key,
        data,
        metadata: {
          createdAt: new Date().toISOString(),
          lastAccessed: new Date().toISOString(),
          accessCount: 1,
          expiresAt: config.ttl ? new Date(Date.now() + config.ttl).toISOString() : undefined,
          size,
          priority: config.priority,
          tags: [key.split('_')[0]], // Extract model type as tag
          version: '1.0.0'
        },
        loadingState: 'loaded'
      };

      // Check if we need to evict entries
      await this.ensureCapacity(size);
      
      // Store in cache
      this.cache.set(key, entry);
      this.updateAccessOrder(key);
      
      // Update stats
      this.stats.totalEntries++;
      this.stats.totalSize += size;
      this.stats.loadingCount--;
      
      // Update performance stats
      this.updatePerformanceStats('load', loadTime);
      
      console.log(`ModelCache: Loaded ${key} in ${loadTime}ms (${this.formatSize(size)})`);
      
      return data;

    } catch (error) {
      this.stats.loadingCount--;
      this.stats.errorCount++;
      
      // Create error entry
      const errorEntry: CacheEntry<T> = {
        id: `${key}_error_${Date.now()}`,
        key,
        data: null as any,
        metadata: {
          createdAt: new Date().toISOString(),
          lastAccessed: new Date().toISOString(),
          accessCount: 0,
          size: 0,
          priority: config.priority,
          tags: ['error'],
          version: '1.0.0'
        },
        loadingState: 'error',
        error: String(error)
      };

      this.cache.set(key, errorEntry);
      
      console.error(`ModelCache: Failed to load ${key}`, error);
      throw error;
    }
  }

  public async set<T>(key: string, data: T, options: {
    ttl?: number;
    priority?: 'low' | 'medium' | 'high' | 'critical';
    tags?: string[];
  } = {}): Promise<void> {
    const size = this.estimateSize(data);
    
    await this.ensureCapacity(size);
    
    const entry: CacheEntry<T> = {
      id: `${key}_${Date.now()}`,
      key,
      data,
      metadata: {
        createdAt: new Date().toISOString(),
        lastAccessed: new Date().toISOString(),
        accessCount: 0,
        expiresAt: options.ttl ? new Date(Date.now() + options.ttl).toISOString() : undefined,
        size,
        priority: options.priority || 'medium',
        tags: options.tags || [],
        version: '1.0.0'
      },
      loadingState: 'loaded'
    };

    // Remove existing entry if present
    if (this.cache.has(key)) {
      const existingEntry = this.cache.get(key)!;
      this.stats.totalSize -= existingEntry.metadata.size;
      this.stats.totalEntries--;
    } else {
      this.stats.totalEntries++;
    }

    this.cache.set(key, entry);
    this.updateAccessOrder(key);
    this.stats.totalSize += size;
    
    console.log(`ModelCache: Cached ${key} (${this.formatSize(size)})`);
  }

  public invalidate(key: string): boolean {
    const entry = this.cache.get(key);
    if (entry) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      this.stats.totalSize -= entry.metadata.size;
      this.stats.totalEntries--;
      console.log(`ModelCache: Invalidated ${key}`);
      return true;
    }
    return false;
  }

  public invalidateByTag(tag: string): number {
    let invalidatedCount = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.metadata.tags.includes(tag)) {
        this.cache.delete(key);
        this.removeFromAccessOrder(key);
        this.stats.totalSize -= entry.metadata.size;
        this.stats.totalEntries--;
        invalidatedCount++;
      }
    }
    
    console.log(`ModelCache: Invalidated ${invalidatedCount} entries with tag '${tag}'`);
    return invalidatedCount;
  }

  public clear(): void {
    this.cache.clear();
    this.accessOrder = [];
    this.accessCount.clear();
    this.loadingPromises.clear();
    
    this.stats.totalEntries = 0;
    this.stats.totalSize = 0;
    this.stats.evictionCount = 0;
    
    console.log('ModelCache: Cleared all entries');
  }

  private async ensureCapacity(newEntrySize: number): Promise<void> {
    while (
      this.stats.totalSize + newEntrySize > this.config.maxSize ||
      this.stats.totalEntries >= this.config.maxEntries
    ) {
      const evicted = await this.evictEntry();
      if (!evicted) {
        break; // No more entries to evict
      }
    }
  }

  private async evictEntry(): Promise<boolean> {
    if (this.cache.size === 0) return false;
    
    let keyToEvict: string | null = null;
    
    switch (this.config.evictionPolicy) {
      case 'lru':
        keyToEvict = this.accessOrder[0] || null;
        break;
        
      case 'lfu':
        keyToEvict = this.findLFUEntry();
        break;
        
      case 'ttl':
        keyToEvict = this.findExpiredEntry();
        break;
        
      case 'priority':
        keyToEvict = this.findLowestPriorityEntry();
        break;
    }
    
    if (keyToEvict) {
      const entry = this.cache.get(keyToEvict)!;
      this.cache.delete(keyToEvict);
      this.removeFromAccessOrder(keyToEvict);
      this.stats.totalSize -= entry.metadata.size;
      this.stats.totalEntries--;
      this.stats.evictionCount++;
      
      console.log(`ModelCache: Evicted ${keyToEvict} (${this.config.evictionPolicy} policy)`);
      return true;
    }
    
    return false;
  }

  private findLFUEntry(): string | null {
    let minAccessCount = Infinity;
    let keyToEvict: string | null = null;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.metadata.accessCount < minAccessCount) {
        minAccessCount = entry.metadata.accessCount;
        keyToEvict = key;
      }
    }
    
    return keyToEvict;
  }

  private findExpiredEntry(): string | null {
    const now = new Date();
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.metadata.expiresAt && new Date(entry.metadata.expiresAt) < now) {
        return key;
      }
    }
    
    return null;
  }

  private findLowestPriorityEntry(): string | null {
    const priorityOrder = { low: 0, medium: 1, high: 2, critical: 3 };
    let lowestPriority = 4;
    let keyToEvict: string | null = null;
    
    for (const [key, entry] of this.cache.entries()) {
      const priority = priorityOrder[entry.metadata.priority];
      if (priority < lowestPriority) {
        lowestPriority = priority;
        keyToEvict = key;
      }
    }
    
    return keyToEvict;
  }

  private isExpired(entry: CacheEntry): boolean {
    if (!entry.metadata.expiresAt) return false;
    return new Date(entry.metadata.expiresAt) < new Date();
  }

  private updateAccessOrder(key: string): void {
    this.removeFromAccessOrder(key);
    this.accessOrder.push(key);
  }

  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  private updateAccessStats(key: string, startTime: number, isHit: boolean): void {
    const duration = Date.now() - startTime;
    
    if (isHit) {
      this.stats.hitCount++;
    } else {
      this.stats.missCount++;
    }
    
    const totalAccesses = this.stats.hitCount + this.stats.missCount;
    this.stats.hitRate = totalAccesses > 0 ? this.stats.hitCount / totalAccesses : 0;
    
    this.updatePerformanceStats('access', duration);
  }

  private updatePerformanceStats(operation: string, duration: number): void {
    // Update average times
    if (operation === 'load') {
      const totalLoads = this.stats.hitCount + this.stats.missCount;
      this.stats.performance.averageLoadTime = 
        (this.stats.performance.averageLoadTime * (totalLoads - 1) + duration) / totalLoads;
    } else if (operation === 'access') {
      const totalAccesses = this.stats.hitCount + this.stats.missCount;
      this.stats.performance.averageAccessTime = 
        (this.stats.performance.averageAccessTime * (totalAccesses - 1) + duration) / totalAccesses;
    }
    
    // Track slow operations
    if (duration > 1000) { // Operations slower than 1 second
      this.stats.performance.slowestOperations.push({
        operation: `${operation}_${Date.now()}`,
        duration,
        timestamp: new Date().toISOString()
      });
      
      // Keep only last 10 slow operations
      if (this.stats.performance.slowestOperations.length > 10) {
        this.stats.performance.slowestOperations.shift();
      }
    }
  }

  private estimateSize(data: any): number {
    try {
      return new Blob([JSON.stringify(data)]).size;
    } catch {
      // Fallback estimation
      if (typeof data === 'string') return data.length * 2;
      if (data instanceof ArrayBuffer) return data.byteLength;
      if (data && typeof data === 'object') return JSON.stringify(data).length * 2;
      return 1024; // Default 1KB
    }
  }

  private formatSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)}${units[unitIndex]}`;
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.performCleanup();
    }, this.config.cleanupInterval);
  }

  private performCleanup(): void {
    let cleanedCount = 0;
    const now = new Date();
    
    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        this.cache.delete(key);
        this.removeFromAccessOrder(key);
        this.stats.totalSize -= entry.metadata.size;
        this.stats.totalEntries--;
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`ModelCache: Cleaned up ${cleanedCount} expired entries`);
    }
    
    // Update memory usage stats
    this.updateMemoryStats();
  }

  private updateMemoryStats(): void {
    const used = this.stats.totalSize;
    const available = this.config.maxSize;
    const percentage = (used / available) * 100;
    
    this.stats.memoryUsage = {
      used,
      available,
      percentage
    };
  }

  // Model loader implementations (mock for demo)
  
  private async loadNLPModel(key: string, options: any = {}): Promise<any> {
    // Mock NLP model loading
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
    
    return {
      type: 'nlp_model',
      name: key,
      version: '1.0.0',
      loadedAt: new Date().toISOString(),
      classify: (text: string) => ({ intent: 'order', confidence: 0.95 }),
      extractEntities: (text: string) => [{ type: 'food_item', value: 'pizza' }],
      metadata: {
        vocabulary_size: 50000,
        model_size: '45MB',
        accuracy: 0.94
      }
    };
  }

  private async loadSpeechModel(key: string, options: any = {}): Promise<any> {
    // Mock speech recognition model loading
    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));
    
    return {
      type: 'speech_model',
      name: key,
      version: '2.1.0',
      loadedAt: new Date().toISOString(),
      transcribe: (audioData: ArrayBuffer) => ({ transcript: 'Hello', confidence: 0.92 }),
      setLanguage: (lang: string) => console.log(`Language set to ${lang}`),
      metadata: {
        sample_rate: 16000,
        model_size: '95MB',
        languages: ['en', 'hi', 'hinglish']
      }
    };
  }

  private async loadEmotionModel(key: string, options: any = {}): Promise<any> {
    // Mock emotion detection model loading
    await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 1200));
    
    return {
      type: 'emotion_model',
      name: key,
      version: '1.5.0',
      loadedAt: new Date().toISOString(),
      detectEmotion: (audioData: ArrayBuffer) => ({ emotion: 'happy', confidence: 0.87 }),
      metadata: {
        emotions: ['happy', 'sad', 'angry', 'neutral', 'frustrated'],
        model_size: '28MB',
        accuracy: 0.91
      }
    };
  }

  private async loadMLModel(key: string, options: any = {}): Promise<any> {
    // Mock ML model loading
    await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 2000));
    
    return {
      type: 'ml_model',
      name: key,
      version: '1.2.0',
      loadedAt: new Date().toISOString(),
      predict: (features: number[]) => ({ prediction: 0.85, confidence: 0.93 }),
      metadata: {
        features: 150,
        model_size: '22MB',
        accuracy: 0.89
      }
    };
  }

  private async loadLanguageModel(key: string, options: any = {}): Promise<any> {
    // Mock language detection model loading
    await new Promise(resolve => setTimeout(resolve, 600 + Math.random() * 800));
    
    return {
      type: 'language_model',
      name: key,
      version: '1.3.0',
      loadedAt: new Date().toISOString(),
      detectLanguage: (text: string) => ({ language: 'en', confidence: 0.96 }),
      metadata: {
        languages: ['en', 'hi', 'hinglish', 'es', 'fr'],
        model_size: '38MB',
        accuracy: 0.97
      }
    };
  }

  private async loadBiometricsModel(key: string, options: any = {}): Promise<any> {
    // Mock voice biometrics model loading
    await new Promise(resolve => setTimeout(resolve, 1200 + Math.random() * 1500));
    
    return {
      type: 'biometrics_model',
      name: key,
      version: '2.0.0',
      loadedAt: new Date().toISOString(),
      verifyVoice: (audioData: ArrayBuffer, userId: string) => ({ verified: true, confidence: 0.94 }),
      enrollVoice: (audioData: ArrayBuffer, userId: string) => ({ enrolled: true }),
      metadata: {
        feature_dimensions: 512,
        model_size: '58MB',
        accuracy: 0.96
      }
    };
  }

  // Public API methods

  public getStats(): CacheStats {
    this.updateMemoryStats();
    return { ...this.stats };
  }

  public getCacheEntries(): Array<{
    key: string;
    size: string;
    age: string;
    accessCount: number;
    priority: string;
    status: string;
  }> {
    return Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      size: this.formatSize(entry.metadata.size),
      age: this.getAge(entry.metadata.createdAt),
      accessCount: entry.metadata.accessCount,
      priority: entry.metadata.priority,
      status: entry.loadingState
    }));
  }

  private getAge(createdAt: string): string {
    const age = Date.now() - new Date(createdAt).getTime();
    const minutes = Math.floor(age / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    return `${minutes}m`;
  }

  public warmup(modelKeys: string[] = []): Promise<void[]> {
    const keysToWarmup = modelKeys.length > 0 
      ? modelKeys 
      : Array.from(this.modelConfigs.keys());
    
    console.log(`ModelCache: Warming up ${keysToWarmup.length} models...`);
    
    return Promise.allSettled(
      keysToWarmup.map(key => this.get(key, { skipStats: true }))
    ) as Promise<void[]>;
  }

  public updateConfig(newConfig: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('ModelCache: Configuration updated', newConfig);
  }

  public shutdown(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    this.clear();
    this.modelConfigs.clear();
    
    console.log('ModelCache: Shutdown complete');
  }
}