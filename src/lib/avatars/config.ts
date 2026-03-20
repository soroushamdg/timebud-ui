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
- Maintain a playful, toy-like aesthetic throughout

REFERENCE IMAGE INSTRUCTIONS:
When a reference image is provided, carefully analyze the person's facial features, hair style, skin tone, and distinctive characteristics. Create a LEGO minifigure that captures their unique identity while applying the LEGO transformation style. Focus on:
- Matching hair color and style with LEGO hair pieces
- Capturing facial structure and expressions within minifigure constraints
- Using appropriate skin tone colors for the minifigure
- Including distinctive features like glasses, facial hair, or accessories
- Creating a recognizable likeness that maintains the person's identity`

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
