'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useSpeechSynthesis } from '@/hooks/useSpeechSynthesis';
import { useNLPProcessing } from '@/hooks/useAgentManager';

interface FormField {
  id: string;
  name: string;
  type: 'text' | 'number' | 'email' | 'phone' | 'date' | 'select' | 'multiselect' | 'boolean';
  label: string;
  voicePrompt: string;
  required: boolean;
  validation?: {
    pattern?: RegExp;
    min?: number;
    max?: number;
    options?: { value: string; label: string; aliases?: string[] }[];
  };
  hints?: string[];
  confirmationRequired?: boolean;
  value?: any;
}

interface FormStep {
  id: string;
  title: string;
  description: string;
  fields: FormField[];
  skipCondition?: (formData: any) => boolean;
  voiceIntro?: string;
}

interface ConversationalFormProps {
  steps: FormStep[];
  onComplete: (data: any) => Promise<void>;
  onCancel?: () => void;
  language?: 'en' | 'hi' | 'hinglish';
  autoAdvance?: boolean;
  allowBacktrack?: boolean;
  confirmationStrategy?: 'field' | 'step' | 'form' | 'smart';
}

interface FormState {
  currentStepIndex: number;
  currentFieldIndex: number;
  formData: { [key: string]: any };
  errors: { [key: string]: string | undefined };
  isCompleting: boolean;
  awaitingConfirmation: boolean;
  confirmationContext?: {
    type: 'field' | 'step' | 'form';
    data: any;
  };
}

