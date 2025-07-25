import { IntelligentAgent } from './src/services/IntelligentAgent.js';

// Mock LocalLLMConfig for testing
const mockModel = {
  provider: 'lm-studio',
  url: 'http://localhost:1234',
  name: 'test-model'
};

async function testRefactoredArchitecture() {
  console.log('🧪 Testing Refactored Next Mavens Architecture\n');
  
  const agent = new IntelligentAgent(mockModel);
  const workingDirectory = process.cwd();
  
  const testCases = [
    {
      name: 'File Operations',
      message: 'list directory contents',
      description: 'Testing file operations agent'
    },
    {
      name: 'Command Execution',
      message: 'run echo "Hello from Next Mavens"',
      description: 'Testing command execution agent'
    },
    {
      name: 'Git Operations',
      message: 'git status',
      description: 'Testing git operations'
    },
    {
      name: 'Code Quality',
      message: 'analyze code quality',
      description: 'Testing code quality analysis'
    },
    {
      name: 'Database Operations',
      message: 'list mcp tools',
      description: 'Testing MCP operations'
    },
    {
      name: 'Codebase Analysis',
      message: 'analyze my codebase',
      description: 'Testing codebase analysis'
    },
    {
      name: 'General Conversation',
      message: 'what can you do?',
      description: 'Testing general conversation'
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`\n📋 Test: ${testCase.name}`);
    console.log(`📝 Description: ${testCase.description}`);
    console.log(`💬 Message: "${testCase.message}"`);
    console.log('🔄 Processing...\n');
    
    try {
      const response = await agent.processRequest({
        message: testCase.message,
        workingDirectory
      });
      
      console.log(`✅ Response: ${response.content.substring(0, 200)}...`);
      
      if (response.toolResults && response.toolResults.length > 0) {
        console.log(`🔧 Tool Results: ${response.toolResults.length} operations`);
      }
      
      if (response.commandResults && response.commandResults.length > 0) {
        console.log(`💻 Command Results: ${response.commandResults.length} commands`);
      }
      
      if (response.gitResults && response.gitResults.length > 0) {
        console.log(`🔧 Git Results: ${response.gitResults.length} operations`);
      }
      
      if (response.qualityResults && response.qualityResults.length > 0) {
        console.log(`🔍 Quality Results: ${response.qualityResults.length} analyses`);
      }
      
      if (response.mcpResults && response.mcpResults.length > 0) {
        console.log(`🔌 MCP Results: ${response.mcpResults.length} operations`);
      }
      
      if (response.databaseResults && response.databaseResults.length > 0) {
        console.log(`🗄️ Database Results: ${response.databaseResults.length} operations`);
      }
      
      if (response.context) {
        console.log(`📊 Context: ${response.context.projectType} project, ${response.context.codeFiles} code files`);
      }
      
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
    
    console.log('─'.repeat(80));
  }
  
  console.log('\n🎉 Refactored Architecture Test Complete!');
  console.log('\n📊 Architecture Summary:');
  console.log('• BaseAgent: Core LLM-driven processing and common functionality');
  console.log('• FileOperationsAgent: Specialized file operations with learning');
  console.log('• CommandExecutionAgent: Specialized command execution with error analysis');
  console.log('• IntelligentAgent: Orchestrates specialized agents (330 lines vs 1775 lines)');
  console.log('• LearningSystem: Adaptive learning and pattern recognition');
  console.log('• ContextManager: Conversation context and relevance tracking');
  console.log('\n✨ Benefits:');
  console.log('• Modular and maintainable code');
  console.log('• Specialized agents for different operations');
  console.log('• Fully LLM-driven with agentic features');
  console.log('• Under 500 lines per file');
  console.log('• Easy to extend with new specialized agents');
}

// Run the test
testRefactoredArchitecture().catch(console.error); 