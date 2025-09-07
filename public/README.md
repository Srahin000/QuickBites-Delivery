# Quickbites Universal Links Website

This is the landing page for Quickbites universal links, deployed on Vercel.

## Deployment

1. **Connect to Vercel:**
   ```bash
   # Install Vercel CLI
   npm i -g vercel
   
   # Login to Vercel
   vercel login
   
   # Deploy from the public directory
   cd public
   vercel --prod
   ```

2. **Or deploy via GitHub:**
   - Push this repository to GitHub
   - Connect your GitHub repo to Vercel
   - Set the root directory to `public`
   - Deploy

## Verification Files

The following files must be accessible at:
- `https://quickbites-q9h4.vercel.app/.well-known/apple-app-site-association`
- `https://quickbites-q9h4.vercel.app/.well-known/assetlinks.json`

## Testing Universal Links

After deployment, test these URLs:
- `https://quickbites-q9h4.vercel.app/restaurant/123`
- `https://quickbites-q9h4.vercel.app/cart`
- `https://quickbites-q9h4.vercel.app/orders`

## Domain Configuration

Make sure your Vercel domain is set to: `quickbites-q9h4.vercel.app` 