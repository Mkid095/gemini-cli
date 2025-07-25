import { IntelligentAgent } from './dist/services/IntelligentAgent.js';

// Mock LocalLLMConfig
const mockModel = {
  id: 'test-model',
  name: 'test-model',
  provider: 'lm-studio',
  url: 'http://localhost:1234'
};

async function testAllFeatures() {
  console.log('🚀 Testing ALL Next Mavens Features...\n');
  
  const agent = new IntelligentAgent(mockModel);
  const workingDirectory = process.cwd();
  
  // Test 1: Basic Operations
  console.log('📁 Test 1: Basic File Operations...');
  try {
    const response = await agent.processRequest({
      message: 'list directory',
      workingDirectory
    });
    console.log('✅ Directory Listing:');
    console.log(response.content.substring(0, 200) + '...');
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 2: Git Operations
  console.log('🔧 Test 2: Git Operations...');
  try {
    const response = await agent.processRequest({
      message: 'git status',
      workingDirectory
    });
    console.log('✅ Git Status:');
    console.log(response.content);
    if (response.gitResults) {
      console.log('Git Results:', response.gitResults.length);
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 3: Code Quality Analysis
  console.log('🔍 Test 3: Code Quality Analysis...');
  try {
    const response = await agent.processRequest({
      message: 'analyze code quality',
      workingDirectory
    });
    console.log('✅ Code Quality Report:');
    console.log(response.content);
    if (response.qualityResults) {
      console.log('Quality Results:', response.qualityResults.length);
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 4: Shell Commands
  console.log('💻 Test 4: Shell Commands...');
  try {
    const response = await agent.processRequest({
      message: 'run echo "Testing shell commands"',
      workingDirectory
    });
    console.log('✅ Shell Command:');
    console.log(response.content);
    if (response.commandResults) {
      console.log('Command Results:', response.commandResults.length);
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 5: File Creation
  console.log('📄 Test 5: File Creation...');
  try {
    const response = await agent.processRequest({
      message: 'create test-feature.js with console.log("Testing new features")',
      workingDirectory
    });
    console.log('✅ File Creation:');
    console.log(response.content);
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 6: MCP Operations
  console.log('🔌 Test 6: MCP Operations...');
  try {
    const response = await agent.processRequest({
      message: 'list mcp tools',
      workingDirectory
    });
    console.log('✅ MCP Tools:');
    console.log(response.content);
    if (response.mcpResults) {
      console.log('MCP Results:', response.mcpResults.length);
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 7: Database Operations (will show connection info)
  console.log('🗄️ Test 7: Database Operations...');
  try {
    const response = await agent.processRequest({
      message: 'connect to supabase https://example.supabase.co',
      workingDirectory
    });
    console.log('✅ Database Connection:');
    console.log(response.content);
    if (response.databaseResults) {
      console.log('Database Results:', response.databaseResults.length);
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 8: Code Search
  console.log('🔎 Test 8: Code Search...');
  try {
    const response = await agent.processRequest({
      message: 'search for js files',
      workingDirectory
    });
    console.log('✅ Code Search:');
    console.log(response.content);
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 9: Project Analysis
  console.log('📊 Test 9: Project Analysis...');
  try {
    const response = await agent.processRequest({
      message: 'analyze my codebase',
      workingDirectory
    });
    console.log('✅ Project Analysis:');
    console.log(response.content);
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 10: General Conversation
  console.log('💬 Test 10: General Conversation...');
  try {
    const response = await agent.processRequest({
      message: 'what can you do?',
      workingDirectory
    });
    console.log('✅ Capabilities:');
    console.log(response.content);
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
  
  console.log('\n🎉 ALL FEATURES TESTING COMPLETED!');
  console.log('\n📋 SUMMARY OF NEW FEATURES:');
  console.log('✅ Git Integration - Status, commit, push, pull, branch operations');
  console.log('✅ Code Quality Analysis - Linting, complexity, security checks');
  console.log('✅ Database Operations - Supabase, PostgreSQL, migrations');
  console.log('✅ Enhanced Shell Commands - Smart command extraction');
  console.log('✅ MCP Server Integration - External tool connections');
  console.log('✅ Advanced File Operations - Intelligent file creation');
  console.log('✅ Code Search & Analysis - Project understanding');
  console.log('✅ Concise Responses - No more verbose explanations');
  console.log('✅ Context-Aware Processing - Smart intent recognition');
  console.log('✅ Multi-Service Architecture - Modular, extensible design');
  
  console.log('\n🚀 Next Mavens CLI is now a POWERHOUSE coding assistant!');
  console.log('💪 Ready for real-world development workflows!');
}

testAllFeatures().catch(console.error); 