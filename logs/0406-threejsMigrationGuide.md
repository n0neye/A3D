# Three.js Migration Guide

## Overview

This document outlines the process, strategies, and key considerations for migrating our 3D editor from Babylon.js to Three.js. The migration maintains the existing architecture while replacing the underlying 3D rendering engine.

## Migration Strategy

### 1. Core Infrastructure First

We've adopted a component-by-component migration approach, starting with the core infrastructure:

- `ThreeCore` replaces `BabylonCore` as the foundation
- File-by-file migration while maintaining interfaces
- Entities and managers adapted one at a time
- Migration of utilities (materials, shapes, lights)

### 2. Maintaining Architecture

Our existing decoupled architecture has been preserved:
- React components remain unchanged
- EditorEngine facade pattern maintained
- Interface-based communication between subsystems
- Command pattern for operations

## Key Differences Between Babylon.js and Three.js

### Concepts

| Babylon.js | Three.js | Migration Notes |
|------------|----------|----------------|
| `TransformNode` | `Object3D` | Base class for all 3D objects |
| `Scene.add()` implicit via constructor | `scene.add()` explicit | Need to explicitly add objects to scene |
| `metadata` property | `userData` property | Three.js uses userData for custom data |
| `setEnabled()` | `visible = true/false` | Visibility control differs |
| `ShadowGenerator` | Light's `shadow` property | Three.js integrates shadows with lights |
| `Animation` system | Custom animation (RAF) | Animation system is quite different |

### Coordinate System

Three.js uses a right-handed coordinate system by default (Y-up), which differs from Babylon.js's left-handed system.

### Parent-Child Relationships

```javascript
// Babylon.js
mesh.parent = parentNode;

// Three.js
parentNode.add(mesh);
```

### Resource Disposal

```javascript
// Babylon.js
mesh.dispose();

// Three.js
// Remove from parent
mesh.parent.remove(mesh);
// Then dispose resources
mesh.geometry.dispose();
mesh.material.dispose();
```

## Component Migration Details

### Core Components

#### 1. ThreeCore

```typescript
/**
 * Core low-level wrapper around the Three.js renderer and scene
 */
export class ThreeCore {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private canvas: HTMLCanvasElement;
  private clock: THREE.Clock;
  
  constructor(canvas: HTMLCanvasElement) {
    // Initialize renderer, scene, and events
  }
}
```

#### 2. EntityBase

```typescript
/**
 * Base class for all entities in the scene
 */
export class EntityBase extends THREE.Object3D implements ISelectable {
  // Core properties
  uuid: string;
  entityType: EntityType;
  created: Date;
  
  // Core methods
  serialize(): SerializedEntityData { ... }
  dispose(): void { ... }
}
```

### Entity Types

1. **ShapeEntity**: Creates primitive shapes with materials
2. **LightEntity**: Handles lighting with shadow capabilities
3. **GenerativeEntity**: Manages AI-generated content
4. **CharacterEntity**: Handles animated characters and models

### Manager Classes

Each manager required updates to work with Three.js:

1. **CameraManager**: Now uses OrbitControls
2. **SelectionManager**: Updated raycasting for Three.js
3. **GizmoModeManager**: Uses TransformControls instead of Babylon gizmos
4. **EnvironmentManager**: Grid and skybox implementation for Three.js

## Migration Challenges and Solutions

### 1. Material System

**Challenge**: Babylon.js materials (especially TriPlanarMaterial) don't have direct equivalents.

**Solution**: 
- Created custom material utilities
- Used Three.js MeshStandardMaterial with appropriate properties
- Implemented texture loading and mapping patterns

### 2. Shadow System

**Challenge**: Babylon.js has a separate ShadowGenerator while Three.js integrates with lights.

**Solution**:
- Configured shadows directly on light objects
- Created helper utilities for shadow setup
- Implemented mesh shadow configuration

### 3. Event System

**Challenge**: Different event systems between libraries.

**Solution**:
- Created abstraction layer for input events
- Updated raycasting for object selection

### 4. Animation System

**Challenge**: Different animation approaches.

**Solution**:
- Created custom animation utilities
- Used requestAnimationFrame for simple animations
- Adapted to Three.js's animation system for complex cases

## Testing and Validation

Each migrated component should be tested for:

1. Visual appearance matching original
2. Functionality matching original behavior
3. Performance benchmarks
4. Edge case handling

## Future Considerations

1. **ShaderMaterial**: Implement custom shaders for effects like Fresnel
2. **Performance Optimization**: Implement instancing for repeated objects
3. **Advanced Features**: Implement post-processing effects
4. **React Three Fiber**: Consider integrating with React Three Fiber for better React integration

## Migration Progress

- [x] Core infrastructure (EditorEngine, ThreeCore)
- [x] Basic entity system
- [x] Shape entities and utilities
- [x] Material system
- [x] Light entities and shadow system
- [ ] Camera and control system
- [ ] Selection and gizmo system
- [ ] Advanced entities (Generative, Character)
- [ ] UI integration and polish 