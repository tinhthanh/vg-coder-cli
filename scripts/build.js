const AdmZip = require('adm-zip');
const path = require('path');
const fs = require('fs-extra');
const { execSync } = require('child_process');

async function build() {
    try {
        const rootDir = path.resolve(__dirname, '..');
        const extensionSourceDir = path.join(rootDir, 'vetgo-auto', 'chrome', 'dist');
        const extensionWorkspaceDir = path.join(rootDir, 'vetgo-auto');
        const zipPath = path.join(rootDir, 'vg-coder.zip');
        const targetDir = path.join(rootDir, 'src', 'server', 'views', 'vg-coder');

        console.log('🏗️  Starting build process...');

        // Strategy 1: Try to build and copy from vetgo-auto/chrome/dist
        if (fs.existsSync(extensionWorkspaceDir)) {
            console.log('📦 Found vetgo-auto workspace. Building extension...');
            
            try {
                // Build the extension
                console.log('🔨 Running: cd vetgo-auto && npm run build');
                execSync('npm run build', {
                    cwd: extensionWorkspaceDir,
                    stdio: 'inherit'
                });

                // Check if dist directory exists
                if (fs.existsSync(extensionSourceDir)) {
                    console.log('✅ Extension built successfully at:', extensionSourceDir);
                    
                    // Clean old directory
                    if (fs.existsSync(targetDir)) {
                        console.log('🧹 Cleaning old extension directory...');
                        fs.removeSync(targetDir);
                    }

                    // Copy built extension
                    console.log('📋 Copying extension to:', targetDir);
                    fs.copySync(extensionSourceDir, targetDir);
                    
                    console.log('✅ Extension copied successfully!');
                    console.log('🚀 Build completed successfully!');
                    return;
                } else {
                    console.warn('⚠️  Extension dist directory not found. Falling back to zip extraction...');
                }
            } catch (buildError) {
                console.warn('⚠️  Extension build failed:', buildError.message);
                console.warn('⚠️  Falling back to zip extraction...');
            }
        } else {
            console.log('ℹ️  vetgo-auto workspace not found. Using zip file...');
        }

        // Strategy 2: Fallback to zip extraction (for npm package users)
        if (!fs.existsSync(zipPath)) {
            console.error('❌ vg-coder.zip not found and extension build failed.');
            console.error('❌ Cannot proceed with build.');
            process.exit(1);
        }

        // Clean old directory
        if (fs.existsSync(targetDir)) {
            console.log('🧹 Cleaning old extension directory...');
            fs.removeSync(targetDir);
        }

        // Unzip
        console.log('📦 Unzipping vg-coder.zip...');
        const zip = new AdmZip(zipPath);
        zip.extractAllTo(targetDir, true);

        console.log(`✅ Extension extracted to: ${targetDir}`);
        console.log('🚀 Build completed successfully!');

    } catch (error) {
        console.error('❌ Build failed:', error);
        process.exit(1);
    }
}

build();
