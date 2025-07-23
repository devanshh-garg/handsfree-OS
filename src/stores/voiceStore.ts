import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { VoiceState, VoiceCommand, VoiceAction } from '@/types';
import { saveToStore, getRecentVoiceCommands } from '@/lib/db';
import { getEnhancedVoiceProcessor, EnhancedVoiceCommand } from '@/lib/nlp/EnhancedVoiceProcessor';

interface VoiceStoreState extends VoiceState {
  // Actions
  startListening: () => void;
  stopListening: () => void;
  setProcessing: (processing: boolean) => void;
  addCommand: (command: VoiceCommand) => void;
  setCurrentCommand: (command: string) => void;
  setLastResponse: (response: string) => void;
  setError: (error: string | null) => void;
  clearHistory: () => void;
  loadHistory: () => Promise<void>;
  undoLastCommand: () => Promise<boolean>;
  
  // Voice processing
  processVoiceCommand: (transcript: string, confidence: number) => Promise<VoiceCommand>;
  executeVoiceAction: (action: VoiceAction, parameters: Record<string, any>) => Promise<string>;
}

export const useVoiceStore = create<VoiceStoreState>()(
  immer((set, get) => ({
    isListening: false,
    isProcessing: false,
    currentCommand: undefined,
    lastResponse: undefined,
    error: null,
    history: [],

    startListening: () => set((state) => {
      state.isListening = true;
      state.error = null;
    }),

    stopListening: () => set((state) => {
      state.isListening = false;
    }),

    setProcessing: (processing: boolean) => set((state) => {
      state.isProcessing = processing;
    }),

    addCommand: (command: VoiceCommand) => set((state) => {
      state.history.unshift(command); // Add to beginning for most recent first
      state.history = state.history.slice(0, 100); // Keep only last 100 commands
      
      // Auto-save to IndexedDB
      saveToStore('voiceCommands', command);
    }),

    setCurrentCommand: (command: string) => set((state) => {
      state.currentCommand = command;
    }),

    setLastResponse: (response: string) => set((state) => {
      state.lastResponse = response;
    }),

    setError: (error: string | null) => set((state) => {
      state.error = error;
    }),

    clearHistory: () => set((state) => {
      state.history = [];
    }),

    loadHistory: async () => {
      try {
        const commands = await getRecentVoiceCommands(50);
        set((state) => {
          state.history = commands as VoiceCommand[];
        });
      } catch (error) {
        console.error('Failed to load voice history:', error);
      }
    },

    undoLastCommand: async () => {
      const { history } = get();
      const lastCommand = history[0];
      
      if (!lastCommand || !lastCommand.success) {
        return false;
      }

      try {
        // Create undo action based on the last command
        const undoAction = createUndoAction(lastCommand);
        if (undoAction) {
          const response = await get().executeVoiceAction(undoAction.action, undoAction.parameters);
          
          // Add undo command to history
          const undoCommand: VoiceCommand = {
            id: `undo-${Date.now()}`,
            command: `Undo: ${lastCommand.command}`,
            language: 'english',
            confidence: 1.0,
            timestamp: new Date(),
            action: undoAction.action,
            parameters: undoAction.parameters,
            success: true,
            response
          };
          
          get().addCommand(undoCommand);
          return true;
        }
      } catch (error) {
        console.error('Failed to undo command:', error);
      }
      
      return false;
    },

    processVoiceCommand: async (transcript: string, confidence: number) => {
      try {
        // Use enhanced voice processor for sophisticated analysis
        const enhancedProcessor = getEnhancedVoiceProcessor();
        const sessionId = 'voice_session_' + Date.now(); // In real app, this would be persistent
        
        const enhancedCommand = await enhancedProcessor.processVoiceCommand(
          transcript, 
          confidence, 
          sessionId
        );

        // Convert enhanced command to basic VoiceCommand for compatibility
        const command: VoiceCommand = {
          id: enhancedCommand.id,
          command: enhancedCommand.command,
          language: enhancedCommand.language,
          confidence: enhancedCommand.confidence,
          timestamp: enhancedCommand.timestamp,
          action: enhancedCommand.action,
          parameters: enhancedCommand.parameters,
          success: enhancedCommand.success,
          response: enhancedCommand.response
        };

        // Execute the action using enhanced analysis
        if (enhancedCommand.success && enhancedCommand.action) {
          try {
            const response = await get().executeVoiceAction(command.action, command.parameters);
            command.success = true;
            command.response = response;
            get().setLastResponse(response);
          } catch (error) {
            command.success = false;
            command.response = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
            get().setError(command.response);
          }
        }

        get().addCommand(command);
        
        // Log enhanced processing results for debugging
        if (enhancedCommand.nlpAnalysis) {
          console.log('Enhanced NLP Analysis:', {
            intent: enhancedCommand.nlpAnalysis.intentClassification?.intent,
            entities: enhancedCommand.nlpAnalysis.entityExtraction?.length || 0,
            language: enhancedCommand.nlpAnalysis.languageDetection,
            sentiment: enhancedCommand.nlpAnalysis.sentimentAnalysis?.sentiment
          });
        }

        return command;
      } catch (error) {
        console.warn('Enhanced processing failed, falling back to basic:', error);
        
        // Fallback to basic processing
        const command: VoiceCommand = {
          id: `cmd-${Date.now()}`,
          command: transcript,
          language: detectLanguage(transcript),
          confidence,
          timestamp: new Date(),
          action: parseVoiceCommand(transcript),
          parameters: extractParameters(transcript),
          success: false
        };

        try {
          const response = await get().executeVoiceAction(command.action, command.parameters);
          command.success = true;
          command.response = response;
          get().setLastResponse(response);
        } catch (actionError) {
          command.success = false;
          command.response = `Error: ${actionError instanceof Error ? actionError.message : 'Unknown error'}`;
          get().setError(command.response);
        }

        get().addCommand(command);
        return command;
      }
    },

    executeVoiceAction: async (action: VoiceAction, parameters: Record<string, any>) => {
      // Emit voice command to socket server for real-time processing
      if (typeof window !== 'undefined' && window.socket) {
        window.socket.emit('voice:command', { action, parameters });
      }

      // Also handle locally for immediate feedback
      switch (action.type) {
        case 'order':
          return await handleOrderAction(action.subtype, parameters);
        case 'table':
          return await handleTableAction(action.subtype, parameters);
        case 'inventory':
          return await handleInventoryAction(action.subtype, parameters);
        case 'navigation':
          return await handleNavigationAction(action.subtype, parameters);
        case 'query':
          return await handleQueryAction(action.subtype, parameters);
        default:
          throw new Error(`Unknown action type: ${action.type}`);
      }
    }
  }))
);

