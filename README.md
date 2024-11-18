<p align="center">
  <img src="https://github.com/Spidersouris/termic/assets/7102007/9b186166-8fe2-475f-be4b-1bc718a56881">
</p>

# termic: an alternative to Microsoft Terminology Search

**A deployed and ready-to-use version of termic is available on [https://termic.me](https://termic.me).**

## Data Collection

Data used by termic is available for download on [Dropbox](https://www.dropbox.com/sh/5oh21rhlmrp7rip/AAB_F2Q9wboJlopMZVTMKD5Ya?dl=0).

### Translation Memory

The 2020+ translation memory was retrieved from [Visual Studio Dev Essentials](https://my.visualstudio.com/downloads?pid=6822) as .csv files. Those files were merged using a custom script, [merge_csv.py, that is available in the termic-data GitHub project](https://github.com/Spidersouris/termic-data/blob/main/scripts/merge_csv.py).

To download Microsoft's translation memory, follow these steps:
1. Go to [Visual Studio Dev Essentials](https://my.visualstudio.com/downloads?pid=6822).
2. Search "Translation and UI Strings Glossaries September 2020" in the "Search downloads" search bar.
3. The link should appear as you start typing; click on it and search.
4. Choose your language on the right and click on the "Download" button.

In addition, this dataset was expanded with VSCode strings (which are not available in the TM provided by Microsoft). [vscode_data.py](https://github.com/Spidersouris/termic-data/blob/main/scripts/vscode_data.py) was used for extraction.

### Glossaries

Glossaries were retrieved from [the Microsoft Terminology Collection](https://www.microsoft.com/en-us/language/Terminology). Those are .tbx files that were converted to .xlsx using [Xbench](https://www.xbench.net/).

## Requirements

### Website

- Python (>=3.10)
- Flask (>=2.3.1)
- psycopg2 (>=2.9.6)

### Scripts

- Python (>=3.10)
- requests (>=2.29.0)
- pandas (>=2.0.1)

## Usage

1) `git clone https://github.com/spidersouris/termic.git`
2) `cd termic`
3) `pip install -r requirements.txt`
4) `python termic.py`
5) Go to http://localhost:5000

### Using a database

If you want to run termic locally with the data available for download on [Dropbox](https://www.dropbox.com/sh/5oh21rhlmrp7rip/AAB_F2Q9wboJlopMZVTMKD5Ya?dl=0) or with your own terminology data, using a local database is recommended.

You can change the connection string in [config/db_config.py](https://github.com/Spidersouris/termic/blob/main/config/db_config.py) to connect to your database.

### Using local data files

Using local data files with termic is far from being ideal. However, if it is your only option, here are a few tips:
- You can use [pandas](https://pandas.pydata.org/) (or any other alternative Python data processing librairies) to process the .csv (translation memory) and .xlsx (glossary) files.
- If you do use pandas, consider converting the .csv and .xlsx files to the [binary feather format](https://pandas.pydata.org/docs/reference/api/pandas.DataFrame.to_feather.html) to reduce disk usage and improve search time. To do so, you can use the [convert_to_feather.py script, that is available in the termic-data GitHub project](https://github.com/Spidersouris/termic-data/blob/main/scripts/convert_to_feather.py).
- You can use [termic_pandas.py](https://gist.github.com/Spidersouris/e2509906b3a609f87947bc657bffabde) as a basis for your local deployment.

### Mail server

termic comes with Flask-Mail, which means that you can configure a SMTP endpoint to receive messages sent via the contact form (on the /about route by default).

This requires setting up the following environment variables (see [config/mail_config.py](config/mail_config.py) for more information): `MAIL_SERVER`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_SENDER`, `MAIL_RECIPIENTS`.

If any of these environment variables are undefined, the mail service will be disabled and users won't be able to send emails.

## Development

`flask --app termic run --debug`

## Deployment

You can use [Heroku](https://dashboard.heroku.com/new-app) for deployment.

1) `heroku login`
2) `heroku create --app termic`
3) `git push heroku master`

## Contributors

- [benediktkr](https://github.com/benediktkr)
- MK