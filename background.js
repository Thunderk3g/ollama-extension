// Constants
const OLLAMA_BASE_URL = 'http://localhost:11434';
const PORTFOLIO_SITE = 'https://portfolio-flame-five.vercel.app';
// Default endpoints that don't directly map to Ollama
let DEFAULT_ENDPOINTS = {
  '/api/resume': '/api/chat' // Map resume to chat endpoint
};

// Store the Ollama URL (allowing for customization later)
let ollamaUrl = OLLAMA_BASE_URL;
// Flag to indicate if we should use legacy /api/generate instead of /api/chat
let useLegacyApi = false;
// Store for custom endpoint mappings defined by the user
let customEndpointMappings = [];
// Store for available models and their configurations
let availableModels = [];
// Default model to use when none is specified
let defaultModel = 'llama3';
// Store for model parameter presets
let modelPresets = {};
// Store for transformation templates
let transformationTemplates = {};

// Default transformation templates
const DEFAULT_TEMPLATES = {
  'default': {
    id: 'default',
    name: 'Default',
    description: 'Standard format for Ollama API',
    framework: 'generic',
    requestTransform: {
      '/api/chat': (data) => {
        // Ensure we have a model and messages
        return {
          model: data.model || defaultModel,
          messages: data.messages || [
            { role: 'user', content: data.prompt || 'Hello' }
          ],
          options: data.options || {}
        };
      },
      '/api/generate': (data) => {
        // For generate API, ensure we have a prompt
        return {
          model: data.model || defaultModel,
          prompt: data.prompt || (data.messages ? 
            data.messages.map(m => `${m.role}: ${m.content}`).join('\n\n') : 
            'Please respond.'),
          options: data.options || {}
        };
      }
    },
    responseTransform: {
      '/api/chat': (response) => response,
      '/api/generate': (response) => {
        // Convert generate response to chat format
        if (response && response.response) {
          return {
            message: {
              role: 'assistant',
              content: response.response
            }
          };
        }
        return response;
      }
    }
  },
  'nextjs-langchain': {
    id: 'nextjs-langchain',
    name: 'Next.js + LangChain',
    description: 'Format for Next.js apps using LangChain.js',
    framework: 'nextjs',
    requestTransform: {
      '/api/chat': (data) => {
        // Ensure we have a model and messages
        let messages = data.messages || [];
        if (data.prompt && messages.length === 0) {
          messages = [{ role: 'user', content: data.prompt }];
        }
        
        // Add system message if provided but not present
        if (data.systemPrompt && !messages.some(m => m.role === 'system')) {
          messages.unshift({ role: 'system', content: data.systemPrompt });
        }
        
        return {
          model: data.model || defaultModel,
          messages: messages,
          options: {
            temperature: data.temperature || 0.7,
            top_p: data.top_p || 0.9,
            top_k: data.top_k || 40,
            ...data.options
          }
        };
      }
    },
    responseTransform: {
      '/api/chat': (response) => {
        // Structure response for LangChain expectations
        if (response && response.message) {
          return {
            output: response.message.content,
            messageId: Date.now().toString(),
            conversationId: Date.now().toString()
          };
        }
        return response;
      }
    }
  },
  'react-openai-api': {
    id: 'react-openai-api',
    name: 'React OpenAI API Format',
    description: 'Compatible with OpenAI API clients',
    framework: 'react',
    requestTransform: {
      '/api/chat': (data) => {
        // Convert from OpenAI format
        let options = {};
        if (data.temperature) options.temperature = data.temperature;
        if (data.top_p) options.top_p = data.top_p;
        if (data.max_tokens) options.num_predict = data.max_tokens;
        
        return {
          model: data.model || defaultModel,
          messages: data.messages || [],
          options
        };
      }
    },
    responseTransform: {
      '/api/chat': (response) => {
        // Convert to OpenAI-like format
        if (response && response.message) {
          return {
            id: `chatcmpl-${Date.now()}`,
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: defaultModel,
            choices: [
              {
                index: 0,
                message: response.message,
                finish_reason: 'stop'
              }
            ],
            usage: {
              prompt_tokens: -1,
              completion_tokens: -1,
              total_tokens: -1
            }
          };
        }
        return response;
      }
    }
  }
};

