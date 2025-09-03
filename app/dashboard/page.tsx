'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Activity, LogOut, User, Clock, CheckCircle } from 'lucide-react';

interface User {
  email: string;
  userId: string;
  lastActivity: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionStatus, setSessionStatus] = useState<'active' | 'expired' | 'invalid'>('active');

  useEffect(() => {
    validateSession();
  }, []);

  const validateSession = async () => {
    try {
      const response = await fetch('/api/auth/validate');
      const data = await response.json();

      if (data.valid) {
        setUser(data.user);
        setSessionStatus('active');
      } else {
        setSessionStatus('invalid');
        router.push('/auth');
      }
    } catch (error) {
      console.error('Session validation failed:', error);
      setSessionStatus('invalid');
      router.push('/auth');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/');
    } catch (error) {
      console.error('Logout failed:', error);
      // Force redirect even if logout fails
      router.push('/');
    }
  };

  const formatLastActivity = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} minutes ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hours ago`;
    
    const days = Math.floor(hours / 24);
    return `${days} days ago`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background-primary via-background-secondary to-background-tertiary flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-text-muted">Validating session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-primary via-background-secondary to-background-tertiary">
      {/* Header */}
      <header className="border-b border-border-primary bg-surface-primary/80 backdrop-blur-md">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-accent-primary to-accent-secondary rounded-lg flex items-center justify-center">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gradient">Pocket-APP</h1>
                <p className="text-sm text-text-muted">Trading Dashboard</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-accent-success rounded-full animate-pulse"></div>
                <span className="text-sm text-text-secondary">Authenticated</span>
              </div>
              
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 px-3 py-2 bg-surface-elevated hover:bg-surface-secondary border border-border-primary hover:border-accent-danger/50 rounded-lg transition-all duration-200"
              >
                <LogOut className="w-4 h-4 text-accent-danger" />
                <span className="text-sm text-text-secondary">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Welcome Section */}
          <div className="lg:col-span-2">
            <div className="trading-card p-6 mb-6">
              <div className="flex items-center space-x-3 mb-4">
                <CheckCircle className="w-6 h-6 text-accent-success" />
                <h2 className="text-xl font-semibold">Authentication Successful</h2>
              </div>
              <p className="text-text-secondary mb-6">
                You have successfully connected to Pocket Option. Your session is secure and all communications are encrypted.
              </p>
              
              <div className="bg-accent-success/10 border border-accent-success/20 rounded-lg p-4">
                <h3 className="font-medium text-accent-success mb-2">Security Features Active:</h3>
                <ul className="text-sm text-text-secondary space-y-1">
                  <li>✓ End-to-end encrypted connection</li>
                  <li>✓ Anti-detection measures enabled</li>
                  <li>✓ Session token secure (HTTP-only)</li>
                  <li>✓ Automatic session timeout configured</li>
                </ul>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="trading-card p-6">
              <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  onClick={() => router.push('/')}
                  className="p-4 bg-surface-elevated hover:bg-surface-secondary border border-border-primary hover:border-accent-primary/50 rounded-lg transition-all duration-200 text-left"
                >
                  <Activity className="w-5 h-5 text-accent-primary mb-2" />
                  <h4 className="font-medium mb-1">Start Trading Analysis</h4>
                  <p className="text-sm text-text-muted">Access the main trading interface</p>
                </button>
                
                <button className="p-4 bg-surface-elevated hover:bg-surface-secondary border border-border-primary hover:border-accent-secondary/50 rounded-lg transition-all duration-200 text-left">
                  <Shield className="w-5 h-5 text-accent-secondary mb-2" />
                  <h4 className="font-medium mb-1">Security Settings</h4>
                  <p className="text-sm text-text-muted">Manage your connection settings</p>
                </button>
              </div>
            </div>
          </div>

          {/* Session Info */}
          <div className="space-y-6">
            {/* User Info */}
            <div className="trading-card p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <User className="w-5 h-5 mr-2 text-accent-primary" />
                Session Information
              </h3>
              
              {user && (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-text-muted">Connected Account</label>
                    <p className="font-mono text-sm bg-surface-elevated p-2 rounded border border-border-primary mt-1">
                      {user.email}
                    </p>
                  </div>
                  
                  <div>
                    <label className="text-sm text-text-muted">Session ID</label>
                    <p className="font-mono text-sm bg-surface-elevated p-2 rounded border border-border-primary mt-1">
                      {user.userId}
                    </p>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-muted">Last Activity</span>
                    <span className="text-sm text-text-primary flex items-center">
                      <Clock className="w-3 h-3 mr-1" />
                      {formatLastActivity(user.lastActivity)}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-muted">Status</span>
                    <span className="text-sm text-accent-success flex items-center">
                      <div className="w-2 h-2 bg-accent-success rounded-full mr-2"></div>
                      Active
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Security Status */}
            <div className="trading-card p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Shield className="w-5 h-5 mr-2 text-accent-success" />
                Security Status
              </h3>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-secondary">Connection</span>
                  <span className="text-sm text-accent-success">Encrypted</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-secondary">Session</span>
                  <span className="text-sm text-accent-success">Secure</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-secondary">Anti-Detection</span>
                  <span className="text-sm text-accent-success">Active</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-secondary">Auto-Logout</span>
                  <span className="text-sm text-accent-warning">24h</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
