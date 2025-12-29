# 🚀 Production Deployment Guide - RENDER.COM

## ✅ Step 1: Backend Code Ready
Backend code has been committed to git!

## 📋 Step 2: GitHub Repo Setup (MANUAL - 2 minutes)

### Create GitHub repo:
1. Go to https://github.com/new
2. Name: `trave-social-backend` (or any name)
3. Privacy: **Private** (recommended)
4. Click "Create repository"

### Push code:
```powershell
cd c:\Projects\trave-social-backend
git remote add origin https://github.com/YOUR-USERNAME/trave-social-backend.git
git push -u origin main
```

---

## 🌐 Step 3: Render.com Deployment (MANUAL - 5 minutes)

### 1. Sign Up:
- Go to https://render.com/
- Sign up with GitHub

### 2. Create Web Service:
- Click "New +" → "Web Service"
- Connect your `trave-social-backend` repo
- Select branch: `main`

### 3. Settings:
- **Name:** `travesocial-backend`
- **Environment:** `Node`
- **Build Command:** `npm install`
- **Start Command:** `npm run start`

### 4. Environment Variables (CRITICAL!):
Click "Add Environment Variable" for each:

```
MONGODB_URI = mongodb+srv://your-mongodb-atlas-uri
JWT_SECRET = your-jwt-secret-key
PORT = 5000
NODE_ENV = production
```

Add any other .env variables you have (Cloudinary, Firebase Admin, etc.)

### 5. Deploy:
- Click "Create Web Service"
- Wait 3-5 minutes for deployment
- Render will give you a URL: `https://travesocial-backend.onrender.com`

---

## 📱 Step 4: Update Frontend API URL

Your new backend URL will be: `https://travesocial-backend.onrender.com`

Update frontend .env:
```
EXPO_PUBLIC_API_BASE_URL=https://travesocial-backend.onrender.com/api
```

---

## ✅ Step 5: Test Backend

Open in browser:
```
https://travesocial-backend.onrender.com/api/status
```

Should return: `{"status":"ok"}`

---

## 🔄 Auto-Deploy (DONE!)
From now on, every `git push` to main branch will auto-deploy to Render!

---

## 💰 Pricing Notes:
- **Free tier:** Backend sleeps after 15 min idle
- **Paid ($7/month):** Always-on, faster, no sleep
- Upgrade when you have users!

---

## 🆘 Troubleshooting:
- **Deployment failed?** Check Render logs for errors
- **Env vars missing?** Double-check in Render dashboard
- **Backend not responding?** Check if it's sleeping (free tier)

---

## 📞 Need Help?
If stuck, check Render docs: https://render.com/docs

---

**Next steps:**
1. Create GitHub repo (2 min)
2. Push code (1 command)
3. Setup on Render.com (5 min)
4. Update frontend .env
5. Build APK! 🎉
