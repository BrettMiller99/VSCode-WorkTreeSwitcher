import * as vscode from 'vscode';
import * as path from 'path';
import { WorktreeService, WorktreeInfo } from '../services/worktreeService';
import { Logger } from '../utils/logger';

export class WorktreeItem extends vscode.TreeItem {
    constructor(
        public readonly worktree: WorktreeInfo,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(worktree.name, collapsibleState);
        
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

    private buildTooltip(): string {
        const lines = [
            `Path: ${this.worktree.path}`,
            `Branch: ${this.worktree.currentBranch || this.worktree.branch || 'Unknown'}`,
            `HEAD: ${this.worktree.head.substring(0, 8)}`,
            `Status: ${this.getStatusText()}`
        ];

        if (this.worktree.isActive) {
            lines.push('Currently active workspace');
        }

        if (this.worktree.locked) {
            lines.push('⚠️ Locked');
        }

        if (this.worktree.prunable) {
            lines.push('⚠️ Prunable');
        }

        return lines.join('\n');
    }

    private buildDescription(): string {
        const parts: string[] = [];
        
        // Add branch name
        const branchName = this.worktree.currentBranch || this.worktree.branch;
        if (branchName) {
            parts.push(branchName);
        }
        
        // Add status indicator
        const statusText = this.getStatusText();
        if (statusText !== 'Clean') {
            parts.push(statusText);
        }

        return parts.join(' • ');
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
