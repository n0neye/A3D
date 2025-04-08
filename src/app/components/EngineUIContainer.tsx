import AddPanel from './AddPanel';
import EntityPanel from './EntityPanels/EntityPanel';
import GizmoModeSelector from './TransformModeSelector';
import CameraPanel from './CameraPanel';
import FileMenu from './FileMenu';
import GalleryPanel from './GalleryPanel';
import Guide from './Guide';
import RenderPanel from './RenderPanel';
import RatioOverlay from './RatioOverlay';
import { useState } from 'react';
import { useEditorEngine } from '../context/EditorEngineContext';

function EngineUIContainer() {
    const { engine } = useEditorEngine();
    const [isDebugMode, setIsDebugMode] = useState(false);

    return (
        <>
            <RatioOverlay />
            <AddPanel />
            <EntityPanel />

            {/* Render Panel - simplified props */}
            <RenderPanel isDebugMode={isDebugMode} />

            <div className='fixed top-2 w-full flex justify-center items-center'>
                <div className="panel-shape p-1 flex gap-2">
                    <FileMenu />
                    <CameraPanel />
                    <GizmoModeSelector />
                </div>
            </div>

            {/* Gallery Panel handles its own state now */}
            <GalleryPanel />

            {/* Add the Guide component */}
            <Guide />
        </>
    );
}

export default EngineUIContainer;