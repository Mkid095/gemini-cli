import { ShellCommandExecutor, CommandResult } from './ShellCommandExecutor.js';
import { EventEmitter } from 'events';

export interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  staged: string[];
  unstaged: string[];
  untracked: string[];
  conflicts: string[];
}

export interface GitCommit {
  hash: string;
  author: string;
  date: string;
  message: string;
  files: string[];
}

export interface GitDiff {
  file: string;
  additions: number;
  deletions: number;
  changes: string[];
}

export class GitService extends EventEmitter {
  private shellExecutor: ShellCommandExecutor;

  constructor(workingDirectory: string) {
    super();
    this.shellExecutor = new ShellCommandExecutor(workingDirectory);
  }

  async init(): Promise<CommandResult> {
    return await this.shellExecutor.executeCommand('git init');
  }

  async status(): Promise<GitStatus> {
    const result = await this.shellExecutor.executeCommand('git status --porcelain');
    const branchResult = await this.shellExecutor.executeCommand('git branch --show-current');
    
    const status: GitStatus = {
      branch: branchResult.stdout.trim() || 'main',
      ahead: 0,
      behind: 0,
      staged: [],
      unstaged: [],
      untracked: [],
      conflicts: []
    };

    if (result.success) {
      const lines = result.stdout.split('\n').filter(line => line.trim());
      for (const line of lines) {
        const statusCode = line.substring(0, 2);
        const file = line.substring(3);
        
        if (statusCode.includes('M') || statusCode.includes('A') || statusCode.includes('D')) {
          if (statusCode[0] !== ' ') {
            status.staged.push(file);
          }
          if (statusCode[1] !== ' ') {
            status.unstaged.push(file);
          }
        } else if (statusCode === '??') {
          status.untracked.push(file);
        } else if (statusCode.includes('U') || statusCode.includes('A')) {
          status.conflicts.push(file);
        }
      }
    }

    // Get ahead/behind info
    const remoteResult = await this.shellExecutor.executeCommand('git rev-list --count --left-right @{u}...HEAD 2>/dev/null || echo "0 0"');
    if (remoteResult.success) {
      const [behind, ahead] = remoteResult.stdout.trim().split('\t').map(Number);
      status.behind = behind || 0;
      status.ahead = ahead || 0;
    }

    return status;
  }

  async add(files: string[] = []): Promise<CommandResult> {
    const fileList = files.length > 0 ? files.join(' ') : '.';
    return await this.shellExecutor.executeCommand(`git add ${fileList}`);
  }

  async commit(message: string, files: string[] = []): Promise<CommandResult> {
    if (files.length > 0) {
      await this.add(files);
    }
    return await this.shellExecutor.executeCommand(`git commit -m "${message}"`);
  }

  async push(branch?: string): Promise<CommandResult> {
    const branchName = branch || 'HEAD';
    return await this.shellExecutor.executeCommand(`git push origin ${branchName}`);
  }

  async pull(branch?: string): Promise<CommandResult> {
    const branchName = branch || 'HEAD';
    return await this.shellExecutor.executeCommand(`git pull origin ${branchName}`);
  }

  async checkout(branch: string, create: boolean = false): Promise<CommandResult> {
    const flag = create ? '-b ' : '';
    return await this.shellExecutor.executeCommand(`git checkout ${flag}${branch}`);
  }

  async branch(name?: string, shouldDelete: boolean = false): Promise<CommandResult> {
    if (shouldDelete && name) {
      return await this.shellExecutor.executeCommand(`git branch -d ${name}`);
    } else if (name) {
      return await this.shellExecutor.executeCommand(`git branch ${name}`);
    } else {
      return await this.shellExecutor.executeCommand('git branch -a');
    }
  }

  async merge(branch: string, strategy: string = ''): Promise<CommandResult> {
    const strategyFlag = strategy ? `-s ${strategy}` : '';
    return await this.shellExecutor.executeCommand(`git merge ${strategyFlag} ${branch}`);
  }

  async rebase(branch: string): Promise<CommandResult> {
    return await this.shellExecutor.executeCommand(`git rebase ${branch}`);
  }

  async log(limit: number = 10, format: string = 'oneline'): Promise<GitCommit[]> {
    const result = await this.shellExecutor.executeCommand(`git log --format="%H|%an|%ad|%s" --date=short -n ${limit}`);
    
    if (!result.success) return [];

    const commits: GitCommit[] = [];
    const lines = result.stdout.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      const [hash, author, date, message] = line.split('|');
      commits.push({
        hash: hash || '',
        author: author || '',
        date: date || '',
        message: message || '',
        files: []
      });
    }

