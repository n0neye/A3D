import * as BABYLON from '@babylonjs/core';
import { GizmoManager } from '@babylonjs/core';
import { Observer } from '../utils/Observer';
import { ISelectable } from '@/app/interfaces/ISelectable';

export enum GizmoMode {
    Position = 0,
    Rotation = 1,
    Scale = 2,
    BoundingBox = 3
}

export class TransformControlManager {
    private scene: BABYLON.Scene;
    private gizmoManager: GizmoManager;
    private _lastMode: GizmoMode = GizmoMode.Position;
    private _currentMode: GizmoMode = GizmoMode.Position;
    private _allowedModes: GizmoMode[] = [GizmoMode.Position, GizmoMode.Rotation, GizmoMode.Scale, GizmoMode.BoundingBox];
    public observers = new Observer<{
        gizmoModeChanged: { mode: GizmoMode };
        gizmoAllowedModesChanged: { modes: GizmoMode[] };
    }>();

    constructor(scene: BABYLON.Scene) {
        this.scene = scene;
        this.gizmoManager = new GizmoManager(scene);
    }   

    public setGizmoMode(mode: GizmoMode): GizmoMode {

        if(!this._allowedModes.includes(mode)) {
            // Set to the first allowed mode
            console.log(`transformControlManager.setGizmoMode: Invalid mode: ${mode} in allowed modes: ${this._allowedModes.join(', ')}, setting to first allowed mode: ${this._allowedModes[0]}`);
            mode = this._allowedModes[0];
        }

        this._currentMode = mode;
        this.gizmoManager.scaleGizmoEnabled = mode === GizmoMode.Scale;
        this.gizmoManager.rotationGizmoEnabled = mode === GizmoMode.Rotation;
        this.gizmoManager.positionGizmoEnabled = mode === GizmoMode.Position;
        this.gizmoManager.boundingBoxGizmoEnabled = mode === GizmoMode.BoundingBox;
        console.log(`transformControlManager.setGizmoMode: Set gizmo mode to: ${mode}`);
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
        console.log(`transformControlManager.attachToSelectable: Attaching to selectable: ${selectable?.getName()}`, selectable?.gizmoCapabilities);
        // TODO: Update gizmo visual size, and gizmo capabilities
        if (selectable) {
            // Update allowed modes
            this.setAllowedModes(selectable.gizmoCapabilities.allowedGizmoModes);

            // if selectable has a default gizmo mode, set it
            if(selectable.gizmoCapabilities.defaultGizmoMode) {
                this.setGizmoMode(selectable.gizmoCapabilities.defaultGizmoMode);
            }else{
                this.setGizmoMode(this._lastMode);
            }
        }
        this.gizmoManager.attachToNode(selectable?.getGizmoTarget() || null);
    }

    public getGizmoManager(): GizmoManager {
        return this.gizmoManager;
    }
}
