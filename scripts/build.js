const AdmZip = require('adm-zip');
const path = require('path');
const fs = require('fs-extra');

async function build() {
    try {
        const rootDir = path.resolve(__dirname, '..');
        const zipPath = path.join(rootDir, 'vg-coder.zip');
        const targetDir = path.join(rootDir, 'src', 'server', 'views', 'vg-coder');

        console.log('🏗️  Starting build process...');

        // 1. Check if zip exists
        if (!fs.existsSync(zipPath)) {
            console.error('⚠️  vg-coder.zip not found at root. Skipping extension extraction.');
            // We don't exit 1 here to allow build to continue if zip is missing in dev
            return;
        }

        // 2. Clean old directory
        if (fs.existsSync(targetDir)) {
            console.log('🧹 Cleaning old extension directory...');
            fs.removeSync(targetDir);
        }

        // 3. Unzip
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
