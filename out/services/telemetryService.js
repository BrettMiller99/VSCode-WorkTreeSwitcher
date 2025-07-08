"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelemetryService = void 0;
const vscode = __importStar(require("vscode"));
/**
 * Service for handling telemetry data collection
 * Respects VS Code's telemetry settings and user privacy
 */
class TelemetryService {
    constructor(logger, extensionId = 'worktree-switcher') {
        this.isEnabled = false;
        this.logger = logger;
        this.extensionId = extensionId;
        this.updateTelemetryState();
        // Listen for telemetry setting changes
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('telemetry') || e.affectsConfiguration('worktreeSwitcher.enableTelemetry')) {
                this.updateTelemetryState();
            }
        });
    }
    /**
     * Update telemetry enabled state based on VS Code settings
     */
    updateTelemetryState() {
        const vscodeConfig = vscode.workspace.getConfiguration('telemetry');
        const extensionConfig = vscode.workspace.getConfiguration('worktreeSwitcher');
        const telemetryLevel = vscodeConfig.get('telemetryLevel', 'all');
        const extensionTelemetryEnabled = extensionConfig.get('enableTelemetry', true);
        // Respect both VS Code's telemetry settings and extension's own setting
        const vscodeEnabled = telemetryLevel !== 'off' && telemetryLevel !== 'crash';
        this.isEnabled = vscodeEnabled && extensionTelemetryEnabled;
        this.logger.debug(`Telemetry ${this.isEnabled ? 'enabled' : 'disabled'} (VS Code: ${vscodeEnabled}, Extension: ${extensionTelemetryEnabled})`);
    }
    /**
     * Send a telemetry event if telemetry is enabled
     */
    sendEvent(eventName, properties, measurements) {
        if (!this.isEnabled) {
            return;
        }
        try {
            const event = {
                eventName: `${this.extensionId}.${eventName}`,
                properties: this.sanitizeProperties(properties),
                measurements
            };
            // Log telemetry event for debugging (without sensitive data)
            this.logger.debug(`Telemetry event: ${event.eventName}`, {
                propertiesCount: Object.keys(event.properties || {}).length,
                measurementsCount: Object.keys(event.measurements || {}).length
            });
            // In a real implementation, this would send to a telemetry service
            // For now, we'll just log it as this is a demonstration
            this.logTelemetryEvent(event);
        }
        catch (error) {
            this.logger.error('Failed to send telemetry event', error);
        }
    }
    /**
     * Send command execution telemetry
     */
    sendCommandEvent(commandName, success, duration, error) {
        this.sendEvent('command.executed', {
            command: commandName,
            success: success.toString(),
            error: error ? 'true' : 'false'
        }, {
            duration: duration || 0
        });
    }
    /**
     * Send worktree operation telemetry
     */
    sendWorktreeEvent(operation, success, worktreeCount) {
        this.sendEvent('worktree.operation', {
            operation,
            success: success.toString()
        }, {
            worktreeCount: worktreeCount || 0
        });
    }
    /**
     * Send extension activation telemetry
     */
    sendActivationEvent(activationTime, gitVersion) {
        this.sendEvent('extension.activated', {
            gitVersion: gitVersion || 'unknown'
        }, {
            activationTime
        });
    }
    /**
     * Send error telemetry (without sensitive information)
     */
    sendErrorEvent(errorType, command) {
        this.sendEvent('error.occurred', {
            errorType,
            command: command || 'unknown'
        });
    }
    /**
     * Sanitize properties to remove sensitive information
     */
    sanitizeProperties(properties) {
        if (!properties) {
            return {};
        }
        const sanitized = {};
        for (const [key, value] of Object.entries(properties)) {
            // Remove or hash sensitive data
            if (this.isSensitiveKey(key)) {
                sanitized[key] = this.hashValue(value);
            }
            else {
                sanitized[key] = value;
            }
        }
        return sanitized;
    }
    /**
     * Check if a property key contains sensitive information
     */
    isSensitiveKey(key) {
        const sensitiveKeys = ['path', 'directory', 'username', 'email', 'repo', 'url'];
        return sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive));
    }
    /**
     * Hash sensitive values for privacy
     */
    hashValue(value) {
        // Simple hash for demonstration - in production, use a proper hashing algorithm
        let hash = 0;
        for (let i = 0; i < value.length; i++) {
            const char = value.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return `hashed_${Math.abs(hash).toString(16)}`;
    }
    /**
     * Log telemetry event (placeholder for actual telemetry service)
     */
    logTelemetryEvent(event) {
        // In a real implementation, this would send to Azure Application Insights,
        // Google Analytics, or another telemetry service
        this.logger.info(`[TELEMETRY] ${event.eventName}`, {
            properties: event.properties,
            measurements: event.measurements
        });
    }
    /**
     * Get telemetry status for display
     */
    isEnabledStatus() {
        return this.isEnabled;
    }
    /**
     * Dispose of telemetry service
     */
    dispose() {
        // Clean up any resources if needed
        this.logger.debug('Telemetry service disposed');
    }
}
exports.TelemetryService = TelemetryService;
//# sourceMappingURL=telemetryService.js.map