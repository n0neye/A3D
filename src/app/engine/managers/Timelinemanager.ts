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

    // Observer for timeline events
    public observers = new Observer<{
        timelineUpdated: { time: number };
        playbackStateChanged: { isPlaying: boolean };
        entityAnimationCreated: { entityId: string };
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
        const cameraSheetObj = this.mainSheet.object('Camera', {
            // Note that the rotation is in radians
            // (full rotation: 2 * Math.PI)
            rotation: THEATRE.types.compound({
                x: THEATRE.types.number(camera.rotation.x, { range: [-2, 2] }),
                y: THEATRE.types.number(camera.rotation.y, { range: [-2, 2] }),
                z: THEATRE.types.number(camera.rotation.z, { range: [-2, 2] }),
            }),
        })


        cameraSheetObj.onValuesChange((values) => {
            // Pause orbit controls
            this.engine.getCameraManager().setOrbitControlsEnabled(false);
            console.log('TimelineManager: Camera values changed', values);
            const { x, y, z } = values.rotation
            camera.rotation.set(x * Math.PI, y * Math.PI, z * Math.PI)
            dummyCube.rotation.set(x * Math.PI, y * Math.PI, z * Math.PI)
        })

        THEATRE.onChange(
            this.mainSheet.sequence.pointer.position,
            (position) => {
                console.log('TimelineManager: PointerChanged:', position);
            }
        );


    }

}