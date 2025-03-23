/**
 * Icon Generator for Ollama Bridge Extension
 * 
 * This script generates simple PNG icons for testing the extension.
 * Run this script in a browser console to generate and download the icons.
 * 
 * Usage:
 * 1. Open a browser tab
 * 2. Open developer console (F12 or right-click > Inspect > Console)
 * 3. Copy and paste this entire script
 * 4. Press Enter to run
 * 5. Three icon files will be downloaded: icon16.png, icon48.png, and icon128.png
 * 6. Move these files to your extension's 'icons' folder
 */

function generateIcon(size) {
  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  
  // Background
  ctx.fillStyle = '#4a69bd';
  ctx.fillRect(0, 0, size, size);
  
  // Draw a simple bridge icon
  ctx.strokeStyle = 'white';
  ctx.lineWidth = Math.max(2, size / 16);
  
  // Bridge arch
  ctx.beginPath();
  ctx.moveTo(size * 0.2, size * 0.75);
  ctx.quadraticCurveTo(size * 0.5, size * 0.35, size * 0.8, size * 0.75);
  ctx.stroke();
  
  // Bridge deck
  ctx.beginPath();
  ctx.moveTo(size * 0.1, size * 0.75);
  ctx.lineTo(size * 0.9, size * 0.75);
  ctx.stroke();
  
  // Draw Ollama-like symbol
  const circleSize = size * 0.15;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(size * 0.5, size * 0.45, circleSize, 0, Math.PI * 2);
  ctx.fill();
  
  // Convert to data URL and return
  return canvas.toDataURL('image/png');
}

function downloadIcon(size) {
  const iconData = generateIcon(size);
  const link = document.createElement('a');
  link.href = iconData;
  link.download = `icon${size}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  console.log(`Icon ${size}x${size} generated and download started`);
}

// Generate and download icons
function generateAllIcons() {
  downloadIcon(16);
  downloadIcon(48);
  downloadIcon(128);
  console.log('All icons generated. Move these files to your extension\'s "icons" folder.');
}

// Run the generator
generateAllIcons();

// Instructions for use
console.log(`
Ollama Bridge Icon Generator

Three icon files should now be downloading:
- icon16.png
- icon48.png
- icon128.png

Once downloaded, move these files to your extension's "icons" folder.
Reload your extension in Chrome to see the new icons.

For production use, you should create professional icons using image editing software.
`); 