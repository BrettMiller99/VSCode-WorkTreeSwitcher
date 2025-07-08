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
exports.WorktreeItem = exports.ActivityBarProvider = void 0;
const vscode = __importStar(require("vscode"));
/**
 * Tree data provider for the Activity Bar worktree view.
 * Provides a more compact and action-oriented view compared to the Explorer view.
 */
class ActivityBarProvider {
    constructor(worktreeService, configService, logger) {
        this.worktreeService = worktreeService;
        this.configService = configService;
        this.logger = logger;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.disposables = [];
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
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    /**
     * Get tree item representation
     */
    getTreeItem(element) {
        return element;
    }
    /**
     * Get children for tree view
     */
    async getChildren(element) {
        if (!element) {
            // Root level - return all worktrees
            try {
                const worktrees = await this.worktreeService.getWorktrees();
                return worktrees.map(worktree => {
                    const isCurrent = worktree.isActive;
                    return new WorktreeItem(worktree, isCurrent, this.getWorktreeIcon(worktree, isCurrent), this.getStatusIcon(worktree));
                });
            }
            catch (error) {
                this.logger.error('Failed to get worktrees for Activity Bar', error);
                return [];
            }
        }
        return [];
    }
    /**
     * Get appropriate icon for worktree type
     */
    getWorktreeIcon(worktree, isCurrent) {
        if (isCurrent) {
            return '🏠'; // Current worktree
        }
        const branchName = worktree.branch?.toLowerCase() || '';
        if (branchName.includes('feature') || branchName.startsWith('feat/')) {
            return '🚀'; // Feature branch
        }
        else if (branchName.includes('hotfix') || branchName.includes('fix')) {
            return '🔧'; // Hotfix branch
        }
        else if (branchName === 'main' || branchName === 'master') {
            return '🌟'; // Main branch
        }
        else {
            return '🌿'; // Generic branch
        }
    }
    /**
     * Get status icon based on worktree state
     */
    getStatusIcon(worktree) {
        if (worktree.locked) {
            return '🔒'; // Locked
        }
        // Check status based on the status object structure
        if (worktree.status.clean && worktree.status.staged === 0 && worktree.status.unstaged === 0) {
            return '🟢'; // Clean
        }
        else if (worktree.status.staged > 0) {
            return '🟡'; // Staged changes
        }
        else if (worktree.status.unstaged > 0) {
            return '🔴'; // Unstaged changes
        }
        else {
            return '⚪'; // Unknown status
        }
    }
    /**
     * Get badge count for dirty worktrees
     */
    async getBadgeCount() {
        try {
            const worktrees = await this.worktreeService.getWorktrees();
            return worktrees.filter(w => !w.status.clean || w.status.staged > 0 || w.status.unstaged > 0).length;
        }
        catch (error) {
            this.logger.error('Failed to get badge count', error);
            return 0;
        }
    }
    /**
     * Dispose of resources
     */
    dispose() {
        this.disposables.forEach(d => d.dispose());
        this._onDidChangeTreeData.dispose();
    }
}
exports.ActivityBarProvider = ActivityBarProvider;
/**
 * Tree item for Activity Bar worktree view
 */
class WorktreeItem extends vscode.TreeItem {
    constructor(worktree, isCurrent, typeIcon, statusIcon) {
        super(`${typeIcon} ${worktree.name || worktree.branch || 'Unknown'} ${statusIcon}`, vscode.TreeItemCollapsibleState.None);
        this.worktree = worktree;
        this.isCurrent = isCurrent;
        this.typeIcon = typeIcon;
        this.statusIcon = statusIcon;
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
        }
        else {
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
    getStatusDescription() {
        if (this.worktree.locked) {
            return 'Locked 🔒';
        }
        // Check status based on the status object structure
        if (this.worktree.status.clean && this.worktree.status.staged === 0 && this.worktree.status.unstaged === 0) {
            return 'Clean 🟢';
        }
        else if (this.worktree.status.staged > 0) {
            return `Staged Changes (${this.worktree.status.staged}) 🟡`;
        }
        else if (this.worktree.status.unstaged > 0) {
            return `Unstaged Changes (${this.worktree.status.unstaged}) 🔴`;
        }
        else {
            return 'Unknown ⚪';
        }
    }
}
exports.WorktreeItem = WorktreeItem;
//# sourceMappingURL=activityBarProvider.js.map