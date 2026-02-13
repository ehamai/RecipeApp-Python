"""
Recipe Generator App - Flask Backend

A web application that generates AI-powered recipes using GitHub Models API,
with GitHub OAuth PKCE authentication.
"""

import json
import re
from flask import Flask, request, jsonify, send_from_directory
import requests

import config

app = Flask(__name__, static_folder='static', static_url_path='')


# =============================================================================
# Static File Serving
# =============================================================================

@app.route('/')
def serve_index():
    """Serve the main application page."""
    return send_from_directory(app.static_folder, 'index.html')


# =============================================================================
# Health Check
# =============================================================================

@app.route('/api/health')
def health_check():
    """Health check endpoint."""
    return jsonify({'status': 'ok', 'message': 'Recipe Generator API is running'})


@app.route('/api/config')
def get_config():
    """Return public configuration (client ID for OAuth)."""
    return jsonify({
        'github_client_id': config.GITHUB_CLIENT_ID
    })


# =============================================================================
# OAuth Token Exchange
# =============================================================================

@app.route('/api/oauth/token', methods=['POST'])
def oauth_token_exchange():
    """
    Exchange OAuth authorization code for access token using PKCE.
    
    Expected request body:
    {
        "code": "authorization_code",
        "code_verifier": "pkce_code_verifier",
        "redirect_uri": "http://localhost:5000"
    }
    """
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'Request body required'}), 400
    
    code = data.get('code')
    code_verifier = data.get('code_verifier')
    redirect_uri = data.get('redirect_uri')
    
    if not code:
        return jsonify({'error': 'Authorization code required'}), 400
    if not code_verifier:
        return jsonify({'error': 'Code verifier required'}), 400
    if not redirect_uri:
        return jsonify({'error': 'Redirect URI required'}), 400
    
    if not config.GITHUB_CLIENT_ID:
        return jsonify({'error': 'Server misconfigured: GITHUB_CLIENT_ID not set'}), 500
    
    # Exchange code for token with GitHub
    token_payload = {
        'client_id': config.GITHUB_CLIENT_ID,
        'code': code,
        'code_verifier': code_verifier,
        'redirect_uri': redirect_uri
    }
    
    # Add client secret if configured (not needed for GitHub Apps with PKCE)
    if config.GITHUB_CLIENT_SECRET:
        token_payload['client_secret'] = config.GITHUB_CLIENT_SECRET
    
    # Debug logging
    print(f"DEBUG: Token exchange payload (without code): client_id={config.GITHUB_CLIENT_ID}, redirect_uri={redirect_uri}, has_secret={bool(config.GITHUB_CLIENT_SECRET)}")
    
    # Use form-encoded data (not JSON) for GitHub OAuth token endpoint
    token_response = requests.post(
        config.GITHUB_OAUTH_TOKEN_URL,
        headers={
            'Accept': 'application/json'
        },
        data=token_payload,
        timeout=30
    )
    
    # Debug: print full response from GitHub
    print(f"DEBUG: GitHub response status: {token_response.status_code}")
    print(f"DEBUG: GitHub response body: {token_response.text}")
    
    if token_response.status_code != 200:
        return jsonify({'error': 'Failed to exchange code for token'}), 502
    
    token_data = token_response.json()
    
    if 'error' in token_data:
        error_description = token_data.get('error_description', token_data['error'])
        return jsonify({'error': error_description}), 400
    
    return jsonify({
        'access_token': token_data.get('access_token'),
        'token_type': token_data.get('token_type', 'bearer'),
        'scope': token_data.get('scope', '')
    })


# =============================================================================
# OAuth Device Flow
# =============================================================================

