# Deployment Guide — Wow Moments

This guide provides instructions for deploying the **Wow Moments** CMS and frontend application to production environments.

The project is structured as a monorepo that supports both persistent server environments (such as **Render**) and serverless environments (such as **Vercel**).

---

## 1. MongoDB Atlas Setup (Prerequisite)

Since Vercel is serverless (read-only filesystem) and Render's filesystem is ephemeral (resets on restart), **MongoDB Atlas** is required to store templates, review invitations, and customer testimonials in production.

1. **Create an Account**: Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) and sign up.
2. **Create a Free Cluster**: Deploy a free shared tier cluster (M0) in your preferred region.
3. **Set Up Network Security**:
   - Navigate to **Network Access** under Security.
   - Click **Add IP Address** and choose **Allow Access From Anywhere** (`0.0.0.0/0`). This is necessary because serverless environments (Vercel) and cloud app platforms (Render) dynamically cycle their server IP addresses.
4. **Create Database User**:
   - Go to **Database Access**.
   - Create a database user with password authentication. Give them **Read and Write to any database** privileges.
5. **Get Connection String**:
   - Click **Connect** on your cluster panel.
   - Choose **Drivers** (Node.js).
   - Copy the connection string (it will look like `mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<dbname>`).

---

## 2. Deploying to Render (Web Service)

Render is ideal for persistent Node.js servers. The codebase includes a built-in keep-alive health check to prevent Render's free-tier instance from spinning down.

### Steps to Deploy:
1. Log in to your [Render Dashboard](https://dashboard.render.com).
2. Click **New +** and select **Web Service**.
3. Connect your GitHub repository containing the Wow Moments code.
4. Configure the Web Service settings:
   - **Name**: `wow-moments-backend` (or your preferred name)
   - **Runtime**: `Node`
   - **Build Command**: `npm install && cd server && npm install`
   - **Start Command**: `node server.js` (or `npm run start` from the root)
5. Under **Environment**, add the following variables:
   
   | Key | Value | Notes |
   | :--- | :--- | :--- |
   | `PORT` | `3000` | Port the app listens on |
   | `NODE_ENV` | `production` | Set to production |
   | `MONGODB_URI` | `your_mongodb_connection_string` | Obtained from MongoDB Atlas |
   | `ADMIN_USERNAME` | `your_secure_admin_username` | Admin login username |
   | `ADMIN_PASSWORD` | `your_secure_admin_password` | Admin login password (automatically encrypted at server startup) |
   | `JWT_SECRET` | `a_long_random_jwt_secret_key` | Secret key used for admin session signing |
   | `RENDER_EXTERNAL_URL` | `https://your-app-name.onrender.com` | Your public Render URL (triggers the 3-min health checkup keep-alive loop) |

6. Click **Deploy Web Service**.

---

## 3. Deploying to Vercel (Serverless)

The repository contains a `vercel.json` file in the root, configured to automatically package and build the backend Node.js endpoints and serve static client files serverless.

### Steps to Deploy:
1. Log in to [Vercel](https://vercel.com).
2. Click **Add New** -> **Project**.
3. Import your GitHub repository.
4. In the **Configure Project** step:
   - Keep the **Framework Preset** as `Other`.
   - Keep the Root Directory as `./`.
5. Expand the **Environment Variables** panel and add:

   | Key | Value |
   | :--- | :--- |
   | `MONGODB_URI` | `your_mongodb_connection_string` |
   | `ADMIN_USERNAME` | `your_secure_admin_username` |
   | `ADMIN_PASSWORD` | `your_secure_admin_password` |
   | `JWT_SECRET` | `your_jwt_secret_key` |

6. Click **Deploy**. Vercel will build the project using the configuration in `vercel.json`.

---

## 4. Keep-Alive Mechanism

The backend includes a health keep-alive task that operates automatically:
- Every **3 minutes**, the server pings the `/api/health` checkup route.
- If deployed on **Render**, this prevents the server from spinning down after 15 minutes of inactivity on the free tier.
- To ensure it runs, make sure `RENDER_EXTERNAL_URL` (or the corresponding URL env variable) is set in your Render Web Service settings.
