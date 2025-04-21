import { ScrollArea } from "@/components/ui/scroll-area";
import { applyMaterialConfig, defaultMaterials } from "../engine/utils/materialUtil";
import { useState } from "react";

function MaterialSelector() {
    const [activeMaterialIndex, setActiveMaterialIndex] = useState<number>(0);

    // Handle material selection
    const handleMaterialChange = (index: number) => {
        // Use the utility function to apply the material config
        applyMaterialConfig(index);
        setActiveMaterialIndex(index);
    };

    return (
        <>
            <h3 className="text-sm font-medium px-4 py-2">Base Material</h3>

            <div className="grid grid-cols-3 gap-2 p-2">
                {defaultMaterials.map((material, index) => (
                    <div
                        key={index}
                        className={`relative cursor-pointer rounded-full overflow-hidden hover:ring-2 hover:ring-primary transition-all w-12 h-12
                    ${activeMaterialIndex === index ? 'ring-2 ring-primary' : ''}`}
                        onClick={() => handleMaterialChange(index)}
                    >
                        <img
                            src={material.thumbnail || material.colorMap}
                            alt={`Material ${index + 1}`}
                            className="object-cover"
                        />
                        {/* <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-xs p-1 truncate">
                    {material.name}
                  </div> */}
                    </div>
                ))}
            </div>
        </>
    );
}

export default MaterialSelector;