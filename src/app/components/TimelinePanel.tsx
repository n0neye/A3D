/**
 * TimelinePanel.tsx
 * 
 * React component for controlling animation timeline
 * Provides UI for:
 * - Playing/pausing animation
 * - Scrubbing through timeline
 * - Adding keyframes to camera and entities
 * - Visualizing keyframes on the timeline
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useEditorEngine } from '../context/EditorEngineContext';
import { Button } from "@/components/ui/button";
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { RefreshCw, Play, Pause, Plus, Camera } from 'lucide-react';

// Keyframe data type
interface Keyframe {
  entityId: string;
  property: string;
  time: number;
}

export default function TimelinePanel() {
  const { engine, selectedEntity } = useEditorEngine();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [maxTime, setMaxTime] = useState(10); // Default timeline duration in seconds
  const [keyframes, setKeyframes] = useState<Keyframe[]>([]);

  // Subscribe to timeline events
  useEffect(() => {
    if (!engine) return;

    console.log('TimelinePanel: Subscribing to timeline events');
    const timelineManager = engine.getTimelineManager();
    
    const unsubPlaybackChanged = timelineManager.observers.subscribe(
      'playbackStateChanged',
      ({ isPlaying }) => {
        console.log('TimelinePanel: Playback state changed to:', isPlaying);
        setIsPlaying(isPlaying);
      }
    );
    
    const unsubTimeUpdated = timelineManager.observers.subscribe(
      'timelineUpdated',
      ({ time }) => {
        console.log('TimelinePanel: Timeline updated to time:', time);
        setCurrentTime(time);
      }
    );

    // Subscribe to keyframe added events
    const unsubKeyframeAdded = timelineManager.observers.subscribe(
      'keyframeAdded',
      ({ entityId, property, time }) => {
        console.log('TimelinePanel: Keyframe added:', { entityId, property, time });
        setKeyframes(prev => [...prev, { entityId, property, time }]);
      }
    );
    
    // Log information about the timeline manager
    console.log('TimelinePanel: TimelineManager instance:', timelineManager);
    
    // Cleanup subscriptions
    return () => {
      console.log('TimelinePanel: Cleaning up timeline subscriptions');
      unsubPlaybackChanged();
      unsubTimeUpdated();
      unsubKeyframeAdded();
    };
  }, [engine]);

  // Handle timeline scrubbing
  const handleScrub = (values: number[]) => {
    const time = values[0];
    console.log('TimelinePanel: User scrubbed to time:', time);
    setCurrentTime(time);
    engine.scrubTimeline(time);
  };

  // Handle playback toggle
  const handlePlayPause = () => {
    console.log('TimelinePanel: User toggled play/pause, current state:', isPlaying);
    engine.toggleTimelinePlayback();
  };

  // Add all camera keyframes at once
  const addAllCameraKeyframes = () => {
    console.log('TimelinePanel: Adding all camera keyframes');
    engine.addCameraAllKeyframes();
  };

  // Add keyframe to selected entity
  const addEntityPositionKeyframe = () => {
    if (selectedEntity) {
      console.log('TimelinePanel: Adding entity position keyframe for:', selectedEntity.name);
      engine.addEntityKeyframe(selectedEntity, 'position');
    }
  };

  const addEntityRotationKeyframe = () => {
    if (selectedEntity) {
      console.log('TimelinePanel: Adding entity rotation keyframe for:', selectedEntity.name);
      engine.addEntityKeyframe(selectedEntity, 'rotation');
    }
  };

  const addEntityScaleKeyframe = () => {
    if (selectedEntity) {
      console.log('TimelinePanel: Adding entity scale keyframe for:', selectedEntity.name);
      engine.addEntityKeyframe(selectedEntity, 'scale');
    }
  };

  // Filter keyframes for camera only
  const cameraKeyframes = useMemo(() => {
    return keyframes.filter(kf => kf.entityId === 'camera');
  }, [keyframes]);

  // Filter keyframes for the selected entity
  const selectedEntityKeyframes = useMemo(() => {
    if (!selectedEntity) return [];
    return keyframes.filter(kf => kf.entityId === selectedEntity.entityId);
  }, [keyframes, selectedEntity]);

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
      
      {/* Timeline scrubber with keyframe markers */}
      <div className="relative">
        <Slider
          value={[currentTime]}
          min={0}
          max={maxTime}
          step={0.01}
          onValueChange={handleScrub}
          className="w-full"
        />
        
        {/* Camera Keyframe Markers */}
        <div className="absolute top-0 left-0 right-0 h-full pointer-events-none">
          {cameraKeyframes.map((kf, idx) => {
            const leftPos = (kf.time / maxTime) * 100;
            const color = kf.property === 'position' ? 'bg-blue-500' : 
                        kf.property === 'rotation' ? 'bg-green-500' : 'bg-yellow-500';
            
            return (
              <div 
                key={`camera-${kf.property}-${idx}`}
                className={`absolute top-0 w-1 h-4 ${color} rounded-full transform -translate-x-1/2`} 
                style={{ left: `${leftPos}%` }}
                title={`Camera ${kf.property} at ${kf.time.toFixed(2)}s`}
              />
            );
          })}
        </div>
      </div>
      
      {/* Camera keyframe controls */}
      <div className="mt-2">
        <div className="text-sm font-medium text-zinc-300 mb-2">Camera</div>
        <div className="flex gap-2">
          <Button
            variant="outline" 
            size="sm"
            onClick={addAllCameraKeyframes}
            className="h-7 text-xs"
          >
            <Camera className="h-3 w-3 mr-1" /> Add Keyframe
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