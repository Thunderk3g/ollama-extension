# Customizing Ollama Bridge Extension

This guide explains how to customize the Ollama Bridge extension for your own projects, websites, or devices.

## Configuring for Different Websites

By default, the extension is configured to work with specific websites. To make it work with your own website:

### 1. Modify the `manifest.json` file

Update the `content_scripts` and `host_permissions` sections to include your website:

```json
"content_scripts": [
  {
    "matches": [
      "https://your-website.com/*",
      "http://localhost:3000/*"  // For local development
    ],
    "js": ["content.js"]
  }
],
"host_permissions": [
  "http://localhost:11434/*",    // Ollama API
  "http://127.0.0.1:11434/*",    // Alternative localhost
  "https://your-website.com/*",  // Your production site
  "http://localhost:3000/*"      // Your development site
]
```

### 2. Test Your Configuration

1. Make the changes above
2. Reload the extension in Chrome's extensions page
3. Visit your website
4. Open the console and run `window.debugOllamaStatus()`
5. Verify that the extension is detected

## Advanced Customization

### Customizing the Ollama API Endpoint

If you're running Ollama on a different port or host:

1. Open the extension popup by clicking its icon
2. Change the Ollama URL in the settings
3. Click "Save" to apply changes

Alternatively, modify the default URL in `background.js`:

```javascript
// Find this line near the top of background.js
const OLLAMA_BASE_URL = 'http://localhost:11434';
// Change it to your custom URL
```

### Adding Support for Different API Patterns

If your website uses a different API pattern to communicate with Ollama:

1. Open `content.js`
2. Modify the `OLLAMA_API_PATH` constant:

```javascript
// Default is '/api/'
const OLLAMA_API_PATH = '/your-custom-path/';
```

3. If needed, update the URL checking logic in the fetch interception code

### Building for Different Browsers

#### Firefox

Firefox requires slightly different settings:

1. In `manifest.json`, add:
   ```json
   "browser_specific_settings": {
     "gecko": {
       "id": "ollama-bridge@your-domain.com",
       "strict_min_version": "101.0"
     }
   }
   ```

2. Test using `about:debugging#/runtime/this-firefox`

#### Other Chromium-based browsers (Edge, Brave, etc.)

The extension should work as-is with other Chromium browsers.

## Creating a Production Build

For a production-ready build:

1. Create proper icons (16px, 48px, 128px) in the `icons/` folder
2. Update the extension name and description in `manifest.json`
3. Create a zip file with all necessary files:
   ```
   manifest.json
   background.js
   content.js
   bridge-interface.js
   popup/ (folder)
   icons/ (folder)
   ```

4. Follow browser-specific submission guidelines to publish

## Setting Up for Development

### Prerequisites

- Chrome or Firefox browser
- Basic knowledge of JavaScript
- Ollama installed and running on your machine

### Development Workflow

1. Clone the repository:
   ```bash
   git clone https://github.com/Thunderk3g/ollama-extension.git
   cd ollama-extension
   ```

2. Make your code changes

3. Test your changes:
   - Load the unpacked extension in Chrome
   - Visit your website
   - Check the console for errors
   - Use `window.debugOllamaStatus()` to verify

4. Debugging:
   - Use Chrome's Developer Tools
   - Go to the Extensions tab
   - Click "Inspect views: background page"
   - Check for errors in the console

## Common Customizations

### Add Authorization Support

To add authorization to Ollama API calls:

1. Modify `background.js` to include headers:
   ```javascript
   // In the handleOllamaRequest function
   const options = {
     method: method || 'GET',
     headers: {
       'Content-Type': 'application/json',
       'Authorization': 'Bearer YOUR_API_KEY' // Add your auth header
     }
   };
   ```

### Whitelist Specific Models

To restrict which models can be used:

1. Modify `background.js` to filter allowed models:
   ```javascript
   // In the handleOllamaRequest function
   if (endpoint.includes('/api/chat') && data) {
     // Check if the requested model is allowed
     const allowedModels = ['llama2', 'mistral', 'codellama'];
     if (data.model && !allowedModels.includes(data.model)) {
       throw new Error('Model not allowed');
     }
   }
   ```

### Add Usage Analytics

To track extension usage (locally):

1. Add to `background.js`:
   ```javascript
   // Track API usage
   function logApiUsage(endpoint, model) {
     const now = new Date();
     const usage = {
       timestamp: now.toISOString(),
       endpoint: endpoint,
       model: model
     };
     
     chrome.storage.local.get('apiUsage', (result) => {
       const usageLog = result.apiUsage || [];
       usageLog.push(usage);
       chrome.storage.local.set({ apiUsage: usageLog });
     });
   }
   
   // Call this in the handleOllamaRequest function
   ```

## Troubleshooting

### Extension Not Detected

1. Verify your website matches the patterns in `manifest.json`
2. Check if content scripts are running (look for console logs)
3. Ensure there are no Content Security Policy restrictions

### Ollama Connection Issues

1. Verify Ollama is running (`http://localhost:11434`)
2. Check network requests in DevTools
3. Look for CORS or mixed content errors

### Script Injection Problems

If the bridge doesn't load properly:

1. Update the injection method in `content.js`
2. Consider using a web_accessible_resources approach instead 