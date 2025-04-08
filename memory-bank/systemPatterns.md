# System Patterns: 3D AI Scene Editor

## System Architecture

The 3D AI Scene Editor follows a decoupled architecture that cleanly separates the 3D engine from the React UI layer:

```
Application
├── Engine Layer
│   ├── EditorEngine (Singleton)
│   │   ├── ThreeCore: The core of the 3D engine, including creation of the scene, manage render loop
│   │   ├── Entity
│   │   │   ├── EntityFactory: Manages the creation of entities, including the creation of 3D models, textures, and other assets.
│   │   │   ├── Interfaces
│   │   │   │   ├── ISelectable: Defines the selection and transform behavior for selectable objects.
│   │   │   │   ├── IGenerationLog: Represents one generation step of a GenerativeEntity, which can be an image or a 3D model. Logs can be derived from another log (eg. image to 3D model), and logs in the same generativeEntity can be applied any time to be displayed.
│   │   │   │   └── IRenderLog: Represents one final AI-rendered image. A project can have multiple render logs, and each render log can have multiple generation logs. Render logs can be displayed in the GalleryPanel, and can be saved in a project file.
│   │   │   ├── Base
│   │   │   │   └── EntityBase: The base class for all entities, which are the main objects in the scene. Implements ISelectable.
│   │   │   ├── Types: Sub-classes of EntityBase
│   │   │   │   ├── GenerativeEntity: The fundamental entity that contains 2D and 3D objects. Users generate 2D images, and later convert them into 3D models. 
│   │   │   │   ├── ShapeEntity: Extends EntityBase and represents basic 3D shapes like cubes, spheres, and cylinders.
│   │   │   │   ├── LightEntity: Extends EntityBase and represents lights in the scene.
│   │   │   │   ├── CharacterEntity: Extends EntityBase and represents a rigged skin-meshed 3D model.
│   │   │   └── Components: Other implementations of ISelectable, can be added to the entity
│   │   │       └── BoneControl: Extends ISelectable and represents the control points for bones of a CharacterEntity.
│   │   ├── Managers
│   │   │   ├── CameraManager: Manages camera movement(via orbit controls) and settings(FOV, near/far plane, etc.), and also "Ratio Overlay" which indicates the 2D overlay that displays the aspect ratio of the final render.
│   │   │   ├── SelectionManager: Manages the selection of entities, and the state of the selection.
│   │   │   ├── TransformControlManager: Manages the transform controls handles.
│   │   │   ├── HistoryManager: Manages the history of the actions taken in the scene, allowing for undo/redo.
│   │   │   ├── InputManager: Manages the input from the browser, such as mouse, keyboard, and touch events.
│   │   │   ├── ProjectManager: Manages the project files, including save and open project files, and serializing and deserializing the project state.
│   │   │   └── EnvironmentManager: Manages the environment of the scene, including the skybox, fog, and other environmental settings.
│   │   └── Services
│   │       └──  RenderService: Manages the rendering of the scene, including the renderer, the scene, and the camera.
│   └── Utils
│       ├── Observer (Type-safe event system)
│       └── Other utilities
│
└── UI Layer (React)
    ├── EditorEngineContext (Bridge to Engine)
    └── Components
        ├── EditorUIContainer: A container that holds the UI components.
        ├── AddPanel: A panel that allows user to add new entities to the scene.
        ├── CameraPanel: Camera settings, Ratio Overlay, etc.
        ├── RenderPanel: A panel that allow user to configure the render settings (Prompts, Lora models, render models, etc.), execute the render, and display the final rendered image.
        ├── EntityPanel: A panel that displays the properties of selected entities. Will load different panels (like GenerativeEntityPanel, LightEntityPanel, etc) depending on the type of entity.
        ├── GalleryPanel: A panel that displays a gallery of final rendered images.
        └── Other UI components
```

## Key Design Patterns

### Singleton Pattern
- **EditorEngine**: Central singleton that coordinates all engine functionality
- **Ensures**: Single source of truth and consistent state management
- **API**: Provides a clean interface for React components

### Observer Pattern
- **Implementation**: Type-safe event system for communication
- **Purpose**: Decouples components and enables reliable communication
- **Usage**: Used throughout the system for notifications and state updates

### Factory Pattern
- **EntityFactory**: Creates different types of 3D entities
- **Standardizes**: Creation process with consistent interfaces
- **Supports**: Various entity types with specialized behaviors

### Command Pattern
- **Implementation**: Operations are wrapped in command objects
- **Benefits**: Enables history (undo/redo) support
- **Examples**: Creating entities, transforming objects, deleting items

### Bridge Pattern
- **EditorEngineContext**: Acts as a bridge between React and the engine
- **Purpose**: Isolates UI from engine implementation details
- **Provides**: Simplified access to engine functionality from React components

## Communication Flows

1. **UI to Engine**:
   - React components access engine through EditorEngineContext
   - Commands are dispatched to the engine via public API methods
   - Input events are captured and forwarded to InputManager

2. **Engine to UI**:
   - Engine publishes events through the Observer system
   - UI components subscribe to relevant events
   - State updates trigger React rerenders when needed

3. **Inter-Manager Communication**:
   - Managers communicate via the Observer system
   - Direct method calls for simple operations
   - Commands for operations that need history support

## Entity Management

Entities follow a consistent lifecycle:
1. **Creation**: Through factory with appropriate parameters
2. **Management**: Through SelectionManager and TransformControlManager
3. **Manipulation**: Via commands that support undo/redo
4. **Persistence**: Through ProjectManager for saving/loading
5. **Deletion**: Via delete commands with history support

## Input Handling

Centralized in InputManager which:
1. Captures raw browser events
2. Determines context (camera movement, object selection, etc.)
3. Delegates to appropriate managers based on context
4. Implements keyboard shortcuts and command triggers 