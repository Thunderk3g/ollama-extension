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

// Unique request ID counter
let requestCounter = 0;

// Map to store resolve/reject functions for requests
const pendingRequests = new Map();

// Map to store stream controllers and event targets
const activeStreams = new Map();

// Listen for messages from the content script
window.addEventListener('message', function(event) {
  // Check if the message is from our extension
  if (event.data.type === 'OLLAMA_API_RESPONSE') {
    // Look up the corresponding request
    const requestId = event.data.requestId;
    const pendingRequest = pendingRequests.get(requestId);
    
    if (pendingRequest) {
      // Remove from pending requests
      pendingRequests.delete(requestId);
      
      // Resolve or reject the promise
      if (event.data.success) {
        pendingRequest.resolve(event.data.data);
      } else {
        pendingRequest.reject(new Error(event.data.error || 'Unknown error'));
      }
    }
  } else if (event.data.type === 'OLLAMA_STREAM_CHUNK') {
    // Handle streaming chunk
    const requestId = event.data.requestId;
    const streamController = activeStreams.get(requestId);
    
    if (streamController) {
      // Process the chunk based on stream type
      if (streamController.type === 'callback') {
        // For callback-based streams
        streamController.callback(event.data.data, false, null);
      } else if (streamController.type === 'readable-stream') {
        // For ReadableStream
        streamController.controller.enqueue(event.data.data);
      } else if (streamController.type === 'event-target') {
        // For EventTarget
        const chunkEvent = new CustomEvent('chunk', { detail: event.data.data });
        streamController.target.dispatchEvent(chunkEvent);
      }
    }
  } else if (event.data.type === 'OLLAMA_STREAM_END') {
    // Handle stream completion
    const requestId = event.data.requestId;
    const streamController = activeStreams.get(requestId);
    
    if (streamController) {
      // Process stream end based on stream type
      if (streamController.type === 'callback') {
        // Signal completion to callback
        streamController.callback(null, true, null);
      } else if (streamController.type === 'readable-stream') {
        // Close the stream
        streamController.controller.close();
      } else if (streamController.type === 'event-target') {
        // Dispatch end event
        const endEvent = new CustomEvent('end');
        streamController.target.dispatchEvent(endEvent);
      }
      
      // Remove from active streams
      activeStreams.delete(requestId);
    }
  } else if (event.data.type === 'OLLAMA_STREAM_ERROR') {
    // Handle stream error
    const requestId = event.data.requestId;
    const streamController = activeStreams.get(requestId);
    
    if (streamController) {
      // Process stream error based on stream type
      const error = new Error(event.data.error || 'Unknown streaming error');
      
      if (streamController.type === 'callback') {
        // Signal error to callback
        streamController.callback(null, false, error);
      } else if (streamController.type === 'readable-stream') {
        // Error the stream
        streamController.controller.error(error);
      } else if (streamController.type === 'event-target') {
        // Dispatch error event
        const errorEvent = new CustomEvent('error', { detail: error });
        streamController.target.dispatchEvent(errorEvent);
      }
      
      // Remove from active streams
      activeStreams.delete(requestId);
    }
  }
});

