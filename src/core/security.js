/**
 * Security utilities for XSS prevention and input validation
 */

/**
 * Escape HTML to prevent XSS attacks
 * @param {string} text - Text to escape
 * @returns {string} - Escaped HTML
 */
function escapeHtml(text) {
    if (typeof text !== 'string') return '';
    
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
        '/': '&#x2F;'
    };
    
    return text.replace(/[&<>"'\/]/g, (s) => map[s]);
}

/**
 * Sanitize user input for display
 * @param {string} input - User input to sanitize
 * @returns {string} - Sanitized input
 */
function sanitizeInput(input) {
    if (typeof input !== 'string') return '';
    
    // Remove potential script tags and dangerous attributes
    return input
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
        .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
        .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
        .replace(/on\w+\s*=/gi, '') // Remove event handlers
        .trim();
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} - Is valid email
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Validate project name
 * @param {string} name - Project name to validate
 * @returns {boolean} - Is valid project name
 */
function isValidProjectName(name) {
    if (!name || typeof name !== 'string') return false;
    if (name.length < 2 || name.length > 100) return false;
    if (!/^[a-zA-Z0-9\s\-_\.]+$/.test(name)) return false;
    return true;
}

/**
 * Validate space name
 * @param {string} name - Space name to validate
 * @returns {boolean} - Is valid space name
 */
function isValidSpaceName(name) {
    if (!name || typeof name !== 'string') return false;
    if (name.length < 1 || name.length > 50) return false;
    return true;
}

/**
 * Validate trade/company name
 * @param {string} trade - Trade name to validate
 * @returns {boolean} - Is valid trade name
 */
function isValidTrade(trade) {
    if (!trade || typeof trade !== 'string') return false;
    if (trade.length < 1 || trade.length > 100) return false;
    return true;
}

/**
 * Log security events
 * @param {string} event - Security event type
 * @param {string} details - Event details
 * @param {Object} data - Additional data
 */
function logSecurityEvent(event, details, data = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        event,
        details,
        data,
        userAgent: navigator.userAgent,
        url: window.location.href
    };
    
    console.warn('SECURITY EVENT:', logEntry);
    
    // In production, you might want to send this to a logging service
    // Example: sendToLoggingService(logEntry);
}

/**
 * Validate and sanitize form data
 * @param {Object} formData - Form data to validate
 * @returns {Object} - Validated and sanitized data
 */
function validateFormData(formData) {
    const validated = {};
    const errors = [];
    
    // Validate project name
    if (formData.projectName) {
        if (isValidProjectName(formData.projectName)) {
            validated.projectName = sanitizeInput(formData.projectName);
        } else {
            errors.push('Invalid project name');
        }
    }
    
    // Validate space name
    if (formData.spaceName) {
        if (isValidSpaceName(formData.spaceName)) {
            validated.spaceName = sanitizeInput(formData.spaceName);
        } else {
            errors.push('Invalid space name');
        }
    }
    
    // Validate trade
    if (formData.trade) {
        if (isValidTrade(formData.trade)) {
            validated.trade = sanitizeInput(formData.trade);
        } else {
            errors.push('Invalid trade name');
        }
    }
    
    // Validate description
    if (formData.description) {
        validated.description = sanitizeInput(formData.description);
    }
    
    return {
        data: validated,
        errors: errors,
        isValid: errors.length === 0
    };
}

// Make functions globally available
window.escapeHtml = escapeHtml;
window.sanitizeInput = sanitizeInput;
window.isValidEmail = isValidEmail;
window.isValidProjectName = isValidProjectName;
window.isValidSpaceName = isValidSpaceName;
window.isValidTrade = isValidTrade;
window.logSecurityEvent = logSecurityEvent;
window.validateFormData = validateFormData;
