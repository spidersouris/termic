from flask import Flask, request, jsonify, render_template
import pandas as pd
import gc
#import memory_profiler as mp

app = Flask(__name__)

#@mp.profile
def load_dataframes(target_lang):
        df_gl = pd.read_feather(f"data/feather/glossary_{target_lang}.ft")
        df_exc = pd.read_feather(f"data/feather/merged_exc_{target_lang}.ft")
        return df_gl, df_exc

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/", methods=["POST"])
#@mp.profile
def main():
    term = request.json["term"]
    target_lang = request.json["target_lang"]
    exact_match_gl = request.json["exact_match_gl"]
    exact_match_exc = request.json["exact_match_exc"]

    try:
        print(f"Query: {term}. Target lang: {target_lang}")
        df_gl, df_exc = load_dataframes(target_lang)
    except Exception as e:
        print(e)
        raise

    if exact_match_gl == 1:
        print(f"Searching for '{term}' in glossary… Exact match: true")
        results_gl = df_gl[df_gl["term_en-US"] == term]
    else:
        print(f"Searching for '{term}' in glossary… Exact match: false")
        results_gl = df_gl[df_gl["term_en-US"].str.contains(term, case=False, na=False)]
    
    if exact_match_exc == 1:
        results_exc = df_exc[df_exc["Source Term"] == term]
        print(f"Searching for '{term}' in translations excerpts… Exact match: true")
    else:
        results_exc = df_exc[df_exc["Source Term"].str.contains(term, case=False, na=False)]
        print(f"Searching for '{term}' in translations excerpts… Exact match: false")

    if len(results_gl) > 0:
        gl_source = results_gl["term_en-US"].tolist()
        gl_translation = results_gl["term_" + target_lang].tolist()
        gl_source_pos = results_gl["pos_en-US"].str.split(n=1).str[1].str.lower().tolist()
        gl_target_pos = results_gl["pos_" + target_lang].str.split(n=1).str[1].str.lower().tolist()
        gl_source_def = [s[:1].lower() + s[1:] for s in results_gl["def_en-US"].str.split(n=1).str[1].tolist()]
    else:
        gl_source, gl_translation, gl_source_pos, gl_target_pos, gl_source_def = [''] * 5

    if len(results_exc) > 0:
        exc_source = results_exc["Source Term"].tolist()
        exc_translation = results_exc["Translation"].tolist()
        exc_cat = results_exc["String Category"].fillna("unknown").tolist()
        exc_platform = results_exc["Platform"].fillna("unknown").tolist()
        exc_product = results_exc["Product"].fillna("unknown").tolist()
        exc_version = results_exc["Version"].fillna("unknown").tolist()
    else:
        exc_source, exc_translation, exc_cat, exc_platform, exc_product, exc_version = [''] * 6
    
    del [[df_gl, df_exc]]
    gc.collect()
    df_gl = None
    df_exc = None
    
    # JSON Response
    response = {"gl_source": gl_source, "gl_translation": gl_translation, "gl_source_pos": gl_source_pos, "gl_target_pos": gl_target_pos, "gl_source_def": gl_source_def,
    "exc_source": exc_source, "exc_translation": exc_translation, "exc_cat": exc_cat, "exc_platform": exc_platform, "exc_product": exc_product, "exc_version": exc_version}
    return jsonify(response)

if __name__ == "__main__":
    app.run()