# VSCode WorkTree Switcher

A comprehensive Visual Studio Code extension for managing Git worktrees with an intuitive, feature-rich interface that provides seamless worktree management across multiple views and interaction methods.

## 🆕 What's New in v1.1.0

### 🎨 Perfect UI Consistency
- **Unified Visual Experience**: Explorer and Activity Bar views now have identical styling
- **Enhanced Labels**: `🚀 worktree-name 🟢` format with type and status icons
- **Rich Markdown Tooltips**: Professional formatting with interactive hints
- **Complete Functional Parity**: Same navigation buttons and capabilities in both views

### 🔧 Polished User Experience
- **Clean Error Handling**: Eliminated confusing duplicate notifications
- **Professional Command Palette**: Fixed duplicate prefixes for clean appearance
- **Single Warning Messages**: Clear, user-friendly notifications
- **Enhanced Accessibility**: Full feature set available in all views

## ✨ Features

### 🎯 **Core Functionality**
- **🌳 Explorer Tree View**: Dedicated sidebar panel for browsing all worktrees with context menus
- **🎯 Activity Bar Integration**: Dedicated Activity Bar view with direct click-to-switch functionality
- **⚡ Quick Switch**: Lightning-fast worktree switching via Command Palette with configurable window behavior
- **➕ Smart Creation**: Intelligent worktree creation with existing, new, and orphan branch options
- **🗑️ Safe Removal**: Protected worktree removal with comprehensive confirmation system
- **🔄 Auto-refresh**: Automatic worktree list updates with configurable intervals and manual refresh
- **📊 Status Bar Integration**: Current worktree display with click-to-switch functionality

### 🚀 **Advanced Operations**
- **🔄 Bulk Operations**: Multi-worktree management capabilities:
  - Bulk discard changes across all dirty worktrees
  - Comprehensive status overview with interactive switching
  - Bulk refresh all worktrees
  - Clean untracked files from all worktrees
- **🌱 Orphan Branch Creation**: Create completely empty branches with no history
- **⚙️ Advanced Configuration**: Extensive customization options for power users
- **🎯 Smart Window Management**: Configurable behavior for opening worktrees (same/new window/ask)

### 🎨 **Enhanced Visual Experience**
- **🚀 Distinctive Icons**: Worktree-specific visual identity:
  - 🏠 Current/Active worktree
  - 🚀 Feature branches
  - 🔧 Hotfix/Bugfix branches
  - 🌟 Main/Master branches
  - 🌿 Generic branches
- **🎨 Color-Coded Status**: Intuitive status indicators:
  - 🟢 Clean worktrees
  - 🟡 Staged changes
  - 🔴 Unstaged changes
  - 🔒 Locked worktrees
- **💫 Enhanced QuickPick**: Rich dialogs with dual-icon system and contextual information
- **📱 Multiple Views**: Consistent experience across Explorer, Activity Bar, and Command Palette
- **✨ Perfect UI Consistency**: Explorer and Activity Bar views now have identical styling and functionality
- **🎯 Rich Tooltips**: Professional markdown tooltips with interactive hints and code formatting

### ⚙️ **Advanced Configuration**
- **🔧 Git Operations**: Configurable timeouts, branch filtering, and naming patterns
- **🎯 UI Customization**: Sorting preferences, display limits, and visibility controls
- **🔒 Safety Features**: Confirmation dialogs for dangerous operations
- **📝 Debug & Logging**: Comprehensive logging with configurable verbosity levels

## 🎮 Commands

