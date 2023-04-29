import pandas as pd
import glob

df_list = []

csv_files = glob.glob("csv/*.csv")

# todo: review implementation / this is garbage but it works
final_df = pd.read_csv(csv_files[0], skiprows=12, delimiter=',', encoding='utf-8', error_bad_lines=False)

for csv_file in csv_files[1:]:
    df = pd.read_csv(csv_file, skiprows=12, delimiter=',', encoding='utf-8', error_bad_lines=False)
    df = df.loc[:, ~df.columns.str.contains('^Unnamed')]
    df_list.append(df)

#print(df_list)

merged_df = pd.concat(df_list, axis=0, ignore_index=True)

merged_df.to_csv("data/merged.csv", sep="\t", index=False)