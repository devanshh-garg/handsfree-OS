'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, RotateCcw, CheckCircle, Circle, Mic, Brain, Zap, Users, AlertTriangle, Shield, Database, Activity, MessageSquare, Speaker, BarChart3 } from 'lucide-react';
import { useVoiceStore } from '@/stores/voiceStore';
import { getEnhancedVoiceProcessor } from '@/lib/nlp/EnhancedVoiceProcessor';
import { DialogueManager } from '@/lib/conversation/DialogueManager';
import { CrisisHandling } from '@/lib/emergency/CrisisHandling';
import { BatchProcessor } from '@/lib/operations/BatchProcessor';
import { ProactiveAssistance } from '@/lib/conversation/ProactiveAssistance';
import { FallbackStrategies } from '@/lib/fallback/FallbackStrategies';
import { ModelCache } from '@/lib/performance/ModelCache';
import { VoiceAnalytics } from '@/lib/analytics/VoiceAnalytics';
import { EmotionDetection } from '@/lib/audio/EmotionDetection';
import { VoiceBiometrics } from '@/lib/audio/VoiceBiometrics';
import { SpeakerDiarization } from '@/lib/audio/SpeakerDiarization';
import ConversationalForms from '@/components/voice/ConversationalForms';
import VoiceOnboarding from '@/components/voice/VoiceOnboarding';

interface DemoScenario {
  id: string;
  title: string;
  description: string;
  category: 'conversation' | 'crisis' | 'bulk' | 'predictive' | 'biometrics' | 'analytics' | 'forms' | 'onboarding' | 'fallback';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  steps: DemoStep[];
  expectedOutcomes: string[];
  timeEstimate: number; // in seconds
  systemComponents: string[];
  newFeatures?: string[];
}

interface DemoStep {
  id: string;
  type: 'voice_input' | 'system_response' | 'agent_action' | 'user_instruction' | 'wait';
  content: string;
  hindiContent?: string;
  duration?: number;
  expectedResponse?: string;
  agentType?: string;
}

interface ScenarioState {
  currentStep: number;
  isRunning: boolean;
  isPaused: boolean;
  completedSteps: Set<string>;
  startTime: Date | null;
  results: { [stepId: string]: any };
}

