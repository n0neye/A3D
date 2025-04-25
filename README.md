![A3D Logo](/frontend/public/logo.svg)

# A3D Editor (beta)

A3D is a 3DxAI hybrid editor that allows you to compose 3D scene, generate 3D models and render them with AI.


## Main Features

- Dummy characters and pose control
- 2D image and 3D model generation with AI (Fal.ai)
- Depth guided final rendering with AI (Fal.ai or [ComfyUI](https://github.com/n0neye/A3D-comfyui-integration))
- 3D scene composition, 2D/3D import, project management.


## Usage

1. Download the latest release from [Releases](https://github.com/n0neye/A3D/releases/), windows only for now.
2. Unzip the file and run `A3D.exe`
3. (Optional) Create a [Fal.ai](https://fal.ai) account and add an [API key](https://fal.ai/dashboard/keys) in User Setting for 3D model generation, and cloud rendering.
4. (Optional) Install the [ComfyUI integration](https://github.com/n0neye/A3D-comfyui-integration) custom nodes, to send the color and depth images to ComfyUI for final rendering.
5. Please note that the app is still in early beta, and bugs are expected. Any feedback is welcome!


## Cost
The app is free to use, but some features require 3rd party services for now. We'll try to make all features available with local computation in the future.
- Fast image generation with [Fast-LCM](https://fal.ai/models/fal-ai/fast-lcm-diffusion): 1739 images/$1
- 3D model generation with [Trellis](https://fal.ai/models/fal-ai/trellis): 50 models/$1
- Final render with [Flux lora depth](https://fal.ai/models/fal-ai/flux-control-lora-depth/image-to-image): 800 images/$1


## TODO

- [ ] Send OpenPose image to ComfyUI
- [ ] Animation system & Depth guided video rendering with Wan2.1
- [ ] Local 3D model generation, with ComfyUI and/or built-in python
- [ ] Skybox generation
- [ ] More built-in characters & poses

## Development

1. Install dependencies: `yarn`
1. Run the electron app & nextjs development server: `yarn dev`
1. Build electron app: `yarn dist`

see [guide/development.md](guide/development.md) for more details

## Looking forCollaborators

I'm looking for collaborators to help me improve the project, especially in ComfyUI integration and local 3D model generation. DM me on X if you're interested!

## Author
X: [_@n0neye](https://x.com/_n0neye)
IG: [@n0neye](https://www.instagram.com/n0neye/) 


⭐ if you like the project!
