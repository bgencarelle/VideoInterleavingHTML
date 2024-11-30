# process_files.py
# This script processes JSON lists of folders into separate JSON lists of image file paths,
# preserving folder indices and treating each folder as a standalone entity.

import os
import re
import json
import sys
from itertools import zip_longest
import get_folders_list  # Ensure this imports correctly

def find_default_jsons(processed_dir):
    """
    Find JSON files: float_folders_XXXXXX.json and main_folders_XXXXXX.json
    with the same XXXXXX.
    Returns a dictionary with keys 'main' and 'float' mapping to their respective file paths.
    """
    float_pattern = re.compile(r'^float_folders_(\d+)\.json$')
    main_pattern = re.compile(r'^main_folders_(\d+)\.json$')

    float_files = {}
    main_files = {}

    for file in os.listdir(processed_dir):
        float_match = float_pattern.match(file)
        main_match = main_pattern.match(file)

        if float_match:
            float_files[float_match.group(1)] = os.path.join(processed_dir, file)
        if main_match:
            main_files[main_match.group(1)] = os.path.join(processed_dir, file)

    # Find matching XXXXXX
    matching_keys = set(float_files.keys()).intersection(set(main_files.keys()))
    if matching_keys:
        # For simplicity, pick the first matching pair
        key = sorted(matching_keys)[0]  # You can modify this logic as needed
        return {
            'main': main_files[key],
            'float': float_files[key]
        }

    return None

def choose_file(processed_dir):
    """
    Allows the user to choose which JSON files to process if the default pair isn't found.
    Returns a list of dictionaries with keys 'main' and 'float'.
    """
    available_files = [f for f in os.listdir(processed_dir) if f.endswith('.json')]

    if not available_files:  # If no files found
        print("No JSON files found, running get_folders_list.")
        get_folders_list.write_folder_list()
        available_files = [f for f in os.listdir(processed_dir) if f.endswith('.json')]

    print("Available JSON files:")
    for i, file in enumerate(available_files):
        print(f"{i + 1}: {file}")

    pairs = []
    # Attempt to find matching main and float files based on similar numbering
    float_pattern = re.compile(r'^float_folders_(\d+)\.json$')
    main_pattern = re.compile(r'^main_folders_(\d+)\.json$')

    float_files = {}
    main_files = {}

    for file in available_files:
        float_match = float_pattern.match(file)
        main_match = main_pattern.match(file)

        if float_match:
            float_files[float_match.group(1)] = os.path.join(processed_dir, file)
        if main_match:
            main_files[main_match.group(1)] = os.path.join(processed_dir, file)

    matching_keys = set(float_files.keys()).intersection(set(main_files.keys()))
    for key in sorted(matching_keys):
        pairs.append({
            'main': main_files[key],
            'float': float_files[key]
        })

    if pairs:
        return pairs

    # If no matching pairs, allow the user to select individual files
    response = input("No matching main and float JSON pairs found. Do you want to process all available JSON files separately? (y/n): ").strip().lower()
    if response == "y":
        # Process each JSON file individually, assuming they are either main or float
        for file in available_files:
            if float_pattern.match(file):
                pairs.append({'float': os.path.join(processed_dir, file)})
            elif main_pattern.match(file):
                pairs.append({'main': os.path.join(processed_dir, file)})
        return pairs
    else:
        # Let the user select specific files
        selected_pairs = []
        while True:
            try:
                choice = int(input("Enter the number corresponding to the desired file (or 0 to finish): "))
                if choice == 0:
                    break
                if 1 <= choice <= len(available_files):
                    selected_file = os.path.join(processed_dir, available_files[choice - 1])
                    if 'main_folders_' in available_files[choice - 1]:
                        selected_pairs.append({'main': selected_file})
                    elif 'float_folders_' in available_files[choice - 1]:
                        selected_pairs.append({'float': selected_file})
                else:
                    print("Invalid choice. Please enter a valid number.")
            except ValueError:
                print("Invalid input. Please enter a valid number.")
        return selected_pairs

