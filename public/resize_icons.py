#!/usr/bin/env python3
"""
Icon Resizer Script
Resizes icon-original.png to 512x512 and 192x192 pixels and replaces existing icon files.
Maintains image quality using high-quality resampling.
"""

import os
import sys
from PIL import Image, ImageOps

def resize_icon(input_path, output_sizes):
    """
    Resize an image to multiple sizes while maintaining quality.
    
    Args:
        input_path (str): Path to the input image
        output_sizes (dict): Dictionary mapping output filenames to (width, height) tuples
    """
    try:
        # Open the original image
        with Image.open(input_path) as img:
            # Convert to RGB if necessary (for PNG with alpha channel)
            if img.mode in ('RGBA', 'LA', 'P'):
                # Create a new white background image
                background = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'P':
                    img = img.convert('RGBA')
                # Paste the image on the background, using the alpha channel as mask
                if img.mode == 'RGBA':
                    background.paste(img, mask=img.split()[-1])
                    img = background
                else:
                    img = img.convert('RGB')
            
            # Get the directory of the input file
            input_dir = os.path.dirname(input_path)
            
            # Resize for each required size
            for output_filename, (width, height) in output_sizes.items():
                output_path = os.path.join(input_dir, output_filename)
                
                # Resize using high-quality resampling
                resized_img = img.resize((width, height), Image.Resampling.LANCZOS)
                
                # Save as PNG with high quality
                resized_img.save(output_path, 'PNG', optimize=True)
                print(f"✅ Created {output_filename} ({width}x{height})")
                
    except FileNotFoundError:
        print(f"❌ Error: Could not find {input_path}")
        print("Please make sure icon-original.png exists in the same directory as this script.")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error processing image: {e}")
        sys.exit(1)

def main():
    """Main function to run the icon resizer."""
    # Get the directory where this script is located
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Path to the original icon
    original_icon_path = os.path.join(script_dir, "icon-original.png")
    
    # Output sizes and filenames
    output_sizes = {
        "icon-512x512.png": (512, 512),
        "icon-192x192.png": (192, 192)
    }
    
    print("🎨 Icon Resizer - TimeBud")
    print("=" * 40)
    
    # Check if original icon exists
    if not os.path.exists(original_icon_path):
        print(f"❌ Error: {original_icon_path} not found!")
        print("Please place icon-original.png in the public folder.")
        sys.exit(1)
    
    print(f"📁 Working directory: {script_dir}")
    print(f"📸 Input file: icon-original.png")
    print("🎯 Target sizes:")
    for filename, (width, height) in output_sizes.items():
        print(f"   - {filename} ({width}x{height})")
    print()
    
    # Resize the icon
    resize_icon(original_icon_path, output_sizes)
    
    print()
    print("✨ Icon resizing completed successfully!")
    print("🔄 Existing icon files have been replaced.")

if __name__ == "__main__":
    main()
