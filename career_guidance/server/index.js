const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const bodyParser = require('body-parser');
const { google } = require('googleapis');

const path = require('path');
const { parse } = require('json2csv');
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const PORT = process.env.PORT || 5000;


const admin = require('firebase-admin');

let serviceAccount;

// Try to parse from environment variable
if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    console.log('✅ Firebase credentials loaded from FIREBASE_SERVICE_ACCOUNT_JSON');
  } catch (error) {
    console.error("❌ Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:", error);
  }
}

if (!serviceAccount) {
  console.error('❌ Firebase service account is missing. Please set FIREBASE_SERVICE_ACCOUNT_JSON in Render environment variables.');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
console.log('✅ Firebase initialized');





// Middleware
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman, curl)
    if (!origin) return callback(null, true);
    
    // Allow all origins for now
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
// Add OPTIONS handling for preflight requests


app.use(bodyParser.json());


// ✅ Health check endpoints
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Career Guidance API is running',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// Store OTPs temporarily
const otpStore = new Map();

// Configure nodemailer transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL,
    pass: process.env.EMAIL_PASSWORD
  }
});

const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Generate 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}


// ============================================
// INITIALIZE GOOGLE SHEETS
// ============================================
 async function initializeGoogleSheets() {
  try {
    // Option 1: Using JSON file path
    if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH) {
      const auth = new google.auth.GoogleAuth({
        keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      sheets = google.sheets({ version: 'v4', auth });
      sheetsEnabled = true;
      console.log('✅ Google Sheets initialized (from file)');
      return;
    }

    // Option 2: Using JSON string from env
    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      sheets = google.sheets({ version: 'v4', auth });
      sheetsEnabled = true;
      console.log('✅ Google Sheets initialized (from env)');
      return;
    }

    console.warn('⚠️ Google Sheets credentials not found - feature disabled');
  } catch (error) {
    console.error('❌ Google Sheets initialization failed:', error.message);
    sheetsEnabled = false;
  }
}

// Call on server start
initializeGoogleSheets();



async function saveQuizToGoogleSheets(quizData) {
  // Skip if sheets not enabled
  if (!sheetsEnabled || !sheets) {
    console.log('⚠️ Google Sheets disabled');
    return false;
  }

  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) {
    console.log('⚠️ Missing GOOGLE_SHEETS_SPREADSHEET_ID');
    return false;
  }

  try {
    const {
      userProfile,
      email,
      quizNumber,
      timestamp,
      overallScore,
      comprehensiveAnalysis,
      rounds,
      skillPerformance
    } = quizData;

    // ✅ STEP 1: Ensure "Quiz Results" sheet exists
    await ensureSheetExists(spreadsheetId);

    // ✅ STEP 2: Build row data (simplified)
    const rowData = [
      new Date(timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      email || 'N/A',
      userProfile?.fullName || 'N/A',
      quizNumber || 'N/A',
      `${overallScore?.percentage || 0}%`,
      overallScore?.totalCorrect || 0,
      overallScore?.totalQuestions || 0,
      `${Math.round((overallScore?.timeTaken || 0) / 1000)}s`,
      `${comprehensiveAnalysis?.careerReadiness || 0}/100`,
      `${comprehensiveAnalysis?.percentile || 0}th`,
      comprehensiveAnalysis?.primaryCareer?.role || 'N/A',
      `${comprehensiveAnalysis?.primaryCareer?.matchPercentage || 0}%`,
      comprehensiveAnalysis?.primaryCareer?.averageSalary || 'N/A',
      (comprehensiveAnalysis?.strengthAreas || []).join(', ') || 'N/A',
      (comprehensiveAnalysis?.weaknessAreas || []).join(', ') || 'N/A',
      userProfile?.degree || 'N/A',
      userProfile?.department || 'N/A',
      userProfile?.currentYear || 'Graduated',
      userProfile?.careerInterestArea || 'N/A'
    ];

    // ✅ STEP 3: Append to sheet (FIXED RANGE)
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Quiz Results!A2', // Start from row 2 (headers in row 1)
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: [rowData]
      }
    });

    console.log(`✅ Quiz #${quizNumber} saved to Google Sheets for ${email}`);
    return true;

  } catch (error) {
    console.error('❌ Google Sheets save failed:', error.message);
    return false;
  }


  
}




// ============================================
// ✅ ENSURE SHEET EXISTS WITH HEADERS
// ============================================
async function ensureSheetExists(spreadsheetId) {
  try {
    // Check if sheet exists
    const response = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetExists = response.data.sheets.some(
      s => s.properties.title === 'Quiz Results'
    );

    if (sheetExists) {
      console.log('✅ "Quiz Results" sheet found');
      return true;
    }

    // Create sheet with headers
    console.log('📝 Creating "Quiz Results" sheet...');
    
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [{
          addSheet: {
            properties: {
              title: 'Quiz Results',
              gridProperties: {
                frozenRowCount: 1,
                columnCount: 19
              }
            }
          }
        }]
      }
    });

    // Add headers
    const headers = [
      'Timestamp',
      'Email',
      'Full Name',
      'Quiz #',
      'Score %',
      'Correct',
      'Total Qs',
      'Time',
      'Career Readiness',
      'Percentile',
      'Primary Career',
      'Match %',
      'Salary Range',
      'Strengths',
      'Weaknesses',
      'Degree',
      'Department',
      'Current Year',
      'Career Interest'
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Quiz Results!A1:S1',
      valueInputOption: 'RAW',
      resource: {
        values: [headers]
      }
    });

    console.log('✅ Sheet created with headers');
    return true;

  } catch (error) {
    console.error('❌ Error ensuring sheet exists:', error.message);
    return false;
  }
}


 async function setupGoogleSheet() {
  if (!sheetsEnabled || !sheets) {
    return { success: false, error: 'Google Sheets not initialized' };
  }

  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) {
    return { success: false, error: 'GOOGLE_SHEETS_SPREADSHEET_ID not set' };
  }

  try {
    const headers = [
      'Timestamp', 'Email', 'Full Name', 'Quiz #', 'Score %', 'Correct',
      'Total Qs', 'Time', 'Career Readiness', 'Percentile', 'Primary Career',
      'Match %', 'Salary Range', 'Strengths', 'Weaknesses', 'Skill Performance',
      'Round Performance', 'Top 3 Recommendations', 'Degree', 'Department',
      'Current Year', 'Career Interest'
    ];

    // Check if "Quiz Results" sheet exists
    const response = await sheets.spreadsheets.get({ spreadsheetId });
    const sheet = response.data.sheets.find(s => s.properties.title === 'Quiz Results');
    let sheetId;

    if (!sheet) {
      // Create sheet
      const createResponse = await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        resource: {
          requests: [{
            addSheet: {
              properties: {
                title: 'Quiz Results',
                gridProperties: { frozenRowCount: 1, columnCount: headers.length }
              }
            }
          }]
        }
      });
      sheetId = createResponse.data.replies[0].addSheet.properties.sheetId;
      console.log('✅ Created "Quiz Results" sheet');
    } else {
      sheetId = sheet.properties.sheetId;
    }

    // Add headers
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Quiz Results!A1:V1',
      valueInputOption: 'RAW',
      resource: { values: [headers] }
    });

    // Format headers (bold + blue background)
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [
          {
            repeatCell: {
              range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.4, green: 0.5, blue: 0.92 },
                  textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 }, fontSize: 11 },
                  horizontalAlignment: 'CENTER'
                }
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)'
            }
          },
          {
            autoResizeDimensions: {
              dimensions: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: headers.length }
            }
          }
        ]
      }
    });

    console.log('✅ Google Sheet setup complete!');
    return { success: true, message: 'Sheet configured successfully' };
  } catch (error) {
    console.error('❌ Sheet setup error:', error.message);
    return { success: false, error: error.message };
  }
}


async function addQuizToSheetExample(newQuizResult, userProfile, email, quizNumber) {
  try {
    const result = await saveQuizToGoogleSheets({
      userProfile,
      email,
      quizNumber,
      timestamp: newQuizResult.timestamp,
      overallScore: newQuizResult.overallScore,
      comprehensiveAnalysis: newQuizResult.comprehensiveAnalysis,
      rounds: newQuizResult.rounds,
      skillPerformance: newQuizResult.skillPerformance
    });

    if (!result) {
      console.warn('⚠️ Google Sheets: DISABLED or NOT CONFIGURED');
      console.log('   - sheetsEnabled =', sheetsEnabled);
      console.log('   - GOOGLE_SHEETS_SPREADSHEET_ID =', process.env.GOOGLE_SHEETS_SPREADSHEET_ID ? 'SET' : 'MISSING');
    } else {
      console.log(`✅ Quiz #${quizNumber} → Google Sheets SUCCESS`);
    }
  } catch (error) {
    console.error('❌ Google Sheets FAILED:', error.message);
    console.error('   Full error:', error);
  }
}
// ============================================
// ADD TO YOUR QUIZ SUBMISSION ENDPOINT
// ============================================

// Find your existing: app.post('/api/submit-quiz', ...)
// After saving to Firestore, add this:

// ... your existing Firestore save code ...



app.get('/api/migrate-cloudinary-to-firebase', async (req, res) => {
  try {
    const folder = 'career_profiles'; // default folder
    const resources = await cloudinary.api.resources({
      type: 'upload',
      prefix: folder,
      resource_type: 'raw',
      max_results: 500
    });

    const migrated = [];

    for (const file of resources.resources) {
      try {
        const response = await fetch(file.secure_url);
        const data = await response.json();

        if (!data.email) continue; // skip if no email

        await db.collection('career_profiles').doc(data.email).set(data, { merge: true });
        migrated.push(data.email);
      } catch (err) {
        console.error(`❌ Failed to migrate ${file.public_id}:`, err.message);
      }
    }

    res.json({ success: true, total: migrated.length, migrated });
  } catch (err) {
    console.error('❌ Migration error:', err);
    res.status(500).json({ error: 'Migration failed', message: err.message });
  }
});
// Route 1: Send OTP to email
app.post('/api/send-otp', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const otp = generateOTP();
    
    otpStore.set(email, {
      otp,
      expiresAt: Date.now() + 10 * 60 * 1000
    });

    const mailOptions = {
      from: process.env.EMAIL,
      to: email,
      subject: 'Career Guidance - Email Verification',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #667eea;">Email Verification</h2>
          <p>Thank you for signing up with Career Guidance!</p>
          <p>Your verification code is:</p>
          <div style="background: #f7fafc; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <h1 style="color: #667eea; font-size: 36px; letter-spacing: 8px; margin: 0;">${otp}</h1>
          </div>
          <p style="color: #718096; font-size: 14px;">This code will expire in 10 minutes.</p>
          <p style="color: #718096; font-size: 14px;">If you didn't request this code, please ignore this email.</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);

    res.json({ 
      success: true, 
      message: 'OTP sent successfully',
      expiresIn: 600
    });

  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

// Route 2: Verify OTP
app.post('/api/verify-otp', (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ error: 'Email and OTP are required' });
  }

  const storedData = otpStore.get(email);

  if (!storedData) {
    return res.status(400).json({ error: 'OTP not found or expired' });
  }

  if (Date.now() > storedData.expiresAt) {
    otpStore.delete(email);
    return res.status(400).json({ error: 'OTP has expired' });
  }

  if (storedData.otp === otp) {
    otpStore.delete(email);
    return res.json({ 
      success: true, 
      message: 'Email verified successfully' 
    });
  } else {
    return res.status(400).json({ error: 'Invalid OTP' });
  }
});



app.post('/api/save-profile', async (req, res) => {
  try {
    const { email, profileData } = req.body;
    
    const cleanEmail = email.toLowerCase().trim();
    const sanitizedEmail = cleanEmail.replace(/[@.]/g, '_');
    
    const userData = {
      email: cleanEmail,
      username: cleanEmail.split('@')[0],
      submittedAt: new Date().toISOString(),
      sanitizedEmail: sanitizedEmail,  // ✅ Store sanitized ID
      ...profileData
    };

    // ✅ SAME DOC ID as migration
    await db.collection('career_profiles').doc(sanitizedEmail).set(userData);

    console.log('✅ SAVED:', cleanEmail, '→', sanitizedEmail);
    
    res.json({ success: true, message: 'Profile saved successfully', docId: sanitizedEmail });
  } catch (error) {
    console.error('❌ Save error:', error);
    res.status(500).json({ error: 'Failed to save profile' });
  }
});



app.get('/api/get-profile/:email', async (req, res) => {
  try {
    let rawEmail = decodeURIComponent(req.params.email).trim().toLowerCase();
    rawEmail = rawEmail.replace(/%20/g, ' ').trim();
    
    console.log('🌐 RAW URL:', req.params.email);
    console.log('📧 Clean email:', rawEmail);

    // ✅ TRY BOTH POSSIBLE DOC IDs
    const possibleDocIds = [
      rawEmail.replace(/[@.]/g, '_'),    // aanirudhch_gmail_com
      rawEmail                           // aanirudhch@gmail.com (your migration)
    ];

    console.log('🔍 Trying doc IDs:', possibleDocIds);

    let profileData = null;
    let usedDocId = null;

    // Try sanitized first
    let docRef = db.collection('career_profiles').doc(possibleDocIds[0]);
    let docSnap = await docRef.get();
    if (docSnap.exists) {
      profileData = docSnap.data();
      usedDocId = possibleDocIds[0];
    } else {
      // Try raw email (your migration format)
      docRef = db.collection('career_profiles').doc(possibleDocIds[1]);
      docSnap = await docRef.get();
      if (docSnap.exists) {
        profileData = docSnap.data();
        usedDocId = possibleDocIds[1];
      }
    }

    if (!profileData) {
      // Show what's actually there
      const snapshot = await db.collection('career_profiles').limit(3).get();
      const existing = snapshot.docs.map(doc => doc.id);
      
      return res.json({
        success: true,
        profile: null,
        exists: false,
        searched: possibleDocIds,
        foundDocs: existing
      });
    }

    console.log('✅ FOUND using:', usedDocId);
    res.json({
      success: true,
      profile: profileData,
      exists: true,
      docIdUsed: usedDocId
    });

  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ error: error.message });
  }
});



app.get('/api/test-google-sheets', async (req, res) => {
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
    });

    res.json({
      success: true,
      message: 'Google Sheets credentials are correct',
      sheetTitle: response.data.properties.title
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


app.get('/api/debug/firestore', async (req, res) => {
  const snap = await db.collection('career_profiles').get();
  res.json(snap.docs.map(d => d.id));
});



app.get('/api/all-profiles', async (req, res) => {
  try {
    const snapshot = await db.collection('career_profiles').get();
    
    const profiles = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      profiles.push({
        id: doc.id,
        email: data.email,
        username: data.username,
        submittedAt: data.submittedAt,
        docRef: `career_profiles/${doc.id}`
      });
    });

    console.log(`✅ Found ${profiles.length} profiles in Firestore`);
    
    res.json({
      success: true,
      total: profiles.length,
      profiles: profiles
    });

  } catch (error) {
    console.error('❌ List error:', error);
    res.status(500).json({ error: 'Failed to list profiles' });
  }
});


