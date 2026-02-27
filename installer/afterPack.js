const path = require('path');
const { execSync } = require('child_process');
const fs = require('fs');

exports.default = async function (context) {
    // Only apply this fix on macOS builds
    if (context.electronPlatformName !== 'darwin') {
        return;
    }

    console.log('\n[afterPack] ========================================');
    console.log('[afterPack] STARTING SYMLINK PRESERVATION HOOK');

    const appOutDir = context.appOutDir;
    const appName = context.packager.appInfo.productFilename;
    const resourcesPath = path.join(appOutDir, `${appName}.app`, 'Contents', 'Resources');

    // The backend was copied by electron-builder's extraResources, but symlinks are broken.
    // We need to re-copy the _internal directory using 'ditto' which preserves symlinks natively.
    const targetInternalDir = path.join(resourcesPath, 'backend', 'dist', 'voxis_backend', '_internal');
    const sourceInternalDir = path.resolve(context.packager.projectDir, '..', 'backend', 'dist', 'voxis_backend', '_internal');

    if (fs.existsSync(sourceInternalDir)) {
        console.log(`[afterPack] Found source _internal at: ${sourceInternalDir}`);

        // Check if target exists and remove it first, so ditto starts fresh
        if (fs.existsSync(targetInternalDir)) {
            console.log(`[afterPack] Removing broken _internal directory...`);
            fs.rmSync(targetInternalDir, { recursive: true, force: true });
        }

        console.log(`[afterPack] Copying _internal using ditto (preserves symlinks)...`);
        try {
            // ditto natively preserves all symlinks, permissions, and extended attributes
            execSync(`ditto "${sourceInternalDir}" "${targetInternalDir}"`, { stdio: 'inherit' });
            console.log(`[afterPack] ✅ Successfully copied _internal with symlinks intact.`);

            // Let's verify the Python symlink specifically since it routinely breaks
            const targetPythonLink = path.join(targetInternalDir, 'Python');
            if (fs.existsSync(targetPythonLink) && fs.lstatSync(targetPythonLink).isSymbolicLink()) {
                const target = fs.readlinkSync(targetPythonLink);
                console.log(`[afterPack] Verified Python is a symlink -> ${target}`);
            } else {
                console.warn(`[afterPack] ⚠️ Python symlink verification failed (expected a symlink).`);
            }
        } catch (e) {
            console.error(`[afterPack] ❌ Failed to run ditto:`, e.message);
        }
    } else {
        console.warn(`[afterPack] ⚠️ Source _internal directory not found at ${sourceInternalDir}`);
    }

    console.log('[afterPack] ========================================\n');
};
