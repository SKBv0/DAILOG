# DAILOG – Visual dialog flow editor

Visual dialog flow editor with local AI support.

> **⚠️ Beta** – Core features are complete. Some features may cause errors, and performance optimizations may still need work. This is an experimental and educational project.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61dafb.svg)](https://reactjs.org/)
![Status](https://img.shields.io/badge/status-beta-yellow.svg)

---

## What is DAILOG? 
<img width="50%" height="50%" alt="image" src="https://github.com/user-attachments/assets/b92e5e7c-d3a2-4baa-8c90-b4eaeace1537" />


DAILOG is a node-based editor for creating dialog structures. You can build dialog trees visually, connect nodes, and use local LLMs (via Ollama) to generate content.

Useful for:
- Game dialog systems
- Interactive stories
- Screenplay dialog

## Features

- Visual node editor with drag-and-drop
- Local AI generation via Ollama
- Three view modes: Flow (editing), Tree, Read
- Tag system for organizing nodes and guiding AI
- Subgraphs for nested dialog structures
- Flow generator to create dialog trees from topics
- Project types: Game, Interactive Story, Novel/Script
- JSON import/export
- Auto-save to localStorage

## Quick Start

### Requirements
- Node.js 18+ with npm
- [Ollama](https://ollama.ai/) running locally to unlock AI features

### Setup

```bash
npm install
npm run dev
```

Visit `http://localhost:5173` to open the editor.

### First Steps
1. Select a project type (Game / Interactive Story / Novel)
2. Open Settings (gear icon) and select an Ollama model if you want to use AI features
3. Add nodes from the left panel and connect them, or use Flow Generator to create structures automatically
4. Tag nodes to provide context for AI generation
5. Use AI buttons on nodes (or right panel) to generate content (requires Ollama running)


See [GUIDE.md](docs/GUIDE.md) for detailed documentation.


## Development Commands

```bash
npm run dev       # start dev server
npm run build     # build production bundle
npm test         # run tests
npm run lint      # run linter
npm run preview   # preview production build
```

## Limitations

- Performance may degrade with very large graphs
- AI output quality depends on your model, system prompts, and tags
- Requires Ollama running locally for AI features

**Note:** Dialog quality depends on your selected model, system prompts, and tags. You can manually customize system prompts in Settings to optimize them for your chosen model.

## License

MIT License

## Documentation

- [GUIDE.md](docs/GUIDE.md) - Complete user and developer guide
