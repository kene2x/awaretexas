# Texas Senate Bill Tracker

A web application that provides citizens with an accessible way to track current Texas Senate bills through automated scraping, AI-powered summaries, and a polished user interface.

## Features

- **Bill Tracking**: View all current Texas Senate bills in a responsive grid layout
- **Smart Search**: Filter bills by keywords, topics, and sponsors with live updates
- **AI Summaries**: Plain-language summaries of complex legislation using Gemini AI
- **News Integration**: Related news articles for each bill
- **Texas Theme**: Clean interface with Texas flag color scheme (red, white, blue)

## Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Configuration**
   - Copy `.env.example` to `.env`
   - Fill in your Firebase, Gemini API, and News API credentials

3. **Build CSS**
   ```bash
   npm run build:css
   ```

4. **Start Development Server**
   ```bash
   npm run dev
   ```

## Project Structure

```
├── backend/           # Express.js server and API routes
├── frontend/          # HTML, CSS, and JavaScript frontend
├── services/          # External API integrations (scraper, AI, news)
├── models/           # Data models and validation
├── config/           # Configuration files (Firebase, etc.)
└── tests/            # Test files
```

## API Endpoints

- `GET /api/bills` - Retrieve all bills with optional filters
- `GET /api/bills/:id` - Get specific bill details
- `POST /api/summary/:billId` - Generate AI summary
- `GET /api/news/:billId` - Get related news articles
- `GET /api/health` - Health check

## Technologies

- **Backend**: Node.js, Express.js
- **Frontend**: HTML/CSS/JavaScript, Tailwind CSS
- **Database**: Firebase Firestore
- **AI**: Google Gemini API
- **News**: News API
- **Scraping**: Axios, Cheerio

## License

MIT