import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

// Firebase Configuration
// Supports environment variables or direct configuration
const firebaseConfig = {
    apiKey: "AIzaSyDjR_98Jl6dJu4Ot70GxVTU4_c74Gty08E",
    authDomain: "phd-app-hub-4df7c.firebaseapp.com",
    projectId: "phd-app-hub-4df7c",
    storageBucket: "phd-app-hub-4df7c.firebasestorage.app",
    messagingSenderId: "1045567899788",
    appId: "1:1045567899788:web:489c0576c15c9be40393a9"
  };

// Initialize Firebase
const app = initializeApp(firebaseConfig)

// Initialize Firebase services
export const auth = getAuth(app)
export const db = getFirestore(app)
export default app

