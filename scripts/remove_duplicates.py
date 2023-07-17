import os
from more_itertools import unique_everseen

def remove_duplicates():
    for root, dirs, files in os.walk("exc"):
        for f in files:
            file_name = os.path.splitext(f)[0]
            print(f"Treating file {f}")
            os.makedirs("duplicates_removed", exist_ok=True)
            with open(f"exc/{f}", "r") as f, open(f"exc/duplicates_removed/{file_name}_without_dup.csv", "w") as out_file:
                out_file.writelines(unique_everseen(f))
            print(f"File {f} treated successfully \
and saved to exc/duplicates_removed/{file_name}_without_dup.csv!")