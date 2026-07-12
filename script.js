// script.js
// Frontend logic: authentication, post rendering, and comment handling.

const API_BASE = '/api';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let currentUser = null; // { id, name, email }
let authToken = null;
let currentPosts = []; // cache of posts currently rendered
const searchInput = document.getElementById('searchInput');

// ---------------------------------------------------------------------------
// DOM references
// ---------------------------------------------------------------------------
const guestActions = document.getElementById('guestActions');
const userActions = document.getElementById('userActions');
const navUserName = document.getElementById('navUserName');

const modalBackdrop = document.getElementById('modalBackdrop');
const loginModal = document.getElementById('loginModal');
const registerModal = document.getElementById('registerModal');

const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const postForm = document.getElementById('postForm');

const composerSection = document.getElementById('composerSection');
const guestPrompt = document.getElementById('guestPrompt');

const postsList = document.getElementById('postsList');
const emptyState = document.getElementById('emptyState');
const postTemplate = document.getElementById('postTemplate');
const commentTemplate = document.getElementById('commentTemplate');

const toast = document.getElementById('toast');

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  restoreSession();
  updateAuthUI();
  loadPosts();
  bindGlobalEvents();

  searchInput.addEventListener('input', () => {

    const keyword = searchInput.value.toLowerCase();

    const filteredPosts = currentPosts.filter(post =>
      post.title.toLowerCase().includes(keyword) ||
      post.content.toLowerCase().includes(keyword)
    );

    renderPosts(filteredPosts);
  });

});

// ---------------------------------------------------------------------------
// Session helpers
// ---------------------------------------------------------------------------
function restoreSession() {
  const savedToken = localStorage.getItem('inkwell_token');
  const savedUser = localStorage.getItem('inkwell_user');
  if (savedToken && savedUser) {
    authToken = savedToken;
    currentUser = JSON.parse(savedUser);
  }
}

function saveSession(token, user) {
  authToken = token;
  currentUser = user;
  localStorage.setItem('inkwell_token', token);
  localStorage.setItem('inkwell_user', JSON.stringify(user));
}

function clearSession() {
  authToken = null;
  currentUser = null;
  localStorage.removeItem('inkwell_token');
  localStorage.removeItem('inkwell_user');
}

function updateAuthUI() {
  const loggedIn = Boolean(authToken && currentUser);
  guestActions.classList.toggle('hidden', loggedIn);
  userActions.classList.toggle('hidden', !loggedIn);
  composerSection.classList.toggle('hidden', !loggedIn);
  guestPrompt.classList.toggle('hidden', loggedIn);
  if (loggedIn) navUserName.textContent = currentUser.name;
  renderPosts(currentPosts); // re-render to show/hide owner actions & comment forms
}

// ---------------------------------------------------------------------------
// Toast messages
// ---------------------------------------------------------------------------
function showToast(message, isError = false) {
  toast.textContent = message;
  toast.classList.toggle('error', isError);
  toast.classList.remove('hidden');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => toast.classList.add('hidden'), 3200);
}

// ---------------------------------------------------------------------------
// API helper
// ---------------------------------------------------------------------------
async function apiRequest(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || 'Something went wrong. Please try again.');
  }
  return data;
}

// ---------------------------------------------------------------------------
// Modal handling
// ---------------------------------------------------------------------------
function openModal(which) {
  modalBackdrop.classList.remove('hidden');
  loginModal.classList.toggle('hidden', which !== 'login');
  registerModal.classList.toggle('hidden', which !== 'register');
}
function closeModal() {
  modalBackdrop.classList.add('hidden');
  loginForm.reset();
  registerForm.reset();
}

// ---------------------------------------------------------------------------
// Global event bindings
// ---------------------------------------------------------------------------
function bindGlobalEvents() {
  document.getElementById('openLoginBtn').addEventListener('click', () => openModal('login'));
  document.getElementById('openRegisterBtn').addEventListener('click', () => openModal('register'));
  document.getElementById('promptLoginBtn').addEventListener('click', () => openModal('login'));
  document.getElementById('promptRegisterBtn').addEventListener('click', () => openModal('register'));
  document.getElementById('switchToRegister').addEventListener('click', () => openModal('register'));
  document.getElementById('switchToLogin').addEventListener('click', () => openModal('login'));

  document.querySelectorAll('[data-close-modal]').forEach((btn) =>
    btn.addEventListener('click', closeModal)
  );
  modalBackdrop.addEventListener('click', (e) => {
    if (e.target === modalBackdrop) closeModal();
  });

  document.getElementById('logoutBtn').addEventListener('click', handleLogout);

  loginForm.addEventListener('submit', handleLogin);
  registerForm.addEventListener('submit', handleRegister);
  postForm.addEventListener('submit', handleCreatePost);
}

