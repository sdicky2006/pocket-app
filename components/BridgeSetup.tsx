'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, ExternalLink, Copy, CheckCircle } from 'lucide-react';

export default function BridgeSetup() {
  const [setupInstructions, setSetupInstructions] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchInstructions = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/bridge/browser-launch');
      const data = await response.json();
      setSetupInstructions(data);
    } catch (error) {
      console.error('Failed to fetch setup instructions:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyScript = async () => {
    if (setupInstructions?.bridgeScript) {
      await navigator.clipboard.writeText(setupInstructions.bridgeScript);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  useEffect(() => {
    fetchInstructions();
  }, []);

  if (loading) {
    return (
      <div className="p-4 border rounded-lg">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-300 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (!setupInstructions) {
    return null;
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">
            Manual Bridge Setup Required
          </h3>
          
          <p className="text-blue-800 mb-4">
            Browser automation isn't available in the deployed environment. 
            Follow these steps to connect manually:
          </p>

          <div className="space-y-3 mb-4">
            <div className="flex items-start gap-2">
              <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full min-w-[24px] text-center">1</span>
              <span className="text-blue-700">Open your browser and go to https://pocketoption.com</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full min-w-[24px] text-center">2</span>
              <span className="text-blue-700">Log in to your Pocket Option account</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full min-w-[24px] text-center">3</span>
              <span className="text-blue-700"><strong>Press F12</strong> to open Developer Tools</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full min-w-[24px] text-center">4</span>
              <span className="text-blue-700"><strong>Click "Console" tab</strong> (usually the 2nd tab)</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full min-w-[24px] text-center">5</span>
              <span className="text-blue-700"><strong>Click where you see the ">" prompt</strong> at the bottom</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full min-w-[24px] text-center">6</span>
              <div className="text-blue-700">
                <strong>Enable pasting first:</strong><br/>
                Type: <code className="bg-blue-100 px-1 rounded">allow pasting</code> and press Enter
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full min-w-[24px] text-center">7</span>
              <span className="text-blue-700"><strong>Now copy and paste the script below</strong> (Ctrl+V)</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full min-w-[24px] text-center">8</span>
              <span className="text-blue-700"><strong>Press Enter</strong> to run the script</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full min-w-[24px] text-center">9</span>
              <span className="text-blue-700"><strong>Go to the trading page</strong> or refresh if already there</span>
            </div>
          </div>

          <div className="bg-gray-900 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-green-400 font-mono text-sm">Bridge Script</span>
              <button
                onClick={copyScript}
                className="flex items-center gap-2 px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm transition-colors"
              >
                {copied ? (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy Script
                  </>
                )}
              </button>
            </div>
            <pre className="text-green-300 text-xs overflow-x-auto whitespace-pre-wrap">
              {setupInstructions.bridgeScript}
            </pre>
          </div>

          {setupInstructions.shortScript && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <span className="text-yellow-800 font-medium text-sm">Can't paste? Use this shorter version to type:</span>
              </div>
              <div className="bg-gray-900 rounded p-2">
                <pre className="text-green-300 text-xs overflow-x-auto whitespace-pre-wrap">
                  {setupInstructions.shortScript}
                </pre>
              </div>
              <p className="text-yellow-700 text-xs mt-2">
                This shorter script does the same thing - easier to type manually if pasting doesn't work.
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <a
              href="https://pocketoption.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              Open Pocket Option
            </a>
            
            <button
              onClick={fetchInstructions}
              className="px-4 py-2 border border-blue-300 text-blue-700 hover:bg-blue-100 rounded transition-colors"
            >
              Refresh Instructions
            </button>
          </div>

          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded">
            <h4 className="text-green-800 font-medium text-sm mb-2">🔍 After pasting the script, look for these messages:</h4>
            <div className="text-green-700 text-xs font-mono space-y-1">
              <div>🚀 Pocket Option Bridge Starting...</div>
              <div>✅ Bridge script installed! Monitoring...</div>
              <div>📡 Found existing WebSocket: wss://...</div>
              <div>🔗 Successfully connected to your trading app!</div>
            </div>
            <p className="text-green-800 text-sm mt-2">
              <strong>No connection?</strong> Navigate to the trading interface or refresh the page.
            </p>
          </div>
          
          <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-yellow-800 text-sm">
              <strong>Note:</strong> This manual setup is only needed when the app is deployed. 
              When running locally, the automatic browser launch will work normally.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
