import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import { Logger } from './logger';

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
     * Execute a Git command with the given arguments
     */
    private async executeGit(args: string[], options: GitCommandOptions = {}): Promise<string> {
        const { cwd, timeout = this.defaultTimeout, signal } = options;
        
        // Mask sensitive paths in logs
        const maskedArgs = args.map(arg => 
            arg.includes('/') ? path.basename(arg) : arg
        );
        
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
        } catch (error: any) {
            // Handle abort errors more gracefully
            if (error.name === 'AbortError' || error.code === 'ABORT_ERR') {
                this.logger.debug(`Git command aborted: git ${maskedArgs.join(' ')}`);
                throw error; // Re-throw abort errors as-is
            }
            
            this.logger.error(`Git command failed: git ${maskedArgs.join(' ')}`, error);
            
            // Enhance error message with more context
            if (error.code === 'ENOENT') {
                throw new Error('Git is not installed or not found in PATH');
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
        signal?: AbortSignal
    ): Promise<void> {
        if (options.orphan) {
            // For orphan branches, we need a different approach since git worktree add doesn't support --orphan
            // 1. Create worktree with a temporary branch
            const tempBranch = `temp-${Date.now()}`;
            const tempArgs = ['worktree', 'add', '-b', tempBranch, worktreePath];
            if (options.force) {
                tempArgs.splice(2, 0, '--force');
            }
            await this.executeGit(tempArgs, { cwd: repoPath, signal });
            
            // 2. Create orphan branch in the new worktree
            await this.executeGit(['checkout', '--orphan', branch], { cwd: worktreePath, signal });
            
            // 3. Remove all files to make it truly empty
            await this.executeGit(['rm', '-rf', '.'], { cwd: worktreePath, signal });
            
            // 4. Clean up any remaining files
            await this.executeGit(['clean', '-fd'], { cwd: worktreePath, signal });
            
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

        await this.executeGit(args, { cwd: repoPath, signal });
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

        await this.executeGit(args, { cwd: repoPath, signal });
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
     * Get branches that don't have existing worktrees
     */
    async getBranchesWithoutWorktrees(cwd: string, signal?: AbortSignal): Promise<string[]> {
        const [allBranches, existingWorktrees] = await Promise.all([
            this.listBranches(cwd, signal),
            this.listWorktrees(cwd, signal)
        ]);

        // Get branches that are already used by worktrees
        const usedBranches = new Set(
            existingWorktrees
                .map(wt => wt.branch)
                .filter(branch => branch) // Filter out undefined branches
        );

        // Filter out branches that already have worktrees
        return allBranches.filter(branch => {
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
