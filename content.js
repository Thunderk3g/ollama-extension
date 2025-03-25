// Constants
const OLLAMA_API_PATH = '/api/';
const OLLAMA_HOST_PATTERNS = [
  'localhost:11434',
  '127.0.0.1:11434'
];
// Add known custom endpoints
const CUSTOM_API_ENDPOINTS = [
  '/api/resume',
  '/api/chat',
  '/api/tags',
  '/api/generate'
];
const EXTENSION_VERSION = '1.0.0';

// Notify the page that the extension is installed
document.dispatchEvent(new CustomEvent('ollama-bridge-loaded', { detail: { version: EXTENSION_VERSION } }));

// Create a custom element for communication between page and extension
const bridgeElement = document.createElement('div');
bridgeElement.id = 'ollama-bridge-element';
bridgeElement.style.display = 'none';
document.documentElement.appendChild(bridgeElement);

// Set up communication with the page
bridgeElement.addEventListener('ollama-request', (event) => {
  // Get the request data
  const { url, options, requestId } = event.detail;
  
  // Extract the API endpoint path
  let endpoint = '';
  let parsedUrl;
  
  try {
    // Check if this is a custom endpoint we know about
    if (CUSTOM_API_ENDPOINTS.some(ep => url === ep || url.startsWith(ep))) {
      endpoint = url;
      console.log(`Ollama Bridge: Recognized custom endpoint: ${endpoint}`);
    } else {
      // Try to parse as a full URL
      try {
        parsedUrl = new URL(url);
        // For full URLs like http://localhost:11434/api/...
        if (OLLAMA_HOST_PATTERNS.some(host => parsedUrl.host === host)) {
          endpoint = parsedUrl.pathname + parsedUrl.search;
          console.log(`Ollama Bridge: Extracted endpoint from URL: ${endpoint}`);
        } 
      } catch (e) {
        // Not a full URL, check if it's a relative API path
        if (url.startsWith(OLLAMA_API_PATH)) {
          // For relative URLs like /api/...
          endpoint = url;
          console.log(`Ollama Bridge: Using relative API path: ${endpoint}`);
        }
      }
    }
  } catch (e) {
    console.warn('Ollama Bridge: Could not parse URL', url, e);
    bridgeElement.dispatchEvent(new CustomEvent('ollama-response', {
      detail: {
        success: false,
        error: `Invalid URL: ${url} - ${e.message}`,
        requestId
      }
    }));
    return;
  }
  
  if (!endpoint) {
    console.warn('Ollama Bridge: Could not parse endpoint from URL', url);
    bridgeElement.dispatchEvent(new CustomEvent('ollama-response', {
      detail: {
        success: false,
        error: 'Could not extract API endpoint from URL: ' + url,
        requestId
      }
    }));
    return;
  }
  
  // Prepare request data
  let method = options?.method; // Keep the original method
  const getEndpoints = ['/api/tags', '/api/ps', '/api/version'];
  
  // If no method specified, determine based on endpoint
  if (!method) {
    method = getEndpoints.includes(endpoint) ? 'GET' : 'POST';
    console.log(`Ollama Bridge: Defaulting to ${method} method for ${endpoint}`);
  }
  
  let data = null;
  
  if (options?.body) {
    try {
      data = typeof options.body === 'string' 
        ? JSON.parse(options.body) 
        : options.body;
      
      console.log(`Ollama Bridge: Parsed request body for ${endpoint}:`, data);
    } catch (e) {
      console.warn('Ollama Bridge: Failed to parse request body', e);
      bridgeElement.dispatchEvent(new CustomEvent('ollama-response', {
        detail: {
          success: false,
          error: `Failed to parse request body: ${e.message}`,
          requestId
        }
      }));
      return;
    }
  }
  
  // Forward to background script
  console.log(`Ollama Bridge: Forwarding ${method} request to ${endpoint}`);
  chrome.runtime.sendMessage({
    type: 'OLLAMA_API_REQUEST',
    endpoint,
    method,
    data,
    requestId
  }, response => {
    // Handle potential error
    if (chrome.runtime.lastError) {
      console.warn('Ollama Bridge: Runtime error:', chrome.runtime.lastError.message);
      bridgeElement.dispatchEvent(new CustomEvent('ollama-response', {
        detail: {
          success: false,
          error: chrome.runtime.lastError.message,
          requestId
        }
      }));
      return;
    }
    
    // Send the response back to the page
    console.log(`Ollama Bridge: Received response for ${endpoint}`, response);
    bridgeElement.dispatchEvent(new CustomEvent('ollama-response', {
      detail: {
        success: response.success,
        data: response.data,
        error: response.error,
        requestId
      }
    }));
  });
});

