/**
 * CameraObserver.ts
 * 
 * Type-safe observer for camera-related events
 */
import { ImageRatio } from "@/app/util/generation/generation-util";
import { Observer } from "./Observer";
import { EntityBase } from "@/app/engine/entity/EntityBase";

export interface SelectionEvents {
  entitySelected: { entity: EntityBase };
}

export const selectionObserver = new Observer<SelectionEvents>(); 