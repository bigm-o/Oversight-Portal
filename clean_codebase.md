---
name: cleaning-codebase
description: Identifies and deletes temporary files and agent artifacts (e.g., SQL dumps, logs, progress tracking MDs). Use when the user asks to clean up the project or remove agent debris.
---

# Cleaning Codebase

## When to use this skill
- User asks to "clean up" the project.
- User wants to remove temporary files created during development.
- User mentions removing "agent debris", "progress files", or "temporary tests".

## Workflow
1.  **Scan**: Identify potential temporary files using strict patterns.
2.  **Report**: Present the list of files to the user for confirmation.
3.  **Clean**: Delete the verified files.

## Instructions

### 1. Scan for Artifacts

Run the following command to identify potential temporary files. This includes SQL dumps, logs, temporary scripts, and agent progress files.

**Note:** This command EXCLUDES `node_modules`, `.git`, and `venv`.

```bash
find . -type f \
    \( \
       -name "*.sql" \
       -o -name "*.log" \
       -o -name "*.dump" \
       -o -name "*.tmp" \
       -o -name "temp_*" \
       -o -name "*_progress.md" \
       -o -name "plan.md" \
       -o -name "todo.md" \
       -o -name "scratchpad.md" \
       -o -name "current_task.md" \
    \) \
    -not -path "*/node_modules/*" \
    -not -path "*/.git/*" \
    -not -path "*/venv/*" \
    -not -path "*/dist/*" \
    -not -path "*/build/*" \
    -print
```

### 2. Verify with User

**CRITICAL STEP**: Do NOT delete files automatically.
1.  **List**: Show the output of the scan to the user.
2.  **Ask**: "I've identified the following files that appear to be temporary or agent artifacts. specific testing files or SQL dumps might be important. Which of these should I delete?"

### 3. Remove Files

**Option A: Delete specific files (Safer)**
If the user indicates specific files, use `rm`:
```bash
rm path/to/file1 path/to/file2
```

**Option B: Delete ALL found files (Only if explicitly confirmed)**
If the user says "delete all of them", use the delete flag:
```bash
find . -type f \
    \( \
       -name "*.sql" \
       -o -name "*.log" \
       -o -name "*.dump" \
       -o -name "*.tmp" \
       -o -name "temp_*" \
       -o -name "*_progress.md" \
       -o -name "plan.md" \
       -o -name "todo.md" \
       -o -name "scratchpad.md" \
       -o -name "current_task.md" \
    \) \
    -not -path "*/node_modules/*" \
    -not -path "*/.git/*" \
    -not -path "*/venv/*" \
    -not -path "*/dist/*" \
    -not -path "*/build/*" \
    -delete
```

## Common Artifacts to Watch For
- **SQL/DB**: `*.sql`, `*.sqlite`, `*.db` (Check if these are production data or dumps!)
- **Logs**: `*.log`, `npm-debug.log`
- **Agent Tracking**: `plan.md`, `todo.md`, `scratchpad.md`, `step_*.md`
- **Temp Code**: `temp_script.py`, `check_*.js`
