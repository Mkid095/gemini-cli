import { IntelligentAgent } from './dist/services/IntelligentAgent.js';

// Mock LocalLLMConfig
const mockModel = {
  id: 'test-model',
  name: 'test-model',
  provider: 'lm-studio',
  url: 'http://localhost:1234'
};

async function testFileCreation() {
  console.log('🧪 Testing File Creation Fix...\n');
  
  const agent = new IntelligentAgent(mockModel);
  const workingDirectory = process.cwd();
  
  // Test 1: Simple file creation
  console.log('📄 Test 1: Simple file creation...');
  try {
    const response = await agent.processRequest({
      message: 'create test.txt with Hello World',
      workingDirectory
    });
    console.log('✅ File Creation Response:');
    console.log(response.content);
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 2: HTML file creation
  console.log('🌐 Test 2: HTML file creation...');
  try {
    const response = await agent.processRequest({
      message: 'create a simple html file called test.html with <h1>Hello World</h1>',
      workingDirectory
    });
    console.log('✅ HTML File Creation Response:');
    console.log(response.content);
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 3: List directory to see created files
  console.log('📂 Test 3: List directory...');
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
  
  console.log('\n🎉 File creation testing completed!');
}

testFileCreation().catch(console.error); 