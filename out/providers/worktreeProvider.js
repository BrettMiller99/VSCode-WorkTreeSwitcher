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
exports.WorktreeProvider = exports.WorktreeItem = void 0;
const vscode = __importStar(require("vscode"));
class WorktreeItem extends vscode.TreeItem {
    constructor(worktree, collapsibleState) {
        super(worktree.name, collapsibleState);
        this.worktree = worktree;
        this.collapsibleState = collapsibleState;
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
    buildTooltip() {
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
    buildDescription() {
        const parts = [];
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
    getStatusText() {
        if (this.worktree.status.clean) {
            return 'Clean';
        }
        const parts = [];
        if (this.worktree.status.staged > 0) {
            parts.push(`${this.worktree.status.staged} staged`);
        }
        if (this.worktree.status.unstaged > 0) {
            parts.push(`${this.worktree.status.unstaged} unstaged`);
        }
        return parts.join(', ') || 'Modified';
    }
    getIcon() {
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
exports.WorktreeItem = WorktreeItem;
/**
 * Tree data provider for the worktree explorer view.
 * Displays worktrees in the VS Code Explorer sidebar with status indicators.
 */
class WorktreeProvider {
    constructor(worktreeService, logger) {
        this.disposables = [];
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.worktreeService = worktreeService;
        this.logger = logger;
        // Listen for worktree changes
        this.disposables.push(this.worktreeService.onDidChangeWorktrees(() => {
            this.refresh();
        }));
        // Initialize the service
        this.worktreeService.initialize().catch(error => {
            this.logger.error('Failed to initialize worktree service', error);
        });
    }
    /**
     * Refresh the tree view
     */
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    /**
     * Get tree item for the given element
     */
    getTreeItem(element) {
        return element;
    }
    /**
     * Get children for the given element (or root if element is undefined)
     */
    getChildren(element) {
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
    getParent(element) {
        // All items are at root level
        return null;
    }
    /**
     * Convert worktrees to tree items
     */
    getWorktreeItems() {
        const worktrees = this.worktreeService.getWorktrees();
        if (worktrees.length === 0) {
            // Return a placeholder item when no worktrees are found
            const placeholderItem = new vscode.TreeItem('No worktrees found', vscode.TreeItemCollapsibleState.None);
            placeholderItem.description = 'Click refresh to scan for worktrees';
            placeholderItem.iconPath = new vscode.ThemeIcon('info');
            placeholderItem.contextValue = 'placeholder';
            return [placeholderItem];
        }
        // Sort worktrees: active first, then by name
        const sortedWorktrees = [...worktrees].sort((a, b) => {
            if (a.isActive && !b.isActive)
                return -1;
            if (!a.isActive && b.isActive)
                return 1;
            return a.name.localeCompare(b.name);
        });
        return sortedWorktrees.map(worktree => new WorktreeItem(worktree, vscode.TreeItemCollapsibleState.None));
    }
    dispose() {
        this.disposables.forEach(d => d.dispose());
        this._onDidChangeTreeData.dispose();
    }
}
exports.WorktreeProvider = WorktreeProvider;
//# sourceMappingURL=worktreeProvider.js.map