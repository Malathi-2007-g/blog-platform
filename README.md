
# Blog Platform

A modern full-stack blogging platform that allows users to create, edit, delete, like, and interact with blog posts through a clean and user-friendly interface.

## Overview

This project is developed using Node.js, Express.js, MongoDB, HTML, CSS, and JavaScript. It provides a complete blogging experience with user authentication and post management features.

## Features

- User Registration and Authentication
- Create New Blog Posts
- Edit Existing Posts
- Delete Posts
- Like and Unlike Posts
- Comment System
- Search Functionality
- Image Support via URLs
- JWT-Based Secure Authentication
- Responsive and Clean User Interface

## Technology Stack

### Frontend
- HTML5
- CSS3
- JavaScript (Vanilla JS)

### Backend
- Node.js
- Express.js

### Database
- MongoDB
- Mongoose

### Authentication
- JSON Web Tokens (JWT)

## Project Structure

```text
blog-platform/
│
├── index.html
├── style.css
├── script.js
├── server.js
├── database.js
├── package.json
├── package-lock.json
└── README.md
```

## Installation

### Clone the Repository

```bash
git clone <repository-url>
```

### Install Dependencies

```bash
npm install
```

### Configure Environment Variables

Create a `.env` file in the project root:

```env
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_secret_key
```

### Run the Application

```bash
node server.js
```

The server will start locally and connect to MongoDB.

## Key Functionalities

### Authentication
- User Signup
- User Login
- JWT Token Verification

### Post Management
- Create Posts
- Edit Posts
- Delete Posts
- View Posts

### Social Features
- Like / Unlike Posts
- Add Comments
- View Community Posts

## Future Improvements

- Direct Image Upload from Device
- User Profile Pages
- Dark Mode
- Notification System
- Follow/Followers Feature
- Mobile App Version



This project is created for educational and learning purposes.
