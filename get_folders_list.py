# get_folders_list.py
# This script scans directories for PNG and WEBP files, organizes them, and generates JSON lists.

import re
import json
import shutil
from pathlib import Path
from PIL import Image
from collections import defaultdict

def get_subdirectories(path: Path):
    """Retrieve all subdirectories within a given path."""
    return [d for d in path.rglob('*') if d.is_dir()]

def contains_image_files(path: Path):
    """Check if a directory contains any PNG or WEBP files."""
    return any(file.suffix.lower() in ['.png', '.webp'] for file in path.iterdir())

def count_image_files(path: Path):
    """Count the number of PNG and WEBP files in a directory."""
    return sum(1 for file in path.iterdir() if file.suffix.lower() in ['.png', '.webp'])

def parse_line(line: str):
    """Parse a line from folder_locations.txt."""
    match = re.match(r'(\d+)[.,]\s*(.+)', line)
    return (int(match.group(1)), match.group(2)) if match else (None, None)

def has_alpha_channel(image: Image.Image):
    """Determine if an image has an alpha channel."""
    return image.mode in ('RGBA', 'LA') or (image.mode == 'P' and 'transparency' in image.info)

def create_folder_json_files(folder_counts, processed_dir: Path, script_dir: Path):
    """Create JSON files categorizing folders into main and float groups."""
    groups = defaultdict(list)
    float_group = defaultdict(list)

    for folder_info in folder_counts:
        folder, first_png, width, height, has_alpha, file_count = folder_info
        folder_relative = folder.relative_to(script_dir)
        folder_data = {
            "index": None,  # To be filled later
            "folder_rel": folder_relative.as_posix(),
            "image_list": [
                (folder_relative / img.name).as_posix()
                for img in sorted(
                    folder.iterdir(),
                    key=lambda x: natural_sort_key(x.name)
                ) if img.suffix.lower() in ['.png', '.webp']
            ]
        }
        if folder.name.startswith('255_'):
            float_group[file_count].append(folder_data)
        else:
            groups[file_count].append(folder_data)

    def write_json(group, file_name_format):
        for file_count_write, sub_group in group.items():
            # Sort the group based on numeric prefix or folder name
            sub_group_sorted = sorted(sub_group, key=lambda x: (
                int(x["folder_rel"].split('_')[0]) if x["folder_rel"].split('_')[0].isdigit() else float('inf'),
                x["folder_rel"]
            ))
            # Assign indices
            for idx, folder_data_write in enumerate(sub_group_sorted, 0):
                folder_data_write["index"] = idx
            json_filename = file_name_format.format(file_count_write)
            json_path = processed_dir / json_filename
            with json_path.open('w', encoding='utf-8') as f:
                json.dump({"folders": sub_group_sorted}, f, indent=4)  # Wrap list in "folders" key
            print(f"JSON file created: {json_path}")

    write_json(groups, 'main_folders_{}.json')
    write_json(float_group, 'float_folders_{}.json')

