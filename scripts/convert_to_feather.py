import pandas as pd
import glob
import os

csv_files = glob.glob(f"../data/*.csv")
xlsx_files = glob.glob(f"../data/*.xlsx")

for csv_file in csv_files:
    csv_file = os.path.basename(csv_file)
    file_name = csv_file[:-4]
    print(csv_file)
    if os.path.isfile(f"../data/feather/{file_name}.ft"):
        print(f"Existing feather file found for CSV {csv_file}: {file_name}.ft")
    else:
        df = pd.read_csv(f"../data/{csv_file}", sep="\t")
        df.to_feather(f"../data/feather/{file_name}.ft")
        print("completed csv")

for xlsx_file in xlsx_files:
    if os.path.isfile(f"../data/feather/{xlsx_file}.ft"):
        print(f"Existing feather file found for XLSX {xlsx_file}: {xlsx_file}.ft")
    else:
        df = pd.read_excel(f"{xlsx_file}")
        df.to_feather(f"{xlsx_file}.ft")
        print("completed xlsx")