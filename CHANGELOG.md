# Changelog

All notable changes to the VSCode WorkTree Switcher extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
