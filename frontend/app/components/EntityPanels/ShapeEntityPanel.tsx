import { ShapeEntity } from "@/engine/entity/types/ShapeEntity";
import { Label } from "@radix-ui/react-label";
import { useEffect, useRef, useState } from "react";
import { Input } from "../ui/input";
import Image from "next/image";

interface ShapeEntityPanelProps {
    entity: ShapeEntity;
}

const defaultColors = [
    '#333333', // Dark gray
    '#888888', // Gray  
    '#ff5500', // Orange-red
    '#ff9933', // Orange
    '#ffcc33', // Yellow
    '#33cc66', // Green
    '#33dddd', // Teal
    '#3388ff', // Blue
    '#9944ff', // Purple
    '#ff44aa', // Pink
    '#ffffff', // White
]



function ShapeEntityPanel({ entity }: ShapeEntityPanelProps) {

    // Color 
    const [colorDisplay, setColorDisplay] = useState(entity.props.material?.color || '#ffffff');
    const [showColorPopover, setShowColorPopover] = useState(false); // State for popover visibility
    const colorPopoverRef = useRef<HTMLDivElement>(null); // Ref for popover container

    // Update local color state if entity's color changes externally
    useEffect(() => {
        setColorDisplay(entity.props.material?.color || '#ffffff');
    }, [entity.props.material?.color]);

    // Updated function to set color from swatches or input
    const handleSetColor = (newColor: string) => {
        setColorDisplay(newColor);
        entity.setColor(newColor);
    };

    // Handler specifically for the color input element
    const handleCustomColorInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        handleSetColor(event.target.value);
    };

    return (
        <div>
            <div ref={colorPopoverRef} className="relative flex items-center gap-2">
                {/* <Label className="text-xs whitespace-nowrap">Color:</Label> */}
                {/* Color Circle Trigger */}
                <div
                    className="w-7 h-7 rounded-full border border-slate-500 cursor-pointer outline-1"
                    style={{ backgroundColor: colorDisplay }}
                    onClick={() => setShowColorPopover(!showColorPopover)}
                />

                {/* Color Popover */}
                {showColorPopover && (
                    <div className="absolute bottom-full mb-5 -left-7 p-2">
                        <div
                            className="z-50 panel-shape p-3"
                        >
                            {/* Single row with predefined colors and custom color picker */}
                            <div className="flex flex-row gap-2 mb-3">
                                {defaultColors.map((tone) => (
                                    <div
                                        key={tone}
                                        className="w-6 h-6 rounded-full cursor-pointer border border-slate-600 hover:border-slate-400"
                                        style={{ backgroundColor: tone }}
                                        onClick={() => handleSetColor(tone)}
                                    />
                                ))}
                                {/* Custom Color Input */}
                                <div className="relative w-6 h-6">
                                    <div className="w-6 h-6 rounded-full overflow-hidden cursor-pointer border border-slate-600 hover:border-slate-400">
                                        <Image 
                                            src="./icons/color_wheel.jpg" 
                                            alt="Color wheel" 
                                            width={24} 
                                            height={24}
                                            className="object-cover"
                                        />
                                    </div>
                                    <Input
                                        id="customColor"
                                        type="color"
                                        value={colorDisplay}
                                        onChange={handleCustomColorInputChange}
                                        className="absolute inset-0 opacity-0 w-6 h-6 cursor-pointer"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default ShapeEntityPanel;