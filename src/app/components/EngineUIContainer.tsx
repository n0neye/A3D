
import AddPanel from './AddPanel';
import EntityPanel from './EntityPanels/EntityPanel';
import GizmoModeSelector from './GizmoModeSelector';
import FramePanel from './FramePanel';
import FileMenu from './FileMenu';
import GalleryPanel from './GalleryPanel';
import Guide from './Guide';
import RenderPanel from './RenderPanel';
import { useEffect, useRef, useState } from 'react';
import { useProjectSettings } from '../context/ProjectSettingsContext';
import { availableAPIs } from '../util/generation/image-render-api';
import { RenderLog } from '@/app/engine/managers/ProjectManager';


function EngineUIContainer() {

    const { ProjectSettings, updateProjectSettings } = useProjectSettings();
    const [isGalleryOpen, setIsGalleryOpen] = useState(false);
    const [currentGalleryIndex, setCurrentGalleryIndex] = useState(0);
    const [isDebugMode, setIsDebugMode] = useState(false);
    const prevRenderLogsLength = useRef(0);

    const openGallery = () => {
        console.log('openGallery');
        setIsGalleryOpen(true);
    }

    // Track when new images are added to renderLogs
    // TODO: Use event emitter instead of polling
    useEffect(() => {
        if (ProjectSettings.renderLogs.length > prevRenderLogsLength.current) {
            // A new image was added and gallery should open
            setCurrentGalleryIndex(ProjectSettings.renderLogs.length - 1);
            setIsGalleryOpen(true);
        }
        // Update previous length
        prevRenderLogsLength.current = ProjectSettings.renderLogs.length;
    }, [ProjectSettings.renderLogs.length]);

    const handleApplyRenderSettings = (renderLog: RenderLog) => {
        // Extract settings from the renderLog
        const settings = {
            prompt: renderLog.prompt,
            seed: renderLog.seed,
            promptStrength: renderLog.promptStrength,
            depthStrength: renderLog.depthStrength,
            selectedLoras: renderLog.selectedLoras || [],
            // Find the API by name
            selectedAPI: availableAPIs.find(api => api.name === renderLog.model)?.id || availableAPIs[0].id
        };
        // Update the project settings
        updateProjectSettings(settings);
    };


    return (
        <>

            <AddPanel />
            <EntityPanel />

            {/* Render Panel - no longer needs onImageGenerated */}
            <RenderPanel
                isDebugMode={isDebugMode}
                onOpenGallery={openGallery}
            />


            {/* Top Toolbar */}
            <div className='fixed top-2  w-full flex justify-center items-center'>
                <div className=" panel-shape p-1 flex gap-2">
                    <FileMenu />
                    <FramePanel />
                    <GizmoModeSelector />
                </div>
            </div>


            <GalleryPanel
                isOpen={isGalleryOpen}
                onClose={() => setIsGalleryOpen(false)}
                images={ProjectSettings.renderLogs}
                currentIndex={currentGalleryIndex}
                onSelectImage={setCurrentGalleryIndex}
                onApplySettings={handleApplyRenderSettings}
            />

            {/* Add the Guide component */}
            <Guide />
        </>
    );
}

export default EngineUIContainer;