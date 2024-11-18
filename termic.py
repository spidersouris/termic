import os
import time

from flask import (
    Flask,
    request,
    jsonify,
    render_template,
    redirect,
    send_from_directory,
)
from flask_mail import Mail, Message
import psycopg2
from config.mail_config import Config
from config.db_config import CONN_STRING

app = Flask(__name__, static_folder="static")
app.config.from_object(Config)

mail_config_kv = {k: v for k, v in app.config.items() if "MAIL" in k}

if not all(mail_config_kv.values()):
    missing_keys = [k for k, v in mail_config_kv.items() if v is None]
    print(
        "Mail configuration is incomplete. "
        f"The following keys are missing: {", ".join(missing_keys)}"
        "\nEmail functionality will be disabled."
    )
    mail = None
else:
    mail = Mail(app)


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
            conn = psycopg2.connect(CONN_STRING)
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


def build_sql_queries(
    modes: list,
    source_lang: str,
    target_lang: str,
    condition: str,
    result_count: dict[str, int],
    data_period: str,
) -> dict:
    """
    Build the SQL query to execute for each mode.
    """
    sql_queries = {}
    # 2020+ tables have no data period suffix
    if data_period != "2017":
        data_period = ""
    # We consider en_us to be the "default" and filter language
    # because this is the language from which glossary/TM terms are translated.
    if "glossary" in modes:
        if source_lang == "en_us":
            sql_queries[
                "glossary_query"
            ] = f"""SELECT term_en_us, term_{target_lang},
            pos_en_us, pos_{target_lang}, def_en_us FROM glossary_{target_lang}
            WHERE term_en_us {condition} LIMIT {result_count["result_count_gl"]};"""
        elif target_lang == "en_us":
            sql_queries[
                "glossary_query"
            ] = f"""SELECT term_{source_lang}, term_en_us,
            pos_{source_lang}, pos_en_us, def_en_us FROM glossary_{source_lang}
            WHERE term_{source_lang} {condition}
            LIMIT {result_count["result_count_gl"]};"""
        else:
            # Join glossary tables based on the English term.
            # Joining by ID is not possible because the number of terms
            # in each glossary table is different.
            sql_queries[
                "glossary_query"
            ] = f"""SELECT term_{source_lang},
            term_{target_lang}, glossary_{target_lang}.pos_en_US, pos_{target_lang},
            glossary_{target_lang}.def_en_US FROM glossary_{target_lang}
            JOIN glossary_{source_lang}
            ON glossary_{target_lang}.term_en_us = glossary_{source_lang}.term_en_us
            WHERE term_{source_lang} {condition}
            LIMIT {result_count["result_count_gl"]};"""
    if "tm" in modes:
        if source_lang == "en_us":
            sql_queries[
                "tm_query"
            ] = f"""SELECT source_term, translation,
            string_cat, platform, product FROM excerpts_{target_lang}{data_period}
            WHERE source_term {condition}
            LIMIT {result_count["result_count_tm"]};"""
        elif target_lang == "en_us":
            # Select translation first so it appears in the "Source" column
            sql_queries[
                "tm_query"
            ] = f"""SELECT translation, source_term,
            string_cat, platform, product FROM excerpts_{source_lang}{data_period}
            WHERE translation {condition}
            LIMIT {result_count["result_count_tm"]};"""
        else:
            # Join TM tables based on the English ("source") term.
            # Joining by ID is not possible because the number of terms
            # in each TM table is different.
            sql_queries[
                "tm_query"
            ] = f"""SELECT
            excerpts_{source_lang}{data_period}.translation,
            excerpts_{target_lang}{data_period}.translation,
            excerpts_{source_lang}{data_period}.string_cat,
            excerpts_{source_lang}{data_period}.platform,
            excerpts_{source_lang}{data_period}.product
            FROM excerpts_{target_lang}{data_period}
            JOIN excerpts_{source_lang}{data_period}
            ON excerpts_{target_lang}{data_period}.source_term =
            excerpts_{source_lang}{data_period}.source_term
            WHERE excerpts_{source_lang}{data_period}.translation {condition}
            LIMIT {result_count["result_count_tm"]};"""
    if any(mode not in ["glossary", "tm"] for mode in modes):
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
    else:
        results_gl = []

    if queries.get("tm_query"):
        print(f"Searching '{term}' in TM…")
        # %s in sql_query gets replaced with the term
        cur.execute(queries["tm_query"], (term,))
        results_tm = cur.fetchall()
        results_tm = list(zip(*results_tm))
    else:
        results_tm = []

    return process_results(results_tm, results_gl)


