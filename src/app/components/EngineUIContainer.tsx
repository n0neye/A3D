import AddPanel from './AddPanel';
import EntityPanel from './EntityPanels/EntityPanel';
import GizmoModeSelector from './TransformModeSelector';
import CameraPanel from './CameraPanel';
import FileMenu from './FileMenu';
import GalleryPanel from './GalleryPanel';
import Guide from './Guide';
import RenderPanel from './RenderPanel';
import RatioOverlay from './RatioOverlay';
import TimelinePanel from './TimelinePanel';
import { useState } from 'react';
import { useEditorEngine } from '../context/EditorEngineContext';

function EngineUIContainer() {
    const { engine } = useEditorEngine();
    const [isDebugMode, setIsDebugMode] = useState(false);

    return (
        <div className="fixed inset-0 pointer-events-none">
            {/* Left Side Panels */}
            <div className="absolute left-4 top-4 bottom-4 flex flex-col gap-4 w-60 z-10 pointer-events-auto">
                <AddPanel />
                <CameraPanel />
            </div>

            {/* Right Side Panels */}
            <div className="absolute right-4 top-4 bottom-4 flex flex-col gap-4 w-60 z-10 pointer-events-auto">
                <EntityPanel />
                <RenderPanel isDebugMode={isDebugMode} />
            </div>

            {/* Bottom Panel */}
            <div className="absolute left-72 right-72 bottom-4 flex flex-col gap-4 z-10 pointer-events-auto">
                <TimelinePanel />
            </div>

            {/* Transform Controls */}
            <div className="absolute left-1/2 transform -translate-x-1/2 top-4 flex flex-row gap-2 z-10 pointer-events-auto">
                <GizmoModeSelector />
            </div>

            {/* File Menu */}
            <div className="absolute left-1/2 transform -translate-x-1/2 bottom-4 flex flex-row gap-2 z-10 pointer-events-auto">
                <FileMenu />
            </div>

            {/* Gallery Panel handles its own state now */}
            <GalleryPanel />

            {/* Add the Guide component */}
            <Guide />
        </div>
    );
}

export default EngineUIContainer;