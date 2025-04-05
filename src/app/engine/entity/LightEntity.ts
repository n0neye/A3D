import * as BABYLON from '@babylonjs/core';
import { EntityBase, SerializedEntityData, toBabylonVector3 } from './EntityBase';
import { environmentObjects } from '@/app/util/editor/editor-util';
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

// Add serialized data interface
export interface SerializedLightEntityData extends SerializedEntityData {
  props: LightProps;
}

export class LightEntity extends EntityBase {
  // LightEntity specific properties
  light: BABYLON.Light;
  shadowGenerator?: BABYLON.ShadowGenerator;
  gizmoMesh: BABYLON.Mesh;
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

    console.log("LightEntity: constructor", options);

    // Create the light
    this.light = this.createLight(
      options.props?.intensity || 0.7,
      options.props?.color || { r: 1, g: 1, b: 1 },
      options.props?.shadowEnabled || false
    );

    this.props = {
      intensity: options.props?.intensity || 0.7,
      color: options.props?.color || { r: 1, g: 1, b: 1 },
      shadowEnabled: options.props?.shadowEnabled || false
    };

    // Create light visual representation
    this.gizmoMesh = this.createLightGizmo(scene);
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
    console.log("Creating shadow generator for light", light);
    // Create with higher resolution for better quality
    const shadowGenerator = new BABYLON.ShadowGenerator(2048, light);

    // Better filtering technique for smoother shadows
    shadowGenerator.usePercentageCloserFiltering = true; // Use PCF instead of blur
    shadowGenerator.filteringQuality = BABYLON.ShadowGenerator.QUALITY_HIGH;

    // Fix self-shadowing artifacts with proper bias
    shadowGenerator.bias = 0.05

    shadowGenerator.useBlurExponentialShadowMap = true;
    shadowGenerator.blurScale = 0.5;

    // Add to our global list
    environmentObjects.shadowGenerators.push(shadowGenerator);
  }

  /**
   * Create visual representation of the light
   */
  private createLightGizmo(scene: BABYLON.Scene): BABYLON.Mesh {

    // Create a visual representation for the light (a glowing sphere)
    const lightSphere = BABYLON.MeshBuilder.CreateSphere(
      `${name}-visual`,
      { diameter: 0.2 },
      scene
    );
    // Create an emissive material for the sphere
    const lightMaterial = new BABYLON.StandardMaterial(`${name}-material`, scene);
    lightMaterial.emissiveColor = new BABYLON.Color3(this.props.color.r, this.props.color.g, this.props.color.b);
    lightMaterial.disableLighting = true;
    lightSphere.material = lightMaterial;

    // Make the sphere not cast shadows (it's just a visual indicator)
    lightSphere.receiveShadows = false;

    // Parent the sphere to the light entity
    lightSphere.parent = this;
    lightSphere.metadata = { rootEntity: this };
    return lightSphere;
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
   * Deserialize a light entity from serialized data
   */
  static async deserialize(scene: BABYLON.Scene, data: SerializedLightEntityData): Promise<LightEntity> {
    const position = data.position ? toBabylonVector3(data.position) : undefined;

    return new LightEntity(data.name, scene, {
      id: data.id,
      position,
      props: data.props
    });
  }

  /**
   * Serialize with light-specific properties
   */
  serialize(): SerializedLightEntityData {
    const base = super.serialize();
    return {
      ...base,
      props: this.props
    };
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