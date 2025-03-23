// Constants
const OLLAMA_BASE_URL = 'http://localhost:11434';
const PORTFOLIO_SITE = 'https://portfolio-flame-five.vercel.app';
// Custom endpoints that don't directly map to Ollama
const CUSTOM_ENDPOINTS = {
  '/api/resume': '/api/chat' // Map resume to chat endpoint
};

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
        console.error('Ollama Bridge: API request failed', error.message);
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
    
    // Handle custom endpoints mapping
    let ollamaEndpoint = endpoint;
    let customEndpoint = false;
    
    // Check if this is a known custom endpoint
    if (CUSTOM_ENDPOINTS[endpoint]) {
      ollamaEndpoint = CUSTOM_ENDPOINTS[endpoint];
      customEndpoint = true;
      console.log(`Ollama Bridge: Mapping custom endpoint ${endpoint} to ${ollamaEndpoint}`);
      
      // For resume endpoint, customize the data
      if (endpoint === '/api/resume') {
        // Default model if not provided
        const modelName = data?.model || 'llama3';
        
        // Ensure we have a valid data structure
        data = {
          model: modelName,
          messages: data?.messages || [
            { 
              role: 'system', 
              content: 'You are a resume reviewer. The user will provide resume information, and you should provide feedback and suggestions for improvement.' 
            },
            { 
              role: 'user', 
              content: data?.prompt || data?.messages?.[0]?.content || 'Please review my resume.'
            }
          ]
        };
      }
    }
    
    // Check for required parameters based on endpoint
    if (ollamaEndpoint === '/api/chat') {
      // For chat endpoint, 'model' is required
      if (!data || !data.model) {
        throw new Error('Missing required "model" parameter for chat request');
      }
      
      // Ensure proper format for messages
      if (!data.messages || !Array.isArray(data.messages) || data.messages.length === 0) {
        throw new Error('Chat requests require a non-empty "messages" array');
      }
    } else if (ollamaEndpoint === '/api/generate') {
      // For generate endpoint, 'model' and 'prompt' are required
      if (!data || !data.model) {
        throw new Error('Missing required "model" parameter for generate request');
      }
      if (!data.prompt && typeof data.prompt !== 'string') {
        throw new Error('Missing required "prompt" parameter for generate request');
      }
    }
    
    // Build the full URL
    const url = `${baseUrl}${ollamaEndpoint}`;
    console.log(`Ollama Bridge: Making request to ${url}`, data);
    
    // Configure fetch options with CORS headers
    const options = {
      method: method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Origin': PORTFOLIO_SITE
      },
      mode: 'cors'
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
      console.error(`Ollama API error (${response.status}):`, errorText);
      throw new Error(`Ollama API error (${response.status}): ${errorText}`);
    }
    
    // Parse JSON response
    const jsonResponse = await response.json();
    console.log('Ollama response:', jsonResponse);
    
    // If this was a custom endpoint, we might need to transform the response
    if (customEndpoint) {
      if (endpoint === '/api/resume') {
        // No transformation needed for now, but we could add it here
      }
    }
    
    return jsonResponse;
  } catch (error) {
    console.error('Ollama Bridge error:', error);
    throw error;
  }
} 