// Create the Ollama API client
window.OllamaBridge = {
  /**
   * Send a request to the Ollama API
   * @param {string} endpoint - The API endpoint (e.g., "/api/chat")
   * @param {Object} data - The request data
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} - Promise resolving to the API response
   */
  request: function(endpoint, data = {}, options = {}) {
    return new Promise((resolve, reject) => {
      // Generate a unique request ID
      const requestId = `req_${++requestCounter}`;
      
      // Store the resolve/reject functions
      pendingRequests.set(requestId, { resolve, reject });
      
      // Determine HTTP method, defaulting based on endpoint type
      const getEndpoints = ['/api/tags', '/api/ps', '/api/version'];
      const defaultMethod = getEndpoints.includes(endpoint) ? 'GET' : 'POST';
      const method = options.method || defaultMethod;
      
      // Send the request to the content script
      window.postMessage({
        type: 'OLLAMA_API_REQUEST',
        requestId: requestId,
        endpoint: endpoint,
        method: method,
        data: data
      }, '*');
    });
  },
  
  /**
   * Send a streaming request to the Ollama API using a callback
   * @param {string} endpoint - The API endpoint (e.g., "/api/chat")
   * @param {Object} data - The request data
   * @param {Function} callback - Callback function(chunk, done, error)
   * @param {Object} options - Additional options including streamFormat
   * @returns {Object} - Controller with an abort method
   */
  requestStream: function(endpoint, data = {}, callback, options = {}) {
    // Generate a unique request ID
    const requestId = `stream_${++requestCounter}`;
    
    // Create stream controller
    const controller = {
      type: 'callback',
      callback: callback,
      abort: function() {
        // Remove from active streams
        activeStreams.delete(requestId);
      }
    };
    
    // Store the controller
    activeStreams.set(requestId, controller);
    
    // Send the streaming request to the content script
    window.postMessage({
      type: 'OLLAMA_STREAMING_REQUEST',
      requestId: requestId,
      endpoint: endpoint,
      method: 'POST', // Streaming only works with POST
      data: data,
      streamFormat: options.streamFormat || 'sse'
    }, '*');
    
    return controller;
  },
  
  /**
   * Send a streaming request to the Ollama API using ReadableStream
   * @param {string} endpoint - The API endpoint (e.g., "/api/chat")
   * @param {Object} data - The request data
   * @param {Object} options - Additional options including streamFormat
   * @returns {ReadableStream} - Stream of response chunks
   */
  getStream: function(endpoint, data = {}, options = {}) {
    // Generate a unique request ID
    const requestId = `stream_${++requestCounter}`;
    
    // Create a ReadableStream
    return new ReadableStream({
      start: (controller) => {
        // Create stream controller
        const streamController = {
          type: 'readable-stream',
          controller: controller,
          abort: function() {
            // Remove from active streams
            activeStreams.delete(requestId);
          }
        };
        
        // Store the controller
        activeStreams.set(requestId, streamController);
        
        // Send the streaming request to the content script
        window.postMessage({
          type: 'OLLAMA_STREAMING_REQUEST',
          requestId: requestId,
          endpoint: endpoint,
          method: 'POST', // Streaming only works with POST
          data: data,
          streamFormat: options.streamFormat || 'json'
        }, '*');
      },
      cancel: () => {
        // Remove from active streams when consumer cancels
        activeStreams.delete(requestId);
      }
    });
  },
  
  /**
   * Send a streaming request to the Ollama API using EventTarget
   * @param {string} endpoint - The API endpoint (e.g., "/api/chat")
   * @param {Object} data - The request data
   * @param {Object} options - Additional options including streamFormat
   * @returns {EventTarget} - Event target with stream events
   */
  getEventSource: function(endpoint, data = {}, options = {}) {
    // Generate a unique request ID
    const requestId = `stream_${++requestCounter}`;
    
    // Create an EventTarget
    const eventTarget = new EventTarget();
    
    // Create stream controller
    const streamController = {
      type: 'event-target',
      target: eventTarget,
      abort: function() {
        // Remove from active streams
        activeStreams.delete(requestId);
        // Dispatch abort event
        const abortEvent = new Event('abort');
        eventTarget.dispatchEvent(abortEvent);
      }
    };
    
    // Store the controller
    activeStreams.set(requestId, streamController);
    
    // Send the streaming request to the content script
    window.postMessage({
      type: 'OLLAMA_STREAMING_REQUEST',
      requestId: requestId,
      endpoint: endpoint,
      method: 'POST', // Streaming only works with POST
      data: data,
      streamFormat: options.streamFormat || 'sse'
    }, '*');
    
    // Add abort method to the event target
    eventTarget.abort = streamController.abort;
    
    return eventTarget;
  },
  
  // Utility functions for common API endpoints
  chat: function(params, options = {}) {
    return this.request('/api/chat', params, options);
  },
  
  chatStream: function(params, callback, options = {}) {
    return this.requestStream('/api/chat', params, callback, options);
  },
  
  generate: function(params, options = {}) {
    return this.request('/api/generate', params, options);
  },
  
  generateStream: function(params, callback, options = {}) {
    return this.requestStream('/api/generate', params, callback, options);
  },
  
  embeddings: function(params, options = {}) {
    return this.request('/api/embeddings', params, options);
  },
  
  getTags: function(options = {}) {
    return this.request('/api/tags', {}, { method: 'GET', ...options });
  },
  
  getVersion: function(options = {}) {
    return this.request('/api/version', {}, { method: 'GET', ...options });
  }
};

// Let the page know the bridge is ready
window.dispatchEvent(new CustomEvent('ollama-bridge-ready')); 