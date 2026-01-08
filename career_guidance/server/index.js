const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const { parse } = require('json2csv');
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const PORT = process.env.PORT || 5000;



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

    if (!email || !profileData) {
      return res.status(400).json({ error: 'Email and profile data required' });
    }

    const userData = {
      email,
      username: email.split('@')[0],
      submittedAt: new Date().toISOString(),
      ...profileData
    };

    const sanitizedEmail = email.replace(/[@.]/g, '_');
    const jsonContent = JSON.stringify(userData, null, 2);

    const result = await cloudinary.uploader.upload(
      `data:application/json;base64,${Buffer.from(jsonContent).toString('base64')}`,
      {
        resource_type: 'raw',
        public_id: sanitizedEmail,
        folder: 'career_profiles',
        overwrite: true
      }
    );

    console.log('✅ Saved with public_id:', result.public_id);
    console.log('✅ Asset folder:', result.asset_folder);

    res.json({ 
      success: true, 
      message: 'Profile saved successfully',
      url: result.secure_url
    });

  } catch (error) {
    console.error('❌ Save error:', error);
    res.status(500).json({ error: 'Failed to save profile' });
  }
});

app.get('/api/get-profile/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const sanitizedEmail = email.replace(/[@.]/g, '_');
    
    console.log('🔍 Looking for profile:', email);

    const paths = [
      `career_profiles/${sanitizedEmail}`,
      `career_profiles/${sanitizedEmail}.json`,
      `career_profiles/career_profiles/${sanitizedEmail}`,
      `career_profiles/career_profiles/${sanitizedEmail}.json`
    ];

    for (const path of paths) {
      try {
        console.log('Trying:', path);
        const resource = await cloudinary.api.resource(path, { resource_type: 'raw' });
        console.log('✅ Found at:', path);
        
        const response = await fetch(resource.secure_url);
        const profileData = await response.json();
        
        return res.json({ success: true, profile: profileData, exists: true });
      } catch (err) {
        continue;
      }
    }

    console.log('❌ Profile not found in any location');
    return res.json({ success: true, profile: null, exists: false });

  } catch (error) {
    console.error('❌ Error:', error);
    return res.json({ success: true, profile: null, exists: false });
  }
});

