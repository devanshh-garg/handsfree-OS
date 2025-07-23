'use client';

interface EmergencyAlert {
  id: string;
  type: EmergencyType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  location: string;
  description: string;
  reportedBy: string;
  timestamp: string;
  status: 'active' | 'acknowledged' | 'resolved' | 'false_alarm';
  responseTime?: string;
  resolvedTime?: string;
  assignedPersonnel: string[];
  actions: EmergencyAction[];
  metadata: {
    audioTranscript?: string;
    confidence: number;
    language: 'en' | 'hi' | 'hinglish';
    speakerId?: string;
    emotionalState?: string;
  };
}

interface EmergencyAction {
  id: string;
  type: 'notification' | 'protocol' | 'evacuation' | 'medical' | 'security' | 'system';
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  assignedTo?: string;
  timestamp: string;
  completedAt?: string;
  result?: string;
}

interface EmergencyProtocol {
  id: string;
  name: string;
  type: EmergencyType;
  triggers: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  actions: EmergencyActionTemplate[];
  escalationRules: EscalationRule[];
  autoActivate: boolean;
  requiresConfirmation: boolean;
}

interface EmergencyActionTemplate {
  type: 'notification' | 'protocol' | 'evacuation' | 'medical' | 'security' | 'system';
  description: string;
  priority: number;
  delay?: number;
  requiredRole?: string[];
  autoExecute: boolean;
  dependencies?: string[];
}

interface EscalationRule {
  condition: string;
  delay: number;
  action: string;
  notifyRoles: string[];
}

interface EmergencyContact {
  id: string;
  name: string;
  role: string;
  phone: string;
  email: string;
  priority: number;
  availability: {
    [day: string]: { start: string; end: string; };
  };
  currentStatus: 'available' | 'busy' | 'offline';
}

type EmergencyType = 'fire' | 'medical' | 'security' | 'gas_leak' | 'power_outage' | 'flood' | 'earthquake' | 'violence' | 'robbery' | 'food_poisoning' | 'equipment_failure' | 'customer_incident' | 'staff_injury';

export class CrisisHandling {
  private static instance: CrisisHandling;
  
  private activeAlerts: Map<string, EmergencyAlert> = new Map();
  private emergencyProtocols: Map<EmergencyType, EmergencyProtocol> = new Map();
  private emergencyContacts: Map<string, EmergencyContact> = new Map();
  private alertHistory: EmergencyAlert[] = [];
  private isSystemActive: boolean = true;
  
  // Emergency detection patterns
  private emergencyPatterns = [
    {
      type: 'fire' as EmergencyType,
      patterns: [
        /fire|burning|smoke|flames?/i,
        /आग|धुआं|जल रहा/i,
        /fire|smoke|जल रहा है/i
      ],
      severity: 'critical' as const,
      confidence: 0.95
    },
    {
      type: 'medical' as EmergencyType,
      patterns: [
        /medical|emergency|heart attack|unconscious|injured|bleeding|choking/i,
        /मेडिकल|आपातकाल|दिल का दौरा|बेहोश|घायल|खून|गला घुट रहा/i,
        /medical emergency|injury|बेहोश है/i
      ],
      severity: 'critical' as const,
      confidence: 0.9
    },
    {
      type: 'security' as EmergencyType,
      patterns: [
        /security|fight|violence|threat|weapon|dangerous/i,
        /सुरक्षा|लड़ाई|हिंसा|धमकी|हथियार|खतरनाक/i,
        /security issue|fight|खतरा है/i
      ],
      severity: 'high' as const,
      confidence: 0.85
    },
    {
      type: 'robbery' as EmergencyType,
      patterns: [
        /robbery|theft|stealing|burglar|intruder/i,
        /चोरी|डकैती|चुराना|चोर|घुसपैठिया/i,
        /robbery|theft|चोरी हो रही/i
      ],
      severity: 'critical' as const,
      confidence: 0.9
    },
    {
      type: 'gas_leak' as EmergencyType,
      patterns: [
        /gas leak|smell gas|propane|natural gas/i,
        /गैस लीक|गैस की गंध|प्रोपेन/i,
        /gas leak|गैस निकल रही/i
      ],
      severity: 'high' as const,
      confidence: 0.8
    },
    {
      type: 'food_poisoning' as EmergencyType,
      patterns: [
        /food poisoning|sick from food|contaminated|nausea|vomiting/i,
        /खाद्य विषाक्तता|खाने से बीमार|दूषित|मतली|उल्टी/i,
        /food poisoning|खाना खराब|उल्टी हो रही/i
      ],
      severity: 'medium' as const,
      confidence: 0.75
    },
    {
      type: 'customer_incident' as EmergencyType,
      patterns: [
        /customer complaint|angry customer|upset|dissatisfied/i,
        /ग्राहक शिकायत|नाराज ग्राहक|परेशान|असंतुष्ट/i,
        /customer angry|complaint|ग्राहक परेशान/i
      ],
      severity: 'low' as const,
      confidence: 0.7
    }
  ];

