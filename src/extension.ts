import * as vscode from 'vscode';
import { Logger } from './utils/logger';
import { ConfigurationService } from './services/configurationService';
import { WorktreeService } from './services/worktreeService';
import { WorktreeProvider } from './providers/worktreeProvider';
import { ActivityBarProvider } from './providers/activityBarProvider';
import { CommandController } from './controllers/commandController';
import { BulkOperationsController } from './controllers/bulkOperationsController';
import { StatusBarManager } from './ui/statusBarManager';

let logger: Logger;
let worktreeService: WorktreeService;
let worktreeProvider: WorktreeProvider;
let activityBarProvider: ActivityBarProvider;
let commandController: CommandController;
let bulkOperationsController: BulkOperationsController;
let statusBarManager: StatusBarManager;

export function activate(context: vscode.ExtensionContext) {
    // Initialize logger
    logger = new Logger('WorktreeSwitcher');
    logger.info('Activating Worktree Switcher extension...');

    try {
        // Initialize core services
        const configService = new ConfigurationService(logger);
        worktreeService = new WorktreeService(logger, configService);
        worktreeProvider = new WorktreeProvider(worktreeService, logger);
        activityBarProvider = new ActivityBarProvider(worktreeService, configService, logger);
        commandController = new CommandController(worktreeService, logger, configService);
        bulkOperationsController = new BulkOperationsController(worktreeService, configService, logger);
        statusBarManager = new StatusBarManager(worktreeService, logger);

        // Register tree data providers
        const treeView = vscode.window.createTreeView('worktreeExplorer', {
            treeDataProvider: worktreeProvider,
            showCollapseAll: false
        });
        
        const activityBarTreeView = vscode.window.createTreeView('worktreeActivityView', {
            treeDataProvider: activityBarProvider,
            showCollapseAll: false
        });

        // Register commands
        const commands = [
            vscode.commands.registerCommand('worktree.switch', (item) => commandController.switchWorktree(item)),
            vscode.commands.registerCommand('worktree.create', () => commandController.createWorktree()),
            vscode.commands.registerCommand('worktree.remove', (item) => commandController.removeWorktree(item)),

            vscode.commands.registerCommand('worktree.refresh', () => commandController.refresh()),
            // Activity Bar specific commands
            vscode.commands.registerCommand('worktree.showActivityView', () => {
                vscode.commands.executeCommand('workbench.view.extension.worktreeActivityBar');
            }),
            vscode.commands.registerCommand('worktree.discardAllChanges', () => bulkOperationsController.discardAllChanges()),
            vscode.commands.registerCommand('worktree.bulkOperations', () => bulkOperationsController.showBulkOperationsMenu())
        ];

        // Add all disposables to context
        context.subscriptions.push(
            treeView,
            activityBarTreeView,
            configService,
            ...commands,
            worktreeService,
            worktreeProvider,
            activityBarProvider,
            commandController,
            bulkOperationsController,
            statusBarManager,
            logger
        );

        // Initial refresh to populate the tree view
        worktreeService.refresh();

        logger.info('Worktree Switcher extension activated successfully');
    } catch (error) {
        logger.error('Failed to activate extension', error);
        vscode.window.showErrorMessage('Failed to activate Worktree Switcher extension. Check the output panel for details.');
    }
}

export function deactivate() {
    logger?.info('Deactivating Worktree Switcher extension...');
    
    // Cleanup resources
    worktreeService?.dispose();
    worktreeProvider?.dispose();
    activityBarProvider?.dispose();
    commandController?.dispose();
    bulkOperationsController?.dispose();
    statusBarManager?.dispose();
    logger?.dispose();
}
