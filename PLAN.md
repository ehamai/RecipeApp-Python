# Recipe Generator App - Implementation Plan

A web application that generates AI-powered recipes using GitHub Models API, with GitHub OAuth PKCE authentication.

## Overview

- **Backend**: Python 3.14 + Flask
- **Frontend**: Vanilla HTML/CSS/JavaScript
- **AI**: GitHub Models REST API (`https://models.github.ai/inference/chat/completions`)
- **Auth**: GitHub OAuth Authorization Code + PKCE (no client secret)
- **Dependencies**: Minimal (`flask`, `requests`)

## Architecture

```
┌────────────────────────────┐     ┌──────────────────────────────────┐
│   Frontend (Static Files)  │     │   Backend (Flask / Python 3.14)  │
│                            │     │                                  │
│  ┌──────────────────────┐  │     │  ┌────────────────────────────┐  │
│  │   Login Screen       │  │     │  │  GET /                     │  │
│  │   - GitHub OAuth btn │──┼────▶│  │  Serves static/index.html  │  │
│  └──────────────────────┘  │     │  └────────────────────────────┘  │
│            │               │     │                                  │
│            ▼               │     │  ┌────────────────────────────┐  │
│  ┌──────────────────────┐  │     │  │  POST /api/oauth/token     │  │
│  │  OAuth PKCE Flow     │──┼────▶│  │  - Exchanges code+verifier │  │
│  │  - code_verifier     │  │     │  │  - Returns access_token    │  │
│  │  - code_challenge    │  │     │  └────────────────────────────┘  │
│  └──────────────────────┘  │     │                                  │
│            │               │     │  ┌────────────────────────────┐  │
│            ▼               │     │  │  POST /api/generate-recipes│  │
│  ┌──────────────────────┐  │     │  │  - Receives ingredients    │  │
│  │  Ingredient Picker   │──┼────▶│  │  - Calls GitHub Models API │  │
│  │  - Checkbox grid     │  │     │  │  - Returns 8 recipes       │  │
│  │  - Custom input      │  │     │  └────────────────────────────┘  │
│  └──────────────────────┘  │     │                                  │
│            │               │     │  ┌────────────────────────────┐  │
│            ▼               │     │  │  GitHub Models API         │  │
│  ┌──────────────────────┐  │     │  │  models.github.ai          │  │
│  │  Recipe Cards Grid   │  │     │  │  /inference/chat/completions│ │
│  │  - 8 clickable cards │  │     │  └────────────────────────────┘  │
│  │  - Modal detail view │  │     │                                  │
│  └──────────────────────┘  │     └──────────────────────────────────┘
└────────────────────────────┘
```

---

## Phase 1: Project Setup & Backend Foundation

### 1.1 Create Project Structure
- [ ] Create `requirements.txt` with `flask` and `requests`
- [ ] Create `app.py` with basic Flask app skeleton
- [ ] Create `static/` directory for frontend files
- [ ] Create `config.py` for configuration (client_id, etc.)

### 1.2 Implement Flask Server
- [ ] Set up Flask app with static file serving
- [ ] Configure CORS headers for API endpoints
- [ ] Add health check endpoint `GET /api/health`
- [ ] Set up environment variable loading for `GITHUB_CLIENT_ID`

### 1.3 Implement OAuth Token Exchange Proxy
- [ ] Create `POST /api/oauth/token` endpoint
- [ ] Accept `{ code, code_verifier, redirect_uri }` in request body
- [ ] POST to `https://github.com/login/oauth/access_token` with:
  - `client_id` (from config)
  - `code` (from request)
  - `code_verifier` (from request)
  - `redirect_uri` (from request)
- [ ] Parse response and return `{ access_token, token_type, scope }`
- [ ] Handle errors (invalid code, expired code, etc.)

**Deliverable**: Flask server that can exchange OAuth codes for tokens

---

## Phase 2: GitHub OAuth PKCE Frontend

