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
exports.Logger = void 0;
const vscode = __importStar(require("vscode"));
/**
 * Logger utility for the Worktree Switcher extension.
 * Writes to VS Code OutputChannel with configurable log levels and timestamps.
 */
class Logger {
    constructor(channelName) {
        this.logLevel = 'info';
        this.outputChannel = vscode.window.createOutputChannel(channelName);
        this.updateLogLevel();
        // Listen for configuration changes
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('worktreeSwitcher.logLevel')) {
                this.updateLogLevel();
            }
        });
    }
    updateLogLevel() {
        const config = vscode.workspace.getConfiguration('worktreeSwitcher');
        this.logLevel = config.get('logLevel', 'info');
    }
    shouldLog(level) {
        const levels = ['error', 'warn', 'info', 'debug'];
        const currentLevelIndex = levels.indexOf(this.logLevel);
        const messageLevelIndex = levels.indexOf(level);
        return messageLevelIndex <= currentLevelIndex;
    }
    formatMessage(level, message, error) {
        const timestamp = new Date().toISOString();
        const levelStr = level.toUpperCase().padEnd(5);
        let formattedMessage = `[${timestamp}] ${levelStr} ${message}`;
        if (error) {
            if (error instanceof Error) {
                formattedMessage += `\n  Error: ${error.message}`;
                if (error.stack) {
                    formattedMessage += `\n  Stack: ${error.stack}`;
                }
            }
            else {
                formattedMessage += `\n  Details: ${JSON.stringify(error, null, 2)}`;
            }
        }
        return formattedMessage;
    }
    log(level, message, error) {
        if (!this.shouldLog(level)) {
            return;
        }
        const formattedMessage = this.formatMessage(level, message, error);
        this.outputChannel.appendLine(formattedMessage);
        // For errors and warnings, also show in VS Code notifications
        if (level === 'error') {
            vscode.window.showErrorMessage(`Worktree Switcher: ${message}`, 'Show Details').then(selection => {
                if (selection === 'Show Details') {
                    this.outputChannel.show();
                }
            });
        }
        else if (level === 'warn') {
            vscode.window.showWarningMessage(`Worktree Switcher: ${message}`);
        }
    }
    /**
     * Log an error message
     */
    error(message, error) {
        this.log('error', message, error);
    }
    /**
     * Log a warning message
     */
    warn(message, error) {
        this.log('warn', message, error);
    }
    /**
     * Log an info message
     */
    info(message, error) {
        this.log('info', message, error);
    }
    /**
     * Log a debug message
     */
    debug(message, error) {
        this.log('debug', message, error);
    }
    /**
     * Show the output channel
     */
    show() {
        this.outputChannel.show();
    }
    /**
     * Clear the output channel
     */
    clear() {
        this.outputChannel.clear();
    }
    dispose() {
        this.outputChannel.dispose();
    }
}
exports.Logger = Logger;
//# sourceMappingURL=logger.js.map