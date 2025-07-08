import * as vscode from 'vscode';
import { Logger } from './utils/logger';
import { ConfigurationService } from './services/configurationService';
import { WorktreeService } from './services/worktreeService';
import { WorktreeProvider } from './providers/worktreeProvider';
import { CommandController } from './controllers/commandController';
import { StatusBarManager } from './ui/statusBarManager';

let logger: Logger;
let worktreeService: WorktreeService;
let worktreeProvider: WorktreeProvider;
let commandController: CommandController;
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
        commandController = new CommandController(worktreeService, logger, configService);
        statusBarManager = new StatusBarManager(worktreeService, logger);

        // Register tree data provider
        const treeView = vscode.window.createTreeView('worktreeExplorer', {
            treeDataProvider: worktreeProvider,
            showCollapseAll: false
        });

        // Register commands
        const commands = [
            vscode.commands.registerCommand('worktree.switch', () => commandController.switchWorktree()),
            vscode.commands.registerCommand('worktree.create', () => commandController.createWorktree()),
            vscode.commands.registerCommand('worktree.remove', (item) => commandController.removeWorktree(item)),
            vscode.commands.registerCommand('worktree.openFolder', (item) => commandController.openFolder(item)),
            vscode.commands.registerCommand('worktree.refresh', () => commandController.refresh())
        ];

        // Add all disposables to context
        context.subscriptions.push(
            treeView,
            configService,
            ...commands,
            worktreeService,
            worktreeProvider,
            commandController,
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
    commandController?.dispose();
    statusBarManager?.dispose();
    logger?.dispose();
}
