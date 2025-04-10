import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";
import { downloadImage } from "../engine/utils/helpers";
import { IconDownload } from "@tabler/icons-react";

function RenderVideoPanel() {
    const [isLoading, setIsLoading] = useState(false);
    const [isTest, setIsTest] = useState(false);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [executionTime, setExecutionTime] = useState<number | null>(null);
    const handleRender = (isTest: boolean) => {
        setIsLoading(true);
        setIsTest(isTest);
    };

    return (
        <>
            <CardContent className="space-y-4">
                {/* Preview image or placeholder */}
                <div className="w-full aspect-video bg-muted rounded-lg flex items-center justify-center overflow-hidden group relative">
                    {isLoading && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <div className="animate-spin rounded-full w-12 h-12 border-t-2 border-b-2 border-primary mb-3"></div>
                            <p className="text-muted-foreground">Rendering...</p>
                        </div>
                    )}
                    {videoUrl ? (
                        <>
                            <video
                                src={videoUrl}
                                className="w-full h-full object-contain cursor-pointer"
                                onClick={() => window.openGallery?.()}
                            />
                            <Button
                                variant="ghost"
                                size="icon"
                                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                                onClick={() => {
                                        // if (!imageUrl) return;
                                        // downloadImage(imageUrl);
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
                {/* Action buttons */}
                <Button
                    variant="default"
                    size="lg"
                    onClick={() => handleRender(isTest)}
                    disabled={isLoading}
                    className="w-full"
                >
                    {isLoading ? 'Rendering...' : 'Render'}
                    <span className="ml-2 text-xs opacity-70">Ctrl+⏎</span>
                </Button>
            </CardContent>
        </>
    );
}

export default RenderVideoPanel;