### 2.1 Create Base HTML Structure
- [ ] Create `static/index.html` with:
  - Login view (initially visible)
  - Main app view (hidden until authenticated)
  - Recipe detail modal (hidden)
- [ ] Link CSS and JavaScript files
- [ ] Add meta viewport for mobile responsiveness

### 2.2 Implement PKCE Utilities (static/app.js)
- [ ] `generateCodeVerifier()` - Random 43-128 character string
- [ ] `generateCodeChallenge(verifier)` - SHA-256 hash, base64url encoded
- [ ] `base64UrlEncode(buffer)` - Convert ArrayBuffer to base64url string

### 2.3 Implement OAuth Flow
- [ ] `login()` function:
  - Generate and store `code_verifier` in `sessionStorage`
  - Generate `code_challenge`
  - Redirect to GitHub authorization URL with params:
    - `client_id`, `redirect_uri`, `scope=models:read`
    - `code_challenge`, `code_challenge_method=S256`
- [ ] `handleOAuthCallback()` function:
  - Check URL for `code` parameter
  - Retrieve `code_verifier` from `sessionStorage`
  - Call `/api/oauth/token` with code + verifier
  - Store `access_token` in `sessionStorage`
  - Clear URL parameters, show main app view
- [ ] `logout()` function:
  - Clear `sessionStorage`
  - Show login view

### 2.4 Session Management
- [ ] On page load, check for existing token in `sessionStorage`
- [ ] If token exists, show main app view
- [ ] If URL has `code` param, handle OAuth callback
- [ ] Otherwise, show login view

**Deliverable**: Working GitHub OAuth PKCE login flow

---

## Phase 3: Recipe Generation API

### 3.1 Implement Recipe Generation Endpoint
- [ ] Create `POST /api/generate-recipes` endpoint
- [ ] Accept `{ token, ingredients }` in request body
- [ ] Validate input (token required, at least 1 ingredient)

### 3.2 Craft AI Prompt
- [ ] Create system prompt defining chef persona
- [ ] Create user prompt template:
  ```
  Generate exactly 8 recipes using some or all of these ingredients: {ingredients}
  
  Return a JSON object with a "recipes" array. Each recipe must have:
  - name: string (creative recipe name)
  - description: string (2-3 sentences)
  - skillLevel: "Easy" | "Medium" | "Hard"
  - cookingTime: string (e.g., "30 minutes", "1 hour")
  - ingredients: array of strings with quantities
  - instructions: array of numbered step strings
  ```

### 3.3 Call GitHub Models API
- [ ] POST to `https://models.github.ai/inference/chat/completions`
- [ ] Headers: `Authorization: Bearer {token}`, `Content-Type: application/json`
- [ ] Body:
  ```json
  {
    "model": "openai/gpt-4.1",
    "messages": [system_message, user_message],
    "temperature": 0.7,
    "max_tokens": 4000
  }
  ```
- [ ] Parse response, extract JSON from assistant message
- [ ] Return parsed recipes array to frontend

### 3.4 Error Handling
- [ ] Handle 401 Unauthorized (token expired/invalid)
- [ ] Handle 429 Rate Limited
- [ ] Handle 5xx Server Errors
- [ ] Return structured error responses with user-friendly messages

**Deliverable**: Working recipe generation endpoint

---

## Phase 4: Ingredient Selection UI

### 4.1 Design Ingredient Grid
- [ ] Create checkbox grid with common ingredients:
  - Proteins: chicken, beef, pork, fish, eggs, tofu
  - Dairy: milk, cheese, butter, yogurt, cream
  - Grains: rice, pasta, bread, flour, oats
  - Vegetables: onions, garlic, tomatoes, potatoes, carrots, peppers
  - Pantry: olive oil, salt, pepper, sugar, vinegar, soy sauce
- [ ] Style as clickable card-like checkboxes

### 4.2 Implement Custom Ingredient Input
- [ ] Text input field with "Add" button
- [ ] Add custom ingredients to selected list
- [ ] Prevent duplicates

