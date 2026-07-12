// server.js
// Main Express server: models, routes, controllers, and authentication middleware.

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const connectDB = require('./database');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-this-in-production';

// ----------------------------------------------------------------------------
// Middleware
// ----------------------------------------------------------------------------
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname))); // serves index.html, style.css, script.js

// Connect to MongoDB
connectDB();

// ----------------------------------------------------------------------------
// MODELS
// ----------------------------------------------------------------------------

// ---- User Model ----
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true } // stored hashed
  },
  { timestamps: true }
);
const User = mongoose.model('User', userSchema);

// ---- Post Model ----
const postSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    image:{
    type:String,
    default:""
  },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    authorName: { type: String, required: true },
likes: [
  {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
]// denormalized for fast display
  },
  { timestamps: true }
);
const Post = mongoose.model('Post', postSchema);

// ---- Comment Model ----
const commentSchema = new mongoose.Schema(
  {
    post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    authorName: { type: String, required: true },
    text: { type: String, required: true, trim: true }
  },
  { timestamps: true }
);
const Comment = mongoose.model('Comment', commentSchema);

// ----------------------------------------------------------------------------
// AUTH MIDDLEWARE
// ----------------------------------------------------------------------------

/**
 * Verifies the JWT sent in the Authorization header ("Bearer <token>").
 * On success, attaches the decoded user payload to req.user.
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'No token provided. Please log in.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, name, email }
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token. Please log in again.' });
  }
}

// ----------------------------------------------------------------------------
// ROUTES: AUTHENTICATION
// ----------------------------------------------------------------------------

// @route  POST /api/auth/register
// @desc   Register a new user
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password are all required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    // Hash the password before saving
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await User.create({ name, email, password: hashedPassword });

    const token = jwt.sign(
      { id: newUser._id, name: newUser.name, email: newUser.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      message: 'Registration successful! Welcome aboard.',
      token,
      user: { id: newUser._id, name: newUser.name, email: newUser.email }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error during registration.', error: error.message });
  }
});

// @route  POST /api/auth/login
// @desc   Authenticate a user and return a JWT
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      { id: user._id, name: user.name, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: `Welcome back, ${user.name}!`,
      token,
      user: { id: user._id, name: user.name, email: user.email }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error during login.', error: error.message });
  }
});

// @route  POST /api/auth/logout
// @desc   Logout (stateless JWT - client discards the token). Endpoint kept for a
//         consistent API and to allow future token-blacklisting if needed.
app.post('/api/auth/logout', (req, res) => {
  res.json({ success: true, message: 'Logged out successfully.' });
});

// ----------------------------------------------------------------------------
// ROUTES: POSTS
// ----------------------------------------------------------------------------

// @route  GET /api/posts
// @desc   Get all blog posts, newest first
app.get('/api/posts', async (req, res) => {
  try {
    const posts = await Post.find().sort({ createdAt: -1 }).lean();
    res.json({ success: true, posts });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Could not fetch posts.', error: error.message });
  }
});

// @route  GET /api/posts/:id
// @desc   Get a single blog post
app.get('/api/posts/:id', async (req, res) => {
  try {
    const post = await Post.findById(req.params.id).lean();
    if (!post) return res.status(404).json({ success: false, message: 'Post not found.' });
    res.json({ success: true, post });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Could not fetch post.', error: error.message });
  }
});

// @route  POST /api/posts
// @desc   Create a new blog post (requires login)
app.post('/api/posts', authMiddleware, async (req, res) => {
  try {
    const { title, content, image } = req.body;
    if (!title || !content) {
      return res.status(400).json({ success: false, message: 'Title and content are required.' });
    }
    

    const post = await Post.create({
      title,
      content,
      image,
      author: req.user.id,
      authorName: req.user.name
    });

    res.status(201).json({ success: true, message: 'Post published successfully!', post });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Could not create post.', error: error.message });
  }
});

// @route  PUT /api/posts/:id
// @desc   Update a blog post (only by its author)
app.put('/api/posts/:id', authMiddleware, async (req, res) => {
  try {
    const { title, content } = req.body;
    const post = await Post.findById(req.params.id);
    if (!post.likes) {
  post.likes = [];
}

    if (!post) return res.status(404).json({ success: false, message: 'Post not found.' });
    if (post.author.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'You can only edit your own posts.' });
    }

    if (title) post.title = title;
    if (content) post.content = content;
    if (image !== undefined) post.image = image;
    await post.save();

    res.json({ success: true, message: 'Post updated successfully!', post });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Could not update post.', error: error.message });
  }
});

// @route  DELETE /api/posts/:id
// @desc   Delete a blog post (only by its author) — also removes its comments
app.delete('/api/posts/:id', authMiddleware, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) return res.status(404).json({ success: false, message: 'Post not found.' });
    if (post.author.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'You can only delete your own posts.' });
    }

    await Comment.deleteMany({ post: post._id });
    await post.deleteOne();

    res.json({ success: true, message: 'Post deleted successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Could not delete post.', error: error.message });
  }
});

// Like a Post

app.put('/api/posts/:id/like', authMiddleware, async (req, res) => {

  try {

    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found"
      });
    }

    const userId = req.user.id;

    const alreadyLiked = post.likes.includes(userId);

    if (alreadyLiked) {

      post.likes = post.likes.filter(
        id => id.toString() !== userId
      );

    } else {

      post.likes.push(userId);

    }

    await post.save();

    res.json({
      success: true,
      likes: post.likes.length,
      liked: !alreadyLiked
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: "Server Error"
    });

  }

});
// ----------------------------------------------------------------------------
// ROUTES: COMMENTS
// ----------------------------------------------------------------------------

// @route  GET /api/posts/:id/comments
// @desc   Get all comments for a post, oldest first
app.get('/api/posts/:id/comments', async (req, res) => {
  try {
    const comments = await Comment.find({ post: req.params.id }).sort({ createdAt: 1 }).lean();
    res.json({ success: true, comments });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Could not fetch comments.', error: error.message });
  }
});

// @route  POST /api/posts/:id/comments
// @desc   Add a comment to a post (requires login)
app.post('/api/posts/:id/comments', authMiddleware, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Comment text cannot be empty.' });
    }

    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found.' });

    const comment = await Comment.create({
      post: post._id,
      author: req.user.id,
      authorName: req.user.name,
      text: text.trim()
    });

    res.status(201).json({ success: true, message: 'Comment added!', comment });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Could not add comment.', error: error.message });
  }
});

// ----------------------------------------------------------------------------
// Fallback: serve index.html for the root route
// ----------------------------------------------------------------------------
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ----------------------------------------------------------------------------
// Start server
// ----------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`🚀 Blog Platform server running at http://localhost:${PORT}`);
});