app.get('/api/update-stream-names', async (req, res) => {
  try {
    const streamMapping = {
      'Science-PCM': 'Computer Science (Maths)',
      'Science-PCB': 'Biology',
      'Science-PCMB': 'Pure Science',
      'Commerce': 'Commerce',
      'Arts': 'Arts/Humanities',
      'Vocational': 'Vocational'
    };

    const result = await cloudinary.api.resources({
      type: 'upload',
      resource_type: 'raw',
      prefix: 'career_profiles',
      max_results: 500
    });

    let updatedCount = 0;
    let errors = [];

    for (const resource of result.resources) {
      try {
        const response = await fetch(resource.secure_url);
        const profileData = await response.json();

        if (profileData.twelfthStream && streamMapping[profileData.twelfthStream]) {
          profileData.twelfthStream = streamMapping[profileData.twelfthStream];

          const jsonContent = JSON.stringify(profileData, null, 2);
          
          await cloudinary.uploader.upload(
            `data:application/json;base64,${Buffer.from(jsonContent).toString('base64')}`,
            {
              resource_type: 'raw',
              public_id: resource.public_id,
              overwrite: true
            }
          );

          updatedCount++;
          console.log('✅ Updated:', resource.public_id);
        }
      } catch (err) {
        console.error('❌ Error updating:', resource.public_id, err);
        errors.push({ file: resource.public_id, error: err.message });
      }
    }

    res.json({
      success: true,
      message: 'Stream names updated successfully',
      totalProfiles: result.resources.length,
      updatedCount: updatedCount,
      errors: errors
    });

  } catch (error) {
    console.error('Error updating stream names:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/test-cloudinary/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const sanitizedEmail = email.replace(/[@.]/g, '_');
    
    const result = await cloudinary.api.resources({
      type: 'upload',
      resource_type: 'raw',
      prefix: 'career_profiles/',
      max_results: 100
    });
    
    res.json({
      totalFiles: result.resources.length,
      files: result.resources.map(r => ({
        public_id: r.public_id,
        url: r.secure_url,
        format: r.format
      })),
      lookingFor: `career_profiles/${sanitizedEmail}`
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/debug-cloudinary', async (req, res) => {
  try {
    const result = await cloudinary.api.resources({
      type: 'upload',
      resource_type: 'raw',
      prefix: 'career_profiles/',
      max_results: 50
    });
    
    console.log('All resources in career_profiles:', JSON.stringify(result, null, 2));
    res.json(result);
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/test-gemini', async (req, res) => {
  try {
    const API_KEY = process.env.GEMINI_API_KEY;
    
    if (!API_KEY) {
      return res.status(500).json({ success: false, error: 'No API key' });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: 'Say hello in one sentence!' }]
          }]
        })
      }
    );

    const data = await response.json();
    
    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: data.error?.message || 'Failed',
        fullError: data
      });
    }

    const text = data.candidates[0].content.parts[0].text;
    
    return res.json({
      success: true,
      message: '✅ Gemini 2.5 Flash working!',
      response: text,
      model: 'gemini-2.5-flash'
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ✅ NEW: List available models
app.get('/api/list-models', async (req, res) => {
  try {
    const API_KEY = process.env.GEMINI_API_KEY;
    
    if (!API_KEY) {
      return res.status(500).json({ success: false, error: 'No API key' });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      }
    );

    const data = await response.json();
    
    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: data.error?.message || 'Failed to fetch models',
        fullError: data
      });
    }

    const textModels = data.models
      .filter(model => 
        model.supportedGenerationMethods?.includes('generateContent')
      )
      .map(model => ({
        name: model.name.replace('models/', ''),
        displayName: model.displayName,
        description: model.description,
        inputTokenLimit: model.inputTokenLimit,
        outputTokenLimit: model.outputTokenLimit,
        supportedMethods: model.supportedGenerationMethods
      }));

    console.log('\n✅ Available Models:');
    textModels.forEach(m => {
      console.log(`   - ${m.name} (${m.displayName})`);
      console.log(`     Input: ${m.inputTokenLimit}, Output: ${m.outputTokenLimit}`);
    });

    return res.json({
      success: true,
      totalModels: textModels.length,
      models: textModels,
      recommendation: textModels.length > 0 ? textModels[0].name : null
    });

  } catch (error) {
    console.error('❌ Error listing models:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ✨ SMART CAREER GUIDANCE - Firebase Storage/Firestore (FIXED)
app.post('/api/generate-career-guidance', async (req, res) => {
  try {
    const { email, forceRegenerate } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    console.log('🎯 Checking career guidance for:', email);

    // 1. 🔥 TRY FIRESTORE FIRST (new saves)
    let fullProfile = null;
    let source = null;

    // Try Firestore (sanitized email)
    const sanitizedEmail = email.toLowerCase().trim().replace(/[@.]/g, '_');
    
    let docRef = db.collection('career_profiles').doc(sanitizedEmail);
    let docSnap = await docRef.get();
    
    if (docSnap.exists) {
      fullProfile = docSnap.data();
      source = 'Firestore (sanitized)';
      console.log(`✅ Found profile in Firestore: ${sanitizedEmail}`);
    } else {
      // Try Firestore (raw email - migration format)
      docRef = db.collection('career_profiles').doc(email.toLowerCase().trim());
      docSnap = await docRef.get();
      
      if (docSnap.exists) {
        fullProfile = docSnap.data();
        source = 'Firestore (raw)';
        console.log(`✅ Found profile in Firestore: ${email}`);
      }
    }

    // 2. Try Firebase Storage (JSON files)
    if (!fullProfile) {
      const storagePaths = [
        `career_profiles/${sanitizedEmail}.json`,
        `career_profiles/${email.toLowerCase().trim()}.json`,
        `career_profiles/${sanitizedEmail}`,
        `career_profiles/${email.toLowerCase().trim()}`
      ];

      for (const path of storagePaths) {
        try {
          const file = bucket.file(path);
          const [exists] = await file.exists();
          
          if (exists) {
            const [contents] = await file.download();
            fullProfile = JSON.parse(contents.toString());
            source = `Firebase Storage: ${path}`;
            console.log(`✅ Found profile in Firebase Storage: ${path}`);
            break;
          }
        } catch (err) {
          continue;
        }
      }
    }

    if (!fullProfile) {
      return res.status(404).json({ 
        error: 'Profile not found', 
        message: 'Please complete your profile first',
        searched: ['Firestore sanitized', 'Firestore raw', ...storagePaths.slice(0,2)]
      });
    }

    console.log(`✅ Profile loaded from: ${source}`);

    // 3. CHECK: Does gotResponse: 1 exist?
    if (fullProfile.gotResponse === 1 && fullProfile.aiGuidance && !forceRegenerate) {
      console.log('✅ Cached guidance found! Skipping API call.');
      return res.json({
        success: true,
        guidance: fullProfile.aiGuidance,
        cached: true,
        source: source,
        generatedAt: fullProfile.aiGuidance.generatedAt
      });
    }

    // 4. Generate with Gemini (same logic)
    console.log('📡 Calling Gemini API...');
    const careerData = extractCareerInputs(fullProfile);
    const prompt = buildPrompt(careerData);

    const API_KEY = process.env.GEMINI_API_KEY;
    const modelsToTry = [
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite', 
      'gemini-2.0-flash-exp'
    ];

    let aiResponse = null;
    let usedModel = null;

    for (const model of modelsToTry) {
      try {
        console.log(`   Trying ${model}...`);
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;
        
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { 
              temperature: 0.7, 
              maxOutputTokens: 8000 
            }
          })
        });

        if (response.ok) {
          const data = await response.json();
          
          if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
            aiResponse = data.candidates[0].content.parts[0].text;
            usedModel = model;
            console.log(`   ✅ SUCCESS with ${model}`);
            break;
          }
        }
      } catch (err) {
        console.log(`   ❌ ${model} failed:`, err.message);
      }
    }

    if (!aiResponse) {
      return res.status(500).json({ error: 'All Gemini models failed' });
    }

    // 5. Parse & Save back
    let guidanceData;
    try {
      const jsonMatch = aiResponse.match(/```json\n([\s\S]*?)\n```/) || aiResponse.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : aiResponse;
      guidanceData = JSON.parse(jsonText);
    } catch {
      guidanceData = { assessment: aiResponse, rawText: aiResponse };
    }

    const aiGuidance = {
      ...guidanceData,
      generatedAt:  new Date().toISOString(),
      modelUsed: usedModel,
      version: '1.0'
    };

    fullProfile.aiGuidance = aiGuidance;
    fullProfile.gotResponse = 1;

    // 6. SAVE BACK to SAME SOURCE
    if (source.startsWith('Firestore')) {
      // Save to Firestore
      const docId = source.includes('sanitized') ? sanitizedEmail : email.toLowerCase().trim();
      await db.collection('career_profiles').doc(docId).set(fullProfile);
      console.log('✅ Guidance saved to Firestore');
    } else {
      // Save to Firebase Storage
      const filePath = source.split(': ')[1];
      await bucket.file(filePath).save(JSON.stringify(fullProfile, null, 2), {
        contentType: 'application/json',
        metadata: { cacheControl: 'public, max-age=31536000' }
      });
      await bucket.file(filePath).makePublic();
      console.log('✅ Guidance saved to Firebase Storage');
    }

    return res.json({ 
      success: true, 
      guidance: aiGuidance,
      cached: false,
      source: source,
      modelUsed: usedModel
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return res.status(500).json({ error: 'Failed to generate guidance', message: error.message });
  }
});


// ✅ Helper function to extract career data from profile
function extractCareerInputs(profile) {
  const techSkills = [...(Array.isArray(profile.technicalSkills) ? profile.technicalSkills : [])];
  if (profile.otherTechnicalSkill) {
    techSkills.push(...profile.otherTechnicalSkill.split(',').map(s => s.trim()).filter(Boolean));
  }

  const softSkills = [...(Array.isArray(profile.softSkills) ? profile.softSkills : [])];
  if (profile.otherSoftSkill) {
    softSkills.push(...profile.otherSoftSkill.split(',').map(s => s.trim()).filter(Boolean));
  }

  return {
    fullName: profile.fullName || 'Student',
    age: profile.dob ? calculateAge(profile.dob) : null,
    location: `${profile.city || ''}, ${profile.state || ''}`.trim(),
    education: {
      status: profile.educationLevel || 'Not specified',
      degree: profile.degree === 'Other' ? (profile.degreeOther || profile.degree) : (profile.degree || 'Not specified'),
      department: profile.department === 'Other' ? (profile.departmentOther || profile.department) : (profile.department || 'Not specified'),
      collegeName: profile.collegeName || 'Not specified',
      currentYear: profile.currentYear || null,
      academicPerformance: {
        currentCGPA: profile.currentCGPA || null,
        finalCGPA: profile.finalCGPA || null,
        twelfthPercentage: profile.twelfthPercentage || 'Not specified',
        twelfthStream: profile.twelfthStream || 'Not specified',
        tenthPercentage: profile.tenthPercentage || 'Not specified'
      },
      yearRange: `${profile.collegeStartYear || ''} - ${profile.collegeEndYear || ''}`.trim()
    },
    technicalSkills: techSkills.filter(Boolean),
    softSkills: softSkills.filter(Boolean),
    careerGoals: {
      interestArea: profile.careerInterestArea === 'Other' 
        ? (profile.careerInterestAreaOther || profile.careerInterestArea)
        : (profile.careerInterestArea || 'Not specified'),
      preferredJobType: profile.preferredJobType || 'Not specified',
      preferredLocation: profile.preferredLocation || 'Flexible',
      salaryExpectation: profile.salaryRange || 'Not specified',
      higherStudiesPlan: profile.higherStudiesPlan || 'Not decided'
    },
    hasGithub: !!profile.githubUrl,
    hasLinkedIn: !!profile.linkedinUrl,
    hasPortfolio: !!profile.portfolioUrl
  };
}

// ✅ Helper function to calculate age
function calculateAge(dob) {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

// ✅ Helper function to build Gemini prompt
function buildPrompt(p) {
  const cgpa = p.education.academicPerformance.currentCGPA || p.education.academicPerformance.finalCGPA || 'Not specified';
  
  return `You are an expert career counselor for Indian students. Analyze this profile and provide comprehensive career guidance.

**STUDENT PROFILE:**
Name: ${p.fullName}
Age: ${p.age || 'N/A'} years
Location: ${p.location}

**EDUCATION:**
Status: ${p.education.status}
College: ${p.education.collegeName}
Degree: ${p.education.degree} in ${p.education.department}
Year: ${p.education.currentYear || 'Graduated'}
CGPA: ${cgpa}
12th Stream: ${p.education.academicPerformance.twelfthStream}
12th Percentage: ${p.education.academicPerformance.twelfthPercentage}

**SKILLS:**
Technical: ${p.technicalSkills.join(', ') || 'None listed'}
Soft Skills: ${p.softSkills.join(', ') || 'None listed'}

**CAREER PREFERENCES:**
Interest Area: ${p.careerGoals.interestArea}
Job Type: ${p.careerGoals.preferredJobType}
Preferred Location: ${p.careerGoals.preferredLocation}
Salary Expectation: ${p.careerGoals.salaryExpectation}
Higher Studies Plan: ${p.careerGoals.higherStudiesPlan}

**ONLINE PRESENCE:**
GitHub: ${p.hasGithub ? 'Yes' : 'No'}
LinkedIn: ${p.hasLinkedIn ? 'Yes' : 'No'}
Portfolio: ${p.hasPortfolio ? 'Yes' : 'No'}

---

**RESPOND WITH ONLY THIS JSON (no markdown, no code blocks, pure JSON):**

{
  "assessment": "2-3 sentences about overall career readiness",
  "readiness_score": "X/10",
  "strengths": ["strength1", "strength2", "strength3"],
  "skill_gaps": ["gap1", "gap2", "gap3"],
  "career_paths": [
    {
      "title": "Specific Job Role",
      "match": "High/Medium/Low",
      "reason": "Why this role fits",
      "salary_range": "X-Y LPA",
      "companies": ["Company1", "Company2", "Company3"]
    }
  ],
  "learning_roadmap": [
    {
      "skill": "Skill Name",
      "importance": "Why needed",
      "resources": {
        "free": ["Free resource 1", "Free resource 2"],
        "paid": ["Paid course 1"]
      },
      "duration": "X weeks/months",
      "priority": "High/Medium/Low"
    }
  ],
  "action_plan": [
    {
      "month": "1-2",
      "action": "Specific action items"
    }
  ],
  "higher_education": "Advice about masters/certifications or null",
  "branding_tips": {
    "github": "Specific GitHub improvements",
    "linkedin": "LinkedIn profile suggestions",
    "portfolio": "Portfolio project ideas"
  }
}

**IMPORTANT:**
- Focus on Indian job market
- Be realistic and actionable
- Suggest Indian companies (TCS, Infosys, Wipro, startups, etc.)
- Consider current tech trends in India
- Return ONLY valid JSON, no extra text
- ENSURE THE RESPONSE IS COMPLETE - do not cut off mid-sentence
`;
}



// ==================== GENERATE QUIZ ENDPOINT ====================
app.post('/api/generate-quiz', async (req, res) => {
  const { email, rounds, questionsPerRound, difficulty } = req.body;

  if (!email || !rounds || !questionsPerRound || !difficulty) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    console.log('📝 Generating quiz for:', email, { rounds, questionsPerRound, difficulty });

    // 🔥 LOAD PROFILE (Firebase compatible)
    const sanitizedEmail = email.toLowerCase().trim().replace(/[@.]/g, '_');
    let userProfile = null;
    let source = null;

    // Try Firestore first
    const docIds = [sanitizedEmail, email.toLowerCase().trim()];
    for (const docId of docIds) {
      try {
        const docRef = db.collection('career_profiles').doc(docId);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
          userProfile = docSnap.data();
          source = `Firestore: ${docId}`;
          console.log(`✅ Found profile in ${source}`);
          break;
        }
      } catch (err) {
        continue;
      }
    }

    // Try Firebase Storage
    if (!userProfile) {
      const storagePaths = [
        `career_profiles/${sanitizedEmail}.json`,
        `career_profiles/${email.toLowerCase().trim()}.json`
      ];
      
      for (const path of storagePaths) {
        try {
          const file = bucket.file(path);
          const [exists] = await file.exists();
          if (exists) {
            const [contents] = await file.download();
            userProfile = JSON.parse(contents.toString());
            source = `Storage: ${path}`;
            console.log(`✅ Found profile in ${source}`);
            break;
          }
        } catch (err) {
          continue;
        }
      }
    }

    if (!userProfile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    console.log('✅ Profile loaded successfully');

    // ✅ FIXED: Declare usedModel BEFORE loop
    let result = null;
    let usedModel = null;  // 🔥 MOVED UP HERE

    // Gemini models
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const modelsToTry = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash-exp'];

    const techSkills = userProfile.technicalSkills || [];
    const careerGoal = userProfile.careerInterestArea || 'general career development';

    // Same detailed prompt as original
    const prompt = `You are an expert career assessment system. Generate a personalized career assessment quiz.

USER PROFILE:
Name: ${userProfile.fullName || 'Student'}
Skills: ${techSkills.join(', ') || 'None listed'}
Career Interest: ${careerGoal}
Education: ${userProfile.degree || 'Not specified'} in ${userProfile.department || 'Not specified'}

QUIZ CONFIGURATION:
- Total Rounds: ${rounds}
- Questions per Round: ${questionsPerRound}
- Difficulty Level: ${difficulty}
- Total Questions: ${rounds * questionsPerRound}

**OUTPUT FORMAT (STRICT JSON):**
{
  "rounds": [
    {
      "roundNumber": 1,
      "category": "Technical Skills Assessment",
      "questions": [
        {
          "questionId": "r1q1",
          "question": "What is the primary purpose of React hooks?",
          "options": {
            "A": "To manage component styling",
            "B": "To use state and lifecycle features in functional components",
            "C": "To handle API requests", 
            "D": "To optimize performance only"
          },
          "correctAnswer": "B",
          "explanation": "React hooks allow functional components to use state and lifecycle features.",
          "skillTested": "React",
          "difficulty": "${difficulty}"
        }
      ]
    }
  ]
}

Generate EXACTLY ${questionsPerRound} questions per round. Return ONLY valid JSON.`;

    // ✅ FIXED: Loop properly declares usedModel
    for (const modelName of modelsToTry) {
      try {
        console.log(`🤖 Trying model: ${modelName}...`);
        const model = genAI.getGenerativeModel({ model: modelName });
        result = await model.generateContent(prompt);
        usedModel = modelName;  // ✅ Now accessible outside loop
        console.log(`✅ SUCCESS with ${modelName}`);
        break;
      } catch (error) {
        console.log(`❌ ${modelName} failed:`, error.message);
        if (error.status === 429) continue;
      }
    }

    if (!result || !usedModel) {  // ✅ Check both
      // 🔥 GENERATE MOCK QUIZ INSTEAD OF ERROR
      console.log('⚠️ All AI models failed. Generating mock quiz...');
      
      const mockQuizData = {
        rounds: [{
          roundNumber: 1,
          category: "General Assessment",
          questions: [
            {
              questionId: "r1q1",
              question: "What is version control used for?",
              options: {
                A: "Writing code",
                B: "Tracking code changes",
                C: "Compiling programs",
                D: "Debugging"
              },
              correctAnswer: "B",
              explanation: "Version control tracks and manages code changes.",
              skillTested: "Version Control",
              difficulty: difficulty
            },
            {
              questionId: "r1q2",
              question: "Which data structure uses LIFO?",
              options: {
                A: "Queue",
                B: "Array",
                C: "Stack",
                D: "List"
              },
              correctAnswer: "C",
              explanation: "Stack uses Last In First Out.",
              skillTested: "Data Structures",
              difficulty: difficulty
            },
            {
              questionId: "r1q3",
              question: "What is binary search complexity?",
              options: {
                A: "O(n)",
                B: "O(log n)",
                C: "O(n²)",
                D: "O(1)"
              },
              correctAnswer: "B",
              explanation: "Binary search is O(log n).",
              skillTested: "Algorithms",
              difficulty: difficulty
            },
            {
              questionId: "r1q4",
              question: "Which is NOT an OOP principle?",
              options: {
                A: "Encapsulation",
                B: "Inheritance",
                C: "Compilation",
                D: "Polymorphism"
              },
              correctAnswer: "C",
              explanation: "Compilation is not an OOP principle.",
              skillTested: "OOP",
              difficulty: difficulty
            },
            {
              questionId: "r1q5",
              question: "What is most important in programming?",
              options: {
                A: "Memorizing syntax",
                B: "Problem-solving",
                C: "Typing speed",
                D: "Tool knowledge"
              },
              correctAnswer: "B",
              explanation: "Problem-solving is fundamental.",
              skillTested: "Core Skills",
              difficulty: difficulty
            }
          ]
        }]
      };

      const quiz = {
        quizId: `quiz_${Date.now()}`,
        userEmail: email,
        generatedAt: new Date().toISOString(),
        configuration: {
          rounds,
          questionsPerRound,
          difficulty,
          totalQuestions: rounds * questionsPerRound
        },
        quizData: mockQuizData.rounds,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        modelUsed: 'mock-fallback'
      };

      return res.json({
        success: true,
        quiz,
        modelUsed: 'mock-fallback'
      });
    }

    console.log('✅ Received response from Gemini using:', usedModel);
    
    // Parse quiz (same as original)
    const responseText = result.response.text().trim();
    let cleanedResponse = responseText;
    if (cleanedResponse.startsWith('```json')) {
      cleanedResponse = cleanedResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    }
    
    const quizData = JSON.parse(cleanedResponse);

    // Build complete quiz object (same as original)
    const quiz = {
      quizId: `quiz_${Date.now()}`,
      userEmail: email,
      generatedAt: new Date().toISOString(),
      configuration: {
        rounds,
        questionsPerRound,
        difficulty,
        totalQuestions: rounds * questionsPerRound
      },
      quizData: quizData.rounds,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      modelUsed: usedModel  // ✅ Now defined!
    };

    console.log('✅ Quiz generated successfully using:', usedModel);

    res.json({
      success: true,
      quiz,
      modelUsed: usedModel  // ✅ SAFE!
    });

  } catch (error) {
    console.error('❌ Quiz generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate quiz',
      details: error.message 
    });
  }
});


