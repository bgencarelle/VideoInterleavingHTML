# process_files.py
import json
import sys
from itertools import zip_longest
from pathlib import Path
import re
# noinspection SpellCheckingInspection
import gzip  # Imported for gzipping JSON files
import get_folders_list  # Ensure this imports correctly


def find_default_jsons(processed_dir):
    float_pattern = re.compile(r'^float_folders_(\d+)\.json$')
    main_pattern = re.compile(r'^main_folders_(\d+)\.json$')

    float_files = {}
    main_files = {}

    for file in processed_dir.iterdir():
        if file.is_file():
            float_match = float_pattern.match(file.name)
            main_match = main_pattern.match(file.name)

            if float_match:
                float_files[float_match.group(1)] = file
            if main_match:
                main_files[main_match.group(1)] = file

    matching_keys = set(float_files.keys()).intersection(main_files.keys())
    if matching_keys:
        key = sorted(matching_keys)[0]
        return {
            'main': main_files[key],
            'float': float_files[key]
        }

    return None


def choose_file(processed_dir):
    available_files = [f for f in processed_dir.iterdir() if f.is_file() and f.suffix == '.json']

    if not available_files:
        print("No JSON files found, running get_folders_list.")
        get_folders_list.write_folder_list()
        available_files = [f for f in processed_dir.iterdir() if f.is_file() and f.suffix == '.json']

    print("Available JSON files:")
    for i, file in enumerate(available_files):
        print(f"{i + 1}: {file.name}")

    pairs = []
    float_pattern = re.compile(r'^float_folders_(\d+)\.json$')
    main_pattern = re.compile(r'^main_folders_(\d+)\.json$')

    float_files = {}
    main_files = {}

    for file in available_files:
        float_match = float_pattern.match(file.name)
        main_match = main_pattern.match(file.name)

        if float_match:
            float_files[float_match.group(1)] = file
        if main_match:
            main_files[main_match.group(1)] = file

    matching_keys = set(float_files.keys()).intersection(main_files.keys())
    for key in sorted(matching_keys):
        pairs.append({
            'main': main_files[key],
            'float': float_files[key]
        })

    if pairs:
        return pairs

    response = input(
        "No matching main and float JSON pairs found. Do you want to process all available JSON files separately? (y/n): ").strip().lower()
    if response == "y":
        for file in available_files:
            if float_pattern.match(file.name):
                pairs.append({'float': file})
            elif main_pattern.match(file.name):
                pairs.append({'main': file})
        return pairs
    else:
        selected_pairs = []
        while True:
            try:
                choice = int(input("Enter the number corresponding to the desired file (or 0 to finish): "))
                if choice == 0:
                    break
                if 1 <= choice <= len(available_files):
                    selected_file = available_files[choice - 1]
                    if 'main_folders_' in selected_file.name:
                        selected_pairs.append({'main': selected_file})
                    elif 'float_folders_' in selected_file.name:
                        selected_pairs.append({'float': selected_file})
                else:
                    print("Invalid choice. Please enter a valid number.")
            except ValueError:
                print("Invalid input. Please enter a valid number.")
        return selected_pairs


def parse_folder_json(json_path):
    if json_path.exists():
        try:
            with json_path.open('r', encoding='utf-8') as f:
                data = json.load(f)
                for folder in data.get("folders", []):
                    folder["folder_rel"] = Path(folder["folder_rel"])
                return data.get("folders", [])
        except Exception as e:
            print(f"Error reading JSON file {json_path}: {e}")
            return []
    return []


def natural_sort_key(s):
    return [int(text) if text.isdigit() else text.lower() for text in re.split(r'(\d+)', s)]


def sort_image_files(folder_list, script_dir):
    sorted_folders = []
    for folder in folder_list:
        folder_rel = folder.get("folder_rel", Path(""))
        try:
            folder_rel_normalized = folder_rel.resolve().relative_to(Path(script_dir).resolve())
        except ValueError:
            # If folder_rel is not relative to script_dir, keep it as is
            folder_rel_normalized = folder_rel
        folder_abs = Path(script_dir) / folder_rel_normalized
        if not folder_abs.exists():
            print(f"Warning: Folder path does not exist: {folder_abs}. Skipping.")
            continue
        image_files = [f for f in folder_abs.iterdir() if f.is_file() and f.suffix.lower() in ['.png', '.webp']]
        if not image_files:
            print(f"Warning: No image files found in folder: {folder_abs}. Skipping.")
            continue
        sorted_files = sorted(image_files, key=lambda x: natural_sort_key(x.name))
        sorted_image_paths = [(folder_rel_normalized / img.name).as_posix() for img in sorted_files]
        sorted_folders.append({
            "index": folder.get("index", 0),
            "folder_rel": str(folder_rel_normalized),
            "image_list": sorted_image_paths
        })
    return sorted_folders


def write_json_list(folder_list, output_folder, output_filename):
    output_path = Path(output_folder) / output_filename
    try:
        # Ensure all paths use forward slashes
        for folder in folder_list:
            folder["folder_rel"] = folder["folder_rel"].replace("\\", "/")
            folder["image_list"] = [img.replace("\\", "/") for img in folder["image_list"]]

        # Write the regular JSON file
        with output_path.open('w', encoding='utf-8') as f:
            json.dump({"folders": folder_list}, f, indent=4)
        print(f"JSON file created: {output_path}")

        # Create a gzipped version of the JSON file
        gzipped_output_path = output_path.with_suffix(output_path.suffix + '.gz')
        with gzip.open(gzipped_output_path, 'wt', encoding='utf-8') as gz:
            json.dump({"folders": folder_list}, gz, indent=4)
        print(f"Gzipped JSON file created: {gzipped_output_path}")
    except Exception as e:
        print(f"Failed to write JSON or gzipped JSON file at {output_path}: {e}")
        raise


def remove_duplicates(folders):
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
    script_dir = Path(__file__).parent.resolve()
    processed_dir = script_dir / 'folders_processed'
    generated_dir = script_dir / 'generated_img_lists'

    if not processed_dir.exists():
        print("'folders_processed' directory not found. Running get_folders_list to generate it.")
        get_folders_list.write_folder_list()

    if not processed_dir.exists():
        print("Failed to create 'folders_processed' directory. Please check permissions.")
        sys.exit(1)

    default_jsons = find_default_jsons(processed_dir)

    if default_jsons:
        print("Default JSON files found:")
        for key, json_file in default_jsons.items():
            print(f" - {key}: {json_file}")
        json_pairs = [default_jsons]
    else:
        print("Default JSON files not found. Running get_folders_list to generate them.")
        get_folders_list.write_folder_list()
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

    if not generated_dir.exists():
        generated_dir.mkdir()
    else:
        # Remove existing files in 'generated_img_lists'
        for file in generated_dir.iterdir():
            if file.is_file():
                file.unlink()

    all_main_folders = []
    all_float_folders = []

    for pair in json_pairs:
        if 'main' in pair:
            main_folders = parse_folder_json(pair['main'])
            if main_folders:
                sorted_main_folders = sort_image_files(main_folders, script_dir)
                sorted_main_folders = remove_duplicates(sorted_main_folders)
                all_main_folders.extend(sorted_main_folders)
            else:
                print(f"No valid main folders found in {pair['main']}.")

        if 'float' in pair:
            float_folders = parse_folder_json(pair['float'])
            if float_folders:
                sorted_float_folders = sort_image_files(float_folders, script_dir)
                sorted_float_folders = remove_duplicates(sorted_float_folders)
                all_float_folders.extend(sorted_float_folders)
            else:
                print(f"No valid float folders found in {pair['float']}.")

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