@app.route('/api/oauth/device', methods=['POST'])
def oauth_device_code():
    """
    Request a device code for OAuth Device Flow.
    No client secret required!
    
    Returns:
    {
        "device_code": "...",
        "user_code": "ABCD-1234",
        "verification_uri": "https://github.com/login/device",
        "expires_in": 900,
        "interval": 5
    }
    """
    if not config.GITHUB_CLIENT_ID:
        return jsonify({'error': 'Server misconfigured: GITHUB_CLIENT_ID not set'}), 500
    
    response = requests.post(
        'https://github.com/login/device/code',
        headers={
            'Accept': 'application/json'
        },
        data={
            'client_id': config.GITHUB_CLIENT_ID,
            'scope': 'models:read'
        },
        timeout=30
    )
    
    if response.status_code != 200:
        return jsonify({'error': 'Failed to get device code'}), 502
    
    data = response.json()
    
    if 'error' in data:
        return jsonify({'error': data.get('error_description', data['error'])}), 400
    
    return jsonify({
        'device_code': data.get('device_code'),
        'user_code': data.get('user_code'),
        'verification_uri': data.get('verification_uri'),
        'expires_in': data.get('expires_in'),
        'interval': data.get('interval', 5)
    })


@app.route('/api/oauth/device/token', methods=['POST'])
def oauth_device_token():
    """
    Poll for access token during Device Flow.
    
    Expected request body:
    {
        "device_code": "..."
    }
    
    Returns access token when user authorizes, or error status while pending.
    """
    data = request.get_json()
    
    if not data or not data.get('device_code'):
        return jsonify({'error': 'device_code required'}), 400
    
    if not config.GITHUB_CLIENT_ID:
        return jsonify({'error': 'Server misconfigured: GITHUB_CLIENT_ID not set'}), 500
    
    response = requests.post(
        config.GITHUB_OAUTH_TOKEN_URL,
        headers={
            'Accept': 'application/json'
        },
        data={
            'client_id': config.GITHUB_CLIENT_ID,
            'device_code': data['device_code'],
            'grant_type': 'urn:ietf:params:oauth:grant-type:device_code'
        },
        timeout=30
    )
    
    token_data = response.json()
    
    # Check for pending/slow_down status (user hasn't authorized yet)
    if 'error' in token_data:
        error = token_data['error']
        if error in ('authorization_pending', 'slow_down'):
            # These are expected while waiting for user
            return jsonify({
                'status': 'pending',
                'error': error,
                'interval': token_data.get('interval', 5)
            })
        else:
            # Actual error
            return jsonify({
                'status': 'error',
                'error': token_data.get('error_description', error)
            }), 400
    
    # Success!
    return jsonify({
        'status': 'complete',
        'access_token': token_data.get('access_token'),
        'token_type': token_data.get('token_type', 'bearer'),
        'scope': token_data.get('scope', '')
    })


# =============================================================================
# Recipe Generation
# =============================================================================

def create_recipe_prompt(ingredients):
    """Create the AI prompt for recipe generation."""
    system_prompt = """You are an expert chef and culinary instructor. Your task is to create 
delicious, practical recipes based on the ingredients provided. Be creative but realistic.
Always respond with valid JSON only, no additional text or markdown."""
    
    user_prompt = f"""Generate exactly 8 recipes using some or all of these ingredients: {', '.join(ingredients)}

Return a JSON object with a "recipes" array. Each recipe must have:
- name: string (creative recipe name)
- description: string (2-3 sentences describing the dish)
- skillLevel: "Easy" | "Medium" | "Hard"
- cookingTime: string (e.g., "30 minutes", "1 hour")
- ingredients: array of strings with quantities (e.g., "2 cups flour")
- instructions: array of step strings (numbered instructions)

Important: Return ONLY the JSON object, no markdown code blocks or additional text."""

    return system_prompt, user_prompt


def extract_json_from_response(text):
    """Extract JSON from the AI response, handling potential markdown wrapping."""
    # Try to parse directly first
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    
    # Try to extract from markdown code block
    code_block_pattern = r'```(?:json)?\s*([\s\S]*?)\s*```'
    match = re.search(code_block_pattern, text)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass
    
    # Try to find JSON object in the text
    json_pattern = r'\{[\s\S]*\}'
    match = re.search(json_pattern, text)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass
    
    return None


