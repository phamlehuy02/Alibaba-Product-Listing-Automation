# Alibaba Coffee Product Listing Bot

A premium, AI-powered automation tool for coffee exporters listing products on Alibaba.com.

## Getting Started

### 1. Installation
Ensure you have Node.js installed, then run:
```bash
npm install
```

### 2. Configuration
You will need your Alibaba Open Platform credentials. In the dashboard, you can input your:
- **App Key**
- **App Secret**
- **Access Token** (OAuth 2.0 session token)

### 3. Running the Dashboard
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to access the dashboard.

## Features

- **AI Content Generation**: Uses Gemini-powered logic to optimize product titles and descriptions for B2B buyers.
- **Coffee-Specific Attributes**: Pre-configured for Roasted Coffee Beans, including roast levels, variety, and origin.
- **Direct API Publishing**: Uses the `alibaba.icbu.product.add` endpoint with secure HMAC-MD5 signing.
- **Photo Bank Integration**: (Ready for implementation) Uploads local photos directly to the Alibaba Photo Bank.

## Project Structure

- `src/app`: Next.js App Router components and styles.
- `src/components`: Reusable UI components like the Product Form.
- `src/lib`: Core logic for AI optimization and Alibaba API communication.
- `scripts`: (Future) CLI tools for batch processing.

---
*Created with ❤️ for elite coffee exporters.*
