# Console Paste Issue - How to Fix "Unable to Paste"

## The Problem
When you try to paste into the browser console, you might see:
- "Pasting is disabled"
- Nothing happens when you press Ctrl+V
- Console blocks the paste operation

## The Solution

### Step 1: Enable Pasting First
Before pasting the bridge script, you need to type this magic phrase:

```
allow pasting
```

**Instructions:**
1. Click in the console where you see the `>` prompt
2. Type exactly: `allow pasting`
3. Press **Enter**
4. Now you can paste normally with Ctrl+V

### Step 2: Alternative Methods

If "allow pasting" doesn't work, try these:

#### Method A: Type the Permission
Some browsers require:
```
allow pasting
```
or
```
Allow pasting
```
(with capital A)

#### Method B: Use the Menu
1. Right-click in the console
2. Look for "Allow pasting" or similar option
3. Click it

#### Method C: Browser Settings
**Chrome/Edge:**
1. Look for a warning about pasting
2. Click "Allow" or "Enable pasting"

**Firefox:**
1. Type `allow pasting` in console
2. Or go to Settings → Privacy & Security → Enable console pasting

#### Method D: Manual Typing (Last Resort)
If nothing works, you can type the script manually:

**Short Version of Bridge Script:**
```javascript
(function(){
  const o=WebSocket;
  WebSocket=function(u,p){
    const w=new o(u,p);
    if(u.includes('po.market')||u.includes('pocketoption')){
      console.log('📡 Connected:',u);
      w.addEventListener('message',e=>{
        fetch('/api/bridge/ws-stream',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({type:'ws_message',data:e.data,timestamp:Date.now()})
        }).catch(console.error);
      });
    }
    return w;
  };
  console.log('✅ Bridge installed!');
})();
```

## Browser-Specific Solutions

### Chrome/Edge
1. Look for yellow warning bar at top
2. Click "Allow" or type `allow pasting`

### Firefox  
1. Type: `allow pasting`
2. Press Enter
3. Now paste normally

### Safari
1. Usually allows pasting without restrictions
2. If blocked, try typing `allow pasting`

## Why This Happens
Browsers block console pasting to prevent:
- Malicious script execution
- Social engineering attacks
- Accidental harmful code execution

The "allow pasting" command proves you understand what you're doing.

## Verification
After typing "allow pasting" you should see:
- Cursor still blinking in console
- Ability to paste with Ctrl+V
- No more paste restrictions

## Success Indicators
Once the bridge script runs successfully:
```
🚀 Pocket Option Bridge Starting...
📡 Connected to Pocket Option WebSocket: wss://...
✅ Bridge script installed! WebSocket messages will be forwarded.
```

## Quick Troubleshooting
- ❌ **Can't paste**: Type `allow pasting` first
- ❌ **Still can't paste**: Try right-click → Allow pasting
- ❌ **Nothing works**: Use the short manual script above
- ✅ **Script pasted**: Press Enter to execute
- ✅ **Success**: You'll see the success messages
