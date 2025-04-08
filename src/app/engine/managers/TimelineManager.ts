import * as THREE from 'three';
import { EditorEngine } from '../core/EditorEngine';
import { EntityBase } from '../entity/base/EntityBase';
import { Observer } from '../utils/Observer';
import * as THEATRE from '@theatre/core';
import studio from '@theatre/studio';

// Mapping between entity IDs and their Theatre.js objects
interface EntityTimelineMap {
    [entityId: string]: {
        sheet: THEATRE.ISheet;
        obj: THEATRE.ISheetObject<any>;
    };
}

// Types of properties that can be animated
export type AnimatableProperty = 'position' | 'rotation' | 'scale' | 'fov';

/**
 * Manages the animation timeline for all entities in the scene
 * Integrates with Theatre.js for animation playback
 */
export class TimelineManager {
    private engine: EditorEngine;
    private project: THEATRE.IProject;
    private entityMap: EntityTimelineMap = {};
    private isPlaying: boolean = false;
    private initialized: boolean = false;

    // Observer for timeline events
    public observers = new Observer<{
        timelineUpdated: { time: number };
        playbackStateChanged: { isPlaying: boolean };
        keyframeAdded: { entityId: string; property: AnimatableProperty; time: number };
        entityAnimationCreated: { entityId: string };
    }>();

    constructor(engine: EditorEngine) {
        this.engine = engine;

        // Create a Theatre.js project
        this.project = THEATRE.getProject('AI-Editor-Animation');

        // Initialize Theatre.js studio in development
        if (process.env.NODE_ENV !== 'production') {
            studio.initialize();
        }
    }

    /**
     * Initialize the timeline manager
     */
    initialize() {
        if (this.initialized) return;

        console.log('TimelineManager: Initializing timeline');

        // Create the main timeline sheet that will be used for playback
        this.project.ready.then(() => {
            // Create a main sheet for general timeline control
            const mainSheet = this.project.sheet('Main');
            console.log('TimelineManager: Created main sheet with ID:', mainSheet.address.sheetId);

            // Set up a test object to ensure the sheet has something to animate
            const dummyObj = mainSheet.object('TimelineControl', {
                time: THEATRE.types.number(0, { range: [0, 10] })
            });

            console.log('TimelineManager: Created dummy timeline control object');

            // Set up a change handler to listen for timeline updates
            dummyObj.onValuesChange(values => {
                console.log('TimelineManager: Timeline control value changed:', values.time);
            });
        });

        this.initialized = true;
        console.log('TimelineManager initialized');
    }

    /**
     * Get the Theatre.js project
     */
    getProject(): THEATRE.IProject {
        return this.project;
    }

    /**
     * Play the timeline animation
     */
    play() {
        if (this.isPlaying) return;

        console.log('TimelineManager: Playing timeline');
        this.isPlaying = true;
        this.project.ready.then(() => {
            console.log('TimelineManager: Project ready, playing sequence');
            const sheet = this.project.sheet('Main');
            console.log('TimelineManager: Using sheet:', sheet.address.sheetId);

            sheet.sequence.play({ iterationCount: Infinity })
                .then((completed) => {
                    console.log('TimelineManager: Playback completed:', completed);
                })
                .catch(err => {
                    console.error('TimelineManager: Error during playback:', err);
                });
        });
        this.observers.notify('playbackStateChanged', { isPlaying: true });
    }

    /**
     * Pause the timeline animation
     */
    pause() {
        if (!this.isPlaying) return;

        console.log('TimelineManager: Pausing timeline');
        this.isPlaying = false;
        this.project.ready.then(() => {
            console.log('TimelineManager: Project ready, pausing sequence');
            const sheet = this.project.sheet('Main');
            sheet.sequence.pause();
        });
        this.observers.notify('playbackStateChanged', { isPlaying: false });
    }

