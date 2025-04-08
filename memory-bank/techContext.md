# Technical Context: 3D AI Scene Editor

## Technology Stack

### Frontend Framework
- **Next.js**: React framework for server-rendered pages and routing
- **React**: UI component library for building the interface
- **TypeScript**: Static typing for safer code and better developer experience

### 3D Graphics
- **Three.js**: 3D library for WebGL rendering
- **Custom engine layer**: Abstracts Three.js for easier React integration

### Styling
- **TailwindCSS**: Utility-first CSS framework for rapid UI development
- **Shadcn UI**: Component library built on Tailwind for consistent design

### Backend and APIs
- **AI Services**: Integration with various AI services for content generation
- **Convex**: Backend as a service for data storage and synchronization (as mentioned in fetch_rules)

### Build and Development
- **Node.js**: JavaScript runtime for development and building
- **npm/yarn**: Package management

## Development Environment

### Prerequisites
- Node.js (LTS version)
- npm or yarn package manager
- Modern web browser with WebGL support

### Setup Process
1. Clone repository
2. Install dependencies: `yarn`
3. Run development server: `yarn dev`
4. Access the application at http://localhost:3030

### Environment Variables
- AI service API keys
- Backend connection information
- Feature flags

## Technical Constraints

### Browser Support
- Modern browsers with WebGL support (Chrome, Firefox, Safari, Edge)
- Mobile browser support with performance considerations

### Performance Considerations
- 3D scene complexity balanced against rendering performance
- Optimized asset loading and management
- Efficient event handling for responsive UI

### API Rate Limits
- AI service usage must respect rate limits
- Queueing system for handling generation requests

## Dependencies

### Critical Dependencies
- Three.js for 3D rendering
- React for UI components
- Next.js for application framework
- TailwindCSS for styling
- TypeScript for type safety

### External Services
- AI content generation APIs (e.g., Replicate as mentioned in project-desc)
- Convex backend for data management

## Design Decisions

### Browser-based Approach
- Enables cross-platform compatibility without installation
- Uses modern Web APIs for advanced 3D capabilities

### Decoupled Architecture
- Separates 3D engine from UI
- Enables cleaner code organization and testing
- Follows industry best practices for complex applications

### Type Safety
- TypeScript throughout the application
- Type-safe event system for reliable communication
- Ensures consistency and reduces runtime errors 