### 4.3 Selected Ingredients Display
- [ ] Show selected ingredients as removable tags/chips
- [ ] Click "×" to remove ingredient
- [ ] Update checkbox state when removing preset ingredient

### 4.4 Generate Button
- [ ] "Generate Recipes" button
- [ ] Disabled state when no ingredients selected
- [ ] Loading state during API call
- [ ] Ingredient count badge

**Deliverable**: Interactive ingredient selection interface

---

## Phase 5: Recipe Cards & Detail View

### 5.1 Recipe Card Component
- [ ] Card layout with:
  - Recipe name (heading)
  - Short description
  - Skill level badge (color-coded: green/yellow/red)
  - Cooking time with clock icon
- [ ] Hover effect (slight lift/shadow)
- [ ] Cursor pointer to indicate clickability

### 5.2 Recipe Grid Layout
- [ ] CSS Grid: 4 columns on desktop (>1200px)
- [ ] 3 columns on large tablet (900-1200px)
- [ ] 2 columns on tablet (600-900px)
- [ ] 1 column on mobile (<600px)
- [ ] Gap spacing between cards

### 5.3 Recipe Detail Modal
- [ ] Modal overlay with centered content
- [ ] Full recipe display:
  - Large title
  - Skill level + cooking time badges
  - Full description
  - Ingredients list (bulleted)
  - Instructions (numbered steps)
- [ ] Close button (×) and click-outside-to-close
- [ ] Keyboard escape to close

### 5.4 Loading & Empty States
- [ ] Skeleton loader cards during generation
- [ ] Empty state message: "Select ingredients and generate recipes"
- [ ] Animate cards appearing after generation

**Deliverable**: Beautiful recipe cards with detail modal

---

## Phase 6: Styling & Polish

### 6.1 Create CSS Foundation (static/style.css)
- [ ] CSS reset/normalize
- [ ] CSS custom properties (colors, spacing, fonts)
- [ ] Typography scale
- [ ] Container and layout utilities

### 6.2 Component Styles
- [ ] Login screen styling
- [ ] Ingredient checkbox grid
- [ ] Selected ingredients tags
- [ ] Generate button states
- [ ] Recipe card styles
- [ ] Modal styles
- [ ] Loading skeleton animations

