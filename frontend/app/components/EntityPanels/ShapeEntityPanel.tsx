import { ShapeEntity } from "@/engine/entity/types/ShapeEntity";
import { useEffect, useState } from "react";
import { Input } from "../ui/input";
import Image from "next/image";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ColorPickerMenu from "../ColorPickerMenu";

interface ShapeEntityPanelProps {
    entity: ShapeEntity;
}

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

    return (
        <>
            <ColorPickerMenu color={colorDisplay} onColorChange={handleSetColor} />
        </>
    );
}

export default ShapeEntityPanel;