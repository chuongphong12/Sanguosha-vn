# Agent Instructions

This project uses a specialized set of agent skills to ensure high code quality, maintainability, and correctness. Whenever you receive a prompt to write, review, or modify code, you MUST follow these guidelines.

## Default Skill Set

### 1. Karpathy Guidelines (`.agents/skills/karpathy-guidelines`)
- **Think Before Coding**: Don't assume. Surface tradeoffs. State assumptions explicitly.
- **Simplicity First**: Write the minimum code that solves the problem. No speculative features.
- **Surgical Changes**: Touch only what you must. Clean up only your own mess. Do not reformat or clean up unrelated code.
- **Goal-Driven Execution**: Define verifiable success criteria and loop until verified.

### 2. Brainstorming (`.agents/skills/brainstorming`)
- Before implementing non-trivial features, explore user intent and propose 2-3 approaches.
- Wait for user approval before writing code.
- Do NOT skip this step if the architecture or design is ambiguous.

### 3. Test-Driven Development (`.agents/skills/tdd`)
- Prefer writing tests *before* writing the implementation (Red-Green-Refactor).
- Ensure existing tests pass before and after your changes.

### 4. Implementation (`.agents/skills/implement`)
- Execute the work based on the agreed spec or tickets.
- Run typechecking (e.g., `npm run check`) regularly to verify correctness.

### 5. Code Review (`.agents/skills/code-review`)
- Once the code is written, review the changes against two axes: Standards (including Fowler's code smells like Feature Envy, Duplicated Code, Magic Strings) and the Original Spec.
- Fix any code smells and refactor before declaring the task done.

### 6. Diagnosing Bugs (`.agents/skills/diagnosing-bugs`)
- When faced with a bug, use a structured diagnosis loop: reproduce, isolate, and verify. Do not guess blindly.

## Execution Workflow

1. **Plan & Align**: Use `brainstorming` for new features or `diagnosing-bugs` for issues.
2. **Execute Cautiously**: Follow `karpathy-guidelines`, write tests (`tdd`), and `implement` surgical changes.
3. **Verify & Review**: Run tests/typechecks and perform a `code-review` on your own diff.

Failure to follow these steps violates the project's quality standards. Always prioritize simplicity, isolation of changes, and verifiable success criteria.
