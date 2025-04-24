import React, { useEffect, useState } from 'react';

import { Slider } from '@/components/ui/slider';
import { LightEntity } from '@/engine/entity/types/LightEntity';
import ColorPickerMenu from '../ColorPickerMenu';

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
    const handleLightColorChange = (newColor: string) => {
        // Update the entity using its method
        setLightColor(newColor);
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
            <div className="flex flex-row space-x-2 p-1 px-2">
                <ColorPickerMenu color={lightColor} onColorChange={handleLightColorChange} />

                <div className="flex items-center space-x-1">
                    <Slider
                        value={[lightIntensity]}
                        min={0}
                        max={2}
                        step={0.05}
                        className="w-24"
                        onValueChange={handleLightIntensityChange}
                    />
                    <span className="text-xs text-left">{lightIntensity.toFixed(2)}</span>
                </div>
            </div>
        </>
    );
}

export default LightEntityPanel;