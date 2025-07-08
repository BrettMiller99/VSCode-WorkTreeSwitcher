#!/usr/bin/env node

/**
 * Simple test script to verify Git worktree operations work correctly
 */

const { execSync } = require('child_process');
const path = require('path');

function runCommand(command, cwd = process.cwd()) {
    try {
        const result = execSync(command, { 
            cwd, 
            encoding: 'utf8',
            timeout: 30000 
        });
        return result.trim();
    } catch (error) {
        console.error(`Command failed: ${command}`);
        console.error(`Error: ${error.message}`);
        return null;
    }
}

function testGitWorktrees() {
    console.log('🧪 Testing Git worktree operations...\n');
    
    // Test basic git availability
    console.log('1. Testing Git availability...');
    const gitVersion = runCommand('git --version');
    if (!gitVersion) {
        console.error('❌ Git is not available');
        return false;
    }
    console.log(`✅ Git found: ${gitVersion}\n`);
    
    // Test if we're in a git repository
    console.log('2. Testing Git repository detection...');
    const isRepo = runCommand('git rev-parse --is-inside-work-tree');
    if (isRepo !== 'true') {
        console.log('⚠️  Not in a Git repository, creating a test repo...');
        
        // Create a temporary test repository
        const testDir = path.join(__dirname, '..', 'test-repo');
        runCommand(`mkdir -p ${testDir}`);
        runCommand('git init', testDir);
        runCommand('git config user.name "Test User"', testDir);
        runCommand('git config user.email "test@example.com"', testDir);
        runCommand('echo "# Test Repo" > README.md', testDir);
        runCommand('git add README.md', testDir);
        runCommand('git commit -m "Initial commit"', testDir);
        
        console.log(`✅ Created test repository at ${testDir}\n`);
        process.chdir(testDir);
    } else {
        console.log('✅ In a Git repository\n');
    }
    
    // Test worktree list command
    console.log('3. Testing worktree list...');
    const worktreeList = runCommand('git worktree list --porcelain');
    if (worktreeList !== null) {
        console.log('✅ Worktree list command works');
        console.log('Current worktrees:');
        console.log(worktreeList || '(none)');
    } else {
        console.log('❌ Worktree list command failed');
        return false;
    }
    
    console.log('\n🎉 All Git tests passed!');
    return true;
}

// Run the tests
if (require.main === module) {
    testGitWorktrees();
}
