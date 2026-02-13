/**
 * Recipe Generator App - Frontend JavaScript
 * 
 * Handles GitHub OAuth Device Flow authentication, ingredient selection,
 * recipe generation, and UI interactions.
 */

// =============================================================================
// Configuration
// =============================================================================

const CONFIG = {
    // API endpoints
    API_DEVICE_CODE_ENDPOINT: '/api/oauth/device',
    API_DEVICE_TOKEN_ENDPOINT: '/api/oauth/device/token',
    API_GENERATE_ENDPOINT: '/api/generate-recipes',
    
    // GitHub verification URL
    GITHUB_DEVICE_URL: 'https://github.com/login/device',
    
    // Storage keys
    STORAGE_ACCESS_TOKEN: 'github_access_token',
    STORAGE_DEVICE_CODE: 'oauth_device_code',
    
    // Limits
    MAX_INGREDIENTS: 20
};

// =============================================================================
// State
// =============================================================================

let selectedIngredients = new Set();
let currentRecipes = [];
let isGenerating = false;
let deviceFlowPollInterval = null;

// =============================================================================
// OAuth Device Flow
// =============================================================================

/**
 * Initiate GitHub OAuth login with Device Flow
 */
async function login() {
    const loginBtn = document.getElementById('login-btn');
    loginBtn.disabled = true;
    loginBtn.innerHTML = `
        <span class="spinner"></span>
        Getting code...
    `;
    
    try {
        // Request device code from backend
        const response = await fetch(CONFIG.API_DEVICE_CODE_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to get device code');
        }
        
        // Store device code for polling
        sessionStorage.setItem(CONFIG.STORAGE_DEVICE_CODE, data.device_code);
        
        // Copy user code to clipboard
        await navigator.clipboard.writeText(data.user_code);
        
        // Show the device flow UI
        showDeviceFlowUI(data.user_code, data.expires_in);
        
        // Open GitHub device page in new tab
        window.open(CONFIG.GITHUB_DEVICE_URL, '_blank');
        
        // Start polling for token
        startDeviceFlowPolling(data.device_code, data.interval || 5);
        
    } catch (error) {
        console.error('Device flow error:', error);
        showToast(error.message, 'error');
        resetLoginButton();
    }
}

/**
 * Show the device flow UI with the user code
 */
function showDeviceFlowUI(userCode, expiresIn) {
    const loginCard = document.querySelector('.login-card');
    loginCard.innerHTML = `
        <div class="logo">
            <span class="logo-icon">🍳</span>
            <h1>Recipe Generator</h1>
        </div>
        <div class="device-flow-ui">
            <p class="device-instruction">Enter this code on GitHub:</p>
            <div class="user-code" onclick="copyCode('${userCode}')">${userCode}</div>
            <p class="code-copied-hint">Code copied to clipboard!</p>
            <p class="device-status">
                <span class="spinner"></span>
                Waiting for authorization...
            </p>
            <p class="device-hint">A new tab should have opened. If not, <a href="${CONFIG.GITHUB_DEVICE_URL}" target="_blank">click here</a>.</p>
            <button class="btn btn-outline" onclick="cancelDeviceFlow()">Cancel</button>
        </div>
    `;
}

/**
 * Copy code to clipboard and show feedback
 */
async function copyCode(code) {
    await navigator.clipboard.writeText(code);
    showToast('Code copied to clipboard!', 'success');
}

/**
 * Start polling for device flow token
 */