  // Pre-configured emergency protocols
  private defaultProtocols: EmergencyProtocol[] = [
    {
      id: 'fire_protocol',
      name: 'Fire Emergency Protocol',
      type: 'fire',
      triggers: ['fire detected', 'smoke alarm', 'burning smell'],
      severity: 'critical',
      autoActivate: true,
      requiresConfirmation: false,
      actions: [
        {
          type: 'notification',
          description: 'Alert fire department (911)',
          priority: 1,
          delay: 0,
          autoExecute: true
        },
        {
          type: 'evacuation',
          description: 'Initiate immediate evacuation',
          priority: 2,
          delay: 0,
          autoExecute: true
        },
        {
          type: 'system',
          description: 'Activate fire suppression system',
          priority: 3,
          delay: 30,
          autoExecute: true
        },
        {
          type: 'notification',
          description: 'Alert all staff via PA system',
          priority: 4,
          delay: 0,
          autoExecute: true
        }
      ],
      escalationRules: [
        {
          condition: 'no_response_5min',
          delay: 300,
          action: 'escalate_to_fire_chief',
          notifyRoles: ['manager', 'owner']
        }
      ]
    },
    {
      id: 'medical_protocol',
      name: 'Medical Emergency Protocol',
      type: 'medical',
      triggers: ['medical emergency', 'injury', 'unconscious person'],
      severity: 'critical',
      autoActivate: true,
      requiresConfirmation: false,
      actions: [
        {
          type: 'notification',
          description: 'Call emergency services (911)',
          priority: 1,
          delay: 0,
          autoExecute: true
        },
        {
          type: 'medical',
          description: 'Administer first aid if trained staff available',
          priority: 2,
          delay: 0,
          requiredRole: ['first_aid_certified'],
          autoExecute: false
        },
        {
          type: 'notification',
          description: 'Clear area and maintain privacy',
          priority: 3,
          delay: 0,
          autoExecute: true
        },
        {
          type: 'notification',
          description: 'Alert manager and key staff',
          priority: 4,
          delay: 0,
          autoExecute: true
        }
      ],
      escalationRules: [
        {
          condition: 'critical_condition',
          delay: 0,
          action: 'multiple_ambulance_request',
          notifyRoles: ['manager', 'owner']
        }
      ]
    },
    {
      id: 'security_protocol',
      name: 'Security Incident Protocol',
      type: 'security',
      triggers: ['violence', 'threatening behavior', 'weapon'],
      severity: 'high',
      autoActivate: false,
      requiresConfirmation: true,
      actions: [
        {
          type: 'security',
          description: 'Assess threat level',
          priority: 1,
          delay: 0,
          requiredRole: ['manager', 'security'],
          autoExecute: false
        },
        {
          type: 'notification',
          description: 'Alert security/police if needed',
          priority: 2,
          delay: 0,
          autoExecute: false
        },
        {
          type: 'protocol',
          description: 'De-escalate situation if safe',
          priority: 3,
          delay: 0,
          requiredRole: ['manager'],
          autoExecute: false
        },
        {
          type: 'evacuation',
          description: 'Evacuate area if necessary',
          priority: 4,
          delay: 0,
          autoExecute: false
        }
      ],
      escalationRules: [
        {
          condition: 'escalating_violence',
          delay: 120,
          action: 'call_police_immediately',
          notifyRoles: ['manager', 'owner', 'security']
        }
      ]
    }
  ];

