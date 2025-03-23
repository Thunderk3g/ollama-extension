// Constants
const OLLAMA_BASE_URL = 'http://localhost:11434';
const PORTFOLIO_SITE = 'https://portfolio-flame-five.vercel.app';

// Store the Ollama URL (allowing for customization later)
let ollamaUrl = OLLAMA_BASE_URL;

// Initialize extension state
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ 
    ollamaUrl: OLLAMA_BASE_URL,
    isEnabled: true
  });
});

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'OLLAMA_API_REQUEST') {
    // Handle API request forwarding
    handleOllamaRequest(request.endpoint, request.method, request.data)
      .then(response => {
        sendResponse({ success: true, data: response });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true; // Indicates async response
  } else if (request.type === 'UPDATE_SETTINGS') {
    // Update extension settings
    if (request.ollamaUrl) {
      ollamaUrl = request.ollamaUrl;
      chrome.storage.local.set({ ollamaUrl });
    }
    if (request.hasOwnProperty('isEnabled')) {
      chrome.storage.local.set({ isEnabled: request.isEnabled });
    }
    sendResponse({ success: true });
    return true;
  } else if (request.type === 'GET_SETTINGS') {
    // Return current settings
    chrome.storage.local.get(['ollamaUrl', 'isEnabled'], (result) => {
      sendResponse({ 
        ollamaUrl: result.ollamaUrl || OLLAMA_BASE_URL,
        isEnabled: result.isEnabled !== undefined ? result.isEnabled : true
      });
    });
    return true;
  }
});

// Function to handle Ollama API requests
async function handleOllamaRequest(endpoint, method, data) {
  try {
    // Get current settings
    const settings = await chrome.storage.local.get(['ollamaUrl', 'isEnabled']);
    
    // Check if extension is enabled
    if (!settings.isEnabled) {
      throw new Error('Ollama Bridge is disabled');
    }
    
    // Use stored Ollama URL or default
    const baseUrl = settings.ollamaUrl || OLLAMA_BASE_URL;
    
    // Build the full URL
    const url = `${baseUrl}${endpoint}`;
    
    // Configure fetch options
    const options = {
      method: method || 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    // Add body for POST/PUT requests
    if (data && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(data);
    }
    
    // Make the request to Ollama
    const response = await fetch(url, options);
    
    // Handle non-200 responses
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error (${response.status}): ${errorText}`);
    }
    
    // Parse and return JSON response
    return await response.json();
  } catch (error) {
    console.error('Ollama Bridge error:', error);
    throw error;
  }
} 