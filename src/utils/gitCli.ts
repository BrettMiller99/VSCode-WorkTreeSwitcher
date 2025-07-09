import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import { Logger } from './logger';

export enum BranchType {
    Local = 'local',
    Remote = 'remote',
    Both = 'both'
}

const execFileAsync = promisify(execFile);

export interface GitWorktree {
    path: string;
    head: string;
    branch?: string;
    bare: boolean;
    detached: boolean;
    locked: boolean;
    prunable: boolean;
}

export interface GitCommandOptions {
    cwd?: string;
    timeout?: number;
    signal?: AbortSignal;
    suppressExpectedErrors?: boolean;
}

/**
 * Thin wrapper around Git CLI operations using child_process.execFile.
 * All Git commands are funneled through this class for testability and consistent error handling.
 */
export class GitCLI {
    private static readonly DEFAULT_TIMEOUT = 30000; // 30 seconds
    private logger: Logger;
    private defaultTimeout: number;

    constructor(logger: Logger, defaultTimeout?: number) {
        this.logger = logger;
        this.defaultTimeout = defaultTimeout || GitCLI.DEFAULT_TIMEOUT;
    }

    /**
     * Find Git executable with fallback locations
     */
    private async findGitExecutable(): Promise<string> {
        // Try common Git locations
        const commonPaths = [
            'git', // Default PATH
            '/usr/bin/git',
            '/usr/local/bin/git',
            '/opt/homebrew/bin/git', // Apple Silicon Homebrew
            '/opt/local/bin/git' // MacPorts
        ];

        for (const gitPath of commonPaths) {
            try {
                await execFileAsync(gitPath, ['--version'], { timeout: 5000 });
                return gitPath;
            } catch {
                continue;
            }
        }

        throw new Error('Git executable not found. Please ensure Git is installed and available in PATH.');
    }

    /**
     * Execute a Git command with the given arguments
     */
    private async executeGit(args: string[], options: GitCommandOptions = {}): Promise<string> {
        const { cwd, timeout = this.defaultTimeout, signal, suppressExpectedErrors = false } = options;
        
        // Mask sensitive paths in logs
        const maskedArgs = args.map(arg => 
            arg.includes('/') ? path.basename(arg) : arg
        );
        
        this.logger.debug(`Executing git command: git ${maskedArgs.join(' ')}`, { cwd });

        try {
            // Try to find Git executable if not already cached
            let gitExecutable = 'git';
            try {
                gitExecutable = await this.findGitExecutable();
            } catch (error) {
                this.logger.warn('Could not find Git executable, using default "git"');
            }

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
        } catch (error: any) {
            // Handle abort errors more gracefully
            if (error.name === 'AbortError' || error.code === 'ABORT_ERR') {
                this.logger.debug(`Git command aborted: git ${maskedArgs.join(' ')}`);
                throw error; // Re-throw abort errors as-is
            }
            
            // Check if this is an expected error that might be retried
            const isExpectedError = error.stderr && (
                error.stderr.includes('missing but already registered') ||
                error.stderr.includes('already used by worktree') ||
                error.stderr.includes('is a main working tree')
            );
            
            // Only log as error if it's not an expected error or if we're not suppressing
            if (!suppressExpectedErrors || !isExpectedError) {
                this.logger.error(`Git command failed: git ${maskedArgs.join(' ')}`, error);
            }
            
            // Enhance error message with more context
            if (error.code === 'ENOENT') {
                throw new Error('Git is not installed or not found in PATH. Please install Git or add it to your system PATH.');
            } else if (error.code === 'ETIMEDOUT') {
                throw new Error(`Git command timed out after ${timeout}ms`);
            } else if (error.stderr) {
                throw new Error(`Git error: ${error.stderr}`);
            } else {
                throw error;
            }
        }
    }

