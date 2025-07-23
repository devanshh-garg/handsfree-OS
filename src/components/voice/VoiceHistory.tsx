'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  History, 
  Mic, 
  CheckCircle, 
  XCircle, 
  Volume2, 
  RotateCcw,
  Filter,
  Search,
  Clock
} from 'lucide-react';
import { useVoice } from '@/hooks/useVoice';
import { VoiceCommand } from '@/types';
import { cn, formatTime, getLanguageFlag } from '@/lib/utils';

interface VoiceHistoryProps {
  className?: string;
  maxItems?: number;
  showFilters?: boolean;
}

export function VoiceHistory({ 
  className, 
  maxItems = 20,
  showFilters = true 
}: VoiceHistoryProps) {
  const { history, undoLastCommand } = useVoice();
  const [filter, setFilter] = useState<'all' | 'success' | 'failed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  const filteredHistory = history
    .filter(cmd => {
      if (filter === 'success') return cmd.success;
      if (filter === 'failed') return !cmd.success;
      return true;
    })
    .filter(cmd => 
      searchQuery === '' || 
      cmd.command.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .slice(0, maxItems);

  const handleUndo = async () => {
    const success = await undoLastCommand();
    if (success) {
      // Show success feedback
      console.log('Last command undone successfully');
    }
  };

  return (
    <div className={cn('glass rounded-lg p-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-saffron" />
          <h3 className="font-semibold text-foreground">
            Voice History
          </h3>
          <span className="text-xs text-foreground-muted font-devanagari">
            आवाज़ का इतिहास
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          {history.length > 0 && history[0].success && (
            <motion.button
              onClick={handleUndo}
              className="p-1.5 rounded-lg bg-glass-hover hover:bg-saffron/20 text-saffron transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              title="Undo last command"
            >
              <RotateCcw className="w-4 h-4" />
            </motion.button>
          )}
          
          <motion.button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg bg-glass-hover hover:bg-emerald/20 text-emerald transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Filter className="w-4 h-4" />
          </motion.button>
        </div>
      </div>

      {/* Filters */}
      <AnimatePresence>
        {(showFilters && isExpanded) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mb-4 overflow-hidden"
          >
            <div className="flex flex-col gap-3 py-2">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-foreground-muted" />
                <input
                  type="text"
                  placeholder="Search commands..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-background-secondary rounded-lg border border-glass-border text-sm focus:outline-none focus:border-saffron transition-colors"
                />
              </div>
              
              {/* Filter buttons */}
              <div className="flex gap-2">
                {(['all', 'success', 'failed'] as const).map((filterType) => (
                  <button
                    key={filterType}
                    onClick={() => setFilter(filterType)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                      filter === filterType
                        ? 'bg-saffron text-white'
                        : 'bg-glass-hover text-foreground-muted hover:text-foreground'
                    )}
                  >
                    {filterType === 'all' && 'All'}
                    {filterType === 'success' && 'Success'}
                    {filterType === 'failed' && 'Failed'}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* History List */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        <AnimatePresence mode="popLayout">
          {filteredHistory.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-8 text-foreground-muted"
            >
              <Mic className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No voice commands yet</p>
              <p className="text-xs font-devanagari">अभी तक कोई आवाज़ कमांड नहीं</p>
            </motion.div>
          ) : (
            filteredHistory.map((command, index) => (
              <VoiceCommandItem
                key={command.id}
                command={command}
                index={index}
              />
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Summary Stats */}
      {history.length > 0 && (
        <div className="mt-4 pt-3 border-t border-glass-border">
          <div className="flex justify-between text-xs text-foreground-muted">
            <span>
              Total: {history.length}
            </span>
            <span>
              Success: {history.filter(c => c.success).length}
            </span>
            <span>
              Failed: {history.filter(c => !c.success).length}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function VoiceCommandItem({ 
  command, 
  index 
}: { 
  command: VoiceCommand;
  index: number;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ delay: index * 0.05 }}
      className="glass-hover rounded-lg p-3 cursor-pointer"
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div className="flex items-start gap-3">
        {/* Status Icon */}
        <div className="flex-shrink-0 mt-0.5">
          {command.success ? (
            <CheckCircle className="w-4 h-4 text-emerald" />
          ) : (
            <XCircle className="w-4 h-4 text-crimson" />
          )}
        </div>

        {/* Command Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-foreground truncate">
              &quot;{command.command}&quot;
            </span>
            <span className="text-xs">
              {getLanguageFlag(command.language)}
            </span>
          </div>
          
          <div className="flex items-center gap-3 text-xs text-foreground-muted">
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatTime(command.timestamp)}
            </div>
            
            <div className="flex items-center gap-1">
              <Volume2 className="w-3 h-3" />
              {Math.round(command.confidence * 100)}%
            </div>
            
            <div className="px-2 py-0.5 bg-saffron/20 text-saffron rounded-full">
              {command.action.type}
            </div>
          </div>

          {/* Response */}
          {command.response && (
            <motion.div
              initial={false}
              animate={{ 
                height: isExpanded ? 'auto' : 0,
                opacity: isExpanded ? 1 : 0 
              }}
              className="overflow-hidden mt-2"
            >
              <div className="p-2 bg-background-secondary rounded text-xs text-foreground-secondary">
                <div className="flex items-center gap-1 mb-1">
                  <Volume2 className="w-3 h-3" />
                  <span className="font-medium">Response:</span>
                </div>
                &quot;{command.response}&quot;
              </div>
            </motion.div>
          )}
        </div>

        {/* Confidence Indicator */}
        <div className="flex-shrink-0">
          <div className="w-2 h-8 bg-background-secondary rounded-full overflow-hidden">
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: `${command.confidence * 100}%` }}
              className={cn(
                'w-full rounded-full transition-colors',
                command.confidence >= 0.8 ? 'bg-emerald' :
                command.confidence >= 0.6 ? 'bg-saffron' : 'bg-crimson'
              )}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}