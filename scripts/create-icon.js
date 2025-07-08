// Simple script to create a basic PNG icon
// This creates a basic icon using Canvas API (if available in Node.js environment)
// For now, we'll update package.json to use a simpler approach

const fs = require('fs');
const path = require('path');

// Create a simple text-based icon description
const iconInfo = `
# Extension Icon

The extension uses a Git branch and folder icon to represent worktree management.

To create the actual PNG icon:
1. Use the SVG file in images/icon.svg
2. Convert to PNG (128x128) using any SVG to PNG converter
3. Or use online tools like:
   - https://convertio.co/svg-png/
   - https://cloudconvert.com/svg-to-png

For development, we can temporarily remove the icon property from package.json
or create a simple placeholder.
`;

// Write the info file
fs.writeFileSync(path.join(__dirname, '..', 'images', 'icon-info.txt'), iconInfo);

console.log('Icon info created. Please convert the SVG to PNG manually for now.');
