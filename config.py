"""
Configuration for the Recipe Generator App.

Set the GITHUB_CLIENT_ID in a .env file or as an environment variable.
"""

import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# GitHub OAuth App credentials (from https://github.com/settings/developers)
GITHUB_CLIENT_ID = os.environ.get('GITHUB_CLIENT_ID', 'Iv23ligq7stN7RSrPkrT')
GITHUB_CLIENT_SECRET = os.environ.get('GITHUB_CLIENT_SECRET', '')

# GitHub OAuth endpoints
GITHUB_OAUTH_TOKEN_URL = 'https://github.com/login/oauth/access_token'

# GitHub Models API endpoint
GITHUB_MODELS_API_URL = 'https://api.githubcopilot.com/chat/completions'

# Flask configuration
DEBUG = os.environ.get('FLASK_DEBUG', 'false').lower() == 'true'
