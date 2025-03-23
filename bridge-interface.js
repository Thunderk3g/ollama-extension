// This file is loaded by content.js to create the OllamaBridge interface
// Safe access to chrome APIs
const runtime = typeof chrome !== 'undefined' ? chrome.runtime : undefined;
const getManifest = runtime ? () => runtime.getManifest() : () => ({ version: '1.0.0' });

(() => {
  // Create an interface for the website to use
  window.OllamaBridge = {
    isAvailable: true,
    version: '1.0.0',
    
    sendRequest: (url, options = {}) => {
      return new Promise((resolve, reject) => {
        // Generate unique ID for this request
        const requestId = Math.random().toString(36).substring(2);
        
        // Listen for response
        const handleResponse = (event) => {
          if (event.detail.requestId !== requestId) return;
          
          // Clean up
          document.getElementById('ollama-bridge-element')
            .removeEventListener('ollama-response', handleResponse);
          
          if (event.detail.success) {
            // Create a mock Response object
            const mockResponse = new Response(JSON.stringify(event.detail.data), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });
            console.log(`Ollama Bridge: Request to ${url} succeeded`, event.detail.data);
            resolve(mockResponse);
          } else {
            // Create a more detailed error message
            let errorMessage = event.detail.error || 'Unknown error';
            
            // Check for specific error types
            if (errorMessage.includes('403')) {
              errorMessage = `CORS Error: The server returned a 403 Forbidden response. This may be due to CORS restrictions. Try adding "Origin: http://localhost:11434" header to your Ollama server or restart Ollama with: "OLLAMA_ORIGINS=* ollama serve"`;
            } else if (errorMessage.includes('Invalid URL')) {
              errorMessage = `${errorMessage}. Make sure you're using a supported API endpoint.`;
            } else if (errorMessage.includes('model')) {
              errorMessage = `${errorMessage}. Make sure your request includes a valid 'model' parameter.`;
            } else if (errorMessage.includes('404')) {
              errorMessage = `${errorMessage}. The API endpoint doesn't exist or might have changed in your Ollama version.`;
            }
            
            console.error(`Ollama Bridge: Request to ${url} failed: ${errorMessage}`);
            reject(new Error(errorMessage));
          }
        };
        
        // Set up listener for this request
        document.getElementById('ollama-bridge-element')
          .addEventListener('ollama-response', handleResponse);
        
        // If this is a chat request, make sure model is included
        if ((url === '/api/chat' || url.endsWith('/api/chat')) && options.body) {
          try {
            const body = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
            if (!body.model) {
              console.error('Ollama Bridge: Missing required "model" parameter for chat request');
              reject(new Error('Missing required "model" parameter for chat request'));
              return;
            }
          } catch (e) {
            console.warn('Ollama Bridge: Could not parse request body', e);
          }
        }
        
        // Log request for debugging
        console.log(`Ollama Bridge: Sending request to ${url}`, options);
        
        // Send the request
        document.getElementById('ollama-bridge-element')
          .dispatchEvent(new CustomEvent('ollama-request', {
            detail: {
              url,
              options,
              requestId
            }
          }));
      });
    },
    
    getStatus: () => {
      return new Promise((resolve, reject) => {
        // Generate unique ID for this request
        const requestId = Math.random().toString(36).substring(2);
        
        // Listen for response
        const handleResponse = (event) => {
          if (event.detail.requestId !== requestId) return;
          
          // Clean up
          document.getElementById('ollama-bridge-element')
            .removeEventListener('ollama-status-response', handleResponse);
          
          if (event.detail.error) {
            reject(new Error(event.detail.error));
          } else {
            resolve({
              ollamaUrl: event.detail.ollamaUrl,
              isEnabled: event.detail.isEnabled
            });
          }
        };
        
        // Set up listener for this request
        document.getElementById('ollama-bridge-element')
          .addEventListener('ollama-status-response', handleResponse);
        
        // Send the request
        document.getElementById('ollama-bridge-element')
          .dispatchEvent(new CustomEvent('ollama-status-request', {
            detail: { requestId }
          }));
      });
    },
    
    debug: () => {
      return {
        isInjected: true,
        version: '1.0.0',
        timestamp: new Date().toISOString()
      };
    },
    
    // Helper to check if a URL is a valid Ollama API path
    isValidApiPath: (url) => {
      if (!url) return false;
      
      // List of supported API paths
      const validPaths = [
        '/api/chat', 
        '/api/generate', 
        '/api/tags', 
        '/api/resume',
        '/api/version',
        '/api/pull'
      ];
      
      // Check if it's a relative path we support
      if (typeof url === 'string' && validPaths.some(path => url === path || url.startsWith(path))) {
        return true;
      }
      
      // Check if it's a full Ollama URL
      try {
        const parsedUrl = new URL(url);
        if (
          (parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1') && 
          parsedUrl.port === '11434' &&
          parsedUrl.pathname.startsWith('/api/')
        ) {
          return true;
        }
      } catch (e) {
        // Not a valid URL
      }
      
      return false;
    }
  };
  
  // Add a global helper function for testing
  window.debugOllamaStatus = function() {
    console.log("Ollama Bridge Status:", window.OllamaBridge ? {
      isAvailable: window.OllamaBridge.isAvailable,
      version: window.OllamaBridge.version,
      debug: window.OllamaBridge.debug()
    } : "Not available");
    
    if (window.OllamaBridge) {
      window.OllamaBridge.getStatus()
        .then(status => {
          console.log("Connection Status:", status);
        })
        .catch(error => {
          console.error("Connection Status Error:", error.message);
        });
    }
    
    return "Status check initiated. See console for details.";
  };
  
  // Monkey patch the fetch API to intercept Ollama requests
  const originalFetch = window.fetch;
  window.fetch = async function(resource, options = {}) {
    const url = resource instanceof Request ? resource.url : resource;
    
    // Check if this is an Ollama API request
    if (url.includes('localhost:11434') || 
        url.includes('127.0.0.1:11434') || 
        url.startsWith('/api/')) {
      try {
        // Log the request attempt for debugging 
        console.log('Ollama Bridge: Intercepting request to', url, options);
        
        // Ensure the options contain method, default based on endpoint
        const getEndpoints = ['/api/tags', '/api/ps', '/api/version'];
        const defaultMethod = url.match(/\/(tags|ps|version)($|\?)/) ? 'GET' : 'POST';
        
        const enhancedOptions = {
          ...options,
          method: options.method || defaultMethod // Use the original method or default based on endpoint
        };
        
        // Validate if it's a supported API path
        if (!window.OllamaBridge.isValidApiPath(url)) {
          console.warn(`Ollama Bridge: Unsupported API path: ${url}`);
        }
        
        // Special handling for specific APIs to ensure correct format
        if (url === '/api/chat' || url.endsWith('/api/chat')) {
          const requestBody = enhancedOptions.body ? 
            (typeof enhancedOptions.body === 'string' ? JSON.parse(enhancedOptions.body) : enhancedOptions.body) : 
            {};
            
          // Validate request has required fields
          if (!requestBody.model) {
            console.error('Ollama Bridge: Missing required "model" parameter for chat request');
            throw new Error('Missing required "model" parameter for chat request');
          }
          if (!requestBody.messages || !Array.isArray(requestBody.messages) || requestBody.messages.length === 0) {
            console.error('Ollama Bridge: Chat requests require a non-empty "messages" array');
            throw new Error('Chat requests require a non-empty "messages" array');
          }
        }
        
        // Use OllamaBridge instead with enhanced options
        return await window.OllamaBridge.sendRequest(url, enhancedOptions);
      } catch (error) {
        // If bridge fails, log error and fall back to original fetch
        console.error('Ollama Bridge fetch error:', error);
        
        // Don't fall back for certain errors - they need to be fixed in the calling code
        if (error.message.includes('403') || 
            error.message.includes('404') ||
            error.message.includes('Invalid URL') || 
            error.message.includes('Missing required')) {
          throw error;
        }
        
        return originalFetch.apply(this, arguments);
      }
    }
    
    // For all other requests, use normal fetch
    return originalFetch.apply(this, arguments);
  };
  
  // Notify that the bridge is ready
  document.dispatchEvent(new CustomEvent('ollama-bridge-initialized'));
  console.log('Ollama Bridge initialized');
})(); 