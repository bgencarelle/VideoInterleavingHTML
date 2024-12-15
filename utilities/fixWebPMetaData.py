import os
from PIL import Image

def fix_webp_dimensions_in_place(directory):
    for root, dirs, files in os.walk(directory):
        for filename in files:
            if filename.endswith(".webp"):
                file_path = os.path.join(root, filename)

                try:
                    # Open WebP image
                    with Image.open(file_path) as img:
                        # Check if dimensions are valid
                        if hasattr(img, "size") and img.size != (0, 0):
                            print(f"Dimensions OK: {file_path}")
                        else:
                            print(f"Adding dimensions to: {file_path}")
                            # Save with dimensions metadata without re-encoding
                            img.save(file_path, "WEBP", save_all=True)
                except Exception as e:
                    print(f"Error processing {file_path}: {e}")

# Update this path to the directory containing your WebP files
directory = "/Users/main1/Movies/benVideoArtProjects/benFace/moreJPG/2_D_face_digital"

fix_webp_dimensions_in_place(directory)
