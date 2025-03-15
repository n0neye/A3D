# AI Scene Builder - Design & Architecture

## Core Architecture

This project implements a 3D scene editor built on Babylon.js with a custom entity system and mode-based interaction pattern.

### Entity System

The core of our architecture is the EntityNode class, which extends Babylon's TransformNode:

```typescript
export class EntityNode extends BABYLON.TransformNode {
  public metadata: EntityMetadata;
  private _primaryMesh: BABYLON.AbstractMesh | null = null;
  
  // Methods for managing entity state and behavior...
}
```

This provides:
- Strong typing with TypeScript
- Clear ownership of meshes (primary mesh pattern)
- Structured metadata storage
- AI generation history tracking
- Helper methods for entity operations

### Mode-Based Editing
The editor uses a mode pattern for different interaction contexts:
```typescript
export interface EditorMode {
  id: string;
  name: string;
  
  // Lifecycle methods
  onEnter(scene: BABYLON.Scene, previousModeId: string): void;
  onExit(scene: BABYLON.Scene, nextModeId: string): void;
  
  // Input handlers
  handleSceneClick(pickInfo: BABYLON.PickingInfo, scene: BABYLON.Scene): boolean;
  handleEntitySelected(node: BABYLON.Node, scene: BABYLON.Scene): void;
  // ...
}
```

Modes include:
- Default Mode: Navigation and selection
- Entity Mode: Manipulating selected entities (position, rotation, scale)

The EditorModeManager handles transitions between modes and routes input events.

### Selection & Manipulation

Objects are selected through:
1. Scene raycast picking
2. Entity resolution (mesh → entity)
3. Gizmo attachment for manipulation

### AI Generation Integration
The system integrates AI image and 3D model generation:
- Entities store generation history
- Support for text-to-image → image-to-3D pipeline
- Versioning and preview of generated assets

## Design Philosophy
- Strong Type Safety: Custom entity classes with TypeScript over loose metadata
- Single Responsibility: Each component has a clear, focused purpose
- Extensibility: Mode system allows adding new interaction paradigms
- Clean Boundaries: Clear separation between Babylon.js primitives and application logic

## Key Components
- SceneViewer: Main 3D viewport
- EntityPanel: Context-sensitive editing tools
- ModeManager: Handles editing state and transitions
- EntityManager: Creates and manages scene entities

This architecture provides a flexible, maintainable foundation for building complex 3D editing experiences with AI-generated content.
