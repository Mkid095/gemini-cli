#!/usr/bin/env node

/**
 * Test script to verify codebase analyzer functionality
 * This script tests that the analyzer can properly read project structure
 */

import { CodebaseAnalyzer } from './packages/cli/dist/services/CodebaseAnalyzer.js';
import path from 'path';

console.log('🧪 Testing Next Mavens Codebase Analyzer...\n');

async function testCodebaseAnalyzer() {
  try {
    console.log('📋 Testing: Codebase Analysis');
    console.log('   Directory: Current working directory');
    
    const analyzer = new CodebaseAnalyzer();
    const workingDirectory = process.cwd();
    
    console.log('   Analyzing codebase...');
    const structure = await analyzer.analyzeCodebase(workingDirectory);
    
    console.log('\n📊 Codebase Analysis Results:\n');
    console.log(`✅ Analysis completed successfully`);
    console.log(`📁 Root directory: ${structure.root}`);
    console.log(`📄 Total files: ${structure.files.length}`);
    console.log(`💻 Code files: ${structure.codeFiles.length}`);
    console.log(`📁 Directories: ${structure.directories.length}`);
    console.log(`🔧 Project type: ${analyzer.getProjectType(structure)}`);
    console.log(`🌐 Main language: ${analyzer.getMainLanguage(structure)}`);
    
    if (structure.packageJson) {
      console.log(`📦 Package.json found: ${structure.packageJson.name || 'Unknown'}`);
      console.log(`📋 Version: ${structure.packageJson.version || 'Unknown'}`);
    }
    
    if (structure.tsConfig) {
      console.log(`⚙️  TypeScript config found`);
    }
    
    if (structure.readme) {
      console.log(`📖 README found (${structure.readme.length} characters)`);
    }
    
    console.log('\n📄 Sample files:');
    const sampleFiles = structure.files.slice(0, 10);
    sampleFiles.forEach(file => {
      const icon = file.type === 'directory' ? '📁' : '📄';
      const size = file.size ? ` (${formatSize(file.size)})` : '';
      console.log(`   ${icon} ${file.name}${size}`);
    });
    
    if (structure.files.length > 10) {
      console.log(`   ... and ${structure.files.length - 10} more files`);
    }
    
    console.log('\n💻 Sample code files:');
    const sampleCodeFiles = structure.codeFiles.slice(0, 10);
    sampleCodeFiles.forEach(file => {
      console.log(`   📄 ${file.name} (${file.extension || 'no ext'})`);
    });
    
    if (structure.codeFiles.length > 10) {
      console.log(`   ... and ${structure.codeFiles.length - 10} more code files`);
    }
    
    console.log('\n🎉 Codebase analyzer is working correctly!');
    console.log('   The system can now properly read and analyze your project structure.');
    
    return {
      success: true,
      structure,
      projectType: analyzer.getProjectType(structure),
      mainLanguage: analyzer.getMainLanguage(structure)
    };
    
  } catch (error) {
    console.error('❌ Codebase analyzer test failed:', error.message);
    console.error('   Stack trace:', error.stack);
    return {
      success: false,
      error: error.message
    };
  }
}

function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Run the test
testCodebaseAnalyzer().then(result => {
  if (result.success) {
    console.log('\n✅ Test completed successfully!');
    process.exit(0);
  } else {
    console.log('\n❌ Test failed!');
    process.exit(1);
  }
}).catch(error => {
  console.error('❌ Test error:', error);
  process.exit(1);
}); 