All commands are available via Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`):

### 🎯 **Core Commands**
- **🌳 `Worktree: Switch...`** - Enhanced quick-pick switcher with configurable window behavior
- **➕ `Worktree: Create...`** - Smart worktree creation with existing/new/orphan branch options
- **🗑️ `Worktree: Remove...`** - Safe removal with comprehensive confirmation system
- **🔄 `Worktree: Refresh`** - Manually refresh the worktree list and status

### 🚀 **Bulk Operations**
- **📊 `Worktree: Bulk Operations...`** - Access bulk operations menu
- **🗑️ `Worktree: Discard All Changes`** - Discard uncommitted changes across all dirty worktrees

### 🎯 **View Management**
- **🌳 `Worktree: Show Activity View`** - Open the dedicated Activity Bar view

## 🎨 Visual Design

### Distinctive from Built-in Git Tools
This extension uses a unique visual language that makes it immediately recognizable:

**Branch Switcher (Built-in)**: `$(git-branch) branch-name`  
**Worktree Switcher (This Extension)**: `🚀 feature-branch 🟢`

### Icon System
- **Worktree Types**: Context-aware icons based on branch naming patterns
- **Status Colors**: Universal color coding (🟢 = good, 🟡 = caution, 🔴 = attention)
- **Rich Tooltips**: Emoji-enhanced information display
- **Consistent Branding**: Worktree-themed language throughout the interface

## ⚙️ Configuration

Customize the extension behavior in VS Code Settings (`Cmd+,` / `Ctrl+,`):

### 🎯 **Core Settings**
- **`worktreeSwitcher.defaultLocation`** - Default directory for new worktrees (string)
- **`worktreeSwitcher.autoRefresh`** - Auto-refresh interval in minutes (number, 0 = disabled)
- **`worktreeSwitcher.logLevel`** - Logging verbosity ("error" | "warn" | "info" | "debug")
- **`worktreeSwitcher.showStatusBar`** - Display current worktree in status bar (boolean, default: true)
- **`worktreeSwitcher.showActivityBar`** - Show worktree view in Activity Bar (boolean, default: true)

### 🚀 **Advanced Configuration**
- **`worktreeSwitcher.gitTimeout`** - Git command timeout in seconds (5-120, default: 30)
- **`worktreeSwitcher.worktreeNamePattern`** - Template for naming new worktrees with placeholders
- **`worktreeSwitcher.excludeBranches`** - Array of patterns to exclude branches from listings
- **`worktreeSwitcher.confirmDangerousOperations`** - Show confirmation dialogs for removals (boolean, default: true)
- **`worktreeSwitcher.openInNewWindow`** - Window behavior ("always" | "never" | "ask", default: "ask")
- **`worktreeSwitcher.maxWorktrees`** - Maximum worktrees to display (1-100, default: 50)
- **`worktreeSwitcher.sortWorktreesBy`** - Sorting preference ("name" | "branchName" | "lastModified" | "creationDate")
- **`worktreeSwitcher.showHiddenBranches`** - Show branches starting with '.' (boolean, default: false)
- **`worktreeSwitcher.autoCleanupStale`** - Automatic cleanup of stale worktrees (boolean, default: false)

## 🧪 Testing

### Quick Test Setup
1. **Launch Extension**: Press `F5` in VS Code to open Extension Development Host
2. **Open Git Repository**: Open any repository with worktrees (or create test worktrees)
3. **Test Commands**: Use Command Palette (`Cmd+Shift+P`) → "Worktree:"
4. **Check UI**: Verify Tree View (sidebar) and Status Bar (bottom) display

### Create Test Worktrees
```bash
# In your test repository:
git worktree add ../feature-branch feature-branch
git worktree add ../hotfix-branch -b hotfix-branch
```

### Automated Testing
```bash
# Test Git operations
node scripts/test-git.js

# Compile TypeScript
npm run compile
```

See `TESTING.md` for comprehensive testing guide.

## Troubleshooting

### Common Issues

- **Worktree list not updating**: 
  - Try running `Worktree: Refresh` command
  - Check the auto-refresh interval in settings
  - Verify you're in a Git repository

- **"The operation was aborted" error**:
  - This usually indicates a timeout or cancellation
  - Try refreshing the worktree list manually
  - Check if Git operations are taking too long

- **Error creating worktree**: 
  - Ensure Git version 2.25 or higher is installed
  - Check that the target directory is accessible
  - Verify the branch name is valid

- **Status bar not showing**:
  - Ensure `worktreeSwitcher.showStatusBar` is set to `true`
  - Check that you're in a Git repository with worktrees
  - Try reloading VS Code window

### Debug Information

1. Open VS Code Output panel (`View > Output`)
2. Select "Worktree Switcher" from the dropdown
3. Set log level to "debug" in settings for detailed logs
4. Run the test script: `node scripts/test-git.js`

## Development

### Testing the Extension

1. Open this project in VS Code
2. Press `F5` to launch Extension Development Host
3. Open a Git repository with worktrees
4. Check the Explorer sidebar for the "Worktrees" view
5. Use Command Palette (`Cmd+Shift+P`) to access worktree commands

### Building

```bash
npm install
npm run compile
```

### Project Status

✅ **All Major Milestones Complete**
- ✅ Core architecture and services implemented
- ✅ Explorer Tree View with context menus
- ✅ Activity Bar integration with direct switching
- ✅ Status Bar integration with click-to-switch
- ✅ Advanced configuration system
- ✅ Bulk operations for multi-worktree management
- ✅ Orphan branch creation support
- ✅ Comprehensive error handling and logging
- ✅ TypeScript compilation successful
- ✅ Ready for production distribution

## Requirements

- VS Code 1.74.0 or higher
- Git 2.25 or higher (for worktree support)
- A Git repository with worktrees

## Architecture

The extension follows a clean, modular architecture pattern:

### 🎯 **Core Services**
- **WorktreeService**: Core business logic, Git operations, and worktree management
- **GitCLI**: Wrapper around Git commands with proper error handling and timeouts
- **ConfigurationService**: Centralized configuration management with validation
- **Logger**: Comprehensive logging system with configurable verbosity levels

### 📱 **UI Components**
- **WorktreeProvider**: Tree view data provider for Explorer sidebar
- **ActivityBarProvider**: Dedicated Activity Bar view with direct switching
- **StatusBarManager**: Status bar integration with current worktree display

### 🎮 **Controllers**
- **CommandController**: Handles user interactions, QuickPick UI, and command orchestration
- **BulkOperationsController**: Multi-worktree operations and bulk management features

### 🔧 **Architecture Benefits**
- Clean separation of concerns
- Comprehensive error handling throughout all layers
- Configurable and extensible design
- Consistent user experience across all views
- Proper resource management and disposal
