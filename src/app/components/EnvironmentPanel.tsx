import React, { useState, useEffect } from 'react';
import * as BABYLON from '@babylonjs/core';
import { useOldEditorContext } from '../context/OldEditorContext';
import { getEnvironmentObjects } from '../util/editor/editor-util';

// Import Shadcn UI components
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { ChevronUp, ChevronDown, Settings } from "lucide-react";

const EnvironmentPanel: React.FC = () => {
  const { scene, gizmoManager } = useOldEditorContext();
  const [sunIntensity, setSunIntensity] = useState(0.7);
  const [sunColor, setSunColor] = useState('#FFC080');
  const [sunOrientation, setSunOrientation] = useState(45); // Horizontal angle (0-360)
  const [sunTilt, setSunTilt] = useState(-30); // Vertical angle (-90 to 90)
  const [ambientIntensity, setAmbientIntensity] = useState(0.5);
  const [ambientColor, setAmbientColor] = useState('#FFFFFF');
  
  // Add state for panel expansion
  const [isExpanded, setIsExpanded] = useState(false);
  
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

  // Toggle panel expansion
  const toggleExpansion = () => {
    setIsExpanded(prev => !prev);
  };

  // Update sun intensity
  const handleSunIntensityChange = (values: number[]) => {
    const value = values[0];
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
  const handleAmbientIntensityChange = (values: number[]) => {
    const value = values[0];
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
  const handlePointLightIntensityChange = (index: number, values: number[]) => {
    const value = values[0];
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
    <Card className={`fixed z-50 left-4 bottom-28 shadow-lg transition-all duration-200 ${isExpanded ? 'w-72' : 'w-12'}`}>
      <CardHeader className="pb-2 flex flex-row items-center justify-between p-2">
        {isExpanded ? (
          <>
            <CardTitle className="text-base">Environment</CardTitle>
            <Button variant="ghost" size="icon" onClick={toggleExpansion} className="h-8 w-8">
              <ChevronDown className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <Button variant="ghost" size="icon" onClick={toggleExpansion} className="mx-auto h-8 w-8">
            <Settings className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="h-[calc(100vh-400px)] overflow-y-auto space-y-6">
          {/* Sun Light Section */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Sun Light</h4>
            
            <div className="space-y-3">
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <Label className="text-xs text-muted-foreground">Intensity</Label>
                  <span className="text-xs">{sunIntensity.toFixed(1)}</span>
                </div>
                <Slider 
                  value={[sunIntensity]} 
                  min={0} 
                  max={10} 
                  step={0.1}
                  onValueChange={handleSunIntensityChange}
                />
              </div>
              
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Color</Label>
                <div className="flex items-center space-x-2">
                  <div className="relative w-8 h-8 overflow-hidden rounded-md">
                    <Input
                      type="color"
                      value={sunColor}
                      onChange={handleSunColorChange}
                      className="absolute inset-0 w-10 h-10 border-0"
                    />
                  </div>
                  <span className="text-xs">{sunColor}</span>
                </div>
              </div>
            </div>
            
            <Button 
              variant="default" 
              size="sm" 
              onClick={handleSunSelect}
              className="w-full text-xs"
            >
              Select Sun
            </Button>
          </div>
          
          <Separator />
          
          {/* Ambient Light Section */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Ambient Light</h4>
            
            <div className="space-y-3">
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <Label className="text-xs text-muted-foreground">Intensity</Label>
                  <span className="text-xs">{ambientIntensity.toFixed(1)}</span>
                </div>
                <Slider 
                  value={[ambientIntensity]} 
                  min={0} 
                  max={1} 
                  step={0.1}
                  onValueChange={handleAmbientIntensityChange}
                />
              </div>
              
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Color</Label>
                <div className="flex items-center space-x-2">
                  <div className="relative w-8 h-8 overflow-hidden rounded-md">
                    <Input
                      type="color"
                      value={ambientColor}
                      onChange={handleAmbientColorChange}
                      className="absolute inset-0 w-10 h-10 border-0"
                    />
                  </div>
                  <span className="text-xs">{ambientColor}</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Point Lights Section */}
          {pointLightSettings.map((light, index) => (
            <React.Fragment key={index}>
              <Separator />
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Point Light {index + 1}</h4>
                
                <div className="space-y-3">
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <Label className="text-xs text-muted-foreground">Intensity</Label>
                      <span className="text-xs">{light.intensity.toFixed(1)}</span>
                    </div>
                    <Slider 
                      value={[light.intensity]} 
                      min={0} 
                      max={2} 
                      step={0.1}
                      onValueChange={(values) => handlePointLightIntensityChange(index, values)}
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Color</Label>
                    <div className="flex items-center space-x-2">
                      <div className="relative w-8 h-8 overflow-hidden rounded-md">
                        <Input
                          type="color"
                          value={light.color}
                          onChange={(e) => handlePointLightColorChange(index, e.target.value)}
                          className="absolute inset-0 w-10 h-10 border-0"
                        />
                      </div>
                      <span className="text-xs">{light.color}</span>
                    </div>
                  </div>
                </div>
              </div>
            </React.Fragment>
          ))}
        </CardContent>
      )}
    </Card>
  );
};

export default EnvironmentPanel; 