import * as vscode from 'vscode';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

/**
 * Logger utility for the Worktree Switcher extension.
 * Writes to VS Code OutputChannel with configurable log levels and timestamps.
 */
export class Logger implements vscode.Disposable {
    private outputChannel: vscode.OutputChannel;
    private logLevel: LogLevel = 'info';

    constructor(channelName: string) {
        this.outputChannel = vscode.window.createOutputChannel(channelName);
        this.updateLogLevel();

        // Listen for configuration changes
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('worktreeSwitcher.logLevel')) {
                this.updateLogLevel();
            }
        });
    }

    private updateLogLevel(): void {
        const config = vscode.workspace.getConfiguration('worktreeSwitcher');
        this.logLevel = config.get<LogLevel>('logLevel', 'info');
    }

    private shouldLog(level: LogLevel): boolean {
        const levels: LogLevel[] = ['error', 'warn', 'info', 'debug'];
        const currentLevelIndex = levels.indexOf(this.logLevel);
        const messageLevelIndex = levels.indexOf(level);
        return messageLevelIndex <= currentLevelIndex;
    }

    private formatMessage(level: LogLevel, message: string, error?: any): string {
        const timestamp = new Date().toISOString();
        const levelStr = level.toUpperCase().padEnd(5);
        let formattedMessage = `[${timestamp}] ${levelStr} ${message}`;
        
        if (error) {
            if (error instanceof Error) {
                formattedMessage += `\n  Error: ${error.message}`;
                if (error.stack) {
                    formattedMessage += `\n  Stack: ${error.stack}`;
                }
            } else {
                formattedMessage += `\n  Details: ${JSON.stringify(error, null, 2)}`;
            }
        }
        
        return formattedMessage;
    }

    private log(level: LogLevel, message: string, error?: any): void {
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
        } else if (level === 'warn') {
            vscode.window.showWarningMessage(`Worktree Switcher: ${message}`);
        }
    }

    /**
     * Log an error message
     */
    error(message: string, error?: any): void {
        this.log('error', message, error);
    }

    /**
     * Log a warning message
     */
    warn(message: string, error?: any): void {
        this.log('warn', message, error);
    }

    /**
     * Log an info message
     */
    info(message: string, error?: any): void {
        this.log('info', message, error);
    }

    /**
     * Log a debug message
     */
    debug(message: string, error?: any): void {
        this.log('debug', message, error);
    }

    /**
     * Show the output channel
     */
    show(): void {
        this.outputChannel.show();
    }

    /**
     * Clear the output channel
     */
    clear(): void {
        this.outputChannel.clear();
    }

    dispose(): void {
        this.outputChannel.dispose();
    }
}
