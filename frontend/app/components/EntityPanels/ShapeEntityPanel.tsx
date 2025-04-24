import { ShapeEntity } from "@/engine/entity/types/ShapeEntity";
import { useEffect, useState } from "react";
import { Input } from "../ui/input";
import Image from "next/image";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ShapeEntityPanelProps {
    entity: ShapeEntity;
}

const defaultColors = [
    '#ffffff', // White
    '#888888', // Gray  
    '#333333', // Dark gray
    '#ff0000', // Red
    '#ff5500', // Orange-red
    '#ff9933', // Orange
    '#ffcc33', // Yellow
    '#33cc66', // Green
    '#33dddd', // Teal
    '#3388ff', // Blue
    '#9944ff', // Purple
    '#ff44aa', // Pink
]

function ShapeEntityPanel({ entity }: ShapeEntityPanelProps) {
    // Color 
    const [colorDisplay, setColorDisplay] = useState(entity.props.material?.color || '#ffffff');

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
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <div
                        className="w-7 h-7 rounded-full border border-slate-500 cursor-pointer outline-1"
                        style={{ backgroundColor: colorDisplay }}
                    />
                </DropdownMenuTrigger>
                <DropdownMenuContent className="shape-panel p-2 min-w-[220px] rounded-2xl" side="bottom" sideOffset={15}>
                    <div className="flex flex-row gap-2 ">
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
                </DropdownMenuContent>
            </DropdownMenu>
        </>
    );
}

export default ShapeEntityPanel;