import * as BABYLON from '@babylonjs/core';
import { GizmoManager } from '@babylonjs/core';
import { Observer } from '../utils/Observer';
import { ISelectable } from '@/app/interfaces/ISelectable';
export type GizmoMode = 'position' | 'rotation' | 'scale' | 'boundingBox';

export class GizmoModeManager {
    private scene: BABYLON.Scene;
    private gizmoManager: GizmoManager;
    private _lastMode: GizmoMode = 'position';
    private _currentMode: GizmoMode = 'position';
    public observers = new Observer<{
        gizmoModeChanged: { mode: GizmoMode };
    }>();

    constructor(scene: BABYLON.Scene) {
        this.scene = scene;
        this.gizmoManager = new GizmoManager(scene);
    }   

    public setGizmoMode(mode: GizmoMode): GizmoMode {
        this._currentMode = mode;
        this.gizmoManager.scaleGizmoEnabled = mode === 'scale';
        this.gizmoManager.rotationGizmoEnabled = mode === 'rotation';
        this.gizmoManager.positionGizmoEnabled = mode === 'position';
        this.gizmoManager.boundingBoxGizmoEnabled = mode === 'boundingBox';
        console.log(`GizmoModeManager.setGizmoMode: Set gizmo mode to: ${mode}`);
        this.observers.notify('gizmoModeChanged', { mode });
        this._lastMode = mode;
        return mode;
    }

    public getGizmoMode(): GizmoMode {
        return this._currentMode;
    }

    public attachToSelectable(selectable: ISelectable | null): void {
        console.log(`GizmoModeManager.attachToSelectable: Attaching to selectable: ${selectable?.getName()}`, selectable?.gizmoCapabilities);
        // TODO: Update gizmo visual size, and gizmo capabilities
        if (selectable) {
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
