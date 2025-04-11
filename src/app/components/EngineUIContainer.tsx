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
import DebugPanel from './Debug/DebugPanel';
import { useEffect, useState } from 'react';
import { UiLayoutMode, useEditorEngine } from '../context/EditorEngineContext';
import { TimelineManager } from '../engine/managers/timeline/TimelineManager';
import RenderPanels from './RenderPanels';

function EngineUIContainer() {
    const { engine, uiLayoutMode } = useEditorEngine();
    const [timelineManager, setTimelineManager] = useState<TimelineManager | null>(null);
    const [isDebugMode, setIsDebugMode] = useState(false);

    useEffect(() => {
        if(!engine) return;
        const timelineManager = engine.getTimelineManager();
        setTimelineManager(timelineManager);
    }, [engine]);

    return (
        <>
            <RatioOverlay />
            <AddPanel />
            <EntityPanel />

            {/* Render Panel - simplified props */}
            <RenderPanels />

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

            {timelineManager && uiLayoutMode === UiLayoutMode.Video && <TimelinePanel timelineManager={timelineManager} />}
            
            {/* Add the Debug Panel */}
            <DebugPanel />
        </>
    );
}

export default EngineUIContainer;