// ✅ COMPLETE /api/submit-quiz ENDPOINT WITH MODEL FALLBACK
// Replace your entire app.post('/api/submit-quiz', ...) function with this

app.post('/api/submit-quiz', async (req, res) => {
  const { email, quizId, answers, timeTaken, configuration } = req.body;

  if (!email || !quizId || !answers) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    console.log('📊 Submitting quiz for:', email);

    // Load profile
    const sanitizedEmail = email.toLowerCase().trim().replace(/[@.]/g, '_');
    let userProfile = null;

    const docIds = [sanitizedEmail, email.toLowerCase().trim()];
    for (const docId of docIds) {
      try {
        const docSnap = await db.collection('career_profiles').doc(docId).get();
        if (docSnap.exists) {
          userProfile = docSnap.data();
          break;
        }
      } catch (err) {}
    }

    if (!userProfile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Calculate scores
    let totalCorrect = 0, totalQuestions = 0;
    const roundResults = [];
    const skillPerformance = {};

    answers.rounds.forEach((round, index) => {
      let roundCorrect = 0;
      const processedQuestions = round.questions.map(q => {
        totalQuestions++;
        const isCorrect = q.userAnswer === q.correctAnswer;
        if (isCorrect) {
          roundCorrect++;
          totalCorrect++;
        }
        if (q.skillTested) {
          if (!skillPerformance[q.skillTested]) {
            skillPerformance[q.skillTested] = { total: 0, correct: 0 };
          }
          skillPerformance[q.skillTested].total++;
          if (isCorrect) skillPerformance[q.skillTested].correct++;
        }
        return { ...q, isCorrect };
      });

      roundResults.push({
        roundNumber: index + 1,
        category: round.category,
        questions: processedQuestions,
        roundScore: roundCorrect,
        totalQuestions: round.questions.length,
        percentage: Math.round((roundCorrect / round.questions.length) * 100)
      });
    });

    const overallPercentage = Math.round((totalCorrect / totalQuestions) * 100);

    // Get quiz number
    const quizResultsRef = db.collection('quiz_results').doc(sanitizedEmail);
    const quizDoc = await quizResultsRef.get();
    const existingData = quizDoc.exists ? quizDoc.data() : { quizHistory: [], quizCount: 0 };
    const quizNumber = existingData.quizCount + 1;

    // ✅ GEMINI MODELS TO TRY (IN ORDER OF PREFERENCE)
    const modelsToTry = [
      { name: 'gemini-2.5-flash', maxTokens: 32768 },
      { name: 'gemini-flash-latest', maxTokens: 32768 },
      { name: 'gemini-2.5-pro', maxTokens: 32768 },
      { name: 'gemini-2.0-flash', maxTokens: 8192 },
      { name: 'gemini-pro-latest', maxTokens: 32768 }
    ];

    // ✅ COMPREHENSIVE ANALYSIS GENERATION WITH FALLBACK
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    const comprehensivePrompt = `You are an expert career counselor. Analyze this quiz performance and generate a COMPLETE career development plan.

**STUDENT PROFILE:**
Name: ${userProfile.fullName}
Education: ${userProfile.degree} in ${userProfile.department}
Current Year: ${userProfile.currentYear || 'Graduated'}
Career Interest: ${userProfile.careerInterestArea}
Skills: ${(userProfile.technicalSkills || []).slice(0, 8).join(', ')}

**QUIZ PERFORMANCE:**
Score: ${totalCorrect}/${totalQuestions} (${overallPercentage}%)
Time Taken: ${Math.round(timeTaken/1000)} seconds
Skill Performance: ${Object.entries(skillPerformance).map(([skill, perf]) => 
  `${skill}: ${perf.correct}/${perf.total}`
).join(', ')}

**CRITICAL: Return ONLY valid JSON in this EXACT format. No markdown, no explanations, no code blocks:**

{
  "careerReadiness": ${overallPercentage},
  "percentile": ${Math.min(95, Math.round(overallPercentage * 0.9))},
  "strengthAreas": ["List 3 specific skills from quiz"],
  "weaknessAreas": ["List 3 specific weak areas"],
  "primaryCareer": {
    "role": "Best job role for student",
    "matchPercentage": ${Math.min(95, overallPercentage + 15)},
    "whyGoodFit": "2-3 sentences why good fit",
    "averageSalary": "₹X-Y LPA",
    "topCompanies": ["Company1", "Company2", "Company3"]
  },
  "secondaryCareer": {
    "role": "Alternative role",
    "matchPercentage": ${Math.max(60, overallPercentage - 5)},
    "whyGoodFit": "Brief explanation",
    "averageSalary": "₹X-Y LPA"
  },
  "learningRoadmap": {
    "immediate": {
      "title": "Week 1-2: Foundation",
      "tasks": ["Task1", "Task2", "Task3"],
      "estimatedHours": 20
    },
    "shortTerm": {
      "title": "Month 1-2: Core Skills",
      "tasks": ["Task1", "Task2", "Task3"],
      "estimatedHours": 80
    },
    "longTerm": {
      "title": "Month 3-6: Advanced",
      "tasks": ["Task1", "Task2"],
      "estimatedHours": 150
    }
  },
  "documentationResources": [
    {
      "name": "Resource name",
      "url": "https://example.com",
      "category": "Category",
      "priority": "High"
    }
  ],
  "youtubeResources": [
    {
      "channel": "Channel",
      "topic": "Topic",
      "url": "https://youtube.com/...",
      "duration": "10h",
      "difficulty": "Beginner"
    }
  ],
  "practicePlatforms": [
    {
      "name": "LeetCode",
      "url": "https://leetcode.com",
      "focus": "DSA",
      "difficulty": "All",
      "recommendation": "Start with Easy"
    }
  ],
  "projectSuggestions": [
    {
      "title": "Project name",
      "description": "What to build",
      "skills": ["Skill1", "Skill2"],
      "difficulty": "Beginner",
      "estimatedTime": "1 week",
      "keyFeatures": ["Feature1", "Feature2"]
    }
  ],
  "certifications": [
    {
      "name": "Cert name",
      "provider": "Provider",
      "cost": "Cost",
      "duration": "Time",
      "priority": "High",
      "whyUseful": "Why useful"
    }
  ],
  "jobRoleMapping": {
    "currentLevel": "Entry Level",
    "readyFor": ["Role1", "Role2"],
    "needsWork": ["Gap1"],
    "salaryRange": "₹X-Y LPA",
    "jobBoards": ["Naukri", "LinkedIn"]
  },
  "recommendations": [
    "Action 1",
    "Action 2",
    "Action 3"
  ]
}`;

    // Default fallback data
    let comprehensiveAnalysis = {
      careerReadiness: overallPercentage,
      percentile: Math.min(95, Math.round(overallPercentage * 0.9)),
      strengthAreas: ['Problem Solving', 'Quick Learning', 'Attention to Detail'],
      weaknessAreas: ['Advanced Concepts', 'Practical Application', 'Time Management'],
      primaryCareer: {
        role: userProfile.careerInterestArea || 'Software Developer',
        matchPercentage: Math.min(95, overallPercentage + 15),
        whyGoodFit: 'Based on your educational background and technical skills, this role aligns well with your career interests and current skill level.',
        averageSalary: '₹4-8 LPA',
        topCompanies: ['TCS', 'Infosys', 'Wipro']
      },
      secondaryCareer: {
        role: 'Full-Stack Developer',
        matchPercentage: Math.max(60, overallPercentage - 5),
        whyGoodFit: 'Alternative career path that leverages your technical foundation with opportunities for growth.',
        averageSalary: '₹5-10 LPA'
      },
      learningRoadmap: {
        immediate: {
          title: 'Week 1-2: Foundation Building',
          tasks: ['Review core programming concepts', 'Practice coding daily for 1-2 hours', 'Complete beginner-level tutorials'],
          estimatedHours: 20
        },
        shortTerm: {
          title: 'Month 1-2: Core Skill Development',
          tasks: ['Complete a structured online course', 'Build 2-3 mini projects', 'Join online coding communities'],
          estimatedHours: 80
        },
        longTerm: {
          title: 'Month 3-6: Advanced Skills & Job Readiness',
          tasks: ['Build a comprehensive portfolio project', 'Contribute to open source', 'Prepare for technical interviews'],
          estimatedHours: 150
        }
      },
      documentationResources: [
        { name: 'MDN Web Docs', url: 'https://developer.mozilla.org', category: 'Web Development', priority: 'High' },
        { name: 'W3Schools', url: 'https://w3schools.com', category: 'Web Basics', priority: 'Medium' }
      ],
      youtubeResources: [
        { channel: 'freeCodeCamp', topic: 'Full Stack Course', url: 'https://youtube.com/@freecodecamp', duration: '10 hours', difficulty: 'Beginner' },
        { channel: 'Traversy Media', topic: 'Web Development', url: 'https://youtube.com/@TraversyMedia', duration: '5 hours', difficulty: 'Beginner' }
      ],
      practicePlatforms: [
        { name: 'LeetCode', url: 'https://leetcode.com', focus: 'DSA & Problem Solving', difficulty: 'All Levels', recommendation: 'Start with Easy problems, solve 2-3 daily' },
        { name: 'HackerRank', url: 'https://hackerrank.com', focus: 'Coding Practice', difficulty: 'Beginner to Advanced', recommendation: 'Complete tutorials then challenges' }
      ],
      projectSuggestions: [
        {
          title: 'Personal Portfolio Website',
          description: 'Build a responsive portfolio to showcase your projects and skills',
          skills: ['HTML', 'CSS', 'JavaScript'],
          difficulty: 'Beginner',
          estimatedTime: '1 week',
          keyFeatures: ['Responsive design', 'Project showcase', 'Contact form']
        },
        {
          title: 'Todo Application',
          description: 'Create a full-stack todo app with CRUD operations',
          skills: ['React', 'Node.js', 'MongoDB'],
          difficulty: 'Intermediate',
          estimatedTime: '2 weeks',
          keyFeatures: ['User authentication', 'Database integration', 'RESTful API']
        }
      ],
      certifications: [
        {
          name: 'Google IT Support Certificate',
          provider: 'Google (Coursera)',
          cost: 'Free (with financial aid)',
          duration: '3-6 months',
          priority: 'Medium',
          whyUseful: 'Industry-recognized certification that builds foundational IT skills'
        },
        {
          name: 'AWS Cloud Practitioner',
          provider: 'Amazon Web Services',
          cost: '$100',
          duration: '1-2 months prep',
          priority: 'High',
          whyUseful: 'Entry-level cloud certification highly valued by employers'
        }
      ],
      jobRoleMapping: {
        currentLevel: 'Entry Level',
        readyFor: ['Junior Developer', 'Software Engineer Intern', 'Frontend Developer'],
        needsWork: ['Build portfolio projects', 'Gain practical experience', 'Improve problem-solving skills'],
        salaryRange: '₹3-6 LPA',
        jobBoards: ['Naukri.com', 'LinkedIn', 'Internshala', 'AngelList']
      },
      recommendations: [
        'Build 2-3 portfolio projects showcasing your best work',
        'Practice DSA problems daily on LeetCode/HackerRank',
        'Network actively on LinkedIn and attend tech meetups',
        'Contribute to open-source projects on GitHub'
      ]
    };

    // ✅ TRY EACH MODEL UNTIL ONE WORKS
    let aiSuccess = false;
    let lastError = null;

    for (const modelConfig of modelsToTry) {
      try {
        console.log(`🤖 Trying model: ${modelConfig.name}...`);
        
        const model = genAI.getGenerativeModel({ 
          model: modelConfig.name,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: modelConfig.maxTokens
          }
        });

        const result = await model.generateContent(comprehensivePrompt);
        let text = result.response.text().trim();
        
        // Remove markdown code blocks
        text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        
        console.log(`✅ ${modelConfig.name} response received (${text.length} chars)`);
        console.log('📄 First 300 chars:', text.substring(0, 300));
        
        // Try to parse
        const parsed = JSON.parse(text);
        
        // Validate structure
        if (parsed.primaryCareer && parsed.secondaryCareer && parsed.learningRoadmap) {
          comprehensiveAnalysis = { ...comprehensiveAnalysis, ...parsed };
          console.log(`✅ Successfully generated analysis with ${modelConfig.name}`);
          aiSuccess = true;
          break;
        } else {
          console.log(`⚠️ ${modelConfig.name} response missing required fields`);
          lastError = 'Missing required fields in response';
        }
      } catch (err) {
        console.log(`❌ ${modelConfig.name} failed:`, err.message);
        lastError = err.message;
        continue; // Try next model
      }
    }

    if (!aiSuccess) {
      console.log('⚠️ All models failed, using comprehensive fallback data');
      console.log('Last error:', lastError);
    }

    // Build result
    const newQuizResult = {
      quizId,
      quizNumber,
      timestamp: new Date().toISOString(),
      configuration,
      overallScore: { totalCorrect, totalQuestions, percentage: overallPercentage, timeTaken },
      rounds: roundResults,
      comprehensiveAnalysis,
      skillPerformance,
      aiGenerated: aiSuccess
    };

    // Save to Firestore
    const updatedData = {
      userEmail: email,
      quizCount: quizNumber,
      quizHistory: [newQuizResult, ...(existingData.quizHistory || []).slice(0, 9)],
      aggregateStats: {
        totalQuizzes: quizNumber,
        averageScore: Math.round(
          ([newQuizResult, ...(existingData.quizHistory || [])].reduce((sum, q) => sum + q.overallScore.percentage, 0)) / quizNumber
        ),
        bestScore: Math.max(overallPercentage, ...(existingData.quizHistory || []).map(q => q.overallScore.percentage))
      }
    };

    await quizResultsRef.set(updatedData);

    
// 🔥 ADD GOOGLE SHEETS RIGHT HERE 👇
 // ============================================
    // ✅ 7. SAVE TO GOOGLE SHEETS (SIMPLIFIED CALL)
    // ============================================
    try {
      const sheetsSaved = await saveQuizToGoogleSheets({
        userProfile,
        email,
        quizNumber,
        timestamp: newQuizResult.timestamp,
        overallScore: newQuizResult.overallScore,
        comprehensiveAnalysis: newQuizResult.comprehensiveAnalysis,
        rounds: newQuizResult.rounds,
        skillPerformance: newQuizResult.skillPerformance
      });

      if (sheetsSaved) {
        console.log(`✅ Quiz #${quizNumber} → Google Sheets SUCCESS`);
      } else {
        console.log('⚠️ Google Sheets save skipped (disabled or failed)');
      }
    } catch (sheetError) {
      console.error('❌ Google Sheets error:', sheetError.message);
      // Don't fail the request - data is already in Firestore
    }


    // ✅ SEND EMAIL
    const mailOptions = {
      from: process.env.EMAIL,
      to: email,
      subject: `🎉 Your Complete Career Development Plan - Quiz #${quizNumber}`,
      html: generateComprehensiveEmailHTML(userProfile, overallPercentage, totalCorrect, totalQuestions, quizNumber, comprehensiveAnalysis, timeTaken)
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent for Quiz #${quizNumber}`);

    // ✅ RETURN RESPONSE
    res.json({
      success: true,
      message: `Quiz #${quizNumber} submitted! Check your email for complete career plan.`,
      results: {
        quizNumber,
        overallScore: newQuizResult.overallScore,
        rounds: newQuizResult.rounds,
        comprehensiveAnalysis: newQuizResult.comprehensiveAnalysis,
        skillPerformance: newQuizResult.skillPerformance,
        aiGenerated: aiSuccess
      }
    });

  } catch (error) {
    console.error('❌ Quiz submission error:', error);
    res.status(500).json({ error: 'Failed to submit quiz', message: error.message });
  }
});


