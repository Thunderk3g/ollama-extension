#!/bin/bash

echo "Packaging Ollama Bridge Extension for Chrome Web Store..."
echo

echo "Creating zip file..."
zip -r ollama-bridge-extension.zip manifest.json background.js content.js popup/ icons/ README.md

echo
echo "Done! Your extension package is ready: ollama-bridge-extension.zip"
echo
echo "Before submitting to the Chrome Web Store:"
echo "1. Make sure you have created proper icon PNG files"
echo "2. Update contact information in privacy-policy.html"
echo "3. Prepare screenshots and promotional images as per store-listing.md"
echo

read -p "Press Enter to continue..." 