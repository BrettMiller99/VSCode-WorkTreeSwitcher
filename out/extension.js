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
const worktreeService_1 = require("./services/worktreeService");
const worktreeProvider_1 = require("./providers/worktreeProvider");
const commandController_1 = require("./controllers/commandController");
const statusBarManager_1 = require("./ui/statusBarManager");
let logger;
let worktreeService;
let worktreeProvider;
let commandController;
let statusBarManager;
function activate(context) {
    // Initialize logger
    logger = new logger_1.Logger('WorktreeSwitcher');
    logger.info('Activating Worktree Switcher extension...');
    try {
        // Initialize core services
        worktreeService = new worktreeService_1.WorktreeService(logger);
        worktreeProvider = new worktreeProvider_1.WorktreeProvider(worktreeService, logger);
        commandController = new commandController_1.CommandController(worktreeService, logger);
        statusBarManager = new statusBarManager_1.StatusBarManager(worktreeService, logger);
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
        context.subscriptions.push(treeView, ...commands, statusBarManager, logger);
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
    commandController?.dispose();
    statusBarManager?.dispose();
    logger?.dispose();
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map