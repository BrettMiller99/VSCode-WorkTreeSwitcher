import * as vscode from 'vscode';
import { Logger } from './utils/logger';
import { WorktreeService } from './services/worktreeService';
import { WorktreeProvider } from './providers/worktreeProvider';
import { CommandController } from './controllers/commandController';
import { StatusBarManager } from './ui/statusBarManager';
import { TelemetryService } from './services/telemetryService';

let logger: Logger;
let telemetryService: TelemetryService;
let worktreeService: WorktreeService;
let worktreeProvider: WorktreeProvider;
let commandController: CommandController;
let statusBarManager: StatusBarManager;

export async function activate(context: vscode.ExtensionContext) {
    const activationStart = Date.now();
    
    // Initialize logger
    logger = new Logger('WorktreeSwitcher');
    logger.info('Activating Worktree Switcher extension...');
    
    // Initialize telemetry service
    telemetryService = new TelemetryService(logger, 'vscode-worktree-switcher');

    try {
        // Initialize core services
        worktreeService = new WorktreeService(logger, telemetryService);
        worktreeProvider = new WorktreeProvider(worktreeService, logger);
        commandController = new CommandController(worktreeService, logger, telemetryService);
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
            ...commands,
            statusBarManager,
            telemetryService,
            logger
        );

        // Initial refresh to populate the tree view
        await worktreeService.refresh();

        // Send activation telemetry
        const activationTime = Date.now() - activationStart;
        const gitVersion = await worktreeService.getGitVersion().catch(() => 'unknown');
        telemetryService.sendActivationEvent(activationTime, gitVersion);

        logger.info(`Worktree Switcher extension activated successfully in ${activationTime}ms`);
        logger.info(`Telemetry: ${telemetryService.isEnabledStatus() ? 'enabled' : 'disabled'}`);
    } catch (error) {
        logger.error('Failed to activate extension', error);
        telemetryService?.sendErrorEvent('activation_failed');
        vscode.window.showErrorMessage('Failed to activate Worktree Switcher extension. Check the output panel for details.');
    }
}

export function deactivate() {
    logger?.info('Deactivating Worktree Switcher extension...');
    
    // Send deactivation telemetry
    telemetryService?.sendEvent('extension.deactivated');
    
    // Cleanup resources
    worktreeService?.dispose();
    telemetryService?.dispose();
    worktreeProvider?.dispose();
    commandController?.dispose();
    statusBarManager?.dispose();
    logger?.dispose();
}