// Helper functions for voice processing
function detectLanguage(text: string): 'hindi' | 'english' | 'mixed' {
  const hindiPattern = /[\u0900-\u097F]/;
  const hasHindi = hindiPattern.test(text);
  const hasEnglish = /[a-zA-Z]/.test(text);
  
  if (hasHindi && hasEnglish) return 'mixed';
  if (hasHindi) return 'hindi';
  return 'english';
}

function parseVoiceCommand(text: string): VoiceAction {
  const lowerText = text.toLowerCase();
  
  // Order-related commands
  if (lowerText.includes('order') || lowerText.includes('add') || lowerText.includes('item')) {
    if (lowerText.includes('ready') || lowerText.includes('complete')) {
      return { type: 'order', subtype: 'mark_ready' };
    }
    if (lowerText.includes('add') || lowerText.includes('new')) {
      return { type: 'order', subtype: 'add_item' };
    }
    return { type: 'order', subtype: 'update' };
  }
  
  // Table-related commands
  if (lowerText.includes('table')) {
    if (lowerText.includes('clean') || lowerText.includes('clear')) {
      return { type: 'table', subtype: 'mark_cleaning' };
    }
    if (lowerText.includes('occupied') || lowerText.includes('busy')) {
      return { type: 'table', subtype: 'mark_occupied' };
    }
    return { type: 'table', subtype: 'update_status' };
  }
  
  // Inventory-related commands
  if (lowerText.includes('inventory') || lowerText.includes('stock') || lowerText.includes('khatam') || lowerText.includes('finished')) {
    return { type: 'inventory', subtype: 'update' };
  }
  
  // Navigation commands
  if (lowerText.includes('go to') || lowerText.includes('show') || lowerText.includes('open')) {
    return { type: 'navigation', subtype: 'navigate' };
  }
  
  // Query commands
  if (lowerText.includes('how much') || lowerText.includes('kitna') || lowerText.includes('revenue') || lowerText.includes('available')) {
    return { type: 'query', subtype: 'information' };
  }
  
  return { type: 'query', subtype: 'unknown' };
}

