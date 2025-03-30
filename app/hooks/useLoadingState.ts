'use client';

import { useState, useCallback } from 'react';

interface LoadingState {
  isLoading: boolean;
  error: string | null;
}

interface UseLoadingStateReturn extends LoadingState {
  startLoading: () => void;
  stopLoading: (error?: string) => void;
  clearError: () => void;
}

export const useLoadingState = (initialState: boolean = false): UseLoadingStateReturn => {
  const [state, setState] = useState<LoadingState>({
    isLoading: initialState,
    error: null,
  });

  const startLoading = useCallback(() => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
  }, []);

  const stopLoading = useCallback((error?: string) => {
    setState(prev => ({ ...prev, isLoading: false, error: error || null }));
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    startLoading,
    stopLoading,
    clearError,
  };
}; 