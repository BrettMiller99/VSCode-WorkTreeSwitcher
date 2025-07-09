#!/usr/bin/env node

/**
 * Convert SVG icon to PNG for VS Code extension
 * This script converts the SVG icon to PNG format required by VS Code marketplace
 */

const fs = require('fs');
const path = require('path');

// Check if we have the required dependencies
try {
    const sharp = require('sharp');
    console.log('✅ Sharp is available for SVG to PNG conversion');
} catch (error) {
    console.log('❌ Sharp not found. Installing...');
    console.log('Run: npm install --save-dev sharp');
    console.log('Then run this script again.');
    process.exit(1);
}

async function convertSvgToPng() {
    const sharp = require('sharp');
    
    const svgPath = path.join(__dirname, 'images', 'icon.svg');
    const pngPath = path.join(__dirname, 'images', 'icon.png');
    
    try {
        // Check if SVG exists
        if (!fs.existsSync(svgPath)) {
            console.error('❌ SVG icon not found at:', svgPath);
            process.exit(1);
        }
        
        // Convert SVG to PNG
        await sharp(svgPath)
            .resize(128, 128)
            .png()
            .toFile(pngPath);
            
        console.log('✅ Successfully converted SVG to PNG');
        console.log('📁 PNG icon saved at:', pngPath);
        
        // Verify the file was created
        const stats = fs.statSync(pngPath);
        console.log('📊 File size:', Math.round(stats.size / 1024), 'KB');
        
    } catch (error) {
        console.error('❌ Error converting SVG to PNG:', error.message);
        process.exit(1);
    }
}

// Run the conversion
convertSvgToPng().catch(console.error);
