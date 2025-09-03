# Bridge Setup Guide for Deployed Environment

## Issue
When your Pocket-APP is deployed to Vercel, the bridge feature that normally opens a browser window automatically doesn't work. This is because Vercel runs in a serverless environment that doesn't support browser automation.

## Solution
We've implemented a manual bridge setup that works perfectly in the deployed environment.

## How to Use the Bridge in Production

### Method 1: Automatic Instructions (Recommended)
1. Open your deployed app: https://your-app.vercel.app
2. You'll see a blue "Manual Bridge Setup Required" box at the top
3. Follow the step-by-step instructions provided
4. Copy the bridge script and paste it in Pocket Option's browser console

### Method 2: Direct API Access
1. Visit: `https://your-app.vercel.app/api/bridge/browser-launch`
2. This will show you the JSON instructions and script
3. Follow the instructions manually

## Step-by-Step Manual Setup

1. **Open Pocket Option**
   - Go to https://pocketoption.com
   - Log in to your account

2. **Open Developer Tools**
   - Press F12 (or right-click → Inspect)
   - Go to the "Console" tab

3. **Paste the Bridge Script**
   - Copy the script from the setup component
   - Paste it in the console
   - Press Enter

4. **Verify Connection**
   - You should see "✅ Bridge script installed!" message
   - Your app will start receiving WebSocket data

## What the Script Does

The bridge script:
- Intercepts WebSocket connections to Pocket Option
- Forwards trading data to your Vercel app
- Maintains real-time connectivity
- Enables all trading features

## Local Development

When running locally (`npm run dev`), the automatic browser launch will work normally. This manual setup is only needed for the deployed version.

## Troubleshooting

### If the script doesn't work:
1. Make sure you're logged into Pocket Option
2. Refresh the page and try again
3. Check browser console for any errors
4. Ensure your app URL is correct in the script

### If data isn't flowing:
1. Check that WebSocket connections are active in Network tab
2. Verify the script is still running (no page refresh)
3. Ensure Pocket Option has active trading data

## Technical Details

- **Local Environment**: Uses Playwright for automated browser control
- **Production Environment**: Uses manual JavaScript injection
- **Data Flow**: WebSocket → Browser Script → Your App → Trading Analysis
- **Security**: All connections are secure and user-controlled

## Benefits of Manual Setup

✅ **Works in any deployment environment**  
✅ **No server resources needed**  
✅ **Full user control over data**  
✅ **Same functionality as automated version**  
✅ **Works with any browser**  

The manual setup provides the same powerful trading analysis capabilities as the automated version, just with a one-time setup step.