// Listen for status requests from the injected script
bridgeElement.addEventListener('ollama-status-request', (event) => {
  const { requestId } = event.detail;
  
  chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (response) => {
    // Handle potential error
    if (chrome.runtime.lastError) {
      console.warn('Ollama Bridge: Failed to get settings:', chrome.runtime.lastError.message);
      bridgeElement.dispatchEvent(new CustomEvent('ollama-status-response', { 
        detail: {
          isEnabled: false,
          ollamaUrl: '',
          error: chrome.runtime.lastError.message,
          requestId
        }
      }));
      return;
    }
    
    bridgeElement.dispatchEvent(new CustomEvent('ollama-status-response', { 
      detail: {
        isEnabled: response?.isEnabled ?? false,
        ollamaUrl: response?.ollamaUrl ?? '',
        requestId
      }
    }));
  });
});

// Notify the page when settings change
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    const settingsChange = {};
    
    if (changes.ollamaUrl) {
      settingsChange.ollamaUrl = changes.ollamaUrl.newValue;
    }
    
    if (changes.isEnabled) {
      settingsChange.isEnabled = changes.isEnabled.newValue;
    }
    
    if (Object.keys(settingsChange).length > 0) {
      document.dispatchEvent(new CustomEvent('ollama-bridge-settings-changed', { 
        detail: settingsChange 
      }));
    }
  }
});

// Listen for messages from the injected script
window.addEventListener('message', function(event) {
  // Check origin to ensure it's from our page
  if (event.source !== window) return;
  
  // Check if the message is for our extension
  if (event.data.type && event.data.type === 'OLLAMA_API_REQUEST') {
    // Forward the request to the background script
    chrome.runtime.sendMessage(event.data, function(response) {
      // Send the response back to the page
      window.postMessage({
        type: 'OLLAMA_API_RESPONSE',
        requestId: event.data.requestId,
        success: response?.success || false,
        data: response?.data || null,
        error: response?.error || null
      }, '*');
    });
  } else if (event.data.type && event.data.type === 'OLLAMA_STREAMING_REQUEST') {
    // For streaming requests, we need to set up a port connection
    setupStreamingConnection(event.data);
  }
});

// Function to set up a streaming connection
function setupStreamingConnection(requestData) {
  // Connect to the background script
  const port = chrome.runtime.connect({ name: 'ollama-stream' });
  
  // Listen for messages from the background script
  port.onMessage.addListener(function(message) {
    if (message.type === 'stream-chunk') {
      // Forward the chunk to the page
      window.postMessage({
        type: 'OLLAMA_STREAM_CHUNK',
        requestId: requestData.requestId,
        data: message.data
      }, '*');
    } else if (message.type === 'stream-end') {
      // Signal stream completion
      window.postMessage({
        type: 'OLLAMA_STREAM_END',
        requestId: requestData.requestId
      }, '*');
      
      // Close the port
      port.disconnect();
    } else if (message.type === 'stream-error') {
      // Signal stream error
      window.postMessage({
        type: 'OLLAMA_STREAM_ERROR',
        requestId: requestData.requestId,
        error: message.error
      }, '*');
      
      // Close the port
      port.disconnect();
    }
  });
  
  // Forward the request to the background script
  chrome.runtime.sendMessage(requestData);
  
  // Handle port disconnection
  port.onDisconnect.addListener(function() {
    console.log('Ollama Bridge: Stream connection closed');
  });
}

// Inject our bridge interface script into the page
function injectScript() {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('bridge-interface.js');
  script.onload = function() {
    // Script has been injected and loaded
    this.remove();
  };
  (document.head || document.documentElement).appendChild(script);
}

// Inject the script when the content script loads
injectScript(); 