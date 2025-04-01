# 3D AI Scene Editor

This project is a browser-based 3D scene editor that leverages AI for content generation. It allows users to create, manipulate and render 3D scenes using Babylon.js with AI-assisted generation capabilities.

## System Architecture

The application follows a simplified architecture centered around React components and context-based state management:

```
App
├── EditorProvider (Context)
└── EditorContainer
    ├── Canvas (Babylon.js)
    ├── GenerationMenu
    ├── EntityPanel
    └── RenderPanel
```

### Key Components

- **EditorContainer**: The main container that initializes the Babylon.js scene and handles core interactions
- **GenerationMenu**: Creates AI-generated entities based on user input
- **EntityPanel**: Displays and manages properties of the selected entity
- **RenderPanel**: Handles scene rendering and image export functions

## State Management

We use React Context (`EditorContext`) as the central state management solution. This context provides:

- Scene and engine references
- Selected entity state
- Gizmo manager for 3D manipulations
- Entity selection utilities

The context is accessible throughout the application using the `useEditorContext` hook.

## Entity System

The core of the application revolves around `EntityBase` objects, which are extensions of Babylon.js `TransformNode` with additional metadata and capabilities:

```typescript
// Basic entity structure
interface EntityBase extends BABYLON.TransformNode {
  metadata: EntityMetadata;
  primaryMesh: BABYLON.AbstractMesh;
  
  // Methods
  getCurrentGeneration(): GenerationData;
  getEntityType(): EntityType;
  getProcessingState(): EntityProcessingState;
  setProcessingState(state: EntityProcessingState): void;
  // ...
}
```

Entities can be created, manipulated, and deleted through the UI. Each entity maintains its own generation history and metadata.

## Interaction Flow

1. **Creation**: Users create entities via the GenerationMenu
2. **Selection**: Clicking on entities selects them and shows the EntityPanel
3. **Manipulation**: Selected entities can be moved, rotated, and scaled using gizmos
4. **Generation**: Entity appearances can be modified with AI-generated content
5. **Rendering**: The scene can be rendered and exported using the RenderPanel

## Key Features

- **AI Generation**: Create and modify 3D objects with AI-generated images
- **3D Manipulation**: Move, rotate, and scale entities with intuitive controls
- **Image-to-3D**: Convert 2D images to 3D models with depth estimation
- **Scene Export**: Take screenshots and export rendered scenes

## Getting Started

1. Install dependencies: `npm install`
2. Run the development server: `npm run dev`
3. Open your browser to `http://localhost:3000`

## Usage

- Click "Add" buttons to create new entities
- Click on entities to select them
- Use gizmos to move, rotate, and scale entities
- Delete selected entities with the Delete key
- Use the Render panel to take screenshots and generate AI variations

## Development

The project uses:
- Next.js for the React framework
- Babylon.js for 3D rendering
- TailwindCSS for styling
- Various AI services for content generation
