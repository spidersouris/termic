#!/usr/bin/env python3

"""
This script is used to automatically collect VSCode English and
translated strings from the source code and append them to the TM file.

Usage: python vscode_data.py {lang} [OPTIONS]

Options:
--append            Append to existing csv file
etc.

Workflow:
1. Downloads json/…/main.i18n.json for the specified language
2. Downloads json/…/extensions/*.json for the specified language
3. Searches for English strings in the source code and saves to csv/en-US.csv
4. Searches for translated strings in json/…/main.i18n.json and json/…/extensions/*.json
for the specified language and saves to csv/{lang}.csv
5. Merges JSON files from json/…/extensions/*.json into one file
6. (Optional) Appends translated strings from csv/{lang}.csv to exc/merged_exc_{lang}.csv
"""

import os
import time
import logging
import json
import csv
import glob
import re
from argparse import ArgumentParser

import requests
import pandas as pd
from more_itertools import unique_everseen

#!DATA LAST RETRIEVED: 2023-06-05

# Colors for terminal output
CRED = "\33[91m"
CVIOLET = "\33[35m"
CEND = "\33[0m"

# yes this is ugly! blame Microsoft
ENGLISH_TOKENS_PATTERN = (
r'(?P<regex1>localize\s*\(\s*(?:"|\')(.*?)(?:"|\')\s*,\s*(?:"|\')(.*?)(?:"|\'))|'
r'(?P<regex2>localize\s*\((?:{ .*, key: )(?:"|\')(.*)(?:"|\') }, (?:"|\')(.*)(?:"|\'))|'
r'(?P<regex3>localize\s*\((?:{ key: (?:"|\')(.*?)(?:"|\'), .*, (?:"|\')(.*)(?:"|\')))|'
r'(?P<regex4>localize\s*\((?:{)\n\t*key: (?:"|\')(.*)(?:"|\'),(?:(?:.|\n)*?)}, (?:"|\')(.*)(?:"|\'))|'
r'(?P<regex5>localize\s*\(\n\t*{ key: (?:"|\')(.*?)(?:"|\'), .*\n\t*(?:"|\')(.*)(?:"|\'))|'
r'(?P<regex6>localize\({ key: (?:"|\')(.*?)(?:"|\'), .*\t(?:"|\')(.*)(?:"|\'), \w+)|'
r'(?P<regex7>localize\({ key: (?:"|\')(.*)(?:"|\'), comment: .*\n\s*(?:"|\')(.*?)(?:"|\'))'
)

# Key: language code, BCP 47 format
# Value: language code as found in vscode-loc repo (https://github.com/microsoft/vscode-loc)
LANGS = {
"cs-CZ": "cs", "de-DE": "de", "es-ES": "es", "fr-FR": "fr",
"it-IT": "it", "ja-JP": "ja", "ko-KR": "ko", "pl-PL": "pl", "pt-BR": "pt-BR",
"ru-RU": "ru", "tr-TR": "tr", "zh-CN": "zh-hans", "zh-TW": "zh-hant"
}

def parse_args():
    parser = ArgumentParser()
    parser.add_argument("lang", help="Language code for directories and files, BCP 47 format (e.g. cs-CZ)")
    parser.add_argument("--append", action="store_true", help="Append to existing csv file")
    parser.add_argument("--delay", type=int, default=1,
    help="Delay between GitHub download requests to avoid rate limiting. Default: 1 second")
    parser.add_argument("--no-duplicates", action="store_true", help="Remove duplicate strings from csv file")
    parser.add_argument("--check-missing", action="store_true", help="Check for missing tokens in csv file")
    parser.add_argument("--debug", action="store_true", help="Show debug messages in terminal")
    return parser.parse_args()

args = parse_args()

VSCODE_REPO_LOCATION = "data/src/vs"
DIR_LIST = [f"json/{args.lang}/extensions", "csv", "exc", VSCODE_REPO_LOCATION]

