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
     * Validate that Git is available and accessible
     */
    async validateGitAvailability() {
        return await this.gitCli.validateGitAvailability();
    }
    /**
     * Get the repository root path for a given directory
     */
    async getRepositoryRoot(cwd) {
        return await this.gitCli.getRepositoryRoot(cwd);
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
     * Find the main worktree (repository root)
     * Note: git worktree list doesn't include the main repository, so we create a synthetic entry if needed
     */
    async getMainWorktree() {
        try {
            // Get the repository root path
            const currentWorkspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!currentWorkspace) {
                return null;
            }
            const repoRoot = await this.gitCli.getRepositoryRoot(currentWorkspace);
            // First, try to find the main worktree in the existing list
            // (in case it's actually listed as a worktree in some Git configurations)
            let mainWorktree = this.worktrees.find(w => w.path === repoRoot);
            if (mainWorktree) {
                return mainWorktree;
            }
            // If not found, create a synthetic main worktree entry
            // This is normal because git worktree list doesn't include the main repository
            this.logger.debug('Main repository not found in worktrees list, creating synthetic entry');
            try {
                // Get information about the main repository
                const [currentBranchResult, status, head] = await Promise.all([
                    this.gitCli.getCurrentBranch(repoRoot).catch(() => null),
                    this.gitCli.getWorktreeStatus(repoRoot).catch(() => ({ clean: true, staged: 0, unstaged: 0 })),
                    this.gitCli.executeGit(['rev-parse', 'HEAD'], { cwd: repoRoot }).then(result => result.trim()).catch(() => '')
                ]);
                // Handle null branch result by converting to undefined or fallback
                const currentBranch = currentBranchResult || 'main';
                // Create synthetic main worktree info
                const syntheticMainWorktree = {
                    path: repoRoot,
                    name: path.basename(repoRoot),
                    branch: currentBranch,
                    currentBranch: currentBranch,
                    head: head,
                    status: status,
                    isActive: currentWorkspace === repoRoot,
                    bare: false,
                    detached: false,
                    locked: false,
                    prunable: false
                };
                this.logger.debug(`Created synthetic main worktree: ${repoRoot}`);
                return syntheticMainWorktree;
            }
            catch (syntheticError) {
                this.logger.warn('Failed to create synthetic main worktree info', syntheticError);
                // Return a minimal main worktree entry as last resort
                return {
                    path: repoRoot,
                    name: path.basename(repoRoot),
                    branch: 'main',
                    currentBranch: 'main',
                    head: '',
                    status: { clean: true, staged: 0, unstaged: 0 },
                    isActive: currentWorkspace === repoRoot,
                    bare: false,
                    detached: false,
                    locked: false,
                    prunable: false
                };
            }
        }
        catch (error) {
            this.logger.error('Failed to find main worktree', error);
            return null;
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
    async createWorktree(branch, worktreePath, options = {}, suppressExpectedErrors = false) {
        if (!this.repositoryRoot) {
            throw new Error('No Git repository found');
        }
        try {
            this.logger.info(`Creating worktree: ${worktreePath} for branch: ${branch}`);
            await this.gitCli.createWorktree(this.repositoryRoot, worktreePath, branch, options, this.abortController?.signal, suppressExpectedErrors);
            // Refresh the worktree list
            await this.refresh();
            this.logger.info(`Successfully created worktree: ${worktreePath}`);
        }
        catch (error) {
            // Check if this is an expected error that might be retried
            const isExpectedError = error.message && (error.message.includes('missing but already registered') ||
                error.message.includes('already used by worktree'));
            // Only log as error if it's not an expected error or if we're not suppressing
            if (!suppressExpectedErrors || !isExpectedError) {
                this.logger.error(`Failed to create worktree: ${worktreePath}`, error);
            }
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
            // Check if this is an attempt to remove the main working tree
            if (error.message && error.message.includes('is a main working tree')) {
                const friendlyError = new Error('Cannot remove the main Git repository folder. Only worktrees created from branches can be removed.');
                this.logger.warn('Cannot remove the main working tree');
                throw friendlyError;
            }
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
    async getBranchesWithoutWorktrees(branchType = gitCli_1.BranchType.Both) {
        if (!this.repositoryRoot) {
            throw new Error('No Git repository found');
        }
        try {
            return await this.gitCli.getBranchesWithoutWorktrees(this.repositoryRoot, branchType, this.abortController?.signal);
        }
        catch (error) {
            this.logger.error('Failed to get branches without worktrees', error);
            throw error;
        }
    }
    /**
     * Create worktrees for all branches that don't have existing worktrees
     */
    async createWorktreesForAllBranches(branchType = gitCli_1.BranchType.Both, progressCallback, signal) {
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
            const branches = await this.getBranchesWithoutWorktrees(branchType);
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
                    // Create the worktree with retry logic for stale registrations
                    let createOptions = {
                        newBranch: branch.startsWith('origin/')
                    };
                    try {
                        // First attempt - suppress expected errors since we'll retry
                        await this.createWorktree(cleanBranchName, worktreePath, createOptions, true);
                    }
                    catch (createError) {
                        // Check if this is a stale worktree registration error
                        if (createError.message && (createError.message.includes('missing but already registered') ||
                            createError.message.includes('already used by worktree'))) {
                            this.logger.info(`Retrying worktree creation for ${cleanBranchName} with force option`);
                            // Retry with force option to override stale registration
                            createOptions.force = true;
                            await this.createWorktree(cleanBranchName, worktreePath, createOptions, false);
                        }
                        else {
                            // Re-throw other errors
                            throw createError;
                        }
                    }
                    result.created.push(cleanBranchName);
                    this.logger.info(`Created worktree for branch: ${cleanBranchName}`);
                }
                catch (error) {
                    let errorMessage = error.message || 'Unknown error';
                    // Provide more helpful error messages for common issues
                    if (errorMessage.includes('Git is not installed') || errorMessage.includes('not found in PATH')) {
                        errorMessage = 'Git is not installed or not found in PATH. Please install Git and ensure it is available in your system PATH.';
                    }
                    else if (errorMessage.includes('spawn git ENOENT')) {
                        errorMessage = 'Git executable not found. Please ensure Git is installed and available in your system PATH.';
                    }
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
    /**
     * Scan remote repository for new or updated branches
     */
    async scanRemoteChanges() {
        try {
            const currentWorkspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!currentWorkspace) {
                throw new Error('No workspace folder found');
            }
            const repoRoot = await this.gitCli.getRepositoryRoot(currentWorkspace);
            // Fetch remote changes
            this.logger.info('Fetching remote changes...');
            await this.gitCli.fetchRemote(repoRoot);
            // Get remote branches
            const remoteBranches = await this.gitCli.listRemoteBranches(repoRoot);
            const localBranches = await this.gitCli.listBranches(repoRoot);
            // Find new branches (exist on remote but not locally)
            const newBranches = remoteBranches.filter(remoteBranch => !localBranches.some(localBranch => localBranch === remoteBranch || localBranch === `origin/${remoteBranch}`));
            // Find updated branches (local branches that are behind their remote counterparts)
            const updatedBranches = [];
            for (const worktree of this.worktrees) {
                if (worktree.currentBranch && !worktree.currentBranch.startsWith('origin/')) {
                    const isBehind = await this.gitCli.isBranchBehindRemote(repoRoot, worktree.currentBranch, worktree.currentBranch);
                    if (isBehind) {
                        updatedBranches.push({
                            branch: worktree.currentBranch,
                            worktreePath: worktree.path
                        });
                    }
                }
            }
            this.logger.info(`Found ${newBranches.length} new branches and ${updatedBranches.length} updated branches`);
            return { newBranches, updatedBranches };
        }
        catch (error) {
            this.logger.error('Failed to scan remote changes', error);
            throw error;
        }
    }
    /**
     * Create worktrees for new remote branches
     */
    async createWorktreesForNewBranches(branches, progressCallback) {
        const created = [];
        const errors = [];
        for (let i = 0; i < branches.length; i++) {
            const branch = branches[i];
            try {
                progressCallback?.(branch, i + 1, branches.length);
                // Create worktree for the remote branch
                const worktreeName = this.configService.generateWorktreeName(branch);
                const defaultLocation = this.configService.get('defaultLocation');
                const worktreePath = path.join(defaultLocation, worktreeName);
                await this.createWorktree(worktreeName, worktreePath, { newBranch: true });
                created.push(branch);
                this.logger.info(`Created worktree for new branch: ${branch}`);
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                errors.push({ branch, error: errorMessage });
                this.logger.error(`Failed to create worktree for branch ${branch}`, error);
            }
        }
        return { created, errors };
    }
    /**
     * Update existing worktrees with remote changes
     */
    async updateWorktreesWithRemoteChanges(updates, progressCallback) {
        const updated = [];
        const errors = [];
        for (let i = 0; i < updates.length; i++) {
            const { branch, worktreePath } = updates[i];
            try {
                progressCallback?.(branch, i + 1, updates.length);
                // Pull latest changes in the worktree
                await this.gitCli.executeGit(['pull'], { cwd: worktreePath });
                updated.push(branch);
                this.logger.info(`Updated worktree for branch: ${branch}`);
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                errors.push({ branch, error: errorMessage });
                this.logger.error(`Failed to update worktree for branch ${branch}`, error);
            }
        }
        return { updated, errors };
    }
}
exports.WorktreeService = WorktreeService;
//# sourceMappingURL=worktreeService.js.map