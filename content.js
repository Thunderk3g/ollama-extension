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
  let method = options?.method || 'GET';
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

// Inject a proper script file (not inline)
const scriptTag = document.createElement('script');
scriptTag.src = chrome.runtime.getURL('bridge-interface.js');
scriptTag.onload = function() {
  console.log('Ollama Bridge: Interface script loaded');
  this.remove();
};
(document.head || document.documentElement).appendChild(scriptTag); 