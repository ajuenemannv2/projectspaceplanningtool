// ============================================================================
// DEPLOYMENT CONFIGURATION
// ============================================================================

const path = require('path');

// Environment detection
const isDevelopment = process.env.NODE_ENV !== 'production';
const isWindows = process.platform === 'win32';
const isMac = process.platform === 'darwin';
const isLinux = process.platform === 'linux';

// Base paths
const getBasePath = () => {
    if (isDevelopment) {
        return process.cwd();
    }
    
    // Production paths - adjust these for your work environment
    if (isWindows) {
        return path.join(process.env.USERPROFILE || '', 'staging-space-tool');
    } else {
        return path.join(process.env.HOME || '', 'staging-space-tool');
    }
};

// Configuration object
const config = {
    // Environment
    isDevelopment,
    isProduction: !isDevelopment,
    isWindows,
    isMac,
    isLinux,
    
    // Paths
    basePath: getBasePath(),
    dataPath: path.join(getBasePath(), 'data'),
    logsPath: path.join(getBasePath(), 'logs'),
    
    // Server
    port: process.env.PORT || 3000,
    host: process.env.HOST || 'localhost',
    
    // File paths
    files: {
        constructionCampus: 'construction-campusog.json',
        adminData: 'admin-data.json',
        activityLog: 'activity-log.json'
    },
    
    // Security
    allowedOrigins: [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        // Add your work environment URLs here
        'https://your-work-domain.com'
    ],
    
    // Logging
    logLevel: process.env.LOG_LEVEL || 'info',
    
    // Power Platform Integration
    powerPlatform: {
        endpoint: process.env.POWER_AUTOMATE_ENDPOINT || 'https://your-tenant.flow.microsoft.com/webhook/your-webhook-id',
        tenant: process.env.POWER_TENANT || 'your-tenant',
        environment: process.env.POWER_ENVIRONMENT || 'Default'
    }
};

// Helper functions
const helpers = {
    // Get absolute path for a file
    getFilePath: (filename) => {
        return path.join(config.basePath, filename);
    },
    
    // Get data file path
    getDataPath: (filename) => {
        return path.join(config.dataPath, filename);
    },
    
    // Check if file exists
    fileExists: (filepath) => {
        try {
            return require('fs').existsSync(filepath);
        } catch (error) {
            return false;
        }
    },
    
    // Create directory if it doesn't exist
    ensureDirectory: (dirPath) => {
        const fs = require('fs');
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    },
    
    // Get environment-specific settings
    getEnvironmentSettings: () => {
        if (config.isDevelopment) {
            return {
                debug: true,
                cacheControl: 'no-cache',
                cors: true
            };
        } else {
            return {
                debug: false,
                cacheControl: 'public, max-age=3600',
                cors: false
            };
        }
    }
};

// Initialize directories
helpers.ensureDirectory(config.dataPath);
helpers.ensureDirectory(config.logsPath);

module.exports = { config, helpers };
