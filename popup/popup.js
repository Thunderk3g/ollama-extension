// DOM Elements
const enabledToggle = document.getElementById('enabled-toggle');
const statusText = document.getElementById('status-text');
const ollamaUrlInput = document.getElementById('ollama-url');
const saveUrlButton = document.getElementById('save-url');
const testConnectionButton = document.getElementById('test-connection');
const connectionStatus = document.getElementById('connection-status');

// Tab elements
const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// Endpoint mapping elements
const endpointsTable = document.getElementById('endpoints-table');
const endpointsTbody = document.getElementById('endpoints-tbody');
const addEndpointButton = document.getElementById('add-endpoint-button');
const endpointForm = document.getElementById('endpoint-form');
const formTitle = document.getElementById('form-title');
const sourceEndpointInput = document.getElementById('source-endpoint');
const targetEndpointSelect = document.getElementById('target-endpoint');
const endpointDescriptionInput = document.getElementById('endpoint-description');
const transformRequestCheckbox = document.getElementById('transform-request');
const defaultModelInput = document.getElementById('default-model');
const systemPromptInput = document.getElementById('system-prompt');
const saveEndpointButton = document.getElementById('save-endpoint');
const cancelEndpointButton = document.getElementById('cancel-endpoint');
const mappingIdInput = document.getElementById('mapping-id');

// Model management elements
const refreshModelsButton = document.getElementById('refresh-models');
const modelsList = document.getElementById('models-list');
const defaultModelSelect = document.getElementById('default-model-select');
const saveDefaultModelButton = document.getElementById('save-default-model');
const modelParamsForm = document.getElementById('model-params-form');
const currentModelName = document.getElementById('current-model-name');

// Model parameter elements
const paramTemperature = document.getElementById('param-temperature');
const paramTemperatureValue = document.getElementById('param-temperature-value');
const paramTopP = document.getElementById('param-top-p');
const paramTopPValue = document.getElementById('param-top-p-value');
const paramTopK = document.getElementById('param-top-k');
const paramTopKValue = document.getElementById('param-top-k-value');
const paramMaxTokens = document.getElementById('param-max-tokens');
const paramSystemPrompt = document.getElementById('param-system-prompt');
const saveModelParamsButton = document.getElementById('save-model-params');
const resetModelParamsButton = document.getElementById('reset-model-params');

// Default Ollama URL
const DEFAULT_OLLAMA_URL = 'http://localhost:11434';

// Global state
let customEndpointMappings = [];
let isEditingMapping = false;
let availableModels = [];
let selectedModel = null;
let defaultModel = 'llama3';
let modelPresets = {};

// Load settings when popup opens
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  testOllamaConnection();
  setupTabHandlers();
  setupModelParameterHandlers();
  initStreamingTab();
});

// Setup tab switching
function setupTabHandlers() {
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Remove active class from all buttons and contents
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      // Add active class to clicked button and corresponding content
      button.classList.add('active');
      const tabId = button.dataset.tab;
      document.getElementById(`${tabId}-tab`).classList.add('active');
      
      // If models tab selected, refresh models if empty
      if (tabId === 'models' && (!availableModels || availableModels.length === 0)) {
        discoverModels();
      }
    });
  });
}

// Setup model parameter sliders
function setupModelParameterHandlers() {
  // Temperature slider
  paramTemperature.addEventListener('input', () => {
    paramTemperatureValue.textContent = paramTemperature.value;
  });
  
  // Top P slider
  paramTopP.addEventListener('input', () => {
    paramTopPValue.textContent = paramTopP.value;
  });
  
  // Top K slider
  paramTopK.addEventListener('input', () => {
    paramTopKValue.textContent = paramTopK.value;
  });
  
  // Save parameters button
  saveModelParamsButton.addEventListener('click', () => {
    saveModelParameters();
  });
  
  // Reset parameters button
  resetModelParamsButton.addEventListener('click', () => {
    resetModelParameters();
  });
}

// Save settings when toggle is clicked
enabledToggle.addEventListener('change', () => {
  const isEnabled = enabledToggle.checked;
  statusText.textContent = isEnabled ? 'Enabled' : 'Disabled';
  
  chrome.runtime.sendMessage({
    type: 'UPDATE_SETTINGS',
    isEnabled
  });
});

