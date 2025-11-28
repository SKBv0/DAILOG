# DAILOG – Complete Guide

This guide explains how to use DAILOG and how to contribute or extend it.


## Table of Contents

- [Getting Started](#getting-started)
- [User Guide](#user-guide)
  - [View Modes](#view-modes)
  - [Node Types](#node-types)
  - [Tagging System](#tagging-system)
  - [AI Generation](#ai-generation)
  - [Flow Generator](#flow-generator)
  - [Subgraphs](#subgraphs)
- [Developer Guide](#developer-guide)
  - [Core Systems](#core-systems)
  - [Adding Features](#adding-features)
- [Troubleshooting](#troubleshooting)

---
<img width="1290" height="1201" alt="image" src="

## Getting Started
## Screenshots
https://github.com/user-attachments/assets/3d624d49-fd88-404b-a0bf-f04e7c5219fb
| Flow Generator | Settings | Tag Manager | Node Details (AI Controls) |
|----------------|----------|-------------|----------------------------|
| <img width="200" alt="Flow Generator" src="https://github.com/user-attachments/assets/3d624d49-fd88-404b-a0bf-f04e7c5219fb" /> | <img width="200" alt="Settings" src="https://github.com/user-attachments/assets/eac501cd-9f7e-4a56-bccd-dbed694df96a" /> | <img width="200" alt="Tag Manager" src="https://github.com/user-attachments/assets/19e9d452-1e23-4981-9325-f07b50a76050" /> | <img width="200" alt="Node Details" src="https://github.com/user-attachments/assets/73788e27-bab6-499d-900c-1046599f8333" /> |
### Installation

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Configure Ollama (for AI features):**
   - Install [Ollama](https://ollama.ai/)
   - Pull a model: `ollama pull "model name"`
   - Default endpoint: `http://localhost:11434`

3. **Start development server:**

   ```bash
   npm run dev
   ```

4. **Open browser:** Navigate to `http://localhost:5173`

### Log Control

See [Debug Mode](#debug-mode) for log level configuration.

---

## User Guide

### View Modes

DAILOG provides three view modes:

#### Flow Mode (Default)

Visual editing workspace for creating dialog structures. Supports three project types: **Game** (NPC dialogs, player responses, enemy interactions), **Interactive Story** (narrative nodes, choice points, branching logic), and **Novel/Script** (character dialogues, scene descriptions).

**Core Editing Features:**
- Drag-and-drop node creation and positioning
- Visual connection drawing between nodes
- Multi-selection (Ctrl/Cmd + Click or drag area)
- Alt + Drag to copy nodes while dragging
- Zoom and pan controls (mouse wheel, controls, or keyboard)
- Minimap for navigation
- Search overlay for finding nodes quickly

**AI & Content Generation:**
- AI content generation via Ollama integration
- Context-aware dialog generation using connected nodes
- Per-node AI controls (Recreate, Improve, Custom Prompt, Regenerate From Here)

**Organization & Management:**
- Tag management system for organizing nodes and providing AI context
- Flow generator to automatically create dialog structures from topics
- Subgraph support for nested dialog hierarchies 

**Keyboard Shortcuts:**
- `Delete` - Delete selected nodes
- `Escape` - Cancel connection, close node selector, or deselect all
- `Ctrl/Cmd + A` - Select all nodes (also opens right panel)
- `Ctrl/Cmd + C` - Copy selected nodes and their connections
- `Ctrl/Cmd + V` - Paste copied nodes (creates new nodes with unique IDs, offset by 20px)
- `Alt + Drag` - Copy nodes while dragging (hold Alt key and drag selected nodes to create ghost copies; release Alt to finalize copies with new IDs and connections)
- Hold `Shift` or `Ctrl/Cmd` + Click to multi-select nodes
- Drag area to multi-select nodes


#### Tree Mode

Hierarchical view with analytics and flow analysis.

**Features:**
- Expandable/collapsible node hierarchy
- Filtering:
  - By node type
  - Branch points (nodes with multiple outputs)
  - Merge points (nodes with multiple inputs)
  - Dead ends (nodes with no outputs)
  - Orphan nodes (disconnected)
- Analytics dashboard:
  - Total node count
  - Branch point count
  - Merge point count
  - Dead end count
  - Complexity score
  - Maximum depth
  - Average depth
  - Total paths
- Compact/full view toggle
- Search within tree



#### Read Mode

View for reviewing dialog content.

**Features:**
- Pagination
- Adjustable text sizes (Small, Medium, Large)
- Multiple starting point selection
- Search within content
- Page navigation buttons (Previous/Next)


### Node Types

DAILOG supports different node types across three project types:

**Game Projects:**
- **NPC Dialog** — Standard NPC conversations
- **Player Response** — Player character dialogue
- **Enemy Dialog** — Enemy/antagonist interactions

**Interactive Story Projects:**
- **Narrator Node** — Narrative text and descriptions
- **Choice Node** — Player decision points with branching
- **Branching Node** — Conditional branching logic

**Novel/Script Projects:**
- **Character Dialog Node** — Character-specific dialogue
- **Scene Description Node** — Environment and scene descriptions
- **Scene Node** — General scene management

**Available in All Project Types:**
- **Custom Node** — Customizable with custom AI prompts
- **Subgraph Node** — Nested dialog structures

#### Node Anatomy

All nodes have editable text content, connection points for linking nodes, AI generation controls, and tag indicators.

### Tagging System

Tags help you label nodes so the AI can understand who is speaking, where the scene is, and what tone to use.

#### Tag Categories

**Game Projects:**
- `NPC` — Non-player characters
- `player` — Player character
- `enemy` — Enemy characters
- `quest` — Quest-related content
- `side_quest` — Side quest content
- `item` — Game items
- `location` — Locations and places
- `faction` — Factions and organizations
- `emotion` — Emotional context
- `trait` — Character traits

**Interactive Story Projects:**
- `character` — Story characters
- `choice` — Choice points
- `branch_yes` / `branch_no` — Branch indicators
- `emotional` — Emotional tone
- `comedy` / `suspense` / `drama` — Genre tags
- `chapter` — Chapter markers

**Novel/Script Projects:**
- `dialogue_scene` — Dialog-heavy scenes
- `monologue` — Character monologues
- `action_scene` — Action sequences
- `intro` / `climax` / `conclusion` — Story beats
- `world` — World-building elements

#### Tag Properties

Each tag has:

- **Label:** Display name (unique identifier)
- **Content:** Detailed description and context
- **Importance Level (1-5):**
  - `1-2` — Background context
  - `3` — Standard relevance
  - `4` — Important (marked as `[IMPORTANT]` in AI prompts)
  - `5` — Critical (marked as `[CRITICAL]` in AI prompts)
- **Metadata:** Character voice settings, narrative pacing settings

#### Tag Management

**Global Tag Manager:**
- Access via toolbar "Manage Tags" button
- Create, edit, delete tags
- Set default importance levels
- Organize tags by category

**Node-Specific Tagging:**
- Assign tags via right panel "Tags" section
- Override importance levels per node
- Multiple tags per node
- Tag inheritance in subgraphs

#### Best Practices

1. **Use hierarchical tagging:** Combine general and specific tags (e.g., `character` + specific character name)
2. **Set appropriate importance:** Reserve level 4-5 for critical context
3. **Add detailed content:** The tag content field guides AI generation
4. **Avoid over-tagging:** 3-5 relevant tags per node is optimal
5. **Update regularly:** Keep tag content current with your narrative

### AI Generation

DAILOG uses local LLMs via Ollama for context-aware content generation.

#### How It Works

DAILOG analyzes connected nodes (up to 3 levels back and forward), extracts tags and importance levels, builds context-aware prompts using project-specific system prompts, and sends them to Ollama for generation. High-importance tags (level 4-5) are marked as `[IMPORTANT]` or `[CRITICAL]` in prompts.

#### AI Controls

**Per-Node AI Controls (4 buttons):**

*Note: AI controls are only visible when zoom level is above 0.8 for performance optimization.*

1. **Recreate** (RotateCcw icon): Generate new content using current context
2. **Improve** (Sparkles icon): Enhance existing content while keeping the core message
3. **Custom Prompt** (Brain icon): Open a modal to enter a custom AI generation prompt
4. **Regenerate From Here** (FastForward icon): Regenerate this node and all connected child nodes in the dialog tree

**Additional Controls:**
- **Ignore Connections Toggle:** (Available in right panel) Generate without using connected nodes for context
- **Settings Icon:** (Custom Node only) Configure custom system prompt and generation options

**Global Settings:**
- Configure Ollama endpoint
- Select model from available models (pull models with `ollama pull <model-name>`)
- Adjust generation parameters (temperature, max tokens)
- Customize system prompts for different project types and node types

#### Dialog Quality

**Dialog quality depends on your selected model, system prompts, and tags.**

- **Model:** Different models produce different styles and quality of output. Larger models generally provide better results.
- **System Prompts:** You can manually edit and customize system prompts from the AI Settings panel (Settings button). Adjust prompts to work best with your chosen model.
- **Tags:** Tags and importance levels you assign to nodes directly affect the AI's generation quality.

**Editing System Prompts:**
1. Click the Settings button in the toolbar
2. Edit project-specific prompts (Game, Interactive Story, Novel)
3. Customize advanced prompts (diversity, improvement, fix prompts) from the Advanced section
4. Save your changes

### Flow Generator

Generate dialog structures from topics.

#### Usage

1. **Open Flow Generator:** Click the "Generate Dialog Flow" button in the toolbar (Plus icon)
2. **Configure Structure:**
   - **Topic:** Enter a topic or let AI generate one from your existing tags
   - **NPC Count:** Dialog depth - how many conversation levels (1-5). For example, 3 means: NPC → Player → NPC → Player → NPC
   - **Responses per NPC:** How many player response options per NPC dialog
   - **Primary Node Type:** Usually NPC Dialog (varies by project type)
   - **Secondary Node Type:** Usually Player Response (varies by project type)
3. **Add Global Tags (Optional):** Apply tags that influence AI generation across all nodes
4. **Per-Type Tagging (Optional):** Assign different tags to specific node types for character context
5. **Tertiary Nodes (Optional):** Include additional node types (like Enemy Dialog) at configurable intervals
6. **Generate:** Click "Generate Flow" button to create the entire structure

#### Additional Options

- **Use Tertiary Node:** Enable to include a third node type in the generation pattern
- **Tertiary Frequency:** How often to insert tertiary nodes (e.g., every 3rd node)
- **After Tertiary Node Type:** What node type should follow a tertiary node
- **Sequential Processing:** Process AI generation tasks one at a time (slower but more stable) or in parallel (faster but may overload)


### Subgraphs

Organize complex dialogs into nested structures. Select nodes and create subgraph via toolbar button, name it, enter to build content, use breadcrumb trail to navigate back. Limit nesting to 2-3 levels for maintainability.

---

## Developer Guide

#### Technology Stack

- **React 18:** Component framework with hooks
- **TypeScript 5.5:** Type-safe development
- **React Flow:** Visual node editor canvas
- **Zustand:** State management
- **Tailwind CSS:** Utility-first styling
- **Vite:** Build tool and dev server


### Core Systems

#### 1. Node System

**Node Registry (`src/components/nodes/registry.ts`):** Singleton pattern with automatic registration. Node components register via `registry.registerNode("yourType", YourNodeComponent)`.

**Adding a New Node Type:**
1. Create component in `src/components/nodes/YourNode/index.tsx`
2. Export `nodeConfig` (NodeConfig type) and attach to component
3. Register via `registry.registerNode("yourType", YourNode)`
4. Import in `src/components/nodes/index.ts` to auto-register
5. Add system prompt in `src/config/systemPrompts.ts`

**Example:** Create component in `src/components/nodes/YourNode/index.tsx`, export `nodeConfig`, attach to component, and register via `registry.registerNode("yourType", YourNode)`.

#### 2. State Management

**Zustand Stores:** `historyStore` (undo/redo), `regenerationStore` (regeneration queue), `subgraphNavigationStore` (navigation state), `selectors` (shared selectors). Use stores for global state only, prefer React hooks for local state.

#### 3. AI Integration

**OllamaService (`src/services/ollamaService.ts`):** Main functions: `generateDialog()`, `getCharacterContext()`, `findDialogPaths()`, `cleanGeneratedText()`.

**System Prompts (`src/config/systemPrompts.ts`):** Organized by project type (game, interactive_story, novel) and node type, with general fallbacks.

#### 4. Tagging System

**TagService (`src/services/tagService.ts`):** Functions: `getAllTags()`, `getTagById()`, `addTag()`, `updateTag()`, `deleteTag()`. Additional services: `projectTagService.ts` (project-specific tags), `characterVoiceValidator.ts` (voice consistency), `responseCoherenceChecker.ts` (coherence checking), `importService.ts` (import/export), `edgeBundlingService.ts` (edge bundling).

**Tag Structure:** `label`, `content`, `importance` (1-5), `type`, and optional `metadata` (character voice, narrative pacing).

#### 5. Performance Optimization

**Current Optimizations:**
- Viewport-based rendering
- Zoom-based animation disabling
- AI controls hidden when zoom ≤ 0.8
- Web worker for fuzzy search
- Edge path caching and preloading
- Memoization (React.memo, useMemo, useCallback)
- Debounced auto-save
- Virtual scrolling in large lists
- Edge bundling

**Performance Profiler:** Use `PerformanceProfiler` from `src/utils/performanceProfiler.ts` to measure operation times.

### Adding Features

#### Adding a View Mode

1. Add tab button to `ViewportTabs.tsx`
2. Update mode type in `useLayout.ts` to include new mode
3. Create view component
4. Add conditional render in `EditorContent.tsx`

#### Adding a Keyboard Shortcut

Edit `src/hooks/useKeyboardShortcuts.ts`: Add your shortcut handler inside the `useEffect` with `handleKeyDown` function. Skip if user is typing in input fields.

#### Adding a Worker

1. Create worker file in `src/workers/yourWorker.ts`
2. Initialize with `useMemo` and `new Worker(new URL('@/workers/yourWorker.ts', import.meta.url))`
3. Use `worker.postMessage()` and `worker.onmessage` for communication

---

## Troubleshooting

**AI Generation Not Working:** Check Ollama is running (`ollama list`), verify endpoint in settings, check browser console, ensure model is pulled.

**Performance Issues:** Use subgraphs, close unnecessary panels, clear cache/localStorage, use Chrome/Edge.

**Tag Context Not Applied:** Verify importance level (3-5), add detailed content, check tag assignment, try "Ignore Connections".

**Nodes Disappearing:** Check localStorage quota, disable blocking extensions, use Export for backup, clear localStorage.

### Debug Mode

Enable debug logging by setting the `VITE_LOG_LEVEL` environment variable in a `.env` file:

```bash
# In .env file at project root
VITE_LOG_LEVEL=debug
```

Or use different log levels:
- `error` — Only errors
- `warn` — Errors + warnings
- `info` — Errors + warnings + info
- `debug` — All logs (default in development)
- `trace` — Maximum verbosity

This enables:
- Verbose AI prompt logging
- Performance measurements
- State change logging
- Worker message logging

