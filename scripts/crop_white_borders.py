"""
Script to automatically detect and remove white borders from Quran page images.
This script processes all images in a directory and crops out white borders.
"""

import os
import sys
from PIL import Image, ImageChops
import numpy as np

def trim_white_borders(image, threshold=230, edge_sample_size=30, variance_threshold=300):
    """
    Trim white/light colored borders from an image using variance-based detection.
    
    Args:
        image: PIL Image object
        threshold: Pixel value threshold to consider as white (0-255)
        edge_sample_size: Number of pixels to sample from edges
        variance_threshold: Variance threshold - low variance indicates uniform border
    
    Returns:
        PIL Image object with borders cropped
    """
    # Convert to numpy array
    img_array = np.array(image)
    
    # Convert to grayscale for easier processing
    if len(img_array.shape) == 3:
        # Convert RGB to grayscale using standard formula
        gray = np.dot(img_array[...,:3], [0.299, 0.587, 0.114]).astype(np.uint8)
    else:
        gray = img_array
    
    height, width = gray.shape
    
    # Find content by looking for rows/columns with sufficient darkness or variance
    # A border row/column will be very light and have low variance
    
    # Check each row
    row_is_content = np.zeros(height, dtype=bool)
    for i in range(height):
        row = gray[i, :]
        # Row has content if: has dark pixels OR has high variance (text/decoration)
        has_dark = np.any(row < threshold)
        has_variance = np.var(row) > variance_threshold
        row_is_content[i] = has_dark or has_variance
    
    # Check each column
    col_is_content = np.zeros(width, dtype=bool)
    for i in range(width):
        col = gray[:, i]
        # Column has content if: has dark pixels OR has high variance
        has_dark = np.any(col < threshold)
        has_variance = np.var(col) > variance_threshold
        col_is_content[i] = has_dark or has_variance
    
    # Find the bounding box
    if not row_is_content.any() or not col_is_content.any():
        print("    Warning: Image appears to be entirely light or no content detected")
        return image
    
    row_indices = np.where(row_is_content)[0]
    col_indices = np.where(col_is_content)[0]
    
    row_min, row_max = row_indices[0], row_indices[-1]
    col_min, col_max = col_indices[0], col_indices[-1]
    
    # Add small padding to ensure we don't cut into content
    row_min = max(0, row_min - 2)
    row_max = min(height - 1, row_max + 2)
    col_min = max(0, col_min - 2)
    col_max = min(width - 1, col_max + 2)
    
    # Crop the image
    cropped = image.crop((col_min, row_min, col_max + 1, row_max + 1))
    
    return cropped

def process_directory(input_dir, output_dir=None, threshold=230, variance_threshold=300):
    """
    Process all images in a directory to remove white borders.
    
    Args:
        input_dir: Directory containing images to process
        output_dir: Directory to save processed images (if None, overwrites original)
        threshold: Pixel value threshold to consider as white (0-255)
        variance_threshold: Variance threshold for detecting uniform borders
    """
    # If output_dir is not specified, overwrite original images
    if output_dir is None:
        output_dir = input_dir
    else:
        os.makedirs(output_dir, exist_ok=True)
    
    # Supported image formats
    supported_formats = ('.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.webp')
    
    # Get all image files
    image_files = [f for f in os.listdir(input_dir) 
                   if f.lower().endswith(supported_formats)]
    
    if not image_files:
        print(f"No image files found in {input_dir}")
        return
    
    print(f"Found {len(image_files)} images to process")
    
    # Process each image
    for idx, filename in enumerate(image_files, 1):
        input_path = os.path.join(input_dir, filename)
        output_path = os.path.join(output_dir, filename)
        
        try:
            # Open image
            img = Image.open(input_path)
            original_size = img.size
            
            # Trim white borders
            cropped_img = trim_white_borders(img, threshold, variance_threshold=variance_threshold)
            new_size = cropped_img.size
            
            # Save the cropped image
            cropped_img.save(output_path, quality=95)
            
            # Calculate how much was cropped
            width_diff = original_size[0] - new_size[0]
            height_diff = original_size[1] - new_size[1]
            
            print(f"[{idx}/{len(image_files)}] {filename}: "
                  f"{original_size[0]}x{original_size[1]} → {new_size[0]}x{new_size[1]} "
                  f"(removed {width_diff}px width, {height_diff}px height)")
            
        except Exception as e:
            print(f"Error processing {filename}: {str(e)}")
    
    print(f"\nProcessing complete! Images saved to: {output_dir}")

def main():
    if len(sys.argv) < 2:
        print("Usage: python crop_white_borders.py <input_path> [output_path] [threshold] [variance_threshold]")
        print("\nArguments:")
        print("  input_path          - Path to image file or directory containing images")
        print("  output_path         - (Optional) Path to save cropped image(s). If not specified, overwrites original.")
        print("  threshold           - (Optional) Pixel brightness threshold (0-255). Default: 230")
        print("  variance_threshold  - (Optional) Variance threshold for border detection. Default: 300")
        print("\nExample:")
        print('  python crop_white_borders.py "D:\\images\\quran\\page.jpg"')
        print('  python crop_white_borders.py "D:\\images\\quran"')
        print('  python crop_white_borders.py "D:\\images\\quran" "D:\\images\\quran_cropped"')
        print('  python crop_white_borders.py "D:\\images\\quran" "D:\\images\\quran_cropped" 230 300')
        sys.exit(1)
    
    input_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) > 2 else None
    threshold = int(sys.argv[3]) if len(sys.argv) > 3 else 230
    variance_threshold = int(sys.argv[4]) if len(sys.argv) > 4 else 300
    
    if not os.path.exists(input_path):
        print(f"Error: Input path does not exist: {input_path}")
        sys.exit(1)
    
    # Check if input is a file or directory
    if os.path.isfile(input_path):
        # Process single file
        if output_path is None:
            output_path = input_path
        
        print(f"Input file: {input_path}")
        print(f"Output file: {output_path}")
        print(f"Threshold: {threshold}")
        print(f"Variance threshold: {variance_threshold}")
        print()
        
        try:
            img = Image.open(input_path)
            original_size = img.size
            
            cropped_img = trim_white_borders(img, threshold, variance_threshold=variance_threshold)
            new_size = cropped_img.size
            
            cropped_img.save(output_path, quality=95)
            
            width_diff = original_size[0] - new_size[0]
            height_diff = original_size[1] - new_size[1]
            
            print(f"{os.path.basename(input_path)}: "
                  f"{original_size[0]}x{original_size[1]} → {new_size[0]}x{new_size[1]} "
                  f"(removed {width_diff}px width, {height_diff}px height)")
            print(f"\nImage saved to: {output_path}")
            
        except Exception as e:
            print(f"Error processing {input_path}: {str(e)}")
            sys.exit(1)
    
    elif os.path.isdir(input_path):
        # Process directory
        if output_path and output_path != input_path:
            print(f"Input directory: {input_path}")
            print(f"Output directory: {output_path}")
        else:
            print(f"Processing directory: {input_path}")
            print("WARNING: Original images will be overwritten!")
            response = input("Continue? (y/n): ")
            if response.lower() != 'y':
                print("Operation cancelled.")
                sys.exit(0)
        
        print(f"Threshold: {threshold}")
        print(f"Variance threshold: {variance_threshold}")
        print()
        
        process_directory(input_path, output_path, threshold, variance_threshold)

if __name__ == "__main__":
    main()
