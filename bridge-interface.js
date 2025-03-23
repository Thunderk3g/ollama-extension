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
            resolve(mockResponse);
          } else {
            reject(new Error(event.detail.error || 'Unknown error'));
          }
        };
        
        // Set up listener for this request
        document.getElementById('ollama-bridge-element')
          .addEventListener('ollama-response', handleResponse);
        
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
    if (url.includes('localhost:11434') || url.includes('127.0.0.1:11434') || url.includes('/api/')) {
      try {
        // Use OllamaBridge instead
        return await window.OllamaBridge.sendRequest(url, options);
      } catch (error) {
        // If bridge fails, log error and fall back to original fetch
        console.error('Ollama Bridge fetch error:', error);
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