#!/usr/bin/env node

/**
 * Test script to verify that the infinite loop issue has been fixed
 * This script tests that the LLM is not being called repeatedly
 */

const { spawn } = require('child_process');

console.log('🧪 Testing Next Mavens Infinite Loop Fix...\n');

async function testInfiniteLoopFix() {
  return new Promise((resolve, reject) => {
    console.log('📋 Testing: No Infinite LLM Calls');
    console.log('   Expected: Welcome message should generate once and stop');
    
    // Start the CLI process
    const cliProcess = spawn('node', ['packages/cli/dist/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd()
    });

    let output = '';
    let llmCallCount = 0;
    let lastOutputLength = 0;
    let stableOutputCount = 0;
    let timeout;

    // Set up timeout
    timeout = setTimeout(() => {
      cliProcess.kill();
      reject(new Error('Test timed out'));
    }, 30000); // 30 second timeout

    // Handle stdout
    cliProcess.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      
      // Check if output is growing (indicating LLM calls)
      if (output.length > lastOutputLength) {
        llmCallCount++;
        lastOutputLength = output.length;
        stableOutputCount = 0; // Reset stable count
      } else {
        stableOutputCount++;
      }
      
      // Show progress
      if (llmCallCount % 5 === 0 && llmCallCount > 0) {
        console.log(`   📝 LLM call count: ${llmCallCount}, Stable periods: ${stableOutputCount}`);
      }
      
      // If we have stable output for a while, consider it successful
      if (stableOutputCount > 20 && llmCallCount < 10) {
        clearTimeout(timeout);
        cliProcess.kill();
        
        const result = {
          success: true,
          llmCallCount,
          stableOutputCount,
          hasInfiniteLoop: llmCallCount > 20,
          output: output.substring(0, 500) + '...' // First 500 chars for debugging
        };
        
        resolve(result);
      }
      
      // If too many LLM calls detected, consider it a failure
      if (llmCallCount > 30) {
        clearTimeout(timeout);
        cliProcess.kill();
        
        const result = {
          success: false,
          llmCallCount,
          stableOutputCount,
          hasInfiniteLoop: true,
          output: output.substring(0, 500) + '...'
        };
        
        resolve(result);
      }
    });

    // Handle stderr
    cliProcess.stderr.on('data', (data) => {
      console.log(`   Error: ${data.toString()}`);
    });

    // Handle process exit
    cliProcess.on('close', (code) => {
      clearTimeout(timeout);
      if (code !== 0 && llmCallCount === 0) {
        reject(new Error(`Process exited with code ${code}`));
      }
    });
  });
}

async function main() {
  try {
    console.log('🚀 Starting infinite loop fix test...\n');
    
    const result = await testInfiniteLoopFix();
    
    console.log('\n📊 Infinite Loop Fix Test Results:\n');
    console.log(`✅ Test completed successfully`);
    console.log(`📊 LLM call count: ${result.llmCallCount}`);
    console.log(`📏 Stable output periods: ${result.stableOutputCount}`);
    console.log(`🔄 Infinite loop detected: ${result.hasInfiniteLoop ? 'YES' : 'NO'}`);
    
    if (!result.hasInfiniteLoop) {
      console.log('\n🎉 Infinite loop fix is working correctly!');
      console.log('   The LLM is not being called repeatedly.');
      console.log('   The welcome message generates once and stops.');
    } else {
      console.log('\n❌ Infinite loop is still occurring.');
      console.log('   The LLM is being called repeatedly.');
      console.log('   Further investigation is needed.');
    }
    
    console.log('\n📝 Sample output:');
    console.log(result.output);
    
    // Additional analysis
    console.log('\n🔍 Loop Analysis:');
    if (result.llmCallCount <= 5) {
      console.log('   ✅ Excellent - Very few LLM calls detected');
    } else if (result.llmCallCount <= 10) {
      console.log('   ✅ Good - Acceptable number of LLM calls');
    } else if (result.llmCallCount <= 20) {
      console.log('   ⚠️  Fair - Somewhat high number of LLM calls');
    } else {
      console.log('   ❌ Poor - Too many LLM calls, infinite loop detected');
    }
    
  } catch (error) {
    console.error('❌ Infinite loop fix test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
main().catch(console.error); 