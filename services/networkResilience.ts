/**
 * VOXIS Network Resilience Utilities
 * Powered by Trinity | Built by Glass Stone
 * 
 * Provides offline detection, reconnection handling, and operation queuing.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// =============================================================================
// NETWORK STATUS HOOK
// =============================================================================

export interface NetworkStatus {
  isOnline: boolean;
  isBackendReachable: boolean;
  lastOnlineAt: Date | null;
  reconnectAttempts: number;
}

/**
 * Hook to monitor network and backend connectivity
 */
export function useNetworkStatus(healthCheckUrl: string, checkIntervalMs: number = 5000) {
  const [status, setStatus] = useState<NetworkStatus>({
    isOnline: navigator.onLine,
    isBackendReachable: false,
    lastOnlineAt: null,
    reconnectAttempts: 0,
  });
  
  const checkIntervalRef = useRef<number | null>(null);
  
  const checkBackendHealth = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      const response = await fetch(healthCheckUrl, { 
        signal: controller.signal,
        cache: 'no-store'
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        setStatus(prev => ({
          ...prev,
          isBackendReachable: true,
          lastOnlineAt: new Date(),
          reconnectAttempts: 0,
        }));
        return true;
      }
    } catch {
      setStatus(prev => ({
        ...prev,
        isBackendReachable: false,
        reconnectAttempts: prev.reconnectAttempts + 1,
      }));
    }
    return false;
  }, [healthCheckUrl]);
  
  useEffect(() => {
    // Browser online/offline events
    const handleOnline = () => {
      setStatus(prev => ({ ...prev, isOnline: true }));
      checkBackendHealth(); // Immediately check backend when browser comes online
    };
    
    const handleOffline = () => {
      setStatus(prev => ({ 
        ...prev, 
        isOnline: false, 
        isBackendReachable: false 
      }));
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Initial check
    checkBackendHealth();
    
    // Periodic health checks
    checkIntervalRef.current = window.setInterval(() => {
      if (navigator.onLine) {
        checkBackendHealth();
      }
    }, checkIntervalMs);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [checkBackendHealth, checkIntervalMs]);
  
  const forceReconnect = useCallback(() => {
    checkBackendHealth();
  }, [checkBackendHealth]);
  
  return { ...status, forceReconnect };
}

// =============================================================================
// OPERATION QUEUE (for offline-first pattern)
// =============================================================================

export interface QueuedOperation {
  id: string;
  type: 'upload' | 'process' | 'download';
  payload: any;
  createdAt: Date;
  retries: number;
}

/**
 * Hook to queue operations when offline
 */
export function useOperationQueue() {
  const [queue, setQueue] = useState<QueuedOperation[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Load queue from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('voxis_operation_queue');
      if (saved) {
        const parsed = JSON.parse(saved);
        setQueue(parsed.map((op: any) => ({
          ...op,
          createdAt: new Date(op.createdAt)
        })));
      }
    } catch {
      // Ignore parse errors
    }
  }, []);
  
  // Save queue to localStorage on change
  useEffect(() => {
    localStorage.setItem('voxis_operation_queue', JSON.stringify(queue));
  }, [queue]);
  
  const enqueue = useCallback((operation: Omit<QueuedOperation, 'id' | 'createdAt' | 'retries'>) => {
    const newOp: QueuedOperation = {
      ...operation,
      id: `op_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      createdAt: new Date(),
      retries: 0,
    };
    setQueue(prev => [...prev, newOp]);
    return newOp.id;
  }, []);
  
  const dequeue = useCallback((id: string) => {
    setQueue(prev => prev.filter(op => op.id !== id));
  }, []);
  
  const clearQueue = useCallback(() => {
    setQueue([]);
  }, []);
  
  const incrementRetry = useCallback((id: string) => {
    setQueue(prev => prev.map(op => 
      op.id === id ? { ...op, retries: op.retries + 1 } : op
    ));
  }, []);
  
  return {
    queue,
    enqueue,
    dequeue,
    clearQueue,
    incrementRetry,
    isProcessing,
    setIsProcessing,
    queueLength: queue.length,
  };
}

// =============================================================================
// LOCAL STATE PERSISTENCE
// =============================================================================

/**
 * Hook to persist processing state across page reloads
 */
export function usePersistentState<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(`voxis_${key}`);
      return saved ? JSON.parse(saved) : initialValue;
    } catch {
      return initialValue;
    }
  });
  
  useEffect(() => {
    try {
      localStorage.setItem(`voxis_${key}`, JSON.stringify(value));
    } catch {
      // Storage full or unavailable
    }
  }, [key, value]);
  
  const clearPersistedState = useCallback(() => {
    localStorage.removeItem(`voxis_${key}`);
    setValue(initialValue);
  }, [key, initialValue]);
  
  return [value, setValue, clearPersistedState] as const;
}
