# Changelog

All notable changes to the VSCode WorkTree Switcher extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.1] - 2025-07-09

### Fixed
- **🛡️ Main Repository Protection**
  - Fixed warning "Main worktree path is the same as worktree to remove - this should not happen"
  - Prevented users from accidentally removing the main Git repository
  - Added clear error message: "Cannot remove the main Git repository. Only additional worktrees can be removed."
  - Enhanced repository root detection and path comparison logic

- **🔧 Improved Auto-Switch Logic**
  - Fixed edge case where main repository was treated as removable worktree
  - Enhanced error handling for worktree removal operations
  - Added `getRepositoryRoot()` method to WorktreeService for better repository detection

- **🚀 Enhanced User Experience**
  - Eliminated confusing warning messages during worktree operations
  - Improved error messages with actionable guidance
  - Better handling of edge cases in Git repository configurations

## [1.1.0] - 2025-07-09

### Added
- **🎨 Perfect UI Consistency Between Views**
  - Explorer view now matches Activity Bar view styling exactly
  - Enhanced labels with emoji icons showing worktree type and status
  - Rich markdown tooltips with interactive hints and professional formatting
  - Consistent description format across both views

- **🔧 Complete Functional Parity**
  - Added Create and Bulk Operations buttons to Explorer view
  - Both Explorer and Activity Bar views now have identical navigation buttons
  - Same functionality available regardless of view preference
  - Consistent button ordering and grouping

### Improved
- **Enhanced Visual Experience**
  - Labels now show: `🚀 worktree-name 🟢` (type + status icons)
  - Descriptions show: `branch-name • folder-name` (better context)
  - Rich markdown tooltips with bold headers and code formatting
  - Interactive hints like "Click to switch to this worktree"

- **Professional UI Design**
  - Perfect consistency between Explorer and Activity Bar views
  - Enhanced visual feedback with immediate type and status recognition
  - Unified experience across all extension views
  - Better accessibility with full feature set available everywhere

### Fixed
- **🚫 Main Working Tree Removal - Clean UX**
  - Eliminated duplicate warning notifications
  - Single, clean warning: "Worktree Switcher: Cannot remove the main working tree"
  - Suppressed confusing technical Git error messages
  - Perfect single-notification user experience

- **🧹 Bulk Operations Error Cleanup**
  - Eliminated confusing error messages during expected retry scenarios
  - Clean "Retrying with force option" messages only
  - Multi-layer error suppression for comprehensive coverage
  - Only genuine failures are highlighted as errors

- **🔧 Command Palette Polish**
  - Fixed duplicate "Worktree:" prefix in Command Palette
  - Commands now display cleanly as "Worktree: Switch…" instead of "Worktree: Worktree: Switch…"
  - Professional appearance with proper grouping
  - Consistent command naming throughout

### Technical Details
- **Enhanced WorktreeProvider**:
  - Updated `buildTooltip()` to return rich `MarkdownString` tooltips
  - Enhanced label format with type and status icons
  - Improved description format for better context
  - Static methods for icon generation (TypeScript compliance)

- **Menu Configuration**:
  - Added `worktree.create` and `worktree.bulkOperations` to Explorer view
  - Consistent navigation button ordering across views
  - Perfect functional parity between Explorer and Activity Bar

- **Error Handling Improvements**:
  - Multi-layer error suppression in GitCLI and WorktreeService
  - Smart detection of expected vs. genuine errors
  - Clean user notifications with preferred messaging
  - Comprehensive coverage of retry scenarios

---

## [1.0.0] - 2025-01-08

### Added
- **🌳 Bulk Worktree Creation for All Branches**
  - Create worktrees for every branch in the repository with a single command
  - Smart filtering: automatically skips branches that already have worktrees
  - Progress indicators with real-time updates and cancellation support
  - Comprehensive error handling and detailed results reporting
  - Accessible via Command Palette, Bulk Operations menu, and Activity Bar

- **Enhanced User Experience**
  - Confirmation dialogs with branch previews (shows up to 10 branches)
  - Real-time progress with branch names being processed
  - Detailed results summary showing created, skipped, and failed worktrees
  - Option to view detailed logs for troubleshooting errors

- **Technical Improvements**
  - Added `getBranchesWithoutWorktrees()` method to GitCLI
  - Extended WorktreeService with bulk creation capabilities
  - Proper CancellationToken to AbortSignal conversion for VS Code integration
  - Memory-efficient processing for large repositories

### Improved
- **Configuration Respect**: All bulk operations now respect existing configuration settings
  - Worktree naming patterns
  - Default worktree locations
  - Confirmation dialog preferences
- **Error Handling**: Enhanced error reporting with actionable feedback
- **Progress Reporting**: Consistent progress indicators across all bulk operations

### Fixed
- CancellationToken to AbortSignal conversion issues in bulk operations
- Memory management improvements for repositories with many branches
- Proper resource cleanup and disposal in long-running operations

### Technical Details
- **New Commands**:
  - `worktree.createForAllBranches`: Direct command for bulk creation
  - Enhanced `worktree.bulkOperations` menu with new option

- **New Methods**:
  - `GitCLI.getBranchesWithoutWorktrees()`: Smart branch filtering
  - `WorktreeService.createWorktreesForAllBranches()`: Bulk creation with progress
  - `BulkOperationsController.createWorktreesForAllBranches()`: UI integration

- **Architecture**:
  - Follows existing extension patterns and conventions
  - Proper async/await handling throughout
  - Comprehensive TypeScript type safety
  - Zero compilation errors

### Dependencies
- Added `sharp` as dev dependency for icon conversion (SVG to PNG)

---

## Previous Releases

### [0.9.0] - Initial Release
- Basic worktree switching functionality
- Activity Bar integration
- Configuration management
- Status bar integration
- Context menu operations

---

## Upcoming Features (Roadmap)

### [1.1.0] - Planned
- Enhanced filtering options for bulk creation
- Worktree templates and presets
- Integration with VS Code's built-in Git features
- Performance optimizations for very large repositories

### [1.2.0] - Planned
- Worktree synchronization features
- Advanced branch management
- Custom naming patterns with variables
- Backup and restore functionality

---

## Contributing

See [RELEASE_GUIDE.md](./RELEASE_GUIDE.md) for information on creating releases and contributing to the project.