// ✅ COMPLETE EMAIL HTML GENERATOR - Replace your existing function
function generateComprehensiveEmailHTML(userProfile, percentage, correct, total, quizNum, analysis, timeTaken) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { 
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
      line-height: 1.6; 
      color: #333; 
      margin: 0;
      padding: 0;
      background-color: #f5f5f5;
    }
    .container { 
      max-width: 700px; 
      margin: 0 auto; 
      padding: 20px; 
      background-color: #ffffff;
    }
    .header { 
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
      color: white; 
      padding: 30px; 
      border-radius: 12px; 
      text-align: center; 
      margin-bottom: 20px;
    }
    .header h1 { margin: 0 0 10px 0; font-size: 26px; }
    .header p { margin: 5px 0; opacity: 0.95; }
    
    .score-box { 
      background: ${percentage >= 70 ? '#d4edda' : percentage >= 50 ? '#fff3cd' : '#f8d7da'}; 
      padding: 25px; 
      border-radius: 10px; 
      margin: 20px 0; 
      text-align: center; 
    }
    .score-big { 
      font-size: 48px; 
      font-weight: bold; 
      color: ${percentage >= 70 ? '#155724' : percentage >= 50 ? '#856404' : '#721c24'}; 
      margin: 10px 0; 
    }
    
    .section { 
      margin: 25px 0; 
      padding: 20px; 
      background: #f8f9fa; 
      border-radius: 10px; 
      border-left: 4px solid #667eea; 
    }
    .section-title { 
      color: #667eea; 
      font-size: 20px; 
      font-weight: bold; 
      margin-bottom: 15px; 
      display: flex;
      align-items: center;
    }
    
    .career-card { 
      background: white; 
      padding: 20px; 
      border-radius: 8px; 
      margin: 15px 0; 
      box-shadow: 0 2px 8px rgba(0,0,0,0.1); 
    }
    .career-card h3 { margin: 0 0 10px 0; color: #667eea; }
    .career-card h4 { margin: 0 0 10px 0; color: #f59e0b; }
    
    .badge { 
      display: inline-block; 
      padding: 6px 14px; 
      border-radius: 20px; 
      font-size: 13px; 
      font-weight: 600; 
      margin: 5px; 
    }
    .badge-green { background: #d4edda; color: #155724; }
    .badge-orange { background: #fff3cd; color: #856404; }
    
    .roadmap-box {
      background: white;
      padding: 16px;
      border-radius: 8px;
      margin: 12px 0;
      border-left: 4px solid;
    }
    .roadmap-immediate { border-left-color: #4caf50; background: #e8f5e9; }
    .roadmap-short { border-left-color: #ff9800; background: #fff3e0; }
    .roadmap-long { border-left-color: #2196f3; background: #e3f2fd; }
    
    .resource-item { 
      background: white; 
      padding: 15px; 
      margin: 10px 0; 
      border-radius: 6px; 
      border-left: 3px solid #667eea; 
    }
    .resource-item strong { color: #667eea; }
    .resource-item a { color: #667eea; text-decoration: none; }
    
    .project-card {
      background: #e3f2fd;
      padding: 18px;
      margin: 12px 0;
      border-radius: 8px;
    }
    .project-card h4 { margin: 0 0 8px 0; color: #0277bd; }
    
    .btn { 
      display: inline-block; 
      padding: 12px 28px; 
      background: #667eea; 
      color: white !important; 
      text-decoration: none; 
      border-radius: 6px; 
      font-weight: 600; 
      margin: 10px 5px; 
    }
    
    ul { padding-left: 20px; margin: 10px 0; }
    li { margin: 8px 0; line-height: 1.6; }
    
    .footer {
      text-align: center;
      padding: 30px;
      background: #f8f9fa;
      border-radius: 10px;
      margin-top: 30px;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <h1>🎉 Quiz #${quizNum} - Complete Career Plan</h1>
      <p>Hi ${userProfile.fullName || 'Student'},</p>
      <p>Your personalized career development roadmap is ready!</p>
    </div>

    <!-- Score Summary -->
    <div class="score-box">
      <div class="score-big">${percentage}%</div>
      <p style="font-size: 18px; margin: 5px 0;">${correct}/${total} Correct</p>
      <p style="font-size: 14px; color: #666;">⏱️ ${Math.round(timeTaken/1000)} seconds</p>
      <p style="font-size: 16px; font-weight: 600; margin-top: 10px;">📊 Percentile: ${analysis.percentile}th</p>
    </div>

    <!-- Quick Summary -->
    <div class="section">
      <div class="section-title">📋 Quick Summary</div>
      <p><strong>Career Readiness:</strong> ${analysis.careerReadiness}/100</p>
      <p><strong>Strengths:</strong></p>
      ${analysis.strengthAreas.map(s => `<span class="badge badge-green">✓ ${s}</span>`).join(' ')}
      <p style="margin-top: 15px;"><strong>Areas to Improve:</strong></p>
      ${analysis.weaknessAreas.map(w => `<span class="badge badge-orange">⚠ ${w}</span>`).join(' ')}
    </div>

    <!-- Career Recommendations -->
    <div class="section">
      <div class="section-title">🎯 Career Recommendations</div>
      
      <!-- Primary Career -->
      <div class="career-card">
        <h3>🥇 ${analysis.primaryCareer.role}</h3>
        <p><strong>Match:</strong> ${analysis.primaryCareer.matchPercentage}%</p>
        <p>${analysis.primaryCareer.whyGoodFit}</p>
        <p><strong>💰 Salary:</strong> ${analysis.primaryCareer.averageSalary}</p>
        ${analysis.primaryCareer.topCompanies ? `<p><strong>🏢 Top Companies:</strong> ${analysis.primaryCareer.topCompanies.join(', ')}</p>` : ''}
      </div>

      <!-- Secondary Career -->
      ${analysis.secondaryCareer ? `
      <div class="career-card">
        <h4>🥈 ${analysis.secondaryCareer.role}</h4>
        <p><strong>Match:</strong> ${analysis.secondaryCareer.matchPercentage}%</p>
        <p>${analysis.secondaryCareer.whyGoodFit}</p>
        <p><strong>💰 Salary:</strong> ${analysis.secondaryCareer.averageSalary}</p>
      </div>
      ` : ''}
    </div>

    <!-- Learning Roadmap -->
    <div class="section">
      <div class="section-title">📚 Your Learning Roadmap</div>
      
      ${analysis.learningRoadmap.immediate ? `
      <div class="roadmap-box roadmap-immediate">
        <h4 style="color: #2e7d32; margin: 0 0 8px 0;">🚀 ${analysis.learningRoadmap.immediate.title}</h4>
        <p><strong>Focus Time:</strong> ${analysis.learningRoadmap.immediate.estimatedHours} hours</p>
        <ul>
          ${analysis.learningRoadmap.immediate.tasks.map(task => `<li>${task}</li>`).join('')}
        </ul>
      </div>
      ` : ''}

      ${analysis.learningRoadmap.shortTerm ? `
      <div class="roadmap-box roadmap-short">
        <h4 style="color: #e65100; margin: 0 0 8px 0;">📅 ${analysis.learningRoadmap.shortTerm.title}</h4>
        <p><strong>Focus Time:</strong> ${analysis.learningRoadmap.shortTerm.estimatedHours} hours</p>
        <ul>
          ${analysis.learningRoadmap.shortTerm.tasks.map(task => `<li>${task}</li>`).join('')}
        </ul>
      </div>
      ` : ''}

      ${analysis.learningRoadmap.longTerm ? `
      <div class="roadmap-box roadmap-long">
        <h4 style="color: #0277bd; margin: 0 0 8px 0;">🎯 ${analysis.learningRoadmap.longTerm.title}</h4>
        <p><strong>Focus Time:</strong> ${analysis.learningRoadmap.longTerm.estimatedHours} hours</p>
        <ul>
          ${analysis.learningRoadmap.longTerm.tasks.map(task => `<li>${task}</li>`).join('')}
        </ul>
      </div>
      ` : ''}
    </div>

    <!-- Documentation Resources -->
    ${analysis.documentationResources && analysis.documentationResources.length > 0 ? `
    <div class="section">
      <div class="section-title">📖 Official Documentation</div>
      ${analysis.documentationResources.map(doc => `
        <div class="resource-item">
          <strong>${doc.name}</strong> - ${doc.category}
          <br><a href="${doc.url}">${doc.url}</a>
          <br><span class="badge badge-${doc.priority === 'High' ? 'green' : 'orange'}">${doc.priority} Priority</span>
        </div>
      `).join('')}
    </div>
    ` : ''}

    <!-- YouTube Resources -->
    ${analysis.youtubeResources && analysis.youtubeResources.length > 0 ? `
    <div class="section">
      <div class="section-title">🎥 YouTube Learning</div>
      ${analysis.youtubeResources.map(yt => `
        <div class="resource-item">
          <strong>${yt.channel}</strong> - ${yt.topic}
          <br>Duration: ${yt.duration} | Difficulty: ${yt.difficulty}
          <br><a href="${yt.url}" class="btn" style="margin-top: 10px;">Watch Course</a>
        </div>
      `).join('')}
    </div>
    ` : ''}

    <!-- Practice Platforms -->
    ${analysis.practicePlatforms && analysis.practicePlatforms.length > 0 ? `
    <div class="section">
      <div class="section-title">💻 Hands-on Practice (CRITICAL 🔥)</div>
      ${analysis.practicePlatforms.map(platform => `
        <div class="resource-item">
          <h4 style="margin: 0 0 8px 0; color: #667eea;">${platform.name}</h4>
          <p><strong>Focus:</strong> ${platform.focus}</p>
          <p><strong>Difficulty:</strong> ${platform.difficulty}</p>
          <p><strong>💡 Tip:</strong> ${platform.recommendation}</p>
          <a href="${platform.url}" class="btn">Start Practicing</a>
        </div>
      `).join('')}
    </div>
    ` : ''}

    <!-- Project Suggestions -->
    ${analysis.projectSuggestions && analysis.projectSuggestions.length > 0 ? `
    <div class="section">
      <div class="section-title">🚀 Build These Projects</div>
      ${analysis.projectSuggestions.map(proj => `
        <div class="project-card">
          <h4>${proj.title}</h4>
          <p>${proj.description}</p>
          <p><strong>Skills:</strong> ${proj.skills.join(', ')}</p>
          <p><strong>Time:</strong> ${proj.estimatedTime} | <strong>Level:</strong> ${proj.difficulty}</p>
          ${proj.keyFeatures ? `
          <p><strong>Key Features:</strong></p>
          <ul>
            ${proj.keyFeatures.map(f => `<li>${f}</li>`).join('')}
          </ul>
          ` : ''}
        </div>
      `).join('')}
    </div>
    ` : ''}

    <!-- Certifications -->
    ${analysis.certifications && analysis.certifications.length > 0 ? `
    <div class="section">
      <div class="section-title">🎓 Recommended Certifications</div>
      ${analysis.certifications.map(cert => `
        <div class="resource-item">
          <h4 style="margin: 0 0 8px 0; color: #667eea;">${cert.name}</h4>
          <p><strong>Provider:</strong> ${cert.provider}</p>
          <p><strong>Cost:</strong> ${cert.cost} | <strong>Prep Time:</strong> ${cert.duration}</p>
          <p><strong>Why Useful:</strong> ${cert.whyUseful}</p>
          <span class="badge badge-${cert.priority === 'High' ? 'green' : 'orange'}">${cert.priority} Priority</span>
        </div>
      `).join('')}
    </div>
    ` : ''}

    <!-- Job Role Mapping -->
    ${analysis.jobRoleMapping ? `
    <div class="section">
      <div class="section-title">💼 Job Market Reality Check</div>
      <div class="career-card">
        <p><strong>Current Level:</strong> ${analysis.jobRoleMapping.currentLevel}</p>
        <p><strong>✅ You're Ready For:</strong></p>
        <ul>
          ${analysis.jobRoleMapping.readyFor.map(role => `<li>${role}</li>`).join('')}
        </ul>
        ${analysis.jobRoleMapping.needsWork ? `
        <p><strong>⚠️ Still Need Work:</strong></p>
        <ul>
          ${analysis.jobRoleMapping.needsWork.map(need => `<li>${need}</li>`).join('')}
        </ul>
        ` : ''}
        <p><strong>💰 Expected Salary:</strong> ${analysis.jobRoleMapping.salaryRange}</p>
        <p><strong>🔍 Apply Here:</strong> ${analysis.jobRoleMapping.jobBoards.join(', ')}</p>
      </div>
    </div>
    ` : ''}

    <!-- Action Items -->
    ${analysis.recommendations && analysis.recommendations.length > 0 ? `
    <div class="section">
      <div class="section-title">🎯 Action Items (Start Today!)</div>
      <ul>
        ${analysis.recommendations.map(rec => `<li><strong>${rec}</strong></li>`).join('')}
      </ul>
    </div>
    ` : ''}

    <!-- Footer -->
    <div class="footer">
      <p style="font-size: 16px; color: #667eea; font-weight: bold;">🚀 Your Career Journey Starts Now!</p>
      <p style="font-size: 14px; color: #666;">Keep this email as your roadmap. Check off tasks as you complete them.</p>
      <p style="font-size: 12px; color: #999; margin-top: 20px;">Powered by Career Guidance AI • Quiz #${quizNum}</p>
    </div>
  </div>
</body>
</html>
  `;
}


app.get('/api/quiz-results/:email', async (req, res) => {
  try {
    const email = req.params.email;
    const sanitizedEmail = email.toLowerCase().trim().replace(/[@.]/g, '_');
    
    const quizRef = db.collection('quiz_results').doc(sanitizedEmail);
    const quizSnap = await quizRef.get();

    if (!quizSnap.exists) {
      return res.json({
        success: true,
        hasQuizHistory: false,
        message: 'No quiz history found'
      });
    }

    const quizData = quizSnap.data();
    res.json({
      success: true,
      hasQuizHistory: true,
      results: quizData
    });

  } catch (error) {
    console.error('Error fetching quiz results:', error);
    res.status(500).json({ error: 'Failed to fetch quiz results' });
  }
});


app.post('/api/setup-google-sheet', async (req, res) => {
  const result = await setupGoogleSheet();
  res.json(result);
});




// ==================== ULTRA-DEEP GITHUB ANALYSIS + AI CAREER GUIDANCE ====================
app.post('/api/analyze-github', async (req, res) => {
  const { email, githubUsername, profileData } = req.body;

  if (!githubUsername) {
    return res.status(400).json({ error: 'GitHub username required' });
  }

  try {
    console.log(`🔍 ULTRA-DEEP Analysis: ${githubUsername}`);

    // ==================== GITHUB API SETUP ====================
    const GH_HEADERS = {
      Accept: 'application/vnd.github+json',
      ...(process.env.GITHUB_TOKEN && { 
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}` 
      })
    };

    const ghFetch = async (url) => {
      const response = await fetch(url, { headers: GH_HEADERS });
      if (!response.ok) throw new Error(`GitHub API ${response.status}`);
      return response.json();
    };

    // ==================== 1️⃣ USER PROFILE ====================
    const user = await ghFetch(`https://api.github.com/users/${githubUsername}`);

    // ==================== 2️⃣ FETCH ALL REPOSITORIES ====================
    let repos = [];
    let page = 1;
    while (page <= 3) {
      const batch = await ghFetch(
        `https://api.github.com/users/${githubUsername}/repos?per_page=100&page=${page}&sort=updated`
      );
      if (batch.length === 0) break;
      repos.push(...batch);
      if (batch.length < 100) break;
      page++;
    }

    console.log(`📦 Found ${repos.length} repositories`);

    // ==================== TRACKING VARIABLES ====================
    let totalStars = 0;
    let totalForks = 0;
    let languageBytes = {};
    let frameworks = new Set();
    let databases = new Set();
    let cloudServices = new Set();
    let buildTools = new Set();
    let projectTypes = new Set();
    let frontendSkills = new Set();
    let backendSkills = new Set();
    let readmeScores = [];
    let totalCommits = 0;
    let activeRepos = 0;
    let topRepos = [];
    let hasDocker = false;
    let hasTests = false;
    let hasCI = false;
    let hasLiveDemo = 0;

    // ==================== 3️⃣ ULTRA-DEEP REPO ANALYSIS ====================
    const analyzeRepo = async (repo) => {
      try {
        totalStars += repo.stargazers_count;
        totalForks += repo.forks_count;

        topRepos.push({
          name: repo.name,
          description: repo.description || 'No description',
          stars: repo.stargazers_count,
          forks: repo.forks_count,
          language: repo.language,
          updated: new Date(repo.updated_at).toLocaleDateString(),
          url: repo.html_url
        });

        // ==================== LANGUAGES (BYTE-LEVEL) ====================
        try {
          const langs = await ghFetch(repo.languages_url);
          for (const [lang, bytes] of Object.entries(langs)) {
            languageBytes[lang] = (languageBytes[lang] || 0) + bytes;
          }
        } catch {}

        // ==================== GET REPO FILE TREE ====================
        let files = [];
        let fileContents = {};
        
        try {
          const tree = await ghFetch(
            `https://api.github.com/repos/${githubUsername}/${repo.name}/git/trees/${repo.default_branch}?recursive=1`
          );
          files = tree.tree
            .filter(item => item.type === 'blob')
            .map(f => f.path.toLowerCase());
        } catch {
          try {
            const contents = await ghFetch(repo.contents_url.replace('{+path}', ''));
            files = contents.filter(item => item.type === 'file').map(f => f.name.toLowerCase());
          } catch {}
        }

        // ==================== READ KEY FILES ====================
        const readFile = async (fileName) => {
          try {
            const fileData = await ghFetch(
              `https://api.github.com/repos/${githubUsername}/${repo.name}/contents/${fileName}`
            );
            return Buffer.from(fileData.content, 'base64').toString('utf-8');
          } catch {
            return '';
          }
        };

        let dependencies = [];

        // Node.js
        if (files.includes('package.json')) {
          try {
            const pkgContent = await readFile('package.json');
            fileContents['package.json'] = pkgContent;
            const pkg = JSON.parse(pkgContent);
            dependencies.push(...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.devDependencies || {}));
          } catch {}
        }

        // Python - ALL POSSIBLE FILES
        const pythonFiles = ['requirements.txt', 'setup.py', 'pyproject.toml', 'Pipfile'];
        for (const pyFile of pythonFiles) {
          if (files.includes(pyFile)) {
            const content = await readFile(pyFile);
            fileContents[pyFile] = content;
            dependencies.push(...content.split('\n').map(l => l.split('==')[0].split('>=')[0].trim()).filter(Boolean));
          }
        }

        // Django Detection (DEEP)
        if (files.includes('manage.py')) {
          const managePy = await readFile('manage.py');
          fileContents['manage.py'] = managePy;
          if (managePy.includes('django')) {
            frameworks.add('Django');
            backendSkills.add('Django');
          }
        }

        // Check settings.py for database config
        const settingsFiles = files.filter(f => f.includes('settings.py'));
        for (const settingsFile of settingsFiles.slice(0, 2)) {
          const settings = await readFile(settingsFile);
          fileContents[settingsFile] = settings;
          
          if (settings.includes('django.db.backends.postgresql')) databases.add('PostgreSQL');
          if (settings.includes('django.db.backends.mysql')) databases.add('MySQL');
          if (settings.includes('django.db.backends.sqlite3')) databases.add('SQLite');
          if (settings.includes('MONGODB') || settings.includes('pymongo')) databases.add('MongoDB');
          if (settings.includes('AWS') || settings.includes('boto3')) cloudServices.add('AWS');
          if (settings.includes('CLOUDINARY')) cloudServices.add('Cloudinary');
        }

        // Java
        if (files.includes('pom.xml')) {
          const pom = await readFile('pom.xml');
          fileContents['pom.xml'] = pom;
          buildTools.add('Maven');
          if (pom.includes('spring')) frameworks.add('Spring Boot');
          if (pom.includes('mysql')) databases.add('MySQL');
          if (pom.includes('postgresql')) databases.add('PostgreSQL');
        }

        if (files.includes('build.gradle') || files.includes('build.gradle.kts')) {
          buildTools.add('Gradle');
        }

        // React/JSX detection
        const jsxFiles = files.filter(f => f.endsWith('.jsx') || f.endsWith('.tsx'));
        if (jsxFiles.length > 0) {
          frontendSkills.add('React/JSX');
          frameworks.add('React');
        }

        const depString = dependencies.join(' ').toLowerCase() + ' ' + Object.values(fileContents).join(' ').toLowerCase();

        // ==================== FRAMEWORK DETECTION ====================
        if (depString.includes('react')) { frameworks.add('React'); frontendSkills.add('React'); }
        if (depString.includes('vue')) { frameworks.add('Vue.js'); frontendSkills.add('Vue.js'); }
        if (depString.includes('angular')) { frameworks.add('Angular'); frontendSkills.add('Angular'); }
        if (depString.includes('next')) { frameworks.add('Next.js'); frontendSkills.add('Next.js'); }
        if (depString.includes('gatsby')) { frameworks.add('Gatsby'); frontendSkills.add('Gatsby'); }
        if (depString.includes('tailwind')) frontendSkills.add('Tailwind CSS');
        if (depString.includes('bootstrap')) frontendSkills.add('Bootstrap');
        if (depString.includes('material-ui') || depString.includes('@mui')) frontendSkills.add('Material-UI');

        if (depString.includes('django')) { frameworks.add('Django'); backendSkills.add('Django'); }
        if (depString.includes('flask')) { frameworks.add('Flask'); backendSkills.add('Flask'); }
        if (depString.includes('fastapi')) { frameworks.add('FastAPI'); backendSkills.add('FastAPI'); }
        if (depString.includes('express')) { frameworks.add('Express.js'); backendSkills.add('Express.js'); }
        if (depString.includes('nest')) { frameworks.add('NestJS'); backendSkills.add('NestJS'); }
        if (depString.includes('spring')) { frameworks.add('Spring Boot'); backendSkills.add('Spring Boot'); }

        if (depString.includes('react-native')) { frameworks.add('React Native'); frontendSkills.add('React Native'); }
        if (depString.includes('flutter')) { frameworks.add('Flutter'); frontendSkills.add('Flutter'); }

        // ==================== DATABASE DETECTION ====================
        if (depString.includes('mysql') || depString.includes('pymysql')) databases.add('MySQL');
        if (depString.includes('postgres') || depString.includes('psycopg') || depString.includes('pg')) databases.add('PostgreSQL');
        if (depString.includes('sqlite')) databases.add('SQLite');
        if (depString.includes('mongo') || depString.includes('pymongo') || depString.includes('mongoose')) databases.add('MongoDB');
        if (depString.includes('redis')) databases.add('Redis');
        if (depString.includes('firebase')) { databases.add('Firebase'); cloudServices.add('Firebase'); }

        // ==================== CLOUD & DEVOPS ====================
        if (depString.includes('aws') || depString.includes('boto3')) cloudServices.add('AWS');
        if (depString.includes('cloudinary')) cloudServices.add('Cloudinary');
        if (depString.includes('vercel')) cloudServices.add('Vercel');
        if (depString.includes('netlify')) cloudServices.add('Netlify');

        if (files.some(f => f.includes('dockerfile'))) {
          buildTools.add('Docker');
          hasDocker = true;
          projectTypes.add('DevOps');
        }
        if (files.includes('docker-compose.yml')) buildTools.add('Docker Compose');
        if (files.some(f => f.includes('.github/workflows'))) {
          buildTools.add('GitHub Actions');
          hasCI = true;
        }

        // Test detection
        if (files.some(f => f.includes('test') || f.includes('spec'))) hasTests = true;

        // ==================== PROJECT TYPE ====================
        if (files.includes('index.html') || frontendSkills.size > 0) projectTypes.add('Frontend');
        if (backendSkills.size > 0) projectTypes.add('Backend');
        if (frontendSkills.size > 0 && backendSkills.size > 0) projectTypes.add('Full-Stack');
        if (depString.includes('tensorflow') || depString.includes('pytorch')) projectTypes.add('Machine Learning');

        // ==================== README SCORE ====================
        try {
          const readme = await ghFetch(`https://api.github.com/repos/${githubUsername}/${repo.name}/readme`);
          const readmeText = Buffer.from(readme.content, 'base64').toString().toLowerCase();
          
          let score = 0;
          if (readmeText.length > 200) score++;
          if (readmeText.includes('install') || readmeText.includes('setup')) score++;
          if (readmeText.includes('usage')) score++;
          if (readmeText.includes('demo') || readmeText.includes('http')) { score++; hasLiveDemo++; }
          if (readmeText.includes('license')) score++;
          if (readmeText.includes('contribution')) score++;
          if (readmeText.includes('![') || readmeText.includes('<img')) score++;
          if (readmeText.includes('```')) score++;
          
          readmeScores.push(Math.min(10, score));
        } catch {
          readmeScores.push(0);
        }

        // ==================== COMMITS ====================
        try {
          const commits = await ghFetch(
            `https://api.github.com/repos/${githubUsername}/${repo.name}/commits?per_page=100`
          );
          if (commits.length > 0) {
            totalCommits += commits.length;
            activeRepos++;
          }
        } catch {}

      } catch (err) {
        console.log(`⚠️  Error analyzing ${repo.name}:`, err.message);
      }
    };

    // Analyze repos in batches
    const batchSize = 5;
    for (let i = 0; i < Math.min(repos.length, 10); i += batchSize) {
      const batch = repos.slice(i, i + batchSize);
      await Promise.all(batch.map(repo => analyzeRepo(repo)));
      if (i + batchSize < repos.length) await new Promise(r => setTimeout(r, 1000));
    }

    // ==================== 4️⃣ CALCULATE METRICS ====================
    const totalLangBytes = Object.values(languageBytes).reduce((a, b) => a + b, 0);
    const languages = {};
    for (const [lang, bytes] of Object.entries(languageBytes)) {
      const percentage = Math.round((bytes / totalLangBytes) * 100);
      if (percentage > 0) languages[lang] = percentage;
    }

    topRepos.sort((a, b) => b.stars - a.stars);
    topRepos = topRepos.slice(0, 5);

    const avgCommitsPerWeek = activeRepos > 0 ? Math.round(totalCommits / activeRepos / 4) : 0;
    const avgReadmeScore = readmeScores.length > 0 ? Math.round(readmeScores.reduce((a, b) => a + b) / readmeScores.length) : 0;
    const accountAgeYears = (Date.now() - new Date(user.created_at)) / (1000 * 60 * 60 * 24 * 365);
    const consistencyScore = Math.min(10, Math.round((repos.length / (accountAgeYears || 1)) * 0.5 + avgCommitsPerWeek * 0.2));

    // ==================== 5️⃣ SKILL STRENGTH ANALYSIS ====================
    const skillStrengths = {
      frontend: 0,
      backend: 0,
      database: 0,
      devops: 0,
      testing: 0
    };

    // Frontend (0-10)
    if (frontendSkills.size > 0) {
      let score = 0;
      if (frontendSkills.has('React') || frontendSkills.has('Vue.js') || frontendSkills.has('Angular')) score += 3;
      if (languages['JavaScript'] > 10) score += 2;
      if (languages['TypeScript'] > 5) score += 2;
      if (frontendSkills.has('Next.js')) score += 2;
      if (avgReadmeScore > 5) score += 1;
      skillStrengths.frontend = Math.min(10, score);
    }

    // Backend (0-10)
    if (backendSkills.size > 0) {
      let score = 0;
      if (backendSkills.has('Django') || backendSkills.has('Flask')) score += 3;
      if (backendSkills.has('Express.js') || backendSkills.has('NestJS')) score += 3;
      if (languages['Python'] > 10 || languages['Java'] > 10) score += 2;
      if (databases.size > 0) score += 2;
      skillStrengths.backend = Math.min(10, score);
    }

    // Database (0-10)
    if (databases.size > 0) {
      let score = databases.size * 2.5;
      if (databases.has('PostgreSQL') || databases.has('MongoDB')) score += 2;
      skillStrengths.database = Math.min(10, score);
    }

    // DevOps (0-10)
    let devopsScore = 0;
    if (hasDocker) devopsScore += 3;
    if (hasCI) devopsScore += 2;
    if (cloudServices.size > 0) devopsScore += 3;
    if (buildTools.has('Kubernetes')) devopsScore += 2;
    skillStrengths.devops = Math.min(10, devopsScore);

    // Testing (0-10)
    skillStrengths.testing = hasTests ? 6 : (avgReadmeScore > 7 ? 3 : 1);

    // ==================== 6️⃣ SKILL GAPS ====================
    const skillGaps = [];

    if (!hasDocker) {
      skillGaps.push({
        skill: 'Docker',
        current: '❌',
        ideal: '✅',
        status: 'Missing',
        priority: 'High',
        reason: 'Essential for deployment and DevOps roles'
      });
    }

    if (!hasCI) {
      skillGaps.push({
        skill: 'CI/CD (GitHub Actions)',
        current: '❌',
        ideal: '✅',
        status: 'Missing',
        priority: 'High',
        reason: 'Automates testing and deployment'
      });
    }

    if (!hasTests) {
      skillGaps.push({
        skill: 'Testing (Unit/Integration)',
        current: '❌',
        ideal: '✅',
        status: 'Missing',
        priority: 'High',
        reason: 'Shows code quality awareness'
      });
    }

    if (databases.size === 0) {
      skillGaps.push({
        skill: 'Database Management',
        current: '❌',
        ideal: '✅',
        status: 'Missing',
        priority: 'Critical',
        reason: 'Required for backend development'
      });
    } else if (!databases.has('PostgreSQL')) {
      skillGaps.push({
        skill: 'PostgreSQL',
        current: '⚠️',
        ideal: '✅',
        status: 'Improve',
        priority: 'Medium',
        reason: 'Industry-standard relational DB'
      });
    }

    if (hasLiveDemo === 0) {
      skillGaps.push({
        skill: 'Live Deployments',
        current: '❌',
        ideal: '✅',
        status: 'Missing',
        priority: 'High',
        reason: 'Recruiters want to see live projects'
      });
    }

    if (avgReadmeScore < 5) {
      skillGaps.push({
        skill: 'Documentation Quality',
        current: '⚠️',
        ideal: '✅',
        status: 'Needs Work',
        priority: 'Medium',
        reason: 'Good README = professional impression'
      });
    }

    // ==================== 7️⃣ PROJECT RECOMMENDATIONS ====================
    const projectRecommendations = [];

    const dominantRole = skillStrengths.frontend > skillStrengths.backend ? 'Frontend' : 
                         skillStrengths.backend > skillStrengths.frontend ? 'Backend' : 'Full-Stack';

    if (dominantRole === 'Full-Stack') {
      projectRecommendations.push({
        title: 'SaaS Dashboard (React + Django + PostgreSQL)',
        difficulty: 'Advanced',
        skills: ['React', 'Django REST Framework', 'PostgreSQL', 'JWT Auth', 'Docker'],
        mustInclude: ['User authentication', 'Role-based access', 'REST APIs', 'Charts/Analytics', 'Cloud deployment'],
        why: 'Demonstrates full-stack proficiency for mid-level roles'
      });
      projectRecommendations.push({
        title: 'Real-time Collaboration Tool',
        difficulty: 'Advanced',
        skills: ['WebSocket', 'Redis', 'React', 'Node.js'],
        mustInclude: ['Real-time updates', 'User presence', 'Conflict resolution'],
        why: 'Shows advanced backend and real-time skills'
      });
    } else if (dominantRole === 'Backend') {
      projectRecommendations.push({
        title: 'REST API with Microservices',
        difficulty: 'Advanced',
        skills: ['Django/Flask', 'PostgreSQL', 'Docker', 'Redis', 'CI/CD'],
        mustInclude: ['API documentation', 'Rate limiting', 'Caching', 'Unit tests'],
        why: 'Backend engineer essential project'
      });
    } else {
      projectRecommendations.push({
        title: 'Component Library + Storybook',
        difficulty: 'Intermediate',
        skills: ['React', 'TypeScript', 'Storybook', 'Testing Library'],
        mustInclude: ['Reusable components', 'Accessibility', 'Documentation'],
        why: 'Shows frontend architecture skills'
      });
    }

    // ==================== 8️⃣ GITHUB IMPROVEMENT CHECKLIST ====================
    const improvementChecklist = [];

    if (avgReadmeScore < 7) {
      improvementChecklist.push({
        item: 'Add professional README files with screenshots',
        status: avgReadmeScore === 0 ? '❌' : '⚠️',
        impact: 'High'
      });
    }

    if (hasLiveDemo === 0) {
      improvementChecklist.push({
        item: 'Deploy projects and add live demo links',
        status: '❌',
        impact: 'Critical'
      });
    }

    if (!hasDocker) {
      improvementChecklist.push({
        item: 'Add Dockerfile to projects',
        status: '❌',
        impact: 'High'
      });
    }

    if (!hasCI) {
      improvementChecklist.push({
        item: 'Set up GitHub Actions CI/CD',
        status: '❌',
        impact: 'High'
      });
    }

    if (consistencyScore < 5) {
      improvementChecklist.push({
        item: 'Increase commit frequency (aim for 5+/week)',
        status: '⚠️',
        impact: 'Medium'
      });
    }

    if (topRepos && topRepos.stars === 0) {
      improvementChecklist.push({
        item: 'Add badges (build status, license) to repos',
        status: '⚠️',
        impact: 'Low'
      });
    }

    // ==================== 9️⃣ HIRING READINESS SCORE ====================
    let hiringScore = 0;
    if (repos.length >= 5) hiringScore += 15;
    if (projectTypes.has('Full-Stack')) hiringScore += 20;
    if (hasDocker) hiringScore += 10;
    if (hasTests) hiringScore += 10;
    if (hasCI) hiringScore += 10;
    if (avgReadmeScore >= 7) hiringScore += 15;
    if (hasLiveDemo > 0) hiringScore += 10;
    if (consistencyScore >= 7) hiringScore += 10;

    const hiringReadiness = Math.min(100, hiringScore);
    const hiringLevel = hiringReadiness >= 75 ? '🟢 Mid-Level Ready' :
                       hiringReadiness >= 50 ? '🟡 Junior Ready' :
                       '🔴 Intern Level';

    // ==================== 10️⃣ BUILD RESPONSE ====================
    const githubAnalysis = {
      stats: {
        publicRepos: user.public_repos,
        followers: user.followers,
        totalStars,
        totalForks,
        accountAge: Math.round(accountAgeYears * 10) / 10
      },
      languages: Object.fromEntries(Object.entries(languages).sort(([, a], [, b]) => b - a)),
      frameworks: Array.from(frameworks).sort(),
      frontendSkills: Array.from(frontendSkills).sort(),
      backendSkills: Array.from(backendSkills).sort(),
      databases: Array.from(databases).sort(),
      cloudServices: Array.from(cloudServices).sort(),
      buildTools: Array.from(buildTools).sort(),
      projectTypes: Array.from(projectTypes).sort(),
      topRepos,
      commitActivity: {
        avgCommitsPerWeek,
        totalCommits,
        activeRepos,
        consistencyScore
      },
      qualityMetrics: {
        avgReadmeScore,
        reposWithReadme: readmeScores.filter(s => s > 0).length,
        reposWithStars: topRepos.filter(r => r.stars > 0).length
      },
      // 🎯 NEW ADVANCED FEATURES
      skillStrengths,
      skillGaps,
      projectRecommendations,
      improvementChecklist,
      hiringReadiness,
      hiringLevel
    };

    console.log('✅ GitHub analysis complete! Generating AI recommendations...');

    // ==================== 11️⃣ GEMINI AI ====================
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const modelsToTry = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash-exp',
  'gemini-2.0-flash', 'gemini-2.0-flash-001', 'gemini-2.0-flash-lite-001',
  'gemini-2.0-flash-lite', 'gemini-flash-latest', 'gemini-2.5-flash-lite',
  'gemini-pro-latest', 'gemini-2.5-flash-lite-preview-09-2025',
  'gemini-3-pro-preview', 'gemini-3-flash-preview'];

    let aiRecommendations = null;

    for (const modelName of modelsToTry) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        
        const prompt = `You are an AI career advisor analyzing a developer's GitHub portfolio.

GITHUB ANALYSIS:
- Languages: ${Object.entries(githubAnalysis.languages).map(([l, p]) => `${l} (${p}%)`).join(', ')}
- Frontend: ${Array.from(frontendSkills).join(', ') || 'None'}
- Backend: ${Array.from(backendSkills).join(', ') || 'None'}
- Databases: ${githubAnalysis.databases.join(', ') || 'None'}
- Skill Strengths: Frontend ${skillStrengths.frontend}/10, Backend ${skillStrengths.backend}/10, DB ${skillStrengths.database}/10, DevOps ${skillStrengths.devops}/10
- Project Types: ${githubAnalysis.projectTypes.join(', ')}
- Commits/Week: ${avgCommitsPerWeek} | README Quality: ${avgReadmeScore}/10

Provide career guidance in JSON:
{
  "strengths": ["Strong React component architecture", "Django REST API development"],
  "careerPaths": [
    { "role": "Full-Stack Developer", "match": 82, "reason": "Balanced frontend/backend skills" }
  ],
  "actionItems": ["Add live deployments", "Improve README documentation"],
  "learningPath": ["Learn Docker", "Master PostgreSQL"],
  "frontendExpertise": ${skillStrengths.frontend},
  "backendExpertise": ${skillStrengths.backend},
  "hiringReadiness": ${hiringReadiness},
  "focusAreas": {
    "immediate": "Add README to all projects",
    "shortTerm": "Deploy 1 project with CI/CD",
    "longTerm": "Contribute to open-source"
  }
}

Return ONLY valid JSON.`;

        const result = await model.generateContent(prompt);
        let aiText = result.response.text().trim();
        if (aiText.startsWith('```json')) {
          aiText = aiText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        }
        aiRecommendations = JSON.parse(aiText);
        console.log(`✅ AI recommendations generated using ${modelName}`);
        break;
      } catch (error) {
        console.log(`⚠️  ${modelName} failed, trying next...`);
      }
    }

    // ==================== 12️⃣ SAVE TO CLOUDINARY ====================
   // ==================== 12️⃣ SAVE TO FIRESTORE ====================
if (email) {
  try {
    const sanitizedEmail = email.toLowerCase().trim().replace(/[@.]/g, '_');
    const profileRef = db.collection('career_profiles').doc(sanitizedEmail);
    
    await profileRef.set({
      githubAnalysis,
      githubAiRecommendations: aiRecommendations,
      githubUsername,
      githubAnalyzedAt: new Date().toISOString(),
      ...(await profileRef.get()).data() // Merge existing data
    }, { merge: true });
    
    console.log('💾 Saved GitHub analysis to Firestore');
  } catch (err) {
    console.log('⚠️ Save failed:', err.message);
  }
}

    res.json({
      success: true,
      githubAnalysis,
      aiRecommendations
    });

  } catch (error) {
    console.error('❌ Analysis error:', error);
    res.status(500).json({ error: 'Analysis failed', details: error.message });
  }
});


// ✅ Generate AI Career Roadmap - FIXED with fallback
app.post('/api/generate-calendar-roadmap', async (req, res) => {
  const { email, forceRegenerate } = req.body;
  
  try {
    const API_BASE_URL = process.env.API_BASE_URL || `https://careergudiance-10.onrender.com:${PORT}`;
    
    const profileRes = await fetch(`${API_BASE_URL}/api/get-profile/${email}`);
    const profileData = await profileRes.json();
    const profile = profileData.profile;

    if (!profile) {
      return res.status(404).json({ 
        success: false, 
        error: 'Profile not found' 
      });
    }

    // ✅ TRY MULTIPLE MODELS IN ORDER
     const modelsToTry = [
      'gemini-2.5-flash',           // ✅ RECOMMENDED - Fresh quota
      'gemini-exp-1206',            // ✅ Experimental - Higher limits
      'gemini-2.5-flash-lite',      // ✅ Lighter version
      'gemini-3-flash-preview',     // ✅ New model
    ];

    let roadmap = null;
    let lastError = null;

    for (const modelName of modelsToTry) {
      try {
        console.log(`🤖 Trying model: ${modelName}...`);
        
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ 
          model: modelName,
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 4096,
          }
        });
        
        const prompt = `Create a 3-month career roadmap for this student:

PROFILE:
- Education: ${profile.educationLevel}
- Degree: ${profile.degree} in ${profile.department}
- Skills: ${profile.technicalSkills?.slice(0, 5).join(', ')}
- Career Goal: ${profile.careerInterestArea}
- CGPA: ${profile.currentCGPA}

GENERATE EXACTLY 7 WEEKLY MILESTONES IN THIS JSON FORMAT:

{
  "careerPath": "Full Stack Developer",
  "description": "3-month roadmap to become job-ready",
  "milestones": [
    {
      "title": "Week 1-2: React Fundamentals",
      "targetDate": "2026-02-01",
      "description": "Master React hooks, state, and components",
      "category": "learning",
      "completed": false
    },
    {
      "title": "Week 3-4: Build E-commerce App",
      "targetDate": "2026-02-15",
      "description": "Full-stack project with payment gateway",
      "category": "project",
      "completed": false
    }
  ]
}

RETURN ONLY VALID JSON. NO MARKDOWN.`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        
        // Parse JSON
        const cleanedText = responseText
          .replace(/```json\s*/g, '')
          .replace(/```\s*/g, '')
          .trim();
        
        roadmap = JSON.parse(cleanedText);
        
        if (roadmap.careerPath && roadmap.milestones && Array.isArray(roadmap.milestones)) {
          console.log(`✅ Success with ${modelName}!`);
          return res.json({ success: true, roadmap, modelUsed: modelName });
        }
        
      } catch (error) {
        console.error(`❌ ${modelName} failed:`, error.message);
        lastError = error;
        continue; // Try next model
      }
    }

    // ✅ ALL MODELS FAILED - RETURN MOCK DATA
    console.log('⚠️ All AI models failed. Returning mock roadmap.');
    
    const mockRoadmap = {
      careerPath: profile.careerInterestArea || "Software Developer",
      description: "3-month career preparation roadmap (AI temporarily unavailable)",
      milestones: [
        {
          title: "Week 1-2: Master DSA Fundamentals",
          targetDate: "2026-02-01",
          description: "Complete 50 LeetCode problems focusing on arrays, strings, and trees",
          category: "learning",
          completed: false
        },
        {
          title: "Week 3-4: Build Full-Stack Project",
          targetDate: "2026-02-15",
          description: "Create MERN stack e-commerce app with authentication and payment",
          category: "project",
          completed: false
        },
        {
          title: "Week 5-6: Learn System Design",
          targetDate: "2026-03-01",
          description: "Study scalability, databases, caching, and microservices architecture",
          category: "learning",
          completed: false
        },
        {
          title: "Week 7-8: Open Source Contributions",
          targetDate: "2026-03-15",
          description: "Contribute to 3 GitHub projects, build professional network",
          category: "project",
          completed: false
        },
        {
          title: "Week 9: Hackathon Participation",
          targetDate: "2026-03-22",
          description: "Join MLH or DevPost hackathons, win prizes",
          category: "hackathon",
          completed: false
        },
        {
          title: "Week 10-11: Interview Prep",
          targetDate: "2026-04-01",
          description: "Mock interviews, behavioral questions, system design rounds",
          category: "interview",
          completed: false
        },
        {
          title: "Week 12: Job Applications",
          targetDate: "2026-04-15",
          description: "Apply to 30+ companies, update LinkedIn and resume",
          category: "job",
          completed: false
        }
      ]
    };

    res.json({ 
      success: true, 
      roadmap: mockRoadmap, 
      modelUsed: 'mock-fallback',
      warning: 'AI models unavailable. Using template roadmap.'
    });

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    
    res.status(500).json({ 
      success: false, 
      error: 'Failed to generate roadmap',
      message: error.message 
    });
  }
});


