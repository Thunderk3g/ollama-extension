# Testing Your Ollama Bridge Extension Locally

Follow these steps to test your extension in Chrome before submitting it to the Chrome Web Store.

## Prerequisites

1. Make sure you have the following files:
   - manifest.json
   - background.js
   - content.js
   - popup directory with popup.html, popup.css, and popup.js
   - icons directory with placeholder icon files (you'll need real PNGs later)

2. Make sure Ollama is installed and running on your local machine:
   - Download Ollama from [https://ollama.ai/](https://ollama.ai/)
   - Run Ollama on its default port (11434)

## Loading the Extension in Chrome

1. Open Chrome and navigate to: `chrome://extensions/`
2. Enable "Developer mode" by toggling the switch in the top-right corner
3. Click "Load unpacked" button in the top-left corner
4. Select the folder containing your extension files
5. The extension should now appear in your extensions list

## Creating Icon Files

Before testing, you need to create actual PNG icon files:

1. Create 16x16, 48x48, and 128x128 PNG images
2. Save them as:
   - icons/icon16.png
   - icons/icon48.png  
   - icons/icon128.png
3. Reload the extension after adding these files

You can use any image editing software to create these icons. For a quick test, you can find free icons online and resize them.

## Testing the Extension

### Basic Functionality Test

1. Click on the extension icon in Chrome's toolbar
2. The popup should appear showing the settings
3. Make sure the toggle is set to "Enabled"
4. Verify the Ollama URL is set to "http://localhost:11434"

### Connection Test

1. From the extension popup, click "Test Connection"
2. If Ollama is running, you should see "Connected" in green
3. If not, check that Ollama is running properly

### Testing with Website

1. Open the included website-integration-example.html file in your browser
2. This test page should detect the extension and attempt to connect to Ollama
3. If Ollama is running with models installed, you should be able to select models and generate text

## Troubleshooting

If the extension doesn't work as expected:

1. Check Chrome's console for errors:
   - Right-click the page > Inspect > Console
   - Look for any error messages

2. Check extension permissions:
   - Go to chrome://extensions/
   - Click "Details" on your extension
   - Ensure permissions are correctly granted

3. Common issues:
   - Ollama not running (start the Ollama application)
   - Wrong port (default should be 11434)
   - No models installed in Ollama (run "ollama pull llama2" to install a model)

## Packaging for Chrome Web Store

After testing successfully:

1. Create real icon files (PNG format)
2. Update any placeholder information in files
3. Zip all the files (not the containing folder, but the files themselves)
4. Follow the Chrome Web Store submission guidelines in README.md

## Testing in Firefox (Optional)

To test in Firefox:
1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on..."
3. Select any file in your extension directory (e.g., manifest.json)
4. The extension will be installed temporarily (until Firefox is restarted) 