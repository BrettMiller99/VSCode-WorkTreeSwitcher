import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { GitCLI, GitWorktree } from '../utils/gitCli';
import { Logger } from '../utils/logger';
import { ConfigurationService } from './configurationService';

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
    private gitCli: GitCLI;
    private logger: Logger;
    private configService: ConfigurationService;
    private worktrees: WorktreeInfo[] = [];
    private repositoryRoot: string | null = null;
    private abortController: AbortController | null = null;
    private autoRefreshTimer: NodeJS.Timeout | null = null;
    private isRefreshing: boolean = false;

    private readonly _onDidChangeWorktrees = new vscode.EventEmitter<WorktreeInfo[]>();
    public readonly onDidChangeWorktrees = this._onDidChangeWorktrees.event;

    constructor(logger: Logger, configService: ConfigurationService) {
        this.logger = logger;
        this.configService = configService;
        this.gitCli = new GitCLI(logger, configService.getGitTimeoutMs());
        
        // Set up auto-refresh based on configuration
        this.setupAutoRefresh();
        
        // Listen for configuration changes
        this.configService.onConfigurationChanged((config) => {
            this.setupAutoRefresh();
            // Update GitCLI timeout if needed
            this.gitCli = new GitCLI(logger, config.gitTimeout * 1000);
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
        const sortedWorktrees = [...this.worktrees];
        const sortBy = this.configService.getSortWorktreesBy();
        const maxWorktrees = this.configService.getMaxWorktrees();
        
        // Sort worktrees based on configuration
        sortedWorktrees.sort((a, b) => {
            switch (sortBy) {
                case 'name':
                    return a.name.localeCompare(b.name);
                case 'branchName':
                    const branchA = a.currentBranch || a.branch || '';
                    const branchB = b.currentBranch || b.branch || '';
                    return branchA.localeCompare(branchB);
                case 'lastModified':
                case 'creationDate':
                    // For now, fall back to name sorting
                    // TODO: Implement file system stat-based sorting
                    return a.name.localeCompare(b.name);
                default:
                    return 0;
            }
        });
        
        // Limit the number of worktrees returned
        return sortedWorktrees.slice(0, maxWorktrees);
    }

    /**
     * Switch to a worktree by opening it in VS Code
     */
    async switchWorktree(worktreePath: string, forceNewWindow?: boolean): Promise<void> {
        try {
            this.logger.info(`Switching to worktree: ${worktreePath}`);
            
            // Check if the worktree path exists
            if (!fs.existsSync(worktreePath)) {
                throw new Error(`Worktree path does not exist: ${worktreePath}`);
            }

            // Open the worktree in a new window or current window based on configuration
            const uri = vscode.Uri.file(worktreePath);
            const openInNewWindow = forceNewWindow ?? true; // Default to new window for backward compatibility
            await vscode.commands.executeCommand('vscode.openFolder', uri, { forceNewWindow: openInNewWindow });
            
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
            const allBranches = await this.gitCli.listBranches(
                this.repositoryRoot,
                this.abortController?.signal
            );
            
            // Filter branches based on configuration
            const filteredBranches = allBranches.filter(branch => {
                // Check if branch should be excluded
                if (this.configService.shouldExcludeBranch(branch)) {
                    return false;
                }
                
                // Check if hidden branches should be shown
                if (branch.startsWith('.') && !this.configService.shouldShowHiddenBranches()) {
                    return false;
                }
                
                return true;
            });
            
            return filteredBranches;
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

        const autoRefreshMinutes = this.configService.get<number>('autoRefresh');
        
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
}
