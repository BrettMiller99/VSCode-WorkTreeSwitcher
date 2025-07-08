# 🧪 Development Testing Guide

## Quick Test in VS Code

### 1. Launch Extension Development Host
1. Open this project in VS Code
2. Press `F5` or go to Run → Start Debugging
3. This opens a new "Extension Development Host" window

### 2. Test Core Functionality
In the Extension Development Host window:

#### Basic Setup
- Open a Git repository with worktrees (or create test worktrees)
- Check that the "Worktree Switcher" view appears in the Explorer sidebar
- Verify the status bar shows current worktree info (🏠 main 🟢)

#### Command Testing
Open Command Palette (`Cmd+Shift+P`) and test:
- `Worktree: Switch` - Should show QuickPick with available worktrees
- `Worktree: Create` - Should prompt for branch name and location
- `Worktree: Refresh` - Should update the tree view
- `Worktree: Remove` - Should show removal options (not current worktree)
- `Worktree: Open in New Window` - Should open worktree in new window

#### UI Validation
- **Tree View**: Shows worktrees with status icons (🟢🟡🔴🔒)
- **Status Bar**: Click to switch worktrees quickly
- **QuickPick**: Enhanced with emoji icons and clear descriptions
- **Context Menus**: Right-click worktrees for actions

### 3. Test New Telemetry Features

#### Check Telemetry Status
1. Open Output Panel (`View → Output`)
2. Select "WorktreeSwitcher" from dropdown
3. Look for telemetry status messages:
   ```
   [INFO] Telemetry enabled/disabled (VS Code: true, Extension: true)
   [TELEMETRY] vscode-worktree-switcher.extension.activated
   ```

#### Test Configuration
1. Open Settings (`Cmd+,`)
2. Search for "worktree"
3. Verify new settings:
   - `Worktree Switcher: Enable Telemetry`
   - `Worktree Switcher: Git Timeout`
   - `Worktree Switcher: Default Worktree Location`
   - `Worktree Switcher: Show Status Bar`

#### Test Telemetry Events
Execute commands and check Output Panel for telemetry events:
- Command execution tracking
- Success/failure metrics
- Performance timing
- Error reporting

### 4. Configuration Testing

#### Test Git Timeout
1. Set `worktreeSwitcher.gitTimeout` to 5 seconds
2. Try operations in a slow Git repository
3. Verify timeout behavior

#### Test Telemetry Toggle
1. Disable `worktreeSwitcher.enableTelemetry`
2. Check Output Panel - should show "Telemetry disabled"
3. Execute commands - no telemetry events should appear
4. Re-enable and verify telemetry resumes

### 5. Error Handling
Test error scenarios:
- Try to remove current worktree (should be prevented)
- Create worktree with invalid name
- Switch to non-existent worktree
- Verify error messages and telemetry error events

## Expected Results

### ✅ Success Indicators
- Extension activates without errors
- All commands work as expected
- Telemetry events appear in Output Panel
- Configuration changes take effect immediately
- UI shows enhanced icons and formatting
- Status bar integration works correctly

### ❌ Issues to Watch For
- TypeScript compilation errors
- Missing telemetry events
- Configuration not updating
- UI elements not displaying correctly
- Performance issues with Git operations

## Debug Console
Check the Debug Console for any runtime errors or warnings during testing.

---

**Note**: This testing validates Milestone 7 completion and ensures the extension is ready for unit testing and cross-platform QA.
