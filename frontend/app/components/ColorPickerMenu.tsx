import { ShapeEntity } from "@/engine/entity/types/ShapeEntity";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import Image from "next/image";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

function ColorPickerMenu({ color, onColorChange, colorOptions = defaultColors }: { color: string, onColorChange: (color: string) => void, colorOptions?: string[] }) {
    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <div
                        className="w-7 h-7 rounded-full border border-slate-500 cursor-pointer outline-1"
                        style={{ backgroundColor: color }}
                    />
                </DropdownMenuTrigger>
                <DropdownMenuContent className="shape-panel p-2 min-w-[220px] rounded-2xl" side="bottom" sideOffset={15}>
                    <div className="flex flex-row gap-2 ">
                        {colorOptions.map((tone) => (
                            <div
                                key={tone}
                                className="w-6 h-6 rounded-full cursor-pointer border border-slate-600 hover:border-slate-400"
                                style={{ backgroundColor: tone }}
                                onClick={() => onColorChange(tone)}
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
                                value={color}
                                onChange={(e) => onColorChange(e.target.value)}
                                className="absolute inset-0 opacity-0 w-6 h-6 cursor-pointer"
                            />
                        </div>
                    </div>
                </DropdownMenuContent>
            </DropdownMenu>
        </>
    );
}

export default ColorPickerMenu;