function extractParameters(text: string): Record<string, any> {
  const params: Record<string, any> = {};
  const lowerText = text.toLowerCase();
  
  // Extract table numbers
  const tableMatch = text.match(/table\s*(\d+)/i);
  if (tableMatch) {
    params.tableNumber = parseInt(tableMatch[1]);
  }
  
  // Extract item names (simplified - in real app would use fuzzy matching)
  const items = ['paneer', 'dal', 'rice', 'naan', 'chai', 'lassi', 'samosa', 'tikka'];
  for (const item of items) {
    if (lowerText.includes(item)) {
      params.itemName = item;
      break;
    }
  }
  
  // Extract quantities
  const quantityMatch = text.match(/(\d+)\s*(plate|glass|cup)/i);
  if (quantityMatch) {
    params.quantity = parseInt(quantityMatch[1]);
  }
  
  // Extract navigation targets
  if (lowerText.includes('dashboard') || lowerText.includes('home')) {
    params.page = 'dashboard';
  } else if (lowerText.includes('kitchen') || lowerText.includes('किचन')) {
    params.page = 'kitchen';
  } else if (lowerText.includes('waiter') || lowerText.includes('वेटर')) {
    params.page = 'waiter';
  } else if (lowerText.includes('menu') || lowerText.includes('मेन्यू')) {
    params.page = 'menu';
  }
  
  return params;
}

function createUndoAction(command: VoiceCommand): { action: VoiceAction; parameters: Record<string, any> } | null {
  switch (command.action.subtype) {
    case 'mark_ready':
      return {
        action: { type: 'order', subtype: 'mark_preparing' },
        parameters: command.parameters
      };
    case 'add_item':
      return {
        action: { type: 'order', subtype: 'remove_item' },
        parameters: command.parameters
      };
    default:
      return null;
  }
}

// Action handlers (would integrate with other stores)
async function handleOrderAction(subtype: string, params: Record<string, any>): Promise<string> {
  // This would call methods from useOrderStore
  switch (subtype) {
    case 'mark_ready':
      return `Table ${params.tableNumber} का order ready mark कर दिया गया है`;
    case 'add_item':
      return `${params.itemName} table ${params.tableNumber} में add कर दिया गया है`;
    default:
      return 'Order action completed';
  }
}

async function handleTableAction(subtype: string, params: Record<string, any>): Promise<string> {
  switch (subtype) {
    case 'mark_cleaning':
      return `Table ${params.tableNumber} को cleaning के लिए mark कर दिया गया है`;
    case 'mark_occupied':
      return `Table ${params.tableNumber} को occupied mark कर दिया गया है`;
    default:
      return 'Table status updated';
  }
}

async function handleInventoryAction(subtype: string, params: Record<string, any>): Promise<string> {
  return `${params.itemName} की inventory update कर दी गई है`;
}

async function handleNavigationAction(subtype: string, params: Record<string, any>): Promise<string> {
  return 'Navigation completed';
}

async function handleQueryAction(subtype: string, params: Record<string, any>): Promise<string> {
  return 'Information retrieved';
}