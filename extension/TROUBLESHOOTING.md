# Troubleshooting Extension Loading

## Issue: Extension doesn't show up or popup is blank

### Solution 1: Make sure dev server is running
The extension in dev mode needs the dev server running on port 3000.

1. **Keep `npm run dev` running** in a terminal
2. Then load the extension from `.output/chrome-mv3-dev`

### Solution 2: Build for production (no dev server needed)
If you want to test without the dev server:

```bash
cd extension
npm run build
```

Then load from: `.output/chrome-mv3` (no `-dev` suffix)

### Solution 3: Check Chrome console
1. Right-click the extension icon → "Inspect popup"
2. Check the Console tab for errors
3. Common issues:
   - "Failed to load resource" → Dev server not running
   - CORS errors → Check manifest permissions
   - Module errors → Rebuild the extension

### Solution 4: Reload the extension
After making changes:
1. Go to `chrome://extensions/`
2. Click the reload button (🔄) on your extension
3. Click the extension icon again

### Still not working?
- Check that you're loading from `.output/chrome-mv3-dev` (not `chrome-mv3`)
- Make sure Developer mode is enabled
- Try a production build: `npm run build` and load from `.output/chrome-mv3`

