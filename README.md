# Next Mavens CLI

[![Next Mavens CLI CI](https://github.com/nextmavens/cli/actions/workflows/ci.yml/badge.svg)](https://github.com/nextmavens/cli/actions/workflows/ci.yml)

![Next Mavens CLI Screenshot](./docs/assets/next-mavens-screenshot.png)

This repository contains the Next Mavens CLI, a command-line AI workflow tool that connects to your
local LLM services, understands your code and accelerates your workflows.

With the Next Mavens CLI you can:

- Query and edit large codebases using local LLM models with extensive context windows.
- Generate new apps from PDFs or sketches, using local multimodal capabilities.
- Automate operational tasks, like querying pull requests or handling complex rebases.
- Use tools and MCP servers to connect new capabilities with your local development environment.
- Work entirely offline with your own local LLM models through LM Studio and Ollama integration.

## Quickstart

You have two options to install Next Mavens CLI.

### With Node

1. **Prerequisites:** Ensure you have [Node.js version 20](https://nodejs.org/en/download) or higher installed.
2. **Run the CLI:** Execute the following command in your terminal:

   ```bash
   npx https://github.com/nextmavens/cli
   ```

   Or install it with:

   ```bash
   npm install -g @nextmavens/cli
   ```

   Then, run the CLI from anywhere:

   ```bash
   gemini
   ```

### With Homebrew

1. **Prerequisites:** Ensure you have [Homebrew](https://brew.sh/) installed.
2. **Install the CLI** Execute the following command in your terminal:

   ```bash
   brew install next-mavens-cli
   ```

   Then, run the CLI from anywhere:

   ```bash
   next-mavens
   ```

### Common Configuration steps

3. **Pick a color theme**
4. **Configure Local Models:** When prompted, the CLI will help you set up connections to your local LLM services (LM Studio or Ollama). No external API keys or authentication required.

You are now ready to use the Next Mavens CLI!

### Use Local LLM Services:

Next Mavens CLI works with local LLM services, providing complete privacy and no usage limits:

#### LM Studio Setup:
1. Download and install [LM Studio](https://lmstudio.ai/)
2. Download your preferred models through the LM Studio interface
3. Start the local server in LM Studio (typically runs on http://localhost:1234)
4. Next Mavens CLI will automatically detect and connect to your LM Studio instance

#### Ollama Setup:
1. Download and install [Ollama](https://ollama.ai/)
2. Pull your preferred models using: `ollama pull llama2` (or any other model)
3. Start Ollama service (typically runs on http://localhost:11434)
4. Next Mavens CLI will automatically detect and connect to your Ollama instance

#### Legacy Cloud API Support:
For backward compatibility, you can still use cloud APIs by setting environment variables, but local models are recommended for better privacy and performance.

For other authentication methods, including Google Workspace accounts, see the [authentication](./docs/cli/authentication.md) guide.

## Examples

Once the CLI is running, you can start interacting with your local LLM models from your shell.

You can start a project from a new directory:

```sh
cd new-project/
next-mavens
> Write me a Discord bot that answers questions using a FAQ.md file I will provide
```

Or work with an existing project:

```sh
git clone https://github.com/nextmavens/cli
cd cli
next-mavens
> Give me a summary of all of the changes that went in yesterday
```

### Next steps

- Learn how to [contribute to or build from the source](./CONTRIBUTING.md).
- Explore the available **[CLI Commands](./docs/cli/commands.md)**.
- If you encounter any issues, review the **[troubleshooting guide](./docs/troubleshooting.md)**.
- For more comprehensive documentation, see the [full documentation](./docs/index.md).
- Take a look at some [popular tasks](#popular-tasks) for more inspiration.
- Check out our **[Official Roadmap](./ROADMAP.md)**

### Troubleshooting

Head over to the [troubleshooting guide](docs/troubleshooting.md) if you're
having issues.

## Popular tasks

### Explore a new codebase

Start by `cd`ing into an existing or newly-cloned repository and running `next-mavens`.

```text
> Describe the main pieces of this system's architecture.
```

```text
> What security mechanisms are in place?
```

### Work with your existing code

```text
> Implement a first draft for GitHub issue #123.
```

```text
> Help me migrate this codebase to the latest version of Java. Start with a plan.
```

### Automate your workflows

Use MCP servers to integrate your local system tools with your enterprise collaboration suite.

```text
> Make me a slide deck showing the git history from the last 7 days, grouped by feature and team member.
```

```text
> Make a full-screen web app for a wall display to show our most interacted-with GitHub issues.
```

### Interact with your system

```text
> Convert all the images in this directory to png, and rename them to use dates from the exif data.
```

```text
> Organize my PDF invoices by month of expenditure.
```

### Uninstall

Head over to the [Uninstall](docs/Uninstall.md) guide for uninstallation instructions.

## Terms of Service and Privacy Notice

For details on the terms of service and privacy notice applicable to your use of Next Mavens CLI, see the [Terms of Service and Privacy Notice](./docs/tos-privacy.md).