  // Emergency contacts
  private defaultContacts: EmergencyContact[] = [
    {
      id: 'manager_001',
      name: 'Restaurant Manager',
      role: 'manager',
      phone: '+1-555-0101',
      email: 'manager@restaurant.com',
      priority: 1,
      availability: {
        'monday': { start: '08:00', end: '22:00' },
        'tuesday': { start: '08:00', end: '22:00' },
        'wednesday': { start: '08:00', end: '22:00' },
        'thursday': { start: '08:00', end: '22:00' },
        'friday': { start: '08:00', end: '23:00' },
        'saturday': { start: '09:00', end: '23:00' },
        'sunday': { start: '09:00', end: '21:00' }
      },
      currentStatus: 'available'
    },
    {
      id: 'owner_001',
      name: 'Restaurant Owner',
      role: 'owner',
      phone: '+1-555-0102',
      email: 'owner@restaurant.com',
      priority: 2,
      availability: {
        'monday': { start: '00:00', end: '23:59' },
        'tuesday': { start: '00:00', end: '23:59' },
        'wednesday': { start: '00:00', end: '23:59' },
        'thursday': { start: '00:00', end: '23:59' },
        'friday': { start: '00:00', end: '23:59' },
        'saturday': { start: '00:00', end: '23:59' },
        'sunday': { start: '00:00', end: '23:59' }
      },
      currentStatus: 'available'
    },
    {
      id: 'security_001',
      name: 'Security Supervisor',
      role: 'security',
      phone: '+1-555-0103',
      email: 'security@restaurant.com',
      priority: 3,
      availability: {
        'friday': { start: '18:00', end: '02:00' },
        'saturday': { start: '18:00', end: '02:00' },
        'sunday': { start: '18:00', end: '24:00' }
      },
      currentStatus: 'available'
    }
  ];

  private constructor() {
    this.initializeProtocols();
    this.initializeContacts();
  }

  public static getInstance(): CrisisHandling {
    if (!CrisisHandling.instance) {
      CrisisHandling.instance = new CrisisHandling();
    }
    return CrisisHandling.instance;
  }

  private initializeProtocols(): void {
    this.defaultProtocols.forEach(protocol => {
      this.emergencyProtocols.set(protocol.type, protocol);
    });
    
    console.log('CrisisHandling: Initialized with', this.emergencyProtocols.size, 'emergency protocols');
  }

  private initializeContacts(): void {
    this.defaultContacts.forEach(contact => {
      this.emergencyContacts.set(contact.id, contact);
    });
    
    console.log('CrisisHandling: Initialized with', this.emergencyContacts.size, 'emergency contacts');
  }

  public async detectEmergency(
    input: string, 
    context: {
      speakerId?: string;
      location?: string;
      audioMetadata?: any;
      language?: 'en' | 'hi' | 'hinglish';
    } = {}
  ): Promise<{
    isEmergency: boolean;
    type?: EmergencyType;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    confidence: number;
    alertId?: string;
  }> {
    if (!this.isSystemActive) {
      return { isEmergency: false, confidence: 0 };
    }

    try {
      // Analyze input against emergency patterns
      const detection = this.analyzeForEmergency(input);
      
      if (detection.isEmergency && detection.type && detection.severity) {
        // Create emergency alert
        const alert = await this.createEmergencyAlert({
          type: detection.type,
          severity: detection.severity,
          description: input,
          location: context.location || 'Unknown',
          reportedBy: context.speakerId || 'Voice System',
          audioTranscript: input,
          confidence: detection.confidence,
          language: context.language || 'en',
          speakerId: context.speakerId,
          audioMetadata: context.audioMetadata
        });

        // Auto-activate protocol if configured
        const protocol = this.emergencyProtocols.get(detection.type);
        if (protocol && protocol.autoActivate) {
          await this.activateProtocol(alert.id, detection.type);
        }

        return {
          isEmergency: true,
          type: detection.type,
          severity: detection.severity,
          confidence: detection.confidence,
          alertId: alert.id
        };
      }

      return { isEmergency: false, confidence: detection.confidence };
    } catch (error) {
      console.error('CrisisHandling: Error detecting emergency', error);
      return { isEmergency: false, confidence: 0 };
    }
  }