// Save Ollama URL when save button is clicked
saveUrlButton.addEventListener('click', () => {
  const ollamaUrl = ollamaUrlInput.value.trim() || DEFAULT_OLLAMA_URL;
  
  // Validate URL format
  if (!isValidUrl(ollamaUrl)) {
    alert('Please enter a valid URL (e.g., http://localhost:11434)');
    return;
  }
  
  // Save the URL
  chrome.runtime.sendMessage({
    type: 'UPDATE_SETTINGS',
    ollamaUrl
  }, () => {
    // Show feedback
    saveUrlButton.textContent = 'Saved!';
    setTimeout(() => {
      saveUrlButton.textContent = 'Save';
    }, 1500);
    
    // Test connection with new URL
    testOllamaConnection();
    
    // Refresh models with new URL
    discoverModels();
  });
});

// Test connection when button is clicked
testConnectionButton.addEventListener('click', () => {
  testOllamaConnection();
});

// Add endpoint button click
addEndpointButton.addEventListener('click', () => {
  showEndpointForm(false);
});

// Save endpoint button click
saveEndpointButton.addEventListener('click', () => {
  saveEndpointMapping();
});

// Cancel endpoint form button click
cancelEndpointButton.addEventListener('click', () => {
  hideEndpointForm();
});

// Refresh models button click
refreshModelsButton.addEventListener('click', () => {
  discoverModels();
});

// Save default model button click
saveDefaultModelButton.addEventListener('click', () => {
  const modelName = defaultModelSelect.value;
  if (!modelName) {
    alert('Please select a model');
    return;
  }
  
  setDefaultModel(modelName);
});

// Load settings from storage
function loadSettings() {
  chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Error loading settings:', chrome.runtime.lastError);
      return;
    }
    
    // Update toggle state
    enabledToggle.checked = response.isEnabled;
    statusText.textContent = response.isEnabled ? 'Enabled' : 'Disabled';
    
    // Update URL input
    ollamaUrlInput.value = response.ollamaUrl || DEFAULT_OLLAMA_URL;
    
    // Load endpoint mappings
    customEndpointMappings = response.customEndpointMappings || [];
    renderEndpointMappings();
    
    // Load model-related settings
    availableModels = response.availableModels || [];
    defaultModel = response.defaultModel || 'llama3';
    modelPresets = response.modelPresets || {};
    
    // Render models
    renderModels();
    updateDefaultModelSelect();
  });
}

// Test connection to Ollama API
function testOllamaConnection() {
  connectionStatus.textContent = 'Checking...';
  connectionStatus.className = '';
  
  chrome.runtime.sendMessage({
    type: 'OLLAMA_API_REQUEST',
    endpoint: '/api/tags',
    method: 'GET'
  }, (response) => {
    if (chrome.runtime.lastError) {
      showConnectionError(chrome.runtime.lastError.message);
      return;
    }
    
    if (!response || !response.success) {
      showConnectionError(response?.error || 'Unknown error');
      return;
    }
    
    // Success
    connectionStatus.textContent = 'Connected';
    connectionStatus.className = 'connected';
    
    // Refresh models if empty
    if (!availableModels || availableModels.length === 0) {
      discoverModels();
    }
  });
}

// Show connection error
function showConnectionError(errorMessage) {
  console.error('Connection error:', errorMessage);
  connectionStatus.textContent = 'Disconnected';
  connectionStatus.className = 'disconnected';
  
  // Show tooltip with error details (optional)
  connectionStatus.title = `Error: ${errorMessage}`;
}

// Validate URL format
function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
}

