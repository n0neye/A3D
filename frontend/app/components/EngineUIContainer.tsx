import AddPanel from './AddPanel';
import EntityPanel from './EntityPanels/EntityPanel';
import GizmoModeSelector from './TransformModeSelector';
import CameraPanel from './CameraPanel';
import EnvironmentPanel from './EnvironmentPanel';
import FileMenu from './FileMenu';
import GalleryPanel from './GalleryPanel';
import Guide from './Guide';
import RatioOverlay from './RatioOverlay';
// import TimelinePanel from './TimelinePanel';
import DebugPanel from './Debug/DebugPanel';
import FileDragDropOverlay from './FileDragDropOverlay';
import UserPrefPanel from './UserPrefPanel';
import { useEffect, useState } from 'react';
import { UiLayoutMode, useEditorEngine } from '../context/EditorEngineContext';
import { TimelineManager } from '../engine/managers/timeline/TimelineManager';
import RenderPanels from './RenderPanels';
import { IconMinusVertical } from '@tabler/icons-react';

function EngineUIContainer() {
    const { engine, uiLayoutMode } = useEditorEngine();
    const [timelineManager, setTimelineManager] = useState<TimelineManager | null>(null);
    const [isDebugMode, setIsDebugMode] = useState(false);

    useEffect(() => {
        if (!engine) return;
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

            {/* Top Bar: Fixed */}
            {/* <div className='fixed top-0 px-2 w-full flex justify-center items-center bg-background shadow-md  select-none'>
                <div className='w-full flex justify-between items-center p-1'>
                    <div className="panel-shape flex space-x-0 gap-0 items-center p-1">
                        <FileMenu />
                    </div>
                    <IconMinusVertical width={10} height={20} className='opacity-20' />
                    <div className="panel-shape flex gap-1 items-center p-1">
                        <GizmoModeSelector />
                    </div>
                    <IconMinusVertical width={10} height={20} className='opacity-20' />
                    <div className="panel-shape flex gap-1 items-center p-1">
                        <CameraPanel />
                        <EnvironmentPanel />
                        <UserPrefPanel />
                    </div>
                </div>
            </div> */}

            {/* Top Bar: Floating */}
            <div className='fixed top-0 px-2 w-full flex justify-center items-center   select-none'>
                <div className=' flex justify-between items-center p-1 bg-background/20 rounded-b-md panel-shape mt-2'>
                    <div className=" flex space-x-0 gap-0 items-center p-1">
                        <FileMenu />
                    </div>
                    <IconMinusVertical width={10} height={20} className='opacity-20' />
                    <div className="flex gap-1 items-center p-1">
                        <GizmoModeSelector />
                    </div>
                    <IconMinusVertical width={10} height={20} className='opacity-20' />
                    <div className="flex gap-1 items-center p-1">
                        <CameraPanel />
                        <EnvironmentPanel />
                        <UserPrefPanel />
                    </div>
                </div>
            </div>

            {/* Gallery Panel handles its own state now */}
            <GalleryPanel />

            {/* Add the Guide component */}
            <Guide />

            {/* {timelineManager && uiLayoutMode === UiLayoutMode.Video && <TimelinePanel timelineManager={timelineManager} />} */}

            {/* Add the Debug Panel */}
            {!(process.env.NODE_ENV === 'production') && <DebugPanel />}

            {/* Add File Drag Drop Overlay */}
            <FileDragDropOverlay />
        </>
    );
}

export default EngineUIContainer;