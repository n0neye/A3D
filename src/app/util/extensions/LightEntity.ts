import * as BABYLON from '@babylonjs/core';
import { EntityBase } from './EntityBase';
/**
 * Entity that represents lights in the scene
 */
// Light properties

export interface SerializedColor {
  r: number;
  g: number;
  b: number;
}

export interface LightProps {
  color: SerializedColor;
  intensity: number;
  shadowEnabled: boolean;
}

export class LightEntity extends EntityBase {
  // LightEntity specific properties
  light: BABYLON.Light;
  shadowGenerator?: BABYLON.ShadowGenerator;
  props: LightProps;

  constructor(
    name: string,
    scene: BABYLON.Scene,
    options: {
      id?: string;
      position?: BABYLON.Vector3;
      props?: LightProps,
    } = {}
  ) {
    super(name, scene, 'light', {
      id: options.id,
      position: options.position,
    });

    // Create the light
    this.light = this.createLight(
      options.props?.intensity || 0.7,
      options.props?.color || {r: 1, g: 1, b: 1},
      options.props?.shadowEnabled || false
    );

    this.props = {
      intensity: options.props?.intensity || 0.7,
      color: options.props?.color || {r: 1, g: 1, b: 1},
      shadowEnabled: options.props?.shadowEnabled || false
    };

    // Create light visual representation
    this.createLightVisual();
  }

  /**
   * Create the actual light
   */
  private createLight(intensity: number, color: SerializedColor, shadowEnabled: boolean): BABYLON.Light {
    // Implementation for light creation
    const light = new BABYLON.PointLight(`${this.name}-light`, new BABYLON.Vector3(0, 0, 0), this.getScene());
    light.intensity = intensity;
    light.diffuse = new BABYLON.Color3(color.r, color.g, color.b);
    light.specular = light.diffuse;
    light.shadowEnabled = shadowEnabled;
    light.parent = this;

    // Create shadow generator if needed
    if (shadowEnabled) {
      this.createShadowGenerator(light);
    }

    return light;
  }

  /**
   * Create shadow generator
   */
  private createShadowGenerator(light: BABYLON.ShadowLight): void {
    // Implementation for shadow generator
  }

  /**
   * Create visual representation of the light
   */
  private createLightVisual(): void {
    // Implementation for light visual
  }

  /**
   * Set light color
   */
  setColor(color: BABYLON.Color3): void {
    if (this.light instanceof BABYLON.PointLight) {
      this.light.diffuse = color;
      this.light.specular = color;

      // Update metadata
      this.props.color = {
        r: color.r,
        g: color.g,
        b: color.b
      };
    }
  }

  /**
   * Set light intensity
   */
  setIntensity(intensity: number): void {
    this.light.intensity = intensity;

    // Update metadata
    this.props.intensity = intensity;
  }

  /**
   * Enable/disable shadows
   */
  setShadowEnabled(enabled: boolean): void {
    this.light.shadowEnabled = enabled;

    // Update metadata
    this.props.shadowEnabled = enabled;

    // Create or dispose shadow generator
    if (enabled && !this.shadowGenerator && this.light instanceof BABYLON.ShadowLight) {
      this.createShadowGenerator(this.light);
    } else if (!enabled && this.shadowGenerator) {
      this.shadowGenerator.dispose();
      this.shadowGenerator = undefined;
    }
  }

  /**
   * Serialize with light-specific properties
   */
  serialize(): any {
    const base = super.serialize();
    return base; // Light properties already in metadata
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    if (this.light) {
      this.light.dispose();
    }
    if (this.shadowGenerator) {
      this.shadowGenerator.dispose();
    }
    super.dispose();
  }
} 