import React, { useState, useRef, useEffect } from 'react';
import { availableAPIs, API_Info } from '@/app/engine/utils/generation/image-render-api';
import { addNoiseToImage, resizeImage } from '@/app/engine/utils/generation/image-processing';
import { IconDownload, IconRefresh, IconDice } from '@tabler/icons-react';
import { downloadImage } from '@/app/engine/utils/helpers';
import { trackEvent, ANALYTICS_EVENTS } from '@/app/engine/utils/external/analytics';
import { ComfyUIRenderParams, ComfyUIService } from '@/app/engine/services/ComfyUIService';

// Import Shadcn components
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from '@/components/ui/switch';
import { useEditorEngine } from '../context/EditorEngineContext';
import { IRenderSettings, LoraConfig, LoraInfo } from '@/app/engine/interfaces/rendering';

// Update the props of RenderPanel
interface RenderPanelProps {
    // isDebugMode: boolean;
    onOpenStylePanel?: (selectedLoraIds: string[], onSelectStyle: (lora: any) => void) => void;
}

const RenderComfyUIPanel = ({ onOpenStylePanel }: RenderPanelProps) => {
    // const { scene, engine, selectedEntity, setSelectedEntity, gizmoManager, setAllGizmoVisibility } = useOldEditorContext();
    const { engine } = useEditorEngine();
    const { renderSettings } = useEditorEngine();

    // State variables
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const previewImageRef = useRef<HTMLImageElement | null>(null);
    const [executionTime, setExecutionTime] = useState<number | null>(null);
    const [isTest, setIsTest] = useState<boolean>(false);

    // Use values from context instead of local state
    const {
        prompt,
        promptStrength,
        depthStrength,
        noiseStrength,
        seed,
        useRandomSeed,
        // selectedLoras,
        // openOnRendered
    } = renderSettings;

    // Add ComfyUI service instance
    const [comfyUIService] = useState(() => new ComfyUIService());

    const updateRenderSettings = (newSettings: Partial<IRenderSettings>) => {
        engine.getProjectManager().updateRenderSettings(newSettings);
    };

    // Update functions that modify the context
    const setPrompt = (value: string) => updateRenderSettings({ prompt: value });
    const setPromptStrength = (value: number) => updateRenderSettings({ promptStrength: value });
    const setDepthStrength = (value: number) => updateRenderSettings({ depthStrength: value });
    const setNoiseStrength = (value: number) => updateRenderSettings({ noiseStrength: value });
    const setSeed = (value: number) => updateRenderSettings({ seed: value });
    const setUseRandomSeed = (value: boolean) => updateRenderSettings({ useRandomSeed: value });
    const setSelectedLoras = (loras: LoraConfig[]) => updateRenderSettings({ selectedLoras: loras });
    const setOpenOnRendered = (value: boolean) => updateRenderSettings({ openOnRendered: value });

    // Add keyboard shortcut for Ctrl/Cmd+Enter
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Check for Ctrl/Cmd + Enter
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault(); // Prevent default browser behavior
                handleSendToComfyUI();
            }
        };

        // Add event listener
        window.addEventListener('keydown', handleKeyDown);

        // Clean up event listener
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [prompt, promptStrength, noiseStrength]); // Re-create handler when these dependencies change


    const generateDebugImage = async () => {
        try {
            // Force a fresh render
            const screenshot = await engine.getRenderService().takeFramedScreenshot();
            if (!screenshot) throw new Error("Failed to take screenshot");
            console.log("Screenshot generated:", screenshot?.substring(0, 100) + "...");
            setImageUrl(screenshot);
            // Apply noise to the screenshot if noiseStrength > 0
            let processedImage = screenshot;
            if (noiseStrength > 0) {
                processedImage = await addNoiseToImage(screenshot, noiseStrength);
            }
            setImageUrl(processedImage);

        } catch (error) {
            console.error("Error in debug image:", error);
        }
    };


    const generateNewSeed = () => {
        const newSeed = Math.floor(Math.random() * 2147483647);
        setSeed(newSeed);
        return newSeed;
    };

    const handleSuccessfulRender = (result: any, currentSeed: number) => {
        setImageUrl(result.imageUrl);
        if (result && result.imageUrl) {
            // If openOnRendered is true and window.openGallery exists, open gallery
            if (renderSettings.openOnRendered && window.openGallery) {
                // No need for setTimeout anymore
                window.openGallery();
            }
        }
    };


    const handleSendToComfyUI = async (isTest: boolean = false) => {
        try {
            setIsLoading(true);
            setExecutionTime(null);

            // Track that render started
            trackEvent(ANALYTICS_EVENTS.RENDER_COMFYUI + '_started', {
                prompt_length: prompt.length,
            });

            const currentSeed = useRandomSeed ? generateNewSeed() : seed;

            // Take screenshot and get depth map
            const screenshot = await engine.getRenderService().takeFramedScreenshot();
            if (!screenshot) throw new Error("Failed to take screenshot");
            setImageUrl(screenshot);

            console.log("SendToComfyUI: Screenshot", screenshot?.length);

            // Get depth map if needed
            let depthImage: string | undefined = undefined;
            if (depthStrength > 0) {
                const depthResult = await engine.getRenderService().getDepthMap();
                // Crop
                const croppedDepthImage = await engine.getRenderService().cropByRatio(depthResult.imageUrl);
                depthImage = croppedDepthImage;
                // Show depth preview briefly
                setImageUrl(croppedDepthImage);
            }

            console.log("SendToComfyUI: DepthImage", depthImage?.length);

            // If this is just a test, skip sending to ComfyUI
            if (isTest) {
                setExecutionTime(0);
                return;
            }

            // Start timing
            const startTime = Date.now();

            const params: ComfyUIRenderParams = {
                colorImage: screenshot,
                depthImage: depthImage,
                prompt: prompt,
                promptStrength: promptStrength,
                depthStrength: depthStrength,
                seed: currentSeed,
                // selectedLoras: renderSettings.selectedLoras,
                metadata: {
                    test_mode: isTest
                }
            }

            console.log("SendToComfyUI, params:", params);

            // Send to ComfyUI
            const result = await comfyUIService.sendToComfyUI(params);

            // Calculate and set execution time
            setExecutionTime(Date.now() - startTime);

            // Handle result
            if (result.success) {
                // setImageUrl(result.imageUrl);

                // If openOnRendered is true and window.openGallery exists, open gallery
                // if (renderSettings.openOnRendered && window.openGallery) {
                //     window.openGallery();
                // }
            } else {
                alert(`Failed to render with ComfyUI: ${result.message || 'Unknown error'}`);
            }

            // Track successful render
            trackEvent(ANALYTICS_EVENTS.RENDER_COMFYUI + '_completed', {
                test_mode: isTest,
                prompt_length: prompt.length,
            });
        } catch (error) {
            // Track failed render
            trackEvent(ANALYTICS_EVENTS.RENDER_COMFYUI + '_error', {
                test_mode: isTest,
                error_message: error instanceof Error ? error.message : String(error),
                prompt_length: prompt.length,
            });

            console.error("Error generating preview:", error);
            alert("Failed to generate Render. Please try again.");
        } finally {
            // Restore gizmos after rendering
            setIsLoading(false);
        }
    };

    const handleCancelRender = () => {
        setIsLoading(false);
    };


    useEffect(() => {
        // Subscribe to latestRenderChanged event, and update the imageUrl when it changes
        const unsubscribe = engine.getProjectManager().observers.subscribe(
            'latestRenderChanged',
            ({ latestRender }) => {
                setImageUrl(latestRender?.imageUrl || null);
            }
        );
        // Clean up subscription when component unmounts
        return () => unsubscribe();
    }, [engine]);


    return (
        <>
            <CardContent className="space-y-4">
                {/* Preview image or placeholder */}
                <div className="w-full aspect-video bg-muted rounded-lg flex items-center justify-center overflow-hidden group relative">
                    {isLoading && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <div className="animate-spin rounded-full w-12 h-12 border-t-2 border-b-2 border-primary mb-3"></div>
                            <p className="text-muted-foreground">Rendering...</p>
                            <Button
                                variant="ghost"
                                size="xs"
                                onClick={handleCancelRender}
                            >
                                Cancel
                            </Button>
                        </div>
                    )}
                    {imageUrl ? (
                        <>
                            <img
                                src={imageUrl}
                                alt="Scene Preview"
                                className="w-full h-full object-contain cursor-pointer"
                                onClick={() => window.openGallery?.()}
                            />
                            <Button
                                variant="ghost"
                                size="icon"
                                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                                onClick={() => {
                                    if (!imageUrl) return;
                                    downloadImage(imageUrl);
                                }}
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
                    ) : (
                        <div className="text-muted-foreground flex flex-col items-center">
                            <svg className="w-16 h-16 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <p>No preview available</p>
                        </div>
                    )}
                </div>

                {/* Prompt Strength slider */}
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <Label className="text-sm">Creativity</Label>
                        <span className="text-xs">{promptStrength.toFixed(2)}</span>
                    </div>
                    <Slider
                        defaultValue={[promptStrength]}
                        min={0.1}
                        max={1}
                        step={0.05}
                        value={[promptStrength]}
                        onValueChange={(values) => setPromptStrength(values[0])}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>Source</span>
                        <span>Creative</span>
                    </div>
                </div>

                {/* Depth Strength slider */}
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <Label className="text-sm">Depth Strength</Label>
                        <span className="text-xs">{depthStrength.toFixed(2)}</span>
                    </div>
                    <Slider
                        defaultValue={[depthStrength]}
                        min={0.1}
                        max={1}
                        step={0.05}
                        value={[depthStrength]}
                        onValueChange={(values) => setDepthStrength(values[0])}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>Source</span>
                        <span>Creative</span>
                    </div>
                </div>

                {/* Prompt input */}
                <div>
                    <Label className="text-sm mb-2 block">Render Prompt</Label>
                    <Textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        className="resize-none"
                        rows={3}
                        placeholder="Describe how you want the scene to look..."
                    />
                </div>

                {/* Seed input */}
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <Label className="text-sm">Seed</Label>
                    </div>
                    <div className="flex items-center">
                        <Input
                            type="number"
                            value={seed}
                            onChange={(e) => setSeed(parseInt(e.target.value) || 0)}
                            disabled={useRandomSeed}
                            className="rounded-r-none"
                        />
                        <Button
                            variant="secondary"
                            size="icon"
                            onClick={generateNewSeed}
                            disabled={useRandomSeed}
                            className="rounded-l-none rounded-r-none h-10 w-10"
                            title="Generate new seed"
                        >
                            <IconRefresh size={16} />
                        </Button>
                        <Button
                            variant={useRandomSeed ? "default" : "secondary"}
                            size="icon"
                            onClick={() => setUseRandomSeed(!useRandomSeed)}
                            className="rounded-l-none h-10 w-10"
                            title={useRandomSeed ? "Using random seed" : "Using fixed seed"}
                        >
                            <IconDice size={16} />
                        </Button>
                    </div>
                </div>

                {/* Debug Tools */}
                {/* {(true &&
                    <div>
                        <Label className="text-sm mb-2 block">Debug Tools</Label>
                        <div className="grid grid-cols-2 gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={generateDebugImage}
                            >
                                Scene Image
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={enableDepthRender}
                            >
                                Show Depth
                            </Button>
                            <Button
                                variant={isTest ? "default" : "outline"}
                                size="sm"
                                onClick={() => setIsTest(!isTest)}
                            >
                                Test
                            </Button>
                        </div>
                    </div>
                )} */}

                {/* <div className='flex justify-between items-center text-xs gap-2'>
                    <span>Open on Rendered</span>
                    <Switch
                        checked={openOnRendered}
                        onCheckedChange={setOpenOnRendered}
                    />
                </div> */}

                {/* Action buttons */}
                <Button
                    variant="default"
                    size="lg"
                    onClick={() => handleSendToComfyUI(isTest)}
                    disabled={isLoading}
                    className="w-full"
                >
                    {isLoading ? 'Rendering...' : 'Send to ComfyUI'}
                    <span className="ml-2 text-xs opacity-70">Ctrl+⏎</span>
                </Button>
            </CardContent>
        </>
    );
};

export default RenderComfyUIPanel; 