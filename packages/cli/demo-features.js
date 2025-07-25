#!/usr/bin/env node

import { IntelligentAgent } from './dist/services/IntelligentAgent.js';

const mockModel = {
  id: 'demo-model',
  name: 'demo-model',
  provider: 'lm-studio',
  url: 'http://localhost:1234'
};

async function demoFeatures() {
  console.log('🎬 Next Mavens CLI - Feature Demo\n');
  console.log('='.repeat(60));
  
  const agent = new IntelligentAgent(mockModel);
  const workingDirectory = process.cwd();
  
  const demos = [
    {
      title: '🔧 Git Integration',
      message: 'git status',
      description: 'Check repository status with intelligent parsing'
    },
    {
      title: '🔍 Code Quality Analysis',
      message: 'analyze code quality',
      description: 'Comprehensive code analysis and quality checks'
    },
    {
      title: '💻 Smart Shell Commands',
      message: 'build and see what errors I have',
      description: 'Natural language command execution'
    },
    {
      title: '📁 Intelligent File Creation',
      message: 'create demo.html with <h1>Next Mavens Demo</h1><p>This is amazing!</p>',
      description: 'Smart file creation with content'
    },
    {
      title: '🔎 Code Search',
      message: 'search for js files',
      description: 'Intelligent codebase search and analysis'
    },
    {
      title: '🗄️ Database Operations',
      message: 'connect to supabase https://demo.supabase.co',
      description: 'Database connection and query support'
    },
    {
      title: '🔌 MCP Integration',
      message: 'list mcp tools',
      description: 'External tool integration via MCP'
    },
    {
      title: '💬 Concise Responses',
      message: 'what can you do?',
      description: 'No verbose explanations - just what you need'
    }
  ];
  
  for (let i = 0; i < demos.length; i++) {
    const demo = demos[i];
    console.log(`\n${i + 1}. ${demo.title}`);
    console.log(`   ${demo.description}`);
    console.log(`   Command: "${demo.message}"`);
    console.log('   '.repeat(20) + '↓');
    
    try {
      const response = await agent.processRequest({
        message: demo.message,
        workingDirectory
      });
      
      // Truncate long responses for demo
      const content = response.content.length > 200 
        ? response.content.substring(0, 200) + '...'
        : response.content;
      
      console.log(`   Response: ${content}`);
      
      // Show result counts
      const resultCounts = [];
      if (response.gitResults?.length) resultCounts.push(`Git: ${response.gitResults.length}`);
      if (response.qualityResults?.length) resultCounts.push(`Quality: ${response.qualityResults.length}`);
      if (response.databaseResults?.length) resultCounts.push(`Database: ${response.databaseResults.length}`);
      if (response.mcpResults?.length) resultCounts.push(`MCP: ${response.mcpResults.length}`);
      if (response.commandResults?.length) resultCounts.push(`Commands: ${response.commandResults.length}`);
      
      if (resultCounts.length > 0) {
        console.log(`   Results: ${resultCounts.join(', ')}`);
      }
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
    
    console.log('   '.repeat(20) + '↑');
    console.log('   '.repeat(20) + '─'.repeat(40));
  }
  
  console.log('\n🎉 Demo Complete!');
  console.log('\n🚀 Next Mavens CLI Features:');
  console.log('✅ Git Integration - Full version control workflow');
  console.log('✅ Code Quality - Linting, complexity, security analysis');
  console.log('✅ Database Operations - Supabase, PostgreSQL support');
  console.log('✅ Smart Commands - Natural language to shell commands');
  console.log('✅ File Operations - Intelligent file creation and management');
  console.log('✅ MCP Integration - External tool connectivity');
  console.log('✅ Code Search - Deep codebase understanding');
  console.log('✅ Concise UX - No verbose explanations');
  console.log('✅ Local-First - Works offline with local LLMs');
  
  console.log('\n💪 Ready for real-world development!');
  console.log('📖 See README-ALL-FEATURES.md for complete documentation');
}

demoFeatures().catch(console.error); 