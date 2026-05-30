"""
Serveur Flask pour la génération d'images par IA
Utilise Stable Diffusion via l'API Hugging Face
"""
    
import os
import json
import uuid
from datetime import datetime
from flask import Flask, render_template, request, jsonify, send_from_directory
from huggingface_hub import InferenceClient
from PIL import Image
import io

app = Flask(__name__)

# ============================================================
# CONFIGURATION
# ============================================================
# Token Hugging Face - À définir en variable d'environnement !
# Pour obtenir un token : https://huggingface.co/settings/tokens
HF_TOKEN = os.environ.get("HF_TOKEN", "")

# Modèle de diffusion à utiliser
MODEL_ID = "stabilityai/stable-diffusion-xl-base-1.0"

# Dossiers
GENERATED_DIR = os.path.join(app.static_folder, "generated")
HISTORY_FILE = os.path.join(GENERATED_DIR, "history.json")

os.makedirs(GENERATED_DIR, exist_ok=True)

# ============================================================
# FONCTIONS UTILITAIRES
# ============================================================

def load_history():
    """Charge l'historique des générations depuis le fichier JSON."""
    if os.path.exists(HISTORY_FILE):
        with open(HISTORY_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return []


def save_history(history):
    """Sauvegarde l'historique des générations dans le fichier JSON."""
    with open(HISTORY_FILE, "w", encoding="utf-8") as f:
        json.dump(history, f, ensure_ascii=False, indent=2)


# ============================================================
# ROUTES
# ============================================================

@app.route("/")
def index():
    """Page principale."""
    return render_template("index.html")


@app.route("/generate", methods=["POST"])
def generate():
    """
    Génère une image à partir d'un prompt textuel.
    Body JSON attendu : { "prompt": str, "negative_prompt": str, "style": str }
    """
    data = request.get_json()
    prompt = data.get("prompt", "").strip()
    negative_prompt = data.get("negative_prompt", "").strip()
    style = data.get("style", "default")

    if not prompt:
        return jsonify({"error": "Le prompt ne peut pas être vide."}), 400

    # Construire le prompt amélioré selon le style choisi
    style_prefixes = {
        "realistic": "ultra realistic photograph, 8k, photorealistic, ",
        "artistic": "oil painting, masterpiece, fine art, ",
        "anime": "anime style, high quality anime art, detailed, ",
        "3d": "3D render, octane render, cinema 4D, highly detailed, ",
        "pixel": "pixel art style, retro game art, 16-bit, ",
        "watercolor": "watercolor painting, soft colors, artistic, ",
        "default": "high quality, detailed, "
    }

    enhanced_prompt = style_prefixes.get(style, style_prefixes["default"]) + prompt

    default_negative = "blurry, bad quality, low resolution, deformed, ugly, distorted"
    if negative_prompt:
        full_negative = negative_prompt + ", " + default_negative
    else:
        full_negative = default_negative

    try:
        # Appel à l'API Hugging Face
        client = InferenceClient(token=HF_TOKEN)
        image = client.text_to_image(
            prompt=enhanced_prompt,
            negative_prompt=full_negative,
            model=MODEL_ID,
            width=1024,
            height=1024,
        )

        # Sauvegarder l'image
        filename = f"{uuid.uuid4().hex}.png"
        filepath = os.path.join(GENERATED_DIR, filename)
        image.save(filepath, format="PNG")

        # Ajouter à l'historique
        history = load_history()
        entry = {
            "id": filename.replace(".png", ""),
            "filename": filename,
            "prompt": prompt,
            "enhanced_prompt": enhanced_prompt,
            "negative_prompt": negative_prompt,
            "style": style,
            "created_at": datetime.now().isoformat(),
            "url": f"/static/generated/{filename}"
        }
        history.insert(0, entry)
        save_history(history)

        return jsonify({
            "success": True,
            "image": entry
        })

    except Exception as e:
        error_msg = str(e)
        print(f"Erreur lors de la génération : {error_msg}")

        if "401" in error_msg or "token" in error_msg.lower():
            return jsonify({
                "error": "Token Hugging Face invalide ou manquant. Vérifiez votre configuration."
            }), 401
        elif "503" in error_msg:
            return jsonify({
                "error": "Le modèle est en cours de chargement. Réessayez dans quelques secondes."
            }), 503
        else:
            return jsonify({
                "error": f"Erreur lors de la génération : {error_msg}"
            }), 500


@app.route("/gallery")
def gallery():
    """Retourne la liste des images générées."""
    history = load_history()
    return jsonify(history)


@app.route("/gallery/<filename>", methods=["DELETE"])
def delete_image(filename):
    """Supprime une image générée."""
    filepath = os.path.join(GENERATED_DIR, filename)
    if os.path.exists(filepath):
        os.remove(filepath)

    # Mettre à jour l'historique
    history = load_history()
    history = [h for h in history if h["filename"] != filename]
    save_history(history)

    return jsonify({"success": True})


# ============================================================
# LANCEMENT
# ============================================================

if __name__ == "__main__":
    print("=" * 60)
    print("  [ART] Generateur d'Images par IA")
    print("  [OK] Serveur Flask demarre sur http://localhost:5000")
    print("=" * 60)

    if HF_TOKEN == "VOTRE_TOKEN_ICI":
        print("")
        print("  [!] ATTENTION : Configurez votre token Hugging Face !")
        print("  -> Creez un token sur https://huggingface.co/settings/tokens")
        print("  -> Remplacez 'VOTRE_TOKEN_ICI' dans server.py")
        print("  -> Ou definissez la variable d'environnement HF_TOKEN")
        print("")

    app.run(debug=True, host="0.0.0.0", port=5000)