  public async activateProtocol(alertId: string, emergencyType: EmergencyType): Promise<boolean> {
    const alert = this.activeAlerts.get(alertId);
    const protocol = this.emergencyProtocols.get(emergencyType);
    
    if (!alert || !protocol) {
      console.error('CrisisHandling: Alert or protocol not found', { alertId, emergencyType });
      return false;
    }

    try {
      console.log(`CrisisHandling: Activating ${protocol.name} for alert ${alertId}`);
      
      // Execute protocol actions
      for (const actionTemplate of protocol.actions) {
        const action: EmergencyAction = {
          id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          type: actionTemplate.type,
          description: actionTemplate.description,
          status: 'pending',
          timestamp: new Date().toISOString()
        };

        // Add delay if specified
        if (actionTemplate.delay && actionTemplate.delay > 0) {
          setTimeout(async () => {
            await this.executeAction(alertId, action);
          }, actionTemplate.delay * 1000);
        } else {
          await this.executeAction(alertId, action);
        }

        alert.actions.push(action);
      }

      // Set up escalation rules
      this.setupEscalationRules(alertId, protocol.escalationRules);

      // Update alert status
      alert.status = 'acknowledged';
      alert.responseTime = new Date().toISOString();

      return true;
    } catch (error) {
      console.error('CrisisHandling: Error activating protocol', error);
      return false;
    }
  }

  public async resolveAlert(alertId: string, resolution: string, resolvedBy: string): Promise<boolean> {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) return false;

    alert.status = 'resolved';
    alert.resolvedTime = new Date().toISOString();
    
    // Log resolution
    const resolutionAction: EmergencyAction = {
      id: `resolution_${Date.now()}`,
      type: 'protocol',
      description: `Alert resolved: ${resolution}`,
      status: 'completed',
      assignedTo: resolvedBy,
      timestamp: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      result: resolution
    };

    alert.actions.push(resolutionAction);

    // Move to history
    this.alertHistory.push(alert);
    this.activeAlerts.delete(alertId);

