---
name: managing-github-repos
description: Initializes, configures, and maintains GitHub version control. Handles secure .gitignore setup, high-quality README generation, and smart atomic commits while filtering out non-essential documentation.
---

# Managing GitHub Repositories

## When to use this skill
- Starting version control on a new or existing project.
- Setting up a repository for GitHub.
- Creating or updating a high-quality project README.
- Managing commits and pushing changes to a remote repository.
- Cleaning up the repository to exclude agent-specific or policy documents.

## Workflow

### 1. Initialize & Filter
- **Check for Git**: Detect if `.git` already exists.
- **Configure .gitignore**: Create a robust `.gitignore` that excludes:
    - Sensitive files (env, keys, secrets).
    - Platform-specific files (node_modules, bin, obj, target, .DS_Store).
    - **Excluded Docs**: Add patterns for "policy docs" and "implementation logs" as requested (e.g., `agent/`, `docs/implementation/`, `*_policy.md`, `plan.md`).

### 2. Premium README Generation
- Create a `README.md` that includes:
    - Project Title & High-level description.
    - Tech Stack.
    - Installation & Setup instructions.
    - Usage examples.
    - **Note**: Ensure it focuses on the software, not the agent's work logs.

### 3. Smart Commits
- Use atomic commits (one feature/fix per commit).
- Use conventional commit messages: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`.
- **Trigger**: Commit whenever a verification step passes or a unit of work is complete.

### 4. Remote Connectivity
- Set up the remote origin: `git remote add origin <url>`.
- Push to the main branch: `git push -u origin main`.

## Instructions

### Secure Initial Setup
If no git repository exists:
```bash
git init
```

### Filtering Non-Essential Docs
Create or append to `.gitignore` to ensure only the codebase and core docs are tracked.
```ignore
# Agent & Policy Docs (Filtered per user request)
agent/
.agents/
*_policy.md
plan.md
todo.md
scratchpad.md
implementation.md
*.log
.DS_Store
# Environment & Secrets
.env*
*.secrets
*.pem
```

### README Template
Always generate a `README.md` that wows. Use this structure:
```markdown
# [Project Name]

[Short, impactful summary of what this project does]

## 🚀 Features
- Feature 1...
- Feature 2...

## 🛠️ Tech Stack
- [Language/Framework]
- [Database/Tools]

## 📦 Installation
1. Clone the repo...
2. Install dependencies...

## 📖 Usage
[Basic command or example setup]
```

### Committing Changes
Check status and commit with clarity:
1. `git status` to verify what is being staged.
2. `git add .` (knowing `.gitignore` handles the filtering).
3. `git commit -m "[type]: [brief summary]"`

## Red Flags
- **DO NOT** commit `.env` files or hardcoded API keys.
- **DO NOT** commit large binary files without LFS.
- **DO NOT** commit large logs or temp files.
- **ALWAYS** check `git status` before committing to ensure the "filter" is working as expected.
