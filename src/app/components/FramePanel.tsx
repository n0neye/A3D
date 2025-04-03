'use client';

import React, { useState, useEffect } from 'react';
import RatioSelector from './RatioSelector';
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { IconVideo } from '@tabler/icons-react';
import { ImageRatio } from '../util/generation/generation-util';
import { useEditorEngine } from '../context/EditorEngineContext';

const FramePanel: React.FC = () => {
  const { engine } = useEditorEngine();
  
  // Local state to manage UI
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [padding, setPadding] = useState(10);
  const [rightExtraPadding, setRightExtraPadding] = useState(0);
  const [ratio, setRatio] = useState<ImageRatio>('16:9');
  const [fov, setFov] = useState(0.8);
  const [farClip, setFarClip] = useState(20);
  const [isGizmoVisible, setIsGizmoVisible] = useState(true);

  // Initialize state from camera manager settings
  useEffect(() => {
    if (!engine) return;
    // Get initial camera settings
    const cameraManager = engine.getCameraManager();
    const cameraSettings = cameraManager.getCameraSettings();
    setFov(cameraSettings.fov);
    setFarClip(cameraSettings.farClip);
    
    // Get initial ratio overlay settings
    const overlaySettings = cameraManager.getRatioOverlaySettings();
    setOverlayVisible(overlaySettings.isVisible);
    setPadding(overlaySettings.padding);
    setRightExtraPadding(overlaySettings.rightExtraPadding);
    setRatio(overlaySettings.ratio);
    
    // Set up event listeners for settings changes
    const fovChangedHandler = (newFOV: number) => setFov(newFOV);
    const farClipChangedHandler = (newFarClip: number) => setFarClip(newFarClip);
    const visibilityChangedHandler = (visible: boolean) => setOverlayVisible(visible);
    const paddingChangedHandler = (newPadding: number) => setPadding(newPadding);
    const rightPaddingChangedHandler = (newPadding: number) => setRightExtraPadding(newPadding);
    const ratioChangedHandler = (newRatio: ImageRatio) => setRatio(newRatio);
    
    cameraManager.events.on('fovChanged', fovChangedHandler);
    cameraManager.events.on('farClipChanged', farClipChangedHandler);
    cameraManager.events.on('ratioOverlayVisibilityChanged', visibilityChangedHandler);
    cameraManager.events.on('ratioOverlayPaddingChanged', paddingChangedHandler);
    cameraManager.events.on('ratioOverlayRightPaddingChanged', rightPaddingChangedHandler);
    cameraManager.events.on('ratioOverlayRatioChanged', ratioChangedHandler);
    
    // Cleanup event listeners
    return () => {
      cameraManager.events.off('fovChanged', fovChangedHandler);
      cameraManager.events.off('farClipChanged', farClipChangedHandler);
      cameraManager.events.off('ratioOverlayVisibilityChanged', visibilityChangedHandler);
      cameraManager.events.off('ratioOverlayPaddingChanged', paddingChangedHandler);
      cameraManager.events.off('ratioOverlayRightPaddingChanged', rightPaddingChangedHandler);
      cameraManager.events.off('ratioOverlayRatioChanged', ratioChangedHandler);
    };
  }, [engine]);

  // Event handlers
  const handleRatioChange = (newRatio: ImageRatio) => {
    setRatio(newRatio);
    engine.getCameraManager().setRatioOverlayRatio(newRatio);
  };

  const handlePaddingChange = (newValues: number[]) => {
    setPadding(newValues[0]);
    engine.getCameraManager().setRatioOverlayPadding(newValues[0]);
  };

  const handleRightExtraPaddingChange = (newValues: number[]) => {
    setRightExtraPadding(newValues[0]);
    engine.getCameraManager().setRatioOverlayRightPadding(newValues[0]);
  };

  const handleVisibilityChange = (checked: boolean) => {
    setOverlayVisible(checked);
    engine.getCameraManager().setRatioOverlayVisibility(checked);
  };

  const handleFovChange = (newValues: number[]) => {
    setFov(newValues[0]);
    engine.getCameraManager().setFOV(newValues[0]);
  };

  const handleFarClipChange = (newValues: number[]) => {
    setFarClip(newValues[0]);
    engine.getCameraManager().setFarClip(newValues[0]);
  };

  const handleGizmoVisibilityChange = (checked: boolean) => {
    setIsGizmoVisible(checked);
    engine.getRenderService().setAllGizmoVisibility(checked);
  };

  // Convert radians to degrees for display
  const fovDegrees = Math.round(fov * 180 / Math.PI);

  return (
    <div className='group relative'>
      <Button
        variant={'outline'}
        size="icon"
        aria-label="position gizmo"
        className='relative'
      >
        <IconVideo className="h-4 w-4" />
      </Button>
      <div className="hidden group-hover:block absolute top-8 pt-5 left-1/2 -translate-x-1/2">
      <div className="panel-shape max-w-sm p-4 space-y-4 w-48 ">

        <div className="space-y-4">
          
        <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label htmlFor="fov-slider" className="text-xs">Field of View</Label>
              <span className="text-xs text-gray-400">{fovDegrees}°</span>
            </div>
            <Slider
              id="fov-slider"
              value={[fov]}
              min={0.35}
              max={1.57}
              step={0.01}
              onValueChange={handleFovChange}
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label htmlFor="far-clip-slider" className="text-xs">Far Clip</Label>
              <span className="text-xs text-gray-400">{farClip}</span>
            </div>
            <Slider
              id="far-clip-slider"
              value={[farClip]}
              min={10}
              max={200}
              step={10}
              onValueChange={handleFarClipChange}
            />
          </div>

          <Separator />
          
          <div className="flex justify-between items-center">
            <Label htmlFor="gizmo-visibility" className="text-xs">
              Gizmos
              <span className="text-xs opacity-70">[x]</span>
            </Label>
            
            <Switch
              id="gizmo-visibility"
              checked={isGizmoVisible}
              onCheckedChange={handleGizmoVisibilityChange}
            />
          </div>
          
          <div className="flex justify-between items-center">
            <Label htmlFor="overlay-visibility" className="text-xs">Frame</Label>
            <Switch
              id="overlay-visibility"
              checked={overlayVisible}
              onCheckedChange={handleVisibilityChange}
            />
          </div>


          {/* <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label htmlFor="ratio-selector" className="text-xs">Aspect Ratio</Label>
              <RatioSelector
                value={ratio}
                onChange={handleRatioChange}
                disabled={!overlayVisible}
              />
            </div>
          </div> */}

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label htmlFor="padding-slider" className="text-xs">Padding</Label>
              <span className="text-xs text-gray-400">{padding}%</span>
            </div>
            <Slider
              id="padding-slider"
              disabled={!overlayVisible}
              value={[padding]}
              min={0}
              max={30}
              step={1}
              onValueChange={handlePaddingChange}
            />
          </div>

          {/* <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label htmlFor="right-extra-padding-slider" className="text-xs">Right Extra Padding</Label>
              <span className="text-xs text-gray-400">{rightExtraPadding}%</span>
            </div>
            <Slider
              id="right-extra-padding-slider"
              disabled={!overlayVisible}
              value={[rightExtraPadding]}
              min={0}
              max={30}
              step={1}
              onValueChange={handleRightExtraPaddingChange}
            />
          </div> */}

        </div>
      </div></div></div>
  );
};

export default FramePanel; 