    /**
     * Check if the current directory is a Git repository
     */
    async isGitRepository(cwd: string): Promise<boolean> {
        try {
            await this.executeGit(['rev-parse', '--git-dir'], { cwd });
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get the root directory of the Git repository
     */
    async getRepositoryRoot(cwd: string): Promise<string> {
        const stdout = await this.executeGit(['rev-parse', '--show-toplevel'], { cwd });
        return stdout.trim();
    }

    /**
     * List all worktrees in the repository
     */
    async listWorktrees(cwd: string, signal?: AbortSignal): Promise<GitWorktree[]> {
        const stdout = await this.executeGit(['worktree', 'list', '--porcelain'], { cwd, signal });
        return this.parseWorktreeList(stdout);
    }

    /**
     * Create a new worktree
     */
    async createWorktree(
        repoPath: string,
        worktreePath: string,
        branch: string,
        options: { newBranch?: boolean; force?: boolean; orphan?: boolean } = {},
        signal?: AbortSignal,
        suppressExpectedErrors: boolean = false
    ): Promise<void> {
        if (options.orphan) {
            // For orphan branches, we need a different approach since git worktree add doesn't support --orphan
            // 1. Create worktree with a temporary branch
            const tempBranch = `temp-${Date.now()}`;
            const tempArgs = ['worktree', 'add', '-b', tempBranch, worktreePath];
            if (options.force) {
                tempArgs.splice(2, 0, '--force');
            }
            await this.executeGit(tempArgs, { cwd: repoPath, signal, suppressExpectedErrors });
            
            // 2. Create orphan branch in the new worktree
            await this.executeGit(['checkout', '--orphan', branch], { cwd: worktreePath, signal, suppressExpectedErrors });
            
            // 3. Remove all files to make it truly empty
            await this.executeGit(['rm', '-rf', '.'], { cwd: worktreePath, signal, suppressExpectedErrors });
            
            // 4. Clean up any remaining files
            await this.executeGit(['clean', '-fd'], { cwd: worktreePath, signal, suppressExpectedErrors });
            
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

        await this.executeGit(args, { cwd: repoPath, signal, suppressExpectedErrors });
    }

    /**
     * Remove a worktree
     */
    async removeWorktree(repoPath: string, worktreePath: string, force: boolean = false, signal?: AbortSignal): Promise<void> {
        const args = ['worktree', 'remove'];
        
        if (force) {
            args.push('--force');
        }
        
        args.push(worktreePath);

        // Suppress expected errors for main working tree removal attempts
        const suppressExpectedErrors = true;
        await this.executeGit(args, { cwd: repoPath, signal, suppressExpectedErrors });
    }

    /**
     * Get the status of a worktree (clean/dirty)
     */
    async getWorktreeStatus(worktreePath: string, signal?: AbortSignal): Promise<{ clean: boolean; staged: number; unstaged: number }> {
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
        } catch (error) {
            this.logger.warn(`Failed to get status for worktree: ${worktreePath}`, error);
            return { clean: false, staged: 0, unstaged: 0 };
        }
    }

    /**
     * Get the current branch name for a worktree
     */
    async getCurrentBranch(worktreePath: string, signal?: AbortSignal): Promise<string | null> {
        try {
            const stdout = await this.executeGit(['branch', '--show-current'], { cwd: worktreePath, signal });
            const branch = stdout.trim();
            return branch || null;
        } catch (error) {
            this.logger.debug(`Failed to get current branch for worktree: ${worktreePath}`, error);
            return null;
        }
    }

    /**
     * List all branches (local and remote)
     */
    async listBranches(cwd: string, signal?: AbortSignal): Promise<string[]> {
        const stdout = await this.executeGit(['branch', '-a', '--format=%(refname:short)'], { cwd, signal });
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
    async getBranchesWithoutWorktrees(
        cwd: string, 
        branchType: BranchType = BranchType.Both,
        signal?: AbortSignal
    ): Promise<string[]> {
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
            } catch {
                return false;
            }
        });
        
        const usedBranches = new Set(
            validWorktrees
                .map(wt => wt.branch)
                .filter(branch => branch) // Filter out undefined branches
        );

        // Separate local and remote branches
        const localBranches: string[] = [];
        const remoteBranches: string[] = [];
        
        allBranches.forEach(branch => {
            if (branch.startsWith('origin/')) {
                remoteBranches.push(branch);
            } else {
                localBranches.push(branch);
            }
        });
        
        // Create a map to deduplicate branches (prefer local over remote)
        const branchMap = new Map<string, { branch: string; isLocal: boolean }>();
        
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
        let filteredBranches: string[] = [];
        
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
    async resetHard(worktreePath: string, signal?: AbortSignal): Promise<void> {
        await this.executeGit(['reset', '--hard'], { cwd: worktreePath, signal });
    }

    /**
     * Clean untracked files in a worktree (git clean -fd)
     */
    async clean(worktreePath: string, signal?: AbortSignal): Promise<void> {
        await this.executeGit(['clean', '-fd'], { cwd: worktreePath, signal });
    }

    /**
     * Prune stale worktree entries (git worktree prune)
     */
    async pruneWorktrees(cwd: string, signal?: AbortSignal): Promise<void> {
        try {
            await this.executeGit(['worktree', 'prune'], { cwd, signal });
            this.logger.debug('Pruned stale worktree entries');
        } catch (error) {
            this.logger.warn('Failed to prune stale worktree entries', error);
            // Don't throw - this is a cleanup operation that can fail safely
        }
    }

    /**
     * Get detailed status including untracked files
     */
    async getStatus(worktreePath: string, signal?: AbortSignal): Promise<{ clean: boolean; staged: number; unstaged: number; untracked: number }> {
        try {
            const stdout = await this.executeGit(['status', '--porcelain'], { cwd: worktreePath, signal });
            const lines = stdout.trim().split('\n').filter(line => line.length > 0);
            
            let staged = 0;
            let unstaged = 0;
            let untracked = 0;
            
            for (const line of lines) {
                const stagedChar = line[0];
                const unstagedChar = line[1];
                
                if (stagedChar === '?' && unstagedChar === '?') {
                    untracked++;
                } else {
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
        } catch (error) {
            this.logger.warn(`Failed to get detailed status for worktree: ${worktreePath}`, error);
            return { clean: false, staged: 0, unstaged: 0, untracked: 0 };
        }
    }

    /**
     * Parse the output of 'git worktree list --porcelain'
     */
    private parseWorktreeList(output: string): GitWorktree[] {
        const worktrees: GitWorktree[] = [];
        const lines = output.trim().split('\n');
        
        let currentWorktree: Partial<GitWorktree> = {};
        
        for (const line of lines) {
            if (line.startsWith('worktree ')) {
                // Start of a new worktree entry
                if (currentWorktree.path) {
                    worktrees.push(currentWorktree as GitWorktree);
                }
                currentWorktree = {
                    path: line.substring(9), // Remove 'worktree ' prefix
                    bare: false,
                    detached: false,
                    locked: false,
                    prunable: false
                };
            } else if (line.startsWith('HEAD ')) {
                currentWorktree.head = line.substring(5);
            } else if (line.startsWith('branch ')) {
                currentWorktree.branch = line.substring(7);
            } else if (line === 'bare') {
                currentWorktree.bare = true;
            } else if (line === 'detached') {
                currentWorktree.detached = true;
            } else if (line.startsWith('locked')) {
                currentWorktree.locked = true;
            } else if (line.startsWith('prunable')) {
                currentWorktree.prunable = true;
            }
        }
        
        // Add the last worktree
        if (currentWorktree.path) {
            worktrees.push(currentWorktree as GitWorktree);
        }
        
        return worktrees;
    }
}
