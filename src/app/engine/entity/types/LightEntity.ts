import * as THREE from 'three';
import { EntityBase, SerializedEntityData, toThreeVector3, toThreeEuler } from '../base/EntityBase';
import { EditorEngine } from '../../core/EditorEngine';
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
  _light: THREE.Light;
  _gizmoMesh: THREE.Mesh;
  _material: THREE.MeshStandardMaterial;
  
  props: LightProps;


  constructor(
    name: string,
    scene: THREE.Scene,
    options: {
      uuid?: string;
      position?: THREE.Vector3;
      props?: LightProps,
      onLoaded?: (entity: LightEntity) => void;
    } = {}
  ) {
    super(name, scene, 'light', {
      uuid: options.uuid,
      position: options.position,
    });

    console.log("LightEntity: constructor", options);

    // Create the light
    this._light = this.createLight(
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
    const { lightSphere, material } = this.createLightGizmo();
    this._gizmoMesh = lightSphere;
    this._material = material as THREE.MeshStandardMaterial;

    options.onLoaded?.(this);
  }

  /**
   * Create the actual light
   */
  private createLight(intensity: number, color: SerializedColor, shadowEnabled: boolean): THREE.Light {
    // Implementation for light creation
    const light = new THREE.PointLight(
      new THREE.Color(color.r, color.g, color.b),
      intensity,
      100, // distance
      1    // decay
    );

    // Set up shadows if enabled
    if (shadowEnabled) {
      light.castShadow = true;

      // Configure shadow properties
      light.shadow.mapSize.width = 2048;
      light.shadow.mapSize.height = 2048;
      light.shadow.camera.near = 0.1;
      light.shadow.camera.far = 100;
      light.shadow.bias = -0.005;
      light.shadow.radius = 2;
      light.shadow.blurSamples = 8;
    }

    // Add the light to this entity
    this.add(light);

    return light;
  }

  /**
   * Create visual representation of the light
   */
  private createLightGizmo(): { lightSphere: THREE.Mesh, material: THREE.MeshStandardMaterial } {
    // Create a visual representation for the light (a glowing sphere)
    const geometry = new THREE.SphereGeometry(0.2);
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(this.props.color.r, this.props.color.g, this.props.color.b),
      emissive: new THREE.Color(this.props.color.r, this.props.color.g, this.props.color.b),
      emissiveIntensity: 1.0
    });

    const lightSphere = new THREE.Mesh(geometry, material);

    // Make the sphere not cast shadows (it's just a visual indicator)
    lightSphere.castShadow = false;
    lightSphere.receiveShadow = false;

    // Add the sphere to this entity
    this.add(lightSphere);
    lightSphere.userData = { rootEntity: this };

    return { lightSphere, material };
  }

  /**
   * Set light color
   */
  setColor(color: THREE.Color): void {
    if (this._light instanceof THREE.PointLight) {
      this._light.color = color;

      // Update the gizmo color
      if (this._gizmoMesh && this._gizmoMesh.material) {
        const material = this._gizmoMesh.material as THREE.MeshStandardMaterial;
        material.color = color;
        material.emissive = color;
      }

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
    this._light.intensity = intensity;

    // Update metadata
    this.props.intensity = intensity;
  }

  /**
   * Enable/disable shadows
   */
  setShadowEnabled(enabled: boolean): void {
    if (this._light instanceof THREE.PointLight ||
      this._light instanceof THREE.DirectionalLight ||
      this._light instanceof THREE.SpotLight) {
      this._light.castShadow = enabled;
    }

    // Update metadata
    this.props.shadowEnabled = enabled;
  }

  /**
   * Deserialize a light entity from serialized data
   */
  static async deserialize(scene: THREE.Scene, data: SerializedLightEntityData): Promise<LightEntity> {
    const position = data.position ? toThreeVector3(data.position) : undefined;
    const rotation = data.rotation ? toThreeEuler(data.rotation) : undefined;

    return new LightEntity(data.name, scene, {
      uuid: data.uuid,
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
    if (this._light) {
      // Remove the light from this entity
      this.remove(this._light);

      // Dispose of any resources associated with the light
      if (this._light.shadow && this._light.shadow.map) {
        this._light.shadow.map.dispose();
      }
    }

    if (this._gizmoMesh) {
      // Remove the gizmo mesh from this entity
      this.remove(this._gizmoMesh);

      // Dispose of geometry and material
      if (this._gizmoMesh.geometry) {
        this._gizmoMesh.geometry.dispose();
      }

      if (this._gizmoMesh.material) {
        if (Array.isArray(this._gizmoMesh.material)) {
          this._gizmoMesh.material.forEach(material => material.dispose());
        } else {
          this._gizmoMesh.material.dispose();
        }
      }
    }

    super.dispose();
  }

  /**
   * Get the gizmo target for manipulation
   */
  getGizmoTarget(): THREE.Object3D {
    return this._gizmoMesh;
  }

  public static isLightEntity(entity: EntityBase): entity is LightEntity {
    return entity.entityType === 'light';
  }

  /**
   * Convert RGB (0-1) to hex color string
   */
  public rgbToHex(r: number, g: number, b: number): string {
    return "#" + ((1 << 24) + (Math.round(r * 255) << 16) + (Math.round(g * 255) << 8) + Math.round(b * 255)).toString(16).slice(1);
  }

  /**
   * Convert hex color to RGB (0-1)
   */
  public hexToRgb(hex: string): { r: number, g: number, b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16) / 255,
      g: parseInt(result[2], 16) / 255,
      b: parseInt(result[3], 16) / 255
    } : { r: 1, g: 1, b: 1 };
  }

  /**
   * Set light color from hex string
   */
  public setColorFromHex(hexColor: string): void {
    const rgb = this.hexToRgb(hexColor);
    this.setColor(new THREE.Color(rgb.r, rgb.g, rgb.b));
  }

  /**
   * Get current light color as hex
   */
  public getColorAsHex(): string {
    const color = this._light.color;
    return this.rgbToHex(color.r, color.g, color.b);
  }
} 