app.get('/api/all-profiles', async (req, res) => {
  try {
    const result = await cloudinary.api.resources({
      type: 'upload',
      resource_type: 'raw',
      prefix: 'career_profiles',
      max_results: 500
    });

    const profiles = result.resources.map((resource) => {
      const fileName = resource.public_id.split('/').pop();
      const emailFromFile = fileName.replace(/_/g, '@').replace('.json', '').replace('@', '_', 1);
      
      return {
        public_id: resource.public_id,
        url: resource.secure_url,
        fileName: fileName,
        createdAt: resource.created_at,
        bytes: resource.bytes
      };
    });

    res.json({
      success: true,
      total: profiles.length,
      profiles: profiles
    });
  } catch (error) {
    console.error('Error fetching all profiles:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
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

// ✨ SMART CAREER GUIDANCE - Using Best Available Models
app.post('/api/generate-career-guidance', async (req, res) => {
  try {
    const { email, forceRegenerate } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    console.log('🎯 Checking career guidance for:', email);

    // 1. Find and load profile JSON
    const sanitizedEmail = email.replace(/[@.]/g, '_');
    const paths = [
      `career_profiles/${sanitizedEmail}`,
      `career_profiles/${sanitizedEmail}.json`,
      `career_profiles/career_profiles/${sanitizedEmail}`,
      `career_profiles/career_profiles/${sanitizedEmail}.json`
    ];

    let fullProfile = null;
    let resourcePath = null;

    for (const path of paths) {
      try {
        const resource = await cloudinary.api.resource(path, { resource_type: 'raw' });
        const response = await fetch(resource.secure_url);
        fullProfile = await response.json();
        resourcePath = resource.public_id;
        console.log(`✅ Found profile at: ${path}`);
        break;
      } catch (err) {
        continue;
      }
    }

    if (!fullProfile) {
      return res.status(404).json({ 
        error: 'Profile not found',
        message: 'Please complete your profile first' 
      });
    }

    // 2. ✅ CHECK: Does gotResponse: 1 exist?
    if (fullProfile.gotResponse === 1 && fullProfile.aiGuidance && !forceRegenerate) {
      console.log('✅ gotResponse: 1 found! Returning cached guidance (no API call)');
      return res.json({
        success: true,
        guidance: fullProfile.aiGuidance,
        cached: true,
        message: 'Guidance retrieved from cache',
        generatedAt: fullProfile.aiGuidance.generatedAt
      });
    }

    // 3. No guidance yet OR force regenerate → Call Gemini
    console.log('📡 No guidance found. Calling Gemini API...');
    
    const careerData = extractCareerInputs(fullProfile);
    const prompt = buildPrompt(careerData);

    // 4. ✅ Try BEST Models (based on your API key capabilities)
    const API_KEY = process.env.GEMINI_API_KEY;
    const modelsToTry = [
      'gemini-2.5-flash',       // ✅ 65K output, 250 RPD
      'gemini-2.5-flash-lite',  // ✅ 65K output, 1000 RPD
      'gemini-2.0-flash'        // ✅ Backup: 8K output
    ];

    let aiResponse = null;
    let usedModel = null;

    for (const model of modelsToTry) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;
        
        console.log(`   Trying ${model}...`);
        
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { 
              temperature: 0.7, 
              maxOutputTokens: 8000  // ✅ Safe limit for all models
            }
          })
        });

        if (response.ok) {
          const data = await response.json();
          
          // Check if truncated
          if (data.candidates?.[0]?.finishReason === 'MAX_TOKENS') {
            console.log(`   ⚠️ ${model} hit token limit, trying next...`);
            continue;
          }
          
          // Get response
          if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
            aiResponse = data.candidates[0].content.parts[0].text;
            usedModel = model;
            console.log(`   ✅ SUCCESS with ${model}`);
            break;
          }
        } else {
          const errorData = await response.json();
          console.log(`   ❌ ${model} failed:`, errorData.error?.message || response.status);
          
          // If quota exceeded, wait and try next model
          if (errorData.error?.message?.includes('quota')) {
            console.log(`   ⏳ Quota exceeded, trying next model...`);
            continue;
          }
        }
      } catch (err) {
        console.log(`   ❌ ${model} failed:`, err.message);
      }
    }

    if (!aiResponse) {
      return res.status(500).json({
        error: 'All Gemini models failed',
        message: 'Could not generate guidance. Please try again later or check your quota.'
      });
    }

    // 5. Parse AI response
    let guidanceData;
    try {
      const jsonMatch = aiResponse.match(/```json\n([\s\S]*?)\n```/) || aiResponse.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : aiResponse;
      guidanceData = JSON.parse(jsonText);
      console.log('✅ Parsed AI response as JSON');
    } catch (parseError) {
      console.log('⚠️  AI response not JSON, using as text');
      guidanceData = { 
        assessment: aiResponse,
        rawText: aiResponse
      };
    }

    // 6. Build final guidance object
    const aiGuidance = {
      ...guidanceData,
      generatedAt: new Date().toISOString(),
      modelUsed: usedModel,
      version: '1.0'
    };

    // 7. ✅ APPEND to existing JSON: Add aiGuidance + gotResponse: 1
    fullProfile.aiGuidance = aiGuidance;
    fullProfile.gotResponse = 1;

    // 8. Save updated JSON back to Cloudinary
    const jsonContent = JSON.stringify(fullProfile, null, 2);
    await cloudinary.uploader.upload(
      `data:application/json;base64,${Buffer.from(jsonContent).toString('base64')}`,
      {
        resource_type: 'raw',
        public_id: resourcePath,
        overwrite: true
      }
    );

    console.log('✅ Guidance saved! Added gotResponse: 1 to JSON');

    return res.json({ 
      success: true, 
      guidance: aiGuidance,
      cached: false,
      message: 'New guidance generated and saved',
      generatedAt: aiGuidance.generatedAt,
      modelUsed: usedModel
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
    return res.status(500).json({ 
      error: 'Failed to generate guidance', 
      message: error.message
    });
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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