// ---------------------------------------------------------------------------
// Auth handlers
// ---------------------------------------------------------------------------
async function handleLogin(e) {
  e.preventDefault();
  const formData = new FormData(loginForm);
  const payload = Object.fromEntries(formData.entries());

  try {
    const data = await apiRequest('/auth/login', { method: 'POST', body: JSON.stringify(payload) });
    saveSession(data.token, data.user);
    closeModal();
    updateAuthUI();
    showToast(data.message);
  } catch (err) {
    showToast(err.message, true);
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const formData = new FormData(registerForm);
  const payload = Object.fromEntries(formData.entries());

  try {
    const data = await apiRequest('/auth/register', { method: 'POST', body: JSON.stringify(payload) });
    saveSession(data.token, data.user);
    closeModal();
    updateAuthUI();
    showToast(data.message);
  } catch (err) {
    showToast(err.message, true);
  }
}

async function handleLogout() {
  try {
    await apiRequest('/auth/logout', { method: 'POST' });
  } catch (err) {
    // Non-fatal: logout locally even if the request fails
  }
  clearSession();
  updateAuthUI();
  showToast('Logged out successfully.');
}

// ---------------------------------------------------------------------------
// Post handlers
// ---------------------------------------------------------------------------
async function loadPosts() {
  try {
    const data = await apiRequest('/posts');
    currentPosts = data.posts || [];
    renderPosts(currentPosts);
  } catch (err) {
    showToast(err.message, true);
  }
}

async function handleCreatePost(e) {
  e.preventDefault();
  const formData = new FormData(postForm);
  const payload = Object.fromEntries(formData.entries());

  try {
    const data = await apiRequest('/posts', { method: 'POST', body: JSON.stringify(payload) });
    currentPosts.unshift(data.post);
    renderPosts(currentPosts);
    postForm.reset();
    showToast(data.message);
  } catch (err) {
    showToast(err.message, true);
  }
}

async function handleUpdatePost(postId, title, content) {
  try {
    const data = await apiRequest(`/posts/${postId}`, {
      method: 'PUT',
      body: JSON.stringify({ title, content })
    });
    const idx = currentPosts.findIndex((p) => p._id === postId);
    if (idx !== -1) currentPosts[idx] = data.post;
    renderPosts(currentPosts);
    showToast(data.message);
  } catch (err) {
    showToast(err.message, true);
  }
}

async function handleDeletePost(postId) {
  if (!confirm('Delete this post? This cannot be undone.')) return;
  try {
    const data = await apiRequest(`/posts/${postId}`, { method: 'DELETE' });
    currentPosts = currentPosts.filter((p) => p._id !== postId);
    renderPosts(currentPosts);
    showToast(data.message);
  } catch (err) {
    showToast(err.message, true);
  }
}

// ---------------------------------------------------------------------------
// Comment handlers
// ---------------------------------------------------------------------------
async function loadComments(postId, listEl, countEl) {
  try {
    const data = await apiRequest(`/posts/${postId}/comments`);
    renderComments(data.comments || [], listEl);
    countEl.textContent = (data.comments || []).length;
  } catch (err) {
    showToast(err.message, true);
  }
}

async function handleAddComment(postId, text, form, listEl, countEl) {
  try {
    const data = await apiRequest(`/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ text })
    });
    form.reset();
    await loadComments(postId, listEl, countEl);
    showToast(data.message);
  } catch (err) {
    showToast(err.message, true);
  }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function initials(name) {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function renderPosts(posts) {
  postsList.innerHTML = '';
  emptyState.classList.toggle('hidden', posts.length > 0);

  posts.forEach((post) => {
    const node = postTemplate.content.cloneNode(true);
    const article = node.querySelector('.post-card');
    const likeBtn = node.querySelector('.like-btn');
const likeCount = node.querySelector('.like-count');

likeCount.textContent = post.likes ? post.likes.length : 0;

likeBtn.addEventListener('click', async () => {

  try {

    const response = await fetch(`/api/posts/${post._id}/like`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message);
    }

    likeCount.textContent = data.likes;

    if (data.liked) {
      likeBtn.firstChild.textContent = '❤️ ';
    } else {
      likeBtn.firstChild.textContent = '🤍 ';
    }

  } catch (error) {
    console.error(error);
  }

});
    node.querySelector('.post-title').textContent = post.title;
    node.querySelector('.post-author').textContent = post.authorName;
    node.querySelector('.post-date').textContent = formatDate(post.createdAt);
    node.querySelector('.post-date').setAttribute('datetime', post.createdAt);
    node.querySelector('.post-content').textContent = post.content;
    const imageEl = node.querySelector('.post-image');

if(post.image){
  imageEl.src = post.image;
  imageEl.classList.remove('hidden');
}
    node.querySelector('.post-stamp').textContent = '';
    node.querySelector('.post-stamp').setAttribute('title', initials(post.authorName));

    const ownerActions = node.querySelector('.post-owner-actions');
    const isOwner = currentUser && post.author === currentUser.id;
    ownerActions.classList.toggle('hidden', !isOwner);

    // ---- Edit / Delete ----
    const editForm = node.querySelector('.post-edit-form');
    const contentEl = node.querySelector('.post-content');
    const titleEl = node.querySelector('.post-title');
    const editTitleInput = node.querySelector('.edit-title-input');
    const editContentInput = node.querySelector('.edit-content-input');

    node.querySelector('.edit-post-btn').addEventListener('click', () => {
      editTitleInput.value = post.title;
      editContentInput.value = post.content;
      editForm.classList.remove('hidden');
      contentEl.classList.add('hidden');
    });

    node.querySelector('.cancel-edit-btn').addEventListener('click', () => {
      editForm.classList.add('hidden');
      contentEl.classList.remove('hidden');
    });

    node.querySelector('.save-edit-btn').addEventListener('click', async () => {
      const newTitle = editTitleInput.value.trim();
      const newContent = editContentInput.value.trim();
      if (!newTitle || !newContent) {
        showToast('Title and content cannot be empty.', true);
        return;
      }
      await handleUpdatePost(post._id, newTitle, newContent);
    });

    node.querySelector('.delete-post-btn').addEventListener('click', () => handleDeletePost(post._id));

    // ---- Comments toggle ----
    const commentsSection = node.querySelector('.comments-section');
    const toggleBtn = node.querySelector('.toggle-comments-btn');
    const countEl = node.querySelector('.comment-count');
    const listEl = node.querySelector('.comments-list');
    const commentForm = node.querySelector('.comment-form');
    const commentLoginPrompt = node.querySelector('.comment-login-prompt');

    // Preload comment count
    apiRequest(`/posts/${post._id}/comments`)
      .then((data) => { countEl.textContent = (data.comments || []).length; })
      .catch(() => {});

    let loaded = false;
    toggleBtn.addEventListener('click', async () => {
      const willShow = commentsSection.classList.contains('hidden');
      commentsSection.classList.toggle('hidden');
      if (willShow && !loaded) {
        await loadComments(post._id, listEl, countEl);
        loaded = true;
      }
    });

    if (currentUser) {
      commentForm.classList.remove('hidden');
      commentLoginPrompt.classList.add('hidden');
    } else {
      commentForm.classList.add('hidden');
      commentLoginPrompt.classList.remove('hidden');
      commentLoginPrompt.querySelector('.comment-login-link').addEventListener('click', () => openModal('login'));
    }

    commentForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const textarea = commentForm.querySelector('textarea');
      const text = textarea.value.trim();
      if (!text) return;
      handleAddComment(post._id, text, commentForm, listEl, countEl);
    });

    postsList.appendChild(node);
  });
}

function renderComments(comments, listEl) {
  listEl.innerHTML = '';
  if (comments.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'No comments yet — start the conversation.';
    listEl.appendChild(empty);
    return;
  }

  comments.forEach((comment) => {
    const node = commentTemplate.content.cloneNode(true);
    node.querySelector('.comment-avatar').textContent = initials(comment.authorName);
    node.querySelector('.comment-avatar').style.display = 'flex';
    node.querySelector('.comment-avatar').style.alignItems = 'center';
    node.querySelector('.comment-avatar').style.justifyContent = 'center';
    node.querySelector('.comment-avatar').style.color = '#c6ff3d';
    node.querySelector('.comment-avatar').style.fontFamily = 'JetBrains Mono, monospace';
    node.querySelector('.comment-avatar').style.fontSize = '0.7rem';
    node.querySelector('.comment-author').textContent = comment.authorName;
    node.querySelector('.comment-date').textContent = formatDate(comment.createdAt);
    node.querySelector('.comment-date').setAttribute('datetime', comment.createdAt);
    node.querySelector('.comment-text').textContent = comment.text;
    listEl.appendChild(node);
  });
}