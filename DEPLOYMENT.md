# Pocket-APP Deployment Guide

## Making Your App Accessible From Anywhere

This guide provides multiple deployment options to make your Pocket-APP accessible from anywhere on the internet.

## 🚀 Quick Deployment Options

### Option 1: Vercel (Recommended - Easiest)

1. **Install Vercel CLI:**
   ```bash
   npm i -g vercel
   ```

2. **Deploy from your project directory:**
   ```bash
   cd pocket-app
   vercel
   ```

3. **Set environment variables in Vercel dashboard:**
   - Go to your project settings
   - Add these environment variables:
     - `ENCRYPTION_KEY`: Generate a strong random key
     - `FINNHUB_API_KEY`: (Optional) For market data
     - `ALPHAVANTAGE_API_KEY`: (Optional) Alternative market data

4. **Your app will be live at:** `https://your-app-name.vercel.app`

### Option 2: Docker + VPS/Cloud Server

1. **Build and run locally:**
   ```bash
   cd pocket-app
   docker build -t pocket-app .
   docker run -p 3000:3000 -e ENCRYPTION_KEY="your-key-here" pocket-app
   ```

2. **Deploy to cloud services:**
   - **DigitalOcean App Platform**
   - **AWS Lightsail**
   - **Google Cloud Run**
   - **Azure Container Instances**

### Option 3: Railway (Simple & Free Tier)

1. **Connect your GitHub repo to Railway**
2. **Deploy directly from their dashboard**
3. **Set environment variables in Railway dashboard**

### Option 4: Netlify

1. **Build the app:**
   ```bash
   npm run build
   ```

2. **Deploy to Netlify:**
   - Drag and drop the `.next` folder to Netlify
   - Or connect your GitHub repo

## 🔧 Environment Setup

### Required Environment Variables

Create a `.env.local` file:

```env
# REQUIRED: Strong encryption key for production
ENCRYPTION_KEY=your-very-strong-encryption-key-here

# Optional: Market data API keys
FINNHUB_API_KEY=your-finnhub-key
ALPHAVANTAGE_API_KEY=your-alphavantage-key
```

### Generating a Strong Encryption Key

```javascript
// Run this in Node.js to generate a secure key
const crypto = require('crypto');
console.log(crypto.randomBytes(32).toString('hex'));
```

## 🌐 Domain Setup (Optional)

After deployment, you can:

1. **Buy a custom domain** (e.g., `mytrading.app`)
2. **Point it to your deployment:**
   - Vercel: Add domain in project settings
   - Other platforms: Update DNS A/CNAME records

## 📱 Mobile Access

Once deployed, your app will be accessible on mobile:

- **Direct browser access:** `https://your-domain.com`
- **Add to home screen:** Works as a Progressive Web App
- **Works on iOS/Android** browsers

## 🔒 Security Considerations

1. **Always use HTTPS** (automatic with Vercel/Netlify)
2. **Use strong encryption keys**
3. **Enable rate limiting** (already configured)
4. **Regular security updates**

## 🚦 Testing Your Deployment

1. **Check if it's accessible:**
   ```bash
   curl https://your-domain.com/api/pairs
   ```

2. **Test from mobile device**
3. **Verify all features work**

## 💰 Cost Estimates

- **Vercel:** Free tier (hobby projects)
- **Railway:** $5/month (starter)
- **DigitalOcean:** $12/month (basic droplet)
- **AWS/Google Cloud:** Pay-as-you-go

## 🛠 Maintenance

- **Monitor app performance**
- **Keep dependencies updated**
- **Regular backups if using databases**
- **Monitor error logs**

## 📞 Support

If you need help with deployment:
1. Check the deployment platform's documentation
2. Verify environment variables are set correctly
3. Check the application logs for errors

---

Choose the deployment option that best fits your needs and budget. Vercel is recommended for beginners due to its simplicity and generous free tier.
