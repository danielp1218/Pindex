# Testing the PolyIndex Chrome Extension

## Quick Start

1. **Build the extension:**
   ```bash
   cd extension
   npm run dev
   ```
   This builds the extension (WXT automatically creates `.output/chrome-mv3` - this is normal!)

2. **Load in Chrome:**
   - Open Chrome and go to `chrome://extensions/`
   - Enable **Developer mode** (toggle in top right)
   - Click **Load unpacked**
   - Navigate to: `extension/.output/chrome-mv3`
   - Click "Select"
   
   **Note:** `.output/chrome-mv3` is where WXT builds your extension - this is the standard location. Chrome needs the compiled/built files, not the source code.

3. **Test on Polymarket:**
   - Navigate to any Polymarket event page, e.g.:
     - https://polymarket.com/event/khamenei-out-as-supreme-leader-of-iran-by-january-31
   - The PolyIndex overlay should slide in from the top-right corner

## Features

- ✅ **Auto-detects event pages** - Only appears on `/event/*` URLs
- ✅ **Slides in from top-right** - Smooth animation
- ✅ **Fetches event data** - Tries to get data from Polymarket API
- ✅ **Watches for Yes/No clicks** - Detects user interactions
- ✅ **Minimize button** - Collapse/expand the overlay
- ✅ **SPA navigation support** - Handles React Router navigation

## Development

- **Watch mode:** `npm run dev` (auto-rebuilds on changes)
- **Build for production:** `npm run build`
- **Check for errors:** `npm run compile`

## Troubleshooting

- **Overlay doesn't appear:** Check browser console for errors
- **API calls fail:** Polymarket API may require authentication or have CORS restrictions
- **Buttons not detected:** Polymarket's DOM structure may have changed - update selectors in `content.ts`

## File Structure

```
extension/
├── entrypoints/
│   ├── content.ts              # Main content script
│   ├── components/
│   │   └── PolyIndexOverlay.tsx # React overlay component
│   └── popup/                   # Extension popup (separate)
├── public/
│   └── logo.jpg                 # Extension logo
└── wxt.config.ts                # WXT configuration

