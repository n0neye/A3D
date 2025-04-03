import * as BABYLON from '@babylonjs/core';
import { GizmoManager } from '@babylonjs/core';
export type GizmoMode = 'position' | 'rotation' | 'scale' | 'boundingBox';
export class GizmoModeManager {
    private scene: BABYLON.Scene;
    private gizmoManager: GizmoManager;
    private _currentMode: GizmoMode = 'position';

    constructor(scene: BABYLON.Scene) {
        this.scene = scene;
        this.gizmoManager = new GizmoManager(scene);
        
    }   

    public setGizmoMode(mode: GizmoMode): GizmoMode {
        this._currentMode = mode;
        
        // Apply gizmo changes...
        
        // Return the new mode rather than emitting an event
        return mode;
    }

    public getGizmoMode(): GizmoMode {
        return this._currentMode;
    }

    public getGizmoManager(): GizmoManager {
        return this.gizmoManager;
    }
}
