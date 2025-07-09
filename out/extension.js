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
exports.deactivate = exports.activate = void 0;
const vscode = __importStar(require("vscode"));
const logger_1 = require("./utils/logger");
const configurationService_1 = require("./services/configurationService");
const worktreeService_1 = require("./services/worktreeService");
const worktreeProvider_1 = require("./providers/worktreeProvider");
const activityBarProvider_1 = require("./providers/activityBarProvider");
const commandController_1 = require("./controllers/commandController");
const bulkOperationsController_1 = require("./controllers/bulkOperationsController");
const statusBarManager_1 = require("./ui/statusBarManager");
let logger;
let worktreeService;
let worktreeProvider;
let activityBarProvider;
let commandController;
let bulkOperationsController;
let statusBarManager;
function activate(context) {
    // Initialize logger
    logger = new logger_1.Logger('WorktreeSwitcher');
    logger.info('Activating Worktree Switcher extension...');
    try {
        // Initialize core services
        const configService = new configurationService_1.ConfigurationService(logger);
        worktreeService = new worktreeService_1.WorktreeService(logger, configService);
        worktreeProvider = new worktreeProvider_1.WorktreeProvider(worktreeService, logger);
        activityBarProvider = new activityBarProvider_1.ActivityBarProvider(worktreeService, configService, logger);
        commandController = new commandController_1.CommandController(worktreeService, logger, configService);
        bulkOperationsController = new bulkOperationsController_1.BulkOperationsController(worktreeService, configService, logger);
        statusBarManager = new statusBarManager_1.StatusBarManager(worktreeService, logger);
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
            vscode.commands.registerCommand('worktree.scanRemoteChanges', () => commandController.scanRemoteChanges()),
            // Activity Bar specific commands
            vscode.commands.registerCommand('worktree.discardAllChanges', () => bulkOperationsController.discardAllChanges()),
            vscode.commands.registerCommand('worktree.createForAllBranches', () => bulkOperationsController.createWorktreesForAllBranches()),
            vscode.commands.registerCommand('worktree.bulkOperations', () => bulkOperationsController.showBulkOperationsMenu())
        ];
        // Add all disposables to context
        context.subscriptions.push(treeView, activityBarTreeView, configService, ...commands, worktreeService, worktreeProvider, activityBarProvider, commandController, bulkOperationsController, statusBarManager, logger);
        // Git validation removed - extension will handle Git errors gracefully during actual operations
        // Initial refresh to populate the tree view
        worktreeService.refresh();
        logger.info('Worktree Switcher extension activated successfully');
    }
    catch (error) {
        logger.error('Failed to activate extension', error);
        vscode.window.showErrorMessage('Failed to activate Worktree Switcher extension. Check the output panel for details.');
    }
}
exports.activate = activate;
function deactivate() {
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
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map