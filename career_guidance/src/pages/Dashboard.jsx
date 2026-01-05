/* eslint-disable no-unused-vars */
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import './Dashboard.css';




// ✅ Component to display guidance in nice format
function GuidanceDisplay({ guidance }) {
  return (
    <div style={{ padding: '20px' }}>
      {/* Assessment */}
      {guidance.assessment && (
        <Section title="📊 Overall Assessment">
          <p style={{ lineHeight: '1.8', color: '#2d3748', fontSize: '16px' }}>
            {guidance.assessment}
          </p>
          {guidance.readiness_score && (
            <div style={{ 
              marginTop: '16px', 
              padding: '12px 20px', 
              background: '#667eea', 
              color: 'white', 
              borderRadius: '8px', 
              display: 'inline-block',
              fontWeight: '600'
            }}>
              Readiness Score: {guidance.readiness_score}
            </div>
          )}
        </Section>
      )}

      {/* Strengths */}
      {guidance.strengths && guidance.strengths.length > 0 && (
        <Section title="💪 Your Strengths">
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {guidance.strengths.map((strength, i) => (
              <li key={i} style={{ 
                padding: '12px 0', 
                display: 'flex', 
                alignItems: 'start', 
                gap: '12px',
                borderBottom: '1px solid #e2e8f0'
              }}>
                <span style={{ color: '#10b981', fontSize: '20px', flexShrink: 0 }}>✓</span>
                <span style={{ fontSize: '15px', lineHeight: '1.6' }}>{strength}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Skill Gaps */}
      {guidance.skill_gaps && guidance.skill_gaps.length > 0 && (
        <Section title="🎯 Areas to Improve">
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {guidance.skill_gaps.map((gap, i) => (
              <li key={i} style={{ 
                padding: '12px 0', 
                display: 'flex', 
                alignItems: 'start', 
                gap: '12px',
                borderBottom: '1px solid #e2e8f0'
              }}>
                <span style={{ color: '#f59e0b', fontSize: '20px', flexShrink: 0 }}>⚠</span>
                <span style={{ fontSize: '15px', lineHeight: '1.6' }}>{gap}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Career Paths */}
      {guidance.career_paths && guidance.career_paths.length > 0 && (
        <Section title="🚀 Recommended Career Paths">
          {guidance.career_paths.map((path, i) => (
            <CareerPathCard key={i} path={path} />
          ))}
        </Section>
      )}

      {/* Learning Roadmap */}
      {guidance.learning_roadmap && guidance.learning_roadmap.length > 0 && (
        <Section title="📚 Learning Roadmap">
          {guidance.learning_roadmap.map((item, i) => (
            <LearningRoadmapCard key={i} item={item} />
          ))}
        </Section>
      )}

      {/* Action Plan */}
      {guidance.action_plan && guidance.action_plan.length > 0 && (
        <Section title="📅 Action Plan">
          <div style={{ display: 'grid', gap: '16px' }}>
            {guidance.action_plan.map((action, i) => (
              <div key={i} style={{ 
                padding: '20px', 
                background: '#f7fafc', 
                borderRadius: '8px', 
                borderLeft: '4px solid #667eea' 
              }}>
                <strong style={{ color: '#667eea', fontSize: '16px' }}>
                  Month {action.month}
                </strong>
                <p style={{ margin: '8px 0 0 0', lineHeight: '1.7', color: '#2d3748' }}>
                  {action.action}
                </p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Higher Education */}
      {guidance.higher_education && (
        <Section title="🎓 Higher Education Advice">
          <p style={{ lineHeight: '1.8', color: '#2d3748', fontSize: '15px' }}>
            {guidance.higher_education}
          </p>
        </Section>
      )}

      {/* Branding Tips */}
      {guidance.branding_tips && (
        <Section title="🌟 Personal Branding Tips">
          {guidance.branding_tips.github && (
            <div style={{ marginBottom: '20px', padding: '16px', background: '#f7fafc', borderRadius: '8px' }}>
              <h4 style={{ color: '#181717', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>💻</span> GitHub
              </h4>
              <p style={{ margin: 0, lineHeight: '1.7', color: '#4a5568' }}>{guidance.branding_tips.github}</p>
            </div>
          )}
          {guidance.branding_tips.linkedin && (
            <div style={{ marginBottom: '20px', padding: '16px', background: '#f7fafc', borderRadius: '8px' }}>
              <h4 style={{ color: '#0077b5', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>💼</span> LinkedIn
              </h4>
              <p style={{ margin: 0, lineHeight: '1.7', color: '#4a5568' }}>{guidance.branding_tips.linkedin}</p>
            </div>
          )}
          {guidance.branding_tips.portfolio && (
            <div style={{ marginBottom: '20px', padding: '16px', background: '#f7fafc', borderRadius: '8px' }}>
              <h4 style={{ color: '#667eea', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>🎨</span> Portfolio
              </h4>
              <p style={{ margin: 0, lineHeight: '1.7', color: '#4a5568' }}>{guidance.branding_tips.portfolio}</p>
            </div>
          )}
        </Section>
      )}

      {/* Generation info */}
      {guidance.generatedAt && (
        <div style={{ 
          marginTop: '32px', 
          padding: '12px', 
          background: '#e2e8f0', 
          borderRadius: '8px', 
          textAlign: 'center', 
          fontSize: '12px', 
          color: '#64748b' 
        }}>
          Generated on {new Date(guidance.generatedAt).toLocaleString()}
          {guidance.modelUsed && ` using ${guidance.modelUsed}`}
        </div>
      )}
    </div>
  );
}

// Section wrapper
function Section({ title, children }) {
  return (
    <div style={{ marginBottom: '40px' }}>
      <h3 style={{ 
        color: '#1a202c', 
        fontSize: '20px', 
        marginBottom: '20px', 
        borderBottom: '2px solid #e2e8f0', 
        paddingBottom: '10px',
        fontWeight: '600'
      }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

// Career Path Card
function CareerPathCard({ path }) {
  const matchColor = path.match === 'High' ? '#10b981' : path.match?.includes('Medium') ? '#f59e0b' : '#6b7280';
  
  return (
    <div style={{ 
      padding: '24px', 
      background: '#ffffff', 
      borderRadius: '12px', 
      marginBottom: '20px', 
      border: '2px solid #e2e8f0',
      boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
        <h4 style={{ color: '#1a202c', fontSize: '18px', margin: 0, fontWeight: '600' }}>{path.title}</h4>
        <span style={{ 
          background: matchColor, 
          color: 'white', 
          padding: '6px 14px', 
          borderRadius: '20px', 
          fontSize: '13px',
          fontWeight: '600'
        }}>
          {path.match} Match
        </span>
      </div>
      <p style={{ color: '#4a5568', lineHeight: '1.7', marginBottom: '16px', fontSize: '15px' }}>
        {path.reason}
      </p>
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', fontSize: '14px', color: '#64748b' }}>
        {path.salary_range && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '16px' }}>💰</span>
            <strong style={{ color: '#2d3748' }}>{path.salary_range}</strong>
          </div>
        )}
        {path.companies && path.companies.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '16px' }}>🏢</span>
            <strong style={{ color: '#2d3748' }}>{path.companies.slice(0, 3).join(', ')}</strong>
            {path.companies.length > 3 && <span> +{path.companies.length - 3} more</span>}
          </div>
        )}
      </div>
    </div>
  );
}

// Learning Roadmap Card
function LearningRoadmapCard({ item }) {
  const priorityColor = item.priority === 'High' ? '#dc2626' : item.priority === 'Medium' ? '#f59e0b' : '#10b981';
  
  return (
    <div style={{ 
      padding: '20px', 
      background: '#ffffff', 
      border: '1px solid #e2e8f0', 
      borderRadius: '12px', 
      marginBottom: '16px' 
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
        <h4 style={{ color: '#1a202c', fontSize: '16px', margin: 0, fontWeight: '600' }}>{item.skill}</h4>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ color: priorityColor, fontSize: '13px', fontWeight: '600' }}>
            {item.priority} Priority
          </span>
          {item.duration && (
            <span style={{ 
              background: '#e2e8f0', 
              padding: '4px 12px', 
              borderRadius: '12px', 
              fontSize: '12px',
              color: '#4a5568'
            }}>
              {item.duration}
            </span>
          )}
        </div>
      </div>
      <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '12px', lineHeight: '1.6' }}>
        {item.importance}
      </p>
      {item.resources && (
        <div style={{ display: 'grid', gap: '8px' }}>
          {item.resources.free && item.resources.free.length > 0 && (
            <div style={{ fontSize: '14px' }}>
              <strong style={{ color: '#10b981' }}>📚 Free:</strong> {item.resources.free.join(', ')}
            </div>
          )}
          {item.resources.paid && item.resources.paid.length > 0 && (
            <div style={{ fontSize: '14px' }}>
              <strong style={{ color: '#667eea' }}>💎 Paid:</strong> {item.resources.paid.join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


export default function Dashboard() {
  const { currentUser, signOut } = useAuth();
  const navigate = useNavigate();
  
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [showWelcomePopup, setShowWelcomePopup] = useState(false);
  const [maxStepReached, setMaxStepReached] = useState(1); 
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
const [isSubmitting, setIsSubmitting] = useState(false);
const [profileExists, setProfileExists] = useState(false);
const [profileLoading, setProfileLoading] = useState(true);



const [showGuidance, setShowGuidance] = useState(false);
const [careerGuidance, setCareerGuidance] = useState('');
const [guidanceLoading, setGuidanceLoading] = useState(false);
const [guidanceError, setGuidanceError] = useState(null);




  
  const [formData, setFormData] = useState({
  // Personal Details
  fullName: '',
  dob: '',
  country: '',
  state: '',
  city: '',
  
  // School Education
  schoolName: '',
  tenthPercentage: '',
  twelfthPercentage: '',
  twelfthStream: '',
  
  // Higher Education
  educationLevel: '',
  collegeName: '',
  collegeStartYear: '',
  collegeEndYear: '',
  currentYear: '',
  degree: '',
   degreeOther: '',           // NEW: For "Other" degree
  department: '',
    departmentOther: '',       // NEW: For "Other" department

  currentCGPA: '',
  finalCGPA: '',
  
  // Technical Skills - FIXED: Initialize as array
  technicalSkills: [],
  otherTechnicalSkill: '',
  
  // Soft Skills - FIXED: Initialize as array
  softSkills: [],
  otherSoftSkill: '',
  
  // Career Interests
  careerInterestArea: '',
    careerInterestAreaOther: '', // NEW: For "Other" career area
  preferredJobType: '',
   preferredLocation: '',        // NEW
     salaryRange: '',              // NEW
  higherStudiesPlan: '',

  
  // Professional Links - NEW
  linkedinUrl: '',
  githubUrl: '',
  portfolioUrl: ''
});

  

useEffect(() => {
  const checkProfile = async () => {
    if (currentUser?.email) {
      setProfileLoading(true);
      try {
        console.log('Checking profile for:', currentUser.email); // DEBUG
        
        const response = await fetch(
          `http://localhost:5000/api/get-profile/${currentUser.email}`
        );
        const data = await response.json();
        
        console.log('Backend response:', data); // DEBUG
        
        if (data.exists && data.profile) {
          // Profile exists - extract form fields
          const {
            email,
            username,
            submittedAt,
            ...profileFormData
          } = data.profile;
          
          console.log('Setting form data:', profileFormData); // DEBUG
          
          // Fill the form
          setFormData(prev => ({
            ...prev,
            ...profileFormData
          }));
          
          setProfileExists(true);
          
          // DO NOT show welcome popup
          console.log('Profile found - skipping welcome popup'); // DEBUG
          
        } else {
          // No profile found
          console.log('No profile found - will show welcome popup'); // DEBUG
          setProfileExists(false);
          
          // Show welcome popup after 10 seconds ONLY if no profile
          setTimeout(() => {
            setShowWelcomePopup(true);
          }, 10000);
        }
      } catch (error) {
        console.error('Error checking profile:', error);
        // On error, don't show popup
        setProfileExists(false);
      } finally {
        setProfileLoading(false);
      }
    }
  };

  checkProfile();
}, [currentUser]);



  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/');
    } catch (err) {
      alert(err.message);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCheckboxChange = (category, value) => {
    setFormData(prev => ({
      ...prev,
      [category]: prev[category].includes(value)
        ? prev[category].filter(item => item !== value)
        : [...prev[category], value]
    }));
  };

  const nextStep = () => {
  if (currentStep < 5) {
    const newStep = currentStep + 1;
    setCurrentStep(newStep);
    // Track the maximum step reached
    if (newStep > maxStepReached) {
      setMaxStepReached(newStep);
    }
  }
};

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };


  const handleSubmit = async () => {
  setIsSubmitting(true);

  try {
    // Step 1: Save profile to Cloudinary
    const saveResponse = await fetch('http://localhost:5000/api/save-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: currentUser?.email,
        profileData: formData
      })
    });

    const saveData = await saveResponse.json();

    if (saveData.success) {
      setProfileExists(true);
      setShowDialog(false);
      
      // Step 2: Get AI career guidance
      setGuidanceLoading(true);
      setShowGuidance(true);
      
      try {
        const guidanceResponse = await fetch('http://localhost:5000/api/get-career-guidance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profileData: formData })
        });

        const guidanceData = await guidanceResponse.json();
        
        if (guidanceData.success) {
          setCareerGuidance(guidanceData.guidance);
        } else {
          setCareerGuidance('❌ Failed to generate career guidance. Please try again later.');
        }
      } catch (guidanceError) {
        console.error('Guidance error:', guidanceError);
        setCareerGuidance('❌ Error connecting to AI service. Please try again later.');
      }
      
      setGuidanceLoading(false);
      setCurrentStep(1);
      setMaxStepReached(1);
    } else {
      alert('Failed to save profile: ' + (saveData.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('Error saving profile:', error);
    alert('Failed to save profile. Please try again.');
  } finally {
    setIsSubmitting(false);
  }
};


  const skipForNow = () => {
    setShowWelcomePopup(false);
  };


  const fetchCareerGuidance = async () => {
  if (!profileExists) {
    alert('Please complete your profile first!');
    return;
  }
  
  setShowGuidance(true);
  setGuidanceLoading(true);
  setGuidanceError(null);
  
  try {
    const response = await fetch('http://localhost:5000/api/generate-career-guidance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        email: currentUser?.email,
        forceRegenerate: true  // ✅ ADD THIS - Always regenerate
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      setCareerGuidance(data.guidance);
    } else {
      setGuidanceError(data.error || 'Failed to generate guidance');
    }
  } catch (error) {
    console.error('Error:', error);
    setGuidanceError(error.message);
  } finally {
    setGuidanceLoading(false);
  }
};


  const technicalSkillsList = [
    'C', 'C++', 'Java', 'Python', 'C#', 'JavaScript', 'HTML', 'CSS',
    'Bootstrap', 'React', 'Angular', 'Vue.js', 'Node.js', '.NET', 'SQL',
    'MongoDB', 'Git', 'Linux', 'Azure', 'AWS', 'Docker', 'Kubernetes',
    'Machine Learning', 'Artificial Intelligence', 'Data Science',
    'Blockchain', 'Quantum Computing', 'Cybersecurity', 'Cloud Computing',
    'DevOps', 'Django', 'Spring Boot', 'Flask', 'Express.js'
  ];

  const softSkillsList = [
    'Communication', 'Leadership', 'Teamwork', 'Problem Solving',
    'Critical Thinking', 'Time Management', 'Adaptability', 'Creativity',
    'Emotional Intelligence', 'Conflict Resolution', 'Presentation Skills',
    'Project Management', 'Analytical Skills', 'Decision Making'
  ];

  const degrees = [
    'Diploma', 'B.A', 'B.Sc', 'B.Com', 'BCA', 'BBA', 'B.E / B.Tech',
    'M.A', 'M.Sc', 'M.Com', 'MCA', 'MBA', 'M.E / M.Tech', 'Other'
  ];

  const departments = [
    'Computer Science', 'Information Technology', 'Electronics & Communication',
    'Electrical Engineering', 'Mechanical Engineering', 'Civil Engineering',
    'Artificial Intelligence / Data Science', 'Commerce', 'Business Administration',
    'Economics', 'Mathematics', 'Physics', 'Chemistry', 'English', 'Biotechnology',
    'Aerospace Engineering', 'Chemical Engineering', 'Other'
  ];

  const careerAreas = [
    'Software Development', 'Data Science & Analytics', 'Cybersecurity',
    'Cloud Computing', 'AI/ML Engineering', 'Web Development',
    'Mobile App Development', 'DevOps Engineering', 'UI/UX Design',
    'Digital Marketing', 'Business Analytics', 'Product Management',
    'Consulting', 'Finance', 'Healthcare', 'Education', 'Research',
    'Government Services', 'Entrepreneurship', 'Other'
  ];

  const jobTypes = [
    'Full-time', 'Part-time', 'Internship', 'Freelance',
    'Remote', 'Hybrid', 'Contract', 'Startup'
  ];

  return (
    <div className="dashboard-container">
      {/* Navbar */}
      <nav className="navbar">
        <div className="navbar-brand">
          <h2>Career Guidance</h2>
        </div>
        <div className="navbar-menu">
          <a href="#home">Home</a>
          <a href="#courses">Courses</a>
          <a href="#resources">Resources</a>
          <a href="#about">About</a>
        </div>
        <div className="navbar-profile">
          <button 
            className="profile-button"
            onClick={() => setShowProfileMenu(!showProfileMenu)}
          >
            <div className="profile-avatar">
              {currentUser?.email?.charAt(0).toUpperCase()}
            </div>
            <span>{currentUser?.email?.split('@')[0]}</span>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" fill="none"/>
            </svg>
          </button>
          
       
       {showProfileMenu && (
  <div className="profile-dropdown">
    <div className="profile-info">
      <p className="profile-email">{currentUser?.email}</p>
    </div>
    <div className="profile-divider"></div>
    
    {/* UPDATE THIS BUTTON */}
    <button onClick={() => {
      setShowDialog(true);
      setShowProfileMenu(false);
    }}>
      {profileExists ? 'View/Edit Profile' : 'Complete Profile'}
    </button>
    
    <button onClick={() => setShowProfileMenu(false)}>Settings</button>
    <div className="profile-divider"></div>
    <button onClick={handleLogout} className="logout-btn">Logout</button>
  </div>
)}


        </div>
      </nav>

    {/* Add this after navbar, before main content */}
{profileLoading && (
  <div style={{ padding: 40, textAlign: 'center' }}>
    <p>Loading your profile...</p>
  </div>
)}


      {/* Main Content */}
      <div className="dashboard-content">
        <div className="welcome-section">
          <h1>Welcome back, {currentUser?.email?.split('@')[0]}!</h1>
          <p>Ready to explore your career path?,click here for suggestion</p>
        </div>

        

        <div className="dashboard-cards">
          <div className="dashboard-card">
            <div className="card-icon">📚</div>
            <h3>You have to study courses</h3>
            <p>The more the courses and certifications you do it makes you stronger</p>
          </div>
         
         <div 
  className="dashboard-card" 
  onClick={fetchCareerGuidance}
  style={{ cursor: 'pointer' }}
>
  <div className="card-icon">🎯</div>
  <h3>Career Path</h3>
  <p>{profileExists ? 'View AI Recommendations' : 'Complete profile first'}</p>
</div>

          <div className="dashboard-card">
            <div className="card-icon">📊</div>
            <h3>Progress</h3>
            <p>Track your learning journey</p>
            <p>click here </p>
          </div>
          <div className="dashboard-card">
            <div className="card-icon">💼</div>
            <h3>Job Opportunities</h3>
            <p>Explore career options</p>
          </div>
        </div>
      </div>

      {/* Welcome Popup */}
     {/* Welcome Popup - Only show if profile doesn't exist */}
{showWelcomePopup && !profileExists && (
  <div className="popup-overlay">
    <div className="popup-card">
      <div className="popup-header">
        <h2>🎉 Welcome to Career Guidance!</h2>
        <p>Complete your profile to get personalized career recommendations</p>
      </div>
      <div className="popup-actions">
        <button className="btn-primary" onClick={() => {
          setShowDialog(true);
          setShowWelcomePopup(false);
        }}>
          Get Started
        </button>
        <button className="btn-secondary" onClick={skipForNow}>
          Skip for Now
        </button>
      </div>
    </div>
  </div>
)}


      {/* Profile Dialog */}
      {showDialog && (
        <div className="dialog-overlay">
          <div className="dialog-container">
            {/* Progress Stepper */}
       
       {/* Progress Stepper - Clickable only for visited steps */}
<div className="stepper">
  {[1, 2, 3, 4, 5].map((step) => (
    <div 
      key={step} 
      className={`step ${currentStep >= step ? 'active' : ''} ${currentStep > step ? 'completed' : ''}`}
      onClick={() => {
        // Can only click on steps that have been reached before
        if (step <= maxStepReached) {
          setCurrentStep(step);
        }
      }}
      style={{ 
        cursor: step <= maxStepReached ? 'pointer' : 'not-allowed',
        opacity: step <= maxStepReached ? 1 : 0.5
      }}
    >
      <div className="step-number">
        {currentStep > step ? '✓' : step}
      </div>
      <div className="step-label">
        {step === 1 && 'Personal'}
        {step === 2 && 'Education'}
        {step === 3 && 'Technical Skills'}
        {step === 4 && 'Soft Skills'}
        {step === 5 && 'Career Goals'}
      </div>
    </div>
  ))}
</div>


            <div className="dialog-content">
              {/* Step 1: Personal Details */}
              {currentStep === 1 && (
                <div className="form-step">
                  <h2>Personal Details</h2>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Full Name *</label>
                      <input
                        type="text"
                        name="fullName"
                        value={formData.fullName}
                        onChange={handleInputChange}
                        placeholder="Enter your full name"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Date of Birth *</label>
                      <input
                        type="date"
                        name="dob"
                        value={formData.dob}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Country *</label>
                      <input
                        type="text"
                        name="country"
                        value={formData.country}
                        onChange={handleInputChange}
                        placeholder="Enter your country"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>State *</label>
                      <input
                        type="text"
                        name="state"
                        value={formData.state}
                        onChange={handleInputChange}
                        placeholder="Enter your state"
                        required
                      />
                    </div>
                    <div className="form-group full-width">
                      <label>City *</label>
                      <input
                        type="text"
                        name="city"
                        value={formData.city}
                        onChange={handleInputChange}
                        placeholder="Enter your city"
                        required
                      />
                    </div>
                  </div>
                </div>
              )}

             {/* Step 2: Education Details */}
               {/* Step 2: Education Details */}
{currentStep === 2 && (
  <div className="form-step">
    <h2>Education Details</h2>
    
    <div className="form-grid">
      <div className="form-group full-width">
        <label>Current Education Status *</label>
        <select
          name="educationLevel"
          value={formData.educationLevel}
          onChange={handleInputChange}
          required
        >
          <option value="">Select your current status</option>
          <option value="12th-completed">Completed 12th - Looking for college</option>
          <option value="diploma">Diploma</option>
          <option value="studying-college">Currently Studying in College</option>
          <option value="undergraduate">Undergraduate Completed</option>
          <option value="postgraduate">Postgraduate Completed</option>
          <option value="working">Already Working (No degree)</option>
        </select>
      </div>

      {formData.educationLevel && (
        <>
          {/* School Details */}
          <div className="form-group">
            <label>School Name *</label>
            <input
              type="text"
              name="schoolName"
              value={formData.schoolName}
              onChange={handleInputChange}
              placeholder="Enter your school name"
              required
            />
          </div>

          <div className="form-group">
            <label>10th Percentage/CGPA *</label>
            <input
              type="text"
              name="tenthPercentage"
              value={formData.tenthPercentage}
              onChange={handleInputChange}
              placeholder="e.g., 85% or 8.5 CGPA"
              required
            />
          </div>

          {formData.educationLevel !== '10th' && (
            <>
              <div className="form-group">
                <label>12th Percentage/CGPA *</label>
                <input
                  type="text"
                  name="twelfthPercentage"
                  value={formData.twelfthPercentage}
                  onChange={handleInputChange}
                  placeholder="e.g., 90% or 9.0 CGPA"
                  required
                />
              </div>

              <div className="form-group">
                <label>12th Stream *</label>
                <select
                  name="twelfthStream"
                  value={formData.twelfthStream}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">Select stream</option>
                  <option value="Computer Science (Maths)">Computer Science (Maths)</option>
                  <option value="Bilogy">Bilogy</option>

                  <option value="Pure Science">Pure Science</option>
                  <option value="Commerce">Commerce</option>
                  <option value="Arts">Arts/Humanities</option>
                  <option value="Vocational">Vocational</option>
                </select>
              </div>
            </>
          )}

          {/* College Details */}
          {['diploma', 'studying-college', 'undergraduate', 'postgraduate'].includes(formData.educationLevel) && (
            <>
              <div className="form-group full-width">
                <label>College/University Name *</label>
                <input
                  type="text"
                  name="collegeName"
                  value={formData.collegeName}
                  onChange={handleInputChange}
                  placeholder="Enter your college/university name"
                  required
                />
              </div>

              {/* Degree with Other option */}
              <div className="form-group">
                <label>Degree/Course *</label>
                <select
                  name="degree"
                  value={formData.degree}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">Select degree</option>
                  <option value="Diploma">Diploma</option>
                  <option value="B.A">B.A</option>
                  <option value="B.Sc">B.Sc</option>
                  <option value="B.Com">B.Com</option>
                  <option value="BCA">BCA</option>
                  <option value="BBA">BBA</option>
                  <option value="B.E / B.Tech">B.E / B.Tech</option>
                  <option value="M.A">M.A</option>
                  <option value="M.Sc">M.Sc</option>
                  <option value="M.Com">M.Com</option>
                  <option value="MCA">MCA</option>
                  <option value="MBA">MBA</option>
                  <option value="M.E / M.Tech">M.E / M.Tech</option>
                  <option value="Other">Other (Please specify)</option>
                </select>
              </div>

              {/* Show text input if "Other" is selected */}
              {formData.degree === 'Other' && (
                <div className="form-group">
                  <label>Please specify your degree *</label>
                  <input
                    type="text"
                    name="degreeOther"
                    value={formData.degreeOther || ''}
                    onChange={handleInputChange}
                    placeholder="e.g., B.Des, B.Arch, etc."
                    required
                  />
                </div>
              )}

              {/* Department with Other option */}
              <div className="form-group">
                <label>Department/Specialization *</label>
                <select
                  name="department"
                  value={formData.department}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">Select department</option>
                  <option value="Computer Science">Computer Science</option>
                  <option value="Information Technology">Information Technology</option>
                  <option value="Electronics & Communication">Electronics & Communication</option>
                  <option value="Electrical Engineering">Electrical Engineering</option>
                  <option value="Mechanical Engineering">Mechanical Engineering</option>
                  <option value="Civil Engineering">Civil Engineering</option>
                  <option value="AI & Data Science">Artificial Intelligence / Data Science</option>
                  <option value="Commerce">Commerce</option>
                  <option value="Business Administration">Business Administration</option>
                  <option value="Economics">Economics</option>
                  <option value="Mathematics">Mathematics</option>
                  <option value="Physics">Physics</option>
                  <option value="Chemistry">Chemistry</option>
                  <option value="English">English</option>
                  <option value="Biotechnology">Biotechnology</option>
                  <option value="Aerospace Engineering">Aerospace Engineering</option>
                  <option value="Chemical Engineering">Chemical Engineering</option>
                  <option value="Other">Other (Please specify)</option>
                </select>
              </div>

              {/* Show text input if "Other" is selected */}
              {formData.department === 'Other' && (
                <div className="form-group">
                  <label>Please specify your department *</label>
                  <input
                    type="text"
                    name="departmentOther"
                    value={formData.departmentOther || ''}
                    onChange={handleInputChange}
                    placeholder="e.g., Fashion Design, Agriculture, etc."
                    required
                  />
                </div>
              )}

              <div className="form-group">
                <label>Start Year *</label>
                <input
                  type="number"
                  name="collegeStartYear"
                  value={formData.collegeStartYear}
                  onChange={handleInputChange}
                  placeholder="2020"
                  min="1990"
                  max="2030"
                  required
                />
              </div>

              {formData.educationLevel === 'studying-college' ? (
                <>
                  <div className="form-group">
                    <label>Expected End Year *</label>
                    <input
                      type="number"
                      name="collegeEndYear"
                      value={formData.collegeEndYear}
                      onChange={handleInputChange}
                      placeholder="2024"
                      min="2024"
                      max="2035"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Current Year of Study *</label>
                    <select
                      name="currentYear"
                      value={formData.currentYear}
                      onChange={handleInputChange}
                      required
                    >
                      <option value="">Select year</option>
                      <option value="1">1st Year</option>
                      <option value="2">2nd Year</option>
                      <option value="3">3rd Year</option>
                      <option value="4">4th Year</option>
                      <option value="5">5th Year</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Current CGPA/Percentage</label>
                    <input
                      type="text"
                      name="currentCGPA"
                      value={formData.currentCGPA}
                      onChange={handleInputChange}
                      placeholder="e.g., 8.5 CGPA or 85%"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="form-group">
                    <label>End Year *</label>
                    <input
                      type="number"
                      name="collegeEndYear"
                      value={formData.collegeEndYear}
                      onChange={handleInputChange}
                      placeholder="2024"
                      min="1990"
                      max="2030"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Final CGPA/Percentage *</label>
                    <input
                      type="text"
                      name="finalCGPA"
                      value={formData.finalCGPA}
                      onChange={handleInputChange}
                      placeholder="e.g., 8.5 CGPA or 85%"
                      required
                    />
                  </div>
                </>
              )}
            </>
          )}

          {formData.educationLevel === '12th-completed' && (
            <div className="form-group full-width">
              <div className="info-message">
                <p>💡 Great! You can explore various undergraduate programs based on your 12th performance.</p>
              </div>
            </div>
          )}

          {formData.educationLevel === 'working' && (
            <div className="form-group full-width">
              <div className="info-message">
                <p>💼 You're in the workforce! We'll help guide your career growth path.</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  </div>
)}



              {/* Step 3: Technical Skills */}
              {currentStep === 3 && (
                <div className="form-step">
                  <h2>Technical Skills</h2>
                  <p className="step-description">Select all the technical skills you have</p>
                  <div className="skills-grid">
                    {technicalSkillsList.map(skill => (
                      <label key={skill} className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={formData.technicalSkills.includes(skill)}
                          onChange={() => handleCheckboxChange('technicalSkills', skill)}
                        />
                        <span>{skill}</span>
                      </label>
                    ))}
                  </div>
                  <div className="form-group">
                    <label>Other Technical Skills</label>
                    <input
                      type="text"
                      name="otherTechnicalSkill"
                      value={formData.otherTechnicalSkill}
                      onChange={handleInputChange}
                      placeholder="Enter any other technical skills (comma separated)"
                    />
                  </div>
                </div>
              )}

              {/* Step 4: Soft Skills */}
              {currentStep === 4 && (
                <div className="form-step">
                  <h2>Soft Skills</h2>
                  <p className="step-description">Select your soft skills</p>
                  <div className="skills-grid">
                    {softSkillsList.map(skill => (
                      <label key={skill} className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={formData.softSkills.includes(skill)}
                          onChange={() => handleCheckboxChange('softSkills', skill)}
                        />
                        <span>{skill}</span>
                      </label>
                    ))}
                  </div>
                  <div className="form-group">
                    <label>Other Soft Skills</label>
                    <input
                      type="text"
                      name="otherSoftSkill"
                      value={formData.otherSoftSkill}
                      onChange={handleInputChange}
                      placeholder="Enter any other soft skills (comma separated)"
                    />
                  </div>
                </div>
              )}

              {/* Step 5: Career Goals */}
{currentStep === 5 && (
  <div className="form-step">
    <h2>Career Goals & Professional Profile</h2>
    
    <div className="form-grid">
      {/* Career Interest Area with Other option */}
      <div className="form-group full-width">
        <label>Career Interest Area *</label>
        <select
          name="careerInterestArea"
          value={formData.careerInterestArea}
          onChange={handleInputChange}
          required
        >
          <option value="">Select career area</option>
          <option value="Software Development">Software Development</option>
          <option value="Data Science & Analytics">Data Science & Analytics</option>
          <option value="Cybersecurity">Cybersecurity</option>
          <option value="Cloud Computing">Cloud Computing</option>
          <option value="AI/ML Engineering">AI/ML Engineering</option>
          <option value="Web Development">Web Development</option>
          <option value="Mobile App Development">Mobile App Development</option>
          <option value="DevOps Engineering">DevOps Engineering</option>
          <option value="UI/UX Design">UI/UX Design</option>
          <option value="Digital Marketing">Digital Marketing</option>
          <option value="Business Analytics">Business Analytics</option>
          <option value="Product Management">Product Management</option>
          <option value="Consulting">Consulting</option>
          <option value="Finance">Finance</option>
          <option value="Healthcare">Healthcare</option>
          <option value="Education">Education</option>
          <option value="Research">Research</option>
          <option value="Government Services">Government Services</option>
          <option value="Entrepreneurship">Entrepreneurship</option>
          <option value="Other">Other (Please specify)</option>
        </select>
      </div>

      {/* Show text input if "Other" is selected */}
      {formData.careerInterestArea === 'Other' && (
        <div className="form-group full-width">
          <label>Please specify your career interest *</label>
          <input
            type="text"
            name="careerInterestAreaOther"
            value={formData.careerInterestAreaOther || ''}
            onChange={handleInputChange}
            placeholder="e.g., Game Development, Animation, Content Writing, etc."
            required
          />
        </div>
      )}

      <div className="form-group">
        <label>Preferred Job Type *</label>
        <select
          name="preferredJobType"
          value={formData.preferredJobType}
          onChange={handleInputChange}
          required
        >
          <option value="">Select job type</option>
          <option value="Full-time">Full-time</option>
          <option value="Part-time">Part-time</option>
          <option value="Internship">Internship</option>
          <option value="Freelance">Freelance</option>
          <option value="Remote">Remote</option>
          <option value="Hybrid">Hybrid</option>
          <option value="Contract">Contract</option>
          <option value="Startup">Startup</option>
        </select>
      </div>

      <div className="form-group">
        <label>Preferred Work Location (Optional)</label>
        <input
          type="text"
          name="preferredLocation"
          value={formData.preferredLocation || ''}
          onChange={handleInputChange}
          placeholder="e.g., Bangalore, Mumbai, Remote"
        />
      </div>

      <div className="form-group full-width">
        <label>Expected Salary Range (Optional)</label>
        <select
          name="salaryRange"
          value={formData.salaryRange || ''}
          onChange={handleInputChange}
        >
          <option value="">Select salary expectation</option>
          <option value="0-3L">₹0 - 3 LPA (Fresher/Entry Level)</option>
          <option value="3-6L">₹3 - 6 LPA</option>
          <option value="6-10L">₹6 - 10 LPA</option>
          <option value="10-15L">₹10 - 15 LPA</option>
          <option value="15-20L">₹15 - 20 LPA</option>
          <option value="20L+">₹20 LPA+</option>
        </select>
      </div>

      <div className="form-group full-width">
        <label>Plans for Higher Studies? *</label>
        <div className="radio-group">
          <label className="radio-label">
            <input
              type="radio"
              name="higherStudiesPlan"
              value="yes"
              checked={formData.higherStudiesPlan === 'yes'}
              onChange={handleInputChange}
            />
            <span>Yes, I plan to pursue higher studies</span>
          </label>
          <label className="radio-label">
            <input
              type="radio"
              name="higherStudiesPlan"
              value="no"
              checked={formData.higherStudiesPlan === 'no'}
              onChange={handleInputChange}
            />
            <span>No, I want to start working</span>
          </label>
          <label className="radio-label">
            <input
              type="radio"
              name="higherStudiesPlan"
              value="maybe"
              checked={formData.higherStudiesPlan === 'maybe'}
              onChange={handleInputChange}
            />
            <span>Not decided yet</span>
          </label>
        </div>
      </div>

      {/* Professional Links Section */}
      <div className="form-group full-width">
        <div style={{ 
          borderTop: '2px solid #e2e8f0', 
          paddingTop: '24px', 
          marginTop: '16px' 
        }}>
          <h3 style={{ 
            fontSize: '18px', 
            color: '#667eea', 
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            🔗 Professional Links <span style={{ fontSize: '14px', color: '#a0aec0', fontWeight: 'normal' }}>(Optional)</span>
          </h3>
        </div>
      </div>

      <div className="form-group">
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#0077b5">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
          </svg>
          LinkedIn Profile
        </label>
        <input
          type="url"
          name="linkedinUrl"
          value={formData.linkedinUrl || ''}
          onChange={handleInputChange}
          placeholder="https://linkedin.com/in/yourprofile"
        />
      </div>

      <div className="form-group">
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#181717">
            <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
          </svg>
          GitHub Profile
        </label>
        <input
          type="url"
          name="githubUrl"
          value={formData.githubUrl || ''}
          onChange={handleInputChange}
          placeholder="https://github.com/yourusername"
        />
      </div>

      <div className="form-group full-width">
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#667eea">
            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2zm-1 4v12l10-6-10-6z"/>
          </svg>
          Portfolio / Personal Website
        </label>
        <input
          type="url"
          name="portfolioUrl"
          value={formData.portfolioUrl || ''}
          onChange={handleInputChange}
          placeholder="https://yourportfolio.com"
        />
        <small style={{ 
          color: '#718096', 
          fontSize: '12px', 
          marginTop: '4px',
          display: 'block'
        }}>
          Share your personal website, Behance, Dribbble, or any portfolio link
        </small>
      </div>
    </div>
  </div>
)}


                </div>

         {/* Dialog Actions */}
<div className="dialog-actions">
  <button
    className="btn-secondary"
    onClick={() => {
      setShowDialog(false);
      setCurrentStep(1);
      setMaxStepReached(1); // ADD THIS LINE
    }}
  >
    Cancel
  </button>
  <div className="action-buttons">
    {currentStep > 1 && (
      <button className="btn-outline" onClick={prevStep}>
        Previous
      </button>
    )}
   {currentStep < 5 ? (
  <button className="btn-primary" onClick={nextStep}>
    Next
  </button>
) : (
  <button 
    className="btn-primary" 
    onClick={handleSubmit}
    disabled={isSubmitting}
  >
    {isSubmitting ? 'Saving...' : 'Complete Profile'}
  </button>
)}

  </div>
</div>



          </div>
        </div>
      )}

      {/* Success Dialog */}
{showSuccessDialog && (
  <div className="dialog-overlay">
    <div className="success-dialog">
      <div className="success-icon">
        <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
          <circle cx="40" cy="40" r="40" fill="#48bb78" fillOpacity="0.1"/>
          <circle cx="40" cy="40" r="32" fill="#48bb78" fillOpacity="0.2"/>
          <path 
            d="M25 40L35 50L55 30" 
            stroke="#48bb78" 
            strokeWidth="4" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <h2>Profile Completed Successfully! 🎉</h2>
      <p>Your career guidance profile has been saved.</p>
      <p className="success-subtext">
        We'll use this information to provide you with personalized career recommendations.
      </p>
      <button 
        className="btn-primary" 
        onClick={() => setShowSuccessDialog(false)}
        style={{ marginTop: '20px' }}
      >
        Continue to Dashboard
      </button>
    </div>
  </div>
)}




{/* Career Guidance Dialog - UPDATED */}
{showGuidance && (
  <div className="dialog-overlay">
    <div className="dialog-container" style={{ maxWidth: '1000px', maxHeight: '90vh', overflow: 'auto' }}>
      <div className="dialog-content">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ color: '#667eea', margin: 0 }}>🎯 Your Personalized Career Guidance</h2>
          <button 
            onClick={() => setShowGuidance(false)}
            style={{ 
              background: 'none', 
              border: 'none', 
              fontSize: '24px', 
              cursor: 'pointer', 
              color: '#718096' 
            }}
          >
            ✕
          </button>
        </div>

        {guidanceLoading ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ 
              width: '50px',
              height: '50px', 
              border: '4px solid #e2e8f0', 
              borderTop: '4px solid #667eea', 
              borderRadius: '50%', 
              animation: 'spin 1s linear infinite', 
              margin: '0 auto 20px' 
            }}></div>
            <p style={{ fontSize: '18px', color: '#667eea', fontWeight: '600' }}>
              🤖 Analyzing your profile with Gemini AI...
            </p>
            <p style={{ fontSize: '14px', color: '#718096', marginTop: '8px' }}>
              This may take 10-15 seconds
            </p>
          </div>
        ) : guidanceError ? (
          <div style={{ textAlign: 'center', padding: '40px', background: '#fee2e2', borderRadius: '8px' }}>
            <p style={{ color: '#dc2626', fontSize: '16px', marginBottom: '16px' }}>
              ❌ Error: {guidanceError}
            </p>
            <button className="btn-primary" onClick={fetchCareerGuidance}>
              🔄 Try Again
            </button>
          </div>
        ) : careerGuidance ? (
          // ✅ THIS IS THE KEY PART - Use GuidanceDisplay component
          typeof careerGuidance === 'object' ? (
            <GuidanceDisplay guidance={careerGuidance} />
          ) : (
            <div style={{ 
              padding: '20px', 
              background: '#fff3cd', 
              borderRadius: '8px',
              border: '1px solid #ffc107'
            }}>
              <p style={{ color: '#856404', marginBottom: '12px', fontWeight: 'bold' }}>
                ⚠️ Received text response instead of structured data
              </p>
              <div style={{ 
                whiteSpace: 'pre-wrap', 
                lineHeight: '1.8',
                color: '#333',
                background: 'white',
                padding: '16px',
                borderRadius: '6px'
              }}>
                {careerGuidance}
              </div>
            </div>
          )
        ) : (
          <p style={{ textAlign: 'center', padding: '40px', color: '#718096' }}>
            No guidance available yet
          </p>
        )}
      </div>
    </div>
  </div>
)}


    </div>
  );
}