// Add to initialization section
let streamingConfig = {
  streamingEnabled: true,
  streamFormat: 'sse',
  streamChunkSize: 20,
  streamTemplate: 'default'
};

// Load streaming config
chrome.storage.local.get({
  streamingEnabled: true,
  streamFormat: 'sse',
  streamChunkSize: 20,
  streamTemplate: 'default'
}, function(config) {
  streamingConfig = config;
  console.log('Loaded streaming configuration:', streamingConfig);
});

// Initialize extension state
chrome.runtime.onInstalled.addListener(async () => {
  // Initialize with default settings
  const defaultSettings = {
    ollamaUrl: OLLAMA_BASE_URL,
    isEnabled: true,
    customEndpointMappings: [],
    availableModels: [],
    defaultModel: 'llama3',
    modelPresets: {},
    transformationTemplates: DEFAULT_TEMPLATES
  };
  
  // Get existing settings if any
  const existingSettings = await chrome.storage.local.get([
    'customEndpointMappings', 
    'availableModels', 
    'defaultModel',
    'modelPresets',
    'transformationTemplates'
  ]);
  
  // Merge with defaults
  chrome.storage.local.set({ 
    ollamaUrl: OLLAMA_BASE_URL,
    isEnabled: true,
    customEndpointMappings: existingSettings.customEndpointMappings || [],
    availableModels: existingSettings.availableModels || [],
    defaultModel: existingSettings.defaultModel || 'llama3',
    modelPresets: existingSettings.modelPresets || {},
    transformationTemplates: existingSettings.transformationTemplates || DEFAULT_TEMPLATES
  });
  
  // Load custom endpoint mappings
  if (existingSettings.customEndpointMappings) {
    customEndpointMappings = existingSettings.customEndpointMappings;
  }
  
  // Load model-related settings
  if (existingSettings.availableModels) {
    availableModels = existingSettings.availableModels;
  }
  
  if (existingSettings.defaultModel) {
    defaultModel = existingSettings.defaultModel;
  }
  
  if (existingSettings.modelPresets) {
    modelPresets = existingSettings.modelPresets;
  }
  
  // Load transformation templates
  if (existingSettings.transformationTemplates) {
    transformationTemplates = existingSettings.transformationTemplates;
  } else {
    transformationTemplates = DEFAULT_TEMPLATES;
  }
  
  // Check API version on startup
  await checkOllamaVersion();
  
  // Discover available models
  await discoverModels();
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
      DEFAULT_ENDPOINTS = {
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
  } else if (request.type === 'OLLAMA_STREAMING_REQUEST') {
    // Handle streaming API request
    // We can't use sendResponse for streaming, so we'll communicate
    // through port messaging instead
    const port = chrome.runtime.connect({ name: 'ollama-stream' });
    
    handleOllamaStreamingRequest(
      request.endpoint, 
      request.method, 
      request.data, 
      request.streamFormat || 'sse',
      (chunk, done, error) => {
        if (error) {
          port.postMessage({ 
            type: 'stream-error', 
            error: error.message || 'Unknown error' 
          });
          port.disconnect();
        } else if (done) {
          port.postMessage({ type: 'stream-end' });
          port.disconnect();
        } else {
          port.postMessage({ 
            type: 'stream-chunk', 
            data: chunk 
          });
        }
      }
    ).catch(error => {
      // Handle any setup errors
      const port = chrome.runtime.connect({ name: 'ollama-stream' });
      port.postMessage({ 
        type: 'stream-error', 
        error: error.message || 'Unknown error' 
      });
      port.disconnect();
    });
    
    // No sendResponse needed, we're using the port
    return true;
  } else if (request.type === 'UPDATE_SETTINGS') {
    // Update extension settings
    if (request.ollamaUrl) {
      ollamaUrl = request.ollamaUrl;
      chrome.storage.local.set({ ollamaUrl });
      // Re-check API version when URL changes
      checkOllamaVersion();
      // Rediscover models when URL changes
      discoverModels();
    }
    if (request.hasOwnProperty('isEnabled')) {
      chrome.storage.local.set({ isEnabled: request.isEnabled });
    }
    // Handle custom endpoint mappings updates
    if (request.hasOwnProperty('customEndpointMappings')) {
      customEndpointMappings = request.customEndpointMappings;
      chrome.storage.local.set({ customEndpointMappings });
    }
    // Handle model-related settings
    if (request.hasOwnProperty('defaultModel')) {
      defaultModel = request.defaultModel;
      chrome.storage.local.set({ defaultModel });
    }
    sendResponse({ success: true });
    return true;
  } else if (request.type === 'GET_SETTINGS') {
    // Return current settings
    chrome.storage.local.get([
      'ollamaUrl', 
      'isEnabled', 
      'customEndpointMappings',
      'availableModels',
      'defaultModel',
      'modelPresets',
      'transformationTemplates'
    ], (result) => {
      sendResponse({ 
        ollamaUrl: result.ollamaUrl || OLLAMA_BASE_URL,
        isEnabled: result.isEnabled !== undefined ? result.isEnabled : true,
        customEndpointMappings: result.customEndpointMappings || [],
        availableModels: result.availableModels || [],
        defaultModel: result.defaultModel || 'llama3',
        modelPresets: result.modelPresets || {},
        transformationTemplates: result.transformationTemplates || DEFAULT_TEMPLATES
      });
    });
    return true;
  } else if (request.type === 'MANAGE_ENDPOINT_MAPPING') {
    // Handle endpoint mapping management
    handleEndpointMappingRequest(request.action, request.mapping)
      .then(result => {
        sendResponse({ success: true, data: result });
      })
      .catch(error => {
        console.error('Ollama Bridge: Endpoint mapping request failed', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  } else if (request.type === 'MANAGE_MODEL') {
    // Handle model management requests
    handleModelRequest(request.action, request.model)
      .then(result => {
        sendResponse({ success: true, data: result });
      })
      .catch(error => {
        console.error('Ollama Bridge: Model management request failed', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  } else if (request.type === 'DISCOVER_MODELS') {
    // Trigger model discovery
    discoverModels()
      .then(models => {
        sendResponse({ success: true, data: models });
      })
      .catch(error => {
        console.error('Ollama Bridge: Model discovery failed', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  } else if (request.type === 'MANAGE_TEMPLATE') {
    // Handle template management
    handleTemplateRequest(request.action, request.template)
      .then(result => {
        sendResponse({ success: true, data: result });
      })
      .catch(error => {
        console.error('Ollama Bridge: Template management failed', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  } else if (request.action === 'updateStreamingConfig') {
    streamingConfig = request.config;
    console.log('Updated streaming configuration:', streamingConfig);
    sendResponse({ success: true });
    return true;
  }
});

// Function to handle endpoint mapping management
async function handleEndpointMappingRequest(action, mapping) {
  // Load current mappings
  const result = await chrome.storage.local.get(['customEndpointMappings']);
  let mappings = result.customEndpointMappings || [];
  
  switch (action) {
    case 'add':
      // Generate a unique ID if not provided
      if (!mapping.id) {
        mapping.id = 'mapping-' + Date.now();
      }
      mappings.push(mapping);
      break;
    
    case 'update':
      // Find and update the mapping
      const updateIndex = mappings.findIndex(m => m.id === mapping.id);
      if (updateIndex === -1) {
        throw new Error(`Mapping with ID ${mapping.id} not found`);
      }
      mappings[updateIndex] = mapping;
      break;
    
    case 'delete':
      // Remove the mapping
      const deleteIndex = mappings.findIndex(m => m.id === mapping.id);
      if (deleteIndex === -1) {
        throw new Error(`Mapping with ID ${mapping.id} not found`);
      }
      mappings.splice(deleteIndex, 1);
      break;
    
    case 'get':
      // Return the current mappings
      return mappings;
    
    default:
      throw new Error(`Unknown action: ${action}`);
  }
  
  // Save the updated mappings
  await chrome.storage.local.set({ customEndpointMappings: mappings });
  // Update in-memory copy
  customEndpointMappings = mappings;
  
  return mappings;
}

// Function to discover available models from Ollama
async function discoverModels() {
  try {
    console.log('Discovering available models from Ollama...');
    
    // Get current settings
    const settings = await chrome.storage.local.get(['ollamaUrl', 'isEnabled']);
    
    // Check if extension is enabled
    if (!settings.isEnabled) {
      throw new Error('Ollama Bridge is disabled');
    }
    
    // Use stored Ollama URL or default
    const baseUrl = settings.ollamaUrl || OLLAMA_BASE_URL;
    
    // Make request to /api/tags endpoint
    const response = await fetch(`${baseUrl}/api/tags`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get models: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Process the models
    if (data.models) {
      // New format from Ollama API
      availableModels = data.models.map(model => ({
        name: model.name,
        modified: model.modified_at,
        size: model.size,
        parameters: model.parameter_size
      }));
    } else {
      // Older format or custom response
      availableModels = Object.keys(data).map(modelName => ({
        name: modelName,
        modified: new Date().toISOString(),
        size: 0,
        parameters: 0
      }));
    }
    
    // Save to storage
    await chrome.storage.local.set({ availableModels });
    
    // If no default model is set or the default model is not in the list,
    // set the first available model as default
    if (!defaultModel || !availableModels.some(m => m.name === defaultModel)) {
      if (availableModels.length > 0) {
        defaultModel = availableModels[0].name;
        await chrome.storage.local.set({ defaultModel });
      }
    }
    
    console.log(`Discovered ${availableModels.length} models`);
    return availableModels;
  } catch (error) {
    console.error('Error discovering models:', error);
    // Don't clear existing models on error
    return availableModels;
  }
}

// Function to handle model management requests
async function handleModelRequest(action, model) {
  // Get current model presets
  const result = await chrome.storage.local.get(['modelPresets', 'defaultModel']);
  let presets = result.modelPresets || {};
  let currentDefault = result.defaultModel || defaultModel;
  
  switch (action) {
    case 'get_all':
      // Return all available models with their presets
      return {
        models: availableModels,
        presets: presets,
        defaultModel: currentDefault
      };
    
    case 'set_default':
      // Set a model as default
      if (!model || !model.name) {
        throw new Error('Model name is required');
      }
      
      // Update default model
      defaultModel = model.name;
      await chrome.storage.local.set({ defaultModel: model.name });
      return { defaultModel: model.name };
    
    case 'save_preset':
      // Save parameter preset for a model
      if (!model || !model.name) {
        throw new Error('Model name is required');
      }
      
      // Create or update preset
      presets[model.name] = {
        temperature: model.temperature || 0.7,
        top_p: model.top_p || 0.9,
        top_k: model.top_k || 40,
        frequency_penalty: model.frequency_penalty || 0,
        presence_penalty: model.presence_penalty || 0,
        max_tokens: model.max_tokens || 2048,
        stop: model.stop || [],
        system_prompt: model.system_prompt || '',
        include_images: model.include_images || false,
        format: model.format || 'json'
      };
      
      // Save updated presets
      await chrome.storage.local.set({ modelPresets: presets });
      return { presets };
    
    case 'delete_preset':
      // Delete a model preset
      if (!model || !model.name) {
        throw new Error('Model name is required');
      }
      
      if (presets[model.name]) {
        delete presets[model.name];
        await chrome.storage.local.set({ modelPresets: presets });
      }
      
      return { presets };
    
    case 'get_preset':
      // Get preset for a specific model
      if (!model || !model.name) {
        throw new Error('Model name is required');
      }
      
      return { 
        preset: presets[model.name] || {
          temperature: 0.7,
          top_p: 0.9,
          top_k: 40,
          frequency_penalty: 0,
          presence_penalty: 0,
          max_tokens: 2048,
          stop: [],
          system_prompt: '',
          include_images: false,
          format: 'json'
        }
      };
    
    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

// Function to handle transformation template management
async function handleTemplateRequest(action, template) {
  // Get current templates
  const result = await chrome.storage.local.get(['transformationTemplates']);
  let templates = result.transformationTemplates || DEFAULT_TEMPLATES;
  
  switch (action) {
    case 'get_all':
      // Return all templates
      return templates;
    
    case 'get':
      // Get a specific template
      if (!template || !template.id) {
        throw new Error('Template ID is required');
      }
      
      const foundTemplate = templates[template.id];
      if (!foundTemplate) {
        throw new Error(`Template with ID ${template.id} not found`);
      }
      
      return foundTemplate;
    
    case 'save':
      // Save or update a template
      if (!template || !template.id || !template.name) {
        throw new Error('Template ID and name are required');
      }
      
      // Create or update the template
      templates[template.id] = {
        id: template.id,
        name: template.name,
        description: template.description || '',
        framework: template.framework || 'generic',
        requestTransform: template.requestTransform || {},
        responseTransform: template.responseTransform || {}
      };
      
      // Save updated templates
      await chrome.storage.local.set({ transformationTemplates: templates });
      transformationTemplates = templates;
      
      return templates;
    
    case 'delete':
      // Delete a template
      if (!template || !template.id) {
        throw new Error('Template ID is required');
      }
      
      // Cannot delete default templates
      if (template.id === 'default') {
        throw new Error('Cannot delete the default template');
      }
      
      if (templates[template.id]) {
        delete templates[template.id];
        await chrome.storage.local.set({ transformationTemplates: templates });
        transformationTemplates = templates;
      }
      
      return templates;
    
    case 'reset':
      // Reset to default templates
      await chrome.storage.local.set({ transformationTemplates: DEFAULT_TEMPLATES });
      transformationTemplates = DEFAULT_TEMPLATES;
      
      return DEFAULT_TEMPLATES;
    
    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

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
    const settings = await chrome.storage.local.get([
      'ollamaUrl', 
      'isEnabled', 
      'customEndpointMappings',
      'defaultModel',
      'modelPresets',
      'transformationTemplates'
    ]);
    
    // Check if extension is enabled
    if (!settings.isEnabled) {
      throw new Error('Ollama Bridge is disabled');
    }
    
    // Use stored Ollama URL or default
    const baseUrl = settings.ollamaUrl || OLLAMA_BASE_URL;
    
    // Handle endpoint mapping - check custom mappings first
    let ollamaEndpoint = endpoint;
    let customEndpoint = false;
    let currentMapping = null;
    
    // Check custom user-defined mappings first
    if (settings.customEndpointMappings && settings.customEndpointMappings.length > 0) {
      const mapping = settings.customEndpointMappings.find(m => m.sourceEndpoint === endpoint);
      if (mapping) {
        ollamaEndpoint = mapping.targetEndpoint;
        customEndpoint = true;
        currentMapping = mapping;
        console.log(`Ollama Bridge: Using custom mapping for ${endpoint} to ${ollamaEndpoint}`);
      }
    }
    
    // If no custom mapping, check default mappings
    if (!customEndpoint && DEFAULT_ENDPOINTS[endpoint]) {
      ollamaEndpoint = DEFAULT_ENDPOINTS[endpoint];
      customEndpoint = true;
      console.log(`Ollama Bridge: Using default mapping for ${endpoint} to ${ollamaEndpoint}`);
    }
    
    // Variables to track transformation
    let templateId = 'default';
    let transformedData = { ...data };
    let shouldTransformResponse = false;
    
    // Find the relevant endpoint mapping for transformation
    const mapping = customEndpointMappings.find(m => m.sourceEndpoint === endpoint);
    if (mapping && mapping.transformRequest) {
      // If mapping specifies a template, use it
      if (mapping.templateId) {
        templateId = mapping.templateId;
      }
      
      // Get the template
      const templates = settings.transformationTemplates || DEFAULT_TEMPLATES;
      const template = templates[templateId] || templates['default'];
      
      // Apply request transformation if available for this endpoint
      const targetEndpoint = mapping.targetEndpoint || ollamaEndpoint;
      if (template.requestTransform && template.requestTransform[targetEndpoint]) {
        try {
          console.log(`Ollama Bridge: Applying "${template.name}" request transformation for ${endpoint} -> ${targetEndpoint}`);
          transformedData = template.requestTransform[targetEndpoint](data);
          
          // Flag to transform response too
          if (template.responseTransform && template.responseTransform[targetEndpoint]) {
            shouldTransformResponse = true;
          }
        } catch (error) {
          console.error(`Ollama Bridge: Error in request transformation: ${error.message}`);
          // Continue with original data if transformation fails
          transformedData = data;
        }
      }
    } else {
      // If no custom mapping or transformation not enabled, still apply model presets
      transformedData = applyModelPresets(data, ollamaEndpoint, settings);
    }
    
    // Build the full URL
    const url = `${baseUrl}${ollamaEndpoint}`;
    console.log(`Ollama Bridge: Sending request to ${url}`);
    
    // Configure fetch options with CORS headers
    const options = {
      method: method,
      headers: {
        'Access-Control-Allow-Origin': '*'
      }
    };
    
    // Add content-type header and body for POST/PUT/PATCH
    if (['POST', 'PUT', 'PATCH'].includes(method) && transformedData) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(transformedData);
    }
    
    // Log the request for debugging
    console.log(`Ollama Bridge: Making ${method} request with options:`, options);
    
    // Make the request
    const response = await fetch(url, options);
    
    if (!response.ok) {
      // Special handling for 404 on chat API - try legacy generate API
      if (response.status === 404 && ollamaEndpoint === '/api/chat') {
        console.log('Switching to legacy /api/generate API...');
        useLegacyApi = true;
        DEFAULT_ENDPOINTS['/api/chat'] = '/api/generate';
        
        // Try again with the generate endpoint - explicitly use POST method
        return handleOllamaRequest(endpoint, 'POST', transformedData);
      }
      
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }
    
    // Parse response
    const responseData = await response.json();
    
    // Apply response transformation if needed
    if (shouldTransformResponse) {
      // Get the template again
      const templates = settings.transformationTemplates || DEFAULT_TEMPLATES;
      const template = templates[templateId] || templates['default'];
      
      // Apply response transformation if available for this endpoint
      const targetEndpoint = mapping.targetEndpoint || ollamaEndpoint;
      if (template.responseTransform && template.responseTransform[targetEndpoint]) {
        try {
          console.log(`Ollama Bridge: Applying "${template.name}" response transformation for ${targetEndpoint}`);
          return template.responseTransform[targetEndpoint](responseData);
        } catch (error) {
          console.error(`Ollama Bridge: Error in response transformation: ${error.message}`);
          // Return original response if transformation fails
          return responseData;
        }
      }
    }
    
    return responseData;
  } catch (error) {
    console.error(`Ollama Bridge: Request failed: ${error.message}`);
    throw error;
  }
}

// Helper function to apply model presets to data
function applyModelPresets(data, endpoint, settings) {
  if (!data) return data;
  
  // Create a copy to avoid modifying the original
  const transformedData = { ...data };
  
  // If endpoint is chat or generate and we have data
  if ((endpoint === '/api/chat' || endpoint === '/api/generate') && transformedData) {
    // If no model specified, use default model
    if (!transformedData.model) {
      transformedData.model = settings.defaultModel || defaultModel;
      console.log(`Ollama Bridge: Using default model: ${transformedData.model}`);
    }
    
    // Check if we have presets for this model
    const modelName = transformedData.model;
    const presets = settings.modelPresets || {};
    
    if (presets[modelName]) {
      console.log(`Ollama Bridge: Applying presets for model: ${modelName}`);
      
      // For chat API
      if (endpoint === '/api/chat') {
        // Merge options if they exist, otherwise create them
        transformedData.options = {
          ...presets[modelName],
          ...transformedData.options
        };
        
        // Add system prompt if configured and not already present
        if (presets[modelName].system_prompt && 
            (!transformedData.messages || !transformedData.messages.some(m => m.role === 'system'))) {
          
          if (!transformedData.messages) {
            transformedData.messages = [];
          }
          
          transformedData.messages.unshift({
            role: 'system',
            content: presets[modelName].system_prompt
          });
        }
      }
      // For generate API
      else if (endpoint === '/api/generate') {
        // Apply options to the request
        transformedData.options = {
          ...presets[modelName],
          ...transformedData.options
        };
        
        // Add system prompt as part of the prompt if configured
        if (presets[modelName].system_prompt && transformedData.prompt) {
          transformedData.prompt = `System: ${presets[modelName].system_prompt}\n\n${transformedData.prompt}`;
        }
      }
    }
  }
  
  return transformedData;
}

// Function to handle Ollama streaming API requests
async function handleOllamaStreamingRequest(endpoint, method, data, streamFormat = 'sse', chunkCallback) {
  console.log('Handling Ollama streaming request:', { endpoint, method, data, streamFormat });

  // Get settings
  const settings = await chrome.storage.local.get([
    'ollamaUrl', 
    'isEnabled', 
    'customEndpointMappings',
    'defaultModel',
    'modelPresets',
    'transformationTemplates'
  ]);
  
  // Check if streaming is enabled
  if (!streamingConfig.streamingEnabled) {
    chunkCallback(null, true, new Error('Streaming is disabled in extension settings'));
    return;
  }

  // Handle custom endpoint mappings
  let ollamaEndpoint = '/api/chat'; // Default endpoint
  let requestData = data || {};
  
  if (customEndpointMappings && endpoint) {
    const mapping = customEndpointMappings.find(m => m.sourceEndpoint === endpoint);
    if (mapping) {
      ollamaEndpoint = mapping.targetEndpoint;
      console.log(`Mapped ${endpoint} to ${ollamaEndpoint}`);
      
      // Apply transformation if enabled
      if (mapping.transformRequest) {
        const template = getTemplateById(mapping.template || streamingConfig.streamTemplate);
        if (template && template.streamRequestTransform && template.streamRequestTransform[ollamaEndpoint]) {
          try {
            requestData = template.streamRequestTransform[ollamaEndpoint](requestData);
            console.log('Transformed request data:', requestData);
          } catch (error) {
            console.error('Error transforming request:', error);
          }
        }
      }
    }
  }
  
  // Ensure streaming is enabled in the request
  if (!requestData.stream) {
    requestData.stream = true;
  }
  
  // Make request to Ollama
  fetch(`${settings.ollamaUrl}${ollamaEndpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestData)
  })
  .then(async response => {
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    const chunkSize = streamingConfig.streamChunkSize;
    
    // Get appropriate stream format adapter based on configuration
    let streamAdapter;
    
    switch(streamFormat) {
      case 'sse':
        streamAdapter = createSSEAdapter(chunkCallback, ollamaEndpoint);
        break;
      case 'json':
        streamAdapter = createJSONAdapter(chunkCallback, ollamaEndpoint);
        break;
      case 'text':
        streamAdapter = createTextAdapter(chunkCallback, ollamaEndpoint);
        break;
      default:
        streamAdapter = createSSEAdapter(chunkCallback, ollamaEndpoint);
    }
    
    // Process stream
    function processStream() {
      reader.read().then(({ done, value }) => {
        if (done) {
          if (buffer.length > 0) {
            streamAdapter.processChunk(buffer);
          }
          streamAdapter.end();
          return;
        }
        
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        
        // Process complete JSON objects from the buffer
        let newlineIndex;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          
          if (line.trim() === '') continue;
          
          try {
            const jsonChunk = JSON.parse(line);
            streamAdapter.processChunk(jsonChunk);
          } catch (e) {
            console.error('Error parsing JSON from stream:', e, 'Line:', line);
          }
        }
        
        processStream();
      }).catch(error => {
        streamAdapter.error(error);
      });
    }
    
    processStream();
  })
  .catch(error => {
    console.error('Error in streaming request:', error);
    chunkCallback(null, false, error);
  });
}

// Stream format adapters
function createSSEAdapter(chunkCallback, endpoint) {
  const template = getTemplateById(streamingConfig.streamTemplate);
  return {
    processChunk: (chunk) => {
      // Apply transformation if available
      let transformedChunk = chunk;
      if (template && template.streamResponseTransform && template.streamResponseTransform[endpoint]) {
        try {
          transformedChunk = template.streamResponseTransform[endpoint](chunk);
        } catch (error) {
          console.error('Error transforming streaming response:', error);
        }
      }
      
      chunkCallback(transformedChunk, false, null);
    },
    end: () => {
      chunkCallback(null, true, null);
    },
    error: (error) => {
      chunkCallback(null, false, error);
    }
  };
}

function createJSONAdapter(chunkCallback, endpoint) {
  const template = getTemplateById(streamingConfig.streamTemplate);
  return {
    processChunk: (chunk) => {
      // Apply transformation if available
      let transformedChunk = chunk;
      if (template && template.streamResponseTransform && template.streamResponseTransform[endpoint]) {
        try {
          transformedChunk = template.streamResponseTransform[endpoint](chunk);
        } catch (error) {
          console.error('Error transforming streaming response:', error);
        }
      }
      
      chunkCallback(transformedChunk, false, null);
    },
    end: () => {
      chunkCallback(null, true, null);
    },
    error: (error) => {
      chunkCallback(null, false, error);
    }
  };
}

function createTextAdapter(chunkCallback, endpoint) {
  const template = getTemplateById(streamingConfig.streamTemplate);
  let textBuffer = '';
  
  return {
    processChunk: (chunk) => {
      // Extract text content from the chunk
      let content = '';
      if (chunk.response) {
        content = chunk.response;
      } else if (chunk.message && chunk.message.content) {
        content = chunk.message.content;
      } else if (chunk.delta && chunk.delta.content) {
        content = chunk.delta.content;
      }
      
      textBuffer += content;
      
      // Send when buffer reaches configured chunk size
      if (textBuffer.length >= streamingConfig.streamChunkSize) {
        chunkCallback(textBuffer, false, null);
        textBuffer = '';
      }
    },
    end: () => {
      // Send any remaining text in buffer
      if (textBuffer.length > 0) {
        chunkCallback(textBuffer, false, null);
      }
      
      chunkCallback(null, true, null);
    },
    error: (error) => {
      chunkCallback(null, false, error);
    }
  };
}

// Helper function to get template by ID
function getTemplateById(templateId) {
  if (DEFAULT_TEMPLATES[templateId]) {
    return DEFAULT_TEMPLATES[templateId];
  }
  return DEFAULT_TEMPLATES['default'];
} 