const ConversationalForms: React.FC<ConversationalFormProps> = ({
  steps,
  onComplete,
  onCancel,
  language = 'en',
  autoAdvance = true,
  allowBacktrack = true,
  confirmationStrategy = 'smart'
}) => {
  const [formState, setFormState] = useState<FormState>({
    currentStepIndex: 0,
    currentFieldIndex: 0,
    formData: {},
    errors: {},
    isCompleting: false,
    awaitingConfirmation: false
  });

  const [isListening, setIsListening] = useState(false);
  const [processingInput, setProcessingInput] = useState(false);
  const [currentInstructions, setCurrentInstructions] = useState('');
  const [voiceHistory, setVoiceHistory] = useState<string[]>([]);

  const speechRecognition = useSpeechRecognition({
    continuous: true,
    interimResults: true,
    language: language === 'hi' ? 'hi-IN' : 'en-US'
  });

  const speechSynthesis = useSpeechSynthesis({
    lang: language === 'hi' ? 'hi-IN' : 'en-US',
    rate: 0.9,
    pitch: 1.0
  });

  const nlpProcessing = useNLPProcessing();
  const retryCountRef = useRef<{ [fieldId: string]: number }>({});
  const contextRef = useRef<{ lastValidInput?: string; suggestions?: string[] }>({});

  const currentStep = steps[formState.currentStepIndex];
  const currentField = currentStep?.fields[formState.currentFieldIndex];
  const isLastStep = formState.currentStepIndex === steps.length - 1;
  const isLastFieldInStep = formState.currentFieldIndex === currentStep?.fields.length - 1;

  // Initialize form and start first interaction
  useEffect(() => {
    if (currentStep && !formState.isCompleting) {
      startStep();
    }
  }, [formState.currentStepIndex]);

  useEffect(() => {
    if (currentField && !formState.awaitingConfirmation) {
      presentField();
    }
  }, [formState.currentFieldIndex, formState.awaitingConfirmation]);

  // Handle speech recognition results
  useEffect(() => {
    if (speechRecognition.finalTranscript && !processingInput) {
      handleVoiceInput(speechRecognition.finalTranscript);
      speechRecognition.resetTranscript();
    }
  }, [speechRecognition.finalTranscript, processingInput]);

  const startStep = useCallback(async () => {
    if (!currentStep) return;

    const intro = currentStep.voiceIntro || 
      `${getLocalizedText('step_intro', language)} ${currentStep.title}. ${currentStep.description}`;
    
    await speak(intro);
    
    setCurrentInstructions(intro);
    
    // Skip step if condition is met
    if (currentStep.skipCondition && currentStep.skipCondition(formState.formData)) {
      advanceToNextStep();
      return;
    }

    // Reset field index for new step
    setFormState(prev => ({ ...prev, currentFieldIndex: 0 }));
  }, [currentStep, formState.formData, language]);

  const presentField = useCallback(async () => {
    if (!currentField) return;

    const retryCount = retryCountRef.current[currentField.id] || 0;
    let prompt = currentField.voicePrompt;

    // Add contextual information for retries
    if (retryCount > 0) {
      const errorMsg = formState.errors[currentField.id];
      if (errorMsg) {
        prompt = `${getLocalizedText('error_prefix', language)} ${errorMsg}. ${prompt}`;
      }
    }

    // Add hints for repeated attempts
    if (retryCount >= 2 && currentField.hints) {
      const hint = currentField.hints[Math.min(retryCount - 2, currentField.hints.length - 1)];
      prompt += ` ${getLocalizedText('hint_prefix', language)} ${hint}`;
    }

    // Add examples for select fields
    if (currentField.type === 'select' && currentField.validation?.options) {
      const options = currentField.validation.options.slice(0, 3);
      const optionText = options.map(opt => opt.label).join(', ');
      prompt += ` ${getLocalizedText('options_available', language)} ${optionText}`;
    }

    await speak(prompt);
    setCurrentInstructions(prompt);
    
    // Start listening after speaking
    setTimeout(() => {
      setIsListening(true);
    }, 500);
  }, [currentField, formState.errors, language]);

  const handleVoiceInput = useCallback(async (input: string) => {
    if (!currentField || processingInput) return;

    setProcessingInput(true);
    setIsListening(false);
    
    try {
      // Add to voice history
      setVoiceHistory(prev => [...prev.slice(-4), input]);

      // Check for navigation commands first
      const navigationResult = await handleNavigationCommands(input);
      if (navigationResult) {
        setProcessingInput(false);
        return;
      }

      // Handle confirmation responses
      if (formState.awaitingConfirmation) {
        await handleConfirmationResponse(input);
        setProcessingInput(false);
        return;
      }

      // Process field input using NLP
      const nlpResult = await nlpProcessing.processText(input, 'complete_analysis', {
        fieldType: currentField.type,
        fieldId: currentField.id,
        expectedValues: currentField.validation?.options?.map(o => o.value)
      });

      // Extract and validate field value
      const extractedValue = await extractFieldValue(input, nlpResult);
      const validationResult = validateFieldValue(extractedValue);

      if (validationResult.isValid) {
        await handleValidInput(extractedValue);
      } else {
        await handleInvalidInput(validationResult.error || 'Invalid input');
      }
    } catch (error) {
      console.error('Error processing voice input:', error);
      await speak(getLocalizedText('processing_error', language));
      setTimeout(() => setIsListening(true), 1000);
    }

    setProcessingInput(false);
  }, [currentField, formState.awaitingConfirmation, processingInput, language]);

  const handleNavigationCommands = useCallback(async (input: string): Promise<boolean> => {
    const lowerInput = input.toLowerCase();
    
    // Cancel/exit commands
    if (lowerInput.includes('cancel') || lowerInput.includes('exit') || 
        lowerInput.includes('stop') || lowerInput.includes('बंद')) {
      if (onCancel) {
        await speak(getLocalizedText('form_cancelled', language));
        onCancel();
        return true;
      }
    }

    // Back/previous commands
    if (allowBacktrack && (lowerInput.includes('back') || lowerInput.includes('previous') || 
        lowerInput.includes('पिछला') || lowerInput.includes('वापस'))) {
      await goToPreviousField();
      return true;
    }

    // Skip field commands
    if (lowerInput.includes('skip') || lowerInput.includes('next') || 
        lowerInput.includes('छोड़') || lowerInput.includes('अगला')) {
      if (!currentField?.required) {
        await advanceToNextField();
        return true;
      } else {
        await speak(getLocalizedText('field_required', language));
        setTimeout(() => setIsListening(true), 1000);
        return true;
      }
    }

    // Repeat/help commands
    if (lowerInput.includes('repeat') || lowerInput.includes('help') || 
        lowerInput.includes('दोहराएं') || lowerInput.includes('मदद')) {
      await presentField();
      return true;
    }

    return false;
  }, [currentField, allowBacktrack, language, onCancel]);

  const handleConfirmationResponse = useCallback(async (input: string) => {
    const nlpResult = await nlpProcessing.analyzeIntent(input);
    const isConfirmation = nlpResult.intent === 'confirmation' || 
                          input.toLowerCase().includes('yes') || 
                          input.toLowerCase().includes('correct') ||
                          input.toLowerCase().includes('हाँ') ||
                          input.toLowerCase().includes('सही');

    const isRejection = nlpResult.intent === 'rejection' ||
                       input.toLowerCase().includes('no') ||
                       input.toLowerCase().includes('wrong') ||
                       input.toLowerCase().includes('नहीं') ||
                       input.toLowerCase().includes('गलत');

    if (isConfirmation) {
      setFormState(prev => ({ ...prev, awaitingConfirmation: false }));
      
      if (formState.confirmationContext?.type === 'form') {
        await completeForm();
      } else {
        await advanceToNextField();
      }
    } else if (isRejection) {
      setFormState(prev => ({ ...prev, awaitingConfirmation: false }));
      
      if (formState.confirmationContext?.type === 'form') {
        await speak(getLocalizedText('form_correction_mode', language));
        // Allow user to specify which field to correct
        setTimeout(() => setIsListening(true), 1000);
      } else {
        // Re-present current field
        await presentField();
      }
    } else {
      await speak(getLocalizedText('confirmation_unclear', language));
      setTimeout(() => setIsListening(true), 1000);
    }
  }, [formState.confirmationContext, language]);

  const extractFieldValue = useCallback(async (input: string, nlpResult: any): Promise<any> => {
    switch (currentField?.type) {
      case 'text':
        return input.trim();

      case 'number':
        const entities = nlpResult.entities?.filter((e: any) => e.type === 'number') || [];
        if (entities.length > 0) {
          return parseFloat(entities[0].value);
        }
        // Try to extract number from text
        const numberMatch = input.match(/\d+(?:\.\d+)?/);
        return numberMatch ? parseFloat(numberMatch[0]) : null;

      case 'email':
        const emailMatch = input.match(/\S+@\S+\.\S+/);
        return emailMatch ? emailMatch[0] : null;

      case 'phone':
        const phoneMatch = input.match(/[\d\s\-\+\(\)]{10,}/);
        return phoneMatch ? phoneMatch[0].replace(/\D/g, '') : null;

      case 'date':
        // Extract date entities or patterns
        const dateEntities = nlpResult.entities?.filter((e: any) => e.type === 'time') || [];
        if (dateEntities.length > 0) {
          return dateEntities[0].normalized;
        }
        return input.trim();

      case 'select':
        if (!currentField?.validation?.options) return null;
        
        const options = currentField.validation.options;
        const lowerInput = input.toLowerCase();
        
        // Direct match
        const directMatch = options.find(opt => 
          opt.label.toLowerCase() === lowerInput ||
          opt.value.toLowerCase() === lowerInput ||
          opt.aliases?.some(alias => alias.toLowerCase() === lowerInput)
        );
        
        if (directMatch) return directMatch.value;
        
        // Partial match
        const partialMatch = options.find(opt =>
          lowerInput.includes(opt.label.toLowerCase()) ||
          opt.label.toLowerCase().includes(lowerInput) ||
          opt.aliases?.some(alias => 
            lowerInput.includes(alias.toLowerCase()) || 
            alias.toLowerCase().includes(lowerInput)
          )
        );
        
        return partialMatch ? partialMatch.value : null;

      case 'boolean':
        const positiveWords = ['yes', 'true', 'हाँ', 'सही', 'correct', 'right'];
        const negativeWords = ['no', 'false', 'नहीं', 'गलत', 'wrong', 'incorrect'];
        
        const lowerInput2 = input.toLowerCase();
        if (positiveWords.some(word => lowerInput2.includes(word))) return true;
        if (negativeWords.some(word => lowerInput2.includes(word))) return false;
        return null;

      default:
        return input.trim();
    }
  }, [currentField]);

  const validateFieldValue = useCallback((value: any): { isValid: boolean; error?: string } => {
    if (!currentField) return { isValid: false, error: 'No current field' };

    // Required field validation
    if (currentField.required && (value === null || value === undefined || value === '')) {
      return { isValid: false, error: getLocalizedText('field_required', language) };
    }

    // Skip validation for optional empty fields
    if (!currentField.required && (value === null || value === undefined || value === '')) {
      return { isValid: true };
    }

    // Type-specific validation
    if (currentField.validation) {
      const { pattern, min, max, options } = currentField.validation;

      if (pattern && typeof value === 'string' && !pattern.test(value)) {
        return { isValid: false, error: getLocalizedText('invalid_format', language) };
      }

      if (typeof value === 'number') {
        if (min !== undefined && value < min) {
          return { isValid: false, error: `${getLocalizedText('value_too_small', language)} ${min}` };
        }
        if (max !== undefined && value > max) {
          return { isValid: false, error: `${getLocalizedText('value_too_large', language)} ${max}` };
        }
      }

      if (options && !options.some(opt => opt.value === value)) {
        return { isValid: false, error: getLocalizedText('invalid_option', language) };
      }
    }

    return { isValid: true };
  }, [currentField, language]);

  const handleValidInput = useCallback(async (value: any) => {
    if (!currentField) return;

    // Update form data
    setFormState(prev => ({
      ...prev,
      formData: { ...prev.formData, [currentField.id]: value },
      errors: { ...prev.errors, [currentField.id]: undefined }
    }));

    // Clear retry count
    retryCountRef.current[currentField.id] = 0;

    // Handle confirmation if required
    if (shouldConfirmField(value)) {
      await requestFieldConfirmation(value);
    } else {
      await advanceToNextField();
    }
  }, [currentField, confirmationStrategy]);

  const handleInvalidInput = useCallback(async (error: string) => {
    if (!currentField) return;

    // Update error state
    setFormState(prev => ({
      ...prev,
      errors: { ...prev.errors, [currentField.id]: error }
    }));

    // Increment retry count
    retryCountRef.current[currentField.id] = (retryCountRef.current[currentField.id] || 0) + 1;

    // Provide error feedback and retry
    await speak(error);
    setTimeout(() => presentField(), 1500);
  }, [currentField]);

  const shouldConfirmField = useCallback((value: any): boolean => {
    if (!currentField) return false;

    switch (confirmationStrategy) {
      case 'field':
        return currentField.confirmationRequired || false;
      case 'step':
        return isLastFieldInStep;
      case 'form':
        return isLastStep && isLastFieldInStep;
      case 'smart':
        // Smart confirmation based on field importance and retry count
        const retryCount = retryCountRef.current[currentField.id] || 0;
        const isImportant = currentField.type === 'email' || currentField.type === 'phone';
        const isHighValue = currentField.type === 'number' && typeof value === 'number' && value > 1000;
        return retryCount > 0 || isImportant || isHighValue || currentField.confirmationRequired || false;
      default:
        return false;
    }
  }, [currentField, confirmationStrategy, isLastStep, isLastFieldInStep]);

  const requestFieldConfirmation = useCallback(async (value: any) => {
    const formattedValue = formatValueForSpeech(value);
    const confirmationText = `${getLocalizedText('confirmation_request', language)} ${currentField?.label}: ${formattedValue}. ${getLocalizedText('is_correct', language)}`;
    
    await speak(confirmationText);
    
    setFormState(prev => ({
      ...prev,
      awaitingConfirmation: true,
      confirmationContext: { type: 'field', data: value }
    }));
    
    setTimeout(() => setIsListening(true), 1000);
  }, [currentField, language]);

  const advanceToNextField = useCallback(async () => {
    if (isLastFieldInStep) {
      if (confirmationStrategy === 'step') {
        await requestStepConfirmation();
      } else {
        await advanceToNextStep();
      }
    } else {
      setFormState(prev => ({
        ...prev,
        currentFieldIndex: prev.currentFieldIndex + 1
      }));
    }
  }, [isLastFieldInStep, confirmationStrategy]);

  const advanceToNextStep = useCallback(async () => {
    if (isLastStep) {
      if (confirmationStrategy === 'form') {
        await requestFormConfirmation();
      } else {
        await completeForm();
      }
    } else {
      setFormState(prev => ({
        ...prev,
        currentStepIndex: prev.currentStepIndex + 1,
        currentFieldIndex: 0
      }));
    }
  }, [isLastStep, confirmationStrategy]);

  const requestStepConfirmation = useCallback(async () => {
    const stepData = currentStep?.fields.reduce((data, field) => {
      data[field.id] = formState.formData[field.id];
      return data;
    }, {} as any);

    const summary = generateStepSummary(stepData);
    const confirmationText = `${getLocalizedText('step_complete', language)} ${summary}. ${getLocalizedText('is_correct', language)}`;
    
    await speak(confirmationText);
    
    setFormState(prev => ({
      ...prev,
      awaitingConfirmation: true,
      confirmationContext: { type: 'step', data: stepData }
    }));
    
    setTimeout(() => setIsListening(true), 1000);
  }, [currentStep, formState.formData, language]);

  const requestFormConfirmation = useCallback(async () => {
    const summary = generateFormSummary(formState.formData);
    const confirmationText = `${getLocalizedText('form_complete', language)} ${summary}. ${getLocalizedText('is_correct', language)}`;
    
    await speak(confirmationText);
    
    setFormState(prev => ({
      ...prev,
      awaitingConfirmation: true,
      confirmationContext: { type: 'form', data: formState.formData }
    }));
    
    setTimeout(() => setIsListening(true), 1000);
  }, [formState.formData, language]);

  const completeForm = useCallback(async () => {
    setFormState(prev => ({ ...prev, isCompleting: true }));
    
    try {
      await speak(getLocalizedText('submitting_form', language));
      await onComplete(formState.formData);
      await speak(getLocalizedText('form_submitted', language));
    } catch (error) {
      console.error('Error completing form:', error);
      await speak(getLocalizedText('submission_error', language));
      setFormState(prev => ({ ...prev, isCompleting: false }));
    }
  }, [formState.formData, language, onComplete]);

  const goToPreviousField = useCallback(async () => {
    if (formState.currentFieldIndex > 0) {
      setFormState(prev => ({
        ...prev,
        currentFieldIndex: prev.currentFieldIndex - 1,
        awaitingConfirmation: false
      }));
    } else if (formState.currentStepIndex > 0) {
      const prevStep = steps[formState.currentStepIndex - 1];
      setFormState(prev => ({
        ...prev,
        currentStepIndex: prev.currentStepIndex - 1,
        currentFieldIndex: prevStep.fields.length - 1,
        awaitingConfirmation: false
      }));
    } else {
      await speak(getLocalizedText('already_at_beginning', language));
      setTimeout(() => setIsListening(true), 1000);
    }
  }, [formState.currentStepIndex, formState.currentFieldIndex, steps, language]);

  const speak = useCallback(async (text: string): Promise<void> => {
    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onend = () => resolve();
      window.speechSynthesis.speak(utterance);
    });
  }, []);

  const formatValueForSpeech = useCallback((value: any): string => {
    if (value === null || value === undefined) return '';
    
    if (currentField?.type === 'select' && currentField.validation?.options) {
      const option = currentField.validation.options.find(opt => opt.value === value);
      return option ? option.label : String(value);
    }
    
    return String(value);
  }, [currentField]);

  const generateStepSummary = useCallback((stepData: any): string => {
    return currentStep?.fields
      .filter(field => stepData[field.id] !== undefined && stepData[field.id] !== '')
      .map(field => `${field.label}: ${formatValueForSpeech(stepData[field.id])}`)
      .join(', ') || '';
  }, [currentStep]);

  const generateFormSummary = useCallback((formData: any): string => {
    return steps
      .flatMap(step => step.fields)
      .filter(field => formData[field.id] !== undefined && formData[field.id] !== '')
      .slice(0, 5) // Limit to avoid too long speech
      .map(field => `${field.label}: ${formatValueForSpeech(formData[field.id])}`)
      .join(', ');
  }, [steps]);

  // Render component
  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">
            {currentStep?.title || 'Voice Form'}
          </h2>
          <div className="text-sm text-gray-500">
            Step {formState.currentStepIndex + 1} of {steps.length}
          </div>
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ 
              width: `${((formState.currentStepIndex + (formState.currentFieldIndex / currentStep?.fields.length || 1)) / steps.length) * 100}%` 
            }}
          />
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-center space-x-3 mb-2">
            <div className={`w-3 h-3 rounded-full ${isListening ? 'bg-red-500 animate-pulse' : 'bg-gray-400'}`} />
            <span className="font-medium text-blue-900">
              {processingInput ? 'Processing...' : isListening ? 'Listening...' : 'Ready'}
            </span>
          </div>
          <p className="text-blue-800 text-sm">
            {currentInstructions}
          </p>
        </div>

        {currentField && (
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-lg font-medium text-gray-900">
                {currentField.label}
                {currentField.required && <span className="text-red-500 ml-1">*</span>}
              </label>
              <span className="text-sm text-gray-500">
                Field {formState.currentFieldIndex + 1} of {currentStep?.fields.length}
              </span>
            </div>
            
            <div className="mt-2">
              <input
                type="text"
                value={formState.formData[currentField.id] || ''}
                readOnly
                placeholder="Voice input will appear here..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
              />
              {formState.errors[currentField.id] && (
                <p className="mt-1 text-sm text-red-600">
                  {formState.errors[currentField.id]}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-between items-center pt-4 border-t">
          <button
            onClick={goToPreviousField}
            disabled={formState.currentStepIndex === 0 && formState.currentFieldIndex === 0}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50"
          >
            ← Previous
          </button>
          
          <div className="flex space-x-2">
            <button
              onClick={() => setIsListening(!isListening)}
              disabled={processingInput}
              className={`px-4 py-2 rounded-md ${
                isListening 
                  ? 'bg-red-600 text-white hover:bg-red-700' 
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              } disabled:opacity-50`}
            >
              {isListening ? 'Stop Listening' : 'Start Listening'}
            </button>
            
            {onCancel && (
              <button
                onClick={onCancel}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md"
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        {voiceHistory.length > 0 && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Recent Voice Input:</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              {voiceHistory.slice(-3).map((input, index) => (
                <li key={index} className="truncate">"{input}"</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

// Localization helper
function getLocalizedText(key: string, language: string): string {
  const texts: { [key: string]: { [lang: string]: string } } = {
    step_intro: {
      en: "Starting step:",
      hi: "चरण शुरू कर रहे हैं:",
      hinglish: "Step शुरू कर रहे हैं:"
    },
    error_prefix: {
      en: "There was an error:",
      hi: "एक त्रुटि थी:",
      hinglish: "Error था:"
    },
    hint_prefix: {
      en: "Hint:",
      hi: "संकेत:",
      hinglish: "Hint:"
    },
    options_available: {
      en: "Available options are:",
      hi: "उपलब्ध विकल्प हैं:",
      hinglish: "Available options हैं:"
    },
    processing_error: {
      en: "Sorry, I couldn't process that. Please try again.",
      hi: "क्षमा करें, मैं इसे समझ नहीं सका। कृपया फिर से कोशिश करें।",
      hinglish: "Sorry, मैं इसे process नहीं कर सका। Please फिर से try करें।"
    },
    form_cancelled: {
      en: "Form cancelled.",
      hi: "फॉर्म रद्द किया गया।",
      hinglish: "Form cancel हो गया।"
    },
    field_required: {
      en: "This field is required.",
      hi: "यह फील्ड आवश्यक है।",
      hinglish: "यह field required है।"
    },
    confirmation_request: {
      en: "You entered",
      hi: "आपने दर्ज किया",
      hinglish: "आपने enter किया"
    },
    is_correct: {
      en: "Is this correct?",
      hi: "क्या यह सही है?",
      hinglish: "यह correct है?"
    },
    step_complete: {
      en: "Step completed with:",
      hi: "चरण पूरा हुआ:",
      hinglish: "Step complete हुआ:"
    },
    form_complete: {
      en: "Form completed with:",
      hi: "फॉर्म पूरा हुआ:",
      hinglish: "Form complete हुआ:"
    },
    submitting_form: {
      en: "Submitting form...",
      hi: "फॉर्म जमा कर रहे हैं...",
      hinglish: "Form submit कर रहे हैं..."
    },
    form_submitted: {
      en: "Form submitted successfully!",
      hi: "फॉर्म सफलतापूर्वक जमा किया गया!",
      hinglish: "Form successfully submit हो गया!"
    },
    submission_error: {
      en: "Error submitting form. Please try again.",
      hi: "फॉर्म जमा करने में त्रुटि। कृपया फिर से कोशिश करें।",
      hinglish: "Form submit करने में error। Please फिर से try करें।"
    },
    already_at_beginning: {
      en: "Already at the beginning.",
      hi: "पहले से ही शुरुआत में हैं।",
      hinglish: "Already beginning में हैं।"
    },
    confirmation_unclear: {
      en: "I didn't understand. Please say yes or no.",
      hi: "मैं समझ नहीं पाया। कृपया हाँ या नहीं कहें।",
      hinglish: "मैं समझ नहीं पाया। Please हाँ या नहीं बोलें।"
    },
    form_correction_mode: {
      en: "Which field would you like to correct?",
      hi: "आप कौन सा फील्ड सुधारना चाहते हैं?",
      hinglish: "आप कौन सा field correct करना चाहते हैं?"
    },
    invalid_format: {
      en: "Invalid format. Please try again.",
      hi: "गलत प्रारूप। कृपया फिर से कोशिश करें।",
      hinglish: "Invalid format। Please फिर से try करें।"
    },
    value_too_small: {
      en: "Value too small. Minimum is",
      hi: "मान बहुत छोटा है। न्यूनतम है",
      hinglish: "Value बहुत छोटा है। Minimum है"
    },
    value_too_large: {
      en: "Value too large. Maximum is",
      hi: "मान बहुत बड़ा है। अधिकतम है",
      hinglish: "Value बहुत बड़ा है। Maximum है"
    },
    invalid_option: {
      en: "Invalid option. Please choose from available options.",
      hi: "गलत विकल्प। कृपया उपलब्ध विकल्पों में से चुनें।",
      hinglish: "Invalid option। Please available options से choose करें।"
    }
  };

  return texts[key]?.[language] || texts[key]?.['en'] || key;
}

export default ConversationalForms;