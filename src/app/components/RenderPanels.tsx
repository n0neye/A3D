import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";
import RenderVideoPanel from "./RenderVideoPanel";
import RenderPanel from "./RenderPanel";
import { UiLayoutMode, useEditorEngine } from "../context/EditorEngineContext";

function RenderPanels() {
    const { uiLayoutMode, setUiLayoutMode } = useEditorEngine();
    return (

        <div className={`fixed right-4 h-full flex justify-center items-center`}>
            <Card className={`panel-shape z-40   w-64 border-border max-h-[90vh] overflow-y-auto gap-2 `}>
                <CardHeader className="flex flex-row justify-between items-center">
                    <div className="text-lg font-medium">Render</div>
                    <div className="flex items-center gap-2">
                        <Label>Video</Label>
                        <Switch checked={uiLayoutMode === UiLayoutMode.Video} onCheckedChange={() => {
                            setUiLayoutMode(uiLayoutMode === UiLayoutMode.Video ? UiLayoutMode.Image : UiLayoutMode.Video);
                        }} />
                    </div>
                </CardHeader>

                {uiLayoutMode === UiLayoutMode.Video && <RenderVideoPanel />}
                {uiLayoutMode === UiLayoutMode.Image && <RenderPanel />}

            </Card>
        </div>
    );
}

export default RenderPanels;