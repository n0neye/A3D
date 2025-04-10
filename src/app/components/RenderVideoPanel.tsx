import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useState, useEffect } from "react";
import { downloadBlob } from "../engine/utils/helpers";
import { IconDownload, IconVideo } from "@tabler/icons-react";
import { Slider } from "@/components/ui/slider";
import { RenderVideoService } from "../engine/services/RenderVideoService";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useEditorEngine } from "../context/EditorEngineContext";

function RenderVideoPanel() {
    const [isLoading, setIsLoading] = useState(false);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [executionTime, setExecutionTime] = useState<number | null>(null);
    const [progress, setProgress] = useState<number>(0);
    const [renderType, setRenderType] = useState<'regular' | 'depth'>('regular');
    const [fps, setFps] = useState<number>(30);
    const [previewFrame, setPreviewFrame] = useState<string | null>(null);
    
    const { engine } = useEditorEngine();

    const renderVideoService = engine?.getRenderVideoService();
    
    const handleRender = async () => {
        if (!renderVideoService) return;
        
        setIsLoading(true);
        setProgress(0);
        setVideoUrl(null);
        
        try {
            const result = await (renderType === 'depth' 
                ? renderVideoService.renderDepthVideo({
                    fps,
                    width: 1280,
                    height: 720,
                    includeDepth: true,
                    onProgress: setProgress,
                    onPreviewFrame: setPreviewFrame
                  })
                : renderVideoService.renderVideo({
                    fps,
                    width: 1280,
                    height: 720,
                    includeDepth: false,
                    onProgress: setProgress,
                    onPreviewFrame: setPreviewFrame
                  })
            );
            
            if (result) {
                setVideoUrl(result.videoUrl);
                setExecutionTime(result.executionTimeMs);
            }
        } catch (error) {
            console.error("Error rendering video:", error);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleCancelRender = () => {
        if (renderVideoService) {
            renderVideoService.cancelRender();
        }
    };
    
    const handleDownload = () => {
        if (!videoUrl) return;
        
        fetch(videoUrl)
            .then(response => response.blob())
            .then(blob => {
                const filename = `video_${renderType}_${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
                downloadBlob(blob, filename);
            });
    };

    return (
        <>
            <CardContent className="space-y-4">
                {/* Preview image or placeholder */}
                <div className="w-full aspect-video bg-muted rounded-lg flex items-center justify-center overflow-hidden group relative">
                    {isLoading && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 z-10">
                            <div className="animate-spin rounded-full w-12 h-12 border-t-2 border-b-2 border-primary mb-3"></div>
                            <p className="text-white mb-2">Rendering... {Math.round(progress * 100)}%</p>
                            <Button 
                                variant="destructive" 
                                size="sm" 
                                onClick={handleCancelRender}
                            >
                                Cancel
                            </Button>
                        </div>
                    )}
                    
                    {isLoading && previewFrame && (
                        <img 
                            src={previewFrame} 
                            alt="Preview frame" 
                            className="w-full h-full object-contain"
                        />
                    )}
                    
                    {videoUrl ? (
                        <>
                            <video
                                src={videoUrl}
                                className="w-full h-full object-contain cursor-pointer"
                                controls
                                autoPlay
                                loop
                            />
                            <Button
                                variant="ghost"
                                size="icon"
                                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                                onClick={handleDownload}
                            >
                                <IconDownload size={16} />
                            </Button>

                            {/* Execution time */}
                            {executionTime && (
                                <div className="w-full mb-1 absolute bottom-0 left-0 bg-black/50 py-1">
                                    <div className="flex justify-center items-center">
                                        <span className="text-xs text-white/80">{(executionTime / 1000).toFixed(2)} s</span>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : !isLoading && (
                        <div className="text-muted-foreground flex flex-col items-center">
                            <IconVideo className="w-16 h-16 mb-2" />
                            <p>No video available</p>
                        </div>
                    )}
                </div>
                
                {/* Render settings */}
                <div className="space-y-3">
                    <div>
                        <Label htmlFor="renderType">Render Type</Label>
                        <ToggleGroup 
                            type="single" 
                            value={renderType} 
                            onValueChange={(value) => value && setRenderType(value as 'regular' | 'depth')}
                            className="w-full justify-start mt-1"
                        >
                            <ToggleGroupItem value="regular">Regular</ToggleGroupItem>
                            <ToggleGroupItem value="depth">Depth</ToggleGroupItem>
                        </ToggleGroup>
                    </div>
                    
                    <div>
                        <div className="flex justify-between">
                            <Label htmlFor="fps">FPS: {fps}</Label>
                        </div>
                        <Slider
                            id="fps"
                            min={1}
                            max={60}
                            step={1}
                            value={[fps]}
                            onValueChange={(values) => setFps(values[0])}
                            className="mt-1"
                        />
                    </div>
                </div>
                
                {/* Action buttons */}
                <Button
                    variant="default"
                    size="lg"
                    onClick={handleRender}
                    disabled={isLoading || !renderVideoService}
                    className="w-full"
                >
                    {isLoading ? 'Rendering...' : 'Render Video'}
                    <span className="ml-2 text-xs opacity-70">Ctrl+⏎</span>
                </Button>
            </CardContent>
        </>
    );
}

export default RenderVideoPanel;