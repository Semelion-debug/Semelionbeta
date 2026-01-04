#!/usr/bin/env python3
"""
Simplified Semelion AI Chatbot - Frontend with API Integration
Connects to API server at localhost:8080
"""

from flask import Flask, request, jsonify, render_template
import requests
import os
import json
import time

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

app = Flask(__name__)

# API Server Configuration
API_SERVER_URL = os.getenv("API_SERVER_URL", "https://semelion-ai-api.onrender.com")
API_KEY = os.getenv("SEMELION_API_KEY", "sa-150094635296999121")

# User data storage (in-memory)
user_data = {}

def call_api_server(endpoint, payload):
    """Call the API server with authentication"""
    url = f"{API_SERVER_URL}/{endpoint}"
    headers = {
        "X-API-Key": API_KEY,
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"API Server error ({endpoint}): {e}")
        
        # Try with query parameter as fallback
        try:
            url_with_key = f"{url}?api_key={API_KEY}"
            response = requests.post(url_with_key, json=payload, timeout=30)
            response.raise_for_status()
            return response.json()
        except:
            raise Exception(f"Failed to connect to API server: {e}")

def get_user_info(user_name):
    """Get or create user information"""
    if user_name not in user_data:
        user_data[user_name] = {
            "name": user_name,
            "favorites": [],
            "preferences": {},
            "conversation_count": 0,
            "last_interaction": time.time()
        }
    return user_data[user_name]

def update_user_preferences(user_name, key, value):
    """Update user preferences"""
    user_info = get_user_info(user_name)
    user_info["preferences"][key] = value
    user_info["last_interaction"] = time.time()

def add_user_favorite(user_name, item):
    """Add item to user favorites"""
    user_info = get_user_info(user_name)
    if item not in user_info["favorites"]:
        user_info["favorites"].append(item)
        user_info["last_interaction"] = time.time()

@app.route("/")
def index():
    return render_template("index.html")

@app.route('/owner')
def owner():
    return render_template('owner.html')

@app.route("/login", methods=["POST"])
def login():
    """Handle user login"""
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400
    
    data = request.get_json()
    user_name = data.get("name", "").strip()
    
    if not user_name:
        return jsonify({"error": "Name is required"}), 400
    
    # Get or create user info
    user_info = get_user_info(user_name)
    user_info["conversation_count"] += 1
    
    return jsonify({
        "success": True,
        "user": user_info,
        "message": f"Welcome back, {user_name}!" if user_info["conversation_count"] > 1 else f"Welcome, {user_name}!"
    })

@app.route("/user_info", methods=["GET"])
def get_user_info_route():
    """Get user information"""
    user_name = request.args.get("name", "")
    if not user_name:
        return jsonify({"error": "Name parameter required"}), 400
    
    user_info = get_user_info(user_name)
    return jsonify({"user": user_info})

@app.route("/update_preferences", methods=["POST"])
def update_preferences():
    """Update user preferences"""
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400
    
    data = request.get_json()
    user_name = data.get("name", "")
    key = data.get("key", "")
    value = data.get("value", "")
    
    if not all([user_name, key]):
        return jsonify({"error": "Name and key are required"}), 400
    
    update_user_preferences(user_name, key, value)
    return jsonify({"success": True, "message": "Preferences updated"})

@app.route("/add_favorite", methods=["POST"])
def add_favorite():
    """Add item to user favorites"""
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400
    
    data = request.get_json()
    user_name = data.get("name", "")
    item = data.get("item", "")
    
    if not all([user_name, item]):
        return jsonify({"error": "Name and item are required"}), 400
    
    add_user_favorite(user_name, item)
    return jsonify({"success": True, "message": "Added to favorites"})

