# Active Context: 3D AI Scene Editor

## Current Focus

As of the initial setup, we are establishing the Memory Bank to document the project structure and development context. The project is a 3D-to-Image web app SAAS using Three.js, Next.js/TypeScript, with image generation via Replicate API and Convex for backend services.

## Recent Changes

- Created Memory Bank documentation structure
- Documented system architecture and patterns
- Captured project requirements and technical context
- Updated technology references to reflect Three.js as the 3D engine (migrated from Babylon.js)

## Active Decisions

1. **Design Requirements**:
   - Interface should follow dark mode design with rounded shape panels
   - UI should prioritize ease of use while providing powerful functionality

2. **Architecture Approach**:
   - Maintaining clear separation between engine and UI layers
   - Using Observer pattern for cross-component communication
   - Implementing Command pattern for operations with history support

3. **Technology Choices**:
   - Three.js for 3D rendering (migrated from Babylon.js)
   - Next.js and TypeScript for application framework
   - Replicate API for image generation
   - Convex for backend services

## Next Steps

1. **Explore Codebase**:
   - Review existing components and structure
   - Understand current implementation of key features
   - Identify any architectural gaps or improvements

2. **Document Components**:
   - Map out existing UI components
   - Document engine components and their relationships
   - Create diagram of data flow through the system

3. **Review AI Integration**:
   - Document current AI service connections
   - Analyze generation workflows
   - Identify opportunities for enhancement

4. **Establish Development Priorities**:
   - Determine critical features to implement next
   - Identify technical debt to address
   - Create roadmap for upcoming development work

## Key Considerations

- Maintaining performance while offering sophisticated 3D capabilities
- Ensuring AI integration is seamless and user-friendly
- Balancing feature richness with intuitive UX
- Supporting collaboration and sharing workflows 