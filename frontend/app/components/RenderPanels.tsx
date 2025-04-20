import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useEffect, useState } from "react";
import RenderVideoPanel from "./RenderVideoPanel";
import RenderPanel from "./RenderPanel";
import { UiLayoutMode, useEditorEngine } from "../context/EditorEngineContext";
import StylePanel from "./StylePanel";
import { createPortal } from "react-dom";
import RenderComfyUIPanel from "./RenderComfyUIPanel";

function RenderPanels() {
    const { userPreferences, setUserPreference } = useEditorEngine();
    const [renderMode, setRenderMode] = useState<"fal" | "comfyui">("fal");
    const [isStylePanelOpen, setIsStylePanelOpen] = useState(false);
    const [selectedLoraIds, setSelectedLoraIds] = useState<string[]>([]);
    const [onSelectStyle, setOnSelectStyle] = useState<(lora: any) => void>(() => () => { });

    // Handler to open the style panel
    const openStylePanel = (selectedIds: string[], selectHandler: (lora: any) => void) => {
        setSelectedLoraIds(selectedIds);
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
            {isStylePanelOpen && createPortal(
                <StylePanel
                    isOpen={isStylePanelOpen}
                    onClose={() => setIsStylePanelOpen(false)}
                    onSelectStyle={onSelectStyle}
                    selectedLoraIds={selectedLoraIds}
                />,
                document.body
            )}

            <div className={`fixed right-4 h-full flex justify-center items-center`}>
                <Card className={`panel-shape z-40 w-64 border-border max-h-[90vh] overflow-y-auto gap-2 `}>
                    
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
                        <div className="flex items-center gap-2">
                            <Label className="text-xs text-gray-400">API/ComfyUI</Label>
                            <Switch checked={renderMode === "comfyui"} onCheckedChange={(val) => {
                                handleRenderModeChange(val ? "comfyui" : "fal");
                            }} />
                        </div>
                    </CardHeader>
                    {renderMode === "fal" && <RenderPanel onOpenStylePanel={openStylePanel} />}
                    {renderMode === "comfyui" && <RenderComfyUIPanel />}
                </Card>
            </div>
        </>
    );
}
export default RenderPanels;