def main():
    ed = EnglishData()
    td = TranslationData()

    for dir in DIR_LIST:
        if not os.path.exists(dir):
            os.makedirs(dir)

    if args.debug:
        logging.basicConfig(level=logging.DEBUG)

    if args.append and not os.path.exists(f"exc/merged_exc_{args.lang}.csv"):
        raise Exception(f"""--append was requested but
        exc/merged_exc_{args.lang}.csv was not found! Run merge_csv.py first.""")

    if len(os.listdir(f"{VSCODE_REPO_LOCATION}")) == 0:
        raise Exception(f"""{VSCODE_REPO_LOCATION} is empty!
        Put the content of https://github.com/microsoft/vscode/tree/main/src/vs
        in {VSCODE_REPO_LOCATION} and try again.
        Direct download URL: https://download-directory.github.io/?url=https%3A%2F%2Fgithub.com%2Fmicrosoft%2Fvscode%2Ftree%2Fmain%2Fsrc%2Fvs""")

    if not os.path.exists(f"json/{args.lang}/main.i18n.json"):
        print(f"json/{args.lang}/main.i18n.json not found, generating…")
        download_data("main")

    if len(os.listdir(f"json/{args.lang}/extensions")) == 0:
        print(f"json/{args.lang}/extensions/*.json not found, generating…")
        download_data("extensions")

    if not os.path.exists("csv/en-US.csv"):
        print("English csv not found, generating…")
        ed.search_english_strings()
    else:
        print("English csv found, skipping generation…")

    if not os.path.exists(f"csv/{args.lang}.csv"):
        print(f"{args.lang}.csv not found, generating…")
        td.json_translations_to_csv()
    else:
        print(f"{args.lang}.csv found, skipping generation…")

    if not os.path.exists(f"json/{args.lang}/merged_extensions_{args.lang}.json"):
        print(f"merged_extensions_{args.lang}.json not found, generating…")
        td.merge_json_extensions()
        td.read_merged_json()
    else:
        print(f"merged_extensions_{args.lang}.json found, skipping generation…")

    if args.append:
        print("Appending to existing csv file…")
        td.append_translations_to_exc()

    if args.no_duplicates:
        print("Removing duplicates…")
        td.remove_duplicates()

    if args.check_missing:
        options = {"y": True, "n": False}
        write_option = input("Write missing tokens to file? (y/n): ").lower()
        if write_option not in options:
            raise Exception(f"Invalid input, expected one of {options.keys()}")
        else:
            print("Checking for missing tokens…")
            td.check_missing_tokens(write_to_file=write_option)

    print("Done!")

