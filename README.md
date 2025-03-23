# Ollama Bridge Extension

## Overview

The Ollama Bridge Extension creates a secure communication channel between web applications and a locally running Ollama LLM server. This bridge bypasses Cross-Origin Resource Sharing (CORS) restrictions that typically prevent web applications from directly accessing local services, enabling seamless integration of large language models into web-based interfaces.

## Technical Architecture

The extension implements a three-tiered architecture:

1. **Client-side Interface** (`bridge-interface.js`): Injected into web pages to intercept API calls
2. **Content Script Layer** (`content.js`): Mediates between webpage and background service
3. **Background Service Worker** (`background.js`): Makes actual requests to the Ollama server

This design adheres to Chrome's extension security model while maintaining high performance.

### Communication Flow

```
Web Application → bridge-interface.js → content.js → background.js → Ollama Server
         ↑                                                                ↓
         └────────────────────────────────────────────────────────────────┘
```

## Key Implementation Details

### Method-Aware API Routing

The extension intelligently routes requests using the appropriate HTTP method based on the Ollama API specification:

```javascript
// SAFEGUARD: Use correct HTTP methods based on Ollama API specification
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
```

### Request Interception

The extension uses a monkey-patched `fetch` API to intercept Ollama-bound requests:

```javascript
// Monkey patch the fetch API to intercept Ollama requests
const originalFetch = window.fetch;
window.fetch = async function(resource, options = {}) {
  const url = resource instanceof Request ? resource.url : resource;
  
  // Check if this is an Ollama API request
  if (url.includes('localhost:11434') || 
      url.includes('127.0.0.1:11434') || 
      url.startsWith('/api/')) {
    // Use OllamaBridge instead with enhanced options
    return await window.OllamaBridge.sendRequest(url, enhancedOptions);
  }
  
  // For all other requests, use normal fetch
  return originalFetch.apply(this, arguments);
};
```

### API Endpoint Mapping

The extension supports customized endpoint mapping to accommodate different API conventions:

```javascript
// Custom endpoints that don't directly map to Ollama
let CUSTOM_ENDPOINTS = {
  '/api/resume': '/api/chat' // Map resume to chat endpoint
};

// Handle custom endpoints mapping
if (CUSTOM_ENDPOINTS[endpoint]) {
  ollamaEndpoint = CUSTOM_ENDPOINTS[endpoint];
  customEndpoint = true;
  console.log(`Ollama Bridge: Mapping custom endpoint ${endpoint} to ${ollamaEndpoint}`);
}
```

### Version Detection and Compatibility

The extension automatically detects the Ollama server version and adjusts its API calls accordingly:

```javascript
async function checkOllamaVersion() {
  try {
    // First try to call /api/version to get version info
    const versionResponse = await fetch(`${OLLAMA_BASE_URL}/api/version`);
    if (versionResponse.ok) {
      const versionData = await versionResponse.json();
      console.log('Ollama version:', versionData.version);
    }
    
    // Check for chat API support
    const chatResponse = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3',
        messages: [{ role: 'user', content: 'test' }]
      })
    });
    
    if (chatResponse.status === 404) {
      // Fall back to generate API for older versions
      useLegacyApi = true;
      CUSTOM_ENDPOINTS = {
        '/api/resume': '/api/generate',
        '/api/chat': '/api/generate'
      };
    }
  } catch (error) {
    console.warn('Could not determine Ollama API version:', error);
  }
}
```

## Customizing for Your LLM Applications

### 1. Update Allowed Origins

To use this extension with your own web application, modify the `content_scripts` section in `manifest.json`:

```json
"content_scripts": [
  {
    "matches": [
      "https://your-domain.com/*",
      "http://localhost:3000/*"
    ],
    "js": ["content.js"],
    "run_at": "document_start"
  }
]
```

### 2. Add Custom Endpoints

Extend the `CUSTOM_API_ENDPOINTS` array in `content.js` to include your application's specific endpoints:

```javascript
const CUSTOM_API_ENDPOINTS = [
  '/api/resume',
  '/api/chat',
  '/api/tags',
  '/api/generate',
  '/api/your-custom-endpoint'
];
```

### 3. Define Endpoint Mappings

Add custom endpoint mappings in `background.js` to route your application's API calls to the appropriate Ollama endpoints:

```javascript
let CUSTOM_ENDPOINTS = {
  '/api/resume': '/api/chat',
  '/api/your-custom-endpoint': '/api/chat'
};
```

### 4. Customize Request/Response Transformation

Modify the `handleOllamaRequest` function to transform data for your custom endpoints:

```javascript
if (endpoint === '/api/your-custom-endpoint') {
  // Transform input data to match Ollama requirements
  data = {
    model: data.model || 'your-default-model',
    messages: [
      { 
        role: 'system', 
        content: 'Your custom system prompt'
      },
      { 
        role: 'user', 
        content: data.query || 'Default query'
      }
    ]
  };
}
```

### 5. Add Client-Side Integration

Add this code to your web application to detect and use the extension:

```javascript
// Check if Ollama Bridge is available
function isOllamaBridgeAvailable() {
  return typeof window !== 'undefined' && window.OllamaBridge && window.OllamaBridge.isAvailable;
}

// Using the bridge
async function generateWithOllama(prompt) {
  if (isOllamaBridgeAvailable()) {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3',
          messages: [{ role: 'user', content: prompt }]
        })
      });
      
      const data = await response.json();
      return data.message?.content || '';
    } catch (error) {
      console.error('Error using Ollama:', error);
      return 'Error connecting to Ollama';
    }
  } else {
    return 'Ollama Bridge extension not detected. Please install it to use local LLM features.';
  }
}
```

## CORS Configuration

When running the Ollama server, enable CORS for Chrome extensions:

**Windows (CMD):**
```batch
set OLLAMA_ORIGINS=chrome-extension://*
ollama serve
```

**Windows (PowerShell):**
```powershell
$env:OLLAMA_ORIGINS="chrome-extension://*"
ollama serve
```

**Linux/macOS:**
```bash
OLLAMA_ORIGINS=chrome-extension://* ollama serve
```

## Performance Considerations

The extension implements several optimizations:

1. **Minimal Response Parsing**: Only parses necessary parts of responses to minimize overhead
2. **Method Caching**: Intelligently determines and caches HTTP methods to reduce processing time  
3. **Shared Background Worker**: Uses a single service worker for all requests to reduce memory usage
4. **Lightweight Communication**: Uses custom events for efficient message passing between components

## Security Implications

The extension maintains security through:

1. **Origin Validation**: Only allows specific origins defined in the manifest
2. **No External Calls**: Only communicates with the local Ollama server
3. **Request Validation**: Validates all incoming requests before processing
4. **Error Handling**: Provides detailed error messages without exposing system information

## Conclusion

This extension provides a robust, secure bridge between web applications and locally-running Ollama LLM instances. By circumventing CORS restrictions through a properly designed extension architecture, it enables web developers to leverage powerful local language models without compromising on security or user experience. 