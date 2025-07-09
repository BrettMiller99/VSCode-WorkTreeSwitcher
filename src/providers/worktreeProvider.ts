import * as vscode from 'vscode';
import * as path from 'path';
import { WorktreeService, WorktreeInfo } from '../services/worktreeService';
import { Logger } from '../utils/logger';

export class WorktreeItem extends vscode.TreeItem {
    constructor(
        public readonly worktree: WorktreeInfo,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        // Enhanced label with icons like Activity Bar
        super(`${WorktreeItem.getWorktreeTypeIcon(worktree)} ${worktree.name} ${WorktreeItem.getStatusIcon(worktree)}`, collapsibleState);
        
        this.tooltip = this.buildTooltip();
        this.description = this.buildDescription();
        this.iconPath = this.getIcon();
        this.contextValue = 'worktree';
        this.resourceUri = vscode.Uri.file(worktree.path);
        
        // Add command to switch to worktree on click (same window)
        this.command = {
            command: 'worktree.switch',
            title: 'Switch to Worktree',
            arguments: [this]
        };
    }

    private buildTooltip(): vscode.MarkdownString {
        const typeIcon = WorktreeItem.getWorktreeTypeIcon(this.worktree);
        const statusIcon = WorktreeItem.getStatusIcon(this.worktree);
        const branchName = this.worktree.currentBranch || this.worktree.branch || 'Unknown branch';
        const statusText = this.getStatusText();
        
        // Enhanced markdown tooltip like Activity Bar
        const tooltip = new vscode.MarkdownString();
        tooltip.appendMarkdown(`**${typeIcon} ${this.worktree.name}** ${statusIcon}\n\n`);
        tooltip.appendMarkdown(`📂 **Path:** \`${this.worktree.path}\`\n\n`);
        if (this.worktree.branch) {
            tooltip.appendMarkdown(`🌱 **Branch:** \`${branchName}\`\n\n`);
        }
        tooltip.appendMarkdown(`🔗 **HEAD:** \`${this.worktree.head.substring(0, 8)}\`\n\n`);
        tooltip.appendMarkdown(`📊 **Status:** ${statusText}\n\n`);
        
        if (this.worktree.isActive) {
            tooltip.appendMarkdown(`✅ **Current Workspace**`);
        } else {
            tooltip.appendMarkdown(`💡 *Click to switch to this worktree*`);
        }
        
        if (this.worktree.locked) {
            tooltip.appendMarkdown(`\n\n🔒 **Locked**`);
        }
        
        if (this.worktree.prunable) {
            tooltip.appendMarkdown(`\n\n⚠️ **Prunable**`);
        }
        
        return tooltip;
    }

    private buildDescription(): string {
        // Enhanced description with path and status like Activity Bar
        const branchName = this.worktree.currentBranch || this.worktree.branch || 'No branch';
        const pathName = this.worktree.path.split('/').pop() || 'Unknown';
        return `${branchName} • ${pathName}`;
    }

    private getStatusText(): string {
        if (this.worktree.status.clean) {
            return 'Clean';
        }

        const parts: string[] = [];
        if (this.worktree.status.staged > 0) {
            parts.push(`${this.worktree.status.staged} staged`);
        }
        if (this.worktree.status.unstaged > 0) {
            parts.push(`${this.worktree.status.unstaged} unstaged`);
        }

        return parts.join(', ') || 'Modified';
    }

    private static getWorktreeTypeIcon(worktree: WorktreeInfo): string {
        if (worktree.isActive) {
            return '🏠'; // Current/active worktree
        }
        if (worktree.branch && worktree.branch.includes('feature')) {
            return '🚀'; // Feature branch
        }
        if (worktree.branch && (worktree.branch.includes('hotfix') || worktree.branch.includes('fix'))) {
            return '🔧'; // Hotfix/bugfix branch
        }
        if (worktree.branch && worktree.branch.includes('main') || worktree.branch === 'master') {
            return '🌟'; // Main/master branch
        }
        return '🌿'; // Generic branch/worktree
    }

    private static getStatusIcon(worktree: WorktreeInfo): string {
        if (worktree.locked) {
            return '🔒';
        }
        
        if (!worktree.status.clean) {
            if (worktree.status.staged > 0) {
                return '🟡'; // Has staged changes (yellow circle)
            } else {
                return '🔴'; // Has unstaged changes (red circle)
            }
        }
        
        return '🟢'; // Clean (green circle)
    }

    private getIcon(): vscode.ThemeIcon {
        if (this.worktree.isActive) {
            return new vscode.ThemeIcon('folder-active', new vscode.ThemeColor('charts.green'));
        }

        if (!this.worktree.status.clean) {
            return new vscode.ThemeIcon('folder', new vscode.ThemeColor('charts.orange'));
        }

        if (this.worktree.locked) {
            return new vscode.ThemeIcon('lock');
        }

        return new vscode.ThemeIcon('folder');
    }
}

/**
 * Tree data provider for the worktree explorer view.
 * Displays worktrees in the VS Code Explorer sidebar with status indicators.
 */
export class WorktreeProvider implements vscode.TreeDataProvider<WorktreeItem>, vscode.Disposable {
    private worktreeService: WorktreeService;
    private logger: Logger;
    private disposables: vscode.Disposable[] = [];

    private readonly _onDidChangeTreeData = new vscode.EventEmitter<WorktreeItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(worktreeService: WorktreeService, logger: Logger) {
        this.worktreeService = worktreeService;
        this.logger = logger;

        // Listen for worktree changes
        this.disposables.push(
            this.worktreeService.onDidChangeWorktrees(() => {
                this.refresh();
            })
        );

        // Initialize the service
        this.worktreeService.initialize().catch(error => {
            this.logger.error('Failed to initialize worktree service', error);
        });
    }

    /**
     * Refresh the tree view
     */
    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    /**
     * Get tree item for the given element
     */
    getTreeItem(element: WorktreeItem): vscode.TreeItem {
        return element;
    }

    /**
     * Get children for the given element (or root if element is undefined)
     */
    getChildren(element?: WorktreeItem): Thenable<WorktreeItem[]> {
        if (!element) {
            // Return root level items (worktrees)
            return Promise.resolve(this.getWorktreeItems());
        }

        // No children for worktree items
        return Promise.resolve([]);
    }

    /**
     * Get the parent of the given element
     */
    getParent(element: WorktreeItem): vscode.ProviderResult<WorktreeItem> {
        // All items are at root level
        return null;
    }

    /**
     * Convert worktrees to tree items
     */
    private getWorktreeItems(): WorktreeItem[] {
        const worktrees = this.worktreeService.getWorktrees();
        
        if (worktrees.length === 0) {
            // Return a placeholder item when no worktrees are found
            const placeholderItem = new vscode.TreeItem(
                'No worktrees found',
                vscode.TreeItemCollapsibleState.None
            );
            placeholderItem.description = 'Click refresh to scan for worktrees';
            placeholderItem.iconPath = new vscode.ThemeIcon('info');
            placeholderItem.contextValue = 'placeholder';
            return [placeholderItem as any];
        }

        // Sort worktrees: active first, then by name
        const sortedWorktrees = [...worktrees].sort((a, b) => {
            if (a.isActive && !b.isActive) return -1;
            if (!a.isActive && b.isActive) return 1;
            return a.name.localeCompare(b.name);
        });

        return sortedWorktrees.map(worktree => 
            new WorktreeItem(worktree, vscode.TreeItemCollapsibleState.None)
        );
    }

    dispose(): void {
        this.disposables.forEach(d => d.dispose());
        this._onDidChangeTreeData.dispose();
    }
}