// ✅ Google Calendar OAuth
app.post('/api/google-calendar-auth', async (req, res) => {
  const { email } = req.body;

  try {
    // ✅ Check if Google credentials are configured
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return res.status(501).json({ 
        success: false,
        error: 'Google Calendar not configured',
        message: 'Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env file'
      });
    }

    // ✅ Use env variables for OAuth URL
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${process.env.GOOGLE_CLIENT_ID}&` +
      `redirect_uri=${process.env.GOOGLE_REDIRECT_URI || 'https://careergudiance-10.onrender.com:5000/api/google-calendar/callback'}&` +
      `scope=https://www.googleapis.com/auth/calendar&` +
      `response_type=code&` +
      `access_type=offline&` +
      `state=${email}`;

    res.json({ 
      success: true, 
      authUrl,
      message: 'Redirect user to this URL for Google OAuth' 
    });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to generate auth URL',
      message: error.message 
    });
  }
});

// ✅ Google Calendar OAuth Callback (New endpoint)
app.get('/api/google-calendar/callback', async (req, res) => {
  const { code, state } = req.query; // state = email
  
  try {
    if (!code) {
      return res.status(400).send('Authorization code missing');
    }

    // TODO: Exchange code for access token
    // const tokens = await exchangeCodeForToken(code);
    // Store tokens in database/cloudinary for user (state = email)
    
    // ✅ Redirect back to frontend with success
    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${FRONTEND_URL}/dashboard/calendar?connected=true`);
  } catch (error) {
    console.error('OAuth callback error:', error);
    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${FRONTEND_URL}/dashboard/calendar?error=auth_failed`);
  }
});