    return commits;
  }

  async diff(file?: string): Promise<GitDiff[]> {
    const fileArg = file ? ` ${file}` : '';
    const result = await this.shellExecutor.executeCommand(`git diff --stat${fileArg}`);
    
    if (!result.success) return [];

    const diffs: GitDiff[] = [];
    const lines = result.stdout.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      const match = line.match(/^(.+?)\s+\|\s+(\d+)\s+(\+*)(-*)$/);
      if (match) {
        const [, fileName, changes, additions, deletions] = match;
        diffs.push({
          file: fileName.trim(),
          additions: additions.length,
          deletions: deletions.length,
          changes: []
        });
      }
    }

    return diffs;
  }

  async stash(message?: string): Promise<CommandResult> {
    const messageArg = message ? ` push -m "${message}"` : ' push';
    return await this.shellExecutor.executeCommand(`git stash${messageArg}`);
  }

  async stashPop(index: number = 0): Promise<CommandResult> {
    return await this.shellExecutor.executeCommand(`git stash pop stash@{${index}}`);
  }

  async stashList(): Promise<CommandResult> {
    return await this.shellExecutor.executeCommand('git stash list');
  }

  async remote(name: string, url?: string): Promise<CommandResult> {
    if (url) {
      return await this.shellExecutor.executeCommand(`git remote add ${name} ${url}`);
    } else {
      return await this.shellExecutor.executeCommand(`git remote -v`);
    }
  }

  async fetch(remote: string = 'origin'): Promise<CommandResult> {
    return await this.shellExecutor.executeCommand(`git fetch ${remote}`);
  }

  async reset(type: 'soft' | 'mixed' | 'hard' = 'mixed', commit: string = 'HEAD'): Promise<CommandResult> {
    return await this.shellExecutor.executeCommand(`git reset --${type} ${commit}`);
  }

  async clean(dryRun: boolean = true): Promise<CommandResult> {
    const flag = dryRun ? '--dry-run' : '';
    return await this.shellExecutor.executeCommand(`git clean -fd ${flag}`);
  }

  async blame(file: string): Promise<CommandResult> {
    return await this.shellExecutor.executeCommand(`git blame ${file}`);
  }

  async show(commit: string): Promise<CommandResult> {
    return await this.shellExecutor.executeCommand(`git show ${commit}`);
  }

  async tag(name: string, message?: string, commit: string = 'HEAD'): Promise<CommandResult> {
    const messageArg = message ? ` -m "${message}"` : '';
    return await this.shellExecutor.executeCommand(`git tag${messageArg} ${name} ${commit}`);
  }

  async tagList(): Promise<CommandResult> {
    return await this.shellExecutor.executeCommand('git tag -l');
  }

  async cherryPick(commit: string): Promise<CommandResult> {
    return await this.shellExecutor.executeCommand(`git cherry-pick ${commit}`);
  }

  async revert(commit: string): Promise<CommandResult> {
    return await this.shellExecutor.executeCommand(`git revert ${commit}`);
  }

  async bisect(command: 'start' | 'good' | 'bad' | 'reset', commit?: string): Promise<CommandResult> {
    const commitArg = commit ? ` ${commit}` : '';
    return await this.shellExecutor.executeCommand(`git bisect ${command}${commitArg}`);
  }

  async submodule(command: 'init' | 'update' | 'add', path?: string): Promise<CommandResult> {
    const pathArg = path ? ` ${path}` : '';
    return await this.shellExecutor.executeCommand(`git submodule ${command}${pathArg}`);
  }

  async worktree(command: 'add' | 'list' | 'remove', path?: string, branch?: string): Promise<CommandResult> {
    if (command === 'add' && path && branch) {
      return await this.shellExecutor.executeCommand(`git worktree add ${path} ${branch}`);
    } else if (command === 'list') {
      return await this.shellExecutor.executeCommand('git worktree list');
    } else if (command === 'remove' && path) {
      return await this.shellExecutor.executeCommand(`git worktree remove ${path}`);
    }
    return { success: false, stdout: '', stderr: 'Invalid worktree command', exitCode: 1, command: '' };
  }
} 