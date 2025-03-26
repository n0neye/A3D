'use client';

import React, { useState, useEffect } from 'react';
import RatioSelector from './RatioSelector';
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { IconCrop, IconCamera } from '@tabler/icons-react';
import { ImageRatio } from '../util/generation-util';
import { useEditorContext } from '../context/EditorContext';
import { 
  setRatioOverlayRatio, 
  setRatioOverlayPadding, 
  setRatioOverlayVisibility, 
  getEnvironmentObjects 
} from '../util/editor/editor-util';
import { TakeFramedScreenshot } from '../util/render-util';

const RatioPanel: React.FC = () => {
  const { scene, engine } = useEditorContext();
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [padding, setPadding] = useState(10); // Default padding
  const [ratio, setRatio] = useState<ImageRatio>('16:9'); // Default ratio
  
  // Update the actual overlay when state changes
  useEffect(() => {
    if (!scene) return;
    
    setRatioOverlayVisibility(overlayVisible);
    setRatioOverlayPadding(padding, scene);
    setRatioOverlayRatio(ratio, scene);
  }, [overlayVisible, padding, ratio, scene]);

  // Initialize state from current environment overlay settings
  useEffect(() => {
    if (!scene) return;
    
    const env = getEnvironmentObjects();
    if (env.ratioOverlay) {
      setOverlayVisible(env.ratioOverlay.frame.isVisible);
      setPadding(env.ratioOverlay.padding);
      setRatio(env.ratioOverlay.ratio);
    }
  }, [scene]);

  const handleRatioChange = (newRatio: ImageRatio) => {
    setRatio(newRatio);
  };

  const handlePaddingChange = (newValues: number[]) => {
    setPadding(newValues[0]);
  };

  const handleVisibilityChange = (checked: boolean) => {
    setOverlayVisible(checked);
  };

  return (
    <div className="panel-shape max-w-sm p-4 space-y-4 w-64 fixed top-2 right-2">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm">Frame</h3>
        <IconCrop size={18} className="text-gray-400" />
      </div>
      
      <Separator />
      
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Label htmlFor="overlay-visibility" className="text-sm">Show Frame</Label>
          <Switch 
            id="overlay-visibility" 
            checked={overlayVisible}
            onCheckedChange={handleVisibilityChange}
          />
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label htmlFor="ratio-selector" className="text-sm">Aspect Ratio</Label>
            <RatioSelector 
              value={ratio} 
              onChange={handleRatioChange} 
              disabled={!overlayVisible}
            />
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label htmlFor="padding-slider" className="text-sm">Padding</Label>
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
      </div>
    </div>
  );
};

export default RatioPanel; 