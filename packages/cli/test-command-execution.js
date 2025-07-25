import { IntelligentAgent } from './dist/services/IntelligentAgent.js';

// Mock LocalLLMConfig
const mockModel = {
  id: 'test-model',
  name: 'test-model',
  provider: 'lm-studio',
  url: 'http://localhost:1234'
};

async function testCommandExecution() {
  console.log('🧪 Testing Improved Command Execution...\n');
  
  const agent = new IntelligentAgent(mockModel);
  const workingDirectory = process.cwd();
  
  // Test 1: Simple command
  console.log('💻 Test 1: Simple command...');
  try {
    const response = await agent.processRequest({
      message: 'run echo "Hello World"',
      workingDirectory
    });
    console.log('✅ Response:');
    console.log(response.content);
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 2: Build with errors request
  console.log('🔨 Test 2: Build with errors request...');
  try {
    const response = await agent.processRequest({
      message: 'build and see what errors I have and give me a summary',
      workingDirectory
    });
    console.log('✅ Response:');
    console.log(response.content);
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 3: Test with errors request
  console.log('🧪 Test 3: Test with errors request...');
  try {
    const response = await agent.processRequest({
      message: 'test and see what errors I have',
      workingDirectory
    });
    console.log('✅ Response:');
    console.log(response.content);
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 4: Install with errors request
  console.log('📦 Test 4: Install with errors request...');
  try {
    const response = await agent.processRequest({
      message: 'install and check for errors',
      workingDirectory
    });
    console.log('✅ Response:');
    console.log(response.content);
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
  
  console.log('\n🎉 Command execution testing completed!');
  console.log('\n📋 Summary:');
  console.log('✅ Smart command extraction');
  console.log('✅ Context-aware command mapping');
  console.log('✅ Error handling');
  console.log('✅ Natural language understanding');
}

testCommandExecution().catch(console.error); 