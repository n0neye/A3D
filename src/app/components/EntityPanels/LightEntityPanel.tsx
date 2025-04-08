import React, { useEffect, useState } from 'react';

import { Slider } from '@/components/ui/slider';
import { LightEntity } from '@/app/engine/entity/types/LightEntity';

function LightEntityPanel(props: { entity: LightEntity }) {
    // State for light settings
    const [lightColor, setLightColor] = useState('#FFFFFF');
    const [lightIntensity, setLightIntensity] = useState(0.7);

    // Update when selected entity changes
    useEffect(() => {
        if (props.entity) {
            // Initialize color state using entity's method
            setLightColor(props.entity.getColorAsHex());

            // Initialize intensity state
            setLightIntensity(props.entity._light.intensity);
        }
    }, [props.entity]);

    // Handle light color change
    const handleLightColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newColor = e.target.value;
        setLightColor(newColor);

        // Update the entity using its method
        props.entity.setColorFromHex(newColor);
    };

    // Handle light intensity change
    const handleLightIntensityChange = (value: number[]) => {
        const newIntensity = value[0];
        setLightIntensity(newIntensity);

        // Update the entity
        props.entity.setIntensity(newIntensity);
    };

    return (
        <>
            <div className="flex flex-col space-y-2 w-80">
                <div className="flex items-center space-x-2">
                    <label className="text-xs text-white w-20">Color</label>
                    <input
                        type="color"
                        value={lightColor}
                        onChange={handleLightColorChange}
                        className="w-8 h-8 bg-transparent border-none cursor-pointer rounded-full"
                    />
                    <span className="text-xs text-white">{lightColor}</span>
                </div>

                <div className="flex items-center space-x-2">
                    <label className="text-xs text-white w-20">Intensity</label>
                    <Slider
                        value={[lightIntensity]}
                        min={0}
                        max={2}
                        step={0.05}
                        className="w-32"
                        onValueChange={handleLightIntensityChange}
                    />
                    <span className="text-xs text-white w-10 text-right">{lightIntensity.toFixed(2)}</span>
                </div>
            </div>
        </>
    );
}

export default LightEntityPanel;