#!/usr/bin/env node
const axios = require('axios');

const BACKEND_URL = 'https://trave-social-backend.onrender.com';

async function checkEndpoints() {
  console.log('🔍 Checking which endpoints are available\n');
  
  const endpoints = [
    { name: 'GET /api/live-streams', method: 'GET', url: '/api/live-streams' },
    { name: 'POST /api/live-streams', method: 'POST', url: '/api/live-streams', data: { userId: 'test', title: 'test' } },
    { name: 'GET /api/live-streams/123', method: 'GET', url: '/api/live-streams/507f1f77bcf86cd799439011' },
    { name: 'POST /api/live-streams/123/agora-token', method: 'POST', url: '/api/live-streams/507f1f77bcf86cd799439011/agora-token', data: { userId: 'test', role: 'publisher' } },
    { name: 'PATCH /api/live-streams/123/end', method: 'PATCH', url: '/api/live-streams/507f1f77bcf86cd799439011/end', data: { userId: 'test' } },
    { name: 'POST /api/live-streams/123/comments', method: 'POST', url: '/api/live-streams/507f1f77bcf86cd799439011/comments', data: { userId: 'test', text: 'test' } },
    { name: 'GET /api/live-streams/123/comments', method: 'GET', url: '/api/live-streams/507f1f77bcf86cd799439011/comments' },
    { name: 'POST /api/live-streams/123/leave', method: 'POST', url: '/api/live-streams/507f1f77bcf86cd799439011/leave', data: { userId: 'test' } }
  ];
  
  for (const endpoint of endpoints) {
    try {
      let res;
      if (endpoint.method === 'GET') {
        res = await axios.get(`${BACKEND_URL}${endpoint.url}`, { timeout: 3000 });
      } else {
        res = await axios[endpoint.method.toLowerCase()](`${BACKEND_URL}${endpoint.url}`, endpoint.data, { timeout: 3000 });
      }
      console.log(`✅ ${endpoint.name} - Status: ${res.status}`);
    } catch (err) {
      const status = err.response?.status;
      if (status === 404) {
        console.log(`❌ ${endpoint.name} - NOT FOUND (404)`);
      } else if (status === 400 || status === 403) {
        console.log(`⚠️ ${endpoint.name} - Status: ${status} (endpoint exists, validation error)`);
      } else {
        console.log(`❌ ${endpoint.name} - Status: ${status || 'Unknown'}`);
      }
    }
  }
}

checkEndpoints();