function startDeviceFlowPolling(deviceCode, interval) {
    // Clear any existing polling
    if (deviceFlowPollInterval) {
        clearInterval(deviceFlowPollInterval);
    }
    
    let pollInterval = interval * 1000; // Convert to milliseconds
    
    const poll = async () => {
        try {
            const response = await fetch(CONFIG.API_DEVICE_TOKEN_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ device_code: deviceCode })
            });
            
            const data = await response.json();
            
            if (data.status === 'complete') {
                // Success! Store token and show app
                clearInterval(deviceFlowPollInterval);
                sessionStorage.setItem(CONFIG.STORAGE_ACCESS_TOKEN, data.access_token);
                sessionStorage.removeItem(CONFIG.STORAGE_DEVICE_CODE);
                showAppView();
                resetLoginCard();
                showToast('Successfully logged in!', 'success');
                return;
            }
            
            if (data.status === 'pending') {
                // Still waiting, adjust interval if slow_down
                if (data.error === 'slow_down' && data.interval) {
                    clearInterval(deviceFlowPollInterval);
                    pollInterval = data.interval * 1000;
                    deviceFlowPollInterval = setInterval(poll, pollInterval);
                }
                return;
            }
            
            if (data.status === 'error') {
                throw new Error(data.error);
            }
            
        } catch (error) {
            console.error('Polling error:', error);
            clearInterval(deviceFlowPollInterval);
            showToast(error.message, 'error');
            cancelDeviceFlow();
        }
    };
    
    // Start polling
    deviceFlowPollInterval = setInterval(poll, pollInterval);
    
    // Also poll immediately
    poll();
}

/**
 * Cancel device flow and reset UI
 */
function cancelDeviceFlow() {
    if (deviceFlowPollInterval) {
        clearInterval(deviceFlowPollInterval);
        deviceFlowPollInterval = null;
    }
    sessionStorage.removeItem(CONFIG.STORAGE_DEVICE_CODE);
    resetLoginCard();
}

/**
 * Reset login button to original state
 */
function resetLoginButton() {
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) {
        loginBtn.disabled = false;
        loginBtn.innerHTML = `
            <svg class="github-icon" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
            Sign in with GitHub
        `;
    }
}

/**
 * Reset login card to original state
 */
function resetLoginCard() {
    const loginCard = document.querySelector('.login-card');
    if (loginCard) {
        loginCard.innerHTML = `
            <div class="logo">
                <span class="logo-icon">🍳</span>
                <h1>Recipe Generator</h1>
            </div>
            <p class="tagline">AI-powered recipes from your ingredients</p>
            <button id="login-btn" class="btn btn-primary btn-large" onclick="login()">
                <svg class="github-icon" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                Sign in with GitHub
            </button>
            <p class="login-note">Requires GitHub Copilot subscription for AI access</p>
        `;
    }
}

/**
 * Logout and clear session
 */
function logout() {
    // Stop any pending device flow polling
    if (deviceFlowPollInterval) {
        clearInterval(deviceFlowPollInterval);
        deviceFlowPollInterval = null;
    }
    sessionStorage.removeItem(CONFIG.STORAGE_ACCESS_TOKEN);
    sessionStorage.removeItem(CONFIG.STORAGE_DEVICE_CODE);
    selectedIngredients.clear();
    currentRecipes = [];
    showLoginView();
    resetLoginCard();
    showToast('Logged out successfully', 'success');
}

/**
 * Get stored access token
 */
function getAccessToken() {
    return sessionStorage.getItem(CONFIG.STORAGE_ACCESS_TOKEN);
}

// =============================================================================
// View Management
// =============================================================================

function showLoginView() {
    document.getElementById('login-view').classList.remove('hidden');
    document.getElementById('app-view').classList.add('hidden');
}

function showAppView() {
    document.getElementById('login-view').classList.add('hidden');
    document.getElementById('app-view').classList.remove('hidden');
    updateSelectedIngredientsDisplay();
    updateGenerateButton();
}

// =============================================================================
// Ingredient Management
// =============================================================================

/**
 * Toggle ingredient selection from checkbox
 */
function toggleIngredient(ingredient, isChecked) {
    if (isChecked) {
        if (selectedIngredients.size >= CONFIG.MAX_INGREDIENTS) {
            showToast(`Maximum ${CONFIG.MAX_INGREDIENTS} ingredients allowed`, 'warning');
            return false;
        }
        selectedIngredients.add(ingredient.toLowerCase());
    } else {
        selectedIngredients.delete(ingredient.toLowerCase());
    }
    
    updateSelectedIngredientsDisplay();
    updateGenerateButton();
    return true;
}

/**
 * Add custom ingredient
 */