def process_results(results_tm: list[tuple], results_gl: list[tuple]):
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
        gl_source, gl_translation, gl_source_pos, gl_target_pos, gl_source_def = [
            ""
        ] * 5

    if len(results_tm) > 0:
        tm_source = results_tm[0]
        tm_translation = results_tm[1]
        tm_cat = results_tm[2]
        tm_platform = results_tm[3]
        tm_product = results_tm[4]
    else:
        tm_source, tm_translation, tm_cat, tm_platform, tm_product = [""] * 5

    # JSON Response
    response = {
        "gl_source": gl_source,
        "gl_translation": gl_translation,
        "gl_source_pos": gl_source_pos,
        "gl_target_pos": gl_target_pos,
        "gl_source_def": gl_source_def,
        "tm_source": tm_source,
        "tm_translation": tm_translation,
        "tm_cat": tm_cat,
        "tm_platform": tm_platform,
        "tm_product": tm_product,
    }

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


@app.route("/about/")
def about():
    """
    Render the about page.
    """
    return render_template("about.html")


@app.route("/about/", methods=["POST", "GET"])
def send_message():
    """
    Send a message from the contact form.
    """
    if mail is None:
        return jsonify({"error": "Mail service is not enabled"}), 400

    if request.method == "POST":
        if not request.json:
            return jsonify({"error": "No JSON data provided"}), 400

        name = request.json["name"]
        email = request.json["email"]
        message = request.json["message"]

        msg = Message(
            f"Termic Contact Form: Message from {name}",
            sender=Config.MAIL_SENDER,
            recipients=[Config.MAIL_RECIPIENTS],
        )
        msg.body = f"Name: {name}\nEmail: {email}\n\n{message}"
        mail.send(msg)

        return jsonify(success=True)
    else:
        return jsonify(success=False)


@app.route("/robots.txt")
@app.route("/sitemap.xml")
def static_from_root():
    """
    Serve static files from root.
    https://stackoverflow.com/questions/4239825/static-files-in-flask-robot-txt-sitemap-xml-mod-wsgi
    """
    if app.static_folder:
        return send_from_directory(app.static_folder, request.path[1:])
    return "", 404


@app.errorhandler(404)
def page_not_found(e):  # pylint: disable=unused-argument
    """
    Render the 404 page.
    """
    return render_template("404.html"), 404


@app.route("/", methods=["POST", "GET"])
def main():  # pylint: disable=missing-function-docstring
    start_time = time.time()
    conn = db_connect()
    cur = conn.cursor()

    if not request.json:
        return jsonify({"error": "No JSON data provided"}), 400

    term = request.json["term"]  # str: source term input in the search bar
    source_lang = request.json["source_lang"]  # str: source language
    target_lang = request.json["target_lang"]  # str: target language
    # dict[str, int]: number of results to return for each mode
    result_count = {
        "result_count_gl": int(request.json["result_count_gl"]),
        "result_count_tm": int(request.json["result_count_tm"]),
    }
    search_option = request.json[
        "search_option"
    ]  # str: search option (exact match, unexact match, regex)
    case_sensitive = int(request.json["case_sensitive"])  # int: case sensitivity
    modes = request.json["modes"]  # list[str]: modes to search in (glossary, TM, both)
    data_period = request.json["data_period"]  # str: data period (2017, 2020+)

    print(
        f"""
    Query: {term}
    Source lang: {source_lang}
    Target lang: {target_lang}
    Result count: {result_count}
    Search option: {search_option}
    Case sensitivity: {case_sensitive}
    Modes: {modes}
    Data period: {data_period}\n"""
    )

    if (
        result_count["result_count_gl"] <= 100
        and result_count["result_count_tm"] <= 100
    ):
        # Escape wildcard characters
        term = term.replace("%", "\%").replace("_", "\_")

        sql_queries = build_sql_queries(
            modes,
            source_lang,
            target_lang,
            define_condition(search_option, case_sensitive),
            result_count,
            data_period,
        )

        response = search(cur, term, sql_queries)

        cur.close()
        conn.close()

        print(f"Time elapsed: {time.time() - start_time:.2f}s")

        return response
    else:
        return jsonify({"msg": "Result count can't be above 100"}), 500


if __name__ == "__main__":
    app.run()
