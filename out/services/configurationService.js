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
exports.ConfigurationService = void 0;
const vscode = __importStar(require("vscode"));
/**
 * Service for managing advanced configuration settings
 */
class ConfigurationService {
    constructor(logger) {
        this.disposables = [];
        this.changeEmitter = new vscode.EventEmitter();
        /**
         * Event fired when configuration changes
         */
        this.onConfigurationChanged = this.changeEmitter.event;
        this.logger = logger;
        this.setupConfigurationWatcher();
    }
    /**
     * Get the current configuration
     */
    getConfiguration() {
        const config = vscode.workspace.getConfiguration(ConfigurationService.SECTION);
        return {
            defaultLocation: config.get('defaultLocation', ''),
            autoRefresh: config.get('autoRefresh', 5),
            logLevel: config.get('logLevel', 'info'),
            showStatusBar: config.get('showStatusBar', true),
            gitTimeout: config.get('gitTimeout', 30),
            worktreeNamePattern: config.get('worktreeNamePattern', '{branchName}'),
            excludeBranches: config.get('excludeBranches', ['HEAD', 'refs/stash']),
            confirmDangerousOperations: config.get('confirmDangerousOperations', true),
            openInNewWindow: config.get('openInNewWindow', 'ask'),
            maxWorktrees: config.get('maxWorktrees', 20),
            sortWorktreesBy: config.get('sortWorktreesBy', 'name'),
            showHiddenBranches: config.get('showHiddenBranches', false),
            autoCleanupStale: config.get('autoCleanupStale', false)
        };
    }
    /**
     * Get a specific configuration value
     */
    get(key) {
        const config = vscode.workspace.getConfiguration(ConfigurationService.SECTION);
        return config.get(key);
    }
    /**
     * Update a configuration value
     */
    async update(key, value, target) {
        const config = vscode.workspace.getConfiguration(ConfigurationService.SECTION);
        await config.update(key, value, target);
        this.logger.debug(`Configuration updated: ${key} = ${value}`);
    }
    /**
     * Generate a worktree name based on the configured pattern
     */
    generateWorktreeName(branchName) {
        const pattern = this.get('worktreeNamePattern');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const username = process.env.USER || process.env.USERNAME || 'user';
        return pattern
            .replace('{branchName}', branchName)
            .replace('{timestamp}', timestamp)
            .replace('{username}', username)
            .replace(/[<>:"/\\|?*]/g, '-'); // Sanitize for filesystem
    }
    /**
     * Check if a branch should be excluded based on patterns
     */
    shouldExcludeBranch(branchName) {
        const excludePatterns = this.get('excludeBranches');
        return excludePatterns.some(pattern => {
            // Simple glob pattern matching
            const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'));
            return regex.test(branchName);
        });
    }
    /**
     * Check if hidden branches should be shown
     */
    shouldShowHiddenBranches() {
        return this.get('showHiddenBranches');
    }
    /**
     * Get the maximum number of worktrees to display
     */
    getMaxWorktrees() {
        return this.get('maxWorktrees');
    }
    /**
     * Get the Git command timeout in milliseconds
     */
    getGitTimeoutMs() {
        return this.get('gitTimeout') * 1000;
    }
    /**
     * Check if dangerous operations should be confirmed
     */
    shouldConfirmDangerousOperations() {
        return this.get('confirmDangerousOperations');
    }
    /**
     * Get the window opening behavior
     */
    getOpenInNewWindowBehavior() {
        return this.get('openInNewWindow');
    }
    /**
     * Get the sorting preference for worktrees
     */
    getSortWorktreesBy() {
        return this.get('sortWorktreesBy');
    }
    /**
     * Check if stale worktrees should be auto-cleaned
     */
    shouldAutoCleanupStale() {
        return this.get('autoCleanupStale');
    }
    /**
     * Check if worktrees should open in new window
     */
    shouldOpenInNewWindow() {
        return this.getOpenInNewWindowBehavior() === 'always';
    }
    /**
     * Determine window behavior for worktree switching, handling 'ask' option
     */
    async determineWindowBehavior() {
        const behavior = this.getOpenInNewWindowBehavior();
        switch (behavior) {
            case 'always':
                return true;
            case 'never':
                return false;
            case 'ask':
                const choice = await vscode.window.showQuickPick([
                    { label: '🪟 Open in New Window', value: true },
                    { label: '🔄 Switch in Current Window', value: false }
                ], {
                    placeHolder: 'How would you like to open the worktree?',
                    title: 'Window Behavior'
                });
                return choice?.value ?? false; // Default to current window if cancelled
            default:
                return false;
        }
    }
    /**
     * Validate configuration values
     */
    validateConfiguration() {
        const config = this.getConfiguration();
        const errors = [];
        // Validate Git timeout
        if (config.gitTimeout < 5 || config.gitTimeout > 120) {
            errors.push('Git timeout must be between 5 and 120 seconds');
        }
        // Validate max worktrees
        if (config.maxWorktrees < 1 || config.maxWorktrees > 100) {
            errors.push('Max worktrees must be between 1 and 100');
        }
        // Validate auto refresh
        if (config.autoRefresh < 0) {
            errors.push('Auto refresh interval cannot be negative');
        }
        // Validate worktree name pattern
        if (!config.worktreeNamePattern.trim()) {
            errors.push('Worktree name pattern cannot be empty');
        }
        return errors;
    }
    /**
     * Setup configuration change watcher
     */
    setupConfigurationWatcher() {
        const watcher = vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration(ConfigurationService.SECTION)) {
                this.logger.debug('Configuration changed, notifying listeners');
                const newConfig = this.getConfiguration();
                this.changeEmitter.fire(newConfig);
            }
        });
        this.disposables.push(watcher);
    }
    /**
     * Dispose of resources
     */
    dispose() {
        this.disposables.forEach(d => d.dispose());
        this.changeEmitter.dispose();
    }
}
exports.ConfigurationService = ConfigurationService;
ConfigurationService.SECTION = 'worktreeSwitcher';
//# sourceMappingURL=configurationService.js.map