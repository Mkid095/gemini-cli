# Next Mavens - Refactored Agent Architecture

## 🏗️ Architecture Overview

The **Next Mavens CLI** has been completely refactored into a modular, specialized agent architecture that maintains full LLM-driven intelligence while staying under 500 lines per file.

## 📁 File Structure

```
src/services/
├── agents/
│   ├── BaseAgent.ts              # Abstract base class (250 lines)
│   ├── FileOperationsAgent.ts    # File operations specialist (350 lines)
│   └── CommandExecutionAgent.ts  # Command execution specialist (300 lines)
├── IntelligentAgent.ts           # Main orchestrator (330 lines)
├── LearningSystem.ts             # Adaptive learning (400 lines)
├── ContextManager.ts             # Context management (350 lines)
├── CodebaseAnalyzer.ts           # Project analysis
├── ShellCommandExecutor.ts       # Command execution
├── GitService.ts                 # Git operations
├── CodeQualityAnalyzer.ts        # Code quality analysis
├── DatabaseService.ts            # Database operations
└── MCPClient.ts                  # MCP server integration
```

## 🧠 Core Components

### 1. BaseAgent (Abstract Base Class)
**Purpose**: Provides core LLM-driven processing and common functionality
**Key Features**:
- Abstract methods for specialized agents to implement
- Common LLM communication (LM Studio, Ollama)
- Learning system integration
- Context management
- Performance metrics tracking

```typescript
export abstract class BaseAgent {
  protected abstract getAvailableTools(): string[];
  protected abstract buildComprehensivePrompt(...): string;
  protected abstract executeOperationsWithLearning(...): Promise<string>;
  protected abstract enhancedFallbackProcessing(...): Promise<string>;
}
```

### 2. FileOperationsAgent (Specialized Agent)
**Purpose**: Handles all file-related operations with LLM-driven intelligence
**Capabilities**:
- File reading with intelligent path extraction
- File creation with content analysis
- Directory listing with project context
- File search with learning insights
- File content analysis (functions, classes, imports)

**LLM Integration**:
- Intelligent file path extraction from natural language
- File content analysis and language detection
- Learning-based file operation suggestions
- Context-aware file recommendations

### 3. CommandExecutionAgent (Specialized Agent)
**Purpose**: Handles shell command execution with intelligent error analysis
**Capabilities**:
- Natural language command extraction
- Build/test/install command handling
- Directory creation
- Intelligent error analysis and suggestions
- Command result interpretation

**LLM Integration**:
- Natural language to command translation
- Error analysis with LLM-powered suggestions
- Build/test error interpretation
- Command optimization recommendations

### 4. IntelligentAgent (Main Orchestrator)
**Purpose**: Routes requests to appropriate specialized agents
**Key Features**:
- Intent analysis and routing
- Service coordination
- Response aggregation
- Error handling

**Routing Logic**:
```typescript
switch (intent) {
  case 'file_operations': return await this.fileAgent.processRequest(request);
  case 'command_execution': return await this.commandAgent.processRequest(request);
  case 'git_operations': return await this.handleGitOperations(request);
  case 'code_quality': return await this.handleCodeQuality(request);
  case 'database_operations': return await this.handleDatabaseOperations(request);
  case 'mcp_operations': return await this.handleMCPOperations(request);
  case 'codebase_analysis': return await this.handleCodebaseAnalysis(request);
  default: return await this.handleGeneralConversation(request);
}
```

## 🧠 Advanced AI Systems

### LearningSystem
**Purpose**: Adaptive learning and pattern recognition
**Features**:
- Pattern learning from user interactions
- Success rate tracking
- User behavior analysis
- Personalized recommendations
- Confidence scoring

### ContextManager
**Purpose**: Conversation context and relevance tracking
**Features**:
- Context window management
- Relevance scoring
- Conversation history
- Project state tracking
- Intent tracking

## 🔄 LLM-Driven Processing Flow

### 1. Request Processing
```typescript
// 1. Intent Analysis
const intent = await this.analyzeIntent(message);

// 2. Route to Specialized Agent
const response = await this.routeToAgent(intent, request);

// 3. LLM-Enhanced Processing
const llmAnalysis = await this.sendToLLM(comprehensivePrompt);
const operations = await this.executeOperationsWithLearning(...);
```

