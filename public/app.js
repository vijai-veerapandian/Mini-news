// Global variables
let currentUser = null;
let authToken = null;

// API Base URL
const API_BASE = '/api';

// Initialize application
document.addEventListener('DOMContentLoaded', function () {
    checkAuthStatus();
    loadTrendingNews();
    detectLocation();

    // Add enter key listener for search
    document.getElementById('searchInput').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            searchNews();
        }
    });
});

// Authentication functions
async function checkAuthStatus() {
    const token = localStorage.getItem('authToken');
    if (token) {
        try {
            const response = await fetch(`${API_BASE}/auth/verify`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                currentUser = data.user;
                authToken = token;
                showAuthenticatedUI();
                loadPersonalizedNews();
            } else {
                localStorage.removeItem('authToken');
                showUnauthenticatedUI();
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            localStorage.removeItem('authToken');
            showUnauthenticatedUI();
        }
    } else {
        showUnauthenticatedUI();
    }
}

function showAuthenticatedUI() {
    document.getElementById('authButtons').style.display = 'none';
    document.getElementById('userMenu').classList.remove('hidden');
    document.getElementById('userName').textContent = `${currentUser.firstName} ${currentUser.lastName}`;
    document.getElementById('welcomeSection').style.display = 'none';
    document.getElementById('newsDashboard').classList.remove('hidden');

    const userWelcome = document.getElementById('userWelcome');
    const userLocation = document.getElementById('userLocation');

    userWelcome.textContent = `Welcome back, ${currentUser.firstName}!`;
    userLocation.textContent = `${currentUser.city || 'Unknown'}, ${currentUser.state || 'Unknown'} • ${currentUser.careerField || 'Professional'}`;
}

function showUnauthenticatedUI() {
    document.getElementById('authButtons').style.display = 'flex';
    document.getElementById('userMenu').classList.add('hidden');
    document.getElementById('welcomeSection').style.display = 'block';
    document.getElementById('newsDashboard').classList.add('hidden');
}

async function register(event) {
    event.preventDefault();

    const formData = {
        firstName: document.getElementById('firstName').value,
        lastName: document.getElementById('lastName').value,
        email: document.getElementById('email').value,
        password: document.getElementById('password').value,
        careerField: document.getElementById('careerField').value,
        city: document.getElementById('city').value,
        state: document.getElementById('state').value,
        country: document.getElementById('country').value
    };

    try {
        const response = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('authToken', data.token);
            currentUser = data.user;
            authToken = data.token;
            hideModal('registerModal');
            showAuthenticatedUI();
            loadPersonalizedNews();
            showToast('Registration successful!', 'success');
        } else {
            showToast(data.error || 'Registration failed', 'error');
        }
    } catch (error) {
        console.error('Registration error:', error);
        showToast('Registration failed. Please try again.', 'error');
    }
}

async function login(event) {
    event.preventDefault();

    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('authToken', data.token);
            currentUser = data.user;
            authToken = data.token;
            hideModal('loginModal');
            showAuthenticatedUI();
            loadPersonalizedNews();
            showToast('Login successful!', 'success');
        } else {
            showToast(data.error || 'Login failed', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showToast('Login failed. Please try again.', 'error');
    }
}

async function logout() {
    try {
        if (authToken) {
            await fetch(`${API_BASE}/auth/logout`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
        }
    } catch (error) {
        console.error('Logout error:', error);
    }

    localStorage.removeItem('authToken');
    currentUser = null;
    authToken = null;
    showUnauthenticatedUI();
    showToast('Logged out successfully', 'success');
}

// News functions
async function loadPersonalizedNews() {
    if (!authToken) return;

    try {
        const response = await fetch(`${API_BASE}/news/personalized`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            displayNews('localNews', data.news.local);
            displayNews('industryNews', data.news.industry);
            displayNews('globalNews', data.news.global);
        } else {
            console.error('Failed to load personalized news');
            showToast('Failed to load personalized news', 'error');
        }
    } catch (error) {
        console.error('Error loading personalized news:', error);
        showToast('Error loading news', 'error');
    }
}

async function loadTrendingNews() {
    try {
        const response = await fetch(`${API_BASE}/news/trending`);

        if (response.ok) {
            const data = await response.json();
            displayNews('trendingNews', data.articles);
        } else {
            console.error('Failed to load trending news');
        }
    } catch (error) {
        console.error('Error loading trending news:', error);
    }
}

async function searchNews() {
    const query = document.getElementById('searchInput').value.trim();

    if (!query) {
        showToast('Please enter a search term', 'warning');
        return;
    }

    if (!authToken) {
        showToast('Please login to search news', 'warning');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/news/search?q=${encodeURIComponent(query)}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            displaySearchResults(data.articles);
        } else {
            showToast('Search failed', 'error');
        }
    } catch (error) {
        console.error('Search error:', error);
        showToast('Search failed', 'error');
    }
}

