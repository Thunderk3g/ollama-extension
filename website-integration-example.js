/**
 * Ollama Bridge Extension - Website Integration Example
 * 
 * This file demonstrates how to integrate your website with the Ollama Bridge extension
 * to connect with a local Ollama instance from an HTTPS website.
 */

// =====================================================================
// 1. Detect if the Ollama Bridge extension is installed
// =====================================================================

// Method 1: Listen for the initialization event
document.addEventListener('ollama-bridge-initialized', () => {
  console.log('Ollama Bridge extension detected and initialized!');
  
  // You can now make Ollama API calls safely
  enableOllamaFeatures();
});

// Method 2: Check if the OllamaBridge object exists
function checkOllamaBridgeAvailability() {
  if (window.OllamaBridge && window.OllamaBridge.isAvailable) {
    console.log('Ollama Bridge extension detected!');
    enableOllamaFeatures();
    return true;
  }
  return false;
}

// Check immediately (might be too early)
const isAvailableNow = checkOllamaBridgeAvailability();

// If not available immediately, check again after a short delay
if (!isAvailableNow) {
  setTimeout(checkOllamaBridgeAvailability, 1000);
  
  // Final check after longer delay
  setTimeout(() => {
    if (!checkOllamaBridgeAvailability()) {
      console.log('Ollama Bridge extension not detected. Some features will be disabled.');
      showExtensionInstallPrompt();
    }
  }, 3000);
}

// =====================================================================
// 2. Making API calls to Ollama
// =====================================================================

// Example: Make a chat completion request
async function generateChatResponse(prompt, model = 'llama2') {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'user', content: prompt }
        ],
        stream: false
      })
    });
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error calling Ollama:', error);
    return { error: error.message };
  }
}

// Example: List available models
async function listOllamaModels() {
  try {
    const response = await fetch('/api/tags');
    const data = await response.json();
    return data.models || [];
  } catch (error) {
    console.error('Error listing Ollama models:', error);
    return [];
  }
}

// =====================================================================
// 3. UI Integration
// =====================================================================

// Enable Ollama-dependent features in your UI
function enableOllamaFeatures() {
  // Show Ollama-related UI elements
  document.querySelectorAll('.ollama-feature').forEach(el => {
    el.style.display = 'block';
  });
  
  // Populate model dropdown
  listOllamaModels().then(models => {
    const modelSelect = document.getElementById('model-select');
    if (modelSelect) {
      modelSelect.innerHTML = '';
      models.forEach(model => {
        const option = document.createElement('option');
        option.value = model.name;
        option.textContent = `${model.name} (${Math.round(model.size / 1024 / 1024 / 1024)}GB)`;
        modelSelect.appendChild(option);
      });
    }
  });
  
  // Add event listeners for AI interaction
  const chatForm = document.getElementById('chat-form');
  if (chatForm) {
    chatForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const promptInput = document.getElementById('prompt-input');
      const responseDiv = document.getElementById('response-output');
      const selectedModel = document.getElementById('model-select').value;
      
      if (promptInput && responseDiv) {
        const prompt = promptInput.value.trim();
        if (prompt) {
          responseDiv.textContent = 'Generating response...';
          const result = await generateChatResponse(prompt, selectedModel);
          responseDiv.textContent = result.message?.content || 'No response received';
        }
      }
    });
  }
}

// Show a prompt to install the extension
function showExtensionInstallPrompt() {
  const promptDiv = document.createElement('div');
  promptDiv.className = 'extension-install-prompt';
  promptDiv.innerHTML = `
    <h3>Enable AI Features</h3>
    <p>To use AI features with your local Ollama models, please install the Ollama Bridge extension:</p>
    <ol>
      <li>Download the <a href="https://github.com/Thunderk3g/ollama-extension" target="_blank">Ollama Bridge extension</a></li>
      <li>Follow the installation instructions</li>
      <li>Refresh this page</li>
    </ol>
    <button id="dismiss-prompt">Dismiss</button>
  `;
  
  document.body.appendChild(promptDiv);
  
  document.getElementById('dismiss-prompt').addEventListener('click', () => {
    promptDiv.remove();
  });
}

// =====================================================================
// 4. Advanced Features: Status Monitoring
// =====================================================================

// Listen for status changes
document.addEventListener('ollama-bridge-settings-changed', (event) => {
  const { isEnabled, ollamaUrl } = event.detail;
  console.log('Ollama Bridge settings changed:', { isEnabled, ollamaUrl });
  
  if (isEnabled) {
    enableOllamaFeatures();
  } else {
    disableOllamaFeatures();
  }
});

// Get current status
function checkConnectionStatus() {
  if (window.OllamaBridge) {
    window.OllamaBridge.getStatus()
      .then(status => {
        console.log('Ollama Bridge status:', status);
        updateStatusIndicator(status.isEnabled);
      })
      .catch(error => {
        console.error('Failed to get status:', error);
        updateStatusIndicator(false);
      });
  }
}

// Update status indicator in the UI
function updateStatusIndicator(isConnected) {
  const indicator = document.getElementById('ollama-status-indicator');
  if (indicator) {
    indicator.className = isConnected ? 'status-connected' : 'status-disconnected';
    indicator.title = isConnected ? 'Connected to Ollama' : 'Not connected to Ollama';
  }
}

// Disable Ollama features when disconnected
function disableOllamaFeatures() {
  document.querySelectorAll('.ollama-feature').forEach(el => {
    el.style.display = 'none';
  });
  
  const statusMessage = document.createElement('div');
  statusMessage.className = 'ollama-disconnected-message';
  statusMessage.textContent = 'Ollama connection is disabled. Enable it from the extension popup.';
  document.body.appendChild(statusMessage);
  
  setTimeout(() => {
    statusMessage.remove();
  }, 5000);
}

// Check status when page loads
setTimeout(checkConnectionStatus, 2000); 