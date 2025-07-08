import * as vscode from 'vscode';
import { Logger } from '../utils/logger';

/**
 * Telemetry event data structure
 */
interface TelemetryEvent {
    eventName: string;
    properties?: { [key: string]: string };
    measurements?: { [key: string]: number };
}

/**
 * Service for handling telemetry data collection
 * Respects VS Code's telemetry settings and user privacy
 */
export class TelemetryService {
    private readonly logger: Logger;
    private readonly extensionId: string;
    private isEnabled: boolean = false;

    constructor(logger: Logger, extensionId: string = 'worktree-switcher') {
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
    private updateTelemetryState(): void {
        const vscodeConfig = vscode.workspace.getConfiguration('telemetry');
        const extensionConfig = vscode.workspace.getConfiguration('worktreeSwitcher');
        
        const telemetryLevel = vscodeConfig.get<string>('telemetryLevel', 'all');
        const extensionTelemetryEnabled = extensionConfig.get<boolean>('enableTelemetry', true);
        
        // Respect both VS Code's telemetry settings and extension's own setting
        const vscodeEnabled = telemetryLevel !== 'off' && telemetryLevel !== 'crash';
        this.isEnabled = vscodeEnabled && extensionTelemetryEnabled;
        
        this.logger.debug(`Telemetry ${this.isEnabled ? 'enabled' : 'disabled'} (VS Code: ${vscodeEnabled}, Extension: ${extensionTelemetryEnabled})`);
    }

    /**
     * Send a telemetry event if telemetry is enabled
     */
    public sendEvent(eventName: string, properties?: { [key: string]: string }, measurements?: { [key: string]: number }): void {
        if (!this.isEnabled) {
            return;
        }

        try {
            const event: TelemetryEvent = {
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

        } catch (error) {
            this.logger.error('Failed to send telemetry event', error);
        }
    }

    /**
     * Send command execution telemetry
     */
    public sendCommandEvent(commandName: string, success: boolean, duration?: number, error?: string): void {
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
    public sendWorktreeEvent(operation: 'switch' | 'create' | 'remove' | 'refresh', success: boolean, worktreeCount?: number): void {
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
    public sendActivationEvent(activationTime: number, gitVersion?: string): void {
        this.sendEvent('extension.activated', {
            gitVersion: gitVersion || 'unknown'
        }, {
            activationTime
        });
    }

    /**
     * Send error telemetry (without sensitive information)
     */
    public sendErrorEvent(errorType: string, command?: string): void {
        this.sendEvent('error.occurred', {
            errorType,
            command: command || 'unknown'
        });
    }

    /**
     * Sanitize properties to remove sensitive information
     */
    private sanitizeProperties(properties?: { [key: string]: string }): { [key: string]: string } {
        if (!properties) {
            return {};
        }

        const sanitized: { [key: string]: string } = {};
        
        for (const [key, value] of Object.entries(properties)) {
            // Remove or hash sensitive data
            if (this.isSensitiveKey(key)) {
                sanitized[key] = this.hashValue(value);
            } else {
                sanitized[key] = value;
            }
        }

        return sanitized;
    }

    /**
     * Check if a property key contains sensitive information
     */
    private isSensitiveKey(key: string): boolean {
        const sensitiveKeys = ['path', 'directory', 'username', 'email', 'repo', 'url'];
        return sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive));
    }

    /**
     * Hash sensitive values for privacy
     */
    private hashValue(value: string): string {
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
    private logTelemetryEvent(event: TelemetryEvent): void {
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
    public isEnabledStatus(): boolean {
        return this.isEnabled;
    }

    /**
     * Dispose of telemetry service
     */
    public dispose(): void {
        // Clean up any resources if needed
        this.logger.debug('Telemetry service disposed');
    }
}