@app.route("/chat", methods=["POST"])
def chat():
    """Handle chat by calling API server"""
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400

    data = request.get_json()
    user_input = data.get("message", "")
    conversation_history = data.get("conversation_history", [])
    user_name = data.get("user_name", "Anonymous")
    deep_thinking = data.get("deep_thinking", False)
    online_search_requested = data.get("online_search", False)
    vision_mode = data.get("vision_mode", False)
    selected_model = data.get("model", "Pro (Default)")
    user_system_prompt = data.get("system_prompt", "")

    if not user_input:
        return jsonify({"error": "Missing 'message' in JSON"}), 400
    
    # Get user info for context
    user_info = get_user_info(user_name)
    
    # Build user context
    user_context = f"User Information:\n- Name: {user_name}"
    if user_info["favorites"]:
        user_context += f"\n- Favorites: {', '.join(user_info['favorites'][:5])}"
    if user_info["preferences"]:
        user_context += f"\n- Preferences: {json.dumps(user_info['preferences'])}"
    
    # Prepare payload for API server
    payload = {
        "message": user_input,
        "conversation_history": conversation_history,
        "user_name": user_name,
        "deep_thinking": deep_thinking,
        "online_search": online_search_requested,
        "vision_mode": vision_mode,
        "model": selected_model,
        "system_prompt": user_system_prompt,
        "user_context": user_context
    }
    
    try:
        # Call API server
        result = call_api_server("chat", payload)
        
        # Update user interaction time
        user_info["last_interaction"] = time.time()
        
        # Add user info to response
        result["user_info"] = user_info
        
        return jsonify(result)
        
    except Exception as e:
        print(f"Error calling API server: {e}")
        return jsonify({
            "error": "Unable to connect to AI service. Please try again.",
            "retry_suggested": True
        }), 500

@app.route("/online_search", methods=["POST"])
def online_search():
    """Perform online search via API server"""
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400
    
    data = request.get_json()
    query = data.get("query", "").strip()
    
    if not query:
        return jsonify({"error": "Query is required"}), 400
    
    try:
        result = call_api_server("online_search", {"query": query})
        return jsonify(result)
    except Exception as e:
        return jsonify({
            "error": "Search service unavailable",
            "details": str(e)
        }), 500

@app.route("/reload_kb", methods=["POST"])
def reload_knowledge_base():
    """Reload knowledge base via API server"""
    try:
        result = call_api_server("kb/reload", {})
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/kb_status", methods=["GET"])
def kb_status():
    """Get knowledge base status via API server"""
    try:
        result = call_api_server("kb/status", {})
        return jsonify(result)
    except Exception as e:
        return jsonify({
            "error": "API server unavailable",
            "offline": True
        }), 500

@app.route("/models", methods=["GET"])
def get_models():
    """Get available models from API server"""
    try:
        result = call_api_server("models", {})
        return jsonify(result)
    except Exception as e:
        # Fallback if API server is unavailable
        return jsonify({
            "models": ["Pro (Default)", "Agent", "1.0", "Assistant", "SA Vision"],
            "default": "Pro (Default)",
            "offline": True
        })

@app.route("/test_vision", methods=["GET"])
def test_vision():
    """Test vision model availability via API server"""
    try:
        result = call_api_server("test/vision", {})
        return jsonify(result)
    except Exception as e:
        return jsonify({
            "vision_available": False,
            "error": "API server unavailable"
        })

@app.route("/api/health", methods=["GET"])
def health_check():
    """Health check endpoint"""
    try:
        result = call_api_server("health", {})
        return jsonify({
            "frontend": "healthy",
            "api_server": result
        })
    except Exception as e:
        return jsonify({
            "frontend": "healthy",
            "api_server": "unavailable",
            "error": str(e)
        }), 503

if __name__ == "__main__":
    print("=" * 50)
    print("Semelion AI Frontend")
    print(f"API Server URL: {API_SERVER_URL}")
    print(f"API Key: {API_KEY[:10]}...")
    print(f"Frontend running on: http://localhost:5000")
    print("=" * 50)
    
    # Run frontend server
    app.run(
        host="0.0.0.0", 
        port=5000, 
        debug=False,
        threaded=True
    )
