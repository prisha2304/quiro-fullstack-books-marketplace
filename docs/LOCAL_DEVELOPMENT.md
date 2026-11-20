# BookNest Marketplace — Local Development Guide

## Quick Start
```bash
# 1. Install dependencies
cd server && npm install
cd ../client && npm install

# 2. Start MySQL and Redis with Docker Compose
docker compose -f docker-compose.dev.yml up -d

# 3. Run database migrations
cd server
node migrate.js

# 4. Start Server
npm run dev # on port 5000

# 5. Start Client
cd ../client
npm run dev # on port 5173
```
