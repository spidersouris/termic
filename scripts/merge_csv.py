#!/usr/bin/env python3

from argparse import ArgumentParser
import glob
import os

import pandas as pd

def parse_args():
    parser = ArgumentParser()
    parser.add_argument("lang", help="language code for directory containing .csv files to merge")
    parser.add_argument("--csv-path", help="path to the dir containing the .csv files")
    parser.add_argument("--data-path", default="data/", help="path to where the merged csv will be written")
    parser.add_argument("--fix-2017-data", action="store_true", help="fix the 2017 data")
    return parser.parse_args()


def main():
    args = parse_args()
    if args.csv_path is None:
        csv_path = os.path.join("csv_to_merge", args.lang)
    else:
        csv_path = args.csv_path
    csv_glob = os.path.join(csv_path, "*.csv")
    csv_files = glob.glob(csv_glob)

    if args.data_path is None:
        data_path = os.path.join("data", args.lang)
    else:
        data_path = os.path.join(args.data_path, args.lang)
    print(f"Writing merged CSV files to '{data_path}'")
    os.makedirs(data_path, exist_ok=True)


    try:
        with open(os.path.join(data_path, f"merged_exc_{args.lang}.csv"), "w", encoding="utf8") as f:
            f.write("source_term\ttranslation\tstring_cat\tplatform\tproduct\tversion\n")
        if args.fix_2017_data:
            # The first file in most languages (NETFramework2.0SP1.csv)
            # has empty translation rows at the beginning,
            # which messes up pandas' parsing.
            #
            # The current solution is very hacky but rewriting
            # by filtering the lines (see below) gave quite bad results.
            # filtered_content = [row for i, row in enumerate(csv.reader(open(csv_files[0], "r", encoding="utf8"))) if i not in range(14, 20)]
            csv_files[0], csv_files[7] = csv_files[7], csv_files[0]
        for i, csv_file in enumerate(csv_files):
            print(f"Reading file {csv_file}… ({i+1}/{len(csv_files)})")

            try:
                df = pd.read_csv(csv_file, skiprows=13, delimiter=",", encoding="utf-8", on_bad_lines="warn")
                df = df.loc[:, ~df.columns.str.contains("^Unnamed")]
            except pd.errors.EmptyDataError:
                print(f"Empty file '{csv_file}' found, skipping…")
                continue

            # drop empty columns
            df = df.dropna(axis=1, how="all")

            # drop lines with no translation
            try:
                df.dropna(subset=[df.columns[1]], how="all", inplace=True)
            # ignore IndexErrors (bad file formatting)
            except (IndexError, pd.errors.EmptyDataError):
                continue

            merged_path = os.path.join(data_path, f"merged_exc_{args.lang}.csv")
            df.to_csv(merged_path, mode="a", sep="\t", index=False)

            print(f"Parsed {csv_file} successfully.")
        else:
            if len(csv_files) == 0:
                raise SystemExit(f"No csv files found in '{csv_path}'")

    except (OSError, IOError) as e:
        print(f"{type(e).__name__}: {e}")
        raise SystemExit(1)


if __name__ == "__main__":
    main()