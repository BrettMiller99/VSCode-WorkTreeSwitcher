import * as vscode from 'vscode';
import { WorktreeService, WorktreeInfo } from '../services/worktreeService';
import { ConfigurationService } from '../services/configurationService';
import { Logger } from '../utils/logger';

/**
 * Controller for handling bulk operations across multiple worktrees.
 * Provides functionality for discarding changes, bulk status checks, and other multi-worktree operations.
 */
export class BulkOperationsController implements vscode.Disposable {
    private logger: Logger;
    private worktreeService: WorktreeService;
    private configService: ConfigurationService;

    constructor(
        worktreeService: WorktreeService,
        configService: ConfigurationService,
        logger: Logger
    ) {
        this.worktreeService = worktreeService;
        this.configService = configService;
        this.logger = logger;
    }

    /**
     * Show bulk operations menu with available actions
     */
    async showBulkOperationsMenu(): Promise<void> {
        const operations = [
            {
                label: '🗑️ Discard All Changes',
                description: 'Discard uncommitted changes across all worktrees',
                action: 'discardAllChanges'
            },
            {
                label: '📊 Bulk Status Check',
                description: 'Show status overview of all worktrees',
                action: 'bulkStatusCheck'
            },
            {
                label: '🔄 Refresh All Worktrees',
                description: 'Refresh status of all worktrees',
                action: 'refreshAll'
            },
            {
                label: '🧹 Clean All Worktrees',
                description: 'Remove untracked files from all worktrees',
                action: 'cleanAll'
            }
        ];

        const selected = await vscode.window.showQuickPick(operations, {
            placeHolder: '🔧 Select a bulk operation to perform',
            title: 'Bulk Worktree Operations'
        });

        if (!selected) {
            return;
        }

        switch (selected.action) {
            case 'discardAllChanges':
                await this.discardAllChanges();
                break;
            case 'bulkStatusCheck':
                await this.showBulkStatusCheck();
                break;
            case 'refreshAll':
                await this.refreshAllWorktrees();
                break;
            case 'cleanAll':
                await this.cleanAllWorktrees();
                break;
        }
    }

    /**
     * Discard uncommitted changes across all worktrees
     */
    async discardAllChanges(): Promise<void> {
        try {
            const worktrees = await this.worktreeService.getWorktrees();
            const dirtyWorktrees = worktrees.filter(w => 
                !w.status.clean || w.status.staged > 0 || w.status.unstaged > 0
            );

            if (dirtyWorktrees.length === 0) {
                vscode.window.showInformationMessage('🟢 All worktrees are clean - no changes to discard');
                return;
            }

            // Show confirmation dialog if enabled
            if (this.configService.shouldConfirmDangerousOperations()) {
                const confirmation = await vscode.window.showWarningMessage(
                    `⚠️ This will discard ALL uncommitted changes in ${dirtyWorktrees.length} worktree(s). This action cannot be undone.`,
                    { modal: true },
                    'Discard All Changes',
                    'Cancel'
                );

                if (confirmation !== 'Discard All Changes') {
                    return;
                }
            }

            // Show progress indicator
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Discarding changes across worktrees',
                cancellable: true
            }, async (progress, token) => {
                const total = dirtyWorktrees.length;
                let completed = 0;

                for (const worktree of dirtyWorktrees) {
                    if (token.isCancellationRequested) {
                        break;
                    }

                    progress.report({
                        message: `Processing ${worktree.name}...`,
                        increment: 0
                    });

                    try {
                        await this.discardWorktreeChanges(worktree);
                        completed++;
                        
                        progress.report({
                            message: `Completed ${completed}/${total} worktrees`,
                            increment: (100 / total)
                        });

                        this.logger.info(`Discarded changes in worktree: ${worktree.name}`);
                    } catch (error) {
                        this.logger.error(`Failed to discard changes in worktree: ${worktree.name}`, error);
                        // Continue with other worktrees even if one fails
                    }
                }

                if (!token.isCancellationRequested) {
                    vscode.window.showInformationMessage(
                        `✅ Discarded changes in ${completed}/${total} worktrees`
                    );
                }
            });