### 2. Comprehensive Prompt Building
Each specialized agent builds context-rich prompts:
- User request
- Conversation context
- Project context
- Learning insights
- Available tools
- User preferences

### 3. Learning-Enhanced Operations
- Confidence-based operation execution
- Learning insights integration
- Context-aware suggestions
- Performance tracking

## 🎯 Key Benefits

### 1. Modularity
- **Single Responsibility**: Each agent handles one domain
- **Easy Extension**: Add new specialized agents easily
- **Maintainable**: Under 500 lines per file
- **Testable**: Isolated functionality for testing

### 2. LLM-Driven Intelligence
- **Context-Aware**: Full conversation and project context
- **Learning-Enhanced**: Adaptive responses based on patterns
- **Error Analysis**: LLM-powered error interpretation
- **Natural Language**: Intuitive command processing

### 3. Agentic Features
- **Intent Recognition**: Intelligent request routing
- **Tool Orchestration**: Coordinated multi-tool operations
- **Error Recovery**: Graceful fallback processing
- **Performance Optimization**: Learning-based improvements

### 4. Scalability
- **Horizontal Scaling**: Add new specialized agents
- **Vertical Scaling**: Enhance existing agents
- **Performance**: Optimized for large codebases
- **Memory Management**: Efficient context handling

## 🚀 Usage Examples

### File Operations
```typescript
// Natural language file operations
await agent.processRequest({
  message: "read the main configuration file",
  workingDirectory: "/project"
});

await agent.processRequest({
  message: "create a new component file with React hooks",
  workingDirectory: "/project"
});
```

### Command Execution
```typescript
// Natural language command execution
await agent.processRequest({
  message: "build the project and show me any errors",
  workingDirectory: "/project"
});

await agent.processRequest({
  message: "run the tests and give me a summary",
  workingDirectory: "/project"
});
```

### Git Operations
```typescript
// Natural language git operations
await agent.processRequest({
  message: "commit my changes with a descriptive message",
  workingDirectory: "/project"
});

await agent.processRequest({
  message: "check the git status and show me what's changed",
  workingDirectory: "/project"
});
```

## 🔧 Extending the Architecture

### Adding a New Specialized Agent

1. **Create the Agent Class**:
```typescript
export class NewSpecializedAgent extends BaseAgent {
  protected getAvailableTools(): string[] {
    return ['tool1', 'tool2'];
  }
  
  protected buildComprehensivePrompt(...): string {
    return `Specialized prompt for new domain...`;
  }
  
  protected async executeOperationsWithLearning(...): Promise<string> {
    // Implement specialized operations
  }
  
  protected async enhancedFallbackProcessing(...): Promise<string> {
    // Implement fallback processing
  }
}
```

2. **Add to IntelligentAgent**:
```typescript
case 'new_operations':
  return await this.newAgent.processRequest(request);
```

3. **Update Intent Analysis**:
```typescript
if (lowerMessage.includes('new_keyword')) {
  return 'new_operations';
}
```

## 📊 Performance Metrics

### File Size Reduction
- **Before**: 1775 lines in single file
- **After**: 330 lines in main orchestrator
- **Reduction**: 81% size reduction in main file

### Modularity Benefits
- **Maintainability**: Each file under 500 lines
- **Testability**: Isolated functionality
- **Extensibility**: Easy to add new agents
- **Readability**: Clear separation of concerns

### LLM Integration Benefits
- **Context Awareness**: Full conversation and project context
- **Learning**: Adaptive responses based on patterns
- **Error Analysis**: Intelligent error interpretation
- **Natural Language**: Intuitive command processing

## 🎉 Conclusion

The refactored **Next Mavens** architecture provides:

✅ **Modular Design**: Clean separation of concerns
✅ **LLM-Driven**: Fully intelligent processing
✅ **Agentic Features**: Advanced tool orchestration
✅ **Scalable**: Easy to extend and maintain
✅ **Performance**: Optimized for large codebases
✅ **User-Friendly**: Natural language interaction

This architecture maintains the full intelligence and capabilities of the original system while providing a clean, maintainable, and extensible foundation for future development. 