function addCustomIngredient() {
    const input = document.getElementById('custom-ingredient-input');
    const ingredient = input.value.trim().toLowerCase();
    
    if (!ingredient) {
        return;
    }
    
    if (ingredient.length > 50) {
        showToast('Ingredient name too long (max 50 characters)', 'warning');
        return;
    }
    
    if (selectedIngredients.has(ingredient)) {
        showToast('Ingredient already selected', 'warning');
        input.value = '';
        return;
    }
    
    if (selectedIngredients.size >= CONFIG.MAX_INGREDIENTS) {
        showToast(`Maximum ${CONFIG.MAX_INGREDIENTS} ingredients allowed`, 'warning');
        return;
    }
    
    selectedIngredients.add(ingredient);
    input.value = '';
    
    updateSelectedIngredientsDisplay();
    updateGenerateButton();
}

/**
 * Remove ingredient from selection
 */
function removeIngredient(ingredient) {
    selectedIngredients.delete(ingredient);
    
    // Uncheck checkbox if exists
    const checkbox = document.querySelector(`input[type="checkbox"][value="${ingredient}"]`);
    if (checkbox) {
        checkbox.checked = false;
    }
    
    updateSelectedIngredientsDisplay();
    updateGenerateButton();
}

/**
 * Update the selected ingredients display
 */
function updateSelectedIngredientsDisplay() {
    const container = document.getElementById('selected-tags');
    const count = document.getElementById('ingredient-count');
    
    count.textContent = `(${selectedIngredients.size})`;
    
    if (selectedIngredients.size === 0) {
        container.innerHTML = '<p class="empty-selection">No ingredients selected yet</p>';
        return;
    }
    
    container.innerHTML = Array.from(selectedIngredients)
        .map(ing => `
            <span class="ingredient-tag">
                ${escapeHtml(ing)}
                <button class="tag-remove" onclick="removeIngredient('${escapeHtml(ing)}')" aria-label="Remove ${escapeHtml(ing)}">×</button>
            </span>
        `)
        .join('');
}

/**
 * Update generate button state
 */
function updateGenerateButton() {
    const btn = document.getElementById('generate-btn');
    btn.disabled = selectedIngredients.size === 0 || isGenerating;
}

// =============================================================================
// Recipe Generation
// =============================================================================

/**
 * Generate recipes from selected ingredients
 */
async function generateRecipes() {
    if (selectedIngredients.size === 0) {
        showToast('Please select at least one ingredient', 'warning');
        return;
    }
    
    const token = getAccessToken();
    if (!token) {
        showToast('Session expired. Please log in again.', 'error');
        logout();
        return;
    }
    
    isGenerating = true;
    updateGenerateButton();
    showLoadingState();
    
    try {
        const response = await fetch(CONFIG.API_GENERATE_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                token: token,
                ingredients: Array.from(selectedIngredients)
            })
        });
        
        const data = await response.json();
        
        if (response.status === 401) {
            showToast('Session expired. Please log in again.', 'error');
            logout();
            return;
        }
        
        if (response.status === 429) {
            showToast('Rate limit exceeded. Please wait a moment and try again.', 'warning');
            showEmptyRecipes();
            return;
        }
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to generate recipes');
        }
        
        currentRecipes = data.recipes;
        displayRecipes(currentRecipes);
        showToast(`Generated ${currentRecipes.length} recipes!`, 'success');
        
    } catch (error) {
        console.error('Generate recipes error:', error);
        showToast(error.message, 'error');
        showEmptyRecipes();
    } finally {
        isGenerating = false;
        updateGenerateButton();
    }
}

/**
 * Show loading skeleton cards
 */
