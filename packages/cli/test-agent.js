import { IntelligentAgent } from './dist/services/IntelligentAgent.js';

// Mock LocalLLMConfig
const mockModel = {
  id: 'test-model',
  name: 'test-model',
  provider: 'lm-studio',
  url: 'http://localhost:1234'
};

async function testAgent() {
  console.log('🧪 Testing Next Mavens Intelligent Agent...\n');
  
  const agent = new IntelligentAgent(mockModel);
  const workingDirectory = process.cwd();
  
  // Test 1: Analyze codebase
  console.log('📁 Test 1: Analyzing codebase...');
  try {
    const response = await agent.processRequest({
      message: 'analyze my codebase',
      workingDirectory
    });
    console.log('✅ Codebase Analysis Response:');
    console.log(response.content);
    console.log('\nContext:', response.context);
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 2: List directory
  console.log('📂 Test 2: Listing directory...');
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
  
  // Test 3: Read a specific file
  console.log('📄 Test 3: Reading package.json...');
  try {
    const response = await agent.processRequest({
      message: 'read package.json',
      workingDirectory
    });
    console.log('✅ File Reading Response:');
    console.log(response.content);
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 4: Search for files
  console.log('🔍 Test 4: Searching for TypeScript files...');
  try {
    const response = await agent.processRequest({
      message: 'search for ts files',
      workingDirectory
    });
    console.log('✅ File Search Response:');
    console.log(response.content);
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
  
  console.log('\n🎉 Agent testing completed!');
}

testAgent().catch(console.error); 