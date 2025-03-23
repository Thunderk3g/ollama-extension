// DOM Elements
const enabledToggle = document.getElementById('enabled-toggle');
const statusText = document.getElementById('status-text');
const ollamaUrlInput = document.getElementById('ollama-url');
const saveUrlButton = document.getElementById('save-url');
const testConnectionButton = document.getElementById('test-connection');
const connectionStatus = document.getElementById('connection-status');

// Default Ollama URL
const DEFAULT_OLLAMA_URL = 'http://localhost:11434';

// Load settings when popup opens
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  testOllamaConnection();
});

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
  });
});

// Test connection when button is clicked
testConnectionButton.addEventListener('click', () => {
  testOllamaConnection();
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