#!/usr/bin/env python3
"""
Automatic Deskewing Script for Quran Pages
Detects rotation angle and corrects alignment
"""

import cv2
import numpy as np
from pathlib import Path
import argparse


def detect_skew_angle(image_path):
    """
    Detect the skew angle of a scanned document image.
    Returns the angle in degrees.
    """
    # Read image
    img = cv2.imread(str(image_path))
    if img is None:
        raise ValueError(f"Could not read image: {image_path}")
    
    # Convert to grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Apply binary threshold
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    
    # Detect edges with adjusted parameters
    edges = cv2.Canny(binary, 30, 100, apertureSize=3)
    
    # Use Hough Line Transform with more sensitive parameters
    lines = cv2.HoughLinesP(edges, 1, np.pi/180, threshold=80, 
                            minLineLength=50, maxLineGap=20)
    
    if lines is None:
        print("No lines detected, trying alternative method...")
        return detect_skew_alternative(gray)
    
    # Calculate angles of all detected lines
    angles = []
    for line in lines:
        x1, y1, x2, y2 = line[0]
        angle = np.arctan2(y2 - y1, x2 - x1) * 180 / np.pi
        
        # Filter out vertical lines and normalize angles
        if abs(angle) < 45:  # Focus on mostly horizontal lines
            angles.append(angle)
    
    if not angles:
        print("No suitable lines found, trying alternative method...")
        return detect_skew_alternative(gray)
    
    # Use median for robustness, but also check if we have enough data
    skew_angle = np.median(angles)
    
    # If median is very close to 0, try alternative method for confirmation
    if abs(skew_angle) < 0.1 and len(angles) > 10:
        alt_angle = detect_skew_alternative(gray)
        if abs(alt_angle) > 0.3:  # If alternative finds a clearer angle, use it
            return alt_angle
    
    return skew_angle


