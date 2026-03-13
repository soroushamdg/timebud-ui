export const LEGO_TRANSFORM_PROMPT = `Transform this image into a vibrant LEGO minifigure world scene with the following specifications:

- Create an isometric 3D render style showing the subject as LEGO elements
- Use bright, vibrant plastic colors with glossy, reflective surfaces
- Show visible LEGO studs on all surfaces and blocks
- Set against a clean white or light neutral background
- Apply soft, even studio lighting to highlight the plastic texture
- Keep the composition centered and perfectly square
- Preserve the core subject and theme of the original image but render everything in authentic LEGO brick style
- Include characteristic LEGO minifigure proportions if depicting characters
- Ensure high contrast and sharp edges typical of LEGO photography
- Output must be 256x256 pixels
- No text, letters, or labels should appear in the final image
- Maintain a playful, toy-like aesthetic throughout`

export const AVATAR_CONFIG = {
  size: 256,
  quality: 'standard' as const,
  outputFormat: 'png' as const,
  storageBucket: {
    profile: 'profile-avatars',
    project: 'project-avatars',
  },
  staticLibraryPath: '/project-avatars',
  maxFileSizeMB: 2,
  targetCompressedSizeKB: 500,
}

export interface StaticAvatar {
  id: string
  filename: string
  label: string
  path: string
}