function showLoadingState() {
    const container = document.getElementById('recipes-container');
    const skeletons = Array(8).fill(0).map(() => `
        <div class="skeleton-card">
            <div class="skeleton skeleton-title"></div>
            <div class="skeleton skeleton-text"></div>
            <div class="skeleton skeleton-text"></div>
            <div class="skeleton skeleton-text"></div>
            <div class="skeleton-badges">
                <div class="skeleton skeleton-badge"></div>
                <div class="skeleton skeleton-badge"></div>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = skeletons;
}

/**
 * Show empty recipes state
 */
function showEmptyRecipes() {
    const container = document.getElementById('recipes-container');
    container.innerHTML = `
        <div class="empty-recipes">
            <span class="empty-icon">📖</span>
            <p>Select ingredients and generate recipes to see them here</p>
        </div>
    `;
}

/**
 * Display recipe cards
 */
function displayRecipes(recipes) {
    const container = document.getElementById('recipes-container');
    
    if (!recipes || recipes.length === 0) {
        showEmptyRecipes();
        return;
    }
    
    container.innerHTML = recipes.map((recipe, index) => `
        <div class="recipe-card" onclick="openRecipeModal(${index})">
            <h3>${escapeHtml(recipe.name)}</h3>
            <p>${escapeHtml(recipe.description)}</p>
            <div class="recipe-meta">
                <span class="badge badge-${getSkillLevelClass(recipe.skillLevel)}">${escapeHtml(recipe.skillLevel)}</span>
                <span class="badge badge-time">⏱️ ${escapeHtml(recipe.cookingTime)}</span>
            </div>
        </div>
    `).join('');
}

/**
 * Get CSS class for skill level
 */
function getSkillLevelClass(level) {
    const levelLower = (level || '').toLowerCase();
    if (levelLower === 'easy') return 'easy';
    if (levelLower === 'medium') return 'medium';
    if (levelLower === 'hard') return 'hard';
    return 'medium';
}

// =============================================================================
// Recipe Modal
// =============================================================================

/**
 * Open recipe detail modal
 */
function openRecipeModal(index) {
    const recipe = currentRecipes[index];
    if (!recipe) return;
    
    const modalBody = document.getElementById('modal-body');
    modalBody.innerHTML = `
        <h2 class="modal-recipe-title">${escapeHtml(recipe.name)}</h2>
        <div class="modal-meta">
            <span class="badge badge-${getSkillLevelClass(recipe.skillLevel)}">${escapeHtml(recipe.skillLevel)}</span>
            <span class="badge badge-time">⏱️ ${escapeHtml(recipe.cookingTime)}</span>
        </div>
        <p class="modal-description">${escapeHtml(recipe.description)}</p>
        
        <div class="modal-section">
            <h4>Ingredients</h4>
            <ul>
                ${(recipe.ingredients || []).map(ing => `<li>${escapeHtml(ing)}</li>`).join('')}
            </ul>
        </div>
        
        <div class="modal-section">
            <h4>Instructions</h4>
            <ol>
                ${(recipe.instructions || []).map(step => `<li>${escapeHtml(step)}</li>`).join('')}
            </ol>
        </div>
    `;
    
    document.getElementById('recipe-modal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

/**
 * Close recipe modal
 */
function closeModal() {
    document.getElementById('recipe-modal').classList.add('hidden');
    document.body.style.overflow = '';
}

// =============================================================================
// Toast Notifications
// =============================================================================

/**
 * Show toast notification
 */
function showToast(message, type = 'error') {
    const container = document.getElementById('toast-container');
    
    const icons = {
        error: '❌',
        success: '✅',
        warning: '⚠️'
    };
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || icons.error}</span>
        <span class="toast-message">${escapeHtml(message)}</span>
    `;
    
    container.appendChild(toast);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        toast.classList.add('hiding');
        setTimeout(() => toast.remove(), 200);
    }, 5000);
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// =============================================================================
// Event Listeners & Initialization
// =============================================================================

/**
 * Initialize the application
 */
function init() {
    // Set up ingredient checkbox listeners
    document.querySelectorAll('.ingredient-checkbox input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const success = toggleIngredient(e.target.value, e.target.checked);
            if (!success) {
                e.target.checked = false;
            }
        });
    });
    
    // Custom ingredient input enter key
    document.getElementById('custom-ingredient-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addCustomIngredient();
        }
    });
    
    // Modal keyboard close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
        }
    });
    
    // Check for existing session
    const token = getAccessToken();
    if (token) {
        showAppView();
    } else {
        showLoginView();
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    init();
});
