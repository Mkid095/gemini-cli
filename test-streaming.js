#!/usr/bin/env node

/**
 * Test script to verify streaming functionality in Next Mavens
 * This script tests that LLM responses are properly streamed
 */

const { spawn } = require('child_process');

console.log('🧪 Testing Next Mavens Streaming Functionality...\n');

async function testStreaming() {
  return new Promise((resolve, reject) => {
    console.log('📋 Testing: Streaming Response Generation');
    console.log('   Input: "Hello, can you help me with a simple coding task?"');
    
    // Start the CLI process
    const cliProcess = spawn('node', ['packages/cli/dist/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd()
    });

    let output = '';
    let hasStartedStreaming = false;
    let streamingChunks = 0;
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
      
      // Check if we're getting streaming chunks
      if (text.includes('assistant') || text.includes('Next Mavens') || text.includes('Welcome')) {
        hasStartedStreaming = true;
        streamingChunks++;
      }
      
      // If we have a substantial response and multiple chunks, streaming is working
      if (hasStartedStreaming && streamingChunks > 3 && output.length > 300) {
        clearTimeout(timeout);
        cliProcess.kill();
        
        const result = {
          success: true,
          streamingChunks,
          responseLength: output.length,
          hasStreaming: streamingChunks > 1,
          output: output.substring(0, 500) + '...' // First 500 chars for debugging
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
      if (code !== 0 && !hasStartedStreaming) {
        reject(new Error(`Process exited with code ${code}`));
      }
    });

    // Send input after a short delay to allow initialization
    setTimeout(() => {
      cliProcess.stdin.write('Hello, can you help me with a simple coding task?\n');
    }, 2000);
  });
}

async function main() {
  try {
    console.log('🚀 Starting streaming test...\n');
    
    const result = await testStreaming();
    
    console.log('\n📊 Streaming Test Results:\n');
    console.log(`✅ Test completed successfully`);
    console.log(`📊 Streaming chunks detected: ${result.streamingChunks}`);
    console.log(`📏 Response length: ${result.responseLength} characters`);
    console.log(`🔄 Streaming working: ${result.hasStreaming ? 'YES' : 'NO'}`);
    
    if (result.hasStreaming) {
      console.log('\n🎉 Streaming is working correctly!');
      console.log('   The LLM responses are being streamed in real-time.');
    } else {
      console.log('\n⚠️  Streaming may not be working as expected.');
      console.log('   Only one chunk was detected, which might indicate non-streaming response.');
    }
    
    console.log('\n📝 Sample output:');
    console.log(result.output);
    
  } catch (error) {
    console.error('❌ Streaming test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
main().catch(console.error); 