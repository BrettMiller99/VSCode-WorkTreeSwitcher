import * as vscode from 'vscode';
import { WorktreeService, WorktreeInfo } from '../services/worktreeService';
import { ConfigurationService } from '../services/configurationService';
import { Logger } from '../utils/logger';

/**
 * Tree data provider for the Activity Bar worktree view.
 * Provides a more compact and action-oriented view compared to the Explorer view.
 */
export class ActivityBarProvider implements vscode.TreeDataProvider<WorktreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<WorktreeItem | undefined | null | void> = new vscode.EventEmitter<WorktreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<WorktreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private disposables: vscode.Disposable[] = [];

    constructor(
        private worktreeService: WorktreeService,
        private configService: ConfigurationService,
        private logger: Logger
    ) {
        // Listen for worktree changes
        this.worktreeService.onDidChangeWorktrees(() => {
            this.refresh();
        });

        // Listen for configuration changes that might affect the view
        this.configService.onConfigurationChanged(() => {
            this.refresh();
        });
    }

    /**
     * Refresh the tree view
     */
    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    /**
     * Get tree item representation
     */
    getTreeItem(element: WorktreeItem): vscode.TreeItem {
        return element;
    }

    /**
     * Get children for tree view
     */
    async getChildren(element?: WorktreeItem): Promise<WorktreeItem[]> {
        if (!element) {
            // Root level - return all worktrees
            try {
                const worktrees = await this.worktreeService.getWorktrees();
                
                return worktrees.map(worktree => {
                    const isCurrent = worktree.isActive;
                    return new WorktreeItem(
                        worktree,
                        isCurrent,
                        this.getWorktreeIcon(worktree, isCurrent),
                        this.getStatusIcon(worktree)
                    );
                });
            } catch (error) {
                this.logger.error('Failed to get worktrees for Activity Bar', error);
                return [];
            }
        }
        
        return [];
    }

    /**
     * Get appropriate icon for worktree type
     */
    private getWorktreeIcon(worktree: WorktreeInfo, isCurrent: boolean): string {
        if (isCurrent) {
            return '🏠'; // Current worktree
        }

        const branchName = worktree.branch?.toLowerCase() || '';
        
        if (branchName.includes('feature') || branchName.startsWith('feat/')) {
            return '🚀'; // Feature branch
        } else if (branchName.includes('hotfix') || branchName.includes('fix')) {
            return '🔧'; // Hotfix branch
        } else if (branchName === 'main' || branchName === 'master') {
            return '🌟'; // Main branch
        } else {
            return '🌿'; // Generic branch
        }
    }

    /**
     * Get status icon based on worktree state
     */
    private getStatusIcon(worktree: WorktreeInfo): string {
        if (worktree.locked) {
            return '🔒'; // Locked
        }
        
        // Check status based on the status object structure
        if (worktree.status.clean && worktree.status.staged === 0 && worktree.status.unstaged === 0) {
            return '🟢'; // Clean
        } else if (worktree.status.staged > 0) {
            return '🟡'; // Staged changes
        } else if (worktree.status.unstaged > 0) {
            return '🔴'; // Unstaged changes
        } else {
            return '⚪'; // Unknown status
        }
    }

    /**
     * Get badge count for dirty worktrees
     */
    async getBadgeCount(): Promise<number> {
        try {
            const worktrees = await this.worktreeService.getWorktrees();
            return worktrees.filter(w => !w.status.clean || w.status.staged > 0 || w.status.unstaged > 0).length;
        } catch (error) {
            this.logger.error('Failed to get badge count', error);
            return 0;
        }
    }

    /**
     * Dispose of resources
     */
    dispose(): void {
        this.disposables.forEach(d => d.dispose());
        this._onDidChangeTreeData.dispose();
    }
}

/**
 * Tree item for Activity Bar worktree view
 */
export class WorktreeItem extends vscode.TreeItem {
    constructor(
        public readonly worktree: WorktreeInfo,
        public readonly isCurrent: boolean,
        private readonly typeIcon: string,
        private readonly statusIcon: string
    ) {
        super(
            `${typeIcon} ${worktree.name || worktree.branch || 'Unknown'} ${statusIcon}`,
            vscode.TreeItemCollapsibleState.None
        );

        this.contextValue = 'worktree';
        this.resourceUri = vscode.Uri.file(worktree.path);
        
        // Enhanced tooltip with full information
        this.tooltip = new vscode.MarkdownString();
        this.tooltip.appendMarkdown(`**${typeIcon} ${worktree.name || worktree.branch}** ${statusIcon}\n\n`);
        this.tooltip.appendMarkdown(`📂 **Path:** \`${worktree.path}\`\n\n`);
        if (worktree.branch) {
            this.tooltip.appendMarkdown(`🌱 **Branch:** \`${worktree.branch}\`\n\n`);
        }
        this.tooltip.appendMarkdown(`📊 **Status:** ${this.getStatusDescription()}\n\n`);
        if (this.isCurrent) {
            this.tooltip.appendMarkdown(`✅ **Current Workspace**`);
        } else {
            this.tooltip.appendMarkdown(`💡 *Click to switch to this worktree*`);
        }

        // Enhanced description with path and status
        this.description = `${worktree.branch || 'No branch'} • ${worktree.path.split('/').pop()}`;
        
        // Command to execute when clicked
        if (!this.isCurrent) {
            this.command = {
                command: 'worktree.switch',
                title: 'Switch to Worktree',
                arguments: [worktree]
            };
        }
    }

    private getStatusDescription(): string {
        if (this.worktree.locked) {
            return 'Locked 🔒';
        }
        
        // Check status based on the status object structure
        if (this.worktree.status.clean && this.worktree.status.staged === 0 && this.worktree.status.unstaged === 0) {
            return 'Clean 🟢';
        } else if (this.worktree.status.staged > 0) {
            return `Staged Changes (${this.worktree.status.staged}) 🟡`;
        } else if (this.worktree.status.unstaged > 0) {
            return `Unstaged Changes (${this.worktree.status.unstaged}) 🔴`;
        } else {
            return 'Unknown ⚪';
        }
    }
}
