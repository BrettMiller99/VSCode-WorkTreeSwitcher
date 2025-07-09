import * as vscode from 'vscode';
import { Logger } from '../utils/logger';

/**
 * Advanced configuration interface for the WorkTree Switcher extension
 */
export interface WorktreeConfiguration {
    defaultLocation: string;
    autoRefresh: number;
    logLevel: 'error' | 'warn' | 'info' | 'debug';
    showStatusBar: boolean;
    gitTimeout: number;
    worktreeNamePattern: string;
    excludeBranches: string[];
    confirmDangerousOperations: boolean;
    openInNewWindow: 'always' | 'never' | 'ask';
    maxWorktrees: number;
    sortWorktreesBy: 'name' | 'lastModified' | 'creationDate' | 'branchName';
    showHiddenBranches: boolean;
    autoCleanupStale: boolean;
}

/**
 * Service for managing advanced configuration settings
 */
export class ConfigurationService {
    private static readonly SECTION = 'worktreeSwitcher';
    private readonly logger: Logger;
    private readonly disposables: vscode.Disposable[] = [];
    private readonly changeEmitter = new vscode.EventEmitter<WorktreeConfiguration>();

    /**
     * Event fired when configuration changes
     */
    public readonly onConfigurationChanged = this.changeEmitter.event;

    constructor(logger: Logger) {
        this.logger = logger;
        this.setupConfigurationWatcher();
    }

    /**
     * Get the current configuration
     */
    public getConfiguration(): WorktreeConfiguration {
        const config = vscode.workspace.getConfiguration(ConfigurationService.SECTION);
        
        return {
            defaultLocation: config.get('defaultLocation', ''),
            autoRefresh: config.get('autoRefresh', 5),
            logLevel: config.get('logLevel', 'info'),
            showStatusBar: config.get('showStatusBar', true),
            gitTimeout: config.get('gitTimeout', 30),
            worktreeNamePattern: config.get('worktreeNamePattern', '{branchName}'),
            excludeBranches: config.get('excludeBranches', ['HEAD', 'refs/stash']),
            confirmDangerousOperations: config.get('confirmDangerousOperations', true),
            openInNewWindow: config.get('openInNewWindow', 'ask'),
            maxWorktrees: config.get('maxWorktrees', 20),
            sortWorktreesBy: config.get('sortWorktreesBy', 'name'),
            showHiddenBranches: config.get('showHiddenBranches', false),
            autoCleanupStale: config.get('autoCleanupStale', false)
        };
    }

    /**
     * Get a specific configuration value
     */
    public get<T>(key: keyof WorktreeConfiguration): T {
        const config = vscode.workspace.getConfiguration(ConfigurationService.SECTION);
        return config.get(key) as T;
    }

    /**
     * Update a configuration value
     */
    public async update<T>(key: keyof WorktreeConfiguration, value: T, target?: vscode.ConfigurationTarget): Promise<void> {
        const config = vscode.workspace.getConfiguration(ConfigurationService.SECTION);
        await config.update(key, value, target);
        this.logger.debug(`Configuration updated: ${key} = ${value}`);
    }

    /**
     * Generate a worktree name based on the configured pattern
     */
    public generateWorktreeName(branchName: string): string {
        const pattern = this.get<string>('worktreeNamePattern');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const username = process.env.USER || process.env.USERNAME || 'user';

        return pattern
            .replace('{branchName}', branchName)
            .replace('{timestamp}', timestamp)
            .replace('{username}', username)
            .replace(/[<>:"/\\|?*]/g, '-'); // Sanitize for filesystem
    }

    /**
     * Check if a branch should be excluded based on patterns
     */
    public shouldExcludeBranch(branchName: string): boolean {
        const excludePatterns = this.get<string[]>('excludeBranches');
        
        return excludePatterns.some(pattern => {
            // Simple glob pattern matching
            const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'));
            return regex.test(branchName);
        });
    }

    /**
     * Check if hidden branches should be shown
     */
    public shouldShowHiddenBranches(): boolean {
        return this.get<boolean>('showHiddenBranches');
    }

    /**
     * Get the maximum number of worktrees to display
     */
    public getMaxWorktrees(): number {
        return this.get<number>('maxWorktrees');
    }

    /**
     * Get the Git command timeout in milliseconds
     */
    public getGitTimeoutMs(): number {
        return this.get<number>('gitTimeout') * 1000;
    }

    /**
     * Check if dangerous operations should be confirmed
     */
    public shouldConfirmDangerousOperations(): boolean {
        return this.get<boolean>('confirmDangerousOperations');
    }

    /**
     * Get the window opening behavior
     */
    public getOpenInNewWindowBehavior(): 'always' | 'never' | 'ask' {
        return this.get<'always' | 'never' | 'ask'>('openInNewWindow');
    }

    /**
     * Get the sorting preference for worktrees
     */
    public getSortWorktreesBy(): 'name' | 'lastModified' | 'creationDate' | 'branchName' {
        return this.get<'name' | 'lastModified' | 'creationDate' | 'branchName'>('sortWorktreesBy');
    }

    /**
     * Check if stale worktrees should be auto-cleaned
     */
    public shouldAutoCleanupStale(): boolean {
        return this.get<boolean>('autoCleanupStale');
    }

    /**
     * Check if worktrees should open in new window
     */
    public shouldOpenInNewWindow(): boolean {
        return this.getOpenInNewWindowBehavior() === 'always';
    }

    /**
     * Determine window behavior for worktree switching, handling 'ask' option
     */
    public async determineWindowBehavior(): Promise<boolean> {
        const behavior = this.getOpenInNewWindowBehavior();
        
        switch (behavior) {
            case 'always':
                return true;
            case 'never':
                return false;
            case 'ask':
                const choice = await vscode.window.showQuickPick(
                    [
                        { label: '🪟 Open in New Window', value: true },
                        { label: '🔄 Switch in Current Window', value: false }
                    ],
                    {
                        placeHolder: 'How would you like to open the worktree?',
                        title: 'Window Behavior'
                    }
                );
                return choice?.value ?? false; // Default to current window if cancelled
            default:
                return false;
        }
    }

    /**
     * Validate configuration values
     */
    public validateConfiguration(): string[] {
        const config = this.getConfiguration();
        const errors: string[] = [];

        // Validate Git timeout
        if (config.gitTimeout < 5 || config.gitTimeout > 120) {
            errors.push('Git timeout must be between 5 and 120 seconds');
        }

        // Validate max worktrees
        if (config.maxWorktrees < 1 || config.maxWorktrees > 100) {
            errors.push('Max worktrees must be between 1 and 100');
        }

        // Validate auto refresh
        if (config.autoRefresh < 0) {
            errors.push('Auto refresh interval cannot be negative');
        }

        // Validate worktree name pattern
        if (!config.worktreeNamePattern.trim()) {
            errors.push('Worktree name pattern cannot be empty');
        }

        return errors;
    }

    /**
     * Setup configuration change watcher
     */
    private setupConfigurationWatcher(): void {
        const watcher = vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration(ConfigurationService.SECTION)) {
                this.logger.debug('Configuration changed, notifying listeners');
                const newConfig = this.getConfiguration();
                this.changeEmitter.fire(newConfig);
            }
        });

        this.disposables.push(watcher);
    }

    /**
     * Dispose of resources
     */
    public dispose(): void {
        this.disposables.forEach(d => d.dispose());
        this.changeEmitter.dispose();
    }
}
