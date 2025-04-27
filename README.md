<p align="center">
  <img src="/screenshot.png" alt="A3D Screenshot" style="max-width: 1200px; width: 100%; height: auto; display: block; margin: 0 auto;">
</p>


# A3D Editor <sup style="color: #FF6600; font-size: 14px;">Beta</sup>

A3D is a 3D x AI hybrid editor that allows you to compose 3D scene, generate 2D & 3D assets and render them with AI.


## ✨ Main Features

- Dummy characters and pose control
- 3D model generation with Gen AI (Fal.ai)
- Color/Depth guided rendering with [ComfyUI](https://github.com/n0neye/A3D-comfyui-integration) or Fal.ai
- Drag-drop your 3D models or characters(Tested with [Mixamo characters](https://www.mixamo.com/))


## 🚀 Getting Started

1. Download the latest release from [Releases](https://github.com/n0neye/A3D/releases/), **windows only** for now.
1. Unzip the file and run `A3D.exe`
1. (Optional) Fore ComfyUI integration, install the [A3D ComfyUI Integration](https://github.com/n0neye/A3D-comfyui-integration) via Custon Node Manager, to send the color and depth images to ComfyUI for final rendering.
1. (Optional) For 3D model generation, and cloud rendering: Create a [Fal.ai](https://fal.ai) account, add some credits, and create an [API key](https://fal.ai/dashboard/keys), then add it in `A3D -> ⚙️User Setting`.
1. Please note that the app is still in early beta, and bugs are expected. Any feedback is welcome!


## 💸 Cost
The app is **free to use**, but some optional features require 3rd party services for now. We aim to offer fully local workflows in future updates.
- 3D model generation with [Trellis](https://fal.ai/models/fal-ai/trellis)
- Final render with [Flux lora depth](https://fal.ai/models/fal-ai/flux-control-lora-depth/image-to-image)
- Fast image generation with [Fast-LCM](https://fal.ai/models/fal-ai/fast-lcm-diffusion)
- Remove background with [rembg](https://fal.ai/models/fal-ai/imageutils/rembg)


## 🛠️ Roadmap

- [ ] OpenPose to ComfyUI
- [ ] Animation system & Depth guided video rendering (Wan2.1)
- [ ] Local 3D model generation (ComfyUI and/or built-in python tools)
- [ ] Skybox generation
- [ ] More built-in characters & poses
- [ ] IK system for easier pose control

## 🧪 Development

1. Install dependencies: `yarn` or `npm install`
1. Run the electron app & nextjs development server: `yarn dev` or `npm run dev`
1. Build electron app: `yarn dist` or `npm run dist`

see [guide/development.md](guide/development.md) for more details

## 🤝 Looking for Collaborators

I'm looking for collaborators interested in:
- Improving ComfyUI integration
- Building local 3D model generation systems

DM me on X if you're interested!

## 🤖 Author
X: [_@n0neye](https://x.com/_n0neye)
IG: [@n0neye](https://www.instagram.com/n0neye/) 


