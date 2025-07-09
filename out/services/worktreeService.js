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
exports.WorktreeService = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const gitCli_1 = require("../utils/gitCli");
/**
 * Core service for managing Git worktrees.
 * Provides methods to list, create, delete, and switch worktrees.
 * Emits events when worktree state changes.
 */
class WorktreeService {
    constructor(logger, configService) {
        this.worktrees = [];
        this.repositoryRoot = null;
        this.abortController = null;
        this.autoRefreshTimer = null;
        this.isRefreshing = false;
        this._onDidChangeWorktrees = new vscode.EventEmitter();
        this.onDidChangeWorktrees = this._onDidChangeWorktrees.event;
        this.logger = logger;
        this.configService = configService;
        this.gitCli = new gitCli_1.GitCLI(logger, configService.getGitTimeoutMs());
        // Set up auto-refresh based on configuration
        this.setupAutoRefresh();
        // Listen for configuration changes
        this.configService.onConfigurationChanged((config) => {
            this.setupAutoRefresh();
            // Update GitCLI timeout if needed
            this.gitCli = new gitCli_1.GitCLI(logger, config.gitTimeout * 1000);
        });
    }
    /**
     * Initialize the service by detecting the repository and loading worktrees
     */
    async initialize() {
        try {
            await this.detectRepository();
            if (this.repositoryRoot) {
                await this.refresh();
            }
        }
        catch (error) {
            this.logger.error('Failed to initialize WorktreeService', error);
        }
    }
    /**
     * Detect the Git repository root from the current workspace
     */
    async detectRepository() {
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
            }
            catch (error) {
                this.logger.debug(`Failed to check Git repository at ${folderPath}`, error);
            }
        }
        this.logger.warn('No Git repository found in workspace folders');
    }
    /**
     * Refresh the list of worktrees
     */
    async refresh() {
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
            const gitWorktrees = await this.gitCli.listWorktrees(this.repositoryRoot, signal);
            // Enhance worktree information
            const worktreeInfos = [];
            const currentWorkspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            for (const worktree of gitWorktrees) {
                try {
                    const [status, currentBranch] = await Promise.all([
                        this.gitCli.getWorktreeStatus(worktree.path, signal),
                        this.gitCli.getCurrentBranch(worktree.path, signal)
                    ]);
                    const worktreeInfo = {
                        ...worktree,
                        name: path.basename(worktree.path),
                        status,
                        currentBranch: currentBranch || worktree.branch,
                        isActive: currentWorkspacePath === worktree.path
                    };
                    worktreeInfos.push(worktreeInfo);
                }
                catch (error) {
                    if (error instanceof Error && error.name === 'AbortError') {
                        this.logger.debug('Worktree refresh was cancelled');
                        return;
                    }
                    this.logger.warn(`Failed to get detailed info for worktree: ${worktree.path}`, error);
                    // Add basic info even if detailed info fails
                    const worktreeInfo = {
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
        }
        catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                this.logger.debug('Worktree refresh was cancelled');
                return;
            }
            this.logger.error('Failed to refresh worktrees', error);
            this.worktrees = [];
            this._onDidChangeWorktrees.fire(this.worktrees);
        }
        finally {
            this.isRefreshing = false;
        }
    }
    /**
     * Get the current list of worktrees
     */
    getWorktrees() {
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
    async switchWorktree(worktreePath, forceNewWindow) {
        try {
            this.logger.info(`Switching to worktree: ${worktreePath}`);
            // Check if the worktree path exists
            if (!fs.existsSync(worktreePath)) {
                throw new Error(`Worktree path does not exist: ${worktreePath}`);
            }
            // Open the worktree in a new window or current window
            const uri = vscode.Uri.file(worktreePath);
            // If forceNewWindow is explicitly set, use it; otherwise default to same window
            const openInNewWindow = forceNewWindow ?? false;
            await vscode.commands.executeCommand('vscode.openFolder', uri, { forceNewWindow: openInNewWindow });
            this.logger.info(`Successfully switched to worktree: ${worktreePath}`);
        }
        catch (error) {
            this.logger.error(`Failed to switch to worktree: ${worktreePath}`, error);
            throw error;
        }
    }
    /**
     * Create a new worktree
     */
    async createWorktree(branch, worktreePath, options = {}) {
        if (!this.repositoryRoot) {
            throw new Error('No Git repository found');
        }
        try {
            this.logger.info(`Creating worktree: ${worktreePath} for branch: ${branch}`);
            await this.gitCli.createWorktree(this.repositoryRoot, worktreePath, branch, options, this.abortController?.signal);
            // Refresh the worktree list
            await this.refresh();
            this.logger.info(`Successfully created worktree: ${worktreePath}`);
        }
        catch (error) {
            this.logger.error(`Failed to create worktree: ${worktreePath}`, error);
            throw error;
        }
    }
    /**
     * Remove a worktree
     */
    async removeWorktree(worktreePath, force = false) {
        if (!this.repositoryRoot) {
            throw new Error('No Git repository found');
        }
        try {
            this.logger.info(`Removing worktree: ${worktreePath}`);
            await this.gitCli.removeWorktree(this.repositoryRoot, worktreePath, force, this.abortController?.signal);
            // Refresh the worktree list
            await this.refresh();
            this.logger.info(`Successfully removed worktree: ${worktreePath}`);
        }
        catch (error) {
            this.logger.error(`Failed to remove worktree: ${worktreePath}`, error);
            throw error;
        }
    }
    /**
     * Get available branches for creating new worktrees
     */
    async getBranches() {
        if (!this.repositoryRoot) {
            throw new Error('No Git repository found');
        }
        try {
            const allBranches = await this.gitCli.listBranches(this.repositoryRoot, this.abortController?.signal);
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
        }
        catch (error) {
            this.logger.error('Failed to get branches', error);
            throw error;
        }
    }
    /**
     * Get the default location for new worktrees
     */
    getDefaultWorktreeLocation() {
        const config = vscode.workspace.getConfiguration('worktreeSwitcher');
        const defaultLocation = config.get('defaultLocation', '');
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
    setupAutoRefresh() {
        // Clear existing timer
        if (this.autoRefreshTimer) {
            clearInterval(this.autoRefreshTimer);
            this.autoRefreshTimer = null;
        }
        const autoRefreshMinutes = this.configService.get('autoRefresh');
        if (autoRefreshMinutes > 0) {
            const intervalMs = autoRefreshMinutes * 60 * 1000;
            this.autoRefreshTimer = setInterval(() => {
                this.refresh();
            }, intervalMs);
            this.logger.debug(`Auto-refresh enabled: ${autoRefreshMinutes} minutes`);
        }
        else {
            this.logger.debug('Auto-refresh disabled');
        }
    }
    /**
     * Discard all uncommitted changes in a worktree
     */
    async discardWorktreeChanges(worktreePath) {
        if (!this.repositoryRoot) {
            throw new Error('No Git repository found');
        }
        try {
            this.logger.info(`Discarding changes in worktree: ${worktreePath}`);
            // Reset all staged and unstaged changes
            await this.gitCli.resetHard(worktreePath, this.abortController?.signal);
            // Clean untracked files
            await this.gitCli.clean(worktreePath, this.abortController?.signal);
            this.logger.info(`Successfully discarded changes in worktree: ${worktreePath}`);
        }
        catch (error) {
            this.logger.error(`Failed to discard changes in worktree: ${worktreePath}`, error);
            throw error;
        }
    }
    /**
     * Clean untracked files in a worktree
     */
    async cleanWorktree(worktreePath) {
        if (!this.repositoryRoot) {
            throw new Error('No Git repository found');
        }
        try {
            this.logger.info(`Cleaning worktree: ${worktreePath}`);
            await this.gitCli.clean(worktreePath, this.abortController?.signal);
            this.logger.info(`Successfully cleaned worktree: ${worktreePath}`);
        }
        catch (error) {
            this.logger.error(`Failed to clean worktree: ${worktreePath}`, error);
            throw error;
        }
    }
    /**
     * Get detailed status for a specific worktree
     */
    async getWorktreeDetailedStatus(worktreePath) {
        try {
            const status = await this.gitCli.getStatus(worktreePath, this.abortController?.signal);
            return {
                clean: status.staged === 0 && status.unstaged === 0 && status.untracked === 0,
                staged: status.staged,
                unstaged: status.unstaged,
                untracked: status.untracked || 0
            };
        }
        catch (error) {
            this.logger.error(`Failed to get detailed status for worktree: ${worktreePath}`, error);
            throw error;
        }
    }
    /**
     * Get branches that don't have existing worktrees
     */
    async getBranchesWithoutWorktrees() {
        if (!this.repositoryRoot) {
            throw new Error('No Git repository found');
        }
        try {
            return await this.gitCli.getBranchesWithoutWorktrees(this.repositoryRoot, this.abortController?.signal);
        }
        catch (error) {
            this.logger.error('Failed to get branches without worktrees', error);
            throw error;
        }
    }
    /**
     * Create worktrees for all branches that don't have existing worktrees
     */
    async createWorktreesForAllBranches(progressCallback, signal) {
        if (!this.repositoryRoot) {
            throw new Error('No Git repository found');
        }
        const result = {
            created: [],
            skipped: [],
            errors: []
        };
        try {
            // Get branches without worktrees
            const branches = await this.getBranchesWithoutWorktrees();
            if (branches.length === 0) {
                this.logger.info('No branches found that need worktrees');
                return result;
            }
            this.logger.info(`Creating worktrees for ${branches.length} branches`);
            const defaultLocation = this.getDefaultWorktreeLocation();
            for (let i = 0; i < branches.length; i++) {
                if (signal?.aborted) {
                    this.logger.info('Bulk worktree creation cancelled');
                    break;
                }
                const branch = branches[i];
                const cleanBranchName = branch.startsWith('origin/') ? branch.substring(7) : branch;
                // Report progress
                progressCallback?.(i + 1, branches.length, cleanBranchName);
                try {
                    // Generate worktree name using configuration pattern
                    const worktreeName = this.configService.generateWorktreeName(cleanBranchName);
                    const worktreePath = path.join(defaultLocation, worktreeName);
                    // Check if worktree path already exists
                    if (fs.existsSync(worktreePath)) {
                        this.logger.warn(`Worktree path already exists, skipping: ${worktreePath}`);
                        result.skipped.push(cleanBranchName);
                        continue;
                    }
                    // Create the worktree
                    await this.createWorktree(cleanBranchName, worktreePath, { newBranch: branch.startsWith('origin/') } // Create local branch for remote branches
                    );
                    result.created.push(cleanBranchName);
                    this.logger.info(`Created worktree for branch: ${cleanBranchName}`);
                }
                catch (error) {
                    const errorMessage = error.message || 'Unknown error';
                    this.logger.error(`Failed to create worktree for branch: ${cleanBranchName}`, error);
                    result.errors.push({ branch: cleanBranchName, error: errorMessage });
                }
            }
            // Refresh worktree list after bulk creation
            await this.refresh();
            this.logger.info(`Bulk worktree creation completed. Created: ${result.created.length}, Skipped: ${result.skipped.length}, Errors: ${result.errors.length}`);
        }
        catch (error) {
            this.logger.error('Failed to create worktrees for all branches', error);
            throw error;
        }
        return result;
    }
    dispose() {
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
exports.WorktreeService = WorktreeService;
//# sourceMappingURL=worktreeService.js.map