    /**
     * Toggle play/pause state
     */
    togglePlayback() {
        console.log('TimelineManager: Toggling playback, current state:', this.isPlaying);
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    /**
     * Scrub the timeline to a specific time
     */
    scrubTo(time: number) {
        console.log('TimelineManager: Scrubbing to time:', time);
        this.project.ready.then(() => {
            const sheet = this.project.sheet('Main');
            sheet.sequence.position = time;
            console.log('TimelineManager: Set sequence position to:', time);
        });
        this.observers.notify('timelineUpdated', { time });
    }

    /**
     * Create a Theatre.js object for a camera
     */
    createCameraAnimation() {
        console.log('TimelineManager: Creating camera animation');
        const camera = this.engine.getCameraManager().getCamera();
        const cameraSheet = this.project.sheet('Camera');

        // Create Theatre.js object with props using Theatre.js types
        const cameraProps = {
            position: {
                x: THEATRE.types.number(camera.position.x),
                y: THEATRE.types.number(camera.position.y),
                z: THEATRE.types.number(camera.position.z)
            },
            rotation: {
                x: THEATRE.types.number(camera.rotation.x),
                y: THEATRE.types.number(camera.rotation.y),
                z: THEATRE.types.number(camera.rotation.z)
            },
            fov: THEATRE.types.number(camera.fov)
        };

        console.log('TimelineManager: Camera props created', cameraProps);

        // Create the object with the props
        const cameraObj = cameraSheet.object('Camera', cameraProps);
        console.log('TimelineManager: Camera object created', cameraObj.address);

        // Set up change handlers
        cameraObj.onValuesChange((values) => {
            console.log('TimelineManager: Camera values changed:', values);

            // Update camera position
            camera.position.set(
                values.position.x,
                values.position.y,
                values.position.z
            );

            // Update camera rotation
            camera.rotation.set(
                values.rotation.x,
                values.rotation.y,
                values.rotation.z
            );

            // Update camera FOV
            camera.fov = values.fov;
            camera.updateProjectionMatrix();
        });

        // Store in entity map (using "camera" as a special entityId)
        this.entityMap["camera"] = {
            sheet: cameraSheet,
            obj: cameraObj
        };

        return cameraObj;
    }

    /**
     * Create a Theatre.js object for an entity
     */
    createEntityAnimation(entity: EntityBase) {
        console.log('TimelineManager: Creating entity animation for:', entity.name, entity.entityId);

        // Skip if already exists
        if (this.entityMap[entity.entityId]) {
            console.log('TimelineManager: Entity animation already exists, reusing');
            return this.entityMap[entity.entityId].obj;
        }

        // Create a sheet for this entity (using entity name for readability)
        const entitySheet = this.project.sheet(entity.name);

        // Create Theatre.js object with props using Theatre.js types
        const entityProps = {
            position: {
                x: THEATRE.types.number(entity.position.x),
                y: THEATRE.types.number(entity.position.y),
                z: THEATRE.types.number(entity.position.z)
            },
            rotation: {
                x: THEATRE.types.number(entity.rotation.x),
                y: THEATRE.types.number(entity.rotation.y),
                z: THEATRE.types.number(entity.rotation.z)
            },
            scale: {
                x: THEATRE.types.number(entity.scale.x),
                y: THEATRE.types.number(entity.scale.y),
                z: THEATRE.types.number(entity.scale.z)
            }
        };

        console.log('TimelineManager: Entity props created', entityProps);

        // Create the object with the props
        const entityObj = entitySheet.object(entity.name, entityProps);
        console.log('TimelineManager: Entity object created', entityObj.address);

        // Set up change handlers
        entityObj.onValuesChange((values) => {
            console.log('TimelineManager: Entity values changed:', values);

            // Update entity position
            entity.position.set(
                values.position.x,
                values.position.y,
                values.position.z
            );

            // Update entity rotation
            entity.rotation.set(
                values.rotation.x,
                values.rotation.y,
                values.rotation.z
            );

            // Update entity scale
            entity.scale.set(
                values.scale.x,
                values.scale.y,
                values.scale.z
            );
        });

        // Store in entity map
        this.entityMap[entity.entityId] = {
            sheet: entitySheet,
            obj: entityObj
        };

        // Notify that entity animation was created
        this.observers.notify('entityAnimationCreated', { entityId: entity.entityId });

        return entityObj;
    }

    /**
     * Add a keyframe to the camera at the current time
     */
    addCameraKeyframe(property: 'position' | 'rotation' | 'fov'): void {
        if (!this.initialized) {
            console.warn('TimelineManager: Cannot add keyframe, not initialized');
            return;
        }

        const camera = this.engine.getCameraManager().getCamera();
        const currentTime = this.getCurrentTime();

        console.log(`TimelineManager: Adding camera ${property} keyframe at ${currentTime}`);

        switch (property) {
            case 'position':
                this.addCameraPositionKeyframe(camera, currentTime);
                break;
            case 'rotation':
                this.addCameraRotationKeyframe(camera, currentTime);
                break;
            case 'fov':
                this.addCameraFOVKeyframe(camera, currentTime);
                break;
        }

        // Notify that keyframe was added
        this.observers.notify('keyframeAdded', {
            entityId: "camera",
            property,
            time: currentTime
        });
    }

    /**
     * Adds keyframes for all camera properties (position, rotation, and FOV) at the current time
     */
    addCameraAllKeyframes(): void {
        if (!this.initialized) {
            console.warn('TimelineManager: Cannot add keyframes, not initialized');
            return;
        }

        const camera = this.engine.getCameraManager().getCamera();
        const currentTime = this.getCurrentTime();

        console.log(`TimelineManager: Adding all camera keyframes at ${currentTime}`);

        this.addCameraPositionKeyframe(camera, currentTime);
        this.addCameraRotationKeyframe(camera, currentTime);
        this.addCameraFOVKeyframe(camera, currentTime);
        
        // Notify for each property individually to maintain compatibility
        const properties: AnimatableProperty[] = ['position', 'rotation', 'fov'];
        properties.forEach(property => {
            this.observers.notify('keyframeAdded', {
                entityId: "camera",
                property,
                time: currentTime
            });
        });
    }

    /**
     * Helper method to add a camera position keyframe
     */
    private addCameraPositionKeyframe(camera: THREE.Camera, time: number): void {
        // Make sure camera animation exists
        if (!this.entityMap["camera"]) {
            console.log('TimelineManager: Camera animation does not exist, creating');
            this.createCameraAnimation();
        }

        const cameraObj = this.entityMap["camera"].obj;
        console.log('TimelineManager: Adding position keyframe at time:', time);

        // Ensure the property is sequenced in the Studio
        this.ensurePropertyIsSequenced(cameraObj, 'position');

        this.project.ready.then(() => {
            console.log('TimelineManager: Setting position values:', {
                x: camera.position.x,
                y: camera.position.y,
                z: camera.position.z
            });

            // Make sure the position is updated by setting initialValue
            cameraObj.initialValue = {
                position: {
                    x: camera.position.x,
                    y: camera.position.y,
                    z: camera.position.z
                }
            };

            // Apply changes
            this.scrubTo(time);
        });
    }

    /**
     * Helper method to add a camera rotation keyframe
     */
    private addCameraRotationKeyframe(camera: THREE.Camera, time: number): void {
        // Make sure camera animation exists
        if (!this.entityMap["camera"]) {
            console.log('TimelineManager: Camera animation does not exist, creating');
            this.createCameraAnimation();
        }

        const cameraObj = this.entityMap["camera"].obj;
        console.log('TimelineManager: Adding rotation keyframe at time:', time);

        // Ensure the property is sequenced in the Studio
        this.ensurePropertyIsSequenced(cameraObj, 'rotation');

        this.project.ready.then(() => {
            console.log('TimelineManager: Setting rotation values:', {
                x: camera.rotation.x,
                y: camera.rotation.y,
                z: camera.rotation.z
            });

            cameraObj.initialValue = {
                rotation: {
                    x: camera.rotation.x,
                    y: camera.rotation.y,
                    z: camera.rotation.z
                }
            };

            // Apply changes
            this.scrubTo(time);
        });
    }

    /**
     * Helper method to add a camera FOV keyframe
     */
    private addCameraFOVKeyframe(camera: THREE.PerspectiveCamera, time: number): void {
        // Make sure camera animation exists
        if (!this.entityMap["camera"]) {
            console.log('TimelineManager: Camera animation does not exist, creating');
            this.createCameraAnimation();
        }

        const cameraObj = this.entityMap["camera"].obj;
        console.log('TimelineManager: Adding FOV keyframe at time:', time);

        // Ensure the property is sequenced in the Studio
        this.ensurePropertyIsSequenced(cameraObj, 'fov');

        this.project.ready.then(() => {
            console.log('TimelineManager: Setting FOV value:', camera.fov);

            cameraObj.initialValue = {
                fov: camera.fov
            };

            // Apply changes
            this.scrubTo(time);
        });
    }

    /**
     * Add a keyframe to an entity at the current time
     */
    addEntityKeyframe(entity: EntityBase, property: 'position' | 'rotation' | 'scale', time?: number) {
        console.log('TimelineManager: Adding entity keyframe for', entity.name, 'property:', property);

        // Make sure entity animation exists
        if (!this.entityMap[entity.entityId]) {
            console.log('TimelineManager: Entity animation does not exist, creating');
            this.createEntityAnimation(entity);
        }

        const entityObj = this.entityMap[entity.entityId].obj;
        const currentTime = time ?? this.getCurrentTime();
        console.log('TimelineManager: Adding keyframe at time:', currentTime);

        // Ensure the property is sequenced in the Studio
        this.ensurePropertyIsSequenced(entityObj, property);

        // Add keyframe based on property type
        if (property === 'position') {
            this.project.ready.then(() => {
                console.log('TimelineManager: Setting entity position values:', {
                    x: entity.position.x,
                    y: entity.position.y,
                    z: entity.position.z
                });

                entityObj.initialValue = {
                    position: {
                        x: entity.position.x,
                        y: entity.position.y,
                        z: entity.position.z
                    }
                };

                // Also try to play a small animation to make sure changes are applied
                this.scrubTo(currentTime);
                setTimeout(() => {
                    console.log('TimelineManager: Triggering timeline playback to apply changes');
                    this.play();
                    // Pause after a short time so the user can see the effect
                    setTimeout(() => this.pause(), 500);
                }, 100);
            });
        } else if (property === 'rotation') {
            this.project.ready.then(() => {
                console.log('TimelineManager: Setting entity rotation values:', {
                    x: entity.rotation.x,
                    y: entity.rotation.y,
                    z: entity.rotation.z
                });

                entityObj.initialValue = {
                    rotation: {
                        x: entity.rotation.x,
                        y: entity.rotation.y,
                        z: entity.rotation.z
                    }
                };

                // Also try to play a small animation to make sure changes are applied
                this.scrubTo(currentTime);
                setTimeout(() => {
                    console.log('TimelineManager: Triggering timeline playback to apply changes');
                    this.play();
                    // Pause after a short time so the user can see the effect
                    setTimeout(() => this.pause(), 500);
                }, 100);
            });
        } else if (property === 'scale') {
            this.project.ready.then(() => {
                console.log('TimelineManager: Setting entity scale values:', {
                    x: entity.scale.x,
                    y: entity.scale.y,
                    z: entity.scale.z
                });

                entityObj.initialValue = {
                    scale: {
                        x: entity.scale.x,
                        y: entity.scale.y,
                        z: entity.scale.z
                    }
                };

                // Also try to play a small animation to make sure changes are applied
                this.scrubTo(currentTime);
                setTimeout(() => {
                    console.log('TimelineManager: Triggering timeline playback to apply changes');
                    this.play();
                    // Pause after a short time so the user can see the effect
                    setTimeout(() => this.pause(), 500);
                }, 100);
            });
        }

        // Notify that keyframe was added
        this.observers.notify('keyframeAdded', {
            entityId: entity.entityId,
            property,
            time: currentTime
        });
    }

    /**
     * Get the status of the timeline playback
     */
    isTimelinePlaying(): boolean {
        return this.isPlaying;
    }

    /**
     * Get the current time of the timeline
     */
    getCurrentTime(): number {
        // This is a synchronous method but we need to access async data
        // For the MVP, we'll maintain our own time tracking
        console.log('TimelineManager: Getting current time');

        // Create a cache for storing the last known position
        if (!this._cachedTimePosition) {
            this._cachedTimePosition = 0;

            // Start keeping track of the current position
            this.project.ready.then(() => {
                const mainSheet = this.project.sheet('Main');

                // Use onChange to track the position changes
                THEATRE.onChange(mainSheet.sequence.pointer.position, (position) => {
                    console.log('TimelineManager: Timeline position changed via pointer:', position);
                    this._cachedTimePosition = position;
                });
            });
        }

        console.log('TimelineManager: Returning cached time position:', this._cachedTimePosition);
        return this._cachedTimePosition;
    }

    // Cache for the current time position
    private _cachedTimePosition: number = 0;

    /**
     * Dispose and clean up resources
     */
    dispose() {
        // Clean up Theatre.js
        if (process.env.NODE_ENV !== 'production') {
            studio.ui.hide();
        }

        // Reset variables
        this.entityMap = {};
        this.isPlaying = false;
    }

    /**
     * Helper method to ensure properties are sequenced in Studio
     * This is necessary for keyframes to be visible and editable
     */
    private ensurePropertyIsSequenced(obj: THEATRE.ISheetObject<any>, propertyPath: string): void {
        console.log('TimelineManager: Ensuring property is sequenced:', propertyPath);

        // In Theatre.js, we need to programmatically sequence properties
        // to make them available for keyframe editing
        // Unfortunately, this requires using studio, which may not be available
        // in production builds

        if (process.env.NODE_ENV !== 'production' && studio) {
            console.log('TimelineManager: Studio is available, attempting to sequence property');

            try {
                // Note: This is using internal APIs and may break in future versions
                // We'll need to find a better way to do this in the future
                // @ts-ignore - Accessing internal APIs
                if (studio.selection && studio.selection.select) {
                    // @ts-ignore - Accessing internal APIs
                    studio.selection.select([obj.address]);
                    console.log('TimelineManager: Selected object in studio:', obj.address);
                }
            } catch (e) {
                console.error('TimelineManager: Error sequencing property:', e);
            }
        } else {
            console.log('TimelineManager: Studio not available, cannot sequence property');
        }
    }
} 