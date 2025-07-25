import { MCPClient } from './MCPClient.js';
import { ShellCommandExecutor, CommandResult } from './ShellCommandExecutor.js';

export interface DatabaseConnection {
  type: 'supabase' | 'postgresql' | 'mysql' | 'mongodb' | 'sqlite';
  host: string;
  port: number;
  database: string;
  username?: string;
  password?: string;
  url?: string;
}

export interface DatabaseQuery {
  sql: string;
  params?: any[];
  timeout?: number;
}

export interface DatabaseResult {
  success: boolean;
  data?: any[];
  error?: string;
  affectedRows?: number;
  executionTime?: number;
}

export interface DatabaseMigration {
  id: string;
  name: string;
  sql: string;
  applied: boolean;
  appliedAt?: Date;
}

export interface DatabaseBackup {
  id: string;
  filename: string;
  size: number;
  createdAt: Date;
  status: 'completed' | 'failed' | 'in_progress';
}

export class DatabaseService {
  private mcpClient: MCPClient;
  private shellExecutor: ShellCommandExecutor;
  private connections: Map<string, DatabaseConnection> = new Map();

  constructor(workingDirectory: string) {
    this.mcpClient = new MCPClient();
    this.shellExecutor = new ShellCommandExecutor(workingDirectory);
  }

  async connectSupabase(projectUrl: string, apiKey: string): Promise<DatabaseConnection> {
    const connection: DatabaseConnection = {
      type: 'supabase',
      host: projectUrl,
      port: 5432,
      database: 'postgres',
      url: projectUrl,
      password: apiKey
    };

    const connectionId = `supabase_${Date.now()}`;
    this.connections.set(connectionId, connection);

    // Try to connect via MCP if available
    try {
      await this.mcpClient.connectToServer('supabase-mcp', [projectUrl, apiKey]);
    } catch (error) {
      console.log('Supabase MCP server not available, using direct connection');
    }

    return connection;
  }

  async connectPostgreSQL(host: string, port: number, database: string, username: string, password: string): Promise<DatabaseConnection> {
    const connection: DatabaseConnection = {
      type: 'postgresql',
      host,
      port,
      database,
      username,
      password
    };

    const connectionId = `postgresql_${Date.now()}`;
    this.connections.set(connectionId, connection);

    return connection;
  }

