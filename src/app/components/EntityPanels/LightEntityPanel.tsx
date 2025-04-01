import React, { useEffect, useState, useRef, useCallback } from 'react';

import { useEditorContext } from '../../context/EditorContext';
import { EntityBase, } from '../../util/extensions/EntityBase';
import { Slider } from '@/components/ui/slider';
import * as BABYLON from '@babylonjs/core';
import { LightEntity } from '../../util/extensions/LightEntity';

function LightEntityPanel(props: { entity: LightEntity }) {
    // State for light settings
    const [lightColor, setLightColor] = useState('#FFFFFF');
    const [lightIntensity, setLightIntensity] = useState(0.7);

    // Update when selected entity changes
    useEffect(() => {
        // Set the new entity
        if (props.entity) {

            // Handle light entity initialization
            // Find the point light that's a child of this entity
            const pointLight = props.entity.light;
            if (pointLight) {
                // Initialize color state
                const color = pointLight.diffuse;
                setLightColor(rgbToHex(color.r, color.g, color.b));

                // Initialize intensity state
                setLightIntensity(pointLight.intensity);
            }
        }
    }, [props.entity]);


    // Convert RGB to hex color
    const rgbToHex = (r: number, g: number, b: number): string => {
        return "#" + ((1 << 24) + (Math.round(r * 255) << 16) + (Math.round(g * 255) << 8) + Math.round(b * 255)).toString(16).slice(1);
    };

    // Convert hex color to RGB
    const hexToRgb = (hex: string): { r: number, g: number, b: number } => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16) / 255,
            g: parseInt(result[2], 16) / 255,
            b: parseInt(result[3], 16) / 255
        } : { r: 1, g: 1, b: 1 };
    };

    // Handle light color change
    const handleLightColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newColor = e.target.value;
        setLightColor(newColor);

        // Update the actual light
        const pointLight = props.entity.light;
        const rgb = hexToRgb(newColor);
        pointLight.diffuse = new BABYLON.Color3(rgb.r, rgb.g, rgb.b);
        pointLight.specular = new BABYLON.Color3(rgb.r, rgb.g, rgb.b);

        // Also update the visual representation
        const lightSphere = props.entity.gizmoMesh;
        if (lightSphere && lightSphere.material instanceof BABYLON.StandardMaterial) {
            lightSphere.material.emissiveColor = new BABYLON.Color3(rgb.r, rgb.g, rgb.b);
        }

        // Update data
        props.entity.props.color = { r: rgb.r, g: rgb.g, b: rgb.b };
    };

    // Handle light intensity change
    const handleLightIntensityChange = (value: number[]) => {
        const newIntensity = value[0];
        setLightIntensity(newIntensity);

        // Update the actual light
        const pointLight = props.entity.light;
        pointLight.intensity = newIntensity;

        props.entity.props.intensity = newIntensity;
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