def parse_folder_json(json_path):
    """
    Parses the given JSON file to create a list of folder dictionaries.
    """
    if os.path.exists(json_path):
        try:
            with open(json_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return data  # Returns a list of folder dictionaries
        except Exception as e:
            print(f"Error reading JSON file {json_path}: {e}")
            return []
    return []

def natural_sort_key(s):
    """
    Generates a key for natural sorting of strings containing numbers.
    """
    return [int(text) if text.isdigit() else text.lower() for text in re.split(r'(\d+)', s)]

def sort_image_files(folder_list, script_dir):
    """
    Sorts image files in each folder using natural sort.
    Returns a list of folder dictionaries with sorted image paths.
    """
    sorted_folders = []
    for folder in folder_list:
        folder_rel = folder.get("folder_rel", "")
        # Normalize folder_rel to remove leading ../../ or similar
        folder_rel_normalized = os.path.normpath(folder_rel)
        # Construct absolute path
        folder_abs = os.path.join(script_dir, folder_rel_normalized)
        if not os.path.exists(folder_abs):
            print(f"Warning: Folder path does not exist: {folder_abs}. Skipping.")
            continue
        image_files = [f for f in os.listdir(folder_abs) if f.lower().endswith(('.png', '.webp'))]
        if not image_files:
            print(f"Warning: No image files found in folder: {folder_abs}. Skipping.")
            continue
        sorted_files = sorted(image_files, key=natural_sort_key)
        # Prepend the relative folder path to each image file
        sorted_image_paths = [os.path.join(folder_rel_normalized, img) for img in sorted_files]
        sorted_folders.append({
            "index": folder.get("index", 0),
            "folder_rel": folder_rel_normalized,
            "image_list": sorted_image_paths
        })
    return sorted_folders

def write_json_list(folder_list, output_folder, output_filename):
    """
    Writes the list of folders with their image paths to a JSON file in the output folder.
    """
    output_path = os.path.join(output_folder, output_filename)
    try:
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump({"folders": folder_list}, f, indent=4)
        print(f"JSON file created: {output_path}")
    except Exception as e:
        print(f"Failed to write JSON file at {output_path}: {e}")
        raise

def remove_duplicates(folders):
    """
    Removes duplicate image paths within each folder's image list.
    """
    for folder in folders:
        seen = set()
        unique_images = []
        for img in folder["image_list"]:
            if img not in seen:
                seen.add(img)
                unique_images.append(img)
        folder["image_list"] = unique_images
    return folders

def process_files():
    """
    Main function to process JSON files and generate separate image lists in JSON,
    preserving folder indices and treating each folder as a standalone entity.
    """
    global script_dir
    # Determine the script's directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    processed_dir = os.path.join(script_dir, 'folders_processed')
    generated_dir = os.path.join(script_dir, 'generated_img_lists')

    # Check if 'folders_processed' exists
    if not os.path.exists(processed_dir):
        print("'folders_processed' directory not found. Running get_folders_list to generate it.")
        get_folders_list.write_folder_list()

    # Refresh the existence after attempting to create
    if not os.path.exists(processed_dir):
        print("Failed to create 'folders_processed' directory. Please check permissions.")
        sys.exit(1)

    # Attempt to find default JSONs
    default_jsons = find_default_jsons(processed_dir)

    if default_jsons:
        print("Default JSON files found:")
        for key, json_file in default_jsons.items():
            print(f" - {key}: {json_file}")
        json_pairs = [default_jsons]
    else:
        print("Default JSON files not found. Running get_folders_list to generate them.")
        get_folders_list.write_folder_list()
        # Try finding default JSONs again
        default_jsons = find_default_jsons(processed_dir)
        if default_jsons:
            print("Default JSON files found after running get_folders_list:")
            for key, json_file in default_jsons.items():
                print(f" - {key}: {json_file}")
            json_pairs = [default_jsons]
        else:
            print("Default JSON files still not found. Falling back to user prompts.")
            json_pairs = choose_file(processed_dir)

    if not json_pairs:
        print("No JSON files to process. Exiting.")
        sys.exit(0)

    # Ensure 'generated_img_lists' exists and is clean
    if not os.path.exists(generated_dir):
        os.makedirs(generated_dir)
    else:
        # Remove existing files in 'generated_img_lists'
        for file in os.listdir(generated_dir):
            file_path = os.path.join(generated_dir, file)
            if os.path.isfile(file_path):
                os.remove(file_path)

    # Initialize separate lists for main and float images
    all_main_folders = []
    all_float_folders = []

    for pair in json_pairs:
        # Process main folders
        if 'main' in pair:
            main_folders = parse_folder_json(pair['main'])
            if main_folders:
                sorted_main_folders = sort_image_files(main_folders, script_dir)
                sorted_main_folders = remove_duplicates(sorted_main_folders)
                all_main_folders.extend(sorted_main_folders)
            else:
                print(f"No valid main folders found in {pair['main']}.")

        # Process float folders
        if 'float' in pair:
            float_folders = parse_folder_json(pair['float'])
            if float_folders:
                sorted_float_folders = sort_image_files(float_folders, script_dir)
                sorted_float_folders = remove_duplicates(sorted_float_folders)
                all_float_folders.extend(sorted_float_folders)
            else:
                print(f"No valid float folders found in {pair['float']}.")

    # Write the separate JSON lists
    if all_main_folders:
        write_json_list(all_main_folders, generated_dir, 'main_images.json')
    else:
        print("No main folders found to write.")

    if all_float_folders:
        write_json_list(all_float_folders, generated_dir, 'float_images.json')
    else:
        print("No float folders found to write.")

if __name__ == "__main__":
    process_files()