class EnglishData:
    """
    Get English strings and tokens from the source code.
    """
    def __init__(self):
        self.data = {}

    def search_english_strings(self):
        for root, dirs, files in os.walk("src"):
            ts_files = [file for file in files if file.endswith(".ts")]
            for ts_file in ts_files:
                with open(os.path.join(root, ts_file)) as f:
                    logging.debug("Reading file:", os.path.join(root, ts_file))
                    code = f.read()
                    for match in re.finditer(ENGLISH_TOKENS_PATTERN, code):
                        groups = list(filter(lambda x: x is not None, match.groups()))

                        token = groups[1].strip() # skip named capturing group
                        english_string = groups[2].strip()
                        logging.debug(f"Match with {CVIOLET}{match.lastgroup}{CEND}\nFound token: {CRED}{token}{CEND} with string {CRED}{english_string}{CEND}")
                        self.data[token] = english_string

        self.process_extensions_english_json()
        self.generate_english_csv(self.data)

    def process_extensions_english_json(self):
        pattern = re.compile(r"(?:\w+)\.nls\.json")
        for root, dirs, files in os.walk("extensions"):
            json_files = [file for file in files if pattern.match(file)]
            for json_file in json_files:
                json_data = json.loads(open(os.path.join(root, json_file)).read())
                self.data = {**self.data, **json_data}

    def generate_english_csv(self, data):
        with open("csv/en-US.csv", "w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["token", "text"])
            for token, text in data.items():
                writer.writerow([token, text])

        print("English strings written to csv/en-US.csv successfully!")

class TranslationData:
    """
    Get translations from the JSON files.
    """
    def __init__(self):
        self.json_extensions_df = None

    def json_translations_to_csv(self):
        with open(f"json/{args.lang}/main.i18n.json") as f:
            data = json.load(f)

        with open(f"csv/{args.lang}.csv", "w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["token", "translation"])
            for value in data["contents"].values():
                for token, translation in value.items():
                    writer.writerow([token, translation])

        print(f"JSON translations converted to csv/{args.lang}.csv successfully!")

    def merge_json_extensions(self):
        merged_json = {
        "contents": {
            "package": {},
            "bundle": {}
            }
        }
        json_extensions = glob.glob(f"json/{args.lang}/extensions/*.json")

        for i, json_extension in enumerate(json_extensions):
            print(f"Reading file {json_extension}… ({i+1}/{len(json_extensions)})")
            try:
                with open(json_extension) as json_extension:
                    data = json.load(json_extension)

                    # check if "bundle"/"package" is an array in json file
                    if isinstance(data, dict) and "bundle" in data["contents"]:
                        merged_json["contents"]["bundle"].update(data["contents"]["bundle"])
                    if isinstance(data, dict) and "package" in data["contents"]:
                        merged_json["contents"]["package"].update(data["contents"]["package"])

            except Exception as e:
                raise IOError(f"Error reading file {json_extension}: {e}")

            try:
                with open(f"json/{args.lang}/merged_extensions_{args.lang}.json", "w", encoding="utf8") as f:
                    json.dump(merged_json, f, indent=4)

            except Exception as e:
                raise IOError(f"Error writing file merged_extensions_{args.lang}.json: {e}")

    def read_merged_json(self):
        with open(f"json/{args.lang}/merged_extensions_{args.lang}.json", "r", encoding="utf8") as f:
            data = json.load(f)

        json_extensions_df = pd.DataFrame(list(zip(data["contents"]["bundle"],
        data["contents"]["bundle"].values())),
        columns=["source_term", "translation"])

        with open(f"csv/{args.lang}.csv", "a", encoding="utf8", newline="") as f:
            writer = csv.writer(f)
            for token, translation in data["contents"]["package"].items():
                writer.writerow([token, translation])

        self.json_extensions_df = json_extensions_df

    # todo: refactor
    def append_translations_to_exc(self):
        df1 = pd.read_csv("csv/en-US.csv", names=["a", "b"])
        df2 = pd.read_csv(f"csv/{args.lang}.csv", names=["a", "b"])
        merged = pd.merge(df1, df2, on="a", how="outer")
        merged = merged.drop("a", axis=1)
        merged = merged.drop(index=0)
        merged = merged.rename(columns={"b_x": "source_term", "b_y": "translation"})
        if self.json_extensions_df is not None:
            merged = pd.merge(merged, self.json_extensions_df, how="outer")
        merged["string_cat"] = "Text"
        merged["platform"] = "All"
        merged["product"] = "VSCode"
        merged = merged.drop_duplicates(merged)
        merged.to_csv(f"exc/merged_exc_{args.lang}.csv", sep="\t", mode="a", header=False, index=False, na_rep="null")

        print("Translations appended to exc file successfully!")

def check_missing_tokens(write_to_file=False):
    english_tokens = set()
    target_lang_tokens = set()

    with open("csv/en-US.csv") as f, open(f"csv/{args.lang}.csv") as g:
        english_csv = csv.reader(f)
        target_lang_csv = csv.reader(g)
        for row in english_csv:
            token = row[0]
            english_tokens.add(token)
        for row in target_lang_csv:
            token = row[1]
            target_lang_tokens.add(token)

    missing_english_tokens = english_tokens - args.lang_tokens
    missing_target_lang_tokens = args.lang_tokens - english_tokens
    missing_total = missing_english_tokens | missing_target_lang_tokens

    if write_to_file:
        with open("missing_tokens/missing_english_tokens.txt", "w", newline="") as f:
            for token in missing_english_tokens:
                f.write(token + "\n")
        print("Missing English tokens written to missing_english_tokens.txt")
        with open(f"missing_tokens/missing_{args.lang}_tokens.txt", "w", newline="") as f:
            for token in missing_target_lang_tokens:
                f.write(token + "\n")
        print(f"Missing {args.lang} tokens written to missing_{args.lang}_tokens.txt")

    print(f"There are {len(missing_english_tokens)} missing English tokens in {args.lang}.csv")
    print(f"There are {len(missing_target_lang_tokens)} missing {args.lang} tokens in en-US.csv")
    print(f"Total: {len(missing_total)}")

def remove_duplicates():
    for root, dirs, files in os.walk("exc"):
        for f in files:
            print(f"Treating file {f}")
            with open(f"exc/{f}", "r") as f, open(f'exc/duplicates_removed/{f}_without_dup.csv', 'w') as out_file:
                out_file.writelines(unique_everseen(f))

def download_data(data_type):
    if data_type == "main":
        print(f"Downloading main.i18n.json…")
        response = requests.get(f"https://raw.githubusercontent.com/microsoft/vscode-loc/main/i18n/vscode-language-pack-{LANGS[args.lang]}/translations/main.i18n.json")

        with open(f"json/{args.lang}/main.i18n.json", "w") as f:
            json.dump(response.json(), f)

        print(f"main.i18n.json downloaded successfully and extracted to json/{args.lang}/main.i18n.json!")

    elif data_type == "extensions":
        with open("vscode_extensions_files.txt", "r", encoding="utf8") as f:
            for file_name in f.readlines():
                file_name = file_name.strip()
                print(f"Downloading {file_name}…")
                response = requests.get(f"https://raw.githubusercontent.com/microsoft/vscode-loc/main/i18n/vscode-language-pack-{LANGS[args.lang]}/translations/extensions/{file_name}")

                with open(f"json/{args.lang}/extensions/{file_name}", "w") as g:
                    json.dump(response.json(), g)

                print(f"{file_name} downloaded successfully and extracted to json/{args.lang}/extensions/{file_name}!")

                time.sleep(args.delay)

if __name__ == "__main__":
    main()