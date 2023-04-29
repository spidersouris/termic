import pandas as pd
import glob

df_list = []

lang = "nl-NL"
csv_files = glob.glob(f"../csv/{lang}/*.csv")

# todo: review implementation / this is garbage but it works
final_df = pd.read_csv(csv_files[0], skiprows=13, delimiter=',', encoding='utf-8', error_bad_lines=False)
final_df = final_df.loc[:, ~final_df.columns.str.contains('^Unnamed')]
final_df.to_csv(f"../data/merged_exc_{lang}.csv", mode="w", sep="\t", index=False)

for csv_file in csv_files[1:]:
    df = pd.read_csv(csv_file, skiprows=13, delimiter=',', encoding='utf-8', error_bad_lines=False)
    df = df.loc[:, ~df.columns.str.contains('^Unnamed')]
    df.to_csv(f"../data/merged_exc_{lang}.csv", mode="a", sep="\t", index=False)

# print(df_list)

#merged_df = pd.concat([final_df.reset_index(drop=True), final_df2.reset_index(drop=True)], axis=0)


