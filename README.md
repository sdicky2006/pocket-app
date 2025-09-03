# Pocket-APP: Trading Signal Analyzer

A sophisticated web application for analyzing and generating trading signals for currency pairs with real-time Pocket Option integration.

## 🚀 Features

- **Real-time Trading Signals**: Advanced AI-powered analysis with confidence scoring
- **Multiple Currency Pairs**: Support for major forex pairs (EUR/USD, GBP/USD, etc.)
- **Technical Analysis**: EMA, RSI indicators with support/resistance detection
- **Auto-Trading**: Automated trading capabilities with risk management
- **Progressive Web App**: Install on mobile devices for native app experience
- **Responsive Design**: Works perfectly on desktop, tablet, and mobile
- **Real-time Data**: Live quote streaming and bridge integration

## 🔧 Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS 4, Bootstrap 5
- **State Management**: Zustand
- **Charts**: Recharts
- **Icons**: Lucide React
- **Deployment**: Vercel
- **Containerization**: Docker

## 🌐 Live Demo

**Live URL**: [pocket-trading-app.vercel.app](https://pocket-trading-8wuaqe8mn-emporia-medias-projects.vercel.app)

## 📱 Mobile Access

- Works on all mobile browsers (iOS Safari, Android Chrome)
- Can be installed as PWA (Add to Home Screen)
- Responsive design optimized for touch interfaces

## 🛠️ Local Development

1. **Clone the repository**:
   ```bash
   git clone https://github.com/dsnyakundi/pocket-app.git
   cd pocket-app
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your values
   ```

4. **Run the development server**:
   ```bash
   npm run dev
   ```

5. **Open** [http://localhost:3000](http://localhost:3000) in your browser

## 🔐 Environment Variables

Required environment variables:

```env
ENCRYPTION_KEY=your-strong-encryption-key-here
FINNHUB_API_KEY=your-finnhub-api-key (optional)
ALPHAVANTAGE_API_KEY=your-alphavantage-api-key (optional)
```

Generate encryption key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 🚀 Deployment

### Vercel (Recommended)

1. **Install Vercel CLI**:
   ```bash
   npm install -g vercel
   ```

2. **Deploy**:
   ```bash
   vercel
   ```

3. **Set environment variables** in Vercel dashboard

### Docker

1. **Build image**:
   ```bash
   docker build -t pocket-app .
   ```

2. **Run container**:
   ```bash
   docker run -p 3000:3000 -e ENCRYPTION_KEY="your-key" pocket-app
   ```

## 📊 API Endpoints

- `GET /api/pairs` - Get available currency pairs
- `POST /api/signal` - Generate trading signal
- `GET /api/bridge/status` - Check bridge connection status
- `POST /api/auth/login` - Authenticate with Pocket Option
- `GET /api/screener` - Market screener data

## 🎯 Core Components

- **Signal Analysis Engine**: AI-powered technical analysis
- **Currency Pair Selector**: Dynamic pair selection with filters
- **Real-time Bridge**: WebSocket connection to Pocket Option
- **Risk Management**: Built-in position sizing guidelines
- **Auto-Trading**: Automated execution capabilities

## 🔒 Security Features

- Encrypted credential storage
- Rate limiting on all endpoints
- CORS protection
- Secure session management

## 📈 Trading Features

- **Signal Confidence Scoring**: 1-100 confidence levels
- **Multi-timeframe Analysis**: 1m, 3m, 5m, 15m timeframes
- **Risk Guidelines**: Position sizing recommendations
- **Historical Tracking**: Signal performance history
- **Desktop Notifications**: Real-time signal alerts

## 🛡️ Risk Disclaimer

This software is for educational and informational purposes only. Trading involves substantial risk and may not be suitable for all investors. Past performance does not guarantee future results.

## 📄 License

MIT License - see LICENSE file for details

## 👨‍💻 Author

**Daniel Nyakundi**
- Email: dsnyakundi@gmail.com
- GitHub: [@dsnyakundi](https://github.com/dsnyakundi)

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📞 Support

If you encounter any issues or have questions:
1. Check the [Deployment Guide](DEPLOYMENT.md)
2. Open an issue on GitHub
3. Contact: dsnyakundi@gmail.com

---

⭐ **Star this repository if you found it helpful!**