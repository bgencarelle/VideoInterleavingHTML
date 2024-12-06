#!/usr/bin/env bash

# Usage: ./convert_to_webp.sh /path/to/input /path/to/output

# Input directory
INPUT_DIR="$1"
# Output directory
OUTPUT_DIR="$2"

# Set default values if none provided
QUALITY=80
THREADS=30
COMPRESSION_LEVEL=6

if [ -z "$INPUT_DIR" ] || [ -z "$OUTPUT_DIR" ]; then
    echo "Usage: $0 <input_directory> <output_directory>"
    exit 1
fi

mkdir -p "$OUTPUT_DIR"

# Ensure INPUT_DIR does not have a trailing slash
INPUT_DIR="${INPUT_DIR%/}"

# Find images with common extensions.
# If you have other formats, add them to the regex.
find "$INPUT_DIR" -type f \( -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.png" -o -iname "*.tif" -o -iname "*.tiff" -o -iname "*.bmp" -o -iname "*.gif" -o -iname "*.webp" \) | \
parallel -j "$THREADS" '
    # Get the relative path by removing the INPUT_DIR prefix
    REL_PATH=$(echo {} | sed "s|^'"$INPUT_DIR"'/||")
    # Construct the output path with .webp extension
    OUT_PATH="'"$OUTPUT_DIR"'/${REL_PATH%.*}.webp"
    # Ensure output directory structure exists
    mkdir -p "$(dirname "$OUT_PATH")"

    # Run cwebp with chosen settings
    cwebp -q '"$QUALITY"' -m '"$COMPRESSION_LEVEL"' -mt -sharp_yuv {} -o "$OUT_PATH"
'

echo "Conversion complete! WebP files are located in $OUTPUT_DIR"
