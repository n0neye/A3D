import * as THREE from 'three';
import { EditorEngine } from '../core/EditorEngine';
import { EntityBase } from '../entity/base/EntityBase';
import { Observer } from '../utils/Observer';
import * as THEATRE from '@theatre/core';
import studio from '@theatre/studio';


export class TimelineManager {
    private engine: EditorEngine;
    private project: THEATRE.IProject;
    private mainSheet: THEATRE.ISheet;
    private isPlaying: boolean = false;
    private debugUI: HTMLElement | null = null;
    private cameraSheetObj: THEATRE.ISheetObject;

    // Observer for timeline events
    public observers = new Observer<{
        timelineUpdated: { time: number };
        playbackStateChanged: { isPlaying: boolean };
        entityAnimationCreated: { entityId: string };
        keyframeAdded: { time: number };
    }>();

    constructor(engine: EditorEngine) {
        this.engine = engine;

        // Initialize Theatre.js Studio
        if (process.env.NODE_ENV !== 'production') {
            console.log('TimelineManager: Initializing Theatre.js Studio');
            studio.initialize();
        }

        // Create a Theatre.js project
        this.project = THEATRE.getProject('AI-Editor-Animation');
        this.mainSheet = this.project.sheet('Main');


        const camera = this.engine.getCameraManager().getCamera();
        const dummyCube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0x00ff00 }));
        this.engine.getScene().add(dummyCube);
        this.cameraSheetObj = this.mainSheet.object('Camera', {
            // Note that the rotation is in radians
            // (full rotation: 2 * Math.PI)
            rotation: THEATRE.types.compound({
                x: THEATRE.types.number(camera.rotation.x, { range: [-2, 2] }),
                y: THEATRE.types.number(camera.rotation.y, { range: [-2, 2] }),
                z: THEATRE.types.number(camera.rotation.z, { range: [-2, 2] }),
            }),
            position: THEATRE.types.compound({
                x: THEATRE.types.number(camera.position.x, { range: [-2, 2] }),
                y: THEATRE.types.number(camera.position.y, { range: [-2, 2] }),
                z: THEATRE.types.number(camera.position.z, { range: [-2, 2] }),
            }),
            fov: THEATRE.types.number(camera.fov, { range: [1, 179] }),
        }) as any;


        this.cameraSheetObj.onValuesChange((values) => {
            // Pause orbit controls
            this.engine.getCameraManager().setOrbitControlsEnabled(false);
            console.log('TimelineManager: Camera values changed', values);

            camera.rotation.set(values.rotation.x * Math.PI, values.rotation.y * Math.PI, values.rotation.z * Math.PI)
            camera.position.set(values.position.x, values.position.y, values.position.z)
            camera.fov = values.fov

            dummyCube.rotation.set(values.rotation.x * Math.PI, values.rotation.y * Math.PI, values.rotation.z * Math.PI)
            setTimeout(() => {
                if (!this.isPlaying) {
                    this.engine.getCameraManager().setOrbitControlsEnabled(true);
                }
            }, 1);
        })

        // Monitor playback state changes
        THEATRE.onChange(
            this.mainSheet.sequence.pointer.playing,
            (isPlaying) => {
                console.log('TimelineManager: Playback state changed:', isPlaying);
                this.isPlaying = isPlaying;

                // Notify observers about playback state change
                this.observers.notify('playbackStateChanged', { isPlaying });

                // Re-enable orbit controls when animation is paused
                if (!isPlaying) {
                    this.engine.getCameraManager().setOrbitControlsEnabled(true);
                    console.log('TimelineManager: Orbit controls re-enabled');
                }

                // Update debug UI button text if it exists
                this.updateDebugUIPlaybackState();
            }
        );

        // Monitor timeline position changes
        THEATRE.onChange(
            this.mainSheet.sequence.pointer.position,
            (position) => {
                console.log('TimelineManager: PointerChanged:', position);
                // Notify observers about timeline position change
                this.observers.notify('timelineUpdated', { time: position });

                // Update position display in debug UI
                this.updateDebugUIPosition(position);
            }
        );

        // Initialize debug UI
        this.createDebugUI();
    }

    /**
     * Add a keyframe for the current camera rotation at the current timeline position
     */
    public addCameraKeyframe(): void {
        const camera = this.engine.getCameraManager().getCamera();
        const timePosition = this.getPosition();

        // Get current camera rotation and normalize to the range [-2, 2]
        const normalizedRotation = { x: camera.rotation.x / Math.PI, y: camera.rotation.y / Math.PI, z: camera.rotation.z / Math.PI }

        console.log('TimelineManager: Adding keyframe at position', timePosition, 'with rotation', normalizedRotation);

        // Use Theatre.js transaction API to create a keyframe
        studio.transaction(({ set }) => {
            set(this.cameraSheetObj.props.rotation, normalizedRotation);
            set(this.cameraSheetObj.props.position, camera.position);
            set(this.cameraSheetObj.props.fov, camera.fov);

            // Tell Theatre.js to sequence this value (add a keyframe)
            this.mainSheet.sequence.position = timePosition;
        });

        // Notify observers that a keyframe was added
        this.observers.notify('keyframeAdded', { time: timePosition });
        console.log('TimelineManager: Keyframe added successfully');
    }

    /**
     * Update the playback state in the debug UI
     */
    private updateDebugUIPlaybackState(): void {
        if (!this.debugUI) return;

        const playButton = this.debugUI.querySelector('#timeline-play-button');
        if (playButton) {
            (playButton as HTMLButtonElement).textContent = this.isPlaying ? 'Pause' : 'Play';
        }
    }

    /**
     * Update the position display in the debug UI
     */
    private updateDebugUIPosition(position: number): void {
        if (!this.debugUI) return;

        const positionDisplay = this.debugUI.querySelector('#timeline-position');
        if (positionDisplay) {
            positionDisplay.textContent = `Position: ${position.toFixed(2)}s`;
        }

        const slider = this.debugUI.querySelector('input[type="range"]');
        if (slider) {
            (slider as HTMLInputElement).value = position.toString();
        }
    }

    /**
     * Play the animation sequence
     * @param options Optional playback options
     */
    public play(options?: { iterationCount?: number, range?: [number, number] }): void {
        // Disable orbit controls before starting playback
        this.engine.getCameraManager().setOrbitControlsEnabled(false);

        const playOptions = {
            iterationCount: options?.iterationCount || 1,
            range: options?.range,
        };

        this.mainSheet.sequence.play(playOptions).then((finished) => {
            if (finished) {
                console.log('TimelineManager: Playback completed');
            } else {
                console.log('TimelineManager: Playback interrupted');
            }

            // Re-enable orbit controls after playback ends
            if (!this.isPlaying) {
                this.engine.getCameraManager().setOrbitControlsEnabled(true);
            }
        });
    }

    /**
     * Pause the animation sequence
     */
    public pause(): void {
        this.mainSheet.sequence.pause();
    }

    /**
     * Get the current playback position in seconds
     */
    public getPosition(): number {
        return this.mainSheet.sequence.position;
    }

    /**
     * Set the current playback position in seconds
     */
    public setPosition(position: number): void {
        this.mainSheet.sequence.position = position;
    }

    /**
     * Check if the animation is currently playing
     */
    public isPlayingAnimation(): boolean {
        return this.isPlaying;
    }

    /**
     * Toggle debug UI visibility
     */
    public toggleDebugUI(visible?: boolean): void {
        if (!this.debugUI) return;

        if (visible === undefined) {
            visible = this.debugUI.style.display === 'none';
        }

        this.debugUI.style.display = visible ? 'block' : 'none';
    }


    /**
     * Create a debug UI for controlling the timeline
     */
    private createDebugUI(): void {
        // Only create UI in non-production environments
        if (process.env.NODE_ENV === 'production') return;

        // Create UI container
        const container = document.createElement('div');
        container.id = 'timeline-debug-ui';
        container.style.cssText = `position: fixed; bottom: 10px; left: 10px; z-index: 1000; background-color: rgba(0, 0, 0, 0.7); padding: 10px; border-radius: 5px; color: white; font-family: Arial, sans-serif; font-size: 12px;`;

        // Title
        const title = document.createElement('div');
        title.textContent = 'Timeline Debug';
        title.style.cssText = `margin-bottom: 5px;`;
        container.appendChild(title);

        // Position display
        const positionDisplay = document.createElement('div');
        positionDisplay.id = 'timeline-position';
        positionDisplay.textContent = 'Position: 0.00s';
        positionDisplay.style.cssText = `margin-bottom: 5px;`;
        container.appendChild(positionDisplay);

        // Play/Pause button
        const playButton = document.createElement('button');
        playButton.id = 'timeline-play-button';
        playButton.textContent = 'Play';
        playButton.style.cssText = `margin-right: 5px; padding: 3px 8px;`;
        playButton.addEventListener('click', () => {
            if (this.isPlaying) {
                this.pause();
            } else {
                this.play();
            }
        });
        container.appendChild(playButton);

        // Reset button
        const resetButton = document.createElement('button');
        resetButton.textContent = 'Reset';
        resetButton.style.cssText = `margin-right: 5px; padding: 3px 8px;`;
        resetButton.addEventListener('click', () => {
            this.setPosition(0);
        });
        container.appendChild(resetButton);

        // Add Keyframe button
        const keyframeButton = document.createElement('button');
        keyframeButton.textContent = 'Add Keyframe';
        keyframeButton.style.cssText = `padding: 3px 8px;`;
        keyframeButton.addEventListener('click', () => {
            this.addCameraKeyframe();
        });
        container.appendChild(keyframeButton);

        // Position control
        const positionControl = document.createElement('div');
        positionControl.style.marginTop = '5px';

        const positionSlider = document.createElement('input');
        positionSlider.type = 'range';
        positionSlider.min = '0';
        positionSlider.max = '5'; // Default to 5 seconds duration
        positionSlider.step = '0.01';
        positionSlider.value = '0';
        positionSlider.style.width = '100%';
        positionSlider.addEventListener('input', (e) => {
            const newPosition = parseFloat((e.target as HTMLInputElement).value);
            this.setPosition(newPosition);
        });
        positionControl.appendChild(positionSlider);

        container.appendChild(positionControl);

        // Add to document
        document.body.appendChild(container);

        // Store reference
        this.debugUI = container;
    }
}