function displayNews(containerId, articles) {
    const container = document.getElementById(containerId);

    if (!articles || articles.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center py-4">No news available</p>';
        return;
    }

    const isGrid = containerId === 'trendingNews';
    const maxArticles = isGrid ? 6 : 5;

    const newsHtml = articles.slice(0, maxArticles).map(article => `
        <div class="news-card card-hover p-4 ${isGrid ? '' : 'border-b border-gray-200 last:border-b-0'}">
            ${article.image_url && isGrid ? `
                <img src="${escapeHtml(article.image_url)}" alt="News image" class="w-full h-48 object-cover rounded-md mb-3">
            ` : ''}
            <h4 class="font-semibold text-gray-900 mb-2 ${isGrid ? 'text-lg' : 'text-sm'} line-clamp-2">
                <a href="${escapeHtml(article.url)}" target="_blank" rel="noopener noreferrer" class="hover:text-blue-600">
                    ${escapeHtml(article.title)}
                </a>
            </h4>
            ${article.description ? `
                <p class="text-gray-600 text-sm mb-2 line-clamp-2">${escapeHtml(article.description)}</p>
            ` : ''}
            <div class="flex items-center justify-between text-xs text-gray-500">
                <span>${escapeHtml(article.source_name)}</span>
                <span>${formatDate(article.published_at)}</span>
            </div>
        </div>
    `).join('');

    if (isGrid) {
        container.innerHTML = newsHtml;
    } else {
        container.innerHTML = newsHtml;
    }
}

function displaySearchResults(articles) {
    const container = document.getElementById('searchResults');

    if (!articles || articles.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center py-4">No search results found</p>';
        return;
    }

    const resultsHtml = `
        <h4 class="font-semibold text-gray-900 mb-4">Search Results (${articles.length})</h4>
        <div class="space-y-4">
            ${articles.slice(0, 10).map(article => `
                <div class="news-card card-hover p-4 border border-gray-200 rounded-lg">
                    <h5 class="font-semibold text-gray-900 mb-2">
                        <a href="${escapeHtml(article.url)}" target="_blank" rel="noopener noreferrer" class="hover:text-blue-600">
                            ${escapeHtml(article.title)}
                        </a>
                    </h5>
                    ${article.description ? `
                        <p class="text-gray-600 text-sm mb-2">${escapeHtml(article.description)}</p>
                    ` : ''}
                    <div class="flex items-center justify-between text-xs text-gray-500">
                        <span>${escapeHtml(article.source_name)}</span>
                        <span>Relevance: ${article.relevance_score}/10</span>
                        <span>${formatDate(article.published_at)}</span>
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    container.innerHTML = resultsHtml;
}

async function refreshNews() {
    if (authToken) {
        showToast('Refreshing your news...', 'info');
        await loadPersonalizedNews();
        showToast('News refreshed!', 'success');
    } else {
        await loadTrendingNews();
        showToast('Trending news refreshed!', 'success');
    }
}

// Location detection
async function detectLocation() {
    try {
        const response = await fetch('/api/location');
        if (response.ok) {
            const location = await response.json();

            // Pre-fill location in registration form if available
            if (location.city) {
                document.getElementById('city').value = location.city;
            }
            if (location.state) {
                document.getElementById('state').value = location.state;
            }
            if (location.country) {
                document.getElementById('country').value = location.country;
            }
        }
    } catch (error) {
        console.error('Location detection failed:', error);
    }
}

// UI Helper functions
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.add('active');

    // Clear form if it's a form modal
    const form = modal.querySelector('form');
    if (form) {
        form.reset();
    }
}

