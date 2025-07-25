import { spawn, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface CommandResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  command: string;
}

export interface CommandOptions {
  cwd?: string;
  timeout?: number;
  env?: NodeJS.ProcessEnv;
}

export class ShellCommandExecutor {
  private workingDirectory: string;

  constructor(workingDirectory: string) {
    this.workingDirectory = workingDirectory;
  }

  async executeCommand(command: string, options: CommandOptions = {}): Promise<CommandResult> {
    const { cwd = this.workingDirectory, timeout = 30000, env = process.env } = options;

    try {
      console.log(`🔄 Executing command: ${command}`);
      
      const { stdout, stderr } = await execAsync(command, {
        cwd,
        timeout,
        env,
        shell: 'cmd.exe'
      });

      return {
        success: true,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: 0,
        command
      };
    } catch (error: any) {
      return {
        success: false,
        stdout: error.stdout?.trim() || '',
        stderr: error.stderr?.trim() || error.message,
        exitCode: error.code || 1,
        command
      };
    }
  }

  async executeCommandWithStream(command: string, options: CommandOptions = {}): Promise<CommandResult> {
    const { cwd = this.workingDirectory, env = process.env } = options;

    return new Promise((resolve) => {
      const child = spawn(command, [], {
        cwd,
        env,
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        resolve({
          success: code === 0,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: code || 0,
          command
        });
      });

      child.on('error', (error) => {
        resolve({
          success: false,
          stdout: '',
          stderr: error.message,
          exitCode: 1,
          command
        });
      });
    });
  }

  // Common command helpers
  async mkdir(path: string): Promise<CommandResult> {
    const command = process.platform === 'win32' ? `mkdir "${path}"` : `mkdir -p "${path}"`;
    return this.executeCommand(command);
  }

  async touch(filePath: string): Promise<CommandResult> {
    const command = process.platform === 'win32' 
      ? `echo. > "${filePath}"` 
      : `touch "${filePath}"`;
    return this.executeCommand(command);
  }

  async rm(path: string, recursive = false): Promise<CommandResult> {
    const flag = recursive ? '-rf' : '-f';
    const command = process.platform === 'win32'
      ? recursive ? `rmdir /s /q "${path}"` : `del "${path}"`
      : `rm ${flag} "${path}"`;
    return this.executeCommand(command);
  }

  async cp(source: string, destination: string, recursive = false): Promise<CommandResult> {
    const command = process.platform === 'win32'
      ? recursive ? `xcopy "${source}" "${destination}" /E /I /Y` : `copy "${source}" "${destination}"`
      : `cp ${recursive ? '-r' : ''} "${source}" "${destination}"`;
    return this.executeCommand(command);
  }

  async mv(source: string, destination: string): Promise<CommandResult> {
    const command = process.platform === 'win32'
      ? `move "${source}" "${destination}"`
      : `mv "${source}" "${destination}"`;
    return this.executeCommand(command);
  }

  async ls(path?: string): Promise<CommandResult> {
    const targetPath = path || '.';
    const command = process.platform === 'win32'
      ? `dir "${targetPath}"`
      : `ls -la "${targetPath}"`;
    return this.executeCommand(command);
  }

  async cat(filePath: string): Promise<CommandResult> {
    const command = process.platform === 'win32'
      ? `type "${filePath}"`
      : `cat "${filePath}"`;
    return this.executeCommand(command);
  }

  async npm(command: string): Promise<CommandResult> {
    return this.executeCommand(`npm ${command}`);
  }

  async git(command: string): Promise<CommandResult> {
    return this.executeCommand(`git ${command}`);
  }

  async node(command: string): Promise<CommandResult> {
    return this.executeCommand(`node ${command}`);
  }

  async python(command: string): Promise<CommandResult> {
    return this.executeCommand(`python ${command}`);
  }

  async pip(command: string): Promise<CommandResult> {
    return this.executeCommand(`pip ${command}`);
  }
} 