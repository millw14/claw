# ClawCrypt

AI-powered Solana wallet intelligence. Discover, track, and understand crypto wallets using plain English.

## Features

- **Natural Language Search** - "Track this wallet", "Find wallets holding over 2M $TOKEN"
- **Wallet Discovery** - Find wallets by partial address, ENS/SNS names, or token holdings
- **Wallet Profiles** - Auto-generated profiles with balances, activity, and PnL
- **Behavior Classification** - Whale, Sniper, Farmer, Diamond Hands, etc.
- **AI-Powered Analysis** - Groq LLM explains wallet behavior in plain English
- **Real-time Data** - Helius API for accurate Solana blockchain data

## Setup

```bash
# Install dependencies
npm install

# Create .env file with your API keys
cp .env.example .env

# Add your keys to .env:
# VITE_GROQ_API_KEY=your_groq_key
# VITE_HELIUS_API_KEY=your_helius_key

# Run development server
npm run dev

# Build for production
npm run build
```

## Project Structure

```
clawcrypt/
├── assets/              # Images and static assets
├── pages/
│   ├── chat.html        # AI Chat interface
│   ├── docs.html        # Documentation
│   └── features.html    # Features page
├── src/
│   ├── css/
│   │   ├── main.css     # Global styles
│   │   ├── loading.css  # Loading screen
│   │   ├── home.css     # Home page
│   │   ├── chat.css     # Chat interface
│   │   └── pages.css    # Docs/Features pages
│   └── js/
│       ├── app.js       # Main entry point
│       ├── matrix.js    # Matrix rain effect
│       ├── loading.js   # Loading screen
│       ├── home.js      # Home page
│       ├── chat.js      # Chat controller
│       └── services/
│           ├── groq.js    # Groq AI integration
│           └── helius.js  # Helius API integration
├── index.html
├── package.json
├── vite.config.js
└── .env
```

## Tech Stack

- **Vite** - Build tool & dev server
- **Vanilla JavaScript** - ES Modules, no framework
- **Groq API** - LLM for natural language processing
- **Helius API** - Solana blockchain data
- **@solana/web3.js** - Solana SDK (for future features)

## API Keys Required

1. **Groq API** - Get from [console.groq.com](https://console.groq.com)
2. **Helius API** - Get from [helius.dev](https://helius.dev)

## License

MIT
