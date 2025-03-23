@echo off
echo Packaging Ollama Bridge Extension for Chrome Web Store...
echo.

echo Creating zip file...
powershell Compress-Archive -Path manifest.json, background.js, content.js, popup/, icons/, README.md -DestinationPath ollama-bridge-extension.zip -Force

echo.
echo Done! Your extension package is ready: ollama-bridge-extension.zip
echo.
echo Before submitting to the Chrome Web Store:
echo 1. Make sure you have created proper icon PNG files
echo 2. Update contact information in privacy-policy.html
echo 3. Prepare screenshots and promotional images as per store-listing.md
echo.
pause 