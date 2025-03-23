# Ollama Bridge Extension

A browser extension that creates a secure bridge between websites (particularly your portfolio site) and your local Ollama LLM instance.

## Problem Solved

Modern browsers block "mixed content" - they prevent secure HTTPS websites from making insecure HTTP requests. This creates a problem when you want to interact with locally running AI models through Ollama (which runs on http://localhost:11434).

This extension solves this problem by:
1. Intercepting API calls from your website to Ollama
2. Routing them through the extension (which has permission to access localhost)
3. Returning the responses back to your website

## Features

- 🔒 Securely connects HTTPS websites to your local Ollama API
- 🔄 Intercepts API calls and handles CORS issues automatically
- 🚀 Provides a simple JavaScript API for websites to detect and use the extension
- 🧩 Uses a secure DOM-based messaging system that complies with Chrome's Content Security Policy
- 💻 Works with both production and local development environments

## Installation (For Development)

1. Clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory
5. The extension icon should appear in your toolbar

## How It Works

The extension uses a secure DOM-based messaging system to enable communication between websites and your local Ollama instance:

1. **Content Script:** Injects a communication bridge into the web page
2. **Bridge Interface:** Provides an API for the website to make requests
3. **Background Script:** Handles the actual communication with the Ollama API
4. **Popup UI:** Allows users to enable/disable the extension and configure settings

This architecture bypasses Mixed Content restrictions while maintaining security.

## Using with Your Website

Add this code to detect and use the extension:

```javascript
// Check if Ollama Bridge is available
if (window.OllamaBridge) {
  console.log('Ollama Bridge extension detected!');
  
  // Make requests to Ollama
  fetch('/api/chat', {
    method: 'POST',
    body: JSON.stringify({
      model: 'llama2',
      messages: [{ role: 'user', content: 'Hello, how are you?' }]
    })
  })
  .then(response => response.json())
  .then(data => console.log('Ollama response:', data))
  .catch(error => console.error('Error:', error));
} else {
  console.log('Ollama Bridge extension not detected. Please install it to use Ollama models.');
}
```

## Testing the Extension

To test if the extension is working:

1. Install the extension in Chrome
2. Open your portfolio website
3. Open the browser console
4. Run `window.debugOllamaStatus()` - this should show connection status
5. Make a test API call to Ollama

## Code Structure

- `manifest.json` - Extension configuration
- `background.js` - Handles communication with Ollama API
- `content.js` - Injects the bridge into web pages
- `bridge-interface.js` - Provides the JavaScript API
- `popup/` - Contains the extension popup UI
- `icons/` - Extension icons

## Customizing for Your Projects

Need to adapt this extension for your own website or project? Check out the [CUSTOMIZATION.md](./CUSTOMIZATION.md) guide, which includes:

- How to configure for different websites
- Adding support for custom API patterns
- Building for different browsers
- Setting up for local development
- Common customizations and troubleshooting

## Security Considerations

This extension only forwards requests to a specific localhost port (11434) where Ollama runs. It does not access any other local resources or send data to third-party servers. All data remains on your local machine.

## License

MIT License

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. 