/**
 * Ollama Bridge Extension - Website Integration Example
 * 
 * This file demonstrates how to integrate with the Ollama Bridge extension
 * from your website. Copy the relevant parts to your portfolio site.
 */

// Check if the Ollama Bridge extension is installed
function checkOllamaBridgeExtension() {
  // First, check if the extension object is available
  if (window.OllamaBridge && window.OllamaBridge.isAvailable) {
    console.log('Ollama Bridge extension is detected!');
    return true;
  } else {
    console.log('Ollama Bridge extension is not installed.');
    return false;
  }
}

// Get the current status of the Ollama Bridge extension
async function getOllamaBridgeStatus() {
  if (!window.OllamaBridge) return null;
  
  try {
    const status = await window.OllamaBridge.getStatus();
    console.log('Ollama Bridge status:', status);
    return status;
  } catch (error) {
    console.error('Error getting Ollama Bridge status:', error);
    return null;
  }
}

// Listen for extension status changes
function setupStatusChangeListener() {
  document.addEventListener('ollama-bridge-settings-changed', (event) => {
    console.log('Ollama Bridge settings changed:', event.detail);
    
    // You might want to update UI elements based on the new status
    updateUI(event.detail);
  });
}

// Example function to update UI based on extension status
function updateUI(status) {
  const statusElement = document.getElementById('ollama-status');
  if (!statusElement) return;
  
  if (status.isEnabled) {
    statusElement.textContent = 'Connected to Ollama';
    statusElement.className = 'status-connected';
  } else {
    statusElement.textContent = 'Ollama Bridge is disabled';
    statusElement.className = 'status-disconnected';
  }
}

// Example function to make a request to the Ollama API
async function fetchOllamaModels() {
  try {
    // This will be intercepted by the extension if installed
    const response = await fetch('http://localhost:11434/api/tags');
    
    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Available Ollama models:', data);
    return data;
  } catch (error) {
    console.error('Failed to fetch Ollama models:', error);
    return null;
  }
}

// Example function to generate a completion with Ollama
async function generateWithOllama(model, prompt) {
  try {
    // This will be intercepted by the extension if installed
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        prompt: prompt
      })
    });
    
    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Ollama response:', data);
    return data;
  } catch (error) {
    console.error('Failed to generate with Ollama:', error);
    return null;
  }
}

// Initialize when the page loads
document.addEventListener('DOMContentLoaded', async () => {
  // Check if extension is installed
  const isExtensionInstalled = checkOllamaBridgeExtension();
  
  // Update UI based on extension availability
  const extensionStatusElement = document.getElementById('extension-status');
  if (extensionStatusElement) {
    extensionStatusElement.textContent = isExtensionInstalled 
      ? 'Ollama Bridge extension is installed'
      : 'Ollama Bridge extension is not installed';
    extensionStatusElement.className = isExtensionInstalled
      ? 'status-available'
      : 'status-unavailable';
  }
  
  // Get current status if extension is available
  if (isExtensionInstalled) {
    const status = await getOllamaBridgeStatus();
    if (status) {
      updateUI(status);
    }
    
    // Set up listener for status changes
    setupStatusChangeListener();
    
    // Example: Load available models
    const models = await fetchOllamaModels();
    if (models && models.models) {
      // Update a select dropdown with available models
      const modelSelect = document.getElementById('model-select');
      if (modelSelect) {
        modelSelect.innerHTML = '';
        models.models.forEach(model => {
          const option = document.createElement('option');
          option.value = model.name;
          option.textContent = model.name;
          modelSelect.appendChild(option);
        });
      }
    }
  }
});

// Example: Hook up a form for generating text with Ollama
const generateForm = document.getElementById('generate-form');
if (generateForm) {
  generateForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    
    const modelSelect = document.getElementById('model-select');
    const promptInput = document.getElementById('prompt-input');
    const resultOutput = document.getElementById('result-output');
    
    if (!modelSelect || !promptInput || !resultOutput) return;
    
    const model = modelSelect.value;
    const prompt = promptInput.value;
    
    if (!model || !prompt) {
      alert('Please select a model and enter a prompt');
      return;
    }
    
    // Show loading state
    resultOutput.textContent = 'Generating...';
    
    // Generate the response
    const result = await generateWithOllama(model, prompt);
    
    // Update the UI with the result
    if (result) {
      resultOutput.textContent = result.response;
    } else {
      resultOutput.textContent = 'Error generating response. Is Ollama running?';
    }
  });
} 