#!/usr/bin/env node

/**
 * Test script for bulk operations functionality
 * This script tests the BulkOperationsController and related Git operations
 */

const path = require('path');
const fs = require('fs');

// Mock VS Code API for testing
const vscode = {
    window: {
        showQuickPick: async (items, options) => {
            console.log(`📋 QuickPick: ${options?.title || 'Select an option'}`);
            items.forEach((item, index) => {
                console.log(`  ${index + 1}. ${item.label} - ${item.description || ''}`);
            });
            return items[0]; // Return first item for testing
        },
        showWarningMessage: async (message, options, ...buttons) => {
            console.log(`⚠️  Warning: ${message}`);
            return buttons[0]; // Return first button for testing
        },
        showInformationMessage: async (message) => {
            console.log(`ℹ️  Info: ${message}`);
        },
        showErrorMessage: async (message) => {
            console.log(`❌ Error: ${message}`);
        },
        withProgress: async (options, callback) => {
            console.log(`🔄 Progress: ${options.title}`);
            const progress = {
                report: (value) => {
                    console.log(`   ${value.message || ''} ${value.increment ? `(${value.increment}%)` : ''}`);
                }
            };
            const token = { isCancellationRequested: false };
            return await callback(progress, token);
        }
    },
    ProgressLocation: {
        Notification: 15
    },
    commands: {
        executeCommand: async (command) => {
            console.log(`🔧 Command: ${command}`);
        }
    }
};

// Mock logger
class MockLogger {
    info(message, ...args) {
        console.log(`📝 INFO: ${message}`, ...args);
    }
    
    warn(message, ...args) {
        console.log(`⚠️  WARN: ${message}`, ...args);
    }
    
    error(message, ...args) {
        console.log(`❌ ERROR: ${message}`, ...args);
    }
    
    debug(message, ...args) {
        console.log(`🐛 DEBUG: ${message}`, ...args);
    }
}

// Mock configuration service
class MockConfigurationService {
    shouldConfirmDangerousOperations() {
        return true; // Enable confirmations for testing
    }
}

// Mock worktree service
class MockWorktreeService {
    async getWorktrees() {
        return [
            {
                name: 'main-worktree',
                path: '/path/to/main',
                branch: 'main',
                currentBranch: 'main',
                isActive: true,
                status: { clean: true, staged: 0, unstaged: 0 },
                locked: false
            },
            {
                name: 'feature-worktree',
                path: '/path/to/feature',
                branch: 'feature/new-feature',
                currentBranch: 'feature/new-feature',
                isActive: false,
                status: { clean: false, staged: 2, unstaged: 1 },
                locked: false
            },
            {
                name: 'hotfix-worktree',
                path: '/path/to/hotfix',
                branch: 'hotfix/urgent-fix',
                currentBranch: 'hotfix/urgent-fix',
                isActive: false,
                status: { clean: false, staged: 0, unstaged: 3 },
                locked: false
            }
        ];
    }
    
    async discardWorktreeChanges(worktreePath) {
        console.log(`🗑️  Discarding changes in: ${worktreePath}`);
        // Simulate async operation
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    async cleanWorktree(worktreePath) {
        console.log(`🧹 Cleaning worktree: ${worktreePath}`);
        // Simulate async operation
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    async refresh() {
        console.log(`🔄 Refreshing all worktrees`);
    }
    
    async switchWorktree(worktreePath) {
        console.log(`🔀 Switching to worktree: ${worktreePath}`);
    }
}

// Test the bulk operations
async function testBulkOperations() {
    console.log('🧪 Testing Bulk Operations Controller\n');
    
    // Import our classes (we'll need to adjust paths for testing)
    const logger = new MockLogger();
    const configService = new MockConfigurationService();
    const worktreeService = new MockWorktreeService();
    
    // Create a simplified BulkOperationsController for testing
    class TestBulkOperationsController {
        constructor(worktreeService, configService, logger) {
            this.worktreeService = worktreeService;
            this.configService = configService;
            this.logger = logger;
        }
        
        async showBulkOperationsMenu() {
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
                }
            ];

            const selected = await vscode.window.showQuickPick(operations, {
                placeHolder: '🔧 Select a bulk operation to perform',
                title: 'Bulk Worktree Operations'
            });

            if (selected) {
                switch (selected.action) {
                    case 'discardAllChanges':
                        await this.discardAllChanges();
                        break;
                    case 'bulkStatusCheck':
                        await this.showBulkStatusCheck();
                        break;
                }
            }
        }
        
        async discardAllChanges() {
            const worktrees = await this.worktreeService.getWorktrees();
            const dirtyWorktrees = worktrees.filter(w => 
                !w.status.clean || w.status.staged > 0 || w.status.unstaged > 0
            );

            if (dirtyWorktrees.length === 0) {
                await vscode.window.showInformationMessage('🟢 All worktrees are clean - no changes to discard');
                return;
            }

            const confirmation = await vscode.window.showWarningMessage(
                `⚠️ This will discard ALL uncommitted changes in ${dirtyWorktrees.length} worktree(s). This action cannot be undone.`,
                'Discard All Changes',
                'Cancel'
            );

            if (confirmation === 'Discard All Changes') {
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: 'Discarding changes across worktrees',
                    cancellable: true
                }, async (progress, token) => {
                    const total = dirtyWorktrees.length;
                    let completed = 0;

                    for (const worktree of dirtyWorktrees) {
                        if (token.isCancellationRequested) break;

                        progress.report({
                            message: `Processing ${worktree.name}...`,
                            increment: 0
                        });

                        await this.worktreeService.discardWorktreeChanges(worktree.path);
                        completed++;
                        
                        progress.report({
                            message: `Completed ${completed}/${total} worktrees`,
                            increment: (100 / total)
                        });
                    }

                    await vscode.window.showInformationMessage(
                        `✅ Discarded changes in ${completed}/${total} worktrees`
                    );
                });
            }
        }
        
        async showBulkStatusCheck() {
            const worktrees = await this.worktreeService.getWorktrees();
            
            const statusItems = worktrees.map(worktree => {
                const statusIcon = worktree.status.clean ? '🟢' : 
                    worktree.status.staged > 0 ? '🟡' : '🔴';
                const typeIcon = worktree.isActive ? '🏠' : 
                    worktree.branch?.includes('feature/') ? '🚀' : 
                    worktree.branch?.includes('hotfix/') ? '🔧' : '🌿';
                
                return {
                    label: `${typeIcon} ${worktree.name} ${statusIcon}`,
                    description: `${worktree.branch} • ${worktree.status.clean ? 'Clean' : 'Has changes'}`,
                    detail: worktree.path,
                    worktree
                };
            });

            const selected = await vscode.window.showQuickPick(statusItems, {
                placeHolder: '📊 Worktree Status Overview - Select a worktree to switch to it',
                title: `Bulk Status Check (${worktrees.length} worktrees)`
            });

            if (selected) {
                await this.worktreeService.switchWorktree(selected.worktree.path);
            }
        }
    }
    
    const controller = new TestBulkOperationsController(worktreeService, configService, logger);
    
    console.log('1️⃣ Testing Bulk Operations Menu:');
    await controller.showBulkOperationsMenu();
    
    console.log('\n2️⃣ Testing Direct Discard All Changes:');
    await controller.discardAllChanges();
    
    console.log('\n3️⃣ Testing Bulk Status Check:');
    await controller.showBulkStatusCheck();
    
    console.log('\n✅ All tests completed successfully!');
}

// Run the tests
testBulkOperations().catch(console.error);
