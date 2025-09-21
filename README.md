# AwareTexas

## Inspiration

With complex legislation affecting every aspect of Texans' daily lives, many citizens struggle to stay informed about what's happening in their state government. We believe that civic engagement requires accessible information, and we seek to use open-source government data to provide everyday Texans with transparent access to legislative activities and current affairs in our state. By making legislative information more digestible and searchable, we aim to strengthen democratic participation and help citizens make informed decisions about the issues that matter most to them.

## What it does

The AwareTexas bridges the knowledge gap by providing easy access to comprehensive legislative information from the Texas Legislature. Our platform empowers citizens to stay informed about state legislation through real-time bill tracking, intelligent search capabilities, and AI-powered summaries. Users can search for bills by topic, sponsor, or keywords, view detailed legislative histories including all bill stages from filing to enactment, and access content tailored to different reading levels to ensure legislative information is accessible to all Texans regardless of educational background.

## How we built it

We built this application with a robust tech stack centered around Node.js, Firebase Firestore, and Google's Gemini AI. Our sophisticated web scraper leverages Axios and Cheerio to extract comprehensive bill data from the Texas Legislature Online website, intelligently navigating multiple page types including History.aspx and BillStages.aspx to capture complete legislative workflows. The scraper systematically processes all 7+ stages of the bill lifecycle.

The backend Node.js server integrates seamlessly with Firebase Firestore for data persistence and Google's Gemini AI API for intelligent content processing, exposing RESTful endpoints that support complex filtering and real-time search. Our frontend is built with modern vanilla JavaScript, HTML5, and Tailwind CSS, implementing sophisticated state management for real-time filtering, pagination, and search functionality while maintaining smooth performance across all devices.

Advanced caching strategies operate at multiple levels - from in-memory bill summaries to persistent storage of AI-generated content - dramatically reducing API calls and improving response times for the 50+ bills tracked simultaneously.

## Challenges we ran into

Initially, we attempted to scrape all bill data using a single approach, but quickly discovered that the Texas Legislature website uses multiple different page structures and formats for different types of information. Bills have complex multi-stage workflows that required parsing data from separate History.aspx and BillStages.aspx pages to get complete status information. 

We also faced challenges with rate limiting and data consistency when scraping large volumes of legislative data. To solve this, we implemented intelligent retry mechanisms, respectful scraping delays, and robust error handling that gracefully falls back to cached data or official links when scraping services are temporarily unavailable.

Another significant challenge was making complex legislative language accessible to citizens with varying literacy levels. We solved this by integrating Google's Gemini AI to provide intelligent bill summarization at multiple complexity levels, allowing users to choose between high-level overviews and detailed analyses.

## Accomplishments that we're proud of

We are proud that we have used open-source technology and public government data to empower Texans with transparency and knowledge of what's happening in their state government. We successfully built a comprehensive bill tracking system that captures the complete legislative lifecycle, from initial filing through final enactment, giving citizens unprecedented visibility into the legislative process.

Our technical achievement of implementing multi-level caching, intelligent web scraping, and AI-powered content generation creates a seamless user experience that makes complex legislative information accessible to all citizens. We're particularly proud of our accessibility features, including semantic HTML, keyboard navigation, and AI-based reading-level adjustments that ensure legislative information is available to Texans regardless of their technical expertise or educational background.

## What we learned

During the development of this project, we learned the intricacies of government data structures and the challenges of making public information truly accessible to citizens. We gained deep expertise in web scraping techniques for complex, multi-page government websites and learned how to implement robust error handling and fallback mechanisms for reliable civic technology.

We discovered the power of AI in democratizing access to complex information, learning how to leverage Google's Gemini API to transform dense legislative language into clear, actionable summaries. Most importantly, we learned the value of open government data and technology in strengthening democratic participation and civic engagement.

## What's next for AwareTexas

For future development, we plan to expand beyond the Texas Senate to include House bills, providing complete coverage of Texas legislative activity. We aim to add real-time notifications for bill status changes, allowing citizens to follow specific legislation that matters to them.

Additionally, we plan to expand Aware Texas to cover local-level ordinances and municipal elections, because impact often begins at the city and county level. We also aim to build features for personalized bill tracking, so users can follow issues they care most about, receive notifications when bills move through committees, and compare how their representatives vote. Beyond Texas, our architecture is designed to scale—other states face the same challenges, and we envision Aware Texas becoming Aware America, a nationwide platform for accessible, AI-powered legislative transparency.

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

## Technologies

- **Backend**: Node.js, Express.js
- **Frontend**: HTML/CSS/JavaScript, Tailwind CSS
- **Database**: Firebase Firestore
- **AI**: Google Gemini API
- **News**: News API
- **Scraping**: Axios, Cheerio

## License

MIT