@app.route('/api/generate-recipes', methods=['POST'])
def generate_recipes():
    """
    Generate recipes using GitHub Models API.
    
    Expected request body:
    {
        "token": "github_access_token",
        "ingredients": ["eggs", "flour", "butter"]
    }
    """
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'Request body required'}), 400
    
    token = data.get('token')
    ingredients = data.get('ingredients', [])
    
    if not token:
        return jsonify({'error': 'Access token required'}), 400
    if not ingredients or len(ingredients) == 0:
        return jsonify({'error': 'At least one ingredient required'}), 400
    if len(ingredients) > 20:
        return jsonify({'error': 'Maximum 20 ingredients allowed'}), 400
    
    # Sanitize ingredients
    sanitized_ingredients = [
        str(ing).strip()[:50] for ing in ingredients 
        if ing and str(ing).strip()
    ]
    
    if not sanitized_ingredients:
        return jsonify({'error': 'At least one valid ingredient required'}), 400
    
    system_prompt, user_prompt = create_recipe_prompt(sanitized_ingredients)
    
    # Debug: Log token info (truncated for security)
    token_preview = f"{token[:8]}...{token[-4:]}" if len(token) > 12 else "too short"
    print(f"DEBUG: Token length: {len(token)}, preview: {token_preview}")
    print(f"DEBUG: API URL: {config.GITHUB_MODELS_API_URL}")
    
    try:
        response = requests.post(
            config.GITHUB_MODELS_API_URL,
            headers={
                'Authorization': f'Bearer {token}',
                'Content-Type': 'application/json'
            },
            json={
                'model': 'gpt-4o',
                'messages': [
                    {'role': 'system', 'content': system_prompt},
                    {'role': 'user', 'content': user_prompt}
                ],
                'temperature': 0.7,
                'max_tokens': 4000
            },
            timeout=60
        )
    except requests.exceptions.Timeout:
        return jsonify({'error': 'Request timed out. Please try again.'}), 504
    except requests.exceptions.RequestException as e:
        return jsonify({'error': 'Failed to connect to AI service'}), 502
    
    if response.status_code == 401:
        return jsonify({'error': 'Invalid or expired token. Please log in again.'}), 401
    if response.status_code == 429:
        return jsonify({'error': 'Rate limit exceeded. Please wait a moment and try again.'}), 429
    if response.status_code >= 500:
        return jsonify({'error': 'AI service temporarily unavailable. Please try again later.'}), 502
    if response.status_code != 200:
        # Log detailed error info for debugging
        print(f"DEBUG: GitHub Models API error {response.status_code}")
        print(f"DEBUG: Response headers: {dict(response.headers)}")
        try:
            error_body = response.json()
            print(f"DEBUG: Response body: {error_body}")
            error_detail = error_body.get('error', {})
            if isinstance(error_detail, dict):
                error_msg = error_detail.get('message', str(error_detail))
            else:
                error_msg = str(error_detail)
        except:
            error_body = response.text
            error_msg = error_body[:200] if error_body else 'No response body'
            print(f"DEBUG: Response text: {error_body}")
        return jsonify({
            'error': f'AI service error: {response.status_code}',
            'detail': error_msg,
            'status_code': response.status_code
        }), 502
    
    try:
        response_data = response.json()
        assistant_message = response_data['choices'][0]['message']['content']
        recipes_data = extract_json_from_response(assistant_message)
        
        if not recipes_data or 'recipes' not in recipes_data:
            return jsonify({'error': 'Failed to parse recipe data from AI response'}), 500
        
        return jsonify({'recipes': recipes_data['recipes']})
        
    except (KeyError, IndexError, json.JSONDecodeError) as e:
        return jsonify({'error': 'Failed to process AI response'}), 500


# =============================================================================
# Main Entry Point
# =============================================================================

if __name__ == '__main__':
    if not config.GITHUB_CLIENT_ID:
        print("WARNING: GITHUB_CLIENT_ID environment variable not set!")
        print("Set it with: export GITHUB_CLIENT_ID=your_client_id")
    else:
        print(f"Using GitHub Client ID: {config.GITHUB_CLIENT_ID}")
        print(f"Client secret configured: {bool(config.GITHUB_CLIENT_SECRET)}")
    
    app.run(host='0.0.0.0', port=5000, debug=config.DEBUG)
