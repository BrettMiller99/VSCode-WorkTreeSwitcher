import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { GitCLI, GitWorktree } from '../utils/gitCli';
import { Logger } from '../utils/logger';
import { TelemetryService } from './telemetryService';

export interface WorktreeInfo extends GitWorktree {
    name: string;
    status: {
        clean: boolean;
        staged: number;
        unstaged: number;
    };
    currentBranch?: string;
    isActive: boolean;
}

/**
 * Core service for managing Git worktrees.
 * Provides methods to list, create, delete, and switch worktrees.
 * Emits events when worktree state changes.
 */
export class WorktreeService implements vscode.Disposable {
    private readonly gitCli: GitCLI;
    private readonly logger: Logger;
    private readonly telemetryService?: TelemetryService;
    private readonly _onDidChangeWorktrees = new vscode.EventEmitter<WorktreeInfo[]>();
    private worktrees: WorktreeInfo[] = [];
    private repositoryRoot: string | null = null;
    private autoRefreshTimer: NodeJS.Timeout | null = null;
    private abortController: AbortController | null = null;
    private isRefreshing: boolean = false;

    readonly onDidChangeWorktrees = this._onDidChangeWorktrees.event;

    constructor(logger: Logger, telemetryService?: TelemetryService) {
        this.logger = logger;
        this.telemetryService = telemetryService;
        this.gitCli = new GitCLI(logger);
        
        // Set up auto-refresh based on configuration
        this.setupAutoRefresh();
        
        // Listen for configuration changes
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('worktreeSwitcher.autoRefresh')) {
                this.setupAutoRefresh();
            }
        });
    }

    /**
     * Initialize the service by detecting the repository and loading worktrees
     */
    async initialize(): Promise<void> {
        try {
            await this.detectRepository();
            if (this.repositoryRoot) {
                await this.refresh();
            }
        } catch (error) {
            this.logger.error('Failed to initialize WorktreeService', error);
        }
    }

    /**
     * Detect the Git repository root from the current workspace
     */
    private async detectRepository(): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            this.logger.debug('No workspace folders found');
            return;
        }

        // Try each workspace folder to find a Git repository
        for (const folder of workspaceFolders) {
            const folderPath = folder.uri.fsPath;
            try {
                if (await this.gitCli.isGitRepository(folderPath)) {
                    this.repositoryRoot = await this.gitCli.getRepositoryRoot(folderPath);
                    this.logger.info(`Found Git repository at: ${this.repositoryRoot}`);
                    return;
                }
            } catch (error) {
                this.logger.debug(`Failed to check Git repository at ${folderPath}`, error);
            }
        }

        this.logger.warn('No Git repository found in workspace folders');
    }

    /**
     * Refresh the list of worktrees
     */
    async refresh(): Promise<void> {
        // Prevent concurrent refresh operations
        if (this.isRefreshing) {
            this.logger.debug('Refresh already in progress, skipping...');
            return;
        }
        
        if (!this.repositoryRoot) {
            await this.detectRepository();
            if (!this.repositoryRoot) {
                this.worktrees = [];
                this._onDidChangeWorktrees.fire(this.worktrees);
                return;
            }
        }

        this.isRefreshing = true;
        
        try {
            // Cancel any ongoing operations
            if (this.abortController) {
                this.abortController.abort();
            }
            
            // Create new abort controller for this operation
            this.abortController = new AbortController();
            const signal = this.abortController.signal;

            this.logger.debug('Refreshing worktree list...');
            
            const gitWorktrees = await this.gitCli.listWorktrees(
                this.repositoryRoot,
                signal
            );

            // Enhance worktree information
            const worktreeInfos: WorktreeInfo[] = [];
            const currentWorkspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

            for (const worktree of gitWorktrees) {
                try {
                    const [status, currentBranch] = await Promise.all([
                        this.gitCli.getWorktreeStatus(worktree.path, signal),
                        this.gitCli.getCurrentBranch(worktree.path, signal)
                    ]);

                    const worktreeInfo: WorktreeInfo = {
                        ...worktree,
                        name: path.basename(worktree.path),
                        status,
                        currentBranch: currentBranch || worktree.branch,
                        isActive: currentWorkspacePath === worktree.path
                    };

                    worktreeInfos.push(worktreeInfo);
                } catch (error) {
                    if (error instanceof Error && error.name === 'AbortError') {
                        this.logger.debug('Worktree refresh was cancelled');
                        return;
                    }
                    
                    this.logger.warn(`Failed to get detailed info for worktree: ${worktree.path}`, error);
                    
                    // Add basic info even if detailed info fails
                    const worktreeInfo: WorktreeInfo = {
                        ...worktree,
                        name: path.basename(worktree.path),
                        status: { clean: false, staged: 0, unstaged: 0 },
                        currentBranch: worktree.branch,
                        isActive: currentWorkspacePath === worktree.path
                    };
                    
                    worktreeInfos.push(worktreeInfo);
                }
            }

            this.worktrees = worktreeInfos;
            this._onDidChangeWorktrees.fire(this.worktrees);
            
            this.logger.debug(`Found ${this.worktrees.length} worktrees`);
            
            // Send telemetry for successful refresh
            this.telemetryService?.sendWorktreeEvent('refresh', true, this.worktrees.length);
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                this.logger.debug('Worktree refresh was cancelled');
                return;
            }
            
            this.logger.error('Failed to refresh worktrees', error);
            this.worktrees = [];
            this._onDidChangeWorktrees.fire(this.worktrees);
        } finally {
            this.isRefreshing = false;
        }
    }

    /**
     * Get the current list of worktrees
     */
    getWorktrees(): WorktreeInfo[] {
        return [...this.worktrees];
    }

    /**
     * Switch to a worktree by opening it in a new VS Code window
     */
    async switchWorktree(worktreePath: string): Promise<void> {
        try {
            this.logger.info(`Switching to worktree: ${worktreePath}`);
            
            // Check if the worktree path exists
            if (!fs.existsSync(worktreePath)) {
                throw new Error(`Worktree path does not exist: ${worktreePath}`);
            }

            // Open the worktree in a new window
            const uri = vscode.Uri.file(worktreePath);
            await vscode.commands.executeCommand('vscode.openFolder', uri, { forceNewWindow: true });
            
            this.logger.info(`Successfully switched to worktree: ${worktreePath}`);
        } catch (error) {
            this.logger.error(`Failed to switch to worktree: ${worktreePath}`, error);
            throw error;
        }
    }

    /**
     * Create a new worktree
     */
    async createWorktree(
        branch: string,
        worktreePath: string,
        options: { newBranch?: boolean; force?: boolean } = {}
    ): Promise<void> {
        if (!this.repositoryRoot) {
            throw new Error('No Git repository found');
        }

        try {
            this.logger.info(`Creating worktree: ${worktreePath} for branch: ${branch}`);
            
            await this.gitCli.createWorktree(
                this.repositoryRoot,
                worktreePath,
                branch,
                options,
                this.abortController?.signal
            );
            
            // Refresh the worktree list
            await this.refresh();
            
            this.logger.info(`Successfully created worktree: ${worktreePath}`);
        } catch (error) {
            this.logger.error(`Failed to create worktree: ${worktreePath}`, error);
            throw error;
        }
    }

    /**
     * Remove a worktree
     */
    async removeWorktree(worktreePath: string, force: boolean = false): Promise<void> {
        if (!this.repositoryRoot) {
            throw new Error('No Git repository found');
        }

        try {
            this.logger.info(`Removing worktree: ${worktreePath}`);
            
            await this.gitCli.removeWorktree(
                this.repositoryRoot,
                worktreePath,
                force,
                this.abortController?.signal
            );
            
            // Refresh the worktree list
            await this.refresh();
            
            this.logger.info(`Successfully removed worktree: ${worktreePath}`);
        } catch (error) {
            this.logger.error(`Failed to remove worktree: ${worktreePath}`, error);
            throw error;
        }
    }

    /**
     * Get available branches for creating new worktrees
     */
    async getBranches(): Promise<string[]> {
        if (!this.repositoryRoot) {
            throw new Error('No Git repository found');
        }

        try {
            return await this.gitCli.listBranches(
                this.repositoryRoot,
                this.abortController?.signal
            );
        } catch (error) {
            this.logger.error('Failed to get branches', error);
            throw error;
        }
    }

    /**
     * Get the default location for new worktrees
     */
    getDefaultWorktreeLocation(): string {
        const config = vscode.workspace.getConfiguration('worktreeSwitcher');
        const defaultLocation = config.get<string>('defaultLocation', '');
        
        if (defaultLocation && fs.existsSync(defaultLocation)) {
            return defaultLocation;
        }
        
        // Default to parent directory of repository
        if (this.repositoryRoot) {
            return path.dirname(this.repositoryRoot);
        }
        
        // Fallback to user's home directory
        return require('os').homedir();
    }

    /**
     * Set up auto-refresh timer based on configuration
     */
    private setupAutoRefresh(): void {
        // Clear existing timer
        if (this.autoRefreshTimer) {
            clearInterval(this.autoRefreshTimer);
            this.autoRefreshTimer = null;
        }

        const config = vscode.workspace.getConfiguration('worktreeSwitcher');
        const autoRefreshMinutes = config.get<number>('autoRefresh', 5);
        
        if (autoRefreshMinutes > 0) {
            const intervalMs = autoRefreshMinutes * 60 * 1000;
            this.autoRefreshTimer = setInterval(() => {
                this.refresh();
            }, intervalMs);
            
            this.logger.debug(`Auto-refresh enabled: ${autoRefreshMinutes} minutes`);
        } else {
            this.logger.debug('Auto-refresh disabled');
        }
    }

    dispose(): void {
        // Cancel any ongoing operations
        if (this.abortController) {
            this.abortController.abort();
        }
        
        // Clear auto-refresh timer
        if (this.autoRefreshTimer) {
            clearInterval(this.autoRefreshTimer);
        }
        
        // Dispose event emitter
        this._onDidChangeWorktrees.dispose();
    }

    /**
     * Get Git version for telemetry and compatibility checking
     */
    async getGitVersion(): Promise<string> {
        try {
            const result = await this.gitCli.execute(['--version']);
            // Extract version from "git version 2.39.0" format
            const match = result.match(/git version ([\d\.]+)/);
            return match ? match[1] : result.trim();
        } catch (error) {
            this.logger.debug('Failed to get Git version', error);
            throw error;
        }
    }
}