### 6.3 Color Scheme & Branding
- [ ] Primary color (appetizing warm color)
- [ ] Skill level colors:
  - Easy: Green (#22c55e)
  - Medium: Amber (#f59e0b)
  - Hard: Red (#ef4444)
- [ ] Neutral grays for text and backgrounds
- [ ] Accessible contrast ratios

### 6.4 Responsive Design
- [ ] Mobile-first breakpoints
- [ ] Touch-friendly tap targets (44px minimum)
- [ ] Readable font sizes on all devices
- [ ] Modal scrolling on small screens

### 6.5 Micro-interactions
- [ ] Button hover/active states
- [ ] Card hover lift effect
- [ ] Smooth transitions (200-300ms)
- [ ] Loading spinner animation

**Deliverable**: Polished, responsive UI

---

## Phase 7: Error Handling & Edge Cases

### 7.1 Frontend Error Handling
- [ ] Toast notification component
- [ ] Display API errors to user
- [ ] Network error handling (offline state)
- [ ] Token expiration detection → redirect to login

### 7.2 Input Validation
- [ ] Maximum ingredients limit (20?)
- [ ] Custom ingredient length limit
- [ ] Sanitize ingredient text

### 7.3 Rate Limiting Feedback
- [ ] Detect 429 response
- [ ] Show "Please wait" message with retry timer
- [ ] Disable generate button during cooldown

### 7.4 Session Persistence
- [ ] Handle page refresh during OAuth flow
- [ ] Clear stale code_verifier after timeout
- [ ] Graceful handling of invalid stored tokens

**Deliverable**: Robust error handling

---

## Phase 8: Testing & Documentation

### 8.1 Manual Testing Checklist
- [ ] OAuth login flow (happy path)
- [ ] OAuth login flow (user denies)
- [ ] Ingredient selection (presets + custom)
- [ ] Recipe generation with various ingredient combos
- [ ] Recipe card display and modal
- [ ] Logout and re-login
- [ ] Mobile responsive testing
- [ ] Error states (invalid token, rate limit, network)

### 8.2 Documentation
- [ ] README.md with:
  - Project description
  - Prerequisites (Python 3.14, GitHub OAuth App)
  - Setup instructions
  - Environment variables
  - Running locally
  - Deployment notes
- [ ] Inline code comments for complex logic

### 8.3 GitHub OAuth App Setup Guide
- [ ] Instructions for creating OAuth App at github.com/settings/developers
- [ ] Required settings:
  - Homepage URL: `http://localhost:5000`
  - Callback URL: `http://localhost:5000`
  - Request `models:read` scope
- [ ] Note about production URLs

**Deliverable**: Tested, documented application

---

## File Structure

```
RecipeApp-Python/
├── app.py                 # Flask backend
├── config.py              # Configuration (client_id)
├── requirements.txt       # Python dependencies
├── README.md              # Documentation
├── PLAN.md                # This file
└── static/
    ├── index.html         # Single-page application
    ├── app.js             # Frontend JavaScript
    └── style.css          # Styles
```

---

## Prerequisites

Before starting development:

1. **Python 3.14** installed
2. **GitHub Account** with Copilot subscription (for `models:read` access)
3. **GitHub OAuth App** created at https://github.com/settings/developers
   - Set callback URL to `http://localhost:5000`
   - Note the Client ID (no secret needed for PKCE)

---

## Environment Variables

```bash
GITHUB_CLIENT_ID=your_oauth_app_client_id
FLASK_DEBUG=true  # For development
```

---

## API Reference

### POST /api/oauth/token
Exchange OAuth authorization code for access token.

**Request:**
```json
{
  "code": "abc123",
  "code_verifier": "random_43_to_128_char_string",
  "redirect_uri": "http://localhost:5000"
}
```

**Response:**
```json
{
  "access_token": "gho_xxxxxxxxxxxx",
  "token_type": "bearer",
  "scope": "models:read"
}
```

### POST /api/generate-recipes
Generate recipes from ingredients using AI.

**Request:**
```json
{
  "token": "gho_xxxxxxxxxxxx",
  "ingredients": ["eggs", "flour", "butter", "sugar"]
}
```

**Response:**
```json
{
  "recipes": [
    {
      "name": "Classic French Crepes",
      "description": "Light and delicate crepes perfect for breakfast or dessert.",
      "skillLevel": "Easy",
      "cookingTime": "20 minutes",
      "ingredients": ["2 eggs", "1 cup flour", "2 tbsp melted butter", "1 tbsp sugar", "1 cup milk"],
      "instructions": ["Whisk eggs and sugar together...", "Add flour gradually...", "..."]
    }
    // ... 7 more recipes
  ]
}
```

---

## Timeline Estimate

| Phase | Description | Estimated Time |
|-------|-------------|----------------|
| 1 | Project Setup & Backend Foundation | 30 min |
| 2 | GitHub OAuth PKCE Frontend | 45 min |
| 3 | Recipe Generation API | 30 min |
| 4 | Ingredient Selection UI | 30 min |
| 5 | Recipe Cards & Detail View | 45 min |
| 6 | Styling & Polish | 45 min |
| 7 | Error Handling & Edge Cases | 30 min |
| 8 | Testing & Documentation | 30 min |
| **Total** | | **~4.5 hours** |

---

## Next Steps

1. Register a GitHub OAuth App at https://github.com/settings/developers
2. Set environment variable: `export GITHUB_CLIENT_ID=your_client_id`
3. Begin Phase 1 implementation
