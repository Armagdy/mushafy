"""
Aggressive white border cropping for Quran pages with better edge detection.
This version is more aggressive at detecting and removing subtle white/light borders.
"""

import os
import sys
from PIL import Image
import numpy as np

def aggressive_trim(image, margin=5):
    """
    Aggressively trim white borders using percentile-based detection.
    
    Args:
        image: PIL Image object
        margin: Pixels to keep as safety margin around detected content
    
    Returns:
        PIL Image object with borders cropped
    """
    # Convert to numpy array
    img_array = np.array(image)
    
    # Convert to grayscale
    if len(img_array.shape) == 3:
        gray = np.dot(img_array[...,:3], [0.299, 0.587, 0.114]).astype(np.uint8)
    else:
        gray = img_array
    
    height, width = gray.shape
    
    # Use adaptive threshold based on image statistics
    # Find the 95th percentile - this will be close to white in bordered images
    threshold = np.percentile(gray, 95) - 15  # More aggressive
    
    print(f"    Using adaptive threshold: {threshold:.1f}")
    
    # For each row, check if it contains significant dark content
    row_has_content = []
    for i in range(height):
        row = gray[i, :]
        # Row has content if it has enough dark pixels
        dark_pixel_count = np.sum(row < threshold)
        # Consider content if more than 1% of pixels are darker than threshold
        has_content = dark_pixel_count > (width * 0.01)
        row_has_content.append(has_content)
    
    # For each column, check if it contains significant dark content  
    col_has_content = []
    for i in range(width):
        col = gray[:, i]
        # Column has content if it has enough dark pixels
        dark_pixel_count = np.sum(col < threshold)
        # Consider content if more than 1% of pixels are darker than threshold
        has_content = dark_pixel_count > (height * 0.01)
        col_has_content.append(has_content)
    
    # Find first and last rows/columns with content
    row_indices = [i for i, has in enumerate(row_has_content) if has]
    col_indices = [i for i, has in enumerate(col_has_content) if has]
    
    if not row_indices or not col_indices:
        print("    Warning: No content detected, returning original image")
        return image
    
    row_min, row_max = row_indices[0], row_indices[-1]
    col_min, col_max = col_indices[0], col_indices[-1]
    
    # Add small margin to avoid cutting content
    row_min = max(0, row_min - margin)
    row_max = min(height - 1, row_max + margin)
    col_min = max(0, col_min - margin)
    col_max = min(width - 1, col_max + margin)
    
    # Crop the image
    cropped = image.crop((col_min, row_min, col_max + 1, row_max + 1))
    
    return cropped

def process_images(input_dir, output_dir=None, margin=5):
    """
    Process all images in a directory with aggressive cropping.
    
    Args:
        input_dir: Directory containing images
        output_dir: Output directory (None = overwrite originals)
        margin: Safety margin in pixels
    """
    if output_dir is None:
        output_dir = input_dir
    else:
        os.makedirs(output_dir, exist_ok=True)
    
    # Get all image files
    supported = ('.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.webp')
    image_files = sorted([f for f in os.listdir(input_dir) 
                         if f.lower().endswith(supported)])
    
    if not image_files:
        print(f"No images found in {input_dir}")
        return
    
    print(f"Found {len(image_files)} images to process")
    print(f"Safety margin: {margin}px\n")
    
    # Process each image
    for idx, filename in enumerate(image_files, 1):
        input_path = os.path.join(input_dir, filename)
        output_path = os.path.join(output_dir, filename)
        
        try:
            print(f"[{idx}/{len(image_files)}] Processing {filename}...")
            
            # Open and process
            img = Image.open(input_path)
            original_size = img.size
            
            cropped = aggressive_trim(img, margin)
            new_size = cropped.size
            
            # Save with high quality
            cropped.save(output_path, quality=95, optimize=True)
            
            # Show results
            width_diff = original_size[0] - new_size[0]
            height_diff = original_size[1] - new_size[1]
            
            print(f"    {original_size[0]}x{original_size[1]} → {new_size[0]}x{new_size[1]}")
            print(f"    Removed: {width_diff}px width, {height_diff}px height\n")
            
        except Exception as e:
            print(f"    ERROR: {e}\n")
    
    print(f"✓ Complete! Processed images saved to: {output_dir}")

def main():
    if len(sys.argv) < 2:
        print("Aggressive White Border Cropping for Quran Pages")
        print("=" * 50)
        print("\nUsage:")
        print("  python aggressive_crop.py <input_path> [output_path] [margin]")
        print("\nArguments:")
        print("  input_path  - Image file or directory")
        print("  output_path - (Optional) Output path (default: overwrites)")
        print("  margin      - (Optional) Safety margin in pixels (default: 5)")
        print("\nExamples:")
        print('  python aggressive_crop.py "public/assets/mushaf_madinah_images"')
        print('  python aggressive_crop.py "public/assets/mushaf_madinah_images" "output" 3')
        sys.exit(1)
    
    input_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) > 2 else None
    margin = int(sys.argv[3]) if len(sys.argv) > 3 else 5
    
    if not os.path.exists(input_path):
        print(f"Error: Path not found: {input_path}")
        sys.exit(1)
    
    # Single file or directory
    if os.path.isfile(input_path):
        # Process single file
        output_path = output_path or input_path
        
        print(f"Processing: {input_path}")
        print(f"Output: {output_path}")
        print(f"Margin: {margin}px\n")
        
        try:
            img = Image.open(input_path)
            original_size = img.size
            
            cropped = aggressive_trim(img, margin)
            new_size = cropped.size
            
            cropped.save(output_path, quality=95, optimize=True)
            
            width_diff = original_size[0] - new_size[0]
            height_diff = original_size[1] - new_size[1]
            
            print(f"{original_size[0]}x{original_size[1]} → {new_size[0]}x{new_size[1]}")
            print(f"Removed: {width_diff}px width, {height_diff}px height")
            print(f"\n✓ Saved to: {output_path}")
            
        except Exception as e:
            print(f"Error: {e}")
            sys.exit(1)
    
    else:
        # Process directory
        if output_path and output_path != input_path:
            print(f"Input: {input_path}")
            print(f"Output: {output_path}")
        else:
            print(f"Processing: {input_path}")
            print("⚠ WARNING: Will overwrite original images!")
            response = input("Continue? (y/n): ")
            if response.lower() != 'y':
                print("Cancelled.")
                sys.exit(0)
        
        print()
        process_images(input_path, output_path, margin)

if __name__ == "__main__":
    main()
