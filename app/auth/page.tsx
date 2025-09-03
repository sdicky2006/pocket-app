'use client';

import { useState } from 'react';
import { Eye, EyeOff, Shield, Lock, User, AlertCircle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AuthPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false,
  });
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [authStatus, setAuthStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const validateForm = () => {
    const newErrors: {[key: string]: string} = {};

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsLoading(true);
    setAuthStatus('idle');

    try {
      // Simulate API call with anti-detection delay
      await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));
      
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setAuthStatus('success');
        // Redirect to dashboard after success
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 1500);
      } else {
        setAuthStatus('error');
        setErrors({ general: 'Invalid credentials. Please try again.' });
      }
    } catch (error) {
      setAuthStatus('error');
      setErrors({ general: 'Connection error. Please check your internet connection.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-primary via-background-secondary to-background-tertiary flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-accent-primary to-accent-secondary rounded-xl flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gradient mb-2">Secure Authentication</h1>
          <p className="text-text-muted">Connect to Pocket Option safely</p>
        </div>

        {/* Auth Form */}
        <div className="trading-card p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* General Error */}
            {errors.general && (
              <div className="bg-accent-danger/10 border border-accent-danger/20 rounded-lg p-3 flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-accent-danger flex-shrink-0" />
                <span className="text-sm text-accent-danger">{errors.general}</span>
              </div>
            )}

            {/* Success Message */}
            {authStatus === 'success' && (
              <div className="bg-accent-success/10 border border-accent-success/20 rounded-lg p-3 flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-accent-success flex-shrink-0" />
                <span className="text-sm text-accent-success">Authentication successful! Redirecting...</span>
              </div>
            )}

            {/* Email Field */}
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium text-text-secondary">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-4 w-4 text-text-muted" />
                </div>
                <input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className={cn(
                    "w-full pl-10 pr-3 py-3 bg-surface-elevated border rounded-lg",
                    "focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-transparent",
                    "text-text-primary placeholder-text-muted transition-colors",
                    errors.email ? "border-accent-danger" : "border-border-primary"
                  )}
                  placeholder="Enter your Pocket Option email"
                  disabled={isLoading}
                />
              </div>
              {errors.email && (
                <p className="text-sm text-accent-danger">{errors.email}</p>
              )}
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium text-text-secondary">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-text-muted" />
                </div>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  className={cn(
                    "w-full pl-10 pr-10 py-3 bg-surface-elevated border rounded-lg",
                    "focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-transparent",
                    "text-text-primary placeholder-text-muted transition-colors",
                    errors.password ? "border-accent-danger" : "border-border-primary"
                  )}
                  placeholder="Enter your password"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-text-muted hover:text-text-secondary" />
                  ) : (
                    <Eye className="h-4 w-4 text-text-muted hover:text-text-secondary" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-sm text-accent-danger">{errors.password}</p>
              )}
            </div>

            {/* Remember Me */}
            <div className="flex items-center">
              <input
                id="remember-me"
                type="checkbox"
                checked={formData.rememberMe}
                onChange={(e) => setFormData(prev => ({ ...prev, rememberMe: e.target.checked }))}
                className="h-4 w-4 text-accent-primary focus:ring-accent-primary border-border-primary rounded"
                disabled={isLoading}
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-text-secondary">
                Remember my credentials (secure)
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className={cn(
                "w-full bg-gradient-to-r from-accent-primary to-accent-secondary text-white font-semibold py-3 px-4 rounded-lg",
                "transition-all duration-300 transform",
                isLoading
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:shadow-glow hover:scale-[1.02]"
              )}
            >
              {isLoading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Authenticating...</span>
                </div>
              ) : (
                'Connect to Pocket Option'
              )}
            </button>
          </form>

          {/* Security Notice */}
          <div className="mt-6 p-4 bg-surface-secondary rounded-lg border border-border-secondary">
            <div className="flex items-start space-x-3">
              <Shield className="w-5 h-5 text-accent-success flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="text-text-secondary mb-1">
                  <strong className="text-accent-success">Secure Connection:</strong>
                </p>
                <ul className="text-text-muted space-y-1 text-xs">
                  <li>• End-to-end encryption</li>
                  <li>• Anti-detection measures</li>
                  <li>• No credential storage on our servers</li>
                  <li>• Session expires automatically</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-xs text-text-muted">
            By connecting, you agree to use this tool responsibly and in accordance with Pocket Option's terms of service.
          </p>
        </div>
      </div>
    </div>
  );
}