function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.remove('active');
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    const toastIcon = document.getElementById('toastIcon');

    // Set message
    toastMessage.textContent = message;

    // Set icon and colors based on type
    let iconHtml = '';
    let bgColor = '';

    switch (type) {
        case 'success':
            iconHtml = '<i class="fas fa-check-circle text-green-500"></i>';
            bgColor = 'bg-green-50 border-green-200';
            break;
        case 'error':
            iconHtml = '<i class="fas fa-exclamation-circle text-red-500"></i>';
            bgColor = 'bg-red-50 border-red-200';
            break;
        case 'warning':
            iconHtml = '<i class="fas fa-exclamation-triangle text-yellow-500"></i>';
            bgColor = 'bg-yellow-50 border-yellow-200';
            break;
        default: // info
            iconHtml = '<i class="fas fa-info-circle text-blue-500"></i>';
            bgColor = 'bg-blue-50 border-blue-200';
    }

    toastIcon.innerHTML = iconHtml;
    toast.className = `toast ${bgColor} border rounded-lg shadow-lg p-4 max-w-sm`;

    // Show toast
    toast.classList.add('show');

    // Hide after 4 seconds
    setTimeout(() => {
        toast.classList.remove('show');
    }, 4000);
}

// Utility functions
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    if (!dateString) return '';

    try {
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffHours < 1) {
            return 'Just now';
        } else if (diffHours < 24) {
            return `${diffHours}h ago`;
        } else if (diffDays === 1) {
            return 'Yesterday';
        } else if (diffDays < 7) {
            return `${diffDays} days ago`;
        } else {
            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
            });
        }
    } catch (error) {
        return '';
    }
}

// Close modals when clicking outside
document.addEventListener('click', function (event) {
    if (event.target.classList.contains('modal')) {
        const modalId = event.target.id;
        hideModal(modalId);
    }
});

// Handle escape key to close modals
document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
        const activeModal = document.querySelector('.modal.active');
        if (activeModal) {
            hideModal(activeModal.id);
        }
    }
});

// Add loading states for buttons
function setButtonLoading(buttonElement, loading = true) {
    if (loading) {
        buttonElement.disabled = true;
        buttonElement.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Loading...';
    } else {
        buttonElement.disabled = false;
        buttonElement.innerHTML = buttonElement.getAttribute('data-original-text') || 'Submit';
    }
}

// Enhanced form submission with loading states
const originalRegister = register;
const originalLogin = login;

register = async function (event) {
    const button = event.target.querySelector('button[type="submit"]');
    button.setAttribute('data-original-text', button.innerHTML);
    setButtonLoading(button, true);

    try {
        await originalRegister(event);
    } finally {
        setButtonLoading(button, false);
    }
};

login = async function (event) {
    const button = event.target.querySelector('button[type="submit"]');
    button.setAttribute('data-original-text', button.innerHTML);
    setButtonLoading(button, true);

    try {
        await originalLogin(event);
    } finally {
        setButtonLoading(button, false);
    }
};

// Service worker registration for PWA capabilities (optional)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
        navigator.serviceWorker.register('/sw.js').then(function (registration) {
            console.log('ServiceWorker registration successful');
        }, function (err) {
            console.log('ServiceWorker registration failed');
        });
    });
}

// Error boundary for uncaught errors
window.addEventListener('error', function (event) {
    console.error('Uncaught error:', event.error);
    showToast('An unexpected error occurred', 'error');
});

window.addEventListener('unhandledrejection', function (event) {
    console.error('Unhandled promise rejection:', event.reason);
    showToast('A network error occurred', 'error');
    event.preventDefault();
});

// Auto-refresh news every 30 minutes for authenticated users
setInterval(() => {
    if (authToken && currentUser) {
        console.log('Auto-refreshing news...');
        loadPersonalizedNews();
    }
}, 30 * 60 * 1000); // 30 minutes

// Network status monitoring
window.addEventListener('online', function () {
    showToast('Back online! Refreshing news...', 'success');
    if (authToken) {
        loadPersonalizedNews();
    } else {
        loadTrendingNews();
    }
});

window.addEventListener('offline', function () {
    showToast('You are offline. Some features may not work.', 'warning');
});