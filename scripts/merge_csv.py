import pandas as pd
import glob

lang = "vi-VN"
csv_files = glob.glob(f"../csv/{lang}/*.csv")

for csv_file in csv_files:
    df = pd.read_csv(csv_file, skiprows=13, delimiter=',', encoding='utf-8', on_bad_lines="warn")
    df = df.loc[:, ~df.columns.str.contains('^Unnamed')]
    df.to_csv(f"../data/{lang}/merged_exc_{lang}.csv", mode="a", sep="\t", index=False)