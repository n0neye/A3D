import * as BABYLON from '@babylonjs/core';
import { GizmoManager } from '@babylonjs/core';
import { Observer } from '../utils/Observer';
export type GizmoMode = 'position' | 'rotation' | 'scale' | 'boundingBox';

export class GizmoModeManager {
    private scene: BABYLON.Scene;
    private gizmoManager: GizmoManager;
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
        this.observers.notify('gizmoModeChanged', { mode });
        return mode;
    }

    public getGizmoMode(): GizmoMode {
        return this._currentMode;
    }

    public getGizmoManager(): GizmoManager {
        return this.gizmoManager;
    }
}
