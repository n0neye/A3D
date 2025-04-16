# 3D AI Scene Editor

This project is a browser-based 3D scene editor that leverages AI for content generation. It allows users to create, manipulate and render 3D scenes using Three.js with AI-assisted generation capabilities.

## System Architecture

The application follows a decoupled architecture that separates the 3D engine from the React UI layer:

```
Application
├── Engine Layer
│   ├── EditorEngine (Singleton)
│   │   ├── ThreeCore
│   │   ├── Managers
│   │   │   ├── CameraManager
│   │   │   ├── SelectionManager
│   │   │   ├── TransformControlManager
│   │   │   ├── HistoryManager
│   │   │   ├── InputManager
│   │   │   ├── ProjectManager
│   │   │   └── EnvironmentManager
│   │   └── Services
│   │       ├── RenderService
│   │       └── EntityFactory
│   └── Utils
│       ├── Observer (Type-safe event system)
│       └── Other utilities
│
└── UI Layer (React)
    ├── EditorEngineContext (Bridge to Engine)
    └── Components
        ├── EditorUIContainer
        ├── FramePanel
        ├── RenderPanel
        ├── EntityPanel
        └── Other UI components
```

### Key Architectural Components

- **EditorEngine**: The central singleton that coordinates all engine functionality and provides a clean API for React components
- **ThreeCore**: Low-level wrapper around Three.js engine and scene, handling initialization and rendering
- **Managers**: Specialized classes that handle specific aspects of the editor (camera, selection, history, etc.)
- **Services**: Higher-level operations that involve multiple managers or external systems
- **Observer Pattern**: Type-safe event system that enables communication between components without tight coupling

## Communication Patterns

We've moved from a direct reference model to a more loosely coupled event-based architecture:

1. **Type-Safe Observer Pattern**: All communication between managers and with the UI uses a strongly-typed Observer system
2. **Context as Bridge**: EditorEngineContext serves as the bridge between React components and the engine layer
3. **Direct API Calls**: Simple operations use direct method calls on the EditorEngine singleton

```typescript
// Example of UI component interaction with the engine
const { engine } = useEditorEngine();
const handleCreateEntity = () => {
  engine.createEntityDefaultCommand('generative');
};
```

## Entity System

Entities are managed through the EditorEngine, with operations going through the proper managers:

```typescript
// Creation through commands (with history support)
engine.createEntityCommand({
  type: 'generative',
  position: new THREE.Vector3(0, 1, 0)
});

// Selection
engine.selectEntity(entity);

// Deletion (with history support)
engine.deleteEntity(entity);
```

Each entity maintains its own generation history and metadata, accessible through a standardized API.

## Input Handling

All user input is managed by the InputManager, which:

1. Captures pointer events (clicks, drags, wheel)
2. Maintains keyboard state
3. Implements command shortcuts
4. Delegates to appropriate managers based on context

This centralizes input logic and removes it from UI components.

## Rendering Pipeline

The RenderService handles all rendering operations:

- Taking screenshots with proper framing
- Processing depth maps
- Managing gizmo visibility during renders
- Image processing for API operations

## Getting Started

1. Install dependencies: `npm install`
2. Run the development server: `npm run dev`
3. Open your browser to `http://localhost:3030`

## Usage

- Click "Add" buttons to create new entities
- Click on entities to select them
- Use gizmos to move, rotate, and scale entities (keyboard shortcuts: W, E, R, T)
- Delete selected entities with the Delete key
- Duplicate selected entities with Ctrl+D
- Undo/Redo with Ctrl+Z and Ctrl+Shift+Z
- Use the Render panel to take screenshots and generate AI variations

## Development

The project uses:
- Next.js for the React framework
- Three.js for 3D rendering
- TailwindCSS for styling
- Various AI services for content generation

## Extending the Engine

To add new functionality:

1. Create a new manager or service in the appropriate directory
2. Register it with the EditorEngine singleton
3. Expose a clean API through EditorEngine
4. Subscribe to events using the Observer pattern
5. Update the UI components to use the new functionality

This architecture ensures clean separation of concerns and makes the codebase more maintainable.
