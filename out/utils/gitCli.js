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
exports.GitCLI = exports.BranchType = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
var BranchType;
(function (BranchType) {
    BranchType["Local"] = "local";
    BranchType["Remote"] = "remote";
    BranchType["Both"] = "both";
})(BranchType = exports.BranchType || (exports.BranchType = {}));
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
/**
 * Thin wrapper around Git CLI operations using child_process.execFile.
 * All Git commands are funneled through this class for testability and consistent error handling.
 */
class GitCLI {
    constructor(logger, defaultTimeout) {
        this.gitExecutable = null;
        this.logger = logger;
        this.defaultTimeout = defaultTimeout || GitCLI.DEFAULT_TIMEOUT;
    }
    /**
     * Find Git executable with fallback locations and caching
     */
    async findGitExecutable() {
        // Return cached result if available
        if (this.gitExecutable) {
            return this.gitExecutable;
        }
        // Try common Git locations
        const commonPaths = [
            'git',
            '/usr/bin/git',
            '/usr/local/bin/git',
            '/opt/homebrew/bin/git',
            '/opt/local/bin/git' // MacPorts
        ];
        for (const gitPath of commonPaths) {
            try {
                const { stdout } = await execFileAsync(gitPath, ['--version'], {
                    timeout: 5000,
                    encoding: 'utf8'
                });
                if (stdout && stdout.includes('git version')) {
                    this.gitExecutable = gitPath;
                    this.logger.debug(`Found Git executable at: ${gitPath}`);
                    return gitPath;
                }
            }
            catch (error) {
                this.logger.debug(`Git not found at ${gitPath}:`, error);
                continue;
            }
        }
        // If we can't find Git, fall back to 'git' and let the system handle it
        // This preserves the original behavior where the extension would work if Git was in PATH
        this.logger.debug('Could not find Git executable, falling back to "git"');
        this.gitExecutable = 'git';
        return 'git';
    }
    /**
     * Validate that Git is available and accessible
     * This should be called early during extension activation
     */
    async validateGitAvailability() {
        try {
            const gitExecutable = await this.findGitExecutable();
            // Try a simple git command to verify it works
            await execFileAsync(gitExecutable, ['--version'], {
                timeout: 5000,
                encoding: 'utf8'
            });
            return true;
        }
        catch (error) {
            this.logger.debug('Git validation failed, but extension will continue:', error);
            return false;
        }
    }
    /**
     * Execute a Git command with the given arguments (public method for external use)
     */
    async executeGit(args, options = {}) {
        return this.executeGitInternal(args, options);
    }
    /**
     * Execute a Git command with the given arguments (internal implementation)
     */
    async executeGitInternal(args, options = {}) {
        const { cwd, timeout = this.defaultTimeout, signal, suppressExpectedErrors = false } = options;
        // Mask sensitive paths in logs
        const maskedArgs = args.map(arg => arg.includes('/') ? path.basename(arg) : arg);
        this.logger.debug(`Executing git command: git ${maskedArgs.join(' ')}`, { cwd });
        try {
            // Find Git executable - fail early if not available
            const gitExecutable = await this.findGitExecutable();
            const { stdout, stderr } = await execFileAsync(gitExecutable, args, {
                cwd,
                timeout,
                signal,
                encoding: 'utf8'
            });
            if (stderr && stderr.trim()) {
                this.logger.debug(`Git command stderr: ${stderr}`);
            }
            return stdout;
        }
        catch (error) {
            // Handle abort errors more gracefully
            if (error.name === 'AbortError' || error.code === 'ABORT_ERR') {
                this.logger.debug(`Git command aborted: git ${maskedArgs.join(' ')}`);
                throw error; // Re-throw abort errors as-is
            }
            // Check if this is an expected error that might be retried
            const isExpectedError = error.stderr && (error.stderr.includes('missing but already registered') ||
                error.stderr.includes('already used by worktree') ||
                error.stderr.includes('is a main working tree'));
            // Only log as error if it's not an expected error or if we're not suppressing
            if (!suppressExpectedErrors || !isExpectedError) {
                this.logger.error(`Git command failed: git ${maskedArgs.join(' ')}`, error);
            }
            // Enhance error message with more context
            if (error.code === 'ENOENT') {
                throw new Error('Git is not installed or not found in PATH. Please install Git or add it to your system PATH.');
            }
            else if (error.code === 'ETIMEDOUT') {
                throw new Error(`Git command timed out after ${timeout}ms`);
            }
            else if (error.stderr) {
                throw new Error(`Git error: ${error.stderr}`);
            }
            else {
                throw error;
            }
        }
    }
    /**
     * Check if the current directory is a Git repository
     */
    async isGitRepository(cwd) {
        try {
            await this.executeGitInternal(['rev-parse', '--git-dir'], { cwd, suppressExpectedErrors: true });
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Get the root directory of the Git repository
     */
    async getRepositoryRoot(cwd) {
        const stdout = await this.executeGitInternal(['rev-parse', '--show-toplevel'], { cwd });
        return stdout.trim();
    }
    /**
     * List all worktrees in the repository
     */
    async listWorktrees(cwd, signal) {
        const stdout = await this.executeGitInternal(['worktree', 'list', '--porcelain'], { cwd, signal });
        return this.parseWorktreeList(stdout);
    }
    /**
     * Create a new worktree
     */
    async createWorktree(repoPath, worktreePath, branch, options = {}, signal, suppressExpectedErrors = false) {
        if (options.orphan) {
            // For orphan branches, we need a different approach since git worktree add doesn't support --orphan
            // 1. Create worktree with a temporary branch
            const tempBranch = `temp-${Date.now()}`;
            const tempArgs = ['worktree', 'add', '-b', tempBranch, worktreePath];
            if (options.force) {
                tempArgs.splice(2, 0, '--force');
            }
            await this.executeGitInternal(tempArgs, { cwd: repoPath, signal, suppressExpectedErrors });
            // 2. Create orphan branch in the new worktree
            await this.executeGitInternal(['checkout', '--orphan', branch], { cwd: worktreePath, signal, suppressExpectedErrors });
            // 3. Remove all files to make it truly empty
            await this.executeGitInternal(['rm', '-rf', '.'], { cwd: worktreePath, signal, suppressExpectedErrors });
            // 4. Clean up any remaining files
            await this.executeGitInternal(['clean', '-fd'], { cwd: worktreePath, signal, suppressExpectedErrors });
            return;
        }
        const args = ['worktree', 'add'];
        if (options.force) {
            args.push('--force');
        }
        if (options.newBranch) {
            args.push('-b', branch);
        }
        args.push(worktreePath);
        if (!options.newBranch) {
            args.push(branch);
        }
        await this.executeGitInternal(args, { cwd: repoPath, signal, suppressExpectedErrors });
    }
    /**
     * Remove a worktree
     */
    async removeWorktree(repoPath, worktreePath, force = false, signal) {
        const args = ['worktree', 'remove'];
        if (force) {
            args.push('--force');
        }
        args.push(worktreePath);
        // Suppress expected errors for main working tree removal attempts
        const suppressExpectedErrors = true;
        await this.executeGitInternal(args, { cwd: repoPath, signal, suppressExpectedErrors });
    }
    /**
     * Get the status of a worktree (clean/dirty)
     */
    async getWorktreeStatus(worktreePath, signal) {
        try {
            const stdout = await this.executeGitInternal(['status', '--porcelain'], { cwd: worktreePath, signal });
            const lines = stdout.trim().split('\n').filter(line => line.length > 0);
            let staged = 0;
            let unstaged = 0;
            for (const line of lines) {
                const stagedChar = line[0];
                const unstagedChar = line[1];
                if (stagedChar !== ' ' && stagedChar !== '?') {
                    staged++;
                }
                if (unstagedChar !== ' ') {
                    unstaged++;
                }
            }
            return {
                clean: lines.length === 0,
                staged,
                unstaged
            };
        }
        catch (error) {
            this.logger.warn(`Failed to get status for worktree: ${worktreePath}`, error);
            return { clean: false, staged: 0, unstaged: 0 };
        }
    }
    /**
     * Get the current branch name for a worktree
     */
    async getCurrentBranch(worktreePath, signal) {
        try {
            const stdout = await this.executeGitInternal(['branch', '--show-current'], { cwd: worktreePath, signal });
            const branch = stdout.trim();
            return branch || null;
        }
        catch (error) {
            this.logger.debug(`Failed to get current branch for worktree: ${worktreePath}`, error);
            return null;
        }
    }
    /**
     * List all branches (local and remote)
     */
    async listBranches(cwd, signal) {
        const stdout = await this.executeGitInternal(['branch', '-a', '--format=%(refname:short)'], { cwd, signal });
        return stdout
            .trim()
            .split('\n')
            .map(branch => branch.trim())
            .filter(branch => branch.length > 0)
            .filter(branch => !branch.startsWith('origin/HEAD'));
    }
    /**
     * Get branches that don't have existing worktrees with branch type filtering and deduplication
     */
    async getBranchesWithoutWorktrees(cwd, branchType = BranchType.Both, signal) {
        // First, prune stale worktree entries to clean up the registry
        await this.pruneWorktrees(cwd, signal);
        // Get all branches
        const allBranches = await this.listBranches(cwd, signal);
        // Get existing worktrees (after pruning)
        const worktrees = await this.listWorktrees(cwd, signal);
        // Filter out worktrees that don't actually exist on disk
        const validWorktrees = worktrees.filter(wt => {
            try {
                return fs.existsSync(wt.path);
            }
            catch {
                return false;
            }
        });
        const usedBranches = new Set(validWorktrees
            .map(wt => wt.branch)
            .filter(branch => branch) // Filter out undefined branches
        );
        // Separate local and remote branches
        const localBranches = [];
        const remoteBranches = [];
        allBranches.forEach(branch => {
            if (branch.startsWith('origin/')) {
                remoteBranches.push(branch);
            }
            else {
                localBranches.push(branch);
            }
        });
        // Create a map to deduplicate branches (prefer local over remote)
        const branchMap = new Map();
        // Add local branches first (they take priority)
        localBranches.forEach(branch => {
            branchMap.set(branch, { branch, isLocal: true });
        });
        // Add remote branches only if no local equivalent exists
        remoteBranches.forEach(branch => {
            const cleanName = branch.substring(7); // Remove 'origin/' prefix
            if (!branchMap.has(cleanName)) {
                branchMap.set(cleanName, { branch, isLocal: false });
            }
        });
        // Filter based on branch type preference
        let filteredBranches = [];
        branchMap.forEach(({ branch, isLocal }) => {
            switch (branchType) {
                case BranchType.Local:
                    if (isLocal) {
                        filteredBranches.push(branch);
                    }
                    break;
                case BranchType.Remote:
                    if (!isLocal) {
                        filteredBranches.push(branch);
                    }
                    break;
                case BranchType.Both:
                    filteredBranches.push(branch);
                    break;
            }
        });
        // Filter out branches that already have valid worktrees
        return filteredBranches.filter(branch => {
            // Remove origin/ prefix for comparison
            const cleanBranch = branch.startsWith('origin/') ? branch.substring(7) : branch;
            return !usedBranches.has(cleanBranch) && !usedBranches.has(branch);
        });
    }
    /**
     * Reset all changes in a worktree (git reset --hard)
     */
    async resetHard(worktreePath, signal) {
        await this.executeGitInternal(['reset', '--hard'], { cwd: worktreePath, signal });
    }
    /**
     * Clean untracked files in a worktree (git clean -fd)
     */
    async clean(worktreePath, signal) {
        await this.executeGitInternal(['clean', '-fd'], { cwd: worktreePath, signal });
    }
    /**
     * Prune stale worktree entries (git worktree prune)
     */
    async pruneWorktrees(cwd, signal) {
        try {
            await this.executeGitInternal(['worktree', 'prune'], { cwd, signal });
            this.logger.debug('Pruned stale worktree entries');
        }
        catch (error) {
            this.logger.warn('Failed to prune stale worktree entries', error);
            // Don't throw - this is a cleanup operation that can fail safely
        }
    }
    /**
     * Fetch remote changes (git fetch)
     */
    async fetchRemote(cwd, signal) {
        await this.executeGitInternal(['fetch'], { cwd, signal });
        this.logger.debug('Fetched remote changes');
    }
    /**
     * Get list of remote branches
     */
    async listRemoteBranches(cwd, signal) {
        const stdout = await this.executeGitInternal(['branch', '-r'], { cwd, signal });
        return stdout
            .split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.includes('HEAD'))
            .map(line => line.replace(/^origin\//, ''));
    }
    /**
     * Get commit hash for a branch
     */
    async getBranchCommitHash(cwd, branch, signal) {
        const stdout = await this.executeGitInternal(['rev-parse', branch], { cwd, signal });
        return stdout.trim();
    }
    /**
     * Check if local branch is behind remote
     */
    async isBranchBehindRemote(cwd, localBranch, remoteBranch, signal) {
        try {
            const localHash = await this.getBranchCommitHash(cwd, localBranch, signal);
            const remoteHash = await this.getBranchCommitHash(cwd, `origin/${remoteBranch}`, signal);
            return localHash !== remoteHash;
        }
        catch (error) {
            this.logger.warn(`Failed to compare branch hashes for ${localBranch}`, error);
            return false;
        }
    }
    /**
     * Get detailed status including untracked files
     */
    async getStatus(worktreePath, signal) {
        try {
            const stdout = await this.executeGitInternal(['status', '--porcelain'], { cwd: worktreePath, signal });
            const lines = stdout.trim().split('\n').filter(line => line.length > 0);
            let staged = 0;
            let unstaged = 0;
            let untracked = 0;
            for (const line of lines) {
                const stagedChar = line[0];
                const unstagedChar = line[1];
                if (stagedChar === '?' && unstagedChar === '?') {
                    untracked++;
                }
                else {
                    if (stagedChar !== ' ' && stagedChar !== '?') {
                        staged++;
                    }
                    if (unstagedChar !== ' ' && unstagedChar !== '?') {
                        unstaged++;
                    }
                }
            }
            return {
                clean: lines.length === 0,
                staged,
                unstaged,
                untracked
            };
        }
        catch (error) {
            this.logger.warn(`Failed to get detailed status for worktree: ${worktreePath}`, error);
            return { clean: false, staged: 0, unstaged: 0, untracked: 0 };
        }
    }
    /**
     * Parse the output of 'git worktree list --porcelain'
     */
    parseWorktreeList(output) {
        const worktrees = [];
        const lines = output.trim().split('\n');
        let currentWorktree = {};
        for (const line of lines) {
            if (line.startsWith('worktree ')) {
                // Start of a new worktree entry
                if (currentWorktree.path) {
                    worktrees.push(currentWorktree);
                }
                currentWorktree = {
                    path: line.substring(9),
                    bare: false,
                    detached: false,
                    locked: false,
                    prunable: false
                };
            }
            else if (line.startsWith('HEAD ')) {
                currentWorktree.head = line.substring(5);
            }
            else if (line.startsWith('branch ')) {
                currentWorktree.branch = line.substring(7);
            }
            else if (line === 'bare') {
                currentWorktree.bare = true;
            }
            else if (line === 'detached') {
                currentWorktree.detached = true;
            }
            else if (line.startsWith('locked')) {
                currentWorktree.locked = true;
            }
            else if (line.startsWith('prunable')) {
                currentWorktree.prunable = true;
            }
        }
        // Add the last worktree
        if (currentWorktree.path) {
            worktrees.push(currentWorktree);
        }
        return worktrees;
    }
}
exports.GitCLI = GitCLI;
GitCLI.DEFAULT_TIMEOUT = 30000; // 30 seconds
//# sourceMappingURL=gitCli.js.map