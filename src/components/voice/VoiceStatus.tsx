'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { 
  Mic, 
  MicOff, 
  Wifi, 
  WifiOff, 
  AlertTriangle,
  CheckCircle,
  Loader2
} from 'lucide-react';
import { useVoice } from '@/hooks/useVoice';
import { useConnectionStatus } from '@/hooks/useRealTime';
import { MiniVoiceWaveform } from './VoiceWaveform';
import { cn } from '@/lib/utils';

interface VoiceStatusProps {
  className?: string;
  variant?: 'full' | 'compact' | 'minimal';
  showWaveform?: boolean;
}

export function VoiceStatus({ 
  className, 
  variant = 'full',
  showWaveform = true 
}: VoiceStatusProps) {
  const {
    isSupported,
    isListening,
    isProcessing,
    error,
    history
  } = useVoice();
  
  const connectionStatus = useConnectionStatus();

  const getVoiceStatusInfo = () => {
    if (!isSupported) {
      return {
        status: 'unsupported',
        message: 'Voice not supported',
        messageHindi: 'आवाज़ समर्थित नहीं',
        color: 'text-foreground-muted',
        icon: MicOff
      };
    }

    if (error) {
      return {
        status: 'error',
        message: 'Voice error',
        messageHindi: 'आवाज़ में त्रुटि',
        color: 'text-crimson',
        icon: AlertTriangle
      };
    }

    if (isProcessing) {
      return {
        status: 'processing',
        message: 'Processing...',
        messageHindi: 'प्रोसेसिंग...',
        color: 'text-saffron',
        icon: Loader2
      };
    }

    if (isListening) {
      return {
        status: 'listening',
        message: 'Listening',
        messageHindi: 'सुन रहा है',
        color: 'text-emerald',
        icon: Mic
      };
    }

    return {
      status: 'ready',
      message: 'Voice ready',
      messageHindi: 'आवाज़ तैयार',
      color: 'text-emerald',
      icon: CheckCircle
    };
  };

  const getConnectionStatusInfo = () => {
    switch (connectionStatus) {
      case 'connected':
        return {
          message: 'Connected',
          messageHindi: 'जुड़ा हुआ',
          color: 'text-emerald',
          icon: Wifi
        };
      case 'connecting':
        return {
          message: 'Connecting...',
          messageHindi: 'जुड़ रहा है...',
          color: 'text-saffron',
          icon: Loader2
        };
      case 'error':
        return {
          message: 'Connection error',
          messageHindi: 'कनेक्शन त्रुटि',
          color: 'text-crimson',
          icon: AlertTriangle
        };
      default:
        return {
          message: 'Disconnected',
          messageHindi: 'डिस्कनेक्ट',
          color: 'text-foreground-muted',
          icon: WifiOff
        };
    }
  };

  const voiceStatus = getVoiceStatusInfo();
  const connectionInfo = getConnectionStatusInfo();
  const successfulCommands = history.filter(cmd => cmd.success).length;

  if (variant === 'minimal') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <motion.div
          animate={isListening ? { scale: [1, 1.1, 1] } : {}}
          transition={{ duration: 1, repeat: Infinity }}
        >
          <voiceStatus.icon 
            className={cn('w-4 h-4', voiceStatus.color)}
          />
        </motion.div>
        
        {showWaveform && (
          <MiniVoiceWaveform 
            isActive={isListening}
            className={voiceStatus.color}
          />
        )}
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center gap-3 px-3 py-2 glass rounded-lg', className)}>
        {/* Voice Status */}
        <div className="flex items-center gap-2">
          <motion.div
            animate={
              isListening ? { scale: [1, 1.1, 1] } :
              isProcessing ? { rotate: 360 } : {}
            }
            transition={{ 
              duration: isListening ? 1 : isProcessing ? 1 : 0,
              repeat: isListening || isProcessing ? Infinity : 0 
            }}
          >
            <voiceStatus.icon 
              className={cn('w-4 h-4', voiceStatus.color)}
            />
          </motion.div>
          
          {showWaveform && isListening && (
            <MiniVoiceWaveform 
              isActive={true}
              className={voiceStatus.color}
            />
          )}
          
          <span className={cn('text-sm font-medium', voiceStatus.color)}>
            {voiceStatus.message}
          </span>
        </div>

        {/* Connection Status */}
        <div className="flex items-center gap-1">
          <connectionInfo.icon 
            className={cn('w-3 h-3', connectionInfo.color)}
          />
        </div>

        {/* Commands Count */}
        {successfulCommands > 0 && (
          <div className="text-xs text-foreground-muted">
            {successfulCommands}
          </div>
        )}
      </div>
    );
  }

  // Full variant
  return (
    <div className={cn('glass rounded-lg p-4', className)}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground">System Status</h3>
        <span className="text-xs text-foreground-muted font-devanagari">
          सिस्टम स्थिति
        </span>
      </div>

      <div className="space-y-4">
        {/* Voice Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div
              animate={
                isListening ? { scale: [1, 1.1, 1] } :
                isProcessing ? { rotate: 360 } : {}
              }
              transition={{ 
                duration: isListening ? 1 : isProcessing ? 1 : 0,
                repeat: isListening || isProcessing ? Infinity : 0 
              }}
            >
              <voiceStatus.icon 
                className={cn('w-5 h-5', voiceStatus.color)}
              />
            </motion.div>
            
            <div>
              <div className={cn('font-medium', voiceStatus.color)}>
                {voiceStatus.message}
              </div>
              <div className="text-xs text-foreground-muted font-devanagari">
                {voiceStatus.messageHindi}
              </div>
            </div>
          </div>

          {showWaveform && isListening && (
            <MiniVoiceWaveform 
              isActive={true}
              className={voiceStatus.color}
            />
          )}
        </div>

        {/* Connection Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div
              animate={connectionStatus === 'connecting' ? { rotate: 360 } : {}}
              transition={{ 
                duration: 1,
                repeat: connectionStatus === 'connecting' ? Infinity : 0 
              }}
            >
              <connectionInfo.icon 
                className={cn('w-5 h-5', connectionInfo.color)}
              />
            </motion.div>
            
            <div>
              <div className={cn('font-medium', connectionInfo.color)}>
                {connectionInfo.message}
              </div>
              <div className="text-xs text-foreground-muted font-devanagari">
                {connectionInfo.messageHindi}
              </div>
            </div>
          </div>

          <div className="text-xs text-foreground-muted">
            Real-time sync
          </div>
        </div>

        {/* Stats */}
        <div className="flex justify-between pt-3 border-t border-glass-border">
          <div className="text-center">
            <div className="text-lg font-bold text-emerald">
              {successfulCommands}
            </div>
            <div className="text-xs text-foreground-muted">
              Successful
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-lg font-bold text-saffron">
              {history.length}
            </div>
            <div className="text-xs text-foreground-muted">
              Total
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-lg font-bold text-foreground">
              {history.length > 0 ? Math.round((successfulCommands / history.length) * 100) : 0}%
            </div>
            <div className="text-xs text-foreground-muted">
              Accuracy
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="p-3 bg-crimson/10 border border-crimson/20 rounded-lg"
          >
            <div className="flex items-center gap-2 text-crimson text-sm">
              <AlertTriangle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

// Quick status indicator for headers/navbars
export function QuickVoiceStatus({ className }: { className?: string }) {
  const { isListening, isProcessing, error } = useVoice();
  const connectionStatus = useConnectionStatus();

  const getIndicatorColor = () => {
    if (error) return 'bg-crimson';
    if (isProcessing) return 'bg-saffron animate-pulse';
    if (isListening) return 'bg-emerald animate-pulse';
    if (connectionStatus === 'connected') return 'bg-emerald';
    if (connectionStatus === 'connecting') return 'bg-saffron animate-pulse';
    return 'bg-foreground-muted';
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className={cn('w-2 h-2 rounded-full', getIndicatorColor())} />
      <span className="text-xs text-foreground-muted">
        {isListening ? 'Listening' : 
         isProcessing ? 'Processing' :
         error ? 'Error' :
         connectionStatus === 'connected' ? 'Ready' : 'Offline'}
      </span>
    </div>
  );
}