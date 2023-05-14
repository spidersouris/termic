<p align="center">
  <img src="https://github.com/Spidersouris/termic/assets/7102007/9b186166-8fe2-475f-be4b-1bc718a56881">
</p>

# termic: a replacement for Microsoft Terminology Search

**A deployed and ready-to-use version of termic is available on [https://termic.me](https://termic.me).**

## Data Collection

The translaton memory was retrieved from [Visual Studio Dev Essentials](https://my.visualstudio.com/downloads?pid=6822) as .csv files. Those files were merged using a custom script, [merge_csv.py, that is available in the termic-data GitHub project](https://github.com/Spidersouris/termic-data/blob/main/scripts/merge_csv.py).

Glossaries were retrieved from [the Microsoft Terminology Collection](https://www.microsoft.com/en-us/language/Terminology). Those are .tbx files that were converted to .xlsx using [Xbench](https://www.xbench.net/).

## Usage

1) `git clone https://github.com/spidersouris/termic.git`
2) `pip install -r requirements.txt`
3) `python termic.py`
4) Go to http://localhost:5000

### Using a database

If you want to run termic locally with the data available on [the termic-data GitHub project page](https://github.com/Spidersouris/termic-data) or with your own terminology data, using a local database is recommended.

You can change the connection string in [config/db_config.py](https://github.com/Spidersouris/termic/blob/main/config/db_config.py) to connect to your database.

### Using local data

Using local data with termic is far from being ideal. However, if it is your only option, here are a few tips:
- You can use [pandas](https://pandas.pydata.org/) (or any other alternative Python data processing librairies) to process the .csv (translation memory) and .xlsx (glossary) files.
- If you do use pandas, consider converting the .csv and .xlsx files to the [binary feather format](https://pandas.pydata.org/docs/reference/api/pandas.DataFrame.to_feather.html) to reduce disk usage and improve search time. To do so, you can use the [convert_to_feather.py script, that is available in the termic-data GitHub project](https://github.com/Spidersouris/termic-data/blob/main/scripts/convert_to_feather.py).
- You can use [termic_pandas.py](https://gist.github.com/Spidersouris/e2509906b3a609f87947bc657bffabde) as a basis for your local deployment.

## Development

`flask --app termic run --debug`

## Deployment

You can use [Heroku](https://dashboard.heroku.com/new-app) for deployment.

1) `heroku login`
2) `heroku create --app termic`
3) `git push heroku master`
