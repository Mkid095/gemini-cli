#!/usr/bin/env node

/**
 * Test script to verify real-time streaming functionality in Next Mavens
 * This script tests that responses are displayed in real-time as they're being generated
 */

const { spawn } = require('child_process');

console.log('🧪 Testing Next Mavens Real-Time Streaming...\n');

async function testRealTimeStreaming() {
  return new Promise((resolve, reject) => {
    console.log('📋 Testing: Real-Time Streaming Response Generation');
    console.log('   Input: "Tell me a short story about coding"');
    
    // Start the CLI process
    const cliProcess = spawn('node', ['packages/cli/dist/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd()
    });

    let output = '';
    let streamingChunks = 0;
    let lastOutputLength = 0;
    let streamingStarted = false;
    let timeout;

    // Set up timeout
    timeout = setTimeout(() => {
      cliProcess.kill();
      reject(new Error('Test timed out'));
    }, 45000); // 45 second timeout for streaming

    // Handle stdout
    cliProcess.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      
      // Check if we're getting streaming updates
      if (text.includes('assistant') || text.includes('Next Mavens') || text.includes('Welcome')) {
        if (!streamingStarted) {
          streamingStarted = true;
          console.log('   🚀 Streaming started...');
        }
        
        // Check if content is growing (indicating real-time streaming)
        if (output.length > lastOutputLength) {
          streamingChunks++;
          lastOutputLength = output.length;
          
          // Show progress every few chunks
          if (streamingChunks % 5 === 0) {
            console.log(`   📝 Streaming chunk ${streamingChunks} (${output.length} chars)`);
          }
        }
      }
      
      // If we have substantial streaming activity, consider it successful
      if (streamingStarted && streamingChunks > 10 && output.length > 500) {
        clearTimeout(timeout);
        cliProcess.kill();
        
        const result = {
          success: true,
          streamingChunks,
          responseLength: output.length,
          hasRealTimeStreaming: streamingChunks > 5,
          streamingStarted,
          output: output.substring(0, 800) + '...' // First 800 chars for debugging
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
      if (code !== 0 && !streamingStarted) {
        reject(new Error(`Process exited with code ${code}`));
      }
    });

    // Send input after a short delay to allow initialization
    setTimeout(() => {
      cliProcess.stdin.write('Tell me a short story about coding\n');
    }, 3000);
  });
}

async function main() {
  try {
    console.log('🚀 Starting real-time streaming test...\n');
    
    const result = await testRealTimeStreaming();
    
    console.log('\n📊 Real-Time Streaming Test Results:\n');
    console.log(`✅ Test completed successfully`);
    console.log(`📊 Streaming chunks detected: ${result.streamingChunks}`);
    console.log(`📏 Final response length: ${result.responseLength} characters`);
    console.log(`🔄 Real-time streaming working: ${result.hasRealTimeStreaming ? 'YES' : 'NO'}`);
    console.log(`🚀 Streaming started: ${result.streamingStarted ? 'YES' : 'NO'}`);
    
    if (result.hasRealTimeStreaming) {
      console.log('\n🎉 Real-time streaming is working correctly!');
      console.log('   The responses are being displayed as they are generated.');
      console.log('   Users can see the AI thinking and responding in real-time.');
    } else {
      console.log('\n⚠️  Real-time streaming may not be working as expected.');
      console.log('   Only a few chunks were detected, which might indicate buffered response.');
    }
    
    console.log('\n📝 Sample output:');
    console.log(result.output);
    
    // Additional analysis
    console.log('\n🔍 Streaming Analysis:');
    if (result.streamingChunks > 20) {
      console.log('   ✅ Excellent streaming performance - many chunks detected');
    } else if (result.streamingChunks > 10) {
      console.log('   ✅ Good streaming performance - moderate chunks detected');
    } else if (result.streamingChunks > 5) {
      console.log('   ⚠️  Fair streaming performance - few chunks detected');
    } else {
      console.log('   ❌ Poor streaming performance - very few chunks detected');
    }
    
  } catch (error) {
    console.error('❌ Real-time streaming test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
main().catch(console.error); 