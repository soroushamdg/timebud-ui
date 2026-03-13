#!/usr/bin/env python3
"""
Avatar Extraction Script
Extracts individual avatars from avatar-map.png, removes backgrounds,
and saves them as 512x512 images with 1/4 padding.
"""

import os
from PIL import Image
import numpy as np

# Avatar names corresponding to grid positions (left to right, top to bottom)
AVATAR_NAMES = [
    "lego-blocks",
    "laptop-desk",
    "books-lamp",
    "art-palette",
    "briefcase",
    "trophy",
    "lightbulb",
    "camera",
    "plant",
    "game-controller",
    "guitar-amp",
    "toolbox",
    "calendar",
    "globe",
    "dumbbell",
    "chart"
]

def detect_avatars(image_path, grid_size=(4, 4)):
    """
    Detect and extract individual avatars from the grid image.
    Uses the entire cell area to capture complete avatars.
    
    Args:
        image_path: Path to the avatar-map.png file
        grid_size: Tuple of (rows, cols) for the grid layout
        
    Returns:
        List of PIL Image objects for each avatar
    """
    img = Image.open(image_path)
    width, height = img.size
    rows, cols = grid_size
    
    # Calculate exact cell dimensions
    cell_width = width / cols
    cell_height = height / rows
    
    avatars = []
    
    for row in range(rows):
        for col in range(cols):
            # Use the full cell area - no reduction
            left = int(col * cell_width)
            top = int(row * cell_height)
            right = int((col + 1) * cell_width)
            bottom = int((row + 1) * cell_height)
            
            # Crop the full cell
            avatar = img.crop((left, top, right, bottom))
            avatars.append(avatar)
    
    return avatars


def resize_with_padding(image, target_size=512, padding_ratio=0.25):
    """
    Resize image to target_size x target_size with padding.
    
    Args:
        image: PIL Image object
        target_size: Final image size (default 512)
        padding_ratio: Ratio of padding (0.25 = 1/4 padding)
        
    Returns:
        PIL Image object resized with padding
    """
    # Calculate the size for the avatar content (accounting for padding)
    content_size = int(target_size * (1 - 2 * padding_ratio))
    
    # Get original dimensions
    width, height = image.size
    
    # Calculate scaling to fit within content_size while maintaining aspect ratio
    scale = min(content_size / width, content_size / height)
    new_width = int(width * scale)
    new_height = int(height * scale)
    
    # Resize the image
    resized = image.resize((new_width, new_height), Image.Resampling.LANCZOS)
    
    # Create new image with target size and white background
    final_image = Image.new('RGB', (target_size, target_size), (255, 255, 255))
    
    # Calculate position to center the resized image
    x = (target_size - new_width) // 2
    y = (target_size - new_height) // 2
    
    # Paste the resized image onto the final image
    final_image.paste(resized, (x, y))
    
    return final_image

def main():
    """Main execution function."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    input_image = os.path.join(script_dir, 'avatar-map.png')
    output_dir = script_dir
    
    print(f"Processing {input_image}...")
    
    # Extract avatars from grid
    print("Extracting avatars from grid...")
    avatars = detect_avatars(input_image)
    print(f"Found {len(avatars)} avatars")
    
    # Process each avatar
    for idx, (avatar, name) in enumerate(zip(avatars, AVATAR_NAMES), 1):
        print(f"\nProcessing avatar {idx}/{len(avatars)}: {name}")
        
        # Resize with padding
        print("  - Resizing to 512x512 with padding...")
        final_avatar = resize_with_padding(avatar, target_size=512, padding_ratio=0.25)
        
        # Save
        output_path = os.path.join(output_dir, f"{name}.png")
        final_avatar.save(output_path, 'PNG')
        print(f"  - Saved to {output_path}")
    
    print(f"\n✓ Successfully processed {len(avatars)} avatars!")
    print(f"Output directory: {output_dir}")

if __name__ == "__main__":
    main()
