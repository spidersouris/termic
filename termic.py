from flask import Flask, request, jsonify, render_template, redirect
from config.db_config import conn_string
import psycopg2
import os

app = Flask(__name__)

@app.before_request
def enforceHttps():
  if request.headers.get("X-Forwarded-Proto") == "http":
    url = request.url.replace("http://", "https://", 1)
    code = 301
    return redirect(url, code=code)

def db_connect():
    try:
        if os.environ["TERMIC_CONN_STRING"]:
            conn = psycopg2.connect(os.environ["TERMIC_CONN_STRING"])
        else:
            conn = psycopg2.connect(conn_string)
        print("Connection with database established")
        return conn
    except Exception as e:
        print(e)
        raise

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/", methods=["POST"])
def main():
    conn = db_connect()
    cur = conn.cursor()

    term = request.json["term"] # Source term input in the search bar
    target_lang = request.json["target_lang"] # Target language
    result_count_gl = request.json["result_count_gl"] # Number of max. glossary results to retrieve
    result_count_exc = request.json["result_count_exc"]
    exact_match_gl = request.json["exact_match_gl"]
    exact_match_exc = request.json["exact_match_exc"]

    print(f"Query: {term}. Target lang: {target_lang}")

    if result_count_gl <= 100 and result_count_exc <= 100:
        if exact_match_gl == 1:
            print(f"Searching for '{term}' in glossary… Exact match: true")
            cur.execute(f"SELECT term_en_US, term_{target_lang}, pos_en_US, pos_{target_lang}, def_en_US FROM glossary_{target_lang} WHERE term_en_US ILIKE %s LIMIT %s;", (term, result_count_gl))
        else:
            print(f"Searching for '{term}' in glossary… Exact match: false")
            cur.execute(f"SELECT term_en_US, term_{target_lang}, pos_en_US, pos_{target_lang}, def_en_US FROM glossary_{target_lang} WHERE term_en_US ILIKE %s LIMIT %s;", ('%' + term + '%', result_count_gl))

        results_gl = cur.fetchall()

        results_gl = list(zip(*results_gl))

        if len(results_gl) > 0:
            gl_source = results_gl[0]
            gl_translation = results_gl[1]
            gl_source_pos = results_gl[2]
            gl_target_pos = results_gl[3]
            gl_source_def = results_gl[4]
        else:
            gl_source, gl_translation, gl_source_pos, gl_target_pos, gl_source_def = [''] * 5

        if exact_match_exc == 1:
            print(f"Searching for '{term}' in translation excerpts… Exact match: true")
            cur.execute(f"SELECT source_term, translation, string_cat, platform, product FROM excerpts_{target_lang} WHERE source_term ILIKE %s LIMIT %s;", (term, result_count_exc))
        else:
            print(f"Searching for '{term}' in translations excerpts… Exact match: false")
            cur.execute(f"SELECT source_term, translation, string_cat, platform, product FROM excerpts_{target_lang} WHERE source_term ILIKE %s LIMIT %s;", ('%' + term + '%', result_count_exc))

        results_exc = cur.fetchall()

        results_exc = list(zip(*results_exc))

        if len(results_exc) > 0:
            exc_source = results_exc[0]
            exc_translation = results_exc[1]
            exc_cat = results_exc[2]
            exc_platform = results_exc[3]
            exc_product = results_exc[4]
        else:
            exc_source, exc_translation, exc_cat, exc_platform, exc_product = [''] * 5

    cur.close()
    conn.close()

    # JSON Response
    response = {"gl_source": gl_source, "gl_translation": gl_translation, "gl_source_pos": gl_source_pos, "gl_target_pos": gl_target_pos, "gl_source_def": gl_source_def,
    "exc_source": exc_source, "exc_translation": exc_translation, "exc_cat": exc_cat, "exc_platform": exc_platform, "exc_product": exc_product}
    return jsonify(response)

if __name__ == "__main__":
    app.run()