// ✅ Sync Roadmap to Google Calendar
app.post('/api/sync-roadmap-to-calendar', async (req, res) => {
  const { email, roadmap, mode } = req.body;

  try {
    // ✅ Check if Google credentials exist
    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(501).json({ 
        success: false,
        error: 'Google Calendar not configured',
        message: 'Please configure Google Calendar credentials in .env'
      });
    }

    // TODO: Get user's access token from storage
    // TODO: Use Google Calendar API to create events
    // const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    // await calendar.events.insert({ ... });

    // ✅ For now, return mock success
    res.json({ 
      success: true, 
      message: 'Roadmap synced to Google Calendar!',
      eventCount: roadmap?.milestones?.length || 0,
      mode: mode || 'normal'
    });
  } catch (error) {
    console.error('Error syncing to calendar:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to sync calendar',
      message: error.message 
    });
  }
});

// ✅ Get calendar events for user
app.get('/api/get-calendar-events/:email', async (req, res) => {
  const { email } = req.params;

  try {
    // TODO: Fetch from Google Calendar API or your database
    // For now, return mock events
    const mockEvents = [
      {
        id: 1,
        title: "Complete React Tutorial",
        date: "2026-01-15",
        description: "Finish React basics from official docs",
        category: "learning",
        icon: "📚",
        completed: false
      },
      {
        id: 2,
        title: "Build Portfolio Project",
        date: "2026-01-20",
        description: "Create full-stack e-commerce app",
        category: "project",
        icon: "💻",
        completed: false
      }
    ];

    res.json({ 
      success: true, 
      events: mockEvents,
      count: mockEvents.length 
    });
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch events',
      message: error.message 
    });
  }
});


