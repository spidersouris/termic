import os
from flask import Flask, request, jsonify, render_template, redirect, send_from_directory
import psycopg2
from config.db_config import conn_string

app = Flask(__name__, static_folder="static")

@app.before_request
def enforce_https():
    """
    Redirect to HTTPS if the request is made over HTTP.
    https://stackoverflow.com/questions/32237379/python-flask-redirect-to-https-from-http
    """
    if request.headers.get("X-Forwarded-Proto") == "http":
        url = request.url.replace("http://", "https://", 1)
        return redirect(url, 301)

def db_connect():
    """
    Connect to the database with the provied connection string.
    """
    try:
        # Checking if environment variable exists
        # else, using connection string in config/db_config.py
        if os.environ["TERMIC_CONN_STRING"]:
            conn = psycopg2.connect(os.environ["TERMIC_CONN_STRING"])
        else:
            conn = psycopg2.connect(conn_string)
        print("Connection with database established")
        return conn
    except Exception as e:
        print(e)
        raise

def define_condition(search_option: str, case_sensitive: int) -> str:
    """
    Define the condition to use in the SQL query.
    """
    match search_option:
        case "unexact_match":
            # Simply escaping % with %% doesn't work,
            # we need to concatenate as well
            condition = "LIKE '%%' || %s || '%%'"
        case "exact_match":
            condition = "LIKE %s"
        case "regex":
            condition = "~* %s"
        case _:
            raise ValueError("Invalid result_filter value")

    if case_sensitive == 0 and search_option != "regex":
        condition = "I" + condition

    return condition

def build_sql_queries(modes: list, target_lang: str,
                    condition: str, result_count: list[int]) -> dict:
    """
    Build the SQL query to execute for each mode.
    """
    sql_queries = {}
    if "glossary" in modes:
        sql_queries["glossary_query"] = f"""SELECT term_en_US, term_{target_lang},
        pos_en_US, pos_{target_lang}, def_en_US FROM glossary_{target_lang}
        WHERE term_en_US {condition} LIMIT {result_count["result_count_gl"]};"""
    if "tm" in modes:
        sql_queries["tm_query"] = f"""SELECT source_term, translation,
        string_cat, platform, product FROM excerpts_{target_lang}
        WHERE source_term {condition} LIMIT {result_count["result_count_tm"]};"""
    else:
        raise ValueError("Invalid mode value")

    return sql_queries

def search(cur, term: str, queries: dict):
    """
    Search the term in the database.
    """
    if queries.get("glossary_query"):
        print(f"Searching '{term}' in glossary…")
        # %s in sql_query gets replaced with the term
        cur.execute(queries["glossary_query"], (term,))
        results_gl = cur.fetchall()
        results_gl = list(zip(*results_gl))

    if queries.get("tm_query"):
        print(f"Searching '{term}' in TM…")
        # %s in sql_query gets replaced with the term
        cur.execute(queries["tm_query"], (term,))
        results_tm = cur.fetchall()
        results_tm = list(zip(*results_tm))

    return process_results(results_tm, results_gl)

def process_results(results_tm: list[tuple],
                    results_gl: list[tuple]):
    """
    Process the results and return a JSON response.
    """
    if len(results_gl) > 0:
        gl_source = results_gl[0]
        gl_translation = results_gl[1]
        gl_source_pos = results_gl[2]
        gl_target_pos = results_gl[3]
        gl_source_def = results_gl[4]
    else:
        gl_source, gl_translation, gl_source_pos, \
        gl_target_pos, gl_source_def = [''] * 5

    if len(results_tm) > 0:
        tm_source = results_tm[0]
        tm_translation = results_tm[1]
        tm_cat = results_tm[2]
        tm_platform = results_tm[3]
        tm_product = results_tm[4]
    else:
        tm_source, tm_translation, tm_cat, \
        tm_platform, tm_product = [''] * 5

    # JSON Response
    response = {"gl_source": gl_source, "gl_translation": gl_translation,
    "gl_source_pos": gl_source_pos, "gl_target_pos": gl_target_pos,
    "gl_source_def": gl_source_def,
    "tm_source": tm_source, "tm_translation": tm_translation, "tm_cat": tm_cat,
    "tm_platform": tm_platform, "tm_product": tm_product}

    return jsonify(response)

@app.route("/")
def index():
    """
    Render the index page.
    """
    return render_template("index.html")

@app.route("/changelog/")
def changelog():
    """
    Render the changelog page.
    """
    return render_template("changelog.html")

@app.route("/robots.txt")
@app.route("/sitemap.xml")
def static_from_root():
    """
    Serve static files from root.
    https://stackoverflow.com/questions/4239825/static-files-in-flask-robot-txt-sitemap-xml-mod-wsgi
    """
    return send_from_directory(app.static_folder, request.path[1:])

@app.errorhandler(404)
def page_not_found(e):
    """
    Render the 404 page.
    """
    return render_template("404.html"), 404

@app.route("/", methods=["POST", "GET"])
def main():
    conn = db_connect()
    cur = conn.cursor()

    term = request.json["term"] # str: source term input in the search bar
    target_lang = request.json["target_lang"] # str: target language
    # dict[str, int]: number of results to return for each mode
    result_count = {"result_count_gl": request.json["result_count_gl"],
                    "result_count_tm": request.json["result_count_tm"]}
    search_option = request.json["search_option"] # str: search option (exact match, unexact match, regex)
    case_sensitive = request.json["case_sensitive"]
    modes = request.json["modes"] # list[str]: modes to search in (glossary, TM, both)

    print(f"""
    Query: {term}
    Target lang: {target_lang}
    Search option: {search_option}
    Modes: {modes}\n""")

    if result_count["result_count_gl"] <= 100 and result_count["result_count_tm"] <= 100:
        # Escape wildcard characters
        term = term.replace("%", "\%").replace("_", "\_")

        sql_queries = build_sql_queries(modes, target_lang,
        define_condition(search_option, case_sensitive), result_count)

        response = search(cur, term, sql_queries)

        return response

    cur.close()
    conn.close()

if __name__ == "__main__":
    app.run()
