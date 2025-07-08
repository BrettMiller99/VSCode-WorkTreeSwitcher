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
exports.GitCLI = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const path = __importStar(require("path"));
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
/**
 * Thin wrapper around Git CLI operations using child_process.execFile.
 * All Git commands are funneled through this class for testability and consistent error handling.
 */
class GitCLI {
    constructor(logger, defaultTimeout) {
        this.logger = logger;
        this.defaultTimeout = defaultTimeout || GitCLI.DEFAULT_TIMEOUT;
    }
    /**
     * Execute a Git command with the given arguments
     */
    async executeGit(args, options = {}) {
        const { cwd, timeout = this.defaultTimeout, signal } = options;
        // Mask sensitive paths in logs
        const maskedArgs = args.map(arg => arg.includes('/') ? path.basename(arg) : arg);
        this.logger.debug(`Executing git command: git ${maskedArgs.join(' ')}`, { cwd });
        try {
            const { stdout, stderr } = await execFileAsync('git', args, {
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
            this.logger.error(`Git command failed: git ${maskedArgs.join(' ')}`, error);
            // Enhance error message with more context
            if (error.code === 'ENOENT') {
                throw new Error('Git is not installed or not found in PATH');
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
            await this.executeGit(['rev-parse', '--git-dir'], { cwd });
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
        const stdout = await this.executeGit(['rev-parse', '--show-toplevel'], { cwd });
        return stdout.trim();
    }
    /**
     * List all worktrees in the repository
     */
    async listWorktrees(cwd, signal) {
        const stdout = await this.executeGit(['worktree', 'list', '--porcelain'], { cwd, signal });
        return this.parseWorktreeList(stdout);
    }
    /**
     * Create a new worktree
     */
    async createWorktree(repoPath, worktreePath, branch, options = {}, signal) {
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
        await this.executeGit(args, { cwd: repoPath, signal });
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
        await this.executeGit(args, { cwd: repoPath, signal });
    }
    /**
     * Get the status of a worktree (clean/dirty)
     */
    async getWorktreeStatus(worktreePath, signal) {
        try {
            const stdout = await this.executeGit(['status', '--porcelain'], { cwd: worktreePath, signal });
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
            const stdout = await this.executeGit(['branch', '--show-current'], { cwd: worktreePath, signal });
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
        const stdout = await this.executeGit(['branch', '-a', '--format=%(refname:short)'], { cwd, signal });
        return stdout
            .trim()
            .split('\n')
            .map(branch => branch.trim())
            .filter(branch => branch.length > 0)
            .filter(branch => !branch.startsWith('origin/HEAD'));
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