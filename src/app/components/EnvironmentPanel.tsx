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

  // Initialize values from scene
  useEffect(() => {
    const env = getEnvironmentObjects();
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

  // Update sun orientation (horizontal angle)
  const handleSunOrientationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    updateSunDirection(value, sunTilt);
    setSunOrientation(value);
  };

  // Update sun tilt (vertical angle)
  const handleSunTiltChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    updateSunDirection(sunOrientation, value);
    setSunTilt(value);
  };

  // Update the sun's direction based on orientation and tilt angles
  const updateSunDirection = (orientation: number, tilt: number) => {
    const env = getEnvironmentObjects();
    if (env.sun) {
      // Convert angles to radians
      const orientationRad = orientation * (Math.PI / 180);
      const tiltRad = tilt * (Math.PI / 180);

      // Calculate the direction vector
      // X = sin(orientation) * cos(tilt)
      // Y = -sin(tilt)
      // Z = cos(orientation) * cos(tilt)
      const x = Math.sin(orientationRad) * Math.cos(tiltRad);
      const y = -Math.sin(tiltRad); // Negative because we want positive tilt to move the sun up
      const z = Math.cos(orientationRad) * Math.cos(tiltRad);

      // Update the light direction
      env.sun.direction = new BABYLON.Vector3(x, y, z).normalize();
      
      // Find and update the arrow rotation
      const sunArrow = scene?.getMeshByName('sunArrow');
      if (sunArrow) {
        // Calculate rotation quaternion from the direction vector
        // We need to point the arrow in the opposite direction of the light
        const up = new BABYLON.Vector3(0, 1, 0); // Default up vector
        
        // First create a rotation that aligns with the Y axis
        const baseRotation = BABYLON.Quaternion.RotationAxis(
          new BABYLON.Vector3(1, 0, 0), // X axis
          Math.PI // 180 degrees to point down initially
        );
        
        // Now rotate to match the light direction
        const targetDir = env.sun.direction.scale(-1); // Opposite direction
        
        // Create a rotation from the default direction (negative Y) to the target direction
        // Default arrow points in negative Y direction after base rotation
        const defaultDir = new BABYLON.Vector3(0, -1, 0);
        const rotationMatrix = BABYLON.Matrix.Zero();
        BABYLON.Matrix.LookAtLHToRef(
          BABYLON.Vector3.Zero(), 
          targetDir,
          new BABYLON.Vector3(0, 0, 1), // Up vector
          rotationMatrix
        );
        // Get quaternion from the matrix
        const rotationToTarget = BABYLON.Quaternion.FromRotationMatrix(rotationMatrix);
        
        // Combine rotations: first the base rotation, then the target rotation
        const finalRotation = baseRotation.multiply(rotationToTarget);
        
        // Apply rotation
        sunArrow.rotationQuaternion = finalRotation;
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

        {/* Sun Direction Controls */}
        <div className="flex items-center mb-1">
          <span className="text-xs w-16 text-gray-400">Orient</span>
          <input
            type="range"
            min="0"
            max="360"
            step="1"
            value={sunOrientation}
            onChange={handleSunOrientationChange}
            className="w-32"
          />
          <span className="text-xs ml-2">{sunOrientation}°</span>
        </div>
        <div className="flex items-center mb-1">
          <span className="text-xs w-16 text-gray-400">Tilt</span>
          <input
            type="range"
            min="-90"
            max="90"
            step="1"
            value={sunTilt}
            onChange={handleSunTiltChange}
            className="w-32"
          />
          <span className="text-xs ml-2">{sunTilt.toFixed(0)}°</span>
        </div>
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