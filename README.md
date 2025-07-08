# VSCode WorkTree Switcher

A powerful Visual Studio Code extension for managing Git worktrees with an intuitive, visually distinctive interface that stands out from built-in Git tools.

## ✨ Features

### 🎯 **Core Functionality**
- **🌳 Tree View**: Dedicated sidebar panel for browsing all worktrees
- **⚡ Quick Switch**: Lightning-fast worktree switching via Command Palette
- **➕ Smart Creation**: Intelligent worktree creation with branch selection
- **🗑️ Safe Removal**: Protected worktree removal with confirmation dialogs
- **📂 Folder Management**: Open worktree folders in new VS Code windows
- **🔄 Auto-refresh**: Automatic worktree list updates with configurable intervals

### 🎨 **Enhanced Visual Experience**
- **📊 Smart Status Bar**: Current worktree info with click-to-switch functionality
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

### ⚙️ **Configuration & Customization**
- **🔧 Flexible Settings**: Auto-refresh intervals, default locations
- **👁️ Status Bar Control**: Toggle status bar visibility
- **📝 Debug Logging**: Configurable log levels for troubleshooting

## 🎮 Commands

All commands are available via Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`):

- **🌳 `Worktree: Switch...`** - Enhanced quick-pick switcher with visual status indicators
- **➕ `Worktree: Create...`** - Smart worktree creation with branch selection and path management
- **🗑️ `Worktree: Remove...`** - Safe removal with confirmation (protects current worktree)
- **📂 `Worktree: Open Folder`** - Open any worktree in a new VS Code window
- **🔄 `Worktree: Refresh`** - Manually refresh the worktree list and status

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

- **`worktreeSwitcher.defaultLocation`** - Default directory for new worktrees (string)
- **`worktreeSwitcher.autoRefresh`** - Auto-refresh interval in minutes (number, 0 = disabled)
- **`worktreeSwitcher.logLevel`** - Logging verbosity ("error" | "warn" | "info" | "debug")
- **`worktreeSwitcher.showStatusBar`** - Display current worktree in status bar (boolean, default: true)

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

✅ **Milestones 1-5 Complete**
- Core architecture implemented
- All main features working
- TypeScript compilation successful
- Ready for testing and refinement

## Requirements

- VS Code 1.74.0 or higher
- Git 2.25 or higher (for worktree support)
- A Git repository with worktrees

## Architecture

The extension follows a clean architecture pattern:
- **WorktreeService**: Core business logic and Git operations
- **GitCLI**: Wrapper around Git commands with proper error handling
- **WorktreeProvider**: Tree view data provider for the Explorer
- **CommandController**: Handles user interactions and QuickPick UI
- **Logger**: Centralized logging with configurable levels
