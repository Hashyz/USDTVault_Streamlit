import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export function useAuth() {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(() => 
    localStorage.getItem('token')
  );

  useEffect(() => {
    // Function to handle storage changes
    const handleStorageChange = () => {
      const newToken = localStorage.getItem('token');
      setToken(newToken);
      
      // If token is removed (logout), invalidate queries
      if (!newToken) {
        queryClient.invalidateQueries({ queryKey: ['/api/auth/verify'] });
      }
    };

    // Listen for storage events (changes from other tabs/windows)
    window.addEventListener('storage', handleStorageChange);
    
    // Listen for custom storage events (changes from same tab)
    window.addEventListener('localStorageChange', handleStorageChange);
    
    // Check for token on mount and focus
    const checkToken = () => {
      const currentToken = localStorage.getItem('token');
      if (currentToken !== token) {
        setToken(currentToken);
      }
    };
    
    window.addEventListener('focus', checkToken);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('localStorageChange', handleStorageChange);
      window.removeEventListener('focus', checkToken);
    };
  }, [token, queryClient]);

  const { data: user, isLoading, error, refetch } = useQuery({
    queryKey: ['/api/auth/verify', token], // Add token to key to refetch when it changes
    queryFn: () => apiRequest('/api/auth/verify', 'GET'),
    enabled: !!token,
    retry: false,
    staleTime: 5 * 60 * 1000, // Consider data stale after 5 minutes
  });

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    setToken(null);
    queryClient.invalidateQueries({ queryKey: ['/api/auth/verify'] });
    
    // Dispatch custom event for same-tab listening
    window.dispatchEvent(new Event('localStorageChange'));
    
    // Use router navigation instead of window.location
    window.location.href = '/login';
  };

  // Refetch when token changes
  useEffect(() => {
    if (token) {
      refetch();
    }
  }, [token, refetch]);

  const getAuthHeaders = (): HeadersInit => {
    const currentToken = localStorage.getItem('token');
    return {
      'Authorization': currentToken ? `Bearer ${currentToken}` : '',
    };
  };

  return {
    user,
    isLoading,
    isAuthenticated: !!user && !error,
    logout,
    getAuthHeaders,
  };
}