def write_folder_list():
    """Main function to create folder lists and JSON files."""
    # Determine the script's directory
    script_dir = Path(__file__).parent.resolve()
    processed_dir = script_dir / "folders_processed"
	
    if processed_dir.exists():
        shutil.rmtree(processed_dir)

    # Ensure the processed directory exists
    processed_dir.mkdir(exist_ok=True)
    print(f"Processed directory: {processed_dir}")

    # Path to 'images' directory
    images_path = script_dir / "images"

    folder_dict = {}

    if images_path.exists() and images_path.is_dir():
        # Add 'images' to folder_dict only if it contains image files
        if contains_image_files(images_path):
            folder_dict[1] = images_path

        # Add subdirectories that contain image files
        subdirectories = get_subdirectories(images_path)
        for subdirectory in subdirectories:
            if contains_image_files(subdirectory) and subdirectory not in folder_dict.values():
                folder_dict[len(folder_dict) + 1] = subdirectory

    # If 'images' was not added (doesn't exist or has no image files), prompt the user
    if not folder_dict:
        print("The default 'images' directory is missing or contains no image files.")
        print("Please enter directories manually.")

        # Load existing folder locations if available
        folder_locations_path = script_dir / 'folder_locations.txt'
        if folder_locations_path.exists():
            with folder_locations_path.open('r', encoding='utf-8') as f:
                for line in f:
                    number, folder = parse_line(line.strip())
                    if folder:
                        folder_abs = (script_dir / folder).resolve()
                        if folder_abs.exists() and folder_abs.is_dir():
                            folder_dict[number] = folder_abs
                        else:
                            print(f"Warning: Folder '{folder}' does not exist and will be skipped.")

        # Interactive prompt loop
        while True:
            folder_input = input("Enter individual paths, parent directories or type 'quit' to stop: ").strip()
            if folder_input.lower() == 'quit':
                break

            folder_abs = Path(folder_input).expanduser().resolve()
            if not folder_abs.exists() or not folder_abs.is_dir():
                print("Invalid directory. Please try again.")
                continue

            if contains_image_files(folder_abs) and folder_abs not in folder_dict.values():
                new_key = max(folder_dict.keys(), default=0) + 1
                folder_dict[new_key] = folder_abs
                print(f"Added folder: {folder_abs}")

            # Add subdirectories that contain image files
            subdirectories = get_subdirectories(folder_abs)
            for subdirectory in subdirectories:
                if contains_image_files(subdirectory) and subdirectory not in folder_dict.values():
                    new_key = max(folder_dict.keys(), default=0) + 1
                    folder_dict[new_key] = subdirectory
                    print(f"Added subdirectory: {subdirectory}")

    # Final check to ensure at least one folder is added
    if not folder_dict:
        raise Exception("No folders added. Please add at least one main_folder.")

    # Calculate the total number of PNGs and WEBPs
    total_pngs = sum(count_image_files(folder) for folder in folder_dict.values())
    print(f"Total PNG and WEBP files found: {total_pngs}")

    # Gather folder counts and image details
    folder_counts = []
    for folder in folder_dict.values():
        image_files = [f for f in folder.iterdir() if f.suffix.lower() in ['.png', '.webp']]
        if image_files:
            first_img = image_files[0]
            try:
                with Image.open(first_img) as img:
                    width, height = img.size
                    has_alpha = has_alpha_channel(img)
            except Exception as e:
                print(f"Error opening image {first_img} in folder {folder}: {e}")
                first_img = None
                width, height, has_alpha = 0, 0, False
            file_count = count_image_files(folder)
            folder_counts.append((folder, first_img, width, height, has_alpha, file_count))

    # Save folder_count_XXXX.txt with relative paths (optional)
    folder_count_filename = f'folder_count_{total_pngs}.txt'
    folder_count_path = processed_dir / folder_count_filename
    try:
        with folder_count_path.open('w', encoding='utf-8') as f:
            for index, (folder, first_img, width, height, has_alpha, count) in enumerate(folder_counts, 1):
                folder_rel = folder.relative_to(script_dir).as_posix()
                first_png_stripped = first_img.stem if first_img else "NoImage"
                f.write(f"{index}, {folder_rel}, {first_png_stripped}, {width}x{height}, {count}, {has_alpha}\n")
        print(f"Folder count file created: {folder_count_path}")
    except Exception as e:
        print(f"Failed to write folder count file at {folder_count_path}: {e}")
        raise

    # Create JSON files with relative paths
    try:
        create_folder_json_files(folder_counts, processed_dir, script_dir)
    except Exception as e:
        print(f"Failed to create folder JSON files: {e}")
        raise

def natural_sort_key(s: str):
    """Generate a key for natural sorting."""
    return [int(text) if text.isdigit() else text.lower() for text in re.split(r'(\d+)', s)]

if __name__ == "__main__":
    write_folder_list()
