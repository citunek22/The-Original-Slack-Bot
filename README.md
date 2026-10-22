Travel Assistant Slack Bot 
A simple, effective Slack bot designed to help travelers and aviation enthusiasts with real-time data.

Features
/theoriginalslack...: Ping the server to ensure the bot is online.

/original-weather [city]: Get the current weather for a specific city.

/above-me [city]: Display planes within a 50 km radius of the location.

/currency [amount] [from] [to]: Convert currencies using real-time exchange rates (e.g., /currency 100 USD CZK).

How to run
Clone this repository.

Create a .env file and add your SLACK_BOT_TOKEN, SLACK_SIGNING_SECRET, and APP_TOKEN.

Install dependencies: npm install.

Start the bot: node index.js.

Tech Stack
Node.js

@slack/bolt framework

Axios for API requests
Also made with the help of Google Gemini
