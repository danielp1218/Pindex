# How to Load the Extension

## One-Time Setup

1. **Build it:**
   ```bash
   cd extension
   npm run dev
   ```

2. **Load in Chrome:**
   - Go to `chrome://extensions/`
   - Turn on **Developer mode** (top right)
   - Click **"Load unpacked"**
   - Select this folder: `extension/.output/chrome-mv3-dev`
   - Done! ✅

## Why `.output/chrome-mv3-dev`?

- WXT (the build tool) automatically puts the built extension there (in dev mode it's `chrome-mv3-dev`)
- Chrome can't read TypeScript/React source files - it needs compiled JavaScript
- This is the **normal** way - all WXT extensions work like this
- The `.output` folder is created automatically when you run `npm run dev`

## After Making Changes

1. Make your code changes
2. The extension auto-rebuilds (if `npm run dev` is running)
3. Go to `chrome://extensions/`
4. Click the **reload button** (🔄) on your extension
5. Test again!

That's it! 🎉

