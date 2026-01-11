/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-unused-vars */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Calender.css';

export default function Calendar() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [profileData, setProfileData] = useState(null);
  const [careerRoadmap, setCareerRoadmap] = useState(null);
  const [calendarMode, setCalendarMode] = useState('normal');
  const [syncStatus, setSyncStatus] = useState('disconnected');

  useEffect(() => {
    if (!currentUser) {
      navigate('/');
      return;
    }
    initializeCalendar();
  }, [currentUser]);

  const initializeCalendar = async () => {
    try {
      setLoading(true);
      
      // 1. Fetch profile
      const profileRes = await fetch(`https://careerguidance-10.onrender.com/api/get-profile/${currentUser.email}`);
      const profileData = await profileRes.json();
      
      if (!profileData.exists) {
        alert('⚠️ Please complete your profile first!');
        navigate('/dashboard');
        return;
      }
      
      setProfileData(profileData.profile);

      // 2. Fetch AI roadmap (with fallback)
      try {
        const roadmapRes = await fetch('https://careerguidance-10.onrender.com/api/generate-calendar-roadmap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: currentUser.email })
        });
        
        const roadmapData = await roadmapRes.json();
        
        if (roadmapData.success) {
          setCareerRoadmap(roadmapData.roadmap);
          
          // Convert to events
          const events = roadmapData.roadmap.milestones.map((m, i) => ({
            id: i + 1,
            title: m.title,
            date: m.targetDate,
            description: m.description,
            category: m.category || 'learning',
            icon: getCategoryIcon(m.category),
            completed: false
          }));
          
          setCalendarEvents(events);
        }
      } catch (roadmapError) {
        console.error('Roadmap generation failed:', roadmapError);
        alert('⚠️ AI roadmap unavailable. Using default template.');
      }

      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const getCategoryIcon = (category) => {
    const icons = {
      learning: '📚',
      project: '💻',
      hackathon: '🏆',
      interview: '💼',
      job: '🎯'
    };
    return icons[category] || '📅';
  };

  const exportToGoogleCalendar = () => {
    if (!careerRoadmap?.milestones) {
      alert('⚠️ No roadmap available. Please refresh.');
      return;
    }
    
    let ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//AI Career Guidance//Roadmap//EN
X-WR-CALNAME:Career Roadmap
`;

    careerRoadmap.milestones.forEach((m, i) => {
      const date = new Date(m.targetDate);
      const dateStr = date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      
      ics += `BEGIN:VEVENT
UID:${Date.now()}-${i}@careerguidance.app
DTSTART:${dateStr}
SUMMARY:${m.title}
DESCRIPTION:${m.description}
END:VEVENT
`;
    });
    
    ics += `END:VCALENDAR`;
    
    const blob = new Blob([ics], { type: 'text/calendar' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `career-roadmap.ics`;
    link.click();
    
    alert('✅ Downloaded! Import to Google Calendar: Settings → Import & Export');
  };

  if (loading) {
    return (
      <div className="calendar-container">
        <div className="loading-screen">
          <div className="spinner"></div>
          <p>Loading your AI Career Calendar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="calendar-container">
      {/* Header */}
      <div className="calendar-header">
        <button className="btn-back" onClick={() => navigate('/dashboard')}>
          ← Back to Dashboard
        </button>
        <div>
          <h1>🗓️ AI Career Calendar</h1>
          <p>Your personalized learning roadmap</p>
        </div>
        <select 
          value={calendarMode} 
          onChange={(e) => setCalendarMode(e.target.value)}
          style={{ padding: '10px', borderRadius: '8px' }}
        >
          <option value="normal">Normal Mode</option>
          <option value="placement">Placement Season</option>
          <option value="intensive">Intensive Learning</option>
        </select>
      </div>

      {/* Stats */}
      <div className="calendar-stats">
        <StatCard icon="📅" label="Total Events" value={calendarEvents.length} color="#667eea" />
        <StatCard icon="✅" label="Completed" value={0} color="#10b981" />
        <StatCard icon="⏰" label="Upcoming" value={calendarEvents.length} color="#f59e0b" />
        <StatCard icon="🔥" label="Streak" value={0} color="#ef4444" />
      </div>

      {/* Roadmap */}
      {careerRoadmap && (
        <div className="roadmap-section">
          <h2>🎯 {careerRoadmap.careerPath} Roadmap</h2>
          <p>{careerRoadmap.description}</p>
          
          <div className="roadmap-timeline">
            {careerRoadmap.milestones.map((m, i) => (
              <MilestoneCard key={i} milestone={m} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* Export Section */}
      <div className="calendar-sync-section">
        <div className="sync-card">
          <h3>📥 Export to Google Calendar</h3>
          <button className="btn-export" onClick={exportToGoogleCalendar}>
            Download Calendar File
          </button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }) {
  return (
    <div className="stat-card" style={{ borderLeftColor: color }}>
      <div className="stat-icon">{icon}</div>
      <div>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  );
}

function MilestoneCard({ milestone, index }) {
  return (
    <div className="milestone-card">
      <div className="milestone-number">{index + 1}</div>
      <div className="milestone-content">
        <h4>{milestone.title}</h4>
        <p>{milestone.description}</p>
        <div className="milestone-date">{milestone.targetDate}</div>
      </div>
    </div>
  );
}
