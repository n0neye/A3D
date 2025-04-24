import { IconDownload } from "@tabler/icons-react";
import { useState } from "react";
import { downloadImage } from '@/engine/utils/helpers';
import { Button } from "./ui/button";
import { Card } from "./ui/card";

function PreviewPanel({ executionTime, imageUrl, isLoading, handleCancelRender }: { executionTime: number, imageUrl?: string, isLoading: boolean, handleCancelRender: () => void }) {

    if(!isLoading && !imageUrl) return null;
    return (
        <Card className={`panel-shape z-40 w-64 max-h-[256px] flex flex-col gap-1 p-0 overflow-hidden`}>
            {/* <div className="text-lg font-medium absolute px-6 py-2">Preview</div> */}
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
                <div className="text-muted-foreground flex flex-col items-center aspect-video">
                    {/* <svg className="w-16 h-16 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p>No preview available</p> */}
                </div>
            )}
        </Card>
    );
}

export default PreviewPanel;