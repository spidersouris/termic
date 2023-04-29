from flask import Flask, request, jsonify, render_template
import pandas as pd

app = Flask(__name__)

df_gl = pd.read_excel("data/glossary.xlsx")
df_exc = pd.read_csv("data/merged_exc.csv", sep="\t")

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/", methods=["POST"])
def main():
    term = request.json["term"]
    target_lang = request.json["target_lang"]

    df_gl.drop(df_gl.columns[df_gl.columns.str.contains("unnamed", case=False)], axis=1, inplace=True)
    results_gl = df_gl[df_gl["term_en-US"].str.contains(term, case=False, na=False)]
    results_exc = df_exc[df_exc["Source Term"].str.contains(term, case=False, na=False)]
    #print(results_gl.head())

    if len(results_gl) > 0:
        gl_source = results_gl["term_en-US"].tolist()
        gl_translation = results_gl["term_" + target_lang].tolist()
        gl_source_pos = results_gl["pos_en-US"].str.split(n=1).str[1].str.lower().tolist()
        gl_target_pos = results_gl["pos_" + target_lang].str.split(n=1).str[1].str.lower().tolist()
        gl_source_def = [s[:1].lower() + s[1:] for s in results_gl["def_en-US"].str.split(n=1).str[1].tolist()]
    else:
        gl_source, gl_translation, gl_source_pos, gl_target_pos, gl_source_def = []

    if len(results_exc) > 0:
        exc_source = results_exc["Source Term"].tolist()
        exc_translation = results_exc["Translation"].tolist()
        exc_cat = results_exc["String Category"].fillna("unknown").tolist()
        exc_platform = results_exc["Platform"].fillna("unknown").tolist()
        exc_product = results_exc["Product"].fillna("unknown").tolist()
        exc_version = results_exc["Version"].fillna("unknown").tolist()
    else:
        exc_source, exc_translation, exc_cat, exc_platform, exc_product, exc_version = []
    
    # JSON Response
    response = {"gl_source": gl_source, "gl_translation": gl_translation, "gl_source_pos": gl_source_pos, "gl_target_pos": gl_target_pos, "gl_source_def": gl_source_def,
    "exc_source": exc_source, "exc_translation": exc_translation, "exc_cat": exc_cat, "exc_platform": exc_platform, "exc_product": exc_product, "exc_version": exc_version}
    return jsonify(response)

if __name__ == "__main__":
    app.run()