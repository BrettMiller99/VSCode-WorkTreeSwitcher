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
exports.CommandController = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
/**
 * Controller for handling VS Code commands related to worktrees.
 * Orchestrates QuickPick UI, input dialogs, and error handling.
 */
class CommandController {
    constructor(worktreeService, logger) {
        this.worktreeService = worktreeService;
        this.logger = logger;
    }
    /**
     * Show QuickPick to switch between worktrees
     */
    async switchWorktree() {
        try {
            const worktrees = this.worktreeService.getWorktrees();
            if (worktrees.length === 0) {
                vscode.window.showInformationMessage('No worktrees found. Create a worktree first.', 'Create Worktree').then(selection => {
                    if (selection === 'Create Worktree') {
                        this.createWorktree();
                    }
                });
                return;
            }
            // Filter out the currently active worktree
            const availableWorktrees = worktrees.filter(w => !w.isActive);
            if (availableWorktrees.length === 0) {
                vscode.window.showInformationMessage('Only one worktree available (currently active)');
                return;
            }
            const quickPickItems = availableWorktrees.map(worktree => {
                const typeIcon = this.getWorktreeTypeIcon(worktree);
                const statusIcon = this.getStatusIcon(worktree);
                const branchName = worktree.currentBranch || worktree.branch || 'Unknown branch';
                const statusText = this.getStatusText(worktree);
                return {
                    label: `${typeIcon} ${worktree.name} ${statusIcon}`,
                    description: `🌱 ${branchName}`,
                    detail: `📂 ${worktree.path} • ${statusText}`,
                    worktree
                };
            });
            const selected = await vscode.window.showQuickPick(quickPickItems, {
                placeHolder: '🌳 Select a worktree to switch to',
                matchOnDescription: true,
                matchOnDetail: true,
                title: 'Switch Worktree'
            });
            if (selected) {
                await this.worktreeService.switchWorktree(selected.worktree.path);
            }
        }
        catch (error) {
            this.logger.error('Failed to switch worktree', error);
            vscode.window.showErrorMessage(`Failed to switch worktree: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Create a new worktree
     */
    async createWorktree() {
        try {
            // Step 1: Get branch name (existing or new)
            const branchChoice = await vscode.window.showQuickPick([
                {
                    label: '$(git-branch) Use existing branch',
                    description: 'Create worktree from an existing branch',
                    action: 'existing'
                },
                {
                    label: '$(add) Create new branch',
                    description: 'Create worktree with a new branch',
                    action: 'new'
                }
            ], {
                placeHolder: 'How would you like to create the worktree?'
            });
            if (!branchChoice) {
                return;
            }
            let branchName;
            let isNewBranch = false;
            if (branchChoice.action === 'existing') {
                // Show existing branches
                const branches = await this.worktreeService.getBranches();
                const existingWorktrees = this.worktreeService.getWorktrees();
                // Filter out branches that already have worktrees
                const availableBranches = branches.filter(branch => !existingWorktrees.some(w => w.branch === branch || w.currentBranch === branch));
                if (availableBranches.length === 0) {
                    vscode.window.showInformationMessage('All branches already have worktrees');
                    return;
                }
                const branchItems = availableBranches.map(branch => ({
                    label: branch,
                    description: branch.startsWith('origin/') ? 'Remote branch' : 'Local branch'
                }));
                const selectedBranch = await vscode.window.showQuickPick(branchItems, {
                    placeHolder: 'Select a branch for the new worktree'
                });
                if (!selectedBranch) {
                    return;
                }
                branchName = selectedBranch.label;
            }
            else {
                // Get new branch name
                const inputBranchName = await vscode.window.showInputBox({
                    prompt: 'Enter the name for the new branch',
                    placeHolder: 'feature/my-feature',
                    validateInput: (value) => {
                        if (!value || value.trim().length === 0) {
                            return 'Branch name cannot be empty';
                        }
                        if (value.includes(' ')) {
                            return 'Branch name cannot contain spaces';
                        }
                        if (value.startsWith('-') || value.endsWith('-')) {
                            return 'Branch name cannot start or end with a dash';
                        }
                        return null;
                    }
                });
                if (!inputBranchName) {
                    return;
                }
                branchName = inputBranchName.trim();
                isNewBranch = true;
            }
            // Step 2: Get worktree location
            const defaultLocation = this.worktreeService.getDefaultWorktreeLocation();
            const suggestedPath = path.join(defaultLocation, branchName.replace(/[^a-zA-Z0-9-_]/g, '-'));
            const worktreePath = await vscode.window.showInputBox({
                prompt: 'Enter the path for the new worktree',
                value: suggestedPath,
                validateInput: (value) => {
                    if (!value || value.trim().length === 0) {
                        return 'Path cannot be empty';
                    }
                    const trimmedPath = value.trim();
                    // Check if path already exists
                    if (fs.existsSync(trimmedPath)) {
                        return 'Path already exists';
                    }
                    // Check if parent directory exists
                    const parentDir = path.dirname(trimmedPath);
                    if (!fs.existsSync(parentDir)) {
                        return 'Parent directory does not exist';
                    }
                    return null;
                }
            });
            if (!worktreePath) {
                return;
            }
            // Step 3: Create the worktree
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Creating worktree for ${branchName}...`,
                cancellable: false
            }, async () => {
                await this.worktreeService.createWorktree(branchName, worktreePath.trim(), {
                    newBranch: isNewBranch
                });
            });
            // Step 4: Ask if user wants to open the new worktree
            const openChoice = await vscode.window.showInformationMessage(`Worktree created successfully at ${worktreePath}`, 'Open Worktree', 'Stay Here');
            if (openChoice === 'Open Worktree') {
                await this.worktreeService.switchWorktree(worktreePath.trim());
            }
        }
        catch (error) {
            this.logger.error('Failed to create worktree', error);
            vscode.window.showErrorMessage(`Failed to create worktree: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Remove a worktree
     */
    async removeWorktree(item) {
        try {
            let worktreeToRemove;
            if (item && item.worktree) {
                worktreeToRemove = item.worktree;
            }
            else {
                // Show QuickPick to select worktree to remove
                const worktrees = this.worktreeService.getWorktrees();
                const removableWorktrees = worktrees.filter(w => !w.isActive); // Don't allow removing active worktree
                if (removableWorktrees.length === 0) {
                    vscode.window.showInformationMessage('No worktrees available to remove');
                    return;
                }
                const quickPickItems = removableWorktrees.map(worktree => {
                    const typeIcon = this.getWorktreeTypeIcon(worktree);
                    const statusIcon = this.getStatusIcon(worktree);
                    const branchName = worktree.currentBranch || worktree.branch || 'Unknown branch';
                    const statusText = this.getStatusText(worktree);
                    return {
                        label: `${typeIcon} ${worktree.name} ${statusIcon}`,
                        description: `🌱 ${branchName}`,
                        detail: `📂 ${worktree.path} • ${statusText}`,
                        worktree
                    };
                });
                const selected = await vscode.window.showQuickPick(quickPickItems, {
                    placeHolder: '🗑️ Select a worktree to remove (cannot remove current worktree)',
                    title: 'Remove Worktree'
                });
                if (!selected) {
                    return;
                }
                worktreeToRemove = selected.worktree;
            }
            // Confirm removal
            const confirmMessage = `Are you sure you want to remove the worktree "${worktreeToRemove.name}"?\n\nPath: ${worktreeToRemove.path}`;
            const forceOption = worktreeToRemove.status.clean ? undefined : 'Force Remove';
            const options = ['Remove', 'Cancel'];
            if (forceOption) {
                options.splice(1, 0, forceOption);
            }
            const choice = await vscode.window.showWarningMessage(confirmMessage, { modal: true }, ...options);
            if (choice === 'Cancel' || !choice) {
                return;
            }
            const force = choice === 'Force Remove';
            // Remove the worktree
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Removing worktree ${worktreeToRemove.name}...`,
                cancellable: false
            }, async () => {
                await this.worktreeService.removeWorktree(worktreeToRemove.path, force);
            });
            vscode.window.showInformationMessage(`Worktree "${worktreeToRemove.name}" removed successfully`);
        }
        catch (error) {
            this.logger.error('Failed to remove worktree', error);
            vscode.window.showErrorMessage(`Failed to remove worktree: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Open a worktree folder in a new VS Code window
     */
    async openFolder(item) {
        try {
            let worktreeToOpen;
            if (item && item.worktree) {
                worktreeToOpen = item.worktree;
            }
            else {
                // Show QuickPick to select worktree to open
                const worktrees = this.worktreeService.getWorktrees();
                if (worktrees.length === 0) {
                    vscode.window.showInformationMessage('No worktrees found');
                    return;
                }
                const quickPickItems = worktrees.map(worktree => {
                    const typeIcon = this.getWorktreeTypeIcon(worktree);
                    const statusIcon = this.getStatusIcon(worktree);
                    const branchName = worktree.currentBranch || worktree.branch || 'Unknown branch';
                    const statusText = this.getStatusText(worktree);
                    const activeIndicator = worktree.isActive ? ' • CURRENT WORKSPACE' : '';
                    return {
                        label: `${typeIcon} ${worktree.name} ${statusIcon}`,
                        description: `🌱 ${branchName}${activeIndicator}`,
                        detail: `📂 ${worktree.path} • ${statusText}`,
                        worktree
                    };
                });
                const selected = await vscode.window.showQuickPick(quickPickItems, {
                    placeHolder: '📂 Select a worktree to open in new window',
                    title: 'Open Worktree Folder'
                });
                if (!selected) {
                    return;
                }
                worktreeToOpen = selected.worktree;
            }
            await this.worktreeService.switchWorktree(worktreeToOpen.path);
        }
        catch (error) {
            this.logger.error('Failed to open worktree folder', error);
            vscode.window.showErrorMessage(`Failed to open worktree: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Refresh the worktree list
     */
    async refresh() {
        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Window,
                title: 'Refreshing worktrees...',
                cancellable: false
            }, async () => {
                await this.worktreeService.refresh();
            });
        }
        catch (error) {
            this.logger.error('Failed to refresh worktrees', error);
            vscode.window.showErrorMessage(`Failed to refresh worktrees: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
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
     * Get status icon for a worktree
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
    dispose() {
        // No resources to dispose
    }
}
exports.CommandController = CommandController;
//# sourceMappingURL=commandController.js.map