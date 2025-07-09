#!/usr/bin/env node

/**
 * Simple test script to verify branch type filtering functionality
 * This version doesn't depend on VSCode modules
 */

const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

// Simple BranchType enum
const BranchType = {
    Local: 'local',
    Remote: 'remote',
    Both: 'both'
};

async function listBranches(cwd) {
    try {
        const { stdout } = await execFileAsync('git', ['branch', '-a', '--format=%(refname:short)'], {
            cwd,
            encoding: 'utf8'
        });
        
        return stdout.trim().split('\n').filter(branch => branch && !branch.includes('HEAD'));
    } catch (error) {
        throw new Error(`Failed to list branches: ${error.message}`);
    }
}

async function listWorktrees(cwd) {
    try {
        const { stdout } = await execFileAsync('git', ['worktree', 'list', '--porcelain'], {
            cwd,
            encoding: 'utf8'
        });
        
        const worktrees = [];
        const lines = stdout.trim().split('\n');
        let currentWorktree = {};
        
        for (const line of lines) {
            if (line.startsWith('worktree ')) {
                if (currentWorktree.path) {
                    worktrees.push(currentWorktree);
                }
                currentWorktree = { path: line.substring(9) };
            } else if (line.startsWith('branch ')) {
                currentWorktree.branch = line.substring(7);
            }
        }
        
        if (currentWorktree.path) {
            worktrees.push(currentWorktree);
        }
        
        return worktrees;
    } catch (error) {
        throw new Error(`Failed to list worktrees: ${error.message}`);
    }
}

function getBranchesWithoutWorktrees(allBranches, worktrees, branchType = BranchType.Both) {
    // Get used branches from worktrees
    const usedBranches = new Set(
        worktrees
            .map(wt => wt.branch)
            .filter(branch => branch)
    );

    // Separate local and remote branches
    const localBranches = [];
    const remoteBranches = [];
    
    allBranches.forEach(branch => {
        if (branch.startsWith('origin/')) {
            remoteBranches.push(branch);
        } else {
            localBranches.push(branch);
        }
    });
    
    // Create a map to deduplicate branches (prefer local over remote)
    const branchMap = new Map();
    
    // Add local branches first (they take priority)
    localBranches.forEach(branch => {
        branchMap.set(branch, { branch, isLocal: true });
    });
    
    // Add remote branches only if no local equivalent exists
    remoteBranches.forEach(branch => {
        const cleanName = branch.substring(7); // Remove 'origin/' prefix
        if (!branchMap.has(cleanName)) {
            branchMap.set(cleanName, { branch, isLocal: false });
        }
    });
    
    // Filter based on branch type preference
    let filteredBranches = [];
    
    branchMap.forEach(({ branch, isLocal }) => {
        switch (branchType) {
            case BranchType.Local:
                if (isLocal) {
                    filteredBranches.push(branch);
                }
                break;
            case BranchType.Remote:
                if (!isLocal) {
                    filteredBranches.push(branch);
                }
                break;
            case BranchType.Both:
                filteredBranches.push(branch);
                break;
        }
    });
    
    // Filter out branches that already have worktrees
    return filteredBranches.filter(branch => {
        // Remove origin/ prefix for comparison
        const cleanBranch = branch.startsWith('origin/') ? branch.substring(7) : branch;
        return !usedBranches.has(cleanBranch) && !usedBranches.has(branch);
    });
}

async function testBranchFiltering() {
    console.log('🧪 Testing Branch Type Filtering...\n');
    
    const cwd = process.cwd();
    
    try {
        // Get all branches and worktrees
        const allBranches = await listBranches(cwd);
        const worktrees = await listWorktrees(cwd);
        
        console.log(`📊 Repository Status:`);
        console.log(`   Total branches: ${allBranches.length}`);
        console.log(`   Existing worktrees: ${worktrees.length}`);
        console.log('');
        
        // Test all branch types
        const branchTypes = [
            { type: BranchType.Local, name: 'Local Branches Only' },
            { type: BranchType.Remote, name: 'Remote Branches Only' },
            { type: BranchType.Both, name: 'Both Local and Remote (Deduplicated)' }
        ];
        
        for (const { type, name } of branchTypes) {
            console.log(`🔍 ${name}:`);
            
            const branches = getBranchesWithoutWorktrees(allBranches, worktrees, type);
            
            if (branches.length === 0) {
                console.log('   ✅ No branches need worktrees');
            } else {
                console.log(`   📝 Found ${branches.length} branches that need worktrees:`);
                branches.forEach(branch => {
                    const isRemote = branch.startsWith('origin/');
                    const icon = isRemote ? '🌐' : '🌿';
                    console.log(`      ${icon} ${branch}`);
                });
            }
            
            console.log('');
        }
        
        // Test deduplication logic
        console.log('🔍 Deduplication Analysis:');
        
        const localBranches = allBranches.filter(b => !b.startsWith('origin/'));
        const remoteBranches = allBranches.filter(b => b.startsWith('origin/'));
        
        console.log(`   🌿 Local branches: ${localBranches.length}`);
        console.log(`   🌐 Remote branches: ${remoteBranches.length}`);
        
        // Check for potential duplicates
        const duplicates = [];
        localBranches.forEach(local => {
            const remoteEquivalent = `origin/${local}`;
            if (remoteBranches.includes(remoteEquivalent)) {
                duplicates.push({ local, remote: remoteEquivalent });
            }
        });
        
        if (duplicates.length > 0) {
            console.log(`   🔄 Found ${duplicates.length} potential duplicates:`);
            duplicates.slice(0, 5).forEach(({ local, remote }) => {
                console.log(`      ${local} ↔ ${remote}`);
            });
            if (duplicates.length > 5) {
                console.log(`      ... and ${duplicates.length - 5} more`);
            }
            console.log('   ✅ Deduplication logic should prefer local branches');
        } else {
            console.log('   ℹ️  No duplicate branches found');
        }
        
        console.log('\n✅ Branch filtering test completed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        process.exit(1);
    }
}

// Run the test
testBranchFiltering().catch(console.error);