// Render endpoint mappings table
function renderEndpointMappings() {
  // Clear the table body
  endpointsTbody.innerHTML = '';
  
  // If no mappings, show empty state
  if (!customEndpointMappings.length) {
    const emptyRow = document.createElement('tr');
    emptyRow.className = 'empty-row';
    emptyRow.innerHTML = `<td colspan="4">No custom endpoints configured</td>`;
    endpointsTbody.appendChild(emptyRow);
    return;
  }
  
  // Add each mapping to the table
  customEndpointMappings.forEach(mapping => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${mapping.sourceEndpoint}</td>
      <td>${mapping.targetEndpoint}</td>
      <td>${mapping.description || '-'}</td>
      <td>
        <div class="action-buttons">
          <button class="action-button edit-button" data-id="${mapping.id}">Edit</button>
          <button class="action-button delete-button" data-id="${mapping.id}">Delete</button>
        </div>
      </td>
    `;
    
    // Add event listeners for edit and delete buttons
    const editButton = row.querySelector('.edit-button');
    editButton.addEventListener('click', () => {
      editEndpointMapping(mapping.id);
    });
    
    const deleteButton = row.querySelector('.delete-button');
    deleteButton.addEventListener('click', () => {
      deleteEndpointMapping(mapping.id);
    });
    
    endpointsTbody.appendChild(row);
  });
}

// Show endpoint form for add or edit
function showEndpointForm(isEditing, mappingId = null) {
  isEditingMapping = isEditing;
  formTitle.textContent = isEditing ? 'Edit Endpoint Mapping' : 'Add Endpoint Mapping';
  
  // Clear form fields
  if (!isEditing) {
    sourceEndpointInput.value = '';
    targetEndpointSelect.value = '/api/chat';
    endpointDescriptionInput.value = '';
    transformRequestCheckbox.checked = true;
    defaultModelInput.value = '';
    systemPromptInput.value = '';
    mappingIdInput.value = '';
  } else {
    // Find the mapping and populate the form
    const mapping = customEndpointMappings.find(m => m.id === mappingId);
    if (mapping) {
      sourceEndpointInput.value = mapping.sourceEndpoint || '';
      targetEndpointSelect.value = mapping.targetEndpoint || '/api/chat';
      endpointDescriptionInput.value = mapping.description || '';
      transformRequestCheckbox.checked = mapping.transformRequest !== false;
      defaultModelInput.value = mapping.defaultModel || '';
      systemPromptInput.value = mapping.systemPrompt || '';
      mappingIdInput.value = mapping.id;
    }
  }
  
  // Show the form
  endpointForm.classList.remove('hidden');
  sourceEndpointInput.focus();
  
  // Scroll to the form
  endpointForm.scrollIntoView({ behavior: 'smooth' });
}

// Hide endpoint form
function hideEndpointForm() {
  endpointForm.classList.add('hidden');
}

// Save endpoint mapping
function saveEndpointMapping() {
  // Validate inputs
  const sourceEndpoint = sourceEndpointInput.value.trim();
  if (!sourceEndpoint) {
    alert('Source endpoint is required');
    sourceEndpointInput.focus();
    return;
  }
  
  if (!sourceEndpoint.startsWith('/')) {
    alert('Source endpoint must start with /');
    sourceEndpointInput.focus();
    return;
  }
  
  // Get form values
  const targetEndpoint = targetEndpointSelect.value;
  const description = endpointDescriptionInput.value.trim();
  const transformRequest = transformRequestCheckbox.checked;
  const defaultModel = defaultModelInput.value.trim();
  const systemPrompt = systemPromptInput.value.trim();
  
  // Create mapping object
  const mapping = {
    sourceEndpoint,
    targetEndpoint,
    description,
    transformRequest,
    defaultModel,
    systemPrompt
  };
  
  if (isEditingMapping) {
    // Update existing mapping
    mapping.id = mappingIdInput.value;
    
    chrome.runtime.sendMessage({
      type: 'MANAGE_ENDPOINT_MAPPING',
      action: 'update',
      mapping
    }, (response) => {
      if (response && response.success) {
        customEndpointMappings = response.data;
        renderEndpointMappings();
        hideEndpointForm();
      } else {
        alert(`Error updating endpoint mapping: ${response?.error || 'Unknown error'}`);
      }
    });
  } else {
    // Add new mapping
    chrome.runtime.sendMessage({
      type: 'MANAGE_ENDPOINT_MAPPING',
      action: 'add',
      mapping
    }, (response) => {
      if (response && response.success) {
        customEndpointMappings = response.data;
        renderEndpointMappings();
        hideEndpointForm();
      } else {
        alert(`Error adding endpoint mapping: ${response?.error || 'Unknown error'}`);
      }
    });
  }
}

// Edit endpoint mapping
function editEndpointMapping(mappingId) {
  showEndpointForm(true, mappingId);
}

// Delete endpoint mapping
function deleteEndpointMapping(mappingId) {
  if (confirm('Are you sure you want to delete this endpoint mapping?')) {
    chrome.runtime.sendMessage({
      type: 'MANAGE_ENDPOINT_MAPPING',
      action: 'delete',
      mapping: { id: mappingId }
    }, (response) => {
      if (response && response.success) {
        customEndpointMappings = response.data;
        renderEndpointMappings();
      } else {
        alert(`Error deleting endpoint mapping: ${response?.error || 'Unknown error'}`);
      }
    });
  }
}

// Discover available models
function discoverModels() {
  // Clear existing models
  modelsList.innerHTML = '<div class="empty-models">Loading models...</div>';
  
  chrome.runtime.sendMessage({
    type: 'DISCOVER_MODELS'
  }, (response) => {
    if (chrome.runtime.lastError) {
      showModelsError(chrome.runtime.lastError.message);
      return;
    }
    
    if (!response || !response.success) {
      showModelsError(response?.error || 'Unknown error');
      return;
    }
    
    // Update models
    availableModels = response.data;
    
    // Render models
    renderModels();
    updateDefaultModelSelect();
  });
}

// Show models error
function showModelsError(errorMessage) {
  console.error('Models error:', errorMessage);
  modelsList.innerHTML = `<div class="empty-models">Error: ${errorMessage}</div>`;
}

// Render available models
function renderModels() {
  // Clear the list
  modelsList.innerHTML = '';
  
  // If no models, show empty state
  if (!availableModels || availableModels.length === 0) {
    modelsList.innerHTML = '<div class="empty-models">No models found</div>';
    return;
  }
  
  // Add each model to the list
  availableModels.forEach(model => {
    const isDefault = model.name === defaultModel;
    const isSelected = selectedModel === model.name;
    
    const modelItem = document.createElement('div');
    modelItem.className = `model-item${isSelected ? ' selected' : ''}`;
    modelItem.dataset.model = model.name;
    
    let sizeDisplay = '';
    if (model.size) {
      // Format size (convert to GB if large enough)
      const sizeInGB = model.size / (1024 * 1024 * 1024);
      sizeDisplay = sizeInGB > 1 ? `${sizeInGB.toFixed(1)} GB` : `${(model.size / (1024 * 1024)).toFixed(0)} MB`;
    }
    
    const parametersDisplay = model.parameters ? `${(model.parameters / 1e9).toFixed(1)}B params` : '';
    
    modelItem.innerHTML = `
      <div>
        <div class="model-name">${model.name}${isDefault ? ' (Default)' : ''}</div>
        <div class="model-info">${parametersDisplay} ${sizeDisplay}</div>
      </div>
      <div class="model-actions">
        <button class="action-button configure-button" title="Configure">⚙️</button>
      </div>
    `;
    
    // Add click handler to select the model
    modelItem.addEventListener('click', (e) => {
      // Ignore if clicking the configure button
      if (e.target.closest('.configure-button')) {
        return;
      }
      
      selectModel(model.name);
    });
    
    // Add configure button handler
    const configureButton = modelItem.querySelector('.configure-button');
    configureButton.addEventListener('click', () => {
      configureModel(model.name);
    });
    
    modelsList.appendChild(modelItem);
  });
}

// Update default model select
function updateDefaultModelSelect() {
  // Clear the select
  defaultModelSelect.innerHTML = '';
  
  // If no models, show empty option
  if (!availableModels || availableModels.length === 0) {
    defaultModelSelect.innerHTML = '<option value="">No models available</option>';
    return;
  }
  
  // Add each model to the select
  availableModels.forEach(model => {
    const option = document.createElement('option');
    option.value = model.name;
    option.textContent = model.name;
    option.selected = model.name === defaultModel;
    defaultModelSelect.appendChild(option);
  });
}

// Select a model
function selectModel(modelName) {
  selectedModel = modelName;
  
  // Update UI
  const modelItems = document.querySelectorAll('.model-item');
  modelItems.forEach(item => {
    if (item.dataset.model === modelName) {
      item.classList.add('selected');
    } else {
      item.classList.remove('selected');
    }
  });
  
  // Load and display model parameters
  configureModel(modelName);
}

// Configure a model
function configureModel(modelName) {
  // Select the model first
  selectModel(modelName);
  
  // Update the form title
  currentModelName.textContent = modelName;
  
  // Get the model preset or default values
  chrome.runtime.sendMessage({
    type: 'MANAGE_MODEL',
    action: 'get_preset',
    model: { name: modelName }
  }, (response) => {
    if (response && response.success) {
      const preset = response.data.preset;
      
      // Update form fields with preset values
      paramTemperature.value = preset.temperature;
      paramTemperatureValue.textContent = preset.temperature;
      
      paramTopP.value = preset.top_p;
      paramTopPValue.textContent = preset.top_p;
      
      paramTopK.value = preset.top_k;
      paramTopKValue.textContent = preset.top_k;
      
      paramMaxTokens.value = preset.max_tokens;
      
      paramSystemPrompt.value = preset.system_prompt || '';
      
      // Scroll to the parameters form
      modelParamsForm.scrollIntoView({ behavior: 'smooth' });
    }
  });
}

// Save model parameters
function saveModelParameters() {
  if (!selectedModel) {
    alert('Please select a model first');
    return;
  }
  
  // Get form values
  const temperature = parseFloat(paramTemperature.value);
  const top_p = parseFloat(paramTopP.value);
  const top_k = parseInt(paramTopK.value);
  const max_tokens = parseInt(paramMaxTokens.value);
  const system_prompt = paramSystemPrompt.value.trim();
  
  // Create model preset object
  const modelPreset = {
    name: selectedModel,
    temperature,
    top_p,
    top_k,
    max_tokens,
    system_prompt
  };
  
  // Save the preset
  chrome.runtime.sendMessage({
    type: 'MANAGE_MODEL',
    action: 'save_preset',
    model: modelPreset
  }, (response) => {
    if (response && response.success) {
      // Update global state
      modelPresets = response.data.presets;
      
      // Show feedback
      saveModelParamsButton.textContent = 'Saved!';
      setTimeout(() => {
        saveModelParamsButton.textContent = 'Save Parameters';
      }, 1500);
    } else {
      alert(`Error saving model parameters: ${response?.error || 'Unknown error'}`);
    }
  });
}

// Reset model parameters to defaults
function resetModelParameters() {
  if (!selectedModel) {
    return;
  }
  
  // Set default values
  paramTemperature.value = 0.7;
  paramTemperatureValue.textContent = 0.7;
  
  paramTopP.value = 0.9;
  paramTopPValue.textContent = 0.9;
  
  paramTopK.value = 40;
  paramTopKValue.textContent = 40;
  
  paramMaxTokens.value = 2048;
  
  paramSystemPrompt.value = '';
}

// Set default model
function setDefaultModel(modelName) {
  chrome.runtime.sendMessage({
    type: 'MANAGE_MODEL',
    action: 'set_default',
    model: { name: modelName }
  }, (response) => {
    if (response && response.success) {
      // Update global state
      defaultModel = modelName;
      
      // Update UI
      renderModels();
      
      // Show feedback
      saveDefaultModelButton.textContent = 'Saved!';
      setTimeout(() => {
        saveDefaultModelButton.textContent = 'Set Default';
      }, 1500);
    } else {
      alert(`Error setting default model: ${response?.error || 'Unknown error'}`);
    }
  });
}

// Streaming Configuration Tab
function initStreamingTab() {
  const enableStreamingCheckbox = document.getElementById('enable-streaming');
  const streamFormatSelect = document.getElementById('stream-format-select');
  const streamChunkSizeInput = document.getElementById('stream-chunk-size');
  const streamTemplateSelect = document.getElementById('stream-template-select');
  const saveStreamingConfigButton = document.getElementById('save-streaming-config');
  const resetStreamingConfigButton = document.getElementById('reset-streaming-config');

  // Load current streaming settings
  chrome.storage.local.get({
    streamingEnabled: true,
    streamFormat: 'sse',
    streamChunkSize: 20,
    streamTemplate: 'default'
  }, function(config) {
    enableStreamingCheckbox.checked = config.streamingEnabled;
    streamFormatSelect.value = config.streamFormat;
    streamChunkSizeInput.value = config.streamChunkSize;
    streamTemplateSelect.value = config.streamTemplate;
  });

  // Save streaming configuration
  saveStreamingConfigButton.addEventListener('click', function() {
    const config = {
      streamingEnabled: enableStreamingCheckbox.checked,
      streamFormat: streamFormatSelect.value,
      streamChunkSize: parseInt(streamChunkSizeInput.value, 10) || 20,
      streamTemplate: streamTemplateSelect.value
    };

    chrome.storage.local.set(config, function() {
      showToast('Streaming configuration saved');
      
      // Broadcast the settings update to the background script
      chrome.runtime.sendMessage({
        action: 'updateStreamingConfig',
        config: config
      });
    });
  });

  // Reset to defaults
  resetStreamingConfigButton.addEventListener('click', function() {
    const defaultConfig = {
      streamingEnabled: true,
      streamFormat: 'sse',
      streamChunkSize: 20,
      streamTemplate: 'default'
    };

    // Update the UI
    enableStreamingCheckbox.checked = defaultConfig.streamingEnabled;
    streamFormatSelect.value = defaultConfig.streamFormat;
    streamChunkSizeInput.value = defaultConfig.streamChunkSize;
    streamTemplateSelect.value = defaultConfig.streamTemplate;

    // Save to storage
    chrome.storage.local.set(defaultConfig, function() {
      showToast('Streaming configuration reset to defaults');
      
      // Broadcast the settings update
      chrome.runtime.sendMessage({
        action: 'updateStreamingConfig',
        config: defaultConfig
      });
    });
  });
} 