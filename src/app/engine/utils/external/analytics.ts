import posthog from 'posthog-js';

// Initialize PostHog with your project API key
export const initAnalytics = () => {
  if (typeof window !== 'undefined' && !posthog.__loaded) {
    posthog.init(
      process.env.NEXT_PUBLIC_POSTHOG_KEY || 'your_posthog_api_key',
      {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
        // Only capture events in production
        capture_pageview: process.env.NODE_ENV === 'production',
        autocapture: false,
      }
    );
  }
};

// Track specific events with their properties
export const trackEvent = (eventName: string, properties?: Record<string, any>) => {
  if (typeof window !== 'undefined' && posthog.__loaded) {
    posthog.capture(eventName, properties);
    console.log(`[Analytics] Tracked: ${eventName}`, properties);
  }
};

// Event name constants for consistency
export const ANALYTICS_EVENTS = {
  RENDER_IMAGE: 'render_image',
  RENDER_COMFYUI: 'render_comfyui',
  GENERATE_IMAGE: 'generate_image',
  CONVERT_TO_3D: 'convert_to_3d',
  SAVE_PROJECT: 'save_project',
  LOAD_PROJECT: 'load_project',
  CREATE_ENTITY: 'create_entity',
  DELETE_ENTITY: 'delete_entity',
  CHANGE_SETTINGS: 'change_settings',
  CHARACTER_EDIT: 'character_edit',
  IMPORT_ASSET: 'import_asset',
}; 