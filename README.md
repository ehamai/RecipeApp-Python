# Recipe Generator

An AI-powered web application that generates recipes based on ingredients you have available. Built with Python Flask backend and vanilla HTML/CSS/JavaScript frontend, using GitHub Models API for AI-powered recipe generation.

## Features

- **GitHub OAuth PKCE Authentication** - Secure login without client secrets
- **Ingredient Selection** - Choose from preset ingredients or add custom ones
- **AI Recipe Generation** - Get 8 creative recipes based on your ingredients
- **Responsive Design** - Works on desktop, tablet, and mobile devices
- **Beautiful UI** - Modern card-based interface with smooth animations

## Prerequisites

Before running this application, you need:

1. **Python 3.10+** installed on your system
2. **GitHub Account** with [Copilot subscription](https://github.com/features/copilot) (required for `models:read` access)
3. **GitHub OAuth App** (see setup instructions below)

## GitHub OAuth App Setup

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Fill in the application details:
   - **Application name**: Recipe Generator (or any name)
   - **Homepage URL**: `http://localhost:5000`
   - **Authorization callback URL**: `http://localhost:5000`
4. Click "Register application"
5. Copy the **Client ID** (you won't need the client secret for PKCE flow)

## Installation

1. **Clone or create the project directory**:
   ```bash
   cd RecipeApp-Python
   ```

2. **Create a virtual environment** (recommended):
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Set environment variables**:
   ```bash
   # Required: Your GitHub OAuth App Client ID
   export GITHUB_CLIENT_ID=your_client_id_here
   
   # Optional: Enable debug mode
   export FLASK_DEBUG=true
   ```

   On Windows (PowerShell):
   ```powershell
   $env:GITHUB_CLIENT_ID = "your_client_id_here"
   $env:FLASK_DEBUG = "true"
   ```

5. **Update the frontend config** (optional alternative to env var):
   
   Edit `static/app.js` and set the `GITHUB_CLIENT_ID` directly:
   ```javascript
   const CONFIG = {
       GITHUB_CLIENT_ID: 'your_client_id_here',
       // ...
   };
   ```

## Running the Application

1. **Start the Flask server**:
   ```bash
   python app.py
   ```

2. **Open your browser** and navigate to:
   ```
   http://localhost:5000
   ```

3. **Sign in with GitHub** and start generating recipes!

## Usage

1. **Login**: Click "Sign in with GitHub" to authenticate
2. **Select Ingredients**: 
   - Check preset ingredients from categories (Proteins, Dairy, Grains, etc.)
   - Or add custom ingredients using the text input
3. **Generate Recipes**: Click "Generate Recipes" to get 8 AI-generated recipes
4. **View Details**: Click any recipe card to see full ingredients and instructions

## Project Structure

```
RecipeApp-Python/
├── app.py                 # Flask backend server
├── config.py              # Configuration settings
├── requirements.txt       # Python dependencies
├── README.md              # This file
├── PLAN.md                # Implementation plan
└── static/
    ├── index.html         # Main HTML page
    ├── app.js             # Frontend JavaScript
    └── style.css          # Styles
```

## API Endpoints

### `GET /api/health`
Health check endpoint.

### `POST /api/oauth/token`
Exchange OAuth authorization code for access token.

**Request Body**:
```json
{
  "code": "authorization_code",
  "code_verifier": "pkce_code_verifier",
  "redirect_uri": "http://localhost:5000"
}
```

**Response**:
```json
{
  "access_token": "gho_xxxx",
  "token_type": "bearer",
  "scope": "models:read"
}
```

### `POST /api/generate-recipes`
Generate recipes using AI.

**Request Body**:
```json
{
  "token": "github_access_token",
  "ingredients": ["eggs", "flour", "butter"]
}
```

**Response**:
```json
{
  "recipes": [
    {
      "name": "Classic French Crepes",
      "description": "Light and delicate crepes...",
      "skillLevel": "Easy",
      "cookingTime": "20 minutes",
      "ingredients": ["2 eggs", "1 cup flour", ...],
      "instructions": ["Step 1...", "Step 2...", ...]
    }
  ]
}
```

## Deployment Notes

For production deployment:

1. **Update OAuth App URLs**: Change Homepage and Callback URLs to your production domain
2. **Update Frontend Config**: Set the correct `GITHUB_CLIENT_ID` 
3. **Disable Debug Mode**: Ensure `FLASK_DEBUG` is not set to `true`
4. **Use a Production WSGI Server**: Consider using Gunicorn or uWSGI:
   ```bash
   pip install gunicorn
   gunicorn -w 4 -b 0.0.0.0:5000 app:app
   ```

## Troubleshooting

### "GITHUB_CLIENT_ID not set" warning
Make sure you've set the `GITHUB_CLIENT_ID` environment variable before starting the server.

### "Invalid or expired token" error
Your GitHub token may have expired. Click "Logout" and sign in again.

### "Rate limit exceeded" error
GitHub Models API has rate limits. Wait a few minutes before generating more recipes.

### OAuth callback error
Ensure your OAuth App's callback URL matches exactly: `http://localhost:5000` (with no trailing slash)

## License

MIT License - Feel free to use this code for your own projects!
