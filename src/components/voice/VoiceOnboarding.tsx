'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useSpeechSynthesis } from '@/hooks/useSpeechSynthesis';
import { useNLPProcessing } from '@/hooks/useAgentManager';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  voiceIntro: string;
  voiceInstructions: string;
  type: 'welcome' | 'permission' | 'calibration' | 'tutorial' | 'preferences' | 'completion';
  canSkip?: boolean;
  validation?: (input: string) => Promise<boolean>;
  data?: any;
}

interface OnboardingState {
  currentStepIndex: number;
  completedSteps: string[];
  userData: { [key: string]: any };
  isListening: boolean;
  processingInput: boolean;
  currentInstructions: string;
  microphonePermission: boolean;
  voiceCalibrated: boolean;
  preferredLanguage: 'en' | 'hi' | 'hinglish';
  voiceSettings: {
    rate: number;
    pitch: number;
    volume: number;
  };
}

interface VoiceOnboardingProps {
  onComplete: (userData: any) => Promise<void>;
  onSkip?: () => void;
  customSteps?: OnboardingStep[];
  theme?: 'restaurant' | 'general';
  autoStart?: boolean;
}

const VoiceOnboarding: React.FC<VoiceOnboardingProps> = ({
  onComplete,
  onSkip,
  customSteps,
  theme = 'restaurant',
  autoStart = true
}) => {
  const [onboardingState, setOnboardingState] = useState<OnboardingState>({
    currentStepIndex: 0,
    completedSteps: [],
    userData: {},
    isListening: false,
    processingInput: false,
    currentInstructions: '',
    microphonePermission: false,
    voiceCalibrated: false,
    preferredLanguage: 'en',
    voiceSettings: {
      rate: 0.9,
      pitch: 1.0,
      volume: 0.8
    }
  });

  const [interactionHistory, setInteractionHistory] = useState<string[]>([]);
  const [currentStepData, setCurrentStepData] = useState<any>({});

  const speechRecognition = useSpeechRecognition({
    continuous: true,
    interimResults: true,
    language: onboardingState.preferredLanguage === 'hi' ? 'hi-IN' : 'en-US'
  });

  const speechSynthesis = useSpeechSynthesis({
    lang: onboardingState.preferredLanguage === 'hi' ? 'hi-IN' : 'en-US',
    rate: onboardingState.voiceSettings.rate,
    pitch: onboardingState.voiceSettings.pitch
  });

  const nlpProcessing = useNLPProcessing();

  const defaultSteps: OnboardingStep[] = [
    {
      id: 'welcome',
      title: 'Welcome',
      description: 'Welcome to Voice Intelligence System',
      voiceIntro: theme === 'restaurant' 
        ? 'Welcome to our smart restaurant management system! I\'m your voice assistant, and I\'ll help you get started with voice commands.'
        : 'Welcome to the voice intelligence system! I\'m here to help you set up voice interactions.',
      voiceInstructions: 'Say "continue" to proceed, or "help" if you need assistance.',
      type: 'welcome',
      canSkip: false
    },
    {
      id: 'permission',
      title: 'Microphone Permission',
      description: 'Grant microphone access for voice recognition',
      voiceIntro: 'First, I need permission to access your microphone for voice recognition. This is essential for our voice interactions.',
      voiceInstructions: 'Please click "Allow" when your browser asks for microphone permission, then say "granted" when ready.',
      type: 'permission',
      canSkip: false,
      validation: async (input: string) => {
        return input.toLowerCase().includes('grant') || input.toLowerCase().includes('allow') || input.toLowerCase().includes('yes');
      }
    },
    {
      id: 'language',
      title: 'Language Preference',
      description: 'Choose your preferred language',
      voiceIntro: 'Now let\'s set your language preference. I can understand English, Hindi, or mixed Hinglish.',
      voiceInstructions: 'Say "English" for English, "Hindi" for Hindi, or "Hinglish" for mixed language support.',
      type: 'preferences',
      canSkip: true,
      validation: async (input: string) => {
        const lower = input.toLowerCase();
        return lower.includes('english') || lower.includes('hindi') || lower.includes('hinglish') ||
               lower.includes('अंग्रेजी') || lower.includes('हिंदी');
      }
    },
    {
      id: 'calibration',
      title: 'Voice Calibration',
      description: 'Calibrate voice recognition for your voice',
      voiceIntro: 'Let\'s calibrate the system to recognize your voice better. I\'ll ask you to say a few phrases.',
      voiceInstructions: theme === 'restaurant'
        ? 'Please say: "Table 5 needs water" clearly and naturally.'
        : 'Please say: "Hello voice assistant" clearly and naturally.',
      type: 'calibration',
      canSkip: true,
      validation: async (input: string) => {
        const expectedPhrases = theme === 'restaurant' 
          ? ['table', 'water', 'needs']
          : ['hello', 'voice', 'assistant'];
        const lower = input.toLowerCase();
        return expectedPhrases.some(phrase => lower.includes(phrase));
      }
    },
    {
      id: 'tutorial',
      title: 'Voice Commands Tutorial',
      description: 'Learn basic voice commands',
      voiceIntro: theme === 'restaurant'
        ? 'Great! Now let me teach you some basic restaurant commands. You can say things like "Mark table 3 order ready" or "Check inventory for tomatoes".'
        : 'Perfect! Let me show you some basic voice commands you can use.',
      voiceInstructions: theme === 'restaurant'
        ? 'Try saying: "Show me orders for table 2"'
        : 'Try saying: "What can you do?"',
      type: 'tutorial',
      canSkip: true,
      validation: async (input: string) => {
        return input.length > 5; // Any reasonable attempt
      }
    },
    {
      id: 'preferences',
      title: 'Voice Settings',
      description: 'Adjust voice speed and other preferences',
      voiceIntro: 'Finally, let\'s adjust my speaking speed and other settings to your preference.',
      voiceInstructions: 'Say "faster" to speed up, "slower" to slow down, or "perfect" if this speed is good.',
      type: 'preferences',
      canSkip: true,
      validation: async (input: string) => {
        const lower = input.toLowerCase();
        return lower.includes('faster') || lower.includes('slower') || lower.includes('perfect') ||
               lower.includes('good') || lower.includes('fine');
      }
    },
    {
      id: 'completion',
      title: 'Setup Complete',
      description: 'Voice system is ready to use',
      voiceIntro: 'Excellent! Your voice system is now configured and ready to use. You can start giving voice commands immediately.',
      voiceInstructions: theme === 'restaurant'
        ? 'Say "start working" to begin using the restaurant management system, or "show tutorial" to see more examples.'
        : 'Say "I\'m ready" to start using the voice system.',
      type: 'completion',
      canSkip: false,
      validation: async (input: string) => {
        return true; // Any input completes onboarding
      }
    }
  ];

  const steps = customSteps || defaultSteps;
  const currentStep = steps[onboardingState.currentStepIndex];

  // Auto-start onboarding
  useEffect(() => {
    if (autoStart && currentStep) {
      startCurrentStep();
    }
  }, [autoStart]);

  // Handle step changes
  useEffect(() => {
    if (currentStep && onboardingState.currentStepIndex > 0) {
      startCurrentStep();
    }
  }, [onboardingState.currentStepIndex]);

  // Handle speech recognition results
  useEffect(() => {
    if (speechRecognition.finalTranscript && onboardingState.isListening) {
      handleVoiceInput(speechRecognition.finalTranscript);
      speechRecognition.resetTranscript();
    }
  }, [speechRecognition.finalTranscript, onboardingState.isListening]);

  const startCurrentStep = useCallback(async () => {
    if (!currentStep) return;

    await speak(currentStep.voiceIntro);
    
    // Handle step-specific initialization
    switch (currentStep.type) {
      case 'permission':
        await requestMicrophonePermission();
        break;
        
      case 'calibration':
        await initializeVoiceCalibration();
        break;
        
      case 'tutorial':
        await startTutorialMode();
        break;
    }

    setTimeout(async () => {
      await speak(currentStep.voiceInstructions);
      setOnboardingState(prev => ({
        ...prev,
        currentInstructions: currentStep.voiceInstructions,
        isListening: true
      }));
    }, 1000);
  }, [currentStep]);

  const handleVoiceInput = useCallback(async (input: string) => {
    if (onboardingState.processingInput) return;

    setOnboardingState(prev => ({ ...prev, processingInput: true, isListening: false }));
    setInteractionHistory(prev => [...prev.slice(-4), input]);

    try {
      // Check for global commands first
      const globalResult = await handleGlobalCommands(input);
      if (globalResult) {
        setOnboardingState(prev => ({ ...prev, processingInput: false }));
        return;
      }

      // Process step-specific input
      await processStepInput(input);
    } catch (error) {
      console.error('Error processing voice input:', error);
      await speak(getLocalizedText('processing_error', onboardingState.preferredLanguage));
    }

    setOnboardingState(prev => ({ ...prev, processingInput: false }));
  }, [currentStep, onboardingState.processingInput, onboardingState.preferredLanguage]);

  const handleGlobalCommands = useCallback(async (input: string): Promise<boolean> => {
    const lower = input.toLowerCase();

    // Skip commands
    if ((lower.includes('skip') || lower.includes('छोड़')) && currentStep?.canSkip) {
      await speak(getLocalizedText('step_skipped', onboardingState.preferredLanguage));
      await advanceToNextStep();
      return true;
    }

    // Help commands
    if (lower.includes('help') || lower.includes('मदद')) {
      await provideHelp();
      return true;
    }

    // Repeat commands
    if (lower.includes('repeat') || lower.includes('दोहराएं')) {
      await speak(currentStep?.voiceInstructions || '');
      setTimeout(() => {
        setOnboardingState(prev => ({ ...prev, isListening: true }));
      }, 1000);
      return true;
    }

    // Exit commands
    if (lower.includes('exit') || lower.includes('quit') || lower.includes('बाहर')) {
      if (onSkip) {
        await speak(getLocalizedText('onboarding_cancelled', onboardingState.preferredLanguage));
        onSkip();
        return true;
      }
    }

    return false;
  }, [currentStep, onboardingState.preferredLanguage, onSkip]);

  const processStepInput = useCallback(async (input: string) => {
    if (!currentStep) return;

    let isValid = true;
    
    // Validate input if validation function exists
    if (currentStep.validation) {
      isValid = await currentStep.validation(input);
    }

    if (!isValid) {
      await speak(getLocalizedText('invalid_input', onboardingState.preferredLanguage));
      setTimeout(() => {
        setOnboardingState(prev => ({ ...prev, isListening: true }));
      }, 1500);
      return;
    }

    // Process step-specific logic
    switch (currentStep.type) {
      case 'welcome':
        await handleWelcomeStep(input);
        break;
        
      case 'permission':
        await handlePermissionStep(input);
        break;
        
      case 'calibration':
        await handleCalibrationStep(input);
        break;
        
      case 'tutorial':
        await handleTutorialStep(input);
        break;
        
      case 'preferences':
        await handlePreferencesStep(input);
        break;
        
      case 'completion':
        await handleCompletionStep(input);
        break;
        
      default:
        await advanceToNextStep();
    }
  }, [currentStep, onboardingState.preferredLanguage]);

  const handleWelcomeStep = useCallback(async (input: string) => {
    const nlpResult = await nlpProcessing.analyzeIntent(input);
    
    if (nlpResult.intent === 'affirmation' || input.toLowerCase().includes('continue')) {
      await speak(getLocalizedText('welcome_acknowledged', onboardingState.preferredLanguage));
      await advanceToNextStep();
    } else {
      await speak(getLocalizedText('welcome_help', onboardingState.preferredLanguage));
      setTimeout(() => {
        setOnboardingState(prev => ({ ...prev, isListening: true }));
      }, 2000);
    }
  }, [onboardingState.preferredLanguage]);

  const handlePermissionStep = useCallback(async (input: string) => {
    const hasPermission = await checkMicrophonePermission();
    
    if (hasPermission) {
      setOnboardingState(prev => ({ ...prev, microphonePermission: true }));
      await speak(getLocalizedText('permission_granted', onboardingState.preferredLanguage));
      await advanceToNextStep();
    } else {
      await speak(getLocalizedText('permission_needed', onboardingState.preferredLanguage));
      setTimeout(() => {
        setOnboardingState(prev => ({ ...prev, isListening: true }));
      }, 2000);
    }
  }, [onboardingState.preferredLanguage]);

  const handleCalibrationStep = useCallback(async (input: string) => {
    // Analyze voice characteristics
    const voiceAnalysis = await analyzeVoiceInput(input);
    
    setCurrentStepData((prev: any) => ({
      ...prev,
      voiceSamples: [...(prev.voiceSamples || []), voiceAnalysis]
    }));

    if (currentStepData.voiceSamples?.length >= 1) {
      setOnboardingState(prev => ({ ...prev, voiceCalibrated: true }));
      await speak(getLocalizedText('calibration_complete', onboardingState.preferredLanguage));
      await advanceToNextStep();
    } else {
      await speak(getLocalizedText('calibration_good', onboardingState.preferredLanguage));
      setTimeout(() => {
        setOnboardingState(prev => ({ ...prev, isListening: true }));
      }, 1000);
    }
  }, [currentStepData, onboardingState.preferredLanguage]);

  const handleTutorialStep = useCallback(async (input: string) => {
    // Process the tutorial command
    const nlpResult = await nlpProcessing.processText(input);
    
    let response = '';
    if (theme === 'restaurant') {
      if (nlpResult.intent?.intent.includes('order') || input.toLowerCase().includes('order')) {
        response = 'Great! I understood your order command. You can also try commands like "Check table status" or "Update inventory".';
      } else if (nlpResult.intent?.intent.includes('table') || input.toLowerCase().includes('table')) {
        response = 'Perfect! I recognized your table command. Other useful commands include "Mark order ready" and "Customer needs assistance".';
      } else {
        response = 'Good try! I can understand various restaurant commands. Let\'s move on to preferences.';
      }
    } else {
      response = 'Excellent! I understood your command. You\'re ready to use the voice system.';
    }

    await speak(response);
    
    setOnboardingState(prev => ({
      ...prev,
      userData: { ...prev.userData, tutorialCompleted: true }
    }));
    
    await advanceToNextStep();
  }, [theme, onboardingState.preferredLanguage]);

  const handlePreferencesStep = useCallback(async (input: string) => {
    const lower = input.toLowerCase();
    let newSettings = { ...onboardingState.voiceSettings };
    let response = '';

    if (currentStep?.id === 'language') {
      // Handle language selection
      if (lower.includes('english') || lower.includes('अंग्रेजी')) {
        setOnboardingState(prev => ({ ...prev, preferredLanguage: 'en' }));
        response = 'English selected. I\'ll communicate in English.';
      } else if (lower.includes('hindi') || lower.includes('हिंदी')) {
        setOnboardingState(prev => ({ ...prev, preferredLanguage: 'hi' }));
        response = 'Hindi selected. मैं हिंदी में बात करूंगा।';
      } else if (lower.includes('hinglish')) {
        setOnboardingState(prev => ({ ...prev, preferredLanguage: 'hinglish' }));
        response = 'Hinglish selected. I\'ll mix English और Hindi।';
      }
    } else {
      // Handle voice speed preferences
      if (lower.includes('faster') || lower.includes('तेज')) {
        newSettings.rate = Math.min(1.5, newSettings.rate + 0.2);
        response = 'Speaking faster now. How does this sound?';
      } else if (lower.includes('slower') || lower.includes('धीमा')) {
        newSettings.rate = Math.max(0.5, newSettings.rate - 0.2);
        response = 'Speaking slower now. Is this better?';
      } else if (lower.includes('perfect') || lower.includes('good') || lower.includes('ठीक')) {
        response = 'Great! Voice settings saved.';
      }

      setOnboardingState(prev => ({ ...prev, voiceSettings: newSettings }));
    }

    await speak(response);
    
    // Check if more preferences need to be set
    const shouldContinue = currentStep?.id === 'language' ? true : false;
    if (shouldContinue) {
      setTimeout(() => {
        setOnboardingState(prev => ({ ...prev, isListening: true }));
      }, 1500);
    } else {
      await advanceToNextStep();
    }
  }, [currentStep, onboardingState.voiceSettings, onboardingState.preferredLanguage]);

  const handleCompletionStep = useCallback(async (input: string) => {
    const userData = {
      ...onboardingState.userData,
      microphonePermission: onboardingState.microphonePermission,
      voiceCalibrated: onboardingState.voiceCalibrated,
      preferredLanguage: onboardingState.preferredLanguage,
      voiceSettings: onboardingState.voiceSettings,
      completedSteps: [...onboardingState.completedSteps, currentStep.id],
      completedAt: new Date().toISOString()
    };

    try {
      await speak(getLocalizedText('completing_setup', onboardingState.preferredLanguage));
      await onComplete(userData);
      await speak(getLocalizedText('setup_complete', onboardingState.preferredLanguage));
    } catch (error) {
      console.error('Error completing onboarding:', error);
      await speak(getLocalizedText('setup_error', onboardingState.preferredLanguage));
    }
  }, [currentStep, onboardingState, onComplete]);

  const advanceToNextStep = useCallback(async () => {
    const nextIndex = onboardingState.currentStepIndex + 1;
    
    if (nextIndex >= steps.length) {
      // Onboarding complete
      return;
    }

    setOnboardingState(prev => ({
      ...prev,
      currentStepIndex: nextIndex,
      completedSteps: [...prev.completedSteps, currentStep?.id || '']
    }));

    // Clear step data for next step
    setCurrentStepData({});
  }, [onboardingState.currentStepIndex, steps.length, currentStep]);

  const requestMicrophonePermission = useCallback(async (): Promise<void> => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setOnboardingState(prev => ({ ...prev, microphonePermission: true }));
    } catch (error) {
      console.error('Microphone permission denied:', error);
    }
  }, []);

  const checkMicrophonePermission = useCallback(async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch {
      return false;
    }
  }, []);

  const initializeVoiceCalibration = useCallback(async () => {
    setCurrentStepData({ voiceSamples: [] });
  }, []);

  const startTutorialMode = useCallback(async () => {
    // Initialize tutorial mode
    setCurrentStepData({ tutorialActive: true });
  }, []);

  const analyzeVoiceInput = useCallback(async (input: string): Promise<any> => {
    // Mock voice analysis - in real implementation, this would analyze
    // voice characteristics like pitch, tone, accent, etc.
    return {
      input,
      length: input.length,
      words: input.split(' ').length,
      timestamp: new Date().toISOString(),
      confidence: Math.random() * 0.3 + 0.7 // 0.7-1.0 range
    };
  }, []);

  const provideHelp = useCallback(async () => {
    let helpText = '';
    
    switch (currentStep?.type) {
      case 'welcome':
        helpText = 'This is the welcome step. Say "continue" to proceed with setup.';
        break;
      case 'permission':
        helpText = 'I need microphone permission to hear your voice. Please allow access when prompted.';
        break;
      case 'calibration':
        helpText = 'I\'m learning to recognize your voice. Please speak the phrase I mentioned clearly.';
        break;
      case 'tutorial':
        helpText = theme === 'restaurant' 
          ? 'Try any restaurant command like "Show orders" or "Check inventory".'
          : 'Try saying any voice command to test the system.';
        break;
      case 'preferences':
        helpText = 'Tell me if you want me to speak faster, slower, or if the current speed is perfect.';
        break;
      default:
        helpText = 'Say "continue" to proceed, "skip" to skip this step, or "repeat" to hear instructions again.';
    }

    await speak(helpText);
    setTimeout(() => {
      setOnboardingState(prev => ({ ...prev, isListening: true }));
    }, 1000);
  }, [currentStep, theme]);

  const speak = useCallback(async (text: string): Promise<void> => {
    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onend = () => resolve();
      window.speechSynthesis.speak(utterance);
    });
  }, []);

  const toggleListening = useCallback(() => {
    setOnboardingState(prev => ({ 
      ...prev, 
      isListening: !prev.isListening 
    }));
  }, []);

  const restartOnboarding = useCallback(() => {
    setOnboardingState({
      currentStepIndex: 0,
      completedSteps: [],
      userData: {},
      isListening: false,
      processingInput: false,
      currentInstructions: '',
      microphonePermission: false,
      voiceCalibrated: false,
      preferredLanguage: 'en',
      voiceSettings: {
        rate: 0.9,
        pitch: 1.0,
        volume: 0.8
      }
    });
    setInteractionHistory([]);
    setCurrentStepData({});
  }, []);

  if (!currentStep) {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Onboarding Complete!</h2>
        <p className="text-gray-600">Your voice system is ready to use.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen">
      <div className="bg-white rounded-lg shadow-xl p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Voice System Setup
          </h1>
          <p className="text-gray-600">
            Let's configure your voice intelligence system
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              Step {onboardingState.currentStepIndex + 1} of {steps.length}
            </span>
            <span className="text-sm text-gray-500">
              {Math.round(((onboardingState.currentStepIndex + 1) / steps.length) * 100)}% Complete
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div 
              className="bg-gradient-to-r from-blue-500 to-indigo-600 h-3 rounded-full transition-all duration-500"
              style={{ 
                width: `${((onboardingState.currentStepIndex + 1) / steps.length) * 100}%` 
              }}
            />
          </div>
        </div>

        {/* Current Step */}
        <div className="bg-gray-50 rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              {currentStep.title}
            </h2>
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${
                onboardingState.isListening ? 'bg-red-500 animate-pulse' : 
                onboardingState.processingInput ? 'bg-yellow-500' : 'bg-gray-400'
              }`} />
              <span className="text-sm font-medium">
                {onboardingState.processingInput ? 'Processing...' : 
                 onboardingState.isListening ? 'Listening...' : 'Ready'}
              </span>
            </div>
          </div>
          
          <p className="text-gray-700 mb-4">{currentStep.description}</p>
          
          <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
            <p className="text-blue-800">
              <strong>Instructions:</strong> {onboardingState.currentInstructions || currentStep.voiceInstructions}
            </p>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className={`p-4 rounded-lg border ${
            onboardingState.microphonePermission ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
          }`}>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${
                onboardingState.microphonePermission ? 'bg-green-500' : 'bg-gray-400'
              }`} />
              <span className="text-sm font-medium">Microphone Permission</span>
            </div>
          </div>
          
          <div className={`p-4 rounded-lg border ${
            onboardingState.voiceCalibrated ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
          }`}>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${
                onboardingState.voiceCalibrated ? 'bg-green-500' : 'bg-gray-400'
              }`} />
              <span className="text-sm font-medium">Voice Calibrated</span>
            </div>
          </div>
          
          <div className="p-4 rounded-lg border bg-blue-50 border-blue-200">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-sm font-medium">
                Language: {onboardingState.preferredLanguage.toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex space-x-3">
            <button
              onClick={toggleListening}
              disabled={onboardingState.processingInput}
              className={`px-6 py-3 rounded-lg font-medium ${
                onboardingState.isListening
                  ? 'bg-red-600 text-white hover:bg-red-700' 
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              } disabled:opacity-50 transition-colors`}
            >
              {onboardingState.isListening ? 'Stop Listening' : 'Start Listening'}
            </button>
            
            {currentStep.canSkip && (
              <button
                onClick={() => advanceToNextStep()}
                className="px-6 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
              >
                Skip Step
              </button>
            )}
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={provideHelp}
              className="px-4 py-2 text-blue-600 hover:text-blue-800 transition-colors"
            >
              Help
            </button>
            
            {onSkip && (
              <button
                onClick={onSkip}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Exit Setup
              </button>
            )}
          </div>
        </div>

        {/* Voice History */}
        {interactionHistory.length > 0 && (
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Recent Voice Input:</h3>
            <ul className="space-y-1">
              {interactionHistory.slice(-3).map((input, index) => (
                <li key={index} className="text-sm text-gray-600 truncate">
                  "{input}"
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

// Localization helper function
function getLocalizedText(key: string, language: string): string {
  const texts: { [key: string]: { [lang: string]: string } } = {
    step_skipped: {
      en: "Step skipped. Moving to next step.",
      hi: "चरण छोड़ दिया गया। अगले चरण पर जा रहे हैं।",
      hinglish: "Step skip हो गया। Next step पर जा रहे हैं।"
    },
    processing_error: {
      en: "Sorry, I couldn't process that. Please try again.",
      hi: "क्षमा करें, मैं इसे समझ नहीं सका। कृपया फिर से कोशिश करें।",
      hinglish: "Sorry, मैं इसे process नहीं कर सका। Please फिर से try करें।"
    },
    onboarding_cancelled: {
      en: "Onboarding cancelled. You can restart anytime.",
      hi: "सेटअप रद्द किया गया। आप कभी भी फिर से शुरू कर सकते हैं।",
      hinglish: "Setup cancel हो गया। आप कभी भी restart कर सकते हैं।"
    },
    invalid_input: {
      en: "I didn't understand that. Please try again.",
      hi: "मैं इसे समझ नहीं पाया। कृपया फिर से कोशिश करें।",
      hinglish: "मैं समझ नहीं पाया। Please फिर से try करें।"
    },
    welcome_acknowledged: {
      en: "Great! Let's continue with the setup.",
      hi: "बहुत बढ़िया! चलिए सेटअप जारी रखते हैं।",
      hinglish: "Great! चलिए setup continue करते हैं।"
    },
    welcome_help: {
      en: "Say 'continue' to proceed, or 'help' for more information.",
      hi: "आगे बढ़ने के लिए 'जारी रखें' कहें, या अधिक जानकारी के लिए 'मदद' कहें।",
      hinglish: "Continue करने के लिए 'continue' बोलें, या help के लिए 'help' बोलें।"
    },
    permission_granted: {
      en: "Perfect! Microphone access granted.",
      hi: "बहुत बढ़िया! माइक्रोफ़ोन की अनुमति मिल गई।",
      hinglish: "Perfect! Microphone की permission मिल गई।"
    },
    permission_needed: {
      en: "I still need microphone permission. Please allow access.",
      hi: "मुझे अभी भी माइक्रोफोन की अनुमति चाहिए। कृपया अनुमति दें।",
      hinglish: "मुझे अभी भी microphone की permission चाहिए। Please allow करें।"
    },
    calibration_complete: {
      en: "Excellent! Voice calibration complete.",
      hi: "बहुत बढ़िया! आवाज़ का कैलिब्रेशन पूरा हुआ।",
      hinglish: "Excellent! Voice calibration complete हो गया।"
    },
    calibration_good: {
      en: "Good! Let me hear you speak once more.",
      hi: "अच्छा! मुझे एक बार और सुनने दें।",
      hinglish: "Good! एक बार और बोलिए।"
    },
    completing_setup: {
      en: "Completing setup...",
      hi: "सेटअप पूरा कर रहे हैं...",
      hinglish: "Setup complete कर रहे हैं..."
    },
    setup_complete: {
      en: "Setup complete! You're ready to use voice commands.",
      hi: "सेटअप पूरा हुआ! आप आवाज़ी कमांड का उपयोग करने के लिए तैयार हैं।",
      hinglish: "Setup complete! आप voice commands use करने के लिए ready हैं।"
    },
    setup_error: {
      en: "There was an error completing setup. Please try again.",
      hi: "सेटअप पूरा करने में त्रुटि हुई। कृपया फिर से कोशिश करें।",
      hinglish: "Setup complete करने में error हुई। Please फिर से try करें।"
    }
  };

  return texts[key]?.[language] || texts[key]?.['en'] || key;
}

export default VoiceOnboarding;