    console.log(`CrisisHandling: Alert ${alertId} resolved by ${resolvedBy}`);
    return true;
  }

  public async escalateAlert(alertId: string, escalationReason: string): Promise<boolean> {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) return false;

    // Increase severity
    const severityLevels = ['low', 'medium', 'high', 'critical'];
    const currentIndex = severityLevels.indexOf(alert.severity);
    if (currentIndex < severityLevels.length - 1) {
      alert.severity = severityLevels[currentIndex + 1] as any;
    }

    // Notify higher-level contacts
    await this.notifyEmergencyContacts(alert, escalationReason);

    // Log escalation
    const escalationAction: EmergencyAction = {
      id: `escalation_${Date.now()}`,
      type: 'notification',
      description: `Alert escalated: ${escalationReason}`,
      status: 'completed',
      timestamp: new Date().toISOString(),
      completedAt: new Date().toISOString()
    };

    alert.actions.push(escalationAction);

    console.log(`CrisisHandling: Alert ${alertId} escalated - ${escalationReason}`);
    return true;
  }

  public getActiveAlerts(): EmergencyAlert[] {
    return Array.from(this.activeAlerts.values());
  }

  public getAlertHistory(limit: number = 50): EmergencyAlert[] {
    return this.alertHistory.slice(-limit);
  }

  public getEmergencyStatus(): {
    active: boolean;
    activeAlerts: number;
    criticalAlerts: number;
    recentResolutions: number;
  } {
    const activeAlerts = this.getActiveAlerts();
    const criticalAlerts = activeAlerts.filter(alert => alert.severity === 'critical').length;
    const recentResolutions = this.alertHistory.filter(
      alert => new Date(alert.resolvedTime || '').getTime() > Date.now() - 24 * 60 * 60 * 1000
    ).length;

    return {
      active: this.isSystemActive,
      activeAlerts: activeAlerts.length,
      criticalAlerts,
      recentResolutions
    };
  }

  public async testProtocol(emergencyType: EmergencyType, dryRun: boolean = true): Promise<{
    protocolExists: boolean;
    actions: string[];
    estimatedResponseTime: number;
    contacts: string[];
  }> {
    const protocol = this.emergencyProtocols.get(emergencyType);
    if (!protocol) {
      return {
        protocolExists: false,
        actions: [],
        estimatedResponseTime: 0,
        contacts: []
      };
    }

    const actions = protocol.actions.map(action => action.description);
    const estimatedResponseTime = protocol.actions.reduce((total, action) => 
      total + (action.delay || 0), 0
    );
    
    const contacts = Array.from(this.emergencyContacts.values())
      .filter(contact => contact.currentStatus === 'available')
      .map(contact => contact.name);

    if (!dryRun) {
      // Create test alert
      const testAlert = await this.createEmergencyAlert({
        type: emergencyType,
        severity: 'low',
        description: `TEST: ${protocol.name} drill`,
        location: 'Test Location',
        reportedBy: 'System Test',
        audioTranscript: 'Test emergency drill',
        confidence: 1.0,
        language: 'en'
      });

      console.log(`CrisisHandling: Test protocol executed for ${emergencyType}`);
    }

    return {
      protocolExists: true,
      actions,
      estimatedResponseTime,
      contacts
    };
  }

  // Private helper methods

  private analyzeForEmergency(input: string): {
    isEmergency: boolean;
    type?: EmergencyType;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    confidence: number;
  } {
    let bestMatch: {
      type: EmergencyType;
      severity: 'low' | 'medium' | 'high' | 'critical';
      confidence: number;
    } | null = null;

    for (const pattern of this.emergencyPatterns) {
      for (const regex of pattern.patterns) {
        if (regex.test(input)) {
          const confidence = pattern.confidence;
          
          if (!bestMatch || confidence > bestMatch.confidence) {
            bestMatch = {
              type: pattern.type,
              severity: pattern.severity,
              confidence
            };
          }
        }
      }
    }

    if (bestMatch && bestMatch.confidence > 0.6) {
      return {
        isEmergency: true,
        type: bestMatch.type,
        severity: bestMatch.severity,
        confidence: bestMatch.confidence
      };
    }

    return { isEmergency: false, confidence: bestMatch?.confidence || 0 };
  }

  private async createEmergencyAlert(data: {
    type: EmergencyType;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    location: string;
    reportedBy: string;
    audioTranscript: string;
    confidence: number;
    language: 'en' | 'hi' | 'hinglish';
    speakerId?: string;
    audioMetadata?: any;
  }): Promise<EmergencyAlert> {
    const alert: EmergencyAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type: data.type,
      severity: data.severity,
      location: data.location,
      description: data.description,
      reportedBy: data.reportedBy,
      timestamp: new Date().toISOString(),
      status: 'active',
      assignedPersonnel: [],
      actions: [],
      metadata: {
        audioTranscript: data.audioTranscript,
        confidence: data.confidence,
        language: data.language,
        speakerId: data.speakerId,
        audioMetadata: data.audioMetadata
      }
    };

    this.activeAlerts.set(alert.id, alert);
    
    // Immediate notifications for critical alerts
    if (data.severity === 'critical') {
      await this.notifyEmergencyContacts(alert, 'Critical emergency detected');
    }

    console.log(`CrisisHandling: Created ${data.severity} alert ${alert.id} for ${data.type}`);
    return alert;
  }

  private async executeAction(alertId: string, action: EmergencyAction): Promise<void> {
    action.status = 'in_progress';
    
    try {
      switch (action.type) {
        case 'notification':
          await this.executeNotification(action);
          break;
        case 'protocol':
          await this.executeProtocol(action);
          break;
        case 'evacuation':
          await this.executeEvacuation(action);
          break;
        case 'medical':
          await this.executeMedicalAction(action);
          break;
        case 'security':
          await this.executeSecurityAction(action);
          break;
        case 'system':
          await this.executeSystemAction(action);
          break;
      }
      
      action.status = 'completed';
      action.completedAt = new Date().toISOString();
      action.result = 'Action completed successfully';
      
    } catch (error) {
      action.status = 'failed';
      action.result = `Action failed: ${error}`;
      console.error(`CrisisHandling: Action ${action.id} failed`, error);
    }
  }

  private async executeNotification(action: EmergencyAction): Promise<void> {
    // Mock notification execution
    console.log(`CrisisHandling: Executing notification - ${action.description}`);
    
    // In production, this would:
    // - Send SMS/email alerts
    // - Make phone calls
    // - Send push notifications
    // - Update external systems
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private async executeProtocol(action: EmergencyAction): Promise<void> {
    console.log(`CrisisHandling: Executing protocol - ${action.description}`);
    
    // Mock protocol execution
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  private async executeEvacuation(action: EmergencyAction): Promise<void> {
    console.log(`CrisisHandling: Executing evacuation - ${action.description}`);
    
    // In production, this would:
    // - Activate PA system
    // - Unlock emergency exits
    // - Display evacuation routes
    // - Count personnel
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  private async executeMedicalAction(action: EmergencyAction): Promise<void> {
    console.log(`CrisisHandling: Executing medical action - ${action.description}`);
    
    // Mock medical action
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  private async executeSecurityAction(action: EmergencyAction): Promise<void> {
    console.log(`CrisisHandling: Executing security action - ${action.description}`);
    
    // Mock security action
    await new Promise(resolve => setTimeout(resolve, 400));
  }

  private async executeSystemAction(action: EmergencyAction): Promise<void> {
    console.log(`CrisisHandling: Executing system action - ${action.description}`);
    
    // In production, this would:
    // - Control building systems
    // - Activate fire suppression
    // - Control ventilation
    // - Lock/unlock doors
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  private async notifyEmergencyContacts(alert: EmergencyAlert, message: string): Promise<void> {
    const availableContacts = Array.from(this.emergencyContacts.values())
      .filter(contact => contact.currentStatus === 'available')
      .sort((a, b) => a.priority - b.priority);

    for (const contact of availableContacts.slice(0, 3)) {
      console.log(`CrisisHandling: Notifying ${contact.name} (${contact.role}) - ${message}`);
      
      // In production, send actual notifications
      // await sendSMS(contact.phone, message);
      // await sendEmail(contact.email, alert);
    }
  }

  private setupEscalationRules(alertId: string, rules: EscalationRule[]): void {
    rules.forEach(rule => {
      setTimeout(async () => {
        const alert = this.activeAlerts.get(alertId);
        if (alert && alert.status === 'active') {
          await this.escalateAlert(alertId, rule.action);
        }
      }, rule.delay * 1000);
    });
  }

  public activateEmergencyMode(): void {
    this.isSystemActive = true;
    console.log('CrisisHandling: Emergency mode activated');
  }

  public deactivateEmergencyMode(): void {
    this.isSystemActive = false;
    console.log('CrisisHandling: Emergency mode deactivated');
  }

  public shutdown(): void {
    this.activeAlerts.clear();
    this.emergencyProtocols.clear();
    this.emergencyContacts.clear();
    this.alertHistory = [];
    this.isSystemActive = false;
    console.log('CrisisHandling: Shutdown complete');
  }
}