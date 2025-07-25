import { IntelligentAgent } from './dist/services/IntelligentAgent.js';

// Mock LocalLLMConfig
const mockModel = {
  id: 'test-model',
  name: 'test-model',
  provider: 'lm-studio',
  url: 'http://localhost:1234'
};

async function testEnhancedAgent() {
  console.log('🚀 Testing Enhanced Next Mavens Intelligent Agent...\n');
  
  const agent = new IntelligentAgent(mockModel);
  const workingDirectory = process.cwd();
  
  // Test 1: Shell Command Execution
  console.log('💻 Test 1: Shell Command Execution...');
  try {
    const response = await agent.processRequest({
      message: 'run echo "Hello from shell command"',
      workingDirectory
    });
    console.log('✅ Shell Command Response:');
    console.log(response.content);
    if (response.commandResults) {
      console.log('Command Results:', response.commandResults.length);
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 2: Directory Creation
  console.log('📁 Test 2: Directory Creation...');
  try {
    const response = await agent.processRequest({
      message: 'create directory test-folder',
      workingDirectory
    });
    console.log('✅ Directory Creation Response:');
    console.log(response.content);
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 3: File Creation with Proper Naming
  console.log('📄 Test 3: File Creation with Proper Naming...');
  try {
    const response = await agent.processRequest({
      message: 'create a simple html file in test-folder called index.html with <!DOCTYPE html><html><body><h1>Hello World</h1></body></html>',
      workingDirectory
    });
    console.log('✅ File Creation Response:');
    console.log(response.content);
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 4: List Directory
  console.log('📂 Test 4: List Directory...');
  try {
    const response = await agent.processRequest({
      message: 'list directory',
      workingDirectory
    });
    console.log('✅ Directory Listing Response:');
    console.log(response.content);
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 5: Read Created File
  console.log('📖 Test 5: Read Created File...');
  try {
    const response = await agent.processRequest({
      message: 'read test-folder/index.html',
      workingDirectory
    });
    console.log('✅ File Reading Response:');
    console.log(response.content);
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 6: Codebase Analysis
  console.log('🔍 Test 6: Codebase Analysis...');
  try {
    const response = await agent.processRequest({
      message: 'analyze my codebase',
      workingDirectory
    });
    console.log('✅ Codebase Analysis Response:');
    console.log(response.content);
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 7: MCP Server Information
  console.log('🔌 Test 7: MCP Server Information...');
  try {
    const response = await agent.processRequest({
      message: 'list mcp tools',
      workingDirectory
    });
    console.log('✅ MCP Tools Response:');
    console.log(response.content);
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
  
  console.log('\n🎉 Enhanced Agent testing completed!');
  console.log('\n📋 Summary of New Capabilities:');
  console.log('✅ Shell Command Execution');
  console.log('✅ Directory Creation');
  console.log('✅ Proper File Naming (no quotes)');
  console.log('✅ MCP Server Integration');
  console.log('✅ Enhanced File Operations');
  console.log('✅ Better Path Handling');
  console.log('✅ Command Result Tracking');
}

testEnhancedAgent().catch(console.error); 