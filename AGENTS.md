# Roadmap Compliance Rules
OpenCode uses a **skill-driven execution model** powered by the `skill` tool and this repository's `/skills` directory.
- You should always strive to follow the plan from [roadmap.md](roadmap.md).
- Before starting to think about your answer, understand which step you need to complete next.
- If the user's request contradicts the plan, fulfill the request anyway.
- If the user's request is not related to the current project, fulfill the request.
- At the end of each task edit [roadmap.md](roadmap.md) to check off the completed steps.
- If the user disrupts the order of steps, still edit [roadmap.md](roadmap.md) to check off the completed steps.
- At the end of each response, write to the user which steps have been completed, in the format "[X] Step name". Use wording from [roadmap.md](roadmap.md).
- Implement only those items in the [roadmap.md](roadmap.md) that you are explicitly asked to do. Example: when creating authorization, you have the right to deviate a bit from the prompt and create functionality that provides security and convenience. But you are not allowed to go ahead of the roadmap and create, for example, user profile settings
- Reason and answer in Russian
- If you edited [roadmap.md](roadmap.md), write in the chat "🔄Roadmap has been updated"

# Extended Engineering Workflow
Always apply the workflow from agent-skills (DEFINE → PLAN → BUILD → VERIFY → REVIEW → SHIP) when relevant. Skills are loaded from `skills/` and must be used when applicable.

# Extended instructions
Additional engineering discipline rules are defined in `skills/` and `.opencode/`.
Always apply the complete workflow from agent-skills (define → plan → build → verify → review → ship) unless overridden by a user request.