/**
 * TimelinePanel.tsx
 * 
 * React component for controlling animation timeline
 * Provides UI for:
 * - Playing/pausing animation
 * - Scrubbing through timeline
 * - Adding keyframes to camera and entities
 */
import React, { useState, useEffect } from 'react';
import { useEditorEngine } from '../context/EditorEngineContext';
import { Button } from "@/components/ui/button";
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { RefreshCw, Play, Pause, Plus } from 'lucide-react';

export default function TimelinePanel() {
  const { engine, selectedEntity } = useEditorEngine();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [maxTime, setMaxTime] = useState(10); // Default timeline duration in seconds

  // Subscribe to timeline events
  useEffect(() => {
    if (!engine) return;

    const timelineManager = engine.getTimelineManager();
    
    const unsubPlaybackChanged = timelineManager.observers.subscribe(
      'playbackStateChanged',
      ({ isPlaying }) => setIsPlaying(isPlaying)
    );
    
    const unsubTimeUpdated = timelineManager.observers.subscribe(
      'timelineUpdated',
      ({ time }) => setCurrentTime(time)
    );

    // Cleanup subscriptions
    return () => {
      unsubPlaybackChanged();
      unsubTimeUpdated();
    };
  }, [engine]);

  // Handle timeline scrubbing
  const handleScrub = (values: number[]) => {
    const time = values[0];
    setCurrentTime(time);
    engine.scrubTimeline(time);
  };

  // Handle playback toggle
  const handlePlayPause = () => {
    engine.toggleTimelinePlayback();
  };

  // Add keyframe to camera
  const addCameraPositionKeyframe = () => {
    engine.addCameraKeyframe('position');
  };

  const addCameraRotationKeyframe = () => {
    engine.addCameraKeyframe('rotation');
  };

  const addCameraFOVKeyframe = () => {
    engine.addCameraKeyframe('fov');
  };

  // Add keyframe to selected entity
  const addEntityPositionKeyframe = () => {
    if (selectedEntity) {
      engine.addEntityKeyframe(selectedEntity, 'position');
    }
  };

  const addEntityRotationKeyframe = () => {
    if (selectedEntity) {
      engine.addEntityKeyframe(selectedEntity, 'rotation');
    }
  };

  const addEntityScaleKeyframe = () => {
    if (selectedEntity) {
      engine.addEntityKeyframe(selectedEntity, 'scale');
    }
  };

  return (
    <div className="flex flex-col gap-4 bg-zinc-950 rounded-lg p-4 w-full">
      <div className="text-white font-medium">Timeline</div>
      <Separator className="bg-zinc-800" />
      
      {/* Playback controls */}
      <div className="flex items-center gap-2">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={handlePlayPause}
          className="h-8 w-8"
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <div className="text-xs text-zinc-400">
          {currentTime.toFixed(2)}s / {maxTime.toFixed(2)}s
        </div>
      </div>
      
      {/* Timeline scrubber */}
      <Slider
        value={[currentTime]}
        min={0}
        max={maxTime}
        step={0.01}
        onValueChange={handleScrub}
        className="w-full"
      />
      
      {/* Camera keyframe controls */}
      <div className="mt-2">
        <div className="text-sm font-medium text-zinc-300 mb-2">Camera</div>
        <div className="flex gap-2">
          <Button
            variant="outline" 
            size="sm"
            onClick={addCameraPositionKeyframe}
            className="h-7 text-xs"
          >
            <Plus className="h-3 w-3 mr-1" /> Position
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={addCameraRotationKeyframe}
            className="h-7 text-xs"
          >
            <Plus className="h-3 w-3 mr-1" /> Rotation
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={addCameraFOVKeyframe}
            className="h-7 text-xs"
          >
            <Plus className="h-3 w-3 mr-1" /> FOV
          </Button>
        </div>
      </div>
      
      {/* Entity keyframe controls */}
      {selectedEntity && (
        <div className="mt-2">
          <div className="text-sm font-medium text-zinc-300 mb-2">
            {selectedEntity.name}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={addEntityPositionKeyframe}
              className="h-7 text-xs"
            >
              <Plus className="h-3 w-3 mr-1" /> Position
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={addEntityRotationKeyframe}
              className="h-7 text-xs"
            >
              <Plus className="h-3 w-3 mr-1" /> Rotation
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={addEntityScaleKeyframe}
              className="h-7 text-xs"
            >
              <Plus className="h-3 w-3 mr-1" /> Scale
            </Button>
          </div>
        </div>
      )}
    </div>
  );
} 