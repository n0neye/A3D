import React, { useState, useEffect } from 'react';
import * as BABYLON from '@babylonjs/core';
import { useEditorContext } from '../context/EditorContext';
import { getEnvironmentObjects } from '../util/editor/editor-util';

const EnvironmentPanel: React.FC = () => {
  const { scene, gizmoManager } = useEditorContext();
  const [sunIntensity, setSunIntensity] = useState(0.7);
  const [sunColor, setSunColor] = useState('#FFC080');
  const [sunOrientation, setSunOrientation] = useState(45); // Horizontal angle (0-360)
  const [sunTilt, setSunTilt] = useState(-30); // Vertical angle (-90 to 90)
  const [ambientIntensity, setAmbientIntensity] = useState(0.5);
  const [ambientColor, setAmbientColor] = useState('#FFFFFF');
  
  // State for point lights
  const [pointLightSettings, setPointLightSettings] = useState<{
    intensity: number;
    color: string;
  }[]>([
    {
      intensity: 0.7,
      color: '#FFC080'
    },
    {
      intensity: 0.7,
      color: '#0080FF'
    }
  ]);

  // Initialize values from scene
  useEffect(() => {
    const env = getEnvironmentObjects();
    
    // Existing initialization code for sun and ambient light
    if (env.sun) {
      setSunIntensity(env.sun.intensity);
      setSunColor(colorToHex(env.sun.diffuse));

      // Calculate initial direction angles from the light's direction
      const direction = env.sun.direction;
      const tilt = -Math.asin(direction.y) * (180 / Math.PI); // Convert to degrees
      const orientation = Math.atan2(direction.x, direction.z) * (180 / Math.PI);

      setSunOrientation(orientation);
      setSunTilt(tilt);
    }
    if (env.ambientLight) {
      setAmbientIntensity(env.ambientLight.intensity);
      setAmbientColor(colorToHex(env.ambientLight.diffuse));
    }
    
  }, []);

  // Update sun intensity
  const handleSunIntensityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setSunIntensity(value);
    const env = getEnvironmentObjects();
    if (env.sun) {
      env.sun.intensity = value;
    }
  };

  // Update sun color
  const handleSunColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSunColor(value);
    const env = getEnvironmentObjects();
    if (env.sun) {
      env.sun.diffuse = hexToColor3(value);

      // Also update the sun arrow material if it exists
      const sunArrow = scene?.getMeshByName('sunArrow');
      if (sunArrow) {
        sunArrow.getChildMeshes().forEach(mesh => {
          if (mesh.material && mesh.material instanceof BABYLON.StandardMaterial) {
            mesh.material.emissiveColor = hexToColor3(value);
          }
        });
      }
    }
  };

  // Update ambient light intensity
  const handleAmbientIntensityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setAmbientIntensity(value);
    const env = getEnvironmentObjects();
    if (env.ambientLight) {
      env.ambientLight.intensity = value;
    }
  };

  // Update ambient light color
  const handleAmbientColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setAmbientColor(value);
    const env = getEnvironmentObjects();
    if (env.ambientLight) {
      env.ambientLight.diffuse = hexToColor3(value);
    }
  };

  // New handlers for point lights
  
  // Update point light intensity
  const handlePointLightIntensityChange = (index: number, value: number) => {
    setPointLightSettings(prev => {
      const updated = [...prev];
      updated[index].intensity = value;
      return updated;
    });
    
    const env = getEnvironmentObjects();
    if (env.pointLights && env.pointLights[index]) {
      env.pointLights[index].intensity = value;
    }
  };
  
  // Update point light color
  const handlePointLightColorChange = (index: number, value: string) => {
    setPointLightSettings(prev => {
      const updated = [...prev];
      updated[index].color = value;
      return updated;
    });
    
    const env = getEnvironmentObjects();
    if (env.pointLights && env.pointLights[index]) {
      env.pointLights[index].diffuse = hexToColor3(value);
    }
  };

  const handleSunSelect = () => {
    // Select the sun
    const env = getEnvironmentObjects();
    const sunTransform = env.sunTransform;
    if (sunTransform && gizmoManager) {
      gizmoManager.attachToNode(sunTransform);
      gizmoManager.positionGizmoEnabled = false;
      gizmoManager.rotationGizmoEnabled = true;
      gizmoManager.scaleGizmoEnabled = false;
    }
    // Show arrow
    const sunArrow = env.sunArrow;
    if (sunArrow) {
      sunArrow.isVisible = true;
    }
  }

  // Helper function to convert Color3 to hex string
  const colorToHex = (color: BABYLON.Color3): string => {
    const r = Math.round(color.r * 255).toString(16).padStart(2, '0');
    const g = Math.round(color.g * 255).toString(16).padStart(2, '0');
    const b = Math.round(color.b * 255).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  };

  // Helper function to convert hex string to Color3
  const hexToColor3 = (hex: string): BABYLON.Color3 => {
    const r = parseInt(hex.substring(1, 3), 16) / 255;
    const g = parseInt(hex.substring(3, 5), 16) / 255;
    const b = parseInt(hex.substring(5, 7), 16) / 255;
    return new BABYLON.Color3(r, g, b);
  };

  return (
    <div className={`fixed z-50 left-4 bottom-28 w-64 panel h-96 overflow-y-auto`} >
      <h3 className="text-base font-bold mb-6">Environment</h3>

      <div className="mb-6 flex flex-col space-y-4">
        <div className="text-xs font-medium mb-1">Sun Light</div>
        <div className="flex items-center mb-1">
          <span className="text-xs w-16 text-gray-400">Intensity</span>
          <input
            type="range"
            min="0"
            max="10"
            step="0.1"
            value={sunIntensity}
            onChange={handleSunIntensityChange}
            className="w-32"
          />
          <span className="text-xs ml-2">{sunIntensity.toFixed(1)}</span>
        </div>
        <div className="flex items-center mb-1">
          <span className="text-xs w-16 text-gray-400">Color</span>
          <input
            type="color"
            value={sunColor}
            onChange={handleSunColorChange}
            className="w-8 h-6 mr-2"
          />
          <span className="text-xs">{sunColor}</span>
        </div>

        <button
          className="w-full bg-blue-500 text-white text-xs p-2 rounded hover:bg-blue-600 h-8"
          onClick={handleSunSelect}>Select Sun</button>
      </div>

      <div className="mb-6 flex flex-col space-y-4">
        <div className="text-xs font-medium mb-1 ">Ambient Light</div>
        <div className="flex items-center mb-1">
          <span className="text-xs w-16 text-gray-400">Intensity</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={ambientIntensity}
            onChange={handleAmbientIntensityChange}
            className="w-32"
          />
          <span className="text-xs ml-2">{ambientIntensity.toFixed(1)}</span>
        </div>
        <div className="flex items-center mb-1">
          <span className="text-xs w-16 text-gray-400">Color</span>
          <input
            type="color"
            value={ambientColor}
            onChange={handleAmbientColorChange}
            className="w-8 h-6 mr-2"
          />
          <span className="text-xs">{ambientColor}</span>
        </div>
      </div>
      
      {/* Point Lights Section */}
      {pointLightSettings.map((light, index) => (
        <div key={index} className="mb-6 flex flex-col space-y-4">
          <div className="text-xs font-medium mb-1">Point Light {index + 1}</div>
          <div className="flex items-center mb-1">
            <span className="text-xs w-16 text-gray-400">Intensity</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={light.intensity}
              onChange={(e) => handlePointLightIntensityChange(index, parseFloat(e.target.value))}
              className="w-32"
            />
            <span className="text-xs ml-2">{light.intensity.toFixed(1)}</span>
          </div>
          <div className="flex items-center mb-1">
            <span className="text-xs w-16 text-gray-400">Color</span>
            <input
              type="color"
              value={light.color}
              onChange={(e) => handlePointLightColorChange(index, e.target.value)}
              className="w-8 h-6 mr-2"
            />
            <span className="text-xs">{light.color}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default EnvironmentPanel; 