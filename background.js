// Constants
const OLLAMA_BASE_URL = 'http://localhost:11434';
const PORTFOLIO_SITE = 'https://portfolio-flame-five.vercel.app';
// Custom endpoints that don't directly map to Ollama
let CUSTOM_ENDPOINTS = {
  '/api/resume': '/api/chat' // Map resume to chat endpoint
};

// Store the Ollama URL (allowing for customization later)
let ollamaUrl = OLLAMA_BASE_URL;
// Flag to indicate if we should use legacy /api/generate instead of /api/chat
let useLegacyApi = false;

// Initialize extension state
chrome.runtime.onInstalled.addListener(async () => {
  chrome.storage.local.set({ 
    ollamaUrl: OLLAMA_BASE_URL,
    isEnabled: true
  });
  
  // Check API version on startup
  await checkOllamaVersion();
});

// Check which API endpoint to use based on Ollama version
async function checkOllamaVersion() {
  try {
    console.log('Checking Ollama API version...');
    // First try to call /api/version to get version info
    const versionResponse = await fetch(`${OLLAMA_BASE_URL}/api/version`);
    if (versionResponse.ok) {
      const versionData = await versionResponse.json();
      console.log('Ollama version:', versionData.version);
    }
    
    // Try to access the chat endpoint
    const chatResponse = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama3',
        messages: [{ role: 'user', content: 'test' }]
      })
    });
    
    if (chatResponse.status === 404) {
      // 404 means chat endpoint doesn't exist, use generate instead
      console.log('Ollama server does not support /api/chat endpoint, using /api/generate instead');
      useLegacyApi = true;
      CUSTOM_ENDPOINTS = {
        '/api/resume': '/api/generate',
        '/api/chat': '/api/generate'
      };
    } else {
      console.log('Ollama server supports /api/chat endpoint');
      useLegacyApi = false;
    }
  } catch (error) {
    console.warn('Could not determine Ollama API version:', error);
    // Default to supporting both endpoints
  }
}

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
      // Re-check API version when URL changes
      checkOllamaVersion();
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
    // SAFEGUARD: Use correct HTTP methods based on Ollama API specification
    // GET endpoints: /api/tags, /api/ps, /api/version
    // POST endpoints: /api/chat, /api/generate, etc.
    const getEndpoints = ['/api/tags', '/api/ps', '/api/version'];
    
    if (getEndpoints.includes(endpoint)) {
      if (method !== 'GET') {
        console.log(`Ollama Bridge: Using GET method instead of ${method || 'undefined'} for ${endpoint}`);
        method = 'GET';
      }
    } else if (!method) {
      // For non-GET endpoints, default to POST if method isn't specified
      console.log(`Ollama Bridge: Defaulting to POST method for ${endpoint}`);
      method = 'POST';
    }
    
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
      
      // For resume endpoint or chat when using legacy API, customize the data
      if ((endpoint === '/api/resume' || (endpoint === '/api/chat' && ollamaEndpoint === '/api/generate'))) {
        // Default model if not provided
        const modelName = data?.model || 'llama3';
        
        if (ollamaEndpoint === '/api/generate') {
          // For generate API, we need to convert chat format to generate format
          const messages = data?.messages || [];
          let prompt = '';
          
          // Combine messages into a single prompt
          if (messages.length > 0) {
            for (const msg of messages) {
              if (msg.role === 'system') {
                prompt += `System: ${msg.content}\n\n`;
              } else if (msg.role === 'user') {
                prompt += `User: ${msg.content}\n\n`;
              } else if (msg.role === 'assistant') {
                prompt += `Assistant: ${msg.content}\n\n`;
              }
            }
            
            // Add one final prompt if the last message is from user
            if (messages[messages.length-1].role === 'user') {
              prompt += 'Assistant: ';
            }
          } else {
            prompt = data?.prompt || "Please provide a response.";
          }
          
          // Create a generate-compatible request
          data = {
            model: modelName,
            prompt: prompt,
            options: data?.options || { temperature: 0.7 },
            stream: data?.stream || false
          };
        } else {
          // For chat API
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
      method: method,  // Use the method determined earlier
      headers: {
        'Accept': 'application/json',
        'Origin': PORTFOLIO_SITE
      },
      mode: 'cors'
    };
    
    // Add content-type and body for methods that support it
    if (['POST', 'PUT', 'PATCH'].includes(method) && data) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(data);
    }
    
    // Log the complete request details for debugging
    console.log(`Ollama Bridge: Sending ${options.method} request to ${url} with options:`, options);
    
    // Make the request to Ollama
    const response = await fetch(url, options);
    
    // Handle non-200 responses
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Ollama API error (${response.status}):`, errorText);
      
      // If we get a 404 on chat endpoint, try switching to generate
      if (response.status === 404 && ollamaEndpoint === '/api/chat') {
        console.log('Switching to legacy /api/generate API...');
        useLegacyApi = true;
        CUSTOM_ENDPOINTS['/api/chat'] = '/api/generate';
        
        // Try again with the generate endpoint - explicitly use POST method
        return await handleOllamaRequest(endpoint, 'POST', data);
      }
      
      throw new Error(`Ollama API error (${response.status}): ${errorText}`);
    }
    
    // Parse JSON response
    const jsonResponse = await response.json();
    console.log('Ollama response:', jsonResponse);
    
    // If this was a custom endpoint or using legacy API, we might need to transform the response
    if (customEndpoint || (endpoint === '/api/chat' && ollamaEndpoint === '/api/generate')) {
      if (ollamaEndpoint === '/api/generate') {
        // Transform generate response to chat format
        return {
          model: data.model,
          message: {
            role: 'assistant',
            content: jsonResponse.response
          },
          done: true
        };
      }
    }
    
    return jsonResponse;
  } catch (error) {
    console.error('Ollama Bridge error:', error);
    throw error;
  }
} 