'use client';

import React, { useEffect, useRef, useState } from 'react';
import { TimelineManager } from '../engine/managers/timeline/TimelineManager';
import { Track, IKeyframe } from '../engine/managers/timeline/Track';
import { useEditorEngine } from '../context/EditorEngineContext';
import { Button } from "@/components/ui/button";
import {
    ChevronLeft,
    ChevronRight,
    Diamond,
    PauseIcon,
    PlayIcon,
    PlusIcon
} from 'lucide-react';
import { EntityBase } from '../engine/entity/base/EntityBase';
import { CharacterEntity } from '../engine/entity/types/CharacterEntity';

function TimelinePanel({ timelineManager }: { timelineManager: TimelineManager }) {
    // States
    const { engine, selectedEntity } = useEditorEngine();
    const [tracks, setTracks] = useState<Track<any>[]>([]);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(5); // Default duration
    const [isPlaying, setIsPlaying] = useState(false);
    const [activeTrack, setActiveTrack] = useState<Track<any> | null>(null);
    const [selectedKeyframe, setSelectedKeyframe] = useState<IKeyframe | null>(null);

    // Refs
    const timelineRef = useRef<HTMLDivElement>(null);
    const isDraggingPlayhead = useRef(false);
    const isDraggingKeyframe = useRef(false);
    const draggedKeyframeData = useRef<{
        track: Track<any>;
        keyframe: IKeyframe;
        originalTime: number;
    } | null>(null);

    // Theme
    const theme = {
        timelineStart: 180,
        trackHeight: 30,
        headerHeight: 15,
        keyframeRadius: 6,
        activeTrackColor: 'rgba(0, 0, 0, 0.1)',
        inactiveTrackColor: 'rgba(0, 0, 0, 0)',
        activeKeyframeColor: '#ffcc00',
        inactiveKeyframeColor: '#aaaaaa',
        activeKeyframeHoverColor: '#ffdd33',
        inactiveKeyframeHoverColor: '#cccccc',
        playheadColor: '#ffffff',
        textColor: '#cccccc',
        activeTextColor: '#ffffff',
        timeTickColor: '#666666',
        buttonWidth: 40,
        buttonHeight: 20,
        buttonRadius: 5,
        buttonColor: '#444444',
        buttonHoverColor: '#555555',
        playButtonColor: '#55aa55',
        pauseButtonColor: '#cc5555',
        keyframeButtonColor: '#6666aa'
    };

    // Initialize and set up event listeners
    useEffect(() => {
        if (!engine || !timelineManager) return;
        initializeTimeline();

        // Subscribe to project loading events to reinitialize timeline
        const projectManager = engine.getProjectManager();
        const unsubscribeProjectLoaded = projectManager.observers.subscribe('projectLoaded', 
            () => {
                console.log("TimelinePanel: Project loaded - reinitializing timeline");
                // Use setTimeout to ensure timeline manager has been deserialized
                setTimeout(() => initializeTimeline(), 0);
            }
        );

        return () => {
            unsubscribeProjectLoaded();
        };
    }, [engine, timelineManager]);

    const initializeTimeline = () => {
        if (!timelineManager) return;

        console.log("TimelinePanel: Initializing timeline", timelineManager.getTracks());

        // Reset selected keyframe
        setSelectedKeyframe(null);
        
        // Initial state
        setTracks(timelineManager.getTracks());
        setCurrentTime(timelineManager.getCurrentTime());
        setDuration(timelineManager.getDuration());
        setIsPlaying(timelineManager.isPlaying());
        setActiveTrack(timelineManager.getActiveTrack());

        // Subscribe to timeline events
        const unsubscribeTimelineUpdated = timelineManager.observers.subscribe('timelineUpdated',
            ({ time }) => {
                setCurrentTime(time);
            }
        );

        const unsubscribePlaybackStateChanged = timelineManager.observers.subscribe('playbackStateChanged',
            ({ isPlaying }) => {
                setIsPlaying(isPlaying);
            }
        );

        const unsubscribeKeyframeAdded = timelineManager.observers.subscribe('keyframeAdded',
            () => {
                setTracks([...timelineManager.getTracks()]);
            }
        );

        const unsubscribeTrackAdded = timelineManager.observers.subscribe('trackAdded',
            () => {
                setTracks([...timelineManager.getTracks()]);
            }
        );

        const unsubscribeActiveTrackChanged = timelineManager.observers.subscribe('activeTrackChanged',
            ({ track }) => {
                setActiveTrack(track);
            }
        );

        const unsubscribeKeyframeRemoved = timelineManager.observers.subscribe('keyframeRemoved',
            () => {
                setTracks([...timelineManager.getTracks()]);
            }
        );

        // Keyboard event listeners
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === ' ') {
                if (timelineManager.isPlaying()) {
                    timelineManager.pause();
                } else {
                    timelineManager.play();
                }
            }

            if ((event.key === 'Backspace' || event.key === 'Delete') && selectedKeyframe) {
                timelineManager.removeKeyframe(selectedKeyframe);
                setSelectedKeyframe(null);
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        // Cleanup
        return () => {
            unsubscribeTimelineUpdated();
            unsubscribePlaybackStateChanged();
            unsubscribeKeyframeAdded();
            unsubscribeTrackAdded();
            unsubscribeActiveTrackChanged();
            unsubscribeKeyframeRemoved();
            window.removeEventListener('keydown', handleKeyDown);
        };
    }

    // Add a method specifically for timeline deserialization events
    useEffect(() => {
        if (!timelineManager) return;

        // Subscribe to a new timeline deserialized event
        const unsubscribeTimelineDeserialized = timelineManager.observers.subscribe('timelineDeserialized',
            () => {
                console.log("TimelinePanel: Timeline deserialized - reinitializing panel");
                initializeTimeline();
            }
        );

        return () => {
            unsubscribeTimelineDeserialized();
        };
    }, [timelineManager]);

    // Timeline interaction handlers
    const handleTimelineClick = (e: React.MouseEvent) => {
        if (!timelineRef.current || !timelineManager) return;

        const rect = timelineRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const timelineWidth = rect.width - theme.timelineStart;

        if (x >= theme.timelineStart) {
            const timelinePosition = (x - theme.timelineStart) / timelineWidth;
            const newTime = timelinePosition * duration;
            timelineManager.setCurrentTime(newTime);
        }
    };

    const handleMouseDown = (e: React.MouseEvent, target: 'playhead' | 'timeline' | 'keyframe', keyframeData?: { track: Track<any>, keyframe: IKeyframe }) => {
        console.log('handleMouseDown', target, keyframeData);
        if (target === 'keyframe' && keyframeData) {
            isDraggingKeyframe.current = true;
            draggedKeyframeData.current = {
                track: keyframeData.track,
                keyframe: keyframeData.keyframe,
                originalTime: keyframeData.keyframe.time
            };
            setSelectedKeyframe(keyframeData.keyframe);
        } else {
            isDraggingPlayhead.current = true;
        }
        e.stopPropagation();
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!timelineRef.current || !timelineManager) return;
        if (!isDraggingPlayhead.current && !isDraggingKeyframe.current) return;

        const rect = timelineRef.current.getBoundingClientRect();
        const x = Math.max(theme.timelineStart, Math.min(rect.width, e.clientX - rect.left));
        const timelineWidth = rect.width - theme.timelineStart;
        const timelinePosition = (x - theme.timelineStart) / timelineWidth;
        const newTime = Math.max(0, Math.min(duration, timelinePosition * duration));

        if (isDraggingPlayhead.current) {
            timelineManager.setCurrentTime(newTime);
        } else if (isDraggingKeyframe.current && draggedKeyframeData.current) {
            // Preview keyframe position during drag
            // We'll update the actual keyframe position on mouse up
        }
    };

    const handleMouseUp = (e: React.MouseEvent) => {
        if (!timelineRef.current || !timelineManager) return;

        if (isDraggingKeyframe.current && draggedKeyframeData.current) {
            const rect = timelineRef.current.getBoundingClientRect();
            const x = Math.max(theme.timelineStart, Math.min(rect.width, e.clientX - rect.left));
            const timelineWidth = rect.width - theme.timelineStart;
            const timelinePosition = (x - theme.timelineStart) / timelineWidth;
            const newTime = Math.max(0, Math.min(duration, timelinePosition * duration));

            // Update the keyframe time
            draggedKeyframeData.current.track.updateKeyframeTime(
                draggedKeyframeData.current.keyframe,
                newTime
            );

            // Update timeline position
            timelineManager.setCurrentTime(newTime);

            // Reset dragging state
            draggedKeyframeData.current = null;
        }

        isDraggingPlayhead.current = false;
        isDraggingKeyframe.current = false;
    };

    // Timeline track methods
    const handleTrackClick = (track: Track<any>) => {
        if (!timelineManager) return;
        timelineManager.setActiveTrack(track);
    };

    const handleAddKeyframe = (track: Track<any>) => {
        if (!timelineManager) return;
        timelineManager.setActiveTrack(track);
        timelineManager.addKeyframe();
    };

    const goToPreviousKeyframe = (track: Track<any>) => {
        if (!timelineManager) return;

        const keyframes = track.getKeyframes();
        const currentTimeValue = currentTime;

        // Find previous keyframe
        let prevKeyframe = null;
        for (let i = keyframes.length - 1; i >= 0; i--) {
            if (keyframes[i].time < currentTimeValue) {
                prevKeyframe = keyframes[i];
                break;
            }
        }

        // If no previous keyframe, wrap to last
        if (!prevKeyframe && keyframes.length > 0) {
            prevKeyframe = keyframes[keyframes.length - 1];
        }

        if (prevKeyframe) {
            timelineManager.setCurrentTime(prevKeyframe.time);
            setSelectedKeyframe(prevKeyframe);
        }
    };

    const goToNextKeyframe = (track: Track<any>) => {
        if (!timelineManager) return;

        const keyframes = track.getKeyframes();
        const currentTimeValue = currentTime;

        // Find next keyframe
        let nextKeyframe = null;
        for (let i = 0; i < keyframes.length; i++) {
            if (keyframes[i].time > currentTimeValue) {
                nextKeyframe = keyframes[i];
                break;
            }
        }

        // If no next keyframe, wrap to first
        if (!nextKeyframe && keyframes.length > 0) {
            nextKeyframe = keyframes[0];
        }

        if (nextKeyframe) {
            timelineManager.setCurrentTime(nextKeyframe.time);
            setSelectedKeyframe(nextKeyframe);
        }
    };

    // Helper to calculate position from time
    const getPositionFromTime = (time: number) => {
        if (!timelineRef.current) return 0;
        const timelineWidth = timelineRef.current.clientWidth - theme.timelineStart;
        return theme.timelineStart + (time / duration) * timelineWidth;
    };

    const getEntityTrack = (entity: EntityBase) => {
        return timelineManager.getTracks().find(track => track.getTarget() === entity);
    }

    // Add a new helper function to create appropriate track types
    const createTrackForEntity = (entity: EntityBase) => {
        if (entity instanceof CharacterEntity) {
            return timelineManager.createCharacterPoseTrack(`${entity.name} Pose`, entity);
        } else {
            return timelineManager.createEntityTrack(entity.name, entity);
        }
    }

    if (!timelineManager) {
        return <div className="panel-shape">Timeline Manager not available</div>;
    }

    return (
        <div className="panel-shape fixed z-50 bottom-5 left-[25%] w-[50%] min-h-[150px] flex flex-col select-none overflow-hidden">
            {/* Controls Bar */}
            <div className="flex items-center justify-between p-2 ">
                {/* Left */}
                <div className='flex items-center gap-2'>
                    <Button
                        size="sm"
                        variant={isPlaying ? "default" : "secondary"}
                        className="mr-3"
                        onClick={() => isPlaying ? timelineManager.pause() : timelineManager.play()}
                    >
                        {isPlaying ? (
                            <PauseIcon className="h-4 w-4" />
                        ) : (
                            <PlayIcon className="h-4 w-4" />
                        )}
                    </Button>

                    <div className="text-white text-sm">
                        {currentTime.toFixed(2)}s
                    </div>
                </div>

                {/* Right */}
                <div className='flex items-center gap-2'>
                </div>
            </div>

            {/* Timeline */}
            <div
                ref={timelineRef}
                className="flex-grow relative"
                onClick={handleTimelineClick}
                onMouseDown={(e) => handleMouseDown(e, 'timeline')}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            >
                {/* Vertical time markers */}
                <div className="absolute inset-0 pointer-events-none">
                    {Array.from({ length: Math.floor(duration) + 1 }).map((_, i) => (
                        <div
                            key={`timemark-${i}`}
                            className="absolute top-4 bottom-0 w-px bg-gray-700 opacity-40"
                            style={{ left: `${getPositionFromTime(i)}px` }}
                        />
                    ))}
                </div>

                {/* Timeline Header with Time Marks */}
                <div className="relative top-0 left-0 right-0 h-4 flex items-end">
                    <div className='text-xs text-gray-400 pl-2'>Track</div>
                    {Array.from({ length: Math.floor(duration) + 1 }).map((_, i) => (
                        <div
                            key={`time-${i}`}
                            className="absolute bottom-0 text-xs text-gray-400 -translate-x-1/2"
                            style={{ left: `${getPositionFromTime(i)}px` }}
                        >
                            {i}s
                        </div>
                    ))}
                </div>

                {/* Tracks */}
                <div className="relative top-0 left-0 right-0 bottom-0 pl-2">
                    {tracks.map((track, index) => (
                        <div
                            key={`track-${index}-${track.getName()}`}
                            className={`h-8 flex items-center border-t  border-gray-800 ${track === activeTrack ? '' : ''
                                }`}
                            onClick={() => handleTrackClick(track)}
                        >
                            <div className={`h-full flex items-center justify-between pr-2`}
                                style={{ width: `${theme.timelineStart}px` }}
                            >
                                {/* Track Name */}
                                <div className="text-sm font-medium text-white truncate">
                                    {track.getName()}
                                </div>

                                {/* Track Controls */}
                                <div className="flex items-center space-x-1">
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-6 w-4 p-0"
                                        onClick={(e) => { e.stopPropagation(); goToPreviousKeyframe(track); }}
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>

                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        className="h-6 w-4 p-0 bg-indigo-700 hover:bg-indigo-600"
                                        onClick={(e) => { e.stopPropagation(); handleAddKeyframe(track); }}
                                    >
                                        <Diamond className="h-3 w-3 scale-75" size={12} />
                                    </Button>

                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 w-4 p-0"
                                        onClick={(e) => { e.stopPropagation(); goToNextKeyframe(track); }}
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>

                            {/* Keyframes */}
                            {track.getKeyframes().map((keyframe, kIndex) => (
                                <div
                                    key={`keyframe-${index}-${kIndex}`}
                                    className={`absolute w-3 h-3 transform -translate-x-1/2 -translate-y-1/2 rotate-45 cursor-pointer ${keyframe === selectedKeyframe
                                        ? 'bg-yellow-500 border-2 border-white'
                                        : 'bg-gray-400 border border-white'
                                        }`}
                                    style={{
                                        left: `${getPositionFromTime(keyframe.time)}px`,
                                        top: `${theme.trackHeight * (index + 0.5)}px`,
                                    }}
                                    onMouseDown={(e) => {
                                        e.stopPropagation();
                                        handleMouseDown(e, 'keyframe', { track, keyframe });
                                    }}
                                />
                            ))}
                        </div>
                    ))}

                    {selectedEntity && !getEntityTrack(selectedEntity) &&
                        <Button size="xs" variant="secondary" className='text-xs w-40' onClick={() => createTrackForEntity(selectedEntity)}>
                            New Track
                            <PlusIcon className="h-4 w-4" />
                        </Button>
                    }
                </div>

                {/* Playhead */}
                <div
                    className="absolute top-0 bottom-0 w-[2px] bg-white"
                    style={{ left: `${getPositionFromTime(currentTime)}px` }}
                    onMouseDown={(e) => {
                        e.stopPropagation();
                        handleMouseDown(e, 'playhead');
                    }}
                >
                    <div className="absolute -top-2 -left-[7px] w-0 h-0 border-l-[8px] border-r-[8px] border-t-[8px] border-transparent border-t-white" />
                </div>
            </div>
        </div>
    );
}

export default TimelinePanel;