import { useEffect, useState } from "react";
import RenderVideoPanel from "./RenderVideoPanel";
import { UiLayoutMode, useEditorEngine } from "../context/EditorEngineContext";
import StylePanel from "./StylePanel";
import { createPortal } from "react-dom";
import { Button } from "./ui/button";
import { ANALYTICS_EVENTS } from "@/engine/utils/external/analytics";
import { trackEvent } from "@/engine/utils/external/analytics";

import { availableAPIs, API_Info } from '@/engine/utils/generation/image-render-api';
import { addNoiseToImage, resizeImage } from '@/engine/utils/generation/image-processing';
import { IconDownload, IconRefresh, IconDice } from '@tabler/icons-react';
import { IRenderSettings, LoraConfig, LoraInfo } from '@/engine/interfaces/rendering';

// Import Shadcn componentsimport { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Card, CardHeader, CardContent } from "./ui/card";
import { ComfyUIRenderParams, ComfyUIService } from "@/engine/services/ComfyUIService";
import PreviewPanel from "./PreviewPanel";



function RenderPanels() {
    const { userPreferences, setUserPreference } = useEditorEngine();
    const [renderMode, setRenderMode] = useState<"fal" | "comfyui">("fal");
    const [isStylePanelOpen, setIsStylePanelOpen] = useState(false);
    const [onSelectStyle, setOnSelectStyle] = useState<(lora: any) => void>(() => () => { });

    const { engine } = useEditorEngine();
    const { renderSettings } = useEditorEngine();

    // State variables
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
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
        selectedLoras,
        openOnRendered
    } = renderSettings;

    // Find the selected API object from its ID in the context
    const [selectedAPI, setSelectedAPI] = useState(() => {
        const api = availableAPIs.find(api => api.id === renderSettings.selectedAPI);
        return api || availableAPIs[0];
    });


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

    // Instead, modify the setSelectedAPI function to update context at the same time
    const handleAPIChange = (newAPI: API_Info) => {
        setSelectedAPI(newAPI);
        updateRenderSettings({ selectedAPI: newAPI.id });
    };

    // Add keyboard shortcut for Ctrl/Cmd+Enter
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Check for Ctrl/Cmd + Enter
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault(); // Prevent default browser behavior
                handleSubmit();
            }
        };

        // Add event listener
        window.addEventListener('keydown', handleKeyDown);

        // Clean up event listener
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [prompt, promptStrength, noiseStrength, selectedAPI, selectedLoras]); // Re-create handler when these dependencies change


    // Style panel handlers
    const handleSelectStyle = (lora: LoraInfo) => {
        // Only add if not already present
        if (!selectedLoras.some((config: LoraConfig) => config.info.id === lora.id)) {
            setSelectedLoras([...selectedLoras, { info: lora, strength: DEFAULT_STYLE_STRENGTH }]);
        }
    };

    const handleRemoveStyle = (id: string) => {
        setSelectedLoras(selectedLoras.filter((lora: LoraConfig) => lora.info.id !== id));
    };

    const handleUpdateStyleStrength = (id: string, strength: number) => {
        setSelectedLoras(
            selectedLoras.map((lora: LoraConfig) =>
                lora.info.id === id ? { ...lora, strength } : lora
            )
        );
    };

    // Render the selected styles
    const renderSelectedStyles = () => {
        if (selectedLoras.length === 0) {
            return (
                <Button
                    variant="outline"
                    className="w-full h-16 border-dashed"
                    onClick={() => openStylePanel([], handleSelectStyle)}
                >
                    <span className="text-muted-foreground">Click to add a style</span>
                </Button>
            );
        }

        return (
            <div className="space-y-3">
                {selectedLoras.map((loraConfig: LoraConfig) => (
                    <Card key={loraConfig.info.id} className="bg-card border-border p-1 flex flex-row items-center">
                        <div className="h-14 w-14 mr-2 overflow-hidden rounded">
                            <img
                                src={loraConfig.info.thumbUrl}
                                alt={loraConfig.info.name}
                                className="object-cover w-full h-full"
                            />
                        </div>

                        <div className="flex flex-col max-w-[140px] flex-grow">
                            {/* Title and remove button */}
                            <div className="flex items-center mb-2 h-6">
                                <span className="text-sm font-medium truncate max-w-[120px] text-ellipsis">
                                    {loraConfig.info.name}
                                </span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="p-0 h-6 w-6 ml-auto"
                                    onClick={() => handleRemoveStyle(loraConfig.info.id)}
                                >
                                    &times;
                                </Button>
                            </div>

                            {/* Strength slider */}
                            <div className="flex items-center gap-2">
                                <Slider
                                    defaultValue={[loraConfig.strength]}
                                    min={0.1}
                                    max={1}
                                    step={0.05}
                                    value={[loraConfig.strength]}
                                    onValueChange={(values) => handleUpdateStyleStrength(loraConfig.info.id, values[0])}
                                    className="flex-grow max-w-[115px]"
                                />
                                <span className="text-xs w-8 text-right">{loraConfig.strength?.toFixed(2)}</span>
                            </div>
                        </div>
                    </Card>
                ))}

                <Button
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={() => openStylePanel(
                        selectedLoras.map((lora: LoraConfig) => lora.info),
                        handleSelectStyle
                    )}
                >
                    Add
                </Button>
            </div>
        );
    };


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


    const handleSubmit = async (isTest: boolean = false) => {
        
        const trackEventName = renderMode === "fal" ? ANALYTICS_EVENTS.RENDER_IMAGE : ANALYTICS_EVENTS.RENDER_COMFYUI;

        try {
            setIsLoading(true);
            setExecutionTime(null);

            // Track that render started
            trackEvent(trackEventName + '_started', {
                model: selectedAPI.name,
                prompt_length: prompt.length,
                use_depth: selectedAPI.useDepthImage,
            });

            const currentSeed = useRandomSeed ? generateNewSeed() : seed;
            let result = {
                imageUrl: null,
                executionTimeMs: null
            }

            if (renderMode === "fal") {

                const falResult = await engine.getRenderService().Render({
                    isTest: isTest,
                    selectedAPI: selectedAPI,
                    prompt: prompt,
                    promptStrength: promptStrength,
                    noiseStrength: noiseStrength,
                    seed: currentSeed,
                    selectedLoras: selectedLoras,
                    onPreview: (imageUrl: string) => {
                        setImageUrl(imageUrl);
                    },
                });

                result.executionTimeMs = falResult.executionTimeMs;
                result.imageUrl = falResult.imageUrl;
            } else {

                const startTime = Date.now();

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
                const confyResult = await ComfyUIService.getInstance().sendToComfyUI(params);
                result.executionTimeMs = Date.now() - startTime;
                result.imageUrl = confyResult.imageUrl;
            }



            setExecutionTime(result.executionTimeMs);

            // Track successful render
            trackEvent(trackEventName + '_completed', {
                test_mode: isTest,
                model: selectedAPI.name,
                execution_time_ms: result.executionTimeMs,
                prompt_length: prompt.length,
                use_depth: selectedAPI.useDepthImage,
                depth_strength: selectedAPI.useDepthImage ? depthStrength : 0,
            });

            // If it's not a test, add to gallery using the context function
            if (!isTest) {
                handleSuccessfulRender(result, currentSeed);
            }
        } catch (error) {
            // Track failed render
            trackEvent(trackEventName + '_error', {
                test_mode: isTest,
                render_mode: renderMode,
                model: selectedAPI.name,
                error_message: error instanceof Error ? error.message : String(error),
                prompt_length: prompt.length,
            });

            console.error("Render failed:", error, typeof error, error instanceof Error);

            // Show a toast notification
            toast.error(String(error), {
                duration: 8000
            });
        } finally {
            // Restore gizmos after rendering
            setIsLoading(false);
        }
    };

    const enableDepthRender = async () => {
        await engine.getRenderService().showDepthRenderSeconds(3, setImageUrl);
    }


    const handleCancelRender = () => {
        // if (engine.getRenderService()) {
        //     engine.getRenderService().cancelRender();
        // }
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



    // Handler to open the style panel
    const DEFAULT_STYLE_STRENGTH = 0.8;
    const openStylePanel = (selectedLoras: LoraInfo[], selectHandler: (lora: any) => void) => {
        setSelectedLoras(selectedLoras.map(lora => ({ info: lora, strength: DEFAULT_STYLE_STRENGTH })));
        setOnSelectStyle(() => selectHandler);
        setIsStylePanelOpen(true);
    };


    useEffect(() => {
        setRenderMode(userPreferences.renderMode);
    }, [userPreferences]);

    const handleRenderModeChange = (val: "fal" | "comfyui") => {
        setRenderMode(val);
        setUserPreference("renderMode", val);
    };


    return (
        <>
            {/* StylePanel Portal for fullscreen overlay */}
            {createPortal(
                <StylePanel
                    isOpen={isStylePanelOpen}
                    onClose={() => setIsStylePanelOpen(false)}
                    onSelectStyle={onSelectStyle}
                    selectedLoras={selectedLoras.map(lora => lora.info)}
                />,
                document.body
            )}

            <div className={`fixed right-4 h-full flex flex-col gap-2 justify-center items-center `}>

                {/*  */}
                <Card className={`panel-shape z-40 w-64 border-border max-h-[90vh] overflow-y-auto gap-2 flex flex-col px-0`}>

                    {/* Temporary disable video mode */}
                    {/* <CardHeader className="flex flex-row justify-between items-center">
                        <div className="text-lg font-medium">Render</div>
                        <div className="flex items-center gap-2">
                            <Label>Video</Label>
                            <Switch checked={uiLayoutMode === UiLayoutMode.Video} onCheckedChange={() => {
                                setUiLayoutMode(uiLayoutMode === UiLayoutMode.Video ? UiLayoutMode.Image : UiLayoutMode.Video);
                            }} />
                        </div>
                    </CardHeader> */}
                    {/* {uiLayoutMode === UiLayoutMode.Video && <RenderVideoPanel />} */}
                    {/* {uiLayoutMode === UiLayoutMode.Image && <RenderPanel onOpenStylePanel={openStylePanel} />} */}

                    <CardHeader className="flex flex-row justify-between items-center">
                        <div className="text-lg font-medium">Render</div>
                        {/* <div className="flex items-center gap-2">
                            <Label className="text-xs text-gray-400">API/ComfyUI</Label>
                            <Switch checked={renderMode === "comfyui"} onCheckedChange={(val) => {
                                handleRenderModeChange(val ? "comfyui" : "fal");
                            }} />
                        </div> */}
                    </CardHeader>

                    <CardContent className="space-y-4">

                        {/* <div className="flex flex-col gap-2">
                            <div className="flex flex-row justify-between items-center">
                                <Label className="text-sm mb-2 block">Provider</Label>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs opacity-60">Fal.ai/ComfyUI</span>
                                    <Switch checked={renderMode === "comfyui"} onCheckedChange={(val) => {
                                        handleRenderModeChange(val ? "comfyui" : "fal");
                                    }} />
                                </div>
                            </div>
                            <div className="flex flex-row justify-between items-center">
                                <Label className="text-sm mb-2 block">Use Depth</Label>
                                <div className="flex items-center gap-2">
                                    <Switch checked={selectedAPI.useDepthImage} onCheckedChange={(val) => {
                                        val ? handleAPIChange(availableAPIs[1]) : handleAPIChange(availableAPIs[0]);
                                    }} />
                                </div>
                            </div>
                        </div> */}

                        {/* Button group for render mode */}
                        <div className="font-bold">
                            <Label className="text-sm mb-2 block">Provider</Label>
                            <div className=" w-full items-center gap-0 relative grid grid-cols-2 ">
                                <Button
                                    variant={renderMode === "fal" ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => handleRenderModeChange("fal")}
                                    className="w-full rounded-r-none">
                                    Fal
                                </Button>
                                <Button
                                    variant={renderMode === "comfyui" ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => handleRenderModeChange("comfyui")}
                                    className="w-full rounded-l-none">
                                    ComfyUI
                                </Button>
                            </div>
                        </div>

                        {/* Model selection */}
                        {renderMode === "fal" && <div>
                            <Label className="text-sm mb-2 block">Model</Label>
                            <div className="grid grid-cols-2 gap-2">
                                {availableAPIs.map((aiModel) => (
                                    <Button
                                        key={aiModel.id}
                                        variant={selectedAPI.id === aiModel.id ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => handleAPIChange(aiModel)}
                                        className="w-full overflow-ellipsis text-xs"
                                    >
                                        {aiModel.name}
                                    </Button>
                                ))}
                            </div>
                        </div>}

                        {/* Styles section */}
                        {renderMode === "fal" && <div>
                            <Label className="text-sm mb-2 block">Style</Label>
                            {renderSelectedStyles()}
                        </div>}

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
                        {selectedAPI.useDepthImage && (
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
                        )}

                        {/* Prompt input */}
                        <div>
                            <Label className="text-sm mb-2 block">Render Prompt</Label>
                            <Textarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                className="resize-none"
                                rows={3}
                                placeholder={renderMode === "fal" ? "Describe your scene. Use --no <negative_prompt> to exclude certain elements" : "Describe your scene."}
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
                        {(false &&
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
                        )}

                        {renderMode === "fal" && <div className='flex justify-between items-center text-xs gap-2'>
                            <span>Open on Rendered</span>
                            <Switch
                                checked={openOnRendered}
                                onCheckedChange={setOpenOnRendered}
                            />
                        </div>}

                        {/* Action buttons */}
                        <Button
                            variant="default"
                            size="lg"
                            onClick={() => handleSubmit(isTest)}
                            disabled={isLoading}
                            className="w-full"
                        >
                            {renderMode === "fal" && <>
                                {isLoading ? 'Rendering...' : 'Render'}
                                <span className="ml-2 text-xs opacity-70">Ctrl+⏎</span>
                            </>}
                            {renderMode === "comfyui" && <>
                                {isLoading ? 'Sending...' : 'Send to ComfyUI'}
                                <span className="ml-2 text-xs opacity-70">Ctrl+⏎</span>
                            </>}
                        </Button>
                    </CardContent>
                </Card>

                {/* Preview image */}
                <PreviewPanel executionTime={executionTime} imageUrl={imageUrl} isLoading={isLoading} handleCancelRender={handleCancelRender} />
            </div>
        </>
    );
}
export default RenderPanels;