  async executeQuery(connectionId: string, query: DatabaseQuery): Promise<DatabaseResult> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return { success: false, error: 'Connection not found' };
    }

    const startTime = Date.now();

    try {
      if (connection.type === 'supabase') {
        return await this.executeSupabaseQuery(connection, query);
      } else if (connection.type === 'postgresql') {
        return await this.executePostgreSQLQuery(connection, query);
      } else {
        return { success: false, error: `Unsupported database type: ${connection.type}` };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime
      };
    }
  }

  private async executeSupabaseQuery(connection: DatabaseConnection, query: DatabaseQuery): Promise<DatabaseResult> {
    // Try MCP first
    try {
      const servers = await this.mcpClient.listServers();
      const supabaseServer = servers.find(s => s.name.includes('supabase'));
      
      if (supabaseServer) {
        const result = await this.mcpClient.callTool(supabaseServer.name, 'execute_query', {
          sql: query.sql,
          params: query.params || []
        });
        
        return {
          success: true,
          data: result.data,
          affectedRows: result.affectedRows,
          executionTime: Date.now()
        };
      }
    } catch (error) {
      console.log('MCP query failed, trying direct connection');
    }

    // Fallback to direct connection using curl
    const curlCommand = `curl -X POST "${connection.url}/rest/v1/rpc/exec_sql" \
      -H "apikey: ${connection.password}" \
      -H "Authorization: Bearer ${connection.password}" \
      -H "Content-Type: application/json" \
      -d '{"sql": "${query.sql.replace(/"/g, '\\"')}"}'`;

    const result = await this.shellExecutor.executeCommand(curlCommand);
    
    if (result.success) {
      try {
        const data = JSON.parse(result.stdout);
        return {
          success: true,
          data: data.result || data,
          executionTime: Date.now()
        };
      } catch (error) {
        return {
          success: false,
          error: 'Failed to parse response',
          executionTime: Date.now()
        };
      }
    } else {
      return {
        success: false,
        error: result.stderr,
        executionTime: Date.now()
      };
    }
  }

  private async executePostgreSQLQuery(connection: DatabaseConnection, query: DatabaseQuery): Promise<DatabaseResult> {
    // Use psql command line tool
    const envVars = `PGHOST=${connection.host} PGPORT=${connection.port} PGDATABASE=${connection.database} PGUSER=${connection.username} PGPASSWORD=${connection.password}`;
    
    const sqlFile = `query_${Date.now()}.sql`;
    await this.shellExecutor.executeCommand(`echo "${query.sql}" > ${sqlFile}`);
    
    const result = await this.shellExecutor.executeCommand(`${envVars} psql -f ${sqlFile} --csv`);
    
    // Clean up
    await this.shellExecutor.executeCommand(`rm ${sqlFile}`);
    
    if (result.success) {
      return {
        success: true,
        data: this.parseCSVResult(result.stdout),
        executionTime: Date.now()
      };
    } else {
      return {
        success: false,
        error: result.stderr,
        executionTime: Date.now()
      };
    }
  }

  private parseCSVResult(csv: string): any[] {
    const lines = csv.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const data: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
      const row: any = {};
      
      for (let j = 0; j < headers.length; j++) {
        row[headers[j]] = values[j] || null;
      }
      
      data.push(row);
    }

    return data;
  }

  async createMigration(name: string, sql: string): Promise<DatabaseMigration> {
    const migration: DatabaseMigration = {
      id: `migration_${Date.now()}`,
      name,
      sql,
      applied: false
    };

    // Save migration to file
    const filename = `migrations/${migration.id}_${name}.sql`;
    await this.shellExecutor.executeCommand(`mkdir -p migrations`);
    await this.shellExecutor.executeCommand(`echo "${sql}" > ${filename}`);

    return migration;
  }

  async runMigrations(connectionId: string): Promise<CommandResult[]> {
    const results: CommandResult[] = [];
    
    // Find all migration files
    const findResult = await this.shellExecutor.executeCommand('find migrations -name "*.sql" -type f');
    
    if (findResult.success) {
      const migrations = findResult.stdout.split('\n').filter(line => line.trim());
      
      for (const migration of migrations) {
        const content = await this.shellExecutor.executeCommand(`cat "${migration}"`);
        
        if (content.success) {
          const query: DatabaseQuery = { sql: content.stdout };
          const result = await this.executeQuery(connectionId, query);
          
          if (result.success) {
            results.push({
              success: true,
              stdout: `Migration ${migration} applied successfully`,
              stderr: '',
              exitCode: 0,
              command: `migration: ${migration}`
            });
          } else {
            results.push({
              success: false,
              stdout: '',
              stderr: `Migration ${migration} failed: ${result.error}`,
              exitCode: 1,
              command: `migration: ${migration}`
            });
          }
        }
      }
    }

    return results;
  }

  async createBackup(connectionId: string, filename?: string): Promise<DatabaseBackup> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error('Connection not found');
    }

    const backupFilename = filename || `backup_${Date.now()}.sql`;
    const backup: DatabaseBackup = {
      id: `backup_${Date.now()}`,
      filename: backupFilename,
      size: 0,
      createdAt: new Date(),
      status: 'in_progress'
    };

    try {
      if (connection.type === 'postgresql') {
        const envVars = `PGHOST=${connection.host} PGPORT=${connection.port} PGDATABASE=${connection.database} PGUSER=${connection.username} PGPASSWORD=${connection.password}`;
        const result = await this.shellExecutor.executeCommand(`${envVars} pg_dump > ${backupFilename}`);
        
        if (result.success) {
          const sizeResult = await this.shellExecutor.executeCommand(`wc -c < ${backupFilename}`);
          backup.size = parseInt(sizeResult.stdout) || 0;
          backup.status = 'completed';
        } else {
          backup.status = 'failed';
        }
      } else if (connection.type === 'supabase') {
        // For Supabase, we might need to use their backup API
        const result = await this.shellExecutor.executeCommand(`curl -X POST "${connection.url}/rest/v1/rpc/backup_database" \
          -H "apikey: ${connection.password}" \
          -H "Authorization: Bearer ${connection.password}" \
          -o ${backupFilename}`);
        
        if (result.success) {
          const sizeResult = await this.shellExecutor.executeCommand(`wc -c < ${backupFilename}`);
          backup.size = parseInt(sizeResult.stdout) || 0;
          backup.status = 'completed';
        } else {
          backup.status = 'failed';
        }
      }
    } catch (error) {
      backup.status = 'failed';
    }

    return backup;
  }

  async restoreBackup(connectionId: string, backupFilename: string): Promise<CommandResult> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return { success: false, stdout: '', stderr: 'Connection not found', exitCode: 1, command: 'restore' };
    }

    if (connection.type === 'postgresql') {
      const envVars = `PGHOST=${connection.host} PGPORT=${connection.port} PGDATABASE=${connection.database} PGUSER=${connection.username} PGPASSWORD=${connection.password}`;
      return await this.shellExecutor.executeCommand(`${envVars} psql < ${backupFilename}`);
    } else if (connection.type === 'supabase') {
      // For Supabase, we might need to use their restore API
      return await this.shellExecutor.executeCommand(`curl -X POST "${connection.url}/rest/v1/rpc/restore_database" \
        -H "apikey: ${connection.password}" \
        -H "Authorization: Bearer ${connection.password}" \
        -F "file=@${backupFilename}"`);
    }

    return { success: false, stdout: '', stderr: 'Unsupported database type', exitCode: 1, command: 'restore' };
  }

  async listTables(connectionId: string): Promise<string[]> {
    const query: DatabaseQuery = {
      sql: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
    };

    const result = await this.executeQuery(connectionId, query);
    
    if (result.success && result.data) {
      return result.data.map(row => row.table_name).filter(Boolean);
    }

    return [];
  }

  async describeTable(connectionId: string, tableName: string): Promise<any[]> {
    const query: DatabaseQuery = {
      sql: `SELECT column_name, data_type, is_nullable, column_default 
            FROM information_schema.columns 
            WHERE table_name = '${tableName}' 
            ORDER BY ordinal_position`
    };

    const result = await this.executeQuery(connectionId, query);
    
    if (result.success && result.data) {
      return result.data;
    }

    return [];
  }

  async getConnectionInfo(connectionId: string): Promise<DatabaseConnection | null> {
    return this.connections.get(connectionId) || null;
  }

  async listConnections(): Promise<string[]> {
    return Array.from(this.connections.keys());
  }

  async disconnect(connectionId: string): Promise<void> {
    this.connections.delete(connectionId);
  }
} 