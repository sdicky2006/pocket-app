import { NextResponse } from 'next/server';

export async function GET() {
  // Return instructions for manual browser setup since automated browser launch
  // doesn't work in Vercel's serverless environment
  
  const instructions = {
    message: "Browser automation not available in serverless environment",
    instructions: [
      "1. Open your browser manually",
      "2. Navigate to https://pocketoption.com",
      "3. Log in to your account",
      "4. Open browser Developer Tools (F12)",
      "5. Go to Console tab",
      "6. Type: allow pasting (then press Enter)",
      "7. Copy and paste the bridge script below",
      "8. Press Enter to run the script",
      "9. Go to the trading page or refresh if already there"
    ],
    bridgeScript: `
// Pocket Option Bridge Script - Paste this in browser console
(function() {
  console.log('🚀 Pocket Option Bridge Starting...');
  
  // Check if we're on the right site
  if (!window.location.href.includes('pocketoption.com')) {
    console.log('⚠️ Please run this script on pocketoption.com');
    return;
  }
  
  let connected = false;
  const appUrl = '${process.env.VERCEL_URL || window.location.origin}';
  
  // Function to forward WebSocket messages
  function forwardMessage(data, wsUrl) {
    fetch(appUrl + '/api/bridge/ws-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'ws_message',
        data: data,
        timestamp: Date.now(),
        url: wsUrl
      })
    }).then(() => {
      if (!connected) {
        connected = true;
        console.log('🔗 Successfully connected to your trading app!');
      }
    }).catch(err => {
      console.error('❌ Failed to send data to app:', err);
    });
  }
  
  // Check for existing WebSocket connections
  function findExistingConnections() {
    console.log('🔍 Looking for existing WebSocket connections...');
    
    // Try to find existing WebSocket connections in global scope
    for (let prop in window) {
      try {
        if (window[prop] && window[prop].constructor && 
            window[prop].constructor.name === 'WebSocket' &&
            (window[prop].url.includes('po.market') || window[prop].url.includes('pocketoption'))) {
          console.log('📡 Found existing WebSocket:', window[prop].url);
          
          // Hook into existing WebSocket
          const originalOnMessage = window[prop].onmessage;
          window[prop].onmessage = function(event) {
            forwardMessage(event.data, window[prop].url);
            if (originalOnMessage) originalOnMessage.call(this, event);
          };
          
          // Also listen for new messages
          window[prop].addEventListener('message', function(event) {
            forwardMessage(event.data, window[prop].url);
          });
          
          console.log('✅ Hooked into existing connection!');
          return true;
        }
      } catch (e) {}
    }
    return false;
  }
  
  // Intercept new WebSocket connections
  const originalWebSocket = window.WebSocket;
  window.WebSocket = function(url, protocols) {
    const ws = new originalWebSocket(url, protocols);
    
    if (url.includes('po.market') || url.includes('pocketoption')) {
      console.log('📡 New WebSocket connection:', url);
      
      ws.addEventListener('message', function(event) {
        forwardMessage(event.data, url);
      });
      
      ws.addEventListener('open', function() {
        console.log('🔓 WebSocket opened:', url);
      });
      
      ws.addEventListener('close', function() {
        console.log('🔒 WebSocket closed:', url);
        connected = false;
      });
    }
    
    return ws;
  };
  
  // Copy properties from original WebSocket
  Object.setPrototypeOf(window.WebSocket, originalWebSocket);
  Object.defineProperty(window.WebSocket, 'prototype', {
    value: originalWebSocket.prototype,
    writable: false
  });
  
  // Try to find existing connections first
  const foundExisting = findExistingConnections();
  
  if (!foundExisting) {
    console.log('💡 No existing connections found. The bridge will activate when you navigate to trading pages or refresh.');
    console.log('📋 Try: Go to the trading interface or refresh the page.');
  }
  
  console.log('✅ Bridge script installed! Monitoring for WebSocket connections...');
  
  // Test connection to app
  fetch(appUrl + '/api/bridge/status')
    .then(r => r.json())
    .then(data => console.log('🏠 App connection test:', data.status || 'connected'))
    .catch(() => console.log('⚠️ Could not reach your app at:', appUrl));
})();
`,
    shortScript: `(function(){const o=WebSocket;WebSocket=function(u,p){const w=new o(u,p);if(u.includes('po.market')||u.includes('pocketoption')){console.log('📡 Connected:',u);w.addEventListener('message',e=>{fetch('/api/bridge/ws-stream',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'ws_message',data:e.data,timestamp:Date.now()})}).catch(console.error);});}return w;};console.log('✅ Bridge installed!');})();`,
    status: 'manual_setup_required'
  };
  
  return NextResponse.json(instructions);
}
