'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

const toastIcons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info
};

const toastStyles = {
  success: 'bg-emerald/10 border-emerald/30 text-emerald',
  error: 'bg-crimson/10 border-crimson/30 text-crimson',
  warning: 'bg-saffron/10 border-saffron/30 text-saffron',
  info: 'bg-gold/10 border-gold/30 text-gold'
};

export function Toast({ toast, onDismiss }: ToastProps) {
  const Icon = toastIcons[toast.type];
  
  useEffect(() => {
    if (toast.duration) {
      const timer = setTimeout(() => {
        onDismiss(toast.id);
      }, toast.duration);
      
      return () => clearTimeout(timer);
    }
  }, [toast, onDismiss]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.9 }}
      className={cn(
        'glass rounded-lg p-4 shadow-lg border max-w-sm w-full',
        toastStyles[toast.type]
      )}
    >
      <div className="flex items-start gap-3">
        <Icon className="w-5 h-5 mt-0.5 flex-shrink-0" />
        
        <div className="flex-1">
          <h3 className="font-semibold">{toast.title}</h3>
          {toast.message && (
            <p className="text-sm mt-1 opacity-90">{toast.message}</p>
          )}
        </div>
        
        <button
          onClick={() => onDismiss(toast.id)}
          className="p-1 rounded-lg hover:bg-background/20 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}

export function ToastContainer() {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      <AnimatePresence mode="popLayout">
        {window.toasts?.map((toast: Toast) => (
          <Toast
            key={toast.id}
            toast={toast}
            onDismiss={window.dismissToast}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

// Global toast management
declare global {
  interface Window {
    toasts: Toast[];
    showToast: (type: ToastType, title: string, message?: string, duration?: number) => void;
    dismissToast: (id: string) => void;
  }
}

// Initialize global toast system
if (typeof window !== 'undefined') {
  window.toasts = [];
  
  window.showToast = (type: ToastType, title: string, message?: string, duration = 5000) => {
    const toast: Toast = {
      id: `toast-${Date.now()}`,
      type,
      title,
      message,
      duration
    };
    
    window.toasts = [...window.toasts, toast];
    
    // Trigger re-render of ToastContainer
    window.dispatchEvent(new CustomEvent('toast-update'));
  };
  
  window.dismissToast = (id: string) => {
    window.toasts = window.toasts.filter(t => t.id !== id);
    window.dispatchEvent(new CustomEvent('toast-update'));
  };
}

// Hook to use toast system
export function useToast() {
  const [, setUpdate] = useState(0);
  
  useEffect(() => {
    const handleUpdate = () => setUpdate(prev => prev + 1);
    window.addEventListener('toast-update', handleUpdate);
    return () => window.removeEventListener('toast-update', handleUpdate);
  }, []);
  
  return {
    showToast: window.showToast,
    dismissToast: window.dismissToast
  };
}