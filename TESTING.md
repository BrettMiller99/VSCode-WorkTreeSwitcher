# Testing Guide for VSCode WorkTree Switcher

## 🚀 Quick Start Testing

### 1. Launch Extension Development Host
```bash
cd /Users/brettmiller/Documents/Codebase/VSCode-WorkTreeSwitcher
# Open VS Code and press F5, or:
code . 
# Then press F5 to launch Extension Development Host
```

### 2. Test Repository Setup
Open a Git repository that has worktrees, or create test worktrees:
```bash
# In your test repository:
git worktree add ../feature-branch feature-branch
git worktree add ../hotfix-branch -b hotfix-branch
```

## 📋 Manual Testing Checklist

### Core Functionality
- [ ] **Extension Activation**: Extension loads without errors in Output panel
- [ ] **Tree View**: Worktree Explorer appears in sidebar with current worktrees
- [ ] **Status Bar**: Current worktree info shows in status bar (bottom)
- [ ] **Auto-refresh**: Worktrees update automatically (check interval in settings)

### Commands Testing
Test each command via Command Palette (`Cmd+Shift+P`):

- [ ] **Worktree: Switch**
  - Shows QuickPick with all worktrees
  - Icons show status (🔒 locked, ● staged, ○ unstaged, 📁 clean)
  - Selecting opens new VS Code window
  - Active worktree marked as "(Active)"

- [ ] **Worktree: Create**
  - Prompts for worktree name
  - Shows branch selection (existing + option for new)
  - Creates worktree in default location
  - Opens new VS Code window with worktree

- [ ] **Worktree: Remove**
  - Shows only removable worktrees (not current)
  - Confirmation dialog appears
  - Successfully removes worktree

- [ ] **Worktree: Open Folder**
  - Shows all worktrees
  - Opens selected worktree in new window

- [ ] **Worktree: Refresh**
  - Manually refreshes worktree list
  - Updates tree view and status bar

### UI/UX Testing
- [ ] **Tree View Context Menu**: Right-click worktrees for actions
- [ ] **Status Bar Click**: Click status bar item opens switcher
- [ ] **Icons and Formatting**: Consistent icons across all dialogs
- [ ] **Error Handling**: Invalid operations show helpful error messages
- [ ] **Progress Indicators**: Long operations show progress notifications

### Configuration Testing
Test in VS Code Settings (`Cmd+,`):
- [ ] **Auto-refresh interval**: Change and verify timing
- [ ] **Status bar visibility**: Toggle on/off
- [ ] **Default location**: Change worktree creation path
- [ ] **Log level**: Change to debug and check Output panel

### Edge Cases
- [ ] **No Git repository**: Extension handles gracefully
- [ ] **No worktrees**: Shows appropriate empty state
- [ ] **Git errors**: Network issues, permission problems
- [ ] **Concurrent operations**: Multiple rapid commands
- [ ] **Large repositories**: Performance with many worktrees

## 🔧 Automated Testing

### Git Operations Test
```bash
node scripts/test-git.js
```

### TypeScript Compilation
```bash
npm run compile
```

### Package Extension
```bash
npm install -g vsce
vsce package
# Creates .vsix file for manual installation
```

## 🐛 Debugging

### Enable Debug Logging
1. Open VS Code Settings
2. Search for "worktree"
3. Set `worktreeSwitcher.logLevel` to "debug"
4. Check Output panel > "Worktree Switcher"

### Common Test Scenarios
1. **Fresh Repository**: Test with repo that has no worktrees
2. **Multiple Worktrees**: Test with 3+ worktrees
3. **Dirty Worktrees**: Test with uncommitted changes
4. **Network Repository**: Test with remote Git repository
5. **Large Repository**: Test performance with big repos

## 📊 Performance Testing
- Monitor memory usage during auto-refresh
- Test with repositories containing 10+ worktrees
- Verify UI responsiveness during Git operations
- Check startup time impact

## ✅ Acceptance Criteria
Extension is ready for release when:
- All manual tests pass
- No errors in Output panel during normal usage
- Performance is acceptable (< 2s for most operations)
- UI is intuitive and visually distinct from built-in Git features
- Error messages are helpful and actionable