def detect_skew_alternative(gray_image):
    """
    Alternative method using projection profile
    More sensitive for subtle angles
    """
    # Threshold the image
    _, binary = cv2.threshold(gray_image, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    
    # Try angles from -10 to +10 degrees with finer granularity
    best_score = -1
    best_angle = 0
    
    for angle in np.arange(-10, 10, 0.05):
        # Rotate the image
        h, w = binary.shape
        center = (w // 2, h // 2)
        M = cv2.getRotationMatrix2D(center, angle, 1.0)
        rotated = cv2.warpAffine(binary, M, (w, h), 
                                 flags=cv2.INTER_CUBIC,
                                 borderMode=cv2.BORDER_REPLICATE)
        
        # Calculate horizontal projection
        projection = np.sum(rotated, axis=1)
        
        # Score is the variance of the projection (higher = better aligned)
        score = np.var(projection)
        
        if score > best_score:
            best_score = score
            best_angle = angle
    
    return best_angle


def deskew_image(image_path, output_path, angle=None, auto_crop=True):
    """
    Deskew an image by rotating it by the detected or specified angle.
    """
    # Read image
    img = cv2.imread(str(image_path))
    if img is None:
        raise ValueError(f"Could not read image: {image_path}")
    
    # Crop white borders FIRST before detection for better accuracy
    if auto_crop:
        print(f"Removing white borders from {image_path.name}...")
        img = crop_white_borders(img)
    
    # Detect angle if not provided
    if angle is None:
        print(f"Detecting skew angle for {image_path.name}...")
        # Create temporary file for cropped image to detect angle
        import tempfile
        import os
        tmp_fd, tmp_path = tempfile.mkstemp(suffix='.jpg')
        try:
            os.close(tmp_fd)
            cv2.imwrite(tmp_path, img, [cv2.IMWRITE_JPEG_QUALITY, 95])
            angle = detect_skew_angle(Path(tmp_path))
        finally:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
        print(f"Detected angle: {angle:.2f} degrees")
    
    # Get image dimensions
    h, w = img.shape[:2]
    center = (w // 2, h // 2)
    
    # Calculate rotation matrix
    M = cv2.getRotationMatrix2D(center, angle, 1.0)
    
    # Calculate new image size to fit entire rotated image
    cos = np.abs(M[0, 0])
    sin = np.abs(M[0, 1])
    new_w = int((h * sin) + (w * cos))
    new_h = int((h * cos) + (w * sin))
    
    # Adjust the rotation matrix to account for translation
    M[0, 2] += (new_w / 2) - center[0]
    M[1, 2] += (new_h / 2) - center[1]
    
    # Perform rotation with white background
    rotated = cv2.warpAffine(img, M, (new_w, new_h),
                             flags=cv2.INTER_CUBIC,
                             borderMode=cv2.BORDER_CONSTANT,
                             borderValue=(255, 255, 255))
    
    # Always crop white borders after rotation to remove any added white space
    print(f"Removing white borders after rotation...")
    rotated = crop_white_borders(rotated)
    
    # Save the result
    cv2.imwrite(str(output_path), rotated, [cv2.IMWRITE_JPEG_QUALITY, 95])
    print(f"Saved deskewed image to: {output_path}")
    
    return angle


def crop_white_borders(img, threshold=245):
    """
    Automatically crop white borders from the image.
    Uses a lower threshold to be more aggressive with white border removal.
    """
    # Convert to grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Find all non-white pixels
    coords = cv2.findNonZero((gray < threshold).astype(np.uint8))
    
    if coords is None:
        return img
    
    # Get bounding box
    x, y, w, h = cv2.boundingRect(coords)
    
    # Add small margin
    margin = 5
    x = max(0, x - margin)
    y = max(0, y - margin)
    w = min(img.shape[1] - x, w + 2 * margin)
    h = min(img.shape[0] - y, h + 2 * margin)
    
    # Crop the image
    cropped = img[y:y+h, x:x+w]
    
    return cropped


def process_directory(input_dir, output_dir, auto_crop=True):
    """
    Process all images in a directory.
    """
    input_path = Path(input_dir)
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    # Supported image extensions
    extensions = ['.jpg', '.jpeg', '.png', '.tiff', '.tif']
    
    # Find all images (case-insensitive, no duplicates)
    image_files = []
    seen = set()
    for ext in extensions:
        for img_file in input_path.glob(f'*{ext}'):
            if img_file.name.lower() not in seen:
                image_files.append(img_file)
                seen.add(img_file.name.lower())
        for img_file in input_path.glob(f'*{ext.upper()}'):
            if img_file.name.lower() not in seen:
                image_files.append(img_file)
                seen.add(img_file.name.lower())
    
    # Sort for consistent processing order
    image_files.sort()
    
    if not image_files:
        print(f"No images found in {input_dir}")
        return
    
    print(f"Found {len(image_files)} images to process")
    print("-" * 50)
    
    angles = []
    for i, img_file in enumerate(image_files, 1):
        print(f"\n[{i}/{len(image_files)}] Processing {img_file.name}")
        
        output_file = output_path / img_file.name
        try:
            angle = deskew_image(img_file, output_file, auto_crop=auto_crop)
            angles.append(angle)
        except Exception as e:
            print(f"Error processing {img_file.name}: {e}")
    
    if angles:
        print("\n" + "=" * 50)
        print(f"Processing complete!")
        print(f"Average skew angle: {np.mean(angles):.2f} degrees")
        print(f"Output directory: {output_dir}")


def main():
    parser = argparse.ArgumentParser(
        description='Automatically deskew scanned Quran pages or other documents'
    )
    parser.add_argument('input', help='Input image file or directory')
    parser.add_argument('-o', '--output', help='Output file or directory', required=True)
    parser.add_argument('-a', '--angle', type=float, help='Manual rotation angle (optional)')
    parser.add_argument('--no-crop', action='store_true', help='Disable automatic cropping')
    
    args = parser.parse_args()
    
    input_path = Path(args.input)
    
    if input_path.is_file():
        # Process single file
        deskew_image(input_path, Path(args.output), 
                    angle=args.angle, auto_crop=not args.no_crop)
    elif input_path.is_dir():
        # Process directory
        process_directory(input_path, args.output, auto_crop=not args.no_crop)
    else:
        print(f"Error: {args.input} is not a valid file or directory")


if __name__ == '__main__':
    main()
