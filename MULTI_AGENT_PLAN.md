# MULTI-AGENT ARCHITECTURE IMPLEMENTATION PLAN

This document outlines the migration from a single monolithic evaluation service to a sophisticated Multi-Agent Orchestration system.

## 1. AGENT ROLES & HIERARCHY

### A. COORDINATOR AGENT (The Orchestrator)
- **Responsibility**: Subject detection, Task routing, Final result synthesis.
- **Goal**: Ensure consistency and manage the end-to-end evaluation lifecycle.

### B. VISION EXPERT AGENT
- **Responsibility**: High-fidelity transcription of handwriting and diagrams.
- **Task**: Multi-pass vision analysis to extract raw semantic data.

### C. SUBJECT-SPECIFIC AGENTS (Expert Workers)
- **Mathematics**: Step-by-step logic, calculation verification, formula accuracy.
- **Science**: Conceptual depth, terminology, diagram-context matching.
- **Humanities/Languages**: Creative expression, grammar, and narrative flow.

### D. REVIEWER AGENT (The Follow-up)
- **Responsibility**: Cross-verification of assigned marks against the rubric.
- **Goal**: Eliminate AI bias and ensure the Expert Agent followed the 'Coordinator' instructions.

---

## 2. PROJECT RESTRUCTURING

### New Directory Structure:
- `src/lib/agents/`: Central repository for agent prompts and configurations.
- `src/lib/agents/prompts/`: Specific subject-wise system prompts.
- `src/lib/orchestrator/`: Logic for handling the handshakes between agents.

### Refactoring Strategy:
1. **Initialize Agents**: Create base classes for agents to handle AI provider logic.
2. **Setup Prompt Templates**: Design specialized system messages for each subject.
3. **Build Orchestrator**: Implement the `EvaluationDispatcher` to manage the sequential/parallel agent calls.
4. **API Integration**: Update `/api/evaluate/route.ts` to trigger the Orchestrator instead of the base service.

---

## 3. KEY FEATURES
- **Hierarchical Routing**: Automatic detection of subject to trigger the right expert.
- **Verification Loop**: Coordinator-Review pass to ensure 99% grading accuracy.
- **Real-time Agent Status**: UI updates showing exactly which agent is working (e.g., "Math Expert is analyzing logical steps...").

---

## 4. NEXT IMMEDIATE STEPS
- [ ] Create `src/lib/agents/` directory.
- [ ] Implement initial Coordinator Agent prompt logic.
- [ ] Refactor `evaluation-service.ts` to support multi-model routing.
