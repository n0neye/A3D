
## Development

The project uses:
- Electron as desktop app framework
- Next.js for the frontend
- Three.js for 3D rendering
- TailwindCSS, Shadcn/UI for styling
- Various AI services for content generation


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
│       ├── Observer 
│       └── Other utilities
│
└── UI Layer (React)
    ├── EditorEngineContext (Bridge between Engine and UI)
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

The RenderService handles final AI rendering operations:

- Taking screenshots with proper framing
- Processing depth maps
- Managing gizmo visibility during renders
- Image processing for API operations


## Extending the Engine

To add new functionality:

1. Create a new manager or service in the appropriate directory
2. Register it with the EditorEngine singleton
3. Expose a clean API through EditorEngine
4. Subscribe to events using the Observer pattern
5. Update the UI components to use the new functionality

This architecture ensures clean separation of concerns and makes the codebase more maintainable.

