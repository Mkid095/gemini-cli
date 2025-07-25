import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

export interface MCPMessage {
  jsonrpc: '2.0';
  id?: string | number;
  method?: string;
  params?: any;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
}

export interface MCPServer {
  name: string;
  version: string;
  capabilities: any;
  tools: MCPTool[];
}

export class MCPClient extends EventEmitter {
  private process: ChildProcess | null = null;
  private messageId = 0;
  private pendingRequests = new Map<string | number, (result: any) => void>();
  private servers = new Map<string, MCPServer>();

  constructor() {
    super();
  }

  async connectToServer(command: string, args: string[] = []): Promise<MCPServer> {
    return new Promise((resolve, reject) => {
      this.process = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.process.stdout?.on('data', (data) => {
        const messages = data.toString().split('\n').filter((line: string) => line.trim());
        for (const message of messages) {
          try {
            const parsed = JSON.parse(message);
            this.handleMessage(parsed);
          } catch (error) {
            console.error('Failed to parse MCP message:', error);
          }
        }
      });

      this.process.stderr?.on('data', (data) => {
        console.error('MCP Server stderr:', data.toString());
      });

      this.process.on('close', (code) => {
        console.log(`MCP Server process exited with code ${code}`);
        this.emit('disconnect', code);
      });

      this.process.on('error', (error) => {
        console.error('MCP Server process error:', error);
        reject(error);
      });

      // Initialize the connection
      this.initialize().then(resolve).catch(reject);
    });
  }

  private async initialize(): Promise<MCPServer> {
    // Send initialize request
    const response = await this.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: {}
      },
      clientInfo: {
        name: 'next-mavens-cli',
        version: '1.0.0'
      }
    });

    // Send initialized notification
    await this.sendNotification('initialized', {});

    // List tools
    const toolsResponse = await this.sendRequest('tools/list', {});
    
    const server: MCPServer = {
      name: response.result.serverInfo?.name || 'unknown',
      version: response.result.serverInfo?.version || '1.0.0',
      capabilities: response.result.capabilities || {},
      tools: toolsResponse.result.tools || []
    };

    this.servers.set(server.name, server);
    return server;
  }

  private async sendRequest(method: string, params: any): Promise<MCPMessage> {
    return new Promise((resolve, reject) => {
      const id = ++this.messageId;
      const message: MCPMessage = {
        jsonrpc: '2.0',
        id,
        method,
        params
      };

      this.pendingRequests.set(id, resolve);
      
      if (this.process?.stdin) {
        this.process.stdin.write(JSON.stringify(message) + '\n');
      } else {
        reject(new Error('MCP process not connected'));
      }
    });
  }

  private async sendNotification(method: string, params: any): Promise<void> {
    const message: MCPMessage = {
      jsonrpc: '2.0',
      method,
      params
    };

    if (this.process?.stdin) {
      this.process.stdin.write(JSON.stringify(message) + '\n');
    }
  }

  private handleMessage(message: MCPMessage): void {
    if (message.id !== undefined) {
      // This is a response to a request
      const resolve = this.pendingRequests.get(message.id);
      if (resolve) {
        this.pendingRequests.delete(message.id);
        resolve(message);
      }
    } else if (message.method) {
      // This is a notification or request from the server
      this.emit('message', message);
    }
  }

  async callTool(serverName: string, toolName: string, arguments_: any): Promise<any> {
    const server = this.servers.get(serverName);
    if (!server) {
      throw new Error(`Server ${serverName} not found`);
    }

    const tool = server.tools.find(t => t.name === toolName);
    if (!tool) {
      throw new Error(`Tool ${toolName} not found in server ${serverName}`);
    }

    const response = await this.sendRequest('tools/call', {
      name: toolName,
      arguments: arguments_
    });

    if (response.error) {
      throw new Error(`Tool call failed: ${response.error.message}`);
    }

    return response.result;
  }

  async listServers(): Promise<MCPServer[]> {
    return Array.from(this.servers.values());
  }

  async listTools(serverName?: string): Promise<MCPTool[]> {
    if (serverName) {
      const server = this.servers.get(serverName);
      return server?.tools || [];
    }
    
    const allTools: MCPTool[] = [];
    for (const server of this.servers.values()) {
      allTools.push(...server.tools);
    }
    return allTools;
  }

  disconnect(): void {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this.pendingRequests.clear();
    this.servers.clear();
  }
} 