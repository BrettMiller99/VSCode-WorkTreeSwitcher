#!/usr/bin/env node

/**
 * Test script to verify branch type filtering functionality
 */

const { GitCLI, BranchType } = require('../out/utils/gitCli');
const { Logger } = require('../out/utils/logger');

async function testBranchFiltering() {
    console.log('🧪 Testing Branch Type Filtering...\n');
    
    const logger = new Logger('TestBranchFiltering');
    const gitCli = new GitCLI(logger);
    const cwd = process.cwd();
    
    try {
        console.log('📋 Testing different branch type filters:\n');
        
        // Test all branch types
        const branchTypes = [
            { type: BranchType.Local, name: 'Local Branches Only' },
            { type: BranchType.Remote, name: 'Remote Branches Only' },
            { type: BranchType.Both, name: 'Both Local and Remote (Deduplicated)' }
        ];
        
        for (const { type, name } of branchTypes) {
            console.log(`🔍 ${name}:`);
            
            try {
                const branches = await gitCli.getBranchesWithoutWorktrees(cwd, type);
                
                if (branches.length === 0) {
                    console.log('   ✅ No branches need worktrees');
                } else {
                    console.log(`   📝 Found ${branches.length} branches:`);
                    branches.forEach(branch => {
                        const isRemote = branch.startsWith('origin/');
                        const icon = isRemote ? '🌐' : '🌿';
                        console.log(`      ${icon} ${branch}`);
                    });
                }
            } catch (error) {
                console.log(`   ❌ Error: ${error.message}`);
            }
            
            console.log('');
        }
        
        // Test deduplication logic
        console.log('🔍 Testing deduplication logic:');
        console.log('   This should prefer local branches over remote equivalents');
        
        try {
            const allBranches = await gitCli.listBranches(cwd);
            console.log(`   📝 Total branches found: ${allBranches.length}`);
            
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
                duplicates.forEach(({ local, remote }) => {
                    console.log(`      ${local} ↔ ${remote}`);
                });
                console.log('   ✅ Deduplication should prefer local branches');
            } else {
                console.log('   ℹ️  No duplicate branches found');
            }
            
        } catch (error) {
            console.log(`   ❌ Error testing deduplication: ${error.message}`);
        }
        
        console.log('\n✅ Branch filtering test completed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        process.exit(1);
    }
}

// Run the test
testBranchFiltering().catch(console.error);
