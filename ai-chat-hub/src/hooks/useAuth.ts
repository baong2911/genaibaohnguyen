import { useState, useEffect } from "react";
import { toast } from "sonner";

interface User {
  id: string;
  username: string;
  email: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    token: localStorage.getItem('chatHubToken'),
    isAuthenticated: false,
    isLoading: true,
  });

  // Check if user is authenticated on mount
  useEffect(() => {
    const token = localStorage.getItem('chatHubToken');
    const user = localStorage.getItem('chatHubUser');
    
    if (token && user) {
      setAuthState({
        user: JSON.parse(user),
        token,
        isAuthenticated: true,
        isLoading: false,
      });
    } else {
      setAuthState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  const register = async (username: string, email: string, password: string) => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));
      
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('chatHubToken', data.token);
        localStorage.setItem('chatHubUser', JSON.stringify(data.user));
        
        setAuthState({
          user: data.user,
          token: data.token,
          isAuthenticated: true,
          isLoading: false,
        });
        
        toast.success('Registration successful!');
        return { success: true, data };
      } else {
        toast.error(data.error || 'Registration failed');
        return { success: false, error: data.error };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Registration failed';
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setAuthState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const login = async (email: string, password: string) => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));
      
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('chatHubToken', data.token);
        localStorage.setItem('chatHubUser', JSON.stringify(data.user));
        
        setAuthState({
          user: data.user,
          token: data.token,
          isAuthenticated: true,
          isLoading: false,
        });
        
        toast.success('Login successful!');
        
        // Auto reload page after successful login to refresh all components
        setTimeout(() => {
          window.location.reload();
        }, 1000); // Small delay to show the success message
        
        return { success: true, data };
      } else {
        toast.error(data.error || 'Login failed');
        return { success: false, error: data.error };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setAuthState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const logout = () => {
    localStorage.removeItem('chatHubToken');
    localStorage.removeItem('chatHubUser');
    
    // Clear all chat messages and streaming states for all providers
    const providers = ['openai', 'gemini', 'perplexity'];
    providers.forEach(provider => {
      localStorage.removeItem(`chat_${provider}`);
      localStorage.removeItem(`streaming_state_${provider}`);
    });
    
    setAuthState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
    });

    // Notify all useChat instances to clear their in-memory state
    window.dispatchEvent(new Event('chat-logout'));
    
    toast.success('Logged out successfully');

    // Redirect to home page
    window.history.pushState(null, "", "/");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  return {
    ...authState,
    register,
    login,
    logout,
  };
};