// ============================================
// 📊 VIEW GOOGLE SHEETS DATA - BACKEND ENDPOINTS
// ============================================


app.get('/api/sheets/view-all', async (req, res) => {
  if (!sheetsEnabled || !sheets) {
    return res.status(503).json({ 
      success: false, 
      error: 'Google Sheets not configured' 
    });
  }

  try {
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    
    // ✅ FIRST: Get the sheet metadata to find "Quiz Results" sheet ID
    const sheetMetadata = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties'
    });
    
    const quizResultsSheet = sheetMetadata.data.sheets.find(
      s => s.properties.title === 'Quiz Results'
    );
    
    const sheetGid = quizResultsSheet?.properties?.sheetId || 0;
    
    // Get all data from sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Quiz Results!A1:S1000',
    });

    const rows = response.data.values || [];
    
    if (rows.length === 0) {
      return res.json({
        success: true,
        message: 'Sheet is empty',
        data: [],
        totalRows: 0,
        // ✅ Still return the correct URL
        sheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${sheetGid}`
      });
    }

    const headers = rows[0];
    const dataRows = rows.slice(1);

    const quizData = dataRows.map(row => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index] || 'N/A';
      });
      return obj;
    });

    res.json({
      success: true,
      totalRows: dataRows.length,
      headers,
      data: quizData,
      spreadsheetId,
      // ✅ CORRECT URL WITH SHEET GID
      sheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${sheetGid}`
    });

  } catch (error) {
    console.error('❌ Error reading sheet:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to read sheet',
      message: error.message
    });
  }
});

// ============================================
// 2️⃣ GET QUIZ DATA FOR SPECIFIC USER
// ============================================
app.get('/api/sheets/view-user/:email', async (req, res) => {
  if (!sheetsEnabled || !sheets) {
    return res.status(503).json({ 
      success: false, 
      error: 'Google Sheets not configured' 
    });
  }

  try {
    const { email } = req.params;
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    
    // Get all data
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Quiz Results!A1:S1000',
    });

    const rows = response.data.values || [];
    
    if (rows.length === 0) {
      return res.json({
        success: true,
        message: 'No data found',
        data: []
      });
    }

    const headers = rows[0];
    const dataRows = rows.slice(1);

    // Filter by email (column B = Email)
    const userQuizzes = dataRows
      .filter(row => row[1]?.toLowerCase() === email.toLowerCase())
      .map(row => {
        const obj = {};
        headers.forEach((header, index) => {
          obj[header] = row[index] || 'N/A';
        });
        return obj;
      });

    res.json({
      success: true,
      email,
      totalQuizzes: userQuizzes.length,
      data: userQuizzes,
      sheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
    });

  } catch (error) {
    console.error('❌ Error reading user data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to read user data',
      message: error.message
    });
  }
});

// ============================================
// 3️⃣ GET SHEET STATISTICS
// ============================================
app.get('/api/sheets/stats', async (req, res) => {
  if (!sheetsEnabled || !sheets) {
    return res.status(503).json({ 
      success: false, 
      error: 'Google Sheets not configured' 
    });
  }

  try {
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Quiz Results!A1:S1000',
    });

    const rows = response.data.values || [];
    
    if (rows.length <= 1) {
      return res.json({
        success: true,
        stats: {
          totalQuizzes: 0,
          uniqueUsers: 0,
          averageScore: 0,
          highestScore: 0
        }
      });
    }

    const dataRows = rows.slice(1);
    
    // Calculate statistics
    const emails = new Set();
    let totalScore = 0;
    let highestScore = 0;

    dataRows.forEach(row => {
      // Email is column B (index 1)
      if (row[1]) emails.add(row[1]);
      
      // Score % is column E (index 4)
      const scoreStr = row[4];
      if (scoreStr) {
        const score = parseInt(scoreStr.replace('%', ''));
        if (!isNaN(score)) {
          totalScore += score;
          highestScore = Math.max(highestScore, score);
        }
      }
    });

    const stats = {
      totalQuizzes: dataRows.length,
      uniqueUsers: emails.size,
      averageScore: Math.round(totalScore / dataRows.length),
      highestScore,
      lastUpdated: new Date().toISOString(),
      topUsers: await getTopUsers(dataRows)
    };

    res.json({
      success: true,
      stats,
      sheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
    });

  } catch (error) {
    console.error('❌ Error getting stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get statistics',
      message: error.message
    });
  }
});

// Helper function to get top users
async function getTopUsers(dataRows) {
  const userScores = {};

  dataRows.forEach(row => {
    const email = row[1]; // Column B
    const name = row[2];   // Column C
    const scoreStr = row[4]; // Column E
    
    if (email && scoreStr) {
      const score = parseInt(scoreStr.replace('%', ''));
      if (!isNaN(score)) {
        if (!userScores[email]) {
          userScores[email] = {
            email,
            name: name || 'Unknown',
            totalQuizzes: 0,
            totalScore: 0,
            avgScore: 0,
            bestScore: 0
          };
        }
        userScores[email].totalQuizzes++;
        userScores[email].totalScore += score;
        userScores[email].bestScore = Math.max(userScores[email].bestScore, score);
      }
    }
  });

  // Calculate averages and sort
  const topUsers = Object.values(userScores)
    .map(user => ({
      ...user,
      avgScore: Math.round(user.totalScore / user.totalQuizzes)
    }))
    .sort((a, b) => b.avgScore - a.avgScore)
    .slice(0, 10); // Top 10 users

  return topUsers;
}

// ============================================
// 4️⃣ OPEN SHEET IN BROWSER (Direct Link)
// ============================================
app.get('/api/sheets/open', (req, res) => {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  
  if (!spreadsheetId) {
    return res.status(404).json({
      success: false,
      error: 'Spreadsheet ID not configured'
    });
  }

  const sheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
  
  // Redirect to Google Sheets
  res.redirect(sheetUrl);
});

// ============================================
// 5️⃣ EXPORT SHEET AS CSV
// ============================================
app.get('/api/sheets/export-csv', async (req, res) => {
  if (!sheetsEnabled || !sheets) {
    return res.status(503).json({ 
      success: false, 
      error: 'Google Sheets not configured' 
    });
  }

  try {
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Quiz Results!A1:S1000',
    });

    const rows = response.data.values || [];
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No data to export'
      });
    }

    // Convert to CSV
    const csv = rows.map(row => 
      row.map(cell => `"${cell || ''}"`).join(',')
    ).join('\n');

    // Set headers for download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="quiz_results_${Date.now()}.csv"`);
    res.send(csv);

  } catch (error) {
    console.error('❌ Error exporting CSV:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export CSV',
      message: error.message
    });
  }
});

// ============================================
// 6️⃣ SEARCH QUIZZES
// ============================================
app.post('/api/sheets/search', async (req, res) => {
  if (!sheetsEnabled || !sheets) {
    return res.status(503).json({ 
      success: false, 
      error: 'Google Sheets not configured' 
    });
  }

  try {
    const { query, filterBy } = req.body; // filterBy: 'email', 'name', 'career'
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Quiz Results!A1:S1000',
    });

    const rows = response.data.values || [];
    
    if (rows.length <= 1) {
      return res.json({
        success: true,
        results: [],
        message: 'No data found'
      });
    }

    const headers = rows[0];
    const dataRows = rows.slice(1);

    // Filter based on search
    const results = dataRows
      .filter(row => {
        const searchStr = query.toLowerCase();
        
        switch(filterBy) {
          case 'email':
            return row[1]?.toLowerCase().includes(searchStr);
          case 'name':
            return row[2]?.toLowerCase().includes(searchStr);
          case 'career':
            return row[10]?.toLowerCase().includes(searchStr);
          default:
            // Search all columns
            return row.some(cell => 
              cell?.toString().toLowerCase().includes(searchStr)
            );
        }
      })
      .map(row => {
        const obj = {};
        headers.forEach((header, index) => {
          obj[header] = row[index] || 'N/A';
        });
        return obj;
      });

    res.json({
      success: true,
      query,
      filterBy: filterBy || 'all',
      resultCount: results.length,
      results
    });

  } catch (error) {
    console.error('❌ Error searching:', error);
    res.status(500).json({
      success: false,
      error: 'Search failed',
      message: error.message
    });
  }
});

// ============================================
// 7️⃣ DELETE QUIZ ENTRY (Admin only)
// ============================================
app.delete('/api/sheets/delete/:quizNumber/:email', async (req, res) => {
  if (!sheetsEnabled || !sheets) {
    return res.status(503).json({ 
      success: false, 
      error: 'Google Sheets not configured' 
    });
  }

  try {
    const { quizNumber, email } = req.params;
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    
    // Get sheet ID
    const sheetData = await sheets.spreadsheets.get({ spreadsheetId });
    const sheet = sheetData.data.sheets.find(s => s.properties.title === 'Quiz Results');
    
    if (!sheet) {
      return res.status(404).json({
        success: false,
        error: 'Quiz Results sheet not found'
      });
    }

    const sheetId = sheet.properties.sheetId;

    // Get all data to find row number
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Quiz Results!A1:S1000',
    });

    const rows = response.data.values || [];
    
    // Find row index (skip header)
    let rowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][1] === email && rows[i][3] === quizNumber) {
        rowIndex = i;
        break;
      }
    }

    if (rowIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Quiz entry not found'
      });
    }

    // Delete the row
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: rowIndex,
              endIndex: rowIndex + 1
            }
          }
        }]
      }
    });

    res.json({
      success: true,
      message: `Deleted Quiz #${quizNumber} for ${email}`,
      deletedRow: rowIndex + 1
    });

  } catch (error) {
    console.error('❌ Error deleting entry:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete entry',
      message: error.message
    });
  }
});

// ============================================
// 8️⃣ GET SHEET INFO/METADATA
// ============================================
app.get('/api/sheets/info', async (req, res) => {
  if (!sheetsEnabled || !sheets) {
    return res.status(503).json({ 
      success: false, 
      error: 'Google Sheets not configured' 
    });
  }

  try {
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    
    const response = await sheets.spreadsheets.get({ 
      spreadsheetId,
      fields: 'properties,sheets.properties' 
    });

    const info = {
      title: response.data.properties.title,
      locale: response.data.properties.locale,
      timeZone: response.data.properties.timeZone,
      spreadsheetId,
      url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
      sheets: response.data.sheets.map(s => ({
        title: s.properties.title,
        sheetId: s.properties.sheetId,
        rowCount: s.properties.gridProperties.rowCount,
        columnCount: s.properties.gridProperties.columnCount
      }))
    };

    res.json({
      success: true,
      info
    });

  } catch (error) {
    console.error('❌ Error getting sheet info:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get sheet info',
      message: error.message
    });
  }
});



// ==================== RAPIDAPI INTEGRATION ====================
// Sign up at https://rapidapi.com for free API key
// Search for "Udemy" or "courses" APIs on RapidAPI Hub

