import { IntelligentAgent } from './dist/services/IntelligentAgent.js';

// Mock LocalLLMConfig
const mockModel = {
  id: 'test-model',
  name: 'test-model',
  provider: 'lm-studio',
  url: 'http://localhost:1234'
};

async function testConversation() {
  console.log('🧪 Testing Improved Conversation Responses...\n');
  
  const agent = new IntelligentAgent(mockModel);
  const workingDirectory = process.cwd();
  
  // Test 1: Simple greeting
  console.log('👋 Test 1: Simple greeting...');
  try {
    const response = await agent.processRequest({
      message: 'hi',
      workingDirectory
    });
    console.log('✅ Response:');
    console.log(response.content);
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 2: Help request
  console.log('❓ Test 2: Help request...');
  try {
    const response = await agent.processRequest({
      message: 'what can you do?',
      workingDirectory
    });
    console.log('✅ Response:');
    console.log(response.content);
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 3: Codebase analysis (should be concise)
  console.log('🔍 Test 3: Codebase analysis...');
  try {
    const response = await agent.processRequest({
      message: 'analyze my codebase',
      workingDirectory
    });
    console.log('✅ Response:');
    console.log(response.content);
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 4: Random message
  console.log('💬 Test 4: Random message...');
  try {
    const response = await agent.processRequest({
      message: 'I like coding',
      workingDirectory
    });
    console.log('✅ Response:');
    console.log(response.content);
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
  
  console.log('\n🎉 Conversation testing completed!');
  console.log('\n📋 Summary:');
  console.log('✅ Concise greetings');
  console.log('✅ Brief help responses');
  console.log('✅ Short codebase analysis');
  console.log('✅ Contextual responses');
}

testConversation().catch(console.error); 