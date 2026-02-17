/**
 * VOXIS Network Resilience Utilities
 * Powered by Trinity 8.1 | Built by Glass Stone
 *
 * Provides offline detection, reconnection handling, and operation queuing.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export interface NetworkStatus {
  isOnline: boolean;
  isBackendReachable: boolean;
  lastOnlineAt: Date | null;
  reconnectAttempts: number;
}

export function useNetworkStatus(healthCheckUrl: string = 'http://localhost:5001/api/health', checkIntervalMs: number = 5000) {
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
      const response = await fetch(healthCheckUrl, { signal: controller.signal, cache: 'no-store' });
      clearTimeout(timeoutId);
      if (response.ok) {
        setStatus(prev => ({ ...prev, isBackendReachable: true, lastOnlineAt: new Date(), reconnectAttempts: 0 }));
        return true;
      }
    } catch {
      setStatus(prev => ({ ...prev, isBackendReachable: false, reconnectAttempts: prev.reconnectAttempts + 1 }));
    }
    return false;
  }, [healthCheckUrl]);

  useEffect(() => {
    const handleOnline = () => {
      setStatus(prev => ({ ...prev, isOnline: true }));
      checkBackendHealth();
    };
    const handleOffline = () => {
      setStatus(prev => ({ ...prev, isOnline: false, isBackendReachable: false }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    checkBackendHealth();
    checkIntervalRef.current = window.setInterval(() => {
      if (navigator.onLine) checkBackendHealth();
    }, checkIntervalMs);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
    };
  }, [checkBackendHealth, checkIntervalMs]);

  const forceReconnect = useCallback(() => { checkBackendHealth(); }, [checkBackendHealth]);

  return { ...status, forceReconnect, backendOnline: status.isBackendReachable };
}

export interface QueuedOperation {
  id: string;
  type: 'upload' | 'process' | 'download';
  payload: any;
  createdAt: Date;
  retries: number;
}

export function useOperationQueue() {
  const [queue, setQueue] = useState<QueuedOperation[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('voxis_operation_queue');
      if (saved) {
        const parsed = JSON.parse(saved);
        setQueue(parsed.map((op: any) => ({ ...op, createdAt: new Date(op.createdAt) })));
      }
    } catch { }
  }, []);

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

  const dequeue = useCallback((id: string) => { setQueue(prev => prev.filter(op => op.id !== id)); }, []);
  const clearQueue = useCallback(() => { setQueue([]); }, []);

  return { queue, enqueue, dequeue, clearQueue, isProcessing, setIsProcessing, queueLength: queue.length };
}
