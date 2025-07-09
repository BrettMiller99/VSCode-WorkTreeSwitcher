# VSCode Worktree Switcher – Context for Next Chat

_Last updated: 2025-07-09 14:13-05:00_

## Current Objective

~~Fix and polish the **auto-switch behaviour** so that **when the currently active worktree is removed the extension automatically switches to the main worktree first**, ensuring the VS Code window remains open and in a valid state.~~ ✅ **COMPLETED**

> ✅ **FIXED**: Both the main worktree detection and Git PATH issues have been resolved.
> 
> **Main Worktree Issue**:
> - **Root Cause**: `git worktree list` doesn't include the main repository, only additional worktrees.
> - **Solution**: Enhanced `getMainWorktree()` to create synthetic main worktree entries when needed.
> 
> **Git PATH Issue**:
> - **Root Cause**: GitCLI was not properly caching Git executable path and falling back to broken 'git' command.
> - **Solution**: Added Git executable caching, early validation, and user-friendly error messages.
> 
> **Result**: Auto-switch functionality now works reliably, and Git detection is robust with clear error handling.

---

## Key Features & Progress

| Feature / Area | Status | Notes |
|----------------|--------|-------|
| Remote branch scanning | **Complete** | Detects new & behind remote branches, bulk create/update worktrees. Progress reporting, cancellation, config-aware. |
| Branch type filtering (local / remote / both) | **Complete** | Prevents duplicate worktrees, smart deduplication favouring locals. |
| Bulk worktree creation (all branches) | **Complete** | Skips existing worktrees, progress UI, cancellable. |
| Explorer view bulk action buttons | **Complete** | Parity with Activity Bar (Refresh / Create / Bulk Ops). |
| Orphan branch worktree creation | **Complete** | Supports empty branch creation via multi-step orphan flow. |
| Worktree switching consistency | **Complete** | All switch flows respect user config (same/new/ask). |
| Auto-switch on active worktree removal | **Complete & tested** | `CommandController.removeWorktree()` now: 1) Detects active removal, 2) Switches to main worktree in same window with 2 s delay, 3) Removes target, 4) Full error handling. Fixed main worktree detection issue. |

---

## Recent Code Changes (since last session)

1. **`src/controllers/commandController.ts`**
   * Fully rewrote `removeWorktree()`:
     * Restored confirmation dialog logic.
     * Added detection of active worktree removal.
     * Switches to main worktree via `WorktreeService.switchWorktree(path, false)`.
     * Introduced 2 s delay (`setTimeout`) before removal.
     * Progress notification & robust error handling.
   * Removed duplicate JSDoc blocks and resolved syntax errors.
2. **`src/services/worktreeService.ts`** ✅ **MAIN WORKTREE FIX**
   * Enhanced `getMainWorktree()` method to fix "Could not find main worktree" issue:
     * Added synthetic main worktree creation when not found in `git worktree list`
     * Comprehensive error handling with fallback values
     * Proper TypeScript null/undefined handling
     * Debug logging for troubleshooting
   * Added `validateGitAvailability()` method for early Git validation
3. **`src/utils/gitCli.ts`** ✅ **GIT PATH FIX**
   * Fixed Git PATH detection issue causing `spawn git ENOENT` errors:
     * Added Git executable caching with `gitExecutable` and `gitSearchAttempted` properties
     * Enhanced `findGitExecutable()` to cache results and avoid repeated searches
     * Modified `executeGitInternal()` to fail early if Git not found
     * Added `validateGitAvailability()` method for early validation
4. **`src/extension.ts`** ✅ **EARLY VALIDATION**
   * Added Git validation during extension activation:
     * Made `activate()` function async to support await calls
     * Added early Git availability check before initial refresh
     * User-friendly error message with link to install Git
5. **Build** – `npm run compile` succeeds; no TypeScript errors.
6. **Docs** – This context file `CONTEXT_NEXT_CHAT.md` added and updated.

---

## Outstanding / Future Work

1. ✅ ~~Investigate cases where the extension cannot find the main worktree~~ **COMPLETED**
2. Add unit/integration tests for `removeWorktree()` auto-switch path to avoid regressions.
3. Validate no regressions in the newly added remote-scanning & filtering features.
4. Consider telemetry/logging improvements to trace worktree path discovery.
5. **Optional**: Consider adding the synthetic main worktree to the main worktrees list for UI consistency.

---

## Useful Implementation Notes

* **ConfigurationService.determineWindowBehavior()** – Returns `boolean | asks user` controlling window behaviour. `switchWorktree(..., false)` forces same window.
* **WorktreeService.getMainWorktree()** – Compares repo root with tracked worktree paths to identify the main worktree.
* **GitCLI enhancements** – New methods: `fetchRemote`, `listRemoteBranches`, `getBranchCommitHash`, `isBranchBehindRemote`, and public `executeGit`.
* Error handling follows pattern: log (`Logger.error / warn / info`) + VS Code notification.

---

## How to Reproduce Auto-Switch Flow

1. Open the extension in a project with multiple worktrees.
2. Make a worktree (not the main one) the **active** workspace.
3. Run `Worktree: Remove` on the **active** worktree.
4. Expected: VS Code switches to main worktree (same window) then removes target worktree. Watch for the warning if main worktree isn’t detected.

---

## Contact Points in Codebase

* `src/controllers/commandController.ts` – Main UI orchestration.
* `src/services/worktreeService.ts` – Git logic & worktree manipulation.
* `src/services/configurationService.ts` – User preference handling.
* `src/utils/logger.ts` – Logging helper.

---

_End of context file – hand this to the next assistant to continue work without missing a beat._