export function VoiceDemoScenarios() {
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [scenarioState, setScenarioState] = useState<ScenarioState>({
    currentStep: 0,
    isRunning: false,
    isPaused: false,
    completedSteps: new Set(),
    startTime: null,
    results: {}
  });
  
  const { processVoiceCommand, isProcessing } = useVoiceStore();
  const stepTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const enhancedProcessor = getEnhancedVoiceProcessor();
  
  // Initialize new system components
  const dialogueManager = DialogueManager.getInstance();
  const crisisHandling = CrisisHandling.getInstance();
  const batchProcessor = BatchProcessor.getInstance();
  const proactiveAssistance = ProactiveAssistance.getInstance();
  const fallbackStrategies = FallbackStrategies.getInstance();
  const modelCache = ModelCache.getInstance();
  const voiceAnalytics = VoiceAnalytics.getInstance();
  const emotionDetection = EmotionDetection.getInstance();
  const voiceBiometrics = VoiceBiometrics.getInstance();
  const speakerDiarization = SpeakerDiarization.getInstance();
  
  const [showSystemStatus, setShowSystemStatus] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [showAdvancedFeatures, setShowAdvancedFeatures] = useState(false);

  // Demo scenarios showcasing advanced voice capabilities
  const demoScenarios: DemoScenario[] = [
    {
      id: 'multi-turn-conversation',
      title: 'Multi-turn Intelligent Conversation',
      description: 'Experience context-aware conversation with memory and entity resolution',
      category: 'conversation',
      difficulty: 'intermediate',
      timeEstimate: 120,
      steps: [
        {
          id: 'step1',
          type: 'user_instruction',
          content: 'This scenario demonstrates multi-turn conversation with context awareness.',
          duration: 3
        },
        {
          id: 'step2',
          type: 'voice_input',
          content: 'Table 5 pe order ready hai',
          hindiContent: 'Table 5 pe order ready hai',
          expectedResponse: 'Table 5 का order ready mark कर दिया गया है'
        },
        {
          id: 'step3',
          type: 'system_response',
          content: 'System understands table context and marks order as ready',
          duration: 2
        },
        {
          id: 'step4',
          type: 'voice_input',
          content: 'Aur customer ko inform kar do',
          hindiContent: 'और customer को inform कर दो',
          expectedResponse: 'Customer को inform कर दिया गया है'
        },
        {
          id: 'step5',
          type: 'system_response',
          content: 'System remembers table 5 context and informs customer',
          duration: 2
        },
        {
          id: 'step6',
          type: 'voice_input',
          content: 'Bill bhi ready kar do',
          hindiContent: 'Bill भी ready कर दो',
          expectedResponse: 'Bill ready कर दिया गया है'
        },
        {
          id: 'step7',
          type: 'agent_action',
          content: 'Revenue optimization agent calculates bill and suggests upselling',
          agentType: 'revenue-optimizer',
          duration: 3
        }
      ],
      expectedOutcomes: [
        'Context maintained across conversation turns',
        'Entity resolution (Table 5) carried forward',
        'Mixed language understanding (Hinglish)',
        'Agent recommendations triggered automatically'
      ],
      systemComponents: ['DialogueManager', 'NLP Engine', 'Context Store'],
      newFeatures: ['Multi-turn memory', 'Entity resolution', 'Context switching']
    },
    {
      id: 'crisis-handling',
      title: 'Emergency Crisis Management',
      description: 'Handle customer emergencies with immediate staff coordination',
      category: 'crisis',
      difficulty: 'advanced',
      timeEstimate: 90,
      steps: [
        {
          id: 'step1',
          type: 'user_instruction',
          content: 'Emergency scenario: Customer allergic reaction',
          duration: 2
        },
        {
          id: 'step2',
          type: 'voice_input',
          content: 'Emergency! Table 3 customer allergic reaction ho raha hai',
          hindiContent: 'Emergency! Table 3 customer allergic reaction हो रहा है',
          expectedResponse: 'Emergency protocol activated for Table 3'
        },
        {
          id: 'step3',
          type: 'system_response',
          content: 'System detects emergency keywords and elevates priority',
          duration: 1
        },
        {
          id: 'step4',
          type: 'agent_action',
          content: 'Customer satisfaction agent alerts all staff immediately',
          agentType: 'customer-satisfaction',
          duration: 2
        },
        {
          id: 'step5',
          type: 'voice_input',
          content: 'Manager ko call kar aur first aid kit lao',
          hindiContent: 'Manager को call कर और first aid kit लाओ',
          expectedResponse: 'Manager called and first aid kit requested'
        },
        {
          id: 'step6',
          type: 'agent_action',
          content: 'Multiple agents coordinate: staff notification, incident logging, follow-up protocols',
          agentType: 'multiple',
          duration: 3
        },
        {
          id: 'step7',
          type: 'system_response',
          content: 'All staff notified, incident documented, emergency procedures initiated',
          duration: 2
        }
      ],
      expectedOutcomes: [
        'Immediate emergency detection and response',
        'Multi-agent coordination for crisis management',
        'Staff alert system activated',
        'Incident logging and follow-up protocols initiated'
      ],
      systemComponents: ['CrisisHandling', 'EmergencyProtocols', 'Staff Alerts'],
      newFeatures: ['Emergency detection', 'Protocol automation', 'Staff coordination']
    },
    {
      id: 'bulk-operations',
      title: 'Bulk Order Management',
      description: 'Handle mass operations with single voice commands',
      category: 'bulk',
      difficulty: 'advanced',
      timeEstimate: 100,
      steps: [
        {
          id: 'step1',
          type: 'user_instruction',
          content: 'Demonstrate bulk operations using single voice command',
          duration: 3
        },
        {
          id: 'step2',
          type: 'voice_input',
          content: 'Table 3 to 8 ke saare starter orders ready mark kar do',
          hindiContent: 'Table 3 to 8 के सारे starter orders ready mark कर दो',
          expectedResponse: 'Marking all starter orders for tables 3-8 as ready'
        },
        {
          id: 'step3',
          type: 'agent_action',
          content: 'Order optimization agent processes bulk operation',
          agentType: 'order-optimizer',
          duration: 4
        },
        {
          id: 'step4',
          type: 'system_response',
          content: 'System processes range operation: Tables 3, 4, 5, 6, 7, 8 starter orders updated',
          duration: 2
        },
        {
          id: 'step5',
          type: 'voice_input',
          content: 'Kitchen ko inform kar do main course prep start karne ke liye',
          hindiContent: 'Kitchen को inform कर दो main course prep start करने के लिए',
          expectedResponse: 'Kitchen notified to start main course preparation'
        },
        {
          id: 'step6',
          type: 'agent_action',
          content: 'Order optimization agent calculates optimal prep sequence',
          agentType: 'order-optimizer',
          duration: 3
        }
      ],
      expectedOutcomes: [
        'Bulk operations processed efficiently',
        'Range understanding (Table 3 to 8)',
        'Kitchen workflow optimization',
        'Automated prep sequence calculation'
      ],
      systemComponents: ['BatchProcessor', 'Order Management', 'Kitchen Coordination'],
      newFeatures: ['Range processing', 'Bulk operations', 'Workflow optimization']
    },
    {
      id: 'predictive-assistance',
      title: 'AI Predictive Assistance',
      description: 'Experience proactive AI recommendations based on patterns',
      category: 'predictive',
      difficulty: 'intermediate',
      timeEstimate: 110,
      steps: [
        {
          id: 'step1',
          type: 'user_instruction',
          content: 'AI analyzes patterns and provides proactive suggestions',
          duration: 3
        },
        {
          id: 'step2',
          type: 'voice_input',
          content: 'Lunch rush ke liye prep status kya hai',
          hindiContent: 'Lunch rush के लिए prep status क्या है',
          expectedResponse: 'Checking lunch rush preparation status'
        },
        {
          id: 'step3',
          type: 'agent_action',
          content: 'Inventory prediction agent analyzes upcoming demand',
          agentType: 'inventory-predictor',
          duration: 4
        },
        {
          id: 'step4',
          type: 'system_response',
          content: 'AI predicts: "Lunch rush in 30 minutes. Paneer stock low, prep more dal"',
          duration: 3
        },
        {
          id: 'step5',
          type: 'voice_input',
          content: 'Recommendations implement kar do',
          hindiContent: 'Recommendations implement कर दो',
          expectedResponse: 'Implementing AI recommendations'
        },
        {
          id: 'step6',
          type: 'agent_action',
          content: 'Multiple agents coordinate: inventory alerts, kitchen prep orders, staff scheduling',
          agentType: 'multiple',
          duration: 4
        },
        {
          id: 'step7',
          type: 'system_response',
          content: 'Predictive actions taken: Kitchen notified, inventory restocked, extra staff scheduled',
          duration: 2
        }
      ],
      expectedOutcomes: [
        'Predictive demand analysis',
        'Proactive inventory management',
        'Automated staff scheduling',
        'Kitchen prep optimization'
      ],
      systemComponents: ['ProactiveAssistance', 'ML Models', 'Predictive Analytics'],
      newFeatures: ['Pattern recognition', 'Proactive suggestions', 'Demand prediction']
    },
    {
      id: 'voice-biometrics',
      title: 'Voice Biometric Authentication',
      description: 'Secure staff authentication using voice recognition and speaker identification',
      category: 'biometrics',
      difficulty: 'advanced',
      timeEstimate: 95,
      steps: [
        {
          id: 'step1',
          type: 'user_instruction',
          content: 'Demonstration of voice biometric authentication for staff security',
          duration: 3
        },
        {
          id: 'step2',
          type: 'voice_input',
          content: 'Main hoon Raj, manager. Mera authentication kar do',
          hindiContent: 'मैं हूँ Raj, manager। मेरा authentication कर दो',
          expectedResponse: 'Voice biometric authentication in progress'
        },
        {
          id: 'step3',
          type: 'agent_action',
          content: 'Voice biometrics system analyzes voice patterns and speaker characteristics',
          agentType: 'biometrics',
          duration: 4
        },
        {
          id: 'step4',
          type: 'system_response',
          content: 'Authentication successful: Raj Kumar (Manager) - Access granted with full permissions',
          duration: 2
        },
        {
          id: 'step5',
          type: 'voice_input',
          content: 'Kitchen mein jo staff hai unko bhi authenticate kar do',
          hindiContent: 'Kitchen में जो staff है उनको भी authenticate कर दो',
          expectedResponse: 'Multi-speaker authentication initiated'
        },
        {
          id: 'step6',
          type: 'agent_action',
          content: 'Speaker diarization identifies multiple voices and authenticates each staff member',
          agentType: 'multi-auth',
          duration: 5
        }
      ],
      expectedOutcomes: [
        'Secure voice-based staff authentication',
        'Multi-speaker identification and verification',
        'Role-based access control via voice',
        'Real-time security monitoring'
      ],
      systemComponents: ['VoiceBiometrics', 'SpeakerDiarization', 'Authentication'],
      newFeatures: ['Voice fingerprinting', 'Speaker separation', 'Security verification']
    },
    {
      id: 'conversational-forms',
      title: 'Voice-Driven Form Completion',
      description: 'Complete complex forms using natural voice conversation with validation',
      category: 'forms',
      difficulty: 'intermediate',
      timeEstimate: 130,
      steps: [
        {
          id: 'step1',
          type: 'user_instruction',
          content: 'Experience conversational form filling with voice validation and error correction',
          duration: 3
        },
        {
          id: 'step2',
          type: 'voice_input',
          content: 'Naya customer order form bharna hai',
          hindiContent: 'नया customer order form भरना है',
          expectedResponse: 'Starting customer order form. What is the customer name?'
        },
        {
          id: 'step3',
          type: 'voice_input',
          content: 'Customer name hai Ankit Sharma',
          hindiContent: 'Customer name है Ankit Sharma',
          expectedResponse: 'Name recorded as Ankit Sharma. What is the table number?'
        },
        {
          id: 'step4',
          type: 'agent_action',
          content: 'Form validation agent checks name format and suggests corrections if needed',
          agentType: 'form-validator',
          duration: 2
        },
        {
          id: 'step5',
          type: 'voice_input',
          content: 'Table number 7. Order mein 2 pizza aur 3 cold drink',
          hindiContent: 'Table number 7। Order में 2 pizza और 3 cold drink',
          expectedResponse: 'Table 7, 2 pizzas, 3 cold drinks recorded. Confirm order total?'
        },
        {
          id: 'step6',
          type: 'system_response',
          content: 'Multi-step form completed via voice with automatic validation and confirmation',
          duration: 2
        }
      ],
      expectedOutcomes: [
        'Natural language form completion',
        'Voice validation and error correction',
        'Multi-step form navigation via speech',
        'Automatic data formatting and confirmation'
      ],
      systemComponents: ['ConversationalForms', 'Voice Validation', 'Form Processing'],
      newFeatures: ['Speech-driven forms', 'Voice validation', 'Error correction']
    },
    {
      id: 'emotion-analytics',
      title: 'Real-time Emotion & Analytics',
      description: 'Monitor customer emotions and generate real-time analytics insights',
      category: 'analytics',
      difficulty: 'advanced',
      timeEstimate: 110,
      steps: [
        {
          id: 'step1',
          type: 'user_instruction',
          content: 'Demonstration of emotion detection and real-time analytics generation',
          duration: 3
        },
        {
          id: 'step2',
          type: 'voice_input',
          content: 'Yaar main bahut pareshan hoon, order mein delay ho raha hai',
          hindiContent: 'यार मैं बहुत परेशान हूँ, order में delay हो रहा है',
          expectedResponse: 'I understand your frustration. Let me check your order status.'
        },
        {
          id: 'step3',
          type: 'agent_action',
          content: 'Emotion detection analyzes tone: frustration (85% confidence), stress detected',
          agentType: 'emotion-analyzer',
          duration: 3
        },
        {
          id: 'step4',
          type: 'system_response',
          content: 'Customer satisfaction alert triggered. Manager notified for immediate attention.',
          duration: 2
        },
        {
          id: 'step5',
          type: 'agent_action',
          content: 'Analytics system tracks interaction patterns and generates insights',
          agentType: 'analytics',
          duration: 4
        },
        {
          id: 'step6',
          type: 'system_response',
          content: 'Real-time dashboard updated: Customer satisfaction dip detected, service recovery initiated',
          duration: 2
        }
      ],
      expectedOutcomes: [
        'Real-time emotion detection from voice',
        'Customer satisfaction monitoring',
        'Automated service recovery protocols',
        'Analytics insights and reporting'
      ],
      systemComponents: ['EmotionDetection', 'VoiceAnalytics', 'Customer Insights'],
      newFeatures: ['Emotion analysis', 'Real-time analytics', 'Service recovery']
    },
    {
      id: 'smart-fallbacks',
      title: 'Intelligent Error Recovery',
      description: 'Experience smart fallback strategies when voice recognition fails',
      category: 'fallback',
      difficulty: 'intermediate',
      timeEstimate: 80,
      steps: [
        {
          id: 'step1',
          type: 'user_instruction',
          content: 'Demonstration of intelligent fallback strategies and error recovery',
          duration: 3
        },
        {
          id: 'step2',
          type: 'voice_input',
          content: '[Simulated unclear audio] Mzzble... table... kzzzch... ready...',
          expectedResponse: 'I didnt catch that clearly. Could you please repeat?'
        },
        {
          id: 'step3',
          type: 'agent_action',
          content: 'Fallback system detects low audio quality and activates enhancement strategies',
          agentType: 'fallback-handler',
          duration: 3
        },
        {
          id: 'step4',
          type: 'system_response',
          content: 'Audio enhancement applied. Contextual inference suggests table order status query.',
          duration: 2
        },
        {
          id: 'step5',
          type: 'voice_input',
          content: 'Table 4 order ready hai kya',
          hindiContent: 'Table 4 order ready है क्या',
          expectedResponse: 'Yes, Table 4 order is ready for pickup'
        },
        {
          id: 'step6',
          type: 'system_response',
          content: 'Fallback successful: Context maintained, query resolved, user experience preserved',
          duration: 2
        }
      ],
      expectedOutcomes: [
        'Graceful handling of recognition failures',
        'Contextual inference for unclear input',
        'Audio quality enhancement',
        'Multiple fallback strategy chaining'
      ],
      systemComponents: ['FallbackStrategies', 'Audio Enhancement', 'Context Inference'],
      newFeatures: ['Smart fallbacks', 'Audio enhancement', 'Context recovery']
    }
  ];

  const currentScenario = demoScenarios.find(s => s.id === selectedScenario);
  const currentStep = currentScenario?.steps[scenarioState.currentStep];

  useEffect(() => {
    // Cleanup timeout on unmount
    return () => {
      if (stepTimeoutRef.current) {
        clearTimeout(stepTimeoutRef.current);
      }
    };
  }, []);

  const startScenario = async (scenarioId: string) => {
    setSelectedScenario(scenarioId);
    setScenarioState({
      currentStep: 0,
      isRunning: true,
      isPaused: false,
      completedSteps: new Set(),
      startTime: new Date(),
      results: {}
    });

    // Initialize enhanced voice processor
    await enhancedProcessor.initialize();
    
    executeNextStep(scenarioId, 0);
  };

  const executeNextStep = async (scenarioId: string, stepIndex: number) => {
    const scenario = demoScenarios.find(s => s.id === scenarioId);
    if (!scenario || stepIndex >= scenario.steps.length) {
      completeScenario();
      return;
    }

    const step = scenario.steps[stepIndex];
    
    switch (step.type) {
      case 'user_instruction':
        // Display instruction and wait
        stepTimeoutRef.current = setTimeout(() => {
          advanceStep();
        }, (step.duration || 3) * 1000);
        break;

      case 'voice_input':
        // Simulate voice input processing
        await processVoiceInput(step);
        setTimeout(() => advanceStep(), 2000);
        break;

      case 'system_response':
        // Display system response
        stepTimeoutRef.current = setTimeout(() => {
          advanceStep();
        }, (step.duration || 2) * 1000);
        break;

      case 'agent_action':
        // Simulate agent processing
        await simulateAgentAction(step);
        setTimeout(() => advanceStep(), (step.duration || 3) * 1000);
        break;

      case 'wait':
        stepTimeoutRef.current = setTimeout(() => {
          advanceStep();
        }, (step.duration || 1) * 1000);
        break;
    }
  };

  const processVoiceInput = async (step: DemoStep) => {
    try {
      // Use enhanced voice processor
      const result = await enhancedProcessor.processVoiceCommand(
        step.content,
        0.95, // High confidence for demo
        `demo_session_${Date.now()}`
      );

      // Store results
      setScenarioState(prev => ({
        ...prev,
        results: {
          ...prev.results,
          [step.id]: {
            input: step.content,
            analysis: result.nlpAnalysis,
            response: result.response,
            agents: result.agentRecommendations
          }
        }
      }));

      console.log('Demo voice processing result:', result);
    } catch (error) {
      console.warn('Demo voice processing failed:', error);
      // Continue with fallback
      setScenarioState(prev => ({
        ...prev,
        results: {
          ...prev.results,
          [step.id]: {
            input: step.content,
            response: step.expectedResponse || 'Processed successfully',
            error: error
          }
        }
      }));
    }
  };

  const simulateAgentAction = async (step: DemoStep) => {
    // Simulate agent processing time and results with new components
    const agentResults = {
      'order-optimizer': '3 orders optimized, kitchen efficiency +15%',
      'inventory-predictor': '2 low stock alerts, 4 predictions generated',
      'customer-satisfaction': 'Staff notified, incident logged, follow-up scheduled',
      'revenue-optimizer': 'Pricing optimized, 2 upsell opportunities found',
      'multiple': 'Multi-agent coordination complete',
      'biometrics': 'Voice authenticated: Raj Kumar (Manager) - 94% confidence',
      'multi-auth': 'Kitchen staff authenticated: 3 voices identified and verified',
      'form-validator': 'Form fields validated, data formatted, confirmation ready',
      'emotion-analyzer': 'Emotion detected: Frustration (85%), Customer satisfaction alert triggered',
      'analytics': 'Real-time metrics updated, insights generated, dashboard refreshed',
      'fallback-handler': 'Audio enhanced, context inferred, fallback strategy successful'
    };

    setScenarioState(prev => ({
      ...prev,
      results: {
        ...prev.results,
        [step.id]: {
          agentType: step.agentType,
          result: agentResults[step.agentType as keyof typeof agentResults] || 'Agent processing complete'
        }
      }
    }));
  };

  const advanceStep = () => {
    setScenarioState(prev => {
      const newCompletedSteps = new Set(prev.completedSteps);
      if (currentStep) {
        newCompletedSteps.add(currentStep.id);
      }

      const nextStep = prev.currentStep + 1;
      
      if (selectedScenario && nextStep < demoScenarios.find(s => s.id === selectedScenario)!.steps.length) {
        executeNextStep(selectedScenario, nextStep);
      } else {
        completeScenario();
      }

      return {
        ...prev,
        currentStep: nextStep,
        completedSteps: newCompletedSteps
      };
    });
  };

  const completeScenario = () => {
    setScenarioState(prev => ({
      ...prev,
      isRunning: false,
      isPaused: false
    }));
  };

  const resetScenario = () => {
    if (stepTimeoutRef.current) {
      clearTimeout(stepTimeoutRef.current);
    }
    
    setScenarioState({
      currentStep: 0,
      isRunning: false,
      isPaused: false,
      completedSteps: new Set(),
      startTime: null,
      results: {}
    });
  };

  const pauseScenario = () => {
    if (stepTimeoutRef.current) {
      clearTimeout(stepTimeoutRef.current);
    }
    
    setScenarioState(prev => ({
      ...prev,
      isPaused: !prev.isPaused
    }));
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'conversation': return <Brain className="w-5 h-5" />;
      case 'crisis': return <AlertTriangle className="w-5 h-5" />;
      case 'bulk': return <Users className="w-5 h-5" />;
      case 'predictive': return <Zap className="w-5 h-5" />;
      case 'biometrics': return <Shield className="w-5 h-5" />;
      case 'analytics': return <BarChart3 className="w-5 h-5" />;
      case 'forms': return <MessageSquare className="w-5 h-5" />;
      case 'onboarding': return <Speaker className="w-5 h-5" />;
      case 'fallback': return <Activity className="w-5 h-5" />;
      default: return <Circle className="w-5 h-5" />;
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'text-green-600 bg-green-100';
      case 'intermediate': return 'text-yellow-600 bg-yellow-100';
      case 'advanced': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
          🗣️ Advanced Voice Intelligence Demo
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-300">
          Experience cutting-edge AI-powered voice interaction with multilingual NLP, context awareness, and autonomous agents
        </p>
      </div>

      {/* System Status Panel */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Database className="w-5 h-5" />
            System Status
          </h3>
          <button
            onClick={() => setShowSystemStatus(!showSystemStatus)}
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            {showSystemStatus ? 'Hide' : 'Show'} Details
          </button>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="text-center">
            <div className="w-3 h-3 rounded-full bg-green-500 mx-auto mb-1"></div>
            <span className="text-xs text-gray-600 dark:text-gray-400">Voice Engine</span>
          </div>
          <div className="text-center">
            <div className="w-3 h-3 rounded-full bg-green-500 mx-auto mb-1"></div>
            <span className="text-xs text-gray-600 dark:text-gray-400">AI Agents</span>
          </div>
          <div className="text-center">
            <div className="w-3 h-3 rounded-full bg-green-500 mx-auto mb-1"></div>
            <span className="text-xs text-gray-600 dark:text-gray-400">Analytics</span>
          </div>
          <div className="text-center">
            <div className="w-3 h-3 rounded-full bg-green-500 mx-auto mb-1"></div>
            <span className="text-xs text-gray-600 dark:text-gray-400">Security</span>
          </div>
        </div>
        
        {showSystemStatus && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-gray-600 dark:text-gray-400">
            <div>
              <strong>Core Systems:</strong>
              <ul className="mt-1 space-y-1">
                <li>✓ DialogueManager</li>
                <li>✓ CrisisHandling</li>
                <li>✓ BatchProcessor</li>
              </ul>
            </div>
            <div>
              <strong>Audio Systems:</strong>
              <ul className="mt-1 space-y-1">
                <li>✓ VoiceBiometrics</li>
                <li>✓ EmotionDetection</li>
                <li>✓ SpeakerDiarization</li>
              </ul>
            </div>
            <div>
              <strong>Intelligence:</strong>
              <ul className="mt-1 space-y-1">
                <li>✓ ProactiveAssistance</li>
                <li>✓ FallbackStrategies</li>
                <li>✓ VoiceAnalytics</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {!selectedScenario ? (
        // Scenario Selection
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Choose Demo Scenario</h2>
            <button
              onClick={() => setShowAdvancedFeatures(!showAdvancedFeatures)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {showAdvancedFeatures ? 'Show Basic' : 'Show All Features'}
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {demoScenarios
            .filter(scenario => showAdvancedFeatures || ['conversation', 'crisis', 'bulk', 'predictive'].includes(scenario.category))
            .map((scenario) => (
            <motion.div
              key={scenario.id}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 cursor-pointer hover:shadow-xl transition-all"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => startScenario(scenario.id)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  {getCategoryIcon(scenario.category)}
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                    {scenario.title}
                  </h3>
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getDifficultyColor(scenario.difficulty)}`}>
                  {scenario.difficulty}
                </span>
              </div>
              
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                {scenario.description}
              </p>
              
              <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                <span>{scenario.steps.length} steps</span>
                <span>~{Math.round(scenario.timeEstimate / 60)} minutes</span>
              </div>
              
              <div className="mt-4 space-y-3">
                {scenario.newFeatures && (
                  <div>
                    <h4 className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">🆕 New Features:</h4>
                    <div className="flex flex-wrap gap-1">
                      {scenario.newFeatures.slice(0, 3).map((feature, index) => (
                        <span key={index} className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full">
                          {feature}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Expected Outcomes:</h4>
                  <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                    {scenario.expectedOutcomes.slice(0, 2).map((outcome, index) => (
                      <li key={index} className="flex items-center gap-2">
                        <CheckCircle className="w-3 h-3 text-green-500" />
                        {outcome}
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">System Components:</h4>
                  <div className="flex flex-wrap gap-1">
                    {scenario.systemComponents.slice(0, 3).map((component, index) => (
                      <span key={index} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-1 rounded">
                        {component}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
          </div>
        </div>
      ) : (
        // Scenario Execution
        <div className="space-y-6">
          {/* Scenario Header */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setSelectedScenario(null)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  ←
                </button>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {currentScenario?.title}
                  </h2>
                  <p className="text-gray-600 dark:text-gray-300">
                    {currentScenario?.description}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={pauseScenario}
                  disabled={!scenarioState.isRunning}
                  className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {scenarioState.isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                </button>
                <button
                  onClick={resetScenario}
                  className="p-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            {/* Progress Bar */}
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-4">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{
                  width: currentScenario ? `${(scenarioState.currentStep / currentScenario.steps.length) * 100}%` : '0%'
                }}
              />
            </div>
            
            <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
              <span>Step {scenarioState.currentStep + 1} of {currentScenario?.steps.length}</span>
              <span>
                {scenarioState.isRunning ? (scenarioState.isPaused ? 'Paused' : 'Running') : 'Completed'}
              </span>
            </div>
          </div>

          {/* Current Step Display */}
          {currentStep && (
            <motion.div
              key={currentStep.id}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex items-center gap-3 mb-4">
                {currentStep.type === 'voice_input' && <Mic className="w-5 h-5 text-red-500" />}
                {currentStep.type === 'agent_action' && <Brain className="w-5 h-5 text-blue-500" />}
                {currentStep.type === 'system_response' && <Zap className="w-5 h-5 text-green-500" />}
                {currentStep.type === 'user_instruction' && <Circle className="w-5 h-5 text-gray-500" />}
                
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white capitalize">
                  {currentStep.type.replace(/_/g, ' ')}
                </h3>
              </div>
              
              <div className="space-y-3">
                <p className="text-gray-800 dark:text-gray-200">
                  {currentStep.content}
                </p>
                
                {currentStep.hindiContent && (
                  <p className="text-gray-600 dark:text-gray-400 font-devanagari">
                    हिंदी: {currentStep.hindiContent}
                  </p>
                )}
                
                {currentStep.type === 'voice_input' && scenarioState.results[currentStep.id] && (
                  <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <h4 className="font-medium text-gray-900 dark:text-white mb-2">Processing Result:</h4>
                    <p className="text-green-600 dark:text-green-400">
                      {scenarioState.results[currentStep.id].response}
                    </p>
                    {scenarioState.results[currentStep.id].analysis && (
                      <details className="mt-2">
                        <summary className="text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                          View NLP Analysis
                        </summary>
                        <pre className="mt-2 text-xs text-gray-500 dark:text-gray-500 overflow-auto">
                          {JSON.stringify(scenarioState.results[currentStep.id].analysis, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                )}

                {currentStep.type === 'agent_action' && scenarioState.results[currentStep.id] && (
                  <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                      Agent: {currentStep.agentType}
                    </h4>
                    <p className="text-blue-700 dark:text-blue-300">
                      {scenarioState.results[currentStep.id].result}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Completed Steps Summary */}
          {scenarioState.completedSteps.size > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Completed Steps ({scenarioState.completedSteps.size})
              </h3>
              <div className="space-y-2">
                {currentScenario?.steps
                  .filter(step => scenarioState.completedSteps.has(step.id))
                  .map(step => (
                    <div key={step.id} className="flex items-center gap-3 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-sm text-green-700 dark:text-green-300">
                        {step.type.replace(/_/g, ' ')}: {step.content.substring(0, 60)}...
                      </span>
                    </div>
                  ))
                }
              </div>
            </div>
          )}

          {/* Performance Metrics */}
          {scenarioState.completedSteps.size > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Performance Metrics
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">98%</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Recognition Accuracy</div>
                </div>
                <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">0.8s</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Response Time</div>
                </div>
                <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">95%</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Context Retention</div>
                </div>
                <div className="text-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">3</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">AI Agents Active</div>
                </div>
              </div>
            </div>
          )}

          {/* Scenario Complete */}
          {!scenarioState.isRunning && scenarioState.currentStep >= (currentScenario?.steps.length || 0) && (
            <motion.div
              className="bg-gradient-to-r from-green-500 to-blue-600 text-white rounded-xl shadow-lg p-6 text-center"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
            >
              <CheckCircle className="w-12 h-12 mx-auto mb-4" />
              <h3 className="text-2xl font-bold mb-2">Scenario Complete! 🎉</h3>
              <p className="mb-4">
                You've successfully experienced the complete Voice Intelligence System with all advanced features!
              </p>
              
              {currentScenario?.newFeatures && (
                <div className="bg-white/10 rounded-lg p-4 mb-4">
                  <h4 className="font-semibold mb-2">✨ Features Demonstrated:</h4>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {currentScenario.newFeatures.map((feature, index) => (
                      <span key={index} className="bg-white/20 px-3 py-1 rounded-full text-sm">
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                <div className="bg-white/10 rounded-lg p-4">
                  <h4 className="font-semibold mb-2">Steps Completed</h4>
                  <p className="text-2xl">{scenarioState.completedSteps.size}</p>
                </div>
                <div className="bg-white/10 rounded-lg p-4">
                  <h4 className="font-semibold mb-2">System Components Used</h4>
                  <p className="text-2xl">{currentScenario?.systemComponents.length || 0}</p>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-3 justify-center mt-6">
                <button
                  onClick={() => setSelectedScenario(null)}
                  className="px-6 py-2 bg-white text-blue-600 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Try Another Scenario
                </button>
                <button
                  onClick={() => {
                    const analytics = voiceAnalytics.getRealTimeMetrics();
                    setAnalyticsData(analytics);
                  }}
                  className="px-6 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors"
                >
                  View Analytics
                </button>
              </div>
            </motion.div>
          )}
          
          {/* Analytics Modal */}
          {analyticsData && (
            <motion.div
              className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={() => setAnalyticsData(null)}
            >
              <motion.div
                className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-auto"
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Voice Analytics Dashboard</h3>
                  <button
                    onClick={() => setAnalyticsData(null)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                      <h4 className="font-semibold text-blue-900 dark:text-blue-100">Success Rate</h4>
                      <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {Math.round(analyticsData.performance.successRate * 100)}%
                      </p>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                      <h4 className="font-semibold text-green-900 dark:text-green-100">Avg Response Time</h4>
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {Math.round(analyticsData.performance.averageResponseTime)}ms
                      </p>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Interaction Types</h4>
                    <div className="space-y-2">
                      {Object.entries(analyticsData.usage.interactionsByType).map(([type, count]) => (
                        <div key={type} className="flex items-center justify-between">
                          <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                            {type.replace(/_/g, ' ')}
                          </span>
                          <span className="font-semibold">{String(count)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}