app.post('/api/analyze-courses', async (req, res) => {
  const { email, profileData } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email required' });
  }

  try {
    console.log(`📚 Generating course recommendations for: ${email}`);

    // ==================== 1️⃣ LOAD USER PROFILE ====================
    const sanitizedEmail = email.toLowerCase().trim().replace(/[@.]/g, '_');
    let userProfile = null;

    const docIds = [sanitizedEmail, email.toLowerCase().trim()];
    for (const docId of docIds) {
      try {
        const docSnap = await db.collection('career_profiles').doc(docId).get();
        if (docSnap.exists) {
          userProfile = docSnap.data();
          break;
        }
      } catch (err) {
        continue;
      }
    }

    if (!userProfile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // ==================== 2️⃣ FETCH COURSES FROM RAPIDAPI ====================
    const searchQueries = [
      userProfile.careerInterestArea || 'software development',
      userProfile.department || 'computer science',
      ...((userProfile.technicalSkills || []).slice(0, 2))
    ].filter(Boolean);

    console.log('🔍 Searching for courses:', searchQueries);

    let allCourses = [];
    const seenCourses = new Set();

    // Method 1: Try Udemy API from RapidAPI
    for (const query of searchQueries) {
      try {
        console.log(`   🔎 Searching Udemy for: "${query}"`);
        
        const response = await fetch(
          `https://udemy-api3.p.rapidapi.com/courses?search=${encodeURIComponent(query)}&page=1&page_size=20`,
          {
            headers: {
              'X-RapidAPI-Key': process.env.RAPIDAPI_KEY, // Add to .env
              'X-RapidAPI-Host': 'udemy-api3.p.rapidapi.com'
            }
          }
        );

        if (response.ok) {
          const data = await response.json();
          const courses = data.results || data.courses || [];
          
          courses.forEach(course => {
            const courseId = course.id || course.title;
            if (!seenCourses.has(courseId)) {
              seenCourses.add(courseId);
              allCourses.push({
                id: course.id,
                title: course.title,
                provider: 'Udemy',
                url: course.url || `https://www.udemy.com${course.url_path || ''}`,
                description: course.headline || course.description || 'No description',
                duration: course.content_info || course.duration || 'Self-paced',
                difficulty: course.instructional_level || 'All Levels',
                rating: course.avg_rating || 0,
                reviewCount: course.num_reviews || 0,
                enrollments: course.num_subscribers || 0,
                price: course.price || 'Free',
                isPaid: course.is_paid || false,
                topics: course.visible_instructors || [],
                image: course.image_480x270 || course.image_125_H || ''
              });
            }
          });
        }
      } catch (error) {
        console.log(`   ⚠️ Udemy API error for "${query}":`, error.message);
      }

      await new Promise(resolve => setTimeout(resolve, 500)); // Rate limit protection
    }

    // Method 2: Try Coursera-like API from RapidAPI
    for (const query of searchQueries.slice(0, 2)) {
      try {
        console.log(`   🔎 Searching Coursera alternatives for: "${query}"`);
        
        const response = await fetch(
          `https://online-courses-api.p.rapidapi.com/courses/search?q=${encodeURIComponent(query)}`,
          {
            headers: {
              'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
              'X-RapidAPI-Host': 'online-courses-api.p.rapidapi.com'
            }
          }
        );

        if (response.ok) {
          const data = await response.json();
          const courses = data.courses || data.results || [];
          
          courses.forEach(course => {
            const courseId = `coursera-${course.id || course.title}`;
            if (!seenCourses.has(courseId)) {
              seenCourses.add(courseId);
              allCourses.push({
                id: courseId,
                title: course.title || course.name,
                provider: course.provider || 'Coursera',
                url: course.url || course.link,
                description: course.description || 'No description',
                duration: course.duration || 'Self-paced',
                difficulty: course.level || 'Beginner',
                rating: course.rating || 0,
                reviewCount: course.reviews || 0,
                enrollments: course.enrolled || 0,
                price: 'Free',
                isPaid: false
              });
            }
          });
        }
      } catch (error) {
        console.log(`   ⚠️ Coursera API error:`, error.message);
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`✅ Total courses found: ${allCourses.length}`);

    // ==================== 3️⃣ FALLBACK - CURATED COURSES ====================
    if (allCourses.length === 0) {
      console.log('⚠️ No courses from APIs, using curated database');
      
      const curatedCourses = {
        'web development': [
          { title: 'The Complete Web Developer Bootcamp', provider: 'Udemy', url: 'https://www.udemy.com/topic/web-development/', difficulty: 'Beginner', rating: 4.7, price: 'Free' },
          { title: 'Full Stack Web Development', provider: 'Coursera', url: 'https://www.coursera.org/learn/full-stack', difficulty: 'Intermediate', rating: 4.6, price: 'Free' },
          { title: 'Web Design for Everybody', provider: 'Coursera', url: 'https://www.coursera.org/specializations/web-design', difficulty: 'Beginner', rating: 4.8, price: 'Free' },
          { title: 'Modern React with Redux', provider: 'Udemy', url: 'https://www.udemy.com/course/react-redux/', difficulty: 'Intermediate', rating: 4.7, price: 'Free' }
        ],
        'python': [
          { title: 'Python for Everybody', provider: 'Coursera', url: 'https://www.coursera.org/specializations/python', difficulty: 'Beginner', rating: 4.8, price: 'Free' },
          { title: 'Complete Python Bootcamp', provider: 'Udemy', url: 'https://www.udemy.com/topic/python/', difficulty: 'Beginner', rating: 4.6, price: 'Free' },
          { title: 'Python Data Structures', provider: 'Coursera', url: 'https://www.coursera.org/learn/python-data', difficulty: 'Intermediate', rating: 4.7, price: 'Free' },
          { title: 'Automate with Python', provider: 'Udemy', url: 'https://www.udemy.com/automate/', difficulty: 'Intermediate', rating: 4.6, price: 'Free' }
        ],
        'java': [
          { title: 'Java Programming', provider: 'Coursera', url: 'https://www.coursera.org/specializations/java-programming', difficulty: 'Beginner', rating: 4.6, price: 'Free' },
          { title: 'Object Oriented Programming in Java', provider: 'Coursera', url: 'https://www.coursera.org/learn/object-oriented-java', difficulty: 'Intermediate', rating: 4.5, price: 'Free' },
          { title: 'Java Masterclass', provider: 'Udemy', url: 'https://www.udemy.com/java-the-complete-java-developer-course/', difficulty: 'Beginner', rating: 4.7, price: 'Free' }
        ],
        'data science': [
          { title: 'Data Science Specialization', provider: 'Coursera', url: 'https://www.coursera.org/specializations/jhu-data-science', difficulty: 'Intermediate', rating: 4.7, price: 'Free' },
          { title: 'Applied Data Science with Python', provider: 'Coursera', url: 'https://www.coursera.org/specializations/data-science-python', difficulty: 'Intermediate', rating: 4.6, price: 'Free' },
          { title: 'Data Science A-Z', provider: 'Udemy', url: 'https://www.udemy.com/datascience/', difficulty: 'Beginner', rating: 4.5, price: 'Free' },
          { title: 'IBM Data Science', provider: 'Coursera', url: 'https://www.coursera.org/professional-certificates/ibm-data-science', difficulty: 'Beginner', rating: 4.6, price: 'Free' }
        ],
        'machine learning': [
          { title: 'Machine Learning', provider: 'Coursera', url: 'https://www.coursera.org/learn/machine-learning', difficulty: 'Advanced', rating: 4.9, price: 'Free' },
          { title: 'Deep Learning Specialization', provider: 'Coursera', url: 'https://www.coursera.org/specializations/deep-learning', difficulty: 'Advanced', rating: 4.8, price: 'Free' },
          { title: 'Machine Learning A-Z', provider: 'Udemy', url: 'https://www.udemy.com/machinelearning/', difficulty: 'Intermediate', rating: 4.5, price: 'Free' },
          { title: 'TensorFlow Developer', provider: 'Coursera', url: 'https://www.coursera.org/professional-certificates/tensorflow-in-practice', difficulty: 'Intermediate', rating: 4.7, price: 'Free' }
        ],
        'javascript': [
          { title: 'JavaScript Essentials', provider: 'Udemy', url: 'https://www.udemy.com/topic/javascript/', difficulty: 'Beginner', rating: 4.6, price: 'Free' },
          { title: 'Modern JavaScript', provider: 'Udemy', url: 'https://www.udemy.com/the-complete-javascript-course/', difficulty: 'Intermediate', rating: 4.7, price: 'Free' },
          { title: 'JavaScript Algorithms', provider: 'FreeCodeCamp', url: 'https://www.freecodecamp.org/learn', difficulty: 'Intermediate', rating: 4.8, price: 'Free' }
        ],
        'cloud computing': [
          { title: 'AWS Cloud Practitioner', provider: 'Coursera', url: 'https://www.coursera.org/learn/aws-cloud-practitioner-essentials', difficulty: 'Beginner', rating: 4.7, price: 'Free' },
          { title: 'Google Cloud Fundamentals', provider: 'Coursera', url: 'https://www.coursera.org/learn/gcp-fundamentals', difficulty: 'Beginner', rating: 4.6, price: 'Free' },
          { title: 'Azure Fundamentals', provider: 'Microsoft Learn', url: 'https://learn.microsoft.com/en-us/training/paths/azure-fundamentals/', difficulty: 'Beginner', rating: 4.7, price: 'Free' }
        ]
      };

      const userInterests = [
        userProfile.careerInterestArea?.toLowerCase(),
        userProfile.department?.toLowerCase(),
        ...(userProfile.technicalSkills || []).map(s => s.toLowerCase())
      ].filter(Boolean);

      userInterests.forEach(interest => {
        Object.keys(curatedCourses).forEach(category => {
          if (interest.includes(category) || category.includes(interest.split(' ')[0])) {
            curatedCourses[category].forEach((course, idx) => {
              const courseId = `${category}-${idx}`;
              if (!seenCourses.has(courseId) && allCourses.length < 50) {
                seenCourses.add(courseId);
                allCourses.push({
                  id: courseId,
                  title: course.title,
                  provider: course.provider,
                  url: course.url,
                  description: `Comprehensive ${category} course covering fundamentals to advanced topics`,
                  duration: '4-8 weeks',
                  difficulty: course.difficulty,
                  rating: course.rating,
                  reviewCount: Math.floor(Math.random() * 5000) + 1000,
                  enrollments: Math.floor(Math.random() * 100000) + 10000,
                  price: course.price,
                  isPaid: false,
                  topics: [category],
                  skills: [category]
                });
              }
            });
          }
        });
      });

      console.log(`✅ Added ${allCourses.length} curated courses`);
    }

    // ==================== 4️⃣ CATEGORIZE COURSES ====================
    const coursesCategories = {
      technical: [],
      softSkills: [],
      careerDevelopment: [],
      certifications: []
    };

    const technicalKeywords = ['programming', 'code', 'development', 'data', 'machine learning', 'ai', 'database', 'web', 'app', 'python', 'java', 'javascript', 'cloud'];
    const softSkillsKeywords = ['leadership', 'communication', 'management', 'teamwork', 'productivity', 'business'];
    const certKeywords = ['certification', 'professional', 'certified', 'credential', 'certificate'];

    allCourses.forEach(course => {
      const titleLower = course.title.toLowerCase();
      const descLower = (course.description || '').toLowerCase();
      
      if (certKeywords.some(k => titleLower.includes(k))) {
        coursesCategories.certifications.push(course);
      } else if (technicalKeywords.some(k => titleLower.includes(k) || descLower.includes(k))) {
        coursesCategories.technical.push(course);
      } else if (softSkillsKeywords.some(k => titleLower.includes(k))) {
        coursesCategories.softSkills.push(course);
      } else {
        coursesCategories.careerDevelopment.push(course);
      }
    });

    // Sort by rating and enrollments
    Object.keys(coursesCategories).forEach(category => {
      coursesCategories[category].sort((a, b) => {
        const scoreA = (a.rating * 10) + Math.log10(a.enrollments + 1);
        const scoreB = (b.rating * 10) + Math.log10(b.enrollments + 1);
        return scoreB - scoreA;
      });
    });

    // ==================== 5️⃣ GEMINI AI RECOMMENDATIONS ====================
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    const modelsToTry = [
      'gemini-3-flash-preview',
      'gemini-2.0-flash',
      'gemini-2.0-flash-lite',
      'gemma-3-27b-it'
    ];

    let aiRecommendations = null;
    let successfulModel = null;

    const topCourses = [
      ...coursesCategories.technical.slice(0, 8),
      ...coursesCategories.certifications.slice(0, 3),
      ...coursesCategories.softSkills.slice(0, 2)
    ];

    const prompt = `You are an AI career advisor. Create a personalized learning path.

**STUDENT:**
- Name: ${userProfile.fullName}
- Education: ${userProfile.degree} in ${userProfile.department}
- Career Interest: ${userProfile.careerInterestArea}
- Skills: ${(userProfile.technicalSkills || []).join(', ')}
- CGPA: ${userProfile.currentCGPA}

**AVAILABLE COURSES:**
${topCourses.map((c, i) => `${i + 1}. ${c.title} - ${c.provider} (${c.difficulty})`).join('\n')}

Return ONLY valid JSON (no markdown):

{
  "learningPath": {
    "immediate": {
      "title": "Month 1-2: Foundation",
      "courses": [{"title": "...", "provider": "...", "reason": "...", "priority": "High"}],
      "estimatedHours": 40
    },
    "shortTerm": {
      "title": "Month 3-4: Core Skills",
      "courses": [],
      "estimatedHours": 60
    },
    "longTerm": {
      "title": "Month 5-6: Advanced",
      "courses": [],
      "estimatedHours": 80
    }
  },
  "recommendedPlatforms": ["Coursera", "Udemy", "edX"],
  "certifications": [{"name": "...", "provider": "...", "priority": "High", "whyUseful": "..."}],
  "skillGaps": ["Gap1", "Gap2"],
  "careerReadiness": 75,
  "recommendations": ["Tip1", "Tip2"]
}`;

    for (const modelName of modelsToTry) {
      try {
        console.log(`🤖 Trying model: ${modelName}...`);
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        
        let aiText = result.response.text().trim();
        aiText = aiText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        
        aiRecommendations = JSON.parse(aiText);
        successfulModel = modelName;
        console.log(`✅ AI recommendations generated with ${modelName}`);
        break;
      } catch (error) {
        console.log(`⚠️ ${modelName} failed:`, error.message);
      }
    }

    // Fallback if all models fail
    if (!aiRecommendations) {
      aiRecommendations = {
        learningPath: {
          immediate: {
            title: "Month 1-2: Foundation Building",
            courses: topCourses.slice(0, 3).map(c => ({
              title: c.title,
              provider: c.provider,
              reason: "Build strong fundamentals in core technologies",
              priority: "High"
            })),
            estimatedHours: 45
          },
          shortTerm: {
            title: "Month 3-4: Practical Skills",
            courses: topCourses.slice(3, 6).map(c => ({
              title: c.title,
              provider: c.provider,
              reason: "Apply knowledge through hands-on projects",
              priority: "Medium"
            })),
            estimatedHours: 65
          },
          longTerm: {
            title: "Month 5-6: Advanced Specialization",
            courses: topCourses.slice(6, 9).map(c => ({
              title: c.title,
              provider: c.provider,
              reason: "Master advanced concepts and earn certifications",
              priority: "Medium"
            })),
            estimatedHours: 75
          }
        },
        recommendedPlatforms: ["Coursera", "Udemy", "edX", "FreeCodeCamp"],
        certifications: coursesCategories.certifications.slice(0, 3).map(c => ({
          name: c.title,
          provider: c.provider,
          priority: "High",
          whyUseful: "Industry-recognized credential to boost employability"
        })),
        skillGaps: ["Hands-on project experience", "Real-world application development"],
        careerReadiness: 72,
        recommendations: [
          "Start with foundational courses before advancing",
          "Build at least 2-3 projects alongside learning",
          "Earn recognized certifications to strengthen resume",
          "Join online communities for peer learning"
        ],
        modelUsed: "fallback"
      };
    } else {
      aiRecommendations.modelUsed = successfulModel;
    }

    // ==================== 6️⃣ SAVE TO FIRESTORE ====================
    try {
      const profileRef = db.collection('career_profiles').doc(sanitizedEmail);
      await profileRef.set({
        courseAnalysis: {
          coursesCategories,
          aiRecommendations,
          analyzedAt: new Date().toISOString(),
          totalCourses: allCourses.length,
          modelUsed: successfulModel || 'fallback'
        }
      }, { merge: true });
      
      console.log('💾 Saved course analysis to Firestore');
    } catch (err) {
      console.log('⚠️ Save failed:', err.message);
    }

    // ==================== 7️⃣ RETURN RESPONSE ====================
    res.json({
      success: true,
      courseAnalysis: {
        coursesCategories,
        totalCourses: allCourses.length,
        topRatedCourses: topCourses,
        aiRecommendations,
        modelUsed: successfulModel || 'fallback'
      }
    });

  } catch (error) {
    console.error('❌ Course analysis error:', error);
    res.status(500).json({ 
      error: 'Course analysis failed', 
      details: error.message 
    });
  }
});

// ✅ Server startup with environment validation
app.listen(PORT, () => {
  console.log('\n🚀 Career Guidance API Server Started');
  console.log(`📍 Server: http://localhost:${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📧 Email: ${process.env.EMAIL ? '✅ Configured' : '❌ Missing'}`);
  console.log(`☁️  Cloudinary: ${process.env.CLOUDINARY_CLOUD_NAME ? '✅ Configured' : '❌ Missing'}`);
  console.log(`🤖 Gemini AI: ${process.env.GEMINI_API_KEY ? '✅ Configured' : '❌ Missing'}`);
  console.log(`📅 Google Calendar: ${process.env.GOOGLE_CLIENT_ID ? '✅ Configured' : '⚠️  Not configured (optional)'}`);
  console.log('');
});


