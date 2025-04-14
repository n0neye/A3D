import * as THREE from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { Observer } from '@/app/engine/utils/Observer';
import { Selectable, isSelectable } from '@/app/engine/entity/base/Selectable';
import { EditorEngine } from '@/app/engine/core/EditorEngine';
import { TransformCommand } from '@/app/lib/commands';

export enum TransformMode {
    Position = 0,
    Rotation = 1,
    Scale = 2,
    BoundingBox = 3
}

export type TransformSpace = 'world' | 'local';

export class TransformControlManager {
    private scene: THREE.Scene;
    private transformControls: TransformControls;
    private _lastMode: TransformMode = TransformMode.Position;
    private _lastSpace: TransformSpace = 'world';
    private _currentMode: TransformMode = TransformMode.Position;
    private _currentSpace: TransformSpace = 'world';
    private _allowedModes: TransformMode[] = [TransformMode.Position, TransformMode.Rotation, TransformMode.Scale, TransformMode.BoundingBox];
    private _currentTarget: THREE.Object3D | null = null;
    private _isDragging: boolean = false;
    
    // Track the current transform command for history
    private _currentTransformCommand: TransformCommand | null = null;

    public observers = new Observer<{
        gizmoModeChanged: { mode: TransformMode };
        gizmoSpaceChanged: { space: TransformSpace };
        gizmoAllowedModesChanged: { modes: TransformMode[] };
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
            // console.log(`TransformControlManager.dragging-changed: `, event);
            this._isDragging = event.value as boolean;

            // Pause camera orbit controls when dragging
            const cameraManager = EditorEngine.getInstance().getCameraManager();
            cameraManager.setOrbitControlsEnabled(!this._isDragging);

            // Notify when transform starts/ends
            if (this._currentTarget) {
                if (this._isDragging) {
                    // Handle transform start
                    this._handleTransformStart();
                    this.observers.notify('transformStarted', { target: this._currentTarget });
                } else {
                    // Handle transform end
                    this._handleTransformEnd();
                    this.observers.notify('transformEnded', { target: this._currentTarget });
                }

                if (isSelectable(this._currentTarget)) {
                    const selectable = this._currentTarget as Selectable;
                    if (this._isDragging) {
                        selectable.onTransformStart?.();
                    } else {
                        selectable.onTransformEnd?.();
                    }
                }
            }
        });

        // Dragging changed observer
        this.transformControls.addEventListener('change', (event) => {
            // console.log(`TransformControlManager.change: `, event);
        });

        // objectChange
        this.transformControls.addEventListener('objectChange', (event) => {
            console.log(`TransformControlManager.objectChange: `, isSelectable(this._currentTarget));
            if (isSelectable(this._currentTarget)) {
                const selectable = this._currentTarget as Selectable;
                selectable.onTransformUpdate?.();
            }
        });
    }

    /**
     * Handles the start of a transform operation
     * Creates a transform command to track the change
     */
    private _handleTransformStart(): void {
        if (!this._currentTarget) return;

        console.log(`TransformControlManager: Starting transform on ${this._currentTarget.name}`);
        
        // Create a transform command to track this operation
        this._currentTransformCommand = new TransformCommand(this._currentTarget);
    }

    /**
     * Handles the end of a transform operation
     * Finalizes the command and adds it to history
     */
    private _handleTransformEnd(): void {
        if (!this._currentTarget || !this._currentTransformCommand) return;

        console.log(`TransformControlManager: Ending transform on ${this._currentTarget.name}`);
        
        // Update the final state of the command
        this._currentTransformCommand.updateFinalState();
        
        // Add to history manager if there were actual changes
        const historyManager = EditorEngine.getInstance().getHistoryManager();
        if (historyManager) {
            historyManager.executeCommand(this._currentTransformCommand, true);
        }
        
        // Clear the current command
        this._currentTransformCommand = null;
    }

    public setTransformControlMode(mode: TransformMode): TransformMode {
        if (!this._allowedModes.includes(mode)) {
            // Set to the first allowed mode
            console.log(`TransformControlManager.setGizmoMode: Invalid mode: ${mode} in allowed modes: ${this._allowedModes.join(', ')}, setting to first allowed mode: ${this._allowedModes[0]}`);
            mode = this._allowedModes[0];
        }

        this._currentMode = mode;

        // Update transform controls mode
        switch (mode) {
            case TransformMode.Position:
                this.transformControls.setMode('translate');
                break;
            case TransformMode.Rotation:
                this.transformControls.setMode('rotate');
                break;
            case TransformMode.Scale:
                this.transformControls.setMode('scale');
                break;
            case TransformMode.BoundingBox:
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

    public setTransformControlSpace(space: TransformSpace): void {
        this._currentSpace = space;
        this.transformControls.setSpace(space);
        this._lastSpace = space;
        
        // Notify observers of the space change
        this.observers.notify('gizmoSpaceChanged', { space });
        
        console.log(`TransformControlManager.setTransformControlSpace: Set space to: ${space}`);
    }
    
    public toggleTransformControlSpace(): TransformSpace {
        const newSpace = this._currentSpace === 'world' ? 'local' : 'world';
        this.setTransformControlSpace(newSpace);
        return newSpace;
    }
    
    public getCurrentSpace(): TransformSpace {
        return this._currentSpace;
    }

    public setAllowedModes(modes: TransformMode[]): void {
        this._allowedModes = modes;
        this.observers.notify('gizmoAllowedModesChanged', { modes });
    }

    public attachToSelectable(selectable: Selectable | null): void {

        console.log(`TransformControlManager.attachToSelectable: Attaching to selectable: ${selectable?.getName()}`, selectable?.selectableConfig);

        // Detach from current target
        this.transformControls.detach();
        this._currentTarget = null;

        if (selectable) {
            // Update allowed modes
            this.setAllowedModes(selectable.selectableConfig.allowedTransformModes);

            // Get target object
            const target = selectable.getTransformTarget();
            this._currentTarget = target;

            // If selectable has a default gizmo mode, set it
            if (selectable.selectableConfig.defaultTransformMode !== undefined) {
                this.setTransformControlMode(selectable.selectableConfig.defaultTransformMode);
            } else {
                this.setTransformControlMode(this._lastMode);
            }

            // Set transform control space
            if (selectable.selectableConfig.defaultTransformSpace !== undefined) {
                this.setTransformControlSpace(selectable.selectableConfig.defaultTransformSpace);
            } else {
                this.setTransformControlSpace(this._lastSpace);
            }

            // Set transform controls size
            if (selectable.selectableConfig.controlSize) {
                this.transformControls.size = selectable.selectableConfig.controlSize;
            } else {
                this.transformControls.size = 1; // Default size
            }

            // Attach to target
            if (target) {
                this.transformControls.attach(target);
            }
        }
    }

    public attachToNode(node: THREE.Object3D | null): void {

        // Detach from current target
        this.transformControls.detach();
        this._currentTarget = null;

        if (node) {
            this._currentTarget = node;
            this.transformControls.attach(node);
            console.log(`TransformControlManager.attachToNode: Attached to node: ${node.name}`, node);
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
