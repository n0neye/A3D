import React, { useState, useEffect } from 'react';
import * as BABYLON from '@babylonjs/core';
import { useEditorContext } from '../context/EditorContext';
import { getEnvironmentObjects } from '../util/editor/editor-util';

const EnvironmentPanel: React.FC = () => {
  const { scene, gizmoManager } = useEditorContext();
  const [sunIntensity, setSunIntensity] = useState(0.7);
  const [sunColor, setSunColor] = useState('#FFC080');
  const [ambientIntensity, setAmbientIntensity] = useState(0.5);
  const [ambientColor, setAmbientColor] = useState('#FFFFFF');

  // Initialize values from scene
  useEffect(() => {
    const env = getEnvironmentObjects();
    if (env.sun) {
      setSunIntensity(env.sun.intensity);
      setSunColor(colorToHex(env.sun.diffuse));
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
      
      // Also update the sun sphere material if it exists
      const sunSphere = scene?.getMeshByName('sunSphere');
      if (sunSphere && sunSphere.material instanceof BABYLON.StandardMaterial) {
        sunSphere.material.emissiveColor = hexToColor3(value);
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

  // Select the sun for positioning
  const handleSelectSun = () => {
    const env = getEnvironmentObjects();
    if (env.sun && gizmoManager && scene) {
      console.log("env.sun", env.sun);
      // Create a transform node if the light doesn't have a mesh
      gizmoManager.attachToNode(env.sun);
      gizmoManager.rotationGizmoEnabled = true;
      
      // let sunSphere = scene.getMeshByName('sunSphere');
      // if (sunSphere) {
      //   // Attach gizmo to the sun sphere
      //   gizmoManager.positionGizmoEnabled = true;
      //   gizmoManager.rotationGizmoEnabled = false;
      //   gizmoManager.scaleGizmoEnabled = false;
      //   gizmoManager.attachToMesh(sunSphere);
        
      //   // Update the light direction when the sphere moves
      //   scene.onBeforeRenderObservable.add(() => {
      //     if (env.sun && sunSphere) {
      //       // Update light direction to point from the sun sphere to the origin
      //       const direction = BABYLON.Vector3.Zero().subtract(sunSphere.position).normalize();
      //       env.sun.direction = direction;
      //     }
      //   });
      // }
    }
  };

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
          className="py-1 text-xs bg-blue-600 hover:bg-blue-700 rounded text-white px-2 mt-1"
          onClick={handleSelectSun}
        >
          Select Sun
        </button>
      </div>
      
      <div className="mb-3 flex flex-col space-y-4">
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
    </div>
  );
};

export default EnvironmentPanel; 