            // Refresh worktree status
            await this.worktreeService.refresh();

        } catch (error) {
            this.logger.error('Failed to discard all changes', error);
            vscode.window.showErrorMessage('Failed to discard changes. Check the output panel for details.');
        }
    }

    /**
     * Show bulk status check for all worktrees
     */
    async showBulkStatusCheck(): Promise<void> {
        try {
            const worktrees = await this.worktreeService.getWorktrees();
            
            const statusItems = worktrees.map(worktree => {
                const statusIcon = this.getStatusIcon(worktree);
                const typeIcon = this.getTypeIcon(worktree);
                const branchName = worktree.currentBranch || worktree.branch || 'unknown';
                
                let statusText = 'Clean';
                if (worktree.status.staged > 0) {
                    statusText = `${worktree.status.staged} staged`;
                }
                if (worktree.status.unstaged > 0) {
                    statusText += statusText === 'Clean' ? 
                        `${worktree.status.unstaged} unstaged` : 
                        `, ${worktree.status.unstaged} unstaged`;
                }

                return {
                    label: `${typeIcon} ${worktree.name} ${statusIcon}`,
                    description: `${branchName} • ${statusText}`,
                    detail: worktree.path,
                    worktree
                };
            });

            const selected = await vscode.window.showQuickPick(statusItems, {
                placeHolder: '📊 Worktree Status Overview - Select a worktree to switch to it',
                title: `Bulk Status Check (${worktrees.length} worktrees)`,
                matchOnDescription: true,
                matchOnDetail: true
            });

            if (selected) {
                // Switch to selected worktree
                await this.worktreeService.switchWorktree(selected.worktree.path);
            }

        } catch (error) {
            this.logger.error('Failed to show bulk status check', error);
            vscode.window.showErrorMessage('Failed to get worktree status. Check the output panel for details.');
        }
    }

    /**
     * Refresh all worktrees
     */
    async refreshAllWorktrees(): Promise<void> {
        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Refreshing all worktrees...',
                cancellable: false
            }, async () => {
                await this.worktreeService.refresh();
            });

            vscode.window.showInformationMessage('✅ All worktrees refreshed successfully');
        } catch (error) {
            this.logger.error('Failed to refresh all worktrees', error);
            vscode.window.showErrorMessage('Failed to refresh worktrees. Check the output panel for details.');
        }
    }

    /**
     * Clean untracked files from all worktrees
     */
    async cleanAllWorktrees(): Promise<void> {
        try {
            const worktrees = await this.worktreeService.getWorktrees();

            // Show confirmation dialog
            if (this.configService.shouldConfirmDangerousOperations()) {
                const confirmation = await vscode.window.showWarningMessage(
                    `⚠️ This will remove all untracked files from ${worktrees.length} worktree(s). This action cannot be undone.`,
                    { modal: true },
                    'Clean All Worktrees',
                    'Cancel'
                );

                if (confirmation !== 'Clean All Worktrees') {
                    return;
                }
            }

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Cleaning all worktrees...',
                cancellable: true
            }, async (progress, token) => {
                const total = worktrees.length;
                let completed = 0;

                for (const worktree of worktrees) {
                    if (token.isCancellationRequested) {
                        break;
                    }

                    progress.report({
                        message: `Cleaning ${worktree.name}...`,
                        increment: 0
                    });

                    try {
                        await this.cleanWorktree(worktree);
                        completed++;
                        
                        progress.report({
                            message: `Completed ${completed}/${total} worktrees`,
                            increment: (100 / total)
                        });

                        this.logger.info(`Cleaned worktree: ${worktree.name}`);
                    } catch (error) {
                        this.logger.error(`Failed to clean worktree: ${worktree.name}`, error);
                        // Continue with other worktrees even if one fails
                    }
                }

                if (!token.isCancellationRequested) {
                    vscode.window.showInformationMessage(
                        `✅ Cleaned ${completed}/${total} worktrees`
                    );
                }
            });

            // Refresh worktree status
            await this.worktreeService.refresh();

        } catch (error) {
            this.logger.error('Failed to clean all worktrees', error);
            vscode.window.showErrorMessage('Failed to clean worktrees. Check the output panel for details.');
        }
    }

    /**
     * Discard changes in a specific worktree
     */
    private async discardWorktreeChanges(worktree: WorktreeInfo): Promise<void> {
        await this.worktreeService.discardWorktreeChanges(worktree.path);
    }

    /**
     * Clean untracked files in a specific worktree
     */
    private async cleanWorktree(worktree: WorktreeInfo): Promise<void> {
        await this.worktreeService.cleanWorktree(worktree.path);
    }

    /**
     * Get status icon for worktree
     */
    private getStatusIcon(worktree: WorktreeInfo): string {
        if (worktree.locked) {
            return '🔒';
        }
        
        if (worktree.status.clean && worktree.status.staged === 0 && worktree.status.unstaged === 0) {
            return '🟢';
        } else if (worktree.status.staged > 0) {
            return '🟡';
        } else if (worktree.status.unstaged > 0) {
            return '🔴';
        } else {
            return '⚪';
        }
    }

    /**
     * Get type icon for worktree
     */
    private getTypeIcon(worktree: WorktreeInfo): string {
        if (worktree.isActive) {
            return '🏠';
        }

        const branchName = worktree.currentBranch || worktree.branch || '';
        
        if (branchName.includes('feature/') || branchName.startsWith('feat/')) {
            return '🚀';
        } else if (branchName.includes('hotfix/') || branchName.includes('fix/')) {
            return '🔧';
        } else if (branchName === 'main' || branchName === 'master') {
            return '🌟';
        } else {
            return '🌿';
        }
    }

    dispose(): void {
        // No resources to dispose currently
    }
}
