import * as THREE from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { Observer } from '../utils/Observer';
import { ISelectable } from '@/app/interfaces/ISelectable';
import { EditorEngine } from '../EditorEngine';

export enum GizmoMode {
    Position = 0,
    Rotation = 1,
    Scale = 2,
    BoundingBox = 3
}

export class TransformControlManager {
    private scene: THREE.Scene;
    private transformControls: TransformControls;
    private _lastMode: GizmoMode = GizmoMode.Position;
    private _currentMode: GizmoMode = GizmoMode.Position;
    private _allowedModes: GizmoMode[] = [GizmoMode.Position, GizmoMode.Rotation, GizmoMode.Scale, GizmoMode.BoundingBox];
    private _currentTarget: THREE.Object3D | null = null;
    private _isDragging: boolean = false;

    public observers = new Observer<{
        gizmoModeChanged: { mode: GizmoMode };
        gizmoAllowedModesChanged: { modes: GizmoMode[] };
        transformStarted: { target: THREE.Object3D };
        transformEnded: { target: THREE.Object3D };
    }>();

    constructor(scene: THREE.Scene, camera: THREE.Camera, renderer: THREE.WebGLRenderer) {
        this.scene = scene;

        // Create transform controls
        this.transformControls = new TransformControls(camera, renderer.domElement);

        // Add transform controls to scene
        const gizmo = this.transformControls.getHelper();
        scene.add(gizmo);

        // Set up event listeners
        this.transformControls.addEventListener('dragging-changed', (event) => {
            this._isDragging = event.value as boolean;

            // Pause camera orbit controls when dragging
            const cameraManager = EditorEngine.getInstance().getCameraManager();
            cameraManager.setOrbitControlsEnabled(!this._isDragging);
            
            // Notify when transform starts/ends
            if (this._currentTarget) {
                if (this._isDragging) {
                    this.observers.notify('transformStarted', { target: this._currentTarget });
                } else {
                    this.observers.notify('transformEnded', { target: this._currentTarget });
                }
            }
        });
    }

    public setGizmoMode(mode: GizmoMode): GizmoMode {
        if (!this._allowedModes.includes(mode)) {
            // Set to the first allowed mode
            console.log(`TransformControlManager.setGizmoMode: Invalid mode: ${mode} in allowed modes: ${this._allowedModes.join(', ')}, setting to first allowed mode: ${this._allowedModes[0]}`);
            mode = this._allowedModes[0];
        }

        this._currentMode = mode;

        // Update transform controls mode
        switch (mode) {
            case GizmoMode.Position:
                this.transformControls.setMode('translate');
                break;
            case GizmoMode.Rotation:
                this.transformControls.setMode('rotate');
                break;
            case GizmoMode.Scale:
                this.transformControls.setMode('scale');
                break;
            case GizmoMode.BoundingBox:
                // Three.js doesn't have a built-in bounding box mode
                // Default to translate for now
                this.transformControls.setMode('translate');
                break;
        }

        console.log(`TransformControlManager.setGizmoMode: Set gizmo mode to: ${mode}`);
        this.observers.notify('gizmoModeChanged', { mode });
        this._lastMode = mode;
        return mode;
    }

    public getGizmoMode(): GizmoMode {
        return this._currentMode;
    }

    public setAllowedModes(modes: GizmoMode[]): void {
        this._allowedModes = modes;
        this.observers.notify('gizmoAllowedModesChanged', { modes });
    }

    public attachToSelectable(selectable: ISelectable | null): void {
        console.log(`TransformControlManager.attachToSelectable: Attaching to selectable: ${selectable?.getName()}`, selectable?.gizmoCapabilities);

        // Detach from current target
        this.transformControls.detach();
        this._currentTarget = null;

        if (selectable) {
            // Update allowed modes
            this.setAllowedModes(selectable.gizmoCapabilities.allowedGizmoModes);

            // Get target object
            const target = selectable.getGizmoTarget();
            this._currentTarget = target;

            // If selectable has a default gizmo mode, set it
            if (selectable.gizmoCapabilities.defaultGizmoMode !== undefined) {
                this.setGizmoMode(selectable.gizmoCapabilities.defaultGizmoMode);
            } else {
                this.setGizmoMode(this._lastMode);
            }

            // Set transform controls size
            if (selectable.gizmoCapabilities.gizmoVisualSize) {
                this.transformControls.size = selectable.gizmoCapabilities.gizmoVisualSize;
            } else {
                this.transformControls.size = 1; // Default size
            }

            // Attach to target
            this.transformControls.attach(target);
        }
    }

    public attachToNode(node: THREE.Object3D | null): void {
        // Detach from current target
        this.transformControls.detach();
        this._currentTarget = null;

        if (node) {
            this._currentTarget = node;
            this.transformControls.attach(node);
        }
    }

    public getTransformControls(): TransformControls {
        return this.transformControls;
    }

    public getIsDragging(): boolean {
        return this._isDragging;
    }

    public dispose(): void {
        this.transformControls.dispose();
        // Remove the helper from the scene, not the control itself
        const gizmo = this.transformControls.getHelper();
        this.scene.remove(gizmo);
    }
}
