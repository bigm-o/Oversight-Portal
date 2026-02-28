---
name: resolving-issues
description: A rigorous, iterative process for diagnosing, fixing, and verifying bugs or implementing enhancements. Use when debugging errors, fixing issues, or handling complex logic changes without hallucinating.
---

# Resolving Issues

## When to use this skill
- User reports a bug, error, or unexpected behavior.
- Agent needs to fix a specific issue in the codebase.
- User requests an enhancement that requires careful implementation.
- Agent is unsure about the root cause of a problem.

## The Iron Rule: No Guessing
**NEVER assume usage, imports, or logic.**
- Verify every file path exists before editing.
- Read every file before modifying it.
- Run code to confirm behavior, do not just "think" it works.

## Workflow

### Phase 1: reproduce (The "Red" State)
**Goal:** Create a reproduction case that fails.
1.  **Isolate**: Create a specialized test case or script (`repro.sh`, `test_bug.py`) that demonstrates the issue.
2.  **Verify Failure**: Run the reproduction script. **It MUST fail.** If it passes, you haven't reproduced the issue.
3.  **Log Expected vs Actual**: Explicitly state what should happen vs what actually happened.

### Phase 2: Locate (The Investigation)
**Goal:** Find the *exact* line of code causing the issue.
1.  **Trace**: Use `grep` or `find` to locate relevant code.
2.  **Instrument**: Add temporary `print` statements or logging to trace execution flow and variable values.
3.  **Binary Search**: If the issue is complex, comment out halves of the code to isolate the problematic section.
4.  **Read**: Carefully read the code around the error. **Do not skim.**

### Phase 3: Understand (The Root Cause)
**Goal:** Explain *why* it fails based on evidence.
1.  **Hypothesize**: "I think X is null because Y wasn't called."
2.  **Verify Hypothesis**: Add a log to prove X is null.
3.  **No Magic**: Computers are deterministic. If it fails, there is a reason. Find it.

### Phase 4: Fix (The "Green" State)
**Goal:** Implement the fix and verify it works.
1.  **Plan**: Propose the change.
2.  **Edit**: Apply the fix used `sed` or file editing tools.
3.  **Verify Fix**: Run the reproduction script from Phase 1. **It MUST pass.**
4.  **Regression Check**: Run related tests to ensure no new bugs were introduced.

### Phase 5: Cleanup
**Goal:** Leave the codebase cleaner than you found it.
1.  **Remove Instrumentation**: Delete all temporary `print` statements and logs.
2.  **Delete Repro Scripts**: Remove `repro.sh` or temporary test files (unless they should become permanent tests).
3.  **Commit**: (If user approves) Commit the fix with a clear message explaining the root cause.

## Safety Checks (Anti-Hallucination)
-   **If you get an error**: STOP. Read the error message. Do not blindly try again.
-   **If a file is missing**: Check the path. use `find` to locate it.
-   **If an import fails**: Check the file exports.
-   **If you are stuck**: detailed logs. Add *more* logging.
-   **Do not "force" a fix**: If the test passes but the logic seems wrong, you are masking the bug, not fixing it.

## Loop Until Solved
If the verification in Phase 4 fails:
1.  **Undo**: Revert the failed fix.
2.  **Loop**: Go back to Phase 2 (Locate) with the new information.
3.  **Deepen**: Look deeper. Check callers, check config, check libraries. **Do not give up.**
