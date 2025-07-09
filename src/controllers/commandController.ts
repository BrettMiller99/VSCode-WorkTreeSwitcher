import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { WorktreeService } from '../services/worktreeService';
import { WorktreeItem } from '../providers/worktreeProvider';
import { Logger } from '../utils/logger';
import { ConfigurationService } from '../services/configurationService';

/**
 * Controller for handling VS Code commands related to worktrees.
 * Orchestrates QuickPick UI, input dialogs, and error handling.
 */
export class CommandController implements vscode.Disposable {
    private worktreeService: WorktreeService;
    private logger: Logger;
    private configService: ConfigurationService;

    constructor(worktreeService: WorktreeService, logger: Logger, configService: ConfigurationService) {
        this.worktreeService = worktreeService;
        this.logger = logger;
        this.configService = configService;
    }

    /**
     * Switch to a specific worktree (from tree item) or show QuickPick to select one
     */
    async switchWorktree(treeItem?: any): Promise<void> {
        // If called from tree item, switch directly to that worktree
        if (treeItem && treeItem.worktree) {
            try {
                // Respect user configuration for window behavior
                const openInNewWindow = await this.configService.determineWindowBehavior();
                await this.worktreeService.switchWorktree(treeItem.worktree.path, openInNewWindow);
                return;
            } catch (error) {
                this.logger.error('Failed to switch to worktree from tree item', error);
                vscode.window.showErrorMessage(`Failed to switch worktree: ${error instanceof Error ? error.message : 'Unknown error'}`);
                return;
            }
        }
        
        // Otherwise show QuickPick (original behavior)
        try {
            const worktrees = this.worktreeService.getWorktrees();
            
            if (worktrees.length === 0) {
                vscode.window.showInformationMessage(
                    'No worktrees found. Create a worktree first.',
                    'Create Worktree'
                ).then(selection => {
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
                const openInNewWindow = await this.configService.determineWindowBehavior();
                await this.worktreeService.switchWorktree(selected.worktree.path, openInNewWindow);
            }
        } catch (error) {
            this.logger.error('Failed to switch worktree', error);
            vscode.window.showErrorMessage(`Failed to switch worktree: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Create a new worktree
     */
    async createWorktree(): Promise<void> {
        try {
            // Step 1: Select branch or create new one
            const branches = await this.worktreeService.getBranchesWithoutWorktrees();
            
            if (branches.length === 0) {
                vscode.window.showInformationMessage('No available branches to create worktrees from. All branches already have worktrees.');
                return;
            }

            // Create QuickPick items for branches
            const branchItems = branches.map(branch => ({
                label: `🌱 ${branch}`,
                description: 'Existing branch',
                branch,
                action: 'existing' as const
            }));

            // Add options for creating new branches
            const newBranchItems = [
                {
                    label: '$(plus) Create new branch',
                    description: 'Create a new branch and worktree',
                    branch: '',
                    action: 'new' as const
                },
                {
                    label: '$(git-branch) Create orphan branch',
                    description: 'Create a new orphan branch (no history)',
                    branch: '',
                    action: 'orphan' as const
                }
            ];

            const allItems = [...newBranchItems, ...branchItems];

            const branchChoice = await vscode.window.showQuickPick(allItems, {
                placeHolder: '🌿 Select a branch or create a new one',
                title: 'Create Worktree - Select Branch'
            });

            if (!branchChoice) {
                return;
            }

            let branchName: string;
            let isNewBranch = false;
            let isOrphanBranch = false;

            if (branchChoice.action === 'existing') {
                branchName = branchChoice.branch;
            } else if (branchChoice.action === 'new' || branchChoice.action === 'orphan') {
                // Get new branch name from user
                const inputBranchName = await vscode.window.showInputBox({
                    prompt: 'Enter the name for the new branch',
                    placeHolder: 'feature/my-feature',
                    validateInput: (value) => {
                        if (!value || value.trim().length === 0) {
                            return 'Branch name cannot be empty';
                        }
                        
                        // Basic validation for Git branch names
                        const trimmedValue = value.trim();
                        if (trimmedValue.includes(' ')) {
                            return 'Branch name cannot contain spaces';
                        }
                        if (trimmedValue.startsWith('-') || trimmedValue.endsWith('-')) {
                            return 'Branch name cannot start or end with a dash';
                        }
                        if (trimmedValue.includes('..')) {
                            return 'Branch name cannot contain consecutive dots';
                        }
                        
                        return null;
                    }
                });

                if (!inputBranchName) {
                    return;
                }

                branchName = inputBranchName.trim();
                isNewBranch = true;
                isOrphanBranch = branchChoice.action === 'orphan';
            } else {
                // Should not reach here, but handle gracefully
                return;
            }

            // Step 2: Get worktree location
            const defaultLocation = this.worktreeService.getDefaultWorktreeLocation();
            const worktreeName = this.configService.generateWorktreeName(branchName);
            const suggestedPath = path.join(defaultLocation, worktreeName);

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
                    newBranch: isNewBranch,
                    orphan: isOrphanBranch
                });
            });

            // Step 4: Ask if user wants to open the new worktree
            const openChoice = await vscode.window.showInformationMessage(
                `Worktree created successfully at ${worktreePath}`,
                'Open Worktree',
                'Stay Here'
            );

            if (openChoice === 'Open Worktree') {
                const openInNewWindow = await this.configService.determineWindowBehavior();
                await this.worktreeService.switchWorktree(worktreePath.trim(), openInNewWindow);
            }

        } catch (error) {
            this.logger.error('Failed to create worktree', error);
            vscode.window.showErrorMessage(`Failed to create worktree: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Remove a worktree
     */
    async removeWorktree(item?: WorktreeItem): Promise<void> {
        try {
            let worktreeToRemove: any;

            if (item && item.worktree) {
                worktreeToRemove = item.worktree;
            } else {
                // Show QuickPick to select worktree to remove
                const worktrees = this.worktreeService.getWorktrees();
                // Allow removing any worktree, including the active one
                const removableWorktrees = worktrees;

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
                    placeHolder: '🗑️ Select a worktree to remove',
                    title: 'Remove Worktree'
                });

                if (!selected) {
                    return;
                }

                worktreeToRemove = selected.worktree;
            }

            // Confirm removal (if configured to do so)
            let choice = 'Remove';
            if (this.configService.shouldConfirmDangerousOperations()) {
                const confirmMessage = `Are you sure you want to remove the worktree "${worktreeToRemove.name}"?\n\nPath: ${worktreeToRemove.path}`;
                const forceOption = worktreeToRemove.status.clean ? undefined : 'Force Remove';
                const options = ['Remove', 'Cancel'];
                if (forceOption) {
                    options.splice(1, 0, forceOption);
                }

                choice = await vscode.window.showWarningMessage(
                    confirmMessage,
                    { modal: true },
                    ...options
                ) || 'Cancel';
            }

            if (choice === 'Cancel' || !choice) {
                return;
            }

            const force = choice === 'Force Remove';
            
            // Check if we're trying to remove the main repository
            const currentWorkspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            const repoRoot = currentWorkspace ? await this.worktreeService.getRepositoryRoot(currentWorkspace) : null;
            
            if (repoRoot && worktreeToRemove.path === repoRoot) {
                this.logger.warn('Attempt to remove main repository detected');
                vscode.window.showWarningMessage(
                    'Cannot remove the main Git repository. Only additional worktrees can be removed.',
                    'OK'
                );
                return;
            }
            
            // Check if we're removing the currently active worktree
            const isRemovingActiveWorktree = worktreeToRemove.isActive;
            this.logger.info(`Removing worktree: ${worktreeToRemove.name}, isActive: ${isRemovingActiveWorktree}`);
            
            // If removing the active worktree, switch to main worktree first
            if (isRemovingActiveWorktree) {
                this.logger.info('Attempting to switch to main worktree before removing active worktree...');
                const mainWorktree = await this.worktreeService.getMainWorktree();
                
                if (mainWorktree) {
                    this.logger.info(`Found main worktree: ${mainWorktree.path}`);
                    if (mainWorktree.path !== worktreeToRemove.path) {
                        this.logger.info(`Switching to main worktree: ${mainWorktree.path}`);
                        try {
                            // Explicitly set forceNewWindow to false to ensure we switch in the same window
                            // This is important for the auto-switch functionality to work correctly
                            await this.worktreeService.switchWorktree(mainWorktree.path, false);
                            this.logger.info('Successfully initiated switch to main worktree');
                            // Increase the delay to give VSCode more time to complete the switch before removing
                            await new Promise(resolve => setTimeout(resolve, 2000));
                            this.logger.info('Completed delay after switch, proceeding with removal');
                        } catch (switchError) {
                            this.logger.error('Failed to switch to main worktree:', switchError);
                            throw new Error(`Failed to switch to main worktree before removal: ${switchError instanceof Error ? switchError.message : 'Unknown error'}`);
                        }
                    } else {
                        // This should now be prevented by the check above, but keep as fallback
                        this.logger.error('Cannot remove main repository - this should have been caught earlier');
                        vscode.window.showErrorMessage('Cannot remove the main Git repository.');
                        return;
                    }
                } else {
                    this.logger.error('Could not find main worktree to switch to before removal');
                    throw new Error('Cannot remove active worktree: Unable to find main worktree to switch to');
                }
            }

            // Remove the worktree
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Removing worktree ${worktreeToRemove.name}...`,
                cancellable: false
            }, async () => {
                await this.worktreeService.removeWorktree(worktreeToRemove.path, force);
            });

            vscode.window.showInformationMessage(`Worktree "${worktreeToRemove.name}" removed successfully`);
        } catch (error) {
            // Check if this is an attempt to remove the main working tree
            if (error instanceof Error && error.message.includes('Cannot remove the main Git repository folder')) {
                // Don't show additional UI notification - the WorktreeService already handles this
                this.logger.debug('Main working tree removal attempt handled by WorktreeService');
                return;
            }
            
            this.logger.error('Failed to remove worktree', error);
            vscode.window.showErrorMessage(`Failed to remove worktree: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Refresh the worktree list
     */
    async refresh(): Promise<void> {
        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Window,
                title: 'Refreshing worktrees...'
            }, async () => {
                await this.worktreeService.refresh();
            });
            
            vscode.window.showInformationMessage('Worktree list refreshed successfully');
        } catch (error) {
            this.logger.error('Failed to refresh worktrees', error);
            vscode.window.showErrorMessage(`Failed to refresh worktrees: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Scan for remote changes and offer to create worktrees for new branches
     */
    async scanRemoteChanges(): Promise<void> {
        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Scanning for remote changes...',
                cancellable: true
            }, async (progress, token) => {
                const remoteChanges = await this.worktreeService.scanRemoteChanges();
                
                if (remoteChanges.newBranches.length === 0 && remoteChanges.updatedBranches.length === 0) {
                    vscode.window.showInformationMessage('No new remote changes found.');
                    return;
                }
                
                let message = '';
                const actions: string[] = [];
                
                if (remoteChanges.newBranches.length > 0) {
                    message += `Found ${remoteChanges.newBranches.length} new remote branch(es). `;
                    actions.push('Create Worktrees');
                }
                
                if (remoteChanges.updatedBranches.length > 0) {
                    message += `Found ${remoteChanges.updatedBranches.length} updated branch(es). `;
                    actions.push('Update Worktrees');
                }
                
                if (actions.length > 0) {
                    actions.push('View Details');
                    
                    const choice = await vscode.window.showInformationMessage(message, ...actions);
                    
                    if (choice === 'Create Worktrees') {
                        await this.createWorktreesForNewBranches(remoteChanges.newBranches);
                    } else if (choice === 'Update Worktrees') {
                        await this.updateWorktreesWithRemoteChanges(remoteChanges.updatedBranches);
                    } else if (choice === 'View Details') {
                        // Show detailed information about changes
                        const details = [
                            `New branches: ${remoteChanges.newBranches.join(', ')}`,
                            `Updated branches: ${remoteChanges.updatedBranches.map(u => u.branch).join(', ')}`
                        ].filter(d => !d.includes(': ')).join('\n');
                        
                        vscode.window.showInformationMessage(details);
                    }
                }
            });
        } catch (error) {
            this.logger.error('Failed to scan remote changes', error);
            vscode.window.showErrorMessage(`Failed to scan remote changes: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Create worktrees for new branches found in remote
     */
    private async createWorktreesForNewBranches(branches: string[]): Promise<void> {
        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Creating worktrees for ${branches.length} new branch(es)...`,
                cancellable: true
            }, async (progress, token) => {
                await this.worktreeService.createWorktreesForNewBranches(branches, (branchName, current, total) => {
                    progress.report({
                        message: `Creating worktree for ${branchName} (${current}/${total})`,
                        increment: (100 / total)
                    });
                });
            });
            
            vscode.window.showInformationMessage(`Successfully created worktrees for ${branches.length} new branch(es).`);
        } catch (error) {
            this.logger.error('Failed to create worktrees for new branches', error);
            vscode.window.showErrorMessage(`Failed to create worktrees: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Update existing worktrees with remote changes
     */
    private async updateWorktreesWithRemoteChanges(updates: { branch: string; worktreePath: string }[]): Promise<void> {
        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Updating ${updates.length} worktree(s) with remote changes...`,
                cancellable: true
            }, async (progress, token) => {
                await this.worktreeService.updateWorktreesWithRemoteChanges(updates, (branchName, current, total) => {
                    progress.report({
                        message: `Updating worktree for ${branchName} (${current}/${total})`,
                        increment: (100 / total)
                    });
                });
            });
            
            vscode.window.showInformationMessage(`Successfully updated ${updates.length} worktree(s) with remote changes.`);
        } catch (error) {
            this.logger.error('Failed to update worktrees with remote changes', error);
            vscode.window.showErrorMessage(`Failed to update worktrees: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Get status text for a worktree
     */
    private getStatusText(worktree: any): string {
        if (worktree.status.clean) {
            return 'Clean';
        }

        const parts: string[] = [];
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
    private getStatusIcon(worktree: any): string {
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

    /**
     * Get worktree type icon based on its characteristics
     */
    private getWorktreeTypeIcon(worktree: any): string {
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

    dispose(): void {
        // No resources to dispose
    }
}
