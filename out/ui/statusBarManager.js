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
exports.StatusBarManager = void 0;
const vscode = __importStar(require("vscode"));
/**
 * Manages the status bar item that shows the current worktree information.
 * Clicking the status bar item opens the worktree switcher QuickPick.
 */
class StatusBarManager {
    constructor(worktreeService, logger) {
        this.disposables = [];
        this.worktreeService = worktreeService;
        this.logger = logger;
        // Create status bar item
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100 // Priority - higher numbers appear more to the left
        );
        this.statusBarItem.command = 'worktree.switch';
        this.statusBarItem.tooltip = 'Click to switch worktree';
        // Listen for worktree changes
        this.disposables.push(this.worktreeService.onDidChangeWorktrees(() => {
            this.updateStatusBar();
        }));
        // Listen for workspace folder changes
        this.disposables.push(vscode.workspace.onDidChangeWorkspaceFolders(() => {
            this.updateStatusBar();
        }));
        // Listen for configuration changes
        this.disposables.push(vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('worktreeSwitcher.showStatusBar')) {
                this.updateStatusBar();
            }
        }));
        // Initial update
        this.updateStatusBar();
    }
    /**
     * Update the status bar item with current worktree information
     */
    updateStatusBar() {
        try {
            // Check if status bar is enabled in configuration
            const config = vscode.workspace.getConfiguration('worktreeSwitcher');
            const showStatusBar = config.get('showStatusBar', true);
            if (!showStatusBar) {
                this.statusBarItem.hide();
                return;
            }
            const worktrees = this.worktreeService.getWorktrees();
            const activeWorktree = worktrees.find(w => w.isActive);
            if (!activeWorktree) {
                // No active worktree or not in a Git repository
                this.statusBarItem.hide();
                return;
            }
            // Format status bar text with distinctive worktree styling
            const branchName = activeWorktree.currentBranch || activeWorktree.branch || 'unknown';
            const statusIcon = this.getStatusIcon(activeWorktree);
            const typeIcon = this.getWorktreeTypeIcon(activeWorktree);
            this.statusBarItem.text = `${typeIcon} ${activeWorktree.name} ${statusIcon}`;
            this.statusBarItem.tooltip = `🌳 Current Worktree: ${activeWorktree.name}\n🌱 Branch: ${branchName}\n📂 Path: ${activeWorktree.path}\n📊 Status: ${this.getStatusText(activeWorktree)}\n\n🔄 Click to switch worktrees`;
            this.statusBarItem.show();
            this.logger.debug(`Status bar updated: ${this.statusBarItem.text}`);
        }
        catch (error) {
            this.logger.error('Failed to update status bar', error);
            this.statusBarItem.hide();
        }
    }
    /**
     * Get the appropriate icon for the worktree status
     */
    getStatusIcon(worktree) {
        if (worktree.locked) {
            return '🔒';
        }
        if (!worktree.status.clean) {
            if (worktree.status.staged > 0) {
                return '🟡'; // Has staged changes (yellow circle)
            }
            else {
                return '🔴'; // Has unstaged changes (red circle)
            }
        }
        return '🟢'; // Clean (green circle)
    }
    /**
     * Get worktree type icon based on its characteristics
     */
    getWorktreeTypeIcon(worktree) {
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
    /**
     * Get status text for a worktree
     */
    getStatusText(worktree) {
        if (worktree.status.clean) {
            return 'Clean';
        }
        const parts = [];
        if (worktree.status.staged > 0) {
            parts.push(`${worktree.status.staged} staged`);
        }
        if (worktree.status.unstaged > 0) {
            parts.push(`${worktree.status.unstaged} unstaged`);
        }
        return parts.join(', ') || 'Modified';
    }
    /**
     * Build detailed tooltip for the status bar item
     */
    buildTooltip(activeWorktree, totalWorktrees) {
        const lines = [
            `Current Worktree: ${activeWorktree.name}`,
            `Branch: ${activeWorktree.currentBranch || activeWorktree.branch || 'Unknown'}`,
            `Path: ${activeWorktree.path}`,
            `Status: ${this.getStatusText(activeWorktree)}`
        ];
        if (totalWorktrees > 1) {
            lines.push(`Total Worktrees: ${totalWorktrees}`);
        }
        lines.push('', 'Click to switch worktree');
        return lines.join('\n');
    }
    /**
     * Show or hide the status bar item based on configuration
     */
    setVisible(visible) {
        if (visible) {
            this.updateStatusBar();
        }
        else {
            this.statusBarItem.hide();
        }
    }
    dispose() {
        this.statusBarItem.dispose();
        this.disposables.forEach(d => d.dispose());
    }
}
exports.StatusBarManager = StatusBarManager;
//# sourceMappingURL=statusBarManager.js.map